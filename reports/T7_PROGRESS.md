# T7 progress: drawings still owed

Branch `t7/drawings`, cut from `origin/rebuild/main` at 41772c7.

| Group | State | Commit |
|---|---|---|
| 1 Start of a shift | drawn; 16 of 16 pass after re-review (lowest 20) | see git log |
| 2 Table actions | drawn; 26 of 26 pass (lowest 20); logic clashes fixed after review | see git log |
| 3 Order screen states | drawn; 16 of 16 pass after re-review (lowest 22) | see git log |
| 4 Paying | drawn; 16 of 16 pass (lowest 21); pending Record made inactive until a reference is typed | see git log |
| 5 Supervisor | drawn; 16 of 16 pass (lowest 20); counts and times made to agree after review | see git log |
| 6 Kitchen and bar | drawn; 10 of 14 passed review 1; the 4 failures redrawn, re-review with group 7 | see git log |
| 7 Stock | drawn, measured, under review | see git log |

## How drawings are made here
- Generator: `design/screens/tools/t7/` (`base.py` shared pieces, `g<N>.py` per group, `build.py`). Tiles and table 12's bill are copied verbatim from `Main.html`, `Floor-Phone.html`, `Order-Terminal.html`.
- Render and measure: `design/screens/tools/render-all.js` (same checks as `render.js`, plus a "hidden by its box" check). Output per group in `reports/proof/T7/measure-g<N>.json`.
- Contact sheets for looking: `tools/t7/sheet.js`.

## Decisions taken
1. The lock screen, the wrong-PIN screen and "Set your own PIN" carry the slim navy header but no bottom bar: nobody is signed in yet, so no role's sections apply.
2. Two kit classes were added at the end of `kit.css` under a dated comment: `.pin` (PIN dots) and `.toast`.
3. The supervisor's phone bar says "Bookings" (owner question 4, default yes).
4. The cashier's bar stays Floor · Receipts · Till · Me (rebuild decision R9, 26 Nov 2026), although the group-1 reviewer cited the older Floor · Till · Me from the C1 milestone. R9 is newer and wins.
5. The keypad's delete key in new drawings is a backspace mark, not the curved arrow of `Cashier-Pay` (the reviewer read it as "undo"). `Cashier-Pay` is not changed.
7. The sold-out drawing moved from table 17 to table 23, whose floor tile already says "3 items not sent · 19,000", so totals agree with `Main`.
8. The walk-out is drawn on a terminal with the manager signed in: R1 gives every role the same order screen.
9. A choice with several picks (tables to move or hand over) shows a check on a deeper tint, never navy, so the one filled button stays alone on the screen. Helper `picks()` in `base.py`.
10. Reservations "Attention" holds 2 (late, table busy), as in the approved `Reservations-Supervisor`. A booking with no table joins Attention only 30 minutes before its time.
11. The bar screen keeps the kitchen ticket; colour times are 5 and 10 minutes for drinks (a station setting, as `02-life-cycles.md` section 4 allows).
6. "as at 19:42" stays: the first 38 drawings use it on every count.

## Left out, and why
(none yet)

## Next
Group 8, manager on a laptop.
