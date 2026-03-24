# Completion Report — M11 KDS + Station Routing + SLA Timers

## Context Snapshot

- Current milestone: M11 ✅
- Previous completed milestone: M10 — POS Orders: Create + Lifecycle + Status Machine
- Next milestone: M12 — TBD (Discounts / Payments per ROADMAP)

## Summary

- What was built: Kitchen Display System (KDS) module — station-routed work tickets with real-time urgency timers and SSE streaming. Orders sent to kitchen/bar automatically spawn per-station KDS tickets. SLA configuration per branch/station with GREEN→AMBER→RED color states.
- What is now working: KDS queue endpoint with urgency enrichment, mark-ready/recall ticket actions, per-station SLA config CRUD, SSE real-time stream, automatic ticket creation on order send.

## Files Added / Changed

### Added
- `apps/api/src/modules/kds/kds.module.ts` — NestJS module with EventEmitterModule
- `apps/api/src/modules/kds/kds.service.ts` — Core KDS logic (ticket CRUD, queue enrichment, SLA)
- `apps/api/src/modules/kds/kds.controller.ts` — 6 endpoints + SSE stream
- `apps/api/src/modules/kds/dto/list-kds-queue-query.dto.ts` — Queue query DTO
- `apps/api/src/modules/kds/dto/update-kds-sla.dto.ts` — SLA update DTO with custom validator
- `apps/api/src/modules/kds/dto/index.ts` — Barrel export
- `apps/api/src/modules/kds/kds.service.spec.ts` — 20 unit tests
- `apps/api/test/kds.e2e-spec.ts` — 13 e2e tests
- `packages/db/prisma/migrations/20260323200000_m11_kds_station_routing/migration.sql` — Migration SQL
- `postman/collections/M11-KDS-Station-Routing.postman_collection.json` — 8 Postman requests

### Changed
- `packages/db/prisma/schema.prisma` — Added KdsTicketStatus enum, KdsUrgencyState enum, KdsTicket model, KdsTicketItem model, KdsSlaConfig model, relations on Organization/Branch/Order/OrderItem
- `packages/db/prisma/seed.ts` — M11 permissions (3), role mappings (7 roles), seedKdsData function, milestone bumped to M11
- `apps/api/src/app.module.ts` — Added KdsModule import
- `apps/api/src/modules/orders/orders.module.ts` — Added KdsModule import
- `apps/api/src/modules/orders/orders.service.ts` — Inject KdsService, create tickets on sendOrder
- `apps/api/src/modules/orders/orders.service.spec.ts` — Added KdsService mock
- `docs/ARCHITECTURE.md` — Added M11 architecture section
- `docs/API_CONVENTIONS.md` — Added KDS endpoints table
- `docs/MODULES.md` — KDS marked as Implemented
- `ai/AI_STATUS.md` — Updated to M11

## Database

- Prisma models added: KdsTicket (11 fields), KdsTicketItem (4 fields), KdsSlaConfig (9 fields)
- Enums added: KdsTicketStatus (QUEUED, READY, RECALLED), KdsUrgencyState (GREEN, AMBER, RED)
- Migration name: 20260323200000_m11_kds_station_routing
- Indexes: 7 on KdsTicket (branchId+status+station+createdAt, orgId, orderId, station, branchId+station, branchId+status, branchId+createdAt), 2 on KdsTicketItem (kdsTicketId, orderItemId), 2 on KdsSlaConfig (branchId+station unique, orgId)
- Seed updates: 3 permissions added, 7 role-permission mappings updated, SLA configs for 4 stations, demo KDS tickets for SENT order
- Notes: Migration SQL created manually (Neon P1001 pattern — apply when online)

## API

- Modules added: KdsModule (imports EventEmitterModule.forRoot(), exports KdsService)
- Endpoints added:
  - `GET /api/kds/queue` — Queue view with urgency enrichment (pos:kds:read)
  - `GET /api/kds/sla-config/:station` — SLA config read (pos:kds:read)
  - `PATCH /api/kds/sla-config/:station` — SLA config update (pos:kds:sla:write)
  - `POST /api/kds/tickets/:id/mark-ready` — Mark ticket ready (pos:kds:write)
  - `POST /api/kds/tickets/:id/recall` — Recall ticket (pos:kds:write)
  - `GET /api/stream/kds` — SSE stream (JwtAuthGuard + BranchContextGuard)
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard on all endpoints; SSE has JwtAuth + Branch only
- Audit coverage: KDS_TICKET_CREATED, KDS_TICKET_READY, KDS_TICKET_RECALLED, KDS_SLA_UPDATED
- Idempotency coverage: createTicketsForOrder returns existing tickets if already created

## Tests

- Unit tests: 20 in kds.service.spec.ts — ticket creation (multi-station grouping, NONE exclusion, non-SENT rejection, idempotency), queue (enrichment, station filter, urgency sorting), mark-ready (happy, conflict, not found), recall (happy, conflict), SLA config (stored, defaults), SLA update (happy, invalid order), urgency calculation (GREEN/AMBER/RED), event publishing
- e2e tests: 13 in kds.e2e-spec.ts — order create+send with KDS tickets, queue retrieval, station filtering, auth/branch denial, mark-ready, already-ready conflict, recall, non-ready recall conflict, SLA read, SLA update, invalid SLA, nonexistent ticket
- Existing tests: All 190 tests across 14 suites passing (0 regressions)
- Commands run: `npx tsc --noEmit` (clean), `pnpm jest --no-coverage` (190 pass), `npx eslint apps/api/src/modules/kds` (0 errors)

## Postman

- Collection added: M11-KDS-Station-Routing.postman_collection.json
- Requests: Login, Get KDS Queue, Get Queue (KITCHEN filter), Get SLA Config, Update SLA Config, Mark Ticket Ready, Recall Ticket, Update SLA Invalid (400)
- Variables: Uses {{accessToken}}, {{branchId}}, {{kdsTicketId}}

## Docs

- ARCHITECTURE.md: M11 section with models, lifecycle, urgency logic, SSE, permissions, audit events
- API_CONVENTIONS.md: KDS endpoints table (6 endpoints)
- MODULES.md: KDS / Station Routing → ✅ Implemented (M11)
- AI_STATUS.md: Milestone advanced to M11, full checklist added

## DONE Checks

- `npx tsc --noEmit` — ✅ Clean (0 errors)
- `pnpm jest --no-coverage` — ✅ 190 tests, 14 suites, all passing
- `npx eslint apps/api/src/modules/kds` — ✅ 0 errors (10 pre-existing no-explicit-any warnings)
- `pnpm db:generate` — ✅ Prisma client generated
- `pnpm db:migrate` — Pending Neon connectivity (migration SQL created)
- `pnpm db:seed` — Pending Neon connectivity (seed function added)

## Decisions / Deviations

- KDS moved from M15 to M11 per user request
- Used @nestjs/event-emitter (EventEmitter2) for SSE rather than Redis pub/sub (local-first, Redis deferred)
- SLA urgency computed at query time (no cron/ticker) — keeps implementation simple, clients see real-time urgency on each poll/SSE event
- KDS ticket creation failure on sendOrder is caught silently to avoid blocking order send operations

## Known Issues

- Neon P1001: Migration and seed pending database connectivity (same pattern as M5-M10)
- SSE stream uses in-process EventEmitter2 — horizontal scaling will need Redis adapter in future milestone

## Next Step

- M12: Discounts / Payments (per ROADMAP)
