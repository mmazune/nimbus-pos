# T3 report: the one order screen, for every role, on every device

Branch `t3/order-screen`, cut from `rebuild/main` `0af95f8`, `origin/e1/order-truth` merged (`6d433e8`). Session on Opus, 26 Nov 2026. `moses-build-standards` v5 loaded. Advisor consulted at the phase-1 boundary, before the money and rights work in phase 4, and before closing.
Grades: **[live]** a command or browser run in this container, **[emulation]** headless Chromium at a set viewport, **[code]** read from source, **[asserted]** stated, not checked.
Stack for every run: throwaway Postgres 16 `t3_order` on localhost (seed + demo import), the E1 API built and run on :4111, the web app as a **production build** (`next build` + `next start`) on :3111. Neon never touched; no `.env*` read or written; secrets minted in the shell per boot; Quick PINs reissued in memory by the test setup and never written anywhere.

## Phases
| Phase | What | Commits |
|---|---|---|
| 1 | Read-back (`T3_READ_BACK.md`); `screens/order/data/`: the menu in the shape of `/api/menu/workspace` (filled from navigation + catalog, so the switch is one file), exact money, the order with sent / unsent / voided lines, every call, rights and R5 | `ded65e1`, `214c096` |
| 2–3 | The screen on a terminal for the waiter; item sheet, search, quantity first, mixer row, Same again, tap a line, leave guard | `25cddc1` |
| 4 | Mounted for cashier, supervisor, manager; table actions; void one line; take payment; laptop frame | `4c9ed92`, `a54628f` |
| 5 | Phone: menu first, order as a sheet, item as a sheet | `b54ac3e` |
| 6 | Old surfaces deleted; races; tap counts; three runs; compare images; report | `de37868`, this commit |

## Done when, with proof
1. **One screen from a table tap for all four roles; the old three gone.** [live] `OrderScreen` is mounted by `WaiterFloorScreen`, `CashierFloorScreen`, `SupervisorFloorScreen` and `ManagerTablesScreen` (laptop frame under the top bar). Deleted: `WaiterOrderBuilderScreen.tsx` (1,608 lines), `WaiterTableWorkspace.tsx`, `WaiterOwnershipBlockedPanel.tsx`, `OperationalTableWorkspaceFrame.tsx` (the docked sheet), `SupervisorTableControlWorkspace.tsx`, the manager's inline card, and the unused `WaiterNewOrderScreen` / `WaiterOrdersQueueScreen`. Find bill and Find order still work and open tableless orders by id in the same screen (`actions.spec.ts` "takeaway opens by id"). Typecheck and build green after the deletions.
2. **A free table tapped and left creates nothing.** [live] `waiter.spec.ts` records method, path and status only: `reports/proof/T3/free-table-network.json` has `writes: []`, and the table's order count is unchanged.
3. **Adding to a sent order; the second Send sends only the new lines.** [live] `waiter.spec.ts` and `evening.spec.ts`: no second `POST /api/pos/orders`, three `POST …/items` and one `POST …/send`; the order's lines carry two distinct `sentAt` values; `reports/proof/T3/two-sends-network.json`.
4. **Search from three letters and from initials; quantity first; Same again.** [live] "col" finds Cola 300 ml, "bs" finds Blended Scotch (`waiter.spec.ts`; also unit `data.spec.ts`). Quantity first: "How many 2" then the item adds 2 (and a digit key on a keyboard). Same again re-adds the drinks of the last round, unsent (UGX 98,000 → 128,000).
5. **A supervisor voids one sent line with a reason and "was it made?"; a waiter cannot.** [live] `evening.spec.ts`: void sheet, "Made, it is waste", "Guest complaint", bill 98,000 → 74,000; the API row has `voidReason GUEST_COMPLAINT`, `wasMade true`; the line stays, struck through. The waiter's tap on a sent line opens nothing and her token gets **403** on the void route; rights matrix for all four roles in `reports/proof/T3/rights-matrix.txt`.
6. **A cashier takes 100,000 and the change shows before and after.** [live] Before: "Change to give UGX 26,000" (bill 74,000 after the void). After: "Give this change UGX 26,000 · Cash given UGX 100,000, as the till recorded it"; the payment row has `changeGiven 26000`. Screenshots `evening-1-4-cashier-pay-before.png`, `evening-1-5-cashier-paid.png`.
7. **Each drawing beside a screenshot of the built screen.** [emulation] `reports/proof/T3/compare-<Drawing>.png` for Order-Empty, Order-Terminal, Order-Other, Order-Laptop, Order-Phone, Order-Phone-Check, Order-Phone-Item, Supervisor-Table, Supervisor-Void, Cashier-Pay, and Table-Life (a montage: it is a spec, not a screen). Differences and reasons: see "Differences from the drawings".
8. **"Table 12's evening" three runs in a row; taps ≤ 4.** [live] `reports/proof/T3/evening-3-runs.txt`: 3 of 3 green on the production build (with the waiter's part at 390 × 844 each time). Tap counts, measured by a click counter, from the open table in its default view (Food, first group):

   | Task | Route | Taps | From the Floor (+ table) |
   |---|---|---|---|
   | A beer from Popular | Drinks, Lager | 2 | 3 |
   | A double whisky with cola | Drinks, Whisky, Double, Cola | 4 | 5 |
   | … by search | Search, Double, Cola (typing "bs" not counted) | 3 | 4 |
   | A burger with choices | Grills, Beef burger, Medium, Add | 4 | 5 |

   None is above four from the open table. Counted from the Floor, the whisky and burger routes by groups are five; only search (or the item sitting in Popular) brings them to four. Stated plainly so the owner can decide which origin the budget means.
9. **Rule 10 at both sizes; check:ui, lint, typecheck, build green.** [emulation] The rule-10 measurer (no sideways scroll, nothing clipped, no target under 44, no text under 12, at most one filled button) runs on Order-Empty, Order-Terminal, Order-Other, the supervisor's table actions and void sheet, the cashier's payment (1280 × 800), the manager laptop (1440 × 900), and Order-Phone, -Check, -Item (390 × 844): all green. Gate outputs below.
10. **The diff shows only what T3 owns.** [live] `reports/proof/T3/diff-stat.txt`. The literal `git diff --stat origin/e1/order-truth...HEAD` also lists `rebuild/main`'s own commits since `27790c1` (U0 kit, gallery, check:ui, prompts) because the merge base is the E1 tip; T3's own work is `6d433e8..HEAD` (70 files): `screens/order/**`, `e2e/order/**`, `reports/**`, the four floor mount files, the deleted workspace files, `components/waiter/orders/**`, and the owned kit files `OptionTile`, `OrderHeader`, `OrderLine`, `Sheet`. Two edits outside the letter of the list, disclosed: `components/floor/index.ts` and `components/supervisor/floor/index.ts` lose the export of the deleted frame and workspace (one line each), and `components/waiter/floor/WaiterOwnershipBlockedPanel.tsx` was deleted with the waiter's table workspace, its only user. `apps/api` and `packages/db`: no change.
11. **SCREENS.md rows say `built`, with their score.** See "Look review"; rows updated in this commit.

## Gate outputs [live]
`reports/proof/T3/gates.txt`, run after the last code change: web typecheck exit 0; `next lint` "✔ No ESLint warnings or errors"; `next build` exit 0 (production, the build every proof ran on); `check:ui` green; `check:event` green; `e2e/order` 21 passed on the production build; "Table 12's evening" plus the phone part 3 of 3 in a row. The web package has no unit runner (its `test` script is a stub); the data layer's unit tests run as `e2e/order/data.spec.ts` (10 passed, inside the 21). API untouched, so its gates are E1's (`reports/E1_REPORT.md`).

## Look review [emulation, reviewer]
A subagent that built nothing scored the compare images (`reports/T3_LOOK_REVIEW.md`): Order-Empty 20, Order-Terminal 22, Order-Other 21, Order-Laptop 21, Order-Phone 21, Order-Phone-Check 23, Order-Phone-Item 23, Supervisor-Table 23, Supervisor-Void 24, Cashier-Pay 22, each out of 24 with no zero. First pass had Order-Other 18 (no way forward on the lock card) and Order-Laptop 18; fixed (a filled "Back to the floor"; "Floor ›" with an Open pill) and re-scored. Top remaining note: group tiles wrap long names to two lines and the "How many" strip is an addition. Owner decision: the laptop drawing shows a simpler bar than the manager's shared top bar (D-MGRTOPNAV, not T3's).

## Differences from the drawings (and why)
- Icons: the drawings' stand-ins are drawn with Phosphor names from the registry (I cannot add names; `pos-shell` is not mine): Move table `table`, Join `serviceArea`, Change waiter `staff`, Split `count`, Discount `revenue`, Void `soldOut`, Cancel `close`, Same again `refresh`.
- "How many 2–6" strip in the menu's top row (quantity first has no drawing).
- The order column is 372 px on the laptop too (the drawing's 400 has no kit token; kit tokens are not mine).
- Header context: guest counts are not in the data, so "3 guests" is left out; time open and the waiter's short name show.
- Order-Other: the lock card says "A supervisor can move it to you"; "Ask Brian O." and "Take it over" have no endpoint; no Print bill (the API refuses a waiter's bill request on another's order); the order column shows the count of **lines** and the total, not the lines (the API refuses the read).
- Supervisor-Table: "Send to kitchen again" has no endpoint and is replaced by "Same again"; Split bill says "Equal parts, recorded for the cashier" (the API only records allocation).
- Cashier-Pay: "Split" is left out (no drawing for entering parts); mobile money is a manual MOMO close (no phone prompt); the line under the button says the receipt is under Receipts (no printing yet).
- Phone groups go three across when a name has a word longer than eight letters ("Zero-Proof Bar"), four as drawn otherwise; long option names wrap to two lines rather than being cut.
- The search field on a phone has its visible label above (the kit field requires a label).

## Left out, and which milestone brings it
| What | Why | Brings it |
|---|---|---|
| Popular and Offers from sales data | no data source; a group named Popular is honoured when a manager makes it | T2 `/api/menu/workspace` |
| Sold out, "3 left", availability | not in the API; the tile already renders both states | T2 (E2), the joining-up prompt |
| Print bill printing | no printer path; the button records the bill request and says nothing printed | E4 |
| Waiter asks for a void | no approval route for a line void | later approvals milestone |
| Ask the waiter / Take it over | no endpoint | U4 / later |
| Split payment, partial cash | close needs the whole amount in one call; parts have no drawing | U3 follow-up |
| Split items, move items, mark served, table status change, complimentary, discount approve/reject | not drawn on the order screen; approve/reject live on Approvals (T1) | T1 Approvals; a later drawing |
| Guest count in the header | not in the data | — |
| Kitchen states per line (Ready, Collected) | E5 | T2 / E5 |

## Decisions taken
In `reports/T3_PROGRESS.md` (13 entries). The main ones: lines not sent stay on the device until Send, with a leave guard; the session prefers the signed-in person's own order when a table holds two; R5's filled button takes payment from the role (supervisor default: no payment); R1–R7 (26 Nov 2026) override the older `CLAUDE.md` bans this work would otherwise break (Manager operations read-only, no order actions for Manager on the floor, Supervisor without line void).

## Found, for other tracks
- **T2 (tables, E3):** `transfer-table` and `merge` (pos-handoff) leave the source table `OCCUPIED` with no order; close and void free it. The e2e puts its own empty fixture tables back to `AVAILABLE`; it does not paper over the gap in the product. [live]
- **T2:** the demo data leaves open orders on almost every demo table (TD-01 has 5); the e2e uses its own tables `12`, `14`–`18`. [live]
- **T4 (tests):** old suites that name the removed surfaces will go red by design and were not edited: `e2e/cashier-floor/*` (18 specs), `e2e/manager-operations/tables-and-reservations.spec.ts`, and the assertion scripts `cashier-c1/c2/c3`, `floor`, `prompt3a/3b1/3b2/3b3a/3b3b`. [code]
- **Sweep:** now unreferenced, left in place because they are not T3's: `CashierSelectedTablePanel` and ten `Supervisor*Dialog` files in `components/supervisor/floor/`. `CashierBillResolutionPanel` and `CashierSettlementWorkspace` are still imported by the hidden cashier queue route. [code]
- **T1 (floor):** the order screen is one component, `screens/order/OrderScreen.tsx`, taking `{ role, tableId | null, tableLabel, orderId?, onClose, onChanged, reservation?, orderingBlocked?, frame }`; mount it from the new floor the same way.
- The throwaway DB holds two "Grace Atim" waiters from an early fixture run (lookup fixed since); harmless, throwaway only.

## Process slip, disclosed
Phase 6: the first production build ran while my own dev server's `next-server` child (started by me) was still alive in the same folder (rule 19): killing the recorded `npx` PID did not stop its child. I stopped both PIDs, rebuilt cleanly, and every proof in this report comes from that second build.

## Way back
Revert the branch. No API, schema, seed or migration change; the deleted web files come back with the revert.
