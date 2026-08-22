import { expect, Page } from "@playwright/test";

import { MANAGER_CFG } from "../manager-shell/fixtures";

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

  // Closing — Track B5.5
  fiscalPeriods: "/manager/accounting/closing/fiscal-periods",
  periodCloseRuns: "/manager/accounting/closing/period-close-runs",

  // Reporting (Budgets/Demand calendar/Forecast) + Configuration — Track B5.6 (write-enabled)
  budgets: "/manager/accounting/reporting/budgets",
  demandCalendar: "/manager/accounting/reporting/demand-calendar",
  forecast: "/manager/accounting/reporting/forecast",
  chartOfAccounts: "/manager/accounting/configuration/chart-of-accounts",
  costCentres: "/manager/accounting/configuration/cost-centres",
  postingSourceMaps: "/manager/accounting/configuration/posting-source-maps",
  taxConfig: "/manager/accounting/configuration/tax-config",
} as const;

/**
 * The 28 rows that are `available: true` in `lib/accounting/menu.ts` — ALL of
 * them, as of Track B5.6 (2026-08-22) — in DOM order. The Bank group sits
 * BEFORE "Accounting" and "Review" in the menu tree (Customers → Vendors →
 * Bank → Accounting → Review → Reporting → Configuration). Within
 * "Accounting", Fiscal periods/Period close runs sit AFTER Journal entries.
 * B5.6 appended its three Reporting rows (Budgets vs actuals, Demand
 * calendar, Forecast) AFTER Aged payable, and its four Configuration rows
 * (Chart of accounts, Cost centres, Posting source maps, Tax configuration)
 * at the very end — menu.ts's own row order, not appended arbitrarily.
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
  "accounting-periods",
  "accounting-period-close-runs",
  "accounting-posting-runs",
  "accounting-posting-errors",
  "accounting-audit-trail",
  "accounting-aged-receivable",
  "accounting-aged-payable",
  "accounting-budgets",
  "accounting-demand-calendar",
  "accounting-forecast",
  "accounting-chart-of-accounts",
  "accounting-cost-centres",
  "accounting-posting-source-maps",
  "accounting-tax-config",
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

// ═══════════════════════════════════════════════════════════════════════════
// B5.7-GAP (2026-08-22) — API fixture helpers for the write-enabled surfaces.
// Same pattern as `e2e/supervisor-reservations/fixtures.ts`'s
// `apiLoginRole`/`apiCreateReservation`: self-contained QA data created live
// via the API, not committed seed rows, so these specs never depend on a
// specific stack's exact fixture state beyond what demo-import already
// guarantees (branches, a handful of POSTED journals).
// ═══════════════════════════════════════════════════════════════════════════

function accountingHeaders(token: string, branchId: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Branch-Id": branchId,
  };
}

/** Logs in as the seeded demo Manager via the API and returns an access token. */
export async function apiLoginManager(): Promise<string> {
  const res = await fetch(`${MANAGER_CFG.api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: MANAGER_CFG.email, password: MANAGER_CFG.password }),
  });
  const json = await res.json();
  return json.accessToken as string;
}

/**
 * `POST /accounting/periods` — a fresh DRAFT fiscal period, uniquely named
 * AND uniquely windowed per call (the backend refuses an overlapping
 * fiscal-period date range — a real business rule found live while writing
 * this spec, not previously documented).
 */
export async function apiCreateFiscalPeriod(
  token: string,
  branchId: string,
): Promise<{ id: string; name: string }> {
  // A narrow day-offset space (originally `Date.now() % 3650`, ~10 years)
  // started colliding with itself after enough accumulated runs against a
  // reused isolated stack — a real flake found live while writing this spec
  // (`POST /accounting/periods` 409s on an overlapping window, and the
  // caller must check `res.ok`, not just assume `json.name` is present).
  // Widened to ~2,700 years of distinct days and retried a few times with a
  // fresh random offset on a 409, rather than trusting one shot.
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const name = `B57GAP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dayOffset = Math.floor(Math.random() * 1_000_000);
    const startsAt = new Date(Date.UTC(2035, 0, 1) + dayOffset * 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 89 * 86_400_000);
    const res = await fetch(`${MANAGER_CFG.api}/api/accounting/periods`, {
      method: "POST",
      headers: accountingHeaders(token, branchId),
      body: JSON.stringify({
        name,
        startsAt: startsAt.toISOString().slice(0, 10),
        endsAt: endsAt.toISOString().slice(0, 10),
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { id: json.id as string, name: json.name as string };
    }
    lastError = `${res.status} ${await res.text()}`;
  }
  throw new Error(`apiCreateFiscalPeriod: exhausted retries — last error: ${lastError}`);
}

/** `POST /accounting/posting/replay` with an unknown sourceKey — the documented way to raise a real PostingError. */
export async function apiCreatePostingError(token: string, branchId: string): Promise<{ id: string; errorId: string }> {
  const sourceKey = `B57GAP_QA_${Date.now()}`;
  const res = await fetch(`${MANAGER_CFG.api}/api/accounting/posting/replay`, {
    method: "POST",
    headers: accountingHeaders(token, branchId),
    body: JSON.stringify({ sourceKey, sourceDocumentId: `b57gap-${Date.now()}` }),
  });
  const json = await res.json();
  return { id: json.postingRun.id as string, errorId: json.error.id as string };
}

export type BankReconciliationFixture = {
  reconciliationId: string;
  bankAccountId: string;
  statementLineId: string;
  manualEntryId: string;
};

/**
 * Creates a bank account, imports a one-line statement, records a matching
 * manual entry, and starts a reconciliation — everything `match` needs,
 * left UNMATCHED so the spec itself drives the Match action through the UI.
 */
export async function apiCreateReconciliationFixture(
  token: string,
  branchId: string,
): Promise<BankReconciliationFixture> {
  const stamp = Date.now();
  const headers = accountingHeaders(token, branchId);

  const bankAccountRes = await fetch(`${MANAGER_CFG.api}/api/accounting/bank-accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: `B57GAP Bank ${stamp}`, accountCode: `Q${stamp}`, bankName: "QA Bank", currencyCode: "UGX" }),
  });
  const bankAccount = await bankAccountRes.json();

  const statementRes = await fetch(`${MANAGER_CFG.api}/api/accounting/bank-statements/import`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccount.id,
      statementDate: "2026-08-22",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-22",
      openingBalance: 0,
      closingBalance: 42000,
      lines: [{ txDate: "2026-08-10", description: `B57GAP deposit ${stamp}`, amount: 42000, direction: "CREDIT" }],
    }),
  });
  const statement = await statementRes.json();

  const manualEntryRes = await fetch(`${MANAGER_CFG.api}/api/accounting/manual-bank-entries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankAccountId: bankAccount.id,
      txDate: "2026-08-10",
      amount: 42000,
      direction: "CREDIT",
      description: `B57GAP manual entry ${stamp}`,
      entryType: "MISCELLANEOUS",
    }),
  });
  const manualEntry = await manualEntryRes.json();

  const reconciliationRes = await fetch(`${MANAGER_CFG.api}/api/accounting/reconciliation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ bankAccountId: bankAccount.id, bankStatementId: statement.id }),
  });
  const reconciliation = await reconciliationRes.json();

  return {
    reconciliationId: reconciliation.id as string,
    bankAccountId: bankAccount.id as string,
    statementLineId: statement.lines[0].id as string,
    manualEntryId: manualEntry.id as string,
  };
}

/**
 * Returns the id of a POSTED journal on the active branch, preferring the
 * highest-numbered row (the freshest — least likely to have been reversed by
 * an earlier run of this same spec against a reused stack). `status=POSTED`
 * alone already excludes REVERSED journals (a reversed journal's own status
 * transitions to REVERSED, per `ledger.service.ts`'s `reverseJournal`), so no
 * further filtering is needed. Demo-import seeds several on Tapas Downtown.
 */
export async function apiFindReversibleJournal(token: string, branchId: string): Promise<string | null> {
  const res = await fetch(`${MANAGER_CFG.api}/api/accounting/journals?status=POSTED&take=20`, {
    headers: accountingHeaders(token, branchId),
  });
  const json = await res.json();
  const rows = (json.data as Array<{ id: string; journalNumber?: string | null }>) || [];
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => (b.journalNumber || "").localeCompare(a.journalNumber || ""));
  return sorted[0].id;
}
