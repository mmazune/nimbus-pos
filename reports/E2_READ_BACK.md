# E2 read-back (inside track T2), 26 Nov 2026

Base: `rebuild/main` `0af95f8` with `origin/e1/order-truth` merged (`c6983c4`). `OrderItem.sentAt` is in the schema (line 1398). Throwaway Postgres 16 in the container, db `nimbus_event_t2`, localhost; seeded once.

## Baseline on this base [live]
- API typecheck `tsc --noEmit`: 0 errors. API build `nest build`: exit 0.
- Unit (`jest`): **1,309 passed, 71 suites, 0 failed** (matches E1's report).
- e2e, the suites this track touches (`order-truth menu kds floor orders.e2e`): 104 tests, **103 passed, 1 failed**: `orders.e2e` "close — SERVED → CLOSED", which fails at base (pays 9,999 on a dearer item; recorded by E1). `pnpm check:event` green.

## What each menu endpoint returns today (seed: 32 active items, 9 browse groups) [live]
- `GET /api/menu/catalog`: categories → active items with price, station, tax, browse group/sub-group, servings. **No choice groups, no availability.** 13,282 B, 29 ms.
- `GET /api/menu/navigation`: sections → browse groups → sub-groups, **no items**. 1,822 B, 11 ms.
- Choices need a third call per item (`GET /menu/items/:id/modifier-groups`). The only "sold out" is `MenuItem.isActive=false`, which hides the item, and `computeLinePricing` refuses it with `MENU_ITEM_UNAVAILABLE`.

## How the send path can check and take a count
`OrdersService.sendOrder` already runs one `$transaction`: `SELECT … FOR UPDATE` on the order, reads unsent live lines, stamps `sentAt`, calls `KdsService.createTicketsForLines(tx, …)`, writes the audit row. The hook goes between "read unsent" and "stamp": per line, a guarded `UPDATE menu_item_availability SET left = left - qty WHERE menu_item_id = $1 AND state = 'AVAILABLE' AND left >= qty RETURNING left` (no row = skip). The row lock serialises two orders racing for the last portion; the order lock does not, because they are different orders. Items with no availability row are unlimited.

## Where permissions are seeded
`packages/db/prisma/seed.ts`: `PERMISSIONS_DATA` (line ~150) and `ROLE_PERM_MATRIX` (Owner 684, Manager 958, Supervisor 1335, Chef 1564, Bartender 1650). Roles carry `jobRole` (`CHEF`, `BARTENDER`, …), and `req.user.roles[].jobRole` reaches services (see `common/auth/waiter-scope.ts`). `pos:menu:write` is held by Owner, Manager, Supervisor. **Chef holds neither `pos:kds:read` nor `pos:kds:write`** (relevant to phase 3). No bartender demo user is seeded; tests create one.

## Contradictions and which document won
1. "per item per branch": a `MenuItem` already belongs to one branch, so one row per item is per item per branch. The prompt's wording is kept; the row carries `branchId` too.
2. Reset is "Owner, Manager" but the new key goes to five roles: reset uses the new key **and** a job-role check (Owner, Manager); no second key, so the seed diff stays one key (Done-when 9 wins).
3. `03` §6 says the second sender "gets 409 with the item named, and only that line fails"; E2 says the line is skipped and reported and only an all-skipped send is 409. E2 (the prompt) wins.
4. Section of an item: the browse group's section; an item with no group falls back to its `itemType` (`DRINK`/`ALCOHOL`-like types → DRINKS, else FOOD).

## Questions, with the default taken
- Q1 Add a line for a sold-out item? Default: refused, 409 `ITEM_SOLD_OUT` (the button is grey; the server agrees).
- Q2 Offer price on an item with servings? Default: the offer replaces the item's own price only; a chosen serving keeps its serving price.
- Q3 `popular` with fewer than 20 sold items? Default: sold items by quantity first, then filled to 20 in menu order.
- Q4 Chef's stations: `KITCHEN`, `COLD_KITCHEN`, `DESSERT`; bartender: `BAR`; `NONE` items only by supervisor and above.
- Q5 A line needing more than is left (2 wanted, 1 left)? Default: the whole line is skipped with "only 1 left"; nothing is taken.
