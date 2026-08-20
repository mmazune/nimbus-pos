import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getManagerDashboardRequest,
  getManagerLowStockRequest,
  getManagerOpenAnomalyCountRequest,
  getManagerOpenOrdersRequest,
  getManagerPaymentMixRequest,
  getManagerPendingDiscountCountRequest,
  getManagerPendingLeaveCountRequest,
  getManagerPendingShiftSwapCountRequest,
  getManagerTodaySummaryRequest,
  refreshManagerKpiRequest,
} from "@/lib/manager/dashboard-api";
import type {
  ManagerApprovalCount,
  ManagerDashboardResponse,
  ManagerLowStockResponse,
  ManagerOpenOrdersResponse,
  ManagerPaymentMixResponse,
  ManagerTodaySummaryResponse,
} from "@/lib/manager/dashboard-types";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Manager Overview dashboard — React Query binding (Track B2).
 *
 * Performance contract (CLAUDE.md §15, roadmap B2 acceptance gate):
 *
 * - **Nine bounded requests**, all issued once per branch on mount. Nothing here
 *   fans out per card, per row, or per render.
 * - Every key is `["manager", <surface>, <branchId>]` via `managerQueryKey`, so a
 *   branch switch re-scopes through the existing narrow
 *   `invalidateQueries({ queryKey: ["manager"] })` in `ManagerBranchProvider` and
 *   a stale branch's numbers can never paint under a new branch's name.
 * - **Polled, not streamed** (MP0-07 / NG-14 — see `dashboard-api.ts`). One shared
 *   interval constant, `refetchOnWindowFocus` left at the app default (`false`),
 *   so a background tab does not generate traffic.
 * - Each card owns its own query, so ONE failing endpoint degrades ONE card
 *   instead of blanking the dashboard — and a failed card renders its error state,
 *   never its last-known or a zeroed number.
 */

/** 60s. Slow enough not to be a request storm, fast enough to be a service dashboard. */
export const MANAGER_DASHBOARD_POLL_MS = 60_000;

export const MANAGER_DASHBOARD_SURFACES = [
  "dashboard-manager",
  "dashboard-today-summary",
  "dashboard-payment-mix",
  "dashboard-open-orders",
  "dashboard-low-stock",
  "dashboard-approvals-discount",
  "dashboard-approvals-leave",
  "dashboard-approvals-shift-swap",
  "dashboard-approvals-anomaly",
] as const;

export type ManagerDashboardSnapshot = {
  branchId: string | null;
  currencyCode: string | null;
  /** False when there is no branch or no session — every query stays disabled. */
  isEnabled: boolean;
  managerQuery: UseQueryResult<ManagerDashboardResponse>;
  todaySummaryQuery: UseQueryResult<ManagerTodaySummaryResponse>;
  paymentMixQuery: UseQueryResult<ManagerPaymentMixResponse>;
  openOrdersQuery: UseQueryResult<ManagerOpenOrdersResponse>;
  lowStockQuery: UseQueryResult<ManagerLowStockResponse>;
  approvalQueries: Record<ManagerApprovalCount["domain"], UseQueryResult<ManagerApprovalCount>>;
  /** Newest `calculatedAt` across the two endpoints that report one. */
  calculatedAt: string | null;
  /** True while any card is loading for the first time. */
  isInitialLoading: boolean;
  refresh: {
    /** Runs POST /dash/kpi/refresh, then re-reads every dashboard query. */
    run: () => void;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    /** ISO timestamp of the last successful refresh in this session, if any. */
    lastRefreshedAt: string | null;
  };
};

export function useManagerDashboard(): ManagerDashboardSnapshot {
  const queryClient = useQueryClient();
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  const branchId = branch.branchId;
  const isEnabled = Boolean(accessToken && branchId && isAuthenticated && isManager);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const shared = {
    enabled: isEnabled,
    refetchInterval: isEnabled ? MANAGER_DASHBOARD_POLL_MS : false,
    retry: 1,
  } as const;

  const managerQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-manager", branchId),
    queryFn: () => getManagerDashboardRequest(accessToken as string, branchId as string),
  });

  const todaySummaryQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-today-summary", branchId),
    queryFn: () => getManagerTodaySummaryRequest(accessToken as string, branchId as string),
  });

  const paymentMixQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-payment-mix", branchId),
    queryFn: () => getManagerPaymentMixRequest(accessToken as string, branchId as string),
  });

  const openOrdersQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-open-orders", branchId),
    queryFn: () => getManagerOpenOrdersRequest(accessToken as string, branchId as string),
  });

  const lowStockQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-low-stock", branchId),
    queryFn: () => getManagerLowStockRequest(accessToken as string, branchId as string),
  });

  const discountApprovalsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-approvals-discount", branchId),
    queryFn: () => getManagerPendingDiscountCountRequest(accessToken as string, branchId as string),
  });

  const leaveApprovalsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-approvals-leave", branchId),
    queryFn: () => getManagerPendingLeaveCountRequest(accessToken as string, branchId as string),
  });

  const shiftSwapApprovalsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-approvals-shift-swap", branchId),
    queryFn: () => getManagerPendingShiftSwapCountRequest(accessToken as string, branchId as string),
  });

  const anomalyApprovalsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("dashboard-approvals-anomaly", branchId),
    queryFn: () => getManagerOpenAnomalyCountRequest(accessToken as string, branchId as string),
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshManagerKpiRequest(accessToken as string, branchId as string),
    onSuccess: async (snapshot) => {
      setLastRefreshedAt(snapshot?.calculatedAt || new Date().toISOString());
      // NARROW: exactly the nine dashboard keys for THIS branch. Never the whole
      // manager namespace (that would also drop the shell's readiness reads), and
      // never `queryClient.clear()`.
      await Promise.all(
        MANAGER_DASHBOARD_SURFACES.map((surface) =>
          queryClient.invalidateQueries({ queryKey: managerQueryKey(surface, branchId) }),
        ),
      );
    },
  });

  const errors = [
    managerQuery.error,
    todaySummaryQuery.error,
    paymentMixQuery.error,
    openOrdersQuery.error,
    lowStockQuery.error,
    discountApprovalsQuery.error,
    leaveApprovalsQuery.error,
    shiftSwapApprovalsQuery.error,
    anomalyApprovalsQuery.error,
    refreshMutation.error,
  ];

  useEffect(() => {
    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) clearSession();
    // The error identities are the dependency; listing the array itself is stable enough
    // because React Query keeps error references until the next settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSession, ...errors]);

  const runRefresh = useCallback(() => {
    if (!isEnabled || refreshMutation.isPending) return;
    refreshMutation.mutate();
  }, [isEnabled, refreshMutation]);

  const calculatedAt = useMemo(() => {
    const stamps = [managerQuery.data?.calculatedAt, todaySummaryQuery.data?.calculatedAt]
      .filter((value): value is string => Boolean(value))
      .sort();
    return stamps.length ? stamps[stamps.length - 1] : null;
  }, [managerQuery.data?.calculatedAt, todaySummaryQuery.data?.calculatedAt]);

  return {
    branchId,
    currencyCode: branch.currencyCode,
    isEnabled,
    managerQuery,
    todaySummaryQuery,
    paymentMixQuery,
    openOrdersQuery,
    lowStockQuery,
    approvalQueries: {
      discount: discountApprovalsQuery,
      leave: leaveApprovalsQuery,
      "shift-swap": shiftSwapApprovalsQuery,
      anomaly: anomalyApprovalsQuery,
    },
    calculatedAt,
    isInitialLoading:
      isEnabled &&
      [managerQuery, todaySummaryQuery, paymentMixQuery, openOrdersQuery, lowStockQuery].some(
        (query) => query.isLoading,
      ),
    refresh: {
      run: runRefresh,
      isPending: refreshMutation.isPending,
      isError: refreshMutation.isError,
      error: refreshMutation.error,
      lastRefreshedAt,
    },
  };
}
