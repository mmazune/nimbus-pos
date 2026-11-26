# How everything flows (the life cycles)

Written 26 Nov 2026 for the owner's ask: "Help me detangle this web. It flows in so many directions… I don't want dead ends. It should flow concurrently, interconnected, every single part."

The rule that keeps it untangled: **every action is one recorded event, and every event has four answers**: what it changes, who is told, where they see it, which report it lands in. If a new feature cannot fill all four, it is not finished. The table in section 2 is the whole system on one page; sections 3 to 12 walk each chain end to end. Words used: a *point store* is the stock that sits where it is used (the kitchen store: fridge and shelves in the kitchen; the bar store). It is fed by a *secondary store* or the *main store*, depending on the venue.

## 1. The people and their one screen

| Person | Home screen | Is told things through |
|---|---|---|
| Waiter | Floor | Table tiles, the Ready section, a line on the order |
| Cashier | Floor | Table tiles ("Bill"), Receipts, Till |
| Supervisor | Floor | Approvals section, Attention in Reservations, Team |
| Chef, bartender | Tickets | Ticket colours, the Store section badge, a banner |
| Store keeper | Requests | Requests badge, low-stock list |
| Manager | Today | "Needs you" list (laptop and phone) |
| Accountant | Costs | "No cost yet" and "Cost changed" lists |
| Owner | Today, all branches | "Needs you" list, the day report |

## 2. Every event on one page

| # | Event | It changes | Who is told, and where | Report it lands in |
|---|---|---|---|---|
| 1 | A line is sent | Ticket to its station. Stock leaves that station's point store by the recipe. Servings left are worked out again. | Chef or bar: Tickets. Everyone: the table tile. | Sales by item, usage, ticket times |
| 2 | Station taps Ready | Ticket done, time kept | Waiter: Ready section and tile | Ticket times |
| 3 | Waiter taps Collected | Served time kept | — | Ticket times |
| 4 | A sent line is voided | Line struck, bill drops. "Made": stock stays out, as waste. "Not made": stock goes back. | Chef: line struck on the ticket. Supervisor: it was theirs to approve. | Voids, waste |
| 5 | Servings left reach the low mark | Item shows "3 left" | Waiters: the item button. Chef: Store badge. | Sold-out log |
| 6 | Servings left reach zero, or someone marks sold out | Item goes grey for everyone | Waiters: grey button. Manager: Needs you. | Sold-out log |
| 7 | A point store falls below its minimum | A request is suggested, already filled in | Chef or bar: banner and Store badge | Low stock |
| 8 | Chef asks the store | Request waiting | Store keeper: Requests badge | Requests |
| 9 | Store keeper issues | Stock leaves the feeding store and is "on its way" | Chef: Store, "5 items on the way" | Requests, movements |
| 10 | Chef receives with a PIN | Stock arrives in the point store. Short? The gap is kept against the trip. | Store keeper and manager if short | Requests, variance |
| 11 | A feeding store falls below its minimum | Item joins the "To buy" list | Store keeper: Stock. Manager: Needs you. | To buy |
| 12 | A delivery is received | Stock in. Average cost works itself out. | Accountant: Cost changed. Chef: sold-out item can come back. | Purchases, cost |
| 13 | Stock is taken out for a reason (spoiled, broken, staff meal, missing…) | Stock out, with who and why | Manager: Needs you when it is "Missing" or above the limit | Waste by reason |
| 14 | A count is entered | Difference posted as an adjustment | Manager when the difference is above the limit | Variance |
| 15 | Payment in full | Order closed, table free, booking complete, till totals up | Cashier: receipt. Waiter: tile gone. | Day report, payments |
| 16 | Something needs approval | Request waiting | Supervisor: Approvals, or PIN on the spot. After 3 minutes: manager's phone. | Approvals log |
| 17 | Till is closed | Counted against expected | Supervisor signs a difference above the limit | Till report |
| 18 | The day is closed | Checks run, day report made, sold-out marks and counts reset | Owner: Today and the day report | Day report |
| 19 | A device drops out (printer, kitchen screen, internet) | Work is held or rerouted, never lost | Whoever is at that screen, at once. Supervisor: banner. | Device log |

## 3. A table, from empty to paid

Free → (tap) menu opens → first Send makes the order → tickets to kitchen and bar, stock leaves → Ready → Collected → more rounds, each Send only the new lines → Print bill (the bill gets a number) → more ordered after printing? the tile says "Bill changed" and the payment screen shows both totals → Take payment → table free, booking complete, receipt under Receipts. Someone else's table: look, print, ask to take over. Nothing here ends without a next step: an unpaid table at day close goes to section 11.

## 4. A dish, from sent to served

Sent → on the station's screen, oldest first → green under 10 minutes, amber under 20, red after (per station setting) → Ready → waiter's Ready section → Collected. Burnt or dropped: the chef taps **Remake** on the ticket; ingredients leave stock a second time with the reason "kitchen error"; the guest is not charged twice. Guest sends it back: the supervisor voids the line as "made"; it is waste. Ticket lost or printer down: the ticket is still on screen and under Done, and can be sent again.

## 5. Running low, then sold out, then back

1. Every send lowers the point store. The system works out **servings left** for each dish: for every ingredient, stock on hand divided by what one serving needs; the smallest answer wins.
2. At the low mark (5 by default, set per item) the button shows "3 left". Waiters see it before they promise the dish.
3. At zero the button goes grey on every screen. A waiter who taps it sees why and since when. The last serving goes to whoever sends first; the second waiter is told at once.
4. A line that was entered but not yet sent when the dish ran out turns red on that order: remove it or ask the kitchen. The rest of the order still sends.
5. The manager's Today shows "Lamb chops sold out since 19:20".
6. It comes back by itself when stock arrives (section 6), or when the chef taps **We have it**.

The chef is always in charge: **Sold out** and **Set a number** ("12 goat stews left") work by hand, with no stock set up at all. And because stock records are never perfect, each venue picks how strict stock-driven sold-out is: *Off* (hand only), *Warn* (amber "check stock", still sells; the default) or *Block* (goes grey). "We have it" overrides a block for the day and raises a count task for that ingredient, so the record is fixed instead of fought.

## 6. Stock, from the gate to the plate

Supplier → **main store** (delivery checked against what was ordered: full, short, over, or a different price) → **secondary store**, if the venue has one → **point store** (kitchen, bar) → the plate, by recipe, on send.

- Each store keeps a *minimum* and a *fill-to* level per item. Crossing the minimum makes one alert, not one per sale, and it clears itself when stock is back above the line.
- The chef's request is suggested for them: everything below minimum, topped up to fill-to, rounded to whole packs. One tap sends it. They can change any line.
- Issue → on its way → received with a PIN. Short on arrival is recorded against the trip, so nobody argues later about where 12 buns went.
- A request nobody answers in 15 minutes shows on the supervisor's and manager's screens.
- If the feeding store cannot cover it, the item joins **To buy**, which the manager turns into an order to a supplier.
- A venue with one store room simply has one store that also feeds the kitchen. A venue can start with no stock at all and sell everything "as bought".

## 7. Stock that leaves for another reason

One action, **Take out of stock**, on the chef's, bartender's and store keeper's screens: pick the item, the amount, the reason.

| Reason | Who can | Extra step |
|---|---|---|
| Spoiled or expired | Chef, bartender, store keeper | — |
| Burnt, dropped, broken | Chef, bartender, store keeper | — |
| Staff meal | Chef | Counted on its own line, never as waste |
| On the house | Supervisor, manager, from the order | Reason and for whom |
| Missing | Chef, bartender, store keeper | Manager is told at once; a count of that item is asked for |
| Returned to supplier | Store keeper | Linked to the delivery |
| We found more | Store keeper, manager | Adds stock back, with a reason |

Above a value the venue sets (UGX 50,000 an entry by default) a supervisor's PIN is needed. "Stolen" is not a button: theft shows up as *missing* or as a count that does not match, and the manager can mark an entry as theft after looking into it. Nothing is ever deleted; a mistake is corrected by a new entry.

## 8. Counting, and what does not add up

Spot count (ten items, a few minutes), full count (month end), bar count (open bottles every shift). The counter does not see the expected number. Selling carries on during a count: each line is compared with the books at the minute it was entered. The difference is posted as an adjustment. Above the venue's limit the manager must write what happened before the count closes, and the item goes on the variance report. A count is also asked for automatically after "Missing" and after "We have it".

## 9. Cost, from the invoice to the margin

Delivery price → average cost of what is in the store → cost of each recipe → margin of each dish. A price change on a delivery puts the item on the accountant's "Cost changed" list and updates every dish that uses it. An item with no cost shows no margin anywhere until the accountant sets one. Waste, staff meals and count differences are valued at the same cost.

## 10. Asking for permission

A waiter or cashier taps something they may not do alone → a request with the reason → the supervisor types a PIN on that same screen, or answers from Approvals → nobody answers in 3 minutes: it goes to the manager's phone → approved or declined, with a name and a time → the asker sees the answer at once. Every answer is in the approvals log.

## 11. Closing the day

The day does not close with loose ends. The close screen lists them and each has a way out:

| Loose end | Way out |
|---|---|
| Table or tab still open | Take payment, carry it to tomorrow (guests past midnight), or close as a walk-out with a reason (manager) |
| Line entered but never sent | Send or remove |
| Till not counted | Count and close |
| Mobile money still pending | Enter the reference, or change the method |
| Request still on its way | Receive, or mark not arrived |

Then: the day report is made and reaches the owner's Today; sold-out marks and counted-down numbers reset (yesterday's list is shown to the chef at opening: "still sold out?"); a business day ends at the hour the venue sets, not at midnight.

## 12. When something breaks

| Break | What staff see | What is kept |
|---|---|---|
| Internet drops | "Not connected" on every screen. Orders can still be entered and are held on the device. | Held lines send themselves once, never twice, when the line is back |
| Printer out | The bill or ticket shows on screen and waits in a queue; the supervisor sees which printer | Print again from the queue |
| Kitchen screen out | Tickets print on the kitchen printer instead | Nothing lost; under Done when it returns |
| Terminal dies mid-order | Sign in at another terminal; sent lines are there | Unsent lines on the dead terminal are lost and must be re-entered |
| Double tap on Send or Pay | The second tap does nothing | One ticket, one payment |
