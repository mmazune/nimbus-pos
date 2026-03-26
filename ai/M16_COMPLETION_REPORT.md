# M16 Completion Report — Reservations + Deposits + Seating Bridge

## Milestone Summary

| Field            | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Milestone        | M16                                                         |
| Title            | Reservations + Deposits + Seating Bridge                    |
| Branch           | `milestone/m16-reservations-deposits-seating`               |
| Status           | ✅ Complete                                                 |
| Date             | 2026-03-26                                                  |
| Previous         | M15 — Shifts / Till Sessions / Cash Reconciliation          |

## What Was Built

### Database Layer

- **4 enums**: `ReservationStatus` (PENDING, CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW), `ReservationSource` (WALK_IN, PHONE, WHATSAPP, INSTAGRAM, MANUAL, OTHER), `ReservationDepositStatus` (PENDING, RECEIVED, APPLIED, REFUNDED, FORFEITED, VOIDED), `ReservationEventType` (CREATED, CONFIRMED, DEPOSIT_RECORDED, TABLE_ASSIGNED, SEATED, CANCELLED, NO_SHOW, DEPOSIT_REFUNDED, DEPOSIT_FORFEITED)
- **3 models**: `Reservation`, `ReservationDeposit`, `ReservationEvent`
- **Migration**: `20260326100000_m16_reservations_deposits_seating`
- **Relations**: Reservation → User (createdBy, updatedBy), Table, Order (seatedOrder); ReservationDeposit → Payment (optional); ReservationEvent → User (actor)
- **Indexes**: branch+reservationAt, branch+status, table, seatedOrder, createdAt, status

### Application Layer

- **ReservationsModule**: `reservations.module.ts`, `reservations.service.ts`, `reservations.controller.ts`
- **8 DTOs**: CreateReservationDto, ConfirmReservationDto, SeatReservationDto, CancelReservationDto, MarkNoShowDto, RecordDepositDto, ListReservationsQueryDto, AssignTableDto
- **12 endpoints**:
  - `POST /reservations` — Create reservation
  - `GET /reservations` — List (paginated, filterable by status/date/upcoming/tableId)
  - `GET /reservations/upcoming` — List upcoming PENDING/CONFIRMED
  - `GET /reservations/:id` — Get by ID
  - `PATCH /reservations/:id/confirm` — Confirm
  - `PATCH /reservations/:id/seat` — Seat (optional order creation)
  - `PATCH /reservations/:id/cancel` — Cancel (with deposit outcome)
  - `PATCH /reservations/:id/no-show` — Mark no-show (with deposit outcome)
  - `POST /reservations/:id/deposits` — Record deposit
  - `GET /reservations/:id/deposits` — List deposits
  - `GET /reservations/:id/events` — List event log
  - `PATCH /reservations/:id/assign-table` — Assign/reassign table

### Business Logic

- **State machine**: PENDING → CONFIRMED → SEATED → COMPLETED; cancel/no-show from PENDING/CONFIRMED
- **Seating bridge**: `createOrder: true` creates DINE_IN order linked via `seatedOrderId` (bridges to M10 Orders)
- **Table conflict detection**: Overlap check by reservationAt ± expectedDurationMinutes (default 120 min)
- **Deposit lifecycle**: Record → RECEIVED; on cancel/no-show → REFUNDED or FORFEITED
- **Reservation number**: `RES-XXXXXX` format, branch-scoped, sequential
- **Event log**: Append-only ReservationEvent captures all lifecycle transitions with actor, message, metadata

### Permissions (10 new)

| Permission                     | Roles with access                                 |
| ------------------------------ | ------------------------------------------------- |
| pos:reservation:create         | Owner, Manager, Supervisor, Event Manager, Cashier, Waiter |
| pos:reservation:read           | All 11 roles                                      |
| pos:reservation:confirm        | Owner, Manager, Supervisor, Event Manager, Cashier, Waiter |
| pos:reservation:seat           | Owner, Manager, Supervisor, Event Manager, Cashier, Waiter |
| pos:reservation:cancel         | Owner, Manager, Supervisor, Event Manager         |
| pos:reservation:no-show        | Owner, Manager, Supervisor, Event Manager         |
| pos:reservation:deposit:record | Owner, Manager, Supervisor, Event Manager, Cashier, Waiter |
| pos:reservation:deposit:read   | Owner, Manager, Supervisor, Event Manager, Cashier, Waiter, Accountant |
| pos:reservation:update         | Owner, Manager, Supervisor, Event Manager         |
| pos:reservation:table:assign   | Owner, Manager, Supervisor, Event Manager, Cashier, Waiter |

### Tests

- **Unit tests**: 24 tests in `reservations.service.spec.ts` covering create, confirm, seat, cancel, no-show, deposit, assign-table, list, get-by-id, state machine guards
- **E2E tests**: `reservations.e2e-spec.ts` covering full lifecycle, seating bridge with order creation, permission denial (chef), state machine enforcement, deposit recording, events/deposits listing

### Seed Data

- 5 demo reservations: PENDING (birthday dinner with deposit required), CONFIRMED (with deposit received), SEATED (walk-in), CANCELLED (schedule conflict), NO_SHOW (past reservation)
- Events and deposits seeded for each reservation as appropriate

### Postman

- `M16-Reservations-Deposits-Seating.postman_collection.json` — 14 requests with auto-capture variables and test assertions

### Docs Updated

- `docs/ARCHITECTURE.md` — M16 section with models, state machine, seating bridge, permissions, audit events
- `docs/API_CONVENTIONS.md` — 12 endpoint table
- `docs/MODULES.md` — Reservations → ✅ Implemented (M16)
- `ai/AI_STATUS.md` — M16 checklist + current state updated

## Files Created/Modified

### Created
- `packages/db/prisma/migrations/20260326100000_m16_reservations_deposits_seating/migration.sql`
- `apps/api/src/modules/reservations/reservations.module.ts`
- `apps/api/src/modules/reservations/reservations.service.ts`
- `apps/api/src/modules/reservations/reservations.controller.ts`
- `apps/api/src/modules/reservations/reservations.service.spec.ts`
- `apps/api/src/modules/reservations/dto/create-reservation.dto.ts`
- `apps/api/src/modules/reservations/dto/confirm-reservation.dto.ts`
- `apps/api/src/modules/reservations/dto/seat-reservation.dto.ts`
- `apps/api/src/modules/reservations/dto/cancel-reservation.dto.ts`
- `apps/api/src/modules/reservations/dto/mark-no-show.dto.ts`
- `apps/api/src/modules/reservations/dto/record-deposit.dto.ts`
- `apps/api/src/modules/reservations/dto/list-reservations-query.dto.ts`
- `apps/api/src/modules/reservations/dto/assign-table.dto.ts`
- `apps/api/src/modules/reservations/dto/index.ts`
- `apps/api/test/reservations.e2e-spec.ts`
- `postman/collections/M16-Reservations-Deposits-Seating.postman_collection.json`
- `ai/M16_COMPLETION_REPORT.md`

### Modified
- `packages/db/prisma/schema.prisma` — 4 enums, 3 models, 6 relation updates
- `packages/db/prisma/seed.ts` — 10 permissions, role mappings for 11 roles, seedReservations function + call
- `apps/api/src/app.module.ts` — ReservationsModule import
- `docs/ARCHITECTURE.md` — M16 section
- `docs/API_CONVENTIONS.md` — Reservation endpoints table
- `docs/MODULES.md` — Reservations status → Implemented
- `ai/AI_STATUS.md` — M16 checklist

## Verification Status

| Check                    | Status  | Notes                                          |
| ------------------------ | ------- | ---------------------------------------------- |
| pnpm db:generate         | ✅      | Prisma v5.22.0 client generated                |
| pnpm db:migrate          | ✅      | `prisma migrate deploy` — M16 migration applied |
| pnpm db:seed             | ✅      | 2× idempotent (10 perms, 58 role-perm, 5 res)  |
| pnpm lint                | ✅      | 0 errors, 197 warnings (pre-existing)           |
| pnpm test                | ✅      | 319/319 pass across 20 suites                   |
| pnpm test:e2e            | ✅      | 281/281 pass across 16 suites                   |
| CI workflow              | ✅      | branch-validation.yml: lint+unit push, e2e PR   |
| dev:api boots            | ✅      | 12 M16 routes registered, health OK             |
| Manual endpoint hits     | ✅      | 16/16 passed (all lifecycle + deposits + seat)   |
| Postman collection       | ✅      | 14 requests with assertions                     |
| DB verification          | ✅      | 10 perms, 58 mappings, 5 reservations verified  |

**Verification completed 2026-03-26**: All gates passed. DLL lock resolved (stale node.exe cleared). Used `prisma migrate deploy` instead of `migrate dev` to avoid M5 drift reset. Three bugs fixed during verification: DTO `!` assertions, e2e date conflict, lint unused var.

## Deferred Items

- M13.1 (MTN native) = PENDING
- M13.2 (Airtel native) = PENDING
- Reservation → completed auto-transition (when order closes) — deferred to future milestone
- SMS/WhatsApp confirmation notifications — deferred to notifications milestone
