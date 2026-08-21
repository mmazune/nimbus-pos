# CODEX.md - Nimbus POS

> Primary onboarding file for Codex working in this repository. Read this first,
> then read `CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`, `AGENTS.md`, and the
> mandatory governance docs before making changes. When docs and code disagree,
> the local worktree and the top of `ai/AI_STATUS.md` win; update stale docs to
> match reality.

---

## 1. Project purpose

Nimbus POS is a full-depth restaurant/hospitality operating system: POS, KDS,
inventory, procurement, reservations, events, HR/workforce, payroll, accounting,
franchise, billing, developer portal, reporting, alerts, offline reliability, and
late-wave hardware integrations.

- Backend: complete through BG7 (M0-M42 + BG0-BG7).
- Frontend: active phase. Waiter, Cashier, and Supervisor are being built on a
  shared operational UI system.
- Brand (2026-08-20): the Aug-2026 Nimbus POS Brand Identity (designer
  Andimashimwe Rhoda) has fully landed in the frontend - navy/silver/graphite
  tokens, an alpha-channel token system, true-vector steering-wheel logo assets in
  `apps/web/public/brand/`, and the `NimbusLogomark` brand mark. Canonical
  reference: `docs/BRAND_IDENTITY.md`. Do not reintroduce pre-Aug-2026 palette
  values from the `Front End/` doc packs.

## 2. Repository path

- Current workspace: `/Users/mosesmazune/Desktop/Nimbus POS`
- Historical Windows canonical path in Claude docs: `C:\Users\arman\Desktop\nimbus-pos`
- Forbidden stale Windows path: `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

Use the current local workspace path for this Codex task. Do not assume GitHub or
the last commit is newer than the dirty worktree.

## 3. Package manager and commands

Use pnpm `8.15.0` through Corepack.

```bash
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev

corepack pnpm@8.15.0 dev:api
```

API base is `http://localhost:3001`, global prefix `/api`; web dev normally runs
on `:3000`. Do not run migrations, seed, destructive QA, or shared Neon writes
unless the task explicitly requires them and the relevant isolation rules are met.

## 4. Source-of-truth documents

| Topic | Canonical document |
| --- | --- |
| Codex onboarding | `CODEX.md` (this file) |
| Claude onboarding | `CLAUDE.md` |
| Shared agent memory | `AGENTS.md` |
| Progress / status | `PROGRESS.md` and `ai/AI_STATUS.md` |
| Architecture index | `ARCHITECTURE.md` |
| Detailed architecture | `docs/ARCHITECTURE.md`, `docs/UI_SYSTEM.md` |
| Brand identity (palette/logo/type) | `docs/BRAND_IDENTITY.md` (canonical, Aug-2026 rebrand - supersedes every `Front End/` palette table) |
| Waiter role UI | `docs/waiter-ui-docs/{README,WAITER_API_MATRIX,WAITER_LIFECYCLE}.md` (canonical, new 2026-08-20) |
| Cashier API contract | `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (canonical, new 2026-08-20 - supersedes the legacy `Front End/cashier_ui_docs_pack` matrix) |
| API / Postman contract | `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`, `ai/AI_POSTMAN_WORKING_PATTERNS.md` |
| Testing / QA | `docs/TESTING_AND_QA.md` |
| **Enterprise UI plan (canonical)** | **`ai/ENTERPRISE_UI_ROADMAP.md`** (new 2026-08-20; Tracks A/B/C - supersedes `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` from M-P2 onward) |
| Manager Operations + Staff (Track B3) | `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md` (canonical B3 record, 2026-08-20) + `ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md` |
| Manager Accounting (Track B5.1) | `ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md` (canonical B5.1 record, 2026-08-21) - the frontend accounting contract is the executable registry `apps/web/src/lib/accounting/route-registry.ts` |
| Manager dashboard (Track B2) | `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md` (canonical B2 record, 2026-08-20) - shell record: `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md` |
| Odoo reference + gap analysis | `ai/ODOO_REFERENCE_RESEARCH.md` (+ `ai/odoo-reference-screenshots/`), `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` |
| **Backend gap batch 2 (PC-03, PC-04)** | **`ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md`** (canonical record, 2026-08-21) |
| **Permissions cutover (C-21, FU-1, B3-F1)** | **`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`** (canonical record, 2026-08-20) |
| **Accounting/finance API verification (Track B0)** | **`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`** (canonical B0 record plus the B5 go/no-go, 2026-08-20) |
| Locked decisions | `docs/DECISIONS.md` |
| Known limitations | `docs/KNOWN_LIMITATIONS.md` |
| Cashier reconstruction | `docs/cashier-ui-docs/*`, `ai/CASHIER_FLOOR_RECONSTRUCTION_*.md` (C3 complete 2026-08-20; C4 not started) |
| Supervisor reconstruction | `docs/supervisor-ui-docs/*`, `ai/SUPERVISOR_RECONSTRUCTION_*.md` |

## 5. Current implementation status

**Enterprise UI Track B5.1 complete - Manager ACCOUNTING module shell, menu tree and
dashboard (2026-08-21) - A: B5.1 COMPLETE / B5.2 through B5.6 GATED.** Frontend and
docs only. No backend, schema, migration, seed, permission, DTO or Postman change.

Accounting becomes the SEVENTH Manager module (OD-3 approved), inserted before
Settings, shipped as one more `MANAGER_MENU_GROUPS` entry over the shared
`OperationalTopNav` - never a fork. New role-agnostic `lib/accounting/*` (OD-2: an
Accountant role can later mount the same module) with exactly one Manager-shaped
adapter, `lib/manager/accounting-context.ts`.

Manager accounting is READ-ONLY BY PERMISSION, not by product preference. Manager
holds 15 accounting read strings and zero writes (PC-01/PC-02, re-verified live:
5 of 5 representative writes returned 403), so no write affordance renders
anywhere, not even a disabled one. The assertion script bans a write `method:`,
`useMutation`, `<Button`, `onClick=` and `<form>` across the accounting tree, and
the e2e proves zero non-GET requests and zero disabled buttons. Where an Odoo user
would reach for New / Upload / Post / Approve / Match, a panel names the action and
the route and says an Owner or Accountant performs it.

Menu tree: 24 rows, 1 live link, 23 honest phase-tagged not-yet rows, grouped under
Odoo's own headings (Customers, Vendors, Bank, Accounting, Review, Reporting,
Configuration). Every row cites a live-verified endpoint in the new 38-route
`ACCOUNTING_ROUTE_REGISTRY`, and `assertAccountingMenuIsBacked()` runs at module
scope - a row citing an unknown endpoint, or one Manager cannot read, fails the
build. Eleven Odoo item groups are ABSENT with written reasons, including the
eleven financial statements (no endpoint exists - NG-07 to C-11), Receipts and
Manual entries (both POST-only; the roadmap's own menu table listed Receipts -
corrected here) and Procurement suggestions (403 for Manager, PC-02).

Five cards, every figure registry-bound through the 19-entry
`ACCOUNTING_KPI_BINDINGS` (an unregistered key throws): Customers-receivable,
Vendors-payable, General ledger, Bank, Fiscal period. Live Tapas Downtown: UGX
9,106,400 receivable over 5 open invoices, UGX 1,282,400 payable over 3 open bills,
5 journals, 0 posting errors, FY2026-Q3 Open. Switching to Rooftop Bar re-scopes
every branch figure (2,454,600 / 3,263,500 / 8) while the organisation-level fiscal
period stays put - the visible proof that batch 2's PC-03 fix reached the UI.
Budget-vs-actuals was OMITTED though the brief listed it as a candidate:
`/finance/budgets` returns `[]` in both probed branches on a fully seeded and
demo-imported database, so no figure could be verified live (same for demand
calendar). No charting dependency - one hand-rolled SVG bucket-bar mark, honest
because the aging buckets are a real categorical series the backend itself
computes; no time trend exists (NG-05) so none is drawn. PC-06 bare arrays ship
as-is, client-counted and labelled "Showing all N ... not a server total"; no pager
is bound and `.length` is never assigned to a `total`.

Sub-phases were RENUMBERED: the dashboard moved from B5.6 to B5.1 and everything
else shifted by one - B5.2 Customers+Vendors, B5.3 Bank, B5.4 Core+Review, B5.5
Closing, B5.6 Reporting+Configuration. The renumber lives in
`lib/accounting/menu.ts`, so the on-screen phase tags and the roadmap agree.

Two new backend findings, recorded not implemented. B5-F1: `ar/aging.summary`
aggregates the RETURNED PAGE, not the whole `where` - live `?take=1` reported
`total: 5` beside `summary.totalOutstanding: 599,800` where the branch figure is
9,106,400, so a bounded read (which every Manager discipline rule demands) would
have printed an understated receivable balance. B0 missed it because its probe used
the default page size on a five-invoice dataset. The card now withholds the balance
unless `sum(accounts[].invoices.length) >= total`. B5-F2:
`GET /ar/invoices?status=<invalid>` returns 500, not 400 - the status query is an
unvalidated raw string. Also recorded: B5-F3 (B0's "pagination bound" column is an
artefact of a combined take+pageSize+limit probe; there is no server maximum),
B5-F4 (`/api/audit/timeline` ignores `X-Branch-Id` and pages with `pageSize`),
B5-F5 (`ap/aging` is unbounded by design), B5-F6 (the 24-row dropdown is long).

Two defects were found and fixed in this phase. B5-D1: a `<p>` nested inside the
card footnote's `<p>` produced 64 React warnings per load, caught by the
zero-console-error gate. B5-D2: the receivable card explained a FAILED READ with the
partial-page wording - specific, confident and wrong - caught by VIEWING the
error-state screenshot, not by a test. Both are now pinned by assertions. Five
assertions that pinned Accounting's ABSENCE were INVERTED, not deleted, each naming
OD-3 and the date; the "exactly six" nav guards became "exactly seven" - still exact
lists, never relaxed to "at least".

Validated on an isolated local Docker stack (Postgres `:55435`, API `:4031`, web
`:3120`). Shared Neon was never connected to or written - the QA API held exactly
one non-listening TCP connection, to `[::1]:55435` - and neither `.env` was modified
(SHA-256 identical before and after). Web typecheck, lint and production build pass;
17 of 17 assertion scripts pass including the new `manager-b5-assertions.ts`;
Playwright `e2e/manager-accounting/` 90 passed / 10 skipped across four viewports;
regressions `manager-shell` 125 passed / 11 skipped (matching the B1/B2 baseline
exactly), `manager-dashboard` 84/84, cashier cross-role 12/12; 9 accounting requests
and at most 14 total per dashboard load, all GET, all branch-scoped; zero console
errors; 19 screenshots captured and 6 viewed at 1440x900 and 1280x680;
`/api/health` returns ok; `git diff --check` clean; all five pre-existing dev
servers verified healthy before and after, and the container removed.

B5.2 (Customers + Vendors lists) and every later B5 sub-phase, plus B6 and B7, are
NOT started - do not begin any of them without explicit owner authorisation. See
`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) - backend gap batch 2 complete - PC-03, PC-04 (2026-08-21) - A: COMPLETE /
B5 gate now GO / shared-Neon deploy STILL GATED.** The second owner-authorized
Track C batch clears the two blocking conditions on the B5 gate. Backend source,
tests and docs only. No Prisma schema change, no migration, no seed change, no
permission change, no `demo-import.ts` change, no Postman collection edited, and
no frontend file touched.

Validated on an isolated local Docker Postgres stack (`:55433`, API `:4021`, web
`:3100`), with a second container (`:55434`, API `:4022`) carrying a `bcbabd9`
worktree so every claim has a measured "before". Shared Neon was never connected
to or written, and neither `.env` was modified (SHA-256 identical before and
after).

- **PC-03 - each entity was ruled on from SCHEMA TRUTH, and the leak was wider
  than B0 recorded.** Three categories, not two. NOT NULL `branchId`
  (`BankAccount`, `BankStatement`, `BankReconciliation`, `ManualBankEntry`) gets
  strict equality. Nullable `branchId` (suppliers, bills, payments, AP/AR credit
  notes, invoices, customer accounts, reminders, recurring profiles, posting
  errors) gets "acting branch OR `branchId IS NULL`" - the repo's existing
  predicate in `attendance`, `workforce`, `payroll` and `analytics` - because
  strict equality on a nullable column would orphan every org-level row from
  every branch at once. Models with NO `branchId` column at all (`FiscalPeriod`,
  `PostingSourceMap`, `TaxLedgerConfig`), plus `PeriodCloseRun` whose nullable
  column the close path never stamps, are org-level BY DESIGN: documented,
  downgraded, and no column invented for them. Both rules live once in
  `apps/api/src/common/scope/branch-scope.ts`, so a list and its detail sibling
  cannot drift apart again.
- **B0 undercounted and got one fact backwards.** Beyond the four named reads,
  eleven further instances of the same class were found, including three
  cross-branch WRITES (`POST /ap/bills/:id/approve`, reconciliation `match` and
  `skip`), both aging aggregates (org-wide money shown above a single-branch
  list), and `GET /ar/accounts`, which honoured only the optional `?branchId=`
  query param and ignored `X-Branch-Id` entirely. And `getBankStatement` was
  org-scoped too, so the detail leaked rather than 404ing as B0 claimed.
  Cross-branch targets now return 404, never 403 (the B3-F1 precedent), and the
  scope helpers throw rather than degrade to an org-wide read.
  Before and after on the same 31-case suite: 19 failed / 12 passed at `bcbabd9`,
  then 31 passed / 0 failed.
- **PC-04 needed two checks, because repairing the comparison alone cannot
  work.** After a generation the profile already points at the next cycle, so a
  "cycle already billed" check finds nothing; it is paired with a
  cadence-elapsed check measured from `lastGeneratedAt`. Measured before and
  after, three clicks of one MONTHLY 150,000 profile: `200/200/200` producing 3
  bills and 450,000 billed, versus `200/409/409` producing 1 bill and 150,000.
  The deliberately-red e2e is green, its "do not relax this to 200" warning is
  retained, and a new test proves the legitimate next-period bill still returns
  200 (count goes 1 to 2, not 1 to 3).
- **PC-05 closed as a precondition.** The stale `totals.grand*` names meant
  `accounts-receivable.service.spec.ts` could not compile, so the whole AR unit
  suite was dead and the new AR scoping tests had nowhere to live. Test-only fix.
- **PC-01, PC-02, PC-06 and PC-07 remain open by design.** B0 raised them as
  decisions B5 must make, not defects to repair, and all four are carried as
  explicit roadmap entries. Do NOT grant Manager an accounting write, and do NOT
  fabricate a server `total` from `array.length`.
- **New finding C-23: the M33 GL Postman collection cannot run.** It sends a
  literal `{{accountId}}`, so journal creation returns 400 and 20 assertions fail
  across 18 requests. Proven pre-existing - identical failure set at `bcbabd9` on
  a from-scratch database. B0 never ran M33, so B5.3's journals surface has no
  Postman verification. C-22 (37 unseeded deferred-module permissions) was
  promoted from a passing mention to a proper Track C register row with the
  B7-must-budget note.

**Validation.** AP+AR e2e 91 passed / 0 failed, against a `bcbabd9` baseline of 1
failed / 88 passed on a from-scratch database (that one being the deliberately-red
test). New cross-branch e2e 31/31. Full API e2e 98 failed / 1043 total versus 99
failed / 1010 total at HEAD from equally clean databases, with the failing
TEST-NAME SETS diffed: the only difference is the PC-04 test going green, so zero
regressions. The 98 are pre-existing cross-suite interference in billing, HMS,
quick-pin, franchise, attendance and tenancy, none in accounting; B0's "272/273"
was a subset run, not the full suite. Touched unit suites 148/148. Full API unit
1100 passed / 4 failed, the 4 proven pre-existing at `bcbabd9`
(`client-onboarding`). API typecheck 0 errors. Newman M34 23 requests / 46
assertions 0 failed, M35 21/45 0 failed, M32 17/34 0 failed, M36 18/24 0 failed,
M33 20 assertions failed (pre-existing, C-23). 56/56 collections parse. Web
typecheck, lint and production build pass. 16/16 assertion scripts. Playwright
`manager-operations` 40/40. `/api/health` ok.

⚠️ **Disclosed.** The first QA API launch used `PORT=4021`, but `main.ts` reads
`API_PORT`, so it defaulted to 3001 and exited with `EADDRINUSE` - it failed
rather than taking the port, and the pre-existing dev API was verified healthy
immediately afterwards. The QA browser run initially failed at login because
`API_CORS_ORIGINS` defaults to `:3000` only; it was restarted with `:3100`
allowed. Both pre-existing dev servers (`:3001`, `:3003`) were left running and
verified afterwards, and no shared-Neon write occurred.

**The shared-Neon deploy is STILL GATED** and is now behaviour-visible in one
more way: accounting reads will return FEWER rows (one branch's, not the org's),
AP and AR aging figures will CHANGE VALUE, and cross-branch AP approvals and
reconciliation matches will stop working. **B5, B6 and B7 are NOT started - do
not begin any of them without explicit owner authorisation.** See
`ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) - permissions cutover complete - C-21, FU-1, B3-F1 plus Track B0 (2026-08-20) -
A: COMPLETE / B5 CONDITIONAL GO / shared-Neon deploy GATED.** Backend and seed
DATA only. No Prisma schema change, no migration, no `demo-import.ts` change,
and no frontend file touched.

Validated on an isolated local Docker Postgres stack (`:55432`, API `:4011`, web
`:3111`). Shared Neon was never connected to or written, and neither `.env` was
modified - SHA-256 identical before and after, because isolation was achieved by
constructing the child-process environment explicitly rather than by swapping
`.env` (the `tools/qa/lib/isolation.mjs` principle).

- **C-21: the gap was 36 permission strings over 56 routes, not the 23 on
  record.** The earlier count was a PREFIX check, not a string check. `bank-rec`
  references 11 `pos:accounting:*` strings that share the prefix with the seeded
  M28/M29 rows but are themselves absent, and `budget` references two strings
  outside the `finance:` prefix. Measured live before the change, all 6 bank-rec
  GET routes returned 403 to Owner - so the prior claim that "accounting, ledger
  and bank-rec are fine" was wrong. All 36 are now seeded with route-accurate
  descriptions.
- **OD-9 resolved with the owner's stated default, and the reasoning is recorded
  in the seed.** OD-9 conditioned Manager's writes on "B0 proving the permission
  is held", which is unsatisfiable: B0 can only observe what the seed grants.
  Grants are Owner FULL (36), Accountant FULL (36), Manager READ-ONLY (15),
  nobody else. Verified live: Manager 200 on 25 of 26 accounting GETs and 403 on
  all 16 write attempts; Supervisor 403 on all 36.
- ⚠️ **`procurement:advisory:read` is deliberately withheld from Manager.** That
  one string gates both a read AND the mutation
  `PATCH /finance/procurement-suggestions/:id/review` (finding PC-02), so
  granting the read would have granted a write. It is Manager's only accounting
  read 403.
- **Seed idempotence proven three ways:** run twice (36/87/1 created then
  0/0/0, identical content hashes); a greenfield seed converging on the identical
  `c2b602ce...` hash at 273 permissions / 922 grants; and a repair run recreating
  exactly 56 deliberately-deleted rows.
- **FU-1: `pos:hr:compensation:read` REVOKED from Manager** (Owner and Accountant
  keep it). This enforces the locked "compensation excluded from the Manager MVP"
  decision at the wire instead of relying on the frontend not to ask. Live before
  to after: Manager `?view=full` 200 to 403 on both list and detail, and
  `/hr/compensation-profiles` 200 to 403. The default safe read is unchanged.
  Because `seedRolePermissions` only inserts, `revokeStaleWaiterPermissions` was
  generalised into a declarative `REVOKED_ROLE_PERMISSIONS` table plus
  `revokeStaleRolePermissions()`.
- **B3-F1: Quick-PIN admin routes are branch-guarded.** `loadEmployeeForOrg`
  became `loadEmployeeForBranch` (org AND branch, mirroring shift-swap approve),
  failing closed twice over: a cross-branch target returns 404, never a 403 that
  would confirm the id exists elsewhere, and a NULL-branch employee is refused
  too. Live before to after: cross-branch status/disable/enable 200 to 404.
  ⚠️ A second escape not in the original write-up was found and closed: `reset()`
  accepted `body.branchId` and fed it straight into the Quick PIN lookup hash, so
  a caller could mint a PIN scoped to a branch they are not acting in. Now 400.
  Onboarding does NOT share the gap - checked, it takes the branch from
  `ctx.branchId` only.
- ⚠️ **A hollow test was found and fixed.** The first B3-F1 e2e looked FOR a
  second-branch employee and self-skipped when the dataset had none, so the suite
  went green while proving nothing. The fixture is now CREATED through the public
  onboarding API. Re-run: 19/19 with 0 skips, including a control proving the
  same id resolves 200 once `X-Branch-Id` names its own branch.
- **B0 folded in and COMPLETE** - `ai/ACCOUNTING_API_VERIFICATION_REPORT.md`. 112
  routes extracted and reconciled against the API's own RouterExplorer boot log
  (0 unmapped, 0 missed), which is how a parser defect was caught:
  `budget.controller.ts` declares THREE `@Controller` classes and the forecast
  route is `/api/franchise/forecast`, not `/api/finance/forecast`. The 75-route
  accounting block was verified live across four roles with 25 live writes,
  including a bank reconciliation taken to COMPLETED and a fiscal period taken
  DRAFT to OPEN to CLOSED to LOCKED (PC-07 - four states, no unlock route).
  The clearest measure of what C-21 unblocked: AP+AR e2e went from 69 failed /
  20 passed in the pre-cutover permission state to 1 failed / 88 passed after.
- 🔴 **B5 is CONDITIONAL GO**, blocking on **PC-03** - `ap/suppliers`,
  `ap/credit-notes`, `ar/credit-notes` and `bank-statements` return ANOTHER
  BRANCH's rows regardless of `X-Branch-Id` (9 of 34 list/get methods filter on
  `orgId` only; `bank-statements` and `posting-errors` are list/detail
  inconsistent) - and **PC-04** - AP recurring-bill duplicate prevention is dead
  code: the guard compares `lastBill.dueDate === profile.nextDueDate` but the
  same transaction advances `nextDueDate`, so a second call issues a SECOND bill
  for the same supplier. Its e2e test is deliberately left RED to document the
  correct contract; do not "fix" it to expect 200. Also PC-06 (ten list routes
  return a bare array with no server `total`, which the C4 pager cannot bind to)
  and PC-01 (Manager holds no accounting write at all).
- 🔴 **New finding C-22: 37 further guard permissions still have no seeded row** -
  `franchise:*` (12), `ops:*` (8), `dev:*` (5), `merchant:*` (4), `billing:*` (3),
  `onboarding:*` (2), `support:*` (2). Franchise, ops-portal, developer-portal and
  owner SaaS billing are 403 for every role exactly as accounting was. They were
  DELIBERATELY not seeded (all deferred modules). B7 must budget the same cutover.
- **Postman:** three stale collections repaired. M34 sent `paymentTermsDays` (the
  DTO field is `paymentTermDays`; the whitelist 400'd and cascaded into 10
  downstream 404s), M35 asserted the renamed `totals.grand*` instead of
  `summary.*` (PC-05), and M37's two procurement-review requests now carry R11
  honest-skip guards so an empty dataset can never read as a verified route. On a
  from-scratch database: 85 requests, 0 request failures; 166/168 assertions pass,
  the 2 being those deliberate skip markers. 56/56 collections parse (3 carry a
  pre-existing BOM).
- **Validation:** API unit 1057 passed / 4 failed, the 4 proven pre-existing by
  re-running the same two suites at `30c67aa` in a throwaway worktree (identical
  failures, identical test names). API e2e 272/273 (the 1 is PC-04). Web
  typecheck, lint and build pass. 16/16 assertion scripts. Playwright
  `manager-shell` 125 passed / 11 skipped and `manager-dashboard` 84/84, both
  matching their B1/B2 baselines exactly, plus `manager-staff` 106 passed / 26
  skipped, `manager-reports` 151 passed / 1 skipped and `manager-operations`
  160/160. `/api/health` ok. `git diff --check` clean.
- ⚠️ **Disclosed:** three Playwright runs were invalidated by the isolated web
  server being OOM-killed - reported rather than discarded, and re-run at
  `--workers=2`. A too-broad `pkill` killed the pre-existing shared-Neon dev API
  on `:3001`, and the pre-existing web dev server on `:3003` was lost to
  background-task process-group cleanup. Both were restarted and verified
  (`:3001` `/api/health` ok on the external Neon host, `:3003` `/login` 200), and
  no shared-Neon write occurred. Lessons: use PID-targeted kills, never a broad
  `pkill` pattern, and start long-lived helper servers detached.

**The shared-Neon deploy is STILL GATED** and is behaviour-visible: 56 routes
change from 403 to reachable, a Manager token LOSES compensation access, and
cross-branch Quick-PIN administration stops working. **B5, B6 and B7 are NOT
started - do not begin any of them without explicit owner authorisation.** See
`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) - Enterprise UI Track B4 complete - Manager REPORTS (2026-08-20) -
A: B4 COMPLETE / B5, B6, B0 and the permissions cutover GATED.** Frontend and
docs only; no backend, schema, migration, seed, permission or Postman change.

`/manager/reports` becomes a MODULE (its root now redirects) carrying two live
surfaces - `/reports/catalog` and `/reports/runs` - built on the existing B1/B3
chrome. No new shared primitive was added. The two `B4`-tagged placeholder rows
in the B1 menu tree are now real links.

- **Precondition repaired first.** The B4 brief required B3 complete AND
  committed. It was neither: no B3 commit existed, its Playwright run had been
  cut off at 245/292, and its report section 10 plus evidence sections 5 and 7
  were placeholders. The interrupted run was recovered (292 passed, 37.5m, 0
  failed), the evidence filled in with real numbers, and B3 committed as
  `c34d12e` before B4 began.
- **Catalog** lists all 37 entries and takes availability from the API's OWN
  `status` field - IMPLEMENTED 24, CONDITIONAL 1, PENDING_LATER 12 - so the UI
  cannot drift from what the backend can run. The 13 non-implemented entries get
  `generatorPath: null` and are structurally uncallable: no form, no disabled
  button, and each names the milestone the API itself cites. An unknown status
  fails closed.
- **Generate** is ONE shared form. MP0-16 was re-verified live on all 24 routes
  (all returned 201): every DTO is `{reportWindow!, dateFrom?, dateTo?,
  parameters?}` and only `top-items` adds `limit?`. CUSTOM requires both dates
  and the form says so instead of letting the API 400. `parameters` is accepted
  by every DTO but read by none, so no free-form editor ships (B4-F6).
- **History is genuinely persisted** - verified before it was built, because the
  brief required an honest session-only fallback otherwise. `GET /api/reports`
  is a real server-paginated, branch-scoped read fed by the endpoint's `total`.
- **Export is CSV-only and the format is hard-coded** - there is no format
  parameter, so no caller can request a PDF. `format: PDF` returns 501
  (re-verified live) and a legacy pre-2026-08-20 PDF artifact's download returns
  404; those artifacts are disclosed in prose and never offered as a control.
  The download streams the server's bytes via `response.blob()`; `new Blob(`
  appears nowhere in the Manager tree.
- **No graph and no pivot, and neither is advertised** - gated on C-03.
  `ManagerViewSwitcher` is deliberately not mounted on Reports.
- **Defect found and fixed (B4-D1).** The first implementation added a second
  query key for `/api/reports/catalog`, which the M-P1 readiness strip already
  fetches on every Manager page, so the catalog page issued that request TWICE
  per load. Reports now shares the readiness strip's key and fetcher and
  projects with `select` - one endpoint, one cache entry, two consumers.
- **Defect caught before shipping (B4-F2).** `grossSales` is tax-inclusive at
  summary level but ex-tax inside `topItems[]` and `categories[]` - the same
  field name with two tax bases. A generic "render every key" breakdown
  mislabelled per-item ex-tax money as tax-inclusive, so each report now
  declares its own columns, mirroring its CSV header. Money uses fail-safe
  classification: an unrecognised key renders as text, never guessed into
  currency. `rowCount` is labelled "Records aggregated" (219 for SALES_BY_HOUR,
  whose export is 24 rows) and no table may be derived from it.
- **Cross-branch reads fail safe at the API-client boundary** - MP0-12
  re-verified live: another branch's run returns 200 from `/reports/:id`.
- **Live money cross-check:** DAILY_SALES, `/dash/today-summary` and
  `/dash/manager` agree exactly - gross 33,014,100 = net 27,978,300 + tax
  5,035,800, subtotal 28,107,000.

Validated on the same isolated local Docker Postgres stack B3 used (never shared
Neon): web typecheck, lint and build pass; 16/16 assertion scripts including the
new `manager-b4-assertions`; Playwright `e2e/manager-reports/` 152/152 across
four viewports (38 each, 0 skipped) with CSV file CONTENTS asserted rather than
just status; 10 screenshots at 1440x900 and 1280x680 viewed; per-surface budgets
at or under 4 requests; zero console errors; `/api/health` ok. Six findings
recorded and none implemented (B4-F1 through B4-F6). See
`ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`.

**B5 (Accounting), B6 (Settings), B0 and the C-21 permissions cutover are NOT
started. Do not begin any of them without explicit authorization.** Do not add a
PDF affordance, a graph or pivot view, a second catalog query key, a
client-built CSV, a row table derived from `rowCount`, or a delete/edit control
on run history.

**Prior status (superseded above) - Enterprise UI Track B3 complete - Manager OPERATIONS + STAFF (2026-08-20) -
A: B3 COMPLETE / B4 GATED.** Frontend and docs only; no backend, schema,
migration, seed, permission or Postman change.

Operations and Staff become MODULES (`/manager/operations` and `/manager/staff`
now redirect) carrying eight live surfaces, built on the B1 chrome primitives -
B3 is the first phase to actually MOUNT `ManagerSearchFilterMenu` and
`ManagerBreadcrumbs` - plus four new shared ones: `ManagerListTable` (Odoo C4),
`ManagerStatusPipeline` (C14), `ManagerViewSwitcher`, `ManagerRecordActionsMenu`
(C13).

- **Operations is STRICTLY READ-ONLY** (zero mutations and zero `useMutation`
  hooks, proven by assertion). `/operations/orders` is the C4 list - server
  pagination fed by the endpoint's own `total` (298), status and service filters
  as removable chips, an optional-column gear, and a totals row labelled "This
  page" because `/pos/orders` returns no aggregate - opening a read-only C5
  record with a breadcrumb + record pager, statusbar pipeline, notebook tabs and
  a totals block, and NO action control of any kind. `/operations/tables`
  renders the SHARED `OperationalFloor` unforked (proven in e2e through its own
  `data-operational-*` attributes) with a read-only selection panel.
  `/operations/reservations` is read-only over the same bounded
  `scope=active|history` contract Supervisor 4A/4B established.
- **Staff writes exactly four things**: frontline onboarding (3-step, shared
  `ActionConfirmDialog`, PIN masked then revealed once with copy-once, never
  cached, logged, stored or URL-encoded); Quick-PIN reset/disable/enable (Odoo
  C12 with only the rows Nimbus can back - password, 2FA, API keys, passkeys and
  session revocation are OMITTED, not greyed out, per NG-08); leave review (no
  payroll or roster claim, and the org-scoped decision is disclosed); and
  shift-swap REJECTION only.
- **Shift swaps are Outcome C, proven not asserted.** A real rejection changed
  0 of 3 `schedule_assignment` rows and left `GET /workforce/roster`
  byte-identical. There is no Approve control and there must not be one.
- **Privacy.** `lib/manager/staff-projection.ts` is an ALLOW-LIST of 14 safe
  fields applied at the API-client boundary - necessary because `/hr/leave` and
  `/hr/shift-swaps` still embed full employee `dateOfBirth`, `address`,
  `emergencyContact*` and `notes` on the wire (re-verified live). `?view=full` is
  never sent (confirmed live that it WOULD return compensation to a Manager
  token - FU-1 is real); `GET /hr/employees/:id` is never called; the directory
  narrows to the branch in the BROWSER and says so, because `/hr/employees` is
  org-scoped and 400s on `?branchId=` (MP0-06 / C-09 - the payload spans 5
  branches).
- **Defect found and fixed (B3-D1).** Backend gap batch 1 INVERTED
  `grossSales`/`netSales`, so the B2 Overview was rendering the ex-tax figure
  under the label "Sales today (tax-inclusive)". FU-3 recorded this as merely
  stale notes; it was a live mislabel of the dashboard's headline money. The KPI
  bindings are re-pointed and pinned by an assertion - do not "fix" them back. A
  second B3-caused untruth was also removed: the M-P1 global "Read-only
  oversight" badge in the readiness strip, false the moment Staff shipped a New
  button. Read-only is now a per-surface claim.
- **Deferred with written reasons**, not silently dropped: Operations Exceptions
  and Staff Attendance (outside the owner's enumerated scope, tagged "Deferred"
  rather than an invented phase number); the chatter rail (still gated on B0);
  and every escalation write plus the escalation list - the roadmap's own
  precondition (a verified domain DTO) was unmet, and `/api/approvals` is only
  partly branch-scoped (MP0-05).
- **New findings recorded, none implemented.** B3-F1: the Quick-PIN admin routes
  resolve by `{id, orgId}` only, so they are org-scoped and NOT branch-guarded
  (200 from a second branch). B3-F2: FU-1 confirmed live. B3-F3: leave and
  shift-swap creation are self-service only (403 for a manager acting on an
  employee's behalf).

Validated on an isolated local Docker Postgres stack (never shared Neon; both
`.env` files restored byte-for-byte, SHA-256 verified): web typecheck, lint and
production build pass; 15/15 assertion scripts; a live API matrix of 39/39;
Playwright `e2e/manager-operations/` and `e2e/manager-staff/` across four
viewports; 9 screenshots per viewport; per-surface request budgets measured;
`/api/health` returns ok. B4 (Reporting) has NOT started - do not begin it, or
any later Track B phase, without explicit authorization.

**Prior milestone (superseded above) - Backend gap batch 1 complete - Track C: C-02, MP0-10, MP0-09, C-01 (2026-08-20)
- A: BATCH COMPLETE / B3 UNBLOCKED ON C-02 / SHARED-NEON DEPLOY STILL GATED.**
The first owner-authorized Track C batch fixes four backend defects. No schema,
migration, seed or permission change; no frontend file touched; local dev DB only.

- **C-02 (NG-02 / MP0-01)** - new `apps/api/src/modules/hr/employee-projection.ts`.
  The DEFAULT payload on `GET /hr/employees`, `GET /hr/employees/:id`, the POST and
  PATCH echoes, and the employee embedded in `/hr/contracts` never *selects*
  `compensationProfile`, `dateOfBirth`, `address`, `emergencyContact*`, private
  `notes` or `metadata` from Postgres; `/:id` returns contracts with no salary
  field. `?view=full` restores the historical payload behind the PRE-EXISTING
  `pos:hr:compensation:read` (403 without it; an unknown `view` is a 400). Live:
  40 manager rows, zero forbidden keys. Caveat recorded honestly - the seeded role
  matrix grants that permission to Owner, MANAGER and Accountant, so a Manager can
  still opt in explicitly; narrowing the grant is a seed change and was NOT
  authorized (follow-up FU-1). B3's Staff directory is unblocked.
- **MP0-10** - the gross/net inversion was a labelling defect, not an aggregation
  bug: `Order.total = subtotal + tax - discount`, so `total` is tax-inclusive. Now
  `grossSales = SUM(order.total)` and `netSales = grossSales - taxTotal`, with the
  old ex-tax figure kept ADDITIVELY as `subtotalSales`; `gross = net + tax` implies
  `gross >= net`. Live: gross 28,107,000 -> 33,014,100, net 33,014,100 ->
  27,978,300. Applied to `/dash/today-summary`, `/dash/owner`, `/dash/manager`,
  `/stream/metrics`, `POST /dash/kpi/refresh` AND the SHIFT_END / DAILY_SALES report
  summaries through one `salesFigures()` helper, so the dashboard and the exported
  report cannot disagree.
- **MP0-09** - `/dash/open-orders` gains `total` (uncapped), `limit` and `truncated`
  from the SAME `where` clause the dashboards count with; `count` deliberately keeps
  its page-length meaning so the B2 Overview keeps working. Live: `total` 107 ==
  `/dash/manager.openOrders` 107 (was 50 vs 107). Use `total` for any number shown
  to a user.
- **C-01 (NG-01 / MP0-03)** - `format: PDF` now returns 501 before any artifact row
  is created; `generateTextPdf` is deleted; all 37 catalog entries advertise
  `['CSV']`; the BG6 `/api/exports` facade 501s too. No PDF renderer was added -
  OD-10 stays open. Artifacts created before 2026-08-20 keep their fake mime type.

Validated on an isolated local Docker Postgres stack (never shared Neon; both `.env`
files restored byte-for-byte, SHA-256 verified): API unit 1057/1061 (the 4 failures
are pre-existing, proven by re-running the same suites at `HEAD` in a throwaway git
worktree); `hr` e2e 25/25, `dashboards` + `reports` e2e 53/53; web typecheck pass,
14/14 assertion scripts, Playwright `manager-dashboard` 84/84, `manager-shell` 125
passed / 11 skipped, cross-role 36/36 (the B2 dashboard is untouched and still
passes); newman M19 55/55, M20 40/40, M23 39/39, BG6 46 assertions with 7
pre-existing AP failures; 56/56 collections parse; `/api/health` -> ok.

**New finding recorded as Track C `C-21`: 38 accounting routes are 403 for EVERY
role, including Owner.** accounts-payable (19 routes), accounts-receivable (10) and
budget (9) are guarded by 23 permission strings (`accounting:ap:*`,
`accounting:ar:*`, `finance:*`) that have ZERO rows in the permissions table (237
seeded). `pos:accounting:*` (17 rows) IS seeded, so accounting, ledger and bank-rec
are reachable. B5 must budget a permission/seed cutover before any AP/AR/Budget UI.

Deploying these fixes to shared Neon is still gated on the cutover authorization.
B3 and every other Track B phase remain NOT started. See
`ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) - Enterprise UI Track B2 complete - Manager Overview dashboard (2026-08-20)
- A: B2 COMPLETE / GATED FOR B3.** Frontend-only; no backend/schema/migration/
seed/permission/Postman change. `/manager/overview` graduates from the B1 honest
foundation screen to a real branch dashboard: the Odoo C10 journal-card pattern
rebuilt natively as a 3-column grid of EIGHT cards with a coloured left accent
bar - Sales today, Orders today, Payment mix, Open orders, Low stock, Needs a
decision, Shift and till coverage, Branch readiness - composed through the B1
chrome (`ManagerControlPanel` + `ManagerContentShell`; `ManagerSearchFilterMenu`
and `ManagerBreadcrumbs` stay unmounted because Overview has no record list).
New `components/manager/dashboard/*` plus
`lib/manager/dashboard-{types,model,api,context}.ts`.

Every rendered figure resolves through the 26-entry `MANAGER_KPI_BINDINGS`
registry, which binds it to a verified endpoint field AND a drill-in target; an
unregistered KPI THROWS rather than renders, and only the two till/shift KPIs may
lack a drill-in (each carrying a written reason, MP0-02). Boundaries reproduced
live on the isolated stack: the open count uses `/dash/manager.openOrders` (107),
never `/dash/open-orders.count` (50 = the capped page length, MP0-09, disclosed in
card copy); `netSales` 33,014,100 is greater than `grossSales` 28,107,000
(MP0-10), so both labels state the tax basis and no bare Gross/Net exists;
approval counts come from the four canonical branch-scoped domain endpoints
(`/pos/discounts/pending`, `/hr/leave`, `/hr/shift-swaps`,
`/analytics/anomalies`), never the partly org-scoped `/api/approvals` inbox
(MP0-05), bounded to `take=1`/`limit=1` and projected to count-only at the
API-client boundary so the leave/shift-swap PII payload never reaches React state
or the query cache (MP0-01); tills and shifts are counts with no list and no
drill-in. Overview decides nothing - counts link into the surface that owns the
decision.

Polled, not streamed: 60 s refetch with a permanent worded degraded state, and
there is NO SSE code anywhere (the assertion script fails if any appears) because
`EventSource` cannot carry `Authorization` + `X-Branch-Id` - MP0-07 / NG-14,
Track C-04. `POST /dash/kpi/refresh` sits behind the shared `ActionConfirmDialog`
plus an in-flight lock, then narrowly re-reads the nine dashboard keys, never the
whole `["manager"]` namespace. No charting dependency was added: three hand-rolled
token-driven SVG marks, each `role="img"` with `<title>` and `<desc>`, plus new
`chart-series-1..4` / `chart-track` tokens and two new canonical icon-registry
names (`revenue`, `inventory`). A real defect was found by this phase's own e2e
and fixed: M-P1's branch-switch `invalidateQueries` ran while the observers still
held the OUTGOING branch's keys and refetched them - 9 wasted requests per switch -
now `refetchType: "none"`. Foundation `liveFrom` badges were re-tagged from the
superseded M-P* numbering to the Track B phases (B3/B3/B4/B6).

Validated 2026-08-20: web typecheck, lint, and build pass; 14/14 assertion
scripts pass (new `manager-b2-assertions.ts`); Playwright executed live on an
isolated local Docker Postgres stack, never shared Neon - `e2e/manager-dashboard/`
84/84, `e2e/manager-shell/` 125 passed / 11 deliberately skipped,
`e2e/supervisor-prompt3/` 64/64, `e2e/cashier-floor` cross-role 48/48; 12 requests
measured for one clean Overview load (1 `/auth/me` + 2 shell readiness + 9
dashboard); five screenshots at 1440x900 and 1280x680 captured and viewed; zero
console errors; `GET /api/health` returns ok; the stack was torn down and both
`.env` files restored byte-for-byte. See
`ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`. NEXT = B3 (Operations + Staff)
and B0 (API verification, docs-only, parallel). Neither is started - do not begin
B3 or any later Track B phase without an explicit owner go.

**Prior milestone record (superseded above) - Enterprise UI Track B1 complete - Manager top-nav shell conversion (2026-08-20)
- A: B1 COMPLETE / GATED FOR B0+B2.** Frontend-only; no backend/schema/migration/
seed/permission/Postman change; no commit or push. Manager's presentation
converts from the M-P1 fixed bottom nav to an Odoo-style top module bar, shipped
as an ADDITIVE `OperationalShell` variant (`navigation="top" | "bottom"`, default
`"bottom"`) - never a Manager shell fork; the three frontline roles were verified
live to render byte-identically. New shared
`components/pos-shell/OperationalTopNav.tsx` plus `OperationalTopNavDropdown.tsx`
(click-to-open, full keyboard operation: roving-tabindex menubar, Escape/outside-
click/route-change close) are consumed by a thin `ManagerTopNav` adapter; the
retired M-P1 `ManagerHeader.tsx` and `ManagerBottomNav.tsx` were deleted. The six
locked M-P1 surfaces survive unchanged as the menu tree - Overview and Me stay
direct links; Operations, Staff, Reports, and Settings host dropdowns, each with
ONE real link to today's foundation page plus an honest, inert not-yet tree
tagged by phase (for example "Orders - B3"); Accounting is NOT a seventh menu
(OD-3 stays open, gated on B5). New reusable Manager chrome primitives
(`components/manager/chrome/`: `ManagerControlPanel`, `ManagerBreadcrumbs`,
`ManagerContentShell`, `ManagerSearchFilterMenu`) - B1 mounts only
`ManagerControlPanel` and `ManagerContentShell`, title-only, since no B1 surface
has data to back a create action, search, pager, or view switcher;
`ManagerSearchFilterMenu` and `ManagerBreadcrumbs` ship built but deliberately
unmounted (first consumed from B3). OD-4 answered with a recorded deviation: the
collapse breakpoint is `xl` (1280px), not the roadmap-suggested `lg` (1024px) -
the full bar does not reliably fit at 1024x768, so that project gets the
collapsed "Menu" control too, never falling back to the frontline bottom nav.
OD-5 needed no fallback - the shared shell absorbed the variant with one additive
prop. Validated: typecheck, lint, and build pass; 13 static assertion scripts
pass; Playwright executed live on an isolated local Docker Postgres stack (never
shared Neon) - `e2e/manager-shell/` 125/136 passed, 11 deliberately skipped
(desktop-only mechanics at the collapsed viewport, proven separately),
`e2e/supervisor-prompt3/` 64/64, `e2e/cashier-floor` cross-role regression 48/48;
8 screenshots at 1440x900 and 1280x680, zero console errors; isolated stack fully
torn down, `.env` files restored byte-for-byte. See
`ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`. NEXT = B0 (API verification,
parallel, docs-only) and B2 (Overview dashboard, gated on B1). Neither is
started - do not begin B2 or any later Track B phase without an explicit owner
go.

**Prior status record (superseded above) - Enterprise UI research complete; new
canonical roadmap adopted (2026-08-20) - documentation only.** The owner's live
Odoo instance was explored read-only (17
screenshots, no record created or edited) and written up as
`ai/ODOO_REFERENCE_RESEARCH.md`, then compared against this repo in
`ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` (20 typed gaps NG-01 to NG-20). Headline
finding: roughly 90 accounting/finance endpoints already exist with zero UI -
`accounts-payable`, `accounts-receivable`, `bank-rec` and `budget` are registered
and wired while `docs/MODULES.md` still marks them "Planned". Those routes were
found by STATIC SCAN ONLY and are claimed-by-code, unverified-at-runtime. The new
canonical plan is `ai/ENTERPRISE_UI_ROADMAP.md`: three tracks - A experience
polish (A0 shipped; A1 is the shared floor-toolbar wrap at 1024x768), B the
management suite (B0 API verification, B1 top-nav shell, B2 Overview, B3
Operations+Staff, B4 Reporting, B5 Accounting suite, B6 Settings, B7 Owner), and C
the true backend gaps C-01 to C-20 plus C-P carrying Cashier C4 to C6 forward
unchanged. Owner decision recorded in `docs/DECISIONS.md` as D-MGRTOPNAV:
management navigation switches to an Odoo-style TOP NAV BAR (module bar plus
click-to-open dropdown submenus, a control-panel row with New + title + chip search
+ server pager + view switcher, and breadcrumb + record pager). This SUPERSEDES the
M-P1 bottom-nav decision for Manager; Waiter, Cashier and Supervisor KEEP bottom
nav and must render byte-identically. Only the navigation presentation is
superseded - M-P1's shell, session guard, branch switcher, surface allow-list,
honest foundation pages and Manager Me all carry forward, and M-P0's findings
MP0-01 to MP0-18 remain in force. `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` is
superseded from M-P2 onward, with M-P0 and M-P1 history intact. No code, no
backend/schema/seed/permission/Postman change, no commit or push. Nothing in Track
B is implemented - do not begin B1 or any Track B phase without an explicit owner
go. Eleven open owner decisions OD-1 to OD-11 are recorded with recommendations;
OD-4 (sub-desktop collapse - never fall back to the frontline bottom nav) and OD-5
(additive `OperationalShell` variant versus a separate management shell) must be
answered at the start of B1.

**Manager reconstruction - Prompt M-P1 COMPLETE (2026-08-20) - A: M-P1 COMPLETE /
READY FOR M-P2.** The Manager workspace foundation is live and Manager is the
fourth consumer of the shared operational UI system, never a fork. Shipped
(frontend and docs only): `"manager"` added to `OperationalRole` and
`role-navigation.ts`; the locked six-tab nav Overview / Operations / Staff /
Reports / Settings / Me (no More tab, no Approvals tab) with landing
`/manager/overview` and a `/manager` redirect; six new canonical icon-registry
names (`overview`, `operations`, `staff`, `reports`, `settings`, `caretDown`);
`components/manager/shell/*` as thin adapters over `OperationalShell`,
`OperationalHeader`, `OperationalBottomNav`, and the shared idle handler;
`ManagerSessionGuard` sending non-manager users to `/login?reason=manager_only`;
and the branch switcher - the one genuinely new shell affordance - mounted through
a new OPTIONAL `OperationalHeaderContext.branchSwitcher` slot so the other three
role headers render byte-identically. Branch state resolves stored ->
`defaultBranchId` -> default-flagged -> first ACTIVE membership, persists at
`nimbus.managerBranchId` (deliberately separate from the station key
`nimbus.stationBranchId`), flows into `X-Branch-Id` through the existing
`apiRequest({ branchId })` parameter with no API-client change, and invalidates
only the `["manager", ...]` query namespace - never `queryClient.clear()`, never
auth or profile. `lib/manager/permissions.ts` is a SURFACE ALLOW-LIST, not a
permission check: the manager JWT holds 214 permissions including
`pos:hr:compensation:read`, `pos:hr:contracts:*`, and `approvals:decide`, all of
which the approved MVP forbids, so a `hasPermission()` UI would open
payroll-adjacent surfaces. Pages are six honest foundation screens with no
fabricated data, plus a real Manager Me built solely from the already-fetched
`/api/auth/me`. The readiness strip ships three verified chips only (Branch,
report generators from `GET /reports/catalog`, devices from `GET /devices`);
tills, shifts, and pending-approvals chips are omitted rather than faked because
`GET /api/tills` and `GET /api/shifts` do not exist and `/tills|shifts/active` are
operator-scoped. A fourth navy-family role accent was added
(`--color-role-manager` `oklch(0.36 0.06 324)`, white-on-solid 11.18:1). Validated
2026-08-20: web typecheck and lint pass (`next build` deliberately not run in the
dev QA sandbox and stated as such); `manager-p1-assertions.ts` plus 11 of 11
existing assertion scripts pass (`shell` and `profile` extended to four roles);
Playwright `e2e/manager-shell/` 92 of 92 across all four viewports; cross-role
regression 68 of 68; a live manager browse at 1440x900 and 1024x768 with the
`X-Branch-Id` change captured and persistence verified across reload; and Waiter,
Cashier, and Supervisor re-verified live as unchanged. No backend, schema,
migration, seed, permission, or Postman change, and no commit or push. M-P2
(Overview dashboard) is NOT started and must not be started without explicit
authorization. See `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md` and
`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`.

**Cashier Floor-First reconstruction - Prompt C3 COMPLETE (2026-08-20) - A: C3
COMPLETE / READY FOR C4.** The C2 read-only settlement workspace is now a working,
fail-closed payment and close surface, built as a mount rather than a rewrite. New
`components/cashier/floor/CashierSettlementActions.tsx` composes the
already-verified primitives (`CashierPaymentPanel` including
`CashierCloseOrderPanel`, and `CashierResolutionPanel` with the additive
`variant="split-only"` prop for split-bill plus split-items; the merge,
move-items, and transfer-table group is deliberately not mounted). New
`lib/cashier/settlement-mutations.ts` owns the only post-mutation refresh: it
awaits a canonical re-read of `orderDetail` plus `orderPayments` before showing any
result (no optimistic money), then narrowly invalidates `tableBills`, `floor`, the
`find-bills` prefix, and the Waiter/Supervisor Floor keys through the C2 key
factories - no broad sweep (9 requests measured after a close). Live behaviour:
cash settles and closes in one call at the single verified choke point
`POST /pos/orders/:id/close`; card, MTN, Airtel, and bank post manual references
(a final one auto-settles server-side); partial payment shows a canonical
remaining balance; split-bill records allocation metadata and split-items creates
a `NEW` child order that is correctly not payable; a CLOSED or VOIDED bill renders
no settlement control at all. Documented deviation: there is no standalone Close
button, because the backend has no zero-payment close (`CloseOrderDto.payments` is
`@ArrayMinSize(1)` and the order must be `SERVED` with the balance covered), so
close is reached through payment and the close panel states the real precondition.
Frontend-only - no backend, schema, migration, seed, permission, or Postman
change, and no commit or push. Validated 2026-08-20: web typecheck and lint pass
(`next build` deliberately not run in the QA sandbox); shell, floor, profile, C1,
C2, and the new C3 assertion scripts pass; Playwright `e2e/cashier-floor/` 192/192
(48 tests x 4 viewports) and cross-role regression 20/20, executed with real
payments and closes on an isolated disposable local Postgres; console and network
clean; 36 screenshots at 1440x900 and 1024x768. Six findings recorded and none
implemented (manual-reference accepts a payment on a CLOSED order; reservation
auto-completion does not fire on the cashier close path; `generateOrderNumber` can
500 on branch-prefixed demo numbers; cashier idempotency keys are not reused across
retries; sub-unit UGX split amounts; an ambiguous readiness-strip badge). C4 is NOT
started. See `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md`
and `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

**Rebrand + role UI QA wave COMPLETE (2026-08-20).** The Aug-2026 brand identity
is fully landed in `apps/web`: canonical navy/silver/graphite tokens (navy-900
`#000033` canonical), a new alpha-channel token system that fixed a pre-existing
app-wide defect where every `token/alpha` utility (all modal scrims) rendered
transparent, true-vector steering-wheel assets in `apps/web/public/brand/`, the
non-registry `NimbusLogomark` in the operational header and login hero, PWA/OG
metadata, and new canonical `docs/BRAND_IDENTITY.md`. Shared-component
accessibility fixes landed (Button `inverse` variant, header logout 2.71 to
20.48:1, disabled 3.62 to 8.51:1, a visible `focus-inverse` ring on navy surfaces,
navy scrims, two invisible-label fixes). Waiter, Cashier (within the C2 boundary -
nothing gated implemented), and Supervisor each got a full live QA pass at
1440x900 and 1024x768 on an isolated local Postgres 16 + WASM-Prisma stack (shared
Neon untouched), producing new canonical `docs/waiter-ui-docs/*` and
`docs/cashier-ui-docs/CASHIER_API_MATRIX.md` plus a live-verified
`SUPERVISOR_API_MATRIX.md`. Frontend and docs only - no backend, schema,
migration, seed, permission, or Postman change, and no commit or push. Validated
2026-08-20: web typecheck, lint, and production build all pass; ~180 QA
screenshots. Two apparent 500s (receipts GET, add-item POST) were QA-harness
artifacts (WASM Prisma Decimal class identity), fixed in the harness and
re-verified 200/201 - not product bugs. Nine open findings are recorded for the
owner and none were implemented. (That wave predates C3: Cashier was QA'd within
the C2 boundary and nothing gated was implemented at the time.) See
`ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`.

Cashier Floor-First reconstruction is complete through **C3**; **C4 is not
started**. Cashier nav is locked to Floor / Till / Me, default route
`/cashier/floor`, with Queue and Receipts kept as hidden compatibility routes
until later prompts (Receipts retires at C4, Queue at C5). C2 delivered
table-to-bill resolution, canonical `?tableId=&orderId=` state, the one
`CashierSettlementWorkspace`, and a bounded Cashier-only Find bill dialog; C3
delivered payment collection, partial payment, split settlement, and order close
inside that workspace. Do not implement receipt print/reprint/deliver, receipt
search, or refund execution, and do not retire Queue or Receipts, without explicit
authorization to proceed past C3.

Supervisor reconstruction is demo-ready with known limitations. Waiter is
complete and visually locked. Manager reconstruction is at M-P1, Track B1, Track
B2 and Track B3 COMPLETE: the shell, the Odoo-style top-nav menu tree, session
guard, branch switcher, Manager chrome primitives, a real Manager Me, the live
eight-card Overview dashboard, and the eight Operations + Staff surfaces are all
shipped. **Reports and Settings still carry only their honest foundation
screens** - their live data is B4 and B6. Per the 2026-08-20 owner decision the
Manager track is no longer blocked on Cashier C6, but B4 (Reporting) must not
start without explicit authorization.

## 6. Locked role boundaries

- Waiter: Floor / Reservations / Me. No Orders tab. No payment collection or
  order close.
- Cashier: Floor / Till / Me. Owns payment collection, till, close, and (later)
  receipts. Payment / partial / split / close execution is LIVE as of C3 inside
  `CashierSettlementWorkspace`; receipt actions and refunds are C4 and must not be
  started without explicit authorization. The merge / move-items / transfer-table
  handoff group stays off the Cashier Floor path, and no synthetic standalone Close
  control may be added (the backend has no zero-payment close).
- Supervisor: Floor / Reservations / Approvals / Me. Read-first oversight and
  approved supervisor actions only; no payment collection, order close, refund
  creation, or transfer-server UI without explicit authorization.
- Manager: Overview / Operations / Staff / Reports / Accounting / Settings / Me
  (SEVEN, not six, since 2026-08-21 - OD-3 approved and Accounting was inserted
  before Settings in Track B5.1; the "exactly six tabs" lock governed the
  BOTTOM-NAV presentation D-MGRTOPNAV superseded, never the number of modules), landing
  `/manager/overview`, presented as an Odoo-style TOP NAV BAR module bar (Track
  B1, 2026-08-20, owner decision `docs/DECISIONS.md` D-MGRTOPNAV - now
  implemented, superseding the M-P1 bottom-nav presentation). Overview and Me are
  direct links; Operations, Staff, Reports, and Settings host click-to-open
  dropdowns. Operations and Staff are now MODULES whose root redirects into real
  sub-routes (`/operations/{orders,tables,reservations}`,
  `/staff/{directory,onboarding,quick-pin,leave,shift-swaps}`); Reports and
  Settings still host one real link plus an honest not-yet tree. Waiter, Cashier
  and Supervisor keep bottom nav and render byte-identically. Branch-level
  oversight with a required header branch switcher that drives `X-Branch-Id` on
  every manager read. M-P1 and B1 shipped the shell/nav foundation, B2 the live
  Overview dashboard, and B3 the eight Operations + Staff surfaces - do not begin
  B4 (Reporting) or any later Track B phase, add an approval DECISION control to
  Overview, render a KPI that is not in `MANAGER_KPI_BINDINGS`, add an
  SSE/`EventSource` client (gated on C-04), add a charting dependency, fabricate a
  revenue trend (no bucketed series exists and `/dash/snapshots` needs
  `pos:dash:owner:read`, which Manager does not hold), take the open-order count
  from `/dash/open-orders.count`, read approval counts from the generic
  `/api/approvals` inbox, add a More/Approvals tab, change the landing route,
  convert `lib/manager/permissions.ts` into a `hasPermission()` check, add tills
  or shifts chips/lists (those routes do not exist), offer a PDF report export
  (the backend 501s on `format: PDF`), build a branch-profile edit form
  (`PATCH /branches/:id` does not exist), or add an EIGHTH top-nav module
  (Accounting as the seventh was approved under OD-3 and shipped in Track B5.1 on
  2026-08-21, superseding the earlier "OD-3 stays open, gated on B5" note here) -
  without explicit authorization.
- Manager Track B5.1 boundaries (2026-08-21): **Manager accounting is READ-ONLY BY
  PERMISSION** - 15 read strings, zero writes (PC-01/PC-02, re-verified live: 5 of 5
  representative writes returned 403). Do not add any write affordance to the
  accounting tree, not even a disabled one: the assertion script bans a write
  `method:`, `useMutation`, `<Button`, `onClick=` and `<form>` under
  `lib/accounting`, `components/manager/accounting`,
  `lib/manager/accounting-context.ts` and `pages/manager/accounting`, and it also
  fails if any mutation anywhere in the Manager tree names an accounting path. Do
  not add a menu row citing an endpoint absent from `ACCOUNTING_ROUTE_REGISTRY`, or
  one Manager is 403 on - such a surface is ABSENT, not a not-yet row (that is why
  Procurement suggestions has no row: PC-02). Do not offer any financial statement
  (balance sheet, P&L, cash flow, trial balance, general or partner ledger, tax or
  fiscal report) - no endpoint exists (NG-07 to C-11). Do not add a Receipts or
  Manual entries row - both endpoints are POST-only. Do not render a figure absent
  from `ACCOUNTING_KPI_BINDINGS` (it throws). Do not treat `ar/aging.summary` as a
  branch total without the completeness check - B5-F1: it aggregates only the
  RETURNED PAGE, so a bounded read understates the balance; the card withholds the
  figure unless `sum(accounts[].invoices.length) >= total`. Do not filter
  `ar/invoices` by a status outside
  `DRAFT|ISSUED|PARTIALLY_PAID|PAID|CANCELLED|CREDIT_ADJUSTED` - an invalid value
  returns 500 (B5-F2). Do not relabel `periods`, `period-close-runs`,
  `posting-source-maps` or `tax-config` as branch data - they are
  organisation-level by design. Do not bind a pager to, or fabricate a server
  `total` from, the bare-array routes (PC-06) - label them "Showing all N". Do not
  add a charting dependency or draw a time trend (no bucketed series exists -
  NG-05); the aging bucket bars are honest because the backend computes that series
  itself. B5.2 (Customers + Vendors lists), B5.3, B5.4, B5.5, B5.6, B6 and B7 are
  NOT started - do not begin any of them without explicit owner authorisation.
- Manager Track B3 boundaries (2026-08-20): **Operations is strictly read-only** -
  do not add any mutation, `useMutation` hook, checkout/tender/order-builder
  control, order close/void/discount, or table-status write to
  `components/manager/operations`. **Staff writes exactly four things**: frontline
  onboarding, Quick-PIN reset/disable/enable, leave review, and shift-swap
  REJECTION; the assertion script counts 7 allow-listed Manager mutations
  repo-wide and fails on an eighth. **Shift swaps are Outcome C - there is NO
  Approve control** and must not be one, because `scheduleAssignment` has no write
  path anywhere in the API (proven live: 3 roster rows before a real rejection, 3
  after). Never send `?view=full`, never call `GET /hr/employees/:id`, and never
  widen `lib/manager/staff-projection.ts` - it is an ALLOW-LIST, and `/hr/leave`
  and `/hr/shift-swaps` still embed full employee PII on the wire, so projection
  must stay at the API-client boundary rather than at render. Never persist, log,
  cache or URL-encode a one-time PIN. Do not claim a leave decision affects
  payroll or the roster. Do not build an escalation write without first verifying
  the domain DTO, or an escalation list from the partly org-scoped
  `/api/approvals` (MP0-05). Do not build the chatter rail (gated on B0) or a
  graph/pivot view (gated on C-03). Do not reinstate a workspace-wide "Read-only
  oversight" badge in the readiness strip - it is false over Staff; read-only is a
  per-surface claim. Do not "fix back" the B3-D1 sales KPI bindings:
  `grossSales` is tax-INCLUSIVE and `netSales = gross - tax` since backend gap
  batch 1.

Shared components are mandatory for equivalent UI concepts across roles:
`components/pos-shell`, `components/floor`, and `components/profile`. Do not fork
the shared Floor or reintroduce role-specific Floor component trees. Icons come
only from the canonical registry (`pos-shell/role-icon-config.ts` +
`role-icons.ts`) - never import Phosphor directly in routes or screens.
**Brand-mark exception (2026-08-20):** `pos-shell/NimbusLogomark.tsx` is the
Nimbus steering-wheel brand mark, not a UI icon, so it is deliberately NOT in the
icon registry; it renders inline SVG in `currentColor` and is mounted in
`BranchContextLabel` (44px header tile) and `login.tsx` (56px hero tile). This is
the only documented exception, not a licence to import glyphs directly. Brand
files live in `apps/web/public/brand/`; see `docs/BRAND_IDENTITY.md`.

### Backend gap batch 1 - do not undo (2026-08-20)

- Do not reintroduce a PDF export path (`format: PDF` returns 501; there is no
  renderer, OD-10 is still open) or re-advertise PDF in the report catalog.
- Do not widen the employee safe projection - `compensationProfile`, `dateOfBirth`,
  `address`, `emergencyContact*`, `notes` and `metadata` must stay off the default
  `/hr/employees` payload.
- Do not take an open-order COUNT from `/dash/open-orders.count` (page length) -
  use `total`.
- Do not reintroduce `grossSales = SUM(subtotal)` / `netSales = SUM(total)`.
- ~~Do not seed the missing `accounting:*` / `finance:*` permissions (C-21), change
  the Manager role's `pos:hr:compensation:read` grant (FU-1)~~ - both were DONE
  under owner authorisation on 2026-08-20 (permissions cutover). Do not deploy
  batch 1 or the cutover to shared Neon without the cutover gate.

### Permissions cutover - do not undo (2026-08-20)

- Do not remove any of the 36 seeded `accounting:ap:*`, `accounting:ar:*`,
  `pos:accounting:*` (bank-rec), `finance:*`, `franchise:forecast:read` or
  `procurement:advisory:read` rows. Do not re-derive the gap with a PREFIX match -
  that is exactly how the original count missed bank-rec's 11 strings and
  under-reported 36 as 23.
- Do not grant Manager ANY accounting write. The OD-9 resolution is Owner FULL,
  Accountant FULL, Manager READ-ONLY (15 strings). B5 must request the five OD-9
  writes explicitly (PC-01).
- Do not grant Manager `procurement:advisory:read` - it also gates the mutation
  `PATCH /finance/procurement-suggestions/:id/review` (PC-02), so it would hand
  Manager a write.
- Do not restore `pos:hr:compensation:read` to Manager (FU-1). Owner and
  Accountant keep it.
- Do not relax the Quick-PIN branch guard (B3-F1): cross-branch is 404, and a
  foreign `body.branchId` on reset is 400. Do not change the 404 to a 403 - a 403
  would confirm the id exists in another branch.
- Do not seed the 37 `franchise:*`, `ops:*`, `dev:*`, `merchant:*`, `billing:*`,
  `onboarding:*` or `support:*` strings (C-22). Those modules are deferred; B7
  must budget its own cutover.
- The formerly-red AP test now PASSES - keep it that way. In
  `accounts-payable.e2e-spec.ts`, "should return 409 when generating duplicate for
  same cycle" was left failing on purpose by B0 to document the correct contract;
  backend gap batch 2 fixed the source and it is green. Relaxing it to 200 would
  encode a duplicate-billing bug as the contract. Its two sibling cases - the
  next-period bill still returning 200, and a rewound `nextDueDate` returning 409 -
  guard the two halves of the guard and must not be deleted.

### Backend gap batch 2 is complete and must not be undone

- Do not widen any accounting `where` clause back to `orgId` alone. Use
  `branchOrOrgScope` / `strictBranchScope` from `apps/api/src/common/scope/`, and
  make a list and its detail sibling call the SAME helper.
- Do not make those helpers fail OPEN when no branch is resolved. The throw is the
  point; an org-wide fallback is exactly the PC-03 defect.
- Do not turn a cross-branch 404 into a 403 - a 403 confirms the id exists in
  another branch (the B3-F1 precedent).
- Do not use STRICT equality on a NULLABLE `branchId`; it orphans org-level rows
  from every branch at once. The repo's predicate is
  `OR: [{ branchId }, { branchId: null }]`.
- Do not invent a `branchId` for `FiscalPeriod`, `PostingSourceMap`,
  `TaxLedgerConfig` or `PeriodCloseRun`. Those are org-level BY DESIGN - the first
  three have no `branch_id` column at all, and the fourth is never stamped by the
  close path. B5 must LABEL them as organisation data, not "fix" them.
- Do not relax the PC-04 guard: a repeat generation must 409 while the legitimate
  next-period bill still returns 200.

### B5 boundaries set by B0 (verdict: GO, upgraded 2026-08-21)

`ai/ACCOUNTING_API_VERIFICATION_REPORT.md` is canonical.

- PC-03 is FIXED: `ap/suppliers`, `ap/credit-notes`, `ar/credit-notes`,
  `bank-statements` - and eleven further routes of the same class - are now
  genuinely branch-scoped. But DO label `accounting/periods`,
  `accounting/posting-source-maps`, `accounting/tax-config` and
  `accounting/period-close-runs` as ORGANISATION data; they are org-level by
  design.
- PC-04 is FIXED: a `Generate bill` control may now ship.
- Do not bind a C4 pager to a fabricated total on the ten list routes that return
  a bare array with no server `total` (PC-06, still open). Ship them as explicitly
  unpaginated instead.
- Manager still holds NO accounting write (PC-01), and is deliberately denied
  `procurement:advisory:read` because that string also gates a mutation (PC-02).
  B5 must request those explicitly.
- Do not call `/api/finance/forecast` - the route is `/api/franchise/forecast`.
- Do not read AR aging totals from `totals.grand*` - they are under `summary`
  (PC-05; the endpoint shape is unchanged).
- Model fiscal periods as DRAFT to OPEN to CLOSED to LOCKED, with no unlock route
  (PC-07).
- Ship journals READ-ONLY for Manager - the guides are live-verified correct
  (`journals:create`, `journals:reverse` and `posting:replay` all return 403).
  Note C-23: the M33 collection cannot run, so that surface has no Postman
  verification.

## 7. Worktree safety

- Run `git status` before edits.
- Never reset, restore, stash, clean, discard, or overwrite existing worktree
  changes unless the user explicitly asks.
- Do not commit or push unless explicitly asked.
- Prefer narrow, additive edits; preserve unrelated work.

## 8. Validation expectations

For frontend changes, run web typecheck, lint, and build before claiming the
phase complete. For backend/API contract changes, follow the mandatory milestone
order in `AGENTS.md`: DB -> service -> controller -> tests -> seed -> Postman ->
docs -> status -> completion report. Postman is mandatory for real API contract
changes.

Destructive or mutation QA must use an isolated disposable database, never shared
Neon production. Always report commands and failures honestly.

## 9. Claude + Codex synchronization rule

`CLAUDE.md` and `CODEX.md` are paired agent onboarding files. Whenever durable
project guidance changes in either file - status summaries, locked decisions,
paths, commands, role boundaries, validation expectations, governance rules, or
handoff notes - update the other file in the same change with the same facts,
adapted only for tool-specific wording. If a change intentionally applies to
only one agent, say why in the changed file so the other agent does not treat the
omission as drift.
