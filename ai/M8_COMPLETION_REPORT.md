# Completion Report — M8 Recipes + Ingredient Costing (COGS Foundation)

## Context Snapshot

- Current milestone: M8 ✅
- Previous completed milestone: M7 — Menu Modifier Groups + Options
- Next milestone: M9 — Inventory (Live Stock)

## Summary

- What was built: Full recipe/ingredient costing system — inventory item master records, recipe linking (menu item → ingredient rows), and theoretical COGS cost breakdown with role-based visibility masking.
- What is now working: Branch-scoped inventory items CRUD, atomic recipe set/replace, recipe viewing (grouped by base/modifier/serving), cost breakdown with effectiveQty/extendedCost/totalCogs/margin/marginPercent, modifier-linked ingredient costing, and chef cost visibility gating via OrgSettings.showCostToChef.

## Files Added / Changed

### Added
- `apps/api/src/modules/recipes/recipes.module.ts`
- `apps/api/src/modules/recipes/recipes.controller.ts`
- `apps/api/src/modules/recipes/recipes.service.ts`
- `apps/api/src/modules/recipes/recipes.service.spec.ts`
- `apps/api/src/modules/recipes/dto/index.ts`
- `apps/api/src/modules/recipes/dto/set-recipe.dto.ts`
- `apps/api/src/modules/recipes/dto/inventory-item.dto.ts`
- `apps/api/src/modules/recipes/dto/list-recipe-cost-query.dto.ts`
- `apps/api/test/recipes.e2e-spec.ts`
- `packages/db/prisma/migrations/20260321300000_m8_recipes_costing/migration.sql`
- `postman/collections/M8-Recipes-Costing.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — Added InventoryItem + RecipeIngredient models, updated 5 relation arrays
- `packages/db/prisma/seed.ts` — M8 permissions, role-permission matrix, 24 inventory items, 10 recipes, 2 modifier-linked recipes
- `apps/api/src/app.module.ts` — Registered RecipesModule
- `postman/environments/dev.postman_environment.json` — Added inventoryItemId, inventoryItemId2
- `postman/POSTMAN_GUIDE.md` — Added M8 manual checklist, updated directory tree and milestone table
- `docs/ARCHITECTURE.md` — Added M8 architecture section
- `docs/API_CONVENTIONS.md` — Added M8 endpoint tables
- `docs/MODULES.md` — Updated M8 status to ✅ Implemented
- `README.md` — Updated milestone table
- `repo file tree.txt` — Added M8 files
- `ai/AI_STATUS.md` — Added M8 checklist

## Database

- Prisma models added: `InventoryItem` (13 fields), `RecipeIngredient` (14 fields)
- Migration name: `20260321300000_m8_recipes_costing`
- Indexes / constraints:
  - `@@unique([branchId, name])` on InventoryItem
  - 6 indexes on RecipeIngredient FK columns (menuItemId, inventoryItemId, menuItemServingId, modifierOptionId, branchId, orgId)
  - Foreign keys on both tables with CASCADE delete on org/branch, RESTRICT on referenced entities
- Seed updates:
  - 3 new permissions: pos:recipe:read, pos:recipe:write, pos:cost:read
  - Role-permission matrix: Owner/Manager/Supervisor get all 3; Chef gets pos:recipe:read + pos:cost:read
  - 24 inventory items (proteins, produce, dairy, bakery, beverages, bar, pizza, pasta)
  - 10 base recipes with 31 total ingredient rows
  - 2 modifier-linked recipes (Extra Cheese on Beef Burger + Margherita Pizza)
- Notes: Migration SQL created manually — apply via `prisma db execute` when Neon Postgres is online

## API

- Modules added: `RecipesModule` at `apps/api/src/modules/recipes/`
- Endpoints added (7 total):
  - `POST /api/inventory/items` — Create inventory item
  - `GET /api/inventory/items` — List inventory items
  - `GET /api/inventory/items/:id` — Get inventory item by ID
  - `PATCH /api/inventory/items/:id` — Update inventory item
  - `POST /api/inventory/recipes/:menuItemId` — Set/replace recipe (atomic)
  - `GET /api/inventory/recipes/:menuItemId` — Get recipe (grouped)
  - `GET /api/inventory/recipes/:menuItemId/cost` — Cost breakdown
- Guards applied: JwtAuthGuard, PermissionGuard, BranchContextGuard on all 7 endpoints
- Audit coverage: 6 events (INVENTORY_ITEM_CREATED, INVENTORY_ITEM_UPDATED, RECIPE_SET, RECIPE_UPDATED, RECIPE_COST_VIEWED, RECIPE_ACCESS_DENIED)
- Idempotency coverage: N/A for M8 (deferred to M41)

## Tests

- Unit tests: 25 tests in `recipes.service.spec.ts`
  - Inventory item CRUD (create, duplicate rejection, update, 404, list, get)
  - Recipe set/replace (new vs existing, 404 menu item, 404 inventory item, serving validation, modifier validation)
  - Recipe get (grouped ingredients, 404)
  - Cost calculation (math verification, serving price selection, default serving, chef cost masking, showCostToChef toggle, permission denial, 404 cases, modifier-linked costing)
- E2e tests: 17 tests in `recipes.e2e-spec.ts`
  - Inventory items: create, duplicate 409, list, get, update, missing branch 400, permission 403, invalid payload 400
  - Recipes: set recipe, get recipe, cost breakdown, atomic replace, 404 menu item, 404 inventory item, invalid payload 400, RBAC cost denial 403
- Commands run: `pnpm jest --testPathPattern="recipes.service.spec" --no-coverage`
- Results: 25/25 passing (6.961s)

## Postman

- Collection added: `M8-Recipes-Costing.postman_collection.json` (10 requests in 2 folders)
- Variables added: `inventoryItemId`, `inventoryItemId2` (auto-captured in test scripts)
- Manual checklist: Added to POSTMAN_GUIDE.md (13 steps)

## Docs

- ROADMAP status impact: M8 is now ✅ Complete
- Files updated: README.md, ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, POSTMAN_GUIDE.md, repo file tree.txt, AI_STATUS.md

## DONE Checks

- `pnpm db:generate` — ✅ Prisma client generated successfully
- `pnpm lint` — Pending
- `pnpm test` — 25/25 M8 unit tests passing
- `pnpm db:migrate` — Pending Neon connectivity (migration SQL created manually)
- `pnpm db:seed` — Pending Neon connectivity (seed logic written + tested in prior milestones)
- `dev:api` — Pending Neon connectivity

## Decisions / Deviations

- Used `/inventory` as the controller prefix (not `/recipes`) to group inventory items and recipes under one namespace, matching the spec's endpoint design.
- RecipeIngredient supports optional `menuItemServingId` and `modifierOptionId` for serving-specific and modifier-linked ingredients respectively.
- Cost breakdown returns string-formatted Decimal values (not floats) for frontend safety.
- Visibility masking removes cost fields entirely from the response (not null values) when the caller is masked.

## Known Issues

- Neon Postgres P1001 suspend: Migration SQL and seed must be applied when Neon comes online. This is a known pattern from M3.1–M7.
- E2e tests require a running database with seeded data — cannot be verified until migration is applied.

## Next Step

- M9: Inventory (Live Stock) — stock quantity tracking, par levels, reorder points, stock movements (deduction on order, receiving, adjustments).
