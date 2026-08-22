# Enterprise UI Track B5.1 — Accounting module shell, menu tree and dashboard

> ⚠️ **PARTIALLY SUPERSEDED 2026-08-21 (backend gap batch 4 — PERMS-2 / C-27).** This report's
> "Manager is READ-ONLY BY PERMISSION" claims described the permission state **at the time this
> phase shipped** and remain historically accurate for that date. They no longer describe current
> permission state: the owner has since decided Manager has full access to everything it is
> responsible for, and PERMS-2 granted Manager the full 36-string C-21 accounting/finance set plus
> the full M28/M29 set (matching Accountant), resolving finding **C-27** (a pre-existing, un-audited
> `periods:create`/`accounts:create`/`cost-centers:create` write grant this phase never caught). The
> **frontend** described below is UNCHANGED and still correctly renders zero write affordances —
> that is now a deliberate build-order gate (Track **B5.7**, not started), not a permission gate. See
> `ai/BACKEND_GAP_BATCH4_COMPLETION_REPORT.md` and CLAUDE.md's C-27 correction note for the current
> state. History below is preserved, not rewritten.

**Date:** 2026-08-21
**Phase:** `ai/ENTERPRISE_UI_ROADMAP.md` Track **B5.1** (Accounting suite — module shell, menu tree,
dashboard), executed under the owner's 2026-08-21 brief and the four binding rulings recorded in it.
**Status:** **COMPLETE**
**Gate:** B5.2 (Customers + Vendors lists) is **NOT started** and must not begin without explicit
owner authorisation.

**Scope of change:** frontend + docs only. **No backend, schema, migration, seed, permission, DTO or
Postman change.** No commit to shared Neon; all live work ran on an isolated local Docker stack.

---

## 1. Headline

Accounting becomes the **seventh Manager module** (OD-3, owner-approved 2026-08-21), with its own
grouped Odoo-style dropdown tree and a live dashboard at `/manager/accounting/dashboard`. It is
**read-only by permission, not merely by product choice** — Manager holds 15 accounting read strings
and **zero writes**, so **no write affordance renders anywhere, not even a disabled one**. Where an
Odoo user would reach for `New` / `Upload` / `Post` / `Approve` / `Match`, the module names the
action and says who can perform it.

Five cards ship, all bound to endpoints re-probed live at `43e1cf1`. Live Tapas Downtown figures:
receivable **UGX 9,106,400** over 5 open invoices, payable **UGX 1,282,400** over 3 open bills,
**5** journal entries, **0** posting errors, **0** bank accounts, fiscal period **FY2026-Q3 Open**.
Switching to Rooftop Bar re-scopes every branch figure (**2,454,600 / 3,263,500 / 8 journals**)
while the organisation-level fiscal period stays put — the visible proof that backend gap batch 2's
PC-03 fix reached the UI.

**Two new backend findings were discovered by this pass and are recorded, not implemented** — one of
them (**B5-F1**) would have put an understated receivable balance on a manager's screen, and the UI
now fails closed against it.

---

## 2. ⚠️ Sub-phase renumber (deviation from the roadmap, recorded)

The roadmap scheduled the dashboard **last** (B5.6, "depends on B5.1–B5.5") and the Customers/Vendors
lists first. The owner's brief inverts that so the module has a landing page and a menu before any
list exists. Everything else shifts by one:

| Tag | Scope | Was (roadmap) | Status |
| --- | --- | --- | --- |
| **B5.1** | module shell + menu tree + dashboard | B5.6 | ✅ **COMPLETE (this phase)** |
| **B5.2** | Customers + Vendors lists | B5.1 | 🔴 NOT started — gated |
| **B5.3** | Bank reconciliation workbench | B5.2 | 🔴 NOT started — gated |
| **B5.4** | Accounting core + Review | B5.3 | 🔴 NOT started — gated |
| **B5.5** | Closing (fiscal periods) | B5.4 | 🔴 NOT started — gated |
| **B5.6** | Reporting + Configuration | B5.5 | 🔴 NOT started — gated |

The renumber is encoded in `lib/accounting/menu.ts` (`ACCOUNTING_SUBPHASES`) and every not-yet menu
row carries its new tag, so the on-screen promise and the roadmap agree.

---

## 3. Live response shapes vs the B0 verification report

Re-probed **2026-08-21** on an isolated stack (Postgres `:55435`, API `:4031`, from-scratch
`migrate deploy` → `db:seed` → `db:demo:import`), Manager token, **two branches** (Tapas Downtown,
Rooftop Bar), at commit `43e1cf1` — i.e. after backend gap batch 2.

### 3.1 Confirmed unchanged

| Route | B0 said | This pass measured | Verdict |
| --- | --- | --- | --- |
| `ap/aging` | `{asOf, buckets, bySupplier, bills…}`, no `total` | `{asOf, buckets, bySupplier, billCount}` | ✅ (field is `billCount`, not `bills`) |
| `ar/aging` | `{asOf,total,skip,take,summary,accounts}` | identical; `summary.*` names confirmed (PC-05 rename is real) | ✅ |
| `ap/*`, `ar/*` lists | `{data,total,skip,take}` | identical | ✅ |
| `bank-accounts`, `bank-statements`, `reconciliation`, `period-close-runs`, `periods`, `cost-centers`, `posting-source-maps`, `finance/budgets`, `finance/demand-calendar` | bare array, no `total` (PC-06) | identical — **all nine confirmed** | ✅ |
| `accounting/accounts` | `{data,total}` no skip/take | identical (`total` 16) | ✅ |
| `tax-config`, `franchise/forecast` | single object | identical | ✅ |
| `finance/procurement-suggestions` | **403** for Manager (PC-02) | **403** | ✅ |
| Manager writes | all 403 (PC-01) | 5/5 representative writes → **403** | ✅ |
| PC-03 branch scoping | fixed by batch 2 | **confirmed visibly**: AP/AR/journal figures differ per branch; supplier rows carry the acting branch's own `branchId` | ✅ |
| Org-level by design | `periods`, `period-close-runs`, `posting-source-maps`, `tax-config` | identical payloads under both branch headers; `periods` rows carry **no `branchId` field at all** | ✅ |

### 3.2 Drift and corrections found

| # | Finding | Detail |
| --- | --- | --- |
| **1** | 🔴 **B5-F1 — `ar/aging.summary` is PAGE-scoped, not branch-scoped.** | The service pages `openInvoices` with `skip`/`take` and then aggregates **only the returned page**, while `total` counts the whole `where`. Measured live: `?take=1` → `total: 5` beside `summary.totalOutstanding: 599,800`, where the true branch figure is **9,106,400**. B0 missed it because its probe used the default `take=50` on a five-invoice dataset. **A bounded read — which every Manager discipline rule demands — would have printed an understated receivable balance.** |
| **2** | 🔴 **B5-F2 — `GET /ar/invoices?status=<invalid>` returns 500, not 400.** | The controller takes `@Query('status') status?: string` as a raw string and hands it to Prisma. `status=OVERDUE` — a `VendorBillStatus` value `InvoiceStatus` does not have — throws. Valid values: `DRAFT\|ISSUED\|PARTIALLY_PAID\|PAID\|CANCELLED\|CREDIT_ADJUSTED`. (`ap/bills?status=` is properly enum-validated and 400s.) |
| **3** | ⚠️ **B0's "pagination bound" column is unreliable.** | B0 probed `take=5000&pageSize=5000&limit=5000` in one request; `limit` is not on those DTOs, so the whitelist 400'd and the route was recorded as "bounded". Probed with `take` **alone**, `ap/bills`, `ar/invoices`, `journals` and `ar/aging` all return **200** at `take=5000`. There is **no server-side maximum** on these routes — the bound is entirely the caller's responsibility. |
| **4** | ⚠️ `GET /api/audit/timeline` pages with **`pageSize`**, not `take`/`limit` (`?limit=` → 400), and honours a branch only via an explicit **`?branchId=`** query parameter — it **ignores `X-Branch-Id`**. B5.4 must pass the branch explicitly or label the rail organisation-wide. |
| **5** | ⚠️ `ap/aging` field is **`billCount`** (the roadmap's table said "bills"). |

**Nothing in the demo dataset backs bank or budget:** `bank-accounts`, `bank-statements`,
`reconciliation`, `period-close-runs`, `finance/budgets` and `finance/demand-calendar` all return
`[]` in **both** branches on a fully seeded + demo-imported database.

---

## 4. Cards included vs omitted

| Card | Endpoint(s) | Why included |
| --- | --- | --- |
| **Customers — receivable** | `ar/aging` | Real branch money and a real bucket series. Odoo's *Sales* card. |
| **Vendors — payable** | `ap/aging` | Real branch money; the endpoint is unpaged so `buckets.total` is a true branch total. Odoo's *Purchases* card. |
| **General ledger** | `journals` + `posting-runs` + `posting-errors` (`take=1`, server `total`) | Branch-scoped counts (5 vs 8 across branches) and posting health. |
| **Bank** | `bank-accounts` + `reconciliation` | Odoo's *Bank* card. Endpoints verified 200; the dataset is empty, so it renders its honest empty state. |
| **Fiscal period** | `periods` + `period-close-runs` | Odoo's *Tax Returns* card pattern (status + lifecycle, not money). PC-07's four states. |

| Omitted | Why |
| --- | --- |
| **Budget vs actuals** *(an owner-listed candidate)* | `GET /api/finance/budgets` returns `[]` in **both** probed branches on a fully seeded + demo-imported database. **No figure on it could be verified live**, and the brief's rule is to omit rather than fake. The route is verified reachable and carries a **B5.6** menu row. |
| **Demand calendar** | Same — `[]` in both branches. |
| **Trial balance / any statement** | **No endpoint exists** (NG-07 → C-11). The ledger card says so in product copy. |
| **Salaries** | Payroll is a locked exclusion; FU-1 revoked `pos:hr:compensation:read` from Manager. |
| **Petty cash** | No petty-cash ledger exists. |
| **A bank balance figure** | `BankAccount` rows were never observed (zero exist), so a balance field could not be verified. B5.3 can add it once real rows exist. |
| **Procurement suggestions** | 403 for Manager (PC-02). Absent from the menu too, not a not-yet row. |

**Charts:** exactly one mark type ships — the aging bucket bar, on the two aging cards. It is honest
because `ap/aging.buckets` and `ar/aging.summary` are a **real categorical series the backend itself
computes**. There is still **no bucketed time series** anywhere (NG-05), so no trend is drawn, and
**no charting dependency was added** (hand-rolled SVG, the B2 precedent; asserted against 13 chart
packages).

---

## 5. The menu tree — and what was deliberately not cloned

One grouped dropdown carrying Odoo's own headings, adapted: **Dashboard · Customers · Vendors ·
Bank · Accounting · Review · Reporting · Configuration**. **24 rows**, of which **1 is a live link**
(Dashboard) and **23 are inert, phase-tagged not-yet rows**. Every row cites a live-verified endpoint
in `ACCOUNTING_ROUTE_REGISTRY`; `assertAccountingMenuIsBacked()` runs **at module scope**, so a row
citing an unknown endpoint — or one Manager cannot read — fails the build rather than shipping.

Eleven Odoo item groups are **absent with a written reason** (`ACCOUNTING_OMITTED_ITEMS`), including:

- the **eleven financial statements** (Balance Sheet, P&L, Cash Flow, Trial Balance, General Ledger,
  Partner Ledger, Tax Report, Fiscal Report, Invoice Analysis, Analytic Report, Executive Summary) —
  no endpoint exists for any of them;
- **Customers → Receipts** — ⚠️ the roadmap's own menu table listed `ar/receipts`, but it is
  **POST-only**; there is no GET to list. Corrected here;
- **Bank → Manual entries** — likewise POST-only;
- **Reporting → Procurement suggestions** — 403 for Manager (PC-02);
- **Configuration → Currencies / Rounding / Tax matrix / Exchange rates** — these are `/api/settings/*`
  organisation settings owned by **B6**; listing them under Accounting would claim a navigation
  placement B5.1 has no authority to decide;
- Journals-as-config, Fiscal Positions, Multi-Ledger, Checks, Asset Models, Payment Terms, Follow-up
  Levels, Payment Providers, Payment Methods, Assets, Loans, Tax Returns, and the seven Review items —
  no backing model (NG-17 / NG-19).

---

## 6. Scope checklist against the owner's brief

| Requirement | Status |
| --- | --- |
| Accounting registered as the **seventh** top-nav module via a thin adapter, `OperationalTopNav` **not forked** | ✅ — one new `MANAGER_MENU_GROUPS` entry; the shared component is untouched |
| Full grouped menu tree modelled on Odoo, honest "arrives in B5.x" rows, never dead links | ✅ — 24 rows, 1 live, 23 tagged; absent items registered with reasons |
| **Ruling 2** — no write affordance anywhere, not even disabled | ✅ — asserted three ways: no write `method:` in the tree, no `useMutation`, no `<Button>`/`onClick=`/`<form>`; e2e proves zero non-GET requests and zero disabled buttons |
| **Ruling 3** — PC-06 bare arrays shipped as-is, client-counted, labelled "Showing all N" | ✅ — `unpaginatedCountLabel`; no pager bound; no `.length` assigned to a `total` |
| **Ruling 4** — every figure traceable to a re-verified field | ✅ — 19-entry `ACCOUNTING_KPI_BINDINGS`; an unregistered key **throws** |
| Odoo C10 journal-card grid, UGX zero-fraction, 2–3 secondary lines, SVG only where real | ✅ — 5 cards on the **reused** B2 card shell |
| Branch-scoped, narrow `["manager","accounting-*",branchId]` keys, no request storms | ✅ — 9 queries, 9 keys, measured **9 accounting requests / ≤14 total** per load |
| Truthful per-card loading / empty / error states that fail closed | ✅ — plus a dedicated **withheld** state for B5-F1 |
| Shared primitives for later sub-phases in `components/manager/accounting/shared/` | ✅ — money/KPI, aging bars, period badge, scope note, read-only note, unpaginated note |

---

## 7. Defects found and fixed **in** this phase

| # | Defect | Fix |
| --- | --- | --- |
| **B5-D1** | `AccountingReadOnlyNote` rendered a `<p>` inside `ManagerDashboardCard`'s footnote, which is itself a `<p>` — invalid nesting, 64 React `validateDOMNesting` warnings per load. Caught by the zero-console-error assertion. | Changed to a `<span>`; the reason is recorded at the component. |
| **B5-D2** | The receivable card keyed its footnote off `complete` alone, so a **failed read** displayed the *partial page* explanation — "this branch has more open invoices than the page requested": specific, confident and wrong. **Caught by viewing the error-state screenshot**, not by a test. | Footnote now branches on `isError` first; pinned by an e2e assertion that the error state says "This read failed" and does **not** say "more open invoices than". |

---

## 8. Findings recorded, **none implemented**

| ID | Severity | Finding |
| --- | --- | --- |
| **B5-F1** | 🔴 High | `ar/aging.summary` aggregates the **returned page**, not the whole `where`. A bounded read understates the branch receivable balance. The UI fails closed (withholds the figure when `Σ accounts[].invoices.length < total`), but **the endpoint should aggregate over the full `where` like `ap/aging` does.** |
| **B5-F2** | Medium | `GET /ar/invoices?status=<invalid>` → **500**. The status query is an unvalidated raw string; it needs an `@IsEnum(InvoiceStatus)` DTO like AP's. |
| **B5-F3** | Low | B0's pagination-bound column is an artefact of a combined `take`+`pageSize`+`limit` probe. There is **no server maximum** on `ap/bills`, `ar/invoices`, `journals`, `ar/aging`. |
| **B5-F4** | Low | `GET /api/audit/timeline` ignores `X-Branch-Id` (branch only via `?branchId=`) and pages with `pageSize`. B5.4 must handle it. |
| **B5-F5** | Low | `ap/aging` is unpaged by design — correct for totals, but it reads every open bill for the branch with no ceiling. Fine at demo scale; worth a bound before a large tenant. |
| **B5-F6** | Cosmetic | The Accounting dropdown carries 24 rows in one `max-h-[70vh]` scrolling panel. Odoo splits these across seven top-level menus. Readable today; worth revisiting when the rows become live links in B5.2. |

Carried forward unchanged and **still open**: **PC-01** (Manager holds no accounting write),
**PC-02** (`procurement:advisory:read` gates a read *and* a write), **PC-06** (ten bare-array routes),
**PC-07** (four period states, no unlock), **C-23** (the M33 GL Postman collection cannot run, so
B5.4's journals surface has no Postman verification).

---

## 9. Files

**New — `lib/accounting/` (role-agnostic core, per OD-2):**
`route-registry.ts` (38 verified GET routes + `ACCOUNTING_DENIED_WRITES`) · `menu.ts` (tree +
omissions + the executable gate) · `routes.ts` · `types.ts` · `model.ts` (money, buckets, the B5-F1
guard, period resolution, `ACCOUNTING_KPI_BINDINGS`) · `api.ts` (**reads only**).

**New — Manager binding:** `lib/manager/accounting-context.ts` (the single Manager-shaped file).

**New — components:** `components/manager/accounting/AccountingDashboard.tsx`, `cards/` (5),
`shared/` (`AccountingKpi`, `AccountingAgingBars`, `AccountingNotes`, `index`).

**New — pages:** `pages/manager/accounting/index.tsx` (redirect) + `dashboard.tsx`.

**New — QA:** `scripts/manager-b5-assertions.ts`, `e2e/manager-accounting/` (4 specs + fixtures).

**Modified:** `lib/manager/routes.ts` (seventh module) · `lib/manager/top-nav.ts` (adapter) ·
`lib/manager/permissions.ts` (allow-list entry + corrected exclusion) ·
`components/pos-shell/role-icon-config.ts` + `role-icons.ts` (one glyph) ·
`e2e/manager-shell/fixtures.ts` + `navigation-and-landing.spec.ts` ·
`scripts/{shell,manager-p1,manager-b1,manager-b3,manager-b4}-assertions.ts`.

⚠️ **Five assertions that asserted Accounting's ABSENCE were inverted, not deleted**, each with a
comment naming OD-3 and the date, so the change of contract is visible in the diff rather than
silent. The "exactly six" guards became "exactly seven" — still exact lists, never relaxed to
"at least".

---

## 10. Validation

Isolated local Docker stack — Postgres 16 `:55435` (`nimbus_b51`), API `:4031`, web `:3120`.
**Shared Neon was never connected to or written**; the QA API process held exactly **one** non-listening
TCP connection, to `[::1]:55435`. Neither `.env` was modified — SHA-256 identical before and after
(`apps/api/.env` `0f7cfb12…`, `packages/db/.env` `2dad4d3c…`). Isolation was achieved by constructing
the child-process environment explicitly.

| Gate | Result |
| --- | --- |
| `typecheck` | ✅ 0 errors |
| `lint` | ✅ 0 warnings, 0 errors |
| `build` | ✅ compiled; `/manager/accounting` 258 B, `/manager/accounting/dashboard` 7.63 kB |
| Assertion scripts | ✅ **17/17** (incl. the new `manager-b5-assertions.ts`) |
| `e2e/manager-accounting/` | ✅ **90 passed / 10 skipped**, 4 viewports (25 tests each; the skips are the desktop-dropdown mechanics at `vp-1024x768`, where OD-4 collapses the bar, plus the two once-only 1280×680 evidence tests) |
| `e2e/manager-shell/` regression | ✅ **125 passed / 11 skipped** — matches the B1/B2 baseline exactly |
| `e2e/manager-dashboard/` regression | ✅ **84/84** — B2 untouched |
| `e2e/cashier-floor/cross-role-c2-regression` | ✅ **12/12** |
| Request budget | **9** accounting reads + **≤14** total per dashboard load; all GET, all carrying `X-Branch-Id` |
| Console errors | **0** (after B5-D1) |
| `/api/health` | ✅ `ok` |
| `git diff --check` | ✅ clean |
| Screenshots | 19 captured; **4 viewed** at 1440×900 (dashboard, menu open, card error, branch-switched) and **2 viewed** at 1280×680 (dashboard, card error) |

**Live money cross-check.** Every rendered figure matches the API probe exactly — Tapas
9,106,400 / 1,282,400 / 5 journals / FY2026-Q3 Open; Rooftop 2,454,600 / 3,263,500 / 8 journals /
FY2026-Q3 Open.

**Disclosed:** the browser run used `next dev` on `:3120` rather than `next start`, because
`NEXT_PUBLIC_API_BASE_URL` is inlined at build time and a production build made without it would
default to `:3001` — the **pre-existing shared-Neon dev API**. Using dev mode kept the verified
production build artifact untouched and guaranteed the browser could not reach shared Neon. All five
pre-existing dev servers (`:3000`, `:3001`, `:3003`, `:3008`, `:3009`) were verified running and
healthy before and after; `:3001` `/api/health` → `ok` on its external host. The isolated container
was removed and both ports released.

---

## 11. Deferred, and gated

- **B5.2 (Customers + Vendors lists) is NOT started.** Do not build a list, a record form, a pager or
  any write control without explicit owner authorisation.
- **B5.3 / B5.4 / B5.5 / B5.6 are NOT started.**
- Do not grant Manager any accounting write (**PC-01**), and do not grant
  `procurement:advisory:read` (**PC-02** — it also grants a write).
- Do not bind a pager to a fabricated total on the ten bare-array routes (**PC-06**).
- Do not treat `ar/aging.summary` as a branch total without the completeness check (**B5-F1**).
- Do not relabel `periods`, `period-close-runs`, `posting-source-maps` or `tax-config` as branch
  data — they are organisation-level by design.
