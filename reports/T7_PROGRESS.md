# T7 progress: drawings still owed

Branch `t7/drawings`, cut from `origin/rebuild/main` at 41772c7.

| Group | State | Commit |
|---|---|---|
| 1 Start of a shift | drawn, measured, under review | see git log |

## How drawings are made here
- Generator: `design/screens/tools/t7/` (`base.py` shared pieces, `g<N>.py` per group, `build.py`). Tiles and table 12's bill are copied verbatim from `Main.html`, `Floor-Phone.html`, `Order-Terminal.html`.
- Render and measure: `design/screens/tools/render-all.js` (same checks as `render.js`, plus a "hidden by its box" check). Output per group in `reports/proof/T7/measure-g<N>.json`.
- Contact sheets for looking: `tools/t7/sheet.js`.

## Decisions taken
1. The lock screen, the wrong-PIN screen and "Set your own PIN" carry the slim navy header but no bottom bar: nobody is signed in yet, so no role's sections apply.
2. Two kit classes were added at the end of `kit.css` under a dated comment: `.pin` (PIN dots) and `.toast`.
3. The supervisor's phone bar says "Bookings" (owner question 4, default yes).

## Left out, and why
(none yet)

## Next
Group 2, table actions.
