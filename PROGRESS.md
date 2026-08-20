# PROGRESS.md — Nimbus POS

> Concise canonical progress index. The detailed live tracker is
> **`ai/AI_STATUS.md`** (its top-of-file "Current State" is authoritative).
> This file summarises where the project stands and links to the evidence.

**PERMISSIONS CUTOVER COMPLETE — C-21 · FU-1 · B3-F1 + Track B0 (2026-08-20) — A: COMPLETE / B5
CONDITIONAL GO / SHARED-NEON DEPLOY GATED.** Backend + **seed data** only; **no Prisma schema
change, no migration, no `demo-import.ts` change, no frontend file touched**. Validated on an
isolated local Docker Postgres stack (`:55432`, API `:4011`, web `:3111`) — **shared Neon was never
connected to or written**, and **neither `.env` was modified** (SHA-256 identical before and after;
isolation achieved by constructing the child-process environment explicitly).
**C-21 — the gap was 36 permission strings over 56 routes, not the 23 previously recorded.** The
earlier count was a **prefix** check, not a string check: `bank-rec` references **11**
`pos:accounting:*` strings that share the prefix with the seeded M28/M29 rows but are themselves
absent, and `budget` references two strings outside the `finance:` prefix. Measured live before the
change, **all 6 bank-rec GET routes returned 403 to Owner** — the prior claim that "`accounting`,
`ledger` and `bank-rec` are fine" was wrong. All 36 are now seeded with route-accurate descriptions.
**OD-9 is resolved with the owner's stated default, and the reasoning is recorded in the seed:**
OD-9 conditioned Manager's writes on "B0 proving the permission is held", which is unsatisfiable —
B0 can only observe what the seed grants. Grants are therefore **Owner FULL (36) · Accountant FULL
(36) · Manager READ-ONLY (15) · nobody else**. Verified live: Manager 200 on 25 of 26 accounting
GETs, **403 on all 16 write attempts**; Supervisor 403 on all 36. ⚠️ **`procurement:advisory:read`
is deliberately withheld from Manager** — that one string gates both a read **and** the mutation
`PATCH /finance/procurement-suggestions/:id/review` (**PC-02**), so granting the read would have
granted a write.
**Seed idempotence proven three ways:** run twice (36/87/1 → **0/0/0**, identical content hashes);
a **greenfield** seed converging on the identical `c2b602ce…` hash at **273 permissions / 922
grants**; and a repair run recreating exactly 56 deliberately-deleted rows.
**FU-1 — `pos:hr:compensation:read` REVOKED from Manager** (Owner + Accountant keep it), enforcing
the locked "compensation excluded from the Manager MVP" decision **at the wire** instead of relying
on the frontend not to ask. Live before → after: Manager `?view=full` **200 → 403** (list *and*
detail), `/hr/compensation-profiles` **200 → 403**; the default safe read is unchanged. Because
`seedRolePermissions` only inserts, `revokeStaleWaiterPermissions` was generalised into a
declarative `REVOKED_ROLE_PERMISSIONS` table + `revokeStaleRolePermissions()`.
**B3-F1 — Quick-PIN admin routes are now branch-guarded.** `loadEmployeeForOrg` →
`loadEmployeeForBranch` (org **and** branch, mirroring shift-swap approve), failing **closed** twice
over: a cross-branch target returns **404** (never a 403 that would confirm the id exists
elsewhere), and a **NULL-branch** employee is refused too. Live before → after: cross-branch
status/disable/enable **200 → 404**. ⚠️ **A second escape not in the original write-up was found and
closed:** `reset()` accepted `body.branchId` and fed it straight into the Quick PIN lookup hash, so
a caller could mint a PIN scoped to a branch they are not acting in — now **400**. **Onboarding does
NOT share the gap** (checked: it takes the branch from `ctx.branchId` only).
⚠️ **A hollow test was found and fixed:** the first B3-F1 e2e *looked for* a second-branch employee
and self-skipped when the dataset had none — the suite went green while proving nothing. The fixture
is now **created** through the public onboarding API, and the re-run is **19/19 with 0 skips**,
including a control proving the same id resolves 200 once `X-Branch-Id` names its own branch.
**B0 folded in and COMPLETE → `ai/ACCOUNTING_API_VERIFICATION_REPORT.md`.** 112 routes extracted and
**reconciled against the API's own `RouterExplorer` boot log** (0 unmapped, 0 missed — which is how
a parser defect was caught: `budget.controller.ts` declares **three** `@Controller` classes and the
forecast route is **`/api/franchise/forecast`**). The 75-route accounting block was verified live
across four roles with **25 live writes**, including a bank reconciliation taken to `COMPLETED` and
a fiscal period taken `DRAFT → OPEN → CLOSED → LOCKED` (**PC-07** — four states, no unlock route).
The clearest measure of what C-21 unblocked: the AP+AR e2e suites went from **69 failed / 20 passed**
in the pre-cutover permission state to **1 failed / 88 passed** after.
🔴 **B5 is 🟡 CONDITIONAL GO**, blocking on **PC-03** — `ap/suppliers`, `ap/credit-notes`,
`ar/credit-notes` and `bank-statements` return **another branch's rows** regardless of
`X-Branch-Id` (9 of 34 list/get methods filter on `orgId` only; `bank-statements` and
`posting-errors` are list/detail-inconsistent) — and **PC-04** — AP recurring-bill duplicate
prevention is **dead code** (the guard compares `lastBill.dueDate === profile.nextDueDate` but the
same transaction advances `nextDueDate`), so a second call issues a **second bill for the same
supplier**. Its e2e test is **deliberately left red** to document the correct contract; do not
"fix" it to expect 200. Also **PC-06** (ten list routes return a bare array with no server `total`,
which the C4 pager contract cannot bind to) and **PC-01** (Manager holds no accounting write).
🔴 **New finding C-22: 37 further guard permissions still have no seeded row** — `franchise:*` (12),
`ops:*` (8), `dev:*` (5), `merchant:*` (4), `billing:*` (3), `onboarding:*` (2), `support:*` (2) —
so franchise, ops-portal, developer-portal and owner-SaaS-billing are 403 for every role exactly as
accounting was. **Deliberately not seeded** (all deferred modules); **B7 must budget the same
cutover.**
**Postman:** three stale collections were repaired — M34 sent `paymentTermsDays` (the DTO field is
`paymentTermDays`; the whitelist 400'd and cascaded into 10 downstream 404s), M35 asserted the
renamed `totals.grand*` instead of `summary.*` (**PC-05**), and M37's two procurement-review requests
now carry **R11 honest-skip guards** so an empty dataset can never read as a verified route. On a
from-scratch database: **85 requests, 0 request failures; 166/168 assertions pass**, the 2 being
those deliberate skip markers. **56/56 collections parse** (3 carry a pre-existing BOM).
**Validation:** API unit **1057 passed / 4 failed** — the 4 **proven pre-existing** by re-running the
same two suites at `30c67aa` in a throwaway worktree (identical failures, identical test names);
API e2e **272/273** (the 1 is PC-04); web typecheck + lint + build pass; **16/16** assertion scripts;
Playwright `manager-shell` **125/11 skipped** and `manager-dashboard` **84/84** — both matching their
B1/B2 baselines exactly — plus `manager-staff` **106 passed / 26 skipped**, `manager-reports` **151 passed / 1
skipped** and `manager-operations` **160/160**; `/api/health` → ok; `git diff --check` clean.
⚠️ **Disclosed:** three Playwright runs were invalidated by the isolated web server being OOM-killed
(reported, not discarded, and re-run at `--workers=2`); a too-broad `pkill` killed the pre-existing
shared-Neon dev API on `:3001`; and the pre-existing web dev server on `:3003` was lost to
background-task process-group cleanup. **Both dev servers were restarted and verified** (`:3001`
`/api/health` ok on the external Neon host, `:3003` `/login` 200) — **no shared-Neon write
occurred.**
**Shared-Neon deploy is STILL GATED** and is behaviour-visible: 56 routes change from 403 to
reachable, a Manager token **loses** compensation access, and cross-branch Quick-PIN administration
stops working. **B5, B6 and B7 are NOT started — do not begin any of them without explicit owner
authorisation.** See `ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B4 COMPLETE — Manager REPORTS (2026-08-20) — A: B4 COMPLETE / B5 · B6 · B0 ·
PERMISSIONS-CUTOVER GATED.** Frontend + docs only; **no backend / schema / migration / seed /
permission / Postman change**. `/manager/reports` becomes a **module** (the root now redirects)
carrying two live surfaces — **`/reports/catalog`** and **`/reports/runs`** — built on the B1/B3
chrome with no new shared primitive. The B1 menu tree's two `B4`-tagged placeholder rows are now
real links.
⚠️ **The B4 precondition failed and was repaired first:** Track B3 was **not committed**, its
Playwright run had been **cut off at 245/292**, and its report §10 + evidence §5/§7 were
placeholders. The interrupted run was recovered (**292 passed, 37.5m, 0 failed**), the evidence was
filled in with real numbers, and **B3 was committed as `c34d12e`** before B4 began.
**CATALOG** lists all **37** entries and **drives availability from the API's own `status` field**
(`IMPLEMENTED` 24 / `CONDITIONAL` 1 / `PENDING_LATER` 12 — the exact 24-of-37 split M-P0 verified),
so the UI cannot drift from what the backend can run. The 13 non-implemented entries have
`generatorPath: null` — **structurally uncallable**, no form and no disabled button, each naming the
milestone the API itself cites (e.g. *"needs M30 — Payroll Engine + Pay Runs + Payslips"*). An
unknown status **fails closed**.
**GENERATE** is ONE shared form, because **MP0-16 was re-verified live on all 24 routes** (all
returned **201**): every DTO is `{reportWindow!, dateFrom?, dateTo?, parameters?}` and `top-items`
alone adds `limit?`. `CUSTOM` requires both dates (the API 400s otherwise) and the form says so
rather than letting the request fail. `parameters` is accepted by every DTO but **read by none**, so
no free-form editor ships (B4-F6).
**HISTORY is genuinely persisted** — verified before it was built, because the brief required an
honest session-only fallback otherwise: `GET /api/reports` is a real server-paginated branch-scoped
read fed by the endpoint's own `total`.
**EXPORT IS CSV-ONLY AND THE FORMAT IS HARD-CODED** — there is no format parameter, so no caller can
request a PDF; `format: PDF` → **501** re-verified live, and a legacy pre-2026-08-20 PDF artifact's
download → **404**. Those artifacts are **disclosed in prose and never offered as a control**. The
download streams the server's bytes via `response.blob()`; **`new Blob(` appears nowhere in the
Manager tree.**
🔴 **Graph and pivot are NOT built and NOT advertised** (gated on **C-03**); `ManagerViewSwitcher` is
deliberately unmounted and no menu row hints at them.
⚠️ **Defect found and fixed (B4-D1):** the first implementation added a second query key for
`/api/reports/catalog`, which the M-P1 readiness strip already fetches on every Manager page — the
catalog page issued **`2x GET /api/reports/catalog`** per load. Reports now **shares the readiness
strip's key and fetcher** and projects with `select`: one endpoint, one cache entry, two consumers.
⚠️ **Defect caught before shipping (B4-F2):** `grossSales` is **tax-inclusive** at summary level but
**ex-tax** inside `topItems[]`/`categories[]` — the same field name with two tax bases. A generic
"render every key" breakdown mislabelled per-item ex-tax money as tax-inclusive, so **each report now
declares its own columns, mirroring its CSV header**. Money uses **fail-safe classification**: an
unrecognised key renders as text, never guessed into currency. `rowCount` is labelled **"Records
aggregated"** (219 for SALES_BY_HOUR, whose export is 24 rows) and no table may derive from it.
**Cross-branch reads fail safe at the API-client boundary** (MP0-12 re-verified live: another
branch's run returns **200**).
**Live money cross-check:** DAILY_SALES, `/dash/today-summary` and `/dash/manager` agree exactly —
gross **33,014,100** = net **27,978,300** + tax **5,035,800**, subtotal **28,107,000**.
Validated on the same isolated local Docker stack B3 used (**never shared Neon**): web typecheck /
lint / build pass; **16/16** assertion scripts incl. the new `manager-b4-assertions`; Playwright
`e2e/manager-reports/` **152/152 across four viewports** (38 each, 0 skipped) with **CSV file
contents asserted**, not just status; 10 screenshots at 1440×900 + 1280×680 viewed; per-surface
budgets **≤4 requests**; zero console errors; `/api/health` → ok. Six findings recorded and **none
implemented** (B4-F1…F6). See `ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`. **B5 (Accounting),
B6 (Settings), B0 and the C-21 permissions cutover are NOT started — do not begin any of them
without explicit authorization.**

**2026-08-20 — ENTERPRISE UI TRACK B3 COMPLETE — Manager OPERATIONS + STAFF — A: B3 COMPLETE /
B4 GATED.** Frontend + docs only; **no backend, schema, migration, seed, permission or Postman
change**. Operations and Staff graduate from honest foundation screens to **eight live surfaces**,
built on the B1 chrome primitives — which B3 is the first phase to actually MOUNT
(`ManagerSearchFilterMenu`, `ManagerBreadcrumbs`) — plus four new shared ones: `ManagerListTable`
(Odoo **C4**), `ManagerStatusPipeline` (**C14**), `ManagerViewSwitcher`, `ManagerRecordActionsMenu`
(**C13**).
**OPERATIONS is strictly read-only** — `/operations/orders` (C4 list: server pagination fed by the
real `total` **298**, status/service filters, removable chips, optional-column gear, a totals row
labelled *This page* because the endpoint returns no aggregate) → a read-only **C5** record
(breadcrumb + record pager, statusbar pipeline, notebook tabs, totals block, **zero** action
controls); `/operations/tables` renders the **shared `OperationalFloor` unforked** (proven in e2e by
its own `data-operational-*` attributes) with a read-only selection panel; `/operations/reservations`
is read-only over the same bounded `scope=active|history` contract Supervisor 4A/4B established.
Assertions prove **zero mutations and zero `useMutation` hooks** anywhere in Operations.
**STAFF writes exactly four things**: frontline onboarding (3-step, `ActionConfirmDialog`, PIN
**masked → revealed once → copy-once**, never cached/logged/stored/URL-encoded — verified live);
Quick-PIN reset/disable/enable (Odoo **C12** with only the rows Nimbus can back — password/2FA/API
keys/passkeys/session revocation **omitted, not greyed out**, NG-08); leave review (**no payroll or
roster claim**, org-scoped decision disclosed); and shift-swap **rejection only**.
🔴 **Shift swaps are Outcome C, proven not asserted:** a real rejection changed **0 of 3**
`schedule_assignment` rows and left `/workforce/roster` byte-identical. There is **no Approve
control** and must not be one.
**Privacy:** `lib/manager/staff-projection.ts` is an **allow-list** (14 safe fields) applied at the
**API-client boundary**, because `/hr/leave` and `/hr/shift-swaps` still embed full employee
`dateOfBirth`/`address`/`emergencyContact*`/`notes` — verified live. `?view=full` is never sent
(⚠️ confirmed live that it *would* return compensation to a Manager token — **FU-1 is real**);
`GET /hr/employees/:id` is never called; the directory narrows to the branch **in the browser** and
says so, because the endpoint is org-scoped and 400s on `?branchId=` (MP0-06/C-09, re-confirmed —
the payload spans 5 branches).
⚠️ **Defect found and fixed (B3-D1):** backend gap batch 1 **inverted** `grossSales`/`netSales`, so
the B2 Overview was rendering the **ex-tax** figure under the label *"Sales today (tax-inclusive)"*.
FU-3 recorded this as merely stale notes; it was a live mislabel of the dashboard's headline money.
Bindings re-pointed and pinned by an assertion. A second B3-caused untruth was also removed: the
M-P1 global *"Read-only oversight"* badge in the readiness strip, which became false the moment
Staff shipped a **New** button — read-only is now a per-surface claim.
**Deferred with reasons, not silently dropped:** Operations **Exceptions** and Staff **Attendance**
(outside the owner's enumerated scope, tagged `Deferred` — not an invented phase number); the
**chatter rail** (still gated on **B0**); and **every escalation write and the escalation list** —
the roadmap's own precondition (a verified domain DTO) was unmet, and `/api/approvals` is only
partly branch-scoped (MP0-05).
**New findings recorded, none implemented:** **B3-F1** the Quick-PIN admin routes are org-scoped, not
branch-guarded (200 from another branch); **B3-F2** FU-1 confirmed live; **B3-F3** leave/shift-swap
creation is self-service only (403 for a manager acting on behalf).
Validation: web typecheck / lint / production build pass; **15/15** assertion scripts (the new `manager-b3-assertions.ts` proves 7 allow-listed mutations, 14 safe employee fields, 20 forbidden keys absent, 0 `view=full`, 0 roster writes, 0 SSE clients); a live API matrix of **39/39** checks; Playwright `e2e/manager-operations/` + `e2e/manager-staff/` across **four viewports**; 9 screenshots per viewport; per-surface request budgets measured. All of it on an **isolated local Docker Postgres stack — shared Neon was never touched**, and both `.env` files were restored byte-for-byte (SHA-256 verified). See `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md` and `ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md`. **B4 (Reporting) has NOT started — do not begin it, or any later Track B phase, without explicit owner authorization.**

**2026-08-20 — BACKEND GAP BATCH 1 COMPLETE (Track C: C-02, MP0-10, MP0-09, C-01) — A: BATCH
COMPLETE / B3 UNBLOCKED ON C-02 / SHARED-NEON DEPLOY STILL GATED.** Backend + tests + Postman + docs;
**no schema, migration, seed, permission or frontend change**, local dev DB only.
**C-02 (NG-02/MP0-01)** — `GET /hr/employees` no longer puts compensation or personal PII on the
wire: the default payload is a safe projection whose sensitive columns (`compensationProfile`,
`dateOfBirth`, `address`, `emergencyContact*`, private `notes`, `metadata`) are **not selected from
Postgres at all**, `/:id` returns contracts without any salary field, the write echoes and the
employee embedded in `/hr/contracts` are projected too, and the historical payload survives behind
`?view=full` gated by the pre-existing `pos:hr:compensation:read` (403 without it, 400 on an unknown
view). Live as manager: 40 rows, **zero** forbidden keys. ⚠️ Honest caveat — the seeded matrix grants
that permission to Owner, **Manager** and Accountant, so a Manager can still opt in explicitly;
narrowing the grant is a seed change and was not authorised (**FU-1**). **This unblocks B3's Staff
directory.**
**MP0-10** — the gross/net inversion was a labelling defect, not an aggregation bug: the persisted
identity is `total = subtotal + tax − discount`, so `total` is tax-inclusive. Now
`grossSales = SUM(total)` and `netSales = gross − tax`, with the old ex-tax figure kept **additively**
as `subtotalSales`. Live before/after on the same branch-day: gross **28,107,000 → 33,014,100**, net
**33,014,100 → 27,978,300**, `gross = net + tax` exact, `gross ≥ net` always. Applied to
`/dash/{today-summary,owner,manager}`, `/stream/metrics`, `kpi/refresh` **and** the SHIFT_END /
DAILY_SALES report summaries so the dashboard and the exported report cannot disagree.
**MP0-09** — `/dash/open-orders` gains a real **`total`** (+ `limit`, `truncated`) from the *same*
`where` clause the dashboards count with; `count` deliberately keeps its old page-length meaning so
B2 keeps working. Live: `total 107` == `/dash/manager.openOrders 107` (was 50 vs 107).
**C-01 (NG-01/MP0-03)** — the fake PDF is gone: `format: PDF` returns **501** before any artifact row
is created, `generateTextPdf` is deleted, and all 37 catalog entries advertise `['CSV']`. The same
501 applies through the BG6 `/api/exports` facade. **No renderer added — OD-10 still open.**
Validated on an isolated local Docker Postgres stack (never shared Neon; both `.env` files restored
byte-for-byte, SHA-256 verified): API unit **1057/1061** (the 4 failures pre-existing, proven by
re-running them at `HEAD` in a throwaway worktree); `hr` e2e **25/25**, `dashboards`+`reports` e2e
**53/53**; web **typecheck pass**, **14/14** assertion scripts, Playwright `manager-dashboard`
**84/84**, `manager-shell` **125 passed/11 skipped**, cross-role **36/36** — **the B2 dashboard was
not touched and still passes**; newman M19 **55/55**, M20 **40/40**, M23 **39/39**, BG6 46 with 7
pre-existing AP failures; all 56 collections parse; `/api/health` → ok.
🔴 **New finding recorded as Track C `C-21`:** **38 accounting routes are 403 for every role,
including Owner** — AP (19), AR (10) and Budget (9) are guarded by 23 permission strings
(`accounting:ap:*`, `accounting:ar:*`, `finance:*`) with **zero rows** in the permissions table.
This qualifies the "~90 accounting endpoints exist with zero UI" headline and means **B5 must budget
a permission/seed cutover first**. See `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`.
**Deploying these fixes to shared Neon is still gated on the cutover authorisation. B3 and every
other Track B phase remain NOT started.**

**2026-08-20 — ENTERPRISE UI TRACK B2 COMPLETE (Manager Overview dashboard) — A: B2 COMPLETE /
GATED FOR B3.** Frontend-only; no backend/schema/migration/seed/permission/Postman change.
`/manager/overview` stops being the honest foundation screen and becomes a real branch dashboard: an
Odoo C10-style **3-column grid of eight bordered cards with a coloured left accent bar** — Sales
today, Orders today, Payment mix, Open orders, Low stock, Needs a decision, Shift & till coverage,
Branch readiness — composed through the B1 chrome (`ManagerControlPanel` + `ManagerContentShell`).
Every rendered figure resolves through **`MANAGER_KPI_BINDINGS`**, a 26-entry registry binding each
KPI to a verified endpoint field and a drill-in target; an unregistered KPI **throws** rather than
renders, and only the two till/shift KPIs may lack a drill-in (each with a written reason — MP0-02).
The verified boundaries are all honoured live: the open count comes from `/dash/manager.openOrders`
(**107** live) not `/dash/open-orders.count` (**50**, the capped page length — MP0-09 reproduced);
`netSales` **33,014,100** > `grossSales` **28,107,000** (MP0-10 reproduced) so both labels state the
tax basis and no bare Gross/Net exists; approval counts come from the **four canonical branch-scoped
domain endpoints**, never the partly org-scoped `/api/approvals` inbox (MP0-05), and are projected to
**count-only at the API-client boundary** with `take=1`/`limit=1` so the leave/shift-swap PII payload
never reaches state or cache (MP0-01); tills and shifts are counts with no list and no drill-in.
**Polled, not streamed** — 60 s, with a permanent "Live stream unavailable — showing the latest
fetched data." (C-04/NG-14 still open; the assertion script fails if any SSE code appears).
`POST /dash/kpi/refresh` sits behind the shared `ActionConfirmDialog` + an in-flight lock (live: one
POST per confirm, zero on cancel). **No charting dependency was added** — three hand-rolled
token-driven SVG marks (donut, bar series, ratio meter), each `role="img"` with `<title>`/`<desc>`;
new `chart-series-1…4` + `chart-track` brand-monochrome tokens. **Defect found and fixed by this
phase's own e2e:** M-P1's branch-switch `invalidateQueries` ran while the observers still held the
OUTGOING branch's keys, refetching them — **9 wasted requests per switch**, now `refetchType: "none"`.
Validated 2026-08-20: web typecheck/lint/build pass; **14/14** assertion scripts pass (new
`manager-b2-assertions.ts`); Playwright on an isolated local Docker Postgres stack (never shared
Neon) — `e2e/manager-dashboard/` **84/84**, `e2e/manager-shell/` **125 passed / 11 deliberately
skipped**, `e2e/supervisor-prompt3/` **64/64**, `e2e/cashier-floor` cross-role **48/48**; measured
**12 requests** for one clean Overview load (1 `/auth/me` + 2 shell + 9 dashboard); 5 screenshots at
1440×900 + 1280×680 viewed (full dashboard, branch-switched, forced card error, confirmation); zero
console errors; `GET /api/health` → `ok`; `git diff --check` clean; stack torn down and both `.env`
files restored byte-for-byte (SHA-256 verified). See
`ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`. **B3 (Operations + Staff) and B0 (API
verification, docs-only, parallel) are next — neither is started; both remain gated on an explicit
owner go.**

**2026-08-20 — ENTERPRISE UI TRACK B1 COMPLETE (Manager top-nav shell conversion) — A: B1 COMPLETE /
GATED FOR B0+B2.** Frontend-only; no backend/schema/migration/seed/permission/Postman change; no
commit/push. Manager's presentation converts from the M-P1 fixed **bottom nav** to an Odoo-style
**top module bar**, shipped as an additive `OperationalShell` variant (`navigation="top" | "bottom"`,
default `"bottom"`) — never a Manager shell fork. The shared `OperationalTopNav` +
`OperationalTopNavDropdown` (click-to-open, full keyboard operation: roving-tabindex menubar,
Escape/outside-click/route-change close, arrow-key item navigation) are consumed by a thin
`ManagerTopNav` adapter; the retired M-P1 `ManagerHeader.tsx`/`ManagerBottomNav.tsx` were deleted.
The six locked M-P1 surfaces survive unchanged as the menu tree (Overview/Me direct links;
Operations/Staff/Reports/Settings host dropdowns with one real link to today's foundation page plus
an honest, inert not-yet tree tagged by the phase that ships it — e.g. "Orders — B3"). New Manager
chrome primitives (`components/manager/chrome/`: `ManagerControlPanel`, `ManagerBreadcrumbs`,
`ManagerContentShell`, `ManagerSearchFilterMenu`) are built for every later Track B phase to reuse;
B1 mounts only `ManagerControlPanel`/`ManagerContentShell`, title-only, since no B1 surface has data
to back a create action, search, pager, or view switcher yet — `ManagerSearchFilterMenu` and
`ManagerBreadcrumbs` ship built but deliberately unmounted (first consumed from B3). **OD-4 answered
with a deviation:** the collapse-to-single-menu-control breakpoint is `xl` (1280px), not the
roadmap-suggested `lg` (1024px) — the full bar does not reliably fit at 1024×768, so that project
gets the collapsed control too, preserving the "no horizontal overflow at 1024×768" invariant.
**OD-5 needed no fallback** — the shared shell absorbed the variant with one additive prop. Validated
2026-08-20: web typecheck/lint/build pass; 13 static assertion scripts pass (new
`manager-b1-assertions.ts` + the updated `manager-p1-assertions.ts`, changed only for the retired
Header/BottomNav files, per the density-pass precedent); Playwright executed live on an isolated
local Docker Postgres stack (never shared Neon) — `e2e/manager-shell/` **125/136 passed, 11
deliberately skipped** (desktop-only dropdown mechanics at viewports where the module bar is
collapsed by design — proven separately by a viewport-forced OD-4 test), `e2e/supervisor-prompt3/`
**64/64**, `e2e/cashier-floor` cross-role regression **48/48**; 8 screenshots at 1440×900 + 1280×680
(Manager Overview with a dropdown open + all three frontline shells, byte-identical); zero console
errors; `GET /api/health` → `ok`; `git diff --check` clean; isolated stack fully torn down and
`apps/api/.env`/`packages/db/.env` restored byte-for-byte. See
`ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`. *(Superseded by the B2 entry above: B2 shipped on
2026-08-20; B0 remains unstarted.)*

**2026-08-20 — ENTERPRISE UI RESEARCH COMPLETE; NEW CANONICAL ROADMAP ADOPTED (documentation only).**
The owner's live Odoo instance was explored read-only through his authenticated browser session
(17 screenshots, no record created/edited/deleted) and written up as `ai/ODOO_REFERENCE_RESEARCH.md`;
it was then compared against the Nimbus repo in `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` (20 typed gaps
**NG-01…NG-20**). **Headline finding: Nimbus's accounting backend is far larger than any Nimbus
document admits** — four registered, wired controllers (`accounts-payable` 20 routes,
`accounts-receivable` 11, `bank-rec` 16, `budget` 12) that `docs/MODULES.md` still marks
"⬜ Planned", so ~90 accounting/finance endpoints exist with **zero UI**. ⚠️ Those routes were found
by **static scan only** and are *claimed-by-code, unverified-at-runtime*. On that basis a new
canonical plan was adopted: **`ai/ENTERPRISE_UI_ROADMAP.md`** — three tracks, phased and gated.
**Track A** experience polish (A0 shipped today; A1 = the floor-toolbar wrap at 1024×768, the only
item that track still owns). **Track B** the management suite: **B0** API verification extension →
**B1** Manager **top-nav shell conversion** → **B2** Overview KPI card grid → **B3** Operations +
Staff → **B4** Reporting (CSV-only; graph/pivot gated) → **B5** Accounting suite (sub-phased
B5.1–B5.6) → **B6** Settings → **B7** Owner variant. **Track C** the true backend gaps
**C-01…C-20**, each naming the phase it unblocks, plus **Track C-P** carrying Cashier **C4→C6**
forward unchanged. ⚠️ **Owner decision recorded (`docs/DECISIONS.md` D-MGRTOPNAV): management
navigation switches to an Odoo-style TOP NAV BAR, superseding the M-P1 bottom-nav decision for
Manager** — module bar + click-to-open dropdown submenus, a control-panel row (`New` + title + chip
search + server pager + view switcher) and breadcrumb + record pager. **Frontline roles keep bottom
nav.** Only the navigation *presentation* is superseded: M-P1's shell, session guard, **branch
switcher**, surface allow-list, honest foundation pages and Manager Me all carry forward, and M-P0's
18 findings remain in force. `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` is now **superseded from M-P2
onward** (M-P0/M-P1 history intact) and carries a banner saying so. Also recorded:
`docs/DECISIONS.md` **D-ENTERPRISE** (the Odoo-grade direction), `docs/UI_SYSTEM.md` §3b (the
top-nav spec), and `docs/DOCUMENT_INDEX.md` (the new roadmap + both research docs). **Documentation
only — no code, no backend/schema/seed/permission/Postman change, no commit/push. Nothing in Track
B is implemented. NEXT = Track B1 (top-nav shell conversion), pending an explicit owner go.**

**2026-08-20 — OWNER UI POLISH WAVE 2 COMPLETE (global density + fullscreen lock screen).**
Five owner complaints fixed in the SHARED layer, frontend + docs only, no backend/API/schema/seed/
permission change, no commit/push. **(1)** `/login` is a true `h-screen` + `overflow-hidden` layout
with an internally scrolling card — page scroll is now zero at every terminal viewport
(`scrollHeight`/`innerHeight` = 680/680, 768/768, 900/900, 1080/1080). **(2)** A **global density
mechanism** — viewport-height-scaled root font size `clamp(13.5px, calc(0.625vh + 9.25px), 16px)`
plus rem-normalized `--space-*` tokens — makes the whole app enterprise-tight at laptop sizes while
leaving 1920×1080 identical to the previous baseline; targeted px fixes cover what rem cannot reach
(icon registry 18/24/32 → **16/20/28**, table card 176px → **`min-h-[9.5rem]`** = 152/141/128px,
grid track 220px → 13rem, header and bottom nav **80 → 64px**). **(3)** The lock screen is brand-led:
logomark + inline Inter-ExtraBold "Nimbus POS" lockup, "Service terminal" heading, three compact
status chips — the role-marketing paragraph and the always-visible footer sentence are gone, while
the truthful blocked-role toast behaviour is unchanged. **(4)** The header now prints a **terminal
identity** ("Terminal 01", from the new shared `pos-shell/station.ts`) instead of "Service area
unavailable" / "Workstation unavailable" — documented in code as a station label, not backend data.
**(5)** Long floor table labels are abbreviated deterministically and collision-safely
(`QA-P4-PASS2-1440` → `QP4P2-1440`), with the full label preserved in `title`/`aria-label`; card
titles are one line. Two assertions were updated to the new canonical values (bottom-nav icon 24→20;
card title `break-words`→`truncate`) and both are recorded in `docs/DECISIONS.md`. Validated:
typecheck + lint; 12/12 assertion scripts; Playwright **180/180** across four viewport projects
(manager-shell 92, cashier-floor 32, supervisor-prompt3 32, supervisor approvals/reservations 24);
zero console errors; 15 screenshots at 1280×680 + 1440×900. See `docs/UI_SYSTEM.md` §1c/§1d/§2b/§5b
and `docs/DECISIONS.md` D-DENSITY / D-LOGIN / D-TERMINAL / D-TABLELABEL.

**2026-08-20 — MANAGER RECONSTRUCTION PROMPT M-P1 COMPLETE (A: M-P1 COMPLETE / READY FOR M-P2).**
The Manager workspace foundation is live and Manager is now the **fourth consumer** of the shared
operational UI system — never a fork. Delivered (frontend + docs only): `"manager"` in
`OperationalRole` and the nav registry; the locked six-tab nav **Overview · Operations · Staff ·
Reports · Settings · Me** (no More tab, no Approvals tab) with landing `/manager/overview` and a
`/manager` redirect; `ManagerShell`/`ManagerSessionGuard`/`ManagerHeader`/`ManagerBottomNav`/
`ManagerReadinessStrip` as thin adapters over `OperationalShell`, `OperationalHeader`,
`OperationalBottomNav` and the shared `OperationalIdleLogoutHandler`; the **branch switcher** — the
one genuinely new shell affordance — in a new **optional** `branchSwitcher` header slot, sourced
from `me.memberships` (zero extra requests), persisted at `nimbus.managerBranchId` (deliberately NOT
the station key), driving `X-Branch-Id` through the existing `apiRequest({ branchId })` parameter
(no API-client change) and invalidating **only** the `["manager", …]` query namespace;
`isManagerCompatible()` + `getManagerLandingPath()` and all four `login.tsx` call sites plus the
`manager_only` reason copy; `lib/manager/permissions.ts` as a **surface allow-list, not a permission
check** (the manager token holds 214 permissions incl. compensation/contracts/approvals-decide that
the approved MVP forbids); six honest foundation pages with **no fabricated data**; a real Manager
**Me** built solely from the already-fetched `/api/auth/me`; and a fourth navy-family role accent
(`--color-role-manager` `oklch(0.36 0.06 324)`, white-on-solid **11.18:1**). The readiness strip
ships **three verified chips only** (Branch, report generators `24 of 37`, devices) — tills, shifts
and pending-approvals chips are **omitted, not faked**, because those routes do not exist or are
operator/org-scoped. Validated: typecheck + lint pass (`next build` deliberately not run in the dev
QA sandbox); `manager-p1-assertions.ts` + **11/11** existing assertion scripts pass (`shell` and
`profile` extended to four roles); Playwright `e2e/manager-shell/` **92/92** across four viewports;
cross-role regression **68/68**; live manager browse at 1440×900 + 1024×768 with a captured
`X-Branch-Id` change and persistence across reload; Waiter/Cashier/Supervisor re-verified live and
unchanged. Three findings recorded and **none implemented** (pre-existing guard reason-race, header
label truncation at 1024, the switcher's dropped `(default)` suffix). **No backend / schema /
migration / seed / permission / Postman change; no commit/push. M-P2 (Overview dashboard) NOT
started — do not start without explicit authorization.** See
`ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md` and `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`.

**2026-08-20 — CASHIER FLOOR-FIRST RECONSTRUCTION PROMPT C3 COMPLETE (A: C3 COMPLETE / READY FOR
C4).** The C2 read-only settlement workspace is now a working, **fail-closed payment + close**
surface — implemented as a **mount, not a rewrite**. A new thin
`components/cashier/floor/CashierSettlementActions.tsx` composes the already-verified primitives
(`CashierPaymentPanel` → payment entry / blocked banner / result notice / payment history /
`CashierCloseOrderPanel`, and `CashierResolutionPanel` with a new additive `variant="split-only"` →
split-bill + split-items; the merge/move/transfer group is deliberately **not** mounted). New
`lib/cashier/settlement-mutations.ts` owns the only post-mutation refresh: it **awaits** a canonical
re-read of `orderDetail` + `orderPayments` before any result is shown (no optimistic money) and
otherwise invalidates only the bounded table-bill list, the Floor snapshot, open Find-bill results
and the Waiter/Supervisor Floor keys — all via the C2 key factories, no broad sweep (measured: **9
requests** after a close). Delivered: cash payment (settles **and** closes at the single verified
choke point `POST /pos/orders/:id/close`), card/MTN/Airtel/bank manual-reference payments,
**partial** payment with a canonical remaining balance, **split** allocation + split-items child
order, and truthful terminal state (a CLOSED/VOIDED bill renders **no** settlement control). Fails
closed on inactive/loading/failed/other-operator readiness, an unresolved payment summary, a pending
provider intent, and a non-`SERVED` bill. **Documented deviation:** there is **no standalone Close
button** — the backend has no zero-payment close (`payments` is `@ArrayMinSize(1)`; order must be
`SERVED` with the balance covered), so close is reached through payment and the close panel states
the real precondition. **Frontend-only — no backend/schema/migration/seed/permission/Postman change;
no commit/push.** Validated: web typecheck + lint (build deliberately not run in the QA sandbox);
shell/floor/profile/C1/C2/**C3** assertion scripts all pass; Playwright `e2e/cashier-floor/`
**192/192** (48 × 4 viewports) and cross-role regression **20/20**, executed against an **isolated
disposable local Postgres** stack with REAL payments/closes; console/network clean; 36 screenshots
at 1440×900 + 1024×768. Six findings recorded and **none implemented** (notably: manual-reference
accepts a payment on a CLOSED order; reservation auto-completion does not fire on the cashier close
path; `generateOrderNumber` can 500 on branch-prefixed demo numbers). **C4 NOT started** — receipts,
refunds and Receipts retirement remain gated. See
`ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md` and
`ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

**2026-08-20 — MANAGER OWNER DECISIONS APPROVED; MANAGER TRACK UNBLOCKED (documentation only).**
The product owner (Moses) approved the Manager core + MVP scope as recommended: role
`JobRole.MANAGER`, landing `/manager/overview`, bottom nav **Overview · Operations · Staff ·
Reports · Settings · Me**, required branch switcher driving every branch-scoped query, **no
Approvals bottom tab** (counts on Overview; escalations in Operations; leave/swap in Staff), Reports
+ Settings first-class, no More tab; Staff excludes compensation/contracts/payroll; Operations is
read-only oversight (no cashier-checkout or waiter-order-entry clone); Reports need a truthful
generator-unavailable state (**fake downloads forbidden**); Settings = branch profile + devices,
printer routes metadata-only, terminal pairing stub-only, alerts defer-or-read-only, sync-conflict
diff deferred, owner/SaaS billing excluded; **domain-specific decision routes preferred** over the
generic `POST /api/approvals/:id/decide` (Supervisor **Option B** precedent). ⚠️ **Sequencing
changed:** the "Manager is blocked until Cashier C6" rule is **REPLACED** — **Cashier C3 is
authorized to proceed in parallel** (in progress separately) and the **Manager track no longer waits
for C6**. Every "Pending owner approval" row in
`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md` now reads
**Approved (owner, 2026-08-20)**; new canonical roadmap
**`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`** (**M-P0 → M-P6**) created; `docs/manager-ui-docs/` made
portable and canonical-with-an-authority-split (dead `file:///C:/Users/arman/...` links removed).
**Documentation only — no code, no backend/schema/seed/permission change, no commit/push. Manager UI
implementation remains NOT STARTED**; approval of decisions is not authorization to write Manager
runtime code, and **M-P0 (repo/API verification audit) runs first.** Note recorded during this pass:
Manager **does** hold `approvals:read` + `approvals:decide` in the seed
(`packages/db/prisma/seed.ts:974–975`) while Supervisor holds neither — so the domain-route
preference is a product/safety constraint, not a permission block.

(Prior status date:) **2026-08-20 — Rebrand + role UI QA wave COMPLETE.** The **Aug-2026 Nimbus POS
Brand Identity** (designer Andimashimwe Rhoda) is fully landed in `apps/web` — canonical navy/silver/
graphite tokens (navy-900 `#000033` canonical), a **new alpha-channel token system** that fixed a
pre-existing app-wide defect (every `token/alpha` utility, i.e. every modal scrim, rendered fully
transparent), true-vector steering-wheel assets in `apps/web/public/brand/`, the new non-registry
`NimbusLogomark` in the operational header + login hero, PWA/OG metadata, and new canonical
`docs/BRAND_IDENTITY.md`. Shared-component **accessibility fixes** landed (Button `inverse` variant,
header logout 2.71→20.48:1, disabled 3.62→8.51:1, a visible `focus-inverse` ring on navy surfaces,
navy scrims, two invisible-label fixes). **Waiter, Cashier (within the C2 boundary), and Supervisor**
each got a full live QA pass at 1440×900 + 1024×768, producing NEW canonical
`docs/waiter-ui-docs/*` (37 endpoints; Waiter had no docs dir and no API matrix before) and
`docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (32 endpoints, 19 live-verified), plus a live-verified
`SUPERVISOR_API_MATRIX.md` (68 rows) with its quick-pin path defect fixed and a `docs/UI_SYSTEM.md`
§9 correction. Frontend + docs only — **no backend/schema/migration/seed/permission/Postman change;
no commit/push.** Validated 2026-08-20: web typecheck + lint + production build **PASS**;
Playwright-driven visual QA ~180 screenshots. QA ran on an isolated local **Docker-free Postgres 16 +
WASM-Prisma harness** stack (API :3001, web :3000); **shared Neon untouched**. ⚠️ The two "500
defects" first seen (receipts GET, add-item POST) were **QA-harness artifacts**, fixed in the harness
and re-verified 200/201 — **not product bugs**. Nine open findings are recorded for the owner and
**none were implemented**. **Cashier C3 stays gated; Manager reconstruction stays NOT STARTED and
blocked until Cashier C6.** See `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`.

(Prior status date: 2026-07-31 —) **Cashier Floor-First reconstruction Prompt C2 COMPLETE (A: C2
COMPLETE / READY FOR C3).** C2 replaces C1's neutral boundary with table→bill resolution
(zero/one/multiple, fail-closed, no first-pick), canonical `?tableId=&orderId=` URL state, ONE
read-only `CashierSettlementWorkspace` (Bill/Totals/Payment state/Readiness/History) that reuses the
existing checkout primitives, and a bounded Cashier-only **Find bill** sibling (tableless/takeaway +
exact-id). No payment/close/receipt/refund **execution** (that is C3/C4). Queue/Receipts kept as
hidden compatibility routes (not deleted, not redirected; retire C4/C5). Frontend-only; browser QA
executed on an isolated local Docker Postgres stack (`e2e/cashier-floor/` across the four viewport
projects); shared Neon untouched; no commit/push. See
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`. **C3 not started; Manager
reconstruction remains blocked until Cashier C6.**
(Prior: **Cashier C1 COMPLETE** — third shared-`OperationalFloor` consumer, nav Floor/Till/Me,
`?tableId=` selection, read-only boundary; see
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.)
(Prior: **Supervisor Reconstruction FINAL CLOSURE complete (B: COMPLETE WITH KNOWN LIMITATIONS /
DEMO-READY)** — full four-viewport live QA, 262/264 executed passed, shared Neon unchanged; see
`ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`.)
**Branch:** `main` — **dirty worktree carries the newest, authoritative work.**
**Commit/push status:** ⛔ No commit or push. Recent frontend waves are all
uncommitted by design; treat the worktree as source of truth.

---

## Role completion state

| Role | Nav (locked) | State |
| --- | --- | --- |
| **Waiter** | Floor · Reservations · Me | ✅ Complete & visually locked. **Rebranded + fully live-QA'd (2026-08-20):** all surfaces (floor, workspace/order builder, reservations, me, receipt drawer, login) verified on the live isolated stack at 1440×900 + 1024×768; flows confirmed; zero console errors; **37 endpoints verified** (20 GETs + 11 writes live, rest static). NEW canonical `docs/waiter-ui-docs/{README,WAITER_API_MATRIX,WAITER_LIFECYCLE}.md` — Waiter previously had **no** canonical docs dir and **no** API matrix anywhere. Open finding: no Quick PIN seeded for `waiter@nimbus.demo` though docs advertise 246810. See `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`. |
| **Cashier** | **Floor · Till · Me** (implemented, default `/cashier/floor`); Queue/Receipts hidden compatibility routes (retire C4/C5) | ✅ **Floor-First reconstruction Prompt C1 COMPLETE (2026-07-31) — A. C1 COMPLETE / READY FOR C2.** Cashier now consumes the shared `OperationalFloor` (Waiter/Supervisor/Cashier); nav Floor/Till/Me; `/cashier` → `/cashier/floor`; `?tableId=` selection URL state; table selection opens a **read-only** truthful settlement boundary ("Select a bill to continue.") with no payment action (the mount point C2 replaces). Queue/Receipts preserved & reachable by direct URL. Frontend-only — no backend/schema/migration/seed/permission/Postman change. Validated: web typecheck/lint/build; shell/floor/cashier-c1 assertions; Playwright `e2e/cashier-floor/` **88/88** + cross-role regression **40/40** (× 4 viewports) executed on an isolated local Docker Postgres stack (shared Neon untouched); no commit/push. **C2 not started.** See `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`, `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`, `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C2.md`. **Rebranded + live-QA'd within the C2 boundary (2026-08-20):** all surfaces QA'd live incl. **zero/one/multiple** bill resolution (fail-closed confirmed, bounded queries confirmed, URL state confirmed), Till, Me, and the hidden Queue/Receipts compatibility routes (confirmed still rendering). NEW canonical `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (32 endpoints, **19 live-verified**) + README update; the legacy pack matrix is superseded. **C3 remains NOT started and gated — nothing gated was implemented.** Open finding **M1**: Cashier has no shift-open control while `tills.service` requires an actor-owned active shift (cold-start cashier cannot open a till unaided), and `/shifts/active` vs `/tills/active` key on different fields → contradictory readiness chips. See `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`. |
| **Supervisor** | Floor · Reservations · Approvals · Me | ✅ Reconstruction Prompt 0–3 complete (3D demo-ready); **Prompt 4A backend lifecycle complete**; **Prompt 4B Reservations UI = COMPLETE WITH KNOWN LIMITATIONS**. The read-only triple-query Reservations page is replaced by a premium master-detail workspace on the 4A `scope=active/history` contracts — **Arriving/Seated/Attention/History** views (one bounded active query + lazy history; no triple-fetch/merge; no all-history load), reservation **creation**, and the full verified **lifecycle** (confirm/assign/change-table/seat/cancel/no-show/manual-complete) — **all already permitted for Supervisor, so zero permission/backend change**. Attention = overdue + structural SEATED issues (individual actions, **no bulk**). Cross-role Waiter visibility via narrow invalidation; URL-persisted state; responsive/accessible. Validated: web typecheck/lint/build + reservations+orders Jest 67/67 + Playwright suite (72 tests × 4 viewports) compiles. ✅ **Prompt 4C shared-Neon cutover COMPLETE (2026-07-29):** migration `20260518000000_prompt4a_reservation_completed_event` (`ReservationEventType.COMPLETED`) **deployed + verified on the shared `production` branch** via `db:migrate:deploy` (checksum match; counts unchanged), and `db:seed` applied the authorized `pos:order:transfer` Supervisor mapping — so **manual-complete + order-close auto-completion + Transfer table now all work on shared Neon** (the 4B + 3D shared residuals are closed). Pre-migration **recovery branch retained**. During the optional live-QA phase an isolated API accidentally hit production (inherited shell `DATABASE_URL` overrode the swapped `.env`) and created one marked QA reservation, immediately deleted (user-authorized) → production restored to 126/12. Closed at **B** per user decision. ✅ **Prompt 4D isolated live QA COMPLETE (2026-07-29):** the outstanding live-browser/API gate is closed with durable **fail-closed isolation tooling** (`tools/qa/`: env-isolation lib + DB-identity preflight using the API's own Prisma client + launcher = denylist→preflight→spawn), fixing the 4C incident root cause (inherited shell `DATABASE_URL` overriding a swapped `.env`). **Live reservation mutation matrix 53/53** on the isolated stack (create/confirm/assign/reassign/seat/cancel/no-show/manual-complete/queries/pagination/overdue/branch-isolation/concurrency); the Playwright reservations suite (72 tests × 4 viewports) was **actually executed** against an isolated local Docker stack (the disposable Neon branch's EAT↔us-east-1 latency exceeds the app's 30s client abort — external, not a UI defect), with first-run spec fragilities found & fixed and the product independently verified (create-dialog validation renders correctly; Jest 67/67). **Shared Neon verified untouched** (126/12/0-QA; recovery branch `br-dawn-truth-a4zjs1p7` retained). No backend/DTO/schema/migration/seed/permission/Postman change; new non-blocking gap **SUP-RG-034** (reservation-number create race → recommended backend hardening). ✅ **Prompt 5A Approvals backend/contract/QA foundation COMPLETE — READY FOR PROMPT 5B (2026-07-30):** audited all four approval domains (discount/leave/shift-swap/anomaly — decision lifecycles already existed & pass Jest); applied **backward-compatible hardening** (bounded leave/swap pagination `Max(100)`, **branch-isolation** on shift-swap approve + anomaly ack/resolve, **concurrency-safe** conditional-claim on all four decisions → duplicate = 409/400, History `dateFrom`/`dateTo`, anomaly-list `actorUser` identity include) with **no permission/schema/migration/seed/Postman change**; added the additive `lib/supervisor/approvals-contract.ts` (Needs-action/Resolved/History scopes, minimal identity, query keys, narrow invalidation) leaving the read-only Approvals page **visually unchanged**. Architecture locked **domain-specific (Option B)** — Supervisor lacks `approvals:*`, so no generic `/api/approvals/:id/decide`. **Live QA on a disposable Neon branch:** API decision matrix **29/29** + Playwright smoke **8/8** (4 viewports); shared `production` verified **untouched** (58/0/836/126). ✅ **Prompt 5B1 Approvals premium UI — Discount + Leave decisions — COMPLETE WITH KNOWN LIMITATIONS / READY FOR PROMPT 5B2 (2026-07-30):** the read-only Approvals page is replaced by `SupervisorApprovalsWorkspace` on the 5A contract — **Needs action / Resolved / History** scope tabs, All + per-domain filters, server-`total` counts, identity-safe queue rows, responsive master-detail (desktop split / mobile stack — one detail workspace), URL-persisted state, bounded pagination. **Discount** approve/reject (Prompt 3 endpoints + financials, UI-only payment gate, truthful self-approval notice) and **Leave** approve/reject (`/hr/leave/:id/review`, no payroll/roster claim) are **fully actionable**; terminal records read-only. **Shift-swap + Anomaly render read-only** (decisions → Prompt 5B2). Discounts omitted from Resolved/History (**SUP-RG-035**, truthful order-scoped notice). **No permission/schema/migration/seed/backend/Postman change; no commit/push.** Validated: web typecheck/lint/build; API attendance+discounts+analytics+DTO **126/126** + reservations **39/39**; **isolated live browser QA on disposable Neon branch `br-aged-resonance-a47lmtt5`** (fail-closed launcher, `/api/health` ok) — Playwright Approvals suite **80/80** (10 files × 4 viewports); shared `production` verified **untouched** (58/836/126, 0 QA rows, sentinel absent); disposable branch deleted. New non-blocking gap **SUP-RG-040** (pre-existing `POST /pos/orders` order-number collision on a populated branch — not a 5B1 defect). Prompt 5B2 (live Shift-swap + Anomaly decisions) **not started**. Reports: `ai/SUPERVISOR_RECONSTRUCTION_PROMPT5B1_APPROVALS_DISCOUNT_LEAVE_UI_COMPLETION_REPORT.md`, `ai/SUPERVISOR_APPROVALS_UI_QA_EVIDENCE_INDEX.md`. ✅ **Prompt 5B2 Approvals closure — SUPERVISOR APPROVALS CLOSED AT B / DEMO-READY WITH KNOWN LIMITATIONS (2026-07-31):** completes the four-domain workspace. **Anomaly** Acknowledge (OPEN→ACK, note optional, row stays actionable) + Resolve (ACK→RESOLVED, note required; evidence preserved, underlying entity untouched) are live via `pos:analytics:anomalies:acknowledge`. **Shift-swap = Outcome C (user-authorized): Reject only, NO Approve control** — a truthful roster swap is unsupported (`ScheduleAssignment` is **read-only across the entire API**; no roster-mutation service; the request references only a date; the approve permission has never mutated roster — SUP-RG-036/**042**); the UI says so honestly and Reject changes **0** roster rows (verified). **Frontend-only: no backend/schema/migration/seed/permission/Postman change; no commit/push.** Validated: web typecheck/lint/build; API **126/126** + reservations **39/39**; **isolated live QA** on disposable Neon branch `br-hidden-king-a4rbwvj0` — API matrix **11/11** (shift-swap reject/dup/bound + anomaly ack/resolve/dup/stale) + roster-integrity **0 assignments touched** + full Playwright Approvals suite **120/120** (15 files × 4 viewports, 2 flaky recovered on retry, exit 0); shared `production` verified **untouched** (58/836/126, 0 QA rows, sentinel absent); disposable branch deleted. **Supervisor Approvals is CLOSED.** Next major track: **Manager reconstruction (not started).** Reports: `ai/SUPERVISOR_RECONSTRUCTION_PROMPT5B2_SHIFT_SWAP_ANOMALY_UI_COMPLETION_REPORT.md`, `ai/SUPERVISOR_RECONSTRUCTION_PROMPT5_APPROVALS_FINAL_COMPLETION_REPORT.md`. **Rebranded + fully live-QA'd (2026-08-20):** floor (action dialogs opened + cancelled), reservations (4 views + create), approvals (4 domains incl. the reject-only shift-swap path), me — all verified live at 1440×900 + 1024×768; the reservations **one bounded query** design confirmed in flight; legacy `/supervisor/orders` redirect confirmed. `SUPERVISOR_API_MATRIX.md` live-verified (**68 rows: 24 live + 3 probes + 41 static**) and its **quick-pin path defect FIXED** (real route `auth/quick-pin-login`); `docs/UI_SYSTEM.md` §9 idle-logout claims **corrected** (Supervisor DOES inject the shared idle handler — code wins); 7 supervisor docs annotated. Open finding: the discount dialog placeholder leaks internal jargon ("Prompt 3B3A discount validation"). See `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`. |
| **Manager** | Overview · Operations · Staff · Reports · Settings · Me (**locked by owner decision, 2026-08-20**; not built) | ⬜ **UI NOT STARTED — but no longer blocked.** **Owner decisions APPROVED 2026-08-20:** every row in `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md` now reads **Approved (owner, 2026-08-20)** (§8 Safety rows stay Locked; §9 checklist ticked). ⚠️ **The "blocked until Cashier C6" rule is REPLACED** — Cashier C3 is authorized in parallel and the Manager track is unblocked. Canonical phased plan: **`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`** (**M-P0** repo/API verification audit → **M-P1** shell/nav/session/branch switcher → **M-P2** Overview → **M-P3** Operations read-only → **M-P4** Staff → **M-P5** Reports → **M-P6** Settings/Me/closure QA). Manager will be the **4th consumer** of the shared `OperationalShell`/`OperationalFloor`/icon registry via thin adapters — **not a fork**. `docs/manager-ui-docs/` reconciled + made portable (dead Windows `file:///` links removed; explicit authority split vs. the pack). **M-P0 must run before any implementation.** Documentation-only pass — no code, no backend/permission change, no commit/push. |

## Completed milestones / workstreams

- **Rebrand + role UI QA wave** ✅ (2026-08-20) — frontend + documentation only; **no backend/
  schema/migration/seed/permission/Postman change; no commit/push.** Landed the **Aug-2026 Nimbus
  POS Brand Identity** (designer Andimashimwe Rhoda) in `apps/web`: canonical tokens in
  `styles/globals.css` (navy-950 `#000024` / **navy-900 `#000033`** canonical / navy-800 `#1E1E52` /
  silver `#B3B4AF` / graphite `#6B6B6B` — sampled from the guide's swatch, its printed hex is a
  typo), `surface-navy` + `focus-ring` → navy-900, and a **NEW alpha-channel token system** (channel
  triplets + `tailwind.config.ts` `rgb(var() / <alpha-value>)` mappings) that **fixed a pre-existing
  app-wide defect** — every `token/alpha` utility (all modal scrims) previously rendered fully
  transparent. True-vector steering-wheel assets extracted from the brand PDF into
  `apps/web/public/brand/` (logomark/wordmark/combination-mark ± white ± stacked, favicon set,
  apple-touch-icon, icon-192/512(+maskable), og-image, `manifest.webmanifest`); root `favicon.svg`
  replaced; new `components/pos-shell/NimbusLogomark.tsx` (`currentColor`, **non-registry brand
  mark**) mounted in `BranchContextLabel` (44px header tile) and `login.tsx` (56px hero tile,
  replacing `LockKey`); `_app.tsx` theme-color/manifest/apple-touch-icon/og meta. Shared-component
  **accessibility/consistency fixes** verified in all 3 roles at 1440×900 + 1024×768: `ui/Button.tsx`
  new **`inverse`** variant + `disabled:text-text-primary` (**3.62 → 8.51:1**); `OperationalHeader`
  logout on the inverse variant (**2.71 → 20.48:1**, hover → navy-800); new `--shadow-focus-inverse`
  wired into `OperationalBottomNav` + Button inverse (the ring was navy-on-navy = invisible);
  four dialog scrims `bg-black/40` → `bg-brand-navy-950/40`; `CashierPaymentMethodSelector`
  selected-tile class conflict fixed (label was **1.18:1**); `CashierCheckoutPreview`
  `text-white` → `text-text-inverse`. Three role QA passes (**Waiter**, **Cashier** within the C2
  boundary, **Supervisor**) executed live, producing new canonical `docs/BRAND_IDENTITY.md`,
  `docs/waiter-ui-docs/*`, and `docs/cashier-ui-docs/CASHIER_API_MATRIX.md`. Validated 2026-08-20:
  web typecheck + lint + production build **PASS**; Playwright-driven visual QA **~180 screenshots**;
  `git diff --check` clean except pre-existing md whitespace. **QA environment:** isolated local
  **Docker-free Postgres 16 + WASM-Prisma harness** + API `:3001` + web `:3000`; **shared Neon
  untouched**; destructive QA never ran against shared Neon. ⚠️ The two "500 defects" first seen
  (receipts GET, add-item POST) were **QA-harness artifacts** (WASM Prisma Decimal class identity),
  fixed in the harness and re-verified **200/201 — not product bugs**; the only `packages/db` change
  is the harness-required generator line `previewFeatures = ["driverAdapters"]`. **Nine open findings
  (a)–(i) are recorded for the owner and none were implemented.** **Cashier C3 stays gated; Manager
  reconstruction stays NOT STARTED and blocked until Cashier C6.** Report:
  `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md` (canonical).
- **Cashier Floor-First Reconstruction — Prompt C0** ✅ (2026-07-31) — documentation-and-
  verification-only pass. Safely fetched and fast-forwarded the canonical
  `docs/cashier-ui-docs/*` + `ai/CASHIER_FLOOR_RECONSTRUCTION_*` documentation branch
  (`docs/cashier-three-tab-floor-workflow` @ `9b374c3`) into the dirty local worktree with zero
  path conflicts; confirmed the 12 intentional shared-Floor deletions remain absent; audited the
  actual current Cashier routes/shell/Queue/Receipts/payment/split/Till/refund/Me/tests/
  permissions against the locked Floor-First target (nav **Floor · Till · Me**, default route
  `/cashier/floor`, Cashier as the third `OperationalFloor` consumer, settlement workspace behind
  table selection, **Find bill** sibling control for tableless/takeaway/lookup cases). No
  runtime/backend/schema/permission/Postman change; no commit/push. Reports:
  `ai/CASHIER_FLOOR_RECONSTRUCTION_C0_REPO_VERIFICATION_REPORT.md` (canonical),
  `ai/CASHIER_FLOOR_RECONSTRUCTION_{COMPONENT_AUDIT,ROUTE_AND_NAV_AUDIT,
  CAPABILITY_MIGRATION_MATRIX,PERMISSION_AND_API_MATRIX,TEST_INVENTORY}.md`, updated
  `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`. **C1 (shared Cashier Floor/shell/nav/routing)
  NOT started** — do not begin without explicit authorization. Manager reconstruction stays
  blocked until Cashier C6 closes.
- **Backend M0–M42 + BG0–BG7** — 100% complete (BG7 HMS Integration, 2026-05-08).
  ~65 migrations, 53 API modules, 56 Postman collections, ~420+ endpoints.
- **Waiter UI** — complete: premium menu/order entry, instant table→menu flow,
  manager-configured FOOD/DRINKS taxonomy, UGX zero-fraction totals, receipts,
  reservations + seat, shared-profile Me. (2026-07-16 → 07-18)
- **Application-wide performance hardening** — complete (2026-07-18): JWT reuses
  claims, `/auth/me` parallelised, branch guard caches/dedupes, Quick PIN trimmed,
  API client bounded 30s timeout + AbortController + request IDs, cashier/
  supervisor list N+1 fan-outs removed (cashier startup ~101 → ~9 requests).
  Residual local/Neon latency remains and is documented (not a frontend deadlock).
- **Shared profile** — complete (2026-07-18): Waiter/Cashier/Supervisor reuse the
  `components/profile/*` primitives; employee-link handling consolidated; long
  shifts presented truthfully.
- **Supervisor Reconstruction:**
  - **Prompt 0** ✅ — repo re-verification, shared-component mapping, lifecycle
    audit, phased roadmap, gap register, MVP include/defer matrix (docs only).
  - **Prompt 1** ✅ — shared operational shell/header/clock/logout/bottom-nav +
    canonical icon registry; Supervisor nav reduced to Floor/Reservations/
    Approvals/Me; Orders removed from visible nav; `/supervisor/orders` legacy
    redirect into Floor.
  - **Prompt 2** ✅ — Waiter + Supervisor share one `OperationalFloor`; Supervisor
    table selection opens a read-first table-control workspace; URL-backed
    selection + legacy Orders routing.
  - **Prompt 3A** ✅ (2026-07-27) — action foundation + safe service actions:
    Supervisor idle-session parity (shared idle handler); central order
    action-availability module; canonical selected-order wiring; shared
    confirmation dialog + idempotency-intent foundation; **live Request bill and
    Mark served** (verified against the backend, permission `pos:orders:write`);
    payment stays read-only. High-impact actions remain prepared but hidden.
  - **Prompt 3B1** ✅ (2026-07-27) — Supervisor **Split bill, Split items, Move
    items, Merge** live inside the Floor workspace (BG3 idempotency, bounded
    branch-scoped target selector, shared line selector, EQUAL/CUSTOM allocation
    validators). Required an authorized RBAC grant (Supervisor → `pos:order:split`
    / `merge` / `move-items` via seed mapping). Payment read-only; no Orders nav.
  - **Prompt 3B2** ✅ (2026-07-28) — Supervisor **Transfer table** live inside the
    Floor workspace (bounded branch-scoped target selector, BG3 idempotency,
    canonical source/target Floor cache reassignment, post-transfer URL re-anchor)
    + **Find order** compact Floor lookup (bounded/paginated, status/service
    filters, exact-ID fallback) opening takeaway/tableless/closed/voided/exception
    orders in the canonical workspace; tableless truthful, terminal read-only,
    legacy `/supervisor/orders` redirect verified. Required an authorized RBAC
    grant (Supervisor → `pos:order:transfer` via seed mapping); ⚠️ that single
    permission also makes the UNUSED `transfer-server` endpoint API-reachable.
    Payment read-only; no Orders nav. Live/browser QA pending (no API/DB/browser
    automation in this environment).
  - **Prompt 3B2 transfer-server** ⬜ Deferred (Outcome B) — no safe branch-scoped
    server selector exists; endpoint stays UI-hidden/blocked. See `docs/DECISIONS.md`.
  - **Prompt 3B3A** ✅ (2026-07-28) — Supervisor **active-order Void**
    (`pos:orders:void`) and **order-level Discount request** (`pos:discount:request`)
    live inside the Floor workspace, in a new **Adjustments** group, with a read-only
    Discounts panel. Void is separated from refund/complimentary/post-close void;
    discount basis = subtotal, backend threshold decides APPROVED vs PENDING (UI shows
    an estimate, no optimistic total). A documented UI-only payment safety gate blocks
    both when money is present. No permission/backend change (perms pre-existed).
    Narrow discount-domain-only Approvals invalidation. Live/browser QA pending.
  - **Prompt 3B3B** ✅ (2026-07-28) — Supervisor **discount Approve/Reject** (inline on
    PENDING discount rows, `pos:discount:approve`) and **Complimentary** (whole-order
    100% discount via `pos:discount:request`, Outcome B — metadata round-trips) in the
    Adjustments group. Approve recalcs totals (payment-gated); reject leaves totals
    unchanged; complimentary may return PENDING above the org threshold. Self-approval is
    backend-permitted (UI matches + flags it; backend guard recommended). Narrow
    discount-domain invalidation; Approvals page not redesigned. No permission/backend
    change. Live/browser QA pending.
  - **Prompt 3C** 🟡 (2026-07-28) — **consolidated live-QA / closure = IMPLEMENTED /
    QA BLOCKED.** Verification-only (no code/backend/seed/Postman change; no DB mutation).
    Passed: worktree safety, web typecheck/lint/build, `git diff --check`, 53/56 Postman
    JSON (3 pre-existing BOM), fresh API boot + **`/api/health` db ok**, API
    `orders.service` Jest **26/26**, and **read-only runtime permission verification**
    (Supervisor login 201; `/auth/me` 132 perms; guard-boundary probes return non-403 for
    all 13 in-scope actions → each permission GRANTED with zero mutation). Re-verified in
    code: no Orders tab, legacy redirect, no transfer-server UI, shared-Floor reuse,
    payment safety gates, no forbidden actions. **Blocked (not fabricated):** destructive
    live-mutation QA (shared live Neon DB + classifier write-block, no isolated DB) and
    browser + 4-viewport QA (no Playwright/Puppeteer/Cypress). **⚠️ Runtime gap:**
    Supervisor lacks `pos:order:transfer` on the active DB (confirmed via `/auth/me` +
    `role_permissions` read + a live **403** on transfer-table) → **Transfer table 403s
    until the authorised additive seed mapping is applied** (`db:seed` or insert the single
    roleId `cmqlcft890006wp6loken0xub` × `pos:order:transfer` row; no schema/migration).
    Reports: `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3_CONSOLIDATED_LIVE_QA_COMPLETION_REPORT.md`,
    `ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`.
  - **Prompt 3D** ✅ (2026-07-28) — **isolated destructive QA + browser matrix = COMPLETE
    WITH KNOWN LIMITATIONS.** Stood up a disposable Docker Postgres 16 (`nimbus_prompt3_qa`,
    :55432) + API :4001 + web :3100 (shared Neon untouched); migrations + `db:seed` +
    `db:demo:import`; installed Playwright + Chromium. **API mutation matrix (41 checks):
    all in-scope actions + rejections + idempotency replays pass; totals never negative.**
    **Playwright 64/64 across 1024×768/1366×768/1440×900/1920×1080.** **Defect fixed:**
    discounts-list `?pageSize` 400 → added `@Type(() => Number)` to `ListOrderDiscountsQueryDto`
    (+6-test Jest spec); the Supervisor Discounts panel read now works and complimentary
    metadata round-trips. Postman/schema/permissions unchanged. Harness kept
    (`apps/web/playwright.config.ts`, `e2e/supervisor-prompt3/*`). Reports:
    `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3D_ISOLATED_QA_COMPLETION_REPORT.md`.
  - **Prompt 4A** ✅ (2026-07-28) — **Neon reservation-lifecycle completion + active/history
    query repair + order-close sync = COMPLETE WITH KNOWN LIMITATIONS / READY FOR PROMPT 4B.** Backend fix for
    indefinite reservation pile-up (not a frontend filter): new `POST /reservations/:id/complete`
    (SEATED→COMPLETED, gated by the already-seeded, already-Supervisor `pos:reservation:update`
    — **no new permission, no seed change**); **auto-completion on order close** at the single
    canonical `OrdersService.transitionOrder` CLOSED choke point (explicit `seatedOrderId`
    linkage, retry-safe, failure-logged-not-swallowed); **concurrency-safe guarded transitions**
    (conditional `updateMany` compare-and-set); **`scope=active|history` split** + `from`/`to`
    range + **pageSize default 25 / max 100 clamp** + deterministic sort + server-derived
    `overdue` (never auto-NO_SHOW). Only schema change = `COMPLETED` added to `ReservationEventType`
    enum + migration `20260518000000_prompt4a_reservation_completed_event` (**NOT deployed to
    shared Neon this pass**). FE = contract helpers only (no Reservations UI redesign — that is
    Prompt 4B). **Static validation all pass** (API typecheck for changed modules, web
    typecheck/lint/build, **reservations+orders Jest 67/67**, 56 Postman collections parse).
    **Isolated Neon QA EXECUTED** (via Neon MCP on a disposable fork of the live `production`
    branch): migration audit (no drift; only the 4A migration unapplied on shared, intended),
    migration applied + `COMPLETED` enum verified on the branch, Supervisor `pos:reservation:update`
    confirmed by live SQL, shared read-only data audit (126 res; 6 order-less SEATED + 55 overdue =
    repair candidates, not auto-resolved), live manual + order-close auto-completion + idempotency +
    active/history split, query plans (no index needed), and **zero writes to shared Neon** (identical
    before/after counts). **Not run (non-blocking):** HTTP-layer API boot / `/api/health` / Playwright
    smoke (stack unit-tested 67/67, DB contract proven live). Reports:
    `ai/SUPERVISOR_RECONSTRUCTION_PROMPT4A_NEON_RESERVATION_LIFECYCLE_COMPLETION_REPORT.md`,
    `ai/SUPERVISOR_RESERVATION_QA_RECORD_REGISTER.md`,
    `ai/SUPERVISOR_RESERVATION_SHARED_NEON_DATA_AUDIT.md`.
  - **Deferred (out of Supervisor reconstruction scope):** transfer **server** (no safe
    selector), refund creation/approval, post-close void, payment collection, order close,
    Reservations UI reconstruction (Prompt 4B).

## Active milestone

**Current (2026-08-20): Rebrand + role UI QA wave — COMPLETE.** No implementation track is open.
The Aug-2026 brand identity is landed across `apps/web`, and Waiter / Cashier (C2 boundary) /
Supervisor have each been live-QA'd at 1440×900 + 1024×768 with canonical API matrices written or
corrected. Frontend + docs only; no backend/schema/migration/seed/permission/Postman change; no
commit/push. Next approved tracks are **Cashier C3 (pending authorization)** and **Manager
(blocked until Cashier C6 + owner decisions)** — see "Next approved milestone" below and
`ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`.

(Prior active milestone, kept for history —) Supervisor Reconstruction — **Prompt 4 COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY (2026-07-29).**
4A (backend lifecycle) + 4B (Reservations UI) + 4C (shared-Neon cutover) + **4D (isolated live QA +
fail-closed DB isolation tooling)** are done. Prompt 4D closed the outstanding live-browser/API QA
gate: durable `tools/qa/` isolation harness (denylist → DB-identity preflight → launcher), live
reservation mutation matrix **53/53**, the Playwright reservations suite (72 tests × 4 viewports)
**actually executed** on an isolated local stack (first-run spec fragilities fixed), and shared Neon
verified untouched (126/12/0-QA; recovery branch retained). No backend/DTO/schema/migration/seed/
permission/Postman change; new non-blocking gap SUP-RG-034. **Full Approvals-page reconstruction is
NOT started** (do not begin without approval).

## Next approved milestone

> ⚠️ **Dated supersession note (2026-08-20).** The Supervisor Prompt 3B2/3B3 line below is **stale
> and superseded — it is kept only as history.** Supervisor reconstruction **closed on 2026-07-31**
> (Prompts 3B2, 3B3A, 3B3B, 4A–4D and 5A/5B1/5B2 are all complete; the Approvals track is CLOSED at
> B / DEMO-READY). The **actual next approved tracks are:**
> 1. **Cashier Floor-First reconstruction Prompt C3** (payment/close execution) — **pending explicit
>    owner authorization; NOT started.** Do not implement payment collection, partial/split
>    execution, order close, receipt print/reprint/deliver, or refund execution; do not delete or
>    redirect Queue/Receipts; do not fork the shared Floor; do not change a Cashier permission.
> 2. **Manager reconstruction** — **NOT started and blocked until Cashier C6 closes**, and
>    additionally pending the owner decisions in
>    `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md` (all still
>    pending).

- ~~**Supervisor Reconstruction Prompt 3B2/3B3** (recommended next)~~ — **superseded 2026-08-20
  (completed 2026-07-31); history only:** transfer table,
  void (active + post-close), discount request/approve/reject, complimentary,
  refunds — reusing the action-availability module, shared confirmation dialog, and
  idempotency-intent utility. **transfer-server stays blocked** until a safe narrow
  server selector exists. See `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`.
- Formal roadmap line item: **M43 — Frontend Shell + Role-Based Workspaces**
  (the role UIs are being delivered ahead of / interleaved with this).

## Blocked work (backend contract gaps)

- **Waiter post-send item additions** — blocked: backend lacks per-line sent
  state / idempotent send-additions contract (WKL-010).
- ~~**Supervisor reservation completion** — no verified completion endpoint and no
  `ReservationEventType.COMPLETED` enum (SUP-RG-008/009; needs migration).~~
  ⚠️ **SUPERSEDED — NOT BLOCKED (dated note 2026-08-20).** This line is stale and is kept only as
  history. Reservation completion was **delivered in Supervisor Prompt 4A (2026-07-28)**
  (`POST /api/reservations/:id/complete` + auto-completion on order close) and the
  `ReservationEventType.COMPLETED` enum migration
  `20260518000000_prompt4a_reservation_completed_event` was **deployed and verified on shared Neon
  `production` in Prompt 4C (2026-07-29)**.
  SUP-RG-008/009 are closed. The 4B Reservations UI exposes the full lifecycle and was re-verified
  live in the 2026-08-20 QA pass.
- Supervisor **Split bill / Split items / Move items / Merge** are live (Prompt 3B1).
  Remaining high-impact actions (transfer table, void, discount request/approve/
  reject, complimentary, refunds) are deferred to Prompt 3B2/3B3.
- Supervisor **transfer-server** stays blocked — no safe narrow, branch-scoped,
  operational-role server selector endpoint exists (only admin-gated/unfiltered
  tenancy memberships or an org-wide HR directory).
- **RBAC note (2026-07-27):** the Supervisor role was granted `pos:order:split`,
  `pos:order:merge`, `pos:order:move-items` (user-authorized seed mapping to
  existing permission rows; re-seeded). No schema/migration change.

## Deferred work

Full accounting, payroll admin, franchise, developer portal, owner SaaS billing,
PesaPal diner checkout, live MTN/Airtel diner mobile money, printer drivers,
terminal/acquirer traffic, MSR/badge login, smart spouts. See
`docs/KNOWN_LIMITATIONS.md`.

## Known limitations

Consolidated in `docs/KNOWN_LIMITATIONS.md`, with role detail in
`ai/WAITER_MVP_KNOWN_LIMITATIONS.md`, `ai/CASHIER_UI_KNOWN_LIMITATIONS.md`, and
`ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md`.

## Validation status (2026-07-26 onboarding pass)

| Gate | Result |
| --- | --- |
| `@nimbus-pos/web` typecheck | ✅ pass |
| `@nimbus-pos/web` lint | ✅ pass (no warnings/errors) |
| `@nimbus-pos/web` build | ✅ pass |
| `GET /api/health` | ✅ `{ status: ok, db: ok }` (HTTP 200) |
| `git diff --check` | ✅ clean (LF→CRLF info warnings only) |
| Postman JSON (56 collections) | ✅ all valid (3 carry a legacy UTF-8 BOM Postman tolerates) |

**Re-validated 2026-08-20 (rebrand + role UI QA wave):** `@nimbus-pos/web` typecheck ✅ · lint ✅ ·
production build ✅ · `git diff --check` ✅ clean except pre-existing markdown whitespace ·
Playwright-driven visual QA ~180 screenshots across 3 roles × 2 viewports on an isolated local
Postgres 16 + WASM-Prisma stack (shared Neon untouched). Postman untouched (no contract change).

## Dirty-worktree warning

The worktree has large uncommitted changes (new shared `pos-shell/`, `floor/`,
`profile/` trees; deleted role-specific floor components; auth/orders perf
hardening; new docs). **Do not reset/restore/stash/clean/discard.** GitHub is stale.

## Commit / push status

⛔ **No commit or push** during onboarding/polish passes unless the user asks.
