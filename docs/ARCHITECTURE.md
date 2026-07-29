# ARCHITECTURE.md — Nimbus POS Rebuild

## Monorepo Structure

```text
nimbus-pos/
├── apps/
│   ├── api/                 # NestJS API (primary backend)
│   ├── web/                 # Next.js backoffice / shared web UI (M43+)
│   ├── desktop/             # Optional POS desktop shell (deferred)
│   └── mobile/              # Optional mobile companion (deferred)
├── packages/
│   ├── db/                  # Prisma schema, migrations, seed, client
│   └── shared/              # Shared types, enums, DTOs, constants
├── ai/                      # AI governance docs, status, reports
├── docs/                    # Architecture & convention documentation
└── postman/                 # Postman collections & environments
```

### Database Package (`packages/db`)

The Prisma schema, migrations, client, and seed all live in `packages/db`.

- Schema: `packages/db/prisma/schema.prisma`
- Migrations: `packages/db/prisma/migrations/`
- Seed: `packages/db/prisma/seed.ts` — idempotent by design
- Client: `packages/db/src/client.ts` — singleton Prisma client export

The API app consumes Prisma through a shared NestJS `PrismaModule` / `PrismaService`
located at `apps/api/src/common/prisma/`. This handles lifecycle (`$connect` / `$disconnect`)
and is registered as a global module so all business modules can inject it via DI.

Neon Postgres is used via `DATABASE_URL` and `DIRECT_DATABASE_URL` environment variables only.
No connection strings are ever committed to source control.

### Future packages (added as milestones require)

| Package              | Purpose                     | Added in    |
| -------------------- | --------------------------- | ----------- |
| `packages/contracts` | Shared API contracts / DTOs | When needed |
| `packages/ui`        | Shared React UI components  | M43+        |
| `packages/auth`      | Shared auth utilities       | M2+         |
| `packages/printer`   | ESC/POS printer adapters    | M46+        |

### Future services (added as milestones require)

| Service           | Purpose                         | Added in    |
| ----------------- | ------------------------------- | ----------- |
| `services/worker` | BullMQ jobs / reports / digests | When needed |
| `services/sync`   | Offline/sync service            | M41+        |

## Runtime Principles

- API is the source of truth for business state.
- Worker handles heavy reports, digests, retries, and scheduled jobs (added when needed).
- Sync service is late-wave and only appears once reliability contracts are mature.
- Shared packages prevent backend/frontend contract drift.

## Backend Module Style

Every business domain gets:

- Module
- Service
- Controller
- DTO folder
- Spec files
- e2e coverage in `test/` folder when milestone risk justifies it

## Cross-Cutting Layers

| Layer                        | Location                            | Added in |
| ---------------------------- | ----------------------------------- | -------- |
| PrismaModule / PrismaService | `apps/api/src/common/prisma/`       | M1 ✅   |
| Auth guards (JWT)            | `apps/api/src/common/guards/`       | M2 ✅   |
| Permission guard             | `apps/api/src/common/guards/`       | M2 ✅   |
| Platform-access guard        | `apps/api/src/common/guards/`       | M2 ✅   |
| Branch context guard         | `apps/api/src/common/guards/`       | M3 ✅   |
| Tenant / branch guards       | `apps/api/src/common/guards/`       | M3 ✅   |
| Quick PIN service            | `apps/api/src/modules/auth/`        | M3.1 ✅ |
| Org settings service         | `apps/api/src/modules/settings/`    | M4 ✅   || Floor / table service        | `apps/api/src/modules/floor/`       | M5 ✅   |
| Menu catalog service         | `apps/api/src/modules/menu/`        | M6 ✅   |
| Audit service                | `apps/api/src/common/audit/`        | M2 ✅   |
| Idempotency interceptor      | `apps/api/src/common/interceptors/` | M41      |
| Global exception filter      | `apps/api/src/common/filters/`      | M1       |
| Request ID / correlation     | `apps/api/src/common/interceptors/` | M1       |

## Data Design Rules

- `orgId` first, `branchId` where operational
- `cuid2` IDs everywhere
- Decimal-safe money fields
- UTC timestamps
- Immutable history for stock / finance / security-sensitive flows

## Auth Architecture (M2)

### Token Strategy

- **Access token**: JWT HS256, signed with `JWT_ACCESS_SECRET`, default 15 min TTL.
- **Refresh token**: 48-byte cryptographic random hex, stored as SHA-256 hash in `RefreshToken` table.
  - Refresh token rotation: each use issues a new token pair and invalidates the old one.
  - Family-based revocation: if a revoked token is reused, the entire token family is revoked to prevent replay.
- Tokens are issued via `POST /api/auth/login`, `POST /api/auth/pin-login`, and `POST /api/auth/refresh`.

### Session Model

- A `Session` row is created on every login, storing `jti`, platform, source, IP, user-agent, and expiry.
- The JWT `validate()` callback checks that the session is still active (not revoked, not expired) on every request.
- Access tokens carry short-lived role and permission claims. The JWT strategy uses those claims for
  normal protected requests so it does not reload the full role-permission graph on every API call.
- `lastActivityAt` is rate-limited and updated outside the critical request path when the previous
  activity timestamp is stale enough to warrant a write.
- Logout revokes the session and all its child refresh tokens.

### RBAC Model

- **5 hierarchical role levels**: L1 (staff) → L5 (super-admin).
- **11 named job roles**: OWNER, GENERAL_MANAGER, BRANCH_MANAGER, ACCOUNTANT, HEAD_CHEF, SOUS_CHEF, CASHIER, WAITER, HOST, BARISTA, DELIVERY.
- Users can hold multiple roles (via `UserRole`) — the JWT strategy aggregates permissions from all roles.
- **Permissions** are string-based (`identity:user:read`, `identity:role:manage`, etc.) checked by `PermissionGuard`.

### Platform Access Guard

- `X-Platform` header (default: `POS_DESKTOP`) is validated against a level-based access matrix:
  - L5 → all 6 platforms
  - L4 → WEB_BACKOFFICE, MOBILE_APP, POS_DESKTOP
  - L3 → KDS_SCREEN, POS_DESKTOP
  - L2 → POS_DESKTOP, MOBILE_APP
  - L1 → MOBILE_APP

### Audit Log

The `AuditService` (global module at `apps/api/src/common/audit/`) writes structured entries to the `AuditLog` table. Every auth action (login, logout, refresh, failures) is audited with actor, action, entity, IP, and user-agent metadata.

### Deferred to Later Milestones

- MSR / badge swipe login → M46
- MFA / passkeys / SSO → M45
- Org / branch scoping in roles (`orgId`, `branchId` on `UserRole`) → M3

## Multi-Tenancy Architecture (M3)

### Tenancy Model

Nimbus uses **branch-based tenancy**:

- **Organization** = tenant root entity. All business data is ultimately org-scoped.
- **Branch** = physical store/location unit within an organization. Branch-operational data (orders, inventory, shifts) is scoped to a branch.
- **Membership** = links a user to a branch within an org with a specific role. A user may belong to multiple branches.

### Branch Isolation Rules

- Users can only access branches where they have an ACTIVE membership.
- `GET /api/branches` returns only branches the current user is a member of.
- `GET /api/branches/:id` verifies membership before returning data.
- Future modules (M4+) requiring branch-scoped data must use the `BranchContextGuard`.

### X-Branch-Id Header

For branch-scoped modules (M4+), requests must include `X-Branch-Id` header:

- Missing header → `400 Bad Request`
- Branch not found or inactive → `400 Bad Request`
- User not a member of the branch → `403 Forbidden`
- Valid → `branchContext` object attached to the request with `branchId`, `organizationId`, `roleId`, `membershipId`

`BranchContextGuard` resolves membership and branch context in one Prisma read where possible, keeps a
short in-memory per-process cache for repeated user/branch checks, and dedupes in-flight lookups. This
cache is an operational latency optimization only; tenancy, active membership, active branch checks,
and audit logging for denied access remain authoritative in the backend.

### Session/Auth Integration

- Sessions carry optional `orgId` and `branchId` fields for future branch-switching context.
- `GET /api/me` returns full tenancy context: organizations, branches, roles, permissions, default branch.
- `GET /api/auth/me` remains for backward-compatible auth-only context.
- Login does not require branch selection; branch context is determined per-request via header or membership defaults.

### Future Modules That Must Be Branch-Scoped

All operational modules from M5 onward must accept `X-Branch-Id`:
- Floor plans, tables, service areas (M5)
- Menu catalog (M6-M7)
- Inventory, stock (M9-M13)
- POS orders, KDS (M14-M15)
- Payments, shifts, tills (M17-M19)
- HR scheduling at branch level (M27-M29)

### Org Settings and Branch Settings

These are deferred to M4. M3 only establishes the tenancy structure.

### Audit Events (M3)

| Action                    | Trigger                        |
| ------------------------- | ------------------------------ |
| ORG_CREATED               | Organization created           |
| BRANCH_CREATED            | Branch created                 |
| MEMBERSHIP_CREATED        | User added to a branch         |
| BRANCH_ACCESS_DENIED      | User tried to access a branch without membership |
| TENANCY_PERMISSION_DENIED | Permission guard rejected access |

## Org Settings Architecture (M4)

### Single Source of Truth

`OrgSettings` is a single row per organization storing all org-level defaults. Branch modules in M5+ will read these defaults; branch-specific overrides are deferred to later milestones.

### Settings Model

- One `OrgSettings` row per `Organization` (unique `orgId` FK).
- Scalar fields for critical values: `vatPercent`, `currency`, `discountApprovalThreshold`, `reservationHoldMinutes`, `showCostToChef`.
- JSON fields for structured configs: `taxMatrix`, `rounding`, `anomalyThresholds`, `platformAccess`, `bookingPolicies`, `attendance`, `inventoryTolerance`, `franchiseWeights`, `metadata`, `defaults`.
- `ExchangeRate` table for multi-currency rate history.

### Settings Impact on Future Modules

| Setting                  | Consumers                                |
| ------------------------ | ---------------------------------------- |
| VAT / taxMatrix          | Menu, orders, invoices, accounting       |
| currency / baseCurrency  | Reporting, accounting, exchange rates    |
| reservationHoldMinutes   | Reservations, events                     |
| bookingPolicies          | Reservations, events, ticketing          |
| platformAccess           | Workspace and device access              |
| anomalyThresholds        | Anti-theft, alerts, anomaly detection    |
| showCostToChef           | KDS costing visibility                   |
| inventoryTolerance       | Stock counts, reconciliation             |
| franchiseWeights         | Future branch rankings                   |
| rounding                 | POS orders, invoicing                    |
| attendance               | HR, scheduling                           |

### M4 Permissions

| Permission               | Purpose                   |
| ------------------------ | ------------------------- |
| tenancy:settings:manage  | Create/update settings    |
| tenancy:org:read         | Read settings             |

### M4 Audit Events

| Action                    | Trigger                       |
| ------------------------- | ----------------------------- |
| ORG_SETTINGS_CREATED      | Settings row auto-created     |
| ORG_SETTINGS_UPDATED      | General settings patch        |
| CURRENCY_UPDATED          | Currency changed              |
| TAX_MATRIX_UPDATED        | Tax matrix changed            |
| ROUNDING_UPDATED          | Rounding policy changed       |
| THRESHOLDS_UPDATED        | Thresholds changed            |
| PLATFORM_ACCESS_UPDATED   | Platform access changed       |
| EXCHANGE_RATE_CREATED     | New exchange rate added       |

## Floor Plans + Tables Architecture (M5)

### Data Model

- **FloorPlan**: A visual layout container scoped to `orgId` + `branchId`. Stores a `data` JSON field for layout metadata (grid dimensions, zone definitions). Supports `isActive` toggle.
- **Table**: A seating resource scoped to `orgId` + `branchId`, optionally linked to a `FloorPlan`. Unique label per branch (`@@unique([branchId, label])`). Stores `capacity`, `status` enum, and optional `metadata` JSON for placement/shape.
- **TableStatus** enum: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`.

### Branch Scoping

All M5 endpoints require `X-Branch-Id` header via the `BranchContextGuard`. Floor plans and tables are strictly branch-isolated — a user can only see/manage assets in branches where they hold active membership.

### Visual Layout

- `FloorPlan.data` stores freeform JSON suitable for frontend drag-drop rendering. M5 seeds include placeholder zone/dimension data.
- `Table.metadata` stores optional position/shape data per table. Later front-end milestones will consume this for visual layout rendering.

### Status Model

M5 implements a simple status enum — no state machine transitions yet. Any valid `TableStatus` value can be set directly via `PATCH /tables/:id/status`. Later milestones (reservations M20, POS orders M14) may add transition rules.

### Future Integration Points

- Reservations (M20) will attach to tables via `tableId`.
- POS orders (M14) will reference tables for dine-in sessions.
- No schema changes needed for those attachments — just new FK columns on future models.

### M5 Permissions

| Permission           | Purpose                          |
| -------------------- | -------------------------------- |
| pos:floor:read       | List/view floor plans            |
| pos:floor:write      | Create/update floor plans        |
| pos:table:read       | List/view tables + availability  |
| pos:table:write      | Create/update tables + status    |

### M5 Audit Events

| Action               | Trigger                          |
| -------------------- | -------------------------------- |
| FLOOR_PLAN_CREATED   | Floor plan created               |
| FLOOR_PLAN_UPDATED   | Floor plan updated               |
| TABLE_CREATED        | Table created                    |
| TABLE_UPDATED        | Table updated                    |
| TABLE_STATUS_UPDATED | Table status changed             |
| FLOOR_ACCESS_DENIED  | Access denied to floor resource  |

## Menu Catalog Architecture (M6)

### Data Model

- **Category**: Branch-scoped menu category. Unique per branch (`@@unique([branchId, name])`). Supports `sortOrder`, `isActive`, `color` (hex for POS UI).
- **TaxCategory**: Branch-scoped tax rate definition. Unique per branch (`@@unique([branchId, name])`). Stores `rate` as `Decimal(5,2)` and `isInclusive` flag.
- **MenuItem**: A sellable product scoped to a category (and transitively to a branch). Unique per category (`@@unique([categoryId, name])`). Stores `price` as `Decimal(10,2)`, `type` (FOOD/DRINK), `station` (KITCHEN/BAR/COLD_KITCHEN/DESSERT/NONE), optional `taxCategoryId`, `description`, `imageUrl`, `sortOrder`, `isActive`.
- **MenuItemType** enum: `FOOD`, `DRINK`.
- **PrepStation** enum: `KITCHEN`, `BAR`, `COLD_KITCHEN`, `DESSERT`, `NONE`.

### Catalog Endpoint

`GET /api/menu/catalog` returns a POS-friendly grouped payload:
- Active categories in sort order, each with active items in sort order.
- Summary of tax categories for the branch.
- Designed for a single POS fetch at shift start / menu refresh.

### Branch Scoping

All M6 endpoints require `X-Branch-Id` header via `BranchContextGuard`. Categories, tax categories, and menu items are strictly branch-isolated.

### M6 Permissions

| Permission       | Purpose                              |
| ---------------- | ------------------------------------ |
| pos:menu:read    | List/view categories and menu items  |
| pos:menu:write   | Create/update categories and items   |
| pos:tax:read     | List/view tax categories             |
| pos:tax:write    | Create/update tax categories         |

### M6 Audit Events

| Action                  | Trigger                       |
| ----------------------- | ----------------------------- |
| CATEGORY_CREATED        | Category created              |
| CATEGORY_UPDATED        | Category updated              |
| TAX_CATEGORY_CREATED    | Tax category created          |
| TAX_CATEGORY_UPDATED    | Tax category updated          |
| MENU_ITEM_CREATED       | Menu item created             |
| MENU_ITEM_UPDATED       | Menu item updated             |
| MENU_ACCESS_DENIED      | Access denied to menu resource|

## Recipes + Ingredient Costing Architecture (M8)

### Data Model

- **InventoryItem**: Branch-scoped ingredient master record. Unique per branch (`@@unique([branchId, name])`). Stores `sku`, `name`, `unit`, `category`, `theoreticalUnitCost` as `Decimal(10,3)`, `isActive`. This is the theoretical cost reference — not live inventory stock.
- **RecipeIngredient**: Links a `MenuItem` to one or more `InventoryItem` rows with quantity and waste. Supports optional `menuItemServingId` (for serving-specific ingredients) and `modifierOptionId` (for modifier-triggered extra ingredients). Stores `qtyPerUnit` as `Decimal(10,3)`, `wastePct` as `Decimal(5,2)`, `unit`, `notes`.

### Cost Calculation

The COGS per ingredient row is:

```
effectiveQty = qtyPerUnit × (1 + wastePct / 100)
extendedCost = effectiveQty × theoreticalUnitCost
```

Total COGS is the sum of all `extendedCost` values for the recipe. Margin = sellingPrice − totalCogs. MarginPercent = margin / sellingPrice × 100.

Selling price is determined by: explicit servingId query param > default serving price > base menu item price.

### Visibility / Masking

- L4 (Manager) and L5 (Owner) always see cost data.
- Chef (L2 with CHEF jobRole) sees cost only if `OrgSettings.showCostToChef = true`.
- When masked, the response omits `unitCost`, `effectiveQty`, `extendedCost`, `totalTheoreticalCogs`, `margin`, and `marginPercent`.

### Scope Limitation

M8 is **theoretical COGS only** — linking menu items to ingredient rows for cost-awareness. It does NOT implement:
- Live inventory deduction on order
- FIFO/LIFO costing
- Stock quantity tracking
- Par levels or reorder points

Those features are deferred to M9–M13.

### M8 Permissions

| Permission        | Purpose                              |
| ----------------- | ------------------------------------ |
| pos:recipe:read   | View recipes and inventory items     |
| pos:recipe:write  | Create/update inventory items + recipes |
| pos:cost:read     | View cost breakdown (visibility-gated) |

### M8 Audit Events

| Action                  | Trigger                              |
| ----------------------- | ------------------------------------ |
| INVENTORY_ITEM_CREATED  | Inventory item created               |
| INVENTORY_ITEM_UPDATED  | Inventory item updated               |
| RECIPE_SET              | First recipe created for menu item   |
| RECIPE_UPDATED          | Recipe replaced (atomic)             |
| RECIPE_COST_VIEWED      | Cost breakdown accessed              |
| RECIPE_ACCESS_DENIED    | Cost access denied (missing perm)    |

## POS Orders Architecture (M10)

### Data Model

- **Order**: Branch-scoped order record. Unique order number per branch (`@@unique([branchId, orderNumber])`). Stores `orgId`, `branchId`, `userId` (creator), optional `tableId` (dine-in only), `orderNumber` (format `ORD-XXXXXX`), `status` (OrderStatus enum), `serviceType` (ServiceType enum), money totals (`subtotal`, `tax`, `discount`, `total` as `Decimal(10,2)`), optional `anomalyFlags` JSON, `notes`, `metadata` JSON, and timestamps.
- **OrderItem**: Line item linked to an Order. References `menuItemId` and optional `menuItemServingId`. Stores `quantity`, `price` (unit), `subtotal` (line total), optional `notes`, `metadata` JSON, and cost snapshot fields (`costUnit`, `costTotal`, `marginTotal`, `marginPct` as Decimal).

### Service Type Model

- **ServiceType** enum: `DINE_IN`, `TAKEAWAY`.
- `DINE_IN` orders may reference a `tableId`; `TAKEAWAY` orders must not.

### Order Number Generation

- Format: `ORD-XXXXXX` (zero-padded 6-digit sequential).
- Branch-scoped: each branch maintains its own sequence.
- Generated at order creation time from the last order's number in that branch.

### State Machine

| From         | Allowed Targets           |
| ------------ | ------------------------- |
| NEW          | SENT, VOIDED              |
| SENT         | IN_KITCHEN, VOIDED        |
| IN_KITCHEN   | READY, VOIDED             |
| READY        | SERVED, VOIDED            |
| SERVED       | CLOSED                    |
| VOIDED       | (terminal)                |
| CLOSED       | (terminal)                |

- Post-kitchen voids (from IN_KITCHEN or READY) require a reason.
- Items cannot be added/updated/deleted on CLOSED or VOIDED orders.

### Line Pricing + Cost Snapshots

- Unit price resolved from `MenuItemServing.price` (if serving selected) or `MenuItem.price`.
- Modifier price deltas added from `ModifierOption.priceDelta` via `metadata.selectedModifiers`.
- Cost snapshot computed from M8 recipe ingredients (`RecipeIngredient`) including waste percentage and modifier-linked ingredients.
- Margin calculated as `(subtotal - costTotal) / subtotal * 100`.

### Scope Boundaries

- **Included**: Order CRUD, item CRUD, lifecycle transitions, pricing snapshots, cost snapshots, audit.
- **Excluded**: Payments (M17), discounts (M12), stock deduction on order (M13), tax computation (M4/M12). KDS integration moved to M11.

### M10 Permissions

| Permission          | Purpose                        |
| ------------------- | ------------------------------ |
| pos:orders:read     | List/view orders               |
| pos:orders:write    | Create/update orders and items |
| pos:orders:close    | Close orders (SERVED → CLOSED) |
| pos:orders:void     | Void orders                    |

### M10 Audit Events

| Action              | Trigger                         |
| ------------------- | ------------------------------- |
| ORDER_CREATED       | Order created                   |
| ORDER_ITEM_ADDED    | Item added to order             |
| ORDER_ITEM_UPDATED  | Order item updated              |
| ORDER_ITEM_REMOVED  | Order item deleted              |
| ORDER_SENT          | Order sent (NEW → SENT)         |
| ORDER_IN_KITCHEN    | Order in kitchen                |
| ORDER_READY         | Order ready                     |
| ORDER_SERVED        | Order served                    |
| ORDER_CLOSED        | Order closed                    |
| ORDER_VOIDED        | Order voided                    |

## KDS + Station Routing Architecture (M11)

M11 introduces the Kitchen Display System (KDS) module — turning SENT orders into station-routed work tickets with real-time urgency timers. When an order transitions to SENT, KDS tickets are automatically created by grouping order items by their `PrepStation` (KITCHEN, BAR, COLD_KITCHEN, DESSERT). Items with station `NONE` are excluded.

### Models

- **KdsTicket**: Branch-scoped work ticket. One per station per order. Fields: `orgId`, `branchId`, `orderId`, `station` (string matching PrepStation enum), `status` (KdsTicketStatus: QUEUED → READY → RECALLED), `startedAt` (auto-set on create), `readyAt`, `recalledAt`. Indexed for queue queries.
- **KdsTicketItem**: Join between KdsTicket and OrderItem. Links ticket to specific order line items for that station.
- **KdsSlaConfig**: Per-branch, per-station SLA thresholds. Fields: `greenSeconds`, `amberSeconds`, `redSeconds`. Unique constraint `[branchId, station]`. Defaults: 300s / 600s / 900s.

### Ticket Lifecycle

```
Order SENT → createTicketsForOrder() → group by station → KdsTicket(QUEUED)
                                                            ↓
                                                      mark-ready → READY
                                                            ↓
                                                       recall → RECALLED
```

- **QUEUED → READY**: Chef/bartender marks ticket done. Sets `readyAt`.
- **READY → RECALLED**: Ticket recalled back to queue. Nulls `readyAt`, sets `recalledAt`.
- Idempotent: calling createTicketsForOrder twice returns existing tickets.

### Urgency / SLA Timer

Queue enrichment computes urgency state per ticket:
- `elapsedSeconds` = time since `startedAt`
- **GREEN**: elapsed < amberSeconds
- **AMBER**: elapsed >= amberSeconds AND < redSeconds
- **RED**: elapsed >= redSeconds

Queue is sorted: RED first → AMBER → GREEN; within each band, oldest first.

### SSE Stream

`GET /api/stream/kds` — Server-Sent Events stream filtered by branchId and optional `?station=` query. Events: `NEW_TICKET`, `TICKET_READY`, `TICKET_RECALLED`. Uses `@nestjs/event-emitter` + rxjs.

### M11 Permissions

| Permission          | Purpose                              |
| ------------------- | ------------------------------------ |
| pos:kds:read        | Read KDS queue and ticket data       |
| pos:kds:write       | Mark ready / recall KDS tickets      |
| pos:kds:sla:write   | Update KDS SLA configuration         |

### M11 Audit Events

| Action              | Trigger                             |
| ------------------- | ----------------------------------- |
| KDS_TICKET_CREATED  | KDS ticket created from sent order  |
| KDS_TICKET_READY    | Ticket marked as ready              |
| KDS_TICKET_RECALLED | Ticket recalled back to queue       |
| KDS_SLA_UPDATED     | SLA config updated for a station    |

## Discounts + Approval Workflow Architecture (M12)

M12 adds order-level discounts with an approval workflow. Discounts can be FIXED amount or PERCENTAGE of the order subtotal. Small discounts (effective amount ≤ `OrgSettings.discountApprovalThreshold`, default UGX 5000) are auto-approved. Larger discounts enter PENDING status and require manager/supervisor approval.

### Models

- **Discount**: Branch-scoped discount record. Fields: `orgId`, `branchId`, `orderId`, `type` (DiscountType: PERCENTAGE | FIXED), `value` (Decimal 10,2), `reason`, `status` (DiscountStatus: PENDING → APPROVED | REJECTED), `requestedById`, `approvedById`, `rejectedById`, `approvedAt`, `rejectedAt`, `rejectionReason`. Indexed for branch+status queries.

### Discount Lifecycle

    Request discount → compute effective amount
        ↓ (≤ threshold)          ↓ (> threshold)
    AUTO-APPROVE              PENDING
                                ↓ approve        ↓ reject
                             APPROVED           REJECTED

- **Auto-approve**: Effective amount ≤ orgSettings.discountApprovalThreshold → APPROVED immediately.
- **Manual approve**: Manager/supervisor with `pos:discount:approve` calls approve endpoint. Optional manager PIN verification via bcrypt against `User.quickPinHash`.
- **Reject**: Manager calls reject endpoint with `rejectionReason`.
- One active approved discount per order (latest approved wins for order.discount recalc).
- Discountable states: NEW, SENT, IN_KITCHEN, READY. SERVED/VOIDED/CLOSED are blocked (409).

### Heavy Discount Anomaly

When a discount is requested above the approval threshold, `HEAVY_DISCOUNT` is appended to the order's `anomalyFlags` JSON array for audit/analytics.

### Order Integration

`recalcOrderTotals()` in orders.service.ts computes `order.discount` from the latest approved Discount record and adjusts `order.total = subtotal - discount`.

### M12 Permissions

| Permission           | Purpose                                |
| -------------------- | -------------------------------------- |
| pos:discount:request | Request a discount on an order         |
| pos:discount:approve | Approve or reject pending discounts    |
| pos:discount:read    | Read discount records                  |

### M12 Audit Events

| Action             | Trigger                              |
| ------------------ | ------------------------------------ |
| DISCOUNT_REQUESTED | Discount requested on an order       |
| DISCOUNT_APPROVED  | Discount approved (manual or auto)   |
| DISCOUNT_REJECTED  | Discount rejected by manager         |

## Payments Architecture (M13)

M13 adds payment capture for closing orders. Supports CASH, CARD, MOMO (Mobile Money), and BANK_TRANSFER methods. Split payments (multiple methods per order) are first-class. Mobile Money uses an async intent lifecycle with webhook-driven status updates.

### Data Models

- **Payment**: Branch-scoped payment record on an order. Fields: `orgId`, `branchId`, `orderId`, `amount` (Decimal 12,2), `method` (PaymentMethod enum), `status` (PaymentStatus: PENDING → COMPLETED | FAILED | REFUNDED), optional `transactionId`, `metadata` JSON. Indexed for order, method, status, and transactionId queries.
- **PaymentIntent**: Async MOMO payment intent. Fields: `orgId`, `branchId`, `orderId`, `provider` (MTN/AIRTEL), `amount` (Decimal 12,2), `currency` (default UGX), `status` (PaymentIntentStatus: PENDING → REQUIRES_ACTION → SUCCEEDED | FAILED | CANCELLED), optional `providerRef`, `metadata` JSON. Indexed for order, provider, providerRef, and status queries.
- **WebhookEvent**: Raw webhook payload persistence. Fields: `provider`, `eventType`, `raw` JSON, `verified` boolean, timestamps. Persisted before any processing (persistence-first design).

### Close Order Flow

    SERVED order + payment array → validate totals
        ├── totalPaid >= orderTotal → OK
        │   ├── Cash overpayment → changeDue returned
        │   └── Non-cash overpayment → 400 (blocked)
        ├── totalPaid < orderTotal → 400 (insufficient)
        └── MOMO method → requires SUCCEEDED PaymentIntent

All payment records and the order status transition (SERVED → CLOSED) happen in a single Prisma transaction.

### MOMO Intent Lifecycle

    Create intent (REQUIRES_ACTION) → Provider sends webhook
        ├── SUCCEEDED → auto-create Payment record, mark intent SUCCEEDED
        ├── FAILED → mark intent FAILED
        └── Cancel → mark intent CANCELLED (only from PENDING/REQUIRES_ACTION)

### Webhook Processing

1. Persist raw payload to `webhook_events` table immediately (before processing)
2. Resolve `providerRef` from payload (multiple field name patterns supported)
3. Find matching PaymentIntent by providerRef or intentId
4. Update intent status using normalized provider status mapping
5. If SUCCEEDED, create Payment record (with duplicate check)
6. Mark webhook as processed

### M13 Permissions

| Permission         | Purpose                                |
| ------------------ | -------------------------------------- |
| pos:payment:create | Create payment records on orders       |
| pos:payment:close  | Close orders with payment              |
| pos:payment:intent | Create/cancel MOMO payment intents     |
| pos:payment:read   | Read payment and intent records        |

### M13 Audit Events

| Action                    | Trigger                                   |
| ------------------------- | ----------------------------------------- |
| ORDER_PAID_AND_CLOSED     | Order closed with payment(s)              |
| PAYMENT_RECORDED          | Individual payment record created          |
| PAYMENT_INTENT_CREATED    | MOMO payment intent created               |
| PAYMENT_INTENT_CANCELLED  | MOMO payment intent cancelled             |
| PAYMENT_WEBHOOK_RECEIVED  | Webhook event received from provider      |

## Refunds + Post-Close Void Architecture (M14)

### Refund Model

Each Refund is linked to a Payment on a CLOSED Order. Fields: id, orgId, branchId, orderId, paymentId, provider, amount (Decimal 10,2), reason, status (PENDING/APPROVED/COMPLETED/FAILED), createdById, approvedById, metadata, timestamps.

### Refund Flow

1. **Create refund** (`POST /pos/orders/:id/refunds`) — only CLOSED orders. Validates refund ≤ remaining payment balance.
2. **Auto-complete** — if amount ≤ OrgSettings.discountApprovalThreshold, refund auto-completes. Otherwise PENDING.
3. **Approve** (`POST /pos/refunds/:id/approve`) — manager approves with optional PIN. Transitions PENDING → COMPLETED.
4. **Payment status** — when total refunds ≥ payment amount, payment marked REFUNDED.
5. **Anomaly flag** — high-value refunds flag `highValueRefund` on order.anomalyFlags.

### Post-Close Void

- `POST /pos/orders/:id/post-close-void` — voids a CLOSED order within 15-minute window.
- Requires manager PIN verification (bcrypt against quickPinHash).
- Transitions order CLOSED → VOIDED and all COMPLETED payments → REFUNDED in a single transaction.
- Audit logged as ORDER_POST_CLOSE_VOIDED.

### M14 Permissions

| Permission          | Owner | Manager | Supervisor | Cashier | Waiter | Chef |
| ------------------- | ----- | ------- | ---------- | ------- | ------ | ---- |
| pos:refund:create   | ✅    | ✅      | ✅         | ✅      | ✅     | —    |
| pos:refund:approve  | ✅    | ✅      | ✅         | —       | —      | —    |
| pos:refund:read     | ✅    | ✅      | ✅         | ✅      | ✅     | ✅   |
| pos:void:postclose  | ✅    | ✅      | ✅         | —       | —      | —    |

### M14 Audit Events

| Action                    | Trigger                                   |
| ------------------------- | ----------------------------------------- |
| REFUND_AUTO_COMPLETED     | Small refund auto-completed below threshold|
| REFUND_REQUESTED          | High-value refund created as PENDING      |
| REFUND_APPROVED           | Manager approved a pending refund         |
| ORDER_POST_CLOSE_VOIDED   | Post-close void executed                  |

---

## M15 — Shifts / Till Sessions / Cash Reconciliation

### New Models (Prisma)

| Model             | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| Shift             | Represents an operational shift (OPEN → CLOSED)  |
| TillSession       | Cash drawer session within a shift               |
| CashMovement      | Append-only ledger of cash events on a till      |
| ShiftCloseSummary | Auto-generated financial summary when shift closes|

### Enums

| Enum               | Values                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| ShiftStatus        | OPEN, CLOSED                                                                               |
| TillSessionStatus  | OPEN, RECONCILED, CLOSED                                                                   |
| CashMovementType   | OPENING_FLOAT, SAFE_DROP, CASH_PICKUP, PAID_IN, PAID_OUT, REFUND_PAYOUT                    |
| VarianceStatus     | MATCHED, SHORT, OVER                                                                       |

### Endpoints

| Method | Route                     | Permission           | Description                        |
| ------ | ------------------------- | -------------------- | ---------------------------------- |
| POST   | /shifts/open              | pos:shift:open       | Open a new shift                   |
| POST   | /shifts/:id/close         | pos:shift:close      | Close shift + generate summary     |
| GET    | /shifts/active            | pos:shift:read       | Get current user's active shift    |
| GET    | /shifts/:id               | pos:shift:read       | Get shift by ID                    |
| GET    | /shifts/:id/summary       | pos:shift:read       | Get shift close summary            |
| POST   | /tills/open               | pos:till:open        | Open a till session (within shift) |
| POST   | /tills/:id/safe-drop      | pos:till:safe-drop   | Perform cash safe drop             |
| POST   | /tills/:id/reconcile      | pos:till:reconcile   | Reconcile + close till             |
| GET    | /tills/active             | pos:till:read        | Get current user's active till     |
| GET    | /tills/:id                | pos:till:read        | Get till by ID with movements      |
| GET    | /tills/:id/summary        | pos:till:read        | Get till summary + expected cash   |

### Business Rules

- One active shift per user per branch (ConflictException on duplicate)
- Shift close blocked while OPEN till sessions exist
- Shift close auto-generates ShiftCloseSummary (gross/cash/momo/card sales, refunds, drops)
- One active till per tillCode per branch (@@unique constraint)
- Till open requires an active shift
- Opening float → automatic OPENING_FLOAT CashMovement
- Safe drop only on OPEN tills → SAFE_DROP CashMovement + expectedCash decrement
- Reconcile computes `expectedCash = openingFloat + cashSales + paidIn − safeDrops − cashPickups − refundCashOut − refundPayout − paidOut`
- Variance = countedCash − expectedCash → MATCHED (≤0.01), SHORT (<0), OVER (>0)
- Variance mismatch requires `varianceReason` (BadRequestException)
- All CashMovement records are append-only (no updates, no deletes)
- `hasActiveTillInBranch()` policy hook for future cash-payment gating

### Permissions

| Permission          | Owner | Manager | Supervisor | Cashier | Waiter | Chef | Bartender | Accountant |
| ------------------- | ----- | ------- | ---------- | ------- | ------ | ---- | --------- | ---------- |
| pos:shift:open      | ✅    | ✅      | ✅         | ✅      | ✅     | —    | —         | —          |
| pos:shift:close     | ✅    | ✅      | ✅         | ✅      | ✅     | —    | —         | —          |
| pos:shift:read      | ✅    | ✅      | ✅         | ✅      | ✅     | ✅   | ✅        | ✅         |
| pos:till:open       | ✅    | ✅      | ✅         | ✅      | ✅     | —    | —         | —          |
| pos:till:reconcile  | ✅    | ✅      | ✅         | ✅      | ✅     | —    | —         | —          |
| pos:till:safe-drop  | ✅    | ✅      | ✅         | ✅      | ✅     | —    | —         | —          |
| pos:till:read       | ✅    | ✅      | ✅         | ✅      | ✅     | ✅   | ✅        | ✅         |

### M15 Audit Events

| Action                  | Trigger                                       |
| ----------------------- | --------------------------------------------- |
| SHIFT_OPENED            | New shift opened                              |
| SHIFT_CLOSED            | Shift closed + summary generated              |
| TILL_OPENED             | Till session opened                           |
| TILL_SAFE_DROP          | Cash safe drop performed                      |
| TILL_RECONCILED         | Till reconciled successfully                  |
| TILL_RECONCILE_VARIANCE | Reconciliation with cash variance detected    |

## M16 — Reservations + Deposits + Seating Bridge

### Purpose

Table reservation lifecycle management with deposit tracking, conflict detection, and seamless POS order bridging on seating.

### DB Models

| Model              | Key Fields                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Reservation        | reservationNumber (RES-XXXXXX), customerName, partySize, reservationAt, status, tableId?, seatedOrderId?, depositRequired? |
| ReservationDeposit | reservationId, amount, status (PENDING→RECEIVED→APPLIED/REFUNDED/FORFEITED/VOIDED), method?, reference? |
| ReservationEvent   | reservationId, type (CREATED/CONFIRMED/DEPOSIT_RECORDED/TABLE_ASSIGNED/SEATED/CANCELLED/NO_SHOW/DEPOSIT_REFUNDED/DEPOSIT_FORFEITED), actorUserId |

### State Machine

```
PENDING → CONFIRMED → SEATED → COMPLETED
  ↓            ↓
CANCELLED   CANCELLED / NO_SHOW
  ↓            ↓
NO_SHOW     NO_SHOW
```

Valid transitions:
- PENDING → CONFIRMED, CANCELLED, NO_SHOW
- CONFIRMED → SEATED, CANCELLED, NO_SHOW
- SEATED → COMPLETED
- COMPLETED, CANCELLED, NO_SHOW → (terminal)

### Seating Bridge

When seating a reservation with `createOrder: true`, the service creates a DINE_IN order linked to the reservation via `seatedOrderId`. This bridges the reservation system to the existing POS order flow (M10).

### Table Conflict Detection

Before assigning a table or creating a reservation with a table, the service checks for overlapping reservations on the same table within the time window (reservationAt ± expectedDurationMinutes, default 120 min).

### Permissions (10 new)

| Permission                       | Description                           |
| -------------------------------- | ------------------------------------- |
| pos:reservation:create           | Create a new reservation              |
| pos:reservation:read             | Read reservations and events          |
| pos:reservation:confirm          | Confirm a pending reservation         |
| pos:reservation:seat             | Seat a confirmed reservation          |
| pos:reservation:cancel           | Cancel a reservation                  |
| pos:reservation:no-show          | Mark a reservation as no-show         |
| pos:reservation:deposit:record   | Record a deposit for a reservation    |
| pos:reservation:deposit:read     | Read deposits for a reservation       |
| pos:reservation:update           | Update reservation details            |
| pos:reservation:table:assign     | Assign a table to a reservation       |

### M16 Audit Events

| Action                        | Trigger                                |
| ----------------------------- | -------------------------------------- |
| RESERVATION_CREATED           | New reservation created                |
| RESERVATION_CONFIRMED         | Reservation confirmed                  |
| RESERVATION_SEATED            | Party seated (+ optional order)        |
| RESERVATION_CANCELLED         | Reservation cancelled                  |
| RESERVATION_NO_SHOW           | Marked as no-show                      |
| RESERVATION_DEPOSIT_RECORDED  | Deposit payment recorded               |
| RESERVATION_TABLE_ASSIGNED    | Table assigned to reservation          |

## M17 — Events + Booking Portal + Ticketing

### Purpose

Event lifecycle management with a booking portal, ticket classes, bookings, ticket issuance, QR-based check-in, and a dedicated event audit log.

### DB Models

| Model            | Key Fields                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Event            | eventNumber (EVT-XXXXXX), title, slug, startsAt, endsAt, status, capacity, soldCount, checkedInCount, portalKey, venueTableId?, metadata |
| EventTicketClass | eventId, name, type (GENERAL/VIP/EARLY_BIRD/GROUP/COMPLIMENTARY), price, capacity, soldCount       |
| EventBooking     | bookingNumber (BKG-XXXXXX), eventId, ticketClassId, customerName/Phone/Email, quantity, status, totalAmount |
| EventTicket      | ticketNumber (TKT-XXXXXX), bookingId, eventId, ticketClassId, holderName, status, qrToken, checkedInAt |
| EventCheckIn     | ticketId, eventId, status (ADMITTED/DUPLICATE/DENIED), scannedAt, message                          |
| EventAuditLog    | eventId, action, actorUserId, details, ipAddress, userAgent                                        |

### State Machine

| From       | Allowed Targets              |
| ---------- | ---------------------------- |
| DRAFT      | PUBLISHED, CANCELLED         |
| PUBLISHED  | OPEN, CANCELLED              |
| OPEN       | CLOSED, COMPLETED, CANCELLED |
| CLOSED     | (terminal)                   |
| COMPLETED  | (terminal)                   |
| CANCELLED  | (terminal)                   |

### Booking Flow

1. Event must be PUBLISHED or OPEN (booking window open)
2. Booking validates ticket class capacity (`soldCount + quantity <= capacity`)
3. Booking creates CONFIRMED booking, increments `soldCount` on ticket class and event
4. Ticket issuance generates `quantity` tickets with unique QR tokens
5. Check-in scans QR, logs ADMITTED/DUPLICATE/DENIED, updates booking status when all tickets checked in

### Portal Endpoint

`GET /api/events/portal/:portalKey` returns a public-safe subset of event data with ticket class availability. Does not expose `orgId`, `branchId`, or internal audit data.

### Permissions (12 new)

| Permission               | Description                        |
| ------------------------ | ---------------------------------- |
| pos:event:create         | Create events                      |
| pos:event:read           | Read events and ticket classes     |
| pos:event:update         | Update DRAFT events, manage ticket classes |
| pos:event:publish        | Publish events (DRAFT → PUBLISHED) |
| pos:event:close          | Close events                       |
| pos:event:booking:create | Create bookings                    |
| pos:event:booking:read   | Read bookings                      |
| pos:event:booking:cancel | Cancel bookings                    |
| pos:event:ticket:issue   | Issue tickets for bookings         |
| pos:event:ticket:read    | Read ticket details                |
| pos:event:checkin        | Check in tickets via QR            |
| pos:event:portal:read    | Access portal endpoint             |

### M17 Audit Events

| Action                  | Trigger                                |
| ----------------------- | -------------------------------------- |
| EVENT_CREATED           | New event created                      |
| EVENT_UPDATED           | Event details updated                  |
| EVENT_PUBLISHED         | Event published (portal key generated) |
| EVENT_CLOSED            | Event closed                           |
| EVENT_CANCELLED         | Event cancelled                        |
| TICKET_CLASS_CREATED    | Ticket class added to event            |
| BOOKING_CREATED         | Booking confirmed                      |
| BOOKING_CANCELLED       | Booking cancelled (capacity reversed)  |
| TICKETS_ISSUED          | Tickets issued for booking             |
| CHECK_IN_ADMITTED       | Ticket checked in successfully         |
| CHECK_IN_DUPLICATE      | Duplicate check-in attempt             |
| CHECK_IN_DENIED         | Check-in denied                        |

## M18 — Anomaly Detection + Anti-Theft Signals

Branch-scoped anomaly detection with configurable rules, severity-based escalation, staff risk scoring, and threshold management.

### Models

- **AnomalyRule**: Org/branch-scoped detection rules with type (VOID_SPIKE, DISCOUNT_ABUSE, etc.), metric key, operator, threshold, window.
- **AnomalyEvent**: Individual anomaly occurrences linked to rules, with status (OPEN → ACKNOWLEDGED → RESOLVED), severity, evidence JSON.
- **RiskThreshold**: Org-scoped configurable thresholds (void rate %, cash variance limit, etc.).
- **StaffRiskSnapshot**: Per-staff risk score snapshots for dashboard aggregation.

### M18 Permissions

| Permission                              | Description                                  |
| --------------------------------------- | -------------------------------------------- |
| pos:analytics:anomalies:read            | Read anomaly events and history              |
| pos:analytics:anomaly-rules:create      | Create anomaly detection rules               |
| pos:analytics:anomaly-rules:update      | Update anomaly detection rules               |
| pos:analytics:anomalies:acknowledge     | Acknowledge or resolve anomaly events        |
| pos:analytics:risk-dashboard:read       | View staff risk dashboard and snapshots      |
| pos:analytics:anomalies:recalculate     | Trigger anomaly recalculation for a branch   |
| pos:analytics:thresholds:read           | Read risk threshold configuration            |
| pos:analytics:thresholds:update         | Update risk threshold configuration          |

## M19 — Operational Dashboards + KPI Streams

Owner/manager operational visibility: today/MTD sales, payment mix, open orders, low-stock signals, anomaly highlights, KPI snapshots, and lightweight live metric streaming via SSE.

### Models

- **KpiSnapshot**: Cached point-in-time aggregation with gross/net sales, payment mix (cash/card/momo), refunds, order counts, low stock count, anomaly counts, reservations, events, and avg order value. Scoped by `KpiScopeType` (OWNER/MANAGER/BRANCH) and `KpiMetricWindow` (TODAY/MTD/CUSTOM).
- **KpiSubscription**: Lightweight SSE subscription state per user/branch/scope.

### Endpoints

- `GET /api/dash/owner` — Full owner dashboard (today + MTD + payment mix + anomalies + reservations + events)
- `GET /api/dash/manager` — Manager dashboard (today sales + open orders + shift/till summary)
- `GET /api/dash/today-summary` — Compact today summary with all KPIs
- `GET /api/dash/payment-mix` — Payment method breakdown
- `GET /api/dash/open-orders` — Open orders list
- `GET /api/dash/low-stock` — Low stock items list
- `GET /api/dash/snapshots` — Historical KPI snapshots
- `POST /api/dash/kpi/refresh` — Manual KPI snapshot refresh (creates KpiSnapshot, audit logged)
- `SSE GET /api/stream/metrics` — Live metric SSE stream (15s polling interval)

### M19 Permissions

| Permission                    | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| pos:dash:owner:read           | Read owner-level dashboard                            |
| pos:dash:manager:read         | Read manager-level dashboard                          |
| pos:dash:today-summary:read   | Read today summary + payment mix + open orders + low stock |
| pos:dash:stream:read          | Subscribe to live metric SSE stream                   |
| pos:dash:kpi:refresh          | Trigger a manual KPI snapshot refresh                 |

### M19 Audit Events

| Action               | Trigger                  |
| -------------------- | ------------------------ |
| KPI_REFRESH_TRIGGERED | Manual KPI refresh      |

## M20 — Reporting v1 + Exports

### Overview

Operational reporting engine providing on-demand report generation and CSV/PDF export artifacts.
Reports aggregate data from existing operational tables (orders, payments, refunds, shifts, tills,
stock adjustments, anomaly events) into structured ReportRun records with JSON summaries.

Export artifacts are generated synchronously in v1 and stored as local files. A future milestone
will migrate to cloud object storage (S3/GCS).

### Models

- **ReportRun** — tracks a single report generation request; stores type, window, date range, parameters, status, summary JSON, and row count
- **ExportArtifact** — tracks an export file generated from a completed ReportRun; stores format, file metadata, checksum, and local storage path

### Report Types

| Enum                | Description                               |
| ------------------- | ----------------------------------------- |
| SHIFT_END           | Shift/till summary with gross/net sales, payment breakdown, refunds, safe drops |
| DAILY_SALES         | Daily sales aggregation with order counts, AOV, refunds, payment mix |
| PAYMENT_MIX         | Payment method breakdown with amounts, counts, percentages |
| TOP_ITEMS           | Top-selling menu items by quantity and gross contribution |
| STOCK_VARIANCE      | Stock adjustment summary per inventory item |
| ANOMALY_SUMMARY     | Anomaly event counts by type, severity, status |
| RESERVATION_SUMMARY | Reserved for future milestone              |
| EVENT_SUMMARY       | Reserved for future milestone              |

### Endpoints

- `POST /api/reports/shift-end` — Generate shift-end report
- `POST /api/reports/daily-sales` — Generate daily sales report
- `POST /api/reports/payment-mix` — Generate payment mix report
- `POST /api/reports/top-items` — Generate top items report
- `POST /api/reports/stock-variance` — Generate stock variance report
- `POST /api/reports/anomaly-summary` — Generate anomaly summary report
- `GET /api/reports` — List reports (paginated, filterable by type/status)
- `GET /api/reports/:id` — Get report by ID with export artifacts
- `POST /api/reports/export` — Create CSV/PDF export from completed report
- `GET /api/reports/exports/:id/download` — Download export artifact file

### M20 Permissions

| Permission                             | Description                              |
| -------------------------------------- | ---------------------------------------- |
| pos:reports:shift-end:generate         | Generate shift-end report                |
| pos:reports:daily-sales:generate       | Generate daily sales report              |
| pos:reports:payment-mix:generate       | Generate payment mix report              |
| pos:reports:top-items:generate         | Generate top items report                |
| pos:reports:stock-variance:generate    | Generate stock variance report           |
| pos:reports:anomaly-summary:generate   | Generate anomaly summary report          |
| pos:reports:reservation-summary:generate | Generate reservation summary report    |
| pos:reports:event-summary:generate     | Generate event summary report            |
| pos:reports:exports:read               | Create export artifacts from reports     |
| pos:reports:exports:download           | Download export artifacts                |
| pos:reports:history:read               | List and view report run history         |

### M20 Audit Events

| Action                  | Trigger                          |
| ----------------------- | -------------------------------- |
| REPORT_RUN_COMPLETED    | Report generation succeeded      |
| REPORT_RUN_FAILED       | Report generation failed         |
| EXPORT_ARTIFACT_CREATED | Export artifact created (pending) |
| EXPORT_ARTIFACT_READY   | Export file generated and ready   |

### Known Limitations (v1)

- Export generation is synchronous — large reports may cause slower responses
- Local filesystem storage only; no S3/GCS integration yet
- PDF output is structured text, not a proper PDF render (no pdfkit/puppeteer)
- RESERVATION_SUMMARY and EVENT_SUMMARY types are reserved but not yet implemented

## Frontend Strategy (M43+)

- Web shell first
- POS / KDS UI after backend maturity
- Shared role-filtered navigation
- React Query for API state
- Offline awareness reserved for reliability milestone (M41)

## M23 — Employees + Contracts + HR Core

### Overview

M23 adds the foundational HR layer: employee master data, employment contracts, organizational positions, and compensation profiles. This module stores **who works here** only — attendance, scheduling, payroll, and performance are reserved for later milestones (M27+).

### Models

- **Employee** — Core HR record per org. Auto-generates `employeeCode` as `EMP-XXXXX`. Optional link to a `User` account (unique per employee), position, and compensation profile. Tracks status (ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED) and employment type (PERMANENT, TEMPORARY, CASUAL, CONTRACTOR).
- **EmploymentContract** — Formal contract record per employee. Auto-generates `contractNumber` as `CTR-XXXXX`. Tracks contract period (startsAt, endsAt), salary basis + amount, and status lifecycle (DRAFT → ACTIVE → EXPIRED/TERMINATED).
- **Position** — Organizational position template (e.g., Head Chef, Waiter). Unique `code` per org.
- **CompensationProfile** — Salary template (e.g., Monthly Senior, Daily Casual). Unique `code` per org.

### Enums

| Enum             | Values                                      |
| ---------------- | ------------------------------------------- |
| EmployeeStatus   | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED     |
| EmploymentType   | PERMANENT, TEMPORARY, CASUAL, CONTRACTOR    |
| ContractStatus   | DRAFT, ACTIVE, EXPIRED, TERMINATED          |
| SalaryBasis      | HOURLY, DAILY, WEEKLY, MONTHLY              |

### Endpoints

All under `/api/hr`, protected by JwtAuthGuard + PermissionGuard + BranchContextGuard.

- `POST /api/hr/employees` — Create employee
- `GET /api/hr/employees` — List employees (paginated, filterable by status/type/positionId)
- `GET /api/hr/employees/:id` — Get employee with contracts + position
- `PATCH /api/hr/employees/:id` — Update employee fields
- `POST /api/hr/contracts` — Create employment contract
- `GET /api/hr/contracts` — List contracts (filterable by employeeId/status)
- `POST /api/hr/positions` — Create position
- `GET /api/hr/positions` — List all positions for org
- `POST /api/hr/compensation-profiles` — Create compensation profile
- `GET /api/hr/compensation-profiles` — List all compensation profiles for org

### M23 Permissions

| Permission                     | Description                       |
| ------------------------------ | --------------------------------- |
| pos:hr:employees:read          | List and view employees           |
| pos:hr:employees:create        | Create employee records           |
| pos:hr:employees:update        | Update employee records           |
| pos:hr:contracts:read          | List and view employment contracts|
| pos:hr:contracts:create        | Create employment contracts       |
| pos:hr:positions:read          | List and view positions           |
| pos:hr:positions:create        | Create positions                  |
| pos:hr:compensation:read       | List and view compensation profiles|
| pos:hr:compensation:create     | Create compensation profiles      |

### M23 Audit Events

| Action                         | Trigger                                     |
| ------------------------------ | ------------------------------------------- |
| EMPLOYEE_CREATED               | New employee record created                 |
| EMPLOYEE_UPDATED               | Employee fields updated                     |
| CONTRACT_CREATED               | Employment contract created                 |
| POSITION_CREATED               | Position template created                   |
| COMPENSATION_PROFILE_CREATED   | Compensation profile template created       |

## M29 — General Ledger + Journal Entries + Posting Engine

### Purpose

Double-entry General Ledger with automated posting engine. Journal entries must always balance (total debits = total credits). The posting engine replays accounting events from PostingSourceMaps into journal entries, with idempotent run keys and error tracking.

### Models

- **JournalEntry** — Double-entry header. Auto-generates `journalNumber` as `JNL-XXXXXX`. Tracks status lifecycle (DRAFT → POSTED → REVERSED), optional source key linkage, fiscal period, and self-referential reversal chain.
- **JournalLine** — Individual debit/credit line within a journal entry. Links to Account and optional CostCenter. Direction enum (DEBIT/CREDIT) with Decimal(10,2) amounts.
- **PostingRun** — Execution record for automated posting. Idempotent via unique `runKey` per org. Tracks status (RUNNING → SUCCEEDED/FAILED), duration, and generated journal entry.
- **PostingError** — Error record when posting fails. Tracks error message, source context, and resolution status (OPEN → RESOLVED/IGNORED).

### Enums

| Enum               | Values                         |
| ------------------ | ------------------------------ |
| JournalStatus      | DRAFT, POSTED, REVERSED        |
| PostingRunStatus   | RUNNING, SUCCEEDED, FAILED     |
| PostingErrorStatus | OPEN, RESOLVED, IGNORED        |
| JournalLineDirection | DEBIT, CREDIT                |

### Endpoints

All under `/api/accounting`, protected by JwtAuthGuard + PermissionGuard + BranchContextGuard.

- `POST /api/accounting/journals` — Create balanced journal entry (auto-POSTED)
- `GET /api/accounting/journals` — List journals (paginated, filterable by status/sourceKey/dateRange)
- `GET /api/accounting/journals/:id` — Get journal with lines and relations
- `POST /api/accounting/journals/:id/reverse` — Create compensating reversal entry
- `POST /api/accounting/posting/replay` — Replay posting from source map (idempotent)
- `GET /api/accounting/posting-runs` — List posting runs (paginated)
- `GET /api/accounting/posting-errors` — List posting errors (filterable by status)
- `GET /api/accounting/posting-errors/:id` — Get posting error detail

### M29 Permissions

| Permission                          | Description                        |
| ----------------------------------- | ---------------------------------- |
| pos:accounting:journals:read        | List and view journal entries      |
| pos:accounting:journals:create      | Create journal entries             |
| pos:accounting:journals:reverse     | Reverse journal entries            |
| pos:accounting:posting:replay       | Replay posting from source maps    |
| pos:accounting:posting-runs:read    | List and view posting runs         |
| pos:accounting:posting-errors:read  | List and view posting errors       |

### M29 Audit Events

| Action                   | Trigger                                       |
| ------------------------ | --------------------------------------------- |
| JOURNAL_CREATED          | New journal entry created                     |
| JOURNAL_REVERSED         | Journal entry reversed (compensating entry)   |
| POSTING_RUN_CREATED      | Posting engine replay executed                |
| POSTING_ERROR_RECORDED   | Posting error captured during replay          |
