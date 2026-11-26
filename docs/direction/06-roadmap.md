# Roadmap to deployment (written 26 Nov 2026)

Base: branch `rebuild/main`, cut from `concert/event-till--moses` at `938c013` (the newest code; the Event Till engine stays in it, unused). Two tracks run side by side and never touch the same folders: **U** is screens (`apps/web`, Opus), **E** is engines (`apps/api`, `packages/db`, Sonnet). A risky engine is closed by a separate review (**R**, Opus, a session that built nothing). One prompt is one milestone is one session. No screen is built before its drawing is in `design/screens/`.

| ID | Milestone | Model | Needs | Done when, in one line |
|---|---|---|---|---|
| U0 | Foundations: tokens, the kit, the gallery, the checks | Opus | — | Every kit piece renders at the drawn size on `/kit`; `check:ui` goes red on a planted fault |
| E1 | Order truth: one close door, send by line, pay with change, void one line | Sonnet | — | Table 12's evening passes as a test from first send to a freed table |
| R-E1 | Review of E1 | Opus | E1 | Verdict pass, or an F prompt |
| U1 | New shell and Floor for every role, four screen sizes | Opus | U0 | Floor matches the four floor drawings; old sheet and card are gone |
| U2 | The order screen, one for all roles, terminal, laptop, phone | Opus | U1, E1 | Free table, table with an order, another waiter's table match the drawings |
| E2 | Menu shape: Food and Drinks, groups, Popular, Offers, search, sold out, measures, choices | Sonnet | E1 | A 200-item menu loads in one call and search finds an item in under 100 ms |
| E3 | Areas, tabs, bulk add tables, put away, move, join, change waiter | Sonnet | E1 | 60 tables and 30 tabs created from the set-up screen's API |
| E4 | Printing: bill and receipt, printer per station, print again | Sonnet | E1 | A bill prints on a real 80 mm printer and as a PDF fallback |
| U3 | Table actions, payment, receipts, till | Opus | U2, E3, E4 | Cash, mobile money by reference, card by reference and split all close a table |
| E5 | Kitchen and bar tickets: stations, Ready, Collected, bring back, sold out | Sonnet | E1, E2 | A second round reaches the bar; Ready reaches the waiter |
| U4 | Reservations, Ready, Approvals, Team, Me | Opus | U3, E5 | The five drawings match; a waiter seats a booking at another table |
| U5 | Kitchen and bar screens | Opus | E5 | Eight tickets, oldest first, on a 1920 screen with no scrolling |
| E9 | Rights: the matrix, the 35 unseeded keys, approval by PIN on the same device | Sonnet | E1 | Every endpoint a screen calls answers for the roles that should have it |
| R-E9 | Review of E9 | Opus | E9 | Verdict pass |
| E6 | Units, recipes, "how is it sold", stock leaves on send, void puts back | Sonnet | E2 | A burger sent takes 150 g of mince from Kitchen store |
| R-E6 | Review of E6 | Opus | E6 | Verdict pass |
| E7 | Stores: main and others, ask, issue, receive by PIN, deliveries, counts | Sonnet | E6 | The burger-bun request runs Requested, Issued, Received short |
| R-E7 | Review of E7 | Opus | E7 | Verdict pass |
| U6 | Store keeper and chef store screens | Opus | E7 | The two drawings match |
| E8 | Cost: average cost, accountant rights, margin per item | Sonnet | E6 | Beef burger shows UGX 5,700 cost from its recipe |
| U7 | Back office: menu items and recipes, floor set-up, costs, Today; phone screens for manager, owner, accountant | Opus | E2, E3, E8 | The eight drawings match |
| C1 | Clean-up: delete what nothing reaches (about 15,600 lines in web, 10 modules in API), remove developer wording | Sonnet | U4 | Build and tests green with the code gone; no screen shows a permission key or a route |
| D1 | Staging: API and database on their own host, web on Vercel preview, health page, backups | Sonnet | U3 | A logged-out phone opens the preview and logs in with a PIN |
| D2 | Pilot venue data: real menu, tables, staff, prices, printers | Sonnet | D1, U7 | The venue's manager confirms the menu and the floor on screen |
| D3 | Dress rehearsal: one full evening on staging with the venue's staff, then fixes | Opus review | D2, all R | Zero blockers after the rehearsal list is closed |
| D4 | Go live at the pilot venue, with a named way back | owner's word | D3 | First night closed, tills counted, stock matches |

## Order of work

Week 1: U0 and E1 together, then R-E1. Week 2: U1, E2, E3. Week 3: U2, E4, E5. Week 4: U3, E9, U5. Week 5: U4, E6, R-E9. Week 6: E7, E8, R-E6, U6. Week 7: U7, R-E7, C1, D1. Week 8: D2, D3. Go live when D3 has zero blockers. The weeks are a plan, not a promise: a missed target gets an F prompt, never a silent pass.

## Drawings still owed before their milestone starts

U1: PIN login and lock, cashier floor. U3: move, join, split, discount, mobile money, card, split payment, paid state. U4: supervisor Team and Me, new and edit reservation, cancel, no-show, history. U5: bar screen, Done, Sold out. U6: Stock, Receive, Count. U7: manager Today on a laptop, menu list, stock, staff, reports, settings, owner and accountant laptop screens. Every one also at 390 px, with its empty, loading and error states.

## Not on this roadmap

Mobile-money and card machines talking to the till directly (payment is recorded by reference until then), tax and e-receipts for URA, payroll, franchise, the Event Till screens, smart pour spouts. Each comes back after D4.
