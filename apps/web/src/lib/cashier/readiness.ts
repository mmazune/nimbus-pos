import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getCashierActiveShift, getCashierActiveTill } from "@/lib/cashier/api";
import type { CashierReadinessItem, CashierReadinessTone } from "@/lib/cashier/state";

type CashierReadinessStatus = "loading" | "active" | "inactive" | "failed" | "unavailable";

export type CashierReadinessState = {
  status: CashierReadinessStatus;
  label: string;
  detail: string;
  tone: CashierReadinessTone;
};

export type CashierReadinessSnapshot = {
  shift: CashierReadinessState;
  till: CashierReadinessState;
  items: CashierReadinessItem[];
  shiftQuery: ReturnType<typeof useQuery>;
  tillQuery: ReturnType<typeof useQuery>;
};

function isOpen(value?: string | null) {
  return value?.toUpperCase() === "OPEN";
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function pendingState(label: string): CashierReadinessState {
  return {
    status: "loading",
    label,
    detail: label,
    tone: "neutral",
  };
}

function unavailableState(label: string, detail: string): CashierReadinessState {
  return {
    status: "unavailable",
    label,
    detail,
    tone: "neutral",
  };
}

export function useCashierReadiness(): CashierReadinessSnapshot {
  const { accessToken, branchId, clearSession, isCashier, isAuthenticated } = useAuth();
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isCashier);

  const shiftQuery = useQuery({
    queryKey: ["cashier", "active-shift", branchId],
    enabled: canQuery,
    queryFn: () => getCashierActiveShift(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 30_000,
  });

  const tillQuery = useQuery({
    queryKey: ["cashier", "active-till", branchId],
    enabled: canQuery,
    queryFn: () => getCashierActiveTill(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    const error = shiftQuery.error || tillQuery.error;
    if (error instanceof ApiError && error.isAuthError) {
      clearSession();
    }
  }, [clearSession, shiftQuery.error, tillQuery.error]);

  const shift = useMemo<CashierReadinessState>(() => {
    if (!canQuery) {
      if (!isAuthenticated) {
        return unavailableState("Shift check pending", "Session check pending.");
      }
      if (!isCashier) {
        return unavailableState("Shift check pending", "Cashier access required.");
      }
      return unavailableState("Shift check pending", "Branch context unavailable.");
    }
    if (shiftQuery.isLoading) return pendingState("Shift check pending");
    if (shiftQuery.isError) {
      return {
        status: "failed",
        label: "Shift check failed",
        detail: `${errorMessage(shiftQuery.error, "Could not read active shift state.")} Retry before checkout.`,
        tone: "danger",
      };
    }
    if (shiftQuery.data && isOpen(shiftQuery.data.status)) {
      return {
        status: "active",
        label: "Shift active",
        detail: shiftQuery.data.shiftNumber
          ? `Active shift ${shiftQuery.data.shiftNumber}.`
          : "Active shift confirmed.",
        tone: "success",
      };
    }
    return {
      status: "inactive",
      label: "No active shift",
      detail: "Shift is not active. Payment actions will stay blocked.",
      tone: "warning",
    };
  }, [canQuery, isAuthenticated, isCashier, shiftQuery.data, shiftQuery.error, shiftQuery.isError, shiftQuery.isLoading]);

  const till = useMemo<CashierReadinessState>(() => {
    if (!canQuery) {
      if (!isAuthenticated) {
        return unavailableState("Till check pending", "Session check pending.");
      }
      if (!isCashier) {
        return unavailableState("Till check pending", "Cashier access required.");
      }
      return unavailableState("Till check pending", "Branch context unavailable.");
    }
    if (tillQuery.isLoading) return pendingState("Till check pending");
    if (tillQuery.isError) {
      return {
        status: "failed",
        label: "Till check failed",
        detail: `${errorMessage(tillQuery.error, "Could not read active till state.")} Cash payments remain blocked.`,
        tone: "danger",
      };
    }
    if (tillQuery.data && isOpen(tillQuery.data.status)) {
      return {
        status: "active",
        label: "Till active",
        detail: tillQuery.data.tillCode
          ? `Active till ${tillQuery.data.tillCode}.`
          : "Active till confirmed.",
        tone: "success",
      };
    }
    return {
      status: "inactive",
      label: "No active till",
      detail: "Cash payments will stay blocked until a till is active.",
      tone: "warning",
    };
  }, [canQuery, isAuthenticated, isCashier, tillQuery.data, tillQuery.error, tillQuery.isError, tillQuery.isLoading]);

  const items = useMemo<CashierReadinessItem[]>(
    () => [
      {
        key: "shift",
        label: "Shift",
        value: shift.label,
        tone: shift.tone,
      },
      {
        key: "till",
        label: "Till",
        value: till.label,
        tone: till.tone,
      },
      {
        key: "providers",
        label: "Provider mode",
        value: "Manual/stub only",
        tone: "info",
      },
    ],
    [shift.label, shift.tone, till.label, till.tone],
  );

  return {
    shift,
    till,
    items,
    shiftQuery,
    tillQuery,
  };
}
