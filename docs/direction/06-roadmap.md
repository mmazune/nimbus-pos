# Roadmap to deployment (version 2, 26 Nov 2026)

Version 2 adds what the owner asked for after the first push: stores as a chain, running low and sold out, waste, counts, alerts, reports, the day close, and working through a dropped connection. Read `02-life-cycles.md` before any milestone.

Base: branch `rebuild/main`. Two tracks that never touch the same folders: **U** is screens (`apps/web`, Opus), **E** is engines (`apps/api`, `packages/db`, Sonnet). **R** is a review by a fresh Opus session that built nothing; every engine that touches money, rights or stock gets one. One prompt is one milestone is one session. Only one E session runs at a time (they share the schema); only one U session runs at a time (they share the shell). A session's branch is merged into `rebuild/main` by the owner after its report (and its review, where one is listed) passes. No screen is built before its drawing is in `design/screens/`.

## The milestones

| ID | Milestone | Model | Needs | Done when, in one line |
|---|---|---|---|---|
| U0 | Tokens, the kit, the gallery, the checks | Opus | — | Kit pieces measure as drawn on `/kit` |
| E1 | Order truth | Sonnet | — | "Table 12's evening" passes |
| R-E1 | Review of E1 | Opus | E1 | Pass, or an F prompt |
| U1 | Shell, lock screen and Floor for every role | Opus | U0 | The four floor drawings match on four screen sizes |
| E2 | Menu in one call, search, Popular, Offers, sold out and counts | Sonnet | E1 | "Lamb chops, 2 left, then gone" passes |
| U2 | The one order screen, terminal, laptop, phone | Opus | U1, E1, E2 | Free table, table with an order, another waiter's table match |
| E3 | Areas, tabs, bulk tables, move, join, split, hand over | Sonnet | E2 | 60 tables and 30 tabs made through the API; a hand-over is accepted |
| E4 | Printing: bill with a number, receipt, printer per station, queue | Sonnet | E3 | A bill prints on an 80 mm printer and again from the queue |
| U3 | Table actions, payment, receipts, till | Opus | U2, E3, E4 | Cash, mobile money, card and split each close a table |
| E5 | Tickets: stations, hold and fire, allergy, Ready, Collected, bring back | Sonnet | E4 | Second round reaches the bar; Ready reaches the waiter |
| U5 | Kitchen and bar screens | Opus | U3, E5 | Eight tickets on a 1920 screen, no scrolling |
| E9 | Rights: the matrix, the 35 unseeded keys, PIN on the spot, climb to the manager | Sonnet | E5 | Every endpoint a screen calls answers for the right roles and no others |
| R-E9 | Review of E9 | Opus | E9 | Pass |
| U4 | Reservations, Ready, Approvals, Team, Me | Opus | U5, E9 | The drawings match; approval works from the manager's phone |
| E6 | Stock ledger, units, recipes, stock out on send, void puts back, take out of stock, remake | Sonnet | E9 | A burger sent takes 150 g of mince; a spoiled kilo is on the ledger with a reason |
| R-E6 | Review of E6 | Opus | E6 | Pass |
| E7 | Stores chain, minimum and fill-to, suggested request, issue, receive, deliveries, To buy, counts | Sonnet | E6 | The bun request runs asked, issued, received 12 short; a blind count posts its difference |
| R-E7 | Review of E7 | Opus | E7 | Pass |
| E10 | Availability from stock and the alert engine | Sonnet | E7 | Mince runs out, burgers go grey, the chef is told, stock arrives, they come back: one test |
| U6 | Store keeper, chef and bartender stock screens: requests, stock, receive, count, take out of stock | Opus | U4, E7, E10 | The drawings match |
| E8 | Cost: average cost, accountant rights, margin | Sonnet | E7 | Beef burger shows UGX 5,700 from its recipe |
| E11 | Reports, the day close, the business day | Sonnet | E8, E10 | All 24 reports answer from events; a day with loose ends will not close |
| E13 | Money exceptions: open item, price change, on the house, staff meal, service charge, pending mobile money, walk-out, drawer reason, happy hour, seats | Sonnet | E11 | Each lands on the Exceptions report |
| R-E13 | Review of E11 and E13 | Opus | E13 | Pass |
| U7 | Back office: menu and recipes, floor set-up, stores set-up, costs; Today; phone screens | Opus | U6, E8 | The drawings match |
| U9 | Reports and day close screens, laptop and phone | Opus | U7, E11 | The owner reads the day report on a phone |
| E12 | Working through a drop: held orders, send once, printer queue, fall back from screen to printer | Sonnet | E13 | Pull the cable mid-order; nothing is lost and nothing is doubled |
| R-E12 | Review of E12 | Opus | E12 | Pass |
| C1 | Clean-up: delete what nothing reaches, remove developer wording | Sonnet | U9 | Build and tests green with the code gone |
| D1 | Staging: API and database on their own host, web preview, health page, backups | Sonnet | U3 | A logged-out phone opens the preview and signs in with a PIN |
| D2 | Pilot venue data: menu, recipes, stores, tables, staff, printers | Sonnet | D1, U7 | The venue's manager confirms menu and floor on screen |
| D3 | Dress rehearsal: one full evening on staging with the venue's staff | Opus review | D2, all R | Zero blockers left |
| D4 | Go live, with a named way back | owner's word | D3 | First night closed, tills counted, stock matches |

## Order of work

| Week | Screens (one at a time) | Engines (one at a time) | Reviews |
|---|---|---|---|
| 1 | U0 | E1 | R-E1 |
| 2 | U1 | E2, E3 | |
| 3 | U2 | E4, E5 | |
| 4 | U3, U5 | E9 | R-E9 |
| 5 | U4 | E6 | R-E6 |
| 6 | U6 | E7, E10 | R-E7 |
| 7 | U7 | E8, E11 | |
| 8 | U9 | E13, E12 | R-E13, R-E12 |
| 9 | — | C1, D1, D2 | D3 |

A plan, not a promise: a missed target gets an F prompt, never a silent pass. A venue can go live after week 5 without stock (everything "as bought", sold-out by hand) if the owner chooses; stock then arrives as an update.

## Briefs: what each unwritten prompt must contain

The architect turns a brief into a prompt in the standard frame (`09-architect-handover.md`). Each brief names its rules; the prompt quotes the owner from `01-decisions.md` and `02-life-cycles.md`.

- **U1** written: `docs/prompts/U1-shell-and-floor.md`.
- **E2** written: `docs/prompts/E2-menu-and-availability.md`.
- **R-E1** written: `docs/prompts/RE1-review-order-truth.md`.
- **U2**: one order screen mounted for every role from the floor (R1, R2, R3, R5). Free table saves nothing. Sent and unsent lines. Item with choices as a sheet. Measures as buttons. Search. "3 left" and grey buttons from E2. Repeat round, quantity first. The unsendable-line state. Phone layout. Remove `WaiterOrderBuilderScreen` and the docked sheet. Drawings: Order-Empty, Order-Terminal, Order-Other, Order-Laptop, Order-Phone, Order-Phone-Check, Order-Phone-Item.
- **E3**: `Area` model and tabs area; bulk create; put away, never delete; move, join, split by guest, item, amount and evenly; change waiter; hand over with acceptance; move a line between tables. Real case: 60 tables, 30 tabs, two parties joined then split.
- **E4**: bill number and version ("Bill changed"); receipt; HTML to 80 mm and PDF fallback; printer per station; print queue with retry; print again. No device driver work beyond network printers.
- **U3**: table actions sheet, void, discount, split, move, join; payment with cash, mobile money by reference (pending state), card by reference, split; Receipts; Till with pay out, drop, count. Drawings: Supervisor-Table, Supervisor-Void, Cashier-Pay, Cashier-Receipts, Cashier-Till, Bill-Phone, plus the owed ones.
- **E5**: a ticket per send per station (from E1), station list as settings, hold and fire with a 3 second undo, allergy flag, takeaway flag, Ready, Collected, bring back, late times, `TICKET_LATE` and `READY_WAITING`.
- **U5**: kitchen and bar screens. Drawing: Kitchen, plus bar, Done and Sold out.
- **E9**: the rights matrix from `07-scenarios-and-rules.md` and `03` section 11 as seed; resolve the 35 unseeded keys (seed or remove the endpoint); approval requests with PIN on the same device and the climb to the manager; a server answer of "what may this person do to this order". R14 holds.
- **U4**: Reservations for waiter and supervisor, Ready, Approvals, Team, Me. Drawings exist for five; Team and the booking forms are owed.
- **E6**: `03` sections 3, 4, 5 and 7 (ledger, units, sold-as, stock out on send through the E1 line events, reversal on a "not made" void, take out of stock, remake). One store per branch for now. Negative allowed (R18).
- **E7**: `03` sections 2, 7, 8, 9, 10 (store chain, levels, suggested request, issue and receive with PIN, transit loss, deliveries, To buy, counts and the limit).
- **E10**: `03` section 6 item 3 and `04-alerts.md` in full: the alert table, once per crossing, self-clearing, the climb, the "Needs you" feed.
- **U6**: store keeper Requests, Stock, Receive, Count; chef and bartender Store and Take out of stock. Drawings: Store-Requests, Chef-Request-Phone, plus the owed ones.
- **E8**: moving average cost, accountant rights (see, not sell), margin, "No cost" and "Cost changed" lists.
- **E11**: the 24 reports as endpoints with CSV; day close with its loose-end list (R24); business day hour; reset of sold-out marks (R20).
- **E13**: `07-scenarios-and-rules.md`, Money and Sensitive actions tables.
- **U7**, **U9**: back office, Today and report screens, laptop and phone.
- **E12**: R28. Idempotency key per send and per payment (the pattern exists in the quick-sale engine), orders held on the device, sign-in for staff who signed in today, printer queue, screen-to-printer fallback.

## Drawings owed before their milestone starts

U1: lock and PIN, cashier floor, start of shift. U2: search results, unsendable line, repeat round. U3: move, join, split, discount, mobile money pending, card, paid. U4: Team, supervisor Me, new and edit booking, cancel, no-show, history. U5: bar screen, Done, Sold out with "set a number". U6: Stock with minimum and fill-to, Receive a delivery, Count, Take out of stock, the low-stock banner. U7: manager Today on a laptop, menu list, stores set-up, To buy, staff, settings. U9: day close, each report's first screen, the day report on a phone. Every one also at 390 px with its empty, loading and error states.

## Not on this roadmap

Card machines and mobile money talking to the till directly, URA e-receipts and tax, payroll, franchise, messages to phones by SMS or WhatsApp, batch and expiry dates, the Event Till screens, smart pour spouts. Each comes back after D4.
