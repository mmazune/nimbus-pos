/**
 * Accounting route registry — Track B5.1.
 *
 * The machine-checkable contract for the whole Accounting module: every route the
 * UI may reference, with the permission that guards it, whether the **Manager**
 * role can actually reach it, the scope the backend really applies, and the
 * response envelope it really returns.
 *
 * WHY IT EXISTS. The roadmap's B5 acceptance gate reads *"every menu item
 * resolves to a verified endpoint; no menu item exists without one"*. This file
 * is that gate in executable form — `scripts/manager-b5-assertions.ts` walks it,
 * `menu.ts` may only cite keys that appear here, and every rendered figure binds
 * to one of these entries through `ACCOUNTING_KPI_BINDINGS`.
 *
 * PROVENANCE. Every row was re-probed **live on 2026-08-21** against an isolated
 * local Docker stack (Postgres `:55435`, API `:4031`, from-scratch
 * `migrate deploy` → `db:seed` → `db:demo:import`) with a real Manager token,
 * against **two** branches, at commit `43e1cf1` — i.e. AFTER backend gap batch 2.
 * The B0 report (`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`) is the reference;
 * where this pass measured something different, the `note` says so.
 *
 * NO WRITES. Manager holds **15 accounting read strings and zero writes**
 * (PC-01/PC-02, re-verified live: 5/5 representative writes → 403). This registry
 * therefore contains **only GET routes**. The writes an Odoo user would expect are
 * listed separately in `ACCOUNTING_DENIED_WRITES` so the UI can *name* what it
 * cannot do instead of rendering a disabled button for it.
 *
 * RELATIVE IMPORTS on purpose: this module is executed directly by the assertion
 * script under `tsx`, which does not resolve the Next.js `@/` alias at runtime.
 * Same precedent as `lib/manager/dashboard-model.ts`.
 */

/** Where the backend really scopes the read. Not what we wish it did. */
export type AccountingRouteScope =
  /** Filtered by `orgId` **and** the acting `X-Branch-Id`. */
  | "branch"
  /**
   * Filtered by `orgId` alone, BY DESIGN — the model carries no `branch_id`
   * column at all, or never stamps one. Backend gap batch 2 ruled on these
   * explicitly; B5 must LABEL them as organisation data, never "fix" them.
   */
  | "organization";

export type AccountingRouteEnvelope =
  /** `{data, total, skip, take}` — a real server total the pager may bind to. */
  | "data-total"
  /** `{data, total}` — a server total, no skip/take. */
  | "data-total-unpaged"
  /** A purpose-built aggregate object (the two aging reports). */
  | "aggregate"
  /** A bare JSON array: no envelope, no `total`, no server pagination (PC-06). */
  | "bare-array"
  /** A single object. */
  | "object";

export type AccountingRouteEntry = {
  key: string;
  /** GET only — see the module docblock. */
  method: "GET";
  path: string;
  /** The `@Permissions(...)` string on the controller. */
  permission: string;
  /** Live-verified reachability for a Manager token. */
  manager: "allowed" | "forbidden";
  scope: AccountingRouteScope;
  envelope: AccountingRouteEnvelope;
  /** True only when the endpoint returns its own count for the full `where`. */
  serverTotal: boolean;
  /** What the 2026-08-21 isolated probe actually observed. */
  observed: string;
  note?: string;
};

export const ACCOUNTING_ROUTES_VERIFIED_ON = "2026-08-21";

export const ACCOUNTING_ROUTE_REGISTRY: readonly AccountingRouteEntry[] = [
  // ── Accounts payable (Vendors) ────────────────────────────────────────────
  {
    key: "ap.aging",
    method: "GET",
    path: "/api/accounting/ap/aging",
    permission: "accounting:ap:bill:read",
    manager: "allowed",
    scope: "branch",
    envelope: "aggregate",
    serverTotal: false,
    observed:
      "200 {asOf, buckets{current,days1to30,days31to60,days61to90,days90plus,total}, bySupplier[], billCount}; Tapas total 1,282,400 / 3 bills vs Rooftop 3,263,500 — the branch header changes the money.",
    note: "UNPAGED by design: the service reads every open bill for the branch, so buckets.total IS the branch total, not a page subtotal. Contrast ar.aging below.",
  },
  {
    key: "ap.bills",
    method: "GET",
    path: "/api/accounting/ap/bills",
    permission: "accounting:ap:bill:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 6 (Tapas) / 7 (Rooftop).",
    note: "?status= accepts VendorBillStatus only (DRAFT|APPROVED|PARTIALLY_PAID|PAID|OVERDUE|CANCELLED); PENDING_APPROVAL → 400.",
  },
  {
    key: "ap.bill",
    method: "GET",
    path: "/api/accounting/ap/bills/:id",
    permission: "accounting:ap:bill:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "404 for a non-existent id — the permission passes (B0 matrix).",
  },
  {
    key: "ap.suppliers",
    method: "GET",
    path: "/api/accounting/ap/suppliers",
    permission: "accounting:ap:bill:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 10 per branch; every returned row's own branchId matches the header.",
    note: "PC-03: this route ignored X-Branch-Id entirely before backend gap batch 2. Fixed at 43e1cf1 and re-verified here.",
  },
  {
    key: "ap.payments",
    method: "GET",
    path: "/api/accounting/ap/payments",
    permission: "accounting:ap:bill:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 12 (Tapas) / 0 (Rooftop).",
  },
  {
    key: "ap.creditNotes",
    method: "GET",
    path: "/api/accounting/ap/credit-notes",
    permission: "accounting:ap:credit-note:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 0 on this dataset — no AP credit note is seeded or demo-imported.",
  },
  {
    key: "ap.recurringProfiles",
    method: "GET",
    path: "/api/accounting/ap/recurring-profiles",
    permission: "accounting:ap:recurring:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 0 on this dataset.",
  },
  {
    key: "ap.reminders",
    method: "GET",
    path: "/api/accounting/ap/reminders",
    permission: "accounting:ap:reminder:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 0 on this dataset.",
  },

  // ── Accounts receivable (Customers) ───────────────────────────────────────
  {
    key: "ar.aging",
    method: "GET",
    path: "/api/accounting/ar/aging",
    permission: "accounting:ar:aging:read",
    manager: "allowed",
    scope: "branch",
    envelope: "aggregate",
    serverTotal: true,
    observed:
      "200 {asOf, total, skip, take, summary{current,bucket_1_30,bucket_31_60,bucket_61_90,bucket_90_plus,totalOutstanding}, accounts[]}; Tapas 9,106,400 over 5 invoices vs Rooftop 2,454,600 over 2.",
    note:
      "🔴 B5-F1 (found by this pass, NOT in B0): `summary` is aggregated over the RETURNED PAGE, not the whole `where`. Probed live: ?take=1 returns total 5 but summary.totalOutstanding 599,800 instead of 9,106,400. `total` counts INVOICES while `accounts[]` groups them, so completeness = Σ accounts[].invoices.length >= total. The UI must fail closed when the page is partial. PC-05 renamed totals.grand* → summary.* — the names above are the live ones.",
  },
  {
    key: "ar.invoices",
    method: "GET",
    path: "/api/accounting/ar/invoices",
    permission: "accounting:ar:invoice:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 7 (Tapas) / 4 (Rooftop).",
    note:
      "🔴 B5-F2 (found by this pass): `?status=` is an unvalidated raw string handed to Prisma. `status=OVERDUE` — a VendorBillStatus value that InvoiceStatus does not have — returns **500**, not 400. Valid values are DRAFT|ISSUED|PARTIALLY_PAID|PAID|CANCELLED|CREDIT_ADJUSTED.",
  },
  {
    key: "ar.invoice",
    method: "GET",
    path: "/api/accounting/ar/invoices/:id",
    permission: "accounting:ar:invoice:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "404 for a non-existent id — the permission passes (B0 matrix).",
  },
  {
    key: "ar.accounts",
    method: "GET",
    path: "/api/accounting/ar/accounts",
    permission: "accounting:ar:account:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 7 (Tapas) / 4 (Rooftop).",
    note: "PC-03: honoured only the optional ?branchId= query param and ignored X-Branch-Id before batch 2.",
  },
  {
    key: "ar.account",
    method: "GET",
    path: "/api/accounting/ar/accounts/:id",
    permission: "accounting:ar:account:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "404 for a non-existent id — the permission passes (B0 matrix).",
  },
  {
    key: "ar.creditNotes",
    method: "GET",
    path: "/api/accounting/ar/credit-notes",
    permission: "accounting:ar:credit-note:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 0 on this dataset.",
  },

  // ── Bank ──────────────────────────────────────────────────────────────────
  {
    key: "bank.accounts",
    method: "GET",
    path: "/api/accounting/bank-accounts",
    permission: "pos:accounting:bank-accounts:read",
    manager: "allowed",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [] on this dataset — no bank account is seeded or demo-imported for any branch.",
    note: "PC-06: bare array, no total, no server pagination bound.",
  },
  {
    key: "bank.statements",
    method: "GET",
    path: "/api/accounting/bank-statements",
    permission: "pos:accounting:bank-statements:read",
    manager: "allowed",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [] on this dataset.",
    note: "PC-03/PC-06: was org-scoped on BOTH list and detail before batch 2; BankStatement.branchId is NOT NULL so both now use strict branch equality.",
  },
  {
    key: "bank.statement",
    method: "GET",
    path: "/api/accounting/bank-statements/:id",
    permission: "pos:accounting:bank-statements:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "Not exercised on this dataset — zero statements exist (B0 matrix records 404* for a non-existent id).",
  },
  {
    key: "bank.reconciliations",
    method: "GET",
    path: "/api/accounting/reconciliation",
    permission: "pos:accounting:reconciliation:read",
    manager: "allowed",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [] on this dataset.",
    note: "PC-06: bare array.",
  },
  {
    key: "bank.reconciliation",
    method: "GET",
    path: "/api/accounting/reconciliation/:id",
    permission: "pos:accounting:reconciliation:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "Not exercised on this dataset — zero reconciliations exist (B0 matrix records 404*).",
  },

  // ── Accounting core + Closing ─────────────────────────────────────────────
  {
    key: "accounting.periods",
    method: "GET",
    path: "/api/accounting/periods",
    permission: "pos:accounting:periods:read",
    manager: "allowed",
    scope: "organization",
    envelope: "bare-array",
    serverTotal: false,
    observed:
      "200 [5] identical under both branch headers; no row carries a branchId field at all. FY2026-Q3 / FY2026-07 / FY2026-06 all OPEN.",
    note: "ORG-LEVEL BY DESIGN (batch 2): FiscalPeriod has no branch_id column. PC-07: DRAFT → OPEN → CLOSED → LOCKED, LOCKED terminal, no unlock route.",
  },
  {
    key: "accounting.periodCloseRuns",
    method: "GET",
    path: "/api/accounting/period-close-runs",
    permission: "pos:accounting:period-close-runs:read",
    manager: "allowed",
    scope: "organization",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [] identical under both branch headers.",
    note: "ORG-LEVEL BY DESIGN (batch 2): PeriodCloseRun.branchId is nullable and the close path never stamps it.",
  },
  {
    key: "accounting.journals",
    method: "GET",
    path: "/api/accounting/journals",
    permission: "pos:accounting:journals:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 5 (Tapas) / 8 (Rooftop); rows carry status POSTED and balanced totalDebit/totalCredit.",
    note: "Manager READ-ONLY: journals:create / journals/:id/reverse / posting/replay are 403 (B0 §3.4, re-verified — POST /journals → 403).",
  },
  {
    key: "accounting.journal",
    method: "GET",
    path: "/api/accounting/journals/:id",
    permission: "pos:accounting:journals:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "404 for a non-existent id — the permission passes (B0 matrix).",
    note:
      "🔴 C-25 (found by this pass, Track B5.4, NOT in B0/batch 2/batch 3): `getJournal` resolves by `{id, orgId}` alone — no branch predicate at all, list/detail-inconsistent with `listJournals`. A journal id from another branch's list is still readable by id under this branch's header. Backend fix out of scope for this frontend-only phase (Track C candidate). Mitigated client-side: the journal detail screen compares the returned `branchId` against the active branch and refuses to render a mismatch, the same MP0-12 fail-safe B4 used for report runs.",
  },
  {
    key: "accounting.postingRuns",
    method: "GET",
    path: "/api/accounting/posting-runs",
    permission: "pos:accounting:posting-runs:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 0 on this dataset, both branches.",
  },
  {
    key: "accounting.postingErrors",
    method: "GET",
    path: "/api/accounting/posting-errors",
    permission: "pos:accounting:posting-errors:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed: "200 total 0 on this dataset, both branches.",
  },
  {
    key: "accounting.postingError",
    method: "GET",
    path: "/api/accounting/posting-errors/:id",
    permission: "pos:accounting:posting-errors:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "Not exercised — zero posting errors exist (B0 recorded the same gap).",
    note: "PC-03 class: getPostingError was org-scoped while the list was branch-scoped; batch 2 aligned them.",
  },

  // ── Configuration ─────────────────────────────────────────────────────────
  {
    key: "accounting.chartOfAccounts",
    method: "GET",
    path: "/api/accounting/accounts",
    permission: "pos:accounting:accounts:read",
    manager: "allowed",
    scope: "organization",
    envelope: "data-total-unpaged",
    serverTotal: true,
    observed: "200 total 16, identical under both branch headers.",
    note: "ORG-LEVEL BY DESIGN: the chart of accounts is organisation-wide (listAccounts filters on orgId alone).",
  },
  {
    key: "accounting.costCenters",
    method: "GET",
    path: "/api/accounting/cost-centers",
    permission: "pos:accounting:cost-centers:read",
    manager: "allowed",
    scope: "organization",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [21] identical under both branch headers, though the codes are branch-prefixed (e.g. TAPAS_DOWNTOWN-ADMIN).",
    note: "ORG-LEVEL: listCostCenters filters on orgId + active only.",
  },
  {
    key: "accounting.postingSourceMaps",
    method: "GET",
    path: "/api/accounting/posting-source-maps",
    permission: "pos:accounting:posting-source-maps:read",
    manager: "allowed",
    scope: "organization",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [6] identical under both branch headers.",
    note: "ORG-LEVEL BY DESIGN (batch 2): PostingSourceMap has no branch_id column.",
  },
  {
    key: "accounting.taxConfig",
    method: "GET",
    path: "/api/accounting/tax-config",
    permission: "pos:accounting:tax-config:read",
    manager: "allowed",
    scope: "organization",
    envelope: "object",
    serverTotal: false,
    observed: "200 single object with the five mapped accounts and `active: true`, identical under both branch headers.",
    note: "ORG-LEVEL BY DESIGN (batch 2): TaxLedgerConfig has no branch_id column. Manager cannot update it (403).",
  },

  // ── Reporting ─────────────────────────────────────────────────────────────
  {
    key: "finance.budgets",
    method: "GET",
    path: "/api/finance/budgets",
    permission: "finance:budget:read",
    manager: "allowed",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [] on this dataset, both branches — no budget row is seeded or demo-imported.",
    note: "PC-06: bare array. Strict branch equality (orgId + branchId) in listBudgets.",
  },
  {
    key: "finance.demandCalendar",
    method: "GET",
    path: "/api/finance/demand-calendar",
    permission: "finance:demand-calendar:read",
    manager: "allowed",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed: "200 [] on this dataset, both branches.",
    note: "PC-06: bare array.",
  },
  {
    key: "franchise.forecast",
    method: "GET",
    path: "/api/franchise/forecast",
    permission: "franchise:forecast:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "200 single forecast object with assumptions/demandSignals/daypartSummaries/outputs and an embedded procurementSuggestions[].",
    note: "⚠️ /api/FRANCHISE/forecast, not /api/finance/forecast — the route lives on a third @Controller class inside budget.controller.ts. A client assuming the /finance prefix 404s.",
  },
  {
    key: "finance.procurementSuggestions",
    method: "GET",
    path: "/api/finance/procurement-suggestions",
    permission: "procurement:advisory:read",
    manager: "forbidden",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed: "403 for Manager — re-verified live on this stack.",
    note: "PC-02: the SAME string gates the mutation PATCH /finance/procurement-suggestions/:id/review, so granting the read would grant a write. Deliberately withheld. This surface is therefore ABSENT from the menu, not a not-yet row.",
  },

  // ── Review ────────────────────────────────────────────────────────────────
  {
    key: "audit.timeline",
    method: "GET",
    path: "/api/audit/timeline",
    permission: "audit:read",
    manager: "allowed",
    scope: "branch",
    envelope: "data-total",
    serverTotal: true,
    observed:
      "200 {data, total, page, pageSize, filters} — re-verified live 2026-08-21 on the isolated B5.4 stack. Paged with `page`/`pageSize` (NOT `skip`/`take` like every other data-total route in this registry — `toAccountingPager({page, pageSize, total})` still applies, only the request param names differ). `?limit=` is rejected 400 by the DTO whitelist.",
    note:
      "✅ B5-F4 FIXED (backend gap batch 3, 2026-08-21): this entry was written B5.1-era, before the fix, and said the endpoint ignored X-Branch-Id and was ORGANISATION scope — STALE, corrected here. `audit-timeline.service.ts` now unconditionally ANDs `metadata.branchId = X-Branch-Id`, mirroring the AR/AP 'header scopes it; an explicit ?branchId= narrows within that scope, and a disagreeing one returns nothing' precedent. Genuinely branch-scoped like every other B5.4 surface. Accountant cannot read it (403) but Manager can (B0 §10). " +
      "🔴 C-26 (found by this pass, Track B5.4, NOT in B0/batch 2/batch 3): `ledger.service.ts`'s six `audit.log(...)` calls (JOURNAL_CREATED, JOURNAL_REVERSED, POSTING_RUN_STARTED, POSTING_RUN_FINISHED, POSTING_ERROR_CREATED) stamp `metadata.orgId` but NEVER `metadata.branchId` — live-proven: 8 fresh journal/posting-run/posting-error events were created via this pass's own fixtures (JOURNAL_CREATED ×3, JOURNAL_REVERSED ×1, POSTING_RUN_STARTED/FINISHED ×2 pairs, POSTING_ERROR_CREATED ×1), and every one of the resulting `AuditLog` rows has `metadata->>'branchId'` = NULL. Because B5-F4's fix ANDs branch match unconditionally, this endpoint can structurally never return a ledger-domain event through the default branch-scoped read — not a data-freshness gap, a metadata-shape gap. Backend fix (add `branchId` to those six call sites) is out of scope for this frontend-only phase; the Audit trail screen discloses the gap in its own copy rather than implying no ledger event has ever happened.",
  },
];

const registryByKey = new Map(ACCOUNTING_ROUTE_REGISTRY.map((entry) => [entry.key, entry]));

export function getAccountingRoute(key: string): AccountingRouteEntry {
  const entry = registryByKey.get(key);
  if (!entry) {
    throw new Error(
      `Accounting route "${key}" is not in ACCOUNTING_ROUTE_REGISTRY — every menu item and every rendered figure must cite a live-verified endpoint.`,
    );
  }
  return entry;
}

export function isAccountingRouteReadableByManager(key: string) {
  return getAccountingRoute(key).manager === "allowed";
}

/**
 * The writes an Odoo Accounting user would expect and **Manager does not hold**.
 *
 * This is the honest counterpart to the read-only ruling: rather than render a
 * disabled `New` / `Post` / `Approve` / `Match` button, the UI names the action
 * and says who can perform it. All were re-verified live at 43e1cf1 — a Manager
 * token returned 403 on five representative writes (AP supplier create, AR
 * invoice create, journal create, bank account create, budget create).
 */
export const ACCOUNTING_DENIED_WRITES: readonly {
  label: string;
  route: string;
  permission: string;
  finding: string;
}[] = [
  {
    label: "Create or approve a vendor bill",
    route: "POST /api/accounting/ap/bills · POST /api/accounting/ap/bills/:id/approve",
    permission: "accounting:ap:bill:write · accounting:ap:bill:approve",
    finding: "PC-01",
  },
  {
    label: "Record a supplier payment",
    route: "POST /api/accounting/ap/payments",
    permission: "accounting:ap:payment:write",
    finding: "PC-01",
  },
  {
    label: "Issue a customer invoice or receipt",
    route: "POST /api/accounting/ar/invoices · POST /api/accounting/ar/receipts",
    permission: "accounting:ar:invoice:write · accounting:ar:receipt:write",
    finding: "PC-01",
  },
  {
    label: "Match, skip or complete a bank reconciliation",
    route: "PATCH /api/accounting/reconciliation/:id/match · /skip · POST /:id/complete",
    permission: "pos:accounting:reconciliation:match · pos:accounting:reconciliation:create",
    finding: "PC-01",
  },
  {
    label: "Post or reverse a journal entry",
    route: "POST /api/accounting/journals · POST /api/accounting/journals/:id/reverse",
    permission: "pos:accounting:journals:create · pos:accounting:journals:reverse",
    finding: "OD-9 / B0 §3.4",
  },
  {
    label: "Replay a posting run",
    route: "POST /api/accounting/posting/replay",
    permission: "pos:accounting:posting:replay",
    finding: "OD-9 / B0 §3.4 — re-verified live 403 for Manager, Track B5.4",
  },
  {
    label: "Open, close or lock a fiscal period",
    route: "PATCH /api/accounting/periods/:id/open · /close · /lock",
    permission: "pos:accounting:periods:open · :close · :lock",
    finding: "PC-01 / PC-07",
  },
  {
    label: "Create a budget or refresh its actuals",
    route: "POST /api/finance/budgets · POST /api/finance/budgets/:id/update-actuals",
    permission: "finance:budget:write · finance:budget:update-actuals",
    finding: "PC-01",
  },
  {
    label: "Review a procurement suggestion",
    route: "PATCH /api/finance/procurement-suggestions/:id/review",
    permission: "procurement:advisory:read",
    finding: "PC-02 — one string gates both the read and this write, so Manager holds neither.",
  },
];
