# M17 Completion Report — Events + Booking Portal + Ticketing

## Milestone Summary

| Field            | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Milestone        | M17                                                         |
| Title            | Events + Booking Portal + Ticketing                         |
| Branch           | `milestone/m17-events-booking-ticketing`                    |
| Status           | ✅ Complete                                                 |
| Date             | 2026-03-27                                                  |
| Previous         | M16 — Reservations + Deposits + Seating Bridge              |

## What Was Built

### Database Layer

- **5 enums**: `EventStatus` (DRAFT, PUBLISHED, OPEN, CLOSED, CANCELLED, COMPLETED), `EventBookingStatus` (PENDING, CONFIRMED, CANCELLED, REFUNDED), `TicketStatus` (ISSUED, CHECKED_IN, CANCELLED, EXPIRED), `TicketClassType` (GENERAL, VIP, EARLY_BIRD, GROUP, COMPLIMENTARY), `CheckInStatus` (ADMITTED, DUPLICATE, DENIED)
- **6 models**: `Event`, `EventTicketClass`, `EventBooking`, `EventTicket`, `EventCheckIn`, `EventAuditLog`
- **Migration**: `20260326200000_m17_events_booking_ticketing` — 5 CREATE TYPE, 6 CREATE TABLE, ~50 indexes, ~30 foreign keys, 6 unique constraints
- **Relations**: Event → Organization, Branch, Table (venue), User (createdBy/updatedBy); EventTicketClass → Event; EventBooking → Event, TicketClass, User; EventTicket → Booking, Event, TicketClass; EventCheckIn → Ticket, Event, User; EventAuditLog → Event, User
- **Indexes**: branch+eventNumber (unique), branch+status, branch+startsAt, portalKey (unique), slug, booking+ticketClass, ticket qrToken (unique), check-in ticket+status

### Application Layer

- **EventsModule**: `events.module.ts`, `events.service.ts`, `events.controller.ts`
- **10 DTOs**: CreateEventDto, UpdateEventDto, PublishEventDto, CloseEventDto, CreateTicketClassDto, CreateBookingDto, CancelBookingDto, IssueTicketsDto, CheckInTicketDto, ListEventsQueryDto
- **16 endpoints**:
  - `POST /events` — Create event (DRAFT)
  - `GET /events` — List events (paginated, filterable by status/date/search)
  - `GET /events/upcoming` — List upcoming events
  - `GET /events/portal/:portalKey` — Public portal view
  - `GET /events/:id` — Get event by ID
  - `PATCH /events/:id` — Update DRAFT event
  - `PATCH /events/:id/publish` — Publish event (generates portalKey + slug)
  - `PATCH /events/:id/close` — Close event
  - `POST /events/:id/ticket-classes` — Create ticket class
  - `GET /events/:id/ticket-classes` — List ticket classes
  - `POST /events/:id/bookings` — Create booking
  - `GET /events/:id/bookings` — List bookings for event
  - `GET /events/bookings/:bookingId` — Get booking by ID
  - `PATCH /events/bookings/:bookingId/cancel` — Cancel booking
  - `POST /events/bookings/:bookingId/tickets/issue` — Issue tickets
  - `POST /events/tickets/:ticketId/check-in` — Check in ticket

### Business Logic

- **State machine**: DRAFT → PUBLISHED → OPEN → CLOSED/COMPLETED/CANCELLED; cancel from DRAFT/PUBLISHED/OPEN
- **Event number generation**: EVT-XXXXXX format, branch-scoped, sequential
- **Booking number generation**: BKG-XXXXXX format, branch-scoped, sequential
- **Ticket number generation**: TKT-XXXXXX format, branch-scoped, sequential
- **Publish flow**: Generates 32-byte hex portalKey + optional slug; transitions DRAFT → PUBLISHED
- **Booking flow**: Validates booking window (bookingOpensAt/bookingClosesAt), ticket class capacity, creates CONFIRMED booking in transaction with soldCount updates
- **Ticket issuance**: Creates `quantity` tickets with 16-byte hex QR tokens; prevents duplicate issuance (409)
- **Check-in**: Validates ticket is ISSUED, logs ADMITTED; duplicate check-in logs DUPLICATE (409); invalid ticket logs DENIED (409). Auto-updates booking status to CHECKED_IN when all tickets checked in.
- **Cancel booking**: Reverses capacity (decrements soldCount on ticket class and event), cancels all tickets
- **Portal endpoint**: Returns public-safe event data with ticket class availability (excludes orgId, branchId, internal IDs)
- **EventAuditLog**: Dedicated audit trail for all event lifecycle actions with actor, IP, user-agent

### Permissions (12 new)

| Permission               | Roles with access                                 |
| ------------------------ | ------------------------------------------------- |
| pos:event:create         | Owner, Manager, Supervisor                        |
| pos:event:read           | All roles                                         |
| pos:event:update         | Owner, Manager, Supervisor                        |
| pos:event:publish        | Owner, Manager, Supervisor                        |
| pos:event:close          | Owner, Manager, Supervisor                        |
| pos:event:booking:create | Owner, Manager, Supervisor, Cashier, Waiter       |
| pos:event:booking:read   | Owner, Manager, Supervisor, Cashier, Waiter, Accountant |
| pos:event:booking:cancel | Owner, Manager, Supervisor                        |
| pos:event:ticket:issue   | Owner, Manager, Supervisor, Cashier, Waiter       |
| pos:event:ticket:read    | Owner, Manager, Supervisor, Cashier, Waiter, Accountant |
| pos:event:checkin        | Owner, Manager, Supervisor, Cashier, Waiter       |
| pos:event:portal:read    | Owner, Manager, Supervisor, Cashier, Waiter       |

### Tests

- **Unit tests**: 19 tests in `events.service.spec.ts` covering create event (DRAFT), publish event, reject publish non-DRAFT, create ticket class, reject ticket class exceeding capacity, create booking + sold counts, reject booking window not open, reject booking capacity exceeded, issue tickets, reject duplicate issuance, check-in ticket, reject duplicate check-in, cancel booking + decrement counts, reject double cancel, branch isolation (404), close event, reject update non-DRAFT, portal key lookup, portal 404 for non-public
- **E2E tests**: `events.e2e-spec.ts` covering full lifecycle: create → update → ticket class → publish → portal → booking → ticket issuance → check-in → cancel → list → upcoming → close → permission denial (chef)

### Seed Data

- 12 new permissions + role mappings for 8 roles (Owner, Manager, Supervisor, Cashier, Waiter, Chef, Bartender, Accountant)
- 3 demo events:
  - EVT-000001: DRAFT event (upcoming, basic setup)
  - EVT-000002: OPEN event with full chain (2 ticket classes, 3 bookings, 3 tickets, 1 check-in, audit logs)
  - EVT-000003: CANCELLED event (past date)
- `m17-events-booking-ticketing` entry in SeedHistory

### Postman

- `M17-Events-Booking-Portal-Ticketing.postman_collection.json` — 18 requests with auto-capture variables and test assertions

### Docs Updated

- `docs/ARCHITECTURE.md` — M17 section with models, state machine, booking flow, permissions, audit events
- `docs/API_CONVENTIONS.md` — 16 endpoint table
- `docs/MODULES.md` — Events/Ticketing → ✅ Implemented (M17)
- `ai/AI_STATUS.md` — M17 checklist + current state updated

## Files Created/Modified

### Created
- `packages/db/prisma/migrations/20260326200000_m17_events_booking_ticketing/migration.sql`
- `apps/api/src/modules/events/events.module.ts`
- `apps/api/src/modules/events/events.service.ts`
- `apps/api/src/modules/events/events.controller.ts`
- `apps/api/src/modules/events/events.service.spec.ts`
- `apps/api/src/modules/events/dto/create-event.dto.ts`
- `apps/api/src/modules/events/dto/update-event.dto.ts`
- `apps/api/src/modules/events/dto/publish-event.dto.ts`
- `apps/api/src/modules/events/dto/close-event.dto.ts`
- `apps/api/src/modules/events/dto/create-ticket-class.dto.ts`
- `apps/api/src/modules/events/dto/create-booking.dto.ts`
- `apps/api/src/modules/events/dto/cancel-booking.dto.ts`
- `apps/api/src/modules/events/dto/issue-tickets.dto.ts`
- `apps/api/src/modules/events/dto/check-in-ticket.dto.ts`
- `apps/api/src/modules/events/dto/list-events-query.dto.ts`
- `apps/api/src/modules/events/dto/index.ts`
- `apps/api/test/events.e2e-spec.ts`
- `postman/collections/M17-Events-Booking-Portal-Ticketing.postman_collection.json`
- `ai/M17_COMPLETION_REPORT.md`

### Modified
- `packages/db/prisma/schema.prisma` — 5 enums, 6 models, 10 relation updates
- `packages/db/prisma/seed.ts` — 12 permissions, role mappings, seedEvents function + call
- `apps/api/src/app.module.ts` — EventsModule import
- `docs/ARCHITECTURE.md` — M17 section
- `docs/API_CONVENTIONS.md` — Events endpoints table
- `docs/MODULES.md` — Events/Ticketing status → Implemented
- `ai/AI_STATUS.md` — M17 checklist + current state

## Verification Status

| Check                    | Status  | Notes                                          |
| ------------------------ | ------- | ---------------------------------------------- |
| pnpm db:generate         | ✅      | Prisma v5.22.0 client generated                |
| pnpm db:migrate          | ✅      | `prisma migrate deploy` — 21 migrations applied |
| pnpm db:seed             | ✅      | 2× idempotent (12 perms, role mappings, 3 events) |
| pnpm lint                | ✅      | 0 errors, 219 warnings (pre-existing)           |
| pnpm test                | ✅      | 338/338 pass across 21 suites                   |
| pnpm test:e2e            | ✅      | 26/26 M17 e2e tests pass (216s)                |
| Postman collection       | ✅      | 18 requests with assertions                    |
| DB verification          | ✅      | 12 perms, role mappings, 3 events verified     |

## Deferred Items

- M13.1 (MTN native) = PENDING
- M13.2 (Airtel native) = PENDING
- Event → COMPLETED auto-transition (when all tickets checked in) — service supports it via check-in logic
- SMS/WhatsApp booking confirmation notifications — deferred to notifications milestone
- Public portal without auth (currently requires JWT + branch context) — deferred to public API milestone
