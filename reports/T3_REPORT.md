# T3 report: the one order screen, for every role, on every device

Branch `t3/order-screen`, cut from `rebuild/main` `0af95f8`, with `origin/e1/order-truth` merged (`6d433e8`). Session on Opus, 26 Nov 2026. `moses-build-standards` v5 loaded. Advisor consulted at the phase-1 boundary, before the money-and-rights work in phase 4, and before closing (its closing list was worked through; see "After the closing review").

Grades:
- **[live]** a command or browser run in this container.
- **[emulation]** headless Chromium at a set viewport.
- **[code]** read from source.
- **[asserted]** stated, not checked.

**The stack for every run:**
- A throwaway Postgres 16 database, `t3_order`, on localhost (seed and demo import).
- The E1 API, built and run on :4111.
- The web app as a **production build** (`next build` then `next start`) on :3111.
- Neon was never touched, and no `.env*` file was read or written.
- Secrets are minted in the shell per boot. Quick PINs are reissued in memory by the test setup and never written anywhere.

## Phases
| Phase | What | Commits |
|---|---|---|
| 1 | Read-back (`T3_READ_BACK.md`). `screens/order/data/`: the menu in the shape of `/api/menu/workspace` (filled from navigation and catalog, so the switch is one file), exact money, the order with sent, unsent and voided lines, every call, rights and R5 | `ded65e1`, `214c096` |
| 2–3 | The screen on a terminal for the waiter: item sheet, search, quantity first, mixer row, Same again, tap a line, leave guard | `25cddc1` |
| 4 | Mounted for cashier, supervisor and manager: table actions, voiding one line, taking payment, the laptop frame | `4c9ed92`, `a54628f` |
| 5 | Phone: menu first, the order as a sheet, the item as a sheet | `b54ac3e` |
| 6 | Old surfaces deleted; races; tap counts; three runs; compare images; look review; closing fixes; report | `de37868`, `6cbcecc`, and the close commit |

## Done when, with proof

### 1. One screen opens from a table tap for every role; the old three are gone [live]
- `OrderScreen` is mounted by `WaiterFloorScreen`, `CashierFloorScreen`, `SupervisorFloorScreen` and `ManagerTablesScreen` (as a laptop frame under the top bar).
- **Deleted:** `WaiterOrderBuilderScreen.tsx` (1,608 lines), `WaiterTableWorkspace.tsx`, `WaiterOwnershipBlockedPanel.tsx`, `OperationalTableWorkspaceFrame.tsx` (the docked sheet), `SupervisorTableControlWorkspace.tsx`, the manager's inline card, and the unused `WaiterNewOrderScreen` and `WaiterOrdersQueueScreen`.
- **Brought into the new screen** so nothing the old sheets did is lost:
  - a reservation card ("Seat them here", through the existing seat route);
  - the shift-not-started banner;
  - Table status (Free, In use, Reserved, Cleaning);
  - a chooser when a table holds two orders;
  - the cash-needs-an-open-till rule.
- Cashier Find bill opens a takeaway by id in the same screen (`actions.spec.ts`) [live]. Supervisor Find order opens an order in the same screen (`kept.spec.ts`) [live]. The reservation card seats the booking and the menu opens; the shift banner blocks adding (`kept.spec.ts`) [live].

### 2. A free table tapped and left creates nothing on the server [live]
`waiter.spec.ts` records each call as method, path and status only. In `reports/proof/T3/free-table-network.json`, `writes` is an empty list, and the table's order count is unchanged.

### 3. A waiter adds to a sent order, and the second Send sends only the new lines [live]
In `waiter.spec.ts` and `evening.spec.ts`, the second round makes:
- no second `POST /api/pos/orders`;
- three `POST …/items`;
- one `POST …/send`.

The order's lines carry two distinct `sentAt` values (`two-sends-network.json`). A double tap on Send makes one order (race test). Two waiters sending on the same free table at once make two orders, and the screen opens the signed-in waiter's own order and says there are two (race test).

### 4. Search finds an item from three letters and from its initials; quantity first and "Same again" work [live]
- "col" finds Cola 300 ml, and "bs" finds Blended Scotch (also covered by the unit tests in `data.spec.ts`).
- Quantity first: "How many 2", then the item, adds two.
- Same again re-adds the drinks of the last round as unsent lines (UGX 98,000 becomes 128,000).
- A keyboard digit arms the quantity too: "3", then Chips, adds three (`kept.spec.ts`) [live].

### 5. A supervisor voids one sent line with a reason and "was it made?"; a waiter cannot [live]
- In `evening.spec.ts`, the supervisor chooses "Made, it is waste" and "Guest complaint"; the bill goes from 98,000 to 74,000.
- The API row records `voidReason GUEST_COMPLAINT` and `wasMade true`. The line stays on the order, struck through.
- The line is picked from a list and is never preselected.
- At 390 × 844, "Not made" with "Wrong item entered" also passes.
- The waiter's tap on a sent line opens nothing, and her token gets **403** from the void route.
- Rights for all four roles: `reports/proof/T3/rights-matrix.txt`.

### 6. A cashier takes 100,000 on a bill and the screen shows the change before and after [live]
- **Before:** "Change to give UGX 26,000" (the bill is 74,000 after the void).
- **After:** "Give this change UGX 26,000 · Cash given UGX 100,000, as recorded on the payment". The payment row records `changeGiven 26000`.
- After a 10% discount, the change shown before equals the change recorded (`actions.spec.ts`).
- At 390 × 844: 20,000 on 16,000 gives change of 4,000, before and after.
- "To pay" is the total less posted payments. Discount and Cancel the order are hidden once a payment is posted.
- **Cash needs the taker's own open till** (restored from the old screen: a till counts cash by its open period, so cash taken with no till open falls outside every till). Card and mobile money work without one.

### 7. Each drawing sits beside a screenshot of the built screen [emulation]
- One image per drawing, `reports/proof/T3/compare-<Drawing>.png`, for Order-Empty, Order-Terminal, Order-Other, Order-Laptop, Order-Phone, Order-Phone-Check, Order-Phone-Item, Supervisor-Table, Supervisor-Void and Cashier-Pay.
- Table-Life is a spec, not a screen, so its image is a montage of the built states.
- Extra phone captures: `built-Supervisor-Table-390x844.png`, `built-Supervisor-Void-390x844.png`, `built-Cashier-Pay-390x844.png`.
- Differences and their reasons are listed below.

### 8. "Table 12's evening" passes three runs in a row; tap counts are in the report and none is above four [live]
- `reports/proof/T3/evening-3-runs.txt`: three of three green on the final production build, each run with the waiter's part at 390 × 844, the 390 checks for supervisor and cashier, and the tap-count test.
- The tap counts are from `taps.spec.ts` (`reports/proof/T3/tap-counts.json`): measured by a click counter, **from the waiter's Floor including the table tap** (as A2 §3.8 counts). Each task starts with nothing unsent. The test asserts none is above four.

| Task | Route | Taps |
|---|---|---|
| A beer from Popular | table, Drinks (opens on Popular), Lager | **3** |
| A double whisky with cola | table, Drinks (opens on Popular, where the house Scotch is), Double, Cola | **4** |
| … the same by search | table, Search, Double, Cola (typing "bs" not counted) | **4** |
| A burger with choices | table, Beef burger (in Food › Popular food), Medium, Add | **4** |

The counts rest on the venue's Popular groups (R3: Popular comes first). The fixture puts the house Scotch, the lager and the burger there, as a manager would. A drink that is not in Popular takes one more tap through its own group (a single malt via Whisky: table, Drinks, Whisky, Double, Cola = 5) or four by search.

### 9. Rule 10 holds at both sizes; check:ui, web lint, typecheck and build are green [emulation, live]
The measurer checks five things: no sideways scroll, nothing clipped, no target under 44 px, no text under 12 px, at most one filled button (a chosen tile counts as a selection, not a button). It is green on:
- **at 1280 × 800:** Order-Empty, Order-Terminal, Order-Other, the waiter with drinks, the supervisor's actions sheet and void sheet, and the cashier's payment;
- **at 1440 × 900:** the manager on a laptop;
- **at 390 × 844:** Order-Phone, Order-Phone-Check, Order-Phone-Item, the supervisor's actions sheet and void sheet, and the cashier's payment.

The gate outputs are below.

### 10. `git diff --stat origin/e1/order-truth...HEAD` shows only what T3 owns [live]
Output in `reports/proof/T3/diff-stat.txt`.
- The merge base is the E1 tip, so the literal diff also lists `rebuild/main`'s own commits since `27790c1` (the U0 kit, its gallery, check:ui, the prompts). This branch was cut from them; they are not T3's work.
- T3's own work is `6d433e8..HEAD`: `screens/order/**`, `e2e/order/**`, `reports/**`, my `SCREENS.md` rows, the four floor mount files, the deleted workspace files, `components/waiter/orders/**`, and the owned kit files `OptionTile`, `OrderHeader`, `OrderLine` and `Sheet`.
- **Disclosed, outside the letter of the list:**
  - `components/floor/index.ts` and `components/supervisor/floor/index.ts` each lose one export line, for the deleted frame and workspace.
  - `WaiterOwnershipBlockedPanel.tsx` was deleted with its only user.
- No change to `apps/api` or `packages/db`.

### 11. `SCREENS.md` rows for the order drawings say `built`, with their score [live]
The rows are updated with the scores below.

## Gate outputs [live]
Saved in `reports/proof/T3/gates.txt`, run on the final code after the last change:

| Gate | Result |
|---|---|
| Web typecheck | exit 0 |
| `next lint` (no `--fix`) | "✔ No ESLint warnings or errors" |
| `next build` | exit 0 (the build every final proof ran on) |
| `check:ui` | green |
| `check:event` | green |
| `e2e/order` on that build | **30 passed** |
| Evening, phone (390) and taps | three of three in a row |
| Fixture on a fresh database | two of two (`fixture-fresh-db.txt`) |

- The fresh-database check ran only migrations, seed and demo import, plus a second API on :4112. The fixture builds its menu, tables, people, shifts and tills through the API, and its second run is idempotent: one Grace, six tables, seven items.
- The web package has no unit runner (its `test` script is a stub). The data layer's 11 unit tests run in `e2e/order/data.spec.ts`, inside the 30.
- The API is untouched, so its gates are E1's (`reports/E1_REPORT.md`).

## Look review [emulation, reviewer]
**The scores in `SCREENS.md` come from an independent review** (`reports/T3_LOOK_REVIEW_INDEPENDENT.md`, round 3): a fresh subagent that built nothing, saw no earlier review, and was given no guidance on what to set aside. Each score is out of 24; a pass is 20 with no zero.

| Screen | Round 1 | Round 2 | Round 3 (recorded) |
|---|---|---|---|
| Order-Empty | 21 | 22 | **22** pass |
| Order-Terminal | 21 | 22 | **22** pass |
| Order-Other | 20 fail | 19 fail | **20 fail** (one zero: fidelity) |
| Order-Laptop | 19 fail | 22 | **22** pass |
| Order-Phone | 20 | 21 | **22** pass |
| Order-Phone-Check | 23 | 23 | **23** pass |
| Order-Phone-Item | 22 | 21 | **22** pass |
| Supervisor-Table | 22 | 21 | **22** pass |
| Supervisor-Void | 23 | 24 | **24** pass |
| Cashier-Pay | 23 | 22 | **21** pass |

Each round was scored by a different fresh reviewer, after each round's fixes.
- **Order-Laptop**, from round 1 to round 2: the breadcrumb and an Open pill, and five items across.
- **Order-Other**, between rounds 2 and 3:
  - "Take it over" works: a supervisor enters their own PIN on the waiter's device. That makes a one-off supervisor session for the existing transfer-server call, which is logged out at once; the PIN is never stored.
  - The other waiter's lines are read from the kitchen tickets, priced from the menu only when the prices add up to the order's own total.

**Order-Other still fails on one zero, and it cannot pass on this track.** The drawn filled Print bill and "Ask Brian O." have no API a waiter can use on another waiter's order:
- the bill request is refused (`assertWaiterOrderOwnership`);
- there is no "ask the waiter" endpoint.

Building either would mean a dead or faked control (rule 13), and `apps/api` is outside T3's folders (rule 20). The fix is an API change: a waiter-safe bill request and a request-to-waiter endpoint. It goes to T2 or the joining-up prompt, and the screen then needs two buttons.

The first review (`reports/T3_LOOK_REVIEW.md`), with a re-score I led, is kept for the record and not used.

## Differences from the drawings (and why)
- **Icons:** the drawings' stand-in icons are drawn with names from the Phosphor registry. I cannot add names, because `pos-shell` is not mine. Move table uses `table`, Join tables `serviceArea`, Change waiter `staff`, Split bill `count`, Discount `revenue`, Void an item `soldOut`, Cancel the order `close`, Same again `refresh`, Table status `table`.
- **A "How many 2–6" strip** sits in the menu's top row; quantity first has no drawing.
- **Long group names wrap** to two lines instead of being cut ("Small Plates", "Coffee & Tea", "Zero-Proof Bar").
- **The waiter's terminal bottom row has no ⋯** unless there is something to put behind it (Same again). The drawing always shows one.
- **The Food/Drinks control is narrower** than drawn: the kit's segmented control sizes to its words, and that control is not my file.
- **The order column is 372 px on a laptop as well.** The drawing's 400 px has no kit token, and the kit tokens are not mine.
- **The laptop search** is a labelled field in the menu, not a pill. The grid has four columns, not five.
- **No guest counts in the header.** They are not in the data. Time open and the waiter's short name show instead.
- **Order-Other:**
  - "Take it over" is built: a supervisor enters their PIN, and it calls the existing transfer-server route.
  - "Ask Brian O." has no endpoint.
  - There is no Print bill: the API refuses a waiter's bill request on another's order.
  - The lines come from the kitchen tickets, because the order read is refused. They are priced from the menu only when the prices add up to the order's own total; otherwise the price is blank and a line says so.
- **Supervisor-Table:** "Send to kitchen again" has no endpoint, so "Same again" stands in its place. Split bill says "Equal parts, recorded for the cashier", because the API only records the allocation. Table status is added.
- **Cashier-Pay:**
  - "Split" is left out.
  - Mobile money is a manual MOMO close.
  - Cash needs your till.
  - The receipt line points to Receipts.
- **Phone groups** go three across when a name has a word longer than eight letters, otherwise four as drawn. On a phone the void choices read "Made, waste" and "Not made".
- **Group names:** the API makes them unique per branch, so Food's popular group is named "Popular food", and any group whose name starts with "Popular" or "Offers" ranks first.

## Left out, and which milestone brings it
| What | Why | Brings it |
|---|---|---|
| Popular and Offers from sales data | no data source; a group named Popular… is honoured | T2 `/api/menu/workspace` |
| Sold out, "3 left", availability | not in the API; the tile already renders both states | T2 (E2) and the joining-up prompt |
| Printing the bill | no printer path; the button records the bill request and says nothing printed | E4 |
| A waiter asking for a void | no approval route for a line void | a later approvals milestone |
| Ask the waiter, Take it over | no endpoint | U4 or later |
| Split payment, partial cash | close needs the whole amount in one call; entering parts has no drawing | U3 follow-up |
| Split items, move items, mark served, complimentary, discount approve and reject | not drawn on the order screen; approve and reject live on Approvals | T1 Approvals, or a later drawing |
| Guest count in the header | not in the data | — |
| Kitchen states per line (Ready, Collected) | not built yet | T2 / E5 |

## Decisions taken
`reports/T3_PROGRESS.md` holds 16. The main ones:
- Lines not sent stay on the device until Send, and leaving asks first.
- The signed-in person's own order opens first when a table holds two.
- R5's filled button takes payment by role: cashier and manager, never the supervisor (owner default 2).
- Cash needs the taker's own open till.
- R1–R7 (26 Nov 2026) override the older `CLAUDE.md` bans this work would otherwise break: Manager operations read-only, no order actions for Manager on the floor, and Supervisor without a line void.

## Found, for other tracks
- **T2 (tables, E3)** [live]:
  - `transfer-table` and `merge` (pos-handoff) leave the source table `OCCUPIED` with no order; close and void free it.
  - A supervisor can now free such a table with Table status (`actions.spec.ts`), and the fixture puts its own empty tables back to `AVAILABLE`.
  - The product gap remains for T2.
- **T2** [live]:
  - The demo data leaves open orders on almost every demo table; the e2e uses its own tables, `12` and `14`–`18`.
  - Browse-group names are unique per branch across Food and Drinks, so "Popular" cannot exist in both sections.
- **T4 (tests)** [code]: older suites that drive the floor routes will go red by design. I did not edit them:
  - e2e: `cashier-floor` (18 specs), `supervisor-prompt3` (5), `supervisor-approvals` (2), `manager-operations` (1), `manager-shell` (1);
  - assertion scripts: `cashier-c1`, `cashier-c2`, `cashier-c3`, `floor`, `prompt3a`, `prompt3b1`, `prompt3b2`, `prompt3b3a` and `prompt3b3b`.
- **For the sweep** [code]: now unreferenced, but left in place because they are not T3's: `CashierSelectedTablePanel` and ten `Supervisor*Dialog` files in `components/supervisor/floor/`. `CashierBillResolutionPanel` and `CashierSettlementWorkspace` are still imported by the hidden cashier queue route.
- **T1 (floor):** the order screen is one component, `screens/order/OrderScreen.tsx`. It takes `{ role, tableId | null, tableLabel, orderId?, onClose, onChanged, reservation?, orderingBlocked?, frame }`; mount it from the new floor the same way.

## Process slip, disclosed
In phase 6 the first production build ran while my own dev server was still alive in the same folder, against rule 19: killing the recorded `npx` PID did not stop its `next-server` child. I stopped both PIDs and rebuilt. Every final proof in this report comes from the **last** build, made after the last code change, with no dev server running.

## After the closing review
The advisor's closing list was worked through:
- the till rule restored;
- counts taken from the Floor; the house Scotch placed in Drinks › Popular so the whisky task is four (a non-popular whisky stays five by groups, four by search);
- 390 coverage for the supervisor and the cashier;
- Table status added;
- the discount-then-cash test added;
- the fixture proven on a fresh database;
- the three runs repeated on the final build;
- the wording fixed (bill request; "as the till recorded it" became "as recorded on the payment").

## Owner questions, answered with the default (rule 1)
- **Where a tap count starts:** from the waiter's Floor, including the table tap (A2 §3.8). Measured that way, every task is four or under.
- **The laptop header:** the manager keeps the shared top bar (locked decision D-MGRTOPNAV); the order screen sits under it with the drawing's breadcrumb, Open pill and Move table / Split bill / Discount / More. The drawing's simpler bar would be a shell change, which is T1's.
Both are recorded in `T3_PROGRESS.md` "Decisions taken"; the owner can reverse either.

## Way back
Revert the branch. There is no API, schema, seed or migration change, and the deleted web files come back with the revert.
