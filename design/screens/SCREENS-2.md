# Screens, second set: the wiring table

Drawn by track T7 on 26 Nov 2026 for the screens `docs/direction/06-roadmap.md` lists as owed. Same columns as `SCREENS.md`; that file keeps the first 38. A builder changes the last column of its own rows only. Every drawing here was measured (`reports/proof/T7/measure-g*.json`) and scored by a reviewer that drew none of them (`reports/proof/T7/review-*.md`).

184 drawings in 11 groups.

## 1. Start of a shift

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Lock-PIN` | 1280 × 800 | All touch roles | Lock screen, PIN pad, two digits typed | `/lock (new)` | U1 | drawn, awaiting the owner |
| `Lock-PIN-Phone` | 390 × 844 | All touch roles | Lock screen on a phone | `/lock (new)` | U1 | drawn, awaiting the owner |
| `Lock-Wrong-PIN` | 1280 × 800 | All touch roles | Wrong PIN, tries left | `/lock (new)` | U1 | drawn, awaiting the owner |
| `Lock-Wrong-PIN-Phone` | 390 × 844 | All touch roles | Wrong PIN on a phone | `/lock (new)` | U1 | drawn, awaiting the owner |
| `PIN-Set-Own` | 1280 × 800 | All touch roles | Set your own PIN, typed twice by the person | `/pin/set (new)` | U1 | drawn, awaiting the owner |
| `PIN-Set-Own-Phone` | 390 × 844 | All touch roles | Set your own PIN on a phone | `/pin/set (new)` | U1 | drawn, awaiting the owner |
| `Shift-Start` | 1280 × 800 | Waiter | Start my shift, after the PIN | `/shift/start (new)` | U1 | drawn, awaiting the owner |
| `Shift-Start-Phone` | 390 × 844 | Waiter | Start my shift on a phone | `/shift/start (new)` | U1 | drawn, awaiting the owner |
| `Floor-Shift-Not-Started` | 1280 × 800 | Waiter | Floor before the shift starts: look only | `/waiter/floor` | U1 | drawn, awaiting the owner |
| `Floor-Shift-Not-Started-Phone` | 390 × 844 | Waiter | Floor before the shift starts, phone | `/waiter/floor` | U1 | drawn, awaiting the owner |
| `Cashier-Floor` | 1280 × 800 | Cashier | The cashier’s floor: every table with its waiter, Bill tables marked | `/cashier/floor` | U1 | drawn, awaiting the owner |
| `Cashier-Floor-Phone` | 390 × 844 | Cashier | The cashier’s floor on a phone | `/cashier/floor` | U1 | drawn, awaiting the owner |
| `Floor-Tabs` | 1280 × 800 | Waiter | The Tabs area with New tab | `/waiter/floor?area=tabs` | U1, needs E3 | drawn, awaiting the owner |
| `Floor-Tabs-Phone` | 390 × 844 | Waiter | Tabs on a phone, as rows with their notes | `/waiter/floor?area=tabs` | U1, needs E3 | drawn, awaiting the owner |
| `Tab-Name` | 1280 × 800 | Waiter | New tab: number given, a note to find the guests | `/waiter/floor?area=tabs#new-tab` | U1, needs E3 | drawn, awaiting the owner |
| `Tab-Name-Phone` | 390 × 844 | Waiter | New tab on a phone | `/waiter/floor?area=tabs#new-tab` | U1, needs E3 | drawn, awaiting the owner |

## 2. Table actions

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Table-Move` | 1280 × 800 | Waiter | Move table: pick a free table; the order goes with the guests | `/waiter/floor?tableId=#move` | U3, needs E3 | drawn, awaiting the owner |
| `Table-Move-Phone` | 390 × 844 | Waiter | Move table: pick a free table; the order goes with the guests, phone | `/waiter/floor?tableId=#move` | U3, needs E3 | drawn, awaiting the owner |
| `Table-Join` | 1280 × 800 | Waiter | Join tables: two parties become one bill | `/waiter/floor?tableId=#join` | U3, needs E3 | drawn, awaiting the owner |
| `Table-Join-Phone` | 390 × 844 | Waiter | Join tables: two parties become one bill, phone | `/waiter/floor?tableId=#join` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Guest` | 1280 × 800 | Waiter | Split by guest: tap a line, then a guest | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Guest-Phone` | 390 × 844 | Waiter | Split by guest: tap a line, then a guest, phone | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Item` | 1280 × 800 | Waiter | Split by item: tap lines to move them to a new bill | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Item-Phone` | 390 × 844 | Waiter | Split by item: tap lines to move them to a new bill, phone | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Amount` | 1280 × 800 | Waiter | Split by amount: the first bill takes a sum, the rest stays | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Amount-Phone` | 390 × 844 | Waiter | Split by amount: the first bill takes a sum, the rest stays, phone | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Even` | 1280 × 800 | Waiter | Split evenly: tap the number of people | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Split-Even-Phone` | 390 × 844 | Waiter | Split evenly: tap the number of people, phone | `/waiter/floor?tableId=#split` | U3, needs E3 | drawn, awaiting the owner |
| `Discount` | 1280 × 800 | Waiter | Discount: named ones for staff, any other amount needs a supervisor’s PIN | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `Discount-Phone` | 390 × 844 | Waiter | Discount: named ones for staff, any other amount needs a supervisor’s PIN, phone | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `Change-Waiter` | 1280 × 800 | Supervisor | Change waiter: a supervisor gives a table to another waiter on shift | `/supervisor/floor?tableId=#waiter` | U3, needs E3 | drawn, awaiting the owner |
| `Change-Waiter-Phone` | 390 × 844 | Supervisor | Change waiter: a supervisor gives a table to another waiter on shift, phone | `/supervisor/floor?tableId=#waiter` | U3, needs E3 | drawn, awaiting the owner |
| `Handover-Offer` | 1280 × 800 | Waiter | Hand over: offer tables to a named colleague before going home | `/waiter/me#hand-over` | U4, needs E3 | drawn, awaiting the owner |
| `Handover-Offer-Phone` | 390 × 844 | Waiter | Hand over: offer tables to a named colleague before going home, phone | `/waiter/me#hand-over` | U4, needs E3 | drawn, awaiting the owner |
| `Handover-Accept` | 1280 × 800 | Waiter | Hand over: the colleague accepts on their own screen | `/waiter/floor#hand-over` | U4, needs E3 | drawn, awaiting the owner |
| `Handover-Accept-Phone` | 390 × 844 | Waiter | Hand over: the colleague accepts on their own screen, phone | `/waiter/floor#hand-over` | U4, needs E3 | drawn, awaiting the owner |
| `Line-Move` | 1280 × 800 | Waiter | Move a line to the right table, with no void | `/waiter/floor?tableId=#move-line` | U3, needs E3 | drawn, awaiting the owner |
| `Line-Move-Phone` | 390 × 844 | Waiter | Move a line to the right table, with no void, phone | `/waiter/floor?tableId=#move-line` | U3, needs E3 | drawn, awaiting the owner |
| `Order-Cancel` | 1280 × 800 | Supervisor | Cancel the whole order: every line voided with one reason | `/supervisor/floor?tableId=#cancel` | U3, needs E1 | drawn, awaiting the owner |
| `Order-Cancel-Phone` | 390 × 844 | Supervisor | Cancel the whole order: every line voided with one reason, phone | `/supervisor/floor?tableId=#cancel` | U3, needs E1 | drawn, awaiting the owner |
| `Supervisor-PIN-Pad` | 1280 × 800 | Waiter | A supervisor types their PIN on the waiter’s screen to approve | `/waiter/floor?tableId=#approve` | U3, needs E9 | drawn, awaiting the owner |
| `Supervisor-PIN-Pad-Phone` | 390 × 844 | Waiter | A supervisor types their PIN on the waiter’s screen to approve, phone | `/waiter/floor?tableId=#approve` | U3, needs E9 | drawn, awaiting the owner |

## 3. The order screen’s other states

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Order-Search` | 1280 × 800 | Waiter | Search the whole menu: results with where each item lives | `/waiter/floor?tableId=&q=` | U2 | drawn, awaiting the owner |
| `Order-Search-Phone` | 390 × 844 | Waiter | Search results on a phone | `/waiter/floor?tableId=&q=` | U2 | drawn, awaiting the owner |
| `Order-Search-None` | 1280 × 800 | Waiter | Search finds nothing: say so, offer an open item | `/waiter/floor?tableId=&q=` | U2, open item needs E13 | drawn, awaiting the owner |
| `Order-Search-None-Phone` | 390 × 844 | Waiter | Nothing found on a phone | `/waiter/floor?tableId=&q=` | U2, open item needs E13 | drawn, awaiting the owner |
| `Order-Line-Sold-Out` | 1280 × 800 | Waiter | A line not yet sent whose item sold out: red, Send skips it | `/waiter/floor?tableId=` | U2, needs E2 and E10 | drawn, awaiting the owner |
| `Order-Line-Sold-Out-Phone` | 390 × 844 | Waiter | A line that sold out, on a phone | `/waiter/floor?tableId=` | U2, needs E2 and E10 | drawn, awaiting the owner |
| `Order-Hold-Fire` | 1280 × 800 | Waiter | Hold and fire: a held main is fired, 3 seconds to undo | `/waiter/floor?tableId=` | U2, needs E5 | drawn, awaiting the owner |
| `Order-Hold-Fire-Phone` | 390 × 844 | Waiter | A held main with Fire, and the undo after firing | `/waiter/floor?tableId=` | U2, needs E5 | drawn, awaiting the owner |
| `Order-Line-Allergy` | 1280 × 800 | Waiter | A line’s options: allergy, takeaway, note | `/waiter/floor?tableId=` | U2, needs E5 | drawn, awaiting the owner |
| `Order-Line-Allergy-Phone` | 390 × 844 | Waiter | A line’s options on a phone | `/waiter/floor?tableId=` | U2, needs E5 | drawn, awaiting the owner |
| `Order-Same-Again` | 1280 × 800 | Waiter | Same again: one tap re-adds the last sent drinks | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `Order-Same-Again-Phone` | 390 × 844 | Waiter | Same again on a phone | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `Order-Subgroup` | 1280 × 800 | Waiter | A group with a sub-group filter row | `/waiter/floor?tableId=` | U2, needs E2 | drawn, awaiting the owner |
| `Order-Subgroup-Phone` | 390 × 844 | Waiter | Sub-group filter on a phone: three chips and More | `/waiter/floor?tableId=` | U2, needs E2 | drawn, awaiting the owner |
| `Order-Offers` | 1280 × 800 | Waiter | Offers: what applies now, and when the rest come back | `/waiter/floor?tableId=` | U2, happy hour needs E13 | drawn, awaiting the owner |
| `Order-Offers-Phone` | 390 × 844 | Waiter | Offers on a phone | `/waiter/floor?tableId=` | U2, happy hour needs E13 | drawn, awaiting the owner |

## 4. Paying

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Pay-Mobile-Money` | 1280 × 800 | Cashier | Mobile money by reference: the cashier types the code from the guest’s message | `/cashier/floor?tableId=#pay` | U3, needs E13 | drawn, awaiting the owner |
| `Pay-Mobile-Money-Phone` | 390 × 844 | Cashier | Mobile money by reference, phone | `/cashier/floor?tableId=#pay` | U3, needs E13 | drawn, awaiting the owner |
| `Pay-Mobile-Pending` | 1280 × 800 | Cashier | Mobile money pending: no confirmation yet, the table shows Paying | `/cashier/floor?tableId=#pay` | U3, needs E13 | drawn, awaiting the owner |
| `Pay-Mobile-Pending-Phone` | 390 × 844 | Cashier | Mobile money pending, phone | `/cashier/floor?tableId=#pay` | U3, needs E13 | drawn, awaiting the owner |
| `Pay-Card` | 1280 × 800 | Cashier | Card by reference: run it on the machine, type the approval code | `/cashier/floor?tableId=#pay` | U3 | drawn, awaiting the owner |
| `Pay-Card-Phone` | 390 × 844 | Cashier | Card by reference, phone | `/cashier/floor?tableId=#pay` | U3 | drawn, awaiting the owner |
| `Pay-Split-Part` | 1280 × 800 | Cashier | Split payment part-paid: what is paid, what is left, the next method | `/cashier/floor?tableId=#pay` | U3 | drawn, awaiting the owner |
| `Pay-Split-Part-Phone` | 390 × 844 | Cashier | Split payment part-paid, phone | `/cashier/floor?tableId=#pay` | U3 | drawn, awaiting the owner |
| `Pay-Paid` | 1280 × 800 | Cashier | Paid: change to give, the table is free, the receipt | `/cashier/floor?tableId=#paid` | U3, needs E1 | drawn, awaiting the owner |
| `Pay-Paid-Phone` | 390 × 844 | Cashier | Paid on a phone | `/cashier/floor?tableId=#paid` | U3, needs E1 | drawn, awaiting the owner |
| `Pay-Bill-Changed` | 1280 × 800 | Cashier | “Bill changed”: the printed total and the new one side by side | `/cashier/floor?tableId=#pay` | U3, needs E4 and E10 | drawn, awaiting the owner |
| `Pay-Bill-Changed-Phone` | 390 × 844 | Cashier | “Bill changed” on a phone, phone | `/cashier/floor?tableId=#pay` | U3, needs E4 and E10 | drawn, awaiting the owner |
| `Refund-Supervisor` | 1280 × 800 | Cashier | Refund from a paid bill: lines, reason, a supervisor’s PIN on the spot | `/cashier/receipts#refund` | U3, needs E9 | drawn, awaiting the owner |
| `Refund-Supervisor-Phone` | 390 × 844 | Cashier | Refund asking for a supervisor on a phone | `/cashier/receipts#refund` | U3, needs E9 | drawn, awaiting the owner |
| `Walk-Out` | 1280 × 800 | Manager | Walk-out: the manager closes an unpaid table with a reason | `/manager/operations/floor?tableId=#walk‑out` | U3, needs E13 | drawn, awaiting the owner |
| `Walk-Out-Phone` | 390 × 844 | Manager | Walk-out on a phone | `/manager/operations/floor?tableId=#walk‑out` | U3, needs E13 | drawn, awaiting the owner |

## 5. Supervisor

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Supervisor-Team` | 1280 × 800 | Supervisor | Team: who is on, their tables and sales; move tables between waiters | `/supervisor/team (new)` | U4, needs E3 | drawn, awaiting the owner |
| `Supervisor-Team-Phone` | 390 × 844 | Supervisor | Team on a phone: tap a person to move their tables | `/supervisor/team (new)` | U4, needs E3 | drawn, awaiting the owner |
| `Supervisor-Me` | 1280 × 800 | Supervisor | Me: shift, my day as a supervisor, requests, PIN, log out | `/supervisor/me` | U4 | drawn, awaiting the owner |
| `Supervisor-Me-Phone` | 390 × 844 | Supervisor | Me on a phone | `/supervisor/me` | U4 | drawn, awaiting the owner |
| `Booking-New` | 1280 × 800 | Supervisor | New booking: name, phone, day, time, guests, table, note | `/supervisor/reservations#new` | U4 | drawn, awaiting the owner |
| `Booking-New-Phone` | 390 × 844 | Supervisor | New booking on a phone | `/supervisor/reservations#new` | U4 | drawn, awaiting the owner |
| `Booking-Edit` | 1280 × 800 | Supervisor | Edit a booking: time, guests, table; a too-small table is moved and said | `/supervisor/reservations?id=` | U4 | drawn, awaiting the owner |
| `Booking-Edit-Phone` | 390 × 844 | Supervisor | Edit a booking on a phone | `/supervisor/reservations?id=` | U4 | drawn, awaiting the owner |
| `Booking-Cancel` | 1280 × 800 | Supervisor | Cancel a booking with a reason; the deposit is kept until a manager decides | `/supervisor/reservations?id=#cancel` | U4 | drawn, awaiting the owner |
| `Booking-Cancel-Phone` | 390 × 844 | Supervisor | Cancel a booking on a phone | `/supervisor/reservations?id=#cancel` | U4 | drawn, awaiting the owner |
| `Booking-No-Show` | 1280 × 800 | Supervisor | No‑show: the supervisor decides; the table frees | `/supervisor/reservations?id=#no-show` | U4 | drawn, awaiting the owner |
| `Booking-No-Show-Phone` | 390 × 844 | Supervisor | No‑show on a phone | `/supervisor/reservations?id=#no-show` | U4 | drawn, awaiting the owner |
| `Booking-History` | 1280 × 800 | Supervisor | History: what happened to each booking, with who and when | `/supervisor/reservations?view=history` | U4 | drawn, awaiting the owner |
| `Booking-History-Phone` | 390 × 844 | Supervisor | History on a phone | `/supervisor/reservations?view=history` | U4 | drawn, awaiting the owner |
| `Booking-Attention` | 1280 × 800 | Supervisor | Attention: late, table busy, no table; the next step for each | `/supervisor/reservations?view=attention` | U4 | drawn, awaiting the owner |
| `Booking-Attention-Phone` | 390 × 844 | Supervisor | Attention on a phone | `/supervisor/reservations?view=attention` | U4 | drawn, awaiting the owner |

## 6. Kitchen and bar

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Bar` | 1920 × 1080 | Bartender | The bar screen: drink tickets, to pour now, the bar store | `/bar (new)` | U5, needs E5 | drawn, awaiting the owner |
| `Bar-Phone` | 390 × 844 | Bartender | The bar screen on a phone | `/bar (new)` | U5, needs E5 | drawn, awaiting the owner |
| `Kitchen-Done` | 1920 × 1080 | Chef | Done: tickets already bumped, with bring back | `/kitchen (new)?view=done` | U5, needs E5 | drawn, awaiting the owner |
| `Kitchen-Done-Phone` | 390 × 844 | Chef | Done on a phone | `/kitchen (new)?view=done` | U5, needs E5 | drawn, awaiting the owner |
| `Kitchen-Sold-Out` | 1920 × 1080 | Chef | Sold out: mark, back on, numbers left, stock warnings | `/kitchen (new)?view=sold-out` | U5, needs E2 and E10 | drawn, awaiting the owner |
| `Kitchen-Sold-Out-Phone` | 390 × 844 | Chef | Sold out on a phone | `/kitchen (new)?view=sold-out` | U5, needs E2 and E10 | drawn, awaiting the owner |
| `Kitchen-Set-Number` | 1920 × 1080 | Chef | Set a number: “12 goat stews left”, counted down by each send | `/kitchen (new)?view=sold-out#count` | U5, needs E2 | drawn, awaiting the owner |
| `Kitchen-Set-Number-Phone` | 390 × 844 | Chef | Set a number on a phone | `/kitchen (new)?view=sold-out#count` | U5, needs E2 | drawn, awaiting the owner |
| `Kitchen-Low-Stock` | 1920 × 1080 | Chef | Low stock: one banner on Tickets, the request already written | `/kitchen (new)` | U6, needs E7 and E10 | drawn, awaiting the owner |
| `Kitchen-Low-Stock-Phone` | 390 × 844 | Chef | Low-stock banner on a phone | `/kitchen (new)` | U6, needs E7 and E10 | drawn, awaiting the owner |
| `Kitchen-Remake` | 1920 × 1080 | Chef | Remake: stock out again as kitchen error, no second charge | `/kitchen (new)#remake` | U5, needs E6 | drawn, awaiting the owner |
| `Kitchen-Remake-Phone` | 390 × 844 | Chef | Remake on a phone | `/kitchen (new)#remake` | U5, needs E6 | drawn, awaiting the owner |
| `Kitchen-Opening` | 1920 × 1080 | Chef | Opening: yesterday’s sold-out list, “still sold out?”, one tap each | `/kitchen (new)#opening` | U5, needs E2 and E11 | drawn, awaiting the owner |
| `Kitchen-Opening-Phone` | 390 × 844 | Chef | Opening list on a phone | `/kitchen (new)#opening` | U5, needs E2 and E11 | drawn, awaiting the owner |

## 7. Stock

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Store-Stock` | 1280 × 800 | Store keeper | Stock: each store’s items with minimum and fill-to; one item’s levels | `/store/stock (new)` | U6, needs E7 | drawn, awaiting the owner |
| `Store-Stock-Phone` | 390 × 844 | Store keeper | Stock on a phone | `/store/stock (new)` | U6, needs E7 | drawn, awaiting the owner |
| `Store-Receive` | 1280 × 800 | Store keeper | Receive a delivery line by line: full, short, dearer | `/store/receive (new)` | U6, needs E7 | drawn, awaiting the owner |
| `Store-Receive-Phone` | 390 × 844 | Store keeper | Receive a delivery on a phone | `/store/receive (new)` | U6, needs E7 | drawn, awaiting the owner |
| `Store-Count` | 1280 × 800 | Store keeper | Count, blind: type what is on the shelf; expected numbers stay hidden | `/store/count (new)` | U6, needs E7 | drawn, awaiting the owner |
| `Store-Count-Phone` | 390 × 844 | Store keeper | Blind count on a phone, one item at a time | `/store/count (new)` | U6, needs E7 | drawn, awaiting the owner |
| `Take-Out-Terminal` | 1280 × 800 | Store keeper | Take out of stock on a terminal: item, amount, a fixed reason | `/store/stock#take-out` | U6, needs E6 | drawn, awaiting the owner |
| `Take-Out-Terminal-Phone` | 390 × 844 | Store keeper | Take out of stock on a phone | `/store/stock#take-out` | U6, needs E6 | drawn, awaiting the owner |
| `Request-Received-Short` | 1280 × 800 | Chef | A request received short, with the receiver’s PIN; the gap is kept against the trip | `/kitchen/store#receive` | U6, needs E7 | drawn, awaiting the owner |
| `Request-Received-Short-Phone` | 390 × 844 | Chef | A request received short on a phone | `/kitchen/store#receive` | U6, needs E7 | drawn, awaiting the owner |
| `To-Buy` | 1280 × 800 | Store keeper | To buy: everything below minimum, suggested to fill-to, turned into an order | `/store/to-buy (new)` | U7, needs E7 | drawn, awaiting the owner |
| `To-Buy-Phone` | 390 × 844 | Store keeper | To buy on a phone | `/store/to-buy (new)` | U7, needs E7 | drawn, awaiting the owner |
| `Stores-Setup` | 1440 × 900 | Manager | Stores set-up: main, point stores, which stations take from which | `/manager/stock/stores (new)` | U7, needs E7 | drawn, awaiting the owner |
| `Stores-Setup-Phone` | 390 × 844 | Manager | Stores set-up on a phone | `/manager/stock/stores (new)` | U7, needs E7 | drawn, awaiting the owner |

## 8. Manager on a laptop

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Manager-Today` | 1440 × 900 | Manager | Today on a laptop: sales, what needs the manager, how it was paid | `/manager/overview` | U7 | drawn, awaiting the owner |
| `Manager-Today-Phone` | 390 × 844 | Manager | Today on a phone (same as the approved Manager-Phone-Today, with the sold-out line) | `/manager/overview` | U7 | drawn, awaiting the owner |
| `Manager-Menu-List` | 1440 × 900 | Manager | Menu list: the tree on the left, items with price, how sold, station and today’s state | `/manager/menu (new)` | U7, needs E2 | drawn, awaiting the owner |
| `Manager-Menu-List-Phone` | 390 × 844 | Manager | Menu list on a phone | `/manager/menu (new)` | U7, needs E2 | drawn, awaiting the owner |
| `Manager-Item-Servings` | 1440 × 900 | Manager | An item sold by measure: servings with price and cost, and choice groups | `/manager/menu/items/[id] (new)` | U7, needs E2 | drawn, awaiting the owner |
| `Manager-Item-Servings-Phone` | 390 × 844 | Manager | Item with servings on a phone | `/manager/menu/items/[id] (new)` | U7, needs E2 | drawn, awaiting the owner |
| `Manager-Staff` | 1440 × 900 | Manager | Staff list: who, role, area, today, and whether they have set their own PIN | `/manager/staff/directory` | U7 | drawn, awaiting the owner |
| `Manager-Staff-Phone` | 390 × 844 | Manager | Staff list on a phone | `/manager/staff/directory` | U7 | drawn, awaiting the owner |
| `Manager-Person` | 1440 × 900 | Manager | A person: role, areas, roster; the PIN is only ever set by its owner | `/manager/staff/directory/[id] (new)` | U7 | drawn, awaiting the owner |
| `Manager-Person-Phone` | 390 × 844 | Manager | A person on a phone | `/manager/staff/directory/[id] (new)` | U7 | drawn, awaiting the owner |
| `Manager-Approvals` | 1440 × 900 | Manager | Approvals on a laptop: the waiting list and the chosen request | `/manager/approvals` | U7, needs E9 | drawn, awaiting the owner |
| `Manager-Approvals-Phone` | 390 × 844 | Manager | Approvals list on a phone (the approved Manager-Phone-Approve opens from a row) | `/manager/approvals` | U7, needs E9 | drawn, awaiting the owner |
| `Settings-Areas` | 1440 × 900 | Manager | Settings, areas: each area and its tables; extra tables added in bulk | `/manager/settings#areas` | U7, needs E3 | drawn, awaiting the owner |
| `Settings-Areas-Phone` | 390 × 844 | Manager | Settings, areas: each area and its tables; extra tables added in bulk, phone | `/manager/settings#areas` | U7, needs E3 | drawn, awaiting the owner |
| `Settings-Stations` | 1440 × 900 | Manager | Settings, stations and late times | `/manager/settings#stations` | U7, needs E5 | drawn, awaiting the owner |
| `Settings-Stations-Phone` | 390 × 844 | Manager | Settings, stations and late times, phone | `/manager/settings#stations` | U7, needs E5 | drawn, awaiting the owner |
| `Settings-Limits` | 1440 × 900 | Manager | Settings, limits: caps, PIN thresholds, till and count differences | `/manager/settings#limits` | U7, needs E9 | drawn, awaiting the owner |
| `Settings-Limits-Phone` | 390 × 844 | Manager | Settings, limits: caps, PIN thresholds, till and count differences, phone | `/manager/settings#limits` | U7, needs E9 | drawn, awaiting the owner |
| `Settings-Business-Day` | 1440 × 900 | Manager | Settings, the business day: when it ends, what resets | `/manager/settings#the` | U7, needs E11 | drawn, awaiting the owner |
| `Settings-Business-Day-Phone` | 390 × 844 | Manager | Settings, the business day: when it ends, what resets, phone | `/manager/settings#the` | U7, needs E11 | drawn, awaiting the owner |
| `Day-Close` | 1440 × 900 | Manager | Day close: the loose ends and the way out of each; the day report after | `/manager/overview/close (new)` | U9, needs E11 | drawn, awaiting the owner |
| `Day-Close-Phone` | 390 × 844 | Manager | Day close on a phone | `/manager/overview/close (new)` | U9, needs E11 | drawn, awaiting the owner |

## 9. Reports

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Report-Day` | 1440 × 900 | Owner, manager | The day report: sales, how it was paid, what went wrong, what sold most | `/manager/reports/day (new)` | U9, needs E11 | drawn, awaiting the owner |
| `Report-Day-Phone` | 390 × 844 | Owner, manager | The day report: sales, how it was paid, what went wrong, what sold most, phone | `/manager/reports/day (new)` | U9, needs E11 | drawn, awaiting the owner |
| `Report-Till` | 1440 × 900 | Cashier (own), supervisor, manager | Till report: float, cash in, paid out, dropped, counted, difference | `/manager/reports/till (new)` | U9, needs E11 | drawn, awaiting the owner |
| `Report-Till-Phone` | 390 × 844 | Cashier (own), supervisor, manager | Till report: float, cash in, paid out, dropped, counted, difference, phone | `/manager/reports/till (new)` | U9, needs E11 | drawn, awaiting the owner |
| `Report-Voids` | 1440 × 900 | Manager | Voids: what, who asked, who approved, made or not, why, value | `/manager/reports/voids (new)` | U9, needs E1 | drawn, awaiting the owner |
| `Report-Voids-Phone` | 390 × 844 | Manager | Voids: what, who asked, who approved, made or not, why, value, phone | `/manager/reports/voids (new)` | U9, needs E1 | drawn, awaiting the owner |
| `Report-Sales-By-Item` | 1440 × 900 | Manager | Sales by item and group: what sells, what does not | `/manager/reports/sales-by-item (new)` | U9 | drawn, awaiting the owner |
| `Report-Sales-By-Item-Phone` | 390 × 844 | Manager | Sales by item and group: what sells, what does not, phone | `/manager/reports/sales-by-item (new)` | U9 | drawn, awaiting the owner |
| `Report-Ticket-Times` | 1440 × 900 | Manager, chef | Ticket times: how long by station and hour, how many late | `/manager/reports/ticket-times (new)` | U9, needs E5 | drawn, awaiting the owner |
| `Report-Ticket-Times-Phone` | 390 × 844 | Manager, chef | Ticket times: how long by station and hour, how many late, phone | `/manager/reports/ticket-times (new)` | U9, needs E5 | drawn, awaiting the owner |
| `Report-Stock-On-Hand` | 1440 × 900 | Store keeper, manager, accountant | Stock on hand: what is in each store and what it is worth | `/manager/reports/stock-on-hand (new)` | U9, needs E7 and E8 | drawn, awaiting the owner |
| `Report-Stock-On-Hand-Phone` | 390 × 844 | Store keeper, manager, accountant | Stock on hand: what is in each store and what it is worth, phone | `/manager/reports/stock-on-hand (new)` | U9, needs E7 and E8 | drawn, awaiting the owner |
| `Report-Count-Differences` | 1440 × 900 | Manager, accountant, owner | Count differences: what the count found against the books, with the manager’s note | `/manager/reports/count-differences (new)` | U9, needs E7 | drawn, awaiting the owner |
| `Report-Count-Differences-Phone` | 390 × 844 | Manager, accountant, owner | Count differences: what the count found against the books, with the manager’s note, phone | `/manager/reports/count-differences (new)` | U9, needs E7 | drawn, awaiting the owner |
| `Report-Cost-Margin` | 1440 × 900 | Accountant, manager | Cost and margin per item; items with no cost | `/manager/reports/cost-margin (new)` | U9, needs E8 | drawn, awaiting the owner |
| `Report-Cost-Margin-Phone` | 390 × 844 | Accountant, manager | Cost and margin per item; items with no cost, phone | `/manager/reports/cost-margin (new)` | U9, needs E8 | drawn, awaiting the owner |

The other 16 reports of `docs/direction/05-reports.md` (sales by hour, sales by waiter, payments by method, discounts and on the house, refunds and reopened bills, exceptions, approvals log, sold-out log, low stock and To buy, stock movements, requests, waste by reason, staff meals, used against sold, purchases, bookings) follow this layout: the control panel with period chips and Download; four tiles; the rows in one table; a 420 px side panel; on a phone two tiles and the rows. The waste report is the approved `Manager-Waste-Report`.

## 10. Owner and accountant on a laptop

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Owner-Branches` | 1440 × 900 | Owner | All branches today: sales, open tables, voids, what needs the owner | `/owner/branches (new)` | U7 | drawn, awaiting the owner |
| `Owner-Branches-Phone` | 390 × 844 | Owner | All branches on a phone (Today on a phone is the approved Owner-Phone-Today) | `/owner/branches (new)` | U7 | drawn, awaiting the owner |
| `Owner-Branch` | 1440 × 900 | Owner | One branch: today, this week, who is on, what needs the owner | `/owner/branches/[id] (new)` | U7 | drawn, awaiting the owner |
| `Owner-Branch-Phone` | 390 × 844 | Owner | One branch on a phone | `/owner/branches/[id] (new)` | U7 | drawn, awaiting the owner |
| `Accountant-Purchases` | 1440 × 900 | Accountant | Purchases: what was bought, from whom, price changes, shorts | `/accounting/purchases (new)` | U7, needs E7 and E8 | drawn, awaiting the owner |
| `Accountant-Purchases-Phone` | 390 × 844 | Accountant | Purchases on a phone | `/accounting/purchases (new)` | U7, needs E7 and E8 | drawn, awaiting the owner |
| `Accountant-Stock-Value` | 1440 × 900 | Accountant | Stock value: by store and group, and how it moved this month | `/accounting/stock-value (new)` | U7, needs E7 and E8 | drawn, awaiting the owner |
| `Accountant-Stock-Value-Phone` | 390 × 844 | Accountant | Stock value on a phone | `/accounting/stock-value (new)` | U7, needs E7 and E8 | drawn, awaiting the owner |

## 11. Empty, loading and error

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `State-List-Empty` | 1280 × 800 | Cashier | Empty list: why it is empty, and the way forward | `/cashier/receipts` | U3 | drawn, awaiting the owner |
| `State-List-Empty-Phone` | 390 × 844 | Cashier | Empty list on a phone | `/cashier/receipts` | U3 | drawn, awaiting the owner |
| `State-List-Loading` | 1280 × 800 | Cashier | Loading list: header and bar at once, grey shapes in the final places, no spinner | `/cashier/receipts` | U3 | drawn, awaiting the owner |
| `State-List-Loading-Phone` | 390 × 844 | Cashier | Loading list on a phone | `/cashier/receipts` | U3 | drawn, awaiting the owner |
| `State-List-Error` | 1280 × 800 | Cashier | Error on a list: what happened, what is safe, Try again | `/cashier/receipts` | U3 | drawn, awaiting the owner |
| `State-List-Error-Phone` | 390 × 844 | Cashier | Error on a list, phone | `/cashier/receipts` | U3 | drawn, awaiting the owner |
| `State-Detail-Empty` | 1280 × 800 | Waiter | Empty detail: a free table’s order, nothing yet, Send waits | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `State-Detail-Empty-Phone` | 390 × 844 | Waiter | Empty detail on a phone | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `State-Detail-Loading` | 1280 × 800 | Waiter | Loading detail: the table and its frame at once, grey shapes for lines and menu | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `State-Detail-Loading-Phone` | 390 × 844 | Waiter | Loading detail on a phone | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `State-Detail-Error` | 1280 × 800 | Waiter | Error on a detail: what is safe, what not to do, Try again | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `State-Detail-Error-Phone` | 390 × 844 | Waiter | Error on a detail, phone | `/waiter/floor?tableId=` | U2 | drawn, awaiting the owner |
| `State-Sheet-Empty` | 1280 × 800 | Waiter | Empty sheet: no named discounts set up, and the way forward | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `State-Sheet-Empty-Phone` | 390 × 844 | Waiter | Empty sheet on a phone | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `State-Sheet-Loading` | 1280 × 800 | Waiter | Loading sheet: the sheet and its title at once, grey choices | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `State-Sheet-Loading-Phone` | 390 × 844 | Waiter | Loading sheet on a phone | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `State-Sheet-Error` | 1280 × 800 | Waiter | Error in a sheet: nothing was given, Try again | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `State-Sheet-Error-Phone` | 390 × 844 | Waiter | Error in a sheet, phone | `/waiter/floor?tableId=#discount` | U3, needs E9 | drawn, awaiting the owner |
| `Offline-Held` | 1280 × 800 | Waiter | “Not connected”: orders held on the terminal, tiles marked Held | `/waiter/floor` | U1, needs E12 | drawn, awaiting the owner |
| `Offline-Held-Phone` | 390 × 844 | Waiter | “Not connected” on a phone | `/waiter/floor` | U1, needs E12 | drawn, awaiting the owner |

Every other list, detail and sheet follows these three patterns: grey shapes in the final places while loading, a 72 px tinted circle with one line and one way forward when empty, what happened, what is safe and Try again on an error.
