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
| Manager dashboard (Track B2) | `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md` (canonical B2 record, 2026-08-20) - shell record: `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md` |
| Odoo reference + gap analysis | `ai/ODOO_REFERENCE_RESEARCH.md` (+ `ai/odoo-reference-screenshots/`), `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` |
| Locked decisions | `docs/DECISIONS.md` |
| Known limitations | `docs/KNOWN_LIMITATIONS.md` |
| Cashier reconstruction | `docs/cashier-ui-docs/*`, `ai/CASHIER_FLOOR_RECONSTRUCTION_*.md` (C3 complete 2026-08-20; C4 not started) |
| Supervisor reconstruction | `docs/supervisor-ui-docs/*`, `ai/SUPERVISOR_RECONSTRUCTION_*.md` |

## 5. Current implementation status

**Enterprise UI Track B2 complete - Manager Overview dashboard (2026-08-20)
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
complete and visually locked. Manager reconstruction is at M-P1, Track B1 and
Track B2 COMPLETE: the shell, the Odoo-style top-nav menu tree, session guard,
branch switcher, Manager chrome primitives, foundation pages, a real Manager Me,
and the live eight-card Overview dashboard over the verified `/dash/*` reads are
shipped. Operations, Staff, Reports and Settings still carry only their honest
foundation screens - their live data is B3 through B7. Per the 2026-08-20 owner
decision the Manager track is no longer blocked on Cashier C6, but B3 (Operations
+ Staff) must not start without explicit authorization.

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
- Manager: Overview / Operations / Staff / Reports / Settings / Me, landing
  `/manager/overview`, presented as an Odoo-style TOP NAV BAR module bar (Track
  B1, 2026-08-20, owner decision `docs/DECISIONS.md` D-MGRTOPNAV - now
  implemented, superseding the M-P1 bottom-nav presentation). Overview and Me are
  direct links; Operations, Staff, Reports, and Settings host click-to-open
  dropdowns with one real link plus an honest not-yet tree. Waiter, Cashier and
  Supervisor keep bottom nav and render byte-identically. Branch-level oversight
  with a required header branch switcher that drives `X-Branch-Id` on every
  manager read. M-P1 and B1 shipped the shell/nav foundation and B2 shipped the
  live Overview dashboard - do not begin B3 (Operations + Staff) or any later
  Track B phase, add an approval DECISION control to Overview, render a KPI that
  is not in `MANAGER_KPI_BINDINGS`, add an SSE/`EventSource` client (gated on
  C-04), add a charting dependency, fabricate a revenue trend (no bucketed series
  exists and `/dash/snapshots` needs `pos:dash:owner:read`, which Manager does not
  hold), take the open-order count from `/dash/open-orders.count`, read approval
  counts from the generic `/api/approvals` inbox, add a More/Approvals tab,
  change the landing route, convert `lib/manager/permissions.ts` into a
  `hasPermission()` check, add tills or shifts chips/lists (those routes do not
  exist), pull `/hr/employees` into Manager state without the agreed allow-list
  projection, offer a PDF report export (the backend's PDF is a plain-text file),
  build a branch-profile edit form (`PATCH /branches/:id` does not exist), add
  Accounting as a seventh top-nav menu (OD-3 stays open, gated on B5), or mount
  `ManagerSearchFilterMenu`/`ManagerBreadcrumbs` without real data to back them -
  without explicit authorization.

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
