# T5 — Join the four tracks, then wire the screens to the new engines

Read `docs/prompts/LONG-RUN-RULES.md` first, including its last section. It binds you.
Branch: `t5/join-up`, cut from `rebuild/main`. Then merge, in this order, each with `git merge --no-edit`: `origin/t2/engines`, `origin/t4/review-and-data`, `origin/t3/order-screen`, `origin/t1/screens`. A trial showed the first three merge clean and the fourth conflicts in four files: the three role floor screens (`components/{waiter,cashier,supervisor}/floor/*FloorScreen.tsx`) and `design/screens/SCREENS.md`. Resolve them so: T1's Floor is the floor; a table tap mounts T3's order screen; `SCREENS.md` keeps every row and the later status of each. Any other conflict: in `apps/api/test` helpers and configuration take T4's side, elsewhere under `apps/api` and `packages/db` take T2's side, and write what you did in the report.
You own: `apps/web/**`, `reports/**`, the Status cells in `design/screens/SCREENS.md`.
You never touch: `apps/api/**` and `packages/db/**` beyond resolving a merge (track T6 is working there), `design/screens/html|png|kit.css` (track T7 is drawing there).

## Why

- "I don't want dead ends. It should flow concurrently, interconnected, every single part." (Moses, 26 Nov 2026)
- "If lamb chops are done, they'll… be grayed out in the menu." (Moses, 26 Nov 2026)
- "Some people are just standing." "We have a kitchen screen we are trying to work on… how a chef is notified." (Moses, 25 and 26 Nov 2026)

The real case: four tracks finished on four branches. The order screen (T3) still reads the old menu endpoints and cannot show sold out; the Floor (T1) cannot show areas, tabs or "Ready"; the engines for all of that exist on T2 and nothing on screen uses them. T2's report lists every new endpoint ("Endpoints for T3 and T1"). T4 built a whole demo venue to test on.

## Read first

`reports/T1_REPORT.md`, `T2_REPORT.md` (the endpoint list and "Left out"), `T3_REPORT.md` ("Left out"), `T4_REPORT.md`, `packages/db/demo-venue/` (how to load it), `docs/direction/02-life-cycles.md`, `04-alerts.md`, `07-scenarios-and-rules.md`, `design/screens/SCREENS.md`.

## Phases

**1. One branch that works.** Do the merges. Load the demo venue into a throwaway database and use it for every proof from here on. All gates green: `verify:web`, web build, API typecheck and build, API unit tests, and both tracks' browser suites (T1's 27 and T3's "Table 12's evening"), three runs. Reword the sentence that says "backend" in `lib/cashier/payment-validation.ts` into words a cashier would use.

**2. The menu knows what is left.** Switch `screens/order/data/` to `GET /api/menu/workspace` with its version, and poll the changed-since endpoint. Popular and Offers come from the server. An item with a number shows "3 left" in amber; a sold-out item is grey on every open terminal within 10 seconds and says since when; an unsent line whose item sold out turns red with remove; Send reports skipped lines by name and sends the rest.

**3. Areas, tabs and moving people.** The Floor reads areas from the server; the Tabs area and "New tab" appear, with a note on the tab. Tiles take their state from the server: not sent, sent, ready, late, bill. The table actions sheet gains what T2 built: move table, join and split again, move a line, split the bill by guest, by item, by amount and evenly, change waiter (supervisor), hand over one table or all (the colleague accepts on their own screen; ending a shift with open tables is refused with the way out shown). A form with no drawing is a kit Sheet with kit Fields and one filled button; before you build each one run `git fetch origin` and, if `origin/t7/drawings` has a drawing for it under `design/screens/html/`, build to that.

**4. The kitchen talks back.** Waiter: the Ready section as drawn (`Waiter-Ready`), with Collected, and Ready added to the waiter's bar. On the order screen: hold a line and fire it, with 3 seconds to undo; an allergy flag and a takeaway flag on a line. Tiles show "Ready" and "Late".

**5. The kitchen and bar screens.** Drawing `Kitchen`, for chef and bartender, on T2's ticket endpoints: tickets oldest first, colour by age, voided lines struck, allergy in red, Ready; the "to make now" totals; Done with bring back; Sold out with mark, back on and set a number (T2's availability endpoints). Their bar is Tickets, Done, Sold out; Store waits for its engine and is left out. A chef and a bartender sign in with a PIN and land here. At 1920 × 1080 and 1280 × 800, eight tickets with no scrolling at the first size.

**6. Prove the chains in the browser, as real people, on the demo venue.** Each three runs in a row at 1280 × 800, the waiter's parts again at 390 × 844:
- "Lamb chops": the chef sets 2 left; one waiter sends one; two waiters race for the last; the loser is told and the rest of the order goes; the button is grey on a third terminal.
- "Starters now, mains later": hold, send, Ready on the kitchen screen, the waiter's Ready section, Collected, fire, undo once, allergy visible on the ticket.
- "A busy Friday": a tab opened and named, a party moved, two tables joined and split, a hand-over accepted, then the shift ended.
- "Table 12's evening" still passes.
Score every screen you built or changed against the standards' look review.

## Done when

1. The four branches are merged on `t5/join-up`; every gate in phase 1 is green; the conflict resolutions are listed.
2. The order screen makes one menu call and shows "3 left", sold out and the red line; proven in the browser on two terminals at once.
3. Areas, Tabs and "New tab" are on the Floor; move, join, split four ways, move a line, change waiter and hand over each work from the table actions sheet.
4. Ready reaches the waiter and is collected; hold, fire, undo, allergy and takeaway work.
5. A chef and a bartender each sign in to their own screen; eight tickets fit 1920 × 1080; Done and Sold out work.
6. The four browser cases pass three runs in a row.
7. Rule 10 holds on every screen at its sizes; `pnpm check:ui` is green; no screen shows developer wording.
8. `SCREENS.md` rows for what you built say `built` with a score of 20 or more out of 24.
9. `git diff --stat` against the merge result shows `apps/web`, `reports` and `SCREENS.md` only.
