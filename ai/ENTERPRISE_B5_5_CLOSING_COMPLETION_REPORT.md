# Enterprise UI Track B5.5 — Manager Accounting Closing surfaces

**Date:** 2026-08-21
**Phase:** `ai/ENTERPRISE_UI_ROADMAP.md` Track **B5.5** (Closing), owner-approved.
**Status:** **COMPLETE**
**Gate:** B5.6 (the remainder of Reporting + Configuration) is **NOT started** and must not begin
without explicit owner authorisation. A future backend batch will need to address C-25, C-26,
B5.4-D1, C-27 and B5.5-F1 before B6 (Settings) can start.

**Scope of change:** frontend + docs only. **No backend, schema, migration, seed, permission, DTO or
Postman change.** No commit to shared Neon; all live work ran on an isolated local Docker stack.

---

## 0. Scope confirmation — the brief matched the tags this time

`lib/accounting/menu.ts`'s own `ACCOUNTING_SUBPHASES` tags — set in B5.1, unchanged by every later
phase, and the authority B5.4 itself deferred to — tag exactly **two** rows "B5.5": **Fiscal
periods** (`routeKeys: ["accounting.periods"]`) and **Period close runs**
(`routeKeys: ["accounting.periodCloseRuns"]`), both under the "Accounting" heading, both immediately
after Journal entries. This phase's brief described the same two surfaces, so — unlike B5.4, which
had to correct an operator brief against the tags — **there was no scope discrepancy to resolve**.
The brief's own OWNER RULING #3 anticipated the org-level-labelling requirement B5.4 never actually
needed (all four B5.4 surfaces turned out branch-scoped); this phase is where that anticipation
turns out to be correct — **both B5.5 surfaces are genuinely organisation-level**.

One shape correction from the brief's expectations, resolved by code: the brief described "list +
detail" for Fiscal periods. `accounting.controller.ts` and `bank-rec.controller.ts` declare **no**
`GET /periods/:id` or `GET /period-close-runs/:id` route — the exact "list-only, no detail route"
shape B5.4 already found for Posting runs. Both B5.5 surfaces therefore ship **list-only**, matching
that established precedent rather than inventing a client-only detail view the registry cannot back.

---

## 1. Headline

The two Accounting menu rows B5.1 shipped as honest not-yet placeholders — Fiscal periods, Period
close runs — are now real surfaces. **The Accounting menu goes from 19 live rows to 21** (of 28
total). Manager accounting stays **read-only by permission** for the actions this phase's owner
ruling covers — opening, closing and locking a period are all re-verified live at 403 for Manager —
but this phase found a real exception, disclosed below (C-27).

**Fiscal periods** — list-only (`GET /accounting/periods`), a `ManagerStatusPipeline` rendering the
real PC-07 lifecycle `DRAFT → OPEN → CLOSED → LOCKED` per row, with **LOCKED as a genuine terminal
pipeline stage** (not an exit chip — unlike bank reconciliation's `DISPUTED`, there is no real
side-branch a fiscal period can be diverted to). An unrecognised status value is the ONLY thing that
renders as an exit chip ("Status unavailable", neutral tone) — proven by a mocked malformed-status
Playwright spec, not merely asserted. **Period close runs** — list-only
(`GET /accounting/period-close-runs?fiscalPeriodId=`, a real server-side filter this phase's API
function supports even though the screen itself does not currently bind it to a period-scoped
link), showing the fiscal period, closed-by actor, income/expense/retained-earnings money tie-out
(retained earnings correctly rendering **negative** when expense exceeds income), and a status
badge that fails closed the same way the Fiscal periods badge does.

Both routes are confirmed live, in the browser (not only by curl), to be **organisation-level**:
switching the active branch from Tapas Downtown to Rooftop Bar leaves both lists byte-identical.
Both are PC-06 bare arrays with no server total — "Showing all N", never a fabricated pager.

🔴 **One new finding, live-proven, more consequential than any prior B5 finding because it is a
permission leak, not a data-shape defect — neither implemented (out of scope for a frontend-only
phase):**

- **C-27** — Manager's own token holds `pos:accounting:periods:create` (and, incidentally,
  `pos:accounting:accounts:create` / `pos:accounting:cost-centers:create`) — a **pre-existing
  M28-era seed grant** (`packages/db/prisma/seed.ts` ~line 1105, under the comment `// M28:
  Accounting Foundation (Manager: read + create, no tax-config:update)`) that **predates** the
  2026-08-20 permissions cutover and was **never revoked or even audited** by it — the cutover
  (`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`) only ADDED 15 new AP/AR/bank-rec/finance read
  strings; it never swept the older M28/M29-era grants for a stray write. Live-proven on the
  isolated B5.5 QA stack: `POST /accounting/periods` with the Manager token → **201**, creating a
  real `DRAFT` period. `PATCH .../open`, `.../close` and `.../lock` remain genuinely 403 for
  Manager — only `:create` leaked. Every prior B5 phase's "5/5 representative writes → 403"
  spot-check never happened to probe `periods:create`/`accounts:create`/`cost-centers:create`, so
  this went undetected through B5.1–B5.4. **Not fixed here** — a permission/seed change is out of
  scope for a frontend-only phase — but the Fiscal periods screen discloses the gap by name
  (`data-accounting-finding="C-27"`) and ships **zero** create control regardless, matching the
  read-first posture every other B5 surface holds. This is the single most important finding of
  this phase: it means the "Manager holds 15/19/21 accounting read strings and ZERO writes"
  claim repeated in every prior CLAUDE.md milestone entry was **not fully true** — it was true for
  every string the C-21 cutover itself seeded, but not for three older ones the cutover never
  looked at.

Also disclosed, a smaller structural gap discovered by reading `closeFiscalPeriod()`'s own
transaction rather than by an external probe:

- **B5.5-F1** — `PeriodCloseRunStatus.FAILED` and `.PENDING` are **unreachable through the live
  API**. `BankRecService.closeFiscalPeriod()` always creates the resulting `PeriodCloseRun` with
  `status: 'COMPLETED'` inside its own transaction; no branch of that method ever persists
  `FAILED`, and no code anywhere writes `PENDING` (the Prisma `@default(PENDING)` is a schema
  default this create call always overrides). A close attempt that cannot proceed throws a
  `ConflictException`/`NotFoundException` **before** any `PeriodCloseRun` row is created at all —
  proven live: closing an already-CLOSED period returned 409 with zero new rows (confirmed by
  re-reading the list immediately after — count unchanged). The Period close runs screen discloses
  this in its own footnote rather than implying every enum member is equally attainable, and the
  status badge still renders `FAILED` with danger tone should it ever appear, never guessing a
  malformed value into `COMPLETED`'s success styling.

**PC-07 re-verified live, precisely**: `PATCH /accounting/periods/:id/lock` on a CLOSED period →
200, `status: "LOCKED"`; a subsequent `PATCH .../unlock` → **404** (the route genuinely does not
exist, confirmed on the isolated stack, not merely "documented as absent").

---

## 2. Scope checklist against the roadmap's real B5.5 row

| Requirement | Status |
| --- | --- |
| Fiscal periods: status progression (DRAFT→OPEN→CLOSED→LOCKED), LOCKED terminal, no unlock UI | ✅ shipped — `ManagerStatusPipeline` per row, LOCKED confirmed terminal both in the UI (no unlock affordance was ever going to exist) and live against the API (404) |
| Period close runs: trigger, timing, truthful outcome | ✅ shipped — fiscal period, closed-by, closed-at, income/expense/retained-earnings, status; B5.5-F1 discloses that FAILED/PENDING have never actually occurred |
| Detail views for both | **Correctly NOT built** — neither entity has a `GET .../:id` route (§0); list-only, matching the B5.4 Posting-runs precedent |
| A period-close readiness/checklist view, only if a real endpoint backs one | **Correctly NOT built** — no such endpoint exists anywhere in the API; not invented |
| Wire the B5.1 dashboard's Fiscal period card to a real drillIn | ✅ `period.current`/`period.open`/`period.closeRuns` KPI bindings now carry a real `drillIn` (were `noDrillInReason: NOT_YET("B5.5", …)`); the card's own rendering logic (fail-closed status, date-window resolution, org-level footnote) was **not** rewritten — B5.1 already built it correctly |
| Do NOT build posting-source-maps or tax-config (B5.6) | ✅ correctly untouched — still honest not-yet rows, `B5.6` tag unchanged |
| Fail closed: unreadable status never renders as a real stage; unreadable outcome never renders as success | ✅ `fiscalPeriodPipelineIndex(null) === -1` → "Status unavailable" exit chip; `toPeriodCloseRunStatus()` returns `null` on anything outside the 3-member enum → the same fail-closed badge; both proven by a mocked-response Playwright spec, not just a unit assertion |
| Org-level labelling, verified live | ✅ `AccountingRouteScopeNote` on both screens; branch-switch invariance proven in the browser (screenshot + Playwright) |
| take≤100 respected where applicable | N/A — both routes are PC-06 bare arrays with no `take` parameter at all; "Showing all N" labelling used instead, never a fabricated pager |
| Reuse the B5.1–B5.4 shared primitives; no new component family | ✅ `ManagerContentShell`/`ManagerControlPanel`/`ManagerListTable`/`ManagerStatusPipeline` (reused, not forked), `AccountingRouteScopeNote`/`AccountingUnpaginatedNote`; one new shared primitive, `AccountingPeriodCloseRunStatusBadge`, added to the existing `AccountingNotes.tsx` file alongside the pre-existing `AccountingPeriodStatusBadge` it mirrors |

---

## 3. Fixtures created, live shape drift, and the C-27/B5.5-F1 proof

Created live via the API on the isolated stack, mixing the **Owner** token
(`owner@nimbus.demo` — the intended actor for accounting writes) and, deliberately, the **Manager**
token (`manager@nimbus.demo`) for the one C-27 verification call, against **Tapas Downtown**
(`cb27be401a2c35dfc0d4e610`), which already carried 5 fiscal periods (3 OPEN, 2 CLOSED) and 0 period
close runs from `db:demo:import`:

- **`POST /accounting/periods`** (Owner) — created **FY2027-01** (Jan 2027, non-overlapping), left
  **DRAFT**.
- **`PATCH /accounting/periods/:id/close`** (Owner) on **FY2026-06** (previously OPEN) — the one real
  live close, producing the **one real `PeriodCloseRun`**: `status: COMPLETED`, `incomeTotal:
  3,164,200`, `expenseTotal: 6,461,600`, `retainedEarningsAmount: -3,297,400`, `branchId: null`
  (confirming the B5.5-F1 registry note that the close path never stamps a branch).
- **`PATCH /accounting/periods/:id/close`** (Owner) on the now-CLOSED FY2026-06 a second time →
  **409** `"Cannot close period — current status is CLOSED (must be OPEN)"`, and a re-read of
  `period-close-runs` confirmed the count stayed at exactly 1 — proving B5.5-F1's claim that a
  refused close creates no row, not by reading the code alone.
- **`PATCH /accounting/periods/:id/lock`** (Owner) on **FY2026-04** (previously CLOSED) — real,
  live LOCK. **`PATCH /accounting/periods/:id/unlock`** on the same id → **404** (route does not
  exist — PC-07 terminal, confirmed live).
- **`POST /accounting/periods`** (**Manager token**, deliberately) — the C-27 verification call —
  succeeded with **201**, creating a second DRAFT period named `"x"`. **`PATCH .../open`**,
  **`PATCH .../close`** and **`PATCH .../lock`** with the Manager token all → **403**, confirming
  the leak is scoped to `:create` alone.

**Final Tapas Downtown counts**: **7** fiscal periods — **DRAFT ×2** (`FY2027-01`, `x`), **OPEN ×2**
(`FY2026-Q3`, `FY2026-07`), **CLOSED ×2** (`FY2026-05` from demo-import, `FY2026-06` closed live),
**LOCKED ×1** (`FY2026-04`) — every one of the four `FiscalPeriodStatus` members represented in a
single organisation, live. **1** period close run (COMPLETED). Rooftop Bar was independently
confirmed — both by `curl` and in the live browser via the branch switcher — to render the
byte-identical 7-period and 1-close-run lists, proving organisation scope rather than a
coincidentally-matching branch filter.

**Live shape drift found**: none for either GET route's happy path — every field `types.ts`
declares for `FiscalPeriodRow`/`PeriodCloseRunRow` was confirmed present, correctly named and
correctly typed against real, freshly-mutated API responses. One drift from the brief's own
assumption, not the code's: the brief expected a possible `FAILED` close-run outcome to design
against; none exists, and none could be produced (B5.5-F1).

---

## 4. C-27 — the discovery method, in full

Unlike C-25/C-26 (found by reading `ledger.service.ts`'s own query/audit-log code during B5.4), C-27
was found by the standard read-only verification step every B5 phase runs before shipping a
read-only claim: fetching `GET /api/auth/me` with the Manager token and grepping its permission list
for every `accounting`/`finance`/`procurement:advisory`/`franchise:forecast` string, then
cross-checking each one attempted a write. `pos:accounting:periods:create` appeared in that list.
Rather than assume it was inert, it was tested directly: `POST /accounting/periods` with the Manager
token → **201** — a genuine, exploitable write, not a dead permission string. Reading
`packages/db/prisma/seed.ts` located the exact grant at ~line 1105, under a comment dated to M28 (the
original Accounting Foundation milestone) reading `// M28: Accounting Foundation (Manager: read +
create, no tax-config:update)` — this predates the 2026-08-20 permissions cutover
(`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`) by roughly four months of project history. The
cutover's own scope, re-read for this report, confirms it only **added** 36 new
`accounting:ap:*`/`accounting:ar:*`/`pos:accounting:*` (bank-rec)/`finance:*` strings — it never
swept the pre-existing M28/M29-era Manager grants (`accounts:create`, `cost-centers:create`,
`periods:create`) for a stray write, because those strings were not part of what the cutover was
auditing.

Recorded in `route-registry.ts`'s `accounting.periods` entry by name, and in
`FiscalPeriodsScreen.tsx`'s own on-page disclosure (`data-accounting-finding="C-27"`), and pinned by
three new `manager-b5-assertions.ts` §15 checks (the registry names it; the screen names it; the
screen never claims "Creating … a fiscal period" is Owner/Accountant-only, since that claim would be
false).

---

## 5. Read-only proof

Manager holds the same accounting permission set as B5.1–B5.4 plus the pre-existing C-27 leak this
phase found, not granted (§4). Live-verified this phase: `PATCH /accounting/periods/:id/open`,
`.../close` and `.../lock` all → **403** for Manager — the three lifecycle-transition writes this
phase's owner ruling actually cares about (opening, closing, locking) are genuinely blocked. The one
exception, `POST /accounting/periods` → 201, is disclosed (§1/§4), not silently worked around, and
the frontend renders **zero** create/open/close/lock control regardless of what the token
technically permits.

- Row rendering is entirely presentational — no `onClick=`/`<Button`/`<IconButton`/`type="submit"`
  literal exists anywhere in `components/manager/accounting/closing/`.
- `manager-b5-assertions.ts` §15 (new): both B5.5 routes stay declared `bare-array`/`serverTotal:
  false` (PC-06) and `scope: "organization"`; neither screen binds `toAccountingPager(`/`pager={`;
  neither screen carries `?periodId=`/`?runId=` URL state (no detail route exists for either
  entity); the fiscal-period pipeline models exactly the four real PC-07 stages with no side-branch,
  and an unreadable status is proven to be the ONLY thing that goes "off pipeline"
  (`fiscalPeriodPipelineIndex(null) === -1`); `countPeriodsByStatus`/`countCloseRunsByStatus` fail
  closed to `null`, never `0`; `toFiscalPeriodStatus`/`toPeriodCloseRunStatus` both fail closed on
  an unrecognised value; `AccountingPeriodCloseRunStatusBadge` fails closed on a missing/
  unrecognised status BEFORE indexing `PERIOD_CLOSE_RUN_STATUS_META`; the B5.5-F1 disclosure is
  pinned by name in both the registry and the screen; the C-27 disclosure is pinned by name in both
  the registry and the screen, and the screen is asserted to NEVER claim creating a period is
  Owner/Accountant-only; no interactive control or write-function name (`matchLine`, `skipLine`,
  `completeReconciliation`, `resolvePostingError`, `dismissPostingError`) appears anywhere in the
  Closing tree; both `period.*` KPI placeholders are confirmed gone, replaced with real `drillIn`
  targets.
- Live network capture during the manual QA tour and the automated `closing.spec.ts` GET-only spec:
  every request across both new surfaces was `GET` — zero `POST`/`PATCH`/`PUT`/`DELETE` issued BY
  THE FRONTEND (the C-27 write proof in §3/§4 was issued by hand via `curl` with the Manager token,
  specifically to test the permission boundary — never by any code path this UI ships).

---

## 6. Live browser QA (isolated stack, Manager login)

Logged in as `manager@nimbus.demo` (Daniel Okello, Tapas Downtown, per
`demo-data/DEMO_LOGIN_CREDENTIALS.md`), toured both new pages plus the dashboard's updated Fiscal
period card, at **1440×900** and **1280×680**-equivalent (config viewport `vp-1024x768`, the
project's nearest analogue), on both Tapas Downtown and a live branch switch to Rooftop Bar:

1. **Fiscal periods list** (1440×900) — all 7 rows rendered: `x`/`FY2027-01` DRAFT,
   `FY2026-Q3`/`FY2026-07` OPEN, `FY2026-06`/`FY2026-05` CLOSED, `FY2026-04` LOCKED, each with its
   own `ManagerStatusPipeline` correctly highlighting the matching stage, opened/closed/locked dates
   rendering only where populated (`—` elsewhere), the "Organisation data" badge visible, the C-27
   disclosure paragraph visible and readable in full.
2. **Period close runs list** (1440×900) — 1 row, `FY2026-06`, closed by "Amina Kato" (the Owner
   account's real name, resolved from the `closedBy` relation the service DOES include), income UGX
   3,164,200, expense UGX 6,461,600, **retained earnings −UGX 3,297,400** (the minus sign genuinely
   rendered, not silently dropped), status badge "Completed" (success/green tone), the B5.5-F1
   disclosure paragraph visible in full.
3. **Branch switch (Tapas Downtown → Rooftop Bar)**, both pages — re-fetched (new network request
   issued, confirmed via the query-key/branchId contract) but rendered the **byte-identical** 7-row
   and 1-row lists — organisation scope proven live in the browser, not only asserted from the
   registry's `scope` field.
4. **Accounting dropdown menu** — Journal entries → **Fiscal periods** → **Period close runs** →
   Posting runs, in that exact order (menu.ts's own row order, not appended at the end); Budgets vs
   actuals/Demand calendar/Forecast/Chart of accounts/Cost centres/Tax configuration still greyed
   with `B5.6` tags — visual confirmation that only the two named rows moved.
5. **Dashboard Fiscal period card** — "FY2026-Q3" (the date-window-resolved current period, Open,
   green badge), "Periods open: 2", "Period close runs recorded: 1" — clicking the current-period
   figure opened Fiscal periods; clicking the close-runs stat opened Period close runs — both
   previously-inert `noDrillInReason` figures are now real, working links.
6. **1280×680-equivalent viewport** — both new pages re-toured; identical content, no layout
   breakage, zero console errors.

**Console errors**: zero, across every page and both viewports (checked via
`read_console_messages` after a fresh navigation on each surface, not merely visual inspection).
**Request behaviour**: Fiscal periods issues exactly **1** real GET
(`/accounting/periods`) per load/branch-switch; Period close runs issues exactly **1** real GET
(`/accounting/period-close-runs`) — no duplicate, no storm, matching every prior B5 surface's
request-budget contract. `/api/health` → `ok` throughout.

Screenshots actually viewed (not merely captured): Fiscal periods list at 1440×900 (Tapas Downtown
and Rooftop Bar), Period close runs list at 1440×900 (Tapas Downtown and Rooftop Bar), the Accounting
dropdown menu showing the two new live rows in position, the dashboard Fiscal period card, and both
pages re-rendered at the 1280×680-equivalent viewport.

---

## 7. Files

**New — `components/manager/accounting/closing/`:** `FiscalPeriodsScreen.tsx` (list-only, with the
`ManagerStatusPipeline`-per-row lifecycle and the C-27 disclosure), `PeriodCloseRunsScreen.tsx`
(list-only, with the B5.5-F1 disclosure).

**New — `pages/manager/accounting/closing/`:** `fiscal-periods.tsx`, `period-close-runs.tsx`
(2-line `GetServerSideProps` + `ManagerShell` wrapper, matching every prior B5 page's exact
pattern).

**New — QA:** `e2e/manager-accounting/closing.spec.ts` (28 new specs).

**Modified:**
`lib/accounting/types.ts` (`FiscalPeriodRow` extended with `openedAt`/`openedById`/`closedAt`/
`closedById`/`lockedAt`/`lockedById`/`createdAt`/`updatedAt`; `PeriodCloseRunRow` extended with
`retainedEarningsAmount`/`incomeTotal`/`expenseTotal`/`failureReason`/`notes`/`closedBy` [name] /
`fiscalPeriod` [window]; new `PeriodCloseRunStatus` type + `PERIOD_CLOSE_RUN_STATUSES` const array,
its doc comment naming B5.5-F1) ·
`lib/accounting/api.ts` (`getPeriodCloseRunsRequest` gained an optional, REAL server-side
`fiscalPeriodId` filter parameter) ·
`lib/accounting/routes.ts` (2 new route constants, `fiscalPeriods`/`periodCloseRuns`) ·
`lib/accounting/menu.ts` (2 rows turned `available:true`; docblock records the B5.5 scope
confirmation) ·
`lib/accounting/route-registry.ts` (`accounting.periods` and `accounting.periodCloseRuns` entries'
`observed`/`note` fields refreshed with this phase's own live probe — 7 periods across all four
statuses, 1 close run — and gained the C-27 and B5.5-F1 disclosures by name) ·
`lib/accounting/model.ts` (`fiscalPeriodPipelineIndex`; `PERIOD_CLOSE_RUN_STATUS_META`;
`toPeriodCloseRunStatus`; `countCloseRunsByStatus`; the now-dead `NOT_YET()` helper removed — every
`ACCOUNTING_KPI_BINDINGS` entry now carries a real `drillIn`; three `period.*` bindings gained one)
·
`components/manager/accounting/shared/AccountingNotes.tsx` (+`index.ts` barrel) (new
`AccountingPeriodCloseRunStatusBadge`, mirroring the pre-existing `AccountingPeriodStatusBadge`'s
fail-closed shape) ·
`lib/manager/accounting-surface-queries.ts` (`useFiscalPeriodsList`/`usePeriodCloseRunsList`, two
new React Query hooks, deliberately separate keys from the B5.1 dashboard's own polled
`accounting-fiscal-periods`/`accounting-period-close-runs` queries) ·
`scripts/manager-b5-assertions.ts` (page-count 20→22, available-row-count 19→21; new §15 of
B5.5-specific checks) ·
`e2e/manager-accounting/{fixtures.ts,menu-and-read-only.spec.ts}` (2 new route constants; the
21-row available-menu-key list and its DOM-order text assertion updated with Fiscal periods/Period
close runs inserted after Journal entries; inert-row-count 9→7, tag-count assertion narrowed to
`B5.6` only) ·
`docs/manager-ui-docs/MANAGER_API_MATRIX.md` (new "Consumed by B5.5" section, including the C-27
and B5.5-F1 disclosures) ·
`ai/ENTERPRISE_UI_ROADMAP.md` (B5.5 row marked complete; new C-27/B5.5-F1 Track C rows) ·
`CLAUDE.md`, `CODEX.md`, `PROGRESS.md`, `ai/AI_STATUS.md` (this phase's milestone entry).

---

## 8. Validation

Isolated local Docker stack — Postgres 16 on **`:55470`** (`nimbus_b55_qa`), API on **`:4081`**, web
(`next dev`) on **`:3170`**. **Shared Neon was never connected to or written.** `apps/api/.env` was
never edited on disk (the isolated database target was supplied by an explicitly constructed
child-process environment via `env -u DATABASE_URL -u DIRECT_DATABASE_URL DATABASE_URL=… node
dist/main.js`, per the documented isolation rule — `apps/api/.env` SHA-256
**`0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b`**, confirmed unchanged before
this phase started and never touched during it). `packages/db/.env` **was** temporarily swapped for
the three Prisma CLI steps (`migrate deploy`/`db:seed` ×2/`db:demo:import`) — the documented,
unavoidable exception — restored immediately after, verified byte-identical: SHA-256
**`2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75`**, matching the pre-change
baseline exactly.

| Gate | Result |
| --- | --- |
| `typecheck` | ✅ 0 errors |
| `lint` (`next lint`, no `--fix`) | ✅ 0 warnings, 0 errors |
| `build` | ✅ compiled; `/manager/accounting/closing/fiscal-periods` 2.02 kB, `/manager/accounting/closing/period-close-runs` 2.16 kB |
| Assertion scripts | ✅ **17/17** (`manager-b5-assertions.ts` extended with the new §15; no other script touched) |
| `e2e/manager-accounting/closing.spec.ts` (new, 19 specs × 4 viewports) | ✅ **76/76 passed, 0 failed** (4.1 min) |
| `e2e/manager-accounting/menu-and-read-only.spec.ts` (updated, 19→21 row count) | ✅ **29 passed / 3 skipped / 0 failed** across all 4 viewports (32 total) — the 3 skips are the pre-existing "desktop dropdown only at `xl`" reason at `vp-1024x768`, unrelated to B5.5 (the same skip class every prior B5.x menu spec already carries) |
| `e2e/manager-accounting/` full regression (all spec files, incl. `closing.spec.ts`) | ✅ **88 passed / 10 skipped / 0 failed** (98 total) at `vp-1440x900` — the 10 skips are the pre-existing Bank statements/Reconciliation empty-dataset skips (this session did not recreate B5.3's own fixtures), unrelated to B5.5 |
| `e2e/manager-shell/` regression | ✅ **34/34** at `vp-1440x900` — includes the cross-role boundary suite (waiter/cashier/supervisor cannot open Manager, Manager cannot open their workspaces), branch switcher, top-nav keyboard operation |
| `/api/health` | ✅ `ok` throughout |
| `git diff --check` | ✅ clean |

**Not run in this pass:** newman/Postman — the Closing surfaces' two routes were never part of any
Postman collection to begin with (they are new UI consumers of pre-existing routes; C-23's M33 GL
collection defect is unrelated and unchanged). The API Jest suite was not run (no backend file
touched).

---

## 9. Defects found and fixed **in** this phase

None. Unlike B5.2 (the `detailRequest()` double-id bug) and B5.3
(`BankAccountRow.currentBalance`), this phase found no pre-existing frontend defect in code it
touched or read.

---

## 10. Findings recorded, none implemented

**C-27** (Manager's token holds a pre-existing, never-revoked `pos:accounting:periods:create` write,
plus `accounts:create`/`cost-centers:create`) is the most significant finding of this phase — a real
permission-boundary leak, not a data-shape defect — recorded in `route-registry.ts` and
`ENTERPRISE_UI_ROADMAP.md`'s Track C table by name, and **not implemented**: fixing it means editing
`packages/db/prisma/seed.ts`'s permission grants, a seed change explicitly out of scope for a
frontend-only phase and requiring its own authorised cutover, mirroring how the original C-21 gap
was handled. **B5.5-F1** (`PeriodCloseRunStatus.FAILED`/`.PENDING` unreachable through the live API)
is likewise recorded, not implemented — fixing it would mean adding a failure branch to
`closeFiscalPeriod()`, a backend behaviour change out of scope here. B5.1–B5.4's carried-forward
findings (PC-01, PC-02, PC-06, PC-07, BGB3-L3, C-23, C-25, C-26, B5.4-D1) are unaffected by this
phase and remain open exactly as B5.4 left them.

---

## 11. Deferred, and gated

- **B5.6 (Reporting + Configuration — Budgets vs actuals, Demand calendar, Forecast, Chart of
  accounts, Cost centres, Posting source maps, Tax configuration) is NOT started.**
- Do not add a create/open/close/lock control to either Closing surface — the owner ruling holds
  regardless of C-27's technical permission window; a UI control is a design decision independent
  of what one string happens to permit.
- Do not "fix" C-27 as an incidental side-effect of B5.6 or any later work — it is a seed/permission
  change requiring its own explicit authorisation, the same rule every prior seed-related finding in
  this project (C-21, C-22) has followed.
- Do not add a failure-branch/retry affordance for period close runs without first confirming a real
  FAILED-producing endpoint exists — B5.5-F1 established that none currently does.
- A future backend batch should sweep the **entire** Manager permission grant for every OTHER
  pre-2026-08-20 M-series module (not only accounting) for the same class of un-audited stray write
  C-27 found here — this phase did not attempt that broader sweep, which is explicitly out of scope,
  but the method (§4) generalises directly.
