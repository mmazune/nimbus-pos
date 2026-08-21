import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  getApAgingRequest,
  getArAgingRequest,
  getBankAccountsRequest,
  getBankReconciliationsRequest,
  getFiscalPeriodsRequest,
  getJournalCountRequest,
  getPeriodCloseRunsRequest,
  getPostingErrorCountRequest,
  getPostingRunCountRequest,
} from "@/lib/accounting/api";
import type {
  ApAgingResponse,
  ArAgingResponse,
  BankAccountRow,
  BankReconciliationRow,
  FiscalPeriodRow,
  PeriodCloseRunRow,
} from "@/lib/accounting/types";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Accounting dashboard — React Query binding (Track B5.1).
 *
 * This is the ONLY file in the Accounting module that knows it is mounted inside
 * Manager. Everything under `lib/accounting/*` is role-agnostic on purpose
 * (OD-2: "build B5 as a self-contained module with no Manager-specific coupling,
 * so an Accountant role later mounts the same module behind its own allow-list"),
 * so a future remount replaces this one adapter rather than the module.
 *
 * Performance contract (CLAUDE.md §15, and the same shape B2 committed to):
 *
 * - **Nine bounded requests**, issued once per branch on mount. Nothing fans out
 *   per card, per row or per render.
 * - Every key is `["manager", "accounting-<surface>", branchId]` via
 *   `managerQueryKey`, so a branch switch re-scopes through the existing NARROW
 *   `invalidateQueries({ queryKey: ["manager"] })` in `ManagerBranchProvider` and
 *   one branch's money can never paint under another branch's name.
 * - **Polled, not streamed.** There is no SSE client in this app and none is
 *   added here (MP0-07 / NG-14 → Track C-04). The interval is deliberately
 *   SLOWER than the Overview's 60s: accounting balances move on the timescale of
 *   invoices and bills, not orders, so polling them every minute would be traffic
 *   without information.
 * - Each card owns its own query, so one failing endpoint degrades ONE card
 *   rather than blanking the page — and a failed card shows its error state,
 *   never a stale or zeroed figure.
 */

/** 5 minutes. Accounting balances change on a document cadence, not a service one. */
export const ACCOUNTING_POLL_MS = 300_000;

export const ACCOUNTING_SURFACES = [
  "accounting-ar-aging",
  "accounting-ap-aging",
  "accounting-journal-count",
  "accounting-posting-run-count",
  "accounting-posting-error-count",
  "accounting-bank-accounts",
  "accounting-bank-reconciliations",
  "accounting-fiscal-periods",
  "accounting-period-close-runs",
] as const;

export type AccountingDashboardSnapshot = {
  branchId: string | null;
  branchName: string;
  organizationName: string;
  currencyCode: string | null;
  /** False when there is no branch or no session — every query stays disabled. */
  isEnabled: boolean;
  arAgingQuery: UseQueryResult<ArAgingResponse>;
  apAgingQuery: UseQueryResult<ApAgingResponse>;
  journalCountQuery: UseQueryResult<number | null>;
  postingRunCountQuery: UseQueryResult<number | null>;
  postingErrorCountQuery: UseQueryResult<number | null>;
  bankAccountsQuery: UseQueryResult<BankAccountRow[]>;
  reconciliationsQuery: UseQueryResult<BankReconciliationRow[]>;
  fiscalPeriodsQuery: UseQueryResult<FiscalPeriodRow[]>;
  periodCloseRunsQuery: UseQueryResult<PeriodCloseRunRow[]>;
};

export function useAccountingDashboard(): AccountingDashboardSnapshot {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  const branchId = branch.branchId;
  const isEnabled = Boolean(accessToken && branchId && isAuthenticated && isManager);

  const shared = {
    enabled: isEnabled,
    refetchInterval: isEnabled ? ACCOUNTING_POLL_MS : (false as const),
    retry: 1,
  };

  const token = accessToken as string;
  const scope = branchId as string;

  const arAgingQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-ar-aging", branchId),
    queryFn: () => getArAgingRequest(token, scope),
  });

  const apAgingQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-ap-aging", branchId),
    queryFn: () => getApAgingRequest(token, scope),
  });

  const journalCountQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-journal-count", branchId),
    queryFn: () => getJournalCountRequest(token, scope),
  });

  const postingRunCountQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-posting-run-count", branchId),
    queryFn: () => getPostingRunCountRequest(token, scope),
  });

  const postingErrorCountQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-posting-error-count", branchId),
    queryFn: () => getPostingErrorCountRequest(token, scope),
  });

  const bankAccountsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-bank-accounts", branchId),
    queryFn: () => getBankAccountsRequest(token, scope),
  });

  const reconciliationsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-bank-reconciliations", branchId),
    queryFn: () => getBankReconciliationsRequest(token, scope),
  });

  const fiscalPeriodsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-fiscal-periods", branchId),
    queryFn: () => getFiscalPeriodsRequest(token, scope),
  });

  const periodCloseRunsQuery = useQuery({
    ...shared,
    queryKey: managerQueryKey("accounting-period-close-runs", branchId),
    queryFn: () => getPeriodCloseRunsRequest(token, scope),
  });

  const errors = [
    arAgingQuery.error,
    apAgingQuery.error,
    journalCountQuery.error,
    postingRunCountQuery.error,
    postingErrorCountQuery.error,
    bankAccountsQuery.error,
    reconciliationsQuery.error,
    fiscalPeriodsQuery.error,
    periodCloseRunsQuery.error,
  ];

  useEffect(() => {
    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) clearSession();
    // The error identities are the dependency; React Query keeps error references
    // until the next settle, so this is stable. Same shape as B2's dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSession, ...errors]);

  return {
    branchId,
    branchName: branch.branchName,
    organizationName: branch.organizationName,
    currencyCode: branch.currencyCode,
    isEnabled,
    arAgingQuery,
    apAgingQuery,
    journalCountQuery,
    postingRunCountQuery,
    postingErrorCountQuery,
    bankAccountsQuery,
    reconciliationsQuery,
    fiscalPeriodsQuery,
    periodCloseRunsQuery,
  };
}
