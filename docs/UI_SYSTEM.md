# UI_SYSTEM.md — Nimbus POS shared operational UI

> The visual + structural system for the operational role apps (Waiter, Cashier,
> Supervisor). Companion to `PRODUCT.md` (product/design principles) and
> `ARCHITECTURE.md` (system shape). Code lives in `apps/web/src/components/`.

> **Supervisor final closure (2026-07-31):** the shared-first architecture below (one Floor, one
> shell, one idle handler, one icon registry across all three roles) was verified intact by
> cross-role regression specs at all four viewports in the final integrated QA pass — no shared
> component was forked or diverged. See
> `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`.

> **Prompt 5B2 (2026-07-31):** The Approvals workspace's shift-swap + anomaly detail panels gained
> decision controls (reject; acknowledge/resolve) reusing the same shared `ActionConfirmDialog` +
> `ToastProvider` — no new component families. Shift-swap deliberately exposes no Approve control
> (Outcome C), demonstrating the system's honest-affordance principle: the UI never renders an action
> it can't truthfully perform.
>
> **Prompt 5B1 (2026-07-30):** The Supervisor **Approvals** page adopts the premium master-detail
> pattern (mirroring Reservations): a queue column + a sticky detail panel that stacks on narrow
> viewports (`xl:grid-cols-[minmax(0,1fr)_460px]`, one detail workspace). It reuses shared primitives
> — `ActionConfirmDialog`, `ToastProvider`, `Badge`/`Button`/`Card`/`Skeleton`/`StatusMessage` — and
> a single identity-safe queue-row shell for all four approval domains. Scope tabs + domain filter
> use accessible `role=tablist`/`aria-pressed`; status/severity convey via labelled badges (not
> colour alone). Components: `components/supervisor/approvals/workspace/*`.

## 1. Principle: shared-first

Equivalent UI concepts across roles are implemented **once** as shared primitives
and consumed via thin per-role adapters. Never fork a per-role copy of a shared
concept. When you change a shared component, verify **every** consuming role.

Three shared trees:

- `components/pos-shell/` — shell, header, bottom nav, clock, idle handler, icons.
- `components/floor/` — the table Floor (toolbar, grid, cards, status, workspace frame).
- `components/profile/` — the "Me"/profile presentation primitives.

## 2. Shared operational shell

`OperationalShell` is a fixed-region layout: fixed header (top), a readiness strip
below it, a scrolling `main` with generous top padding and a
`pb-[calc(7rem+safe-area-inset-bottom)]` bottom pad so content clears the fixed
bottom nav, and a fixed `OperationalBottomNav`. Max content width `1600px`.

Each role shell (`WaiterShell`/`CashierShell`/`SupervisorShell`) wraps a role
`SessionGuard` around `OperationalShell` and injects four slots: `header`,
`readiness`, `bottomNavigation`, `idleHandler`.

- **Header** (`OperationalHeader`): role identity, branch/workstation/service-area
  context (`BranchContextLabel`, `RoleIdentity`), shared `CurrentTime`, and the
  shared logout. Role headers are thin adapters.
- **Bottom nav** (`OperationalBottomNav`): renders the role's nav items from
  `getOperationalRoleNavigation(role)`; active item uses the `fill` icon weight,
  inactive uses `bold`.
- **Clock** (`CurrentTime`): shared, updates on an interval (coarse granularity is
  intentional).

## 3. Navigation (locked)

Nav is registered centrally in `pos-shell/role-navigation.ts`, sourced from each
role's `lib/<role>/routes.ts`:

| Role | Tabs |
| --- | --- |
| Waiter | **Floor · Reservations · Me** (Floor stays active on `/waiter/orders*`) |
| Cashier | **Floor · Till · Me** (Prompt C1+C2, 2026-07-31; default `/cashier/floor`) |
| Supervisor | **Floor · Reservations · Approvals · Me** |

There is **no Orders tab** for Waiter or Supervisor. Legacy Orders routes are
redirect-only.

✅ **Cashier is Floor-first (Prompt C1+C2 implemented 2026-07-31):** the visible nav is
**Floor · Till · Me** (Queue/Receipts removed from the nav), default route `/cashier/floor`
(with `/cashier` redirecting there), and Cashier is the **third shared-`OperationalFloor`
consumer** alongside Waiter/Supervisor. The Floor tab uses the same canonical `floor` icon.
**C2** added, behind a table selection, table→bill resolution (zero/one/multiple, fail-closed, no
silent first-pick), ONE **read-only** `CashierSettlementWorkspace` reusing the checkout primitives,
canonical `?tableId=&orderId=` URL state, and a Cashier-only **Find bill** sibling above the shared
Floor (payment/close execution is C3). Queue/Receipts survive only as **hidden compatibility
routes** (direct URL, retire C4/C5). See `docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md`,
`ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`, and
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`.

## 4. Canonical icon registry

Single source of truth in `pos-shell/`:

- `role-icon-config.ts` — the name constants (`operationalIconNames`), the
  `OperationalIconName` type, and canonical **sizes** (`bottomNavigation: 24`,
  `compactAction: 18`, `pageState: 32`) and **weights** (`activeNavigation: "fill"`,
  `inactiveNavigation: "bold"`, `default: "bold"`, `brand: "duotone"`).
- `role-icons.ts` — maps each name → a concrete Phosphor component.

Rules: reference icons **by name** only; never import Phosphor directly in
routes/screens; always apply the registry size/weight tokens.

## 5. Shared operational Floor

`OperationalFloor` composes `OperationalFloorToolbar` + `OperationalTableGrid`;
the grid renders `OperationalTableCard`, which renders `OperationalTableStatusBadge`.
Waiter, Supervisor, **and Cashier (Prompt C1, 2026-07-31)** render the **same**
`OperationalFloor` (generic over `OperationalTableViewModel`; each role passes a
role-specific view model that extends it). **Role behaviour diverges only AFTER
table selection:** Waiter → menu/order workspace; Supervisor → read-first
table-control workspace; Cashier → a **read-only, truthful settlement boundary**
(`CashierSelectedTablePanel`, copy "Select a bill to continue.", exposing no
payment/close/split/refund/receipt action) that C2 replaces with the real
settlement workspace. Cashier's Floor reads only shared-safe data (tables + active
orders + reservations) and shows no guest name/contact/payment/receipt reference on
cards.

- **Cards** are a fixed `min-h-[176px]`, show table label, status badge, a status-
  specific middle (ready / reservation time / assigned staff + "Mine" / temporarily
  unavailable), and a capacity footer. Cards **never** expose guest names.
- **Staff names** are formatted `First L.` (e.g. "Peter M.") via
  `floor/formatters.ts` (`formatOperationalStaffName` / `formatOperationalStaffIdentity`),
  shared by both role floor models.
- **Status labels** come from the shared `operationalTableStatusLabels`.
- On table selection, both roles mount `OperationalTableWorkspaceFrame`; the frame
  is shared, the **contents differ by role** (Waiter → menu/order/reservation
  builder; Supervisor → read-first `SupervisorTableControlWorkspace`).

**Invariant:** default Floor geometry (toolbar, grid, card height, breakpoints,
status/staff formatting) is identical across roles at every viewport. Any change
here propagates to all consuming roles by design.

## 6. Shared profile primitives

`components/profile/*` (+ `lib/profile/profile-model.ts`) provide the "Me" building
blocks: `RoleProfileHero`, `ProfileSection`, `ProfileMetaGrid`, `SessionCard`,
`ShiftStatusCard`, `OperationalStatusBadge`, `CapabilityNotice`,
`CompactUnavailableState`, plus `roleAccentMap`/`getRoleAccent`,
`getProfileInitials`, `formatProfileDateTime`. Consumed by all three role
`MeScreen`s (and the headers reuse `getProfileInitials`). Presentation is shared;
each role keeps its own queries/mutations/permissions. Long shifts are presented
truthfully (no fabricated durations).

## 7. States, tone, and semantics

- **Status colours** are semantic (available / occupied / reserved / blocked;
  neutral / info / success / warning / danger surfaces) via Tailwind tokens
  (`bg-status-*`, `text-text-*`, `shadow-*`). Do not hard-code hex.
- **Loading / empty / error** use shared primitives (`StatusMessage`,
  `OperationalFloorErrorState`, `CompactUnavailableState`) — keep presentation
  consistent across roles.
- **Manager-configured taxonomy** (menu navigation): honour manager order/active
  state; **never hard-code fallback categories**. An empty navigation shows an
  honest "manager configuration" empty state.
- **Currency:** UGX with zero-fraction rendering via the shared waiter currency
  formatter and branch currency context; money is Decimal strings end-to-end.

## 8. Interaction & accessibility

- Cards/buttons expose meaningful `aria-label`s (label + status + capacity) and
  `aria-pressed` for selection; visible and accessible labels must agree.
- Target a11y contrast; visible focus (`focus-visible` shadow). Respect reduced
  motion where animations are used.
- Table/order context is URL-backed so Back/Forward behave; no duplicate mounted
  responsive variants of the workspace.

## 8b. Supervisor Reservations master-detail workspace (Prompt 4B, 2026-07-28)

The old read-only Supervisor Reservations surface (six components:
`SupervisorReservationCard/List/Summary/Toolbar/DetailPanel/StatusBadge`) is
**removed** and replaced by a premium **master-detail** workspace under
`apps/web/src/components/supervisor/reservations/`. New components:

- `SupervisorReservationViewSelector` — switches the four UI **views** (Arriving,
  Seated, Attention, History; groupings, **not** new persisted statuses).
- `SupervisorReservationRow` — list row; shows the guest **name only** (no phone/
  email/raw ids — contact detail lives in the workspace/create form).
- `SupervisorReservationsDateToolbar` — operational-date + range navigation.
- `SupervisorReservationTableSelect` — bounded table picker for assign/seat.
- `SupervisorReservationWorkspace` — the detail pane (context, deposits read-only,
  lifecycle actions).
- `SupervisorCreateReservationDialog` — create form (optional `depositRequired`
  amount only; no payment/deposit capture).
- `SupervisorReservationLifecycleDialogs` — confirm/assign/seat/cancel/no-show/
  complete confirmations.

State is **URL-persisted** (view, date, page, status, from, to, selected id) so
Back/Forward/refresh are stable. Arriving/Seated/Attention derive from **one**
bounded `scope=active` query; History is a lazy `scope=history` query. Shared
shell/Floor/profile primitives and the locked nav (Floor · Reservations · Approvals
· Me) are **unchanged**; supporting logic lives in `lib/supervisor/reservations.ts`
(mutations, view grouping, attention derivation, action availability, cache
invalidation, date nav).

## 9. Known UI inconsistencies (recorded, not yet fixed)

These are functional/architectural inconsistencies out of scope for a UI-polish
pass (they touch session/auth behaviour or cross-role refactors). See
`docs/KNOWN_LIMITATIONS.md` §UI.

- **Supervisor shell omits the idle-logout handler** that Waiter and Cashier both
  inject — supervisor sessions do not auto-logout on idle. (Auth-behaviour change;
  document, do not silently patch.)
- **Cross-role idle naming**: the shared `OperationalIdleLogoutHandler` and the
  cashier handler consume waiter-namespaced constants (`WAITER_IDLE_TIMEOUT_MS`
  etc.). Behaviour-correct but a naming/coupling smell for a future rename.
