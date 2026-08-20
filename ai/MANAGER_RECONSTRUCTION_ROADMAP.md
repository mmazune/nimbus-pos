# Manager Reconstruction Roadmap

> ## ⛔ SUPERSEDED FROM M-P2 ONWARD (2026-08-20, owner-approved)
>
> **M-P2 … M-P6 in this document are superseded by
> [`ai/ENTERPRISE_UI_ROADMAP.md`](ENTERPRISE_UI_ROADMAP.md) Track B.** Do not plan or execute
> M-P2, M-P3, M-P4, M-P5 or M-P6 from this file. Their scope, sequencing and gates now live in
> Track B (**B0 → B7**), which extends them with the Odoo-grade patterns, the accounting suite over
> the ~90 existing endpoints, and the explicit Track C backend-gap schedule.
>
> **M-P0 and M-P1 are NOT superseded.** They shipped, and this file remains their canonical
> planning record. Everything M-P1 delivered — Manager as the **fourth consumer** of the shared
> operational UI system, `ManagerShell`/`ManagerSessionGuard`, the **branch switcher** (source,
> persistence, `X-Branch-Id` plumbing, narrow `["manager", …]` invalidation), the surface
> **allow-list**, the honest foundation pages, the real Manager **Me**, and the "three verified
> chips only" readiness rule — **carries forward unchanged**.
>
> **What changed (owner directive, 2026-08-20 — `docs/DECISIONS.md` D-MGRTOPNAV):** Manager
> navigation converts from the M-P1 **bottom nav** to an **Odoo-style top module bar** with
> dropdown submenus, a control-panel row (`New` + title + chip search + pager + view switcher) and
> breadcrumb + record pager. **Only the navigation presentation is superseded** — the six M-P1
> surfaces survive as the first six top-nav menus, and the landing stays `/manager/overview`.
> Frontline roles (Waiter, Cashier, Supervisor) **keep bottom nav**.
>
> The M-P0 findings (**MP0-01 … MP0-18**) and the §2 locked constraints below remain fully in
> force and are carried into Track B verbatim. §8's recorded contradictions still stand.
>
> **Nothing in Track B is implemented. B1 is gated on an explicit owner go.**

**Status:** Canonical for **M-P0 + M-P1 history**; **superseded from M-P2** (see banner above).
Created **2026-08-20**, immediately after the product owner approved the Manager core + MVP scope.
**Owner decisions (locked):**
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`](../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md)
— every previously-pending row now reads **Approved (owner, 2026-08-20)**; the §8 Safety rows stay
**Locked**.
**Manager UI implementation status (2026-08-20): M-P0 ✅ · M-P1 ✅ · M-P2…M-P6 NOT STARTED.**
`apps/web/src/pages/manager/`, `components/manager/`, and `lib/manager/` now exist and carry the
M-P1 shell/nav/guard/branch-switcher foundation plus honest foundation pages — **no live surface
data**. See [`ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md`](MANAGER_P1_SHELL_COMPLETION_REPORT.md).
**M-P2 must not start without explicit authorization.**

Grounded in: `MANAGER_NAV_AND_PAGE_MAP.md`, `MANAGER_FEATURE_SCOPE.md`, `managerui.md`,
`MANAGER_API_MATRIX.md`, `MANAGER_GAP_REGISTER.md` (all in the pack, plus the portable subset in
`docs/manager-ui-docs/`), and the implemented Waiter / Cashier / Supervisor code.

Format follows [`docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md`](../docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md).

---

## 0. Sequencing note (2026-08-20 — supersedes the C6 block)

The rule *"Manager reconstruction is blocked until Cashier reconstruction closes at C6"* — recorded
in `CLAUDE.md` §10/§12, `CODEX.md`, `PROGRESS.md`, and the Cashier roadmap's scope lock ("no Manager
UI before C6 closure") — was **replaced by owner decision on 2026-08-20**:

- **Cashier C3 is authorized to proceed in parallel.**
- **The Manager track no longer waits for Cashier C6.**

The two tracks now run concurrently and share the operational shell + Floor. That makes the
**shared-component contract the main cross-track risk**: any change either track makes to
`components/pos-shell/*` or `components/floor/*` propagates to the other. See §"Shared-shell reuse
rule" below.

Documents still carrying the old wording are stale on sequencing only; do not "fix" them by
reverting this decision.

## 1. Total prompt count

The Manager reconstruction is **seven prompts total**, numbered **M-P0 through M-P6**.

M-P0 is audit-only. M-P1 is the foundation everything else mounts on. M-P2 … M-P5 are one
surface each. M-P6 closes Settings + Me and runs integrated QA.

Do not merge phases. Each has an independent completion gate and completion report
(`ai/AI_COMPLETION_REPORT_TEMPLATE.md`).

## 2. Constraints that bind EVERY prompt

These are the locked decisions. A phase that violates one is not complete, regardless of its own
gate.

**Identity and navigation**
- Role is `JobRole.MANAGER`. **No `BRANCH_MANAGER` enum** (MANAGER-GAP-002 — resolved, do not
  reintroduce).
- Landing route is **`/manager/overview`**.
- Bottom nav is exactly **Overview · Operations · Staff · Reports · Settings · Me** — six items.
  **No More tab. No Approvals tab.**
- A **branch switcher is required** in the shell/header, and the selected branch drives **every**
  branch-scoped query (`X-Branch-Id`, via `apps/web/src/lib/api/client.ts:151`).

**Scope**
- **Operations is read-only oversight.** No cashier-checkout clone. No waiter-order-entry clone.
  No tender panel, no order builder, no order close.
- **Staff excludes compensation, contracts, payroll, pay runs, bank details, tax IDs, private HR
  notes.** Safe-field whitelist on the frontend (MANAGER-GAP-004).
- **Reports:** catalog + generate (DTO-verified) + history/detail + export, with a truthful
  **generator-unavailable** state. **Fake downloads are forbidden** (MANAGER-GAP-008).
- **Settings:** branch profile + device registry only. Printer routes **metadata-only** (no driver
  invocation). Terminal pairing **stub-only** (no acquirer/card traffic). Alert rules
  **defer-or-read-only**. Sync-conflict diff **deferred**. Owner/Admin settings and SaaS billing
  **excluded**.
- **Approvals:** counts on Overview; escalations integrated into Operations; leave/swap review in
  Staff. **Domain-specific decision routes are preferred** over
  `POST /api/approvals/:id/decide` — the **Supervisor Option B precedent**.

**Safety (§8 of the decision register — Locked, pre-dating this approval)**
- No live MTN/Airtel diner execution. No PesaPal diner checkout. No receipt-send success claim
  (no adapter). No printer-driver invocation. No card-terminal/acquirer traffic. No payroll or
  compensation exposure. No real PII. **No fake success states of any kind.**

**Engineering**
- Manager is the **fourth consumer** of the shared operational UI system, **not a fork**.
- **No backend, DTO, Prisma schema, migration, seed, permission, auth-semantics, branch-isolation,
  or Postman change** in any Manager phase without explicit per-change authorization. If a phase
  needs one, **stop and document it** — do not implement it.
- **No commit and no push** unless the user explicitly asks.
- Destructive/mutation QA runs on an **isolated disposable database only** — never shared Neon.
- Do not regress the performance hardening (no duplicate `/api/auth/me`, no request storms, no
  broad invalidation, no responsive double-mounts).

## 3. Shared-shell reuse rule (mandatory, all phases)

Manager consumes the shared assets through **thin Manager adapters**, exactly as the other three
roles do. Manager is a **4th consumer, NOT a fork**.

| Shared asset | Location | Manager's obligation |
| --- | --- | --- |
| `OperationalShell` | `apps/web/src/components/pos-shell/OperationalShell.tsx` | Wrap in `ManagerShell`; do not re-implement the layout. |
| `OperationalHeader`, `BranchContextLabel`, `RoleIdentity`, `CurrentTime` | `components/pos-shell/` | Reuse. The **branch switcher** is the one genuinely new header affordance — build it as a shared-compatible addition, and verify the other three roles still render correctly. |
| `OperationalBottomNav` | `components/pos-shell/OperationalBottomNav.tsx` | Reuse; feed it `managerRoutes`. |
| Role nav registry | `components/pos-shell/role-navigation.ts` + `types.ts` | Add `"manager"` to `OperationalRole` and register `managerRoutes` — do not bypass the registry. |
| Icon registry | `components/pos-shell/role-icon-config.ts` + `role-icons.ts` | Reference icons **by name**. Never import Phosphor directly in routes/screens. Sizes/weights come from the registry tokens (bottomNav 24 / compactAction 18 / pageState 32; active `fill`, inactive `bold`). New Manager tabs will need new registry entries — add them to the registry, not to a Manager-local file. |
| Idle logout | `components/pos-shell/OperationalIdleLogoutHandler.tsx` + `pos-shell/idle.ts` | Reuse the one shared mechanism. |
| `ActionConfirmDialog` | `components/pos-shell/ActionConfirmDialog.tsx` | Reuse for every Manager write confirmation. |
| Idempotency intent | `apps/web/src/lib/pos-shell/idempotency.ts` | Reuse where the endpoint supports it; otherwise block double-submit with in-flight state (MANAGER-GAP-018). |
| Profile primitives | `components/profile/` | Reuse for Manager Me. |
| `OperationalFloor` | `components/floor/OperationalFloor.tsx` | **If** Manager gets a Floor-like view, it renders the shared `OperationalFloor` **read-only** — same toolbar, grid, cards, status labels, `First L.` staff formatting, breakpoints, 176px card height. Never a `ManagerTable*` / `ManagerFloor*` fork. Guest names never appear on Floor cards. |

**Propagation warning.** Changes to shared components reach Waiter, Cashier, and Supervisor by
design. Every phase that touches `pos-shell/` or `floor/` must re-run the cross-role regression
(`e2e/cashier-floor/`, `e2e/supervisor-prompt3/`, plus the shell/floor assertion scripts) and say so
in its report. With Cashier C3 running in parallel, coordinate before editing shared files.

## 4. Brand (2026-08-20 rebrand — already shipped)

Canonical: [`docs/BRAND_IDENTITY.md`](../docs/BRAND_IDENTITY.md).

- Navy **`#000033`** (navy-900), Light Grey **`#B3B4AF`**, Dark Grey **`#6B6B6B`**.
- The **steering-wheel logomark** renders via
  `components/pos-shell/NimbusLogomark.tsx` — the **documented non-registry exception** (brand mark,
  not a UI icon). It is already mounted in `BranchContextLabel` (44px header tile) and `login.tsx`
  (56px hero tile); Manager inherits it through the shared header. Assets: `apps/web/public/brand/`.
- Manager components consume `--color-brand-*` tokens. **No hard-coded hexes.** **Do not
  reintroduce pre-Aug-2026 palette values** from `Front End/manager_ui_full_docs_pack/.../DESIGN.md`
  or `manager_design.md`.
- The alpha-channel token system is live — use the `token/alpha` utilities for scrims rather than
  inventing new ones.

---

# The prompts

## M-P0 — Repo, API, and permission verification audit

**Status: ✅ COMPLETE (2026-08-20). Classification A — M-P0 COMPLETE / GO FOR M-P1 (4 conditions).**
Canonical record: [`ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md`](MANAGER_P0_REPO_VERIFICATION_REPORT.md).
All **62** `MANAGER_API_MATRIX.md` rows now carry a live-verified status
(**🟢 51 · 🟡 7 · 🔴 4**) in a new `Verified (M-P0, 2026-08-20)` column. Verified statically against
`apps/api/src/modules/**/*.controller.ts` **and** live against an isolated QA stack
(API `:3001`, disposable local Postgres, `manager@nimbus.demo`, `GET /api/health` → `ok`).
No runtime/backend/schema/migration/seed/permission/Postman change; no commit/push. Three writes
only, all on the disposable DB (one `MP0-QA` report run, two export artifacts, one KPI snapshot).

### 2026-08-20 — key findings (full detail in the report)

**Assumptions CONFIRMED**
- The demo Manager is **multi-branch — 4 ACTIVE memberships** (Tapas Downtown *default*, Rooftop Bar,
  Garden Cafe, Events Kitchen). Branch switching demonstrably re-scopes data (22 `TD-*` vs 16 `RB-*`
  tables; different dashboards) and is fail-closed: non-member **403**, invalid **400**, missing
  header **400**, missing token **401**. **The branch switcher is de-risked.**
- **Zero permission mismatches — 61/61 matrix permission strings are HELD** (214-permission JWT).
  Manager holds `approvals:read` + `approvals:decide` (seed 974/975, re-confirmed live), and also
  `pos:hr:contracts:*` / `pos:hr:compensation:read`. **Every MVP restriction is a product/safety
  constraint, not a permission block** → `lib/manager/permissions.ts` must be a **surface
  allow-list**, never a `hasPermission()` check.
- `payment-mix`, `open-orders`, `low-stock` **do** all sit behind `pos:dash:today-summary:read`.
- **SSE `/api/stream/metrics`**: the matrix's "None (Requires JWT)" is **correct** — no
  `@Permissions` decorator. **15 s interval verified live.** Branch is captured at subscribe time.
- **§8 contradiction #5 RE-CONFIRMED (SUP-RG-036/042 holds):** `scheduleAssignment` has **six** call
  sites API-wide, **all reads**; `approveShiftSwap` mutates only `ShiftSwapRequest` + audit.
  **Approving a swap changes ZERO roster rows** → M-P4 follows Supervisor **Outcome C**.
- **§8 contradiction #7 quantified:** the controller exposes **24** generators, not 17.
  `POST /api/reports/export` really is gated by **`pos:reports:exports:read`** — a read permission on
  a write route (`reports.controller.ts:609`). Backend defect; **documented, not fixed**.
- The advertised Manager Quick PIN **`11223344`** is **real** — `POST /api/auth/quick-pin-login`
  → 201. (The Waiter QA's phantom-PIN failure did **not** repeat.) Path is `quick-pin-login`.
- The frontend baseline is exactly as assumed: `OperationalRole = "waiter"|"cashier"|"supervisor"`
  (`pos-shell/types.ts:5`), no `pages/manager` / `components/manager` / `lib/manager`, and
  `login.tsx:143-151` clears the session and blocks Manager users.

**Assumptions DISPROVED / corrected**
- 🔴 **`GET /api/tills` and `GET /api/shifts` DO NOT EXIST** (404). `/tills/active` and
  `/shifts/active` are **operator-scoped** (`operatorUserId` / `openedById` = caller), so they
  return the Manager's *own* row, not the branch's. **M-P3 has no tills or shifts table** and the
  readiness strip's tills/shifts chips are **counts only** (from `/dash/manager.shiftSummary`) or
  omitted.
- 🔴 **`PATCH /api/branches/:id` DOES NOT EXIST** (404). **M-P6's branch profile is read-only.**
- 🔴 **`GET /api/hr/employees` returns full compensation** — `compensationProfile{baseAmount,
  salaryBasis, allowances, deductions}` on **all 40 rows**; `/employees/:id` adds `contracts[]` with
  `salaryAmount`. Also `dateOfBirth`, `address`, private HR `notes`. It is **org-scoped** and
  accepts **no `branchId` filter** (`?branchId=` → 400). A frontend whitelist does not stop the wire
  transfer → **M-P4 needs an allow-list projection at the API-client boundary**, plus a client-side
  branch filter.
- 🔴 **`POST /api/reports/export` with `format: PDF` produces a plain-text file** stamped
  `application/pdf` (`reports.service.ts:2056` → `generateTextPdf`), served at 200 with
  `status: READY` and no `%PDF-` header. **A fake success state already in the backend.**
  **M-P5 ships CSV only.**
- 🟡 **`GET /api/approvals` is NOT fully branch-scoped** — `leave_request`, `vendor_bill`, and
  `inter_branch_transfer` are org-scoped. Live with X-Branch-Id=Tapas: `total: 16` across **5**
  branches, incl. a non-membership branch and 5 FINANCE rows. M-P2 must filter before counting.
- 🟡 **`GET /api/reports/:id` returns NO rows** — only `rowCount` + an aggregate `summary`. The
  matrix's "content payload" claim is false; `managerui.md` §8's row table is not buildable from it.
- 🟡 **`EventSource` cannot carry `Authorization` + `X-Branch-Id`**, and `apps/web` has **no SSE
  client at all**. M-P2 must build a `fetch` + `ReadableStream` reader — new infrastructure.
- 🟡 **MANAGER-GAP-009 is DISPROVED.** All 24 generator DTOs are
  `{reportWindow, dateFrom?, dateTo?, parameters?}`; only `top-items` adds `limit?`. **A single
  generic generate form is DTO-correct — M-P5's scope shrinks materially.**
- 🟡 `netSales` (SUM(total), inc-tax) is **larger** than `grossSales` (SUM(subtotal), ex-tax);
  `/dash/open-orders` hard-caps at 50 and its `count` is the page length, not the total; and
  `pageSize`/`take` are **unbounded** on `/pos/orders`, `/reports`, and `/hr/employees`.
- 🟢 `GET /api/reports/catalog` returns **37 entries with truthful `IMPLEMENTED` (24) /
  `CONDITIONAL` (1) / `PENDING_LATER` (12)` statuses — the MANAGER-GAP-008 generator-availability
  source already exists and is honest.

### M-P1 GO conditions (from the report §15c)

1. `lib/manager/permissions.ts` is a **surface allow-list**, not a permission check.
2. Shared-file edits (`pos-shell/{types,role-navigation,role-icon-config,role-icons}.ts`,
   `OperationalHeader.tsx` — **optional** switcher slot — and `login.tsx`) are coordinated with the
   parallel Cashier C3 track and fully cross-role regressed. **5 new icon-registry names** are
   required (only `me` already exists for Manager's six tabs).
3. The readiness strip **omits or count-limits** the tills/shifts chips; the Manager's own
   `/shifts/active` row is never shown as "the branch's active shifts".
4. This roadmap's **M-P5 section is amended before M-P5 begins** to record the disproved
   MANAGER-GAP-009, the CSV-only export, and the missing row payload on `/reports/:id`.

**Type:** documentation and verification only. **No runtime code.**

### Scope

- Fetch/reconcile; confirm the dirty worktree is intact; read the Manager doc set and the locked
  decision register.
- **Verify every row of `MANAGER_API_MATRIX.md` against today's backend** — the matrix is a
  2026-07-06 draft and **nothing in it is live-verified**. For each row confirm: the route is
  registered, the HTTP method matches, the `@Permissions(...)` string on the actual guard matches
  the documented one, branch/org scoping matches, and the response shape matches what the UI plans
  to render. Produce a `Verified` column in the house style of
  `docs/waiter-ui-docs/WAITER_API_MATRIX.md` / `docs/cashier-ui-docs/CASHIER_API_MATRIX.md`.
- Specifically verify, because these are the rows the roadmap depends on:
  - **Dashboards** — `GET /api/dash/manager`, `/dash/today-summary`, `/dash/payment-mix`,
    `/dash/open-orders`, `/dash/low-stock`, `POST /api/dash/kpi/refresh`
    (`apps/api/src/modules/dashboards/dashboards.controller.ts`). Note that `payment-mix`,
    `open-orders`, and `low-stock` all sit behind `pos:dash:today-summary:read`, not their own
    permission — confirm and record. Capture the **actual response DTOs**; the Overview KPI list in
    `managerui.md` §5 (8 cards) must be proven against what `/dash/manager` really returns, not
    assumed.
  - **SSE** — `@Sse('metrics')` on the separate `StreamController` (`@Controller('stream')`, same
    file). The matrix says "None (Requires JWT)" for its permission — **verify that claim against
    the decorators**, and verify the 15s emission interval, the branch-scoping mechanism, and what
    happens when the stream is unavailable (MANAGER-GAP-015 requires a truthful degraded state, not
    a broken-looking dashboard).
  - **Reports generators** — the matrix lists 17 generate routes; the controller
    (`apps/api/src/modules/reports/reports.controller.ts`) exposes **more**, including
    `open-closed-orders`, `cash-movements`, `reservation-deposits`, `reservation-no-shows`,
    `event-bookings`, `event-checkins`, and `high-risk-actors`. Enumerate the full set, map each to
    its permission, and record which ones Manager actually holds. Verify each generator's **request
    DTO** (MANAGER-GAP-009: templates have different filter requirements — a generic form will send
    wrong payloads). Verify `GET /api/reports/catalog`, `GET /api/reports`, `GET /api/reports/:id`,
    `POST /api/reports/export` (documented as `pos:reports:exports:read` — a *read* permission on a
    write route; confirm and flag), and `GET /api/reports/exports/:id/download`. **Probe the
    export/download path for the missing-generator failure mode** (MANAGER-GAP-008) so M-P5 can
    build a truthful unavailable state instead of guessing.
  - **Approvals** — `GET /api/approvals`, `GET /api/approvals/:id`,
    `POST /api/approvals/:id/decide` (`modules/unified-approvals/unified-approvals.controller.ts`),
    plus the domain routes `/pos/discounts/:id/approve|reject`, `/pos/refunds/:id/approve`,
    `/pos/orders/:id/post-close-void`, `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`.
    **Known finding to re-confirm:** `packages/db/prisma/seed.ts` grants Manager **both**
    `approvals:read` (line 974) and `approvals:decide` (line 975), while the `Supervisor:` block
    (line 1090) grants **neither** — so the Option B preference is a product/safety constraint for
    Manager, not a permission block. Capture the **actual decide DTO** per source type
    (MANAGER-GAP-007).
  - **Staff/HR** — employees list/create/update, `hr/frontline-staff/onboard`, the three quick-PIN
    routes, attendance, leave, shift-swaps. **Record exactly which fields the employee endpoints
    return** so M-P4 can build the safe-field whitelist against reality (MANAGER-GAP-004), and
    whether onboarding returns a one-time secret (MANAGER-GAP-005).
    ⚠️ Also verify what `PATCH /hr/shift-swaps/:id/approve` actually does — the Supervisor track
    proved (SUP-RG-036/042) that `ScheduleAssignment` is **read-only across the entire API** and
    that approving a swap mutates **zero** roster rows. If that still holds, Manager's approved
    "shift-swap review" scope must be honest about it and **must not claim a roster change**.
  - **Operations** — `GET /api/pos/orders`, `/pos/orders/:id`, `/tables`, `/reservations`,
    `/tills`, `/shifts`. Confirm pagination bounds (the Cashier/Supervisor work found unbounded
    `pageSize` in places) and branch scoping.
  - **Settings** — `GET /api/branches`, `PATCH /api/branches/:id`, `GET /api/devices`,
    `POST /api/devices/activate`, `POST /api/devices/printers/routes`,
    `POST /api/devices/terminals/pair` (`modules/device-registry/device-registry.controller.ts`).
  - **Auth/session** — `/api/auth/login` (returns **201**), `/api/auth/quick-pin-login` (note: the
    Supervisor audit found the path is `quick-pin-login`, **not** `quick-pin/login`),
    `/api/auth/me`, `/api/auth/logout`.
- Audit the **seeded Manager demo account**: which branches it is a member of (multi-branch is
  required to exercise the switcher), whether a high-tier Quick PIN exists, and whether the
  credentials in `MANAGER_LIFECYCLE.md` §1 are real. The Waiter QA found advertised PINs that were
  not seeded — do not repeat that.
- Audit the shared shell/floor/icon registry for exactly what must change to admit a 4th role.
- Produce the Manager **current-worktree gap register** and the **M-P1 implementation prompt**.

### Out of scope

Any runtime code. Any backend/schema/migration/seed/permission/Postman change. Any UI. Rewriting
the historical matrix body rather than annotating/appending a verified column.

### Key files

`docs/manager-ui-docs/*`, `Front End/manager_ui_full_docs_pack/manager-ui-docs/*`,
`packages/db/prisma/seed.ts`, `apps/api/src/modules/{dashboards,reports,unified-approvals,hr,attendance,orders,floor,reservations,tills,shifts,tenancy,device-registry}/`,
`apps/web/src/components/pos-shell/*`, `apps/web/src/components/floor/*`,
`apps/web/src/lib/{cashier,supervisor,waiter}/routes.ts`, `apps/web/src/lib/auth/role.ts`,
`apps/web/src/lib/api/client.ts`.

### Validation gates

- Every matrix row carries a verified status with the evidence (controller file + line, permission
  string, live response code where probed).
- Live probes run on an **isolated disposable stack** (`tools/qa/` fail-closed launcher);
  `GET /api/health` returns `ok`; shared Neon proven untouched.
- `git diff --check` clean. No commit/push.
- Deliverables: `ai/MANAGER_RECONSTRUCTION_M-P0_REPO_VERIFICATION_REPORT.md`, an updated Manager
  gap register, and `ai/MANAGER_RECONSTRUCTION_PROMPT_M-P1.md`.

  **2026-08-20 delivery note — what actually shipped.** The verification report was filed as
  **[`ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md`](MANAGER_P0_REPO_VERIFICATION_REPORT.md)** (the
  filename authorised in the executed M-P0 prompt), **not** the `MANAGER_RECONSTRUCTION_M-P0_…`
  name planned here. Also shipped: the `Verified (M-P0, 2026-08-20)` column across all 62 rows of
  `docs/manager-ui-docs/MANAGER_API_MATRIX.md`, this status block, and a
  `docs/DOCUMENT_INDEX.md` catalog entry. **Not yet written:** the updated Manager gap register and
  `ai/MANAGER_RECONSTRUCTION_PROMPT_M-P1.md` — the executed prompt did not commission either. The
  18 new findings are carried as **MP0-01 … MP0-18** in §15(b) of the report and should be folded
  into the gap register when the M-P1 prompt is authored.

### Locked constraints it must respect

All of §2. In particular: **document, do not implement** — including any backend defect it finds.

**Completion result:** every architectural assumption in the Manager doc set is confirmed or
disproved against real code. M-P1 is unblocked.

---

## M-P1 — Shell, navigation, session guard, and branch-switcher foundation

**Status: ✅ COMPLETE (2026-08-20). Classification A — M-P1 COMPLETE / READY FOR M-P2.**
Canonical record: [`ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md`](MANAGER_P1_SHELL_COMPLETION_REPORT.md).

Manager is now the **fourth consumer** of the shared operational UI system — no fork. Delivered:
`"manager"` in `OperationalRole` + the nav registry; the locked six-tab nav
(**Overview · Operations · Staff · Reports · Settings · Me**, no More tab, no Approvals tab);
`/manager` → `/manager/overview`; `ManagerShell` / `ManagerSessionGuard` / `ManagerHeader` /
`ManagerBottomNav` / `ManagerReadinessStrip` as thin adapters over `OperationalShell`,
`OperationalHeader`, `OperationalBottomNav` and the shared `OperationalIdleLogoutHandler`; the
**branch switcher** in a new **optional** header slot, sourced from `me.memberships` (zero extra
requests), persisted at `nimbus.managerBranchId`, driving `X-Branch-Id` on every Manager read and
invalidating **only** the `["manager"]` query namespace; `isManagerCompatible()` +
`getManagerLandingPath()` and all four `login.tsx` call sites; a **surface allow-list**
(`lib/manager/permissions.ts`, not a permission check); six honest foundation pages plus a real
Manager **Me** built solely from the already-fetched `/api/auth/me`; and a fourth navy-family role
accent (`--color-role-manager` `oklch(0.36 0.06 324)`, white-on-solid **11.18:1**).

**Icon registry grew by 6, not 5** — the five tab icons (`overview` ChartLineUp, `operations`
ListChecks, `staff` UsersThree, `reports` FileText, `settings` GearSix) plus `caretDown` for the
switcher affordance; `branch` (Storefront) is reused as M-P0 recommended.

**Readiness strip ships three chips only** — Branch (memberships), Reports
(`GET /reports/catalog` → `24 of 37 generators ready`), Devices (`GET /devices` → branch-scoped
total). **Tills, shifts, and pending-approvals chips are omitted**, not faked (GO condition 3).

**Validation:** typecheck + lint pass (`next build` deliberately not run in the dev QA sandbox and
said so); `manager-p1-assertions.ts` plus **11/11** existing assertion scripts pass
(`shell` + `profile` extended to four roles); Playwright `e2e/manager-shell/` **92/92** across all
four viewports; cross-role regression **68/68**; live manager browse at 1440×900 + 1024×768 with
branch switch, persistence across reload, and captured `X-Branch-Id` change; Waiter/Cashier/
Supervisor re-verified live (unchanged landings, navs, headers — no switcher). `GET /api/health`
`ok`; `git diff --check` clean of new issues; **no commit, no push**.

**Findings recorded, not implemented:** the shared guard's "Return to login" can lose its
`reason` query to the guard's own session effect (pre-existing in all four role guards); the header
branch label truncates at 1024×768; the switcher drops a `(default)` suffix in favour of a badge on
Me. See the completion report §14.

**Type:** frontend implementation. The foundation every later phase mounts on.

### Scope

- Add `"manager"` to `OperationalRole` (`components/pos-shell/types.ts`) and register
  `managerRoutes` in `components/pos-shell/role-navigation.ts` — Manager becomes the **4th
  registry consumer**.
- Create `apps/web/src/lib/manager/routes.ts` with **exactly six** nav items: Overview, Operations,
  Staff, Reports, Settings, Me — icons referenced **by name** from the canonical registry (add the
  new names to `role-icon-config.ts` + `role-icons.ts`; `approvals`, `floor`, `me`, `branch` etc.
  already exist).
- `ManagerShell` + `ManagerSessionGuard` (`components/manager/shell/`), modelled on
  `CashierShell`/`CashierSessionGuard` and `SupervisorShell`/`SupervisorSessionGuard`, wrapping the
  shared `OperationalShell`/`OperationalHeader`/`OperationalBottomNav` and injecting the shared idle
  handler.
- **Login routing:** add `isManagerCompatible()` + `getManagerLandingPath()` to
  `apps/web/src/lib/auth/role.ts` (mirroring `isCashierCompatible` / `isSupervisorCompatible` —
  match on `jobRole === "MANAGER"`, and decide explicitly whether `roleName === "MANAGER"` also
  counts, as the cashier/supervisor helpers do) and wire the branches in `pages/login.tsx`
  (currently four call sites at lines ~112, ~115, ~160, ~170). Landing path is `/manager/overview`.
- **Branch switcher** (MANAGER-GAP-001, the one genuinely new shell affordance): a header control
  listing branches from `me.memberships`; selecting one updates the Manager context, persists to
  `localStorage` under `station_branch_id`, and **re-fetches every branch-scoped query** through
  narrow, targeted invalidation (MANAGER-GAP-016 — never a blanket `queryClient.clear()`, never
  invalidate auth/profile). The selected branch must flow into `X-Branch-Id` on every request
  (`lib/api/client.ts:151`).
- `lib/manager/context.ts` — one central Manager context (branch, org, permissions), modelled on
  `lib/cashier/context.ts` / `lib/supervisor/context.ts`. Resolve initial branch from
  `station_branch_id` → `context.defaultBranchId` → first membership.
- Page **stubs** at `pages/manager/{index,overview,operations,staff,reports,settings,me}.tsx`
  (`/manager` → `/manager/overview` redirect). Stubs render honest "not yet implemented" states —
  **no placeholder fake data**.
- Readiness strip skeleton per `MANAGER_NAV_AND_PAGE_MAP.md` §3 — but only chips whose data M-P0
  proved. **A chip with no verified source is omitted, not faked.**

### Out of scope

Any live data on Overview/Operations/Staff/Reports/Settings (those are M-P2…M-P6). Any write
action. Any approvals decision. Any permission change. Forking the shell.

### Key files

**New:** `apps/web/src/lib/manager/{routes,context,permissions,state}.ts`,
`apps/web/src/components/manager/shell/{ManagerShell,ManagerSessionGuard,ManagerBranchSwitcher,index}.tsx`,
`apps/web/src/pages/manager/*.tsx`, `apps/web/scripts/manager-p1-assertions.ts` (+ its tsconfig),
`apps/web/e2e/manager-shell/`.
**Modified (shared — regress all roles):** `components/pos-shell/{types.ts,role-navigation.ts,role-icon-config.ts,role-icons.ts}`,
`components/pos-shell/OperationalHeader.tsx` (branch switcher slot), `lib/auth/role.ts`,
`pages/login.tsx`.

### Validation gates

- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck | lint | build` — all pass.
- New `manager-p1-assertions.ts` proves: exactly six nav items in the locked order; landing is
  `/manager/overview`; no More/Approvals tab; every icon resolves through the registry; the
  branch switcher is present in the header.
- Existing `shell-assertions.ts`, `floor-assertions.ts`, `profile-assertions.ts`,
  `cashier-c1/c2-assertions.ts` still pass (shared files were touched).
- **Playwright 4-viewport matrix** (`vp-1024x768`, `vp-1366x768`, `vp-1440x900`, `vp-1920x1080` —
  `apps/web/playwright.config.ts`): new `e2e/manager-shell/` specs **plus** cross-role regression
  (`e2e/cashier-floor/`, `e2e/supervisor-prompt3/`).
- **Isolated-DB rule:** all browser/mutation QA on an isolated local Postgres 16 stack via the
  `tools/qa/` fail-closed launcher (denylist → DB-identity preflight → spawn). **Never shared
  Neon.** Prove shared Neon untouched.
- `GET /api/health` returns `ok`. `git diff --check` clean. No commit/push.

### Locked constraints it must respect

Six-tab nav exactly; no More tab; no Approvals tab; landing `/manager/overview`; branch switcher
required and driving `X-Branch-Id`; shared shell consumed via thin adapters, never forked; icons via
registry only; brand tokens only; no fake data in stubs; no backend/permission change.

**Completion result:** a Manager can log in, land on `/manager/overview`, navigate six tabs, switch
branch, and be idled out — with no fabricated content anywhere.

---

## M-P2 — Overview dashboard

> ⛔ **SUPERSEDED 2026-08-20 → `ai/ENTERPRISE_UI_ROADMAP.md` Track B (B1 shell, then B2 Overview).**
> M-P2's Overview scope moves to **B2**, extended with the Odoo KPI-card-grid pattern (counts as
> drill-in links, amounts as data, mixed-weight buttons, checklist-instead-of-chart) and preceded by
> **B1**, the top-nav shell conversion the dashboard now mounts inside. The four M-P0 non-negotiables
> below (MP0-02 tills/shifts counts only, MP0-05 client-side approval filtering, MP0-07 SSE reader,
> MP0-10 gross/net qualification) are carried into B2 verbatim. **Plan from Track B, not from here.**

> ⛔ **DO-NOT-START GATE (2026-08-20).** M-P1 is complete and M-P2 is **NEXT**, but it must **not**
> begin without explicit owner authorization. When authorized, M-P2 inherits four non-negotiables
> from M-P0: tills/shifts are **counts only** (`/api/tills` + `/api/shifts` do not exist, MP0-02);
> approval counts must be **filtered client-side** before display (`/api/approvals` is only partly
> branch-scoped, MP0-05); SSE needs a **`fetch` + ReadableStream** reader because `EventSource`
> cannot carry `Authorization` + `X-Branch-Id` (MP0-07); and `gross`/`net` must be qualified
> because the backend's `netSales` is tax-inclusive while `grossSales` is not (MP0-10). Every
> branch-scoped query must take its `branchId` from the M-P1 Manager branch context and use the
> `["manager", …]` key namespace so the switcher keeps re-scoping the whole surface.

### Scope

- KPI cards and widgets from `managerui.md` §5, **restricted to what M-P0 proved
  `/api/dash/manager` and the `/dash/*` reads actually return**: gross sales, net sales, open
  orders, active tills, active shifts, pending approvals, low stock, anomalies.
- Widgets: payment mix, open-orders snapshot, low-stock snapshot, pending-approvals snapshot,
  active shifts/tills coverage, live-stream status.
- **Approval counts** (approved for Overview) sourced from the read surface — `GET /api/approvals`
  is permitted for Manager and is acceptable **for counts/read**. Counts link into the surface that
  owns the decision (Operations or Staff); Overview itself decides nothing.
- **SSE `/api/stream/metrics`** with a truthful **degraded** state (MANAGER-GAP-015): "Live stream
  unavailable — showing latest fetched data." Never a spinner that implies live data, never a
  broken-looking dashboard.
- All five honest states from `managerui.md` §5: loading skeleton, empty, failure, degraded stream,
  no-branch.
- `POST /api/dash/kpi/refresh` behind an explicit confirmation + in-flight lock (per the pack
  matrix §3).

### Out of scope

Every other tab. Any approval **decision**. Any KPI not backed by a verified response field —
**an unproven metric is omitted, not estimated and not mocked**. Owner/franchise/global financials.

### Key files

`components/manager/overview/*`, `lib/manager/{dashboard,dashboard-query-keys,stream}.ts`,
`pages/manager/overview.tsx`.

### Validation gates

typecheck / lint / build; `manager-p2-assertions.ts` (every rendered KPI maps to a verified response
field; degraded-stream state renders when SSE fails); Playwright `e2e/manager-overview/` × 4
viewports including a **forced SSE failure** case; isolated-DB rule; branch-switch re-fetch proven;
no request storm (respect the performance-preservation rules); `git diff --check` clean; no
commit/push.

### Locked constraints

Approval **counts** only — no decisions on Overview. No fake metrics. No Owner-scope financials.
Brand tokens. Shared shell.

**Completion result:** Overview shows real, branch-scoped, truthful branch health.

---

## M-P3 — Operations oversight (read-only)

### Scope

- Read-only sections: floor/table status, active orders table, tills table, active shifts table,
  reservations snapshot, operational exceptions (`managerui.md` §6).
- Row shapes per `managerui.md` §6 (order / till / shift rows) with **`View detail`** as the only
  action — read-only detail panels.
- If a Floor-like table view is used, it renders the shared **`OperationalFloor` read-only** (same
  toolbar/grid/cards/status labels/`First L.` formatting/breakpoints/176px cards). **No
  `ManagerFloor*` fork.** Guest names never on Floor cards.
- Bounded, branch-scoped queries with server pagination; search/filter/sort per `managerui.md` §6
  only where M-P0 proved the backend supports it.
- **Approval escalation placement** (approved: "Refund/discount/void escalation in Operations or
  action prompt — include after verification"). Under the read-only decision the safe reading is:
  Operations may **surface** an escalation and route to its decision affordance, but any decision
  **write** is gated on M-P0 having verified the domain DTO, uses a **domain-specific** route
  (`/pos/discounts/:id/approve|reject`, `/pos/refunds/:id/approve`,
  `/pos/orders/:id/post-close-void`), and carries a confirmation + in-flight lock + honest audit
  result. **If M-P0 did not verify the DTO, ship the read-only surface and defer the write.**
  ⚠️ This is the one place where "Operations is read-only" and "escalations live in Operations"
  are in tension — resolve it in this direction, explicitly, in the completion report.

### Out of scope

**Any cashier-checkout clone, tender panel, or payment collection. Any waiter order builder or menu
entry. Any order close. Any table-status mutation. Any KDS.** Discount *request*, void of an active
order, transfer, split/merge/move — all Supervisor/Cashier territory, not Manager MVP.

### Key files

`components/manager/operations/*`, `lib/manager/{operations,operations-query-keys}.ts`,
`pages/manager/operations.tsx`; consumes `components/floor/OperationalFloor.tsx` read-only.

### Validation gates

typecheck / lint / build; `manager-p3-assertions.ts` asserting **no checkout/tender/order-builder
control renders on any Operations surface** and that the shared Floor is consumed unforked;
Playwright `e2e/manager-operations/` × 4 viewports + **cross-role Floor parity regression** (Waiter,
Cashier, Supervisor) because shared Floor is in play; isolated-DB rule; bounded-query proof (no
unbounded `pageSize`); `git diff --check` clean; no commit/push.

### Locked constraints

Read-only oversight. No checkout/order-entry clones. Shared Floor never forked. Guest names off
Floor cards. Domain-specific routes if any decision write ships.

**Completion result:** Manager can inspect all active branch service without becoming a Waiter or a
Cashier.

---

## M-P4 — Staff administration

### Scope

- Staff directory + detail drawer using a **frontend safe-field whitelist** built from M-P0's
  recorded response fields (MANAGER-GAP-004): name, role/jobRole, branch, status, linked-user
  state, PIN status. Contact detail only if M-P0 proved it is safe and the DTO allows.
- **Frontline onboarding** (`POST /api/hr/frontline-staff/onboard`) with confirmation. If the
  response returns a one-time secret, handle it deliberately — masked, copy-once, with expiry
  instructions (MANAGER-GAP-005). Never log it, never persist it.
- **Quick PIN admin** — status / reset / disable / enable, each behind `ActionConfirmDialog` with
  the staff + branch context named, an honest audit result, and no blind retry (MANAGER-GAP-006).
- **Attendance** timeline (read).
- **Leave review** — `PATCH /hr/leave/:id/review`, approve/reject. **Make no payroll or roster
  claim** (the Supervisor precedent).
- **Shift-swap review** — `PATCH /hr/shift-swaps/:id/approve`. ⚠️ **Gated on M-P0's finding.** If
  `ScheduleAssignment` is still read-only across the API (SUP-RG-036/042), an "approve" mutates
  **zero** roster rows. In that case Manager must follow the Supervisor **Outcome C** precedent —
  say so honestly in the UI and **do not present an Approve control that implies a roster change**.
  The approved scope is "shift-swap review", which an honest reject-only + truthful-notice surface
  satisfies. Record the decision explicitly.
- Sensitive-fields exclusion card (`managerui.md` §7) stating plainly what Manager cannot see.

### Out of scope

**Compensation, contracts, payroll, pay runs, payslips, bank details, tax IDs, private HR notes —
excluded and not fetched.** `GET/POST /api/hr/contracts` stay **Deferred** in the matrix. No
Owner/Admin permission matrix. No role/permission editing.

### Key files

`components/manager/staff/*`, `lib/manager/{staff,staff-safe-fields,quick-pin,leave,shift-swaps}.ts`,
`pages/manager/staff.tsx`; reuses `pos-shell/ActionConfirmDialog.tsx` + `lib/pos-shell/idempotency.ts`.

### Validation gates

typecheck / lint / build; `manager-p4-assertions.ts` asserting the safe-field whitelist is
**allow-list** (not deny-list) and that no compensation/contract/bank/tax key can reach a rendered
component; Playwright `e2e/manager-staff/` × 4 viewports covering PIN confirm/cancel, onboarding
confirm/cancel, leave approve/reject, and the shift-swap path as decided; **live mutation matrix on
an isolated disposable DB** (duplicate-submit, wrong-branch, stale-record cases) — never shared
Neon; roster-integrity check (0 `ScheduleAssignment` rows changed) if a swap decision ships;
`git diff --check` clean; no commit/push.

### Locked constraints

No compensation/contracts/payroll exposure. No real PII. Confirmations on every write. No fake
success state — including no implied roster change. Domain endpoints only.

**Completion result:** Manager can run frontline staff operations safely, with payroll and
compensation provably out of reach.

---

## M-P5 — Reports

> **AMENDED 2026-08-20 (M-P0 GO condition 4 — read this before planning M-P5).** Three premises in
> the section below were disproved by the M-P0 live audit and the scope shrinks materially:
>
> - **MANAGER-GAP-009 is DISPROVED (MP0-16).** All 24 generator DTOs are
>   `{reportWindow, dateFrom?, dateTo?, parameters?}`; only `top-items` adds `limit?`. **A single
>   generic generate form is DTO-correct** — the "template-aware forms, generic form explicitly
>   rejected" wording below is superseded.
> - **Export is CSV-only (MP0-03).** `POST /reports/export` with `format: PDF` returns a plain-text
>   file stamped `application/pdf` at `status: READY` — a fake success state already in the
>   backend. M-P5 offers **CSV only** and never renders a PDF download.
> - **`GET /reports/:id` returns NO rows (MP0-08)** — only `summary` + `rowCount`. The "detail
>   rendered as a readable table … row shape per `managerui.md` §8" requirement is **not
>   buildable**; render the `summary` as a key/value panel and **do not fabricate a row table**.
>
> Also note MP0-12: report reads are looked up by `orgId` only, so a run from another branch is
> readable — always display the row's own `branchId` and never link into a run outside the active
> branch.

### Scope

- **Catalog** — `GET /api/reports/catalog`, driving the generate forms.
- **Generate** — **template-aware forms built from M-P0's verified per-template DTOs**
  (MANAGER-GAP-009). A single generic form is explicitly rejected. Cover the generators M-P0
  confirmed Manager holds; the matrix's 17 rows are a **subset** of what the controller exposes, so
  reconcile against the M-P0 enumeration rather than the draft matrix.
- **History** — `GET /api/reports` (bounded pagination) and **detail** — `GET /api/reports/:id`
  rendered as a readable table, with row shape per `managerui.md` §8.
- **Export/download** — `POST /api/reports/export` then `GET /api/reports/exports/:id/download`,
  with the full honest state set: ready / generating / failed / **generator unavailable** /
  downloaded.
- **Generator-unavailable state is mandatory** (MANAGER-GAP-008): if the generator binaries are
  absent the UI says so truthfully and offers no download.

### Out of scope

**Fake PDF/Excel downloads. Any client-side fabricated file. Any success state on a failed
generate/export.** SaaS invoices. Owner/franchise consolidated reporting. Scheduled/emailed report
delivery (no verified adapter).

### Key files

`components/manager/reports/*`, `lib/manager/{reports,report-templates,report-query-keys}.ts`,
`pages/manager/reports.tsx`.

### Validation gates

typecheck / lint / build; `manager-p5-assertions.ts` asserting **every** generate form's payload
shape matches its verified DTO and that **no code path synthesizes a file client-side**; Playwright
`e2e/manager-reports/` × 4 viewports including a **forced generator-unavailable** case and a failed
export; live generate+export matrix on an **isolated disposable DB**; `git diff --check` clean; no
commit/push.

### Locked constraints

Fake downloads forbidden. DTO-verified generation only. Truthful failure states. Branch-scoped via
the switcher.

**Completion result:** Manager can generate, review, and export real reports, and is told the truth
when the generator cannot.

---

## M-P6 — Settings, Me, and closure QA

### Scope

**Settings**
- **Branch profile** — `GET /api/branches`, `PATCH /api/branches/:id` (name/address/phone/active)
  with confirmation.
- **Device registry** — `GET /api/devices`, `POST /api/devices/activate`.
- **Printer routes** — `POST /api/devices/printers/routes`, **metadata-only**, with copy that says
  so. **No print-driver invocation and no print-success claim.**
- **Terminal pairing** — `POST /api/devices/terminals/pair`, **stub-only**, labelled as a stub.
  **No acquirer/card-terminal traffic.**
- **Alert rules** — **deferred or read-only** (MANAGER-GAP-010). No visual rule builder.
- **Sync jobs** — read-only history; **conflict diff deferred** (MANAGER-GAP-011).
- **Owner/Admin + SaaS billing excluded** — these render no path, layout, or menu entry.

**Me**
- Profile, session, branch memberships, active-branch shortcut, permission summary, restricted
  surfaces, known limitations, logout — reusing `components/profile/` primitives and the shared
  logout.

**Closure QA**
- Continuous Manager journey on fail-closed isolated infrastructure, all four viewports.
- Full **cross-role regression**: Waiter, Cashier (at whatever C-phase is then current — C3 runs in
  parallel), Supervisor. Shared Floor + shell parity verified.
- Role/privacy/branch-isolation boundaries verified: Manager cannot reach payroll, compensation,
  contracts, Owner/Admin, SaaS billing, franchise, or developer surfaces; branch switching does not
  leak cross-branch data.
- Reconcile every Manager limitation; write the demo script, demo-data register, QA evidence index,
  and the canonical completion report; prove shared Neon unchanged; tear down disposable
  infrastructure.

### Out of scope

Alert rule authoring. Sync conflict diff/resolution UI. Owner/Admin settings. SaaS billing.
Franchise. Developer keys. Any live hardware traffic.

### Key files

`components/manager/{settings,me}/*`, `lib/manager/{settings,devices}.ts`,
`pages/manager/{settings,me}.tsx`; reuses `components/profile/*`.

### Validation gates

typecheck / lint / build; `manager-p6-assertions.ts` asserting no owner/billing/franchise/developer
route or menu entry exists and that printer/terminal copy carries the metadata/stub caveat;
Playwright `e2e/manager-*` full suite × 4 viewports + full cross-role regression; live settings
mutation matrix on an **isolated disposable DB** (branch patch, device activate, printer route,
terminal pair — asserting stub behaviour, not fabricated success); `GET /api/health` ok; shared Neon
proven byte-for-byte unchanged; every Postman collection still parses with an empty contract diff;
`git diff --check` clean; no commit/push.

### Locked constraints

All of §2. Plus: printer metadata-only, terminal stub-only, alerts deferred/read-only, sync diff
deferred, owner/billing excluded.

**Completion result:** Manager reconstruction closed as demo-ready **or honestly classified** with
known limitations — never overclaimed.

---

## 5. Phase dependency graph

```text
M-P0 audit / API + permission verification
  ↓
M-P1 shell · nav · session guard · branch switcher   ← foundation for everything below
  ↓
M-P2 Overview (KPIs, approval counts, SSE degraded state)
  ↓
M-P3 Operations oversight (read-only, shared Floor)
  ↓
M-P4 Staff (directory, onboarding, PIN, leave, swaps)
  ↓
M-P5 Reports (catalog, generate, history, export)
  ↓
M-P6 Settings + Me + integrated closure QA
```

M-P2 … M-P5 are strictly sequential here for gate clarity; each still depends only on M-P1 plus its
own M-P0 verifications, so a phase may be resequenced **only** by explicit owner decision.

> **2026-08-20 — the graph above is historical from M-P2 down.** The live dependency diagram is in
> `ai/ENTERPRISE_UI_ROADMAP.md` §4: `M-P0 → M-P1 → B1 (top-nav shell) → {B2 Overview, B3
> Operations+Staff, B4 Reports, B6 Settings} → B7 Owner`, with `B0` (accounting/settings API
> verification) running in parallel with B1 and hard-gating **B5** (the accounting suite), and
> Track C backend gaps hard-gating B3's staff directory (C-02) and B4's graph/pivot (C-03).

## 6. Scope locks across all prompts

- Manager nav stays **Overview · Operations · Staff · Reports · Settings · Me**.
- **No Approvals bottom tab.** **No More tab.**
- The shared shell and shared Floor are **never forked** — Manager is the 4th consumer.
- Icons only via the canonical registry; the `NimbusLogomark` brand mark is the one documented
  exception.
- Brand tokens only — no hard-coded hexes, no pre-Aug-2026 palette.
- Guest names never appear on Floor cards.
- Compensation / contracts / payroll never rendered, never fetched.
- Domain-specific decision routes preferred over generic approvals decide.
- **No fake success states** — no fake downloads, no fake print/terminal/receipt success, no fake
  metrics, no implied roster change.
- No backend / DTO / schema / migration / seed / permission / Postman change without explicit
  authorization.
- No destructive QA against shared Neon.
- No commit/push unless explicitly instructed.
- Cashier and Manager run in parallel — **coordinate before touching shared files.**

## 7. Expected artifacts per prompt

Each phase must produce:

- a focused completion report from `ai/AI_COMPLETION_REPORT_TEMPLATE.md`;
- updated gap/status documentation (`ai/AI_STATUS.md`, `PROGRESS.md`, and
  `repo file tree.txt` if structure changed);
- focused assertion scripts and Playwright specs;
- honest QA evidence (an evidence index; failures reported with command + exact output per
  `ai/AI_ERROR_PROTOCOL.md`);
- the **next** prompt spec, written only after the current gate passes.

## 8. Known contradictions between the pack docs and the locked decisions

Recorded here so no phase silently resolves one the wrong way.

| # | Contradiction | Resolution under the locked decisions |
| --- | --- | --- |
| 1 | `MANAGER_LIFECYCLE.md` §8 (both copies) and `MANAGER_FEATURE_SCOPE.md` §3 describe a **"unified approvals inbox"** committing decisions via `POST /api/approvals/:id/decide`. | Owner **prefers domain-specific decision routes** (Option B). Generic route allowed only where the DTO mapping is provably clear. Use the generic endpoints for **read/counts**; route **writes** to domain endpoints. Recorded in the `MANAGER_API_MATRIX.md` header annotation + row annotations, and in the `MANAGER_LIFECYCLE.md` header note. |
| 2 | `managerui.md` §11 places order/void/refund/discount **escalations in Operations**, while the Operations decision is **read-only oversight**. | Operations may **surface** escalations and route to a decision; any decision **write** is DTO-verified, domain-specific, confirmed, and in-flight-locked — otherwise ship read-only and defer. Resolved explicitly in M-P3, to be restated in its completion report. |
| 3 | `MANAGER_NAV_AND_PAGE_MAP.md` §5 defines an **8-prompt sequence** with a separate *Prompt 7 — Approval Action Hardening*; the pack `README.md` lists **9 phases**. | Superseded by this roadmap's **M-P0 … M-P6**. Approval hardening is not a standalone phase — it is folded into M-P2 (counts), M-P3 (escalation), and M-P4 (leave/swap), each with its own gate. Noted in `docs/manager-ui-docs/README.md`. |
| 4 | `docs/manager-ui-docs/MANAGER_GAP_REGISTER.md` GAP-06 proposes **"mock/stub downloads in test scenarios"**. | **Directly contradicts the locked "fake downloads forbidden" decision.** The approved behaviour is a truthful generator-unavailable state (the pack's MANAGER-GAP-008 already says this). Flagged in that file's header note; the row body was not rewritten. |
| 5 | `MANAGER_FEATURE_SCOPE.md` §4 lists **"approve/reject shift swaps"** as a Manager capability. | Gated on M-P0 re-confirming the Supervisor finding (SUP-RG-036/042) that `ScheduleAssignment` is read-only API-wide and an approve mutates zero roster rows. If it holds, follow the Supervisor **Outcome C** precedent: honest notice, no Approve control implying a roster change. Recorded in M-P4. |
| 6 | The Cashier roadmap's scope lock still says **"no Manager UI before C6 closure"**, and `CLAUDE.md`/`PROGRESS.md` still describe Manager as blocked until C6. | **Replaced by the 2026-08-20 owner decision** — Cashier C3 is authorized in parallel and Manager is unblocked. Recorded in §0 above, in the decision register's header note, and in `docs/manager-ui-docs/README.md`. |
| 7 | `MANAGER_API_MATRIX.md` lists **17** report generators; the live controller exposes more (`open-closed-orders`, `cash-movements`, `reservation-deposits`, `reservation-no-shows`, `event-bookings`, `event-checkins`, `high-risk-actors`). It also documents `POST /api/reports/export` behind a **read** permission (`pos:reports:exports:read`). | Not a decision conflict but a **draft-vs-reality gap**. Both are explicit M-P0 verification items; the matrix body is annotated, not rewritten. |

## 9. Reference set

- Decisions (locked): `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`
- Nav/pages: `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_NAV_AND_PAGE_MAP.md`
- Scope: `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_FEATURE_SCOPE.md`
- Blueprint: `Front End/manager_ui_full_docs_pack/manager-ui-docs/managerui.md`
- Lifecycle: `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_LIFECYCLE.md` (full) ·
  `docs/manager-ui-docs/MANAGER_LIFECYCLE.md` (condensed)
- API: `docs/manager-ui-docs/MANAGER_API_MATRIX.md`
- Gaps: `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_GAP_REGISTER.md` (18 rows)
- Orientation: `docs/manager-ui-docs/README.md`
- Precedents: `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md`,
  `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`,
  `docs/supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md` (Option B)
- Brand: `docs/BRAND_IDENTITY.md` · Shared UI: `docs/UI_SYSTEM.md` · QA: `docs/TESTING_AND_QA.md`
