# Lane C: recipes, units, stock deduction, stores, kitchen screen, true cost of goods

Benchmark and domain study for Nimbus POS (Kampala). Written 26 Nov 2026. Author: research agent, lane C.
Not covered here (other lanes): the waiter's order screen and menu navigation; our own code.

## How to read the marks

- **[V Sn]** I opened the page (source n in the table in section 10) on 26 Nov 2026 and the claim is on it.
- **[2H]** a search result title, a review or a promotional page says so. I did not see primary proof.
- **[PK]** from my own memory of the product or of standard hospitality practice. Treat as unknown until checked.
- **[P]** my proposal for Nimbus.
- **UNKNOWN** I looked and could not establish it.

One caution on every [V]: pages were read through a fetch tool that extracts text with a small model. Quoted words are as that tool returned them. Re-open the page before quoting any of it to a client or in public.

---

## 0. The answer in one page

1. **One mechanism, three ways in [P].** Every menu item deducts through a list of lines (stock item, quantity, unit). "Sold as bought" is one line of 1 piece. "A measure" is one line of 25 ml. "A recipe" is many lines. The manager only answers one question: "How is this sold?"
2. **Three kinds of unit, fixed per stock item [P]:** count (piece), weight (gram), volume (millilitre). Packs sit on top (crate = 25 bottles, bottle = 750 ml, kg = 1,000 g). The kind cannot change once stock has moved. Oracle and Restaurant365 both lock this [V S7] [V S19].
3. **Deduct when the line is sent, never block a sale for low stock [P].** Toast's countdown falls on send [V S17]; Lightspeed deducts when the item is "created or ordered" [V S23]; Simphony's inventory posts after end of day [V S4], which is too late for a shift count.
4. **Two stores = two stock-holding places, one of which sales draw from [V S5] [V S6].** In Simphony each revenue centre is linked to one cost centre and sales deplete that cost centre. The main store is simply a cost centre that sales do not deplete.
5. **Store issue is three states: Requested, Issued, Received [P],** cut down from Oracle's six steps [V S2]. Both people sign. This is the control between the store keeper and the bar.
6. **Bar first.** Whole bottles, tots in ml, and a shift sheet (opening + issues - closing against sold) catch the most leakage for the least build [P].
7. **Moving weighted average cost per stock item, updated at each goods receipt [P].** It is allowed by IAS 2 [PK], needs no batch tracking, and gives a cost of goods the accountant can defend.
8. **Start with no recipes at all.** Default every new item to "sold as bought". Recipes for the top sellers come after a month. Square, Toast and Oracle all show what happens when recipes are a precondition [V S24] [V S16] [V S4].

---

## 1. Item types

### 1.1 The five cases and what each product calls them

| Case | Oracle Simphony + Inventory Management | Loyverse | Square for Restaurants | Toast | Foodics | Lightspeed Restaurant (K-Series) | Restaurant365 |
|---|---|---|---|---|---|---|---|
| (a) sold as bought (bottle of beer) | POS "menu item" linked to an inventory "Item" (type "COS Item") through "Menu Item Linking" [V S3] [V S7] | "Item" with "Track stock" on [V S14] | item with stock tracking [V S24] | menu item; a separate "Quantity" stock status on the button [V S17] | "Product" consuming one "Inventory item" [V S18, partly; the product link is not on the page I opened] | "The stock item and ingredients are added as one Inventory item" [V S23] | "Purchased Item" [V S19] |
| (b) made from a recipe (burger) | menu item linked to a "Recipe"; "You can link one menu item to multiple inventory items or recipes" [V S3] | "Composite item" with "components" [V S14] | "recipe" on a "Prepared Food & Bev" item, built from "ingredients" in the item library [V S24] | "recipe"; only a recipe marked "complete" (not "draft") depletes [V S16] | product with "ingredients" [V S18] | "item composition" [V S23] | "Recipe" [V S19] |
| (c) a measure of a stock item (tot, glass) | a link with a ratio. Oracle's example: one large fries depletes two portions of the small fries recipe [V S3]. Tot set-up itself: UNKNOWN until the scan | two documented ways: "Sold by: Weight" (type 0.5 for half a litre), or a composite portion item whose single component is the base liquid ("drinks served in shots, glasses, or pints") [V S15] | "stock conversion and sell-by units" on a multi-unit ingredient [V S24] | recipe with one line [PK] | product with one ingredient in the "ingredient unit" [PK] | UNKNOWN | recipe with one line [PK] |
| (d) prepared or batch item used inside recipes (sauce) | "Production" documents, "Production Units", "Yield Management", and an item flag "Count as Recipe" ("the item is also a recipe that is being counted as an item") [V S1] [V S7] | composite inside composite, at most 3 levels deep; optional "Production" [V S14] | not supported: "No batch prep or recipes of recipes" [V S24] | "prep item". When used in another recipe, "the system depletes the stock of the prep item itself, rather than its individual raw components" [V S16] | "produced" inventory item, made from other items [V S18] | "production batches" for items with "item composition and enabled manufactured checkbox" [V S23] | prep recipe [PK] |
| (e) combo | POS-side combo meals [PK]; in inventory a menu item can be linked "to other menu items" [V S1, section title] | composite item [V S14] | UNKNOWN | UNKNOWN | combo product [PK] | UNKNOWN | UNKNOWN |

Other products, from memory only (all [PK], none opened): **Odoo** uses a storable product, a Bill of Materials of type "Kit" (components leave stock when the kit is sold, no production step) or "Manufacture this product" (a manufacturing order makes stock), and POS combos. **MarketMan** uses inventory items, "preps" and menu items. **Apicbase** uses ingredients, recipes, sub-recipes and menus. **iiko** uses goods, dishes, semi-finished "prepared components" and modifiers, joined by a "technological map". **WISK, BevSpot, BinWise** map a POS button to a bottle and a pour size.

### 1.2 Things worth noticing

- Oracle can deplete different stock depending on order type. Its example is "coffee to go in a paper cup and coffee in-house in a porcelain mug" [V S3]. This is how takeaway packaging gets deducted.
- Oracle's guide has a section "Menu Item Linking With Negative Quantities" [V S1, title only]. Its content was not opened. The likely use is "no cheese" removing a line; treat as UNKNOWN.
- Square's limits are a warning: no recipe of a recipe, "Modifiers don't track inventory or costs", "Items with multiple variations can't have recipes", and the whole feature is beta and on paid plans only [V S24]. A double tot or extra cheese that does not deduct would be a hole in a bar.
- Two honest ways to treat a sauce exist. Toast and Oracle treat it as a stock item that must be produced and counted [V S16] [V S7]. Odoo's kit and Loyverse's plain nesting pass the deduction through to the raw ingredients with no production entry [PK] [V S14]. The second is far less work for a small kitchen.

### 1.3 Recommendation for Nimbus [P]

| Manager's choice on the item form | Stored as | Example |
|---|---|---|
| **Sold as bought** (default) | one line: 1 piece of one stock item. The stock item is created with the same name if it does not exist | Nile Special 500 ml |
| **A measure of a stock item** | one line: N ml (or g) of one stock item | Tot of whisky 25 ml; glass of wine 150 ml |
| **Made from a recipe** | many lines | Burger |
| **Not tracked** (soft: needs a reason once) | no lines; shows in a "not tracked" list for the accountant | Hot water, service charge |
| **Combo** (stage 3) | a list of menu items; deduction runs through each | Burger + soda |

Sub-recipes (sauce, marinade): a recipe line may point at another recipe. By default the deduction passes through to the raw ingredients. Only if the kitchen wants to count the sauce does it become a stock item "made in batches" with a production entry (stage 3). Depth limit 3, as Loyverse does [V S14].

---

## 2. Units of measure

### 2.1 How the leading systems model units

| Point | What they do |
|---|---|
| Base unit per item | Oracle: "Base Unit ... serves is the base of any unit used for this item in orders, transfers, inventory counts, and recipes", and "Once the item is saved, you cannot change its base unit ... delete and re-add the item with the correct base unit" [V S7] |
| Kinds of measure | Restaurant365 has exactly three: Weight, Volume, Each. "Each created Purchased Item has an assigned Measure Type that is not editable" [V S19] |
| Purchase unit versus stock unit versus recipe unit | Oracle: units are named packs that "Consist of" an amount of a sub-unit; a "Store Unit" is "the main unit used by the store for inventory counts and reporting"; a unit can be flagged "Use Unit in Stock Taking" and "Use for Recipe Yield" [V S7] [V S8]. Foodics: "Storage unit" (the box) and "Ingredient unit" (the piece inside) [V S18]. Restaurant365: separate selectors for Ingredient, Reporting, Inventory and Purchasing units [V S19] |
| Conversions across kinds | Restaurant365: off unless a "Measurement Conversion" is set up; its example is "convert 1 5 GAL BKT to 20 LBS to 80 pickles"; without it "UofM selectors will be locked to a Purchased Item's Measure Type" [V S19] |
| Piece items | Oracle ships base units "each, pint, pound, and portion" and describes three families: sold whole (bagel), solids sold in fractions (ground beef into patties), liquids broken down (milk into glasses) [V S8] |
| Yield and trim loss | Oracle: an item-level "Gain/Loss" percentage, plus a "Yield Management" module and "automatic yield" [V S7] [V S1]. WISK quotes grapefruit at "60% usable liquid" [V S22] |
| Stopping nonsense | Oracle: base unit immutable [V S7]; "Enable Plausibility Check on Inventory" with "Deviation by Value" and "Deviation by Qty%" [V S9]; a receiving warning "when there is a large deviation between what was ordered and what was delivered" [V S7]. Restaurant365: unit pickers locked to the measure type [V S19]. Square: recipe unit must match how the ingredient is stocked or you fix the ingredient [V S24] |

A point against copying Oracle's unit screen: its own example says a 0.35 l bottle must have base unit "pint" [V S8]. That is a US habit and makes no sense in Kampala.

### 2.2 Recommended minimal unit model for Nimbus [P]

1. Each stock item has one **kind**: count, weight or volume. The base unit follows from it: **piece, gram, millilitre**. Nobody types a unit name.
2. Quantities are stored as whole numbers of **one thousandth of the base unit** (so half a bun is 500, and 25 ml is 25,000). No floating point anywhere.
3. Standard units come ready: kg = 1,000 g; litre = 1,000 ml. They are offered only to items of the matching kind.
4. Each stock item can have named **packs**, each with a whole-number size in base units: "crate = 25 bottles", "bottle = 750 ml", "tray = 30 eggs", "sack = 50 kg".
5. Each stock item marks three defaults among its units: **bought in**, **counted in**, **used in recipes**. Anything can still be entered in any unit of that item.
6. The kind is locked after the first stock movement. A wrong kind is fixed by retiring the item and creating a new one (nothing is deleted).

Optional, hidden until needed: a **usable %** (yield) per stock item, default 100; and one **cross-kind equivalence** per item ("1 tomato is about 120 g") for chefs who write recipes in pieces of a thing that is bought by weight.

### 2.3 The six examples

| Stock item | Kind / base | Bought in | Counted in | Used in recipes | A menu line looks like |
|---|---|---|---|---|---|
| Bun | count / piece | pack of 6 (optional) | piece | piece | Burger: 1 piece |
| Beef mince | weight / g | kg | kg | g | Burger: 150 g |
| Cooking oil | volume / ml | jerrycan = 20,000 ml | litre | ml | Chips: 30 ml |
| Whisky (one brand) | volume / ml | bottle = 750 ml | bottle, plus the open bottle in tenths | tot = 25 ml (or 30 ml, set per site) | Tot: 25 ml. Bottle sale: 750 ml |
| Beer (one brand) | count / bottle | crate = 25 bottles | bottle | bottle | Beer: 1 bottle |
| Tomatoes | weight / g | kg | kg | g | Salad: 80 g. Usable % 90 if the chef wants trim counted |

The form always echoes the arithmetic back in words: "1 bottle = 30 tots of 25 ml", "1 crate = 25 bottles", "This burger uses 150 g of beef". Crate size is per item because crates differ (the brief gives 25 for beer; soda crates are often 24 [PK]).

### 2.4 Guards [P]

| Guard | Type |
|---|---|
| Unit picker shows only units of the item's kind | hard |
| Kind cannot change after the first movement | hard |
| Pack size must be a whole number greater than zero | hard |
| Recipe line far outside the item's usual range (20 kg of beef in a burger) | soft: "Are you sure?" with the cost shown |
| Recipe cost above the selling price | advisory, shown in red on the form |
| Purchase price more than 30% away from the last one | soft: confirm, alert to accountant |
| Count far from expected (Oracle's "plausibility check" [V S9]) | soft: recount prompt before submit |

---

## 3. When stock is deducted

### 3.1 What each product does

| Product | When stock moves | Evidence |
|---|---|---|
| Toast, menu item countdown | The count drops "each time you order that menu item"; the worked example is when the order is sent to the kitchen. At zero "the Toast platform will not allow the server to add the menu item to an order". This feature "is not related to the Toast Inventory module" | [V S17] |
| Toast Inventory (beta in Australia, Canada, Ireland, UK) | "the system automatically decrements the stock every time that menu item is sold", counting down from the last physical stock check; deliveries add; draft recipes do not deplete. Send versus payment is not stated | [V S16] |
| Lightspeed Restaurant K-Series (legacy Stock) | "When an item is created or ordered on the POS, the ingredients for the recipe will be automatically deducted from stock." The legacy feature is closed to new customers since June 2023 in favour of an Inventory add-on | [V S23] |
| Square for Restaurants | "When a menu item with a recipe is sold, Square decrements ingredient stock". If a tracked ingredient runs out the item is marked sold out, and staff can override and still sell | [V S24] |
| Loyverse | When the composite item is sold, each component with "Track stock" on is reduced | [V S14] |
| Oracle Simphony + Inventory Management | Sales reach inventory as a batch. For one error case the guide says "After end of day runs and information is sent from Reporting and Analytics Advanced to Inventory Management, you can manually book the sales." Menu items with no link "remain in Unbooked Sales until they are linked." Whether there is also an intraday feed: UNKNOWN | [V S4] |
| Odoo POS | A setting: stock moves in real time, or at closing of the session. Through version 15 closing was advised for performance; from version 16 real time is the default | [V S20] (a forum answer, not the manual) |
| Foodics, MarketMan, Apicbase, iiko, r_keeper | UNKNOWN (not on the pages reached, or not reached) | |

Where sources differ: Toast's two features use different words ("order" and "sold"), and Lightspeed says "created or ordered" while Square and Loyverse say "sold". No vendor page I opened states the rule for a void after preparation, a refund or a comp. Everything in 3.2 on those is standard practice [PK] or my proposal.

### 3.2 Voids, refunds, comps, negative stock, 86

| Event | Standard practice | Source |
|---|---|---|
| Void before the line is sent | Nothing moved, nothing to undo | [PK] |
| Void after it is sent | The system asks whether it was made. Not made: stock goes back. Made: it is waste, with a reason. Oracle carries these as "POS Waste Checks" booked into inventory waste | [PK]; Oracle screen exists [V S10], behaviour not described |
| Refund | Money goes back; stock does not, unless a sealed item is physically returned | [PK] |
| Comp (on the house) | Stock is used as normal; revenue is zero; cost is charged to a comp account | [PK] |
| Staff meal, duty drink | Same as a comp with its own account. A Kampala hotel controller's duties include "Check and verify all staff meals" and "Prepare Duty Drinks and management report and confirm that this is as per entitlement" | [V S26] |
| Negative stock | Square lets staff override a sold-out item and sell [V S24]. Oracle's rule: UNKNOWN (not on the settings page opened [V S9]) | |
| 86 and countdown | Toast: three states, "In Stock", "Out of Stock", "Quantity"; the button shows 0 and ordering is blocked [V S17]. Square: automatic sold-out from ingredients, overridable [V S24] | |

### 3.3 Recommended rule set for Nimbus [P]

**Rule: stock moves when the order line is sent (to the kitchen, to the bar, or confirmed at a counter sale). Payment does not move stock.**

Reasons:
1. Sending is when the food or drink is committed. A bar tab may be paid three hours later; the bottle left the shelf at the start.
2. The shift handover count compares what should be on the shelf with what is there. That only works if the expected figure is current at that minute. An end-of-day post (Simphony's pattern [V S4]) cannot support it.
3. It makes "no ticket, no drink" enforceable: anything poured without a sent line shows as a shortage in the same shift.
4. With a poor network the movement is written on the device with the order line's id as its key, and synced later. The same line can never deduct twice.

Each line records which **store** it drew from: the store linked to the station the line was routed to (section 4.3).

| # | Rule | Type |
|---|---|---|
| 1 | Every sent line writes its stock movements (or an explicit "not tracked" mark) in the same save as the line | hard |
| 2 | Movements are append-only. A correction is a new movement pointing at the one it corrects | hard |
| 3 | One order line can deduct once. A re-send or a sync retry writes nothing new | hard |
| 4 | The deduction stamps the recipe version and the unit cost in force at that moment. Later recipe edits never rewrite it | hard |
| 5 | Void after send: the user must pick "Not made, back to stock" or "Made, wasted", plus a reason. Manager is alerted | soft |
| 6 | Selling when stock shows zero or below is allowed. The line is flagged and the item joins a "check stock" list | soft (silent to the waiter, alert to manager) |
| 7 | Comp and staff meal: allowed with a reason and a named person; stock moves; cost goes to its own account | soft |
| 8 | Refund with "item returned to stock" | soft |
| 9 | A recipe saved as draft sells but does not deduct, and wears a badge "recipe not finished" (Toast's draft pattern [V S16]) | advisory |
| 10 | Low stock, and "about N portions left" | advisory |
| 11 | 86: chef or bartender marks an item "finished" in one tap; the button greys out on every device | hard for waiters, soft for a manager (override with reason) |
| 12 | Countdown: chef sets "12 left"; the number falls on send, rises on a "not made" void, and the item is 86'd at zero | hard at zero for waiters, soft for a manager |

Stage note: 86 and countdown are manual and independent of stock at first, exactly as Toast keeps them apart [V S17]. Automatic 86 from ingredient stock (Square's pattern [V S24]) waits until counts are trusted, otherwise bad stock data will hide dishes that are in fact available.

---

## 4. Stores and locations

### 4.1 The standard structure

| Place | What it is | Who is responsible |
|---|---|---|
| Main store | Receives all deliveries. Locked. Issues only against a request | Store keeper |
| Kitchen store (or the kitchen's fridges and dry shelf) | The day's or week's working stock for the kitchen | Head chef |
| Bar store (or the bar's shelves and fridges) | The shift's or day's working stock for the bar | Bartender on shift, then head bartender |
| Outlet, also called revenue centre | Where sales are rung (restaurant, bar, pool bar, room service) | Outlet manager |
| Cost centre | The accounting name for a place whose consumption is costed | Accountant |

This layout is standard hotel practice [PK]. A 2023 Kampala hotel job advert for a Food and Beverages Stock Controller confirms the same controls are expected locally: no "material is issued out from the store without requisition or approval"; "Prepare variance analysis for food & beverage"; "Control the Food and Beverage outlets in terms of wastage, pilferage and efficiency"; "Spot-check on the receiving department to ensure that the scales are correct"; "Participate in stock taking at the restaurants"; and "Responsible for linking the articles and Recipes in Material Control" [V S26]. The last line names Oracle Materials Control as the system in use at that property.

### 4.2 Simphony Inventory Management: its terms

| Term | Meaning in Oracle's words | Source |
|---|---|---|
| Location | "Locations are defined in Reporting and Analytics, and collect sales data"; they are synchronised into Inventory Management | [V S5] |
| Revenue centre | "differentiates streams of revenue within one location such as dine-in or takeout"; "Revenue centers from Reporting and Analytics are represented as devices in Inventory Management" | [V S5] |
| Cost centre | "Cost centers are defined in Inventory Management. They are the stock holding store where transactions are booked, such as Receiving, Transfer, Waste, or Sales Depletion." | [V S5] |
| Store | Used interchangeably with cost centre in the request flow ("User rights determine if a store can accept or decline"); a rights group is called "Cost Center/Store User/Role Rights" | [V S2] [V S1] |
| Storage location | A shelf or area inside one store, "standard" or "advanced", used to order the count sheet | [V S1] |
| Issue request | A cost centre asks another for stock | [V S2] |
| Transfer | Stock sent from one cost centre to another; the guide also calls the flow the "Transfer Requisition Process" | [V S1] |
| Cost Center Areas | Set-up of which cost centres may transfer to, or request from, which | [V S1, section titles] |
| Master cost centre | A cost centre whose menu item links are copied to others | [V S1, section titles] |
| Allocation | UNKNOWN. The word does not appear in the table of contents I opened | |

**The issue request flow, as Oracle writes it [V S2]:** (1) "A request is made by a cost center in need." (2) "The request is received by the potential transferring cost center." (3) It can "Approve the requested items", "Modify the totals requested", "Zero out all the totals" or "Delete the transfer". (4) "The transferring cost center books the request." (5) "The requesting cost center receives the booked transfer." (6) "The requesting cost center either approves the transfer (modifications and all) or declines the transfer." And the key rule: "Only after the requesting store accepts the transfer does the system modify any stock on hand totals." User rights can make acceptance automatic.

### 4.3 What "two stores" means in Simphony, and which store a sale depletes

- "Two stores" is two cost centres: a main store and an outlet store (bar or kitchen). Stock goes from one to the other by issue request or transfer [V S2].
- A sale depletes the cost centre that its revenue centre is linked to. The link is made at Maintenance, Booking Sales, Devices: pick the revenue centre, pick the cost centre, and optionally tick "Exclude from Sales Depletion if this cost center should not have sales depletion" [V S6].
- Several revenue centres can share one cost centre. Oracle's example: "The Burger Shop has two revenue centers, but they are associated with one cost center since the goods are sold from the same kitchen storage area." [V S5]
- If a revenue centre has no link, its sales cannot be booked: "This error occurs if sales are sent to a revenue center that is not linked to a cost center." [V S4]
- So the main store is, in effect, a cost centre that no revenue centre points at. That last sentence is my reading of the pages, not a quoted statement [P].
- Whether one revenue centre can split depletion between two cost centres (food from the kitchen, drinks from the bar): UNKNOWN. The page uses the singular "the new cost center" [V S6]. This is a first question for the scan.

**For Nimbus [P]:** each station an order line can be routed to (Kitchen, Bar) has one setting, "sells from: [store]". A site with one store points both at it. A site with a main store and a bar store points Bar at the bar store and Kitchen at whichever store the kitchen really draws from. The main store has no station pointing at it and so is only reduced by issues, waste and counts. This gives the food-from-kitchen, drinks-from-bar split that Simphony may or may not manage per revenue centre.

### 4.4 Lifecycles as state tables

Oracle's own document states, for reference: orders are "Suspended, Pending, or Booked"; receipts are "Suspended, Booked, Invoiced, or Cancelled"; invoices are approved and sent to accounts payable; counts are created, frozen or unfrozen, booked, unbooked or cancelled [V S1, section titles]. The tables below are the cut-down Nimbus versions [P].

**Purchase order (stage 3; optional)**

| State | Who acts | What moves |
|---|---|---|
| Draft | Store keeper or manager, often from the "to order" list | Nothing |
| Sent | Manager approves and sends (print, WhatsApp, phone) | Nothing |
| Part received / Received | Store keeper, by posting a goods received note against it | See next table |
| Closed / Cancelled | Manager | Nothing |

**Goods received note (stage 1 as plain "stock in")**

| State | Who acts | What moves |
|---|---|---|
| Draft | Store keeper counts and weighs what arrived; enters quantity and price per line; photo of the delivery note | Nothing |
| Posted | Store keeper | Stock rises in the main store; average cost is recalculated; a payable (or a cash payment) is recorded |
| Matched | Accountant ties it to the supplier's invoice; a price difference posts as a new adjusting entry | Value only |
| Reversed | Accountant or manager, with a reason | A mirror entry; the original stays |

**Requisition and store issue**

| State | Who acts | What moves |
|---|---|---|
| Requested | Chef or bartender picks items and quantities (or taps "the usual") | Nothing. Store keeper's queue gets a new card and a sound |
| Issued | Store keeper enters what was actually handed over (meat is weighed, so 5.0 kg requested may be 5.2 kg issued) | Out of the main store, into "on the way to Kitchen" |
| Received | Requester confirms with a PIN, on their own screen or on the store keeper's | Out of "on the way", into the kitchen or bar store |
| Received short | Requester enters what really arrived | The received amount lands; the gap stays "on the way" and alerts the manager |
| Declined / Cancelled | Store keeper (with reason) / requester | Nothing |

Soft rules: an issue with no request ("direct issue") is allowed and flagged; an issue above a set value needs a manager's approval; an issue not confirmed by the end of the shift is auto-received and flagged "unsigned". Where this differs from Oracle: Oracle moves nothing until the requester accepts [V S2]. Moving stock into an "on the way" bucket at the moment of issue keeps the main store's shelf figure true and makes the unsigned amount visible as its own number.

**Transfer between outlets** uses the same document with any two stores: Sent, then Received.

**Return to store**

| State | Who acts | What moves |
|---|---|---|
| Returned | Chef or bartender | Out of the outlet store, into "on the way to Main" |
| Accepted | Store keeper, after checking condition | Into the main store. If spoiled, the store keeper logs waste instead |

**Waste, breakage, spoilage**

| State | Who acts | What moves |
|---|---|---|
| Logged | Anyone on shift: item, quantity, reason from a short list (spoiled, broken, overcooked, returned by guest, expired), optional photo | Out of that store at once; cost to the wastage account |
| Reviewed | Manager, later | Nothing. A review is a mark, not a gate |

**Staff meals and duty drinks**

| State | Who acts | What moves |
|---|---|---|
| Rung | Entered as an order of type "staff meal" against a named person | Stock moves as for a sale; revenue is zero; cost to the staff meals account |

**Stock count and variance**

| State | Who acts | What moves |
|---|---|---|
| Started | Store keeper, bartender or controller picks a store and a list (all items, or the top 20 by value) | Nothing. The expected quantity is worked out as at the start time |
| Counting | Counter enters what is there, without seeing the expected figure (blind count); works offline | Nothing |
| Submitted | Counter | Nothing. Lines far from expected ask for a recount |
| Approved | Manager or accountant | One adjusting entry per item for the difference; value to the stock variance account |

Oracle's related ideas worth keeping: "count cycles", and "critical counts" that pick "those with the highest variance between actual and theoretical quantity in the last period close count" [V S9].

**Par levels and re-order**

| State | Who acts | What moves |
|---|---|---|
| Below par | System | Nothing. Item appears on the store keeper's "to order" list, or the bar's "to request" list |
| Ordered or requested | Store keeper or bartender taps "order to par" | Starts a purchase order or a requisition |

Foodics uses three levels per branch: "Minimum level", "Par level" ("the automatic reordering level") and "Maximum level" [V S18]. One par figure per item per store is enough to begin.

---

## 5. Bar-specific control

### 5.1 The standard controls

| Control | How it works | Source |
|---|---|---|
| Opening stock | Counted at the start of the shift; equals the previous closing | [PK] |
| Issues from store | Added during the shift, signed for | [PK]; local practice [V S26] |
| Closing stock | Counted at the end of the shift | [PK] |
| Usage against sales | Usage = opening + issues - closing. Compare with what the till says was sold, item by item. WISK describes it as matching "every ounce sold in your POS against the exact volume missing from the physical bottle"; its example is 40 oz rung against 48 oz gone | [V S22] |
| Tot control | A 750 ml bottle holds 30 tots of 25 ml or 25 tots of 30 ml. Shortage is reported in tots and at selling price | arithmetic; method [PK] |
| Bottle for bottle | The store issues a full bottle only against an empty one. Bar stock per brand stays at par | [PK] |
| Partial bottles | Estimated in tenths by eye, or weighed. WISK calls tenths "wildly inaccurate" and sells a Bluetooth scale that reads "down to the mL" | [V S22]; WISK sells scales, so weigh its opinion accordingly |
| Shift handover count | Outgoing and incoming bartender count together and both sign | [PK] |
| Returnable empties | Beer and soda crates and bottles go back to the distributor. Oracle has a "Deposit Item" flag for this | [V S7]; local detail [PK] |

WISK's page quotes "an industry average shrinkage rate of 15% to 20%" for bars [V S22]. That is a vendor's number with no method given. Use it as a reason to measure, not as a fact.

Standard texts and vendors disagree on tenths. Textbook practice accepts counting open bottles in tenths [PK]; WISK rejects it [V S22]. For Nimbus the error of a tenth is 75 ml, three tots, on one open bottle per brand. That is small beside a missing bottle and costs nothing to build.

### 5.2 What is cheap and what catches the most [P]

| Rank | Control | Build | What it catches |
|---|---|---|---|
| 1 | Whole-bottle count per shift for beer, soda, water, and spirits and wine sold by the bottle, against sold | S | Bottles walking out, sales not rung, a bartender selling his own stock (usage and sales will not match) |
| 2 | Signed issue from main store to bar | M | Loss between the store and the bar; "I never got that crate" |
| 3 | Tots: spirits held in ml, shortage shown in tots and shillings per bartender per shift | S once 1 exists | Over-pouring, free tots for friends, tots not rung |
| 4 | Void after send needs "made or not made" and a reason | S | Serve, collect cash, void |
| 5 | Breakage and comp log with a named person | S | Theft written off as breakage |
| 6 | Open bottles in tenths at handover | S | Tightens 3 |
| 7 | Bottle for bottle (count empties at issue) | S, a number on the issue screen | Bartender bringing in his own bottle to sell; stock hoarding |
| 8 | Weighing open bottles | M, needs a scale | Tightens 3 further. Later |
| 9 | Pour events from a smart spout | L, hardware | A third reading: poured against rung against counted. Nimbus is already sourcing a spout (project note of 25 Nov 2026). Because spirits are held in ml, pour events can drop into the same shift sheet as one more column. No part of the stock design should depend on it |

Build 1 to 5 first. They need no recipes and no hardware.

The shift sheet, per brand: Opening | Issued in | Sold (till) | Should be left | Counted | Short or over | Value at selling price. One row per item, one signature each from the outgoing and incoming bartender.

---

## 6. How people are told

### 6.1 Requesting and issuing stock [P, built on Oracle's flow [V S2]]

| Step | Requester (chef or bartender) sees | Store keeper sees |
|---|---|---|
| Request | Button "Request from store" on their home. A list of their usual items with par and current stock; "fill to par" does it in one tap. Send | A queue card: who, what, how long ago. A sound and a badge count |
| Pick | Status "Being prepared" | Taps the card, adjusts each quantity to what is handed over, taps Issue |
| Ready | A banner and a sound on the kitchen or bar screen: "Ready to collect: beef 5.2 kg, oil 5 l" | Card moves to "Waiting for signature" |
| Sign | Taps Received and enters a PIN (or enters it on the store keeper's device at the hatch). Can enter a shortage | Card closes; a short receipt alerts the manager |
| Walk-up | Nothing to do beforehand | "Issue now": pick the person, pick items, the person enters a PIN on this device. Flagged as a direct issue |

Answer to the owner's question, "a chef is picking some meat ... how is he notified in his UI?": the chef's kitchen screen carries a small strip for store requests. It shows the state of each of his requests and sounds once when one becomes ready. He confirms receipt with his PIN. If he simply walks to the store, the store keeper issues on the spot and the chef signs on the store keeper's device.

### 6.2 Kitchen display systems

What Simphony's kitchen display does, from Oracle's guide:

- A kitchen display is "an order device which communicates order information to a preparation area. Instead of orders printing on a kitchen printer, orders appear on monitors" with "color statuses, timers" [V S12].
- Each ticket is a "chit"; a "suborder" is the part of an order for one station [V S12]. Displays run in "chit mode" or "list mode" [V S13].
- Station kinds named in the function list: Prep Stations, Expo Displays, and SOS (speed of service) Displays [V S13].
- **Bump**: "To remove an order from the KDS Display". "Done" marks an order complete and removes the chit; "Done Item" marks one item [V S12] [V S13].
- **Recall**: "Recall an order from the last 50 orders or the last 15 minutes of orders marked as complete and restart the cook timer"; "Recall Last" brings back the last one; "Review" does the same "without restarting the cook timer" [V S13].
- **Started**: "Order Started", "Prep Start/Stop"; a status "All Prep Done" means "The order is complete at all Prep Stations" [V S12] [V S13].
- **Expo and timing**: "Fire Order" and "Fire Item" send items "on hold due to prep timing to their Prep Stations before they automatically fire. This function only works on Expo Displays." [V S13] So Simphony can hold a fast item until the slow one is nearly ready.
- **Counts**: "Summary Condensed" ("all active orders in list mode without condiments"), "Summary Expanded", "Cook Summary" ("a consolidated list of items sorted by status"), "Production Summary" [V S13].
- **Others**: "Priority Order 1-8", "Mark" (cannot be bumped), "Push Order" and "Pull Order" between stations, "Claim Order" in eight colours, "Print Order Chit", "Print Check", "Media Viewer" for recipe pictures, "Table Detail", remote view of another display; 68 functions in all [V S13].

The usual ticket layout across products [PK]: a header with table or order number, waiter, order type and a running timer; then quantity and item in large type; modifiers indented in a second colour; notes and allergies in a highlighted band; a bump button. Tickets sit oldest first, left to right. Colour moves from normal to warning to late at two time limits. A sound plays on arrival.

### 6.3 The 8 behaviours a first kitchen screen must have [P]

1. **Arrives by itself, at the right station.** A sent line shows on the Kitchen or Bar screen within a second or two, routed by the item's station. Nobody refreshes.
2. **A ticket a cook can read from two metres.** Table, waiter, time sent; quantity and item large; modifiers and notes impossible to miss; allergy in its own band.
3. **Oldest first, with a timer and two colour changes** (for example normal to 10 minutes, amber to 15, red after; set per station).
4. **Bump in one tap, and it tells the waiter.** Done removes the ticket and marks the table "ready" on the waiter's side.
5. **Recall.** The last bumped tickets can be brought back, because cooks bump by mistake.
6. **Sound on arrival,** and again when a ticket turns red.
7. **Changes show, they do not vanish.** A voided or changed line stays on the ticket struck through and flashed, and a void after send asks the "made or not made" question (rule 5 in 3.3).
8. **Keeps working when the network does not.** The screen keeps what it has, shows a plain "offline" banner, catches up without duplicates, and the kitchen printer prints the same ticket as a fall-back.

**What can wait:** an expo screen; all-day counts and summaries; course firing and holds; prep-time delays (Simphony's Fire Item); item-level start and done; rush and priority; pushing tickets between stations; claim colours; recipe pictures; bump bars; speed-of-service reports; splitting one station across two screens.

---

## 7. True cost of goods

### 7.1 Cost methods

| Method | What it is | Fit for a small restaurant |
|---|---|---|
| Last purchase price | Every unit valued at the newest price. Oracle keeps a "Last Purchase Price" field on the item [V S7] | Simple, good for menu pricing. Not a permitted stock valuation on its own [PK] |
| Moving weighted average | After each receipt: new average = (value on hand + value received) / (quantity on hand + quantity received) | **Recommended.** Permitted by IAS 2 [PK]; no batch tracking; smooths market price swings on tomatoes and meat |
| FIFO | Oldest batch is used first | Permitted [PK] but needs batch layers. Too heavy here |
| Standard cost | A set cost, reviewed periodically. Foodics offers "Fixed cost" per storage unit as an alternative to costs "calculated from 'Transactions'" [V S18] | Useful only as a fall-back for an item with no purchases yet |
| LIFO | Newest first | Not permitted under IAS 2 [PK] |

IAS 2 itself was not opened in this pass, and nor was Uganda's reporting framework. Both marks above are [PK] and the accountant should confirm them.

### 7.2 The ideas an accountant will expect

- **Theoretical cost** = what the recipes say the sold items should have used, at cost.
- **Actual cost** = opening stock + purchases - closing stock, from counts.
- **Variance** = actual - theoretical. Part of it is explained by recorded waste, staff meals and comps. The rest is leakage. WISK builds its whole product on this comparison [V S22]; Oracle prints an "Inventory Variance Report" and even lets an item be set to "No Inventory Variances (Theo is ACT)" when it is not worth chasing [V S1] [V S7].
- **Recipe cost roll-up**: a menu item's cost is the sum of its lines at current cost, through any sub-recipes. Loyverse and Square both do this automatically [V S14] [V S24].
- **Menu item margin** = selling price net of VAT - recipe cost. **Food cost %** = recipe cost / selling price net of VAT.

### 7.3 Who sets what [P]

| Comes from purchasing, automatically | The accountant sets or confirms |
|---|---|
| Quantity and price on each goods received note | Opening stock quantities and values on day one |
| Average cost per stock item | An estimated cost for any item not yet bought (so that recipes can be costed from day one) |
| Last purchase price, and the price history | Whether the business is VAT registered (cost is then net of input VAT; otherwise it is the gross price) [PK] |
| Recipe cost and margin on every menu item | Corrections when the supplier's invoice differs from the note |
| Cost of each sale, stamped on its movement | Which account each store, waste reason and item group posts to |
| | Approving count variances and closing the period |

This matches the owner's sentence: the accountant "can see the very same menu items and assign cost on the actual item and then the ingredients". The accountant opens the same menu item the manager built, sees each line with its cost, and can fill in or correct a cost. Nothing is typed twice.

### 7.4 The simplest correct design [P]

1. One average cost per stock item for the whole business, not per store. Moving stock between stores then changes no values.
2. Keep two running figures per stock item: quantity on hand and value on hand. Cost per unit is always value / quantity. A receipt adds to both. A deduction removes quantity x current average, rounded to the shilling, from value. When quantity reaches zero any shilling left over is posted to a rounding account. Nothing drifts and no floating point is used.
3. Money is whole shillings. Unit costs are held as whole millionths of a shilling per base unit (salt costs a fraction of a shilling per gram).
4. Every movement stores its own quantity, unit cost and value. Reports add up movements. They never recompute history from today's prices.
5. Cost of sales for a period = the value of sale movements + waste + staff meals + comps + count variance, each on its own line. The count is what turns the theoretical figure into the true one.
6. A period, once closed by the accountant, takes no more entries. A late correction goes into the open period with a note.

### 7.5 The accounting entries this implies

| Event | Debit | Credit |
|---|---|---|
| Goods received | Inventory (and VAT input, if registered) | Supplier payable, or cash |
| Issue from main store to bar or kitchen | none (stock stays stock; only its place changes) | none |
| Sale | Cash or receivable | Sales, and VAT output |
| Same sale, at cost | Cost of sales (food or beverage) | Inventory |
| Waste, breakage, spoilage | Wastage | Inventory |
| Staff meal, duty drink | Staff meals | Inventory |
| Comp | Complimentary or promotion | Inventory |
| Count shortage (a surplus is the reverse) | Stock variance, within cost of sales | Inventory |
| Return to supplier | Supplier payable | Inventory |
| Supplier invoice differs from the note | Inventory, or price variance if the stock is already used | Supplier payable |

### 7.6 Uganda-specific points

| Point | Status |
|---|---|
| Who must use EFRIS | "All VAT-registered businesses and other businesses which operate in specific designated sectors"; the 12 sectors include accommodation and food services, defined as "the provision of complete meals and drinks fit for immediate consumption" [V S21] |
| E-invoice or e-receipt | E-invoices are issued by VAT-registered persons; others issue e-receipts [V S21] |
| EFRIS keeps stock | Products are configured from the EFRIS list and stocked in "as imports, manufactured goods, or local purchases"; there are "stock adjustment, inquiry, or transfer between branches"; damaged or burnt stock is removed by an adjustment with a reason; a benefit named is detecting theft by comparing stock with sales [V S21] |
| When the fiscal document is made | "The EFRIS invoice is generated only when a sale has occurred" [V S21]. So a printed bill before payment is not the fiscal document; the receipt at payment is [P reading] |
| Offline | "you can issue e-receipts and e-invoices offline for up to five days" on desktop, app and system-to-system; not on the web portal [V S21] |
| Penalty | "A penal tax equal to double the tax due or ten currency points whichever is higher"; a currency point is UGX 20,000 [V S21] |
| Must a good be in EFRIS stock before it can go on a receipt | UNKNOWN from the handbook. Widely said to be so for goods [PK]. If true, every beer received in Nimbus must also be stocked in to EFRIS |
| How a restaurant meal is registered: a service with no stock, or a manufactured good that must be stocked in | UNKNOWN. This decides whether recipes have to be mirrored to EFRIS. It is the single most important tax question for this lane |
| Whether raw ingredients must be in EFRIS stock | UNKNOWN |
| VAT rate and registration threshold | Not in the handbook. 18% and UGX 150 million a year [PK]; confirm |
| Excise on beer and spirits at the restaurant level, service charge, any tourism or hotel levy | UNKNOWN |
| Regional direction | Kenya's revenue authority has published a "Stock Management Functionality for Electronic Invoicing" [2H, title only, kra.go.ke]. Tax authorities in the region are moving toward seeing stock, not just sales |

Design consequence [P]: keep the Nimbus stock ledger as the source, and make every movement type map cleanly to an EFRIS stock action (stock in, adjust with reason, transfer). Then whichever answer the three UNKNOWN rows get, it is a mapping job and not a redesign.

---

## 8. Set-up effort and failure

### 8.1 Why recipe-based stock fails in small restaurants

| Cause | Evidence |
|---|---|
| Too much to enter before anything works. Every ingredient, unit, pack, price and recipe line | [PK]. At hotel level it takes a full-time post: the Kampala controller must "Check and ensure all menu items have a recipe" and link "the articles and Recipes in Material Control" [V S26] |
| A sale with no recipe breaks the back end | Oracle: unlinked menu items "remain in Unbooked Sales until they are linked", with numbered errors to clear by hand [V S4] |
| Recipes rot. The chef changes a portion; nobody changes the system | [PK] |
| Counts are late, rushed or copied from last week, so the "expected" figure is never reset and trust goes | [PK]. Toast makes the count the anchor: depletion "counts down from the 'Stock on Hand' quantity recorded during your most recent physical stock check" [V S16] |
| Units entered wrongly on day one, with no way back | Oracle: wrong base unit means delete and re-add [V S7]. Poster publishes an article on replacing an ingredient that has the wrong unit without losing history [2H, title only] |
| Purchases bought with petty cash at the market never get recorded, so stock goes negative and reports look absurd | [PK] |
| The owner sees a wall of numbers and no answer to "who is stealing" | [PK] |

### 8.2 What the products that cope do about it

- **Default to no recipe.** A Loyverse item is just an item; composite is a switch you turn on later [V S14].
- **Let unfinished recipes exist without doing harm.** Toast: draft recipes do not deplete [V S16].
- **Import.** Square: ingredients "manually or through a CSV import" [V S24].
- **Keep recipes shallow.** Square allows one level only [V S24]; Loyverse three [V S14].
- **Count less, more often.** Oracle's "critical counts" take only the items with the worst variance last time [V S9].
- **Give up on items not worth it.** Oracle's "No Inventory Variances (Theo is ACT)" [V S7].
- **Bottles first.** Bar tools (WISK and its peers) start from bottles and pours, where one item maps to one button [V S22].

### 8.3 A staged path for Nimbus [P]

**Stage 1: the day they open.** Target: one hour of set-up.
- Every menu item is "sold as bought" or "not tracked". No recipes.
- Bottles are tracked: beer, soda, water, wine, spirits. Each spirit gets a bottle size and a tot size; that is the only "recipe" anyone enters, and it is two taps.
- One store, or main store plus bar. "Stock in" is a simple receive screen.
- Bar shift sheet: open count, close count, short or over.
- Manual 86. Void after send asks "made or not made". Waste and breakage log.
- Kitchen screen with the 8 behaviours.

**Stage 2: after a month.**
- Requests and signed issues between main store and bar or kitchen.
- Recipes for the 10 to 20 best-selling dishes, and only their costly lines (meat, fish, chicken, cheese, oil). Salt and garnish can wait for ever.
- Purchases with prices, so average cost, recipe cost and margin appear.
- A weekly count of the 20 highest-value items. Par levels and a "to order" list.
- Staff meals and comps as their own order types.
- The accountant's view: items with no cost, price changes, cost of sales by week.

**Stage 3: full.**
- All recipes; modifiers that deduct; sub-recipes; batch items made and counted; usable % (yield).
- Purchase orders; supplier invoice matching; period close; cost of goods statement with theoretical against actual.
- Variance by shift and by person; open-bottle weighing; pour events from the spout.
- Automatic 86 from stock; combos; takeaway packaging by order type; returnable empties.
- EFRIS stock mapping, once the UNKNOWN rows in 7.6 are answered.

The rule between stages: each stage must give the owner a number he believes before the next one is switched on. Stage 1's number is "bottles short per shift". Stage 2's is "margin on my top 20 dishes". Stage 3's is "cost of goods and leakage for the month".

---

## 9. Synthesis for Nimbus [P throughout]

### 9.1 Minimal data model

| Entity | Key fields |
|---|---|
| **Stock item** | id; name; kind (count, weight, volume); group (bar, kitchen, other); recipe-unit default; count-unit default; purchase-unit default; usable % (default 100); made in batches (yes/no); par per store; estimated cost (fall-back); active; retired at |
| **Unit** (standard) | id; name; kind; size in base units (kg = 1,000 g; litre = 1,000 ml; piece = 1) |
| **Pack** (per item conversion) | id; stock item; name ("crate", "bottle", "tot"); size in base units as a whole number; active |
| **Store** | id; name; type (main, outlet); sells for which stations; keeper; active. A system "on the way" bucket exists per destination |
| **Stock level** | store; stock item; quantity; updated at. A running total built from movements. Never edited by hand |
| **Item cost** | stock item; quantity on hand (all stores); value on hand; last purchase price. Built from movements |
| **Movement** (append-only) | id; time on device and on server; store; stock item; quantity (signed, thousandths of base unit); unit cost at that moment; value; type (opening, receipt, issue out, issue in, sale, sale reversal, waste, staff meal, comp, count adjustment, return to supplier, production in, production out, cost adjustment); source document and line; order line id (unique per deduction); recipe version; who; device; reason; corrects movement id |
| **Menu item link** | menu item; sold as (as bought, measure, recipe, not tracked, combo); current recipe version |
| **Recipe** (versioned) | id; menu item or batch stock item; version; status (draft, complete); makes how much (for a batch); effective from; made by |
| **Recipe line** | recipe version; stock item or sub-recipe; quantity; unit or pack; note |
| **Supplier** | id; name; phone; VAT registered |
| **Purchase order** (stage 3) | id; supplier; state; lines (item, quantity, pack, expected price) |
| **Receipt** (goods received note) | id; supplier; store; state; delivery note number and photo; lines (item, quantity, pack, price, VAT); posted by; matched invoice |
| **Requisition / issue** | id; from store; to store; state (requested, issued, received, received short, declined, cancelled); requested by; issued by; received by; direct issue (yes/no); lines (item, requested, issued, received) |
| **Count** | id; store; list; state (started, submitted, approved); started at; counted by; approved by; lines (item, counted full packs, counted loose, expected at start, difference, recount) |
| **Waste entry** | id; store; item or menu item; quantity; reason; who; photo; order line (for a void that was made); reviewed by |
| **Bar shift** | id; store; opened by; closed by; opening count id; closing count id; signatures |
| **Alert** | id; rule broken; who; what; when; seen by |

### 9.2 "Create a menu item": three cases

Typing a name and a price is not counted as a tap. Each form shows cost and margin as soon as a cost is known.

**A bottle of beer** (3 taps)
1. Menu, tap "+ Item".
2. Type name "Nile Special 500 ml". Tap category "Beers". Type price.
3. "How is it sold?" is already on "Sold as bought". The line under it reads "Tracks stock of: Nile Special 500 ml (new), counted in bottles".
4. Optional: "Bought in crates of [25]".
5. Tap Save.

**A tot of whisky** (5 taps)
1. Tap "+ Item".
2. Type name. Tap category "Whiskeys". Type price.
3. Tap "A measure".
4. Tap the bottle it comes from (search list), or "New bottle" and tap a size chip: 750 ml, 1 litre.
5. Tap a measure chip: 25 ml, 30 ml, double, glass 150 ml, other. The form reads "1 bottle = 30 tots".
6. Tap Save. A prompt offers "Also sell by the bottle?"; one more tap and a price makes the second menu item on the same stock.

**A burger** (3 taps, plus 1 tap and a number per ingredient)
1. Tap "+ Item".
2. Type name. Tap category "Mains". Type price.
3. Tap "Made from a recipe".
4. For each ingredient: type two letters, tap the match, type the quantity. The unit is already the item's recipe unit (bun: piece; beef: g; oil: ml) and can be switched only among that item's units. A missing ingredient is created inline by choosing piece, weight or volume.
5. Tap Save, or "Save as draft" if the chef is not sure yet. A draft sells and is flagged.

The form for a burger at illustrative prices would read: bun 1 piece, beef mince 150 g, cheese 1 slice, oil 10 ml; cost per portion and food cost % shown at the foot as lines are added.

### 9.3 Roles and what each home shows

| Role | Home shows, top to bottom | Main buttons |
|---|---|---|
| **Store manager / store keeper** | Requests waiting (count and age); Waiting for signature; Deliveries expected today; Below par ("to order"); Count due | Issue, Receive, Count, Waste, Issue now |
| **Chef** | The kitchen screen. A slim strip for store requests ("Ready to collect") and for 86 | Bump, Recall, 86 / set countdown, Request from store, Log waste |
| **Bartender** | The order screen. Shift status (open count done or not). Requests | Open shift count, Close shift count, Request from store, Receive, Breakage |
| **Accountant** | Cost of sales this period, theoretical against actual; Items with no cost; Receipts to match; Price changes over 30%; Variances waiting for approval | Open a menu item's cost, Match invoice, Approve count, Close period |
| **Manager** | Alerts from soft rules (voids after send, sales at zero stock, direct issues, unsigned issues, short receipts, large variances); 86 list; top and bottom margins | Menu and recipes, Approve, Stores set-up |
| **Owner** | Leakage in shillings: short or over by store and shift; top 10 loss items; waste, comps and voids by person | Read only |

### 9.4 The 15 highest-value features, ranked

| # | Feature | Cost | Leakage it catches |
|---|---|---|---|
| 1 | Append-only stock ledger with who, when, device, reason | M | The base for all the rest; stops records being quietly edited |
| 2 | "Sold as bought" default with whole-bottle deduction on send | S | Bottles sold and not rung; bottles walking out |
| 3 | Bar shift sheet: opening + issues - closing against sold, signed by both bartenders | M | The largest single bar loss; pins it to a shift and a person |
| 4 | Tots: spirits in ml, shortage in tots and shillings | S | Over-pouring, free tots, tots not rung |
| 5 | Void after send: "made or not made" plus reason, with alert | S | Serve, pocket the cash, void |
| 6 | Requisition with two signatures and an "on the way" figure | M | Loss between store and outlet; store keeper pilferage |
| 7 | Goods received with quantity, weight and price; price-jump alert | M | Short deliveries, inflated prices, collusion with a supplier |
| 8 | Blind count with variance and recount prompt | M | Every unexplained loss; resets trust in the figures |
| 9 | Waste, breakage, staff meal and comp log with a named person | S | Theft dressed as waste; over-generous comps |
| 10 | Kitchen screen with the 8 behaviours | M | Food leaving the kitchen with no order |
| 11 | Recipes for top sellers with cost and margin | M | Over-portioning; dishes priced below cost |
| 12 | Moving average cost and a cost-of-sales report, theoretical against actual | M | Puts one shilling figure on leakage for the owner |
| 13 | Par levels and a "to order" list | S | Over-buying; emergency cash purchases that nobody records |
| 14 | 86 and countdown | S | Not leakage. Fewer voids and fewer disappointed guests |
| 15 | Batch items, sub-recipes that are counted, usable % | L | Sauce and butchery loss; fine-tunes 11 and 12 |

### 9.5 Ten things competitors do that Nimbus should not copy

1. **A separate inventory product fed overnight, with an error queue to clear.** Simphony's "Unbooked Sales" and numbered booking errors [V S4]. In Nimbus the order and the stock entry are one save.
2. **Making a recipe a precondition for selling or for stock to work.** Default to "sold as bought".
3. **Long document chains shown to the user.** Oracle's six-step request and its suspended, pending, booked, invoiced states [V S2] [V S1]. Three states are enough.
4. **Deep classification trees.** Over groups, major groups, item groups, categories, account classes, visibility criteria [V S1]. One group field.
5. **Free-form units with a typed base.** Oracle's "Bottle 0.35" with base "pint" [V S8]. Three kinds, picked from chips.
6. **US units.** Ounces, pounds, gallons [V S19] [V S22]. Grams, millilitres, pieces only.
7. **Blocking a sale because stock shows zero.** The guest is at the table and the stock figure is the thing more likely to be wrong.
8. **Recipes that cannot handle real menus.** Square: no recipe of a recipe, modifiers do not deduct, items with variations cannot have recipes [V S24]. A double must deduct two tots.
9. **Hardware as a precondition for control.** Scales [V S22], bump bars [V S13], spouts. Each is a later add-on that feeds the same ledger.
10. **Modules for a different customer.** Vendor catalogues and B2B ordering, nutrient and allergen catalogues, HACCP, event menu planning, mobile handheld management, 68 kitchen-display functions [V S1] [V S13]. None helps a Kampala bar this year.

### 9.6 Questions the Simphony first-hand scan must answer

Stores and depletion
1. In the live property, what cost centres exist, and which revenue centre is linked to which? Is the main store excluded from sales depletion?
2. Can one revenue centre deplete two cost centres (food from kitchen, drinks from bar)? If so, where is it set: on the menu item link, on the item group, or elsewhere?
3. When do POS sales reach inventory: only after end of day, or during the day? Is there any live stock figure on the POS?
4. What does "allocation" mean in their set-up, if the word is used at all?

Requests and issues
5. The real screens and state names for an issue request, from request to acceptance. How many clicks at each step?
6. How is the requester told that a request was booked? On screen, by email, by task list, or not at all?
7. Is acceptance by the requester switched on, or made automatic by user rights? What do staff actually do?
8. Is there any signature, PIN or printed slip at the hand-over?

Items, units, recipes
9. The real unit list for a spirit: base unit, bottle, tot. How is a 25 ml tot linked to a menu item?
10. How is a sale by the bottle and by the tot of the same whisky set up: two menu items, one item at two menu levels, or a ratio link?
11. What do "Menu Item Linking With Negative Quantities" and linking by order type look like in practice?
12. How are sauces handled: production documents, "Count as Recipe", or passed through?
13. Is "Gain/Loss" used on items, or is yield left out?

POS side
14. What happens to stock on a void before send, a void after send, a return, a comp? What reason codes exist, and what is a "POS waste check" from the cashier's side?
15. Is there an item countdown or "out of item" function on the POS, who can set it, and is it tied to inventory?

Counts, cost, kitchen
16. Count sheet layout, freeze and unfreeze in practice, how partial bottles are entered, and what the variance report shows.
17. Which cost method is in use (average, last price), where it is set, and what the cost of sales report looks like.
18. Kitchen display: ticket layout, the colours and time limits in use, which toolbar buttons the kitchen really uses, whether an expo screen exists, and what happens to the screens when the network drops.
19. How many people does it take to keep this running at that property, and what do they do in Excel or on paper beside it?

---

## 10. Method and limits

### 10.1 What was done

13 searches and 26 page reads, all on 26 Nov 2026, plus one project note. The brief asked for about 25 in total; I went over because Oracle's guide is split into many small pages and the first reads of several returned only part of what was needed. Search results in this environment return titles and links only, with no snippet, so a [2H] here usually means "the title says so".

### 10.2 Pages opened ([V])

| # | Source | URL |
|---|---|---|
| S1 | Oracle, Inventory Management User's Guide, table of contents | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/toc.htm |
| S2 | Oracle, Issue Requests and Transfer Process (20.1) | https://docs.oracle.com/en/industries/food-beverage/back-office/20.1/invug/c_requests_issue_request_and_transfer_process.htm |
| S3 | Oracle, Menu Item Linking | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/c_mi_linking.htm |
| S4 | Oracle, Booking Sales | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/c_booking_sales.htm |
| S5 | Oracle, Cost Centers and Locations | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/c_maintenance_cc_and_locations.htm |
| S6 | Oracle, Link a Cost Center to a Revenue Center | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/t_maintenance_cc_and_locations_link_cc.htm |
| S7 | Oracle, Creating a New Item | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/t_masterdata_create_item.htm |
| S8 | Oracle, Creating a Unit | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/t_masterdata_create_unit.htm |
| S9 | Oracle, Inventory Settings | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/r_maintenance_inv_settings.htm |
| S10 | Oracle, Booking Unbooked POS Waste Checks (two steps only) | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/t_booking_sales_book_unbooked_pos_wastechecks.htm |
| S11 | Oracle, Cost Centers (master data). Opened; body came back empty. Nothing cited from it | https://docs.oracle.com/en/industries/food-beverage/back-office/invug/c_masterdata_cc.htm |
| S12 | Oracle, Simphony KDS Configuration and User Guide 18.2, KDS Basics | https://docs.oracle.com/cd/F10429_01/doc.182/f10216/c_kds_basics.htm |
| S13 | Oracle, Simphony KDS 18.2, KDS Bump Bar Functions | https://docs.oracle.com/cd/F10429_01/doc.182/f10216/r_kds_bump_bar_functions.htm |
| S14 | Loyverse, How to Create a Composite Item | https://help.loyverse.com/help/how-create-composite-item |
| S15 | Loyverse, How to sell liquids | https://help.loyverse.com/help/how-sell-liquids |
| S16 | Toast, Toast Inventory Stock Depletion (Canada, Ireland and UK) | https://intercom.help/toast-central/en/articles/13793466-toast-inventory-stock-depletion-canada-ireland-and-uk |
| S17 | Toast platform guide, menu item inventory overview | https://doc.toasttab.com/doc/platformguide/adminMenuItemInventoryOverview.html |
| S18 | Foodics, Inventory Items Overview | https://foodics.helpjuice.com/558310-inventory-items-overview |
| S19 | Restaurant365, Unit of Measure Conversions | https://docs.restaurant365.com/docs/unit-of-measure-conversions |
| S20 | Odoo forum, POS inventory real time versus at closing of the session (a forum answer) | https://www.odoo.com/hi_IN/forum/help-1/pos-what-is-the-configuration-inventory-real-time-vs-at-closing-of-the-session-and-how-to-use-it-198659 |
| S21 | Uganda Revenue Authority, EFRIS Handbook FY 2026-27 (PDF; page numbers uncertain) | https://ura.go.ug/storage/2026/08/EFRIS-HANDBOOK-FY-2026-27.pdf |
| S22 | WISK, blog on liquor theft, over-pouring and shrinkage (vendor marketing) | https://www.wisk.ai/blog/how-do-hotel-bars-and-restaurants-prevent-liquor-theft-overpouring-and-shrinkage |
| S23 | Lightspeed Restaurant K-Series, Adding production batches | https://k-series-support.lightspeedhq.com/hc/articles/4406100692763 |
| S24 | Square, Track ingredient costs with Square Recipes (beta) | https://squareup.com/help/us/en/article/8629-beta-track-ingredient-costs-with-square-recipes |
| S25 | UgaPOS, "Best POS software in Uganda 2025" (the publisher ranks its own product first; promotional) | https://ugapos.com/best-pos-software-in-uganda-2025-complete-buyers-guide-reviews |
| S26 | Great Uganda Jobs, Food and Beverages Stock Controller for a Kampala hospitality client, posted 26 May 2023 | https://greatugandajobs.com/jobs/job-detail/job-Qssu-Ftr-Fbc-Food-Beverages-Stock-Controller-job-at-Q-Sourcing-Limited-trading-45567 |

Also read: the project note "smart-pour-spout-supplier-outreach.md" (Nimbus project, dated 25 Nov 2026), for the spout plan mentioned in 5.2.

### 10.3 What is used in East African hotels and restaurants

- Oracle Materials Control is in use at a Kampala hotel-grade property, run by a dedicated stock controller [V S26]. This fits the owner's remark about Simphony.
- A local vendor's guide names UgaPOS, Lightspeed Retail, Square, Loyverse, Toast, Shopify and Clover as the options a Ugandan buyer weighs, and says of most foreign ones that they lack mobile money and work poorly offline [V S25]. It is promotional and it does not mention EFRIS, bars or hotels. Treat its judgments as [2H].
- Seen in search titles only [2H]: Pesapal's POS for clubs and bars; Odoo partners and customers in Uganda; Odoo add-ons for EFRIS (for example "aminitech efris suite", "kola efris client").
- Paper requisition books, Excel bar stock sheets and a general accounting package beside the POS are the usual reality in mid-sized places [PK].

### 10.4 Where sources disagree

- **When to deduct.** Toast's countdown: on send [V S17]. Lightspeed: when "created or ordered" [V S23]. Square and Loyverse: when "sold" [V S24] [V S14]. Simphony: booked after end of day [V S4]. Odoo: either, by setting, and its own advice changed between version 15 and 16 [V S20].
- **When an issue moves stock.** Oracle: only when the requester accepts [V S2]. My proposal moves it at issue into an "on the way" bucket.
- **Sauces.** Toast and Oracle deplete the prepared item itself [V S16] [V S7]; Loyverse's nesting and Odoo's kit pass through to raw ingredients [V S14] [PK]; Square does not allow it at all [V S24].
- **Tenths.** Textbook practice accepts them [PK]; WISK calls them "wildly inaccurate" [V S22] and sells the alternative.

### 10.5 What I could not reach or verify

- **Not reached at all:** MarketMan; Apicbase; Toast xtraCHEF (the Toast inventory page opened is a separate beta for other countries); BevSpot; BinWise; iiko and r_keeper (one search returned nothing usable); Odoo's own manual on Bill of Materials, kits, warehouses and internal transfers; Oracle Materials Control's own guide (the Inventory Management guide is its successor); Lightspeed's current Inventory add-on.
- **Simphony gaps:** the POS-side handling of voids, returns and waste; item countdown on the POS; whether sales reach inventory during the day; negative stock; the cost method; cost centre types; the word "allocation"; split depletion per revenue centre; the kitchen display's layout, colours and course firing (only the glossary and function list were read).
- **Vendor silence:** no page opened states what happens to stock on a void after preparation, a refund or a comp. Those rules in 3.2 are standard practice from memory.
- **Accounting:** IAS 2 and Uganda's reporting framework were not opened.
- **Uganda tax:** VAT rate and threshold; whether goods must be in EFRIS stock before a receipt; how a restaurant meal is classed in EFRIS; whether ingredients must be stocked in EFRIS; excise and levies at restaurant level. The EFRIS interface specification was seen only as a Scribd title.
- **Numbers:** WISK's 15 to 20% shrinkage and its savings claims are the vendor's own, with no method.
- **Everything marked [PK]** is from memory and should be treated as unknown until checked.
