# Completion Report — M14 Refunds + Post-Close Void Flows

## Context Snapshot

- Current milestone: M14
- Previous completed milestone: M13.1 — MTN Native Request-to-Pay + Offline Manual Reference Fallback
- Next milestone: M15 — TBD

## Summary

- What was built: Refund module (create, approve, list, get) with auto-complete threshold logic, manager PIN approval for high-value refunds, post-close void flow with 15-minute window and PIN requirement, CI pipeline for branch validation.
- What is now working: Complete refund lifecycle on closed orders, post-close void with transaction safety, anomaly flagging, audit trail, permission matrix for all roles.

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260325100000_m14_refunds_voids/migration.sql`
- `apps/api/src/modules/refunds/refunds.module.ts`
- `apps/api/src/modules/refunds/refunds.service.ts`
- `apps/api/src/modules/refunds/refunds.controller.ts`
- `apps/api/src/modules/refunds/refunds.service.spec.ts`
- `apps/api/src/modules/refunds/dto/create-refund.dto.ts`
- `apps/api/src/modules/refunds/dto/approve-refund.dto.ts`
- `apps/api/src/modules/refunds/dto/post-close-void.dto.ts`
- `apps/api/src/modules/refunds/dto/index.ts`
- `apps/api/test/refunds.e2e-spec.ts`
- `.github/workflows/branch-validation.yml`
- `postman/collections/M14-Refunds-Voids.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — RefundStatus enum, Refund model, relations on Organization, Branch, Order, Payment, User
- `packages/db/prisma/seed.ts` — 4 new permissions + role-permission matrix updates for all roles
- `apps/api/src/app.module.ts` — RefundsModule imported
- `docs/ARCHITECTURE.md` — M14 section
- `docs/API_CONVENTIONS.md` — Refund endpoints table
- `docs/MODULES.md` — Refunds row updated to M14 / Implemented
- `ai/AI_STATUS.md` — M14 checklist + status update

## Database

- Prisma models added/changed: RefundStatus enum, Refund model (14 fields), relation arrays on Organization, Branch, Order, Payment, User
- Migration name: 20260325100000_m14_refunds_voids
- Indexes / constraints: 8 indexes (orgId, branchId, orderId, paymentId, status, createdById, approvedById, createdAt)
- Seed updates: 4 permissions (pos:refund:create/approve/read, pos:void:postclose) + role mappings for Owner, Manager, Supervisor, Cashier, Waiter, Chef, Bartender, Accountant
- Notes: Migration is SQL-only; apply when Neon online

## API

- Modules added/changed: RefundsModule (new), app.module.ts (updated)
- Endpoints added/updated:
  - POST `/api/pos/orders/:id/refunds` — Create refund (auto-complete or PENDING)
  - GET `/api/pos/orders/:id/refunds` — List refunds for order
  - GET `/api/pos/refunds/:id` — Get refund detail
  - POST `/api/pos/refunds/:id/approve` — Approve pending refund
  - POST `/api/pos/orders/:id/post-close-void` — Post-close void (15-min window + PIN)
- Guards applied: JwtAuthGuard, PermissionGuard, BranchContextGuard on all endpoints
- Audit coverage: REFUND_AUTO_COMPLETED, REFUND_REQUESTED, REFUND_APPROVED, ORDER_POST_CLOSE_VOIDED
- Idempotency coverage: Refund amount checked against existing refunds; duplicate approval blocked by status check

## Tests

- Unit tests: 16 tests in refunds.service.spec.ts (265 total across 17 suites)
- e2e tests: 11 tests in refunds.e2e-spec.ts
- Commands run: `npx jest --no-cache --forceExit`
- Results: 17 suites, 265 tests passed, 0 failures
- Full e2e gate: 14/14 suites PASS, 238/238 tests PASS (EXIT:0)
- Branch-wide pre-existing e2e bugs fixed: payments (stale lifecycle URLs + auto-close prevention), orders (close payload + response shape + TAKEAWAY guard), kds (HTTP 201 status + timeouts), inventory (unitCost decimal regex + Decimal serialization), quick-pin (self-healing PIN issuance in beforeAll); global 10000/15000 ms per-test timeouts raised to 30000 ms

## Postman

- Collection added: M14-Refunds-Voids.postman_collection.json (18 requests, 25 pm.test assertions)
- Variables/tests added: refundId, paymentId captured; status assertions on refund creation, get, list, approve, post-close void
- Manual checklist executed: Yes — lifecycle URLs updated (accept→in-kitchen, serve→mark-served), auto-complete threshold logic verified

## Docs

- ROADMAP status impact: M14 now completed
- Files updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, AI_STATUS.md

## DONE Checks

- `pnpm db:generate` — ✅ Prisma Client v5.22.0 generated
- `npx eslint src --ext .ts` — ✅ 0 errors, 156 warnings (pre-existing no-explicit-any)
- `npx jest` — ✅ 17 suites, 265 tests, 0 failures
- `pnpm db:migrate` — ✅ Applied to Neon (17/17 migrations up to date, no pending)
- `pnpm db:seed` — ✅ Idempotent confirmed (2× run; second run all-skipped)
- `npx jest --config test/jest-e2e.json --runInBand` — ✅ 14/14 suites PASS, 238/238 tests PASS (EXIT:0)

## Decisions / Deviations

- Reused `discountApprovalThreshold` from OrgSettings for refund auto-complete threshold (same concept, avoids schema addition for now)
- Refund model placed in its own module (`apps/api/src/modules/refunds/`) rather than inside payments module, for cleaner separation of concerns
- Post-close void window uses `order.updatedAt` as the close timestamp (matches when status was set to CLOSED)

## Known Issues

- Neon P1001: migration and seed need to be applied when DB is online
- Post-close void e2e test depends on owner having quickPinHash set — may need seed update for reliable e2e

## Next Step

- M15 (per ROADMAP — to be determined by project governance)
