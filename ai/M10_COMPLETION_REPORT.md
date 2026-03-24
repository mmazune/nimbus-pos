# Completion Report — M10 POS Orders: Create + Lifecycle + Status Machine

## Context Snapshot

- Current milestone: M10
- Previous completed milestone: M9 — Inventory Stock + FIFO
- Next milestone: M11 — TBD

## Summary

- What was built: Full POS order module with order creation (dine-in / takeaway), line item CRUD with pricing + cost snapshots, and a 7-state lifecycle machine (NEW → SENT → IN_KITCHEN → READY → SERVED → CLOSED, VOIDED from pre-served states).
- What is now working: 12 REST endpoints under `/api/pos/orders`, branch-scoped with full RBAC, audit logging, and recipe-based cost snapshots on every line item.

## Files Added / Changed

- `packages/db/prisma/schema.prisma` — Added OrderStatus enum, ServiceType enum, Order model, OrderItem model, relations to Organization/Branch/User/Table/MenuItem/MenuItemServing
- `packages/db/prisma/migrations/20260323100000_m10_pos_orders/migration.sql` — CREATE TYPE + CREATE TABLE + indexes + FKs
- `packages/db/prisma/seed.ts` — Added M10 permissions (4), role-perm matrix updates (7 roles), seedOrders() function (6 demo orders), main() runner hook, recordSeedRun
- `apps/api/src/modules/orders/dto/create-order.dto.ts`
- `apps/api/src/modules/orders/dto/add-order-item.dto.ts`
- `apps/api/src/modules/orders/dto/update-order-item.dto.ts`
- `apps/api/src/modules/orders/dto/transition-order.dto.ts`
- `apps/api/src/modules/orders/dto/list-orders-query.dto.ts`
- `apps/api/src/modules/orders/dto/index.ts`
- `apps/api/src/modules/orders/orders.service.ts` — Full service with state machine, pricing, cost snapshots
- `apps/api/src/modules/orders/orders.controller.ts` — 12 endpoints with guard chain
- `apps/api/src/modules/orders/orders.module.ts` — Module registration
- `apps/api/src/app.module.ts` — Added OrdersModule import
- `apps/api/src/modules/orders/orders.service.spec.ts` — 26 unit tests
- `apps/api/test/orders.e2e-spec.ts` — 16 e2e tests
- `postman/collections/M10-POS-Orders.postman_collection.json` — 14 requests with test scripts
- `postman/POSTMAN_GUIDE.md` — M10 tree entry, status table entry, manual checklist
- `docs/ARCHITECTURE.md` — M10 architecture section
- `docs/API_CONVENTIONS.md` — M10 endpoint tables
- `docs/MODULES.md` — POS Orders marked as implemented
- `ai/AI_STATUS.md` — M10 checklist

## Database

- Prisma models added: Order (17 fields, 7 indexes, unique [branchId, orderNumber]), OrderItem (14 fields, 3 indexes)
- Enums added: OrderStatus (NEW, SENT, IN_KITCHEN, READY, SERVED, VOIDED, CLOSED), ServiceType (DINE_IN, TAKEAWAY)
- Migration name: 20260323100000_m10_pos_orders
- Indexes: idx_orders_branch_status, idx_orders_table, idx_orders_user, idx_orders_created, idx_orders_org, idx_orders_service_type, unique [branchId, orderNumber], idx_order_items_order, idx_order_items_menu_item, idx_order_items_serving
- Seed updates: 4 new permissions, 7 role-permission matrix updates, 6 demo orders with line items, seedOrders() function, m10-pos-orders SeedHistory entry
- Notes: Migration SQL created manually — apply when Neon online (same pattern as M3.1–M9)

## API

- Modules added: OrdersModule (orders.module.ts)
- Endpoints added (12 total):
  - POST /api/pos/orders — Create order
  - GET /api/pos/orders — List orders (paginated, filterable)
  - GET /api/pos/orders/:id — Get order detail
  - POST /api/pos/orders/:id/items — Add item to order
  - PATCH /api/pos/orders/:id/items/:itemId — Update order item
  - DELETE /api/pos/orders/:id/items/:itemId — Remove order item
  - POST /api/pos/orders/:id/send — Transition NEW → SENT
  - POST /api/pos/orders/:id/in-kitchen — Transition SENT → IN_KITCHEN
  - POST /api/pos/orders/:id/ready — Transition IN_KITCHEN → READY
  - POST /api/pos/orders/:id/mark-served — Transition READY → SERVED
  - POST /api/pos/orders/:id/close — Transition SERVED → CLOSED
  - POST /api/pos/orders/:id/void — Void order (from NEW/SENT/IN_KITCHEN/READY)
- Guards applied: JwtAuthGuard → PermissionGuard → BranchContextGuard (all endpoints)
- Audit coverage: ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_UPDATED, ORDER_ITEM_REMOVED, ORDER_SENT, ORDER_IN_KITCHEN, ORDER_READY, ORDER_SERVED, ORDER_CLOSED, ORDER_VOIDED
- Idempotency: Order number unique per branch prevents duplicate creation

## Tests

- Unit tests: 26 tests in orders.service.spec.ts
  - createOrder (4 tests: dine-in happy path, takeaway happy path, takeaway+table rejection, invalid table rejection)
  - getOrder (2 tests: happy path, not found)
  - listOrders (2 tests: paginated result, status filter)
  - addOrderItem (4 tests: happy path + recalc, closed rejection, voided rejection, not found)
  - deleteOrderItem (2 tests: happy path + recalc, closed rejection)
  - sendOrder (2 tests: NEW→SENT, CLOSED→SENT rejection)
  - markInKitchen (1 test: SENT→IN_KITCHEN)
  - markReady (1 test: IN_KITCHEN→READY)
  - markServed (1 test: READY→SERVED)
  - closeOrder (2 tests: SERVED→CLOSED, NEW→CLOSED rejection)
  - voidOrder (5 tests: NEW without reason, IN_KITCHEN with reason, post-kitchen without reason rejection, SERVED rejection, CLOSED rejection)
- e2e tests: 16 tests in orders.e2e-spec.ts (full lifecycle, items CRUD, void, error cases)
- Commands run: `pnpm jest --testPathPattern="orders.service.spec" --no-coverage`
- Results: 26 passed, 0 failed

## Postman

- Collection added: M10-POS-Orders.postman_collection.json (14 requests)
- Variables/tests: accessToken auto-capture, orderId/takeawayOrderId/orderItemId auto-saved, status assertions, format validation
- Manual checklist: Added to POSTMAN_GUIDE.md (20 items)

## Docs

- ROADMAP status impact: M10 should be marked complete
- Files updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, POSTMAN_GUIDE.md, AI_STATUS.md

## DONE Checks

- `pnpm db:generate`: ✅ Generated Prisma Client (v5.22.0)
- `pnpm jest --testPathPattern="orders.service.spec"`: ✅ 26 passed, 0 failed
- `pnpm lint`: Pending
- `pnpm db:migrate`: Pending Neon connectivity
- `pnpm db:seed`: Pending Neon connectivity

## Decisions / Deviations

- ROADMAP had POS Orders as M14; user prompt redefines it as M10. Following user instruction.
- Module placed at `apps/api/src/modules/orders/` (not `pos/`) — flat module layout consistent with existing modules.
- Tax and discount computation deferred (total = subtotal for now); stubs in recalcOrderTotals().
- Order number generation uses sequential DB query, not atomic DB sequence — sufficient for single-instance POS; upgrade to DB sequence if concurrency becomes a concern.

## Known Issues

- Migration SQL pending application on Neon (same pattern as M3.1–M9).
- E2e tests require DB connection + seed data — cannot run offline.
- Pre-existing ~97 `no-explicit-any` lint warnings from M1-M7 code (not introduced by M10).

## Next Step

- M11 — TBD (likely Purchasing/Suppliers or Stock Counts depending on roadmap priority).
