# U1 — The new shell and the Floor, for every touch role

Model: Opus. If you are not Opus, say so and stop.
Size: one session, four parts, one demo (the Floor on four screen sizes).
Base: `rebuild/main` **with U0 merged**. If `apps/web/src/components/kit/index.ts` is missing, U0 is not merged: say so and stop.
You may change: `apps/web/**`, `reports/**`, and the Status cell of your rows in `design/screens/SCREENS.md`. Nothing else. No API, schema, seed or permission change.
Runs beside: one engine session in `apps/api` and `packages/db`. Do not touch them.
Database: you may run the API against a throwaway local Postgres to look at the screens (`service postgresql start`; `DATABASE_URL` on `localhost`, set in the shell only; `db:seed` on that database only). Never Neon. Never read, print or write `.env*`. Never run `next build` while a dev server runs in the same folder. Record PIDs; never `pkill -f`.
Ship policy: commit per part; push this session's branch; open no pull request; merge nothing; deploy nothing.

First: load `moses-build-standards`, say so, and read §0, §3.2, §5A and §12. If it is not listed, say that in your report and carry on with this prompt and `design/screens/README.md`.

## Why

- "In the waiter UI, every UI says something different when they select a table." (Moses, 25 Nov 2026)
- "Some places have like 60 tables, then they add extra tables for busy nights because some people are just standing." (Moses, 26 Nov 2026)
- "The reason for Nimbus POS why we had used a bottom navigation… is because these people use touch screens." "Just two icons for a whole navigation bar is not acceptable." (Moses, 26 Nov 2026)
- "By the time you're coding, they should look exactly the same as those pictures." (Moses, 26 Nov 2026)

The real case: the floor as built is a wall of 152 px cards that scrolls for 28 tables, with "No active order summary" on every card, a strip of six count tiles above it, and labels cut with "…" (`_qa-logs/supervisor-screenshots/supervisor_floor-desktop.png` shows it). The drawing holds 32 tables on a 1280 × 800 terminal and 70 on a 1920 × 1080 one, with no scrolling, and each tile says whose table it is, for how long and how much.

## Read first

1. `docs/direction/01-decisions.md` (R1, R8, R9, R10, R11, R13), `docs/direction/02-life-cycles.md` sections 1 and 3.
2. Drawings, PNG to see and HTML to measure: `Main`, `Floor-1024`, `Floor-1920`, `Floor-Phone`, `Table-Tile`, `Nav-Roles`, `Table-Life`.
3. As built: `apps/web/src/components/pos-shell/` (shell, header, bottom nav, layout, idle logout, role navigation), `components/floor/` (the shared floor and table card), `components/waiter/floor/`, `components/cashier/`, `components/supervisor/`, `lib/<role>/routes.ts`, `lib/waiter/floor-model.ts`, `pages/login.tsx`, `apps/web/playwright.config.ts` and the specs that touch the floor or the shell.

## Read-back (before any code)

`reports/U1_READ_BACK.md`, 60 lines at most: the shell regions today and after; for each thing a tile draws (number, state, whose, guests, minutes, amount, seats, booking time), the field it comes from today, or "no data yet"; how areas are known today; the sections each role gets now and which wait for a later milestone; the Playwright baseline (passed, failed, by spec file); contradictions and which document won; questions with defaults. Then continue unless blocked.

## Parts

**a. The shell.** Waiter, cashier and supervisor get the kit's TouchHeader (64 px: mark, screen title, one summary line "as at HH:MM", search where drawn, signed-in name, role and terminal, a Lock button that returns to the lock screen) and the kit's BottomBar (76 px) on a terminal or tablet, TabBar (84 px) under 640 px wide. Sections come from `kit/sections.ts`. A section whose screen is not built yet is **left out, not faked**: so for now waiter is Floor, Reservations, Me; cashier is Floor, Receipts, Till, Me (Receipts is the existing hidden route, shown again); supervisor is Floor, Reservations, Approvals, Me. Ready and Team arrive in U4. The shift banner, readiness chips and count-tile strips leave the Floor; a shift that is not open is one line under the header with one button. The manager's top bar is untouched. Commit.

**b. The Floor.** One shared Floor for the three roles, built only from kit pieces in `apps/web/src/screens/floor/`. Area chips with counts (from whatever marks a table's area today; one chip "All" if nothing does). Waiter: "My tables · n | All tables", opening on My tables when they have any. Tiles in a grid with no sideways scroll: roomy (108 px high, at least 136 wide, 12 px gap) when the area's tables fit the space between header and bar; else compact (84 high, at least 124 wide, 10 px gap); else compact and the grid scrolls down. Phone: "Yours" first, then the area with its switcher, three tiles across. Supervisor on a wide screen may pick "All areas". Search finds a table by number. Commit.

**c. The tile tells the truth.** States from `Table-Tile`: free (seats), reserved (time and party size), open and yours, open and someone else's (flat grey, their name as "First L."), not sent (items waiting), bill (asked or printed), ready, cleaning. Show minutes open and the amount where the data has them. Where the drawing shows something the data cannot give yet (guest count without a booking, "Late", the Tabs area, "New tab"), leave it out and list it in the report; never invent a value. Never a guest's name on a tile. Tapping a tile opens exactly what it opens today; that screen is replaced in U2 and must keep working until then. Commit.

**d. Measure and tidy.** Extend the kit's Playwright spec, or add one, that loads the Floor as waiter at 1024 × 768, 1280 × 800 and 390 × 844 and as supervisor at 1920 × 1080 against a seeded local database: no sideways overflow, no clipped text, no target under 44 px, no text under 12 px, header 64, bar 76 (phone 84), tile sizes as above, and the number of tiles visible without scrolling. Save screenshots beside the four drawings in `reports/proof/U1/`. Update the specs that asserted the old shell or card and list each one; no other spec that passed at baseline may fail. Delete the old floor card, count strips and bottom nav once nothing imports them. Commit.

## Not in it

The order screen (U2). The lock screen's look (its drawing is owed). Ready, Team, Tabs, New tab, areas set-up. Any API, schema, seed or permission change. The manager, accountant and owner screens. Dark mode.

## Done when

1. The read-back exists with the Playwright baseline.
2. Each of the three roles shows the header and bar as drawn, with exactly the sections listed in part a; on a phone the TabBar.
3. At 1280 × 800 an area of 32 tables shows 8 by 4 roomy tiles with no scrolling; at 1024 × 768 the same area shows compact tiles, 7 across, with no scrolling; at 1920 × 1080 "All areas" shows 12 across.
4. Every tile state in part c that the data supports is on screen in the proof screenshots; the left-out ones are listed with the milestone that brings them.
5. Nothing scrolls sideways, no text is cut, no target is under 44 px, no text is under 12 px, at all four sizes.
6. `pnpm check:ui` is green; every new screen file lives under `apps/web/src/screens/` and uses kit pieces only.
7. Tapping a table still opens and completes an order the way it did at baseline, for each role.
8. Web lint 0, typecheck 0, build 0. Playwright: no spec that passed at baseline fails, except the updated ones you list.
9. `git diff --stat rebuild/main...HEAD` shows `apps/web`, `reports` and `SCREENS.md` only.
10. The rows `Main`, `Floor-1024`, `Floor-1920`, `Floor-Phone` in `SCREENS.md` say `built`, and you scored each against the standards' look review (state the score out of 24; 20 is the pass mark).

## Proof and report

`reports/U1_REPORT.md`: gate outputs, measured numbers against drawn, screenshot paths, the left-out list, the specs you changed. Grade every claim [live], [emulation], [code] or [asserted]. Finish in chat with 8 lines at most, opening with the verdict and ending `You need to: …`.

Then STOP.
