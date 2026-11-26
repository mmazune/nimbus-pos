# Stock, stores and what is available: the model a builder follows

Read `02-life-cycles.md` first for the story. This file is the rules. Sources: `research/C_recipes_stock_stores_kitchen.md`, `research/D_availability_alerts_waste.md`, the code as read in `research/A3_backend_as_built.md`. Marks: [V] verified in code or on a vendor page, [P] our own proposal.

## 1. What exists today [V]

`fifoDeduct` has one caller, a manual adjustment; a sale moves no stock. There is no store or location model, no request, delivery or count. `RecipeIngredient` rows exist (base, per serving, per choice) with a free-text unit and no conversions. A menu item has no sold-out state except `isActive`. The Accountant holds no menu, recipe, cost or stock permission.

## 2. Stores

- `Store`: name, kind (`MAIN`, `SECONDARY`, `POINT`), `feedsFromStoreId` (empty for a main store), active. A branch has at least one store.
- A station (`KITCHEN`, `BAR`, `COLD_KITCHEN`, `DESSERT`) is linked to exactly one store: the one its sends take from. Two stations may share one.
- Stage 1 venue: one store, every station linked to it. Stage 2: main plus point stores. Stage 3: main, secondary, point stores. Moving between stages is a settings change, never a rebuild.
- `StoreLevel` per item per store: `onHand` (derived from the ledger, cached), `minimum`, `fillTo`, `lowServings` lives on the menu item.

## 3. Units

An item has a kind, locked after its first movement: count (base unit piece), weight (g), volume (ml). Amounts are whole thousandths of the display unit, held as integers. A pack size turns "1 crate" into 24 pieces for deliveries and requests. A recipe line is an amount in the item's own kind; mixing kinds is refused at save.

## 4. How a menu item is sold

`soldAs`: `AS_BOUGHT` (one stock item, one unit per sale), `MEASURE` (each serving takes its own amount: a tot is 30 ml of the bottle), `RECIPE` (ingredient lines), `NOT_TRACKED`. Choices that use stock (extra cheese) carry their own line. A venue may leave every item `NOT_TRACKED` and still use manual sold-out.

## 5. The ledger: one row for every movement

`StockMovement`: item, store, signed amount in base units, type, reason, reference (order line, request, delivery, count, waste entry), who, when, unit cost at that moment. Append only. A correction is a new row. `onHand` is the sum.

| Type | Made by | Sign |
|---|---|---|
| `RECEIVE` | Delivery checked in | + |
| `ISSUE_OUT`, `ISSUE_IN` | A request issued, then received. Between the two the amount is "on its way". | −, + |
| `SALE` | A line sent (one row per ingredient) | − |
| `SALE_REVERSAL` | Void of a sent line marked "not made" | + |
| `REMAKE` | Chef remakes a dish | − |
| `WASTE` | Take out of stock: spoiled, expired, burnt, dropped, broken | − |
| `STAFF_MEAL`, `ON_THE_HOUSE` | Their own types so they never hide in waste | − |
| `MISSING` | Take out of stock, reason missing | − |
| `FOUND` | We found more | + |
| `COUNT_ADJUST` | A count that differs from the books | ± |
| `RETURN_TO_SUPPLIER` | Store keeper | − |
| `OPENING` | First stock entered | + |

A sale that would take a store below zero is **still allowed** and the store goes negative: the food is on the plate, the record is what is wrong. A negative level raises a count task. [P] This is the main guard against a rigid system.

## 6. Availability of a menu item

One answer per item per branch, worked out on the server, sent with the menu and pushed when it changes:

`{ state: AVAILABLE | LOW | SOLD_OUT, left: number or null, source: MANUAL | COUNT | STOCK, since, by }`

1. **Manual**: Sold out, or back on. Chef, bartender, supervisor, manager. [V: Toast and Square both have this.]
2. **Count**: "12 left"; each send takes one; zero is sold out. [V: Toast, Square.]
3. **Stock**: servings left = the smallest, over the item's ingredient lines, of `floor(onHand in the station's store ÷ amount per serving)`. Mode per venue, with a per-item override: `OFF`, `WARN` (default), `BLOCK`. [P: no leader does stock-driven sold-out reliably; one vendor blog claims it.]

The strongest wins in that order. `LOW` when `left` ≤ the item's `lowServings` (default 5). In `WARN`, a stock answer of zero shows amber "Check stock" and the item still sells.

- Server check at send, in the same transaction as the stock rows: the last serving goes to the first send; the second gets 409 with the item named, and only that line fails.
- An unsent line whose item becomes sold out is flagged in the order payload; Send skips it and says so.
- **We have it** (chef, supervisor, manager): clears a stock-driven block until day close, writes who and when, and opens a count task for the ingredients that read zero.
- Reset at day close: manual sold-out and counts clear; the list is shown at the next opening to confirm. A venue may switch the reset off. [V: Square resets at end of day; Toast never does.]
- Every change of state writes a row to `AvailabilityLog` (item, from, to, source, who). That is the sold-out log. [P: found in no product read.]

## 7. Minimum, fill-to and the suggested request

When a movement takes a point store's item from at-or-above `minimum` to below it: one `LOW_STOCK` alert for that store and item (see `04-alerts.md`), and the item joins that store's suggestion: `fillTo − onHand − alreadyOnItsWay`, rounded up to a whole pack. The chef's Store section opens with the suggestion ready. Auto-send of suggestions is a venue setting, off by default.

## 8. Requests between stores

`REQUESTED → ISSUED → RECEIVED`, with `DECLINED`, `RECEIVED_SHORT` and `NOT_ARRIVED`. Issue writes `ISSUE_OUT` from the feeding store. Receive needs the receiver's PIN and writes `ISSUE_IN` for what arrived; the gap stays against the request as a transit loss and tells the store keeper and the manager. Unanswered after 15 minutes: `REQUEST_WAITING` alert to supervisor and manager.

## 9. Deliveries and "To buy"

A feeding store below `minimum` puts the item on **To buy** with a suggested amount to `fillTo`. The manager turns lines into a purchase order to a supplier (simple: supplier, lines, expected price). Receive against the order, or with no order: full, short, over, price differs. Receiving writes `RECEIVE` and recomputes the moving weighted average cost. A price that differs by more than the venue's limit (10% by default) puts the item on the accountant's "Cost changed" list.

## 10. Counts and variance

Kinds: spot, full, bar shift. Blind by default. Each count line compares with `onHand` at the second it is saved, so selling continues. Difference → `COUNT_ADJUST`. Above the limit (2% of the period's usage or UGX 20,000 an item, whichever is larger; venue setting) the count cannot close until the manager writes a note. A count task is opened by: `MISSING`, **We have it**, a negative level, and the calendar (bar: every shift; kitchen proteins: daily; everything: month end).

## 11. Rights

| Action | Chef, bartender | Store keeper | Supervisor | Manager | Accountant |
|---|---|---|---|---|---|
| Mark sold out, set a count, We have it | their station | — | yes | yes | — |
| Take out of stock | their store | their store | PIN above the limit | yes | — |
| Ask the store, receive | their store | — | — | yes | — |
| Issue, receive a delivery, count | — | their store | — | yes | — |
| Set minimum and fill-to | — | their store | — | yes | — |
| Set a cost, see margin | — | — | — | see | yes |
| Recipes | see | — | — | yes | see |

Waiter, cashier and supervisor never get procurement or accounting rights (R14).
