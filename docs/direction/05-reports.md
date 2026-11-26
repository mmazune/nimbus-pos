# Reports: every action lands somewhere

Rule: a report shows only what the events hold. A number with no events behind it is left out, never estimated. Each report has a date range, a branch, a download (CSV first; a true PDF later), and opens on the answer, not on filters. "Reads it" is who sees it by default; rights follow R14.

| # | Report | The question it answers | Built from | Reads it |
|---|---|---|---|---|
| 1 | Day report | What did we sell, how was it paid, what went wrong today? | Payments, orders, voids, discounts, tills, alerts left open | Owner, manager |
| 2 | Till report | Does the drawer match? Float, cash in, paid out, dropped, counted, difference | Till movements | Cashier (own), supervisor, manager |
| 3 | Sales by item and group | What sells, what does not | Sent lines, paid | Manager, owner |
| 4 | Sales by hour | When are we busy | Sent lines | Manager |
| 5 | Sales by waiter | Who sold what; tables, average bill | Orders | Manager; a waiter sees their own on Me |
| 6 | Payments by method | Cash, mobile money, card; pending and failed | Payments | Manager, accountant |
| 7 | Voids | What was voided, by whom, why, made or not, value | Line voids | Manager, owner |
| 8 | Discounts and on the house | Who gave what away, with which reason | Discounts, comps | Manager, owner |
| 9 | Refunds and reopened bills | Money that went back | Refunds | Manager, accountant |
| 10 | Exceptions | Price changes, open items, drawer opened with no sale, bills changed after printing, reprints, walk-outs | Audit events | Manager, owner |
| 11 | Approvals log | Who asked, who answered, how long it took | Approvals | Manager |
| 12 | Ticket times | How long food and drinks take, by station and hour; how many late | Ticket events | Manager, chef |
| 13 | Sold-out log | What ran out, from when to when, and the sales it probably cost | Availability log, usual sales of that item at that hour | Manager, chef, owner |
| 14 | Stock on hand | What is in each store and what it is worth | Ledger, cost | Store keeper, manager, accountant |
| 15 | Low stock and To buy | What to order now | Levels, minimums | Store keeper, manager |
| 16 | Stock movements | Everything in and out for one item | Ledger | Store keeper, accountant |
| 17 | Requests | Asked, issued, received, short, how long each took | Requests | Store keeper, manager |
| 18 | Waste by reason | What we threw away, why, what it cost, the sales it would have made; most wasted first | Waste, remake, voids marked made | Manager, chef, owner |
| 19 | Staff meals | What staff ate and its cost | Ledger | Manager |
| 20 | Count differences | What the count found against the books, with the manager's note | Counts | Manager, accountant, owner |
| 21 | Used against sold | What the recipes say we should have used, against what left the store | Ledger, sales, counts | Manager, accountant |
| 22 | Cost and margin | Cost, price and margin per item; items with no cost | Cost, recipes | Accountant, manager |
| 23 | Purchases | What was bought, from whom, price changes | Deliveries | Accountant |
| 24 | Bookings | Seated, no-shows, cancelled, deposits | Reservations | Supervisor, manager |

Report 13 ("the sales it probably cost") is an estimate and is labelled as one on the screen: the item's average sales for that hour and weekday over the last four weeks, times the hours it was out. Until four weeks of data exist the column is empty.

Today (manager, owner, laptop and phone) is not a report: it is report 1 so far today, plus the open alerts.
