# Nimbus POS Web

Frontend foundation for the desktop-first Nimbus POS waiter MVP.

## Stack

- Next.js Pages Router
- TypeScript
- Tailwind CSS
- React Query
- Phosphor Icons
- CSS variable design tokens (brand token **values** rebranded 2026-08-20 — names unchanged; see `docs/BRAND_IDENTITY.md`)

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
- `/waiter/reservations`
- `/waiter/me`

`/waiter` redirects to `/waiter/floor`.

The waiter bottom navigation is exactly Floor, Reservations, and Me. Orders is not a visible
destination. The compatibility URLs `/waiter/orders`, `/waiter/orders/new?tableId=<tableId>`, and
`/waiter/orders/[orderId]` redirect into Floor while preserving safe table/order context.

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
- Quick PIN login can route immediately from the backend-confirmed branch session context, then
  hydrates the richer `GET /api/auth/me` profile in the background.
- Email login and token restore call `GET /api/auth/me` for canonical user, role, membership,
  organization, and branch context before routing.
- `/waiter/*` is protected by `WaiterSessionGuard`.
- Non-waiter users are not routed into owner, manager, accountant, or other unfinished workspaces.
- Logout calls `POST /api/auth/logout` when possible, then clears local session state.
- Idle timeout is active inside the waiter shell and returns to `/login` after 15 minutes.

## API Client And Performance Guardrails

The shared web API client sends `X-Request-Id` on every request, strips accidental `/api` suffixes
from `NEXT_PUBLIC_API_BASE_URL`, handles empty responses safely, wires AbortController signals, and
uses a bounded 30 second timeout. Timeout failures clear pending UI and should be presented with a
retry path rather than leaving buttons disabled indefinitely.

Role list screens should not launch per-row payment, receipt, or detail requests on mount. Load the
primary list first, then fetch selected-row detail/payment state only when the user selects a row or
opens a drawer. If a list needs payment/receipt enrichment for every row, add an aggregate backend
field or summary endpoint instead of mounting `useQueries` for every visible item.

## Shift Read Foundation

`WaiterShiftBanner` performs a non-blocking read of `GET /api/shifts/active` with the resolved
`X-Branch-Id`. It shows whether the waiter has an active shift but does not yet block pages or build
shift open/close UX.

## Floor / Tables

`/waiter/floor` now loads real backend data and renders the waiter table grid from normalized API
responses. The screen uses:

- `GET /api/tables`
- `GET /api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100`
- `GET /api/reservations?pageSize=200`
- `GET /api/shifts/active`

The UI only displays waiter-facing table statuses: Available, Occupied, Reserved. Backend Cleaning,
Blocked, inactive, and unavailable table states are hidden from the waiter grid rather than relabeled.

Search supports table label, guest name, assigned waiter, and internally available order context. Filters are All, Available, Occupied,
Reserved, and Mine. Mine depends on order ownership data from the existing order list response; when
ownership is missing, the UI does not infer ownership.

Table actions:

- Available tables open the full menu workspace immediately and create one guarded dine-in order in the background.
- Reserved tables show guest/time detail and seat the guest inside Floor when the backend permits it.
- Occupied own tables open the contextual order builder immediately from the active-order data already loaded by Floor.
- Occupied tables owned by another waiter show a blocked read-only panel.
- If shift is not open, service actions are blocked with a shift-not-started message.

Cards show full table identifier, Available/Occupied/Reserved, and capacity. Occupied cards show
the assigned waiter as `FirstName L.` and a separate `Mine` badge. Cards never show order numbers,
order labels, order status, bill state, or nested order panels.

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

After login and branch resolution, Floor prefetches menu navigation and catalog data while its
active-order response builds the table-to-order map. Selecting a waiter-operable table synchronously
mounts the full-screen menu shell; there is no intermediate draft-check or preparation screen.
Available tables start the authoritative dine-in order mutation in the background and show progress
only inside the right order panel. If an item is chosen before creation completes, the add waits on
the single verified order promise and commits once, without creating a frontend-only order.

The selected own occupied table loads the waiter-owned order builder with the menu catalog inside
Floor. It supports category filtering, menu search, adding items, item-level notes, serving
selection, modifier option payloads, quantity/note updates, item removal, and `Send to kitchen/bar`.
The modifier payload follows the backend pricing metadata shape: `metadata.selectedModifiers[]`
entries include `modifierOptionId`; UI labels and price deltas are carried as metadata only.

Money display uses the centralized waiter formatter in `src/lib/waiter/formatters.ts`. The formatter
uses the canonical branch currency from auth context when available, renders UGX with grouped whole
amounts such as `UGX 18,000`, and preserves fraction digits for currencies that use minor units.

Item writes paint an explicit pending line snapshot while the backend request is in flight, then
replace it with the backend/canonical order response. This avoids stale zero totals during slow local
Neon/API runs, but edit/remove remains disabled until the backend confirms the line.

Shift-not-open disables create, add, update, delete, and send actions while still allowing order
reads if the backend permits them. `ORDER_NOT_OWNED_BY_WAITER`, 403, and unsafe waiter transition
errors render blocked or failure states without exposing edit controls.

## Retained Waiter Orders Components

The former waiter queue component remains reusable in source, but it is not routed or visible in
waiter navigation. Internal waiter self-scoped queries still use:

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
openable retained row resolves its linked table and opens Floor. If ownership mismatches or no
accessible table exists, the component shows a truthful blocked state instead of editable controls.

## Waiter Receipt / Request Bill

The selected-table Floor workspace includes the waiter bill workflow inside the embedded order
panel. It uses only existing backend endpoints:

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

`/waiter/me` is a role-aware operational profile with verified identity, one focused shift section,
self-scoped workforce history, branch/account context, and session controls. It adds no backend or
Postman contract and uses only existing endpoints:

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
`pos:shift:close` permissions. The page renders exactly one primary shift action and invalidates only
the active-shift query after success. An open shift older than 16 hours or without a valid start time
is shown as `Shift issue`; the UI never changes or closes it automatically.

Attendance, leave, and shift-swap lists are self-scoped with `mine=true`. Employee linkage is resolved
only from the verified `employee.id` returned by `GET /api/auth/me`; legacy session shapes remain
compatible. When linkage is missing, the page shows one `Employee profile required` notice, does not
issue employee-dependent queries, and uses compact unavailable states instead of disabled forms. The
supported leave create payload is:

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
lists existing self-scoped swap requests and labels incoming/outgoing direction when the backend
returns them.

The profile presentation primitives under `src/components/profile/` are reused by Waiter, Cashier,
and Supervisor. They contain no queries, mutations, permissions, or role business rules.

## Design Tokens

Global design tokens live in `src/styles/globals.css` and are mapped into Tailwind in `tailwind.config.ts`.

The `--color-brand-*` token **values** were rebranded on 2026-08-20 to the Aug 2026 Nimbus POS Brand
Identity (canonical navy `#000033`, light grey `#B3B4AF`; navy 950/800 are derived shade/tint; shadow
ink derives from `--color-brand-navy-rgb: 0, 0, 51`). **Token names did not change**, so no component
required edits. Extended neutrals, status colors, and the per-role accents are unchanged. Never
hard-code a hex — the only exceptions are static assets that can't read CSS variables (`public/`
icons and `<meta name="theme-color">` in `src/pages/_app.tsx`). Full reference:
`docs/BRAND_IDENTITY.md`.

Waiter Floor uses the full card grid when no table is selected. Reservation/detail content uses one
responsive right drawer. Any new/resumed/owned/seated-reservation order uses one full-screen workspace
at 1366x768, 1440x900, and 1920x1080; responsive branches must not mount duplicate order components.
One app-level toast host deduplicates mutation messages and stays above navigation.

## Waiter Premium Menu Order Entry

The waiter order workspace reads manager taxonomy from `GET /api/menu/navigation?activeOnly=true`
and items from `GET /api/menu/catalog`. Item detail, serving, modifier-group, and option endpoints are
used through the existing waiter order API helper; no frontend taxonomy or modifier DTO was added.

Available-table entry uses the active orders already loaded with Floor: a waiter-owned `NEW` order is
attached immediately, while a table without an active order starts one background create. The menu
shell, taxonomy, search, items, table label, and Back to Floor remain usable throughout. A canonical
order detail refresh reconciles cached summaries in the background. `tableId` and `orderId` remain
URL-backed, and the action resolver checks the active-order map before backend table status so a
cached `NEW` order cannot trigger a duplicate create.

Simple items add immediately. Configurable items open the full-height configurator for quantity,
serving, sorted modifier groups, min/max enforcement, charged options, and item comments. Draft lines
use the verified add/PATCH/DELETE endpoints; serving stays read-only during edit because PATCH has no
`menuItemServingId`. Sent-order mutations stay blocked because the API has no per-line dispatch state.

The right panel shows returned subtotal, tax when nonzero, discount when nonzero, total, and text-first
send/bill/receipt controls. Waiters do not collect payment or close orders.

## Waiter Docs Source

The requested `docs/waiter-ui-docs` path is not present in this checkout. The active waiter docs used for this foundation are under:

```txt
Front End/waiter-ui-docs/waiter-ui-docs/
```

## Intentionally Deferred

- Payment collection and public mobile-money checkout
- Sending additions after an order is already sent. The backend has no per-line sent state or
  dedicated additions-dispatch contract, and reusing `POST /send` would be an invalid `SENT -> SENT`
  transition with KDS duplication risk.
- Employee-ID backed attendance clock and leave creation until `GET /api/auth/me` returns a safe self employee ID
- Shift-swap creation until a waiter-safe target employee selector exists
- Owner, manager, accountant, mobile, hardware, and payment workflows
- Unsafe waiter transitions and handoff tools: in-kitchen, ready, void, closed, split, merge,
  transfer, move items, combine/uncombine tables
