# Completion Report - WAITER-MVP Frontend Reservations + Seat Guest UI

## Context Snapshot

- Current milestone: WAITER-MVP Frontend Reservations + Seat Guest UI
- Previous completed milestone: WAITER-MVP Frontend Receipt + Request Bill UI
- Next recommended prompt: waiter Me-tab shift/session self-service utilities, using existing backend contracts only

## Summary

- What was built: API-backed `/waiter/reservations` list/detail/seat flow and Floor reserved-table handoff.
- What is now working: waiter can search/filter reservations, open a waiter-safe detail panel, read safe contact/notes/deposit state, and seat a confirmed assigned-table reservation through the real backend seat endpoint when a shift is open.

## Files Added / Changed

- `apps/web/src/lib/waiter/reservation-api.ts`
- `apps/web/src/lib/waiter/reservation-model.ts`
- `apps/web/src/components/waiter/reservations/WaiterReservationsScreen.tsx`
- `apps/web/src/components/waiter/reservations/index.ts`
- `apps/web/src/pages/waiter/reservations.tsx`
- `apps/web/src/components/waiter/floor/WaiterFloorScreen.tsx`
- `apps/web/src/components/waiter/floor/WaiterTableDetailPanel.tsx`
- `apps/web/src/lib/waiter/floor-model.ts`
- `apps/web/README.md`
- `ai/AI_STATUS.md`
- `repo file tree.txt`
- `ai/WAITER_MVP_FRONTEND_RESERVATIONS_SEAT_GUEST_COMPLETION_REPORT.md`

## Database

- Prisma models added/changed: none
- Migration name: none
- Indexes / constraints: none
- Seed updates: none
- Notes: frontend-only milestone

## API

- Existing endpoints used:
  - `GET /api/reservations/upcoming`
  - `GET /api/reservations?pageSize=100`
  - `GET /api/reservations?status=SEATED&pageSize=100`
  - `GET /api/reservations/:id`
  - `PATCH /api/reservations/:id/seat`
  - `GET /api/shifts/active`
- Seat payload shape used:

```json
{
  "tableId": "<assigned table id when known>",
  "createOrder": true
}
```

- Reservation response shape observed/inferred from backend source: reservation fields include `id`, `reservationNumber`, `customerName`, `customerPhone`, `customerEmail`, `partySize`, `reservationAt`, `status`, `source`, `notes`, `specialRequests`, `tableId`, `seatedAt`, `seatedOrderId`, `depositRequired`, `table`, `deposits`, and `seatedOrder`.
- Backend changes: none
- Postman changes: none

## Reservation API Functions Added

- `listUpcomingReservations(token, branchId, query?)`
- `getReservation(token, branchId, reservationId)`
- `seatReservation(token, branchId, reservationId, payload)`

## Reservation View-Model Normalization

- Added `WaiterReservationViewModel`, `WaiterReservationGuestViewModel`, `WaiterReservationTableViewModel`, `WaiterReservationSeatResultViewModel`, and `WaiterReservationStatusViewModel`.
- Safe fallbacks include `Guest not added`, `Table not assigned`, `Time unavailable`, `Status unavailable`, `Contact not returned`, and `No deposit state returned`.
- Seating eligibility blocks pending, seated, completed, cancelled, no-show, unassigned-table, and unknown backend states.

## Reservations Screen Implementation

- Replaced the placeholder `/waiter/reservations` page with `WaiterReservationsScreen`.
- Added page title `Reservations`, subtitle `Upcoming guests ready to seat.`, search, filter chips, reservation cards, detail panel, skeletons, empty state, error state, success feedback, and shift/session blocking.
- Uses existing `WaiterShell`, shared UI primitives, token colors, and Phosphor icons.

## Filter Behavior

- Upcoming: calls `GET /api/reservations/upcoming`, then locally keeps future non-terminal, non-seated rows.
- Today: calls `GET /api/reservations?pageSize=100`, then filters local same-day rows.
- Seated: calls `GET /api/reservations?status=SEATED&pageSize=100`.
- Late: calls `GET /api/reservations?pageSize=100`, then filters rows whose scheduled time has passed and are not seated/terminal.
- All: calls `GET /api/reservations?pageSize=100`.

## Search Behavior

- Local search across guest name, table name, reservation number/id, phone/email when returned, source, status label, and raw status.

## Reservation Card / Detail Behavior

- Cards show guest, party size, reservation time, assigned table, status badge, source when returned, late/upcoming timing label, and read-only deposit badge when returned.
- Detail panel shows guest, party size, time, table, status, source, safe contact, read-only notes/special requests, read-only deposit state, Seat Guest, and close.
- Create, confirm, cancel, no-show, table assignment, and deposit controls are not exposed.

## Seat Guest Behavior

- Requires an active shift.
- Calls `PATCH /api/reservations/:id/seat` with `{ tableId?: string, createOrder: true }`.
- Shows loading state while seating.
- On success, shows `Guest seated.`, refetches reservation/floor/table/order query families, and offers:
  - `Open order` when the backend returns a linked order.
  - `Start order` when no order is returned but a table ID is known.
  - `Go to Floor` in all success cases.
- Failure mapping covers shift not open, forbidden, unauthorized, not found, already seated/conflict, table unavailable, validation/state errors, and network/API unavailable.
- The frontend does not fake table occupancy.

## Floor Reserved-Table Handoff

- Floor reserved-table detail now opens `/waiter/reservations?reservationId=<id>` when `reservationId` is known.
- Shift-closed reserved tables remain readable; seating is blocked in Reservations with `Start your shift before seating guests.`

## Shift / Session Blocking

- Existing `WaiterSessionGuard` redirects unauthenticated users to `/login?reason=session_required`.
- Existing waiter role guard blocks non-waiter workspaces.
- Reservations remain readable when shift is closed.
- Seat Guest is disabled when shift is not open or shift readiness is unavailable.

## Error / Loading / Empty States

- Reservation list has skeleton loading, empty state, API error state, and background refresh indicator.
- Detail panel has skeleton loading, empty selection state, detail API error state, disabled reason messages, seat failure messages, and seat success feedback.
- No full-page spinner-only loading was added.

## Route / Navigation Consistency

- `/waiter/reservations` works and remains in the existing bottom nav.
- `/waiter/floor` reserved table handoff routes into the reservations detail/seat flow.
- `/waiter/orders`, `/waiter/orders/[orderId]`, and `/waiter/orders/new?tableId=` were not changed except for query invalidation after seating.
- No Menu bottom-nav tab was added.

## Postman

- Collection added/updated: none
- Variables/tests added: none
- Manual checklist executed: not applicable; prompt explicitly said not to modify Postman.

## Docs

- Updated `apps/web/README.md` with Reservations endpoints, filters, detail behavior, seat payload, refetch behavior, and deferrals.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.

## Tests

- Unit tests: none added
- e2e tests: none added
- Commands run:
  - `pnpm --filter @nimbus-pos/web typecheck`
  - `pnpm --filter @nimbus-pos/web lint`
  - `pnpm --filter @nimbus-pos/web build`
  - `Invoke-WebRequest http://localhost:3001/api/health`
- Results:
  - `typecheck`: passed
  - `lint`: passed
  - `build`: passed; route table includes `/waiter/reservations`
  - API health: blocked, no API server listening on port 3001

## Browser Smoke

- Existing port 3000 responded for `/login` but returned 500 for `/waiter/reservations`, `/waiter/floor`, and `/waiter/orders`; treated as a stale process.
- Rebuilt the web app and served the production artifact on temporary port 3005.
- Route smoke results on port 3005:
  - `/login`: 200, Next payload present, login/session surface present
  - `/waiter/reservations`: 200, Next payload present, session guard surface present
  - `/waiter/floor`: 200, Next payload present, session guard surface present
  - `/waiter/orders`: 200, Next payload present, session guard surface present
- Temporary smoke server was stopped after verification.
- Live authenticated reservation seating was not run because no API was available on `http://localhost:3001`.

## Decisions / Deviations

- The prompt listed `POST /api/reservations/:id/seat` as expected, but the real backend controller and Postman collection use `PATCH /api/reservations/:id/seat`; the frontend uses the real `PATCH` route.
- Seat Guest sends `createOrder: true` because waiter docs require the seating bridge to create a linked dine-in order when possible.
- Pending reservations are shown read-only because backend state transition permits seating from `CONFIRMED`, not `PENDING`, and waiters cannot confirm reservations.

## Known Issues

- Live authenticated reservation seating verification depends on an API listening on port 3001 and a seatable reservation fixture.
- Existing port 3000 appeared stale during validation and returned 500 for waiter routes; the clean production smoke on port 3005 passed.

## Next Step

- Implement the waiter Me-tab shift/session self-service utilities, preserving `?mine=true` and existing backend contracts only.

## DONE Checks

- `/waiter/reservations` uses a real API loading path.
- Reservation list/read uses existing backend endpoints.
- Seat Guest uses a real backend endpoint.
- Seat Guest is disabled when shift is not open.
- Reservation admin actions are not exposed.
- Floor reserved-table handoff connects to reservation detail/seat flow.
- Successful seating refetches reservation/floor/table/order state.
- No fake seating success.
- No payment/mobile-money implementation.
- No split/merge/transfer implementation.
- No backend code changed.
- No Postman changed.
- No invented endpoints.
- Existing Floor/Tables still works at type level.
- Existing Order Builder still works at type level.
- Existing Orders Queue still works at type level.
- Existing Receipt UI still works at type level.
- Typecheck passes.
- Lint passes.
- Build passes.
- Production route smoke passes for login, reservations, floor, and orders.
