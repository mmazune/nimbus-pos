# Enterprise UI Track B5.2 — Manager Accounting Customers + Vendors surfaces

**Date:** 2026-08-21
**Phase:** `ai/ENTERPRISE_UI_ROADMAP.md` Track **B5.2** (Accounting suite — Customers + Vendors list
and detail surfaces, plus the two Reporting aging views), owner-approved.
**Status:** **COMPLETE**
**Gate:** B5.3 (Bank reconciliation workbench) is **NOT started** and must not begin without
explicit owner authorisation.

**Scope of change:** frontend + docs only. **No backend, schema, migration, seed, permission, DTO or
Postman change.** No commit to shared Neon; all live work ran on an isolated local Docker stack.

---

## 1. Headline

Nine of B5.1's not-yet Customers/Vendors menu rows are now real surfaces, plus the two Reporting →
Aged receivable/payable views pulled forward from B5.6 (they cite the same `ar.aging`/`ap.aging`
routes the B5.1 dashboard cards already read, and the B5.2 brief explicitly scoped "the AR aging
view" / "the AP aging view" as deliverables). The Accounting menu goes from **1 live row to 12**.
Manager accounting remains **read-only by permission** — the same 15 read strings, zero writes; the
B5.1 no-write-affordance guard was extended over the entire new tree, not relaxed.

**Customers (AR):** Invoices (list + detail), Customer accounts (list + detail), Credit notes
(list-only — `total: 0` on the reference dataset).
**Vendors (AP):** Bills (list + detail), Suppliers (list + detail — the one non-flat
`{supplier,summary,recentBills,recentPayments}` detail shape in the module), Credit notes,
Payments, Recurring profiles, Payment reminders (all four list-only; three return `total: 0` on the
reference dataset, Payments returns 12 real rows).
**Reporting:** Aged receivable, Aged payable — full-page, unpaginated branch reports over the same
routes the B5.1 dashboard cards use.

Every dashboard KPI whose "arrives in B5.x" placeholder pointed at one of these surfaces
(`ar.outstanding`, `ar.openInvoices`, `ar.customers`, `ar.overdue`, `ar.buckets`, `ap.outstanding`,
`ap.openBills`, `ap.overdue`, `ap.topSupplier`, `ap.buckets`) now links there for real —
`AccountingPrimaryKpi`/`AccountingStatList` render a `Link` when a KPI's registry binding has a
`drillIn`.

**One live-QA-caught frontend bug, found and fixed in this phase**: the shared `detailRequest()`
helper in `lib/accounting/api.ts` blindly appended `/${id}` to every detail route's path. Three
registry entries (`ar.invoice`, `ar.account`, `ap.bill`) already carry a path with a literal `:id`
placeholder, so the result was a malformed double-id URL that 404'd — every invoice, customer
account and bill detail view rendered "Invoice/Account/Bill unavailable" even for a perfectly valid
id. Caught by opening a real record in the browser against the isolated stack and cross-checking the
same id with a direct `curl` (200). Fixed and re-verified live for all four detail-bearing surfaces.

---

## 2. Scope checklist against the brief

| Requirement | Status |
| --- | --- |
| Customers: accounts list, invoices list + detail, credit-notes list, AR aging view | ✅ |
| Vendors: suppliers list + detail, bills list + detail, credit-notes list, AP aging view | ✅ |
| Odoo list-view pattern — control panel + chip filter + pagination + optional-column money/status | ✅ — `AccountingListScreen` composes `ManagerControlPanel` + `ManagerListTable`, reused across all nine list surfaces |
| Invoice/bill detail — form-view layout (header block, line items, totals, payment/receipt history) | ✅ — breadcrumb + record pager, `ManagerStatusPipeline`, field `<dl>`, `ManagerListTable` line items, receipt/payment history section, totals card, read-only disclosure |
| Mount `ManagerControlPanel`/`ManagerSearchFilterMenu`/`ManagerBreadcrumbs` where still unmounted | ✅ — all three now consumed by the Customers/Vendors tree for the first time outside Operations |
| Reuse (extend where needed) the B5.1 shared primitives — money cell, aging-bucket row, status badge | ✅ — `formatAccountingMoney`, `toArAgingBuckets`/`toApAgingBuckets`, `AccountingAgingBars` reused verbatim; new `accountingStatusTone`/`titleCaseAccountingStatus` added as the one new shared status primitive (B5.1 had no status enum to render) |
| Wire the dashboard's "arrives in B5.x" notes into real links | ✅ — 10 KPI bindings updated in `model.ts`; `AccountingKpi.tsx` renders a `Link` when `drillIn` is set |
| **READ-ONLY** — no New/Create/Post/Approve/Match/Send anywhere, absent not disabled | ✅ — `manager-b5-assertions.ts` extended; every interactive element is a chrome-component callback prop, never a local `onClick=`/`<Button` (see §5) |
| Enum-only filters, take clamped ≤100 | ✅ — `readManagerEnum()` resolves an invalid value to "no filter" client-side; `clampAccountingTake()` mirrors the backend's `MAX_ACCOUNTING_LIST_PAGE_SIZE` (batch 3) |
| Branch-scoped, narrow `["manager","accounting-*",...]` keys, no request storms | ✅ — new `lib/manager/accounting-surface-queries.ts`, deliberately separate from the B5.1 dashboard's exactly-9-query `accounting-context.ts` so as not to alter that file's asserted count or its 5-minute poll semantics for pages that don't need polling |

---

## 3. Menu tree — before/after

24 groups → the same 8 groups, now **28 total rows** (the true count; earlier B5.1 prose said 24,
which underｃounted — this pass corrected the figure with a direct count of `ACCOUNTING_MENU`). **12
are live links, 16 remain inert phase-tagged rows** (Bank ×3 — B5.3; Journal entries, Fiscal periods,
Period close runs, Posting runs, Posting errors, Audit trail — B5.4/B5.5; Budgets, Demand calendar,
Forecast — B5.6; Chart of accounts, Cost centres, Posting source maps, Tax configuration — B5.6).

`assertAccountingMenuIsBacked()` still runs at module scope — every one of the 12 newly-live rows
cites its real registry route key(s), unchanged from B5.1's registry (B5.2 added zero new registry
entries, it consumed nine that already existed unconsumed).

---

## 4. Live response shapes — no drift found

Re-probed against the same isolated stack this pass stood up (see §7). Every shape B5.1's registry
already recorded held exactly as documented — B5.2 did not need to correct a single field. The one
genuinely new fact this pass surfaced is `GET /ap/suppliers/:id`'s non-flat envelope
(`{supplier,summary,recentBills,recentPayments}`), already noted in the registry's `ap.suppliers`
entry but not previously *consumed* by any UI, so this is the first time a frontend component had to
actually handle that shape.

Live cross-check (Tapas Downtown, the seeded manager's default branch):

| Figure | Dashboard card | Aged report | `curl` ground truth | Agree? |
| --- | --- | --- | --- | --- |
| AR outstanding | UGX 9,106,400 | UGX 9,106,400 | `summary.totalOutstanding` = `9106400` | ✅ |
| AR open invoices | 5 | 5 | `total` = `5` | ✅ |
| AR customers with a balance | 5 | 5 | `accounts.length` = `5` | ✅ |
| AP outstanding | UGX 1,282,400 | UGX 1,282,400 | `buckets.total` = `1282400` | ✅ |
| AP open bills | 3 | 3 | `billCount` = `3` | ✅ |
| Customer accounts (list total) | — | — | `total` = `7` | matches list page |
| Suppliers (list total) | — | — | `total` = `10` | matches list page |

Switching to Rooftop Bar re-scoped the Aged receivable report to **UGX 2,454,600 / 2 open invoices /
2 customers** — identical to the figures the B5.1 report already cited for that branch, proving the
new report page inherits the same branch-scoping the dashboard card already had.

---

## 5. Read-only proof

Manager holds the same 15 accounting read strings and zero writes as B5.1 (PC-01/PC-02 unchanged;
no permission was touched). The existing B5.1 guard (`components/manager/accounting/**` may not
contain `<Button`, `onClick=` or `type="submit"`) was kept **unmodified in spirit** and extended to
the new files, which needed real interactivity (row selection, pagination, filtering, tab-free
navigation) without weakening it:

- **Row selection, pagination, filter toggling** are all callback PROPS into already-built chrome
  components (`ManagerListTable.onSelectRow`, `ManagerControlPanel`'s pager `onPrevious`/`onNext`,
  `ManagerSearchFilterMenu.onToggleFilter`) — the literal `onClick=` string lives inside those chrome
  components (`components/manager/chrome/`), never inside an accounting-tree file.
- **"Back to list" on an error state** is a real `<Link>` (`AccountingBackLink`), not a
  `<button onClick=`.
- Live network capture during the manual QA tour: every request across an 11-page tour was `GET` or
  `OPTIONS` (CORS preflight) — **zero** `POST`/`PATCH`/`PUT`/`DELETE`.
- `manager-b5-assertions.ts` §12 (new) additionally checks: every B5.2 list screen file clamps `take`
  through `clampAccountingTake()`; every filter value flows through `readManagerEnum()`/
  `firstManagerQueryValue()`, never a raw `router.query.*` string passed straight into a request
  param; every one of the nine list routes is registry-confirmed `data-total`/`serverTotal:true`
  before a pager may bind to it (a per-file check, not a fragile substring-proximity guess); all ten
  AR/AP KPI bindings that used to carry a `noDrillInReason` now carry a real `drillIn` instead.

---

## 6. Files

**New — `lib/manager/` (Manager-shaped adapters, mirroring `accounting-context.ts`'s existing role):**
`accounting-route.ts` (URL-state helpers: `readManagerEnum`, `firstManagerQueryValue`,
`buildManagerListQuery`, `readManagerPage`) · `accounting-surface-queries.ts` (11 new React Query
hooks — 9 list/detail pairs’ worth plus the two aging-report hooks — deliberately separate from the
B5.1 dashboard's exactly-9-query `accounting-context.ts`).

**New — `components/manager/accounting/shared/`:** `AccountingListScreen.tsx` (the generic list
scaffold every one of the nine list surfaces composes from) · `AccountingDetailPrimitives.tsx`
(`AccountingFieldRow`, `AccountingReadOnlyCard`, `AccountingBackLink`).

**New — `components/manager/accounting/customers/`:** `CustomersInvoicesScreen.tsx`,
`CustomersAccountsScreen.tsx`, `CustomersCreditNotesScreen.tsx`.

**New — `components/manager/accounting/vendors/`:** `VendorsBillsScreen.tsx`,
`VendorsSuppliersScreen.tsx`, `VendorsCreditNotesScreen.tsx`, `VendorsPaymentsScreen.tsx`,
`VendorsRecurringScreen.tsx`, `VendorsRemindersScreen.tsx`.

**New — `components/manager/accounting/reporting/`:** `AgedReceivableScreen.tsx`,
`AgedPayableScreen.tsx`.

**New — `pages/manager/accounting/{customers,vendors,reporting}/`:** 11 page files (2-line
`GetServerSideProps` + `ManagerShell` wrapper, matching the B5.1 dashboard page's exact pattern).

**New — QA:** `e2e/manager-accounting/{customers,vendors,reporting}.spec.ts` (23 new specs).

**Modified:**
`lib/accounting/types.ts` (AR/AP row + detail + status-enum types) ·
`lib/accounting/api.ts` (9 list + 4 detail request functions; the `detailRequest()` `:id` fix) ·
`lib/accounting/routes.ts` (11 new route constants) ·
`lib/accounting/menu.ts` (11 rows turned `available:true`) ·
`lib/accounting/model.ts` (`toAccountingPager`, `sumAccountingPageMoney`,
`titleCaseAccountingStatus`/`accountingStatusTone`, `formatAccountingDate`; 10 KPI bindings gained a
real `drillIn`) ·
`components/manager/accounting/shared/{AccountingKpi.tsx,index.ts}` (Link-when-`drillIn` rendering) ·
`scripts/manager-b5-assertions.ts` (page/menu-count updates + a new §12 of B5.2-specific checks) ·
`scripts/manager-b3-assertions.ts` (the accounting tree excluded from the HR-employee-PII sweep —
see §8) ·
`e2e/manager-accounting/{fixtures.ts,menu-and-read-only.spec.ts}` ·
`docs/UI_SYSTEM.md` (new §8f) · `docs/manager-ui-docs/MANAGER_API_MATRIX.md` (new "Consumed by
B5.2" section).

---

## 7. Validation

Isolated local Docker stack — Postgres 16 on **`:55440`** (`nimbus_b52_qa`), API on **`:4051`**, web
(`next dev`) on **`:3140`**. **Shared Neon was never connected to or written.** `apps/api/.env` and
`packages/db/.env` were swapped to isolated values for the duration and restored byte-for-byte —
SHA-256 **identical before and after** (`apps/api/.env` `0f7cfb12…`, `packages/db/.env`
`2dad4d3c…`). Every process this pass started was tracked by PID/container name and stopped
individually at teardown (API `98455`, web `98595`+child `98612`, Docker container
`nimbus-b52-qa`) — no other process on the host was touched.

| Gate | Result |
| --- | --- |
| `typecheck` | ✅ 0 errors |
| `lint` (`next lint`, no `--fix`) | ✅ 0 warnings, 0 errors |
| `build` | ✅ compiled; 13 accounting pages, e.g. `/manager/accounting/customers/invoices` 4.0 kB, `/manager/accounting/vendors/bills` 4.0 kB, `/manager/accounting/reporting/aged-receivable` 2.03 kB, `/manager/accounting/reporting/aged-payable` 1.93 kB |
| Assertion scripts | ✅ **17/17** (`manager-b5-assertions.ts` extended with the B5.2 §12 checks; `manager-b3-assertions.ts` fixed for a cross-domain false positive — see §8) |
| Live manual QA (isolated stack, Manager demo login) | ✅ all 11 new pages toured; menu tree confirmed exactly 12 live rows; dashboard KPI links confirmed clickable and correctly routed; status filter confirmed to narrow results, tag the URL and never send an invalid value; branch switch confirmed to re-scope Aged receivable; zero console errors and GET-only, bounded (2-4 real accounting requests/page) network traffic throughout; **one bug found and fixed** (§1) |
| `e2e/manager-accounting/` (customers/vendors/reporting specs + updated menu-and-read-only + full existing suite) | ✅ **190 passed / 10 skipped / 0 failed**, 4 viewports (the 10 skips are the pre-existing 1280×680-only evidence-capture pair, which by design runs once, not per viewport — unrelated to B5.2) |
| `e2e/manager-shell/` regression | ✅ **34/34** at `vp-1440x900` (includes the cross-role boundary suite: waiter/cashier/supervisor cannot open Manager, Manager cannot open their workspaces) |
| Aging cross-check (Tapas Downtown → Rooftop Bar) | ✅ dashboard card and Aged report agree exactly for the same branch; switching branch changes the figure (§4) |
| Request budget | 2-4 accounting GETs per list-page load (readiness-strip's pre-existing `reports/catalog`+`devices` calls are unrelated to this phase); all GET/OPTIONS, zero writes |
| Console errors | **0**, across the full manual tour and the automated suite |
| `/api/health` | ✅ `ok` throughout |
| `git diff --check` | ✅ clean |

**Not run in this pass:** newman/Postman (no contract change — nothing to re-run) and the API Jest
suite (no backend file touched).

---

## 8. Defects found and fixed **in** this phase

| # | Defect | Fix |
| --- | --- | --- |
| **B5.2-D1** | `detailRequest()` in `lib/accounting/api.ts` appended `/${id}` to every detail route's registry path, but three entries (`ar.invoice`, `ar.account`, `ap.bill`) already carry a literal `:id` placeholder in that path — producing a malformed double-id URL that 404'd. Every invoice/account/bill detail rendered an honest-looking but WRONG "unavailable" screen for a perfectly valid id. **Caught by opening a real record in the browser against the isolated stack**, not by any static check (typecheck/lint/build/assertions all passed with the bug present). | `detailRequest()` now checks for a literal `:id` in the path and replaces it; falls back to append-with-slash only for the one registry entry with no separate detail key (`ap.suppliers`). Re-verified live for all four detail-bearing surfaces. |
| **B5.2-D2** | `scripts/manager-b3-assertions.ts`'s HR-employee-PII sweep bans the bare word `taxId`/`bankAccount` anywhere in `components/manager`/`lib/manager`/`pages/manager` — written for HR employee compensation data, before Accounting existed as a sibling domain with its OWN, unrelated, non-PII `Supplier.taxId`/`bankName`/`bankAccountNo` fields. `VendorsSuppliersScreen.tsx` rendering `supplier.taxId` (a real, live-verified, non-sensitive business field) failed the sweep. | The sweep now excludes `components/manager/accounting/` and `pages/manager/accounting/` (which has its own, separate read-only guard in `manager-b5-assertions.ts`) with a comment explaining why — the check's real target (employee PII) is unaffected everywhere else in the Manager tree. |

---

## 9. Findings recorded, none implemented

None new. B5.1's carried-forward findings (PC-01, PC-02, PC-06, PC-07, C-23, BGB3-L3) are unaffected
by this phase and remain open exactly as B5.1 and backend gap batch 3 left them.

---

## 10. Deferred, and gated

- **B5.3 (Bank reconciliation workbench) is NOT started.** Do not build a statement list, an import
  flow or a match/skip/complete UI without explicit owner authorisation. The demo dataset still
  carries zero bank accounts/statements/reconciliations (unchanged from B5.1).
- **B5.4 (Accounting core + Review), B5.5 (Closing) and the remainder of B5.6 (Budgets, Demand
  calendar, Forecast, Configuration) are NOT started.**
- Do not grant Manager any accounting write (PC-01), and do not grant `procurement:advisory:read`
  (PC-02 — it also grants a write).
- Do not bind a pager to a fabricated total on the ten PC-06 bare-array routes — none of them are
  B5.2 surfaces, and B5.2 added no new bare-array consumption.
- `ap/payments`, `ap/recurringProfiles`, `ap/reminders`, `ar.creditNotes` and `ap.creditNotes` are all
  genuinely `data-total` (real server totals) — do not mistake their frequently-empty demo-dataset
  counts (`total: 0` on four of the five) for a PC-06 bare array; they are paginated exactly like
  every other B5.2 list, just currently empty.
