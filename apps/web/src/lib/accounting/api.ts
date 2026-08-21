import { apiRequest } from "@/lib/api/client";

import { AR_AGING_PAGE_SIZE } from "./model";
import { getAccountingRoute } from "./route-registry";
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
  BankReconciliationRow,
  FiscalPeriodRow,
  JournalRow,
  PeriodCloseRunRow,
} from "./types";

/**
 * Accounting request layer — Track B5.1.
 *
 * ⚠️ **READS ONLY. THERE IS NO WRITE FUNCTION IN THIS MODULE AND THERE MUST NOT BE
 * ONE.** Manager holds 15 accounting read strings and zero writes (PC-01/PC-02),
 * so a mutation helper here would either 403 at runtime or invite a disabled
 * button in the UI — both are the "soft untruth" the standing rules forbid.
 * `scripts/manager-b5-assertions.ts` greps this whole tree for
 * `method: "POST" | "PATCH" | "PUT" | "DELETE"` and fails the build if one appears.
 *
 * Every request is branch-scoped through `apiRequest({ branchId })`, which sets
 * `X-Branch-Id` (`lib/api/client.ts`). **No API-client change was needed** —
 * exactly as none was needed for M-P1's branch switcher, B2's dashboard, or B4's
 * reports.
 *
 * Bounded reads: every list that accepts a page size gets an EXPLICIT one
 * (MP0-11 — several routes are unbounded server-side, and this pass measured no
 * maximum on `take` at all, so the bound is the caller's responsibility). Count
 * cards use `take=1` and read the server's own `total`, the B2 count-only
 * pattern: bounding the page does not bound the count.
 */

/** Reads the path from the registry so a route can never be typed twice. */
function routePath(key: string) {
  return getAccountingRoute(key).path;
}

// ── Aging (the two money headlines) ─────────────────────────────────────────

export function getArAgingRequest(token: string, branchId: string) {
  return apiRequest<ArAgingResponse>(
    `${routePath("ar.aging")}?take=${AR_AGING_PAGE_SIZE}`,
    { token, branchId },
  );
}

/**
 * AP aging takes no page size — the service reads every open bill for the branch
 * and its DTO accepts only `asOf`. That is why `buckets.total` needs no
 * completeness guard while its AR counterpart does (B5-F1).
 */
export function getApAgingRequest(token: string, branchId: string) {
  return apiRequest<ApAgingResponse>(routePath("ap.aging"), { token, branchId });
}

// ── Count-only reads (B2 pattern: take=1, read the server's own `total`) ─────

async function countOnly(path: string, token: string, branchId: string) {
  const payload = await apiRequest<AccountingListEnvelope<unknown>>(`${path}?take=1`, {
    token,
    branchId,
  });
  const total = payload?.total;
  // Fails closed: an unreadable total is `null`, never `0`.
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export function getJournalCountRequest(token: string, branchId: string) {
  return countOnly(routePath("accounting.journals"), token, branchId);
}

export function getPostingRunCountRequest(token: string, branchId: string) {
  return countOnly(routePath("accounting.postingRuns"), token, branchId);
}

export function getPostingErrorCountRequest(token: string, branchId: string) {
  return countOnly(routePath("accounting.postingErrors"), token, branchId);
}

// ── Bare-array reads (PC-06: no envelope, no total, no server pagination) ────

export function getBankAccountsRequest(token: string, branchId: string) {
  return apiRequest<BankAccountRow[]>(routePath("bank.accounts"), { token, branchId });
}

export function getBankReconciliationsRequest(token: string, branchId: string) {
  return apiRequest<BankReconciliationRow[]>(routePath("bank.reconciliations"), { token, branchId });
}

/** ORGANISATION data — `X-Branch-Id` is still sent, and the backend still ignores it. */
export function getFiscalPeriodsRequest(token: string, branchId: string) {
  return apiRequest<FiscalPeriodRow[]>(routePath("accounting.periods"), { token, branchId });
}

/** ORGANISATION data — see `accounting.periodCloseRuns` in the registry. */
export function getPeriodCloseRunsRequest(token: string, branchId: string) {
  return apiRequest<PeriodCloseRunRow[]>(routePath("accounting.periodCloseRuns"), { token, branchId });
}

// ── Track B5.2: Customers (AR) + Vendors (AP) list/detail reads ─────────────
//
// Same "reads only" rule as the rest of this file — no write function exists
// or may exist here. Every list route below returns `{data,total,skip,take}`
// (`data-total`, `serverTotal: true` in the registry) and the backend now
// CLAMPS `take` at 100 (backend gap batch 3, `MAX_ACCOUNTING_LIST_PAGE_SIZE`)
// — `take > 100` is a 400, not a silent clamp, so `clampAccountingTake` bounds
// every request client-side before it is sent.

/** Mirrors the backend's own `MAX_ACCOUNTING_LIST_PAGE_SIZE` (batch 3). Sending more 400s. */
export const ACCOUNTING_LIST_PAGE_SIZE_MAX = 100;

/** The list page size these surfaces request — comfortably under the server clamp. */
export const ACCOUNTING_LIST_PAGE_SIZE = 25;

export function clampAccountingTake(take: number) {
  return Math.min(Math.max(Math.trunc(take) || 1, 1), ACCOUNTING_LIST_PAGE_SIZE_MAX);
}

type AccountingListParams = Record<string, string | number | boolean | undefined | null>;

function toQueryString(params: AccountingListParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function listRequest<T>(
  routeKey: string,
  token: string,
  branchId: string,
  params: AccountingListParams,
) {
  return apiRequest<AccountingListEnvelope<T>>(`${routePath(routeKey)}${toQueryString(params)}`, {
    token,
    branchId,
  });
}

/**
 * Some registry entries (`ar.invoice`, `ar.account`, `ap.bill`) are their OWN
 * detail key with a path that already carries a literal `:id` placeholder
 * (e.g. `/api/accounting/ar/invoices/:id`), documentation-style, matching how
 * the Nest controller declares the route. Others (`ap.suppliers`) have no
 * separate detail key — the list path has no placeholder, and the real id is
 * simply appended. Blindly appending `/${id}` to a path that already ends in
 * `:id` produced a malformed double-id URL (`.../invoices/:id/<realId>`),
 * caught live: the API 404s appear as an "Invoice unavailable" screen state
 * for what is otherwise a perfectly good id.
 */
function detailRequest<T>(routeKey: string, token: string, branchId: string, id: string) {
  const path = routePath(routeKey);
  const resolved = path.includes(":id") ? path.replace(":id", id) : `${path}/${id}`;
  return apiRequest<T>(resolved, { token, branchId });
}

// ── Customers (AR) ───────────────────────────────────────────────────────────

export type ListArInvoicesParams = {
  status?: string;
  customerAccountId?: string;
  skip?: number;
  take?: number;
};

export function listArInvoicesRequest(
  token: string,
  branchId: string,
  params: ListArInvoicesParams = {},
) {
  return listRequest<ArInvoiceRow>("ar.invoices", token, branchId, {
    status: params.status,
    customerAccountId: params.customerAccountId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export function getArInvoiceRequest(token: string, branchId: string, id: string) {
  return detailRequest<ArInvoiceDetail>("ar.invoice", token, branchId, id);
}

export type ListArAccountsParams = { status?: string; type?: string; skip?: number; take?: number };

export function listArAccountsRequest(
  token: string,
  branchId: string,
  params: ListArAccountsParams = {},
) {
  return listRequest<ArAccountRow>("ar.accounts", token, branchId, {
    status: params.status,
    type: params.type,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export function getArAccountRequest(token: string, branchId: string, id: string) {
  return detailRequest<ArAccountDetail>("ar.account", token, branchId, id);
}

export type ListArCreditNotesParams = { status?: string; customerAccountId?: string; skip?: number; take?: number };

export function listArCreditNotesRequest(
  token: string,
  branchId: string,
  params: ListArCreditNotesParams = {},
) {
  return listRequest<ArCreditNoteRow>("ar.creditNotes", token, branchId, {
    status: params.status,
    customerAccountId: params.customerAccountId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

// ── Vendors (AP) ──────────────────────────────────────────────────────────────

export type ListApBillsParams = { status?: string; supplierId?: string; skip?: number; take?: number };

export function listApBillsRequest(token: string, branchId: string, params: ListApBillsParams = {}) {
  return listRequest<ApBillRow>("ap.bills", token, branchId, {
    status: params.status,
    supplierId: params.supplierId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export function getApBillRequest(token: string, branchId: string, id: string) {
  return detailRequest<ApBillDetail>("ap.bill", token, branchId, id);
}

export type ListApSuppliersParams = { counterpartyType?: string; activeOnly?: boolean; skip?: number; take?: number };

export function listApSuppliersRequest(
  token: string,
  branchId: string,
  params: ListApSuppliersParams = {},
) {
  return listRequest<ApSupplierRow>("ap.suppliers", token, branchId, {
    counterpartyType: params.counterpartyType,
    activeOnly: params.activeOnly,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export function getApSupplierRequest(token: string, branchId: string, id: string) {
  return detailRequest<ApSupplierDetail>("ap.suppliers", token, branchId, id);
}

export type ListApCreditNotesParams = { status?: string; supplierId?: string; skip?: number; take?: number };

export function listApCreditNotesRequest(
  token: string,
  branchId: string,
  params: ListApCreditNotesParams = {},
) {
  return listRequest<ApCreditNoteRow>("ap.creditNotes", token, branchId, {
    status: params.status,
    supplierId: params.supplierId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export type ListApPaymentsParams = { status?: string; supplierId?: string; skip?: number; take?: number };

export function listApPaymentsRequest(
  token: string,
  branchId: string,
  params: ListApPaymentsParams = {},
) {
  return listRequest<ApPaymentRow>("ap.payments", token, branchId, {
    status: params.status,
    supplierId: params.supplierId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export type ListApRecurringProfilesParams = { isActive?: boolean; supplierId?: string; skip?: number; take?: number };

export function listApRecurringProfilesRequest(
  token: string,
  branchId: string,
  params: ListApRecurringProfilesParams = {},
) {
  return listRequest<ApRecurringProfileRow>("ap.recurringProfiles", token, branchId, {
    isActive: params.isActive,
    supplierId: params.supplierId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export type ListApRemindersParams = { status?: string; supplierId?: string; skip?: number; take?: number };

export function listApRemindersRequest(
  token: string,
  branchId: string,
  params: ListApRemindersParams = {},
) {
  return listRequest<ApReminderRow>("ap.reminders", token, branchId, {
    status: params.status,
    supplierId: params.supplierId,
    skip: params.skip ?? 0,
    take: clampAccountingTake(params.take ?? ACCOUNTING_LIST_PAGE_SIZE),
  });
}

export type { JournalRow };
