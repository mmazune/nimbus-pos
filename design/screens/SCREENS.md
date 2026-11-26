# Screens: the wiring table

One row per drawing in `html/` and `png/`. "Built in" is the milestone from `docs/direction/06-roadmap.md`. A builder changes the last column of its own rows, and nothing else, when a screen is built and scored: `drawn` → `built` → `scored NN/24`.

| Drawing | Size | Role | What it shows | Route | Built in | Status |
|---|---|---|---|---|---|---|
| `Main` | 1280 × 800 | Waiter | Floor · terminal 1280 × 800 · waiter | `/waiter/floor` | U1 | drawn |
| `Floor-1024` | 1024 × 768 | Waiter | Floor · small monitor 1024 × 768 · compact tiles | `/waiter/floor` | U1 | drawn |
| `Floor-1920` | 1920 × 1080 | Supervisor | Floor · large monitor 1920 × 1080 · supervisor · 70 tables | `/supervisor/floor` | U1 | drawn |
| `Floor-Phone` | 390 × 844 | Waiter | Floor · phone | `/waiter/floor` | U1 | drawn |
| `Table-Tile` | 1280 × 944 | All | The table tile · every state | `spec, no route` | U0 | built (kit) |
| `Nav-Roles` | 1440 × 1010 | All | The bottom bar · role by role | `spec, no route` | U0 and U1 | built (kit) |
| `Table-Life` | 1440 × 760 | All | The life of a table | `spec, no route` | U2 | built (T3; a spec, its states are scored on the screens above) |
| `Order-Empty` | 1280 × 800 | Waiter | Free table · the menu opens at once | `/waiter/floor?tableId=` | U2 | built · scored 22/24 (T3, independent review) |
| `Order-Terminal` | 1280 × 800 | Waiter | Table with an order · add more, send | `/waiter/floor?tableId=` | U2 | built · scored 22/24 (T3, independent review) |
| `Order-Other` | 1280 × 800 | Waiter | Another waiter’s table | `/waiter/floor?tableId=` | U2 | built · scored 23/24 (T3, independent review) |
| `Reservations-Waiter` | 1280 × 800 | Waiter | Reservations · waiter · seat somewhere else | `/waiter/reservations` | U4 | drawn |
| `Waiter-Ready` | 1280 × 800 | Waiter | Ready · waiter | `/waiter/ready (new)` | U4, needs E5 | drawn |
| `Waiter-Me` | 1280 × 800 | Waiter | Me · waiter | `/waiter/me` | U4 | drawn |
| `Order-Phone` | 390 × 844 | Waiter | Order · phone | `/waiter/floor?tableId=` | U2 | built · scored 21/24 (T3, independent review) |
| `Order-Phone-Check` | 390 × 844 | Waiter | Order · phone · the order | `/waiter/floor?tableId=` | U2 | built · scored 22/24 (T3, independent review) |
| `Order-Phone-Item` | 390 × 844 | Waiter | Order · phone · an item with choices | `/waiter/floor?tableId=` | U2, needs E2 | built · scored 22/24 (T3, independent review) |
| `Bill-Phone` | 390 × 844 | Waiter | Bill · phone | `/waiter/floor?tableId=` | U3, needs E4 | drawn |
| `Supervisor-Table` | 1280 × 800 | Supervisor | Supervisor · table actions | `/supervisor/floor?tableId=` | U3 | built · scored 21/24 (T3, independent review) |
| `Supervisor-Void` | 1280 × 800 | Supervisor | Supervisor · void one item | `/supervisor/floor?tableId=` | U3, needs E1 | built · scored 24/24 (T3, independent review) |
| `Reservations-Supervisor` | 1280 × 800 | Supervisor | Reservations · supervisor | `/supervisor/reservations` | U4 | drawn |
| `Supervisor-Approvals` | 1280 × 800 | Supervisor | Approvals · supervisor | `/supervisor/approvals` | U4 | drawn |
| `Cashier-Pay` | 1280 × 800 | Cashier | Cashier · take payment | `/cashier/floor?tableId=` | U3, needs E1 | built · scored 22/24 (T3, independent review) |
| `Cashier-Receipts` | 1280 × 800 | Cashier | Cashier · receipts | `/cashier/receipts` | U3 | drawn |
| `Cashier-Till` | 1280 × 800 | Cashier | Cashier · till | `/cashier/till` | U3 | drawn |
| `Kitchen` | 1920 × 1080 | Chef | Kitchen screen · 1920 × 1080 | `/kitchen (new)` | U5, needs E5 | drawn |
| `Store-Requests` | 1280 × 800 | Store keeper | Store keeper · requests | `/store/requests (new)` | U6, needs E7 | drawn |
| `Chef-Request-Phone` | 390 × 844 | Chef | Chef · phone · ask the store | `/kitchen/store (new)` | U6, needs E7 | drawn |
| `Order-Laptop` | 1440 × 900 | Manager | Manager · laptop · the same table | `/manager/operations/floor?tableId=` | U2 | built · scored 21/24 (T3, independent review) |
| `Manager-Item` | 1440 × 900 | Manager | Manager · menu item and recipe | `/manager/menu/items/[id] (new)` | U7, needs E2 and E6 | drawn |
| `Manager-Floor` | 1440 × 900 | Manager | Manager · floor setup · add tables | `/manager/settings/floor (new)` | U7, needs E3 | drawn |
| `Accountant-Costs` | 1440 × 900 | Accountant | Accountant · item costs | `/accounting/costs (new)` | U7, needs E8 | drawn |
| `Manager-Phone-Today` | 390 × 844 | Manager | Manager · phone · today | `/manager/overview` | U7 | drawn |
| `Manager-Phone-Approve` | 390 × 844 | Manager | Manager · phone · approve a void | `/manager/approvals/[id] (new)` | U7 | drawn |
| `Owner-Phone-Today` | 390 × 844 | Owner | Owner · phone · all branches | `/owner/today (new)` | U7 | drawn |
| `Accountant-Phone-Costs` | 390 × 844 | Accountant | Accountant · phone · no cost yet | `/accounting/costs` | U7, needs E8 | drawn |
| `Kitchen-Store` | 1280 × 800 | Chef | Kitchen · store running low, request written | `/kitchen/store` (new) | U6, needs E7 and E10 | drawn |
| `Chef-Waste-Phone` | 390 × 844 | Chef | Chef · phone · take out of stock | `/kitchen/store/take-out` (new) | U6, needs E6 | drawn |
| `Manager-Waste-Report` | 1440 × 900 | Manager | Manager · waste and sold out report | `/manager/reports/waste` (new) | U9, needs E11 | drawn |

Not drawn yet (about 120 to 150 boards): PIN login and lock; start and end of shift; new tab; move, join, split and discount sheets; mobile money, card and split payment; paid and receipt states; supervisor Team and Me; cashier floor and Me; bar screen; kitchen Done and Sold out; store Stock, Receive and Count; new, edit, cancel and no-show reservation; history; manager laptop Today, menu list, stock, staff, reports, settings; owner and accountant laptop screens; phone versions of the rest; empty, loading, error and offline states. No screen is built before its drawing is in this folder.
