import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  disableManagerQuickPin,
  enableManagerQuickPin,
  getManagerQuickPinStatus,
  listManagerEmployees,
  listManagerLeave,
  listManagerShiftSwaps,
  onboardManagerFrontlineStaff,
  rejectManagerShiftSwap,
  resetManagerQuickPin,
  reviewManagerLeave,
  type ManagerDirectoryQuery,
} from "@/lib/manager/staff-api";
import type { ManagerOnboardPayload } from "@/lib/manager/staff-model";
import type {
  ManagerDirectoryPage,
  ManagerLeavePage,
  ManagerOnboardResult,
  ManagerOneTimeSecret,
  ManagerQuickPinStatus,
  ManagerShiftSwapPage,
} from "@/lib/manager/staff-types";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Manager Staff — React Query binding (Track B3).
 *
 * ## The cache rules that matter here
 *
 * - **One-time secrets never enter the cache.** Onboarding and PIN reset are
 *   `useMutation`, not `useQuery`. React Query keeps no cache entry for a
 *   mutation result beyond the hook's own lifetime, so the plaintext PIN cannot
 *   outlive the dialog that showed it, cannot be re-read from another component,
 *   and cannot appear in a cache dump. It is also never part of any query key.
 * - **Every key is `["manager", …, branchId]`**, so the existing narrow
 *   branch-switch invalidation re-scopes Staff too. The directory is the one
 *   surface where the branch is applied in the BROWSER (the endpoint is
 *   org-scoped, MP0-06), so its key still carries the branch id — otherwise two
 *   branches would share one cache entry and the filter would fight the cache.
 * - **Post-decision refresh is narrow.** Approving leave invalidates the leave
 *   keys; it does not sweep the Manager namespace and it never touches the
 *   Overview dashboard's nine keys or another role's cache.
 * - **No polling.** Review queues are decided by a person, not watched.
 */

const LIST_STALE_TIME = 30_000;

function useManagerStaffSession() {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  return {
    accessToken,
    branchId: branch.branchId,
    branchName: branch.branchName,
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

// ── Directory ───────────────────────────────────────────────────────────────

export type ManagerDirectorySnapshot = {
  branchId: string | null;
  branchName: string;
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerDirectoryPage>;
};

export function useManagerDirectory(query: ManagerDirectoryQuery): ManagerDirectorySnapshot {
  const session = useManagerStaffSession();

  const listQuery = useQuery({
    queryKey: managerQueryKey("staff-directory", session.branchId, query.search || "", query.status || ""),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      listManagerEmployees(session.accessToken as string, session.branchId as string, query),
  });

  useAuthErrorGuard(session.clearSession, [listQuery.error]);

  return {
    branchId: session.branchId,
    branchName: session.branchName,
    isEnabled: session.isEnabled,
    listQuery,
  };
}

// ── Quick PIN ───────────────────────────────────────────────────────────────

export type ManagerQuickPinAction = "reset" | "disable" | "enable";

export type ManagerQuickPinSnapshot = {
  statusQuery: UseQueryResult<ManagerQuickPinStatus>;
  /** The freshly-issued PIN, if the last action was a reset. Cleared by `dismissSecret`. */
  secret: ManagerOneTimeSecret | null;
  dismissSecret: () => void;
  run: (action: ManagerQuickPinAction) => void;
  isPending: boolean;
  error: unknown;
  lastAction: ManagerQuickPinAction | null;
};

export function useManagerQuickPin(
  employeeId: string | null,
  secretState: {
    secret: ManagerOneTimeSecret | null;
    setSecret: (secret: ManagerOneTimeSecret | null) => void;
  },
): ManagerQuickPinSnapshot {
  const session = useManagerStaffSession();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: managerQueryKey("staff-quick-pin", session.branchId, employeeId || ""),
    // Read ON DEMAND: there is no bulk status endpoint, so a table-wide fetch
    // would be one request per employee. Selecting a row costs exactly one.
    enabled: session.isEnabled && Boolean(employeeId),
    staleTime: 0,
    retry: 1,
    queryFn: () =>
      getManagerQuickPinStatus(
        session.accessToken as string,
        session.branchId as string,
        employeeId as string,
      ),
  });

  const mutation = useMutation({
    mutationFn: async (action: ManagerQuickPinAction) => {
      const token = session.accessToken as string;
      const branchId = session.branchId as string;
      const id = employeeId as string;
      if (action === "reset") return { action, secret: await resetManagerQuickPin(token, branchId, id) };
      if (action === "disable") {
        await disableManagerQuickPin(token, branchId, id);
        return { action, secret: null };
      }
      await enableManagerQuickPin(token, branchId, id);
      return { action, secret: null };
    },
    onSuccess: async (result) => {
      // The plaintext PIN goes to CALLER-OWNED COMPONENT STATE, never to the
      // cache and never to storage.
      secretState.setSecret(result.secret);
      // Narrow: re-read this one employee's status so the panel reflects the new
      // state from the server rather than from an optimistic guess.
      await queryClient.invalidateQueries({
        queryKey: managerQueryKey("staff-quick-pin", session.branchId, employeeId || ""),
      });
    },
  });

  useAuthErrorGuard(session.clearSession, [statusQuery.error, mutation.error]);

  const run = useCallback(
    (action: ManagerQuickPinAction) => {
      if (!session.isEnabled || !employeeId || mutation.isPending) return;
      mutation.mutate(action);
    },
    [employeeId, mutation, session.isEnabled],
  );

  return {
    statusQuery,
    secret: secretState.secret,
    dismissSecret: () => secretState.setSecret(null),
    run,
    isPending: mutation.isPending,
    error: mutation.error,
    lastAction: mutation.data?.action ?? null,
  };
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export type ManagerOnboardingSnapshot = {
  isEnabled: boolean;
  branchName: string;
  submit: (payload: ManagerOnboardPayload) => void;
  isPending: boolean;
  error: unknown;
  result: ManagerOnboardResult | null;
  reset: () => void;
};

export function useManagerOnboarding(): ManagerOnboardingSnapshot {
  const session = useManagerStaffSession();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: ManagerOnboardPayload) =>
      onboardManagerFrontlineStaff(
        session.accessToken as string,
        session.branchId as string,
        payload,
      ),
    onSuccess: async () => {
      // A new employee changes the directory; nothing else. Narrow by design —
      // this must not disturb the Overview dashboard's keys or another surface.
      await queryClient.invalidateQueries({
        queryKey: managerQueryKey("staff-directory", session.branchId),
      });
    },
  });

  useAuthErrorGuard(session.clearSession, [mutation.error]);

  return {
    isEnabled: session.isEnabled,
    branchName: session.branchName,
    submit: (payload) => {
      if (!session.isEnabled || mutation.isPending) return;
      mutation.mutate(payload);
    },
    isPending: mutation.isPending,
    error: mutation.error,
    // NOTE: `mutation.data` holds the one-time PIN. It lives only as long as this
    // hook instance and is not cached by React Query.
    result: mutation.data ?? null,
    reset: () => mutation.reset(),
  };
}

// ── Leave review ────────────────────────────────────────────────────────────

export type ManagerLeaveSnapshot = {
  branchId: string | null;
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerLeavePage>;
  decide: (input: { leaveId: string; decision: "APPROVED" | "REJECTED"; reviewNotes?: string }) => void;
  isDeciding: boolean;
  decisionError: unknown;
  resetDecision: () => void;
  decidedId: string | null;
};

export function useManagerLeaveReview(status: string | null, page: number): ManagerLeaveSnapshot {
  const session = useManagerStaffSession();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: managerQueryKey("staff-leave", session.branchId, status || "", page),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      listManagerLeave(session.accessToken as string, session.branchId as string, status, page),
  });

  const mutation = useMutation({
    mutationFn: async (input: {
      leaveId: string;
      decision: "APPROVED" | "REJECTED";
      reviewNotes?: string;
    }) => {
      await reviewManagerLeave(
        session.accessToken as string,
        session.branchId as string,
        input.leaveId,
        input.decision,
        input.reviewNotes,
      );
      return input.leaveId;
    },
    onSuccess: async () => {
      // Await the canonical re-read before the UI claims anything changed — the
      // C3 settlement precedent: never show a result from an optimistic guess.
      await queryClient.invalidateQueries({
        queryKey: managerQueryKey("staff-leave", session.branchId),
      });
    },
  });

  useAuthErrorGuard(session.clearSession, [listQuery.error, mutation.error]);

  return {
    branchId: session.branchId,
    isEnabled: session.isEnabled,
    listQuery,
    decide: (input) => {
      if (!session.isEnabled || mutation.isPending) return;
      mutation.mutate(input);
    },
    isDeciding: mutation.isPending,
    decisionError: mutation.error,
    resetDecision: () => mutation.reset(),
    decidedId: mutation.data ?? null,
  };
}

// ── Shift-swap review (REJECT ONLY — Outcome C) ──────────────────────────────

export type ManagerShiftSwapSnapshot = {
  branchId: string | null;
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerShiftSwapPage>;
  /** There is deliberately no `approve` here — see `rejectManagerShiftSwap`. */
  reject: (input: { swapId: string; reviewNotes?: string }) => void;
  isRejecting: boolean;
  rejectionError: unknown;
  resetRejection: () => void;
  rejectedId: string | null;
};

export function useManagerShiftSwapReview(
  status: string | null,
  page: number,
): ManagerShiftSwapSnapshot {
  const session = useManagerStaffSession();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: managerQueryKey("staff-shift-swaps", session.branchId, status || "", page),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      listManagerShiftSwaps(session.accessToken as string, session.branchId as string, status, page),
  });

  const mutation = useMutation({
    mutationFn: async (input: { swapId: string; reviewNotes?: string }) => {
      await rejectManagerShiftSwap(
        session.accessToken as string,
        session.branchId as string,
        input.swapId,
        input.reviewNotes,
      );
      return input.swapId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: managerQueryKey("staff-shift-swaps", session.branchId),
      });
    },
  });

  useAuthErrorGuard(session.clearSession, [listQuery.error, mutation.error]);

  return {
    branchId: session.branchId,
    isEnabled: session.isEnabled,
    listQuery,
    reject: (input) => {
      if (!session.isEnabled || mutation.isPending) return;
      mutation.mutate(input);
    },
    isRejecting: mutation.isPending,
    rejectionError: mutation.error,
    resetRejection: () => mutation.reset(),
    rejectedId: mutation.data ?? null,
  };
}

/** Shared helper: the human message behind a failed Staff mutation. */
export function useManagerStaffErrorMessage(error: unknown) {
  return useMemo(() => {
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.isForbidden) return "This account is not permitted to make that change.";
      return error.message;
    }
    return "The request failed. Try again when the connection is stable.";
  }, [error]);
}
