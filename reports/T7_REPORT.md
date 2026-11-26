# T7 report: the screens that were still owed

Track T7, branch `t7/drawings` (cut from `rebuild/main` at 41772c7), 26 Nov 2026. Rules: `docs/prompts/LONG-RUN-RULES.md`. Standards: `moses-build-standards` was loaded first.

## Verdict

All 11 groups are drawn: 184 new drawings, each at its main size and again at 390 × 844. Every one is measured clean (no issue, at most one filled button, Inter) and scored by a reviewer that drew nothing: lowest 20 of 24, none under 20, none with a zero. None of the first 38 drawings and no existing `kit.css` value changed. Nothing is missing from groups 1 to 11.

## Per group

| Group | Drawings | Lowest score | Review |
|---|---|---|---|
| 1. Start of a shift | 16 | 20 | `reports/proof/T7/review-g1.md` |
| 2. Table actions | 26 | 20 | `reports/proof/T7/review-g2.md` |
| 3. The order screen’s other states | 16 | 22 | `reports/proof/T7/review-g3.md` |
| 4. Paying | 16 | 21 | `reports/proof/T7/review-g4.md` |
| 5. Supervisor | 16 | 20 | `reports/proof/T7/review-g5.md` |
| 6. Kitchen and bar | 14 | 20 | `reports/proof/T7/review-g6.md` |
| 7. Stock | 14 | 20 | `reports/proof/T7/review-g7.md` |
| 8. Manager on a laptop | 22 | 20 | `reports/proof/T7/review-g8.md` |
| 9. Reports | 16 | 20 | `reports/proof/T7/review-g9.md` |
| 10. Owner and accountant on a laptop | 8 | 20 | `reports/proof/T7/review-g10-11.md` |
| 11. Empty, loading and error | 20 | 21 | `reports/proof/T7/review-g10-11.md` |

The names of every drawing, with size, role, what it shows, route and the milestone that builds it, are in `design/screens/SCREENS-2.md`; the pictures in order are in `design/screens/OVERVIEW.md`.

## Done when, with proof

1. **Groups 1 to 8 drawn in full, and as much of 9 to 11 as time allows.** All of 1 to 11 are drawn: 184 drawings (92 phone, 92 terminal, kitchen or laptop). Missing: none. Two lines of group 9 and 11 are settled by decisions 17 and 21: the other 16 reports, and empty/loading/error for every other screen, follow the drawn layouts instead of having a drawing each.
2. **Issues empty, at most one filled button, Inter, a recorded score of 20 or more; measured output in `reports/proof/T7/`.** Measured: 184 drawings, 0 with an issue, 0 with more than one filled button, 184 in Inter, 0 overflowing (`reports/proof/T7/MEASUREMENTS.md`, `measure-g1.json` to `measure-g11.json`). Scores: 184 recorded, lowest 20, under 20: 0 (`reports/proof/T7/SCORES.md`). The measuring tool was proven not blind on a planted fault (`reports/proof/T7/check-proof.md`).
3. **No existing drawing and no existing value in `kit.css` changed; new kit classes listed.** `git diff --stat 41772c7 HEAD`:  425 files changed, 12256 insertions(+). Files changed among the first 38 HTML and PNG and `SCREENS.md`: 0. Lines removed from `kit.css`: 0; lines added: the T7 block at the end only. Files changed outside `design/screens/` and `reports/`: 0. New kit classes: `.pin`, `.pin i`, `.pin i.on`, `.pin.bad i.on`, `.toast`, `.skel`.
4. **Names, prices and tables agree with the first 38; no real person, venue or brand.** The cast is the first drawings’ (Amina K., Brian O., Grace N., David S., Sarah M., Ruth A., Joel T., Isaac B., Peter K., Daniel W.), plus Joy M. and Esther L., made up. Table 12 is UGX 98,000 with the same eight items wherever it appears; floor tiles are copied from `Main.html` and `Floor-Phone.html` by the generator, not retyped; menu items and prices are those of the first drawings. Cross-drawing numbers were checked by the reviewers and fixed where they disagreed (decisions 7, 10, 14, 20). Brands: a search for the networks and drink brands found none (decision 22). Phones are from `+256 700 000 xxx`.
5. **`SCREENS-2.md` and `OVERVIEW.md` list every new drawing.** Both are written by `design/screens/tools/t7/deliver.py` from the same registry the drawings come from: 184 rows and 184 pictures, each picture path checked to exist.

## Gates

- `node tools/check-event.mjs`: green, scanned 1428 files.
- `node tools/check-ui.mjs`: green (0 new screens in `apps/web/src/screens`).
- Typecheck, build, unit tests, e2e: not run, settled by decision 23 (no code changed).
- Every drawing re-rendered and measured from the final generator: 184 of 184 clean.

## How a drawing is made here (for whoever draws the next ones)

- `design/screens/tools/t7/base.py` holds the shared pieces (bars per role, the cast, table 12’s bill, tiles copied from the first drawings, sheets, keypad, picks); `g1.py` … `g11.py` one file per group; `build.py 1 2 …` writes the HTML.
- `design/screens/tools/render-all.js <list> <out>` renders and measures many drawings in one browser: the checks of `render.js` plus content hidden by a clipping box, a squeezed card, and a clipped tile number. `sheet.js` makes contact sheets for looking. `deliver.py` writes `SCREENS-2.md` and `OVERVIEW.md`; `scores.py` writes `SCORES.md`; `report.py` this report.

## Left out, and which milestone brings it

- No drawing was left out of groups 1 to 11. What the drawings show but the system cannot do yet is marked in the "Built in" column of `SCREENS-2.md` with the engine milestone it needs (for example “U3, needs E13” for mobile money pending and walk-outs, “U1, needs E12” for held orders).

## Decisions taken

1. The lock screen, the wrong-PIN screen and "Set your own PIN" carry the slim navy header but no bottom bar: nobody is signed in yet, so no role's sections apply.
2. Three kit classes were added at the end of `kit.css` under one dated comment: `.pin` (PIN dots: `.pin i`, `.pin i.on`, `.pin.bad i.on`), `.toast` (navy message with an Undo) and `.skel` (grey loading shape). Nothing above the comment changed.
3. The supervisor's phone bar says "Bookings" (owner question 4, default yes).
4. The cashier's bar stays Floor · Receipts · Till · Me (rebuild decision R9, 26 Nov 2026), although the group-1 reviewer cited the older Floor · Till · Me from the C1 milestone. R9 is newer and wins.
5. The keypad's delete key in new drawings is a backspace mark, not the curved arrow of `Cashier-Pay` (the reviewer read it as "undo"). `Cashier-Pay` is not changed.
6. "as at 19:42" stays: the first 38 drawings use it on every count.
7. The sold-out drawing moved from table 17 to table 23, whose floor tile already says "3 items not sent · 19,000", so totals agree with `Main`.
8. The walk-out is drawn on a terminal with the manager signed in: R1 gives every role the same order screen.
9. A choice with several picks (tables to move or hand over) shows a check on a deeper tint, never navy, so the one filled button stays alone on the screen. Helper `picks()` in `base.py`.
10. Reservations "Attention" holds 2 (late, table busy), as in the approved `Reservations-Supervisor`. A booking with no table joins Attention only 30 minutes before its time.
11. The bar screen keeps the kitchen ticket; colour times are 5 and 10 minutes for drinks (a station setting, as `02-life-cycles.md` section 4 allows).
12. Stock mode keeps "Block" beside Off and Warn: R19 and `03-stock-stores-availability.md` section 6 make it a venue choice, lifted by "We have it". The group-7 reviewer asked to remove it; the decision record wins.
13. "We found more" stays on the take-out sheet: R21 lists it among the fixed reasons of that one action.
14. Lamb chops sold out at 19:40 in every drawing (order screen, kitchen, manager, opening list).
15. The manager's laptop top bar keeps the five words of the approved drawings (Floor, Menu, Stock, Staff, More); Today is the home behind the mark, and Approvals, Reports and Settings sit under More.
16. Report tiles carry the currency in the label ("Sales, UGX") and the bare figure in the number, as in the approved `Manager-Waste-Report`; on a phone a report shows two tiles, not three, so seven-digit figures fit.
17. The other 16 reports of `05-reports.md` follow the report layout drawn here (control panel with period chips and Download; four tiles; the rows in one table; a 420 px side panel; on a phone two tiles and rows). They get no drawing of their own.
18. The accountant is Daniel W. ("DW", as in the approved `Accountant-Costs`); the owner is Esther L. ("EL"), a new member of the fictional cast. The owner's laptop bar mirrors the owner's phone bar: Today, Branches, Reports, Alerts, More.
19. The count limit is the larger of 2% and UGX 20,000 per item (`03-stock-stores-availability.md` section 10), so in the count-differences report only the Scotch line is over it; the group-9 reviewer read it as the smaller.
20. Table 12's voided wings are "made, waste" everywhere, as the approved `Supervisor-Void` shows.
21. Empty, loading and error are drawn once each for a list (Receipts), a detail (an order) and a sheet (discount), on a terminal and a phone; every other screen follows the same three patterns (`.skel` shapes in the final places, a 72 px tinted circle with one line and one way forward, Try again).
22. No real brand: mobile money networks are "Network A" and "Network B" in the drawings; a built screen shows the networks the venue sets up. Suppliers are made-up generic names (Green Valley Farms, City Drinks Depot, Lakeview Butchery, Sunrise Bakery).
23. Rule 12’s code gates (typecheck, build, unit tests, e2e, eslint on changed files) do not apply to this track: the branch changes only `design/screens/` (drawings, kit additions, tools) and `reports/` — `git diff --name-only 41772c7 HEAD` lists nothing else — and this container has no `node_modules`. The two gates that run without installs were run and are green: `node tools/check-event.mjs` (scanned 1428 files, green) and `node tools/check-ui.mjs` (green, 0 new screens). Rules 10, 11 and 24 (driving screens through Playwright as a person, engines, the demo venue) are for built screens; T7 builds none. Its Playwright use is rendering and measuring each drawing.
24. Every drawing was looked at by me on a contact sheet and scored by a reviewer subagent that drew nothing (rule 7 allows subagents for reviewing). Group 10 and 11 were scored together in one review.
25. The supervisor is still drawn without a payment button (owner question 2, default no) and a waiter may seat a booking elsewhere (question 1, default yes).

## What another track must know

- T5 owns `SCREENS.md`; T7 did not touch it. `SCREENS-2.md` sits beside it with the same columns.
- `kit.css` gained `.pin`, `.toast` and `.skel` at the end; the app’s tokens and kit mirror `kit.css`, so a builder adds these three when the first screen that uses them is built.
- Milestone prompts should cite the drawing names in `SCREENS-2.md`. The roadmap’s “Drawings owed” list in `docs/direction/06-roadmap.md` is now drawn; T7 did not edit it (outside its folders).
- Mobile money networks are placeholders (decision 22). The owner’s laptop bar (decision 18) and the manager’s laptop bar without a Today word (decision 15) are proposals for the owner to confirm.
## In short

```
Verdict: T7 done. All 11 groups drawn: 184 new drawings (main size and 390 × 844).
Measured: 184 of 184 clean, at most one filled button, Inter. Scored: lowest 20 of 24, none under 20, no zero.
First 38 drawings and every existing kit.css value untouched; .pin, .toast, .skel appended.
SCREENS-2.md (table) and OVERVIEW.md (every picture in order) list all 184.
Three reviewer calls were overruled by the decision record (R9 cashier bar, R19 Block, the count limit).
Placeholders: mobile money networks are "Network A/B"; the owner is a new made-up name, Esther L.
Code gates not run (no code changed, no node_modules); check:event and check:ui green.
Branch t7/drawings pushed; no pull request opened.
You need to: scroll design/screens/OVERVIEW.md on GitHub and approve or mark each drawing, and answer decisions 15 and 18 (the manager's and owner's laptop bars).
```
