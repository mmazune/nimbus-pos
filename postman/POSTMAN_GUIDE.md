# Postman Guide — Nimbus POS

## Directory Structure

```
postman/
├── POSTMAN_GUIDE.md
├── collections/
│   ├── M0-Repo-Bootstrap.postman_collection.json
│   ├── M1-Health-DB.postman_collection.json
│   ├── M2-Auth-RBAC.postman_collection.json
│   ├── M3-Tenancy.postman_collection.json
│   ├── M3_1-Quick-PIN-Login.postman_collection.json
│   ├── M4-Org-Settings.postman_collection.json
│   ├── M5-Floor-Plans-Tables.postman_collection.json
│   ├── M6-Menu-Catalog.postman_collection.json
│   ├── M6_1-Menu-Taxonomy-Serving-Formats.postman_collection.json
│   ├── M7-Menu-Modifiers.postman_collection.json
│   ├── M8-Recipes-Costing.postman_collection.json
│   ├── M9-Inventory-Stock.postman_collection.json
│   ├── M10-POS-Orders.postman_collection.json
│   ├── M11-KDS-Station-Routing.postman_collection.json
│   └── M12-Discounts-Approval-Workflow.postman_collection.json
└── environments/
    └── dev.postman_environment.json
```

## Setup

1. Import the **environment** file `postman/environments/dev.postman_environment.json` into Postman.
2. Import the relevant **collection** from `postman/collections/`.
3. Select the `Nimbus POS — Dev` environment.
4. Run requests.

## Conventions

- One collection per milestone (minimum).
- Collections are named `M<N>-<Short-Name>.postman_collection.json`.
- Each collection should include test scripts that validate response shape.
- Environment variables are used for `baseUrl`, tokens, and dynamic IDs.

## Token Capture

Auth is implemented in **M2**. The `Login (Owner)` request in the M2 collection
includes test scripts that automatically save `accessToken`, `refreshToken`, and
`userId` into the active environment. The `Refresh Token` request rotates both
tokens and updates the environment variables automatically.

All authenticated requests in the M2+ collections inherit a **Bearer** token
from the collection-level auth setting, using `{{accessToken}}`.

## Milestone Coverage

| Milestone | Collection          | Auth Required              |
| --------- | ------------------- | -------------------------- |
| M0        | `M0-Repo-Bootstrap` | No                         |
| M1        | `M1-Health-DB`       | No                         |
| M2        | `M2-Auth-RBAC`       | Yes — token capture active |
| M3        | `M3-Tenancy`         | Yes — token capture active |
| M3.1      | `M3_1-Quick-PIN-Login` | Yes — token capture active |
| M4        | `M4-Org-Settings`      | Yes — token capture active |
| M5        | `M5-Floor-Plans-Tables`  | Yes — token capture active |
| M6        | `M6-Menu-Catalog`        | Yes — token capture active |
| M6.1      | `M6_1-Menu-Taxonomy-Serving-Formats` | Yes — token capture active |
| M7        | `M7-Menu-Modifiers`      | Yes — token capture active |
| M8        | `M8-Recipes-Costing`     | Yes — token capture active |
| M9        | `M9-Inventory-Stock`     | Yes — token capture active |
| M10       | `M10-POS-Orders`         | Yes — token capture active |
| M11       | `M11-KDS-Station-Routing` | Yes — token capture active |
| M12       | `M12-Discounts-Approval-Workflow` | Yes — token capture active |

## Manual Checklist — M0

- [ ] Import `dev.postman_environment.json`
- [ ] Import `M0-Repo-Bootstrap.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200` with `{ "status": "ok" }`
- [ ] Confirm no auth headers are required

## Manual Checklist — M1

- [ ] Import `dev.postman_environment.json` (if not already imported)
- [ ] Import `M1-Health-DB.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200`
- [ ] Verify `status` = `"ok"`
- [ ] Verify `db` = `"ok"`
- [ ] Verify `timestamp` exists and is a valid ISO string
- [ ] Confirm no auth headers required
- [ ] Note: auth/token capture starts in M2, not M1

## Manual Checklist — M2

- [ ] Import `dev.postman_environment.json` (re-import to get `refreshToken` + `userId` vars)
- [ ] Import `M2-Auth-RBAC.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200` with `status: ok, db: ok`
- [ ] Run `POST /api/auth/login` with owner@demo.local / Owner#123 — expect `201` with tokens
- [ ] Verify `accessToken` and `refreshToken` are auto-saved to environment
- [ ] Run `GET /api/auth/me` — expect `200` with user profile, roles, permissions, session
- [ ] Run `GET /api/auth/sessions` — expect `200` with sessions array
- [ ] Run `POST /api/auth/pin-login` with cashier@demo.local / 3456 — expect `201`, source: PIN
- [ ] Run `POST /api/auth/refresh` with `{{refreshToken}}` — expect `201` with rotated tokens
- [ ] Run `GET /api/auth/_perm-test` as Owner with X-Platform: WEB_BACKOFFICE — expect `200`
- [ ] Login as Cashier, run `GET /api/auth/_perm-test` — expect `403` (insufficient permissions)
- [ ] Login as Waiter, run `GET /api/auth/_perm-test` with X-Platform: WEB_BACKOFFICE — expect `403`
- [ ] Run `POST /api/auth/logout` — expect `201` with logged-out message
- [ ] Run `POST /api/auth/logout-all` — expect `201` with all sessions revoked

## Manual Checklist — M3

- [ ] Import `dev.postman_environment.json` (re-import to get `orgId`, `branchId`, etc.)
- [ ] Import `M3-Tenancy.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201` with tokens auto-saved
- [ ] Run `GET /api/me` — expect `200` with user, organizations, memberships, branches, roles, permissions, session
- [ ] Run `POST /api/orgs` with `{ "name": "Test Org", "slug": "test-org" }` — expect `201`, `orgId` auto-saved
- [ ] Run `POST /api/orgs/{{orgId}}/branches` with `{ "name": "Test Branch" }` — expect `201`, `branchId` auto-saved
- [ ] Run `GET /api/branches` — expect `200` with branches array for the logged-in user
- [ ] Run `GET /api/branches/{{branchId}}` — expect `200` with branch detail
- [ ] Login as Waiter, run `POST /api/orgs/{{orgId}}/branches/{{branchId}}/memberships` to add waiter — expect `201`
- [ ] Run `GET /api/orgs/{{orgId}}/branches/{{branchId}}/memberships` — expect `200` with memberships array
- [ ] Run `GET /api/branch-test` **without** X-Branch-Id header — expect `400` (missing branch context)
- [ ] Run `GET /api/branch-test` **with** X-Branch-Id header (valid branchId) — expect `200` (branch context OK)
- [ ] Run `GET /api/branch-test` with X-Branch-Id for a branch user has no membership — expect `403`

## Manual Checklist — M3.1

- [ ] Import `dev.postman_environment.json` (re-import to get `waiterUserId`, `cashierUserId`, `managerUserId`, `quickPinAccessToken`)
- [ ] Import `M3_1-Quick-PIN-Login.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter/Cashier/Manager)` — expect `201`, userId vars auto-saved
- [ ] Run `Issue Quick PIN (Waiter)` — expect `201`, 6-digit PIN, tier=LOW_6
- [ ] Run `Issue Quick PIN (Cashier)` — expect `201`, 6-digit PIN, tier=LOW_6
- [ ] Run `Issue Quick PIN (Manager)` — expect `201`, 8-digit PIN, tier=HIGH_8
- [ ] Run `Quick PIN Login (Waiter on POS_DESKTOP)` — expect `201`, session source=PIN, platform=POS_DESKTOP
- [ ] Run `Quick PIN Login (Cashier on POS_DESKTOP)` — expect `201`, session source=PIN
- [ ] Run `Quick PIN Login (Manager on POS_DESKTOP)` — expect `201`, session source=PIN
- [ ] Run `Me after Quick PIN Login` — expect `200` with valid session
- [ ] Run `Wrong PIN → 401` — expect `401`
- [ ] Run `Wrong Platform → 403` — expect `403` (non-POS_DESKTOP platform rejected)
- [ ] Run `Reset Quick PIN (Waiter)` — expect `201`, new 6-digit PIN
- [ ] Run `Update Quick PIN Settings (Waiter)` — expect `200`, displayName updated
- [ ] Run `Quick PIN Status (Waiter)` — expect `200` with quickPinEnabled + hasPin flags

## Manual Checklist — M4

- [ ] Import `dev.postman_environment.json` (re-import to get `waiterAccessToken`)
- [ ] Import `M4-Org-Settings.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter)` — expect `201`, waiterAccessToken auto-saved
- [ ] Run `Get Settings` — expect `200` with seeded defaults (currency=UGX, vatPercent=18, rounding, taxMatrix)
- [ ] Run `Get Currency` — expect `200` with currency=UGX
- [ ] Run `Update Currency` — expect `200` with currency=USD
- [ ] Run `Get Tax Matrix` — expect `200` with vatPercent and taxMatrix
- [ ] Run `Update Tax Matrix` — expect `200` with updated defaultVatPct=20
- [ ] Run `Get Rounding` — expect `200` with rounding object
- [ ] Run `Update Rounding` — expect `200` with mode=UP, increment=50
- [ ] Run `Get Thresholds` — expect `200` with discountApprovalThreshold and anomalyThresholds
- [ ] Run `Update Thresholds` — expect `200` with updated anomalyThresholds.lateVoidMin=10
- [ ] Run `Get Platform Access` — expect `200` with platformAccess
- [ ] Run `Update Platform Access` — expect `200` with useRoleDefaults=false
- [ ] Run `Create Exchange Rate` — expect `201` with EUR/UGX rate
- [ ] Run `List Exchange Rates` — expect `200` with array including seeded and new rates
- [ ] Run `Permission Denial — Waiter Update Currency → 403` — expect `403`
- [ ] Run `Permission Denial — Waiter Update Thresholds → 403` — expect `403`

## Manual Checklist — M5

- [ ] Import `dev.postman_environment.json` (re-import to get `floorPlanId`, `tableId` vars)
- [ ] Import `M5-Floor-Plans-Tables.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter)` — expect `201`, waiterAccessToken auto-saved
- [ ] Run `List Floor Plans` — expect `200` with array of seeded floor plans for the branch
- [ ] Run `Create Floor Plan` — expect `201` with new floor plan, `floorPlanId` auto-saved
- [ ] Run `Get Floor Plan` — expect `200` with floor plan detail including tables
- [ ] Run `Update Floor Plan` — expect `200` with updated name/data
- [ ] Run `Create Table` — expect `201` with new table, `tableId` auto-saved
- [ ] Run `List Tables` — expect `200` with tables array for the branch
- [ ] Run `Get Table` — expect `200` with table detail
- [ ] Run `Update Table` — expect `200` with updated label/capacity
- [ ] Run `Change Table Status` — expect `200` with status changed to OCCUPIED
- [ ] Run `Get Availability` — expect `200` with summary (total, available, occupied, reserved, cleaning)
- [ ] Run `Permission Denial — Waiter Create Floor Plan → 403` — expect `403`
- [ ] Run `Permission Denial — Waiter Create Table → 403` — expect `403`
- [ ] Run `Missing Branch Header → 400` — expect `400` (no X-Branch-Id header)
- [ ] Run `Invalid Status Enum → 400` — expect `400` (bad table status value)

## Manual Checklist — M6

- [ ] Import `dev.postman_environment.json` (re-import to get `categoryId`, `taxCategoryId`, `menuItemId` vars)
- [ ] Import `M6-Menu-Catalog.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter)` — expect `201`, waiterAccessToken auto-saved
- [ ] Run `Get Me` — expect `200`, branchId auto-saved
- [ ] Run `List Categories` — expect `200` with array of seeded categories
- [ ] Run `Create Category` — expect `201` with new category, `categoryId` auto-saved
- [ ] Run `Get Category by ID` — expect `200` with category detail
- [ ] Run `Update Category` — expect `200` with updated name
- [ ] Run `List Tax Categories` — expect `200` with array of seeded tax categories
- [ ] Run `Create Tax Category` — expect `201` with new tax category, `taxCategoryId` auto-saved
- [ ] Run `Get Tax Category by ID` — expect `200` with tax category detail
- [ ] Run `Update Tax Category` — expect `200` with updated rate
- [ ] Run `Create Menu Item` — expect `201` with new item, `menuItemId` auto-saved
- [ ] Run `List Menu Items` — expect `200` with items array
- [ ] Run `Get Menu Item by ID` — expect `200` with item detail including category and taxCategory
- [ ] Run `Update Menu Item` — expect `200` with updated price
- [ ] Run `Get Catalog` — expect `200` with grouped categories, items, and taxCategories
- [ ] Run `Permission Denial — Waiter Create Category → 403` — expect `403`
- [ ] Run `Missing Branch Header → 400` — expect `400` (no X-Branch-Id header)
- [ ] Run `Invalid Menu Item Payload → 400` — expect `400` (bad type, negative price)

## Manual Checklist — M7

- [ ] Import `M7-Menu-Modifiers.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Create Modifier Group` — expect `201`, `modifierGroupId` auto-saved
- [ ] Run `List Modifier Groups` — expect `200`
- [ ] Run `Create Modifier Option` — expect `201`, `modifierOptionId` auto-saved
- [ ] Run `List Modifier Options` — expect `200`
- [ ] Run `Attach Modifier Group to Item` — expect `201`

## Manual Checklist — M8

- [ ] Import `M8-Recipes-Costing.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Create Inventory Item` — expect `201` with id, name, unit, `inventoryItemId` auto-saved
- [ ] Run `Create Second Inventory Item` — expect `201`, `inventoryItemId2` auto-saved
- [ ] Run `List Inventory Items` — expect `200` with array of items
- [ ] Run `Get Inventory Item by ID` — expect `200` with item detail
- [ ] Run `Update Inventory Item` — expect `200` with updated theoreticalUnitCost
- [ ] Run `Set Recipe for Menu Item` — expect `201` with menuItemId + ingredientCount=2
- [ ] Run `Get Recipe` — expect `200` with menuItem, baseIngredients, modifierIngredients, servingIngredients
- [ ] Run `Get Recipe Cost Breakdown` — expect `200` with totalTheoreticalCogs, margin, marginPercent, rows
- [ ] Verify cost fields are present for Owner (L5) role
- [ ] Login as Waiter, confirm cost endpoint returns `403` (no pos:cost:read permission)

## Manual Checklist — M9

- [ ] Import `M9-Inventory-Stock.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Get Branch ID` — expect `200`, branchId auto-saved
- [ ] Run `Get Inventory Item ID` — expect `200`, inventoryItemId auto-saved
- [ ] Run `Create Stock Batch` — expect `201`, stockBatchId auto-saved, remainingQty = receivedQty
- [ ] Run `List All Batches` — expect `200` with array of batches
- [ ] Run `List Batches for Item` — expect `200`, all batches for same itemId
- [ ] Run `Get Inventory Levels` — expect `200` with onHandQty, reorderLevel, belowReorder
- [ ] Run `Get Inventory Levels (by Category)` — expect `200`, all items filtered by category=Meat
- [ ] Run `Positive Adjustment (+10)` — expect `201` with reason recorded
- [ ] Run `Negative Adjustment (-5, FIFO)` — expect `201`, FIFO deduction from oldest batch
- [ ] Run `Negative Stock Attempt → 400` — expect `400` with negative stock blocked message
- [ ] Login as Waiter, run `Create Stock Batch` — expect `403` (no pos:inventory:write permission)
- [ ] Login as Waiter, run `Positive Adjustment` — expect `403` (no pos:inventory:adjust permission)
- [ ] Login as Waiter, run `Get Inventory Levels` — expect `200` (pos:inventory:read granted)

## Manual Checklist — M10

- [ ] Import `M10-POS-Orders.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Create Dine-In Order` — expect `201`, status = NEW, serviceType = DINE_IN, orderNumber matches ORD-XXXXXX
- [ ] Run `Create Takeaway Order` — expect `201`, serviceType = TAKEAWAY, tableId = null
- [ ] Run `List Orders` — expect `200` with data array and total
- [ ] Run `Get Order by ID` — expect `200` with items array and user info
- [ ] Run `Add Order Item` — expect `201` with menuItemId and quantity
- [ ] Run `Update Order Item` — expect `200` with updated quantity
- [ ] Run `Delete Order Item` — expect `200`
- [ ] Run `Send Order (NEW → SENT)` — expect `200`, status = SENT
- [ ] Run `Mark In-Kitchen (SENT → IN_KITCHEN)` — expect `200`, status = IN_KITCHEN
- [ ] Run `Mark Ready (IN_KITCHEN → READY)` — expect `200`, status = READY
- [ ] Run `Mark Served (READY → SERVED)` — expect `200`, status = SERVED
- [ ] Run `Close Order (SERVED → CLOSED)` — expect `200`, status = CLOSED
- [ ] Run `Void Order` — expect `200`, status = VOIDED
- [ ] Verify TAKEAWAY + tableId → `400`
- [ ] Verify invalid transition (e.g. NEW → CLOSED) → `409`
- [ ] Verify post-kitchen void without reason → `400`
