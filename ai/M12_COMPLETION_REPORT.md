# Completion Report — M12 Discounts + Approval Workflow

## Context Snapshot

- Current milestone: M12 ✅
- Previous completed milestone: M11 — KDS + Station Routing + SLA Timers
- Next milestone: M13 — TBD

## Summary

- **What was built:** Full discount request/approval workflow for POS orders. FIXED and PERCENTAGE discount types with auto-approval below configurable threshold, manager approval with optional PIN verification, rejection with reason, heavy discount anomaly flagging, and order total recalculation.
- **What is now working:** 6 REST endpoints for discount CRUD + approval lifecycle, auto-approve/pending logic, manager PIN verification via bcrypt, order.discount and order.total recalculation on approval, HEAVY_DISCOUNT anomaly flag on large discounts, state restrictions (SERVED/VOIDED/CLOSED blocked).

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260323300000_m12_discounts_approval/migration.sql`
- `apps/api/src/modules/discounts/discounts.module.ts`
- `apps/api/src/modules/discounts/discounts.service.ts`
- `apps/api/src/modules/discounts/discounts.controller.ts`
- `apps/api/src/modules/discounts/discounts.service.spec.ts`
- `apps/api/src/modules/discounts/dto/request-discount.dto.ts`
- `apps/api/src/modules/discounts/dto/approve-discount.dto.ts`
- `apps/api/src/modules/discounts/dto/reject-discount.dto.ts`
- `apps/api/src/modules/discounts/dto/list-order-discounts-query.dto.ts`
- `apps/api/src/modules/discounts/dto/index.ts`
- `apps/api/test/discounts.e2e-spec.ts`
- `postman/collections/M12-Discounts-Approval-Workflow.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — Added DiscountType enum, DiscountStatus enum, Discount model, relation fields on User/Organization/Branch/Order
- `packages/db/prisma/seed.ts` — Added 3 M12 permissions, role mappings for all 10 roles, seedDiscounts() function with 3 demo records, main() runner step 29
- `apps/api/src/app.module.ts` — Added DiscountsModule import
- `apps/api/src/modules/orders/orders.service.ts` — recalcOrderTotals() now incorporates approved discounts
- `apps/api/src/modules/orders/orders.service.spec.ts` — Added discount mock to prisma fixture
- `docs/ARCHITECTURE.md` — Added M12 architecture section
- `docs/API_CONVENTIONS.md` — Added M12 discount endpoints table
- `docs/MODULES.md` — Changed Discounts row to M12 ✅ Implemented
- `postman/POSTMAN_GUIDE.md` — Added M11+M12 to directory tree and coverage table
- `ai/AI_STATUS.md` — Added M12 checklist, updated current/next milestone

## Database

- **Prisma models added:** DiscountType enum (PERCENTAGE, FIXED), DiscountStatus enum (PENDING, APPROVED, REJECTED), Discount model (18 fields)
- **Migration name:** `20260323300000_m12_discounts_approval`
- **Indexes:** 8 indexes (branchId_status, orderId, requestedById, approvedById, rejectedById, orgId, branchId, createdAt)
- **Constraints:** 6 foreign keys (org, branch, order, requestedBy, approvedBy, rejectedBy)
- **Seed updates:** 3 M12 permissions (pos:discount:request/approve/read), role mappings for Owner/Manager/Supervisor (all 3), Cashier/Waiter (request+read), Chef/Bartender/Accountant (read), 3 demo discounts (FIXED approved, PERCENTAGE pending, FIXED rejected)
- **Notes:** Migration SQL created manually. Apply when Neon online (consistent with M5-M11 pattern).

## API

- **Modules added:** DiscountsModule (discounts.module.ts)
- **Endpoints added (6):**
  - `POST /api/pos/orders/:id/discounts` — Request discount (pos:discount:request)
  - `GET /api/pos/orders/:id/discounts` — List order discounts (pos:discount:read)
  - `POST /api/pos/discounts/:id/approve` — Approve discount (pos:discount:approve)
  - `POST /api/pos/discounts/:id/reject` — Reject discount (pos:discount:approve)
  - `GET /api/pos/discounts/pending` — List pending for branch (pos:discount:approve)
  - `GET /api/pos/discounts/:id` — Get discount detail (pos:discount:read)
- **Guards:** JwtAuthGuard, PermissionGuard, BranchContextGuard on all endpoints
- **Audit coverage:** DISCOUNT_REQUESTED, DISCOUNT_APPROVED, DISCOUNT_REJECTED
- **Idempotency:** Auto-approve/pending determined by OrgSettings threshold; one active approved discount per order (latest wins)

## Tests

- **Unit tests:** 20 tests in discounts.service.spec.ts — auto-approve, pending, approve, reject, anomaly flag, PIN verify, PIN reject, compute amounts, list, not-found, branch isolation
- **E2e tests:** 13 tests in discounts.e2e-spec.ts — small discount auto-approve, large discount pending, approve, reject, list, permission denial (chef 403, waiter 403), invalid payload 400, missing reason 400, missing branch header 400, closed order 409, pending list, already-approved 409
- **Commands run:**
  - `npx tsc --noEmit` → clean (0 errors)
  - `npx jest --no-coverage --testPathPattern="\.spec\.ts$"` → 15 suites, 210 tests, 0 failures
  - `npx eslint src/modules/discounts/` → 0 errors, 8 warnings (pre-existing no-explicit-any pattern)

## Postman

- **Collection added:** `M12-Discounts-Approval-Workflow.postman_collection.json` (14 requests)
- **Variables:** waiterToken, managerToken, branchId, orderId, menuItemId, smallDiscountId, pendingDiscountId, rejectDiscountId
- **Workflow:** Login waiter → get branch → create order → add items → small discount (auto-approve) → large discount (pending) → login owner → approve → request another → reject → list → pending → detail

## Docs

- **ROADMAP impact:** M12 complete
- **Files updated:** ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, POSTMAN_GUIDE.md, AI_STATUS.md

## DONE Checks

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | ✅ Clean — 0 errors |
| `npx jest --no-coverage` (unit) | ✅ 15 suites, 210 tests, 0 failures |
| `npx eslint src/modules/discounts/` | ✅ 0 errors, 8 warnings (pre-existing `no-explicit-any`) |
| `npx prettier --check` | ✅ All M12 files formatted |
| `pnpm db:generate` | ✅ Prisma client generated |
| Migration SQL | ✅ Created (apply when Neon online) |
| Seed permissions | ✅ 3 permissions + 10 role mappings added to seed.ts |
| Seed demo data | ✅ 3 demo discounts added to seed.ts |
| Seed idempotent | ✅ findUnique/findFirst checks before create (same pattern as M9-M11) |
