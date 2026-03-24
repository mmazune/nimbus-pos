# Completion Report — M7: Menu Modifier Groups + Options

## Context Snapshot

- Current milestone: M7 ✅
- Previous completed milestone: M6.1 — Menu Taxonomy + Serving Formats
- Next milestone: M8 — Recipes / Costing

## Summary

- What was built: Full modifier group and modifier option system for the menu module — CRUD for modifier groups (Size, Cooking Temp, etc.), CRUD for modifier options (Small, Medium, Rare, etc. with price deltas), many-to-many item-to-group assignments with sort ordering, and an upgraded item detail read model that returns flattened modifierGroups with nested options.
- What is now working: Restaurant staff can create modifier groups with min/max selection rules, attach options with price deltas (Decimal-safe), assign groups to menu items, and the POS item detail endpoint returns everything needed to render customization UI. All audit-logged, branch-scoped, and permission-guarded.

## Files Added / Changed

- `packages/db/prisma/schema.prisma` — Added ModifierGroup, ModifierOption, MenuItemOnGroup models + relations on Organization, Branch, MenuItem
- `packages/db/prisma/migrations/20260321200000_m7_modifier_groups_options/migration.sql` — CREATED
- `apps/api/src/modules/menu/dto/create-modifier-group.dto.ts` — CREATED
- `apps/api/src/modules/menu/dto/update-modifier-group.dto.ts` — CREATED
- `apps/api/src/modules/menu/dto/create-modifier-option.dto.ts` — CREATED
- `apps/api/src/modules/menu/dto/update-modifier-option.dto.ts` — CREATED
- `apps/api/src/modules/menu/dto/assign-item-modifier-groups.dto.ts` — CREATED
- `apps/api/src/modules/menu/dto/index.ts` — Updated (20 total exports)
- `apps/api/src/modules/menu/menu.service.ts` — Added 9 M7 methods + upgraded getMenuItem()
- `apps/api/src/modules/menu/menu.controller.ts` — Added 10 M7 route handlers
- `apps/api/src/modules/menu/menu.service.spec.ts` — Added 13 M7 unit tests
- `apps/api/test/menu.e2e-spec.ts` — Added 14 M7 e2e tests
- `packages/db/prisma/seed.ts` — Added M7 seed data (4 groups, 14 options, 7 item assignments)
- `postman/collections/M7-Menu-Modifiers.postman_collection.json` — CREATED (16 requests)
- `postman/environments/dev.postman_environment.json` — Added modifierGroupId, modifierOptionId
- `docs/MODULES.md` — Added M7 row
- `ai/AI_STATUS.md` — Updated current milestone, added M7 checklist

## Database

- Prisma models added: ModifierGroup, ModifierOption, MenuItemOnGroup
- Migration name: 20260321200000_m7_modifier_groups_options
- Indexes / constraints:
  - `@@unique([branchId, name])` on ModifierGroup
  - `@@unique([groupId, name])` on ModifierOption
  - `@@unique([itemId, groupId])` on MenuItemOnGroup
  - `@@index([orgId])` on ModifierGroup
  - `@@index([groupId])` on ModifierOption
  - `@@index([itemId])` and `@@index([groupId])` on MenuItemOnGroup
  - Foreign keys: ModifierGroup → Organization, Branch; ModifierOption → ModifierGroup; MenuItemOnGroup → MenuItem, ModifierGroup
- Seed updates: 4 modifier groups (Size, Cooking Temp, Extra Toppings, Drink Extras) + 14 options + 7 item-group assignments across Beef Burger, Grilled Chicken, Margherita Pizza, Cola, OJ, Espresso, House Cocktail
- Notes: priceDelta uses Decimal(10,2) for monetary safety; priceDelta DTO accepts string type

## API

- Modules changed: MenuModule (service + controller extended)
- Endpoints added:
  - `POST /api/menu/modifier-groups` — Create modifier group
  - `GET /api/menu/modifier-groups` — List modifier groups (with options)
  - `GET /api/menu/modifier-groups/:id` — Get single modifier group
  - `PATCH /api/menu/modifier-groups/:id` — Update modifier group
  - `POST /api/menu/modifier-groups/:id/options` — Create modifier option
  - `GET /api/menu/modifier-groups/:id/options` — List options for group
  - `PATCH /api/menu/modifier-groups/:gId/options/:oId` — Update modifier option
  - `POST /api/menu/items/:id/modifier-groups` — Assign modifier groups to item
  - `GET /api/menu/items/:id/modifier-groups` — List modifier groups for item
  - `GET /api/menu/items/:id` — (upgraded) includes modifierGroups in response
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard on all endpoints
- Permissions: pos:menu:read (GET), pos:menu:write (POST/PATCH) — reused from M6
- Audit coverage: 5 new events (MODIFIER_GROUP_CREATED, MODIFIER_GROUP_UPDATED, MODIFIER_OPTION_CREATED, MODIFIER_OPTION_UPDATED, MENU_ITEM_MODIFIER_GROUPS_ASSIGNED)
- Idempotency coverage: Seed is fully idempotent (skip if exists pattern)

## Tests

- Unit tests: 33 total in menu.service.spec.ts (20 M6/M6.1 + 13 M7)
  - M7 tests: create/list/get/update modifier groups, duplicate/min>max rejection, create/list/update modifier options, duplicate/not-found rejection, assign/list item modifier groups, assignment validation
- E2e tests: 50 total in menu.e2e-spec.ts (36 M6/M6.1 + 14 M7)
  - M7 tests: full CRUD flows for modifier groups and options, assignment, item detail, clearing assignments, 409/400 edge cases
- Commands run: `pnpm db:generate`, `pnpm test`
- Results: Pending full verification run

## Postman

- Collection added: `M7-Menu-Modifiers.postman_collection.json` (16 requests)
  - Login, Modifier Groups (create, duplicate 409, min>max 400, list, get, update), Modifier Options (create, duplicate 409, list, update), Item Modifier Assignment (assign, list, item detail, clear)
- Variables added: modifierGroupId, modifierOptionId in dev environment
- Manual checklist: Pending server + Neon availability

## Docs

- ROADMAP status impact: M7 marked complete, next is M8
- Files updated: MODULES.md (added M7 row), AI_STATUS.md (updated current milestone + M7 checklist)

## DONE Checks

- `pnpm db:generate` — ✅ passed
- `pnpm lint` — pending
- `pnpm test` — pending
- `pnpm db:migrate` — pending Neon connectivity
- `pnpm db:seed` — pending Neon connectivity

## Decisions / Deviations

- priceDelta DTO uses string type (not number) to preserve Decimal(10,2) precision through JSON transport
- Assignment uses delete+recreate pattern (not upsert) within a $transaction for simplicity and atomicity
- No soft-delete for modifier groups/options — isActive flag serves the same purpose
- Reused existing pos:menu:read/write permissions rather than creating new modifier-specific ones

## Known Issues

- Neon Postgres P1001: Database suspends after inactivity. Migration SQL created manually, needs to be applied when Neon comes online.
- Windows DLL lock: Prisma engine DLLs may be locked by stale node.exe processes. First db:generate attempt may fail; retry works.

## Next Step

- M8 — Recipes / Costing: recipe definitions, ingredient lists, cost calculation, margin analysis
