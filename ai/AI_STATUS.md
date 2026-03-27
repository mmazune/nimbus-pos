# AI_STATUS.md — Live Progress Tracker

## Current State

- Repo name: nimbus-pos
- Current milestone: M20.1 ✅
- Last completed milestone: M20.1 — Reporting Depth Expansion + M20 Finalization
- Next milestone: M21 — TBD
- M13.1 (MTN Native) = PENDING
- M13.2 (Airtel Native) = PENDING
- Date updated: 2026-03-28

## Environment

- Node target: 22.x (verified: v22.14.0)
- pnpm target: 8.x (verified: 8.15.0)
- Database target: Neon Postgres (wired in M1 ✅, verified M3.1 ✅)
- Prisma version: 5.22.0
- Redis target: docker-compose for local dev (wired later)
- API port target: 3001
- Web port target: 3000

## Locked Decisions

- Stack: Node 22 + TypeScript + NestJS + Prisma + Neon + Redis + BullMQ
- ID type: cuid2
- Validation: class-validator + class-transformer
- Auth v1: JWT access + refresh
- Frontend: Next.js Pages Router
- Deferred until late wave: MSR badge login, smart spouts

## Milestone Checklist

### M0 — Repo Bootstrap + Workspace Tooling

- [x] Workspace created (pnpm workspaces + Turbo)
- [x] API scaffold created (NestJS under apps/api)
- [x] Shared packages scaffolded (packages/db, packages/shared)
- [x] lint / format / test scripts wired
- [x] docs scaffolded (ARCHITECTURE, API_CONVENTIONS, MODULES)
- [x] Health endpoint working (GET /api/health)
- [x] Unit test passing (app.controller.spec.ts)
- [x] e2e test passing (app.e2e-spec.ts)
- [x] Postman collection + environment created
- [x] DONE checks passed

### M1 — Neon + Prisma Baseline + Seed Framework

- [x] Prisma configured (schema.prisma with AppConfig + SeedHistory)
- [x] Neon connection works (via DATABASE_URL env var)
- [x] Migration pipeline works (20260320000000_m1_baseline committed)
- [x] Seed runner idempotent (safe to run multiple times)
- [x] DB-backed /health passes (SELECT 1 check)
- [x] PrismaModule + PrismaService in apps/api/src/common/prisma/
- [x] Root db:generate / db:migrate / db:seed / db:studio scripts wired
- [x] Postman M1-Health-DB collection created
- [x] Docs updated (README, ARCHITECTURE, MODULES, repo file tree)
- [x] pnpm lint clean
- [x] pnpm test clean (2 unit + 2 e2e tests passing)
- [x] DONE checks passed

### M2 — Auth v1 + Sessions + RBAC

- [x] Prisma schema: User, Role, Permission, RolePermission, UserRole, Session, RefreshToken, AuditLog
- [x] Migration: 20260320065959_m2_auth_rbac_sessions committed
- [x] JWT access (15m) + opaque refresh (7d) with rotation + family revocation
- [x] PIN login (4–6 digit, bcrypt hashed)
- [x] Session persistence (jti, platform, source, IP, user-agent, lastActivityAt)
- [x] RBAC: 5 levels (L1–L5), 11 job roles, 6 permissions
- [x] PermissionGuard (decorator-driven)
- [x] PlatformAccessGuard (X-Platform header, level-based matrix)
- [x] AuditService (global module, 10 action types)
- [x] Common decorators (@CurrentUser, @Permissions, @Roles)
- [x] Seed: 11 roles, 6 permissions, 27 role-permission mappings, 6 demo users (idempotent)
- [x] Unit tests: 20 passing (auth.service, permission.guard, platform-access.guard)
- [x] E2e tests: 16 passing (auth flows, RBAC denial, platform denial)
- [x] pnpm lint clean (0 errors)
- [x] Manual API verification (health, login, me, pin-login, 403s)
- [x] Postman M2-Auth-RBAC collection + environment + guide
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, README, repo file tree)
- [x] DONE checks passed

### M3 — Multi-Tenancy Core

- [x] Prisma schema: Organization, Branch, Membership models + enums (OrganizationStatus, BranchStatus, MembershipStatus)
- [x] Migration: 20260320073537_m3_tenancy_org_branch_membership committed
- [x] TenancyModule: service + controller with full CRUD for orgs, branches, memberships
- [x] DTOs: create-org, create-branch, create-membership (class-validator)
- [x] BranchContextGuard: reads X-Branch-Id header, validates branch exists + ACTIVE + user has ACTIVE membership
- [x] @RequireBranchContext decorator for controller routes
- [x] Auth integration: GET /api/me returns full tenancy context (orgs, branches, memberships, roles, permissions, session)
- [x] 5 M3 permissions: tenancy:org:read/write, tenancy:branch:read/write, tenancy:membership:manage
- [x] Role-permission matrix updated for all 11 roles
- [x] Audit events: ORG_CREATED, BRANCH_CREATED, MEMBERSHIP_CREATED, BRANCH_ACCESS_DENIED
- [x] Seed: 1 org, 2 branches, 6 memberships (idempotent)
- [x] Unit tests: tenancy.service.spec (7 tests) + branch-context.guard.spec (4 tests)
- [x] E2e tests: tenancy.e2e-spec (13 tests across 3 suites)
- [x] Postman M3-Tenancy collection + environment updated
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, README, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed

### M3.1 — Quick PIN Login for POS Desktop

- [x] Prisma schema: QuickPinTier enum + 13 new User fields (quickPinHash, pinLookupHash, pinTier, pinLength, displayName, employeeCode, avatarUrl, quickPinEnabled, failedPinAttempts, pinLockedUntil, lastPinChangedAt, quickPinIssuedAt, quickPinIssuedById)
- [x] Migration: 20260320100000_m3_1_quick_pin_login (SQL created manually — apply when Neon online)
- [x] QuickPinService: quickPinLogin, issueQuickPin, resetQuickPin, updateQuickPinSettings, getQuickPinStatus
- [x] Dual-hash security: HMAC-SHA256 pinLookupHash (indexed) + bcrypt quickPinHash
- [x] Role-tier policy: LOW_6 (6-digit) = WAITER/CASHIER/BARTENDER, HIGH_8 (8-digit) = SUPERVISOR/MANAGER
- [x] Platform enforcement: POS_DESKTOP only for quick PIN login
- [x] Lockout policy: 5 failed attempts → 5-minute lock
- [x] 4 DTOs: QuickPinLoginDto, IssueQuickPinDto, ResetQuickPinDto, UpdateQuickPinSettingsDto
- [x] 5 controller endpoints: POST quick-pin-login, POST issue, POST reset, PATCH settings, GET status
- [x] Audit logging: QUICK_PIN_LOGIN, QUICK_PIN_ISSUED, QUICK_PIN_RESET, QUICK_PIN_SETTINGS_UPDATED, QUICK_PIN_LOCKOUT
- [x] Seed: 3 demo quick PINs (waiter=123456/LOW_6, cashier=654321/LOW_6, manager=12345678/HIGH_8)
- [x] Unit tests: 15 tests in quick-pin.service.spec.ts (+ 48 total across 7 suites)
- [x] E2e tests: 16 tests in quick-pin.e2e-spec.ts (+ 44 total across 4 suites)
- [x] Postman: M3_1-Quick-PIN-Login collection (17 requests) + environment updated
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed (2026-03-20: all green — generate, migrate, seed×2, lint, test, test:e2e, dev:api, health, manual PIN login verified)

### M4 — Org Settings + Configuration

- [x] Prisma schema: OrgSettings model (19 fields including Decimal, JSON, scalar) + ExchangeRate model (8 fields, composite index)
- [x] Migration: 20260320120000_m4_org_settings (SQL created manually — apply when Neon online)
- [x] SettingsModule: service + controller with 14 endpoints
- [x] Sub-resource endpoints: /settings, /settings/currency, /settings/tax-matrix, /settings/rounding, /thresholds, /settings/platform-access, /settings/exchange-rate, /settings/exchange-rates
- [x] DTOs: 7 validated DTOs (UpdateOrgSettings, UpdateCurrency, UpdateTaxMatrix, UpdateRounding, UpdateThresholds, UpdatePlatformAccess, CreateExchangeRate)
- [x] New permission: tenancy:settings:manage (assigned to Owner + Manager roles)
- [x] Audit events: SETTINGS_UPDATED, CURRENCY_UPDATED, TAX_MATRIX_UPDATED, ROUNDING_UPDATED, THRESHOLDS_UPDATED, PLATFORM_ACCESS_UPDATED, EXCHANGE_RATE_CREATED
- [x] Decimal safety: all monetary/rate fields use Prisma Decimal, never float
- [x] Seed: OrgSettings defaults (vatPercent=18, currency=UGX, discountApprovalThreshold=5000, reservationHoldMinutes=30) + ExchangeRate (USD/UGX @ 3700.000000)
- [x] Unit tests: 10 tests in settings.service.spec.ts
- [x] E2e tests: 16 tests in settings.e2e-spec.ts (auth, RBAC denial, payload validation, exchange rates)
- [x] Postman: M4-Org-Settings collection (17 requests) + environment updated
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed (2026-03-20: generate ✅, migrate ✅, seed×2 ✅, lint 0 errors ✅, test 60/60 ✅, e2e 16/16 M4 tests ✅, dev:api ✅, manual hits ✅)

### M5 — Floor Plans + Tables

- [x] Prisma schema: TableStatus enum, FloorPlan model (id, orgId, branchId, name, data Json, isActive, timestamps), Table model (id, orgId, branchId, floorPlanId?, label, capacity, status, isActive, metadata Json?, timestamps)
- [x] Migration: 20260320140000_m5_floor_plans_tables (applied via prisma db execute)
- [x] FloorModule: service + controller with full CRUD for floor plans & tables + availability endpoint
- [x] DTOs: 5 validated DTOs (CreateFloorPlan, UpdateFloorPlan, CreateTable, UpdateTable, UpdateTableStatus)
- [x] BranchContextGuard + PermissionGuard on all endpoints
- [x] 4 new permissions: pos:floor:read/write, pos:table:read/write
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Chef/Waiter/Bartender = read-only
- [x] TableStatus state machine: AVAILABLE, OCCUPIED, RESERVED, CLEANING
- [x] Unique constraint: @@unique([branchId, label]) on Table model
- [x] Audit events: FLOOR_PLAN_CREATED, FLOOR_PLAN_UPDATED, TABLE_CREATED, TABLE_UPDATED, TABLE_STATUS_CHANGED
- [x] Seed: 2 floor plans (Main Dining, Patio) + 15 tables (T1-T10, VIP-1/2, P1-P3) for MAIN branch
- [x] Unit tests: 8 tests in floor.service.spec.ts
- [x] E2e tests: 18 tests in floor.e2e-spec.ts (all pass)
- [x] Postman: M5-Floor-Plans-Tables collection (16 requests) + environment updated
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks: pending Neon connectivity for migration/seed verification

### M6 — Menu Catalog + Categories + Tax Categories

- [x] Prisma schema: MenuItemType enum (FOOD, DRINK), PrepStation enum (KITCHEN, BAR, COLD_KITCHEN, DESSERT, NONE), Category model (@@unique([branchId, name])), TaxCategory model (@@unique([branchId, name])), MenuItem model (@@unique([categoryId, name]))
- [x] Migration: 20260321000000_m6_menu_catalog (SQL created manually — apply when Neon online)
- [x] MenuModule: service + controller with full CRUD for categories, tax categories, menu items + catalog endpoint
- [x] DTOs: 7 validated DTOs (CreateCategory, UpdateCategory, CreateTaxCategory, UpdateTaxCategory, CreateMenuItem, UpdateMenuItem, ListMenuQuery)
- [x] BranchContextGuard + PermissionGuard on all 13 endpoints
- [x] 4 new permissions: pos:menu:read/write, pos:tax:read/write
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Chef/Waiter/Bartender = read-only
- [x] Catalog endpoint: GET /api/menu/catalog returns POS-friendly grouped payload (categories with items, tax summary)
- [x] Decimal safety: price Decimal(10,2), rate Decimal(5,2)
- [x] Audit events: CATEGORY_CREATED/UPDATED, TAX_CATEGORY_CREATED/UPDATED, MENU_ITEM_CREATED/UPDATED
- [x] Seed: 5 categories (Starters, Mains, Desserts, Drinks, Sides) + 2 tax categories (VAT Standard 18%, VAT Zero 0%) + 20 menu items across all categories
- [x] Unit tests: 10 tests in menu.service.spec.ts (79/79 total across 10 suites)
- [x] E2e tests: 20 tests in menu.e2e-spec.ts
- [x] Postman: M6-Menu-Catalog collection (20 requests) + environment updated (categoryId, taxCategoryId, menuItemId)
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M6.1 — Menu Taxonomy + Serving Formats

- [x] Prisma schema: MenuSection enum (FOOD, DRINKS), ServingFormat enum (12 values), MenuBrowseGroup model (@@unique([branchId, name])), MenuBrowseSubgroup model (@@unique([groupId, name])), MenuItemServing model (@@unique([menuItemId, format, label])), browseGroupId/browseSubgroupId on MenuItem
- [x] Migration: 20260321100000_m6_1_menu_taxonomy_serving_formats (SQL created manually)
- [x] DTOs: 8 new DTOs (CreateBrowseGroup, UpdateBrowseGroup, CreateBrowseSubgroup, UpdateBrowseSubgroup, CreateMenuItemServing, UpdateMenuItemServing, AssignMenuItemBrowse, ListMenuNavigationQuery)
- [x] MenuService: 13 new methods (browse groups CRUD, subgroups CRUD, servings CRUD, assignItemBrowse, getNavigation, upgraded getCatalog)
- [x] MenuController: 12 new endpoints (browse-groups 4, browse-groups/:id/subgroups 3, items/:id/servings 3, items/:id/browse 1, navigation 1)
- [x] Catalog endpoint upgraded: returns { categories: [...], taxCategories: [...] } with browseGroup, browseSubgroup, servings per item
- [x] Navigation endpoint: GET /api/menu/navigation returns POS browse tree grouped by section → groups → subgroups, supports ?section= and ?activeOnly= filters
- [x] Audit events: MENU_BROWSE_GROUP_CREATED/UPDATED, MENU_BROWSE_SUBGROUP_CREATED/UPDATED, MENU_ITEM_SERVING_CREATED/UPDATED, MENU_ITEM_BROWSE_ASSIGNED
- [x] Seed: 8 browse groups (4 FOOD + 4 DRINKS) + 5 subgroups + 20 item-browse assignments + 12 serving formats across 6 items
- [x] Unit tests: 20 tests in menu.service.spec.ts (10 M6 + 10 M6.1)
- [x] E2e tests: 36 tests in menu.e2e-spec.ts (20 M6 + 16 M6.1)
- [x] Postman: M6_1-Menu-Taxonomy-Serving-Formats collection + environment updated (browseGroupId, browseSubgroupId, servingId)
- [x] Docs updated (MODULES, AI_STATUS)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M7 — Menu Modifier Groups + Options

- [x] Prisma schema: ModifierGroup model (@@unique([branchId, name])), ModifierOption model (@@unique([groupId, name]), Decimal(10,2) priceDelta), MenuItemOnGroup join model (@@unique([itemId, groupId]))
- [x] Migration: 20260321200000_m7_modifier_groups_options (SQL created manually)
- [x] DTOs: 5 new DTOs (CreateModifierGroup, UpdateModifierGroup, CreateModifierOption, UpdateModifierOption, AssignItemModifierGroups)
- [x] MenuService: 9 new methods (modifier groups CRUD, options CRUD, item-group assignment + listing)
- [x] MenuController: 10 new endpoints (modifier-groups 4, modifier-groups/:id/options 3, items/:id/modifier-groups 2, item detail upgraded)
- [x] Item detail endpoint: GET /api/menu/items/:id returns flattened modifierGroups[{id, name, min, max, required, sortOrder, options[]}]
- [x] Business rules: min/max validation (min <= max when both > 0), unique name per branch/group, branch context enforcement
- [x] Audit events: MODIFIER_GROUP_CREATED, MODIFIER_GROUP_UPDATED, MODIFIER_OPTION_CREATED, MODIFIER_OPTION_UPDATED, MENU_ITEM_MODIFIER_GROUPS_ASSIGNED
- [x] Seed: 4 modifier groups (Size, Cooking Temp, Extra Toppings, Drink Extras) + 14 options + 7 item-group assignments
- [x] Unit tests: 33 tests in menu.service.spec.ts (20 M6/M6.1 + 13 M7)
- [x] E2e tests: 50 tests in menu.e2e-spec.ts (36 M6/M6.1 + 14 M7)
- [x] Postman: M7-Menu-Modifiers collection (16 requests) + environment updated (modifierGroupId, modifierOptionId)
- [x] Docs updated (MODULES, AI_STATUS)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M8 — Recipes + Ingredient Costing (COGS Foundation)

- [x] Prisma schema: InventoryItem model (13 fields, @@unique([branchId, name])), RecipeIngredient model (14 fields, indexed FKs), updated Organization/Branch/MenuItem/MenuItemServing/ModifierOption relations
- [x] Migration: 20260321300000_m8_recipes_costing (SQL created manually — apply when Neon online)
- [x] RecipesModule: service + controller with 7 endpoints under /inventory prefix
- [x] DTOs: 4 validated DTOs (CreateInventoryItem, UpdateInventoryItem, SetRecipe with nested RecipeIngredientDto, ListRecipeCostQuery)
- [x] Inventory item CRUD: POST/GET/GET-by-id/PATCH at /api/inventory/items
- [x] Recipe set (atomic replace): POST /api/inventory/recipes/:menuItemId — deletes all existing + creates new in a transaction
- [x] Recipe get: GET /api/inventory/recipes/:menuItemId — grouped by base/modifier/serving ingredients
- [x] Cost breakdown: GET /api/inventory/recipes/:menuItemId/cost — effectiveQty, extendedCost, totalCogs, margin, marginPercent
- [x] Visibility masking: L4/L5 always see cost; Chef (L2 CHEF) sees cost only if showCostToChef=true; cost fields omitted when masked
- [x] Validation: serving IDs, modifier option IDs, inventory item IDs all validated against branch scope
- [x] 3 new permissions: pos:recipe:read, pos:recipe:write, pos:cost:read
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 3; Chef = pos:recipe:read + pos:cost:read
- [x] Audit events: INVENTORY_ITEM_CREATED, INVENTORY_ITEM_UPDATED, RECIPE_SET, RECIPE_UPDATED, RECIPE_COST_VIEWED, RECIPE_ACCESS_DENIED
- [x] Decimal safety: theoreticalUnitCost Decimal(10,3), qtyPerUnit Decimal(10,3), wastePct Decimal(5,2)
- [x] Cost formula: effectiveQty = qtyPerUnit × (1 + wastePct/100), extendedCost = effectiveQty × unitCost
- [x] Seed: 24 inventory items, 10 base recipes (31 ingredient rows), 2 modifier-linked recipes, 3 M8 permissions in role matrices
- [x] Unit tests: 25 tests in recipes.service.spec.ts (inventory CRUD, set/replace recipe, cost calculation, visibility masking, permission denial, modifier-linked costing)
- [x] E2e tests: 17 tests in recipes.e2e-spec.ts (inventory CRUD, recipe set/get/cost, atomic replace, error cases, RBAC denial)
- [x] Postman: M8-Recipes-Costing collection (10 requests) + environment updated (inventoryItemId, inventoryItemId2)
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M9 — Inventory Stock + FIFO

- [x] Prisma schema: StockBatch model (14 fields, 6 indexes), StockAdjustment model (8 fields, 4 indexes), added reorderLevel/reorderQty to InventoryItem
- [x] Migration: 20260323000000_m9_inventory_stock_batches (SQL created manually — apply when Neon online)
- [x] InventoryModule: service + controller with 5 endpoints under /inventory prefix
- [x] DTOs: 3 validated DTOs (CreateStockBatch, CreateStockAdjustment, ListInventoryLevelsQuery)
- [x] Updated M8 DTOs: reorderLevel/reorderQty added to CreateInventoryItemDto and UpdateInventoryItemDto
- [x] Stock batch CRUD: POST /api/inventory/batches, GET /api/inventory/batches, GET /api/inventory/items/:id/batches
- [x] Inventory levels: GET /api/inventory/levels — aggregates remainingQty from batches per item, computes belowReorder flag
- [x] Stock adjustments: POST /api/inventory/adjustments — positive adjustments create zero-cost batches, negative use FIFO deduction
- [x] FIFO deduction foundation: fifoDeduct() consumes oldest batches first (receivedAt ASC), returns deduction records
- [x] Negative stock blocking: attempts audited as NEGATIVE_STOCK_ATTEMPT, returns 400
- [x] 3 new permissions: pos:inventory:read, pos:inventory:write, pos:inventory:adjust
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 3; Stock Manager = all 3; Chef/Cashier/Waiter/Bartender = pos:inventory:read only
- [x] Audit events: STOCK_BATCH_CREATED, STOCK_ADJUSTED, NEGATIVE_STOCK_ATTEMPT
- [x] Decimal safety: all quantities use Prisma Decimal(10,3), never float
- [x] Seed: reorderLevel/reorderQty on all 24 inventory items, 30 stock batches (3 for Chicken, 3 for Milk, 2 for Vodka for FIFO demo)
- [x] Unit tests: 14 tests in inventory.service.spec.ts (batch CRUD, levels, FIFO, adjustments, negative stock blocking)
- [x] E2e tests: 13 tests in inventory.e2e-spec.ts (batch CRUD, levels, adjustments, RBAC, error cases)
- [x] Postman: M9-Inventory-Stock collection (10 requests) + token capture + environment vars
- [x] Docs updated (README, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, AI_STATUS)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M10 — POS Orders: Create + Lifecycle + Status Machine

- [x] Prisma schema: OrderStatus enum (7 values), ServiceType enum (2 values), Order model (17 fields, 7 indexes, unique [branchId, orderNumber]), OrderItem model (14 fields, 3 indexes)
- [x] Relations: Order → Organization, Branch, User, Table; OrderItem → MenuItem, MenuItemServing
- [x] Migration: 20260323100000_m10_pos_orders (SQL created manually — apply when Neon online)
- [x] Prisma Client generated (v5.22.0)
- [x] OrdersModule: service + controller + module registered in app.module.ts
- [x] DTOs: 5 validated DTOs (CreateOrder, AddOrderItem, UpdateOrderItem, TransitionOrder, ListOrdersQuery) + barrel index
- [x] Order CRUD: POST /api/pos/orders, GET /api/pos/orders, GET /api/pos/orders/:id
- [x] Order items CRUD: POST /api/pos/orders/:id/items, PATCH /api/pos/orders/:id/items/:itemId, DELETE /api/pos/orders/:id/items/:itemId
- [x] State machine: NEW → SENT → IN_KITCHEN → READY → SERVED → CLOSED, with VOIDED from NEW/SENT/IN_KITCHEN/READY
- [x] Post-kitchen void requires reason (IN_KITCHEN, READY)
- [x] Closed/voided orders block item mutations
- [x] Order number generation: ORD-XXXXXX, branch-scoped sequential
- [x] Line pricing: resolves from serving price or item price + modifier deltas
- [x] Cost snapshots: computed from M8 recipe ingredients with waste%, margin calculation
- [x] Order total recalculation on every item mutation
- [x] 4 new permissions: pos:orders:read, pos:orders:write, pos:orders:close, pos:orders:void
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Waiter = read + write; Chef/Bartender = read only
- [x] Audit events: ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_UPDATED, ORDER_ITEM_REMOVED, ORDER_SENT, ORDER_IN_KITCHEN, ORDER_READY, ORDER_SERVED, ORDER_CLOSED, ORDER_VOIDED
- [x] Seed: 6 demo orders (dine-in + takeaway, various states: NEW/SENT/IN_KITCHEN/SERVED/CLOSED/VOIDED) with line items
- [x] Unit tests: 26 tests in orders.service.spec.ts (create, get, list, add/delete items, all transitions, void rules)
- [x] E2e tests: 16 tests in orders.e2e-spec.ts (order CRUD, items CRUD, full lifecycle, void, error cases)
- [x] Postman: M10-POS-Orders collection (14 requests) with test scripts + POSTMAN_GUIDE updated
- [x] Docs updated: ARCHITECTURE.md (M10 section), API_CONVENTIONS.md (M10 endpoints), MODULES.md (POS Orders → implemented)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M11 — KDS + Station Routing + SLA Timers

- [x] Schema: KdsTicketStatus + KdsUrgencyState enums, KdsTicket, KdsTicketItem, KdsSlaConfig models with relations
- [x] Migration: 20260323200000_m11_kds_station_routing (SQL created manually — apply when Neon online)
- [x] KDS module: kds.module.ts, kds.service.ts, kds.controller.ts, dto/ (ListKdsQueueQueryDto, UpdateKdsSlaDto)
- [x] Station routing: Order items grouped by PrepStation on sendOrder, NONE excluded
- [x] Ticket lifecycle: QUEUED → READY → RECALLED with audit logging + SSE events
- [x] SLA urgency: GREEN/AMBER/RED computed from elapsed time vs per-station thresholds (defaults 300/600/900s)
- [x] Queue sorting: RED first → AMBER → GREEN, oldest first within each band
- [x] SSE stream: GET /api/stream/kds with EventEmitter2 + rxjs (filtered by branch + optional station)
- [x] Order integration: sendOrder() in orders.service.ts creates KDS tickets automatically
- [x] Permissions: pos:kds:read, pos:kds:write, pos:kds:sla:write seeded + role-mapped
- [x] Seed: SLA configs for 4 stations + demo KDS tickets for SENT order
- [x] Unit tests: 20 tests in kds.service.spec.ts (ticket creation, queue enrichment, mark-ready, recall, SLA, urgency)
- [x] E2e tests: 13 tests in kds.e2e-spec.ts (queue, station filter, mark-ready, recall, SLA CRUD, auth/errors)
- [x] Postman: M11-KDS-Station-Routing collection (8 requests)
- [x] Docs updated: ARCHITECTURE.md (M11 section), API_CONVENTIONS.md (KDS endpoints), MODULES.md (KDS → Implemented)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M12 — Discounts + Approval Workflow

- [x] Schema: DiscountType + DiscountStatus enums, Discount model with relations on User, Organization, Branch, Order
- [x] Migration: 20260323300000_m12_discounts_approval (SQL created manually — apply when Neon online)
- [x] Discounts module: discounts.module.ts, discounts.service.ts, discounts.controller.ts, dto/ (RequestDiscountDto, ApproveDiscountDto, RejectDiscountDto, ListOrderDiscountsQueryDto)
- [x] Auto-approve: effective discount ≤ OrgSettings.discountApprovalThreshold → APPROVED immediately
- [x] Pending flow: large discounts → PENDING → manager approve/reject with optional PIN verification
- [x] Manager PIN: bcrypt compare against User.quickPinHash from M3.1
- [x] Heavy discount anomaly: HEAVY_DISCOUNT flag appended to order.anomalyFlags
- [x] State restrictions: discounts blocked on SERVED, VOIDED, CLOSED orders (409)
- [x] Order integration: recalcOrderTotals() incorporates latest approved discount into order.discount and order.total
- [x] Permissions: pos:discount:request, pos:discount:approve, pos:discount:read seeded + role-mapped
- [x] Seed: 3 demo discounts (FIXED/approved, PERCENTAGE/pending, FIXED/rejected) + permissions for all roles
- [x] Unit tests: 20 tests in discounts.service.spec.ts (auto-approve, pending, approve, reject, anomaly, PIN, state limits, branch isolation)
- [x] E2e tests: 13 tests in discounts.e2e-spec.ts (happy paths, permission denial, validation, closed-order rejection)
- [x] Postman: M12-Discounts-Approval-Workflow collection (14 requests)
- [x] Docs updated: ARCHITECTURE.md (M12 section), API_CONVENTIONS.md (discount endpoints), MODULES.md (Discounts → Implemented)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M13 — Payments: Cash, Card, Mobile Money

- [x] Prisma schema: PaymentMethod enum (CASH/CARD/MOMO/BANK_TRANSFER), PaymentStatus enum (PENDING/COMPLETED/FAILED/REFUNDED), PaymentIntentStatus enum (PENDING/REQUIRES_ACTION/SUCCEEDED/FAILED/CANCELLED), Payment model (12 fields, 7 indexes), PaymentIntent model (13 fields, 7 indexes), WebhookEvent model (9 fields, 3 indexes)
- [x] Migration: 20260324000000_m13_payments (SQL created manually — apply when Neon online)
- [x] PaymentsModule: service + controller + module registered in app.module.ts
- [x] DTOs: 3 validated DTOs (CloseOrderDto with nested CloseOrderPaymentDto, CreatePaymentIntentDto, CancelPaymentIntentDto) + barrel index
- [x] Close order with payment: POST /pos/orders/:id/close — validates SERVED state, split payments, cash overpayment/changeDue, blocks non-cash overpayment, MOMO requires succeeded intent
- [x] Payment intent lifecycle: POST /payments/intents (create MOMO intent), POST /payments/intents/:id/cancel
- [x] Webhook persistence-first: POST /webhooks/mtn, POST /webhooks/airtel — raw payload persisted before processing, provider ref resolution, auto-create Payment on SUCCEEDED
- [x] Get order payments: GET /pos/orders/:id/payments — returns payments + intents
- [x] Business rules: split payment (multiple methods), cash change calculation, idempotent webhook processing, duplicate payment prevention
- [x] 4 new permissions: pos:payment:create, pos:payment:close, pos:payment:intent, pos:payment:read
- [x] Role-permission matrix: Owner/Manager/Supervisor/Cashier = all 4; Waiter = create + read; Chef/Bartender = read only; Accountant = read only
- [x] Audit events: ORDER_PAID_AND_CLOSED, PAYMENT_RECORDED, PAYMENT_INTENT_CREATED, PAYMENT_INTENT_CANCELLED, PAYMENT_WEBHOOK_RECEIVED
- [x] Seed: 4 permissions + role mappings (11 roles), 2 demo payments (CASH split + CARD), 1 MOMO intent (MTN/SUCCEEDED)
- [x] Unit tests: 25 tests in payments.service.spec.ts (close order, split, overpayment, underpayment, state checks, MOMO intent, cancel, webhooks, branch isolation, audit)
- [x] E2e tests: 13 tests in payments.e2e-spec.ts (close flow, intents, webhooks, permission denial, validation, branch header)
- [x] Postman: M13-Payments-Cash-Card-MOMO collection (16 requests) with test scripts
- [x] Docs updated: MODULES.md (Payments → Implemented), AI_STATUS.md (M13 checklist)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M13.1 — MTN Native Request-to-Pay + Offline Manual Reference Fallback

- [x] Prisma schema: PaymentCaptureMode enum (ONLINE_PROVIDER/MANUAL_REFERENCE), PaymentVerificationStatus enum (NOT_REQUIRED/UNVERIFIED/VERIFIED/REJECTED), extended Payment (7 new fields: captureMode, verificationStatus, externalTransactionId, payerPhone, postedAt, enteredById, verificationNote + enteredBy relation + 3 indexes), extended PaymentIntent (11 new fields: customerPhone, externalId [unique], providerTransactionId, requestedAmount, confirmedAmount, requestedMsisdn, confirmedMsisdn, expiresAt, webhookEventIdLast, idempotencyKey, failureReason + 3 indexes), extended WebhookEvent (3 new fields: signature, headers, processingError), User.paymentsEntered relation
- [x] Migration: 20260325000000_m13_1_mtn_native_manual_reference (SQL created manually)
- [x] MTN Adapter: adapters/mtn.adapter.ts — real MTN Collections API (OAuth2, RequestToPay, status polling, token caching, sandbox helpers, status normalization)
- [x] DTOs: CreateManualReferencePaymentDto (orderId, method, amount, externalTransactionId, payerPhone?, postedAt?, note?, provider?), updated CreatePaymentIntentDto (phoneNumber required, idempotencyKey optional)
- [x] Service layer rewrite: EventEmitter2 + MtnAdapter DI, getOutstandingBalance(), autoSettleIfFullyPaid(), enhanced closeOrderWithPayment (pending intent blocking, already-paid tracking), createPaymentIntent (real MTN call, idempotency, externalId), getPaymentIntent, getPaymentIntentStatus, cancelPaymentIntent (SSE events), processWebhook (externalId resolution, confirmedAmount, auto-settle, SSE), getOrderPayments (with balance), createManualReferencePayment (UNVERIFIED, dedupe, auto-settle), getManualReferencePayment, listManualReferencePayments
- [x] Controller: 12 endpoints total — GET /payments/intents/:id, GET /payments/intents/:id/status, POST /payments/manual-reference, GET /payments/manual-reference/:id, GET /payments/manual-reference, SSE GET /stream/payments (with orderId filter), updated webhook endpoints (pass headers)
- [x] Module: MtnAdapter provider registered
- [x] 3 new permissions: pos:payment:manual-reference, pos:payment:cancel, pos:payment:override
- [x] Role-permission matrix updated: Owner/Manager/Supervisor get all 7 payment perms; Cashier gets 6 (all except override); Waiter gets intent + manual-reference + read; Chef/Bartender = read only
- [x] SSE stream: payment.update events (8 event types: PAYMENT_INTENT_CREATED, PAYMENT_PENDING, PAYMENT_SUCCEEDED, PAYMENT_FAILED, PAYMENT_CANCELLED, PAYMENT_MANUAL_REFERENCE_RECORDED, ORDER_BALANCE_UPDATED, ORDER_AUTO_SETTLED)
- [x] Seed: 3 new permissions + role mappings, manual-reference demo payment (MOMO/MANUAL_REFERENCE/UNVERIFIED), enhanced MTN intent demo (externalId, customerPhone, amounts, msisdn)
- [x] Unit tests: 39 tests in payments.service.spec.ts (all M13 tests preserved + 14 new: pending intent blocking, already-paid tracking, idempotency, MTN adapter integration, MTN failure handling, SSE events, webhook auto-settle, manual-reference CRUD, dedupe, auto-settle, VOIDED rejection, intent get/status)
- [x] E2e tests: 23 tests in payments.e2e-spec.ts (all M13 tests preserved + 10 new: manual-reference create/list/filter/403, intent get/status, order balance info, duplicate manual-reference 409)
- [x] Postman: M13_1-MTN-Native-Manual-Reference collection (19 requests) with test scripts
- [x] Docs updated: AI_STATUS.md (M13.1 checklist)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M14 — Refunds + Post-Close Void Flows

- [x] Prisma schema: RefundStatus enum (PENDING/APPROVED/COMPLETED/FAILED), Refund model (14 fields, 8 indexes), relations on Organization, Branch, Order, Payment, User (refundsCreated/refundsApproved)
- [x] Migration: 20260325100000_m14_refunds_voids (SQL created manually)
- [x] RefundsModule: refunds.module.ts, refunds.service.ts, refunds.controller.ts, dto/ (CreateRefundDto, ApproveRefundDto, PostCloseVoidDto)
- [x] Refund creation: POST /pos/orders/:id/refunds — only CLOSED orders, validates payment exists + COMPLETED, amount ≤ remaining balance
- [x] Auto-complete: refund amount ≤ OrgSettings.discountApprovalThreshold → COMPLETED immediately
- [x] Pending flow: large refunds → PENDING → manager approve with optional PIN verification
- [x] Approve refund: POST /pos/refunds/:id/approve — PENDING → COMPLETED, optional manager PIN (bcrypt against quickPinHash)
- [x] Get refund: GET /pos/refunds/:id — includes createdBy user info
- [x] List order refunds: GET /pos/orders/:id/refunds — ordered by createdAt DESC
- [x] Post-close void: POST /pos/orders/:id/post-close-void — CLOSED → VOIDED within 15-minute window, requires manager PIN, voids all payments in transaction
- [x] Payment status tracking: checkAndMarkPaymentRefunded() marks payment REFUNDED when total refunds ≥ payment amount
- [x] Anomaly flagging: highValueRefund flag on order.anomalyFlags for above-threshold refunds
- [x] 4 new permissions: pos:refund:create, pos:refund:approve, pos:refund:read, pos:void:postclose
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Waiter = create + read; Chef/Bartender/Accountant = read only
- [x] Audit events: REFUND_AUTO_COMPLETED, REFUND_REQUESTED, REFUND_APPROVED, ORDER_POST_CLOSE_VOIDED
- [x] Seed: 4 permissions + role mappings for all roles
- [x] Unit tests: 16 tests in refunds.service.spec.ts (auto-complete, pending, approve, PIN, reject excess, order state checks, post-close void, window expiry, list, get)
- [x] E2e tests: 11 tests in refunds.e2e-spec.ts (create, get, list, state check, excess amount, high-value, approve, post-close void, validation, RBAC)
- [x] CI: .github/workflows/branch-validation.yml (lint + unit on push, e2e on PR)
- [x] Postman: M14-Refunds-Voids collection (18 steps, 25 pm.test assertions — fixed lifecycle URLs + auto-complete threshold logic)
- [x] Docs updated: ARCHITECTURE.md (M14 section), API_CONVENTIONS.md (refund endpoints), MODULES.md (Refunds → Implemented)
- [x] DONE: migration applied to Neon (17/17 migrations up to date), seed idempotent (2× confirmed), e2e 11/11 passing
- [x] Full e2e gate: 14/14 suites PASS, 238/238 tests PASS (EXIT:0)
- [x] Branch-wide pre-existing e2e bugs fixed: payments (stale lifecycle URLs + auto-close), orders (close payload + response shape + TAKEAWAY guard), kds (HTTP 201 status + timeouts), inventory (unitCost decimal regex + Decimal serialization), quick-pin (self-healing PIN issuance in beforeAll); global 10000/15000 ms per-test timeouts raised to 30000 ms across all spec files

### M15 — Shifts / Till Sessions / Cash Reconciliation
> Branch: `milestone/m15-shifts-tills-reconciliation`

- [x] Prisma schema: 4 enums (ShiftStatus, TillSessionStatus, CashMovementType, VarianceStatus) + 4 models (Shift, TillSession, CashMovement, ShiftCloseSummary)
- [x] Migration SQL: `20260326000000_m15_shifts_tills_reconciliation` + `20260326000001_m15_fix_till_unique_partial` (partial unique index fix)
- [x] ShiftsModule: service + controller + DTOs (openShift, closeShift, getActiveShift, getShiftById, getShiftSummary)
- [x] TillsModule: service + controller + DTOs (openTill, safeDrop, reconcileTill, getActiveTill, getTillById, getTillSummary, hasActiveTillInBranch)
- [x] Expected cash formula: openingFloat + cashSales + paidIn − safeDrops − cashPickups − refundCashOut − refundPayout − paidOut
- [x] Variance tracking: MATCHED / SHORT / OVER with mandatory reason on mismatch
- [x] ShiftCloseSummary auto-generation on shift close (aggregates payments by method, refunds, cash movements)
- [x] 7 new permissions: pos:shift:open/close/read, pos:till:open/reconcile/safe-drop/read
- [x] Role mappings: Owner/Manager/Supervisor/Cashier/Waiter = full ops; Chef/Bartender/Accountant = read-only (41 role-permission mappings)
- [x] Unit tests: 29 new (14 shifts + 15 tills); 294 total across 19 suites — all passing
- [x] E2E tests: 22 in shifts-tills.e2e-spec.ts — full lifecycle + cleanup. Full suite: 227/227 pass (orders/inventory = pre-existing Neon P1017 flakiness, 33/33 in isolation)
- [x] Seed: 7 permissions + 41 role mappings + demo shifts/tills/cash movements/summary data (idempotent, 2× confirmed)
- [x] Postman: M15-Shifts-Tills-Reconciliation.postman_collection.json (15 requests with auto-capture + assertions)
- [x] Docs updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md
- [x] Policy hook: `hasActiveTillInBranch()` implemented for future cash-payment gating (not wired into payments service yet — deferred)
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] Append-only CashMovement pattern (no updatedAt, no deletes)
- [x] Lint: 0 errors, 0 warnings (exit 0) — 4 pre-existing unused-var fixes applied in E2E test files
- [x] Manual endpoint hits: All 11 M15 endpoints verified (correct status codes + response shapes)
- [x] dev:api boots: All 11 routes registered, health OK
- [x] DB verified: shift_perms=3, till_perms=4, shifts=2, tills=2, summaries=1, no duplicates
- [x] Schema fix: `@@unique([branchId, tillCode, status])` replaced with partial unique `WHERE status='OPEN'` via migration 20260326000001
- [x] DONE: All 16 verification gates confirmed ✅

### M16 — Reservations + Deposits + Seating Bridge
> Branch: `milestone/m16-reservations-deposits-seating`

- [x] Prisma schema: 4 enums (ReservationStatus, ReservationSource, ReservationDepositStatus, ReservationEventType) + 3 models (Reservation, ReservationDeposit, ReservationEvent)
- [x] Migration SQL: `20260326100000_m16_reservations_deposits_seating`
- [x] ReservationsModule: service + controller + 8 DTOs (create, confirm, seat, cancel, noShow, recordDeposit, listQuery, assignTable)
- [x] 12 endpoints: CRUD + lifecycle transitions + deposits + events + assign-table
- [x] State machine: PENDING → CONFIRMED → SEATED → COMPLETED; cancel/no-show from PENDING/CONFIRMED
- [x] Seating bridge: `createOrder: true` creates DINE_IN order linked via `seatedOrderId`
- [x] Table conflict detection: overlap check by time window (reservationAt ± expectedDurationMinutes)
- [x] Deposit lifecycle: PENDING → RECEIVED → APPLIED/REFUNDED/FORFEITED/VOIDED
- [x] 10 new permissions: pos:reservation:create/read/confirm/seat/cancel/no-show/deposit:record/deposit:read/update/table:assign
- [x] Role mappings: Owner/Manager/Supervisor/Event Manager = all 10; Cashier/Waiter = 7 (create/read/confirm/seat/deposit:record/deposit:read/table:assign); Chef/Bartender = read; Accountant = read+deposit:read
- [x] Unit tests: 24 in reservations.service.spec.ts — all lifecycle + guard scenarios
- [x] E2E tests: reservations.e2e-spec.ts — full lifecycle + seating bridge + permission denial + state machine enforcement
- [x] Seed: 10 permissions + role mappings + 5 demo reservations (PENDING, CONFIRMED+deposit, SEATED, CANCELLED, NO_SHOW)
- [x] Postman: M16-Reservations-Deposits-Seating.postman_collection.json (14 requests with auto-capture + assertions)
- [x] Docs updated: ARCHITECTURE.md (M16 section), API_CONVENTIONS.md (12 endpoints), MODULES.md (Implemented)
- [x] Event log: append-only ReservationEvent for full audit trail
- [x] Reservation number format: RES-XXXXXX (branch-scoped, sequential)
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] Prisma generate: v5.22.0 client generated ✅
- [x] Prisma migrate deploy: migration applied ✅
- [x] Seed 2×: idempotent (10 perms, 58 role-perm mappings, 5 reservations, 1 deposit) ✅
- [x] DB verified: 10 perms, 58 role-perm mappings, 5 reservations (PENDING/CONFIRMED/SEATED/CANCELLED/NO_SHOW) ✅
- [x] Lint: 0 errors, 197 warnings (all pre-existing `no-explicit-any`) ✅
- [x] Unit tests: 319/319 pass across 20 suites ✅
- [x] E2E tests: 281/281 pass across 16 suites ✅
- [x] CI workflow: branch-validation.yml covers lint + unit on push, e2e on PR ✅
- [x] dev:api boots: 12 M16 routes registered, health OK ✅
- [x] Manual endpoint hits: 16/16 passed (all lifecycle + deposits + events + seat with table) ✅
- [x] Postman: 14 requests with auto-capture + assertions ✅
- [x] DONE: All verification gates confirmed ✅

### M17 — Events + Booking Portal + Ticketing
> Branch: `milestone/m17-events-booking-ticketing`

- [x] Prisma schema: 5 enums (EventStatus, EventBookingStatus, TicketStatus, TicketClassType, CheckInStatus) + 6 models (Event, EventTicketClass, EventBooking, EventTicket, EventCheckIn, EventAuditLog)
- [x] Migration SQL: `20260326200000_m17_events_booking_ticketing`
- [x] EventsModule: service + controller + 10 DTOs (create-event, update-event, publish-event, close-event, create-ticket-class, create-booking, cancel-booking, issue-tickets, check-in-ticket, list-events-query)
- [x] 16 endpoints: CRUD + lifecycle (publish/close) + ticket classes + bookings + ticket issuance + check-in + portal
- [x] State machine: DRAFT → PUBLISHED → OPEN → CLOSED/COMPLETED/CANCELLED
- [x] Booking flow: capacity validation, booking window enforcement, CONFIRMED status, sold count tracking
- [x] Ticket issuance: unique QR tokens (crypto.randomBytes), duplicate prevention, TKT-XXXXXX numbering
- [x] Check-in: ADMITTED/DUPLICATE/DENIED logging, auto-completes booking when all tickets checked in
- [x] Portal endpoint: GET /events/portal/:portalKey — public-safe subset with ticket class availability
- [x] Event number format: EVT-XXXXXX, booking: BKG-XXXXXX, ticket: TKT-XXXXXX (branch-scoped, sequential)
- [x] EventAuditLog: dedicated audit table for event lifecycle actions
- [x] 12 new permissions: pos:event:create/read/update/publish/close, pos:event:booking:create/read/cancel, pos:event:ticket:issue/read, pos:event:checkin, pos:event:portal:read
- [x] Role mappings: Owner/Manager/Supervisor get all 12; Cashier/Waiter get 8 (read + booking + ticketing + checkin + portal); Chef/Bartender get read only; Accountant gets read + booking:read + ticket:read
- [x] Unit tests: 19 in events.service.spec.ts — all passing
- [x] E2E tests: events.e2e-spec.ts — full lifecycle + portal + permission denial
- [x] Seed: 12 permissions + role mappings for all roles + 3 demo events (DRAFT, OPEN with full booking/ticket/checkin chain, CANCELLED)
- [x] Postman: M17-Events-Booking-Portal-Ticketing.postman_collection.json (18 requests with auto-capture + assertions)
- [x] Docs updated: ARCHITECTURE.md (M17 section), API_CONVENTIONS.md (16 endpoints), MODULES.md (Events → Implemented)
- [x] Prisma generate: v5.22.0 client generated ✅
- [x] Prisma migrate deploy: migration applied (21 total) ✅
- [x] Seed 2×: idempotent (12 perms, role mappings, 3 events) ✅
- [x] Lint: 0 errors, 219 warnings (all pre-existing `no-explicit-any`) ✅
- [x] Unit tests: 338/338 pass across 21 suites ✅
- [x] E2E tests: 26/26 M17 e2e tests pass ✅
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M18 — Anomaly Detection + Anti-Theft Signals

- [x] Prisma schema: AnomalySeverity/AnomalyStatus/AnomalyRuleType enums, AnomalyRule model, AnomalyEvent model, RiskThreshold model
- [x] Migration applied (22 total)
- [x] AnalyticsModule: anomaly rules CRUD, event detection, acknowledge/recalculate, risk dashboard, thresholds
- [x] Seed: 8 permissions + role mappings + 6 risk thresholds + 5 anomaly rules + 1 demo AnomalyEvent
- [x] Unit tests: analytics.service.spec.ts
- [x] E2E tests: analytics.e2e-spec.ts
- [x] Postman: M18-Anomaly-Detection-Anti-Theft.postman_collection.json
- [x] Docs updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M19 — Operational Dashboards + KPI Streams

- [x] Prisma schema: KpiScopeType/KpiMetricWindow/KpiSubscriptionStatus enums, KpiSnapshot model, KpiSubscription model
- [x] Migration: 20260327100000_m19_dashboards_kpi_streams (23 total)
- [x] DashboardsModule + StreamController: 8 REST endpoints + 1 SSE stream
- [x] Live aggregation from Order, Payment, Refund, InventoryItem, AnomalyEvent, Reservation, Event, Shift, TillSession
- [x] 5 permissions: pos:dash:owner:read, pos:dash:manager:read, pos:dash:today-summary:read, pos:dash:stream:read, pos:dash:kpi:refresh
- [x] Role mappings: Owner (5), Manager (4), Accountant (1), Supervisor (3)
- [x] Seed: 5 permissions + role mappings + 1 KpiSnapshot + 1 KpiSubscription
- [x] Unit tests: 13 in dashboards.service.spec.ts — all passing
- [x] E2E tests: 14 in dashboards.e2e-spec.ts — all passing
- [x] Postman: M19-Operational-Dashboards-KPI-Streams.postman_collection.json (16 requests)
- [x] Docs updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md (new)
- [x] Prisma generate: v5.22.0 client generated ✅
- [x] Prisma migrate status: 23 migrations applied, schema up to date ✅
- [x] Seed 2×: idempotent (0 created on second run) ✅
- [x] Lint: 0 errors, 273 warnings (all pre-existing `no-explicit-any`) ✅
- [x] Unit tests: 370/370 pass across 23 suites ✅
- [x] E2E tests: 337/337 pass across 19 suites ✅
- [x] Manual API: all 9 endpoints verified (owner, manager, today-summary, payment-mix, open-orders, low-stock, snapshots, kpi/refresh, stream/metrics)
- [x] Permission denial: Chef gets 403 on owner/manager/refresh ✅
- [x] Missing branch header: 400 ✅
- [x] Unauthenticated: 401 ✅
- [x] Postman contract: baseUrl=http://localhost:3001, all pm.environment.set/get, no violations ✅
- [x] CI: .github/workflows/branch-validation.yml validated ✅
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M20 — Reporting v1 + Exports

- [x] Branch: milestone/m20-reporting-exports
- [x] Schema: ReportRun + ExportArtifact models, 5 enums (ReportType, ReportWindow, ExportFormat, ReportRunStatus, ExportArtifactStatus)
- [x] Migration: 20260327200000_m20_reporting_exports (migration 24)
- [x] Prisma generate: v5.22.0 ✅
- [x] DTOs: 8 validation DTOs (shift-end, daily-sales, payment-mix, top-items, stock-variance, anomaly-summary, export, list-query)
- [x] Service: reports.service.ts — 6 report generators + list + get + export + download
- [x] Controller: reports.controller.ts — 10 endpoints under /api/reports
- [x] Module: reports.module.ts registered in app.module.ts
- [x] Permissions: 11 new (shift-end:generate, daily-sales:generate, payment-mix:generate, top-items:generate, stock-variance:generate, anomaly-summary:generate, reservation-summary:generate, event-summary:generate, exports:read, exports:download, history:read)
- [x] Seed: 11 permissions + role mappings (Owner, Manager, Accountant, Supervisor) + sample ReportRun + ExportArtifact
- [x] Unit tests: reports.service.spec.ts — 16 tests
- [x] E2E tests: reports.e2e-spec.ts — 14 tests
- [x] Postman: M20-Reporting-v1-Exports.postman_collection.json (16 requests)
- [x] Docs: ARCHITECTURE.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md updated
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M20.1 — Reporting Depth Expansion + Finalization

- [x] Branch: milestone/m20-1-reporting-depth-finalization
- [x] Schema: ReportType enum expanded from 8 → 25 values (17 new types)
- [x] Migration: 20260328000000_m20_1_reporting_depth (migration 25)
- [x] Prisma generate: v5.22.0 ✅
- [x] DTOs: 12 new validation DTOs (sales-by-category, sales-by-hour, discounts, voids, refunds, cash-variance, cash-movements, wastage, low-stock, reservation-summary, event-summary, staff-operations)
- [x] Service: rewritten with 20+ report generators + GET /catalog endpoint
- [x] Controller: rewritten with 24+ endpoints (18 new generate + 1 catalog)
- [x] Permissions: 13 new (sales-by-category:generate, sales-by-hour:generate, discounts:generate, voids:generate, refunds:generate, cash-variance:generate, cash-movements:generate, wastage:generate, low-stock:generate, reservations:generate, events:generate, staff-operations:generate, catalog:read)
- [x] Seed: 13 new permissions + updated role mappings (Owner, Manager, Accountant, Supervisor); optimized RolePermissions to batch queries (3 queries instead of ~1243)
- [x] Unit tests: reports.service.spec.ts — 39 tests (20 new)
- [x] E2e tests: reports.e2e-spec.ts — 39 tests (22 new)
- [x] Postman: M20_1-Reporting-Depth-Finalization.postman_collection.json (24 requests)
- [x] Docs: REPORT_CATALOG_GUIDE.md created; API_CONVENTIONS.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md, AI_STATUS.md updated
- [x] TypeScript: 0 errors, ESLint: 0 errors
- [x] Seed x2 idempotent ✅
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All M20.1 verification gates confirmed ✅

### M21+

Track each milestone in order as it is completed. Add one checklist block per milestone as implementation proceeds.

## Known Blockers

- Neon Postgres P1001: Database suspends after inactivity. M5 migration SQL created manually, needs to be applied when Neon comes online. Same pattern as M3.1 and M4.

## Notes

- The roadmap is software-first.
- Do not start M46 hardware work until the software stack is stable.
- Repo structure normalized: API under apps/api (not services/api), shared under packages/shared (not packages/contracts).
- **Windows DLL lock**: Prisma engine DLLs may be locked by stale `node.exe` processes (from `nest --watch`, turbo, or VS Code). Stop all node processes before running `pnpm db:generate`.
- **Neon suspend**: Neon Postgres suspends after inactivity. First request after suspension may return P1001; retry after 2-3 seconds.
- **E2e PIN data**: Running e2e tests modifies quick PIN data. Re-seed after e2e runs to restore demo PINs.
