import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  createManagerExchangeRate,
  getManagerOrgSettings,
  listManagerExchangeRates,
  updateManagerCurrency,
  updateManagerGeneralSettings,
  updateManagerRounding,
  updateManagerTaxMatrix,
  updateManagerThresholds,
} from "@/lib/manager/settings-api";
import { managerQueryKey } from "@/lib/manager/state";
import type { ManagerExchangeRate, ManagerExchangeRateDraft, ManagerOrgSettings } from "@/lib/manager/settings-types";

/**
 * Manager Settings — React Query binding (Track B6).
 *
 * Every write mutation, on success, invalidates the SAME `["manager", "settings", …]`
 * key the read query uses (never the whole Manager namespace) and — because
 * `OrgSettings` is a true org-level singleton, not branch data — the re-fetch is
 * `await`ed so the form re-renders from the server's own post-write value, never
 * an optimistic guess.
 */

const SETTINGS_STALE_TIME = 15_000;

function useManagerSettingsSession() {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  return {
    accessToken,
    branchId: branch.branchId,
    clearSession,
    isEnabled: Boolean(accessToken && branch.branchId && isAuthenticated && isManager),
  };
}

function useAuthErrorGuard(clearSession: () => void, errors: readonly unknown[]) {
  const hasAuthError = errors.some((error) => error instanceof ApiError && error.isAuthError);
  useEffect(() => {
    if (hasAuthError) clearSession();
  }, [clearSession, hasAuthError]);
}

export type ManagerSettingsSnapshot = {
  isEnabled: boolean;
  query: UseQueryResult<ManagerOrgSettings>;
  saveCurrency: (input: { currency: string; baseCurrencyCode?: string }) => Promise<void>;
  saveTaxMatrix: (input: { defaultVatPct: number; categories: { name: string; vatPct: number }[] }) => Promise<void>;
  saveRounding: (input: { mode: "NEAREST" | "UP" | "DOWN"; increment: number }) => Promise<void>;
  saveThresholds: (input: {
    lateVoidMin: number;
    heavyDiscountUGX: number;
    discountApprovalThreshold: string;
  }) => Promise<void>;
  saveGeneral: (
    input: Partial<{
      reservationHoldMinutes: number;
      receiptFooter: string;
      showCostToChef: boolean;
      attendance: Record<string, unknown>;
      inventoryTolerance: Record<string, unknown>;
    }>,
  ) => Promise<void>;
  isSaving: boolean;
  saveError: unknown;
  clearSaveError: () => void;
};

export function useManagerSettings(): ManagerSettingsSnapshot {
  const session = useManagerSettingsSession();
  const queryClient = useQueryClient();
  const key = managerQueryKey("settings", session.branchId);

  const query = useQuery({
    queryKey: key,
    enabled: session.isEnabled,
    staleTime: SETTINGS_STALE_TIME,
    retry: 1,
    queryFn: () => getManagerOrgSettings(session.accessToken as string, session.branchId as string),
  });

  async function refetchAfterWrite() {
    await queryClient.invalidateQueries({ queryKey: key });
  }

  const currencyMutation = useMutation({
    mutationFn: (input: { currency: string; baseCurrencyCode?: string }) =>
      updateManagerCurrency(session.accessToken as string, session.branchId as string, input),
    onSuccess: refetchAfterWrite,
  });

  const taxMatrixMutation = useMutation({
    mutationFn: (input: { defaultVatPct: number; categories: { name: string; vatPct: number }[] }) =>
      updateManagerTaxMatrix(session.accessToken as string, session.branchId as string, input),
    onSuccess: refetchAfterWrite,
  });

  const roundingMutation = useMutation({
    mutationFn: (input: { mode: "NEAREST" | "UP" | "DOWN"; increment: number }) =>
      updateManagerRounding(session.accessToken as string, session.branchId as string, input),
    onSuccess: refetchAfterWrite,
  });

  const thresholdsMutation = useMutation({
    mutationFn: (input: { lateVoidMin: number; heavyDiscountUGX: number; discountApprovalThreshold: string }) =>
      updateManagerThresholds(session.accessToken as string, session.branchId as string, input),
    onSuccess: refetchAfterWrite,
  });

  const generalMutation = useMutation({
    mutationFn: (
      input: Partial<{
        reservationHoldMinutes: number;
        receiptFooter: string;
        showCostToChef: boolean;
        attendance: Record<string, unknown>;
        inventoryTolerance: Record<string, unknown>;
      }>,
    ) => updateManagerGeneralSettings(session.accessToken as string, session.branchId as string, input),
    onSuccess: refetchAfterWrite,
  });

  useAuthErrorGuard(session.clearSession, [
    query.error,
    currencyMutation.error,
    taxMatrixMutation.error,
    roundingMutation.error,
    thresholdsMutation.error,
    generalMutation.error,
  ]);

  const activeMutation =
    (currencyMutation.error && currencyMutation) ||
    (taxMatrixMutation.error && taxMatrixMutation) ||
    (roundingMutation.error && roundingMutation) ||
    (thresholdsMutation.error && thresholdsMutation) ||
    (generalMutation.error && generalMutation) ||
    null;

  return {
    isEnabled: session.isEnabled,
    query,
    saveCurrency: async (input) => {
      await currencyMutation.mutateAsync(input);
    },
    saveTaxMatrix: async (input) => {
      await taxMatrixMutation.mutateAsync(input);
    },
    saveRounding: async (input) => {
      await roundingMutation.mutateAsync(input);
    },
    saveThresholds: async (input) => {
      await thresholdsMutation.mutateAsync(input);
    },
    saveGeneral: async (input) => {
      await generalMutation.mutateAsync(input);
    },
    isSaving:
      currencyMutation.isPending ||
      taxMatrixMutation.isPending ||
      roundingMutation.isPending ||
      thresholdsMutation.isPending ||
      generalMutation.isPending,
    saveError: activeMutation?.error ?? null,
    clearSaveError: () => {
      currencyMutation.reset();
      taxMatrixMutation.reset();
      roundingMutation.reset();
      thresholdsMutation.reset();
      generalMutation.reset();
    },
  };
}

// ── Exchange rates ──────────────────────────────────────────────────────────

export type ManagerExchangeRatesSnapshot = {
  isEnabled: boolean;
  query: UseQueryResult<ManagerExchangeRate[]>;
  create: (draft: ManagerExchangeRateDraft) => void;
  isCreating: boolean;
  createError: unknown;
  resetCreate: () => void;
};

export function useManagerExchangeRates(): ManagerExchangeRatesSnapshot {
  const session = useManagerSettingsSession();
  const queryClient = useQueryClient();
  const key = managerQueryKey("settings-exchange-rates", session.branchId);

  const query = useQuery({
    queryKey: key,
    enabled: session.isEnabled,
    staleTime: SETTINGS_STALE_TIME,
    retry: 1,
    queryFn: () => listManagerExchangeRates(session.accessToken as string, session.branchId as string),
  });

  const mutation = useMutation({
    mutationFn: (draft: ManagerExchangeRateDraft) =>
      createManagerExchangeRate(session.accessToken as string, session.branchId as string, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  useAuthErrorGuard(session.clearSession, [query.error, mutation.error]);

  return {
    isEnabled: session.isEnabled,
    query,
    create: (draft) => {
      if (!session.isEnabled || mutation.isPending) return;
      mutation.mutate(draft);
    },
    isCreating: mutation.isPending,
    createError: mutation.error,
    resetCreate: () => mutation.reset(),
  };
}

export function useManagerSettingsErrorMessage(error: unknown) {
  return useMemo(() => {
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.isForbidden) return "This account is not permitted to make that change.";
      return error.message;
    }
    return "The request failed. Try again when the connection is stable.";
  }, [error]);
}
