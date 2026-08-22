import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  closeFiscalPeriodRequest,
  completeReconciliationRequest,
  createFiscalPeriodRequest,
  dismissPostingErrorRequest,
  lockFiscalPeriodRequest,
  matchReconciliationLineRequest,
  openFiscalPeriodRequest,
  resolvePostingErrorRequest,
  reverseJournalRequest,
  skipReconciliationLineRequest,
  type CloseFiscalPeriodPayload,
  type CreateFiscalPeriodPayload,
  type DismissPostingErrorPayload,
  type MatchReconciliationLinePayload,
  type ResolvePostingErrorPayload,
  type ReverseJournalPayload,
  type SkipReconciliationLinePayload,
} from "@/lib/accounting/write-api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Accounting TRANSITION writes — Track B5.7 (2026-08-22).
 *
 * A deliberately separate file from `accounting-configuration-queries.ts`
 * (Track B5.6's own write file, scoped to exactly its seven Configuration +
 * Reporting surfaces — untouched by this phase) and from
 * `accounting-surface-queries.ts` (read-only, B5.2's Customers/Vendors
 * adapter). This one mounts `useMutation` for the eight B5.7 write routes
 * retrofitted onto B5.3/B5.4/B5.5's previously read-only surfaces: posting-
 * error resolve/dismiss, fiscal period create/open/close/lock, bank
 * reconciliation match/skip/complete, and journal reverse.
 *
 * Same contract as every other accounting mutation file: every mutation
 * invalidates only its OWN surface's query-key prefix (never a blanket
 * `["manager"]` sweep, CLAUDE.md §15), and every write function it calls
 * cites its route through `getAccountingWriteRoute` (enforced in
 * `write-api.ts`, not re-checked here).
 */

type EnabledParams = { token: string; scope: string; branchId: string | null };

function useAccountingAuth(): EnabledParams {
  const { accessToken } = useAuth();
  const branch = useManagerBranch();
  return {
    token: (accessToken as string) || "",
    scope: (branch.branchId as string) || "",
    branchId: branch.branchId,
  };
}

// ── Posting errors (B5.4) ────────────────────────────────────────────────────

export function useResolvePostingError() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: ResolvePostingErrorPayload }) =>
      resolvePostingErrorRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-posting-errors-list", branchId) }),
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-posting-error", branchId, variables.id) }),
      ]);
    },
  });
}

export function useDismissPostingError() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: DismissPostingErrorPayload }) =>
      dismissPostingErrorRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-posting-errors-list", branchId) }),
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-posting-error", branchId, variables.id) }),
      ]);
    },
  });
}

// ── Fiscal periods (B5.5) ────────────────────────────────────────────────────

function invalidateFiscalPeriods(
  queryClient: ReturnType<typeof useQueryClient>,
  branchId: string | null,
) {
  return queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-fiscal-periods-list", branchId) });
}

export function useCreateFiscalPeriod() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFiscalPeriodPayload) => createFiscalPeriodRequest(token, scope, payload),
    onSuccess: () => invalidateFiscalPeriods(queryClient, branchId),
  });
}

export function useOpenFiscalPeriod() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => openFiscalPeriodRequest(token, scope, id),
    onSuccess: () => invalidateFiscalPeriods(queryClient, branchId),
  });
}

export function useCloseFiscalPeriod() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: CloseFiscalPeriodPayload }) =>
      closeFiscalPeriodRequest(token, scope, id, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateFiscalPeriods(queryClient, branchId),
        // Closing a period always creates a real PeriodCloseRun in the same transaction.
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-period-close-runs-list", branchId) }),
      ]);
    },
  });
}

export function useLockFiscalPeriod() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => lockFiscalPeriodRequest(token, scope, id),
    onSuccess: () => invalidateFiscalPeriods(queryClient, branchId),
  });
}

// ── Bank reconciliation (B5.3) ───────────────────────────────────────────────

function invalidateReconciliation(
  queryClient: ReturnType<typeof useQueryClient>,
  branchId: string | null,
  id: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-bank-reconciliations-list", branchId) }),
    queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-bank-reconciliation", branchId, id) }),
  ]);
}

export function useMatchReconciliationLine() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MatchReconciliationLinePayload }) =>
      matchReconciliationLineRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => invalidateReconciliation(queryClient, branchId, variables.id),
  });
}

export function useSkipReconciliationLine() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SkipReconciliationLinePayload }) =>
      skipReconciliationLineRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => invalidateReconciliation(queryClient, branchId, variables.id),
  });
}

export function useCompleteReconciliation() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeReconciliationRequest(token, scope, id),
    onSuccess: async (_, id) => invalidateReconciliation(queryClient, branchId, id),
  });
}

// ── Journals (B5.4 core) ─────────────────────────────────────────────────────

export function useReverseJournal() {
  const { token, scope, branchId } = useAccountingAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: ReverseJournalPayload }) =>
      reverseJournalRequest(token, scope, id, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-journals-list", branchId) }),
        queryClient.invalidateQueries({ queryKey: managerQueryKey("accounting-journal", branchId, variables.id) }),
      ]);
    },
  });
}
