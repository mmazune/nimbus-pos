# E. Scenarios of a full service day, and the small features that make a POS easy

Prepared 26 Nov 2026 for Nimbus POS (table-service restaurant and bar, Uganda).
Scope: what goes wrong in a real day, how the leading products deal with it, what to copy, what to leave out.

## How to read the marks

- **[V]** I opened the page and read it (through a page-fetch tool that returns the text and quotes; see section 7 for the limit this puts on exact wording).
- **[2H]** A review or summary says so; I did not read the vendor's own page.
- **[PK]** From my own knowledge of these products and of running floors. Not checked in this pass. Do not quote in a pitch as a fact about a named competitor.
- **UNKNOWN** Not found on any page I opened. I have not guessed.

Every mark is followed by a source key. The keys:

| Key | Page | URL |
|---|---|---|
| T-OFF | Toast, Offline mode | https://doc.toasttab.com/doc/platformguide/platformOfflineMode.html |
| T-LOCAL | Toast, Offline mode with local sync | https://doc.toasttab.com/doc/platformguide/platformOfflineModeLocalSync.html |
| T-PREP | Toast, Prepare to operate in offline mode during disruptions (the URL slug says "KDS-Backup-Printing" but the page is about outage preparation) | https://support.toasttab.com/en/article/KDS-Backup-Printing |
| T-VOIDDOC | Toast, Voiding checks (platform guide) | https://doc.toasttab.com/doc/platformguide/adminVoidingOrders.html |
| T-VOID | Toast, Void items, payments and checks (help centre) | https://support.toasttab.com/en/article/Voiding-Items-Payments-and-Checks |
| T-PERM | Toast, Permissions reference guide | https://support.toasttab.com/article/Access-Permissions-Reference |
| T-86 | Toast, 86 an item on the POS or Toast Web | https://support.toasttab.com/en/article/86-an-Item?lang=en_US |
| T-QE | Toast, Changing inventory status in Quick Edit mode | https://doc.toasttab.com/doc/platformguide/adminInventoryUpdateQuickEdit.html |
| T-COD | Toast, Close Out Day, Z report and auto-capture | https://support.toasttab.com/en/article/Close-Out-Day-Z-Report-Auto-Capture |
| T-SHIFT | Toast, Shift review checklist for employees and managers | https://support.toasttab.com/en/article/Shift-Review-Checklist-for-Employees-and-Managers |
| SQ-BILL | Square for Restaurants, Bill management (AU help) | https://squareup.com/help/au/article/6429 |
| SQ-FIRE | Square, Hold and fire courses with Square KDS and Square for Restaurants | https://squareup.com/help/au/en/article/8172-hold-and-fire-courses-with-square-kds-and-square-for-restaurants |
| SQ-OFF | Square, Process card payments with offline mode | https://squareup.com/help/us/en/article/7777 |
| LV-SHIFT | Loyverse, Shift management | https://help.loyverse.com/help/shift-management-loyverse-pos |
| LV-OFF | Loyverse, Offline use of Loyverse POS | https://help.loyverse.com/help/offline-work-of-pos |
| LV-OT | Loyverse, How to work with open tickets | https://help.loyverse.com/help/open-tickets |
| LV-FEAT | Loyverse, Features page | https://loyverse.com/features |
| LS-GRP | Lightspeed Restaurant K-Series, Configuring user group settings | https://k-series-support.lightspeedhq.com/hc/articles/1260804647269 |
| FD-DAY | Foodics, How to start and end a business day in Foodics Cashier | https://foodics.helpjuice.com/96018-daily-user-operations/558180-how-to-start-and-end-a-business-day-in-foodics-cashier |
| FD-REASON | Foodics, Reasons overview | https://foodics.helpjuice.com/559049-reasons-overview |

Items the client has already decided (one-tap table, Food/Drinks then group, lines are sent, void with reason and "was it made", cash with change, bottom navigation, reservations seated elsewhere, tabs, kitchen Ready, stock on send, stores and requisitions) appear in the register only as "(decided)" so the register is complete. They are not presented as findings.

---

## 1. Scenario register for a full service day

**Takeaway: 121 scenarios. The leaders handle ordering and the money paths well. They are weakest, or silent, on exactly the things a Ugandan venue meets daily: mobile money that is "pending", power cuts, a supervisor who is not in the building, and closing the day with no internet. Those are where Nimbus can be visibly better.**

The last column is my recommendation for Nimbus so that no scenario ends in a dead end. It is advice, not a sourced claim.

### A. Opening

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| A1 | Shift start, float | Nobody recorded the starting cash, so a shortage at night can be neither proven nor disproven. | Loyverse: open the shift by entering starting cash; from then "all cash and sales operations will be recorded" [V] LV-SHIFT. Foodics: Open Till, enter the opening amount [V] FD-DAY. | Float entry is the cashier's first screen. A waiter-only sign-in skips it. |
| A2 | Second cashier or second till | Two people sell from one drawer; nobody owns the shortage. | Toast ties an employee to a drawer ("locked to a drawer") and closes each drawer on its own [V] T-SHIFT. | One till session per cashier. Every cash payment knows its till. |
| A3 | Yesterday was not closed | Two days of sales merge and the report is useless. | Toast auto-closes at 04:00: closes paid checks, clocks staff out, but "will not close unpaid checks" unless auto-close or auto-void is switched on [V] T-COD. Foodics will not end the day while tills or orders are open [V] FD-DAY. | Morning prompt: "Yesterday is still open. Close it now." Selling is never blocked; new sales go to today. |
| A4 | Yesterday's unpaid table still on the floor | The table looks occupied and the debt is forgotten. | Toast lists unpaid checks on the Close Out Day screen; "Auto-resolve" cannot settle them, a person must [V] T-COD. | Carry-over list with three exits: take payment, move to a named debtor, write off with reason. |
| A5 | Menu or price change before service | Old prices are sold; argument at the table. | Toast: long-press an item on the terminal, with a manager passcode, to edit it there (Quick Edit) [V] T-QE. Price change is its own permission, "Price" [V] T-PERM. Foodics: staff "sync data" on the cashier app to pull changes [V] FD-REASON. | Manager edits on the terminal. Other terminals pick it up without restart and show "menu updated". |
| A6 | An item is off today | Waiter sells it, kitchen refuses, guest waits for nothing. | Toast: an out-of-stock item is "grayed out, can't be selected, and shows a zero in the corner" and stays so "until you mark it back in stock" [V] T-86. | Kitchen or supervisor marks sold out from their own screen. |
| A7 | Limited special (only 12 portions) | Fifteen are sold. | Toast: enter a quantity and "the menu item button shows the quantity amount" [V] T-QE. Whether it counts down by itself on each sale is not stated on the pages opened: UNKNOWN. [PK] it does. | Countdown on the button; at zero it greys out. |
| A8 | Stock received before service | Delivery is not entered, stock shows zero, later sales look like theft. | Loyverse: purchase orders "track deliveries"; stock adjustments record increases [V] LV-FEAT. | Store keeper receives against the order. A zero count never blocks a sale (see F7). |
| A9 | Staff arriving, who is on | Sales are keyed under another person's name. | Foodics: the user clocks in with the login PIN; the business day starts with clock-in plus open till [V] FD-DAY. | First PIN sign-in of the day is the clock-in. No separate step. |
| A10 | Float has no small notes | Cashier borrows from a pocket and the drawer never balances. | Loyverse "Pay In": add cash without a sale, for example change; it shows in the shift report [V] LV-SHIFT. | Pay in and pay out, each two taps with a reason. |

### B. Seating

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| B1 | Walk-in | Table looks free on the screen; a second party is sent to it. | Square: a bill with a cover count stays on the floor plan even with no items, so the table shows occupied [V] SQ-BILL. | Guest count on opening marks the table taken before any order. Skippable. |
| B2 | Booking arrives | (decided: may be seated at any table) | UNKNOWN on pages opened. [PK] reservation tools link the booking to the bill. | (decided) |
| B3 | Late booking or no-show | Table is held empty all night. | UNKNOWN on pages opened. [PK] reservation tools flag "late" and release after a set time. | "Late 15 min" badge; one tap to release; any deposit stays on record. |
| B4 | Booked table still in use | Host argues with seated guests. | UNKNOWN on pages opened. [PK] table age and "bill printed" status tell the host which table will turn next. | Table tile shows age and stage: ordered, eating, bill asked. |
| B5 | Guests move table | Kitchen sends the food to the old table. | Square: long-press a table tile and drag it to another; an empty target receives the bill [V] SQ-BILL. | Move keeps every line. Kitchen and bar screens update the table number on tickets still open. |
| B6 | Tables joined | Two bills, guests want one. | Square: dropping onto an occupied table, "you'll be prompted to confirm a merge" [V] SQ-BILL. | Join with a confirm. |
| B7 | Joined tables separate again | The merge was one-way; the waiter rebuilds the bills by hand. | Square: move items to "New Bill" or "Existing Bill" one by one [V] SQ-BILL. A one-tap un-merge was not found: UNKNOWN. | Each line remembers its original table, so "separate again" is one tap. |
| B8 | Large party | One long ticket; nobody knows who had what. | Square: split "by item or seat" [V] SQ-BILL (seat management is a separate article, not opened). [PK] Toast can add a service charge automatically above a party size. | Seat numbers optional, never forced. |
| B9 | Standing guests | (decided: tabs) | Loyverse open ticket: custom name, default name is the current time, optional comment [V] LV-OT. | Auto-name the tab so nobody types when it is busy. |
| B10 | Tab guest sits down at a table | Tab and table bill both exist; one is forgotten. | Square: Actions > Move, pick the bill to merge into [V] SQ-BILL. | "Move tab to table" keeps the lines and who served them. |
| B11 | One guest leaves early and pays their share | Waiter holds the cash in a pocket until the end. | Square: split bills or payments among guests or payment types [V] SQ-BILL. | Part payment is recorded at once; the balance stays open on the table. |
| B12 | Regular with a known preference | Knowledge is lost when that waiter is off. | Loyverse customer "Notes": stores notes about customer preferences [V] LV-FEAT. | Pin a note to a table or a guest. Optional. |

### C. Ordering

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| C1 | Allergy | A spoken message is lost; a guest is harmed. | UNKNOWN on pages opened. [PK] Toast and Lightspeed print allergy modifiers prominently on tickets. | Allergy button; red banner on kitchen screen and ticket; it stays attached to every later line for that table or seat. |
| C2 | Special request | Scribbled and misread. | Loyverse item modifiers: add-ons or preparation choices "with one tap" [V] LV-FEAT; free comment on a ticket [V] LV-OT. | Common requests as taps; free text as the fallback. |
| C3 | Item not on the menu (open item) | Waiter cannot ring it, so it is sold for cash off the books. | Toast: "Open Items" permission to "create custom-priced items on a check" [V] T-PERM. | Open item: name, price, Food or Drink. Flagged in the day report. |
| C4 | Repeat a round | Six drinks are keyed again one by one. | UNKNOWN on pages opened. [PK] Lightspeed, Square and TouchBistro have a repeat action. | Repeat selected lines, or "same again" for the last round. |
| C5 | Courses, hold then fire | Mains arrive with the starters. | Square: a held course "won't be sent and printed until it's fired"; later tap fire, then Send, and a fire ticket goes to the kitchen [V] SQ-FIRE. | Hold per line or group; one "Fire mains" button. |
| C6 | Kitchen calls the next course | Waiter forgets to fire. | Square: on the expo screen, tap the held course header; a 3-second countdown runs (tap again to cancel); the whole course fires; the POS shows who fired and when [V] SQ-FIRE. | Later phase. Optional. |
| C7 | Wrong table | Table 4 pays for table 5's fish. | Square: item > Move > "New Bill" or "Existing Bill" [V] SQ-BILL. | Move line. Kitchen ticket shows the new table. |
| C8 | Guest changes mind before send | (no harm if removal is free) | Toast: items not yet sent are simply removed, no void needed [V] T-VOID. | Free removal, no reason, no PIN. |
| C9 | Guest changes mind after send | Kitchen keeps cooking. | Toast: void with a reason; "(VOIDED)" shows on the kitchen ticket with lines through the items [V] T-VOIDDOC. Square separates void (not made) from comp (made or delivered) [V] SQ-BILL. | (decided) Note: Toast's void page has no waste option [V] T-VOID, so "was it made" is ahead of it. |
| C10 | Kitchen runs out mid-service | Orders keep coming. | Toast: 86 on the terminal [V] T-86. | Kitchen marks sold out; every terminal sees it at once. |
| C11 | Item sells out while it sits on unsent or held orders | Held mains fire for a dish that is gone. | UNKNOWN: no page opened covers it. | When an item is marked sold out, list the unsent and held lines that contain it and alert those waiters. |
| C12 | Happy hour or timed price | Waiter applies it late or forgets to stop. | UNKNOWN on pages opened. [PK] Toast and Square support time-based prices or discounts. | Automatic by the clock; the line is labelled. |
| C13 | Order straddles the end of happy hour | Dispute at payment. | UNKNOWN. | Price is fixed at send time and shown on the line. |
| C14 | Item with choices | Kitchen has to send someone to ask. | Loyverse modifiers [V] LV-FEAT. [PK] leaders can force a required choice before send. | Required choices pop once; defaults pre-ticked. |
| C15 | Half portion | Rung as full, then discounted by hand. | Loyverse item variants group sizes into one item [V] LV-FEAT. | Size as a variant with its own price and recipe. |
| C16 | Takeaway from a table | Plated instead of packed. | Loyverse dining options: dine-in, takeout, delivery [V] LV-FEAT. A per-line "to go" flag: [PK]. | "Pack" flag per line, shown on the ticket. |
| C17 | Sold by weight (whole fish, meat per kg) | Price is guessed. | Toast supports scales for weighted items, even offline [V] T-OFF. | Type the weight, price computes. No scale integration needed. |
| C18 | Wrong quantity (10 instead of 1) | Ten are cooked. | UNKNOWN. | Confirm when a quantity is above a set number. |
| C19 | Guest asks for the bill, then orders more | The printed bill no longer matches; the guest pays the old total. | UNKNOWN on pages opened. [PK] leaders show a "bill printed" state on the table. | Table marked "bill printed"; adding a line clears it and offers a reprint. |
| C20 | Guest asks what is on the bill so far | Waiter recites from memory. | UNKNOWN on pages opened. [PK] pre-payment bill print. | Show or print the running bill at any time. |

### D. Kitchen and bar

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| D1 | Rush | Oldest tickets are buried. | Square KDS: full ticket summary shows completed, fired and upcoming held courses [V] SQ-FIRE. Ticket colour by age: [PK] Toast KDS. | Tickets in age order; colour changes with minutes waited. |
| D2 | Ticket lost | A table waits forever. | Toast: with a printer, changes can print a new ticket ("Print Ticket Changes" setting) [V] T-VOIDDOC. Recall or reprint: [PK]. | Reprint any ticket from history; recall the last ticket marked Ready. |
| D3 | Re-fire or remake (dropped, sent back) | A second dish is cooked with no record; stock is out by two. | UNKNOWN on pages opened. [PK] leaders have a "refire" or "remake" with a reason. | Remake button: no charge, reason, stock deducted again, appears in waste. |
| D4 | Item delayed | The guest is not told. | UNKNOWN. | Kitchen taps "delayed 10 min"; the waiter is notified. |
| D5 | Ready but nobody collects | Food dies on the pass. | Square: an expo station sees the whole order [V] SQ-FIRE. Waiter alerts: [PK]. | (Ready is decided.) Add a "ready" badge on the table tile with minutes since ready. |
| D6 | Runner takes food to the wrong table | Food is given away. | UNKNOWN on pages opened. [PK] table and seat on the ticket. | Large table number on every ticket; seat if used. |
| D7 | Food and drinks to different stations | The bar never sees the drinks. | Square: a fired course "is sent to your prep stations" [V] SQ-FIRE. | Route by item group. One Send goes to both. |
| D8 | A line is changed after send | Kitchen cooks the old version. | Toast: a new ticket may print depending on the Print Ticket Changes setting [V] T-VOIDDOC. | Changed line shows "CHANGED" on the kitchen screen. |
| D9 | Kitchen marks the wrong ticket ready | Ticket vanishes. | UNKNOWN on pages opened. [PK] KDS recall. | Undo Ready for a short time. |
| D10 | Bar pours before it is rung | Free drinks. | UNKNOWN. [PK] house rule: no ticket, no drink. | Bar screen is the only authority to pour; bar tickets are compared with bottle stock at close. |

### E. Money

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| E1 | Split by guest | Arithmetic at the table; someone underpays. | Square: split by seat [V] SQ-BILL. | Split by seat if seats were used; otherwise by item. |
| E2 | Split by item | Same. | Square: split by item; or move an item to a new bill [V] SQ-BILL. | Tap lines, "pay these". |
| E3 | Split by amount or evenly | Same. | Not described on the Square page opened: UNKNOWN there. Loyverse: one sale paid by cash, card "or a mix" [V] LV-FEAT. [PK] leaders have "split evenly". | "Split in N" and "pay an amount". |
| E4 | One guest pays all after a split | Bills must be joined again. | Square: move or merge a whole bill [V] SQ-BILL. | "Pay all" from any split. |
| E5 | Part payment | Cash sits in a pocket. | Square: split payments [V] SQ-BILL. | Balance shown; the table stays open as "part paid". |
| E6 | Deposit used | Deposit is forgotten and the guest pays twice. | UNKNOWN on pages opened. | Deposit appears on the bill automatically when the reservation is seated, at any table. |
| E7 | Discount | Friends get 50 percent. | Toast: "Discounts" is a manager-level permission [V] T-PERM. Lightspeed: allowed per user group [V] LS-GRP. Square: a reason is selected [V] SQ-BILL. Toast Z report has a discounts section [V] T-COD. | See section 3. |
| E8 | Complimentary | A "comp" hides theft. | Square: comp with a reason; comped items still appear in sales and inventory reports [V] SQ-BILL. | See section 3. |
| E9 | Staff meal | Eaten unrecorded; stock variance. | UNKNOWN on pages opened. [PK] a 100 percent "staff meal" discount type or staff account. | Staff meal as its own settlement type with a daily allowance. |
| E10 | Service charge | Added by hand, inconsistently. | UNKNOWN on pages opened. | Venue setting; removable only with permission and reason. |
| E11 | Tip | Tip is mixed into sales. | Toast: tips added to card payments; cash tips declared at shift review [V] T-OFF, T-SHIFT. | Tip recorded apart from sales, by method. |
| E12 | Mobile money pending | Guest shows an SMS; the waiter cannot tell if money arrived; the table is held hostage. | UNKNOWN: none of the vendors opened covers mobile money. Nearest: Toast stores offline card payments and submits them on reconnect; denied ones are found in the Payments report by Status [V] T-PREP. | Payment state "awaiting confirmation" with reference and phone number. The table can be released. Unconfirmed list is reviewed at close. |
| E13 | Mobile money failed or reversed | Bill is closed but the money never came. | Toast: "If a payment declines once you're back online, it can't be re-run"; take a new payment [V] T-PREP. | Bill returns to unpaid with its history; take another method. |
| E14 | Card declined | Embarrassment; bill stuck. | UNKNOWN on pages opened. [PK] returns to the payment screen. | Bill stays open; choose another method. |
| E15 | Overpayment | Cash: change (decided). Mobile money overpaid: nobody knows what to do. | UNKNOWN. | Three exits: keep as tip, refund in cash (recorded as pay-out), credit to the guest. |
| E16 | Refund after close | Cash leaves the drawer with no record. | Toast: void works only on the same business day; later it is a refund; separate permissions, one limited to same day [V] T-VOID, T-PERM. Loyverse: refund one item or the whole receipt [V] LV-FEAT; refunds are blocked offline [V] LV-OFF. Foodics: a reason is required [V] FD-REASON. | See section 3. |
| E17 | Walk-out | Bill is quietly voided, or left open forever. | UNKNOWN. Toast void reasons are configurable [V] T-VOIDDOC, so "walk-out" could be one [PK]. | Close as "Walk-out": stock stays deducted, supervisor and reason, own line in the day report. |
| E18 | Wrong payment method recorded | Cash short, mobile money over. | Lightspeed: a permission to "change the payment method used on a finished receipt" [V] LS-GRP. Toast: void the payment and take it again; voided payments have their own report [V] T-VOID. | See section 3. |
| E19 | Reprint | Guest needs a copy. | Loyverse "Receipts history" reviews each transaction [V] LV-FEAT. Reprint itself: [PK]. | Reprint from history, marked "COPY". |
| E20 | Paid twice | Drawer over; guest returns angry. | Toast: void a payment the same day [V] T-VOID. | Void one payment with reason; if cash was taken, a pay-out is recorded. |
| E21 | Regular pays later (credit) | Paper book. | Toast has house accounts as a payment method [V] T-OFF. | Named debtor account with a limit; accountant sees the ageing. |
| E22 | Petty cash from the till (ice, charcoal) | Drawer short. | Loyverse "Pay Out" [V] LV-SHIFT. Foodics drawer reason "Taking petty cash" [V] FD-REASON. Toast "Pay Out" permission [V] T-PERM. | Pay-out with reason and optional photo of the receipt. |
| E23 | Cash drop mid-shift | Too much cash in the drawer. | Loyverse pay-out is the mechanism [V] LV-SHIFT. Toast Z report has a deposit summary [V] T-COD. Dedicated "cash drop": [PK]. | "Cash drop to safe" as its own type; supervisor confirms. |
| E24 | Tax invoice for a company guest | Guest cannot claim the expense. | UNKNOWN in vendor pages. [PK] Uganda's URA fiscal receipting (EFRIS) may apply. | Verify the legal requirement separately before building. |
| E25 | No change available | Guest waits; the waiter "owes" change. | UNKNOWN. | Record "change owed"; settle by mobile money or credit; shows at till count. |

### F. Stock

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| F1 | Delivery short | Paid for ten crates, received eight. | Loyverse purchase orders track deliveries [V] LV-FEAT. Partial receive: [PK]. | Receive what arrived; the shortfall stays open against the supplier. |
| F2 | Spoilage | Thrown away unrecorded. | Foodics quantity-adjustment reasons, for example "Expired", "Damaged" [V] FD-REASON. Loyverse stock adjustments for damage and loss [V] LV-FEAT. | Waste entry with reason, by anyone; reviewed by the manager. |
| F3 | Breakage | Same. | Same as F2. | Same; bar can log a broken bottle in two taps. |
| F4 | Missing | Nobody knows when it went. | Loyverse inventory counts, full or partial; inventory history log [V] LV-FEAT. | Count gives a variance; the history shows every movement. |
| F5 | Count mid-service | Count is wrong because sales continue. | Loyverse partial counts [V] LV-FEAT. Counting while selling: UNKNOWN. | Count records the time; sales after that time are adjusted for. |
| F6 | Bar bottle finished | Tots sold do not match bottles used. | Loyverse tracks stock of "products and their components" [V] LV-FEAT. Tots per bottle: [PK]. | Bottle recipe in tots; "bottle finished" tap compares expected with actual. |
| F7 | System says zero, item is on the shelf | Sale is blocked; waiter gives up or sells off the books. | Loyverse has negative stock alerts (not shown offline) [V] LV-OFF, meaning an alert. Whether it can block: UNKNOWN. | Never block a sale. Warn, sell, flag for the store keeper. |
| F8 | Item made, then voided | Stock and waste disagree. | Toast's void article has no waste or inventory option [V] T-VOID. | (decided: "was it made") |
| F9 | Requisition short-issued | Bar asks for six, store gives four, record says six. | UNKNOWN. | Store issues the real number; bar confirms receipt. |
| F10 | Low stock | Found out when it runs out. | Loyverse daily low stock notifications [V] LV-FEAT. | Low-stock list at opening. |

### G. People

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| G1 | Waiter goes home with open tables | Tables are orphaned; nobody may take payment. | Toast shift review: close or pay each open check, or "Change Server"; unpaid checks stop the server ending the shift [V] T-SHIFT, T-COD. | End of shift lists the waiter's open tables with "hand over" beside each. |
| G2 | Handover | Verbal; a table is missed. | Square: Actions > Assign to another clocked-in team member [V] SQ-BILL. Loyverse: tick several tickets and assign them, needs "Manage all open tickets" [V] LV-OT. | Hand over one, or all, in two taps. The new waiter sees a "handed to you" notice. |
| G3 | Waiter left without closing the shift | Shift hangs open. | Toast: a manager completes the shift review on the employee's behalf [V] T-SHIFT. | Supervisor closes it for them; recorded as closed by supervisor. |
| G4 | Forgot PIN | Waiter cannot work. | UNKNOWN on pages opened. | Supervisor resets on the terminal; the waiter sets a new one at next sign-in. |
| G5 | Shared terminal | Orders land under the previous user. | Toast: separate "View Other Employees' Orders" and "Edit Other Employees' Orders" permissions [V] T-PERM. Square: a passcode or permission is needed to move another person's bill [V] SQ-BILL. Auto-lock: [PK]. | Lock after send or after a few idle seconds; PIN to continue. |
| G6 | Supervisor absent | A void or discount cannot be approved; guest waits. | Toast prompts for a manager code or card on the spot [V] T-VOIDDOC. Remote approval: UNKNOWN. | Approval from the manager's phone, or "do now, review later" within a limit. See section 3. |
| G7 | Trainee | Test orders hit the kitchen and the stock. | UNKNOWN on pages opened. [PK] training mode. | Training sign-in that sends nothing and deducts nothing. |
| G8 | PIN is shared | Audit trail is worthless. | UNKNOWN. [PK] swipe cards or fingerprint. | Report of one PIN active on two terminals at once. |
| G9 | Break cover | Another waiter must add to the table. | Toast "Edit Other Employees' Orders" permission [V] T-PERM. | Any waiter may add lines to any table; each line records who keyed it. |
| G10 | "I did not ring that" | No proof. | UNKNOWN on pages opened. [PK] line-level user stamps. | Every line shows who and when. |

### H. Failure

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| H1 | Internet down | Service stops. | Toast: orders and card payments continue on the same device [V] T-OFF. Loyverse: sales and shifts continue, receipts marked "Unsynced" [V] LV-OFF. Square: offline session starts by itself [V] SQ-OFF. | See section 4. |
| H2 | Internet down, local network up | Terminals cannot see each other. | Toast "local sync": one wired Toast device acts as hub; kitchen screens show all orders; one POS still cannot see another POS's orders [V] T-LOCAL. | Local hub so terminals, kitchen and bar keep sharing tables without internet. |
| H3 | Power cut | Everything dies mid-order. | The Toast outage article does not address power [V] T-PREP. UNKNOWN across pages opened. [PK] battery tablets, UPS on router and hub. | Every tap saved at once on the device; on restart the order is exactly where it was. |
| H4 | Printer out of paper or offline | Kitchen gets nothing and nobody knows. | Toast: kitchen tickets print to backup printers "if configured" [V] T-OFF. How the reroute is set up: UNKNOWN. | Printer fault shows on the sender's screen; ticket goes to a backup printer or stays on screen with a "not printed" badge. |
| H5 | Kitchen screen offline | Orders vanish. | Toast: set up a kitchen printer to print what would have shown on the screen [V] T-OFF. Square: firing from the expo screen is not possible while the KDS is offline [V] SQ-FIRE. | Fall back to printer; if none, the waiter's screen says "kitchen not reached, tell them". |
| H6 | Terminal dies mid-order | Order and payments are lost. | Toast offline: orders live only on that device; reinstalling or clearing data "permanently removes stored data and payments" [V] T-OFF. Square gives the same warning [V] SQ-OFF. | Sent lines are on the hub the moment they are sent; unsent lines are a draft that survives restart. |
| H7 | Double tap or duplicate send | Two of everything cooked; guest charged twice. | None of the offline pages opened mentions duplicates [V] T-OFF, T-LOCAL, SQ-OFF: UNKNOWN. [PK] a unique key per send or payment so a repeat is ignored. | Button disables on first tap; each send and each payment carries a unique key; a repeat is ignored. |
| H8 | Two people edit the same table | One overwrites the other. | Toast offline: use one device per employee because orders do not sync between devices [V] T-OFF. Online conflict handling: UNKNOWN. | Lines are added, never overwritten; two waiters adding at once both succeed. |
| H9 | Cannot sign in while offline | Staff are locked out for the whole outage. | Toast: you cannot log in or out of the app offline [V] T-OFF. Loyverse: cannot sign out while unsynced receipts remain [V] LV-OFF. | PIN check works on the device with no network. |
| H10 | Bill numbers during an outage | Duplicate or missing numbers; accountant cannot reconcile. | Toast: check numbers resume where they left off; the offline numbers are not reused [V] T-OFF. | Numbers carry a terminal prefix; never reused. |
| H11 | Long outage | Stored payments expire. | Square: offline card payments not uploaded within 72 hours expire and "cannot be retrieved or reprocessed" [V] SQ-OFF. | Cash and manually confirmed mobile money never expire. Screen shows "not synced for N hours". |
| H12 | Device clock wrong after a power cut | Sales land on the wrong day. | UNKNOWN. | Warn when the device clock differs from the hub. |
| H13 | Mobile money network down, internet fine | Guests cannot pay. | UNKNOWN. | Record "to be confirmed" with reference; or pay later on a named account. |

### I. Closing

| # | Scenario | What goes wrong without help | How the best products handle it | Nimbus: no dead end |
|---|---|---|---|---|
| I1 | Till count over or short | Cashier sees the expected figure and makes the count match. | Loyverse: expected cash, actual cash, difference [V] LV-SHIFT; switch off "View shift report" for cashiers and they see only the actual-cash box (blind count) [V] LV-SHIFT. Toast: blind and full drawer permissions [V] T-PERM; variance above a set threshold needs manager approval [V] T-SHIFT; Z report shows "employee over/short" [V] T-COD. | Blind count, then the difference; over a limit needs the supervisor and a note. |
| I2 | Open tables at close | Day cannot be closed, or is closed with money missing. | Toast: "The End day button is unavailable until all open checks are resolved"; auto-resolve cannot settle unpaid ones [V] T-COD. Foodics: no pending orders, tills and active orders closed [V] FD-DAY. | Close lists each open table with exits: pay, named debtor, walk-out, carry to tomorrow. Never a bare "cannot close". |
| I3 | Guests still seated past midnight | Their sales fall on tomorrow. | Toast: business day turns at 04:00 by default; "Printing the Z Report does not turn the day over" [V] T-COD. | A sale belongs to the business day in which the table was opened. Day cut-off is a venue setting. |
| I4 | End-of-day report | Owner gets a phone call, not figures. | Toast Z report sections: sales, payments, voids, discounts, over/short, pay-outs, deposit [V] T-COD. Foodics emails the End Of Day report automatically [V] FD-DAY. Loyverse exports shift summaries [V] LV-SHIFT. | One page, sent to the owner's phone on close. |
| I5 | Staff still signed in | Hours wrong; shifts hang. | Toast: "Clock out all", or automatic at 04:00 [V] T-COD. Foodics: pop-up asks to clock out all employees [V] FD-DAY. | "Sign everyone out" at close. |
| I6 | Tips paid out | Argument over who gets what. | Toast: the shift screen shows Pay, Collect, or Pay and Collect with the amount [V] T-SHIFT. | Tip total per waiter by method; paid out as a recorded pay-out. |
| I7 | Cash to the owner or bank | Cash leaves with no signature. | Toast Z report has a deposit summary [V] T-COD. The deposits article was not opened: detail UNKNOWN. | Banking entry: amount, who took it, who received it. |
| I8 | Closing while offline | Cannot close; staff wait for the internet. | Toast: shift reviews cannot be completed offline [V] T-OFF. Square: close-of-day reporting is unavailable offline [V] SQ-OFF. | Close works offline; the report is sent when the connection returns. |
| I9 | Next-day reset | Yesterday's sold-out items stay sold out. | Toast: an 86'd item stays so until changed [V] T-86. A page on "automatically refreshing inventory" exists but was not opened: UNKNOWN. | At opening: "3 items still marked sold out. Keep or clear?" |
| I10 | Mistake found after close | History is edited silently. | Toast: a manager can re-open a shift within the business week; doing so "deletes the previous Tip Out and Cash Collected entries" [V] T-SHIFT. | Correction entry dated today that points at the original. History is never edited. |
| I11 | Unconfirmed mobile money at close | Money assumed received. | UNKNOWN. | The list must be cleared, or carried forward by name. |

---

## 2. Thirty small features that make a POS feel easy and fast

**Takeaway: eighteen of the thirty are confirmed on vendor pages; twelve (marked [PK]) are common in the leaders from my own knowledge but not checked here. The sentences are written for Nimbus to say about itself. Name a competitor only for the [V] rows.**

| # | Feature | What a salesperson says | Who has it | Mark and source |
|---|---|---|---|---|
| 1 | Repeat the round | "Same again for the table is one tap, not six." | Lightspeed, Square, TouchBistro | [PK]; not on pages opened |
| 2 | Quantity multiplier | "Tap 6, tap Nile Special, done." | Oracle MICROS, Toast | [PK] |
| 3 | Item countdown | "Tell it there are 12 goat stews left and the button counts down for every waiter." | Toast | [V] T-QE (number on button); auto-decrement [PK] |
| 4 | Sold-out goes grey | "When the kitchen runs out, the button greys out on every screen so nobody sells it." | Toast | [V] T-86 |
| 5 | Hold and fire | "Take the whole order at once; the mains only reach the kitchen when you say so." | Square | [V] SQ-FIRE |
| 6 | Fire with a 3-second undo | "A mis-tap on fire can be cancelled for three seconds." | Square (expo screen) | [V] SQ-FIRE |
| 7 | Seat numbers, split by seat | "If you note who sat where, the bill splits itself." | Square | [V] SQ-BILL |
| 8 | Allergy flag in red | "An allergy prints in red at the top of the kitchen ticket and stays there for every later order from that table." | Toast, Lightspeed | [PK] |
| 9 | Search by initials | "Type CM and Chicken Masala comes up." | Lightspeed, Odoo | [PK] |
| 10 | Long-press to edit on the spot | "The manager holds a finger on an item to change its price or stock without leaving the floor." | Toast (Quick Edit) | [V] T-QE |
| 11 | Drag a table to move or join | "Guests moved? Drag their table onto the new one. If it is taken, it asks whether to join." | Square | [V] SQ-BILL |
| 12 | Guest count holds the table | "The moment you enter three guests the table shows taken, before they order anything." | Square | [V] SQ-BILL |
| 13 | Hand over in two taps | "A waiter going home passes one table or all of them to a colleague in two taps." | Square; Loyverse (several at once) | [V] SQ-BILL, LV-OT |
| 14 | Select many lines at once | "Tick five lines and move, void or comp them together." | Square (open beta) | [V] SQ-BILL |
| 15 | Move a line to another table or course | "Rung on the wrong table? Move the line; do not void and re-enter." | Square | [V] SQ-BILL |
| 16 | Voids are struck through in the kitchen | "A cancelled dish is crossed out on the kitchen screen, so the chef stops cooking it." | Toast | [V] T-VOIDDOC |
| 17 | Supervisor PIN on the spot | "The supervisor approves on the waiter's screen with a PIN. Nobody signs out." | Toast | [V] T-VOIDDOC |
| 18 | Your own reason lists | "You write the reasons for voids, refunds and wastage, so reports speak your language." | Toast, Foodics, Square | [V] T-VOID, FD-REASON, SQ-BILL |
| 19 | Blind cash count | "The cashier counts first, then the system shows what should be there, not the other way round." | Loyverse, Toast | [V] LV-SHIFT, T-PERM |
| 20 | Shortage limit | "A small difference passes; a big one needs the supervisor before the till can close." | Toast | [V] T-SHIFT |
| 21 | Pay in and pay out | "Money for ice taken from the till is two taps and appears on the day report." | Loyverse, Foodics, Toast | [V] LV-SHIFT, FD-REASON, T-PERM |
| 22 | Drawer opens only with a reason | "The drawer never opens without a sale or a stated reason." | Foodics | [V] FD-REASON |
| 23 | One-tap tidy at close | "At closing, one button signs everybody out and clears what can safely be cleared; anything unpaid is shown to a person." | Toast (Auto-resolve) | [V] T-COD |
| 24 | Day report sent to the owner | "When the day is closed, the report reaches the owner's phone by itself." | Foodics (by email) | [V] FD-DAY |
| 25 | "Not yet synced" badge | "With no internet you keep selling; each bill shows a small mark until it has been sent up." | Loyverse | [V] LV-OFF |
| 26 | Tab names itself | "Open a tab without typing; it names itself and you can add a note such as 'red cap at the bar'." | Loyverse | [V] LV-OT |
| 27 | Sort open bills | "Sort open bills by waiter, by amount or by how long they have been open." | Loyverse | [V] LV-OT |
| 28 | Dark screen for the bar | "A dark screen for night service that does not light up the bar." | Loyverse | [V] LV-FEAT |
| 29 | Split evenly in one tap | "Four friends, one bill: tap 4 and it is done." | Square, Toast, Lightspeed | [PK]; the Square page opened did not describe it |
| 30 | Auto-lock and quick switch | "The terminal locks after each order and the next waiter is in with four digits." | Lightspeed, Toast | [PK] |

Six more worth having, all [PK] and unchecked: undo the last tap; colour on the table tile by age; suggested service charge or tip amounts; reprint any bill from history marked COPY; price by typed weight (Toast supports scales [V] T-OFF); a note pinned to a table (Loyverse has ticket comments [V] LV-OT).

---

## 3. Flexibility versus control

**Takeaway: the leaders do not forbid sensitive actions; they let anyone start one and then ask for a permission, a reason, or a manager's code on the same screen, and they put the result on a report somebody reads at close. Nobody opened publishes a per-action money limit or a remote approval, so those two are open ground for Nimbus.**

"Leader practice" is sourced. "Nimbus rule" is my recommendation.

| Action | Permission (leaders) | Reason required | Second person's PIN | Limit | Where it lands | Nimbus rule (recommended) |
|---|---|---|---|---|---|---|
| Price override | Toast: "Price" and "Full Quick Edit" permissions change the menu price from the terminal; no separate per-bill override permission is listed [V] T-PERM. Manager passcode to enter Quick Edit [V] T-QE. | UNKNOWN | Yes, in effect: manager passcode [V] T-QE | UNKNOWN | UNKNOWN | Supervisor PIN, reason, old and new price on the line; shown in the exceptions list. |
| Open item | Toast: "Open Items" permission [V] T-PERM | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Waiter may add up to a set UGX value with a name; above it, supervisor PIN. Listed in the day report so real items get added to the menu. |
| Discount | Toast: "Discounts" manager-level permission [V] T-PERM. Lightspeed: per user group; group members may give any discount defined in the back office [V] LS-GRP. | Square: a reason is chosen [V] SQ-BILL | Toast pattern: manager code if the user lacks the permission [V] T-VOIDDOC (stated for voids; for discounts [PK]) | UNKNOWN on pages opened. [PK] fixed lists of allowed discounts are the usual limit. | Toast Z report "discounts" section [V] T-COD | Named discounts only (no free typing) for waiters; open percentage needs supervisor PIN; cap per role. |
| Complimentary | Square: comp is a separate action from void and from discount [V] SQ-BILL. Toast lists no comp permission (handled as a discount) [V] T-PERM. | Yes, Square [V] SQ-BILL | UNKNOWN | UNKNOWN | Square: comped items still count in sales and inventory reports [V] SQ-BILL | Supervisor or manager only; reason and who it was for; stock stays deducted; own total on the day report. |
| Void after send | Toast: "Void Items / Orders" [V] T-PERM. Lightspeed: permission to cancel items already sent to kitchen or bar [V] LS-GRP. Loyverse: "Void saved items in open tickets" can be removed from cashiers [V] LV-OT. | Toast: prompted only if reasons are set up; otherwise "Are you sure?" [V] T-VOIDDOC. Square: yes [V] SQ-BILL. Foodics: yes [V] FD-REASON. | Toast: prompt for a manager access code or card swipe when the user lacks the permission [V] T-VOIDDOC | UNKNOWN | Toast: Reports > Cash and loss management > Voided orders and Voided items [V] T-VOID; "voids" section on the Z report [V] T-COD; kitchen ticket shows VOIDED [V] T-VOIDDOC | (decided: reason and "was it made"). Add: supervisor PIN, and "made" voids count as waste. |
| Refund | Toast: "Void / Refund Payments", a same-day-only variant, and "Unlinked Refunds" [V] T-PERM. Lightspeed: a "returns" permission [V] LS-GRP. | Foodics: yes [V] FD-REASON | Toast: a manager with the permission must complete it if the server lacks it [V] T-VOID | Time limit: Toast void is same business day only, after that a refund [V] T-VOID. Money limit: UNKNOWN. | Toast: Voided payments report [V] T-VOID. Loyverse: refunds visible in Receipts history [V] LV-FEAT; refunds blocked offline [V] LV-OFF | Same day: supervisor PIN and reason. Later days: manager only. Refund always points at the original bill and states how the money went back. |
| Reopen a closed bill | Lightspeed: permission to "change a closed order to an open order" [V] LS-GRP. Toast: "Find Checks" to reach closed checks [V] T-PERM; the payment must be voided first; a voided open check cannot be reopened [V] T-VOID. | UNKNOWN | Toast pattern as above [V] T-VOID | Toast: same business day for the payment void [V] T-VOID | Toast has a help article on identifying voided payments and items for reopened checks (title seen in search, not opened): UNKNOWN detail | Supervisor PIN and reason, same business day only. After that, a correction entry (see I10). Reopened bills listed at close. |
| No-sale drawer open | Toast: "No Sale" permission [V] T-PERM. Lightspeed: permission for "The cash drawer can be opened at any time without a transaction" [V] LS-GRP. | Foodics: "You can't open the drawer in the cashier without adding a reason" [V] FD-REASON | UNKNOWN | UNKNOWN | UNKNOWN on pages opened | Cashier may open with a reason; every open is counted on the till report. |
| Delete a tab or open bill | Loyverse: removing "Void saved items in open tickets" stops cashiers deleting saved tickets or removing items [V] LV-OT. Toast: "Bulk Void Open Checks" permission [V] T-VOIDDOC. | Toast: if reasons are set up [V] T-VOIDDOC | Toast: manager code or card [V] T-VOIDDOC | UNKNOWN | Toast Voided orders report [V] T-VOID | A tab with no sent lines can be closed by its owner. A tab with sent lines cannot be deleted, only voided line by line or closed as a walk-out. |
| Change payment method after close | Lightspeed: permission to "change the payment method used on a finished receipt" [V] LS-GRP. Toast: no direct change; void the payment and take it again (cash: Void; card: Adjust) [V] T-VOID. | UNKNOWN | Toast pattern as above [V] T-VOID | Toast: same business day [V] T-VOID | Toast Voided payments report [V] T-VOID | Supervisor PIN and reason, before the till is counted. After the count, manager only, as a correction entry. Both tills' expected figures update. |

Three rules that keep control from turning into a dead end (recommendation):

1. **Anyone can start, the right person finishes.** The waiter fills in the void or discount; the approval box appears on the same screen. This is what Toast does with the manager code prompt [V] T-VOIDDOC.
2. **If the approver is not there, there is still a way out.** Either approval from the manager's phone, or "do now, review later" up to a limit set by the owner, landing on a list the manager must clear. Neither was found in the pages opened (UNKNOWN), so this would be a talking point.
3. **Everything sensitive lands on one "exceptions" list** that is part of closing the day: voids, comps, discounts, refunds, reopened bills, payment-method changes, drawer opens, walk-outs, open items, price overrides.

---

## 4. Offline and failure behaviour

**Takeaway: all three products read keep selling without internet, but each has a hole a Ugandan venue would hit weekly: Toast staff cannot sign in while offline and terminals cannot see each other's tables; Loyverse open tickets stop sharing between devices; and none of the pages says how a duplicate order or payment is prevented. A local hub that keeps tables shared, PIN sign-in that works offline, and close-of-day that works offline would put Nimbus ahead of what is documented.**

| Question | Toast | Square | Loyverse |
|---|---|---|---|
| What staff can still do | Add and update orders on the same device; take card payments as offline payments; add tips; use scales; print kitchen tickets to backup printers if set up; open drawers and print receipts [V] T-OFF | Accept cash and most major cards; payments are "securely stored in your point of sale app" [V] SQ-OFF | Process and record sales; manage shifts; create and manage open tickets [V] LV-OFF |
| What is blocked | Orders on kitchen screens (unless local sync); sharing orders between devices; logging in or out; clocking in or out on another device; shift reviews; guest data and online reports; chip cards (swipe only); gift cards, loyalty, house accounts [V] T-OFF | Gift cards and some wallet payments; typed card numbers; refunding a payment still pending; close-of-day reporting; online orders may not appear [V] SQ-OFF | Refunds; signing out while unsynced receipts remain; new or edited customers; integrated card terminals; stock levels and negative-stock alerts; open tickets do not sync to other devices [V] LV-OFF |
| Internet down, local network up | "Local sync": one wired Toast device is the hub; kitchen screens on the same network show all orders; if there is no screen, tickets print at kitchen printers; a POS still cannot see another POS's orders; handhelds on a different subnet are cut off [V] T-LOCAL | UNKNOWN (not on the page opened) | UNKNOWN |
| How it syncs | Banner clears when the connection returns; check numbers resume and the offline numbers are not reused [V] T-OFF. Offline card payments "are submitted for authorization" on reconnect [V] T-PREP | Uploads automatically on reconnect, "no other action is required"; must be within 72 hours or the payment expires [V] SQ-OFF | Offline receipts are stored on the device, marked "Unsynced", and sync automatically; a manual sync button exists [V] LV-OFF |
| Who carries the risk on offline card payments | A declined offline payment "can't be re-run"; collect again from the guest; keep signed receipts [V] T-PREP, T-OFF | "You're responsible for any expired, declined, or disputed payments"; merchant sets a per-payment limit [V] SQ-OFF | Not applicable: integrated card terminals do not work offline [V] LV-OFF |
| Duplicate orders or payments | Not mentioned [V] T-OFF, T-LOCAL. Advice given: one device per employee. UNKNOWN how duplicates are prevented. | Not mentioned [V] SQ-OFF. UNKNOWN. | Not mentioned [V] LV-OFF. UNKNOWN. |
| Printer down | Backup printers "if configured" [V] T-OFF. Warning: do not restart the router while offline, devices cannot print until it is back [V] T-OFF | UNKNOWN | UNKNOWN |
| Kitchen screen down | Set up a kitchen printer to print what would have shown on the screen [V] T-OFF | Expo firing is not possible while the KDS is offline [V] SQ-FIRE | UNKNOWN |
| Things staff must not do | Do not uninstall, reinstall or clear app data: it "permanently removes stored data and payments" [V] T-OFF | Do not sign out, delete the app, switch mode or location, or factory reset while payments are pending [V] SQ-OFF | Cannot sign out until receipts are synced [V] LV-OFF |
| Power cut | Not addressed [V] T-PREP. Suggests a cellular backup for internet only. | UNKNOWN | UNKNOWN |

What this means for Nimbus (recommendation, with [PK] engineering practice):

- **Shared tables must survive an internet outage.** A waiter on terminal 1 and the cashier on terminal 2 must see the same table. Toast does not manage this even with its hub [V] T-LOCAL. A small local hub (a mini PC or the cashier terminal) on a router with a battery solves it.
- **PIN sign-in must work with no network.** Toast's lock-out [V] T-OFF is the worst documented dead end for a shared-terminal venue.
- **Cash and manually confirmed mobile money carry no offline risk.** The whole offline card problem (72-hour expiry, merchant bears declines) [V] SQ-OFF mostly disappears if card is recorded from the bank's own terminal with a reference number.
- **Duplicates.** Give every Send and every payment a unique key created on the terminal at the first tap, and make the hub ignore a second arrival with the same key [PK]. Disable the button after the first tap. Show "sent 14:02" on the line so the waiter trusts it.
- **Printer and kitchen screen.** Report the failure to the person who sent the order, on their screen, within seconds; then reroute to a backup printer or keep the ticket on the kitchen screen. Never fail silently.
- **Power.** Save every tap as it happens; on restart, reopen the same screen. No vendor page opened describes this, so it cannot be benchmarked: UNKNOWN.
- **Closing offline.** Toast and Square both block it [V] T-OFF, SQ-OFF. Nimbus should allow it and send the report later.

---

## 5. End of day

**Takeaway: the leaders make closing a checklist screen, not a button. It walks through what is still open, counts the cash blind, shows the difference, and prints or emails one report. The step they leave to habit is the review of voids, discounts and comps; Nimbus should make that an explicit step with a name on it.**

### Steps, in order

| Step | Who does it | What happens | Evidence |
|---|---|---|---|
| 1. Clear the floor | Supervisor | Every open table and tab is listed. Each is paid, handed to a named debtor, closed as a walk-out, or carried forward on purpose. | Toast: End day is unavailable until open checks are resolved [V] T-COD. Foodics: no pending orders or active orders [V] FD-DAY. |
| 2. Clear pending payments | Cashier | Mobile money "awaiting confirmation" is confirmed or reversed. | UNKNOWN in vendors. Nearest: Toast's check of denied offline payments in the Payments report [V] T-PREP. |
| 3. Each waiter's shift | Each waiter, or the supervisor for anyone who left | Open tables at zero; tips stated; cash owed handed over. | Toast: close or transfer checks, declare tips, pay or collect, clock out; a manager can do it for someone who left [V] T-SHIFT. |
| 4. Till count | Cashier, blind | Cashier types the counted cash without seeing the expected figure; the system shows the difference. | Loyverse blind option and expected, actual, difference [V] LV-SHIFT. Toast blind and full drawer permissions [V] T-PERM. |
| 5. Approve the difference | Supervisor | A difference above the venue's limit needs approval and a note. | Toast: over the threshold, "a manager must approve the closeout" [V] T-SHIFT. |
| 6. Cash movements | Supervisor | Pay-ins, pay-outs and cash drops are read against receipts. | Loyverse: all are in the shift report and exportable [V] LV-SHIFT. Toast Z report: pay-out breakdown, deposit summary [V] T-COD. |
| 7. Exceptions review | Manager | Voids, discounts, comps, refunds, reopened bills, payment-method changes, drawer opens, open items. | Toast Z report sections for voids, removals and discounts [V] T-COD; voided orders and voided payments reports [V] T-VOID. No vendor page makes this a required step: UNKNOWN. |
| 8. Stock snapshot | Store keeper and bar | Count of fast-moving and high-value items against expected; wastage entered. | Loyverse partial counts and adjustments [V] LV-FEAT. Tying it to the close: [PK]. |
| 9. Sign everyone out | Supervisor | One action. | Toast "Clock out all" [V] T-COD. Foodics pop-up [V] FD-DAY. |
| 10. Close the day (Z reading) | Manager | Day is locked; report printed and sent. | Toast prints the Z report from Close Out Day [V] T-COD. Foodics emails the End Of Day report [V] FD-DAY. |
| 11. Banking | Manager and owner or accountant | Cash handed over or banked; amount and both names recorded. | Toast deposit summary on the Z report [V] T-COD. Detail of the deposits article: UNKNOWN (not opened). |
| 12. Next-day reset | System, confirmed at opening | Sold-out marks and countdowns offered for clearing; carried-forward tables shown. | Toast: 86 stays until changed [V] T-86. |

### Reports

| Report | What it is | Evidence |
|---|---|---|
| X reading | Totals so far today, at any time, without closing anything. | [PK] definition. A Lightspeed article on Z and X reports appeared in search and was not opened. |
| Z reading | Totals for the day at close. On Toast it has selectable sections: sales categories, sales and tax summary, payment details, voids, removals, discounts, employee over or short, pay-outs, deposit, employee signature. | [V] T-COD. Note "Printing the Z Report does not turn the day over" [V] T-COD. |
| Till or shift report | Opening cash, cash sales, refunds, pay-ins, pay-outs, expected, actual, difference, per till. | [V] LV-SHIFT |
| Exceptions | Voided orders, voided items, voided payments. | [V] T-VOID |
| Open tables | Unpaid, paid-not-closed, still signed in. | [V] T-COD |
| Stock snapshot | Count versus expected for chosen items. | [V] LV-FEAT for counts; the snapshot at close is [PK] |

### Who signs what (recommendation, [PK] floor practice; only the signature line is sourced)

| Person | Signs for |
|---|---|
| Waiter | Own tables at zero and cash handed in. |
| Cashier | The counted cash (blind). |
| Supervisor | The difference, the cash movements, and anyone closed on their behalf. |
| Manager | The exceptions review and the Z reading. |
| Store keeper | The stock snapshot and wastage. |
| Owner | Receives the report; signs for cash received or banked. |
| Accountant | Posts the day from the Z reading; queries go back as correction entries, never edits. |

Toast's Z report has an optional "employee signature" section [V] T-COD, which supports having a signature line on the printed report.

---

## 6. Ten features the leaders have that Nimbus should not build now

**Takeaway: most of the weight in Toast and Square is there to serve card payments, American tipping law and online ordering. None of it helps a waiter in Kampala on a Friday night, and several items carry real financial risk.**

Statements about the Ugandan market are [PK] unless marked.

| # | Leader feature | Evidence it exists | Why it is wrong or wasteful here, now |
|---|---|---|---|
| 1 | Offline card payments stored and submitted later | [V] SQ-OFF, T-PREP | The venue carries every decline and the payment expires after 72 hours. Where cards are a small share of takings and outages are frequent, this builds a risk the owner did not ask for. Record card from the bank's terminal with a reference instead. |
| 2 | Integrated card terminals and chip handling | [V] LV-OFF, T-OFF | Needs a deal and certification with each bank or processor per country. Months of work for a minority payment method. Typed reference numbers do the job. |
| 3 | Self-ordering kiosks | [V] T-OFF, T-PREP (kiosk recovery is a whole section) | Hardware cost, and table service is the product. No demand at this stage. |
| 4 | Online ordering site and delivery-app menu sync | [V] T-86 (86 must sync to the ordering site and third-party apps) | A second product with its own support burden. Every menu change then has two places to go wrong. Wait until a client asks and pays. |
| 5 | Gift cards and loyalty points | [V] T-OFF, SQ-OFF, LV-FEAT | Stored value is a liability on the books and a fraud surface. A note on a regular guest and a named debtor account cover the real need. |
| 6 | Tip declaration, tip-out and tip pooling rules | [V] T-SHIFT | Built for US wage and tax law. Here: record the tip apart from sales and pay it out. Nothing more. |
| 7 | Labour scheduling and payroll-grade time clock | [V] LV-FEAT (time clock, hourly workload), T-COD (labour section on Z) | The PIN sign-in already says who was on. Rostering and pay are a separate product. |
| 8 | A handheld for every waiter with tableside card payment | [V] T-LOCAL (Toast Go handhelds, and their separate network problem) | Device cost, charging, theft and Wi-Fi coverage. Shared terminals with fast PIN switching are the decided model. Allow phones later, do not depend on them. |
| 9 | Automatic day turnover at a fixed hour that closes bills and signs staff out | [V] T-COD (04:00 auto-close, auto-capture) | A bar may run past any fixed hour, and unpaid tables must be decided by a person. A reminder plus a deliberate close is safer than automation that guesses. |
| 10 | Multi-location, franchise and catering modules | [V] LV-FEAT (multiple locations), T-86 (catering has separate item-limit rules) | Every screen and report gets a location switcher and a second set of rules. Build for one venue done well; keep a venue identifier in the data so it is possible later. |

Also not now, [PK] and unchecked: QR order-and-pay at the table; customer-facing second screen; emailed receipts as the main receipt (Loyverse queues them offline [V] LV-OFF); scale integration (typed weight is enough); kitchen firing of courses from an expo screen (keep it on the roadmap, see C6).

---

## 7. Method and limits

**Takeaway: twenty vendor pages were opened across five vendors (Toast, Square, Loyverse, Lightspeed, Foodics). Seven vendors on the brief were not opened at all, and no operator write-up was opened. Treat every [PK] as a lead to check, not a fact.**

- **Volume.** 9 searches and 21 page fetches (20 readable, 1 lost to a redirect). This is above the "about 15" asked for; I stopped when the next pages would have cost more than they added.
- **How pages were read.** The fetch tool returns the page as text through a small summarising model, with quotes. I did not see the raw HTML. Wording inside quotation marks is as relayed by that tool. Before putting a competitor quote on a slide, open the URL and confirm the sentence.
- **Opened and used ([V]):** the twenty keys in the table at the top.
- **Could not open:** Lightspeed Restaurant 7.9 release notes (https://www.lightspeedhq.co.uk/release-notes/restaurant/lightspeed-restaurant-7-9/ redirected to a general page; not followed).
- **Not opened at all:** Oracle MICROS Simphony, TouchBistro, Revel, SpotOn, Clover, Odoo POS, Petpooja, Posist/Restroworks. Anything said about them is [PK].
- **Seen in search results but not opened** (so not relied on): Square split-bill steps and seat management (article 8583); Square coursing (6428, 7748); Square offline time limits (8106); Toast "Add Void Reasons"; Toast "Identify Voided Payments and Items for Reopened Checks"; Toast shift review overview, cash management, cash deposits; Toast offline card payments and KDS offline pages; Loyverse predefined tickets and shift history; Lightspeed K-Series end-of-day articles; Foodics cashier settings and changelog on cashier authorities; Oracle Simphony manager guides.
- **No [2H] claims.** I used no review sites; everything is either a vendor page I opened or my own knowledge.
- **Things I looked for and did not find on any page opened (UNKNOWN):**
  - How any vendor prevents duplicate orders or duplicate payments.
  - Any handling of mobile money, pending or failed.
  - Any guidance on power cuts (as distinct from internet loss).
  - Remote approval when the manager is off site.
  - Per-action money limits (for example a discount cap per role).
  - Whether Toast's item quantity counts down automatically on each sale.
  - Split by amount or evenly (the Square page opened points to another article).
  - Allergy presentation on tickets; repeat round; auto-lock; search by initials; table colour by age; suggested tip.
  - Reservation no-show and late handling; deposits against a booking.
  - Remake or re-fire with a waste record.
  - Timed prices and what happens to an order that straddles the change.
- **Regional caution.** The Square bill-management page is the Australian help centre; menu paths may differ by country. Toast pages describe the US product; Toast itself notes that in the UK, Ireland and Canada card payments are captured at once, so same-day voids become refunds there [V] T-VOID.
- **Uganda-specific points** (mobile money share, card share, EFRIS, power) come from my own knowledge and are [PK]. The EFRIS requirement in particular should be checked with URA or the client's accountant before any build decision.
- **Recommendation columns** ("Nimbus: no dead end", "Nimbus rule") are advice. They are not sourced claims and carry no mark.
