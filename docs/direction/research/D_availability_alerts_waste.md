# D. Availability, alerts, waste and the reports that close the loop

Research for Nimbus POS (Uganda, table service + bar). Date of research: 26 Nov 2026.

## How to read the marks

- **[V]** I opened the vendor page in this session and the claim comes from it. URL follows.
- **[2H]** A review, summary or third party says so.
- **[PK]** From memory, not checked in this session. Treat as a lead, not a fact.
- **UNKNOWN** Not found in anything I opened. I have not inferred it.

Important limit on every [V]: pages were read through a fetch tool that returns an extracted summary with quotes, not the raw HTML. Quoted phrases are as that tool returned them. Screenshots on the pages (for example Toast's waste Reason drop-down) were not readable. See section 8.

Source keys used below:

| Key | Page | URL |
|---|---|---|
| T1 | Toast: 86 an Item on the POS or Toast Web | https://support.toasttab.com/en/article/86-an-Item |
| T2 | Toast platform guide: menu item inventory overview | https://doc.toasttab.com/doc/platformguide/adminMenuItemInventoryOverview.html |
| T3 | Toast: Set a Count on Menu Items | https://support.toasttab.com/en/article/Setting-the-Stock-Status-and-Count-for-Menu-Items |
| T4 | Toast Inventory: Stock Depletion (Canada, Ireland, UK; beta) | https://intercom.help/toast-central/en/articles/13793466-toast-inventory-stock-depletion-canada-ireland-and-uk |
| T5 | xtraCHEF by Toast: Inventory Waste | https://support.toasttab.com/en/article/xtraCHEF-Inventory-Waste |
| S1 | Square: Managing items with Square for Restaurants | https://squareup.com/help/us/en/article/6425-managing-items-with-square-for-restaurants |
| LK1 | Lightspeed K-Series: About stock (legacy Stock) | https://k-series-support.lightspeedhq.com/hc/en-us/articles/4406100305051 |
| LK2 | Lightspeed K-Series: Wastage (Inventory module) | https://k-series-support.lightspeedhq.com/hc/articles/7116014889499 |
| LO1 | Lightspeed O-Series (ex-Kounta): Tracking Wastage | https://o-series-support.lightspeedhq.com/hc/en-us/articles/201521214-Tracking-Wastage |
| R1 | Restaurant365: Waste Logs Overview and Security | https://docs.restaurant365.com/docs/waste-logs-overview-security |
| LV1 | Loyverse: Notification About Low Stock | https://help.loyverse.com/help/low-stocks |
| LV2 | Loyverse: Advanced Inventory (index page only) | https://help.loyverse.com/help/advanced-inventory |
| PP1 | Petpooja blog: item availability on/off (vendor marketing) | https://blog.petpooja.com/industry-business-guides/item-availability-menu-on-off-stop-cancelled-orders/ |
| UG1 | RestaurantOS (Uganda-first) product page | https://restaurant-os-ug.vercel.app/ |

Not opened at all (so nothing below about them is better than [PK]): Oracle MICROS Simphony, TouchBistro, Revel, Odoo, MarketMan, Apicbase, WISK, BevSpot, Lightspeed L-Series.

---

## 1. Item availability on the menu

**Takeaway: the leaders give waiters a manual 86 and a per-item countdown that flips to sold out at zero, but in the pages I opened none of the big US/EU products switches a dish off automatically because an ingredient ran out; only Petpooja's own blog claims that. The owner's "lamb chops disappear when the kitchen store is empty" is ahead of Toast, not behind it.**

### What each product does

**Toast**

- Three states per menu item: "In Stock", "Out of Stock", "Quantity". "In Stock is the default value when you add a new menu item." [V] T2
- Manual 86 on the terminal: log in with a manager passcode, press and hold the menu or modifier button to open Quick Edit, choose Inventory > Out of stock, Done, Save and continue. [V] T1
- What the waiter sees: the button is "grayed out, can't be selected, and shows a zero in the corner." [V] T1. With a Quantity set, the number shows on the button. [V] T2
- Countdown: only starts after someone sets a Quantity by hand. It drops "each time you order that menu item"; example given is 8 dropping to 6 after two burgers are "ordered and sent to the kitchen." [V] T2
- At zero: "the Toast platform automatically changes the inventory status to Out of Stock." [V] T2. The platform "will not allow the server to add the menu item to an order." [V] T2
- When the count drops: on send, unless the restaurant has "Send orders after check is paid" switched on, in which case after payment. Also requires an auto-firing device to be set up and running, and the restaurant not in Test Mode. [V] T3
- Who: manager-level passcode on the POS; in the Toast Now phone app, permission "4.5 Edit Full Menu or 5.2 Inventory & Quantity." [V] T1
- Reset: none. The item "stays out of stock, or 86'd, until you mark it back in stock." [V] T1. A quantity item stays unavailable until someone enters a new quantity. [V] T3
- Modifiers can be 86'd the same way. [V] T1
- Sync: the 86 applies to Toast online ordering; "Changes can take a few minutes to sync across channels." Changes made in Toast Web reach terminals only "when you publish the change." [V] T1, T2
- Multi-location: the 86 applies only to the location you are viewing. [V] T1
- Ingredient-driven: no. The menu countdown "is not related to the Toast Inventory module." [V] T2. In Toast Inventory (beta, four markets), an ingredient at zero gets an "Out" label on the reorder list and staff "can update your POS by 86ing the item", a manual step. [V] T4
- Item already on an unsent order when it is 86'd: not covered by T1, T2 or T3. UNKNOWN.
- Voided line returning to the count: not covered. UNKNOWN.
- Ordering 3 when 2 remain: not covered. UNKNOWN.
- Offline behaviour of the countdown across several terminals: not covered. UNKNOWN.
- Future orders: Toast "cannot reserve limited-quantity items" for advance orders. [V] T1

**Square for Restaurants**

- Manual: long-press the item on the Menu tab > Edit Availability (or Mark as sold out); also from the Items applet and the web Dashboard. Square's own words: "86 the items by marking them as 'sold out'." [V] S1
- Count: mark an item Available and give a remaining quantity; Available with no quantity means unlimited. Per variation (each size has its own count). [V] S1
- Reset: sold-out items "will be marked as available again at the end of each business day unless a reset availability is chosen"; a specific reset time can be scheduled instead. Business day comes from location hours. [V] S1
- Who: account owner and team members with the items permission. [V] S1
- Committed stock: the Dashboard shows "On hand" and "Available", where Available is on hand minus stock committed to open checks, saved carts and scheduled orders. [V] S1
- Sync: "Available and sold out status are updated across channels." No bulk edit of availability. [V] S1
- What the waiter sees on the tile: not described in S1. UNKNOWN. [PK] a "Sold out" label on the tile and a remaining count; unchecked.
- Ingredient-driven: UNKNOWN. [PK] Square has no native recipe-level depletion; it relies on partner apps. Unchecked.
- Item on an open order when marked sold out: not stated. UNKNOWN (though the committed-stock rule above means open checks already hold their quantity).

**Lightspeed Restaurant**

- K-Series: the legacy Stock module is closed to new customers since June 2023; new customers are sent to the paid Inventory add-on. [V] LK1. POS-side item availability and countdown: I did not open a page that covers it. UNKNOWN. [PK] K-Series has an item availability screen with available / limited quantity / unavailable; unchecked. A third-party page on this was found but not opened: https://storekit.com/docs/guides/integrations/pos/lightspeed/stock-and-availability
- O-Series (ex-Kounta): stock on hand is reduced by sales and wastage [V] LO1; POS-side 86 UNKNOWN.
- L-Series: UNKNOWN (nothing opened).

**Petpooja (India)**: vendor blog, so read as a claim, not a verified behaviour.

- An on/off switch per dish in the POS. "When a dish is off, it greys out on your POS screen and drops off Swiggy and Zomato." Off does not delete price, recipe or photo. [V] PP1
- Ingredient-driven: the blog says dishes are linked to recipes, each sale deducts ingredients and the item pauses when an ingredient is too low to make it; items without a recipe (bottled drinks) use a direct count that pauses at zero; a low-stock threshold lets a dish pause early to leave a buffer for orders in progress; the item comes back by itself when stock rises above the threshold. [V] PP1 (marketing copy; exact product behaviour and roles not confirmed)
- Who can toggle: not stated. UNKNOWN.
- Timed menus (breakfast off at 11:00) exist; a "snooze for N hours" is described only as what "many systems" do. [V] PP1

**Others**

- Oracle MICROS Simphony: [PK] a "Menu Item Availability" function lets a privileged employee set a count; the count shows on the key and the item is refused at zero. Unchecked, no URL.
- TouchBistro: [PK] menu item countdown set by a manager, auto 86 at zero. Unchecked.
- Revel: [PK] inventory-linked "out of stock" on buttons with remaining quantity. Unchecked.
- Loyverse: stock is per item per store, with "low" and "out of stock" markers in the back office. [V] LV1. Whether the POS blocks the sale at zero: UNKNOWN. [PK] Loyverse lets stock go negative rather than blocking. Unchecked.
- Odoo POS: UNKNOWN.
- RestaurantOS (Uganda): page lists "low-stock risks, wastage, and recipe-linked usage"; says nothing about sold-out on the menu. [V] UG1

### Table

| Product | Manual 86 | Countdown | Ingredient-driven | Reset rule | Source |
|---|---|---|---|---|---|
| Toast | Yes. Long-press button > Inventory > Out of stock. Manager passcode. Button grey with "0". [V] | Yes. Set Quantity; shows on button; drops on send (or on payment if that setting is on); auto Out of Stock at 0. [V] | No. Inventory module flags "Out" on reorder list; staff 86 by hand. [V] | Never. Stays 86'd "until you mark it back in stock". [V] | T1, T2, T3, T4 |
| Square for Restaurants | Yes. Long-press > Edit Availability / Mark as sold out. Items permission. [V] | Yes. Available + remaining quantity, per variation. [V] | UNKNOWN | Auto: available again "at the end of each business day" unless a reset time is chosen. [V] | S1 |
| Lightspeed K-Series | UNKNOWN ([PK] yes) | UNKNOWN ([PK] yes) | UNKNOWN | UNKNOWN | LK1 (only says legacy Stock closed to new customers) |
| Lightspeed O-Series | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | LO1 |
| Lightspeed L-Series | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | not opened |
| Petpooja | Yes. On/off switch per dish; greys out on POS. [V, vendor blog] | Yes for no-recipe items (direct count, pause at 0). [V, vendor blog] | Claimed yes, with early-pause threshold and auto return. [V, vendor blog] | Stock-linked items return when stock rises; manual pauses UNKNOWN. | PP1 |
| Oracle Simphony | [PK] yes | [PK] yes | UNKNOWN | UNKNOWN | not opened |
| TouchBistro | [PK] yes | [PK] yes | UNKNOWN | UNKNOWN | not opened |
| Revel | [PK] yes | [PK] yes | [PK] partly | UNKNOWN | not opened |
| Loyverse | UNKNOWN | Stock tracked per item/store [V]; POS block at zero UNKNOWN | Composite items: stock tracked on components, "not tracked for composite items as a whole" [V] | UNKNOWN | LV1 |
| Odoo POS | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | not opened |
| RestaurantOS (UG) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UG1 |

### Where sources disagree (reported, not resolved)

- Reset: Toast keeps an item 86'd forever until a person reverses it [V] T1; Square reopens it at the end of the business day by default [V] S1. Two leaders, opposite defaults.
- Speed of the 86 on Toast: T1 describes the terminal long-press as immediate but also says to allow "a few minutes" for sync; T2 says a web change reaches terminals only on publish. Both [V]. They describe different entry points, but a reader of only one would get the wrong picture.
- Ingredient-driven sold-out: Toast says no, manual step [V] T4; Petpooja's blog says yes, automatic [V] PP1 (marketing).

### What this means for Nimbus (analyst note, not a source claim)

- The gap the owner described (auto sold-out from the kitchen store) is real and unfilled by Toast in what I read. It is worth building, with Petpooja's "pause a little early" buffer so orders in flight can still be cooked.
- Nobody I read documents what happens to a sold-out item sitting on an unsent order. Because Nimbus deducts on send, the check has to happen at send, with a plain message to the waiter who lost the race. Square's "available = on hand minus committed to open checks" is the only documented idea in this area.
- Reset should not be a clock (Square) or never (Toast). For a venue with a store keeper, the natural reset is "stock received into the kitchen store", with a manual override.

---

## 2. Low-stock and reorder alerts

**Takeaway: the documented pattern is a per-item, per-store threshold, a coloured "Low / Out" tag on a list, and at most one daily email to the owner; nothing I opened sends SMS or WhatsApp, and nothing documents snooze or "once per crossing".**

| Mechanism | Product | How it works | Who gets it, by what channel | Fatigue rule | Mark and source |
|---|---|---|---|---|---|
| Par level per ingredient | Toast Inventory (beta) | Item "will receive a Low tag once depletion causes the stock to drop below that level"; zero stock gets an "Out" label | On-screen list in Toast Web: Inventory > Reorder suggestion | Item leaves the list once restocked or above par | [V] T4 |
| Low stock field per item, per store | Loyverse | "the quantity at which you want to be notified"; each store has its own field; bulk set by CSV | "the account owner and employees who have the access right to Manage items in the Back Office"; email + marker in item list with a Stock alert filter (All / Low stock / Out-of-stock) | "sent daily at 10:00 AM"; "If no items meet the low stock condition, no email will be sent". Whether an item that stays low repeats daily: not stated | [V] LV1 |
| Rules | Lightspeed K-Series legacy Stock | "notifications for stock levels by location, product, or quantity" | Channel UNKNOWN | UNKNOWN | [V] LK1 |
| Early-pause threshold | Petpooja | Dish pauses on POS when ingredient falls under threshold | Staff see grey button; apps show sold out | Auto returns above threshold | [V, vendor blog] PP1 |
| "Low-stock risks" in owner's daily view | RestaurantOS (UG) | "stock signals" in a daily owner view | On-screen; WhatsApp is listed only as a contact method, not an alert channel | UNKNOWN | [V] UG1 |
| Low-stock alert email | Square | Per-item alert threshold, daily email | Owner email | UNKNOWN | [PK]; S1 does not cover alerts [V]. Unopened lead: https://square.com/help/us/en/article/6142 |
| Min / max reordering rules | Odoo Inventory | Rule per product per location; replenishment report proposes quantities; can auto-raise a purchase or an internal transfer | On-screen activity / replenishment list | UNKNOWN | [PK], not opened |
| Order-to-par suggestion | MarketMan, Apicbase | Suggested order = par minus on hand | App / email | UNKNOWN | [PK], not opened |
| Days of stock left | any | Stock on hand divided by average daily usage | n/a | n/a | UNKNOWN in everything opened. [PK] exists in several back-office tools; unchecked |
| App push | Toast Now app exists and can change item quantity [V] T1 | Push alert on low stock | UNKNOWN | UNKNOWN | UNKNOWN |
| SMS / WhatsApp alert | none found | n/a | n/a | n/a | UNKNOWN: not on any page I opened |
| Snooze, once per crossing, digest | Loyverse only (digest) | Daily digest at a fixed hour, silent when empty | see above | Snooze and once-per-crossing: UNKNOWN anywhere | [V] LV1 for digest |

Terms, as the sources use them: Toast uses "par level" as the alert line [V] T4; Loyverse uses "Low stock" as a notify-at quantity [V] LV1. Minimum level versus reorder point versus par as three separate numbers: not distinguished in anything I opened. [PK] in the trade, par = the quantity you want on the shelf after a delivery, reorder point = the level that triggers a buy, minimum = the safety floor.

Analyst note: Loyverse's 10:00 email is too late for a Kampala kitchen that buys at the market early, and email is the wrong channel. The pattern worth keeping is the shape (threshold per store, silent when nothing is low, one digest), sent at a time the venue sets and through WhatsApp or SMS, plus an on-screen tag at the moment the kitchen store crosses the line.

---

## 3. Multi-location stock (main store, sub-store, kitchen and bar)

**Takeaway: this is the thinnest area of evidence. I could verify that the products keep stock per location and have a transfer function, but not the transfer states, who confirms, or how shortages are recorded. Most of this section is [PK] or UNKNOWN and should be researched again before it drives design.**

Verified:

- Loyverse keeps "In stock" and "Low stock" separately for each store. [V] LV1. It has a help article titled "How to Work with Transfer Orders"; I saw the title only, not the content. [V] LV2 (title only)
- Lightspeed K-Series legacy Stock has stock locations, and "Stock Movements" that track "purchases, production, sales, and waste" and cover transfers. [V] LK1
- Toast: an 86 is per location [V] T1. Prep recipes: depletion hits "the stock of the prep item itself, rather than its individual raw components" [V] T4, which matters for a kitchen store that holds prepared sauces and marinated meat.
- Toast's "Reorder suggestion" is a purchasing list (buy from supplier), not an internal requisition. [V] T4
- Square shows committed versus available stock. [V] S1

From memory, unchecked:

- Loyverse transfer orders: created at the source, status "In transit", then "Transferred" when the destination receives. [PK]
- Odoo: internal transfers run Draft > Waiting > Ready > Done; a two-step route puts goods in a transit location between warehouses; a short receipt creates a backorder or is closed with "no backorder"; reordering rules can raise the internal transfer automatically from min/max. [PK]
- Restaurant365: item transfers between locations, sender creates and receiver approves. [PK]
- MarketMan and Apicbase: outlets order from a central kitchen or commissary as if it were a supplier; order suggested from par. [PK]
- Oracle (Simphony inventory back office): requisitions and transfers between cost centres. [PK]

UNKNOWN in everything opened:

- A named "in transit" state with a screen showing what is on its way.
- Who confirms receipt and whether a PIN or signature is used.
- How a short receipt is coded (short-shipped, damaged in transit, lost) and where the difference is posted.
- Auto-suggested requisition from point-store par levels (kitchen asks main store, not supplier).

Analyst note: nothing found contradicts Nimbus's Requested > Issued > Received (PIN) / Received short / Declined flow. Equally, nothing I opened confirms that the leaders do it this way. The three-level main > secondary > point structure looks like hotel and East African practice more than US cloud-POS practice; the US products mostly model "locations" as separate restaurants.

---

## 4. Waste, spoilage and loss logging

**Takeaway: every product logs waste as item + reason + quantity, but the reason lists are short, often fixed, and none of the ones I could read contains "stolen" or "missing"; theft is expected to appear as count variance, not as a button.**

### Reason lists, verbatim as far as the pages show them

| Product | Reasons (verbatim) | Can staff add their own? | Mark and source |
|---|---|---|---|
| Lightspeed O-Series | Examples only: "refunded, expired, stock damaged, etc.." Full list not on the page. | No: "adding a customized wastage reason isn't supported." | [V] LO1 |
| Lightspeed K-Series (Inventory) | Causes named in text: "expired ingredients, broken objects, or an issue caused by staff error." Reason picked from a drop-down. | Yes, new reasons can be created, but "Wastage reasons cannot be removed or edited later." | [V] LK2 |
| xtraCHEF by Toast | A "Reason" must be selected, but the list is only in a screenshot. | UNKNOWN | [V] T5 for the field; list UNKNOWN |
| Restaurant365 | No predefined reasons on the page; managers "leave comments to clarify the reasons that the items were wasted" and can attach the printed log. | n/a | [V] R1 |
| Square | Adjustment reason is required when inventory tracking is on [V] S1. List: "Stock received, Inventory re-count, Damage, Theft, Loss, Restock return." | UNKNOWN | list is [PK], unchecked |
| Loyverse | Stock adjustment reasons: "Receive items, Inventory count, Loss, Damage." | UNKNOWN | [PK], unchecked; article exists (title seen) [V] LV2 |
| Odoo | "Scrap" order with optional user-defined scrap reason tags. | Yes | [PK], not opened |
| MarketMan, Apicbase, WISK, BevSpot, Simphony, TouchBistro, Revel | UNKNOWN | UNKNOWN | not opened |
| RestaurantOS (UG) | Tracks "wastage"; no reasons listed. | UNKNOWN | [V] UG1 |

### Who may log, approval, photo

- Lightspeed O-Series: from the back office, users with Admin or Back of House permission; from the POS itself (Menu > Add-ons > Wastage), users with Front of House or wastage permission. No approval step described. [V] LO1
- Lightspeed K-Series: each event records the creator's email, units lost, total value and notes. No approval step described. [V] LK2
- xtraCHEF: Inventory > Manage Waste > + Add Waste; can be back-dated; notes or an image are optional "for your records"; no approval mentioned; who may log is not stated. [V] T5
- Restaurant365: the heaviest control. Separate permissions for View, Create, Edit, Complete, Approve, Unapprove, Unlock, Void, Unvoid, Delete, plus templates. A completed log is reviewed by an admin who can "approve to finalize the log." [V] R1
- Required photo: not required anywhere I read. Optional in xtraCHEF only. [V] T5

### Prepared dish versus raw ingredient

- Lightspeed O-Series: "All items can be recorded as wastage, including your recipe ingredients or products you're selling from the POS." So a finished dish can be wasted as a product. [V] LO1
- Lightspeed K-Series: for a half-made batch, "enter all ingredients as individual lines and the amount lost." So no dish-level waste there; you break it down by hand. [V] LK2
- xtraCHEF: "Best practices call for logging waste by Product" (the purchased product). Recipes and menu items are not mentioned. [V] T5
- Restaurant365: the overview speaks only of "food and product waste" and "purchased items". Recipe or menu-item waste: not on this page. UNKNOWN from R1; [PK] R365 does allow recipes on a waste log.
- Costing: Lightspeed K values waste from "item prices set in Back Office" [V] LK2. Lightspeed O's wastage report shows both "Total Cost" and "Lost Sales" [V] LO1, i.e. what it cost and what it would have sold for.

### Refunds and returned dishes

- Lightspeed O-Series: a refunded non-perishable goes back into stock automatically; "If the refunded item is perishable, you must record it separately as wastage." [V] LO1. This is the nearest documented cousin of Nimbus's void question.

### Staff meals and complimentary items

- Not covered in any page opened. LO1 explicitly does not mention staff meals. UNKNOWN.
- [PK] The common pattern is to ring a staff meal or a comp as a normal sale with a 100% discount or comp reason, so the recipe still deducts and the cost lands in a "comps / staff meals" line of the discount report rather than in waste. Unchecked.

### Theft and unexplained loss

- xtraCHEF: logging waste makes sure "your Actual vs Theoretical Analysis reflects a true variance" [V] T5. In other words, what is left over after known waste is the unexplained part.
- Lightspeed O-Series: a wrong wastage entry is corrected "by performing a stock count" [V] LO1.
- "Theft" as a selectable reason: only in Square's list, and that is [PK].
- No page I opened has a reason called "stolen" or "missing". The owner's wish for the chef to mark stock as "stolen, missing" is therefore unusual. Analyst note: it is reasonable for Uganda, but it should be a declared-loss reason that needs a manager's PIN, kept apart from the count variance that nobody declared.

---

## 5. Stock counts and variance

**Takeaway: the verified facts are few: the count is the reset point for all theoretical stock, and logged waste is what turns raw shrinkage into an explainable variance. Blind counts, frozen stock, thresholds and count frequency are all UNKNOWN or [PK] in this pass.**

Verified:

- Toast Inventory: depletion "counts down from the 'Stock on Hand' quantity recorded during your most recent physical stock check"; a new physical check overrides the calculated figure; receiving a delivery raises it. Accuracy "relies on a solid foundation of your recipes and your last physical count." [V] T4
- xtraCHEF: waste entries exist so that Actual vs Theoretical shows a "true variance". [V] T5
- Lightspeed O-Series: stock on hand is corrected or reversed by a stock count. [V] LO1
- Loyverse has an "Inventory Count" function and an "Inventory History" (titles seen only). [V] LV2 (titles)
- Square requires a reason for each stock change when tracking is on [V] S1; "Inventory re-count" as one of them is [PK].

From memory, unchecked:

- Full versus partial counts: Loyverse offers both; Odoo supports cycle counts by location with a count frequency in days and a "request a count" assigned to a user; Restaurant365 uses count templates by storage area with daily, weekly and period counts. [PK]
- Blind counts (counter cannot see expected quantity): common as an option in back-office tools; I cannot name a verified product. [PK] / UNKNOWN
- Actual versus theoretical: actual usage = opening count + purchases + transfers in - transfers out - closing count; theoretical usage = items sold x recipe quantities; variance = actual - theoretical, shown in quantity, value and as a percentage of sales. [PK] (standard method; named "Actual vs Theoretical Analysis" by xtraCHEF [V] T5)
- Thresholds: trade guidance often treats a food-cost variance within roughly 1 to 2 percentage points of theoretical as acceptable and flags anything above. No vendor page opened states a threshold. [PK], treat as folklore until sourced.
- Bars: WISK and BevSpot push weekly full counts of spirits, some venues count high-value bottles nightly; partial bottles are estimated in tenths or weighed on a scale. [PK], not opened.

UNKNOWN in everything opened:

- Whether sales are frozen or stock is snapshotted while a count is in progress.
- Whether a variance above a set size needs approval before it posts.
- How any product handles a count taken during trading hours.

---

## 6. The reports that close the loop

**Takeaway: the reports the owner asked for exist in the leaders under plain names; the one that is missing everywhere I looked is a "sold-out log" (what was 86'd, when, for how long, and what sales it probably cost).**

Names in quotes were seen on vendor pages; the rest are standard names.

| # | Report | What it shows | Who reads it | Seen where |
|---|---|---|---|---|
| 1 | Waste by reason ("Wastage" report) | Headline tiles "Most Wasted, Quantity, Total Cost, Lost Sales"; lines with Product, Reason, Qty, Net Cost, Tax; filter by site, reason, period | Manager, owner, head chef | [V] LO1 |
| 2 | Waste history (live) | Date, User, Product, Reason, Quantity, in real time on the terminal | Chef, manager on shift | [V] LO1 ("Wastage History") |
| 3 | Waste by staff member | Same data cut by who logged it | Manager, owner | [V] LO1 (Insights wastage dashboard: date, staff, reason, reporting group) |
| 4 | Actual vs theoretical usage / cost | Per ingredient: what should have been used versus what was; variance in quantity, value, % | Owner, accountant, manager | [V] T5 names "Actual vs Theoretical Analysis"; contents [PK] |
| 5 | Count variance | Counted versus expected per item per store after each count | Store keeper, manager, accountant | [PK] |
| 6 | Stock on hand and value | Quantity and value at moving average cost, per store | Accountant, owner | [V] LV2 title "Inventory Valuation Report"; Square "Stock Overview" [V] S1; contents [PK] |
| 7 | Stock movement history | Every in and out per item: purchase, transfer, sale, waste, count | Store keeper, accountant, auditor | [V] LK1 ("Stock Movements"), LV2 title "Inventory History" |
| 8 | Low stock / reorder suggestion | Items tagged Low or Out against par | Store keeper, chef, purchaser | [V] T4 ("Reorder suggestion"), LV1 (Stock alert filter) |
| 9 | Sold-out log | Item, time 86'd, who or what triggered it, time restored, minutes unavailable | Manager, chef, owner | UNKNOWN: not found in any product page opened. Proposed for Nimbus |
| 10 | Transfers and requisitions | Requested, issued, received, short, declined; by store and person | Store keeper, manager, accountant | [PK] |
| 11 | Slow movers / dead stock | Items with stock but little or no usage in N days; days of stock on hand | Owner, purchaser | [PK] |
| 12 | Voids | Item, reason, made or not made, who voided, who approved, value | Manager, owner | [PK] |
| 13 | Discounts, comps and staff meals | Value by reason and by staff member | Owner, accountant | [PK] |
| 14 | Item sales mix | Quantity, sales, cost and margin per item and category | Owner, chef, manager | [PK] |
| 15 | Hourly sales | Sales and covers per hour, per day of week | Manager (rostering), owner | [PK] |
| 16 | Till X (mid-shift) and Z (close) | Sales by tender, expected cash, counted cash, over/short, voids, discounts | Cashier, manager, accountant | [PK] |
| 17 | Purchases by supplier / price changes | What was bought, at what price, price drift | Accountant, owner | [PK] |
| 18 | Permission access | Which roles can create, approve, void a waste log | Owner, auditor | [V] R1 ("Permission Access report") |
| 19 | Owner's daily view | "sales, expenses, payments, and stock signals" on one screen | Owner | [V] UG1 |

---

## 7. What they do badly, and ten small features worth copying

**Takeaway: the leaders assume steady internet, an owner who reads email, and a manager at the terminal; the cheap wins are almost all about putting the stock action where the hand already is (long-press the button, log waste from the till).**

### Ten things that would not suit a Ugandan table-service venue

1. **Ingredient stock does not drive the menu.** Toast's own inventory module flags "Out" on a purchasing list and then asks a person to 86 the item [V] T4, and its menu countdown "is not related to the Toast Inventory module" [V] T2. Two truths about lamb chops. The owner asked for one.
2. **86 that never resets, or resets by the clock.** Toast leaves an item off until someone remembers [V] T1; Square turns it back on at end of business day whether or not a delivery came [V] S1. Neither matches a venue where the item is back when the store keeper issues stock.
3. **Dependence on cloud sync.** Toast: publish from the web, then "a few minutes to sync" [V] T1, T2; the countdown also needs "an auto-firing device" running [V] T3. On patchy internet, a sold-out flag has to travel over the local network in seconds or waiters will sell what is gone.
4. **The person who knows cannot press the button.** Toast needs a manager passcode on the terminal [V] T1. In a kitchen the chef knows first. The 86 belongs on the kitchen screen under the chef's role.
5. **Alerts by email, once, at 10:00.** Loyverse emails the account owner and item managers daily at 10:00 [V] LV1. Ugandan owners run on WhatsApp and phone calls, and market buying is done early. Nothing opened offers SMS or WhatsApp.
6. **Rigid or irreversible reason lists.** Lightspeed O-Series does not allow custom wastage reasons [V] LO1; K-Series lets you add but never edit or remove [V] LK2. None shows "stolen" or "missing". A venue needs a short, governed list it can correct.
7. **Dish-level waste done by hand.** K-Series asks you to enter every ingredient of a spoiled batch as separate lines [V] LK2. A chef at 22:00 will not. Waste by dish or prep item, exploded through the recipe, is the workable form.
8. **Theoretical stock is only as good as recipes and the last count.** Toast says so in terms [V] T4. Where recipes are approximate and portions vary, an automatic sold-out will fire wrongly unless there is a buffer and a one-tap override.
9. **Inventory as a paid add-on, a beta, or a withdrawn module.** Loyverse advanced inventory is "available by paid subscription" [V] LV2; Lightspeed closed legacy Stock to new customers and sells an Inventory add-on [V] LK1; Toast depletion is a beta in four markets, none African [V] T4. Dollar subscriptions per module do not fit a UGX venue.
10. **Controls sized for a chain.** Restaurant365 has ten-plus separate waste-log permissions and an admin approval step [V] R1; Square cannot bulk-edit availability [V] S1; much of the availability logic exists to feed delivery apps (Swiggy, Zomato, Cash App) [V] PP1, S1. A single-site Ugandan venue needs three roles and a PIN, not a permission matrix.

Also noted: "locations" in these products usually means separate restaurants, not a main store feeding a kitchen fridge (see section 3); and no page I opened documents what happens to a sold-out item on an unsent order (section 1).

### Ten small, cheap features that make stock handling feel effortless

| # | What it is | Where seen | Source |
|---|---|---|---|
| 1 | Long-press the menu button to mark sold out or set a count, without leaving the order screen | Toast Quick Edit; Square "Edit Availability" | [V] T1, S1 |
| 2 | Remaining count printed in the corner of the button; grey button with "0" when gone | Toast | [V] T1, T2 |
| 3 | Count hits zero, item flips itself to out of stock and cannot be added | Toast | [V] T2 |
| 4 | Sold-out status that clears itself at end of business day, or at a chosen reset time | Square | [V] S1 |
| 5 | "Available" = on hand minus what is already committed to open checks | Square | [V] S1 |
| 6 | Pause a dish slightly before zero to protect orders in progress, and bring it back automatically when stock rises | Petpooja (vendor blog) | [V] PP1 |
| 7 | Low-stock number on the item card, one per store, plus a list filter: All / Low stock / Out of stock | Loyverse | [V] LV1 |
| 8 | One daily digest at a fixed hour, and no message at all when nothing is low | Loyverse | [V] LV1 |
| 9 | Log waste from the till (product, reason, quantity) with a live history of who logged what | Lightspeed O-Series | [V] LO1 |
| 10 | Waste report that shows both cost and lost sales, with "Most Wasted" on top | Lightspeed O-Series | [V] LO1 |

Runners-up: optional note or photo on a waste entry from a three-dot menu (xtraCHEF) [V] T5; "Low" and "Out" tags that drop off the list by themselves once restocked (Toast) [V] T4; perishable flag decides whether a refund returns stock or must be wasted (Lightspeed O) [V] LO1; waste-log templates for the items a kitchen wastes every day (Restaurant365) [V] R1; one setting that decides whether stock drops on send or on payment (Toast) [V] T3.

---

## 8. Method and limits

**Takeaway: 14 vendor pages opened across Toast, Square, Lightspeed (K and O), Restaurant365, Loyverse, Petpooja and one Ugandan product; nine of the requested products were not opened at all, and sections 3 and 5 rest mostly on memory.**

- Effort: 7 searches and 14 page reads (21 in total, over the "about 15" asked for; I stopped there rather than fill the gaps).
- Every [V] was read through a fetch tool that returns a model-written extract with quotes. I did not see raw pages or screenshots. Quotes should be re-checked against the live page before they are reused in anything public.
- Nothing was blocked; no site was worked around.
- Opened but thin: Loyverse advanced inventory (LV2) returned only an index of article titles, so transfer orders, stock adjustments and inventory counts for Loyverse are [PK]. Lightspeed K "About stock" (LK1) was an overview only. Restaurant365 (R1) covered permissions, not reasons or reports.
- Vendor marketing, not help documentation: Petpooja (PP1) is a blog post. Its claim of ingredient-driven auto sold-out is the only one of its kind here and is unconfirmed by a help page.
- Not opened at all: Oracle MICROS Simphony, TouchBistro, Revel, Odoo POS/Inventory, MarketMan, Apicbase, WISK, BevSpot, Lightspeed L-Series. Everything said about them is [PK].
- East Africa: one product opened (RestaurantOS, "Uganda-first", maker not named on the page, hosted on a vercel.app address, so maturity is uncertain). Pesapal's restaurant POS, Focus ERMS Kenya and an LS Retail customer story appeared in search results but were not opened.
- Could not verify, and still open: (a) what any leader does with a sold-out item on an unsent order; (b) whether a void returns a unit to Toast's countdown; (c) transfer states, receipt confirmation and short-receipt coding in any product; (d) blind counts and frozen stock during a count; (e) a vendor-stated variance threshold; (f) the verbatim waste reason lists of Toast/xtraCHEF, MarketMan, WISK, BevSpot; (g) any SMS or WhatsApp stock alert; (h) how staff meals are recorded.
- Unopened leads for a second pass: https://support.toasttab.com/en/article/Toast-InventoryStock-Depletion ; https://docs.restaurant365.com/docs/waste-logs-create-and-enter-a-waste-log ; https://square.com/help/us/en/article/6142 ; https://storekit.com/docs/guides/integrations/pos/lightspeed/stock-and-availability ; https://www.petpooja.com/inventory ; https://www.pesapal.com/blog/restaurant-pos-system-that-brings-orders-payments-reporting-together

### Against the "already established" list

- **Deduct on send:** consistent. Toast's menu countdown drops on send, unless the venue has chosen "Send orders after check is paid", in which case it drops on payment [V] T3. Toast Inventory says only "every time that menu item is sold" and does not give the moment [V] T4. No contradiction; one nuance (a pay-first venue would deduct on payment).
- **Void asks made (waste) or not made (back to stock):** not contradicted. Lightspeed O-Series does it differently for refunds: non-perishables return to stock automatically, perishables must be wasted by hand [V] LO1. That suggests pre-selecting the answer from a perishable flag rather than changing the rule. Toast's behaviour on void is UNKNOWN.
- **Requested > Issued > Received (PIN) / Received short / Declined:** neither confirmed nor contradicted by anything opened.
- **Moving weighted average cost:** not contradicted. One different practice noted: Lightspeed K-Series values waste from "item prices set in Back Office" [V] LK2, a set price rather than a computed average.
