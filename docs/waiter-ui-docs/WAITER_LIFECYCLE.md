# Waiter Lifecycle

Status: **Canonical (waiter)** — the current, code-grounded waiter lifecycle.
Date: 2026-08-20.
Supersedes: `Front End/waiter-ui-docs/waiter-ui-docs/WAITER_LIFECYCLE.md` (Draft v1, 2026-06-16),
which predates the implemented build. See §11 for the deltas; the pack is kept for history.

> Every claim below is grounded in code and cites the file. Endpoint contracts, permissions and
> live-verification status live in `WAITER_API_MATRIX.md` and are not repeated here.

**The whole lifecycle in one line:**

```txt
login (Quick PIN primary / email fallback) → shift readiness → Floor → table select
→ order build → send to kitchen/bar → request bill → receipt visibility (never payment)
→ reservations: seat → Me: shift, attendance, leave, swaps → logout / idle logout
```

---

## 1. Login

`apps/web/src/pages/login.tsx`, `apps/web/src/lib/auth/auth-api.ts`,
`apps/web/src/lib/auth/AuthProvider.tsx`.

- The login screen opens in **Quick PIN mode** (`useState<LoginMode>("pin")`) — Quick PIN is the
  primary path for frontline staff on a shared terminal; the page copy says so.
- Quick PIN needs a **branch context** before it needs a PIN. The branch id is restored from
  `localStorage` (station key) or `NEXT_PUBLIC_DEFAULT_BRANCH_ID`, falling back to the demo
  branch; without one the form blocks with "Branch context is required for Quick PIN login."
- The PIN pad accepts digits only and enables submit at **exactly 6 or 8 digits**
  (`pinIsValid = pin.length === 6 || pin.length === 8`), matching the backend
  `QuickPinLoginDto` regex. `loginWithPinRequest` posts `{ branchId, pin, platform: "POS_DESKTOP" }`.
- **Email + password is the fallback**, same screen, second tab (`loginWithPasswordRequest`).
- On success `AuthProvider.applyLogin` stores the token and immediately calls `getMeRequest`
  (`GET /api/auth/me`) to resolve the canonical user, roles, permissions, branch and the linked
  **employee** record.
- Role routing: a waiter is hard-navigated to **`/waiter/floor`**. A user who is not waiter,
  cashier or supervisor is signed out with "This frontend currently supports waiter, cashier, and
  supervisor workspaces only."
- The successful branch id is persisted to the station key so the next shift's Quick PIN login
  is one PIN entry.

## 2. Shell and session guard

`components/waiter/shell/*`, `components/pos-shell/*`.

`WaiterShell` composes, in order: `WaiterSessionGuard` → `OperationalShell(header, readiness,
bottomNavigation, idleHandler)`.

- `WaiterSessionGuard` redirects to `/login?reason=session_required` without a token, and renders
  a "Waiter workspace only" blocked state for a non-waiter session.
- `WaiterHeader` → shared `OperationalHeader`: branch label, display name, initials, primary role
  label. **`contextKind="service-area"` is passed with a hard-coded
  `contextLabel="Service area unavailable"`** — the waiter's service area is not resolved from
  any API today.
- `WaiterBottomNav` → shared `OperationalBottomNav` with `getOperationalRoleNavigation("waiter")`,
  i.e. exactly `lib/waiter/routes.ts`: **Floor · Reservations · Me**. The Floor item's `match`
  also claims `/waiter/orders*`, so legacy order URLs keep Floor highlighted.
- `WaiterShiftBanner` is the readiness slot (§3).
- `WaiterIdleLogoutHandler` → shared `OperationalIdleLogoutHandler` (§10).

## 3. Shift readiness

`lib/waiter/useActiveShift.ts`, `components/waiter/shell/WaiterShiftBanner.tsx`,
`apps/api/src/modules/shifts/shifts.service.ts`, `apps/api/src/modules/orders/orders.service.ts`.

- `useActiveShift()` queries `GET /api/shifts/active` — enabled only when there is a token, a
  branch and `isWaiter`; `staleTime` 30 s. It is the single readiness source for the banner, the
  Floor action gating, the order-write gating and the Me shift card.
- The shift returned is **the one this waiter opened in this branch** (`openedById: userId`), not
  a branch-wide shift. The backend write guard `assertWaiterShiftOpen` keys on the same field, so
  banner and enforcement agree.
- Four banner states: loading skeleton · **Off shift** ("Service actions are unavailable.") ·
  **Shift issue** ("Shift review needed. Open Me for details.") · **On shift** with the shift
  number. A 401 anywhere in this query clears the session.
- **Shift issue** is derived in `lib/waiter/me-model.ts` (`normalizeShift`) — an open shift older
  than ~16 h or with an invalid start time. The UI warns and never auto-closes or auto-repairs it.
- Consequence: reading Floor, Reservations and Me works off shift. **Every service write is
  shift-gated** — order create/add/update/delete/send, request bill, and seat.

## 4. Floor

`components/waiter/floor/WaiterFloorScreen.tsx`, `lib/waiter/floor-api.ts`,
`lib/waiter/floor-model.ts`, shared `components/floor/OperationalFloor`.

- `loadWaiterFloorData` fans out three calls in parallel: tables, active orders
  (`excludeStatus=CLOSED,VOIDED&pageSize=100`), reservations (`pageSize=200`).
  `staleTime` 15 s.
- On Floor mount the screen **prefetches the whole menu workspace**
  (`loadWaiterMenuWorkspace`, `staleTime` 5 min) so selecting a table opens an already-warm
  order builder.
- `normalizeWaiterTables` derives each card's state — it does not trust a single field:
  - `occupied` when an active order is attached whose status is **not** `NEW`, or the backend
    table status is `OCCUPIED`. A `NEW` draft therefore does **not** occupy a table.
  - `reserved` from the reservation overlay.
  - `isMine` when the attached order's `userId` equals the authenticated user's id.
- Selection is URL-backed: `/waiter/floor?tableId=…` (`shallow`, no scroll), with a second
  `?orderId=…` once an order is resolved. Closing the workspace pops or replaces back to
  `/waiter/floor` and restores focus to the originating card.
- `getWaiterTableAction` maps a card to one of five intents:

| Intent | When | What opens |
| --- | --- | --- |
| `start-order` | Available table, shift open | Order builder, background draft creation |
| `own-order` | Occupied table where `isMine` | Order builder on the existing order |
| `ownership-blocked` | Occupied table owned by another waiter | `WaiterOwnershipBlockedPanel` (read-first, no editing) |
| `reservation-detail` | Reserved table | Seat workspace (§7) |
| `disabled` | Shift not open, or an unusable table | Explanatory disabled state |

- The screen distinguishes "still loading" from "this table is not on your Floor": a selected id
  that resolves to nothing renders "Table unavailable", not a spinner.
- Floor presentation is the shared `OperationalFloor` used by Waiter, Supervisor and Cashier
  (D-FLOOR). Data access, permissions and mutations stay waiter-owned.

## 5. Order build and send

`components/waiter/orders/WaiterOrderBuilderScreen.tsx` (mounted inside
`WaiterTableWorkspace` → `OperationalTableWorkspaceFrame`, `immersive`), `lib/waiter/order-api.ts`,
`lib/waiter/order-model.ts`.

**Draft creation is optimistic and background.** Selecting an Available table mounts the builder
immediately and fires `createDineInOrder` (`POST /api/pos/orders` with
`{ serviceType: "DINE_IN", tableId }`) behind the UI. `beginOrderCreation` de-duplicates via
`orderReadyPromiseRef`, so a fast double-tap cannot create two orders. If the waiter taps an item
before the id lands, the add is **queued** (`queuedAddPayload`) and replayed once
`getVerifiedOrderId()` resolves. Failure surfaces a toast plus an explicit retry that resets the
creation refs.

**Item entry** runs through `getMenuItemConfiguration`, which fetches item + servings +
modifier groups in parallel and lazily backfills each group's options only when the group came
back without them. The configurator collects serving, quantity, per-line note and modifier
selections; the selections are persisted as `metadata.selectedModifiers` + `metadata.servingLabel`
on the order item.

**Menu taxonomy is manager-owned** (D-TAXONOMY): the builder renders
`GET /api/menu/navigation?activeOnly=true` sections/groups/subgroups joined to the catalog and
never hard-codes fallback categories.

**Every write re-reads the canonical order.** `refreshCanonicalOrder` cancels in-flight queries
and re-fetches `GET /api/pos/orders/:id`, then `writeCanonicalOrder` seeds the cache — the browser
never recomputes totals locally. Money is UGX, zero-fraction, via the shared waiter formatter
(`lib/waiter/formatters.ts`, D-CURRENCY).

**Send** (`POST /api/pos/orders/:id/send`, `NEW → SENT`) is the waiter's hand-off to the kitchen
or bar. It is one of only two transitions the backend treats as waiter-safe
(`WAITER_SAFE_TRANSITIONS = { SENT, SERVED }` in `apps/api/src/common/auth/waiter-scope.ts`); the
server auto-occupies the dine-in table. A post-send refresh failure degrades to a *warning* toast
— the send itself is not reported as failed.

**Three backend rules shape every write**, and all three have dedicated UI copy
(`lib/api/client.ts` types them as first-class error codes):

| Code | HTTP | Meaning | Waiter-facing copy |
| --- | --- | --- | --- |
| `SHIFT_NOT_OPEN` | 409 | No open shift for this waiter in this branch | "Start your shift before continuing service." |
| `ORDER_NOT_OWNED_BY_WAITER` | 403 | Waiter-only actor, order belongs to someone else | "This table has an order assigned to another waiter." |
| `ORDER_TRANSITION_NOT_WAITER_SAFE` | 403 | Target status outside `{SENT, SERVED}` | Blocked action state |

**Known build limitations, both backend-shaped:**
- **Serving cannot be changed after a line is added** — `UpdateOrderItemDto` has no
  `menuItemServingId` (WKL-012).
- **Post-send item additions** remain constrained because there is no per-line sent state
  (WKL-010, `docs/ROLE_JOURNEYS.md`).

## 6. Request bill and the receipt visibility boundary

`components/waiter/receipts/**`, `lib/waiter/receipt-api.ts`, `lib/waiter/receipt-model.ts`,
`apps/api/src/modules/receipts/receipts.service.ts`.

**The waiter never collects payment and never closes an order.** This is D-BOUNDARY, and it is
enforced three ways: the seeded Waiter role has no `pos:orders:close` or `pos:orders:void` grant
(both return 403 live); no waiter surface renders a payment, close, till, refund or discount
action; and the request-bill toast says so out loud — *"Payment collection remains outside the
waiter workspace."*

**Request bill is an audit signal, not a state change.** `POST /api/pos/orders/:id/request-bill`
writes an `ORDER_BILL_REQUESTED` audit row and returns `{ billRequested: true, requestedAt }`.
The order's status is untouched; the cashier picks the signal up from the audit timeline.

`buildBillState` in the builder gates the button honestly:

| Order state | Bill panel |
| --- | --- |
| Shift not open | **Blocked** — "Start your shift before requesting a bill." |
| `NEW` | **Not sent** — "Send the order before requesting a bill." (receipt view also disabled) |
| `SENT`/`IN_KITCHEN`/`READY`/`SERVED` | **Available** — request allowed, receipt viewable |
| already requested | **Requested** — "Cashier payment remains outside the waiter workspace." |
| `CLOSED`/`VOIDED` | **Receipt** — read-only receipt + audit history |

**Receipt id == order id.** The receipts backend has no separate `Receipt` model — a closed order
with its captured payments *is* the receipt — so the waiter client passes the order id to
`getReceipt` / `getReceiptHistory` / `reprintReceipt` / `sendReceipt`. This is correct by design.

**Reprint and send are gated to `CLOSED`/`VOIDED`** on both sides: the backend
`isPrintable(status)` throws 400 otherwise (verified live), and `normalizeWaiterReceipt` sets
`actionState.canReprint/canSend` from the same `PRINTABLE_STATUSES` set, so the buttons are
pre-disabled with the reason spelled out. Both calls attach a client-generated `Idempotency-Key`.

**Send has no live adapter.** `POST /api/receipts/:id/send` returns `202` with
`status: "PENDING"`, `supported: false`, `reason: "NO_LIVE_DELIVERY_ADAPTER"`. The action bar
carries a permanent "PENDING - no live adapter" warning — recording an intent, not delivering.

**Reprint is a recorded request, not a guaranteed print** — the toast says "No print-driver
completion is guaranteed."

> ⚠️ On the isolated stack verified 2026-08-20, `GET /api/receipts/:id` returns **500** for every
> order (`[DecimalError]` in the compiled money path), so the drawer cannot render its preview
> today. `GET /api/receipts/:id/history` is healthy. See `WAITER_API_MATRIX.md` §7 (L1).

## 7. Reservations — read and seat

`components/waiter/reservations/WaiterReservationsScreen.tsx`,
`components/waiter/floor/WaiterTableWorkspace.tsx`, `lib/waiter/reservation-api.ts`,
`lib/waiter/reservation-model.ts`.

- Five filters: **Upcoming** (default) uses `GET /api/reservations/upcoming` with no params;
  **Today / Seated / Late / All** use `GET /api/reservations` with a bounded `pageSize: 100`
  (Seated additionally sends `status=SEATED`). Today/Late narrowing happens client-side over that
  bounded page (`filterWaiterReservations`).
- Selecting a row fetches `GET /api/reservations/:id` for the detail pane; selection is
  URL-persisted.
- **Seat is the only reservation mutation a waiter can perform.**
  `buildSeatReservationPayload` sends `{ tableId: <the reservation's own table>, createOrder: true }`
  to `PATCH /api/reservations/:id/seat`. Server-side this transitions `CONFIRMED → SEATED`, creates
  the linked `DINE_IN` order, flips the table to `OCCUPIED`, and writes a `RESERVATION_SEATED`
  event plus an audit row.
- The same seat flow is available **from Floor**: tapping a Reserved table opens
  `ReservationWorkspace` inside the table workspace. On success the UI invalidates reservations,
  floor and table caches and **opens the newly created order in place**, so seating flows straight
  into order entry.
- Seating is shift-gated in the UI ("Start your shift before seating guests.") and by
  `SHIFT_NOT_OPEN` at the backend.
- **Everything else is denied by permission, not by UI choice.**
  `revokeStaleWaiterPermissions` in `packages/db/prisma/seed.ts` explicitly removes
  `pos:reservation:create`, `:confirm`, `:deposit:record`, `:deposit:read`, `:table:assign` from
  the Waiter role. Live probes returned **403** for create and confirm. Cancel, no-show and manual
  complete are likewise not granted.

## 8. Me — profile, shift control, workforce self-service

`components/waiter/me/WaiterMeScreen.tsx`, `lib/waiter/me-api.ts`, `lib/waiter/me-model.ts`,
shared `components/profile/*`.

- **Identity** comes from `GET /api/auth/me` via `normalizeWaiterMeProfile` — no extra profile
  endpoint exists.
- **The employee link is the gate.** `resolveLinkedEmployeeId` reads `user.employee.id`; when it
  is absent the screen renders a `CapabilityNotice` — *"Attendance actions, leave requests, and
  employee-linked shift-swap details are unavailable."* — instead of broken panels, and the three
  workforce queries stay disabled.
- **Shift card** is the only shift-control surface: status, start time, elapsed, branch, note, and
  one primary action — **Start shift** (`POST /api/shifts/open`) or **End shift**
  (`POST /api/shifts/:id/close`), each with an optional ≤500-char note. A 409 "already has an
  active shift" is translated to "A shift is already open for this branch. Refresh the page before
  trying again."
- **Attendance** is one toggle: `POST /api/hr/attendance/clock` clocks in, or clocks out if
  today's row is open. A second clock-out returns 409 → "Attendance is already clocked out for
  today." The last 8 rows come from `GET /api/hr/attendance?mine=true&take=8`.
- **Leave** — a form posting `{ employeeId, leaveType, startsAt, endsAt, reason? }`; the copy
  states the request stays pending until a manager reviews it. Own requests via
  `GET /api/hr/leave?mine=true&take=8`.
- **Shift swaps are read-only.** `GET /api/hr/shift-swaps?mine=true&take=8` lists swaps this
  employee is requester or target of. The role *holds* `pos:hr:shift-swaps:create` and the backend
  route exists, but `me-api.ts` deliberately exposes no create function — no safe target selector
  has been built.
- **Logout** clears the session and hard-navigates to `/login?reason=logged_out`.

> ⚠️ Data caveat verified 2026-08-20: the workforce lists are branch-scoped by `X-Branch-Id`,
> while the demo waiter's `Employee` row belongs to a different branch — so seeded attendance /
> leave / swap history reads as empty on that stack even though the endpoints are healthy. See
> `WAITER_API_MATRIX.md` §6.

## 9. Order state visibility after send

- There is **no Orders tab** and no mounted order queue (D-NOORDERS). `/waiter/orders` and
  `/waiter/orders/new` are `getServerSideProps` redirects to `/waiter/floor`.
- `/waiter/orders/[orderId]` still renders — `WaiterLegacyOrderRedirect` fetches the order,
  resolves its `tableId`, and replaces the URL with `/waiter/floor?tableId=…&orderId=…`. If the
  order belongs to another waiter it renders a blocked state naming
  `ORDER_NOT_OWNED_BY_WAITER`; if the table cannot be resolved it says so and offers "Go to Floor".
- The waiter's live view of an order is therefore always **the Floor card plus the table
  workspace**. Kitchen progression (`IN_KITCHEN`, `READY`) is driven by KDS, not by the waiter —
  both endpoints return 403 `ORDER_TRANSITION_NOT_WAITER_SAFE` for a waiter-only actor.

## 10. Idle logout and session end

`components/pos-shell/OperationalIdleLogoutHandler.tsx`, `components/pos-shell/idle.ts`.

- Shared across Waiter, Cashier and Supervisor: **15 minutes** (`OPERATIONAL_IDLE_TIMEOUT_MS`)
  of no `mousemove` / `mousedown` / `keydown` / `touchstart` / `scroll` (all passive listeners).
- On timeout the handler calls `logout()` and hard-navigates to `/login?reason=idle_timeout`
  regardless of whether the logout request succeeded — the terminal is never left signed in.
- `lib/waiter/idle.ts` still re-exports `WAITER_IDLE_TIMEOUT_MS` / `WAITER_ACTIVITY_EVENTS` as
  `@deprecated` aliases; new code imports from `@/components/pos-shell/idle`.

## 11. Deltas from the 2026-06-16 pack draft

`Front End/waiter-ui-docs/waiter-ui-docs/WAITER_LIFECYCLE.md` is a 1054-line pre-implementation
draft. It remains a useful record of intent and of the denied-action reasoning, and it received
in-place 2026-07-18 shared-shell/shared-Floor notes plus a §22A full-screen-order-entry appendix.
It is **superseded by this file** for anything describing current behaviour. Differences worth
knowing:

| # | Pack draft | Implemented today |
| --- | --- | --- |
| 1 | Quick PIN login described without an endpoint or PIN format. | `POST /api/auth/quick-pin-login` with `{ branchId, pin, platform: "POS_DESKTOP" }`; PIN is **exactly 6 or 8 digits**, enforced identically in `login.tsx` and `QuickPinLoginDto`. Branch context must be resolved *before* the PIN. |
| 2 | §13.2 — "Retained queue-component filters are not navigation" (Active/Sent/Ready/Served/Closed Today). | The queue component is **not mounted at all**. `WaiterOrdersQueueScreen` and `WaiterNewOrderScreen` are exported from `components/waiter/orders/index.ts` but no page renders them; both routes are server-side redirects. `listWaiterOrders(query)` and `getWaiterTable()` are dead call paths. |
| 3 | §13.3 "Order card" fields (guest, bill state) as a queue surface. | No such card ships. Order context is the Floor card + the table workspace; Floor cards never show guest names (D-PRIVACY). |
| 4 | §9.3 "Editing after send" described as a lifecycle stage. | Constrained — no per-line sent state exists (WKL-010); and serving cannot be edited on an existing line at all because `UpdateOrderItemDto` has no `menuItemServingId` (WKL-012). |
| 5 | §16 receipt reprint/send as ordinary actions. | Both are hard-gated to `CLOSED`/`VOIDED` on **both** sides, carry `Idempotency-Key`, and *send* permanently reports `PENDING` / `supported: false` / `NO_LIVE_DELIVERY_ADAPTER`. |
| 6 | §18.4 shift swap: "Allowed if backend permits… creation remains unavailable". | Confirmed and now definitive: **read-only**, no create function exists in `me-api.ts` despite the role holding `pos:hr:shift-swaps:create`. |
| 7 | Order creation implied as a step after table selection. | Creation is **optimistic and backgrounded** on table select, de-duplicated by promise ref, with early item taps queued and replayed. |
| 8 | Seat described only from the Reservations tab. | Seat is available from **both** Reservations and the Floor Reserved-table workspace, and on success opens the linked order in place. |
| 9 | Idle described generically. | Shared 15-minute cross-role handler; waiter-specific idle constants are deprecated aliases. |
| 10 | Palette/visual language references predate the rebrand. | Visual language is now `docs/BRAND_IDENTITY.md` — navy `#000033`, white, silver `#B3B4AF`, graphite `#6B6B6B`. Do not use the pre-Aug-2026 values. |

## See also

- `docs/waiter-ui-docs/WAITER_API_MATRIX.md` — endpoints, permissions, live verification.
- `docs/waiter-ui-docs/README.md` — role overview and doc index.
- `docs/DECISIONS.md` — D-NAV, D-NOORDERS, D-FLOOR, D-SHELL, D-BOUNDARY, D-CURRENCY, D-TAXONOMY, D-PRIVACY.
- `docs/ROLE_JOURNEYS.md` · `docs/ROLE_CAPABILITY_MATRIX.md` — cross-role summaries.
