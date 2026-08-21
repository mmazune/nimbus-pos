import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  getApAgingRequest,
  getApBillRequest,
  getApSupplierRequest,
  getArAccountRequest,
  getArAgingRequest,
  getArInvoiceRequest,
  getBankAccountsRequest,
  getBankReconciliationRequest,
  getBankReconciliationsRequest,
  getBankStatementRequest,
  getBankStatementsRequest,
  listApBillsRequest,
  listApCreditNotesRequest,
  listApPaymentsRequest,
  listApRecurringProfilesRequest,
  listApRemindersRequest,
  listApSuppliersRequest,
  listArAccountsRequest,
  listArCreditNotesRequest,
  listArInvoicesRequest,
  type ListApBillsParams,
  type ListApCreditNotesParams,
  type ListApPaymentsParams,
  type ListApRecurringProfilesParams,
  type ListApRemindersParams,
  type ListApSuppliersParams,
  type ListArAccountsParams,
  type ListArCreditNotesParams,
  type ListArInvoicesParams,
} from "@/lib/accounting/api";
import type {
  AccountingListEnvelope,
  ApAgingResponse,
  ApBillDetail,
  ApBillRow,
  ApCreditNoteRow,
  ApPaymentRow,
  ApRecurringProfileRow,
  ApReminderRow,
  ApSupplierDetail,
  ApSupplierRow,
  ArAccountDetail,
  ArAccountRow,
  ArAgingResponse,
  ArCreditNoteRow,
  ArInvoiceDetail,
  ArInvoiceRow,
  BankAccountRow,
  BankReconciliationDetail,
  BankReconciliationRow,
  BankStatementDetail,
  BankStatementRow,
} from "@/lib/accounting/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Customers (AR) + Vendors (AP) list/detail queries — Track B5.2.
 *
 * Deliberately a SEPARATE file from `lib/manager/accounting-context.ts`, not an
 * extension of it: that file's own assertion locks `useQueryCount === 9`
 * (`scripts/manager-b5-assertions.ts`), one query per B5.1 dashboard card. These
 * are page-scoped reads — they fire only while a Customers/Vendors surface is
 * mounted, not on every accounting page load — so folding them into the
 * dashboard hook would both break that count and poll list pages the dashboard
 * never shows.
 *
 * Same contract as the dashboard hook: every key is
 * `["manager", "accounting-<surface>", branchId, ...params]` via
 * `managerQueryKey`, so a branch switch re-scopes through the existing narrow
 * `invalidateQueries({ queryKey: ["manager"] })` and a list request is disabled
 * outright with no branch/session. Unlike the dashboard these are NOT polled —
 * a list a manager is actively filtering/paging should not silently reshuffle
 * under them; `refetchInterval` is `false` and a manual `refetch()` on retry
 * is what these callers use instead.
 */

type EnabledParams = {
  accessToken: string | null;
  branchId: string | null;
  isAuthenticated: boolean;
  isManager: boolean;
};

function useAccountingAuth(): EnabledParams & { enabled: boolean; token: string; scope: string } {
  const { accessToken, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  const branchId = branch.branchId;
  const enabled = Boolean(accessToken && branchId && isAuthenticated && isManager);
  return {
    accessToken,
    branchId,
    isAuthenticated,
    isManager,
    enabled,
    token: (accessToken as string) || "",
    scope: (branchId as string) || "",
  };
}

// ── Customers (AR) ───────────────────────────────────────────────────────────

export function useArInvoicesList(
  params: ListArInvoicesParams,
): UseQueryResult<AccountingListEnvelope<ArInvoiceRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ar-invoices", branchId, params),
    queryFn: () => listArInvoicesRequest(token, scope, params),
  });
}

export function useArInvoiceDetail(id: string | null): UseQueryResult<ArInvoiceDetail> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-ar-invoice", branchId, id),
    queryFn: () => getArInvoiceRequest(token, scope, id as string),
  });
}

export function useArAccountsList(
  params: ListArAccountsParams,
): UseQueryResult<AccountingListEnvelope<ArAccountRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ar-accounts", branchId, params),
    queryFn: () => listArAccountsRequest(token, scope, params),
  });
}

export function useArAccountDetail(id: string | null): UseQueryResult<ArAccountDetail> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-ar-account", branchId, id),
    queryFn: () => getArAccountRequest(token, scope, id as string),
  });
}

export function useArCreditNotesList(
  params: ListArCreditNotesParams,
): UseQueryResult<AccountingListEnvelope<ArCreditNoteRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ar-credit-notes", branchId, params),
    queryFn: () => listArCreditNotesRequest(token, scope, params),
  });
}

// ── Vendors (AP) ──────────────────────────────────────────────────────────────

export function useApBillsList(params: ListApBillsParams): UseQueryResult<AccountingListEnvelope<ApBillRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-bills", branchId, params),
    queryFn: () => listApBillsRequest(token, scope, params),
  });
}

export function useApBillDetail(id: string | null): UseQueryResult<ApBillDetail> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-bill", branchId, id),
    queryFn: () => getApBillRequest(token, scope, id as string),
  });
}

export function useApSuppliersList(
  params: ListApSuppliersParams,
): UseQueryResult<AccountingListEnvelope<ApSupplierRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-suppliers", branchId, params),
    queryFn: () => listApSuppliersRequest(token, scope, params),
  });
}

export function useApSupplierDetail(id: string | null): UseQueryResult<ApSupplierDetail> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-supplier", branchId, id),
    queryFn: () => getApSupplierRequest(token, scope, id as string),
  });
}

export function useApCreditNotesList(
  params: ListApCreditNotesParams,
): UseQueryResult<AccountingListEnvelope<ApCreditNoteRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-credit-notes", branchId, params),
    queryFn: () => listApCreditNotesRequest(token, scope, params),
  });
}

export function useApPaymentsList(
  params: ListApPaymentsParams,
): UseQueryResult<AccountingListEnvelope<ApPaymentRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-payments", branchId, params),
    queryFn: () => listApPaymentsRequest(token, scope, params),
  });
}

export function useApRecurringProfilesList(
  params: ListApRecurringProfilesParams,
): UseQueryResult<AccountingListEnvelope<ApRecurringProfileRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-recurring-profiles", branchId, params),
    queryFn: () => listApRecurringProfilesRequest(token, scope, params),
  });
}

// ── Reporting: Aged receivable / Aged payable ───────────────────────────────
//
// Separate query keys from the B5.1 dashboard's `accounting-ar-aging` /
// `accounting-ap-aging` (which poll every 5 minutes as part of the fixed
// 9-query dashboard snapshot) — these report pages fetch on demand instead,
// so opening Aged receivable does not inherit the dashboard's polling
// lifecycle or its `AR_AGING_PAGE_SIZE`-only shape.

/**
 * `getArAgingRequest` always requests `AR_AGING_PAGE_SIZE` (100) accounts in
 * one unpaginated fetch — no `skip` param is exposed here because the demo
 * datasets (and any realistic single-branch customer base) sit comfortably
 * under that bound, the same assumption the B5.1 dashboard card already makes.
 */
export function useArAgingReport(): UseQueryResult<ArAgingResponse> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ar-aging-report", branchId),
    queryFn: () => getArAgingRequest(token, scope),
  });
}

export function useApAgingReport(): UseQueryResult<ApAgingResponse> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-aging-report", branchId),
    queryFn: () => getApAgingRequest(token, scope),
  });
}

export function useApRemindersList(
  params: ListApRemindersParams,
): UseQueryResult<AccountingListEnvelope<ApReminderRow>> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-ap-reminders", branchId, params),
    queryFn: () => listApRemindersRequest(token, scope, params),
  });
}

// ── Bank — Track B5.3 ────────────────────────────────────────────────────────
//
// All three routes here are PC-06 bare arrays with no server total and no
// server-side status filter — `bankAccountId` is the only accepted query
// param, so every status/type filter this surface offers is applied CLIENT-
// side by the screen over the full fetched array (see `unpaginatedCountLabel`).
// Deliberately SEPARATE query keys from the B5.1 dashboard's own
// `accounting-bank-accounts` / `accounting-bank-reconciliations` (which poll
// every 5 minutes as part of the fixed 9-query snapshot) — these surface reads
// fetch on demand instead, matching the Reporting precedent above.

export function useBankAccountsList(): UseQueryResult<BankAccountRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-bank-accounts-list", branchId),
    queryFn: () => getBankAccountsRequest(token, scope),
  });
}

export function useBankStatementsList(bankAccountId?: string): UseQueryResult<BankStatementRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-bank-statements-list", branchId, bankAccountId),
    queryFn: () => getBankStatementsRequest(token, scope, bankAccountId),
  });
}

export function useBankStatementDetail(id: string | null): UseQueryResult<BankStatementDetail> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-bank-statement", branchId, id),
    queryFn: () => getBankStatementRequest(token, scope, id as string),
  });
}

export function useBankReconciliationsList(bankAccountId?: string): UseQueryResult<BankReconciliationRow[]> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled,
    retry: 1,
    queryKey: managerQueryKey("accounting-bank-reconciliations-list", branchId, bankAccountId),
    queryFn: () => getBankReconciliationsRequest(token, scope, bankAccountId),
  });
}

export function useBankReconciliationDetail(id: string | null): UseQueryResult<BankReconciliationDetail> {
  const { enabled, scope, token, branchId } = useAccountingAuth();
  return useQuery({
    enabled: enabled && Boolean(id),
    retry: 1,
    queryKey: managerQueryKey("accounting-bank-reconciliation", branchId, id),
    queryFn: () => getBankReconciliationRequest(token, scope, id as string),
  });
}
