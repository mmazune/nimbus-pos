import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import {
  createAccountRequest,
  createBudgetRequest,
  createCostCenterRequest,
  createDemandCalendarEntryRequest,
  getBudgetRequest,
  getDemandCalendarEntryRequest,
  getForecastRequest,
  getTaxConfigRequest,
  listBudgetsRequest,
  listChartOfAccountsRequest,
  listCostCentersRequest,
  listDemandCalendarRequest,
  listPostingSourceMapsRequest,
  refreshBudgetActualsRequest,
  refreshForecastRequest,
  updateDemandCalendarEntryRequest,
  updatePostingSourceMapRequest,
  updateTaxConfigRequest,
  type CreateAccountPayload,
  type CreateBudgetPayload,
  type CreateCostCenterPayload,
  type CreateDemandCalendarEntryPayload,
  type ForecastParams,
  type ListBudgetsParams,
  type ListChartOfAccountsParams,
  type ListDemandCalendarParams,
  type RefreshBudgetActualsPayload,
  type UpdateDemandCalendarEntryPayload,
  type UpdatePostingSourceMapPayload,
  type UpdateTaxConfigPayload,
} from "@/lib/accounting/write-api";
import type {
  BudgetRow,
  ChartAccountRow,
  CostCenterRow,
  DemandCalendarEntryRow,
  ForecastRunRow,
  PostingSourceMapRow,
  TaxLedgerConfigRow,
} from "@/lib/accounting/types";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Accounting Configuration + Reporting — WRITE-ENABLED React Query bindings,
 * Track B5.6 (2026-08-22).
 *
 * A deliberately SEPARATE file from `accounting-surface-queries.ts`, which
 * only ever mounts `useQuery` — this one also mounts `useMutation`, the
 * dividing line `scripts/manager-b5-assertions.ts` uses to scope the write
 * ban to exactly the seven B5.6 surfaces. Same contract as every other
 * accounting surface file otherwise: every key is
 * `["manager", "accounting-<surface>", branchId, ...params]` via
 * `managerQueryKey`, reads are NOT polled (`refetchInterval: false` — a list a
 * manager is actively editing should not reshuffle under them), and every
 * mutation invalidates only its OWN surface's query-key prefix — never a
 * blanket `["manager"]` sweep (CLAUDE.md §15).
 */

type EnabledParams = { enabled: boolean; token: string; scope: string; branchId: string | null };

function useAccountingAuth(): EnabledParams {
  const { accessToken, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  const branchId = branch.branchId;
  const enabled = Boolean(accessToken && branchId && isAuthenticated && isManager);
  return {
    enabled,
    token: (accessToken as string) || "",
    scope: (branchId as string) || "",
    branchId,
  };
}

/** True 404 ("no config exists yet") is a distinct, non-error empty state — never conflated with a network/permission failure. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export function useBudgetsList(params: ListBudgetsParams): UseQueryResult<BudgetRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-budgets-list", branchId, params),
    queryFn: () => listBudgetsRequest(token, scope, params),
  });
}

export function useBudgetDetail(id: string | null): UseQueryResult<BudgetRow> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-budget", branchId, id),
    queryFn: () => getBudgetRequest(token, scope, id as string),
  });
}

export function useCreateBudget() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBudgetPayload) => createBudgetRequest(token, scope, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-budgets-list", branchId) });
    },
  });
}

export function useRefreshBudgetActuals() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: RefreshBudgetActualsPayload }) =>
      refreshBudgetActualsRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-budgets-list", branchId) }),
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-budget", branchId, variables.id) }),
      ]);
    },
  });
}

// ── Demand calendar ──────────────────────────────────────────────────────────

export function useDemandCalendarList(
  params: ListDemandCalendarParams,
): UseQueryResult<DemandCalendarEntryRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-demand-calendar-list", branchId, params),
    queryFn: () => listDemandCalendarRequest(token, scope, params),
  });
}

export function useDemandCalendarEntryDetail(id: string | null): UseQueryResult<DemandCalendarEntryRow> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-demand-calendar-entry", branchId, id),
    queryFn: () => getDemandCalendarEntryRequest(token, scope, id as string),
  });
}

export function useCreateDemandCalendarEntry() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDemandCalendarEntryPayload) =>
      createDemandCalendarEntryRequest(token, scope, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: managerQueryKey("accounting-demand-calendar-list", branchId),
      });
    },
  });
}

export function useUpdateDemandCalendarEntry() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDemandCalendarEntryPayload }) =>
      updateDemandCalendarEntryRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-demand-calendar-list", branchId) }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKey("accounting-demand-calendar-entry", branchId, variables.id),
        }),
      ]);
    },
  });
}

// ── Forecast ─────────────────────────────────────────────────────────────────

export function useForecast(params: ForecastParams): UseQueryResult<ForecastRunRow> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-forecast", branchId, params),
    queryFn: () => getForecastRequest(token, scope, params),
  });
}

export function useRefreshForecast(params: ForecastParams) {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshForecastRequest(token, scope, params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-forecast", branchId) });
    },
  });
}

// ── Chart of accounts ────────────────────────────────────────────────────────

export function useChartOfAccountsList(
  params: ListChartOfAccountsParams,
): UseQueryResult<{ data?: ChartAccountRow[]; total?: number }> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-chart-of-accounts-list", branchId, params),
    queryFn: () => listChartOfAccountsRequest(token, scope, params),
  });
}

export function useCreateAccount() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAccountPayload) => createAccountRequest(token, scope, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-chart-of-accounts-list", branchId) }),
        // A new account can immediately be chosen as a Posting source map debit/credit account.
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-posting-source-maps-list", branchId) }),
      ]);
    },
  });
}

// ── Cost centres ─────────────────────────────────────────────────────────────

export function useCostCentersList(): UseQueryResult<CostCenterRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-cost-centres-list", branchId),
    queryFn: () => listCostCentersRequest(token, scope),
  });
}

export function useCreateCostCenter() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCostCenterPayload) => createCostCenterRequest(token, scope, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-cost-centres-list", branchId) });
    },
  });
}

// ── Posting source maps ──────────────────────────────────────────────────────

export function usePostingSourceMapsList(): UseQueryResult<PostingSourceMapRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-posting-source-maps-list", branchId),
    queryFn: () => listPostingSourceMapsRequest(token, scope),
  });
}

export function useUpdatePostingSourceMap() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePostingSourceMapPayload }) =>
      updatePostingSourceMapRequest(token, scope, id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: managerQueryKey("accounting-posting-source-maps-list", branchId),
      });
    },
  });
}

// ── Tax configuration ────────────────────────────────────────────────────────

export function useTaxConfig(): UseQueryResult<TaxLedgerConfigRow> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    // A 404 means "not configured yet" — a real, final answer, not a
    // transient failure worth retrying once (unlike every other query here).
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 1,
    refetchInterval: false,
    queryKey: managerQueryKey("accounting-tax-config", branchId),
    queryFn: () => getTaxConfigRequest(token, scope),
  });
}

export function useUpdateTaxConfig() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTaxConfigPayload) => updateTaxConfigRequest(token, scope, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-tax-config", branchId) });
    },
  });
}
