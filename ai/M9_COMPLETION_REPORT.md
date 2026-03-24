# Completion Report — M9 Inventory Stock + FIFO

## Context Snapshot

- Current milestone: M9 ✅
- Previous completed milestone: M8 — Recipes + Ingredient Costing (COGS Foundation)
- Next milestone: M10 — TBD

## Summary

- What was built: Branch-scoped stock batch management with FIFO deduction foundation, inventory levels with reorder thresholds, stock adjustments with negative stock blocking, and audit trail for all stock operations.
- What is now working: Stock batch creation/listing, inventory level aggregation from batch remainingQty with belowReorder flag, positive adjustments (zero-cost batch creation), negative adjustments (FIFO consumption from oldest batches), negative stock blocking with NEGATIVE_STOCK_ATTEMPT audit, and per-item batch history.

## Files Added / Changed

### Added
- `apps/api/src/modules/inventory/inventory.module.ts`
- `apps/api/src/modules/inventory/inventory.controller.ts`
- `apps/api/src/modules/inventory/inventory.service.ts`
- `apps/api/src/modules/inventory/inventory.service.spec.ts`
- `apps/api/src/modules/inventory/dto/index.ts`
- `apps/api/src/modules/inventory/dto/create-stock-batch.dto.ts`
- `apps/api/src/modules/inventory/dto/create-stock-adjustment.dto.ts`
- `apps/api/src/modules/inventory/dto/list-inventory-levels-query.dto.ts`
- `apps/api/test/inventory.e2e-spec.ts`
- `packages/db/prisma/migrations/20260323000000_m9_inventory_stock_batches/migration.sql`
- `postman/collections/M9-Inventory-Stock.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — Added StockBatch model (14 fields, 6 indexes), StockAdjustment model (8 fields, 4 indexes), added reorderLevel/reorderQty to InventoryItem, updated Organization/Branch/User/InventoryItem relations
- `packages/db/prisma/seed.ts` — Bumped to M9/v0.9.0, 3 new permissions (pos:inventory:read/write/adjust), updated role-permission matrix for all 11 roles, added reorderLevel/reorderQty to 24 inventory items, 30 stock batches with realistic costs and FIFO demo data
- `apps/api/src/app.module.ts` — Registered InventoryModule
- `apps/api/src/modules/recipes/dto/inventory-item.dto.ts` — Added reorderLevel/reorderQty to Create and Update DTOs
- `apps/api/src/modules/recipes/recipes.service.ts` — Updated createInventoryItem and updateInventoryItem to pass reorderLevel/reorderQty
- `postman/POSTMAN_GUIDE.md` — Added M9 manual checklist, updated directory tree and milestone table
- `docs/API_CONVENTIONS.md` — Added M9 endpoint tables and FIFO logic section
- `docs/MODULES.md` — Updated Inventory status to ✅ Implemented
- `README.md` — Updated milestone table
- `ai/AI_STATUS.md` — Added M9 checklist

## Schema Changes

### New Models
- **StockBatch**: id, orgId, branchId, itemId, batchNumber, receivedQty, remainingQty, unitCost, expiryDate, receivedAt, goodsReceiptId, metadata, createdAt, updatedAt (14 fields) — indexes on [branchId,itemId], expiryDate, receivedAt, orgId, itemId, goodsReceiptId
- **StockAdjustment**: id, orgId, branchId, itemId, qtyDelta, reason, userId, createdAt (8 fields) — indexes on [branchId,itemId], orgId, userId, createdAt

### Modified Models
- **InventoryItem**: +reorderLevel Decimal(10,3) default 0, +reorderQty Decimal(10,3) default 0, +stockBatches relation, +stockAdjustments relation

## Endpoints

| Method | Path                                | Permission              | Description                    |
| ------ | ----------------------------------- | ----------------------- | ------------------------------ |
| POST   | `/api/inventory/batches`            | pos:inventory:write     | Create stock batch             |
| GET    | `/api/inventory/batches`            | pos:inventory:read      | List all stock batches         |
| GET    | `/api/inventory/items/:id/batches`  | pos:inventory:read      | List batches for item          |
| GET    | `/api/inventory/levels`             | pos:inventory:read      | Get stock levels + reorder     |
| POST   | `/api/inventory/adjustments`        | pos:inventory:adjust    | Create stock adjustment        |

## Permissions

| Permission              | Owner | Manager | Supervisor | Stock Manager | Chef | Cashier | Waiter | Bartender |
| ----------------------- | ----- | ------- | ---------- | ------------- | ---- | ------- | ------ | --------- |
| pos:inventory:read      | ✅    | ✅      | ✅         | ✅            | ✅   | ✅      | ✅     | ✅        |
| pos:inventory:write     | ✅    | ✅      | ✅         | ✅            | ❌   | ❌      | ❌     | ❌        |
| pos:inventory:adjust    | ✅    | ✅      | ✅         | ✅            | ❌   | ❌      | ❌     | ❌        |

## Test Summary

- Unit tests: 14 tests in `inventory.service.spec.ts` — batch creation, levels aggregation, FIFO deduction, adjustments, negative stock blocking, branch isolation
- E2e tests: 13 tests in `inventory.e2e-spec.ts` — batch CRUD, levels, adjustments, RBAC denial, error cases
- Existing tests: All M0–M8 tests remain unchanged

## FIFO Design

- `fifoDeduct(ctx, itemId, qty)`: Internal method that finds oldest non-empty batches (receivedAt ASC) and deducts sequentially
- Returns `{ batchId, deducted }[]` array for traceability
- Exposed as internal service method — will be reused by order-close deduction in M10+
- Negative stock is blocked at the adjustment level before FIFO is called

## What Was NOT Built (Explicitly Deferred)

- Order-close deduction (M10+)
- Purchase orders / goods receipts (M11-M12)
- Wastage ledger / stock counts (M13)
- Multi-warehouse / inter-branch transfers (future)
- Barcode scanning / batch auto-generation (future)
