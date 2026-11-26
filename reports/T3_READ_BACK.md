# T3 read-back: the one order screen (26 Nov 2026)

Branch `t3/order-screen` from `rebuild/main` `0af95f8`, with `origin/e1/order-truth` merged (`6d433e8`). The kit was already present, so `u0/foundations` was not merged again. Sources: code read on this branch [code], the throwaway database and the API on :4111 [live].

## What a table tap opens today [code, A2 §2]
| Role | Opens | Free table |
|---|---|---|
| Waiter | own or free table: full screen `WaiterOrderBuilderScreen` (1,608 lines, columns 160/flex/360, nothing at 390). Reserved, another waiter's, no shift: the right-docked `OperationalTableWorkspaceFrame` sheet | `POST /api/pos/orders` on mount, before anything is ordered |
| Cashier | docked sheet: `CashierBillResolutionPanel` → `CashierSettlementWorkspace` (cash must equal the bill) | "No bill is available for this table." |
| Supervisor | docked sheet: `SupervisorTableControlWorkspace` (9 order actions, no line void) | "No active order" |
| Manager | inline card in `ManagerTablesScreen`, read only | "Open order: None" |

## Endpoints the new screen calls
| Need | Route | Right | Notes [code] |
|---|---|---|---|
| Menu tree | `GET /api/menu/navigation?activeOnly=true` | `pos:menu:read` | sections FOOD/DRINKS → groups → sub-groups |
| Menu items | `GET /api/menu/catalog` | `pos:menu:read` | items with `browseGroup`, `browseSubgroup`, `servings`; **no choices flag** |
| Item choices | `GET /api/menu/items/:id` (+ `/servings`, `/modifier-groups`, `/modifier-groups/:id/options`) | `pos:menu:read` | fetched on tap |
| Table's order | `GET /api/pos/orders?tableId=&excludeStatus=CLOSED,VOIDED` | `pos:orders:read` | list gives item ids only |
| Order lines | `GET /api/pos/orders/:id` | `pos:orders:read` | **waiter gets 403 on another waiter's order** (`assertWaiterOrderOwnership`) |
| First Send | `POST /api/pos/orders` then `POST …/items` per line then `POST …/send` | `pos:orders:write` | the order is made only here (R2) |
| Add, change, remove unsent | `POST …/items`, `PATCH …/items/:itemId`, `DELETE …/items/:itemId` | `pos:orders:write` | waiter needs an open shift (409 `SHIFT_NOT_OPEN`) |
| Send | `POST /api/pos/orders/:id/send` | `pos:orders:write` | E1: sends only unsent lines; nothing to send → 409 |
| Void one line | `POST /api/orders/:orderId/items/:itemId/void` | `pos:order:item:void` | E1: Owner, Manager, Supervisor only |
| Bill asked for | `POST /api/pos/orders/:id/request-bill` | `pos:orders:write` | records the request; no printing (E4) |
| Pay | `POST /api/pos/orders/:id/close` `{payments:[{method,amount}]}` | `pos:orders:close` | E1: cash may exceed, change returned; CARD, MOMO, BANK_TRANSFER must fit; several payments in one call |

## What E1 added [code, reports/E1_REPORT.md]
`sentAt` and void fields on lines; send by line with a database guard; cash with change (`tendered`, `changeGiven`); one close door that frees the table and completes a seated booking; `POST /orders/:orderId/items/:itemId/void` with reason, note, `wasMade`, quantity.

## What is missing (left out and listed, never faked)
1. **Popular / Offers groups**: no data source (no group of that name in the demo menu, no top-sellers read for a waiter). Shown when the data has a group with that name; T2's `/api/menu/workspace` brings it.
2. **Availability** (sold out, "3 left") and **initials**: not in the API. The data layer derives initials from the name (a pure function, not data); availability stays "available" until T2.
3. **Another waiter's lines**: the API refuses the read, so `Order-Other` shows the count and total from the list, not the lines. "Ask Brian O." and "Take it over" have no endpoint: left out.
4. **Print bill**: no printer path (E4). The button records the bill request and shows the bill.
5. **Supervisor table actions**: routes exist for Move table (`transfer-table`), Join tables (`merge`), Change waiter (`transfer-server`), Split bill (`split-bill`, records allocation only), Discount (`/pos/orders/:id/discounts`), Cancel the order (`/pos/orders/:id/void`). "Send to kitchen again" has no endpoint: left out. T3 wires the void of one line (its brief) and lists which of the others it wires in the report.
6. **Waiter asks for a void**: no approval route for a line void → the action is left out for the waiter and listed.
7. **Mobile money**: manual close with method `MOMO` only; no phone prompt (provider not live).
8. **Demo menu** has no bar items with measures; the e2e builds its own fixture menu through the manager's API.

## Contradictions and which won
- Drawing `Order-Other` shows lines; the API refuses them to a waiter. The API wins (rule 13); listed above.
- R5 says the filled button is Print bill or Take payment; there is no print. The drawing's words stay; the action is the bill request.
- Old docs: "cash is valid only on a SERVED bill" — E1 changed it; E1 wins.

## Baseline [live, this turn]
API health ok on :4111 (throwaway Postgres 16, `t3_order`, seed + demo import). Web gates recorded in `T3_PROGRESS.md` before the first code change.
