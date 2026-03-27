# API_CONVENTIONS.md — Nimbus POS Rebuild

## General

- Base path: `/api`
- JSON only in v1
- Use plural resource nouns where practical
- Use branch context explicitly in auth/session or header where needed
- Every response should include enough IDs for client chaining

## Auth (M2) ✅

- Bearer JWT access token (`Authorization: Bearer <token>`)
- Refresh token rotation via `POST /api/auth/refresh`
- PIN login for POS flow via `POST /api/auth/pin-login`
- MSR endpoints deferred until M46

### Auth Endpoints

| Method | Path                  | Auth | Description                          |
| ------ | --------------------- | ---- | ------------------------------------ |
| POST   | `/api/auth/login`     | No   | Email + password login               |
| POST   | `/api/auth/pin-login` | No   | Email + 4-6 digit PIN login          |
| POST   | `/api/auth/refresh`   | No   | Rotate refresh token, get new pair   |
| POST   | `/api/auth/logout`    | Yes  | Revoke current session               |
| POST   | `/api/auth/logout-all`| Yes  | Revoke all sessions for current user |
| GET    | `/api/auth/me`        | Yes  | Current user profile + session       |
| GET    | `/api/auth/sessions`  | Yes  | List active sessions                 |

### Quick PIN Login (M3.1) ✅

- Quick PIN login for POS Desktop only via `POST /api/auth/quick-pin-login`
- Role-tier PIN policy: LOW_6 (6-digit) for Waiter/Cashier/Bartender, HIGH_8 (8-digit) for Supervisor/Manager
- Dual-hash security: HMAC-SHA256 lookup hash (indexed) + bcrypt verification hash
- Lockout: 5 failed attempts → 5 minute lock
- Platform enforcement: only `POS_DESKTOP` allowed for quick PIN login

### Quick PIN Endpoints

| Method | Path                                       | Auth | Description                         |
| ------ | ------------------------------------------ | ---- | ----------------------------------- |
| POST   | `/api/auth/quick-pin-login`                | No   | Branch + PIN login (POS_DESKTOP)    |
| POST   | `/api/auth/users/:id/issue-quick-pin`      | Yes  | Issue new quick PIN for user        |
| POST   | `/api/auth/users/:id/reset-quick-pin`      | Yes  | Reset user’s quick PIN              |
| PATCH  | `/api/auth/users/:id/quick-pin-settings`   | Yes  | Update display name, tier, etc.     |
| GET    | `/api/auth/users/:id/quick-pin-status`     | Yes  | Get user’s quick PIN status flags   |

### Platform Header

`X-Platform` header identifies the calling platform. Guarded endpoints validate this against the user's role level.

Values: `WEB_BACKOFFICE`, `MOBILE_APP`, `POS_DESKTOP`, `KDS_SCREEN`, `SELF_KIOSK`, `DRIVER_APP`

## Tenancy (M3) ✅

- Branch-based multi-tenancy: Org → Branch → Membership
- `X-Branch-Id` header required for branch-scoped endpoints (M4+)
- `GET /api/me` returns full tenancy context (orgs, branches, roles, permissions)

### Tenancy Endpoints

| Method | Path                                                | Auth | Permission                  | Description                       |
| ------ | --------------------------------------------------- | ---- | --------------------------- | --------------------------------- |
| POST   | `/api/orgs`                                         | Yes  | tenancy:org:write           | Create organization               |
| GET    | `/api/orgs`                                         | Yes  | —                           | List user's organizations         |
| GET    | `/api/orgs/:orgId`                                  | Yes  | —                           | Get org detail (membership check) |
| POST   | `/api/orgs/:orgId/branches`                         | Yes  | tenancy:branch:write        | Create branch in org              |
| GET    | `/api/branches`                                     | Yes  | —                           | List user's accessible branches   |
| GET    | `/api/branches/:branchId`                           | Yes  | —                           | Get branch detail (member check)  |
| POST   | `/api/orgs/:orgId/branches/:branchId/memberships`   | Yes  | tenancy:membership:manage   | Add user membership to branch     |
| GET    | `/api/orgs/:orgId/branches/:branchId/memberships`   | Yes  | tenancy:membership:manage   | List memberships for branch       |
| GET    | `/api/me`                                           | Yes  | —                           | Full tenancy context for user     |
| GET    | `/api/branch-test`                                  | Yes  | — (X-Branch-Id required)    | Branch context guard test route   |

### Branch Context Header

`X-Branch-Id` header is required for all branch-scoped endpoints starting in M5.
- Missing → `400`
- Not found / inactive → `400`
- User not a member → `403`

## Org Settings (M4) ✅

Org-level configuration for VAT, currency, rounding, thresholds, and platform access.

### Settings Endpoints

| Method | Path                            | Auth | Permission               | Description                     |
| ------ | ------------------------------- | ---- | ------------------------ | ------------------------------- |
| GET    | `/api/settings`                 | Yes  | tenancy:org:read         | Get full org settings           |
| PATCH  | `/api/settings`                 | Yes  | tenancy:settings:manage  | Partial update org settings     |
| GET    | `/api/settings/currency`        | Yes  | tenancy:org:read         | Get currency config             |
| PUT    | `/api/settings/currency`        | Yes  | tenancy:settings:manage  | Update currency                 |
| GET    | `/api/settings/tax-matrix`      | Yes  | tenancy:org:read         | Get tax / VAT matrix            |
| PUT    | `/api/settings/tax-matrix`      | Yes  | tenancy:settings:manage  | Update tax matrix               |
| GET    | `/api/settings/rounding`        | Yes  | tenancy:org:read         | Get rounding policy             |
| PUT    | `/api/settings/rounding`        | Yes  | tenancy:settings:manage  | Update rounding policy          |
| GET    | `/api/thresholds`               | Yes  | tenancy:org:read         | Get anomaly/discount thresholds |
| PATCH  | `/api/thresholds`               | Yes  | tenancy:settings:manage  | Update thresholds               |
| GET    | `/api/settings/platform-access` | Yes  | tenancy:org:read         | Get platform access rules       |
| PUT    | `/api/settings/platform-access` | Yes  | tenancy:settings:manage  | Update platform access rules    |
| POST   | `/api/settings/exchange-rate`   | Yes  | tenancy:settings:manage  | Create exchange rate entry      |
| GET    | `/api/settings/exchange-rates`  | Yes  | tenancy:org:read         | List exchange rates             |

## Floor Plans + Tables (M5) ✅

Branch-scoped floor plan and table management for dine-in operations.

### Floor/Table Endpoints

| Method | Path                      | Auth | Permission        | Branch | Description                    |
| ------ | ------------------------- | ---- | ----------------- | ------ | ------------------------------ |
| POST   | `/api/floor-plans`        | Yes  | pos:floor:write   | Yes    | Create floor plan              |
| GET    | `/api/floor-plans`        | Yes  | pos:floor:read    | Yes    | List floor plans for branch    |
| GET    | `/api/floor-plans/:id`    | Yes  | pos:floor:read    | Yes    | Get floor plan detail          |
| PATCH  | `/api/floor-plans/:id`    | Yes  | pos:floor:write   | Yes    | Update floor plan              |
| POST   | `/api/tables`             | Yes  | pos:table:write   | Yes    | Create table                   |
| GET    | `/api/tables`             | Yes  | pos:table:read    | Yes    | List tables for branch         |
| GET    | `/api/tables/:id`         | Yes  | pos:table:read    | Yes    | Get table detail               |
| PATCH  | `/api/tables/:id`         | Yes  | pos:table:write   | Yes    | Update table                   |
| PATCH  | `/api/tables/:id/status`  | Yes  | pos:table:write   | Yes    | Update table status            |
| GET    | `/api/floor/availability` | Yes  | pos:floor:read    | Yes    | Current table availability     |

### Table Statuses

| Status      | Meaning                                  |
| ----------- | ---------------------------------------- |
| AVAILABLE   | Table is free and ready for seating      |
| OCCUPIED    | Table has active diners                  |
| RESERVED    | Table is reserved for upcoming guests    |
| CLEANING    | Table is being cleaned / reset           |

## Menu Catalog (M6) ✅

Branch-scoped categories, tax categories, and menu items for the POS menu.

### Menu Endpoints

| Method | Path                         | Auth | Permission       | Branch | Description                          |
| ------ | ---------------------------- | ---- | ---------------- | ------ | ------------------------------------ |
| POST   | `/api/menu/categories`       | Yes  | pos:menu:write   | Yes    | Create category                      |
| GET    | `/api/menu/categories`       | Yes  | pos:menu:read    | Yes    | List categories for branch           |
| GET    | `/api/menu/categories/:id`   | Yes  | pos:menu:read    | Yes    | Get category detail                  |
| PATCH  | `/api/menu/categories/:id`   | Yes  | pos:menu:write   | Yes    | Update category                      |
| POST   | `/api/menu/tax-categories`   | Yes  | pos:tax:write    | Yes    | Create tax category                  |
| GET    | `/api/menu/tax-categories`   | Yes  | pos:tax:read     | Yes    | List tax categories for branch       |
| GET    | `/api/menu/tax-categories/:id` | Yes | pos:tax:read    | Yes    | Get tax category detail              |
| PATCH  | `/api/menu/tax-categories/:id` | Yes | pos:tax:write   | Yes    | Update tax category                  |
| POST   | `/api/menu/items`            | Yes  | pos:menu:write   | Yes    | Create menu item                     |
| GET    | `/api/menu/items`            | Yes  | pos:menu:read    | Yes    | List menu items for branch           |
| GET    | `/api/menu/items/:id`        | Yes  | pos:menu:read    | Yes    | Get menu item detail                 |
| PATCH  | `/api/menu/items/:id`        | Yes  | pos:menu:write   | Yes    | Update menu item                     |
| GET    | `/api/menu/catalog`          | Yes  | pos:menu:read    | Yes    | Full POS catalog (grouped by category) |

### Menu Item Types

| Type  | Meaning        |
| ----- | -------------- |
| FOOD  | Food product   |
| DRINK | Beverage       |

### Prep Stations

| Station       | Meaning            |
| ------------- | ------------------ |
| KITCHEN       | Main kitchen       |
| BAR           | Bar area           |
| COLD_KITCHEN  | Cold prep station  |
| DESSERT       | Dessert station    |
| NONE          | No routing needed  |

## Recipes + Ingredient Costing (M8) ✅

Branch-scoped inventory items, recipes (ingredient lists per menu item), and theoretical COGS cost breakdown.

### Inventory Item Endpoints

| Method | Path                        | Auth | Permission         | Branch | Description                    |
| ------ | --------------------------- | ---- | ------------------ | ------ | ------------------------------ |
| POST   | `/api/inventory/items`      | Yes  | pos:recipe:write   | Yes    | Create inventory item          |
| GET    | `/api/inventory/items`      | Yes  | pos:recipe:read    | Yes    | List inventory items           |
| GET    | `/api/inventory/items/:id`  | Yes  | pos:recipe:read    | Yes    | Get inventory item detail      |
| PATCH  | `/api/inventory/items/:id`  | Yes  | pos:recipe:write   | Yes    | Update inventory item          |

### Recipe Endpoints

| Method | Path                                      | Auth | Permission         | Branch | Description                          |
| ------ | ----------------------------------------- | ---- | ------------------ | ------ | ------------------------------------ |
| POST   | `/api/inventory/recipes/:menuItemId`      | Yes  | pos:recipe:write   | Yes    | Set/replace recipe (atomic)          |
| GET    | `/api/inventory/recipes/:menuItemId`      | Yes  | pos:recipe:read    | Yes    | Get recipe (grouped by base/mod/srv) |
| GET    | `/api/inventory/recipes/:menuItemId/cost` | Yes  | pos:cost:read      | Yes    | Cost breakdown with visibility       |

### Cost Visibility

Cost data is masked for Chef (L2 CHEF) when `OrgSettings.showCostToChef = false`. L4+ always see full cost breakdown.

## Inventory Stock + FIFO (M9) ✅

Branch-scoped stock batches, inventory levels with reorder thresholds, stock adjustments, and FIFO deduction foundation.

### Stock Batch Endpoints

| Method | Path                                | Auth | Permission            | Branch | Description                    |
| ------ | ----------------------------------- | ---- | --------------------- | ------ | ------------------------------ |
| POST   | `/api/inventory/batches`            | Yes  | pos:inventory:write   | Yes    | Create stock batch             |
| GET    | `/api/inventory/batches`            | Yes  | pos:inventory:read    | Yes    | List all stock batches         |
| GET    | `/api/inventory/items/:id/batches`  | Yes  | pos:inventory:read    | Yes    | List batches for item          |

### Inventory Level Endpoints

| Method | Path                        | Auth | Permission            | Branch | Description                    |
| ------ | --------------------------- | ---- | --------------------- | ------ | ------------------------------ |
| GET    | `/api/inventory/levels`     | Yes  | pos:inventory:read    | Yes    | Get stock levels + reorder     |

### Stock Adjustment Endpoints

| Method | Path                            | Auth | Permission              | Branch | Description                    |
| ------ | ------------------------------- | ---- | ----------------------- | ------ | ------------------------------ |
| POST   | `/api/inventory/adjustments`    | Yes  | pos:inventory:adjust    | Yes    | Create stock adjustment        |

### FIFO Logic

Negative adjustments consume stock from oldest batches first (ordered by `receivedAt ASC`). Negative stock is blocked — attempts are audited as `NEGATIVE_STOCK_ATTEMPT`.

## POS Orders — Create + Lifecycle + Status Machine (M10) ✅

Branch-scoped POS orders with line items, state machine lifecycle, pricing snapshots, and cost snapshots from M8 recipes.

### Order Endpoints

| Method | Path                                       | Auth | Permission          | Branch | Description                     |
| ------ | ------------------------------------------ | ---- | ------------------- | ------ | ------------------------------- |
| POST   | `/api/pos/orders`                          | Yes  | pos:orders:write    | Yes    | Create order                    |
| GET    | `/api/pos/orders`                          | Yes  | pos:orders:read     | Yes    | List orders (paginated)         |
| GET    | `/api/pos/orders/:id`                      | Yes  | pos:orders:read     | Yes    | Get order by ID                 |

### Order Item Endpoints

| Method | Path                                       | Auth | Permission          | Branch | Description                     |
| ------ | ------------------------------------------ | ---- | ------------------- | ------ | ------------------------------- |
| POST   | `/api/pos/orders/:id/items`                | Yes  | pos:orders:write    | Yes    | Add item to order               |
| PATCH  | `/api/pos/orders/:id/items/:itemId`        | Yes  | pos:orders:write    | Yes    | Update order item               |
| DELETE | `/api/pos/orders/:id/items/:itemId`        | Yes  | pos:orders:write    | Yes    | Remove order item               |

### Order Lifecycle Endpoints

| Method | Path                                       | Auth | Permission          | Branch | Description                     |
| ------ | ------------------------------------------ | ---- | ------------------- | ------ | ------------------------------- |
| POST   | `/api/pos/orders/:id/send`                 | Yes  | pos:orders:write    | Yes    | Send order (NEW → SENT)         |
| POST   | `/api/pos/orders/:id/in-kitchen`           | Yes  | pos:orders:write    | Yes    | Mark in kitchen (SENT → IN_KITCHEN) |
| POST   | `/api/pos/orders/:id/ready`                | Yes  | pos:orders:write    | Yes    | Mark ready (IN_KITCHEN → READY) |
| POST   | `/api/pos/orders/:id/mark-served`          | Yes  | pos:orders:write    | Yes    | Mark served (READY → SERVED)    |
| POST   | `/api/pos/orders/:id/close`                | Yes  | pos:orders:close    | Yes    | Close order (SERVED → CLOSED)   |
| POST   | `/api/pos/orders/:id/void`                 | Yes  | pos:orders:void     | Yes    | Void order                      |

## KDS + Station Routing — Queue + Tickets + SLA (M11) ✅

Branch-scoped KDS queue, ticket actions, SLA configuration, and real-time SSE stream.

### KDS Endpoints

| Method | Path                                       | Auth | Permission          | Branch | Description                        |
| ------ | ------------------------------------------ | ---- | ------------------- | ------ | ---------------------------------- |
| GET    | `/api/kds/queue`                           | Yes  | pos:kds:read        | Yes    | Get KDS queue (enriched urgency)   |
| GET    | `/api/kds/sla-config/:station`             | Yes  | pos:kds:read        | Yes    | Get SLA config for station         |
| PATCH  | `/api/kds/sla-config/:station`             | Yes  | pos:kds:sla:write   | Yes    | Update SLA thresholds for station  |
| POST   | `/api/kds/tickets/:id/mark-ready`          | Yes  | pos:kds:write       | Yes    | Mark ticket as READY               |
| POST   | `/api/kds/tickets/:id/recall`              | Yes  | pos:kds:write       | Yes    | Recall READY ticket to queue       |
| GET    | `/api/stream/kds`                          | Yes  | —                   | Yes    | SSE stream (filtered by branch)    |

## Discounts + Approval Workflow (M12) ✅

Branch-scoped discount requests with auto-approve / pending approval, manager PIN verification, and order integration.

### Discount Endpoints

| Method | Path                                       | Auth | Permission             | Branch | Description                           |
| ------ | ------------------------------------------ | ---- | ---------------------- | ------ | ------------------------------------- |
| POST   | `/api/pos/orders/:id/discounts`            | Yes  | pos:discount:request   | Yes    | Request discount on order             |
| GET    | `/api/pos/orders/:id/discounts`            | Yes  | pos:discount:read      | Yes    | List discounts for order (paginated)  |
| POST   | `/api/pos/discounts/:id/approve`           | Yes  | pos:discount:approve   | Yes    | Approve pending discount              |
| POST   | `/api/pos/discounts/:id/reject`            | Yes  | pos:discount:approve   | Yes    | Reject pending discount               |
| GET    | `/api/pos/discounts/pending`               | Yes  | pos:discount:approve   | Yes    | List pending discounts for branch     |
| GET    | `/api/pos/discounts/:id`                   | Yes  | pos:discount:read      | Yes    | Get discount detail                   |

## Payments: Cash, Card, Mobile Money (M13) ✅

Close orders with payment, split payments, MOMO intent lifecycle, webhook ingestion.

### Payment Endpoints

| Method | Path                                       | Auth | Permission             | Branch | Description                           |
| ------ | ------------------------------------------ | ---- | ---------------------- | ------ | ------------------------------------- |
| POST   | `/api/pos/orders/:id/close`                | Yes  | pos:orders:close       | Yes    | Close order with payment(s)           |
| POST   | `/api/payments/intents`                    | Yes  | pos:payment:intent     | Yes    | Create MOMO payment intent            |
| POST   | `/api/payments/intents/:id/cancel`         | Yes  | pos:payment:intent     | Yes    | Cancel pending MOMO intent            |
| GET    | `/api/pos/orders/:id/payments`             | Yes  | pos:payment:read       | Yes    | Get payments + intents for order      |
| POST   | `/api/webhooks/mtn`                        | No   | —                      | No     | MTN Mobile Money webhook              |
| POST   | `/api/webhooks/airtel`                     | No   | —                      | No     | Airtel Money webhook                  |

## Refunds + Post-Close Voids (M14) ✅

Refund closed-order payments, approve high-value refunds, post-close void with time window.

### Refund Endpoints

| Method | Path                                       | Auth | Permission             | Branch | Description                           |
| ------ | ------------------------------------------ | ---- | ---------------------- | ------ | ------------------------------------- |
| POST   | `/api/pos/orders/:id/refunds`              | Yes  | pos:refund:create      | Yes    | Create refund (auto-complete or PENDING) |
| GET    | `/api/pos/orders/:id/refunds`              | Yes  | pos:refund:read        | Yes    | List refunds for order                |
| GET    | `/api/pos/refunds/:id`                     | Yes  | pos:refund:read        | Yes    | Get refund detail                     |
| POST   | `/api/pos/refunds/:id/approve`             | Yes  | pos:refund:approve     | Yes    | Approve pending refund                |
| POST   | `/api/pos/orders/:id/post-close-void`      | Yes  | pos:void:postclose     | Yes    | Post-close void (15-min window + PIN) |

## Shifts + Till Sessions + Cash Reconciliation (M15) ✅

Operational shift lifecycle, till sessions with cash drawer management, safe drops, reconciliation with variance tracking.

### Shift Endpoints

| Method | Path                           | Auth | Permission         | Branch | Description                        |
| ------ | ------------------------------ | ---- | ------------------ | ------ | ---------------------------------- |
| POST   | `/api/shifts/open`             | Yes  | pos:shift:open     | Yes    | Open a new shift                   |
| POST   | `/api/shifts/:id/close`        | Yes  | pos:shift:close    | Yes    | Close shift + auto-generate summary|
| GET    | `/api/shifts/active`           | Yes  | pos:shift:read     | Yes    | Get current user's active shift    |
| GET    | `/api/shifts/:id`              | Yes  | pos:shift:read     | Yes    | Get shift by ID                    |
| GET    | `/api/shifts/:id/summary`      | Yes  | pos:shift:read     | Yes    | Get shift close summary            |

### Till Endpoints

| Method | Path                           | Auth | Permission           | Branch | Description                        |
| ------ | ------------------------------ | ---- | -------------------- | ------ | ---------------------------------- |
| POST   | `/api/tills/open`              | Yes  | pos:till:open        | Yes    | Open a till session (within shift) |
| POST   | `/api/tills/:id/safe-drop`     | Yes  | pos:till:safe-drop   | Yes    | Perform cash safe drop             |
| POST   | `/api/tills/:id/reconcile`     | Yes  | pos:till:reconcile   | Yes    | Reconcile + close till             |
| GET    | `/api/tills/active`            | Yes  | pos:till:read        | Yes    | Get current user's active till     |
| GET    | `/api/tills/:id`               | Yes  | pos:till:read        | Yes    | Get till by ID with movements      |
| GET    | `/api/tills/:id/summary`       | Yes  | pos:till:read        | Yes    | Get till summary + expected cash   |

## Reservations + Deposits + Seating (M16) ✅

Table reservation lifecycle with deposit tracking, conflict detection, and seating bridge to POS orders.

### Reservation Endpoints

| Method | Path                                      | Auth | Permission                      | Branch | Description                          |
| ------ | ----------------------------------------- | ---- | ------------------------------- | ------ | ------------------------------------ |
| POST   | `/api/reservations`                       | Yes  | pos:reservation:create          | Yes    | Create a reservation                 |
| GET    | `/api/reservations`                       | Yes  | pos:reservation:read            | Yes    | List reservations (paginated)        |
| GET    | `/api/reservations/upcoming`              | Yes  | pos:reservation:read            | Yes    | List upcoming PENDING/CONFIRMED      |
| GET    | `/api/reservations/:id`                   | Yes  | pos:reservation:read            | Yes    | Get reservation by ID                |
| PATCH  | `/api/reservations/:id/confirm`           | Yes  | pos:reservation:confirm         | Yes    | Confirm a pending reservation        |
| PATCH  | `/api/reservations/:id/seat`              | Yes  | pos:reservation:seat            | Yes    | Seat reservation (optional order)    |
| PATCH  | `/api/reservations/:id/cancel`            | Yes  | pos:reservation:cancel          | Yes    | Cancel a reservation                 |
| PATCH  | `/api/reservations/:id/no-show`           | Yes  | pos:reservation:no-show         | Yes    | Mark as no-show                      |
| POST   | `/api/reservations/:id/deposits`          | Yes  | pos:reservation:deposit:record  | Yes    | Record a deposit                     |
| GET    | `/api/reservations/:id/deposits`          | Yes  | pos:reservation:deposit:read    | Yes    | List deposits for reservation        |
| GET    | `/api/reservations/:id/events`            | Yes  | pos:reservation:read            | Yes    | List event log for reservation       |
| PATCH  | `/api/reservations/:id/assign-table`      | Yes  | pos:reservation:table:assign    | Yes    | Assign/reassign table                |

## Events + Booking Portal + Ticketing (M17) ✅

Branch-scoped event lifecycle with booking portal, ticket classes, bookings, ticket issuance, and QR check-in.

### Event Endpoints

| Method | Path                                                | Auth | Permission               | Branch | Description                          |
| ------ | --------------------------------------------------- | ---- | ------------------------ | ------ | ------------------------------------ |
| POST   | `/api/events`                                       | Yes  | pos:event:create         | Yes    | Create event (DRAFT)                 |
| GET    | `/api/events`                                       | Yes  | pos:event:read           | Yes    | List events (paginated, filterable)  |
| GET    | `/api/events/upcoming`                              | Yes  | pos:event:read           | Yes    | List upcoming events                 |
| GET    | `/api/events/portal/:portalKey`                     | Yes  | pos:event:portal:read    | Yes    | Public portal view                   |
| GET    | `/api/events/:id`                                   | Yes  | pos:event:read           | Yes    | Get event by ID                      |
| PATCH  | `/api/events/:id`                                   | Yes  | pos:event:update         | Yes    | Update DRAFT event                   |
| PATCH  | `/api/events/:id/publish`                           | Yes  | pos:event:publish        | Yes    | Publish event (generates portal key) |
| PATCH  | `/api/events/:id/close`                             | Yes  | pos:event:close          | Yes    | Close event                          |
| POST   | `/api/events/:id/ticket-classes`                    | Yes  | pos:event:update         | Yes    | Create ticket class                  |
| GET    | `/api/events/:id/ticket-classes`                    | Yes  | pos:event:read           | Yes    | List ticket classes                  |
| POST   | `/api/events/:id/bookings`                          | Yes  | pos:event:booking:create | Yes    | Create booking                       |
| GET    | `/api/events/:id/bookings`                          | Yes  | pos:event:booking:read   | Yes    | List bookings for event              |
| GET    | `/api/events/bookings/:bookingId`                   | Yes  | pos:event:booking:read   | Yes    | Get booking by ID                    |
| PATCH  | `/api/events/bookings/:bookingId/cancel`            | Yes  | pos:event:booking:cancel | Yes    | Cancel booking                       |
| POST   | `/api/events/bookings/:bookingId/tickets/issue`     | Yes  | pos:event:ticket:issue   | Yes    | Issue tickets for booking            |
| POST   | `/api/events/tickets/:ticketId/check-in`            | Yes  | pos:event:checkin        | Yes    | Check in ticket via QR               |

## Validation

- DTO classes with `class-validator`
- `whitelist: true`
- `forbidNonWhitelisted: true`
- Normalize dates to UTC
- Money accepted as decimal-safe string or number string

## Error Envelope

```json
{
  "statusCode": 400,
  "error": {
    "code": "DOMAIN_CODE",
    "message": "Human readable message",
    "requestId": "..."
  }
}
```

## Pagination

| Param       | Type           | Description           |
| ----------- | -------------- | --------------------- |
| `page`      | number         | Page number (1-based) |
| `pageSize`  | number         | Items per page        |
| `sort`      | string         | Sort field            |
| `direction` | `asc` / `desc` | Sort direction        |

## Filtering

Prefer query params for simple filters.
Use POST body only for complex report/filter payloads.

## Idempotency (M41+)

Required or strongly recommended for:

- Payment intents
- Order close
- Refunds
- Reservation / booking creation
- Receiving / stock adjustment
- Payroll approval / pay
- Sync replay endpoints

Header: `Idempotency-Key: <unique-client-key>`

## Audit (M2) ✅

All sensitive writes must capture:

- Actor user ID
- Org ID
- Branch ID where relevant
- Action
- Resource type
- Resource ID
- Before / after snapshot where reasonable
- Reason when action is exceptional

## Money & Tax

- Money stored in Decimal-capable fields
- Tax breakdown should be explicit, not hidden in one total
- Totals record: subtotal, discount, service charge, tax, grand total

## Time & Numbering

- Store timestamps in UTC
- Number sequences generated by server
- Receipt / order / PO / journal numbers are never client-generated
