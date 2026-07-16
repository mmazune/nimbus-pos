# Nimbus POS Web

Frontend foundation for the desktop-first Nimbus POS waiter MVP.

## Stack

- Next.js Pages Router
- TypeScript
- Tailwind CSS
- React Query
- Phosphor Icons
- CSS variable design tokens

## Scripts

```pwsh
pnpm --filter @nimbus-pos/web dev
pnpm --filter @nimbus-pos/web lint
pnpm --filter @nimbus-pos/web typecheck
pnpm --filter @nimbus-pos/web build
```

## Routes

- `/login`
- `/waiter`
- `/waiter/floor`
- `/waiter/orders`
- `/waiter/orders/new?tableId=<tableId>`
- `/waiter/orders/[orderId]`
- `/waiter/reservations`
- `/waiter/me`

`/waiter` redirects to `/waiter/floor`.

## Environment

```txt
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_DEFAULT_BRANCH_ID=<optional branch id for Quick PIN terminals>
```

`NEXT_PUBLIC_API_BASE_URL` must not include `/api`; client calls use paths such as
`{{baseUrl}}/api/auth/login`. The web client strips a trailing `/api` defensively, but local
development should still use `http://localhost:3001` to keep browser diagnostics clear.

The local API must allow the web origin through CORS. The Nest API defaults
`API_CORS_ORIGINS` to `http://localhost:3000,http://127.0.0.1:3000` for waiter browser
verification.

Quick PIN login requires a branch context because the backend contract is
`POST /api/auth/quick-pin-login` with `{ branchId, pin, platform: "POS_DESKTOP" }`.
Until terminal provisioning exists, the login screen defaults the local demo to Tapas Downtown,
exposes the branch ID field for other local contexts, and remembers the last entered branch in
browser storage.

## Auth And Session Infrastructure

- Shared login supports Quick PIN and Email + Password modes.
- Quick PIN is the default mode for waiter/frontline access.
- Email + Password remains available, but this frontend MVP only routes waiter-compatible users.
- Tokens are stored in browser-only `localStorage` and are never read during SSR.
- Successful login and token restore call `GET /api/auth/me` for canonical user, role, membership,
  organization, and branch context.
- `/waiter/*` is protected by `WaiterSessionGuard`.
- Non-waiter users are not routed into owner, manager, accountant, or other unfinished workspaces.
- Logout calls `POST /api/auth/logout` when possible, then clears local session state.
- Idle timeout is active inside the waiter shell and returns to `/login` after 15 minutes.

## Shift Read Foundation

`WaiterShiftBanner` performs a non-blocking read of `GET /api/shifts/active` with the resolved
`X-Branch-Id`. It shows whether the waiter has an active shift but does not yet block pages or build
shift open/close UX.

## Floor / Tables

`/waiter/floor` now loads real backend data and renders the waiter table grid from normalized API
responses. The screen uses:

- `GET /api/tables`
- `GET /api/pos/orders?excludeStatus=NEW,CLOSED,VOIDED&pageSize=100`
- `GET /api/reservations/upcoming`
- `GET /api/shifts/active`

The UI only displays waiter-facing table statuses: Available, Occupied, Reserved. Backend Cleaning,
Blocked, inactive, and unavailable table states are hidden from the waiter grid rather than relabeled.

Search supports table label, guest name, and order number. Filters are All, Available, Occupied,
Reserved, and Mine. Mine depends on order ownership data from the existing order list response; when
ownership is missing, the UI does not infer ownership.

Table actions:

- Available tables open a start-order intent panel that routes to `/waiter/orders/new?tableId=<tableId>`.
- Reserved tables open `/waiter/reservations?reservationId=<reservationId>` when a reservation ID is known.
- Occupied own tables route to `/waiter/orders/[orderId]`.
- Occupied tables owned by another waiter show a blocked read-only panel.
- If shift is not open, service actions are blocked with a shift-not-started message.

## Waiter Order Builder

The waiter order flow uses only existing backend endpoints:

- `POST /api/pos/orders`
- `GET /api/pos/orders/:id`
- `POST /api/pos/orders/:id/items`
- `PATCH /api/pos/orders/:id/items/:itemId`
- `DELETE /api/pos/orders/:id/items/:itemId`
- `POST /api/pos/orders/:id/send`
- `GET /api/menu/catalog`
- `GET /api/menu/items/:id`
- `GET /api/menu/items/:id/servings`
- `GET /api/menu/items/:id/modifier-groups`
- `GET /api/menu/modifier-groups/:id/options`
- `GET /api/shifts/active`
- `GET /api/tables/:id`

`/waiter/orders/new?tableId=<tableId>` is a guarded start screen. It requires an active waiter
session, a table ID, and an open shift before enabling `Start order`. It deliberately does not
auto-create orders on route render, so browser refreshes do not duplicate dine-in orders.

`/waiter/orders/[orderId]` loads the waiter-owned order builder with the menu catalog inside the
order flow. It supports category filtering, menu search, adding items, item-level notes, serving
selection, modifier option payloads, quantity/note updates, item removal, and `Send to kitchen/bar`.
The modifier payload follows the backend pricing metadata shape: `metadata.selectedModifiers[]`
entries include `modifierOptionId`; UI labels and price deltas are carried as metadata only.

Shift-not-open disables create, add, update, delete, and send actions while still allowing order
reads if the backend permits them. `ORDER_NOT_OWNED_BY_WAITER`, 403, and unsafe waiter transition
errors render blocked or failure states without exposing edit controls.

## Waiter Orders Queue

`/waiter/orders` now loads the waiter's own operational order queue from the existing order list
endpoint:

- `GET /api/pos/orders?userId=me&excludeStatus=NEW,CLOSED,VOIDED&pageSize=100`
- `GET /api/pos/orders?userId=me&status=SENT&excludeStatus=NEW&pageSize=100`
- `GET /api/pos/orders?userId=me&status=READY&excludeStatus=NEW&pageSize=100`
- `GET /api/pos/orders?userId=me&status=SERVED&excludeStatus=NEW&pageSize=100`
- `GET /api/pos/orders?userId=me&status=CLOSED&excludeStatus=NEW&pageSize=100`

Filters are Active, Sent, Ready, Served, and Closed Today. Closed Today uses the backend `CLOSED`
status response and filters locally by the order timestamp because the backend list contract does
not expose a date-window parameter. Search filters locally across order number, table name, guest
name, status, and bill state when available.

Each order row shows table/takeaway context, guest fallback, order number, status, elapsed time,
total fallback, bill state when metadata exposes it, and item count when present. Selecting an
openable order routes to `/waiter/orders/[orderId]`; if an unexpected ownership mismatch appears,
the queue shows a blocked state instead of opening editable controls. The screen remains readable
when shift is not open and does not add write actions.

## Waiter Receipt / Request Bill

`/waiter/orders/[orderId]` now includes the waiter bill workflow inside the existing order detail
right panel. It uses only existing backend endpoints:

- `POST /api/pos/orders/:id/request-bill`
- `GET /api/pos/orders/:id`
- `GET /api/receipts/:id`
- `GET /api/receipts/:id/history`
- `POST /api/receipts/:id/reprint`
- `POST /api/receipts/:id/send`

The backend receipt contract uses `receiptId === orderId`. `request-bill` returns an action result,
not a payment object, so the frontend refetches the order and opens the receipt drawer using the
order ID as the receipt ID.

Bill action states:

- New/not-sent orders disable `Request bill` with `Send order before requesting bill.`
- Shift-not-open disables unsafe bill writes while keeping the order readable.
- Closed or voided orders show receipt access and block duplicate bill requests.
- Backend ownership, permission, validation, state, and network failures render explicit failure copy.

The receipt drawer is a desktop right-side panel with a clean printable receipt preview, itemized
lines, totals, payment/outstanding values, receipt status, history timeline, and footer actions.
History comes from `GET /api/receipts/:id/history`; an empty response shows `No receipt events yet.`

Reprint calls the backend metadata endpoint only and shows `Reprint request recorded.` No print driver
is invoked. Send receipt supports only the backend-supported channels: email, SMS, and WhatsApp.
Because there is no live adapter, successful send responses are shown as:

```txt
Receipt send is pending. No live email/SMS/WhatsApp adapter is connected yet.
```

The UI never claims a receipt was delivered unless the backend explicitly returns a delivered state.

## Waiter Reservations / Seat Guest

`/waiter/reservations` now loads real reservation data and seats guests through the existing
backend seating bridge only. It uses:

- `GET /api/reservations/upcoming`
- `GET /api/reservations?pageSize=100`
- `GET /api/reservations?status=SEATED&pageSize=100`
- `GET /api/reservations/:id`
- `PATCH /api/reservations/:id/seat`
- `GET /api/shifts/active`

Filters are Upcoming, Today, Seated, Late, and All. Upcoming uses the dedicated backend upcoming
endpoint. Today, Late, and All load the existing paginated reservation list and filter locally where
the backend has no direct status/date-window convenience for the waiter UI. Search filters locally
across guest name, reservation number, table name, phone/email when returned, source, and status.

Reservation cards show guest, party size, reservation time, assigned table, status, timing label,
source when returned, and a read-only deposit badge when the backend returns deposit state. The
detail panel shows safe contact info, party/time/table/status, read-only notes and special requests,
and read-only deposit state. It does not expose create, confirm, cancel, no-show, assign-table, or
deposit actions.

Seat Guest is disabled when shift is not open with:

```txt
Start your shift before seating guests.
```

Seat Guest calls `PATCH /api/reservations/:id/seat` with this DTO-compatible payload:

```json
{
  "tableId": "<assigned table id when known>",
  "createOrder": true
}
```

On success, the frontend refetches reservation, floor, table, and order queue query state. It does
not fake table occupancy. If the backend returns a linked order, the UI offers `Open order`. If only
a table is known, it offers `Start order`; otherwise it guides back to Floor.

## Waiter Me / Shift & Self-Service

`/waiter/me` now provides the waiter profile, shift controls, and self-service HR read surfaces
without adding any backend or Postman contract. It uses only existing endpoints:

- `GET /api/auth/me`
- `GET /api/shifts/active`
- `POST /api/shifts/open`
- `POST /api/shifts/:id/close`
- `GET /api/hr/attendance?mine=true&take=8`
- `POST /api/hr/attendance/clock`
- `GET /api/hr/leave?mine=true&take=8`
- `POST /api/hr/leave`
- `GET /api/hr/shift-swaps?mine=true&take=8`
- `POST /api/auth/logout`

The shift actions use the existing shift DTO shape:

```json
{
  "notes": "Optional waiter note"
}
```

Start shift and End shift are gated by the active shift state and the user's `pos:shift:open` /
`pos:shift:close` permissions. Successful shift actions invalidate the active shift, floor, order
queue, and reservation queries so the rest of the waiter shell can update from backend state.

Attendance, leave, and shift-swap lists are self-scoped with `mine=true`. `GET /api/auth/me`
currently does not return an `employeeId`, while the write DTOs for attendance and leave require
employee identifiers. Because the waiter UI cannot safely derive that identifier from another
endpoint, clock and leave-create actions render an honest unavailable state until the backend exposes
a self employee identifier on the session/profile contract and the session has the matching HR
self-service permission. The supported leave create payload, once an employee ID is available, is:

```json
{
  "employeeId": "<employee id from auth/me>",
  "leaveType": "ANNUAL",
  "startsAt": "2026-06-20T09:00:00.000Z",
  "endsAt": "2026-06-20T17:00:00.000Z",
  "reason": "Optional note"
}
```

Shift-swap creation is not exposed yet because the existing create contract requires a
`targetEmployeeId`, and the waiter UI has no safe waiter-scoped employee selector. The page still
lists existing self-scoped swap requests when the backend returns them.

## Design Tokens

Global design tokens live in `src/styles/globals.css` and are mapped into Tailwind in `tailwind.config.ts`.

## Waiter Docs Source

The requested `docs/waiter-ui-docs` path is not present in this checkout. The active waiter docs used for this foundation are under:

```txt
Front End/waiter-ui-docs/waiter-ui-docs/
```

## Intentionally Deferred

- Payment collection and public mobile-money checkout
- Employee-ID backed attendance clock and leave creation until `GET /api/auth/me` returns a safe self employee ID
- Shift-swap creation until a waiter-safe target employee selector exists
- Owner, manager, accountant, mobile, hardware, and payment workflows
- Unsafe waiter transitions and handoff tools: in-kitchen, ready, void, closed, split, merge,
  transfer, move items, combine/uncombine tables
