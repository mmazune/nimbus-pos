# T7 — Draw the screens that are still owed

Read `docs/prompts/LONG-RUN-RULES.md` first, including its last section. It binds you.
Branch: `t7/drawings`, cut from `rebuild/main`.
You own: `design/screens/html/**`, `design/screens/png/**`, `design/screens/tools/**`, new classes appended to `design/screens/kit.css`, `design/screens/SCREENS-2.md`, `design/screens/OVERVIEW.md`, `reports/**`.
You never touch: `apps/**`, `packages/**`, `design/screens/SCREENS.md` (track T5 edits it), any existing value in `kit.css` (the app's tokens mirror it), any of the 38 existing drawings.

## Why

- "You need to show me how these new screens will look like… for each person… by the time you're coding, they should look exactly the same as those pictures… put the same level of detail on each screen." (Moses, 26 Nov 2026)
- "Design each screen for mobile… for different people in the administration, the owners… you're going to have to design hundreds of screens for this, but it's fine. Go ahead." (Moses, 26 Nov 2026)

The real case: 38 screens are drawn and the roadmap lists about 120 more that are owed before their milestone can start (`docs/direction/06-roadmap.md`, "Drawings owed"). No screen may be built without its drawing, so every missing drawing is a milestone that cannot begin.

## How a drawing is made

Read `design/screens/README.md`, `kit.css`, `tools/README.md`, and look at all 38 PNGs first; open at least `Main`, `Order-Terminal`, `Supervisor-Void`, `Reservations-Supervisor`, `Kitchen`, `Manager-Item`, `Owner-Phone-Today` as HTML to learn the markup. A drawing is one plain `.html` file in `html/` that links `../kit.css`, at the exact size of its device, built only from kit classes, with real-looking made-up data that agrees with the other drawings (the same staff names, table 12's bill, the same menu and prices; the demo venue on `origin/t4/review-and-data` has a full menu you may borrow names from). Then `tools/render.js` makes its PNG and measures it. A drawing is finished when: `issues` is empty, `filled` is 0 or 1, the font is Inter, you have looked at the PNG yourself, and a second look by a reviewer subagent scores it 20 or more out of 24 on the standards' look review. Touch roles (waiter, cashier, supervisor, chef, bartender, store keeper) get the slim navy header and the navy bottom bar; manager, accountant and owner get the top bar on a laptop and the bottom bar on a phone. A sheet marks what is under it `inert`. Words follow `docs/direction/02-life-cycles.md`, `04-alerts.md`, `05-reports.md` and `07-scenarios-and-rules.md`: plain, short, no developer terms. If a piece is missing from the kit, add a class at the end of `kit.css` under a dated comment and list it in the report.

## What to draw, in this order

Each at its main size and again at 390 × 844 unless it says one size. Sizes: terminal 1280 × 800, kitchen 1920 × 1080, laptop 1440 × 900.

1. **Start of a shift:** the lock screen with PIN pad; wrong PIN; "Set your own PIN" (typed twice, by the person); start my shift; shift not started on the Floor; the cashier's Floor; the Floor with the Tabs area and "New tab"; name a tab.
2. **Table actions:** move table (pick a free one); join tables; split by guest, by item, by amount, evenly; discount (named ones, a free percentage behind a PIN); change waiter; hand over (offer, and the colleague's accept); move a line; cancel the order; the supervisor PIN pad on a waiter's screen.
3. **The order screen's other states:** search results; nothing found; a line that became sold out; hold and fire with the 3-second undo; allergy and takeaway on a line; "Same again"; a group with a sub-group filter row; offers.
4. **Paying:** mobile money by reference and its pending state; card by reference; split payment part-paid; paid, with the receipt; "Bill changed" since printing; refund asking for a supervisor; walk-out.
5. **Supervisor:** Team (who is on, their tables and sales, move tables between waiters); Me; new booking; edit; cancel with a reason; no-show; history; Attention.
6. **Kitchen and bar:** the bar screen; Done with bring back; Sold out with mark, back on and set a number; the low-stock banner; remake on a ticket; the opening list "still sold out?".
7. **Stock:** store keeper Stock with minimum and fill-to; Receive a delivery (full, short, dearer); Count (blind); Take out of stock on a terminal; a request received short; To buy; stores set-up.
8. **Manager on a laptop:** Today; menu list; item with servings and choices; staff list; a person (set-up without anyone seeing a PIN); approvals; settings (areas, stations and late times, limits, the business day); day close with its loose ends and the way out of each.
9. **Reports:** the day report (laptop and phone); till report; voids; sales by item; ticket times; stock on hand; count differences; cost and margin. The other reports follow the same layout: say which.
10. **Owner and accountant on a laptop:** all branches; one branch; purchases; stock value.
11. **Empty, loading and error:** one of each for a list screen, a detail screen and a sheet, on a terminal and a phone; "Not connected" with held orders.

## Deliver

`SCREENS-2.md`: one row per new drawing in the same columns as `SCREENS.md` (drawing, size, role, what it shows, proposed route, the milestone that builds it, status `drawn, awaiting the owner`). `OVERVIEW.md`: every new PNG shown in order under the headings above, so the owner can scroll one page on GitHub and approve or mark them. Commit and push after each numbered group.

## Done when

1. Groups 1 to 8 are drawn in full, and as much of 9 to 11 as time allows; the report says exactly which are missing.
2. Every new drawing has `issues` empty, at most one filled button, Inter, and a recorded score of 20 or more; the measured output for each is in `reports/proof/T7/`.
3. No existing drawing and no existing value in `kit.css` changed (`git diff --stat` shown); new kit classes are listed.
4. Names, prices and tables agree with the first 38 drawings; no real person, venue or brand appears.
5. `SCREENS-2.md` and `OVERVIEW.md` list every new drawing.
