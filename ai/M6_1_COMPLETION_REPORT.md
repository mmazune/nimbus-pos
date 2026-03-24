# Completion Report — M6.1 POS Menu Taxonomy + Serving Formats

## Context Snapshot

- Current milestone: M6.1
- Previous completed milestone: M6 — Menu Catalog + Categories + Tax Categories
- Next milestone: M7 — Menu Modifiers + Variants

## Summary

- What was built: POS browse groups (FOOD/DRINKS sections) with optional subgroups, serving formats per menu item (GLASS, BOTTLE, PINT, etc.), item-to-browse assignment, a POS navigation tree endpoint, and an upgraded catalog read model.
- What is now working: Full CRUD for browse groups, subgroups, and servings. Items can be assigned to browse groups/subgroups. The navigation endpoint returns a section→group→subgroup tree for the POS UI. The catalog endpoint now returns `{ categories, taxCategories }` with browseGroup, browseSubgroup, and servings per item.

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260321100000_m6_1_menu_taxonomy_serving_formats/migration.sql`
- `apps/api/src/modules/menu/dto/create-browse-group.dto.ts`
- `apps/api/src/modules/menu/dto/update-browse-group.dto.ts`
- `apps/api/src/modules/menu/dto/create-browse-subgroup.dto.ts`
- `apps/api/src/modules/menu/dto/update-browse-subgroup.dto.ts`
- `apps/api/src/modules/menu/dto/create-menu-item-serving.dto.ts`
- `apps/api/src/modules/menu/dto/update-menu-item-serving.dto.ts`
- `apps/api/src/modules/menu/dto/assign-menu-item-browse.dto.ts`
- `apps/api/src/modules/menu/dto/list-menu-navigation-query.dto.ts`
- `postman/collections/M6_1-Menu-Taxonomy-Serving-Formats.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — Added MenuSection enum, ServingFormat enum, MenuBrowseGroup, MenuBrowseSubgroup, MenuItemServing models; added browseGroupId/browseSubgroupId to MenuItem
- `packages/db/prisma/seed.ts` — Added M6.1 browse groups (8), subgroups (5), assignments (20 items), servings (12); updated AppConfig to v0.6.1/M6.1
- `apps/api/src/modules/menu/dto/index.ts` — Exports all 15 DTOs (7 M6 + 8 M6.1)
- `apps/api/src/modules/menu/menu.service.ts` — 13 new methods + upgraded getCatalog
- `apps/api/src/modules/menu/menu.controller.ts` — 12 new route handlers
- `apps/api/src/modules/menu/menu.service.spec.ts` — 10 new unit tests (20 total)
- `apps/api/test/menu.e2e-spec.ts` — 16 new e2e tests (36 total), fixed catalog test for new shape
- `postman/environments/dev.postman_environment.json` — Added browseGroupId, browseSubgroupId, servingId
- `docs/MODULES.md` — Added M6.1 row
- `ai/AI_STATUS.md` — Updated current milestone, added M6.1 checklist

## Database

- Prisma models added: MenuBrowseGroup, MenuBrowseSubgroup, MenuItemServing
- Prisma enums added: MenuSection (FOOD, DRINKS), ServingFormat (GLASS, BOTTLE, JUG, PINT, HALF_PINT, SHOT, SINGLE, DOUBLE, CARAFE, FLIGHT, CUP, CUSTOM)
- Prisma fields added to MenuItem: browseGroupId, browseSubgroupId (nullable FK)
- Migration name: `20260321100000_m6_1_menu_taxonomy_serving_formats`
- Unique constraints: `[branchId, name]` on MenuBrowseGroup, `[groupId, name]` on MenuBrowseSubgroup, `[menuItemId, format, label]` on MenuItemServing
- Indexes: `menuItemId` on MenuItemServing, `branchId` on MenuBrowseGroup, `browseGroupId` and `browseSubgroupId` on MenuItem
- FK behavior: MenuBrowseSubgroup → Cascade delete with group; MenuItem browseGroupId/browseSubgroupId → SetNull on delete
- Seed: 8 browse groups (4 FOOD: Starters/Mains/Desserts/Sides, 4 DRINKS: Cocktails/Beer/Soft Drinks/Hot Beverages), 5 subgroups (Cold Starters, Hot Starters, Grills, Pasta, Pizza), 20 item-browse assignments, 12 serving formats across 6 drink items

## API

- Module: MenuModule (unchanged — service already exported)
- Endpoints added (12):
  - `POST /api/menu/browse-groups` — create browse group (pos:menu:write)
  - `GET /api/menu/browse-groups` — list browse groups (pos:menu:read)
  - `GET /api/menu/browse-groups/:id` — get browse group (pos:menu:read)
  - `PATCH /api/menu/browse-groups/:id` — update browse group (pos:menu:write)
  - `POST /api/menu/browse-groups/:id/subgroups` — create subgroup (pos:menu:write)
  - `GET /api/menu/browse-groups/:id/subgroups` — list subgroups (pos:menu:read)
  - `PATCH /api/menu/browse-groups/:groupId/subgroups/:subgroupId` — update subgroup (pos:menu:write)
  - `POST /api/menu/items/:id/servings` — create serving (pos:menu:write)
  - `GET /api/menu/items/:id/servings` — list servings (pos:menu:read)
  - `PATCH /api/menu/items/:itemId/servings/:servingId` — update serving (pos:menu:write)
  - `PATCH /api/menu/items/:id/browse` — assign browse group/subgroup (pos:menu:write)
  - `GET /api/menu/navigation` — POS browse tree (pos:menu:read)
- Endpoints updated (1):
  - `GET /api/menu/catalog` — now returns `{ categories: [...], taxCategories: [...] }` with browseGroup, browseSubgroup, servings per item
- Guards: JwtAuthGuard + PermissionGuard + BranchContextGuard on all endpoints
- Audit: MENU_BROWSE_GROUP_CREATED, MENU_BROWSE_GROUP_UPDATED, MENU_BROWSE_SUBGROUP_CREATED, MENU_BROWSE_SUBGROUP_UPDATED, MENU_ITEM_SERVING_CREATED, MENU_ITEM_SERVING_UPDATED, MENU_ITEM_BROWSE_ASSIGNED
- No new permissions needed — reuses existing pos:menu:read/write

## Tests

- Unit tests: 20 passing in menu.service.spec.ts (10 M6 + 10 M6.1)
  - M6.1 tests cover: createBrowseGroup, duplicate group conflict, listBrowseGroups, getBrowseGroup NotFound, createSubgroup, subgroup parent NotFound, createServing, duplicate serving conflict, assignItemBrowse, getNavigation section grouping
- E2e tests: 36 tests in menu.e2e-spec.ts (20 M6 + 16 M6.1)
  - M6.1 e2e: browse group CRUD (5), subgroup CRUD (3), serving CRUD (3), assign browse + clear (2), navigation + filtered (2), waiter denial (1)
- Commands: `npx jest --testPathPattern="menu.service.spec" --no-coverage` → 20/20 ✅
- TypeScript: `npx tsc --noEmit` → clean ✅

## Postman

- Collection added: `M6_1-Menu-Taxonomy-Serving-Formats.postman_collection.json` (24 requests across 4 folders)
- Environment updated: Added browseGroupId, browseSubgroupId, servingId variables
- Coverage: browse groups CRUD + duplicate 409, subgroups CRUD, servings CRUD, assign/clear browse, navigation (unfiltered + FOOD filtered), upgraded catalog

## Docs

- MODULES.md: Added M6.1 row "Menu Taxonomy + Servings"
- AI_STATUS.md: Updated milestone to M6.1, added full checklist
- No ROADMAP change needed (M6.1 is a sub-milestone of M6)

## DONE Checks

- `pnpm db:generate` → ✅ clean
- `npx tsc --noEmit` → ✅ clean (0 errors)
- `npx jest --testPathPattern="menu.service.spec"` → ✅ 20/20 pass
- E2e tests: Written and ready (require running DB for execution)
- Seed: Updated and idempotent (requires running DB for execution)
- Migration: SQL committed, requires Neon connectivity to apply

## Breaking Changes

- **Catalog endpoint shape changed**: `GET /api/menu/catalog` now returns `{ categories: [...], taxCategories: [...] }` instead of a flat array. Any client consuming the old flat array format must update to `response.categories`.
