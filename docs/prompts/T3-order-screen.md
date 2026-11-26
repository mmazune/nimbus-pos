# T3 — The one order screen, for every role, on every device

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t3/order-screen`, cut from `rebuild/main`. Then run `git merge --no-edit origin/e1/order-truth`, and `git merge --no-edit origin/u0/foundations` if `apps/web/src/components/kit/index.ts` is missing. You need E1's API (send by line, void one line, cash with change) to build against; you run it from your own branch and never edit it.
You own: `apps/web/src/screens/order/**`, every `*TableWorkspace*` file and the files that mount the table workspace for waiter, cashier, supervisor and manager, `components/waiter/orders/**`, the kit files for item tile, measure row, order line, order header, sheet, key, option tile, action tile, stepper, square and round action, and new kit files you add. Also `reports/**` and your rows in `design/screens/SCREENS.md`.
You never touch: `apps/web/src/components/pos-shell/**`, the Floor, the screens track T1 owns (`screens/{floor,reservations,me,receipts,till,approvals}`), the other kit files, `apps/api/**`, `packages/db/**`.

## Why

- "Waiter taps a table → a full screen opens, not half a screen… big, clear menu buttons… Starters, offers of the day… categories with sub-categories… you can search the menu." (Moses, 25 Nov 2026)
- "When they press that table again, that's when they can edit an order." "Supervisor taps the same table → void, split bills. Cashier → print bill, take payment." (Moses, 25 Nov 2026)
- "Everything 2 to 3 taps away." (Moses, 25 Nov 2026)

The real case, measured on this code: a table tap gives four different results by role; the waiter's builder is 1,608 lines with three fixed columns that break at 390 px and chips that scroll sideways; a waiter cannot add to an order after Send (`WaiterOrderBuilderScreen.tsx`, about line 1119); no role can void one item; cash must equal the bill; tapping a free table creates an order on the server before anything is ordered.

## Read first

`docs/direction/01-decisions.md` (R1 to R7, R27), `docs/direction/02-life-cycles.md` sections 3 and 4, `design/screens/README.md`; drawings `Order-Empty`, `Order-Terminal`, `Order-Other`, `Order-Laptop`, `Order-Phone`, `Order-Phone-Check`, `Order-Phone-Item`, `Supervisor-Table`, `Supervisor-Void`, `Cashier-Pay`, `Table-Life`; `docs/prompts/E1-order-truth.md` and `reports/E1_REPORT.md` for the API you now have; `docs/direction/research/A2_frontend_as_built.md` section on the table tap.

## Phases

**1. Read-back and the data layer.** `reports/T3_READ_BACK.md`, 60 lines at most: what opens on a table tap for each role today, each endpoint the new screen calls, what E1 added, what is missing. Then `screens/order/data/`: one typed source for the menu in the shape `GET /api/menu/workspace` will have (sections, groups, sub-groups, items with servings and choices, `initials`, `availability`), filled today from the endpoints that exist, so the switch is one file later; and one for the order (lines with sent, unsent, voided; send; add; remove; void; pay).

**2. The screen on a terminal, waiter.** Full screen over the shell. Order header with back to the Floor. Food or Drinks; groups as a grid; a sub-group as a filter row; "Popular" first when the data gives it. Items as tiles; items with servings as rows with one button per serving. The order panel on the right: not sent, then sent by time; total; the bottom row. **Free table**: nothing is saved until the first Send; leaving with nothing entered leaves the table free. **Table with an order**: add at any time; Send sends only the unsent lines. **Another waiter's table**: read only, as drawn. The filled button follows R5.

**3. Fast hands.** Item with choices as a sheet (pick one, extras, leave out, note, quantity). Search over the whole menu by name and by initials. Quantity first (tap 6, then the item). "Same again" re-adds the drinks of the last sent round. Tap a line: change quantity or note, remove if unsent. A line whose item is unavailable shows as drawn when the data says so.

**4. The same table for cashier, supervisor, manager.** Cashier: Take payment as drawn; cash with quick amounts, keypad and change through E1; other methods as the API takes them today. Supervisor: the table actions sheet with the actions an endpoint supports today, and void one line with reason, "was it made?" and quantity through E1. Manager on a laptop: the same screen under the top bar. A waiter asking for a void sees the approval path that exists today, or the action is left out and listed.

**5. Phone.** `Order-Phone`, `Order-Phone-Check`, `Order-Phone-Item`: menu first, the order as a sheet, the item as a sheet.

**6. Swap and prove.** Mount the new screen for all four roles; delete the old builder, the docked sheet and the inline card once nothing imports them. Then drive **"Table 12's evening" through the browser** as real people: the waiter sends food at a free table, adds drinks and sends again, the supervisor voids the wings as made, the cashier takes cash and gives change, the table is free. At 1280 × 800, and the waiter's part again at 390 × 844. Count the taps for: a beer from Popular, a double whisky with cola, a burger with choices; put the counts in the report.

## Done when

1. One screen opens from a table tap for waiter, cashier, supervisor and manager; the old three are gone from the code.
2. A free table tapped and left creates nothing on the server (shown by the network log in the proof).
3. A waiter adds to a sent order and the second Send sends only the new lines.
4. Search finds an item from three letters and from its initials; quantity first and "Same again" work.
5. A supervisor voids one sent line with a reason and "was it made?"; a waiter cannot.
6. A cashier takes 100,000 on a bill and the screen shows the change before and after.
7. Each drawing in Read first sits beside a screenshot of the built screen; layout, sizes and words match; differences are listed with the reason.
8. "Table 12's evening" passes in the browser three runs in a row; tap counts are in the report and none is above four.
9. Rule 10 holds at both sizes; `pnpm check:ui`, web lint, typecheck and build are green.
10. `git diff --stat origin/e1/order-truth...HEAD` shows only what you own (the E1 files arrive by the merge, unchanged).
11. `SCREENS.md` rows for the order drawings say `built`, with their score out of 24.
