import { expect, Page } from "@playwright/test";

export {
  MANAGER_CFG,
  MANAGER_BRANCH_STORAGE_KEY,
  branchSwitcher,
  captureBranchHeaders,
  isDesktopTopNavViewport,
  managerLogin,
} from "../manager-shell/fixtures";
export { captureApiRequests, captureConsoleErrors } from "../manager-dashboard/fixtures";

export const ACCOUNTING_ROUTES = {
  root: "/manager/accounting",
  dashboard: "/manager/accounting/dashboard",

  // Customers (AR) — Track B5.2
  customerInvoices: "/manager/accounting/customers/invoices",
  customerAccounts: "/manager/accounting/customers/accounts",
  customerCreditNotes: "/manager/accounting/customers/credit-notes",

  // Vendors (AP) — Track B5.2
  vendorBills: "/manager/accounting/vendors/bills",
  vendorSuppliers: "/manager/accounting/vendors/suppliers",
  vendorCreditNotes: "/manager/accounting/vendors/credit-notes",
  vendorPayments: "/manager/accounting/vendors/payments",
  vendorRecurringProfiles: "/manager/accounting/vendors/recurring",
  vendorReminders: "/manager/accounting/vendors/reminders",

  // Reporting (aging) — Track B5.2
  agedReceivable: "/manager/accounting/reporting/aged-receivable",
  agedPayable: "/manager/accounting/reporting/aged-payable",

  // Bank — Track B5.3
  bankAccounts: "/manager/accounting/bank/accounts",
  bankStatements: "/manager/accounting/bank/statements",
  bankReconciliation: "/manager/accounting/bank/reconciliation",

  // Accounting core + Review — Track B5.4
  journals: "/manager/accounting/journals",
  postingRuns: "/manager/accounting/review/posting-runs",
  postingErrors: "/manager/accounting/review/posting-errors",
  auditTrail: "/manager/accounting/review/audit-trail",
} as const;

/**
 * The 19 rows that are `available: true` in `lib/accounting/menu.ts`, in DOM
 * order. The Bank group sits BEFORE "Accounting" and "Review" in the menu
 * tree (Customers → Vendors → Bank → Accounting → Review → Reporting →
 * Configuration), so B5.4's four rows (Journal entries under "Accounting";
 * Posting runs/Posting errors/Audit trail under "Review") land between
 * "Reconciliation" and "Aged receivable" — not appended at the end.
 */
export const ACCOUNTING_AVAILABLE_MENU_KEYS = [
  "accounting-dashboard",
  "accounting-ar-invoices",
  "accounting-ar-accounts",
  "accounting-ar-credit-notes",
  "accounting-ap-bills",
  "accounting-ap-payments",
  "accounting-ap-credit-notes",
  "accounting-ap-suppliers",
  "accounting-ap-recurring",
  "accounting-ap-reminders",
  "accounting-bank-accounts",
  "accounting-bank-statements",
  "accounting-bank-reconciliation",
  "accounting-journals",
  "accounting-posting-runs",
  "accounting-posting-errors",
  "accounting-audit-trail",
  "accounting-aged-receivable",
  "accounting-aged-payable",
] as const;

/** `JournalStatus` — the values the Journal entries status filter offers. */
export const JOURNAL_STATUS_VALUES = ["DRAFT", "POSTED", "REVERSED"] as const;

/** `PostingErrorStatus` — the values the Posting errors status filter offers. */
export const POSTING_ERROR_STATUS_VALUES = ["OPEN", "RESOLVED", "DISMISSED"] as const;

/** `InvoiceStatus` — the only values `ar/invoices?status=` accepts (batch 3 `@IsEnum`). */
export const AR_INVOICE_STATUS_VALUES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
  "CREDIT_ADJUSTED",
] as const;

/** `VendorBillStatus` — the only values `ap/bills?status=` accepts (includes OVERDUE, which AR lacks). */
export const AP_BILL_STATUS_VALUES = [
  "DRAFT",
  "APPROVED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

/** `BankStatementStatus` — the values the Bank statements client-side status filter offers. */
export const BANK_STATEMENT_STATUS_VALUES = ["PENDING", "IMPORTED", "RECONCILED", "VOIDED"] as const;

/** `BankReconciliationStatus` — the values the Reconciliation client-side status filter offers. */
export const BANK_RECONCILIATION_STATUS_VALUES = ["OPEN", "IN_PROGRESS", "COMPLETED", "DISPUTED"] as const;

/** The five cards the B5.1 grid ships, in render order. */
export const ACCOUNTING_CARDS = [
  "accounting-receivable",
  "accounting-payable",
  "accounting-ledger",
  "accounting-bank",
  "accounting-period",
] as const;

export function card(page: Page, testId: (typeof ACCOUNTING_CARDS)[number]) {
  return page.locator(`[data-manager-dashboard-card="${testId}"]`);
}

export function kpi(page: Page, key: string) {
  return page.locator(`[data-accounting-kpi="${key}"]`);
}

/** Resolves once every card has left its loading state. */
export async function waitForAccountingSettled(page: Page) {
  await page.locator("[data-accounting-dashboard-grid]").waitFor({ state: "visible", timeout: 45_000 });
  await expect
    .poll(() => page.locator('[data-manager-card-state="loading"]').count(), { timeout: 45_000 })
    .toBe(0);
}

/**
 * The rendered text of a KPI, minus its label.
 *
 * Deliberately keyed on the binding key rather than on position: the whole point
 * of the KPI registry is that a figure sits under the RIGHT binding, so a
 * positional match would not prove the thing that matters.
 */
export async function kpiValue(page: Page, key: string) {
  const node = kpi(page, key);
  await expect(node).toBeVisible();
  const text = (await node.textContent()) || "";
  return text.trim();
}

/** Digits only, so "UGX 9,106,400" and "9106400" compare equal. */
export function digitsOf(value: string) {
  return (value.match(/\d/g) || []).join("");
}

export function accountingMenuTrigger(page: Page) {
  return page
    .locator('[data-operational-top-nav] [role="menubar"]')
    .getByRole("menuitem", { name: /^accounting$/i });
}

// ── Track B5.2 — Customers/Vendors list + detail + aging-report helpers ─────

/** The `ManagerListTable` wrapper (present only once the list has settled with rows). */
export function listTable(page: Page) {
  return page.locator("[data-manager-list-table]");
}

/** All data rows currently rendered in the list table. */
export function listRows(page: Page) {
  return page.locator("[data-manager-list-row]");
}

export function listRow(page: Page, id: string) {
  return page.locator(`[data-manager-list-row="${id}"]`);
}

/**
 * Resolves once a Manager list/detail surface has settled — the table (or, on
 * a detail panel, its identifying content), an empty-state heading, or an
 * error-state heading is on screen. Mirrors `e2e/manager-operations/fixtures.ts`
 * `waitForListSettled` — same shared `ManagerListTable`/`EmptyState`/`ErrorState`
 * primitives, same arrival-barrier shape.
 *
 * ⚠️ This is an ARRIVAL barrier, not a TRANSITION barrier: it returns
 * immediately if content is already on screen, so a paginate/filter/row-click
 * that keeps the previous content visible while the next read is in flight
 * must be awaited with {@link waitForApiRequest} instead.
 */
export async function waitForManagerListSettled(page: Page) {
  await expect
    .poll(
      async () => {
        const table = await listTable(page).count();
        const empty = await page.getByRole("heading", { name: /^No /i }).count();
        const error = await page.getByRole("heading", { name: /unavailable/i }).count();
        // Detail panels render neither a list-table nor an Empty/Error heading
        // on success — their arrival is the record pager / status pipeline, so
        // also settle once the "Loading …" skeleton title is gone.
        const loading = await page.getByText(/^Loading /i).count();
        return table + empty + error > 0 || loading === 0 ? 1 : 0;
      },
      { timeout: 45_000 },
    )
    .toBe(1);
}

/**
 * Waits for a captured request whose URL matches `pattern` — the correct
 * barrier after an interaction that triggers a refetch (filter, paginate,
 * open a record), because the previous content stays on screen while the new
 * read is in flight.
 */
export async function waitForApiRequest(
  requests: Array<{ url: string; method: string; branchId: string | null }>,
  pattern: RegExp,
  timeout = 30_000,
) {
  await expect.poll(() => requests.filter((request) => pattern.test(request.url)).length, { timeout }).toBeGreaterThan(0);
  return requests.filter((request) => pattern.test(request.url));
}

/** The `ManagerControlPanel` list pager (`aria-label="Pagination"`). Absent on unpaginated surfaces. */
export function managerPager(page: Page) {
  return page.locator('[aria-label="Pagination"]');
}

export function managerPagerNext(page: Page) {
  return page.getByRole("button", { name: "Next page" });
}

export function managerPagerPrevious(page: Page) {
  return page.getByRole("button", { name: "Previous page" });
}

/** Parses the `"{from}-{to} / {total}"` (or `"0 / 0"`) pager text into numbers. */
export async function readManagerPagerTotal(page: Page) {
  const text = (await managerPager(page).textContent()) || "";
  const match = text.match(/\/\s*([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

/** The record breadcrumb pager (`aria-label="Record pagination"`) on a detail panel. */
export function recordPager(page: Page) {
  return page.locator('[aria-label="Record pagination"]');
}

export function statusPipeline(page: Page) {
  return page.locator("[data-manager-status-pipeline]");
}

/** Opens a list surface's Filters menu by its `ariaLabel` (e.g. "Filter invoices"). */
export function listFilterTrigger(page: Page, ariaLabel: string) {
  return page.getByRole("button", { name: ariaLabel });
}

export function listFilterOption(page: Page, label: string) {
  return page.getByRole("menuitemcheckbox", { name: label });
}
