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
 * NO WRITES (B5.1–B5.5 ONLY). Manager held 15 accounting read strings and zero
 * writes when B5.1–B5.5 shipped (PC-01/PC-02, re-verified live: 5/5 representative
 * writes → 403). This registry therefore contains **only GET routes**, and every
 * B5.1–B5.5 surface still renders zero write affordances (Track B5.7 gates that).
 * The writes an Odoo user would expect from those surfaces are listed separately
 * in `ACCOUNTING_DENIED_WRITES` so the UI can *name* what it cannot do instead of
 * rendering a disabled button for it.
 *
 * ⚠️ **PERMS-2 (2026-08-21) changed the permission story, and Track B5.6
 * (2026-08-22) is the first surface to act on it.** Manager now holds the full
 * 36-string `C21_ACCOUNTING_FINANCE_ALL` set plus the widened M28/M29 block —
 * matching Accountant/Owner — so PC-01/PC-02 are resolved. B5.6 builds exactly
 * seven WRITE-ENABLED surfaces (Budgets, Demand calendar, Forecast, Chart of
 * accounts, Cost centres, Posting source maps, Tax configuration). Their write
 * routes live in the separate `ACCOUNTING_WRITE_ROUTE_REGISTRY` below — this
 * array (`ACCOUNTING_ROUTE_REGISTRY`) stays GET-only by construction, so the
 * B5.1–B5.5 "no write route in the read registry" invariant keeps holding.
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
      "200 [7] identical under both branch headers (Track B5.5 re-probe, 2026-08-21); no row carries a branchId field at all. All four FiscalPeriodStatus members observed live in one org: DRAFT ×2, OPEN ×2 (FY2026-Q3, FY2026-07), CLOSED ×2 (FY2026-05, FY2026-06), LOCKED ×1 (FY2026-04, via PATCH .../lock — confirmed terminal: PATCH .../unlock → 404, route does not exist).",
    note: "ORG-LEVEL BY DESIGN (batch 2): FiscalPeriod has no branch_id column. PC-07: DRAFT → OPEN → CLOSED → LOCKED, LOCKED terminal, no unlock route. 🔴 C-27 (found by this pass, Track B5.5, NOT in B0/batch 2/batch 3/permissions cutover): Manager's own token additionally holds pos:accounting:periods:create (and accounts:create, cost-centers:create) — a pre-existing M28-era grant (seed.ts ~line 1105, comment reads 'Manager: read + create') that the 2026-08-20 permissions cutover never revoked, because C-21 only ADDED the 15 new AP/AR/bank-rec/finance read strings and never audited the OLDER M28/M29-era Manager grants for a stray write. Live-proven: Manager POST /accounting/periods → 201 (created a real DRAFT period on this isolated stack). PATCH .../open, .../close and .../lock are still genuinely 403 for Manager — only :create leaked. Every prior B5 phase's '5/5 representative writes → 403' spot-check never happened to probe periods:create, accounts:create or cost-centers:create, so this went undetected through B5.1–B5.4. NOT fixed here (a permission/seed change is out of scope for a frontend-only phase) — B5.5 ships zero write affordance for Fiscal periods regardless of what the token technically permits, per the same owner ruling every other B5 sub-phase already follows.",
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
    observed:
      "200 [1] identical under both branch headers (Track B5.5 re-probe, 2026-08-21) after a live close via Owner token produced one real COMPLETED run (retainedEarningsAmount -3,297,400 = incomeTotal 3,164,200 - expenseTotal 6,461,600, branchId null). A second close attempt on the same now-CLOSED period correctly 409'd with no second run created.",
    note: "ORG-LEVEL BY DESIGN (batch 2): PeriodCloseRun.branchId is nullable and the close path never stamps it. B5.5-F1 (new finding, this pass): PeriodCloseRunStatus.FAILED and .PENDING are unreachable through the live API — closeFiscalPeriod()'s own transaction always creates the run COMPLETED, and a refused close throws before any run row exists at all, so no code path ever persists FAILED or PENDING.",
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
    key: "finance.budget",
    method: "GET",
    path: "/api/finance/budgets/:id",
    permission: "finance:budget:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "Track B5.6, 2026-08-22: 404 for a non-existent id on the isolated stack — the permission passes.",
    note: "Same include shape as the list row (fiscalPeriod, createdBy, lines), just for one budget.",
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
    key: "finance.demandCalendarEntry",
    method: "GET",
    path: "/api/finance/demand-calendar/:id",
    permission: "finance:demand-calendar:read",
    manager: "allowed",
    scope: "branch",
    envelope: "object",
    serverTotal: false,
    observed: "Track B5.6, 2026-08-22: 404 for a non-existent id on the isolated stack — the permission passes.",
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
    manager: "allowed",
    scope: "branch",
    envelope: "bare-array",
    serverTotal: false,
    observed:
      "INVERTED 2026-08-22 (Track B5.6): 200 for Manager on the isolated stack — PERMS-2 (2026-08-21) granted the full C21_ACCOUNTING_FINANCE_ALL set, including procurement:advisory:read. Previously recorded 403; that was true when B5.1 wrote this entry and is stale now.",
    note: "PC-02 SUPERSEDED: the same string also gates PATCH /finance/procurement-suggestions/:id/review, so the read grant is a write grant too. Still ABSENT from the menu — not because Manager is forbidden any more, but because Track B5.6 (2026-08-22) deliberately built only the seven rows menu.ts tags B5.6, and this is not one of them. A future phase may add it.",
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
    finding:
      "PC-01 SUPERSEDED by PERMS-2: Manager holds these strings now. Still no UI — Track B5.7 (2026-08-22) time-boxed to the fiscal-period/posting-error/bank-reconciliation/journal-reverse surfaces named highest-value in its brief; the full AR/AP module (8 distinct create/edit entity forms across Customers+Vendors) is deliberately deferred to a future B5.7b pass, not silently dropped.",
  },
  {
    label: "Record a supplier payment",
    route: "POST /api/accounting/ap/payments",
    permission: "accounting:ap:payment:write",
    finding: "PC-01 SUPERSEDED by PERMS-2 — deferred to B5.7b, same reason as the vendor-bill row above.",
  },
  {
    label: "Issue a customer invoice or receipt",
    route: "POST /api/accounting/ar/invoices · POST /api/accounting/ar/receipts",
    permission: "accounting:ar:invoice:write · accounting:ar:receipt:write",
    finding: "PC-01 SUPERSEDED by PERMS-2 — deferred to B5.7b, same reason as the vendor-bill row above.",
  },
  // ⚠️ "Match, skip or complete a bank reconciliation" was removed from this
  // list in Track B5.7 (2026-08-22, NOT deleted silently — see the git
  // history of this file): PERMS-2 resolved PC-01 for
  // `pos:accounting:reconciliation:match`/`:create`, and B5.7 built the
  // Reconciliation detail screen with real Match/Skip/Complete controls. It
  // is no longer a denied write; do not re-add it here.
  {
    label: "Post a new journal entry",
    route: "POST /api/accounting/journals",
    permission: "pos:accounting:journals:create",
    finding:
      "OD-9 / B0 §3.4 SUPERSEDED by PERMS-2 (Manager holds journals:create now) but still undeferred: journal creation needs a dynamic, client-balanced multi-line debit/credit form, materially more complex than a resolve/dismiss or open/close/lock action — Track B5.7 built journal REVERSE (a single-click action on an existing POSTED journal) but deliberately deferred CREATE to B5.7b alongside the AR/AP module above.",
  },
  {
    label: "Replay a posting run",
    route: "POST /api/accounting/posting/replay",
    permission: "pos:accounting:posting:replay",
    finding:
      "OD-9 / B0 §3.4 SUPERSEDED by PERMS-2 (Manager holds posting:replay now) but still undeferred: the Posting runs screen is list-only with no detail route (an existing, pre-B5.7 constraint — see the B5.4 completion report), so there is no natural per-row entry point for a 'replay this run' action without first designing one; deferred to B5.7b.",
  },
  // ⚠️ "Open, close or lock a fiscal period" was removed from this list in
  // Track B5.7 (2026-08-22, NOT deleted silently): PERMS-2 resolved PC-01 for
  // `pos:accounting:periods:open`/`:close`/`:lock` (and `:create` was already
  // a live, C-27-disclosed stray grant), and B5.7 built the Fiscal periods
  // screen with a real Create control and real Open/Close/Lock transitions
  // (Lock gated behind an explicit named-period confirm, being irreversible).
  // It is no longer a denied write; do not re-add it here.
  {
    label: "Review a procurement suggestion",
    route: "PATCH /api/finance/procurement-suggestions/:id/review",
    permission: "procurement:advisory:read",
    finding:
      "PC-02 SUPERSEDED by PERMS-2 (2026-08-21): Manager now holds procurement:advisory:read, so this is no longer a permission gap. It stays here because Track B5.6 (2026-08-22) deliberately built only the seven rows menu.ts tags B5.6 — Procurement suggestions is not one of them (ACCOUNTING_OMITTED_ITEMS still records it ABSENT) — so the review action has no UI surface yet, a build-order gate, not a permission one. A future phase may add it as an eighth row.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Track B5.6 — the WRITE route registry.
//
// Deliberately a SEPARATE array from `ACCOUNTING_ROUTE_REGISTRY` (which stays
// GET-only by construction — see the module docblock) rather than widening
// that type to allow a write method: every B5.1–B5.5 assertion that loops over
// `ACCOUNTING_ROUTE_REGISTRY` and asserts `entry.method === "GET"` keeps
// meaning exactly what it always meant. A write route Manager can reach lives
// here instead, named plainly as a write.
//
// All nine entries were live-verified reachable for a Manager token on the
// isolated B5.6 QA stack (see `ai/ENTERPRISE_B5_6_COMPLETION_REPORT.md`) —
// PERMS-2 (2026-08-21) already put every one of these permission strings on
// Manager's token; B5.6 is the first phase to build a UI that calls them.
// ═══════════════════════════════════════════════════════════════════════════

export type AccountingWriteRouteEntry = {
  key: string;
  /** `GET` covers exactly one case: the forecast `?refresh=true` read-with-a-persisted-side-effect — never a bare read. */
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  permission: string;
  manager: "allowed" | "forbidden";
  /** True for the one GET route in this registry — a side-effecting read, not a pure write. */
  sideEffect?: boolean;
  observed: string;
  note?: string;
};

export const ACCOUNTING_WRITE_ROUTE_REGISTRY: readonly AccountingWriteRouteEntry[] = [
  {
    key: "finance.budgets.create",
    method: "POST",
    path: "/api/finance/budgets",
    permission: "finance:budget:write",
    manager: "allowed",
    observed: "201 on the isolated B5.6 stack — a balanced-lines budget is created DRAFT with a real totalBudget.",
    note: "Unique (orgId, branchId, fiscalPeriodId, budgetType, version) — a repeat submission 409s.",
  },
  {
    key: "finance.budget.updateActuals",
    method: "POST",
    path: "/api/finance/budgets/:id/update-actuals",
    permission: "finance:budget:update-actuals",
    manager: "allowed",
    observed: "200 on the isolated B5.6 stack — pulls POSTED journal-line sums per line's accountId and recomputes variance.",
    note: "400 if the budget is ARCHIVED — the form disables the action rather than letting the request fail.",
  },
  {
    key: "finance.demandCalendar.create",
    method: "POST",
    path: "/api/finance/demand-calendar",
    permission: "finance:demand-calendar:write",
    manager: "allowed",
    observed: "201 on the isolated B5.6 stack.",
    note: "400 if dateEnd < dateStart, or if eventId does not resolve in this org+branch.",
  },
  {
    key: "finance.demandCalendarEntry.update",
    method: "PATCH",
    path: "/api/finance/demand-calendar/:id",
    permission: "finance:demand-calendar:write",
    manager: "allowed",
    observed: "200 on the isolated B5.6 stack. Also used for Archive (`isActive: false`) — there is no separate archive route.",
    note: "A partial dateStart/dateEnd PATCH is validated against the OTHER field's stored value, not just the payload.",
  },
  {
    key: "franchise.forecast.refresh",
    method: "GET",
    path: "/api/franchise/forecast?refresh=true",
    permission: "franchise:forecast:read",
    manager: "allowed",
    sideEffect: true,
    observed:
      "200 on the isolated B5.6 stack — persists a new ForecastRun and bulk-creates ProcurementSuggestion rows as a side effect of a GET. No separate write permission exists for this action; the read permission gates it.",
    note: "The UI's 'Refresh forecast' button re-issues this same GET with refresh=true — it is not a POST anywhere in this tree.",
  },
  {
    key: "accounting.accounts.create",
    method: "POST",
    path: "/api/accounting/accounts",
    permission: "pos:accounting:accounts:create",
    manager: "allowed",
    observed: "201 on the isolated B5.6 stack.",
    note: "Unique (orgId, code) — a repeat code 409s. No edit/archive route exists for accounts at all.",
  },
  {
    key: "accounting.costCenters.create",
    method: "POST",
    path: "/api/accounting/cost-centers",
    permission: "pos:accounting:cost-centers:create",
    manager: "allowed",
    observed: "201 on the isolated B5.6 stack.",
    note: "Unique (orgId, code) — a repeat code 409s. No edit/deactivate route exists for cost centres at all.",
  },
  {
    key: "accounting.postingSourceMaps.update",
    method: "PATCH",
    path: "/api/accounting/posting-source-maps/:id",
    permission: "pos:accounting:posting-source-maps:update",
    manager: "allowed",
    observed: "200 on the isolated B5.6 stack.",
    note: "No create route — rows are seed/system-created; sourceKey is immutable. The service does not itself reject debitAccountId === creditAccountId, so the form guards it client-side.",
  },
  {
    key: "accounting.taxConfig.update",
    method: "PATCH",
    path: "/api/accounting/tax-config",
    permission: "pos:accounting:tax-config:update",
    manager: "allowed",
    observed: "200 on the isolated B5.6 stack — updates the existing active row, or creates one if none exists.",
    note: "Omitting `active` from the PATCH body silently forces it to true (dto.active ?? true) — the form always sends it explicitly, never omits it.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Track B5.7 (2026-08-22) — the retrofit write pass over B5.1–B5.5's
  // surfaces. Every string below was already on Manager's token as of
  // PERMS-2 (2026-08-21); B5.7 is the first phase authorised to build UI on
  // top of these specific eight. Live-verified reachable on the isolated
  // B5.7 QA stack — see `ai/ENTERPRISE_B5_7_COMPLETION_REPORT.md`.
  // ═══════════════════════════════════════════════════════════════════════
  {
    key: "accounting.postingError.resolve",
    method: "PATCH",
    path: "/api/accounting/posting-errors/:id/resolve",
    permission: "pos:accounting:posting-errors:resolve",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — an OPEN posting error transitions to RESOLVED, stamping resolvedById/resolvedAt.",
    note: "Batch 4 (B5.4-D1) endpoint. Status-guarded: only an OPEN error may transition; a repeat attempt on the same error 409s.",
  },
  {
    key: "accounting.postingError.dismiss",
    method: "PATCH",
    path: "/api/accounting/posting-errors/:id/dismiss",
    permission: "pos:accounting:posting-errors:resolve",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — an OPEN posting error transitions to DISMISSED, same resolution columns stamped.",
    note: "Same permission string and same status guard as resolve — one permission gates both outcomes, same as discount Approve/Reject in the Supervisor precedent.",
  },
  {
    key: "accounting.periods.create",
    method: "POST",
    path: "/api/accounting/periods",
    permission: "pos:accounting:periods:create",
    manager: "allowed",
    observed: "201 on the isolated B5.7 stack — creates a DRAFT fiscal period.",
    note: "This is the C-27 grant (a pre-existing M28-era permission every B5.1–B5.5 phase deliberately declined to build UI for). B5.7 is the first phase authorised to surface it — see the C-27 note on the accounting.periods READ entry above for the full history; do not read that historical note as still describing current UI state.",
  },
  {
    key: "accounting.periods.open",
    method: "PATCH",
    path: "/api/accounting/periods/:id/open",
    permission: "pos:accounting:periods:open",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — DRAFT → OPEN.",
  },
  {
    key: "accounting.periods.close",
    method: "PATCH",
    path: "/api/accounting/periods/:id/close",
    permission: "pos:accounting:periods:close",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — OPEN → CLOSED, creates a real PeriodCloseRun (COMPLETED) in the same transaction.",
    note: "A period not in OPEN status 400s — the form disables the action outside that status rather than letting the request fail.",
  },
  {
    key: "accounting.periods.lock",
    method: "PATCH",
    path: "/api/accounting/periods/:id/lock",
    permission: "pos:accounting:periods:lock",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — CLOSED → LOCKED, the terminal PC-07 stage. No unlock route exists.",
    note: "Irreversible (PC-07: no unlock route) — the UI requires the acting Manager to type or explicitly confirm the period's own name before this fires, not a generic 'Are you sure?'.",
  },
  {
    key: "accounting.reconciliation.match",
    method: "PATCH",
    path: "/api/accounting/reconciliation/:id/match",
    permission: "pos:accounting:reconciliation:match",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — an UNMATCHED statement line transitions to MATCHED against a chosen journal line or manual entry.",
  },
  {
    key: "accounting.reconciliation.skip",
    method: "PATCH",
    path: "/api/accounting/reconciliation/:id/skip",
    permission: "pos:accounting:reconciliation:match",
    manager: "allowed",
    observed: "200 on the isolated B5.7 stack — an UNMATCHED statement line transitions to SKIPPED.",
  },
  {
    key: "accounting.reconciliation.complete",
    method: "POST",
    path: "/api/accounting/reconciliation/:id/complete",
    permission: "pos:accounting:reconciliation:create",
    manager: "allowed",
    observed:
      "200 on the isolated B5.7 stack with a fully matched, zero-difference line; 400 ('Cannot complete a reconciliation with no matched lines — start matching first') when every line is SKIPPED/UNMATCHED and none is MATCHED — by design, not a defect, matching ai/ACCOUNTING_API_VERIFICATION_REPORT.md's documented behaviour.",
    note: "OPEN/IN_PROGRESS → COMPLETED (live-proven: the backend auto-transitions OPEN → IN_PROGRESS on the FIRST match/skip call, so a reconciliation is reachable for Complete from either status). The form surfaces the live difference figure and disables Complete while it is non-zero, rather than letting the request 400.",
  },
  {
    key: "accounting.journal.reverse",
    method: "POST",
    path: "/api/accounting/journals/:id/reverse",
    permission: "pos:accounting:journals:reverse",
    manager: "allowed",
    observed: "201 on the isolated B5.7 stack — creates a new REVERSED-linked journal entry with mirrored debit/credit lines; the original transitions to REVERSED.",
    note: "A journal not in POSTED status, or one already reversed, 409s — the form disables Reverse outside POSTED status.",
  },
];

const writeRegistryByKey = new Map(ACCOUNTING_WRITE_ROUTE_REGISTRY.map((entry) => [entry.key, entry]));

export function getAccountingWriteRoute(key: string): AccountingWriteRouteEntry {
  const entry = writeRegistryByKey.get(key);
  if (!entry) {
    throw new Error(
      `Accounting write route "${key}" is not in ACCOUNTING_WRITE_ROUTE_REGISTRY — every write function must cite a live-verified endpoint.`,
    );
  }
  return entry;
}
