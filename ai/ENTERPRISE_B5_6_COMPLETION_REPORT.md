# ENTERPRISE UI TRACK B5.6 — COMPLETION REPORT

**Manager Accounting Configuration + Reporting (write-enabled) — 2026-08-22**

Status: **A — COMPLETE.** Frontend + a small, targeted backend fix (audit
metadata only — no schema/migration/seed/permission/DTO/contract-shape
change). Local commit on `main` only; no push.

---

## 0. Reconciliation — the 54 accounting/finance permission strings PERMS-2 granted Manager

Batch 4 (commit `dbb5e25`) granted Manager 54 accounting/finance permission
strings. The batch's own brief scoped this as "36" (the `C21_ACCOUNTING_FINANCE_ALL`
set). The remaining 18 were the M28/M29-era block, widened to match
Accountant/Owner in the same commit. Every string below was **live-verified**
against a Manager JWT issued by the isolated B5.6 QA stack (`manager@nimbus.demo`
login response, 2026-08-22) — the 54 strings in the token's `permissions[]`
array match this table exactly, no more, no fewer.

### Group (a) — the original 36 (`C21_ACCOUNTING_FINANCE_ALL`, `seed.ts:588-629`)

| # | Permission string | Gates |
|---|---|---|
| 1 | `accounting:ap:bill:read` | List/read vendor bills |
| 2 | `accounting:ap:bill:write` | Create/edit a vendor bill |
| 3 | `accounting:ap:bill:approve` | Approve a vendor bill |
| 4 | `accounting:ap:payment:write` | Record a supplier payment |
| 5 | `accounting:ap:credit-note:read` | List/read AP credit notes |
| 6 | `accounting:ap:credit-note:write` | Create/edit an AP credit note |
| 7 | `accounting:ap:recurring:read` | List/read AP recurring profiles |
| 8 | `accounting:ap:recurring:write` | Create/edit a recurring profile |
| 9 | `accounting:ap:reminder:read` | List/read AP payment reminders |
| 10 | `accounting:ap:reminder:write` | Create/edit a reminder |
| 11 | `accounting:ar:account:read` | List/read customer accounts |
| 12 | `accounting:ar:account:write` | Create/edit a customer account |
| 13 | `accounting:ar:invoice:read` | List/read AR invoices |
| 14 | `accounting:ar:invoice:write` | Create/edit an AR invoice |
| 15 | `accounting:ar:receipt:write` | Post a customer receipt |
| 16 | `accounting:ar:credit-note:read` | List/read AR credit notes |
| 17 | `accounting:ar:credit-note:write` | Create/edit an AR credit note |
| 18 | `accounting:ar:aging:read` | Read the AR aging report |
| 19 | `pos:accounting:bank-accounts:read` | List/read bank accounts |
| 20 | `pos:accounting:bank-accounts:create` | Create a bank account |
| 21 | `pos:accounting:bank-statements:read` | List/read bank statements |
| 22 | `pos:accounting:bank-statements:import` | Import a bank statement |
| 23 | `pos:accounting:bank-entry:create` | Create a manual bank entry |
| 24 | `pos:accounting:reconciliation:read` | List/read reconciliations |
| 25 | `pos:accounting:reconciliation:create` | Start a reconciliation |
| 26 | `pos:accounting:reconciliation:match` | Match/skip/complete a reconciliation |
| 27 | `pos:accounting:period-close-runs:read` | List/read period close runs |
| 28 | `pos:accounting:periods:close` | Close a fiscal period |
| 29 | `pos:accounting:periods:lock` | Lock a fiscal period |
| 30 | `finance:budget:read` | List/read budgets |
| 31 | `finance:budget:write` | **B5.6: create a budget** |
| 32 | `finance:budget:update-actuals` | **B5.6: refresh a budget's actuals** |
| 33 | `finance:demand-calendar:read` | List/read demand calendar entries |
| 34 | `finance:demand-calendar:write` | **B5.6: create/edit/archive a demand calendar entry** |
| 35 | `franchise:forecast:read` | **B5.6: read + refresh the forecast** |
| 36 | `procurement:advisory:read` | Read procurement suggestions (also gates the review PATCH — PC-02) |

### Group (b) — the M28/M29 block widened to match Accountant/Owner (`seed.ts:1129-1147`)

| # | Permission string | Gates | Why Manager needs it |
|---|---|---|---|
| 37 | `pos:accounting:accounts:read` | List the chart of accounts | Manager owns branch financial oversight; reading the GL structure is a precondition for every other accounting read. |
| 38 | `pos:accounting:accounts:create` | **B5.6: create a GL account** | Manager needs to add accounts as the business grows (new revenue/expense lines) without waiting on Accountant. |
| 39 | `pos:accounting:cost-centers:read` | List cost centres | Same oversight rationale as accounts. |
| 40 | `pos:accounting:cost-centers:create` | **B5.6: create a cost centre** | Manager organises branch departments (kitchen, bar, events) as cost centres for budget attribution. |
| 41 | `pos:accounting:periods:read` | List fiscal periods | Needed to know which period a transaction lands in. |
| 42 | `pos:accounting:periods:create` | Create a fiscal period (C-27, pre-existing, not newly exposed by this phase's UI) | Manager plans the fiscal calendar for their branch(es). |
| 43 | `pos:accounting:periods:open` | Open a fiscal period | Manager starts a new accounting period for their branch. |
| 44 | `pos:accounting:posting-source-maps:read` | List posting source maps | Precondition for editing them. |
| 45 | `pos:accounting:posting-source-maps:update` | **B5.6: edit a posting source map** | Manager owns which GL accounts a POS event (sale, refund, payroll) posts to for their branch's chart. |
| 46 | `pos:accounting:tax-config:read` | Read tax ledger config | Precondition for editing it. |
| 47 | `pos:accounting:tax-config:update` | **B5.6: edit tax configuration** | Manager owns the branch's tax GL mapping. |
| 48 | `pos:accounting:journals:read` | List/read journal entries | Oversight of the GL. |
| 49 | `pos:accounting:journals:create` | Create a journal entry | Manual GL correction authority — not exposed by any UI yet (Track B5.7). |
| 50 | `pos:accounting:journals:reverse` | Reverse a journal entry | Same — not yet exposed. |
| 51 | `pos:accounting:posting:replay` | Replay a failed posting run | Same — not yet exposed. |
| 52 | `pos:accounting:posting-runs:read` | List posting runs | Oversight of the posting engine. |
| 53 | `pos:accounting:posting-errors:read` | List posting errors | Oversight of posting failures. |
| 54 | `pos:accounting:posting-errors:resolve` | Resolve/dismiss a posting error (B5.4-D1, new endpoint) | Manager owns closing out posting failures for their branch — not yet exposed by any UI (Track B5.7). |

**`pos:hr:compensation:read` re-confirmed absent**: grepped the live Manager
token's `permissions[]` array from the isolated stack login (2026-08-22) —
the string does not appear. FU-1 (2026-08-20) stands unmodified by PERMS-2 or
this phase.

**No group-(b) string gates anything outside accounting/finance.** All 18 are
`pos:accounting:*` or `finance:*`/`franchise:forecast:read`/`pos:hr` is
absent — confirmed by inspection of every permission's description in
`seed.ts`. No stop-and-report condition was triggered.

Of the 18 group-(b) strings, **B5.6 built UI for exactly 5** (37, 39, 44, 46,
plus the create actions at 38, 40, 45, 47 — i.e. Chart of accounts, Cost
centres, Posting source maps, Tax configuration reads+writes). The remaining
13 (periods create/open, journals create/reverse, posting replay, posting-run
read, posting-error read/resolve) are **out of this phase's 7-surface scope**
and remain either read-only via existing B5.4/B5.5 surfaces or entirely
unexposed pending Track B5.7.

---

## 1. Scope — `lib/accounting/menu.ts` is the scope authority

Before this phase: **21 of 28** menu rows live, 7 tagged `B5.6` (not-yet).
After this phase: **28 of 28** menu rows live — every row in `ACCOUNTING_MENU`.
No row was left dark; all 7 were built:

| Row | Group | Surface built |
|---|---|---|
| Budgets vs actuals | Reporting | List + create form (dynamic line items) + Refresh actuals action |
| Demand calendar | Reporting | List + create + edit + Archive (confirm-gated) |
| Forecast | Reporting | View (cached run + demand signals/daypart summaries + procurement suggestions) + Refresh action |
| Chart of accounts | Configuration | List (org-level) + Create |
| Cost centres | Configuration | List (org-level) + Create |
| Posting source maps | Configuration | List (org-level) + Edit (no create — seed/system rows) |
| Tax configuration | Configuration | Singleton view (honest 404-if-unconfigured state) + Edit (upsert) |

## 2. UI rules

- Every screen composes `ManagerContentShell` + `ManagerControlPanel` +
  `ManagerListTable` — no forked chrome. One additive shared file was created,
  `components/manager/accounting/shared/AccountingWriteFormControls.tsx`
  (`AccountingTextField`/`AccountingSelectField`/`AccountingCheckboxField`/
  `AccountingFormError`/`AccountingFormPanel`) — presentation-only (no
  `onClick`/`<Button>`/mutation), so it needed no allow-listing in the write
  ban and is reusable by any future write-enabled surface.
- Every create/edit form is hosted inside the existing `ActionConfirmDialog`
  (title/consequence/pending/error/confirmDisabled), matching the
  Odoo-control-panel pattern already established (`New` button + title, no
  chip search or pager on these 7 surfaces — none of them has a text-search
  parameter or a real server total to bind a pager to).
- Design tokens only — no raw hex; every colour is a `Badge`/`Button` variant
  or an existing Tailwind token class. No new `-ch` channel triplet was
  needed (no new alpha-blended surface was introduced).
- Spacing is all Tailwind spacing-scale utilities (`gap-4`, `p-5`, `mt-3`, …),
  never a raw px arbitrary value — verified by grep (`grep -rn "\[.*px\]"`
  found zero matches in any B5.6 file).
- Every form has: validation states (create/edit `confirmDisabled` bound to a
  real validity check — `isDemandCalendarWindowValid`, `isPostingSourceMapValid`,
  required-field presence), a disabled/submitting state (`pending` prop,
  "Working…" label), an error state (`AccountingFormError`/dialog `error`
  prop), and an empty state for its list (`ManagerListTable`'s own
  `emptyTitle`/`emptyMessage`, worded per surface).

## 3. Write paths + the C-26-class audit gap this phase found and fixed

**Finding, before this phase started:** none of the 13 audit.log call sites
across `budget.service.ts`, `demand-calendar.service.ts`, `forecast.service.ts`
and `accounting.service.ts` stamped `metadata.branchId` — the identical
C-26 defect class Track B5.4 found (and left disclosed-but-unfixed) in
`ledger.service.ts`. Because this phase's surfaces are genuinely
write-enabled, the task explicitly required this be a real fix, not another
disclosure.

**Fixed — 9 audit actions across 4 backend files, all live-proven on the
isolated stack:**

| Action | File | branchId source |
|---|---|---|
| `ACCOUNT_CREATED` | `accounting.service.ts` | `ctx.branchId` (already threaded) |
| `COST_CENTER_CREATED` | `accounting.service.ts` | `ctx.branchId` |
| `POSTING_SOURCE_MAP_UPDATED` | `accounting.service.ts` | **new** `actingBranchId` param threaded from controller's `branchContext.branchId` — `updatePostingSourceMap` previously took only `orgId`, no branch at all (the entity itself is genuinely org-level; this records which branch context the acting Manager was in, for audit discoverability, without touching the `where` clause) |
| `TAX_LEDGER_CONFIG_UPDATED` | `accounting.service.ts` | same pattern, new `actingBranchId` param |
| `DEMAND_CALENDAR_CREATED` | `demand-calendar.service.ts` | `ctx.branchId` (already threaded) |
| `DEMAND_CALENDAR_UPDATED` | `demand-calendar.service.ts` | `ctx.branchId` |
| `BUDGET_CREATED` | `budget.service.ts` | `ctx.branchId` |
| `BUDGET_ACTUALS_REFRESHED` | `budget.service.ts` | `ctx.branchId` |
| `FORECAST_RUN_CREATED` | `forecast.service.ts` | `ctx.branchId` (null for FRANCHISE-type runs, matching the existing branchId-nullability convention elsewhere in this same file) |

**Live-proven** (isolated B5.6 QA stack, `psql` query against `audit_logs`):
every one of these 9 actions, freshly created via the live API with a Manager
token, produced a row with `metadata->>'branchId' = 'cb27be401a2c35dfc0d4e610'`
(the acting branch) — see §"Live detail/edit route checks" below for the raw
output. Two historical `FORECAST_RUN_CREATED` rows created *before* the
`forecast.service.ts` fix (earlier in the same QA session) correctly still
show `branchId: NULL` — not backfilled, matching the B5-F4/C-26 precedent of
never rewriting history.

**Unit test proof** (not just live proof): `accounting.service.spec.ts`,
`budget.service.spec.ts` and `demand-calendar.service.spec.ts` each gained a
`metadata: expect.objectContaining({ branchId: … })` assertion on the
existing create/update tests for `ACCOUNT_CREATED`, `COST_CENTER_CREATED`,
`POSTING_SOURCE_MAP_UPDATED`, `TAX_LEDGER_CONFIG_UPDATED`, `BUDGET_CREATED`,
`DEMAND_CALENDAR_CREATED` — 6 of the 9 actions. `BUDGET_ACTUALS_REFRESHED`
and `FORECAST_RUN_CREATED` are proven live only (no unit-test fixture existed
for `updateActuals`'s audit call or for `generateForecast` at all — adding a
full mock harness for the latter was judged not worth the time against the
live proof already in hand; disclosed here rather than silently skipped).

**Procurement-suggestion review's audit call was deliberately NOT touched** —
that action belongs to a surface (Procurement suggestions) this phase does
not build (see §1); fixing it here would be scope creep into an area with no
UI to validate the fix against.

**CLAUDE.md §15 discipline**: every mutation invalidates only its own
surface's query-key prefix (`managerQueryKey("accounting-<surface>-list", branchId)`)
— never a blanket `["manager"]` sweep. Reads are NOT polled
(`refetchInterval: false` on every B5.6 query) — a list a manager is actively
editing must not reshuffle under them.

**Confirm-before-destroy**: the one destructive action this phase offers
(Demand calendar Archive) is gated behind `ActionConfirmDialog` naming the
entry and the exact consequence (`isActive: false`, not deleted, reactivatable).
No hard `DELETE` is ever issued by this module — proven by a repo-wide grep
(`method: "DELETE"` — zero matches in `lib/accounting/write-api.ts`) and by a
Playwright assertion (`configuration-and-reporting.spec.ts`).

## 4. The `detailRequest`-class regression check — live browser statuses

Every new detail/edit-capable route was loaded in a **real Chrome browser**
(via `claude-in-chrome`, isolated stack, Manager login) — not inferred from a
passing test suite, per the explicit lesson from B5.2's double-id bug.
Observed HTTP status per request, captured via the browser's own network
panel:

| Route / action | Method | Observed status |
|---|---|---|
| `GET /finance/budgets` | GET | **200** |
| `GET /finance/budgets/:id` | GET | **200** (curl-verified; not separately surfaced by a distinct URL in the UI) |
| `POST /finance/budgets` | POST | **201** (curl) |
| `POST /finance/budgets/:id/update-actuals` | POST | **200** (curl) |
| `GET /finance/demand-calendar` | GET | **200** |
| `GET /finance/demand-calendar/:id` | GET | **200** (curl) |
| `POST /finance/demand-calendar` | POST | **201** (curl) |
| `PATCH /finance/demand-calendar/:id` | PATCH | **200** (browser — reactivated a QA entry live, list re-fetched and updated on screen) |
| `GET /franchise/forecast` | GET | **200** |
| `GET /franchise/forecast?refresh=true` | GET | **200** (curl) |
| `GET /accounting/accounts` | GET | **200** |
| `POST /accounting/accounts` | POST | **201** (curl) |
| `GET /accounting/cost-centers` | GET | **200** |
| `POST /accounting/cost-centers` | POST | **201** (curl) |
| `GET /accounting/posting-source-maps` | GET | **200** |
| `PATCH /accounting/posting-source-maps/:id` | PATCH | **200** (curl) |
| `GET /accounting/tax-config` | GET | **200** |
| `PATCH /accounting/tax-config` | PATCH | **200** (curl) |

The browser network panel also confirmed the demand-calendar edit dialog
**correctly prefilled every field** from the fetched record (title, calendar
type, daypart, dates, Active checkbox reflecting `isActive: false`) before any
edit — the exact failure mode B5.2's bug produced (a malformed request that
still rendered a plausible-looking screen). No such defect was found here.
Zero console errors were observed across every page load and every dialog
interaction in the browser session.

## 5. Backend

**No new endpoint was needed anywhere in this phase.** Every read and write
route the 7 surfaces call already existed and was already reachable by
Manager after PERMS-2 (confirmed in §0/§9). The only backend changes are the
9 audit-metadata fixes in §3 (source + unit test files only — no schema, no
migration, no seed, no permission, no DTO, no Postman-contract change).

## 6. Named pre-existing API unit test failures

Full `apps/api` Jest suite (`npx jest --silent`, isolated from any DB —
these are pure-mock unit specs): **1181 tests, 1177 passed, 4 failed**, all 4
in a single file, all pre-existing and unrelated to this phase (nothing in
`client-onboarding` was touched):

- **File**: `apps/api/src/modules/client-onboarding/client-onboarding.service.spec.ts`
- **Failing tests** (all 4, identical root cause):
  1. `ClientOnboardingService › createInvitations › creates User + Membership + UserRole and returns tempPassword for new invitee`
  2. `ClientOnboardingService › createInvitations › reuses existing user and marks as ALREADY_MEMBER if membership exists`
  3. `ClientOnboardingService › checkAutoComplete (via createInvitations) › sets completedAt when all 7 steps COMPLETED`
  4. `ClientOnboardingService › checkAutoComplete (via createInvitations) › does NOT set completedAt when steps remain`
- **Failure message** (identical for all 4): `TypeError: Cannot read properties of undefined (reading 'updateMany')` at `client-onboarding.service.ts:357`, inside `ClientOnboardingService.inviteOne()`.
- **Read on the cause**: the spec's local `makePrisma()` mock factory
  (`client-onboarding.service.spec.ts:11-31`) enumerates mocks for
  `membership`, `onboardingProgress`, `organization`, `branch`, `subscription`,
  `user`, `userRole` and `role` — but never for `invitation`. `inviteOne()`
  calls `this.prisma.invitation.updateMany(...)` (to expire a prior PENDING
  invite for the same email before creating a new one) — a call the service
  makes that the test's own mock object was never updated to include. This
  reads as a **test-fixture drift bug**: the mock factory fell out of sync
  with the service it exercises, not a defect in `inviteOne()`'s own logic.
  Not fixed here, per instruction.

## Standing-rules compliance

- Never ran `pkill`; every process this pass spawned was tracked by PID
  (API `26957` → restarted as `29043` after the audit-branchId fix; web
  `27509`) and killed individually at teardown. No process this pass did not
  start was touched — the pre-existing `apps/api` dev server (port `3001`,
  a different PID) was verified healthy before and after via `/api/health`.
- No lint script ran with `--fix` — `npx eslint <files>` only, and the two
  real prettier errors it found (long single-line object literals introduced
  by the branchId edits) were reformatted by hand.
- Isolated local Docker Postgres 16, container `nimbus-b56-qa`, port `55480`
  (non-default), database `nimbus_b56_qa`. Isolated API on port `4091`,
  isolated web on port `3180`. **Shared Neon was never connected to or
  written** — the isolated API held exactly 1 (later 6, post-restart)
  established TCP connections, every one to `localhost:55480`, verified via
  `lsof` against the API's own PID both before and after the audit-fix
  restart.
- `packages/db/.env` was temporarily swapped for the three Prisma CLI steps
  only (`migrate deploy` → `db:seed` → `db:demo:import`) and restored
  immediately after — SHA-256 verified byte-identical to the pre-swap
  baseline: `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75`.
  `apps/api/.env` was **never edited on disk** — isolation was achieved by
  passing `DATABASE_URL`/`DIRECT_DATABASE_URL`/`API_PORT`/`API_CORS_ORIGINS`
  directly into the spawning shell's environment (dotenv never overrides an
  already-set env var) — SHA-256 trivially identical throughout:
  `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b`.
- `next build` was run only while confirming no `apps/web` dev server for
  *this* project was active (a `next-server` process found running belonged
  to an unrelated project, `Nimbus Comms`, on a different port — verified via
  `lsof`/`cwd` before proceeding).
- No `git push`. Local commit only, on `main`.

## Validation gate

- **Web typecheck**: `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` — clean.
- **Web lint**: `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` — "No ESLint warnings or errors".
- **Web build**: `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` — succeeds; all 7 new pages listed in the route manifest (`/manager/accounting/reporting/{budgets,demand-calendar,forecast}`, `/manager/accounting/configuration/{chart-of-accounts,cost-centres,posting-source-maps,tax-config}`).
- **API typecheck**: `tsc --noEmit -p apps/api` — clean.
- **API lint** (targeted, no `--fix`): 0 errors on every touched file (pre-existing `no-explicit-any` warnings only, same file, unrelated to this phase's edits).
- **API unit suite**: 1177/1181 passed — the 4 named in §6, proven pre-existing.
- **`scripts/manager-b5-assertions.ts`**: extended with a new §16 (write-registry hygiene, the 3-file/7-screen write-enabled allow-list closing exactly, model-helper unit assertions, no-hard-DELETE sweep, confirm-before-destroy sweep, 28/28 menu-row assertion) — passes, alongside all pre-existing §1–§15 checks (re-scoped, not weakened, for the 10 files now permitted to write).
- **All 17 `apps/web/scripts/*-assertions.ts` scripts**: pass.
- **`git diff --check`**: clean.
- **Playwright, isolated stack** (`PW_BASE_URL=http://localhost:3180 PW_API_URL=http://localhost:4091`):
  - New `e2e/manager-accounting/configuration-and-reporting.spec.ts` (22 specs) + updated `menu-and-read-only.spec.ts` (28-row count) — **117 passed / 3 skipped / 0 failed** across all 4 viewport projects (the 3 skips are the pre-existing "desktop dropdown only at `xl`" skip class, not a B5.6 gap).
  - Full `e2e/manager-accounting/` regression at `vp-1440x900` (all pre-existing B5.1–B5.5 specs plus the new ones) — **109 passed / 11 skipped / 0 failed** — B5.1–B5.5 surfaces all still load and pass unmodified.
  - `e2e/manager-shell/` cross-role + navigation + keyboard regression at `vp-1440x900` — **34/34 passed**.
- **Cross-role, both API and browser**: Waiter/Cashier/Supervisor tokens all **403** on every one of the 7 B5.6 GET routes and on a representative write (`POST /accounting/cost-centers`) — verified via direct `curl`. Supervisor's browser session shows no Accounting nav entry at all, and direct navigation to `/manager/accounting/reporting/budgets` is blocked client-side ("Manager access required") in addition to the server-side 403 — the nav hiding is not the only gate.
- **Zero console errors** on every new route, observed live in a real browser session (not inferred).

## Files changed

**Backend** (audit-metadata fix only): `apps/api/src/modules/accounting/accounting.controller.ts`,
`apps/api/src/modules/accounting/accounting.service.ts`,
`apps/api/src/modules/accounting/accounting.service.spec.ts`,
`apps/api/src/modules/budget/budget.service.ts`,
`apps/api/src/modules/budget/budget.service.spec.ts`,
`apps/api/src/modules/budget/demand-calendar.service.ts`,
`apps/api/src/modules/budget/demand-calendar.service.spec.ts`,
`apps/api/src/modules/budget/forecast.service.ts`.

**Frontend — new**: `apps/web/src/lib/accounting/write-api.ts`,
`apps/web/src/lib/manager/accounting-configuration-queries.ts`,
`apps/web/src/components/manager/accounting/shared/AccountingWriteFormControls.tsx`,
`apps/web/src/components/manager/accounting/reporting/{BudgetsScreen,DemandCalendarScreen,ForecastScreen}.tsx`,
`apps/web/src/components/manager/accounting/configuration/{ChartOfAccountsScreen,CostCentresScreen,PostingSourceMapsScreen,TaxConfigScreen}.tsx`,
7 new page files under `apps/web/src/pages/manager/accounting/{reporting,configuration}/`,
`apps/web/e2e/manager-accounting/configuration-and-reporting.spec.ts`.

**Frontend — edited**: `apps/web/src/lib/accounting/{types,routes,route-registry,model,menu}.ts`,
`apps/web/src/components/manager/accounting/shared/index.ts`,
`apps/web/scripts/manager-b5-assertions.ts`,
`apps/web/e2e/manager-accounting/{fixtures,menu-and-read-only}.spec.ts`.

**B5.6, B5.7 (write-UI for B5.1–B5.5's still-read-only surfaces), and B7 remain governed by
`ai/ENTERPRISE_UI_ROADMAP.md`. B5.7 is NOT started — do not begin it without explicit owner
authorisation.**
