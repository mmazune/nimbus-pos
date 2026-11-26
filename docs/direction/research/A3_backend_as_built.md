# A3 — Back end as built (read-only audit)

Audit date: 26 Nov 2026 (UTC). Source: `/home/claude/pos-scan/repo` (snapshot, no git, no node_modules). Nothing was run against a database; every fact comes from reading source.

**How to read this.** `[V]` = verified by reading the cited file and line. `UNKNOWN` = could not be established from the snapshot. Path shorthands:

- `S:` = `packages/db/prisma/schema.prisma`
- `SEED:` = `packages/db/prisma/seed.ts`
- `M/` = `apps/api/src/modules/`
- `WEB/` = `apps/web/src/`

Role abbreviations: Own = Owner, Mgr = Manager, Acc = Accountant, Sup = Supervisor, Csh = Cashier, Chf = Chef, Wtr = Waiter, Bar = Bartender, Pro = Procurement, Stk = Stock Manager, Evt = Event Manager.

**Method notes.** Role holdings were computed by parsing `ROLE_PERM_MATRIX` (SEED:682-1700), resolving the `...C21_ACCOUNTING_FINANCE_ALL` spreads (SEED:954, 1232, 1330) and subtracting `REVOKED_ROLE_PERMISSIONS` (SEED:1768-1787). Endpoints were extracted from all `*.controller.ts` files (564 route decorators). "Web calls it" means a literal route-prefix string appears in `apps/web/src`; it is a string search, not a screen review.

---

## The ten facts that matter most

1. **A sale does not deduct stock.** The only caller of `fifoDeduct` is the manual adjustment endpoint (`M/inventory/inventory.service.ts:226`). Orders, payments, refunds, quick sale and KDS never touch `StockBatch`. [V]
2. **There is no store / location model.** Stock is keyed by branch only (`S:1233-1260`). One branch = one pool of stock. [V]
3. **No screen calls the inventory, recipes or KDS API.** Zero references to `/inventory`, `/kds` or `/pos/quick-sale` in `WEB/`. [V]
4. **The Accountant cannot see a menu item, a recipe, an ingredient or a cost.** The role holds none of `pos:menu:read`, `pos:recipe:read`, `pos:cost:read`, `pos:inventory:read` (SEED:1234-1331). [V]
5. **Categories do not nest.** `Category` is flat (`S:914-932`). A second, separate tree exists for waiter navigation: Section (FOOD / DRINKS only) → Browse group → Browse subgroup (`S:1002-1066`). Two levels under a fixed two-value section, no deeper. [V]
6. **Tables can be created through the API by Owner, Manager and Supervisor** (`POST /tables`, `pos:table:write`), **but no web screen calls it** and there is no delete endpoint. [V]
7. **Paying a bill does not free the table.** The close path writes `status: CLOSED` directly (`M/payments/payments.service.ts:244-247`, `:102-105`) and never calls the table-release helper, which lives in a function with no caller (`M/orders/orders.service.ts:841`). [V]
8. **Only the first send reaches the kitchen.** Tickets are created once per order; items added later never get a ticket (`M/kds/kds.service.ts:72-82`), and there is no second "send" transition (`M/orders/orders.service.ts:43-51`). [V]
9. **Bumping a kitchen ticket does not move the order.** `kds.service.ts` contains no `order.update`. The order needs three separate calls (`/in-kitchen`, `/ready`, `/mark-served`) that the Chef has no permission for and no screen makes. Cash close requires `SERVED` (`M/payments/payments.service.ts:34`, `:162-166`). [V]
10. **The "bill" is a JSON view.** No print job, no HTML, no PDF, no printer call. Reprint writes an audit row (`M/receipts/receipts.service.ts:127-152`). [V]

---

## 1. Tables and floor

### Models

| Model | Fields | Ref |
|---|---|---|
| `FloorPlan` | id, orgId, branchId, name, `data` (Json), isActive | `S:849-866` [V] |
| `Table` | id, orgId, branchId, floorPlanId (nullable), label, capacity (default 4), status (default AVAILABLE), isActive, metadata (Json) | `S:869-894` [V] |
| `TableStatus` enum | AVAILABLE, OCCUPIED, RESERVED, CLEANING | `S:839-844` [V] |

- Label is unique per branch (`S:889`). [V]
- **There is no Section / Area / Zone model.** Zones exist only as free JSON inside `FloorPlan.data` in the seed (SEED:2292-2314). [V]
- A table has no shape, position or section column; the seed puts `{x, y, shape}` in `metadata` (SEED:2330). [V]
- `Table` relates to `Order`, `Reservation`, `Event` (`S:885-887`). Nothing else. A table does not carry a default waiter, a section, a price list or a printer. [V]

### How a table's state changes

| Change | Trigger | Ref |
|---|---|---|
| → OCCUPIED | A dine-in order is **sent** (not when it is created) | `M/orders/orders.service.ts:116-122`, called at `:710-712` [V] |
| → OCCUPIED | A reservation is seated | `M/reservations/reservations.service.ts:294-296` [V] |
| OCCUPIED → AVAILABLE | An order is **voided** and no other active order is on the table | `M/orders/orders.service.ts:129-146`, called at `:889-891` [V] |
| OCCUPIED → AVAILABLE | `transitionOrder(... CLOSED)` | `M/orders/orders.service.ts:713-714` — **unreachable**: its only caller `closeOrder()` (`:841`) is called by nothing (repo-wide search), and the controller notes the close endpoint moved to payments (`M/orders/orders.controller.ts:208`) [V] |
| any → any | `PATCH /tables/:id/status` (manual) | `M/floor/floor.service.ts:260-295` [V] |
| → RESERVED, → CLEANING | **Never set automatically.** Only the manual endpoint or the seed sets them. Repo-wide search for table writes found only the two files above. | [V] |

**Consequence:** after payment the table stays OCCUPIED until someone patches it by hand. The payment close (`M/payments/payments.service.ts:244-247`) and the auto-settle (`:102-105`) update the order row directly and contain no table write. The same path also skips the reservation auto-complete that `transitionOrder` performs (`M/orders/orders.service.ts:723-741`). [V]

A newly created (unsent) order does not mark the table. `createOrder` does not check whether the table already has an open order, so two waiters can open two orders on one table (`M/orders/orders.service.ts:150-199`). [V]

### Endpoints and who holds them

| Endpoint | Permission | Roles | Ref |
|---|---|---|---|
| `POST /floor-plans` | `pos:floor:write` | Own, Mgr, Sup | `M/floor/floor.controller.ts:22-23` [V] |
| `GET /floor-plans`, `GET /floor-plans/:id` | `pos:floor:read` | Own, Mgr, Sup, Csh, Chf, Wtr, Bar | `:36-37`, `:42-43` [V] |
| `PATCH /floor-plans/:id` | `pos:floor:write` | Own, Mgr, Sup | `:48-49` [V] |
| `POST /tables` | `pos:table:write` | Own, Mgr, Sup | `:65-66` [V] |
| `GET /tables`, `GET /tables/:id` | `pos:table:read` | Own, Mgr, Sup, Csh, Chf, Wtr, Bar | `:79-80`, `:85-86` [V] |
| `PATCH /tables/:id` (label, capacity, floor plan, status, isActive, metadata) | `pos:table:write` | Own, Mgr, Sup | `:91-92`; fields `M/floor/dto/update-table.dto.ts:19-40` [V] |
| `PATCH /tables/:id/status` | `pos:table:write` | Own, Mgr, Sup | `:106-107` [V] |
| `GET /floor/availability` | `pos:floor:read` | as read | `:123-124` [V] |

Grants: `pos:table:write` at SEED:699 (Own), 970 (Mgr), 1341 (Sup). `pos:floor:write` at SEED:697, 968, 1339. [V]

### Who can do what to a table today

| Action | Who | Note |
|---|---|---|
| Create | Own, Mgr, Sup (API only) | `M/floor/floor.service.ts:123-171` [V] |
| Edit | Own, Mgr, Sup (API only) | `:192-258` [V] |
| Delete | **Nobody** | No `@Delete` in the controller; the import list has no `Delete` (`M/floor/floor.controller.ts:1`). Soft-hide is possible with `isActive: false`. [V] |
| Mark RESERVED by hand | Own, Mgr, Sup | status patch [V] |
| Create a reservation | Own, Mgr, Sup, Csh, Evt | `pos:reservation:create` (`M/reservations/reservations.controller.ts:36`) [V] |
| Assign a table to a reservation | Own, Mgr, Sup, Csh, Evt | `:180`. This does **not** set the table to RESERVED. [V] |
| Seat a reservation | Own, Mgr, Sup, Csh, Wtr, Evt | `:87` → table OCCUPIED [V] |

### Is there a path to create a table at all?

- **API: yes** — `POST /api/tables`. [V]
- **Web: no.** The only table calls in `WEB/` are `GET /api/tables`, `GET /api/tables/:id`, `GET /api/floor-plans`, `GET /api/floor/availability` and one `PATCH /api/tables/:id/status` (`WEB/lib/supervisor/floor.ts:72-102`, `WEB/lib/waiter/floor-api.ts:72-76`, `WEB/lib/manager/operations-api.ts:212`, `WEB/lib/cashier/resolution.ts:19`). [V]
- In practice tables come from the seed (SEED:2324-2430) or the CSV importer (`packages/db/prisma/demo-import.ts:24`). [V]

---

## 2. Orders on a table

### Models

- `Order` (`S:1307-1369`): tableId (nullable), userId (the server), orderNumber (unique per branch), status, serviceType (DINE_IN / TAKEAWAY), subtotal, tax, discount, total, notes, metadata, splitFromOrderId, mergedIntoOrderId, tillCode, clientSaleId. [V]
- `OrderItem` (`S:1372-1398`): menuItemId, menuItemServingId, quantity, price, subtotal, notes, metadata, costUnit, costTotal, marginTotal, marginPct. [V]
- **An order item has no status, no "sent" flag, no course, no seat, no void marker.** (`S:1372-1398`) [V]
- An order has no guest count / covers field (`S:1307-1334`). [V]
- Chosen modifiers live in `OrderItem.metadata.selectedModifiers` (JSON), not in a table (`M/orders/orders.service.ts:321-325`). [V]

### State machine

`M/orders/orders.service.ts:43-51` [V]

```
NEW ──► SENT ──► IN_KITCHEN ──► READY ──► SERVED ──► CLOSED
 │        │           │            │
 └────────┴───────────┴────────────┴──► VOIDED        (SERVED cannot be voided)
```

- No backward move, no reopen, no CLOSED → anything in the map. [V]
- **Two paths bypass the map.** (a) Auto-settle sets CLOSED from any non-terminal status when payments cover the total (`M/payments/payments.service.ts:97-105`), reached from a manual-reference payment (`:858`) or a MoMo webhook (`:705`). (b) Post-close void sets CLOSED → VOIDED (`M/refunds/refunds.service.ts:268-272`). [V]
- Close-with-payment requires `SERVED` (`M/payments/payments.service.ts:34`, `:162-166`). [V]
- Discounts are refused once the order is SERVED (`M/discounts/discounts.service.ts:32`, `:55`). So a discount must be granted before the food is marked served, and payment only after. [V]
- Items can be added, changed and deleted in any state except CLOSED / VOIDED (`M/orders/orders.service.ts:489`, `:562`, `:643`). [V]
- **Tax is never calculated.** `recalcOrderTotals` writes subtotal, discount and total only (`:435-471`); `Order.tax` keeps its default of 0 (`S:1317`); a comment elsewhere confirms it (`M/dashboards/dashboards.service.ts:37`). `TaxCategory.rate` (`S:940`) and `OrgSettings.vatPercent` / `taxMatrix` (`S:794`, `:806`) are stored and not applied to orders. [V]

### Endpoints and permissions

| Action | Endpoint | Permission | Ref |
|---|---|---|---|
| Create order | `POST /pos/orders` | `pos:orders:write` | `M/orders/orders.controller.ts:36-37` [V] |
| List / read | `GET /pos/orders`, `/:id` | `pos:orders:read` | `:51-52`, `:62-63` [V] |
| Add item | `POST /pos/orders/:id/items` | `pos:orders:write` | `:73-74` [V] |
| Change item | `PATCH .../items/:itemId` | `pos:orders:write` | `:89-90` [V] |
| Remove item | `DELETE .../items/:itemId` | `pos:orders:write` | `:106-107` [V] |
| Send | `POST .../send` | `pos:orders:write` | `:122-124` [V] |
| In kitchen | `POST .../in-kitchen` | `pos:orders:write` | `:139-141` [V] |
| Ready | `POST .../ready` | `pos:orders:write` | `:156-158` [V] |
| Served | `POST .../mark-served` | `pos:orders:write` | `:173-175` [V] |
| Request bill | `POST .../request-bill` | `pos:orders:write` | `:192-194` [V] |
| Void order | `POST .../void` | `pos:orders:void` | `:210-212` [V] |
| Post-close void | `POST /pos/orders/:id/post-close-void` | `pos:void:postclose` | `M/refunds/refunds.controller.ts:94` [V] |
| Request discount | `POST /pos/orders/:id/discounts` | `pos:discount:request` | `M/discounts/discounts.controller.ts:30` [V] |
| Approve / reject discount | `POST /pos/discounts/:id/approve`, `/reject` | `pos:discount:approve` | `:56`, `:72` [V] |
| Split bill / split items | `POST .../split-bill`, `/split-items` | `pos:order:split` | `M/pos-handoff/pos-handoff.controller.ts:85`, `:120` [V] |
| Merge | `POST /pos/orders/merge` | `pos:order:merge` | `:51` [V] |
| Transfer table / server | `POST .../transfer-table`, `/transfer-server` | `pos:order:transfer` | `:155`, `:190` [V] |
| Move items | `POST .../move-items` | `pos:order:move-items` | `:225` [V] |
| Close with payment | `POST /pos/orders/:id/close` | `pos:orders:close` | `M/payments/payments.controller.ts:39` [V] |
| Manual-reference payment | `POST /payments/manual-reference` | `pos:payment:manual-reference` | `:162` [V] |
| MoMo intent | `POST /payments/intents` | `pos:payment:intent` | `:73` [V] |
| Refund create / approve | `POST /pos/orders/:id/refunds`, `/pos/refunds/:id/approve` | `pos:refund:create` / `pos:refund:approve` | `M/refunds/refunds.controller.ts:28`, `:64` [V] |
| **Void a single item (with reason)** | **does not exist** | — | Item removal is the plain `DELETE` above: `pos:orders:write`, no reason, no approval, allowed after send (`M/orders/orders.service.ts:629-672`) [V] |
| **Reopen a closed order** | **does not exist** | — | No route, no transition [V] |

### Role × action matrix (from the seed)

Y = holds the permission. Seed lines: Wtr 1581-1645, Bar 1646-1664, Csh 1487-1559, Sup 1332-1486, Mgr 956-1233, Own 683-955. [V]

| Action | Waiter | Bartender | Cashier | Supervisor | Manager | Owner |
|---|---|---|---|---|---|---|
| Read orders | Y (own only) | Y | Y | Y | Y | Y |
| Create order | Y (shift open) | **N** | Y | Y | Y | Y |
| Add / change / remove item | Y (own, shift open) | N | Y | Y | Y | Y |
| Send to kitchen | Y (own, shift open) | N | Y | Y | Y | Y |
| Mark in-kitchen / ready | **N** (role guard) | N | Y | Y | Y | Y |
| Mark served | Y (own) | N | Y | Y | Y | Y |
| Request bill | Y (own) | N | Y | Y | Y | Y |
| Void a single item with reason | no such action | — | — | — | — | — |
| Void order | N | N | **N** | Y | Y | Y |
| Post-close void | N | N | N | Y + own PIN | Y + own PIN | Y + own PIN |
| Request discount | Y | N | Y | Y | Y | Y |
| Approve / reject discount | N | N | N | Y | Y | Y |
| Split bill / split items | **N** | N | Y | Y | Y | Y |
| Merge orders | N | N | Y | Y | Y | Y |
| Transfer table / server | N (revoked) | N | Y | Y | Y | Y |
| Move items | N (revoked) | N | Y | Y | Y | Y |
| Close with payment | N | N | Y | Y | Y | Y |
| Record manual-reference payment (auto-closes at zero balance) | **Y** | N | Y | Y | Y | Y |
| Create refund | Y | N | Y | Y | Y | Y |
| Approve refund | N | N | N | Y | Y | Y |
| Reopen | no such action | — | — | — | — | — |
| Read receipt view / reprint / send | Y | N | Y | **N** | Y | Y |
| KDS mark-ready / recall | Y | Y | Y | Y | Y | Y |

Line references for the cells that surprise: Waiter `pos:orders:write` SEED:1590; Waiter transfer + move-items revoked SEED:1778-1779; Waiter has no `pos:order:split` / `merge` (absent from SEED:1581-1645); Waiter `pos:payment:manual-reference` SEED:1597, `pos:refund:create` SEED:1599, `pos:kds:write` SEED:1592; Bartender has no `pos:orders:write` (SEED:1646-1664); Cashier has no `pos:orders:void` (holders SEED:713, 984, 1355); `pos:receipt:*` holders SEED:932-934, 1208-1210, 1549-1551, 1638-1640 — Supervisor absent. [V]

### Guards that are not permission-based

| Guard | Rule | Ref |
|---|---|---|
| Waiter-only test | Applies only when **every** role of the user is WAITER | `apps/api/src/common/auth/waiter-scope.ts:24-28` [V] |
| Ownership | A waiter-only user gets 403 on another waiter's order (read, add, change, send, void, bill) | `waiter-scope.ts:34-47`; used at `M/orders/orders.service.ts:220`, `:486`, `:559`, `:640`, `:697`, `:871`, `:925` [V] |
| Waiter transitions | A waiter-only user may drive only SENT and SERVED | `waiter-scope.ts:54-68`; `M/orders/orders.service.ts:698` [V] |
| Shift open | A waiter-only user needs an OPEN shift on the branch to create, add, change, delete, transition, request bill (409 `SHIFT_NOT_OPEN`) | `M/orders/orders.service.ts:90-110`; called at `:152`, `:487`, `:560`, `:641`, `:700`, `:926` [V] |
| Shift / till for everyone else | **None.** Cashier, Supervisor, Manager, Owner need no open shift or till to order or to take payment. `payments.service.ts` has no shift or till check. | [V] |
| Ownership in handoff / receipts / payments | **Not applied.** The waiter helpers are imported only by `orders.service.ts` (`:14-19`). | [V] |
| Post-kitchen void reason | Void from IN_KITCHEN or READY needs a reason | `M/orders/orders.service.ts:877-881` [V] |
| Manager PIN | Post-close void: mandatory, and it is **the caller's own** quick PIN, within 15 minutes of the last update | `M/refunds/refunds.service.ts:29`, `:247-265` [V] |
| Manager PIN | Discount approve and refund approve: optional, again the caller's own PIN | `M/discounts/discounts.service.ts:165-176`; `M/refunds/refunds.service.ts:162-169` [V] |
| Discount threshold | Auto-approved at or below `OrgSettings.discountApprovalThreshold` (default 5000), else PENDING | `M/discounts/discounts.service.ts:79-87`; `S:796` [V] |
| Refund threshold | Reuses the **discount** threshold | `M/refunds/refunds.service.ts:88-94` [V] |
| Self-approval | Not blocked: the approver may be the requester (no check in `:158-176`) | [V] |
| Idempotency | Handoff, payments, refunds, receipts, tills, shifts, inventory adjustments run through the BG3 facade | e.g. `M/inventory/inventory.controller.ts:41-74` [V] |

**No "second person" approval exists anywhere**: every PIN check compares against the acting user's own PIN. [V]

---

## 3. Menu

### Models

| Model | Key fields | Ref |
|---|---|---|
| `Category` | name (unique per branch), sortOrder, isActive. **No parentId.** | `S:914-932` [V] |
| `TaxCategory` | name, rate (5,2), efirsTaxCode, isActive | `S:935-954` [V] |
| `MenuItem` | categoryId (required), taxCategoryId, browseGroupId, browseSubgroupId, name (unique per category), sku, brand, description, price (10,2), itemType (FOOD / DRINK), station (KITCHEN / BAR / COLD_KITCHEN / DESSERT / NONE), sortOrder, isActive, metadata | `S:957-998`; enums `S:898-909` [V] |
| `MenuBrowseGroup` | section (FOOD / DRINKS), name (unique per branch), internalKey, sortOrder, isActive | `S:1026-1047`; enum `S:1002-1005` [V] |
| `MenuBrowseSubgroup` | groupId, name (unique per group), internalKey, sortOrder, isActive | `S:1050-1066` [V] |
| `MenuItemServing` | format (12-value enum: GLASS, BOTTLE, JUG, PINT, HALF_PINT, SHOT, SINGLE, DOUBLE, CARAFE, FLIGHT, CUP, CUSTOM), label, price, volumeText (free text), isDefault, sortOrder, isActive | `S:1070-1091`; enum `S:1007-1020` [V] |
| `ModifierGroup` | name, min, max, required, sortOrder, isActive | `S:1097-1119` [V] |
| `ModifierOption` | groupId, name, priceDelta, sortOrder, isActive | `S:1122-1139` [V] |
| `MenuItemOnGroup` | item ↔ modifier group | `S:1142-1157` [V] |

**Not in the schema:** specials, offers of the day, happy hour, time-of-day availability, featured flag, image field, "86 / sold out" other than `isActive`, combos, price lists, barcode. A search of the schema for `special|offer|happy|promo|featured|image|availab|soldOut|parentId` found none of these on menu models. [V]

`MenuItem.brand` (`S:967`) was added by the event-till migration (`packages/db/prisma/migrations/20261121000000_event_till_quick_sale/migration.sql:25`). No DTO accepts it (`M/menu/dto/create-menu-item.dto.ts:16-62`) and no code writes it; quick-sale only reads it (`M/quick-sale/quick-sale.service.ts:52`, `:512`). [V]

### Can categories nest?

**No.** `Category` has no parent column. [V]

The waiter-facing tree is a separate structure:

```
Section (enum: FOOD | DRINKS)        ← fixed, cannot add "Alcohol" or "Starters" here
  └─ Browse group    (e.g. Starters, Cocktails)
       └─ Browse subgroup (e.g. Hot Starters)   ← leaf level, cannot nest further
            └─ Menu item
```

- Depth: two configurable levels below a two-value section. `MenuBrowseSubgroup` has no self-reference (`S:1050-1066`). [V]
- An item points at one group and optionally one subgroup (`S:963-964`). [V]
- So "Drinks → Alcohol → Whiskeys" needs three levels under the section and **cannot** be represented; "Drinks → Whiskeys" or "Drinks → Alcohol (group) → Whiskeys (subgroup)" can. The owner's four tops ("food, drinks, starters, alcohols") cannot all be sections. [V]
- Every item carries **both** a `Category` (required) and a browse group — two parallel taxonomies. `/menu/catalog` groups by Category; `/menu/navigation` returns the browse tree without items. [V]

### Read endpoints

| Endpoint | Returns | Ref |
|---|---|---|
| `GET /menu/navigation?section=&activeOnly=` | Sections → groups → subgroups. **No items.** | `M/menu/menu.controller.ts:312`; `M/menu/menu.service.ts:1033-1079` [V] |
| `GET /menu/catalog` | Active categories → active items → tax category, browse group, subgroup, active servings. **Does not return modifiers, images or brand.** The whole menu in one response, no paging. | `:166`; `menu.service.ts:516-587` [V] |
| `GET /menu/items?categoryId=&activeOnly=` | Flat list. Only two filters. | `:137`; `menu.service.ts:339-355`; `M/menu/dto/list-menu-query.dto.ts:4-13` [V] |
| `GET /menu/items/:id`, `/items/:id/servings`, `/items/:id/modifier-groups`, `/modifier-groups/:id/options` | Detail | `:143`, `:271`, `:417`, `:378` [V] |
| **Search** | **None.** No `q`/`search` parameter on any menu DTO; no `contains` query in `menu.service.ts`. | [V] |

All menu reads need `pos:menu:read` (tax reads `pos:tax:read`): Own, Mgr, Sup, Csh, Chf, Wtr, Bar. **Not Accountant, Stock Manager, Procurement, Event Manager.** [V]

### Write endpoints

All `pos:menu:write` (tax: `pos:tax:write`) → **Own, Mgr, Sup** (SEED:701, 972, 1343; tax 703, 974, 1345). [V]

`POST/PATCH /menu/categories`, `/menu/tax-categories`, `/menu/items`, `/menu/browse-groups`, `/menu/browse-groups/:id/subgroups`, `/menu/items/:id/servings`, `PATCH /menu/items/:id/browse`, `/menu/modifier-groups`, `/menu/modifier-groups/:id/options`, `POST /menu/items/:id/modifier-groups` (`M/menu/menu.controller.ts:37-417`). [V]

- **No DELETE on anything in the menu** (controller has no `@Delete`). Deactivate with `isActive`. [V]
- Creating a menu item takes no recipe and no "sold as is" flag (`M/menu/dto/create-menu-item.dto.ts:16-62`). [V]
- **No web screen writes the menu.** The only menu calls in `WEB/` are six GETs in `WEB/lib/waiter/order-api.ts:308-349`. [V]

### The seed's demo menu, in numbers

All seeded into the MAIN branch only (SEED:8109-8198). [V]

| Measure | Value | Ref |
|---|---|---|
| Categories | 5 (Starters, Mains, Desserts, Drinks, Sides) | SEED:2523-2529 [V] |
| Items | 20 (14 FOOD, 6 DRINK) | SEED:2548-2749 [V] |
| Items per category | Drinks 6, Mains 5, Starters 4, Desserts 3, Sides 2 → **min 2, median 4, max 6** | same [V] |
| Stations | KITCHEN 8, BAR 6, COLD_KITCHEN 3, DESSERT 3 | same [V] |
| SKUs | 0 | same [V] |
| Browse groups | 8 (4 FOOD, 4 DRINKS) | SEED:2916-2930 [V] |
| Browse subgroups | 5 (under Starters and Mains only) | SEED:2939-2945 [V] |
| Items with servings | 6 of 20 (12 servings, 2 each) | SEED:2982-3058 [V] |
| Modifier groups / options | 4 / 14 | SEED:3270-3303 [V] |
| Items with modifiers | 7 of 20 | SEED:3306-3313 [V] |
| Items with a recipe | 10 of 20 (31 ingredient rows) + 2 modifier-linked rows | SEED:3682-3847 [V] |
| Tax categories | 2 (VAT Standard 18, VAT Zero 0) | SEED:2531-2534 [V] |

This is a toy menu. A Kampala bar-restaurant menu of several hundred lines (spirits by brand and measure) is not represented; reach and tap counts must not be modelled on it.

The CSV importer (`packages/db/prisma/demo-import.ts`) loads a second, larger dataset from `demo-data/csv`, which is **not in the snapshot** → its menu shape is UNKNOWN. [V]

---

## 4. Recipes

### Models

- **There is no `Recipe` model.** A recipe is the set of `RecipeIngredient` rows for a menu item. [V]
- `RecipeIngredient` (`S:1198-1227`): menuItemId, inventoryItemId, menuItemServingId (nullable), modifierOptionId (nullable), qtyPerUnit (10,3), wastePct (5,2), unit (free string), notes. [V]
- `InventoryItem` (`S:1163-1193`): sku, name (unique per branch), unit (free string), category (free string), theoreticalUnitCost (10,3), reorderLevel, reorderQty, isActive, metadata. [V]
- Three kinds of row: base (no serving, no modifier), serving-specific, modifier-linked (`S:1195-1197`). [V]

### Units of measure

| Question | Answer | Ref |
|---|---|---|
| Unit model or enum? | **No.** `unit` is a free string on both `InventoryItem` and `RecipeIngredient`. | `S:1169`, `S:1208` [V] |
| Conversions (kg ↔ g, case ↔ bottle, bottle ↔ tot)? | **None.** No conversion table, factor, or pack size anywhere in the schema. | search of schema [V] |
| Is the recipe unit checked against the stock unit? | **No.** `setRecipe` stores whatever string arrives. Cost = qty × unit cost regardless of unit. | `M/recipes/recipes.service.ts:206-220`, `:375-383` [V] |
| Piece vs weight vs volume | Only by convention in the text. Seed uses `pc` 7, `ml` 7, `g` 6, `leaf` 2, `slice` 2. | SEED:3468-3667 [V] |
| Waste percentage | Yes, per ingredient row: effective qty = qty × (1 + waste% / 100) | `S:1207`; `M/recipes/recipes.service.ts:380-381` [V] |
| Yield (a batch makes N portions) | **No.** | [V] |
| Sub-recipes / prepared items (a sauce made from ingredients, then used in dishes) | **No.** An ingredient can only be an `InventoryItem`. | `S:1203`, `:1216` [V] |
| Purchase unit vs stock unit vs recipe unit | **No.** One unit per item. | `S:1169` [V] |

### Endpoints and permissions

Note the route prefix is `/inventory`, served from the recipes module. [V]

| Endpoint | Permission | Roles | Ref |
|---|---|---|---|
| `POST /inventory/items` | `pos:recipe:write` | Own, Mgr, Sup | `M/recipes/recipes.controller.ts:21-22` [V] |
| `GET /inventory/items`, `/:id` | `pos:recipe:read` | Own, Mgr, Sup, Chf | `:35-36`, `:41-42` [V] |
| `PATCH /inventory/items/:id` | `pos:recipe:write` | Own, Mgr, Sup | `:47-48` [V] |
| `POST /inventory/recipes/:menuItemId` (replace whole recipe) | `pos:recipe:write` | Own, Mgr, Sup | `:64-65`; atomic delete-and-recreate `M/recipes/recipes.service.ts:201-227` [V] |
| `GET /inventory/recipes/:menuItemId` | `pos:recipe:read` | Own, Mgr, Sup, Chf | `:79-80` [V] |
| `GET /inventory/recipes/:menuItemId/cost` | `pos:cost:read` | Own, Mgr, Sup, Chf (Chef's figures masked unless `showCostToChef`) | `:85-86`; `recipes.service.ts:457-476`; `S:803` [V] |

Grants: `pos:recipe:read` SEED:704, 975, 1346, 1567; `pos:recipe:write` SEED:705, 976, 1347; `pos:cost:read` SEED:706, 977, 1348, 1568. [V]

- **The Stock Manager cannot create, edit or even list stock items**: the role holds only `pos:inventory:read/write/adjust` (SEED:1671-1679), and the item master is behind `pos:recipe:*`. [V]
- There is no list-all-recipes endpoint and no "items without a recipe" endpoint. [V]
- No recipe delete endpoint; send an empty `ingredients` array to clear. [V]
- **No web screen calls any of these** (no `/inventory` string in `WEB/`). [V]

### How a menu item links to a recipe; sold-as-is vs made

- Link: `RecipeIngredient.menuItemId` (`S:1202`). A menu item "has a recipe" if at least one row exists. [V]
- **There is no field that says "sold as is" versus "made from a recipe".** No flag on `MenuItem` (`S:957-998`), no direct `MenuItem → InventoryItem` link. [V]
- A bottle sold as is would have to be modelled as a one-row recipe (1 × bottle). Nothing in the code distinguishes the two cases. [V]
- A serving (tot, glass, bottle) can have its own ingredient rows (`menuItemServingId`), which is the hook for "a tot is 30 ml of the bottle" — but with no unit conversion, the stock item itself must be kept in ml. [V]

### Defects found in the costing logic

1. The order cost snapshot reads **base rows only** (`modifierOptionId: null, menuItemServingId: null`), so serving-specific recipe rows are ignored when an order line is costed (`M/orders/orders.service.ts:371-379`). A double and a single cost the same. [V]
2. The cost endpoint sums **every** row — base, every serving and every modifier — into one "total theoretical COGS" (`M/recipes/recipes.service.ts:342-350`, `:408-411`). For an item with serving-specific rows or modifier rows the total is overstated. [V]
3. `setRecipe` validates modifier option ids without a branch or item filter (`:185-191`). [V]

---

## 5. Inventory and stores

### What exists

| Thing | Model | Ref |
|---|---|---|
| Stock item | `InventoryItem` | `S:1163-1193` [V] |
| Stock on hand | Sum of `StockBatch.remainingQty` for the item in the branch (no stored balance) | `M/inventory/inventory.service.ts:110-118` [V] |
| Batch | `StockBatch`: receivedQty, remainingQty, unitCost (10,2), expiryDate, receivedAt, batchNumber, `goodsReceiptId` (plain string, no relation), metadata | `S:1233-1260` [V] |
| Movement | `StockAdjustment`: qtyDelta, reason (free text), userId. **No type field, no link to an order, a batch, a supplier or a count.** | `S:1264-1284` [V] |
| Supplier | `Supplier` (accounts-payable): name, code, counterpartyType, contact, taxId, payment terms, bank, currency (default "USD") | `S:4367-4400` [V] |
| Supplier bill | `VendorBill` + `VendorBillLine`; line has `itemId` as a plain string with no relation | `S:4460-4483` [V] |
| Transfer | `InterBranchTransfer` — **between branches**, one item or one category per transfer | `S:5552-5595` [V] |
| Buying advice | `ProcurementSuggestion` (generated by forecast) | `S:5341-5387` [V] |

### What does not exist

Searched the schema for `PurchaseOrder`, `GoodsReceipt`, `Requisition`, `StockCount`, `Stocktake`, `Warehouse`, `Storeroom`, `StockLocation`, `model Store`, `model Location`, `UnitOfMeasure`: **no model for any of them.** The only hit is the unlinked string `goodsReceiptId` (`S:1244`). [V]

| Wanted | Status |
|---|---|
| Store / location inside a branch (main store, secondary store, bar, kitchen) | **Missing.** `StockBatch` and `InventoryItem` are keyed by `branchId` only (`S:1166`, `S:1236`). A branch cannot have more than one store. No main / secondary notion. [V] |
| Stock level per location | **Missing** (per branch only). [V] |
| Movement types (receive, issue, transfer, sale, waste, count) | **Missing.** One untyped adjustment. Waste is inferred as "any negative adjustment" (`M/reports/reports.service.ts:1026-1032`). [V] |
| Purchase order | **Missing.** [V] |
| Goods received note | **Missing.** `POST /inventory/batches` creates a batch directly (`M/inventory/inventory.service.ts:30-78`). [V] |
| Transfer between stores | **Missing.** The branch-to-branch transfer is a status record that **does not move stock** — `updateTransferStatus` updates the transfer row only (`M/franchise/franchise.service.ts:667-712`). [V] |
| Requisition / issue to kitchen | **Missing.** [V] |
| Stock count / stocktake | **Missing.** `docs/MODULES.md` lists "Stock Counts / Wastage" as planned. [V] |
| Wastage document | **Missing** (a negative adjustment with a text reason). [V] |
| Supplier on a stock item or batch | **Missing.** No supplierId on `InventoryItem` or `StockBatch`. [V] |

### Endpoints, permissions, roles

| Endpoint | Permission | Roles | Ref |
|---|---|---|---|
| `GET /inventory/levels?category=` | `pos:inventory:read` | Own, Mgr, Sup, Csh, Chf, Wtr, Bar, Stk | `M/inventory/inventory.controller.ts:20-21` [V] |
| `POST /inventory/adjustments` | `pos:inventory:adjust` | Own, Mgr, Sup, Stk | `:29-30` [V] |
| `POST /inventory/batches` | `pos:inventory:write` | Own, Mgr, Sup, Stk | `:79-80` [V] |
| `GET /inventory/batches`, `/inventory/items/:id/batches` | `pos:inventory:read` | as levels | `:93-94`, `:100-101` [V] |
| `GET /dash/low-stock` | `pos:dash:today-summary:read` | Own, Mgr, Acc, Sup | `M/dashboards/dashboards.controller.ts:78` [V] |
| Reports: stock variance, wastage summary, low stock | `pos:reports:*:generate` | — | `M/reports/reports.service.ts:2264-2281` [V] |
| `POST/GET /franchise/transfers`, `PATCH .../status` | `franchise:transfer:write/read/approve` | **Nobody** — these keys are not in the seed | `M/franchise/franchise.controller.ts:97-125` [V] |

Grants: `pos:inventory:read` SEED:707, 978, 1349, 1494, 1569, 1588, 1653, 1676; `write` 708, 979, 1350, 1677; `adjust` 709, 980, 1351, 1678. [V]

- **Procurement role** holds four identity / tenancy keys and nothing else (SEED:1665-1670). It cannot see a supplier, a stock item or a bill. [V]
- Suppliers and vendor bills are behind `accounting:ap:*` → Own, Mgr, Acc only (key list SEED:601-642, spread into the three roles at SEED:954, 1232, 1330). [V]
- No user is seeded for Stock Manager, Procurement, Bartender or Event Manager (SEED:1833-1896). [V]

### State machines

| Document | States | Ref |
|---|---|---|
| Stock batch | None. `remainingQty` is decremented in place. | `M/inventory/inventory.service.ts:311-314` [V] |
| Stock adjustment | None. Insert only. Positive = new batch at **zero cost** (`:229-241`); negative = FIFO deduct, blocked if it would go below zero (`:201-226`). | [V] |
| Inter-branch transfer | REQUESTED → APPROVED / REJECTED / CANCELLED; APPROVED → IN_TRANSIT / CANCELLED; IN_TRANSIT → COMPLETED. No stock effect. | `M/franchise/franchise.service.ts:31-35` [V] |
| Procurement suggestion | PENDING + review (accept / reject) | `S:5203-5208`; `M/budget` [V] |
| Vendor bill | `VendorBillStatus` enum (`S:4305`); approve / pay in accounts-payable. No stock effect: the only stock link is the unlinked `itemId` string copied at `M/accounts-payable/accounts-payable.service.ts:408`. | [V] |

Other points:

- The FIFO deduct is not inside a database transaction and reads then writes each batch (`M/inventory/inventory.service.ts:287-325`): concurrent deductions can race. [V]
- A positive adjustment creates a zero-cost batch, which would drag any batch-based cost to zero. [V]

---

## 6. Does a sale deduct stock?

**No. Nothing that happens to an order changes stock.** [V]

### The trace

| Event | What the code does to inventory | Ref |
|---|---|---|
| Item added | Reads recipe rows and `theoreticalUnitCost` to write a cost snapshot on the line. **Writes nothing to stock.** | `M/orders/orders.service.ts:371-421`, `:503-518` [V] |
| Item quantity changed | Recomputes the same snapshot. No stock write. | `:577-601` [V] |
| Item deleted | Deletes the row. No stock write. | `:652-653` [V] |
| Sent | Status → SENT, table → OCCUPIED, KDS tickets created. No stock write. | `:704-712`, `:763-785` [V] |
| In kitchen / ready / served | Status change + audit only. | `:787-839` [V] |
| Closed with payment | Creates payments, sets CLOSED, audits, emits a payment event. No stock write. | `M/payments/payments.service.ts:223-298` [V] |
| Auto-settled | Sets CLOSED, audits, emits. No stock write. | `:97-129` [V] |
| Voided | Sets VOIDED, releases the table. No stock write, no return to stock. | `M/orders/orders.service.ts:859-910` [V] |
| Refunded / post-close void | Refund row, payment → REFUNDED, order → VOIDED. No stock write. | `M/refunds/refunds.service.ts:42-143`, `:231-300` [V] |
| Split / merge / move | Copies the cost snapshot between lines. No stock write. | `M/pos-handoff/pos-handoff.service.ts:476-478`, `:938-940` [V] |

### The proof

Every write to `stockBatch` or `stockAdjustment` in the API is in one file:

```
apps/api/src/modules/inventory/inventory.service.ts:46    stockBatch.create   (receive a batch)
apps/api/src/modules/inventory/inventory.service.ts:229   stockBatch.create   (positive manual adjustment)
apps/api/src/modules/inventory/inventory.service.ts:244   stockAdjustment.create
apps/api/src/modules/inventory/inventory.service.ts:311   stockBatch.update   (inside fifoDeduct)
```

and the only call of `fifoDeduct` outside its own definition and its unit test is the manual adjustment:

```ts
// apps/api/src/modules/inventory/inventory.service.ts:225-226
      // FIFO deduction for negative adjustments
      await this.fifoDeduct(ctx, dto.itemId, qtyDelta.abs());
```

The function's own comment states the intent that was never carried out:

```ts
// apps/api/src/modules/inventory/inventory.service.ts:277-280
   * Deducts a quantity from the oldest non-empty batches (FIFO order).
   * Batches are ordered by receivedAt ASC.
   * Used by stock adjustments and will be reused by order-close deduction in M10+.
```

A search of `orders`, `payments`, `refunds`, `quick-sale`, `pos-handoff` and `kds` for `inventory|stock|deduct` returns only two comments in pos-handoff. [V]

### What exists that could do it

| Piece | State | Ref |
|---|---|---|
| `InventoryService.fifoDeduct(ctx, itemId, qty)` | Written, unit-tested, **exported** from its module | `M/inventory/inventory.service.ts:287-325`; `M/inventory/inventory.module.ts:11` [V] |
| Who imports `InventoryModule` | Only the root app module. No other module injects `InventoryService`. | `apps/api/src/app.module.ts:72` [V] |
| Recipe rows per menu item, per serving, per modifier | Exist and are read at order time for cost | `M/orders/orders.service.ts:371-411` [V] |
| An event to hang a listener on | `EventEmitter2` emits only `kds.update` and `payment.update`; both are consumed only by SSE controllers. **There is no `@OnEvent` listener anywhere in the API.** | `M/kds/kds.service.ts:497`; `M/payments/payments.service.ts:144` [V] |
| A queue or scheduler | None. No `@Cron`, `@Interval`, BullMQ processor in `apps/api/src`. | [V] |
| A place to record which batches a sale consumed | None. `StockAdjustment` has no order link and no type. | `S:1264-1284` [V] |
| Item-level "sent" marker to deduct once per item | None on `OrderItem`. | `S:1372-1398` [V] |

Docs agree this was deferred: `docs/ARCHITECTURE.md:371` ("does NOT implement: Live inventory deduction on order") and `:440` ("Excluded: … stock deduction on order (M13)"). M13 shipped as payments; the deduction was never built. [V]

### Quick-sale engine

Same answer. `POST /pos/quick-sale` creates a CLOSED takeaway order, its lines and one COMPLETED payment in one transaction (`M/quick-sale/quick-sale.service.ts:357-431`). The file contains no reference to inventory, stock, recipe or KDS. Its lines are written **without** a cost snapshot (`:391-397` — no `costUnit` / `costTotal`) and with tax 0 (`:374`). [V]

---

## 7. Costing

### Where cost comes from

| Source | What it is | Ref |
|---|---|---|
| `InventoryItem.theoreticalUnitCost` | One hand-typed number per stock item (10,3). **The only cost the system uses.** | `S:1171` [V] |
| `StockBatch.unitCost` | Actual cost per received batch. Stored, listed, **never read by any costing, report or ledger code.** | `S:1241`; written `M/inventory/inventory.service.ts:54` [V] |
| `RecipeIngredient` | Carries no cost. Cost = qty × (1 + waste%) × the item's theoretical cost. | `S:1198-1227` [V] |
| `OrderItem.costUnit / costTotal / marginTotal / marginPct` | Snapshot at the moment the line is added or changed. Null when the item has no base recipe rows. | `S:1382-1385`; `M/orders/orders.service.ts:381-421` [V] |
| Menu item cost field | **None.** A menu item cannot be given a cost directly. | `S:957-998` [V] |
| Last / average / standard cost | **None computed.** The only costing basis is "theoretical", typed in. FIFO exists for quantity only. | [V] |

`README.md:200` says costing "uses genuine FIFO"; the code never uses batch cost for anything. [V]

### Who can set a cost

- `theoreticalUnitCost`: `POST` / `PATCH /inventory/items` → `pos:recipe:write` → **Own, Mgr, Sup** (`M/recipes/recipes.controller.ts:21-22`, `:47-48`). [V]
- Batch `unitCost`: `POST /inventory/batches` → `pos:inventory:write` → Own, Mgr, Sup, Stk. [V]
- Receiving a batch does **not** update the item's theoretical cost (`M/inventory/inventory.service.ts:30-78`). [V]
- Changing a cost does not re-cost existing order lines (snapshot). [V]

### How cost of goods is reported today

| Consumer | Uses cost? | Ref |
|---|---|---|
| Recipe cost endpoint (per item) | Theoretical cost, margin, margin % | `M/recipes/recipes.service.ts:407-429` [V] |
| `franchise-analytics` (consolidated finance, drilldown, waste benchmark) | **The only reader of `order_item.cost_total`** — and all its routes sit behind `franchise:*` keys that are not seeded, so they return 403 to every role | `M/franchise-analytics/franchise-analytics.service.ts:173`, `:196-207`, `:702-713` [V] |
| Wastage report | Negative adjustments × theoretical cost | `M/reports/reports.service.ts:1058-1062` [V] |
| Stock variance report | Sums adjustments; no cost | `:973-994` [V] |
| Forecast | Reads theoretical cost for buying advice | `M/budget/forecast.service.ts:375` [V] |
| Sales reports (daily sales, top items, by category) | **No cost, no margin.** The 24 report cases contain no COGS or margin report. | `M/reports/reports.service.ts:2148-2354` [V] |
| Dashboards | No cost | no cost fields in `M/dashboards` [V] |
| Ledger / accounting | **Do not read cost.** No reference to `costTotal`, `costUnit`, `theoreticalUnitCost` or `unitCost` in `M/ledger`, `M/accounting`, `M/accounts-payable`, `M/accounts-receivable`, `M/bank-rec`. | [V] |
| Ledger posting sources | Six keys seeded: ORDER_REVENUE, PAYMENT_RECEIVED, REFUND_ISSUED, INVENTORY_PURCHASE, PAYROLL_EXPENSE, DEPOSIT_COLLECTED. **No COGS source.** Posting is triggered by a manual replay call (`POST /accounting/posting/replay`), not by an order closing; no POS module imports the ledger service. | SEED:7027-7032; `M/ledger/ledger.controller.ts:88-89` [V] |

So "true cost of goods" is not produced anywhere a user can reach. The snapshot is written and then read by no reachable code.

### What an Accountant can and cannot do to costs

Accountant grants: SEED:1234-1331 (113 keys). [V]

| Can | Cannot |
|---|---|
| Read discounts, payments, refunds, shifts, tills (SEED:1240-1244) | Read the menu (`pos:menu:read` absent) |
| Full accounting, AP, AR, bank, budget (spread at SEED:1330) | Read recipes or ingredients (`pos:recipe:read` absent) |
| Read `/dash/low-stock` (`pos:dash:today-summary:read`) | Read a recipe cost (`pos:cost:read` absent) |
| Create suppliers and vendor bills | Read stock levels or batches (`pos:inventory:read` absent) |
| Post journals | Set an ingredient cost (`pos:recipe:write` absent) |
| | Set a cost on a menu item — no such field or endpoint exists for any role |

The seed's own cost figures are not UGX-scale: Beef Burger sells for 40 000 (SEED:2604) while its bun costs 0.500 and patty 3.500 (SEED:3473, 3482). A demo margin would read about 99.99%. The seeded branches also carry currency "USD" (SEED:1958-1967) while `OrgSettings.currency` is "UGX" (SEED:2214). [V]

---

## 8. Kitchen (KDS)

### Models

| Model | Fields | Ref |
|---|---|---|
| `KdsTicket` | orderId, station (**free string**), status, startedAt, readyAt, recalledAt, metadata | `S:1416-1443` [V] |
| `KdsTicketItem` | ticketId, orderItemId. No quantity, no status. | `S:1445-1457` [V] |
| `KdsSlaConfig` | per branch + station: green / amber / red seconds | `S:1459-1477` [V] |
| `KdsTicketStatus` | QUEUED, READY, RECALLED | `S:1402-1406` [V] |
| `KdsUrgencyState` | GREEN, AMBER, RED (computed from age) | `S:1408-1412` [V] |
| `Device` (type KDS_SCREEN, optional station) | Registry row only | `S:7168-7190` [V] |

**There is no Station model.** Routing is the enum `MenuItem.station` (KITCHEN, BAR, COLD_KITCHEN, DESSERT, NONE — `S:903-909`), copied as text onto the ticket. A restaurant cannot add a station (e.g. "Grill", "Pizza", "Shisha") without a schema change. Nothing ties a user or a screen to a station; `station` is a query parameter. [V]

### What creates a ticket, and what does not

- **Creates:** `sendOrder` only (`M/orders/orders.service.ts:782`). One ticket per station present on the order; items with station NONE are skipped (`M/kds/kds.service.ts:84-91`, `:95-121`). [V]
- The call is fire-and-forget with errors swallowed: `void this.kdsService.createTicketsForOrder(...).catch(() => undefined)` (`M/orders/orders.service.ts:782`). If ticket creation fails, the waiter sees success and the kitchen sees nothing. [V]
- **Does not create:**
  - Items added after the first send. The order must be exactly `SENT` (`M/kds/kds.service.ts:72-74`) and if any ticket already exists the function returns it unchanged (`:77-82`). There is no second send (`NEW → SENT` is the only way in — `M/orders/orders.service.ts:44`). **A second round of drinks never reaches the bar.** [V]
  - A split-off child order (`docs/KNOWN_LIMITATIONS.md:266`, LIM-009). [V]
  - Quick sale (no KDS reference in `M/quick-sale`). [V]
  - Item changes or deletions after send (no ticket update in `orders.service.ts`). [V]

### States, bump, recall

| Action | Endpoint | Effect | Ref |
|---|---|---|---|
| Queue | `GET /kds/queue?station=&status=&page=&pageSize=` (default 50, oldest first) | Tickets + items + table label + order notes + urgency | `M/kds/kds.controller.ts:31-34`; `M/kds/kds.service.ts:159-200` [V] |
| Bump | `POST /kds/tickets/:id/mark-ready` | QUEUED or RECALLED → READY, stamps readyAt | `:70-73`; service `:282-298` [V] |
| Recall | `POST /kds/tickets/:id/recall` | READY → RECALLED only | `:86-89`; service `:338-351` [V] |
| SLA read / write | `GET` / `PATCH /kds/sla-config/:station` | Default 300 / 600 / 900 s | `:42-54`; service `:26` [V] |

- **Whole ticket only.** No per-item bump, no "started" state, no "served / cleared" state, no priority, no hold or fire. [V]
- **Bumping a ticket does not change the order.** `kds.service.ts` has no `order.update`. `Order.status` moves only through `/in-kitchen`, `/ready`, `/mark-served` (`M/orders/orders.controller.ts:139-175`), which need `pos:orders:write`. [V]
- READY tickets are never removed from the queue; the list has no "active only" default. [V]

### Stream

`GET /stream/kds?station=` — Server-Sent Events of NEW_TICKET, TICKET_READY, TICKET_RECALLED, filtered by branch and optional station. Guards: JWT + branch context, **no permission key** (`M/kds/kds.controller.ts:104-122`). It is an in-process event bus (`M/kds/kds.module.ts:7`), so it works on one API instance only. It needs an `Authorization` header and `X-Branch-Id`, which the browser `EventSource` cannot send (noted in `WEB/lib/manager/dashboard-api.ts:19-22`). **No web code consumes it** (no `/kds` string in `WEB/`). [V]

### What the Chef and Bartender can do in the API today

| | Chef (SEED:1560-1580, 19 keys) | Bartender (SEED:1646-1664, 17 keys) |
|---|---|---|
| See the queue, bump, recall | Y | Y |
| Read orders, tables, floor, menu | Y | Y |
| Read recipes | Y | **N** |
| Read recipe cost | Y (masked unless `showCostToChef`) | N |
| Read stock levels and batches | Y | Y |
| Move an order to in-kitchen / ready / served | **N** | **N** |
| Create an order (bar tab) or add an item | N | **N** |
| Adjust stock, record waste, receive stock, request stock | N | N |
| Mark an item unavailable (86) | N (`pos:menu:write` absent) | N |
| Be told about anything | Only by holding the SSE stream open | same |

- No Bartender user is seeded (SEED:1833-1896). [V]
- A Chef user exists (`chef@demo.local`, SEED:1881) and there is **no Chef workspace in the web app** (`WEB/pages` has only cashier, manager, supervisor, waiter). [V]
- `pos:kds:write` is also held by Waiter and Cashier (SEED:1592, 1498), so a waiter can bump kitchen tickets. [V]

---

## 9. Bills and receipts

There is no `Receipt` or `Bill` model: "a closed Order with its captured Payment[] IS the receipt" (`M/receipts/receipts.service.ts:54-55`). [V]

| Endpoint | Permission | Behaviour | Ref |
|---|---|---|---|
| `GET /receipts/:id` (id = order id) | `pos:receipt:read` | Returns a JSON view for an order in **any** status (no status check). Logs RECEIPT_VIEWED. | `M/receipts/receipts.controller.ts:39-40`; service `:80-105`, `:301-311` [V] |
| `GET /receipts/:id/history` | `pos:receipt:read` | Audit rows for view / reprint / send / close | `:55-56` [V] |
| `POST /receipts/:id/reprint` | `pos:receipt:reprint` | **Only CLOSED or VOIDED.** Writes an audit row with copies and reason; returns `printable: <the same JSON>`. Sends nothing to a printer. | `:67-69`; service `:111-153`, `:286-288` [V] |
| `POST /receipts/:id/send` | `pos:receipt:send` | Only CLOSED or VOIDED. Records a request; always returns `supported: false`, reason `NO_LIVE_DELIVERY_ADAPTER`. | `:100-102`; service `:160-223` [V] |

### What it renders

A JSON object: order number, status, organisation, branch (name, code, currency, timezone), table label, server name, totals (subtotal, tax, discount, total, paid, outstanding), lines (name, sku, serving label, qty, unit price, line total, notes), payments, footer text, counters (`M/receipts/receipts.service.ts:371-435`). [V]

- **No text, HTML, PDF or ESC/POS output.** Layout is entirely the client's job. [V]
- Modifiers chosen on a line are not in the view (lines map at `:406-416`). [V]
- Tax always prints 0.00 (see §2). No TIN, no EFRIS fields in the view, though `TaxCategory.efirsTaxCode` exists (`S:941`). [V]
- Currency falls back to "USD" (`:404`). [V]

### Pro-forma / bill before payment

- No distinct pro-forma. The same `GET /receipts/:id` works on an open order and shows `outstanding`. [V]
- `POST /pos/orders/:id/request-bill` writes one audit row and returns; it sets no flag on the order or table (`M/orders/orders.service.ts:915-956`). Its comment says the cashier "picks it up via the audit timeline", but `audit:read` is held by Owner and Manager only (SEED:930, 1206). **Nothing tells the cashier a bill was asked for.** [V]
- No count of how many times a bill was printed before payment (reprint is refused on open orders). [V]

### Printers and devices

- `Device` (POS_TERMINAL, KDS_SCREEN, PRINTER, PAYMENT_TERMINAL_STUB) and `PrinterRoute` (RECEIPT, KITCHEN, BAR; optional station; priority) exist (`S:7143-7212`). The schema comment says hardware integration is out of scope (`S:7163-7166`). [V]
- Managed by `M/device-registry` (10 endpoints; writes Own, Mgr; reads Own, Mgr, Csh, Wtr). [V]
- **Nothing reads `PrinterRoute` or `Device` outside the registry module** — receipts, KDS and orders never look up a printer. [V]

### Permissions per role

`pos:receipt:read / reprint / send`: **Own, Mgr, Csh, Wtr** (SEED:932-934, 1208-1210, 1549-1551, 1638-1640). Supervisor, Accountant, Chef, Bartender: none. [V]

### Can a Waiter get a bill for an open order?

**Yes at the API, as JSON:** `GET /api/receipts/<orderId>` with `pos:receipt:read` returns the view for an open order. Two caveats: the receipts service does not apply the waiter ownership rule, so a waiter can read **any** order's bill in the branch (no ownership call in `M/receipts/receipts.service.ts`); and "reprint" is refused until the order is CLOSED. Whether the waiter screen offers it is the front-end audit's question (`WEB/lib/waiter/receipt-api.ts:161` calls the endpoint). [V]

---

## 10. Notifications

| Mechanism | What it is | Who can use it | What consumes it | Ref |
|---|---|---|---|---|
| `GET /stream/kds` (SSE) | New / ready / recalled tickets | Any member of the branch | **Nothing in the web app** | `M/kds/kds.controller.ts:104-122` [V] |
| `GET /stream/payments` (SSE) | Balance updated, order auto-settled | Any member of the branch | **Nothing in the web app** | `M/payments/payments.controller.ts:222` [V] |
| `GET /stream/metrics` (SSE) | Dashboard KPIs on an interval | Any member of the branch | Not consumed; the dashboard polls instead | `M/dashboards/dashboards.controller.ts:125-132`; `WEB/lib/manager/dashboard-api.ts:19-22` [V] |
| Alerts module | Rules (LOW_STOCK, CASH_VARIANCE, SHIFT_NOT_CLOSED, LARGE_WASTAGE_SPIKE …), channels (EMAIL, SMS, SLACK), deliveries, digests | Own, Mgr (read also Acc) | Dispatch is a **mock that logs a line** unless SMTP / SMS env vars are set, and even then no provider call is made. Evaluated only by `POST /alerts/test` and `POST /alerts/digests/:id/run` — there is no scheduler. No web screen. | `S:6409-6462`; `M/alerts/channel-dispatcher.service.ts:91-161`; `M/alerts/digest.service.ts:168`, `:238-239` [V] |
| Owner live feed | `GET /owner/live` | Owner only | No web screen | `M/alerts/alerts.controller.ts:192` [V] |
| Unified approvals inbox | `GET /approvals`, `POST /approvals/:id/decide` over discounts, refunds, AP bills, leave, transfers | Own, Mgr only (SEED:928-929, 1204-1205) | Supervisor screens use the per-domain endpoints instead | `M/unified-approvals/unified-approvals.controller.ts:32-74` [V] |
| Pending discounts | `GET /pos/discounts/pending` (poll) | Own, Mgr, Sup | Web (supervisor) | `M/discounts/discounts.controller.ts:88` [V] |
| Audit log | Every write logs a row; `GET /audit/timeline` | Own, Mgr | Manager accounting audit screen | `M/audit-timeline/audit-timeline.controller.ts:18` [V] |
| Anomaly events | Heavy discount, refund over threshold etc. flagged for review | Sup, Mgr, Own | Supervisor approvals | `M/discounts/discounts.service.ts:110`; `M/refunds/refunds.service.ts:117` [V] |

**What does not exist:** a `Notification` model, a per-user inbox, push, WebSocket, in-app toast feed, "your food is ready" to the waiter, "bill requested" to the cashier, "stock issued to you" to the chef, "low stock" to the store manager. There is no model or endpoint for a stock issue, so the chef-picks-meat notification has nothing to attach to. [V]

No background jobs exist (`@Cron`, `@Interval`, BullMQ: zero in `apps/api/src`), so nothing can fire on a timer. [V]

---

## 11. Permission system facts

| Question | Answer | Ref |
|---|---|---|
| How do permissions reach the client? | **Both.** They are a claim inside the access token (`{ sub, email, jti, roles, permissions }`) and are returned by `GET /auth/me` together with roles and memberships. | `M/auth/auth.service.ts:673`; `M/auth/auth.controller.ts:74`; `auth.service.ts:536-554` [V] |
| When does a change take effect? | On the next token. The guard reads the claim and only falls back to the database if the claim is empty. | `M/auth/jwt.strategy.ts:74-112` [V] |
| Are they per branch? | **No.** They are the union of all the user's `UserRole` rows. `UserRole.orgId / branchId` exist but are nullable and unused for checks. | `auth.service.ts:697-703`; `S:347-352` [V] |
| What is per branch? | **Membership** — whether the user may act in the branch at all (`X-Branch-Id` header → active membership). `Membership.roleId` is carried in the request context but used only to mask recipe cost for chefs. | `apps/api/src/common/guards/branch-context.guard.ts:55`, `:97`, `:117`; `M/recipes/recipes.service.ts:457-476` [V] |
| How is a permission checked? | Exact string match; all listed keys must be held. No wildcards, no hierarchy, no role-level shortcut (Owner gets nothing implicitly). | `apps/api/src/common/guards/permission.guard.ts:24-29` [V] |
| How many keys exist? | **278** seeded. | SEED:132-557 [V] |
| Held by no role | **2**: `pos:feedback:public:token:read` (SEED:316) and `hms:read:*` (SEED:485, granted to API keys at runtime). | [V] |
| Seeded but used by no endpoint | **13**, including `pos:payment:create`, `pos:payment:close`, `pos:payment:override`, `identity:session:read`, `identity:session:revoke`, `tenancy:branch:read`. | computed [V] |
| Used by an endpoint but not seeded | **35 keys guarding 64 endpoints** — `franchise:*` (13), `ops:*` (8), `dev:*` (5), `merchant:*` (4), `billing:*` (3), `support:*` (2). Those endpoints return 403 to every role including Owner. By module: billing 14, ops-portal 14, franchise 12, franchise-analytics 9, public-commerce 8, merchant-payments 5, billing-pesapal 2. | computed [V] |
| Keys per role | Own 276 · Mgr 260 · Sup 133 · Acc 113 · Csh 63 · Wtr 51 · Chf 19 · Bar 17 · Evt 17 · Stk 7 · Pro 4 | SEED:682-1700 [V] |
| Can roles or grants be edited at runtime? | **No endpoint.** `identity:access-matrix:write` is seeded and used by no route. Roles are global rows, not per organisation (`Role.name` unique — `S:301`). Changing who may create tables means editing `seed.ts` and re-seeding; the seed only inserts, removals need an entry in the revoke table. | SEED:1702-1766, 1768-1787 [V] |
| An endpoint that says "what can this user do to this order"? | **None.** No capability or allowed-actions field on any order or table response (searched for `allowedActions`, `availableActions`, `capabilit`, `canVoid`). The client must combine the permission list with the order status and re-implement the service rules. | [V] |
| Finer than order level? | No. One key (`pos:orders:write`) covers create, add, change, **delete item**, send, in-kitchen, ready, served and request-bill. | `M/orders/orders.controller.ts:36-194` [V] |

**For "each role sees its own actions on the same table":** the raw material is there (a permission list in `/auth/me`), but three things are missing — a server-side statement of allowed actions per order, an item-level void permission, and any way for the owner to switch a permission on or off for a role without a developer.

---

## 12. Module inventory (all 53)

Lines = non-test TypeScript in the module folder (DTOs included). "Web" = literal route-prefix hits in `apps/web/src`. "Unseeded" = permission keys the module's guards need that have no seed row.

Verdicts: **CORE** = the table-to-payment loop and what the owner listed. **SUPPORT** = needed soon, or core modules depend on it. **PARKED** = keep, not on the path now. **JUNK-CANDIDATE** = dead, duplicate, unseeded permissions, or outside a restaurant POS. The verdict is this audit's reading; removal is the owner's call.

| Module | What it is | Lines | Endpoints | Web calls it | Unseeded | Verdict |
|---|---|---|---|---|---|---|
| auth | Login (password, PIN, quick PIN), sessions, JWT claims, invitations, password lifecycle | 2735 | 17 | yes (11) | 0 | CORE |
| tenancy | Organisations, branches, memberships | 688 | 10 | no | 0 | CORE |
| settings | OrgSettings: currency, VAT %, tax matrix, rounding, thresholds, exchange rates | 789 | 14 | yes (15) | 0 | CORE |
| floor | Floor plans, tables, table status, availability | 589 | 10 | yes (12, reads + status patch) | 0 | CORE |
| menu | Categories, tax categories, items, servings, browse groups, modifiers, catalog, navigation | 2549 | 34 | yes (6, reads only) | 0 | CORE |
| recipes | Stock item master, recipe ingredients, theoretical cost | 765 | 7 | **no** | 0 | CORE |
| inventory | Stock batches (FIFO), levels, manual adjustments | 537 | 5 | **no** | 0 | CORE |
| orders | Order and item CRUD, state machine, request bill, void | 1380 | 12 | yes (47, shared prefix) | 0 | CORE |
| kds | Tickets per station, queue, bump, recall, SLA, SSE | 701 | 6 | **no** | 0 | CORE |
| discounts | Request / approve / reject | 633 | 6 | yes | 0 | CORE |
| payments | Close with payment, MoMo intents, manual reference, webhooks, SSE | 1626 | 12 | yes | 0 | CORE |
| refunds | Refund create / approve, post-close void | 512 | 5 | yes | 0 | CORE |
| receipts | Receipt JSON view, history, reprint (audit only), send (no adapter) | 668 | 4 | yes (8) | 0 | CORE |
| shifts | Shift open / close, close summary | 488 | 5 | yes (17) | 0 | CORE |
| tills | Till open, safe drop, reconcile | 671 | 6 | yes (13) | 0 | CORE |
| pos-handoff | Split bill, split items, merge, transfer table / server, move items | 1526 | 6 | yes | 0 | CORE |
| device-registry | Registry of terminals, KDS screens, printers, printer routes (config only) | 1283 | 10 | yes (4) | 0 | SUPPORT |
| reservations | Reservations, deposits, seating bridge | 1432 | 13 | yes (25) | 0 | SUPPORT |
| reports | 24 report generators, catalog, CSV export | 3472 | 29 | yes (14) | 0 | SUPPORT |
| dashboards | Owner / manager dashboards, KPI snapshots, low stock, metrics SSE | 851 | 9 | yes (13) | 0 | SUPPORT |
| audit-timeline | Branch-scoped read of the audit log | 297 | 1 | yes (1) | 0 | SUPPORT |
| unified-approvals | Inbox over discount / refund / AP / leave / transfer (imports franchise) | 1149 | 3 | yes (2) | 0 | SUPPORT |
| analytics | Anomaly rules and events, staff risk | 1236 | 13 | yes (12) | 0 | SUPPORT |
| bg3-reliability | Idempotency / maintenance / training wrapper used by 13 modules | 283 | 0 | no | 0 | SUPPORT |
| reliability | Idempotency keys, sync jobs, conflicts (bg3 depends on it) | 1151 | 7 | no | 0 | SUPPORT |
| controlplane | Feature flags, maintenance windows, training sessions (inventory and bg3 depend on it) | 1267 | 12 | no | 0 | SUPPORT |
| hr | Employees, contracts, positions, compensation, frontline staff onboarding | 2386 | 17 | yes (14) | 0 | SUPPORT |
| client-onboarding | Onboarding wizard, staff invitations (imports billing) | 865 | 9 | yes (4) | 0 | SUPPORT |
| accounting | Chart of accounts, cost centres, fiscal periods, posting source maps, tax config | 777 | 11 | yes (13) | 0 | SUPPORT |
| ledger | Journals, posting runs, posting errors | 1148 | 10 | yes (8) | 0 | SUPPORT |
| accounts-payable | Suppliers, vendor bills, payments, credit notes, recurring, reminders | 2600 | 19 | yes (8) | 0 | SUPPORT |
| accounts-receivable | Customer accounts, invoices, receipts, credit notes, aging | 1615 | 10 | yes (8) | 0 | PARKED |
| bank-rec | Bank accounts, statements, reconciliation, period close | 1321 | 15 | yes (15) | 0 | PARKED |
| budget | Budgets, demand calendar, forecast, procurement suggestions | 1994 | 12 | yes (11) | 0 | PARKED |
| attendance | Clock in / out, leave, shift swaps | 1198 | 11 | yes (33) | 0 | PARKED |
| quick-sale | Event till: one-call closed takeaway sale by SKU (tills imports it) | 788 | 1 | no | 0 | PARKED |
| events | Events, ticket classes, bookings, tickets, check-in | 1568 | 17 | no | 0 | PARKED |
| feedback | Guest feedback, NPS, QR requests | 905 | 12 | no | 0 | PARKED |
| documents | Uploads, links, storage config | 774 | 10 | no | 0 | PARKED |
| workforce | Shift templates, schedules, roster, coverage rules | 983 | 11 | no | 0 | PARKED |
| payroll | Pay components, runs, payslips | 991 | 13 | no | 0 | PARKED |
| staff-insights | Staff scores, awards, promotion suggestions | 985 | 10 | no | 0 | PARKED |
| alerts | Alert rules, channels (mock dispatch), deliveries, digests, owner live feed | 1704 | 15 | no | 0 | PARKED |
| exports | Facade over the reports export and documents (duplicates `/reports/export`) | 573 | 4 | no | 0 | JUNK-CANDIDATE |
| billing | SaaS plans, subscriptions, API keys, webhooks, support sessions (**tenancy and client-onboarding import it**) | 1217 | 14 | no | 9/9 | JUNK-CANDIDATE |
| billing-pesapal | Pesapal checkout for the SaaS subscription | 501 | 4 | no | 1/1 | JUNK-CANDIDATE |
| ops-portal | Vendor-side portal: customers, subscriptions, plans, support | 698 | 14 | no | 8/8 | JUNK-CANDIDATE |
| franchise | Multi-branch overview, rankings, inter-branch transfers, HQ digests (**unified-approvals imports it**) | 1356 | 12 | no | 8/8 | JUNK-CANDIDATE |
| franchise-analytics | Consolidated finance, scorecards, waste benchmarks (only reader of `OrderItem.costTotal`) | 1897 | 9 | no | 5/5 | JUNK-CANDIDATE |
| merchant-payments | Merchant payment config for public commerce | 404 | 5 | no | 2/2 | JUNK-CANDIDATE |
| public-commerce | Public restaurant / event pages, holds, merchant profile | 1049 | 19 | no | 2/2 | JUNK-CANDIDATE |
| public-commerce-payments | Public payment callback / IPN for holds | 235 | 5 | no | 0 | JUNK-CANDIDATE |
| hms-integration | Read-only API-key feed for a hotel system | 898 | 18 | no | 0 | JUNK-CANDIDATE |

### Totals

| Verdict | Modules | Lines | Share |
|---|---|---|---|
| CORE | 16 | 16 857 | 28% |
| SUPPORT | 15 | 20 197 | 33% |
| PARKED | 12 | 14 826 | 24% |
| JUNK-CANDIDATE | 10 | 8 828 | 15% |
| **All** | **53** | **60 708** | |

Three CORE modules have no web caller at all: **recipes, inventory, kds** (2 003 lines). Add menu writes, table writes and KDS-driven order states and the picture is: the back end for the owner's new list is partly present, and its screens are entirely absent.

Removal is not free for the junk candidates: `billing` is imported by `tenancy` and `client-onboarding`; `franchise` by `unified-approvals`; `reliability` and `controlplane` by `bg3-reliability`, which wraps 13 modules (import scan of `M/*`). [V]

---

## 13. Junk and risk

### Dead code and broken links in the core loop

| Item | Fact | Ref |
|---|---|---|
| `OrdersService.closeOrder()` | No caller anywhere. It is the only path to the table-release and reservation-complete logic in `transitionOrder`. | `M/orders/orders.service.ts:841-857`, `:713-742`; `M/orders/orders.controller.ts:208` [V] |
| `InventoryService.fifoDeduct` | Never called for a sale (§6). | [V] |
| `InventoryService.getOldestNonEmptyBatch` | Called only by its unit test. | `M/inventory/inventory.service.ts:331` [V] |
| `StockBatch.unitCost`, `StockBatch.goodsReceiptId` | Written, never read by logic; the receipt id points at no model. | `S:1241`, `:1244` [V] |
| `MenuItem.brand` | No writer in the code base. | `S:967` [V] |
| `OrderItem.cost*` / `margin*` | Read only by a module no role can reach. | §7 [V] |
| `Order.tax`, `TaxCategory.rate`, `OrgSettings.taxMatrix` | Stored, never applied to an order. | §2 [V] |
| `PrinterRoute`, `Device` | Read by nothing outside their registry. | §9 [V] |
| `TableStatus.RESERVED`, `CLEANING` | Never set by any workflow. | §1 [V] |
| Order-number generators | Two: `OrdersService.generateOrderNumber` reads the latest order by `createdAt` with no lock (`M/orders/orders.service.ts:67-81`, the comment claims "concurrency-safe"); quick-sale uses a separate `allocateOrderNumber` (`M/orders/order-number.ts`, used at `M/quick-sale/quick-sale.service.ts:364`). Two concurrent creates can collide on `@@unique([branchId, orderNumber])` (`S:1356`). | [V] |
| KDS ticket creation | Errors swallowed. | `M/orders/orders.service.ts:782` [V] |
| Auto-settle | Can close an order from NEW (state machine bypass), including on a webhook. | `M/payments/payments.service.ts:97-105` [V] |
| Manual-reference payment | Refused only on VOIDED orders — a CLOSED order still accepts a payment. | `M/payments/payments.service.ts:785-787` [V] |
| FIFO deduct | Not transactional. | `M/inventory/inventory.service.ts:287-325` [V] |
| Positive adjustment | Creates a zero-cost batch. | `:229-241` [V] |

### Duplicates

- Two menu taxonomies on every item (Category and browse group / subgroup) — `S:961-964`. [V]
- Two close mechanisms (close-with-payment and auto-settle) with different preconditions — `M/payments/payments.service.ts:149-307` vs `:91-141`. [V]
- Two export surfaces (`/reports/export` and `/exports`) — `M/exports` imports `reports`. [V]
- Two reliability layers (`reliability` and `bg3-reliability`) plus `controlplane` maintenance checks called a second time inside the inventory service (`M/inventory/inventory.controller.ts:47-52`). [V]
- Two approval surfaces (`unified-approvals` and per-domain endpoints). [V]
- Route prefix `/inventory` is split across two modules (`recipes` and `inventory`). [V]
- Two `/franchise/rankings` prefixes in two modules (`franchise`, `franchise-analytics`). [V]

### Permission hygiene

- 35 guard keys with no seed row → 64 unreachable endpoints (§11). [V]
- 13 seeded keys used by no endpoint (§11). [V]
- 3 SSE endpoints and both payment webhooks carry no permission key (`M/kds/kds.controller.ts:104`; `M/payments/payments.controller.ts:202`, `:212`, `:222`; `M/dashboards/dashboards.controller.ts:130`). [V]
- `GET /orgs`, `/orgs/:orgId`, `/branches`, `/branches/:branchId`, `/me`, `/branch-test` carry no permission key (`M/tenancy/tenancy.controller.ts:28-108`). `/branch-test` and `/auth/_perm-test` (`M/auth/auth.controller.ts:91`) are developer test routes. [V]
- The seed only inserts grants; a removed line in the matrix stays granted in an existing database unless added to the revoke table (SEED:1754-1766). [V]

### TODO / FIXME

3 in `apps/api/src` (e.g. `M/budget/forecast.service.ts:646`), 0 in `apps/web/src`, 0 in the seed. The low count is not a quality signal: deferred work is recorded in prose comments and in `ai/` reports instead. [V]

### Schema models

- 163 models, 171 enums (`S:` model and enum lines). [V]
- The brief's premise that many models are referenced by no module does not hold: only **10 of 163** have no direct Prisma query in the API, and most of those are written through nested creates. Truly unreferenced in API code: `AppConfig` (`S:121`), `SeedHistory` (`S:132`), `KpiSubscription` (`S:2634`), `NpsSummary` (`S:2910`), `BranchBudgetRollup` (`S:5521`). [V]
- The real issue is the reverse: models are used by modules that no screen and, for some, no role can reach.
- One hand-written migration deliberately left known schema drift unapplied (recorded in `CLAUDE.md`, batch 4 entry). Whether the migrations folder and the schema agree today is UNKNOWN (cannot run `prisma migrate diff`).

### Root-level clutter

| Item | Size | Note |
|---|---|---|
| `CLAUDE.md` | 188 KB | A running log of every milestone, loaded into every agent session |
| `CODEX.md` | 123 KB | Parallel copy for another agent |
| `PROGRESS.md` | 117 KB | |
| `ROADMAP.md` | 89 KB | Superseded in part by `ai/ENTERPRISE_UI_ROADMAP.md` |
| `README.md` | 65 KB | Contains claims the code contradicts (below) |
| `ai/` | 4.7 MB, 215 files | Completion reports, QA evidence indexes, prompts |
| `docs/` | 1.6 MB | |
| `Front End/` | 436 KB | Legacy role design packs; `CLAUDE.md` §1 says not to use their palettes |
| `reports/` | 168 KB | Event-till evidence (H0, H1 …) |
| `apps/desktop`, `apps/mobile` | 2 files each | Empty placeholders (`package.json` + `.gitkeep`) |
| `apps/api/src/modules/.gitkeep` | | Placeholder comment from milestone 1 |
| `apps/web/scripts/` | 21 assertion scripts + 9 tsconfigs | Per-milestone static checks named after prompts |

`CLAUDE.md` names `postman/` (58 collections), `demo-data/` and `repo file tree.txt`; none is in the snapshot, and the governance block makes reading them mandatory. [V]

### Docs that contradict the code

| Doc says | Code says | Ref |
|---|---|---|
| `README.md:200` — costing "uses genuine FIFO" | Batch cost is never read; cost is one typed number per item | §7 [V] |
| `README.md:202` — `StockAdjustment` is an append-only ledger with movement types RECEIVING, DEDUCTION, WASTAGE, MANUAL, COUNT; "No row is ever mutated" | No type column (`S:1264-1284`); batches are mutated in place (`M/inventory/inventory.service.ts:311`) | [V] |
| `README.md:204` — `InventoryItem` carries `reorderPoint`, `parLevel`, `preferredSupplierId` | It carries `reorderLevel`, `reorderQty`, no supplier (`S:1172-1173`) | [V] |
| `docs/MODULES.md` — AP, AR, budgets, franchise, billing, alerts, reliability, flags are "⬜ Planned"; purchasing lives in `modules/purchasing/` | All eight exist as modules; `purchasing` does not exist | `docs/MODULES.md` rows for M32–M42 [V] |
| `CLAUDE.md` §1 — "Backend: 100% complete" | Stock deduction, tax, stores, units, purchase orders, counts, item void were never built | §§2, 4, 5, 6 [V] |
| `CLAUDE.md` §5 — "~65 migrations" | 61 migration folders | `packages/db/prisma/migrations` [V] |
| `M/orders/orders.service.ts:65` comment — order number is "concurrency-safe via DB" | Read-then-write with no lock | `:67-81` [V] |
| `M/orders/orders.service.ts:709` comment — "auto-release on CLOSED" | Unreachable | §1 [V] |
| `M/orders/orders.controller.ts:190-191` — the cashier "picks it up via the audit timeline" | Cashier cannot read the audit timeline | §9 [V] |

---

## 14. Test and seed state

### Tests present

| Suite | Count | Ref |
|---|---|---|
| API unit specs (`*.spec.ts`) | 70 files | `apps/api/src` [V] |
| API e2e specs (`*.e2e-spec.ts`) — need a database | 54 files | `apps/api/test` [V] |
| Web unit tests | 0 | `CLAUDE.md` §4: the test script is a stub [V] |
| Web Playwright specs | 88 files in 10 folders (cashier-floor, manager-*, supervisor-*) | `apps/web/e2e` [V] |
| Web static assertion scripts | 21 | `apps/web/scripts` [V] |

- Core modules with **no unit spec**: receipts, pos-handoff, device-registry (0 spec lines each). [V]
- There is no Playwright folder for the waiter. [V]
- The cashier e2e fixtures drive orders to SERVED by calling `/in-kitchen`, `/ready`, `/mark-served` directly (`apps/web/e2e/cashier-floor/c3-fixtures.ts:80`, `:131`) — the tests work around the missing kitchen step. [V]
- Pass / fail state is UNKNOWN (nothing was run). `CLAUDE.md` records 1184 / 1184 unit and 98 pre-existing e2e failures at different dates; not re-verified.

### What the seed creates (`seed.ts`, MAIN branch unless stated)

| Area | Seeded | Ref |
|---|---|---|
| Organisation | 1 ("Nimbus Restaurant Group") | SEED:1952-1956 [V] |
| Branches | 2 (Main, Downtown), currency **USD**, timezone UTC | SEED:1958-1967 [V] |
| Users | 7: Owner, Manager, Accountant, Supervisor, Cashier, Chef, Waiter (one each). **None for Bartender, Stock Manager, Procurement, Event Manager.** | SEED:1833-1896 [V] |
| Memberships | Owner, Manager, Accountant, Supervisor in both branches; Cashier, Chef, Waiter in Main only | SEED:1971-2012 [V] |
| Floor plans | 2 (Main Dining, Patio) | SEED:2292-2314 [V] |
| Tables | 15 (T1–T10, VIP-1, VIP-2, P1–P3): 12 Main Dining, 3 Patio; 12 AVAILABLE, 1 OCCUPIED, 1 RESERVED, 1 CLEANING | SEED:2324-2430 [V] |
| Menu | 5 categories, 20 items, 8 browse groups, 5 subgroups, 12 servings, 4 modifier groups, 14 options | §3 [V] |
| Stock items | 24 | SEED:3468-3667 [V] |
| Recipes | 10 items, 31 rows + 2 modifier rows | SEED:3682-3847 [V] |
| Stock batches | 29 across the 24 items (dated March 2025, several with March 2025 expiry) | SEED:4036-4262 [V] |
| Orders | 6, one in each of NEW, SENT, IN_KITCHEN, SERVED, CLOSED, VOIDED; tax 0 | SEED:4336-4400, 4489 [V] |
| Also seeded | KDS tickets, discounts, payments, shifts and tills, reservations, events, analytics, dashboards, reports, documents, HR, attendance, workforce, payroll, staff insights, accounting, ledger, alerts, reliability, control plane | SEED:4515-7895 [V] |
| Downtown branch | No floor, tables, menu or stock | SEED:8109-8198 pass `'MAIN'` only [V] |

A second dataset is loaded by `demo-import.ts` from 57+ CSV files (`packages/db/prisma/demo-import.ts:17-75`); the CSVs are not in the snapshot. Its contents are UNKNOWN beyond the file names. [V]

### Would the seed let a demo show stock deduction today?

**No.** The data is there (10 recipes, 24 stock items, 29 batches), but no code path deducts on a sale (§6), so selling ten burgers leaves the bun count unchanged. Three further blockers even after deduction is built: (a) no screen for stock, recipes or the kitchen; (b) the seed's costs are not UGX-scale, so margins would look absurd (§7); (c) no Stock Manager, Bartender or Procurement user exists to log in as.

---

## 15. Gaps against what the owner wants

| # | Wanted (owner's words) | Exists fully | Exists partly — what is missing | Missing |
|---|---|---|---|---|
| 1 | "a manager … or supervisor, someone who creates the tables" | — | API create / edit for Own, Mgr, Sup (`M/floor/floor.controller.ts:65-104`). **Missing:** any web screen; delete; sections / areas; a way to change who holds the permission without a re-seed. | |
| 2 | "when you're creating a table, you are creating something that touches very many things" | — | Table links to orders, reservations, events (`S:885-887`). **Missing:** section, default station / printer, assigned waiter, covers; table release on payment (`M/payments/payments.service.ts:244-247`); RESERVED / CLEANING automation; guard against two open orders on one table. | |
| 3 | Menu "food, drinks, starters … alcohols … further subdivided into whiskeys, gins" | — | Section (FOOD / DRINKS) → group → subgroup (`S:1002-1066`). **Missing:** free top level; a third level; nesting on `Category`; one taxonomy instead of two. | |
| 4 | "offers of the day" | — | — | No model, field or endpoint (§3). |
| 5 | "You can search in the menu" | — | — | No search parameter on any menu endpoint (`M/menu/dto/list-menu-query.dto.ts`). Client-side search over `/menu/catalog` is possible but modifiers are not in the catalog. |
| 6 | "When a supervisor taps the table, what they see should reflect their permissions … void … split bills" | — | Permission list in `/auth/me`; void order, split, merge, transfer, discount approve all exist and are held by Sup (§2). **Missing:** item-level void with reason; a server statement of allowed actions per order; runtime permission editing; second-person approval (PIN is the caller's own). | |
| 7 | "When a cashier clicks at the same table … Printing a bill. Even a waiter can print a bill" | — | JSON bill view for any order status; Wtr and Csh hold `pos:receipt:read` (`M/receipts/receipts.controller.ts:39-40`). **Missing:** any rendering or print path; printer routing in use; bill-printed counter; cashier notified of a bill request; Supervisor has no receipt permission; tax line is always 0. | |
| 8 | "when they are creating a menu item … if it's sold individually or has recipes" | — | Recipe rows per item / serving / modifier (`S:1198-1227`). **Missing:** the sold-as-is flag; recipe in the item-create flow; a screen; menu write for anyone below Supervisor. | |
| 9 | "a burger. It uses a bun … beef, how much … and how it's measured. If it's a bun, it's a piece. Some things are measured in pieces, others in weight" | — | Quantity, waste %, free-text unit per row. **Missing:** unit model, conversions, purchase vs recipe unit, yield, sub-recipes; unit consistency check (`M/recipes/recipes.service.ts:206-220`). | |
| 10 | "when I place an order, it deducts even items from the inventory" | — | `fifoDeduct` exists and is exported (`M/inventory/inventory.service.ts:287-325`). **Missing:** any caller on the sale path; a typed movement linked to the order line; reversal on void / refund; per-item "sent" marker; transactional deduct. | |
| 11 | "an accountant can see the very same menu items and assign cost on the actual item and then the ingredients, so that we get the true cost of goods" | — | Ingredient cost field and per-item cost endpoint exist for Own, Mgr, Sup, Chf. **Missing:** every relevant permission for Accountant (SEED:1234-1331); a cost field on the menu item; actual (batch / average) cost; a reachable COGS or margin report; ledger posting of COGS; cost snapshot ignores servings (`M/orders/orders.service.ts:371-379`). | |
| 12 | "two stores, like the major one, the secondary one … How do we add a store so that things are subtracted from that store" | — | — | No store / location model; stock is per branch (`S:1233-1260`). No rule for which store a sale draws from. |
| 13 | Transfers between stores, issue to the kitchen | — | Branch-to-branch transfer record with a state machine but no stock effect and no reachable permission (`M/franchise/franchise.service.ts:31-35`, `:667-712`). | Requisition / issue, goods received, purchase order, stock count, typed wastage. |
| 14 | "UI for the store manager" | — | Stock Manager role with three inventory keys (SEED:1671-1679). **Missing:** any screen; a seeded user; permission to see or create stock items (`pos:recipe:*`). | |
| 15 | "a chef is picking some meat … How is he notified in his UI?" | — | SSE stream for kitchen tickets only (`M/kds/kds.controller.ts:104-122`), unconsumed. | No issue document, no notification model, no chef screen (§10). |
| 16 | "We have like a kitchen screen we are trying to work on" | — | Ticket API with bump, recall, SLA, stream (§8). **Missing:** a screen; tickets for items added after first send; ticket → order status link; chef permission to advance the order; configurable stations; per-item bump; ticket creation failures surfaced. | |
| 17 | The table loop itself: floor → table → order → kitchen → bill → payment | — | Each step has an endpoint. **Missing links:** order cannot reach SERVED from any screen (§8); only the first send prints; table not released on payment; tax never computed; reopen absent. | |
| 18 | "Remove junk code … building on a structure that is dependable" | — | 16 core modules (16 857 lines) are separable from 10 junk candidates (8 828 lines), with three import knots to cut first (§12). **Missing:** runtime role editing; honest docs; the 35 unseeded keys resolved; root-level log files trimmed. | |

---

## Limits of this audit

- Nothing was executed. Behaviour claims are read from code, not observed.
- "Web calls it" is a literal string search of `apps/web/src`; a route built from variables could be missed. Front-end behaviour belongs to lane A2.
- `demo-data/` and `postman/` are absent from the snapshot, so the larger demo dataset and the Postman contract were not inspected.
- Line counts are of non-test `.ts` files per module folder, split on newlines; treat as approximate.
- Module verdicts are a reading against the owner's stated list, not a deletion plan.
