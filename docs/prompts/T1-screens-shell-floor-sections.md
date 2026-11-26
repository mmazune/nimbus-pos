# T1 — Screens: the shell, the Floor, and every section that already has an API

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t1/screens`, cut from `rebuild/main`. If `apps/web/src/components/kit/index.ts` is missing, run `git merge --no-edit origin/u0/foundations` on your branch.
You own: `apps/web/src/components/pos-shell/**`, `apps/web/src/screens/{floor,reservations,me,receipts,till,approvals}/**`, the pages for those routes, the floor components under `components/floor/`, `components/{waiter,cashier,supervisor}/` **except their table workspace and order files**, the kit files for header, bars, table tile, chip, segmented, row, card, pill, banner, field, switcher, text and button, and new kit files you add. Also `reports/**`, your rows in `design/screens/SCREENS.md`, one script line in the root `package.json`.
You never touch: `apps/web/src/screens/order/**`, any `*TableWorkspace*` file, `components/waiter/orders/**`, the kit files for item tile, measure row, order line, order header, sheet, key, option tile, action tile and stepper (track T3 owns them), `apps/api/**`, `packages/db/**`.

## Why

"In the waiter UI, every UI says something different when they select a table." "The navigation bar should look premium." "By the time you're coding, they should look exactly the same as those pictures." "Hide developer-facing clutter." (Moses, 25 and 26 Nov 2026)

## Phases

**1. Shell and Floor.** Do `docs/prompts/U1-shell-and-floor.md` in full: its Why, Read first, read-back, parts a to d and Done-when 1 to 10 are this phase. (Its branch and ship lines are replaced by this file.)

**2. Reservations.** Drawings `Reservations-Waiter` and `Reservations-Supervisor`. One screen, two sets of rights. Waiter: today's arrivals and seated; seat at the booked table or at another free table that fits (the seat endpoint takes a table in its body). Supervisor: Arriving, Seated, Attention, History; create, confirm, change table, cancel with a reason, no-show only when late, complete. Phone and deposit show for the supervisor only. Use the endpoints that exist (`docs/supervisor-ui-docs/SUPERVISOR_RESERVATION_LIFECYCLE.md`). Forms that have no drawing (new booking, cancel) use a kit Sheet with kit Fields, one filled button.

**3. Me.** Drawing `Waiter-Me`, for waiter, cashier and supervisor: shift, my day (only numbers an endpoint really gives), my requests (leave, swap), change my PIN (the existing token flow), log out. Delete the panels that talk to developers: "Restricted surfaces", "Known limitations", "Readiness", permission keys, endpoint paths.

**4. Receipts and Till.** Drawings `Cashier-Receipts` and `Cashier-Till`, on the existing receipt and till endpoints. Receipts returns to the cashier's bar. "Print again" and "Refund" appear only if an endpoint does the job today; otherwise leave them out and list them.

**5. Approvals.** Drawing `Supervisor-Approvals`, on the approval endpoints that exist: a list, a detail panel, Approve and Decline with who and when.

**6. Sweep.** On every screen these three roles can reach outside an open table: remove developer wording (route names, permission keys, "API", "v1", "stub", "endpoint"; the ten worst are listed in `docs/direction/research/A2_frontend_as_built.md`), remove outlined buttons and cut-off text, and move anything still on old components to the kit where it is one screen's work. Add `verify:web` (lint, typecheck, `check:ui`) and finish on it. Score each built screen against the standards' look review; 20 of 24 passes.

## Done when

1. Phase 1's ten lines hold.
2. Reservations: a waiter seats a late booking at another table and a supervisor creates, confirms, moves, cancels and completes a booking, each driven in the browser and screenshotted beside its drawing at 1280 × 800.
3. Me, Receipts, Till and Approvals each match their drawing in layout, sizes and words, with the left-out parts listed.
4. No screen these roles can reach shows a permission key, a route or an endpoint.
5. Every screen passes rule 10 at 1280 × 800 and 390 × 844.
6. `pnpm verify:web` and the web build are green; no Playwright spec that passed at your baseline fails, except the ones you updated and list.
7. `git diff --stat rebuild/main...HEAD` stays inside what you own.
8. `SCREENS.md` rows for the screens you built say `built`, with their score.
