# U0 — Foundations: tokens, the kit, the gallery, the checks

Model: Opus. If you are not Opus, say so and stop.
Size: one session, four parts, one demo (the `/kit` page).
Base: `rebuild/main`. Work on the branch this session gave you, cut from it. If `design/screens/kit.css` is missing, you are on the wrong base: say so and stop.
You may change: `apps/web/**`, `tools/check-ui.mjs`, `tools/check-ui.allow.json`, one script line in the root `package.json`, `reports/**`, and the Status cell of your own rows in `design/screens/SCREENS.md`. Nothing else.
Runs beside: E1, which owns `apps/api` and `packages/db`. Do not touch them.
Database: none. Do not start one. Never read, print or write `.env*`.
Ship policy: commit per part; push this session's branch; open no pull request; merge nothing; deploy nothing. This is the only session on this branch.

First: load `moses-build-standards`, say so, and read §0, §3.2, §5A and §8. If the skill is not listed, say that in your report and carry on: this prompt and `design/screens/README.md` hold the rules that bind this milestone.

## Why

- "By the time you're coding, they should like look exactly the same as those pictures." (Moses, 26 Nov 2026)
- "The navigation bar should look premium… Large buttons, not so large, but clearly reachable." (Moses, 26 Nov 2026)
- "This is a POS where people are swiping and tapping using their fingers." (Moses, 26 Nov 2026)

The real case, measured on this code at `938c013`: 78.3% of all text sits at 12 to 14 px; there are 31 text styles; 114 hand-made buttons use 87 different sets of classes; 110 one-off px values; 8 different recipes for page padding. That is why every screen "says something different". After U0 a screen can only be made from kit pieces, and a check stops anything else.

## Read first

1. `design/screens/README.md`, `design/screens/kit.css`, `design/screens/SCREENS.md`.
2. These drawings, the PNG to see and the HTML to measure: `Nav-Roles`, `Table-Tile`, `Main`, `Floor-1024`, `Floor-Phone`, `Order-Terminal`, `Order-Phone-Item`, `Supervisor-Table`, `Cashier-Pay`.
3. `docs/direction/01-decisions.md` (R8, R9, R10, R13).
4. As built: `apps/web/tailwind.config.ts`, `apps/web/src/styles/globals.css`, `apps/web/src/components/ui/`, `apps/web/src/components/pos-shell/role-icon-config.ts` and `role-icons.ts`, `apps/web/playwright.config.ts`.

## Read-back (before any code)

Write `reports/U0_READ_BACK.md`, 60 lines at most: each token in `kit.css` and where it will live; how px tokens sit beside the viewport-scaled root font size (R10: the kit is in px and does not scale; old screens are left alone); the list of kit pieces and the drawing each one comes from; the Phosphor icon chosen for each bottom-bar section; contradictions you found and which document won; questions, each with the default you will take. Record the baseline: web lint, typecheck and build (expected 0, 0, 0 and 69 route lines). Then continue unless blocked.

## Parts

**a. Tokens.** One file, `apps/web/src/styles/kit-tokens.css`, imported by `globals.css`, holds every colour, radius, shadow, size and type style from `kit.css` as CSS variables in px. Expose them to Tailwind as semantic keys under one `kit` namespace. Existing tokens and the root font-size rule stay exactly as they are. Commit.

**b. The kit.** In `apps/web/src/components/kit/`, typed, exported from `index.ts`, each with its states (idle, pressed, disabled, current, keyboard focus):
Text (the seven styles and the three extras), Button (filled, tonal, text, danger text; 52 and 44), SquareAction (52), RoundAction (48 and 44), Chip, Segmented, Card, Row, Sheet (bottom, middle, wide, side, with its scrim), Pill (green, amber, red, neutral, brand), Switcher, HeaderBand (phone), Field, TouchHeader (64), OrderHeader (60, with back), BottomBar (terminal) and TabBar (phone) with a count badge, TableTile (roomy and compact; free, open and mine, open and someone else's, not sent, bill, late, reserved, cleaning, new tab), OptionTile (48, 64 with a second line, 96 with an icon), ItemTile (plain, a few left with an amber "3 left", sold out), Banner (one line, amber or red, with one button), MeasureRow, OrderLine (not sent, sent, voided), Stepper, ActionTile (plain, danger), Key (100).
The sections of the bar for each role live in one registry, `kit/sections.ts`, exactly as R9 lists them, using Phosphor through the existing icon registry (regular when idle, fill when current, 28 px). A kit piece takes no free `className` for colour, size or type. No new dependency: Inter, Phosphor and Playwright are already installed. Commit.

**c. The gallery.** `apps/web/src/pages/kit.tsx`, served only when `NEXT_PUBLIC_KIT_GALLERY=1`, otherwise a 404. It shows every piece in every state; the bottom bar for waiter, cashier, supervisor, kitchen and store keeper inside frames 1024, 1280 and 1920 wide; the phone bar for waiter, manager, owner and accountant at 390; and two tile walls: 32 roomy tiles (8 by 4) in a 1280 × 800 frame and 35 compact tiles (7 by 5) in a 1024 × 768 frame, each with the touch header, the chip row and the bottom bar around it. Add one Playwright spec that opens `/kit` at 1280 × 800 and at 390 × 844, asserts the sizes in Done-when 4 and 5, and asserts no sideways overflow, no clipped text (`scrollWidth > clientWidth`), no button or link under 44 px, no text under 12 px. Save screenshots to `reports/proof/U0/`, with the two tile walls beside `design/screens/png/Main.png` and `Floor-1024.png`. If no browser will run here, say so, and grade those claims [code]. Commit.

**d. The checks.** `tools/check-ui.mjs`, run as `pnpm check:ui`, in the style of `tools/check-event.mjs`. It scans `apps/web/src/components/kit/**` and `apps/web/src/screens/**` (the folder every new screen will live in; create it with a one-line README) and exits 1 on: a hex or `rgb(` colour outside `kit-tokens.css`; a Tailwind arbitrary value (`[…]`); `truncate`, `text-ellipsis` or `line-clamp`; `overflow-x-auto` or `overflow-x-scroll`; a raw `<button` or `<a ` in `screens/**`; a text-size class that is not one of the kit's. Plant one fault per rule in a scratch file, show the red output, remove it, show green. Commit.

## Not in it

No change to any existing screen, shell, route or file in `components/ui`. Nothing deleted. No API, schema, seed or permission change. No new dependency. Kitchen ticket, data table, control panel and laptop app bar come later (U5, U7). No dark mode. Do not wire the new bar into the app: that is U1.

## Done when

1. `reports/U0_READ_BACK.md` exists and the baseline is recorded.
2. Every value in `design/screens/kit.css` is in `kit-tokens.css`; no kit file holds a colour or a size of its own.
3. Every piece in part b exists, is typed, is exported and appears on `/kit` in every state.
4. Measured on `/kit`: bottom bar 76 high, sections 56 high and equal in width, for 4 and for 5 sections, at 1024, 1280 and 1920; phone bar 84 with 56 high sections at 390; touch header 64; table tile 108 high with radius 16, compact 84 with radius 14; button 52 and 44 with radius 14; chip 44; segmented button 44; option tile 48, 64 and 96; item tile 96; measure button 48 high and at least 76 wide; order line at least 52; round action 48; key 100; card radius 20; pill 24.
5. The two tile walls fit their frames with no scrolling and sit beside the two drawings in `reports/proof/U0/`.
6. At 1280 × 800 and 390 × 844: no sideways overflow, no clipped text, no target under 44 px, no text under 12 px.
7. `pnpm check:ui` is red on each planted fault and green without them; both outputs are in the report.
8. Web lint 0, typecheck 0, build 0. With the gallery switch off, `/kit` is a 404.
9. `git diff --stat rebuild/main...HEAD` shows changes only in the allowed places.
10. The `Table-Tile` and `Nav-Roles` rows in `SCREENS.md` say `built (kit)`.

## Proof and report

Write `reports/U0_REPORT.md` with the gate outputs, the measured numbers against the drawn ones, and the screenshot paths. Grade every claim [live], [emulation], [code] or [asserted]. Finish in chat with a block of 8 lines at most that opens with the verdict and ends with `You need to: …`.

Then STOP.
