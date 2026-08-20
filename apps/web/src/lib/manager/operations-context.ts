import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  getManagerOrderDetail,
  listManagerOrders,
  listManagerReservations,
  loadManagerFloorSnapshot,
  type ManagerOrdersQuery,
  type ManagerReservationsQuery,
} from "@/lib/manager/operations-api";
import { normalizeManagerFloorTables, type ManagerFloorTableViewModel } from "@/lib/manager/operations-model";
import type {
  ManagerOrderDetail,
  ManagerOrdersPage,
  ManagerReservationsPage,
} from "@/lib/manager/operations-types";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Manager Operations — React Query binding (Track B3).
 *
 * Performance contract (CLAUDE.md §15):
 *
 * - **One query per surface.** Orders = 1 list read; a selected row adds exactly
 *   1 detail read. Reservations = 1 read. Tables = 1 query that fans out to the
 *   3 canonical Floor endpoints inside a single `queryFn`, so React Query sees
 *   one cache entry and one refetch, not three.
 * - **No polling.** Operations is oversight, not a service screen — a manager
 *   reading a list does not need a 60s heartbeat, and a background poll on three
 *   surfaces would triple the traffic B2 was tuned for. Refetch is on mount and
 *   on explicit user action only.
 * - **Every key is `["manager", …, branchId]`** via `managerQueryKey`, so the
 *   existing narrow branch-switch invalidation re-scopes these surfaces with no
 *   new invalidation code, and a stale branch's rows can never paint under a new
 *   branch's name.
 */

/** Lists are user-driven; a page that has not changed does not need re-reading. */
const LIST_STALE_TIME = 30_000;

function useManagerOperationsSession() {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  const branchId = branch.branchId;
  return {
    accessToken,
    branchId,
    clearSession,
    currencyCode: branch.currencyCode,
    branchName: branch.branchName,
    isEnabled: Boolean(accessToken && branchId && isAuthenticated && isManager),
  };
}

function useAuthErrorGuard(clearSession: () => void, errors: readonly unknown[]) {
  const hasAuthError = errors.some((error) => error instanceof ApiError && error.isAuthError);
  useEffect(() => {
    if (hasAuthError) clearSession();
  }, [clearSession, hasAuthError]);
}

// ── Orders ──────────────────────────────────────────────────────────────────

export type ManagerOrdersSnapshot = {
  branchId: string | null;
  branchName: string;
  currencyCode: string | null;
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerOrdersPage>;
  detailQuery: UseQueryResult<ManagerOrderDetail>;
  selectedOrderId: string | null;
};

export function useManagerOrders(
  query: ManagerOrdersQuery,
  selectedOrderId: string | null,
): ManagerOrdersSnapshot {
  const session = useManagerOperationsSession();

  const listQuery = useQuery({
    queryKey: managerQueryKey("operations-orders", session.branchId, query.page, query.status || "", query.serviceType || ""),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      listManagerOrders(session.accessToken as string, session.branchId as string, query),
  });

  const detailQuery = useQuery({
    queryKey: managerQueryKey("operations-order-detail", session.branchId, selectedOrderId || ""),
    // The detail read only fires when a row is actually selected — a list view
    // with no selection issues exactly one request.
    enabled: session.isEnabled && Boolean(selectedOrderId),
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      getManagerOrderDetail(
        session.accessToken as string,
        session.branchId as string,
        selectedOrderId as string,
      ),
  });

  useAuthErrorGuard(session.clearSession, [listQuery.error, detailQuery.error]);

  return {
    branchId: session.branchId,
    branchName: session.branchName,
    currencyCode: session.currencyCode,
    isEnabled: session.isEnabled,
    listQuery,
    detailQuery,
    selectedOrderId,
  };
}

// ── Reservations ────────────────────────────────────────────────────────────

export type ManagerReservationsSnapshot = {
  branchId: string | null;
  branchName: string;
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerReservationsPage>;
};

export function useManagerReservations(query: ManagerReservationsQuery): ManagerReservationsSnapshot {
  const session = useManagerOperationsSession();

  const listQuery = useQuery({
    queryKey: managerQueryKey(
      "operations-reservations",
      session.branchId,
      query.scope,
      query.page,
      query.status || "",
    ),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      listManagerReservations(session.accessToken as string, session.branchId as string, query),
  });

  useAuthErrorGuard(session.clearSession, [listQuery.error]);

  return {
    branchId: session.branchId,
    branchName: session.branchName,
    isEnabled: session.isEnabled,
    listQuery,
  };
}

// ── Floor / tables ──────────────────────────────────────────────────────────

export type ManagerFloorSnapshot = {
  branchId: string | null;
  branchName: string;
  isEnabled: boolean;
  tables: ManagerFloorTableViewModel[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export function useManagerFloor(): ManagerFloorSnapshot {
  const session = useManagerOperationsSession();

  const floorQuery = useQuery({
    queryKey: managerQueryKey("operations-floor", session.branchId),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      loadManagerFloorSnapshot(session.accessToken as string, session.branchId as string),
  });

  useAuthErrorGuard(session.clearSession, [floorQuery.error]);

  const tables = useMemo(() => {
    if (!floorQuery.data) return [];
    return normalizeManagerFloorTables(floorQuery.data);
  }, [floorQuery.data]);

  return {
    branchId: session.branchId,
    branchName: session.branchName,
    isEnabled: session.isEnabled,
    tables,
    isLoading: floorQuery.isLoading,
    isError: floorQuery.isError,
    refetch: () => {
      void floorQuery.refetch();
    },
  };
}
