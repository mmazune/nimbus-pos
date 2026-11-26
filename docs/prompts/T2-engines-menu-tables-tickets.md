# T2 — Engines: the menu and sold out, tables and tabs, kitchen and bar tickets

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t2/engines`, cut from `rebuild/main`. Then run `git merge --no-edit origin/e1/order-truth`: you build on E1. If `OrderItem.sentAt` is not in the schema after the merge, say so in your progress file and stop this track.
You own: `apps/api/src/**`, new test files under `apps/api/test/` and beside the code, `packages/db/prisma/**` (schema, one new migration per phase, the seed), `reports/**`.
You never touch: `apps/web/**`, `packages/db/demo-venue/**`, existing shared test helpers and the e2e configuration (track T4 is repairing them; add files, do not edit theirs), `tools/**`.

## Why

- "If lamb chops are done, they'll disappear from the menu, or they'll be grayed out in the menu." (Moses, 26 Nov 2026)
- "Some places have like 60 tables, then they add extra tables for busy nights because some people are just standing." "Who creates tables and with what permission." (Moses, 25 and 26 Nov 2026)
- "We have like a kitchen screen we are trying to work on… how a chef is notified." (Moses, 25 Nov 2026)

## Before each phase

Run `git fetch origin`. If `docs/reviews/e1-order-truth.md` exists on `origin/t4/review-and-data`, read it (`git show origin/t4/review-and-data:docs/reviews/e1-order-truth.md`). Fix every blocker and should-fix that sits in files you own before starting the next phase, each with the reviewer's probe copied in and passing, as one commit named `fix(e1f): …`, and list them in your report. A finding you disagree with is answered in the report, not ignored.

## Phases

**1. The menu in one call, offers, sold out and a number left.** Do `docs/prompts/E2-menu-and-availability.md` in full: its Why, Read first, read-back, parts a to d, the e2e "Lamb chops, 2 left, then gone" and Done-when 1 to 12 are this phase. (Its model, branch and ship lines are replaced by this file.)

**2. Areas, tabs and moving people around.** Read `docs/direction/02-life-cycles.md` section 3, `07-scenarios-and-rules.md` (Seating, People), and the as-built tables, split, merge and transfer code. Build:
- `Area` (name, order, kind tables or tabs) and `Table.areaId`; existing tables go into areas made from whatever marks their zone today, in the migration.
- Bulk add: how many, first number, seats each, into an area; in one transaction; numbers never collide. Put away (never delete; refused while an order is open). Change seats.
- Tabs for standing guests: open one in a tabs area with the next free number and an optional note; it behaves as a table; it is put away when paid.
- Move a table's order to a free table. Join two tables into one bill and split them again. Move one line to another table. Split a bill by guest, by item, by amount and evenly, using what exists and filling the gaps.
- Change waiter (supervisor, manager) and hand over: a waiter offers one table or all to a named colleague, who accepts or declines; ending a shift with open tables is refused until they are handed over.
- Rights: tables and areas are written by Owner, Manager and Supervisor. Every action writes an audit row.
Real case as an e2e test, **"A busy Friday"**: 60 tables in 4 areas and a tabs area made through the API; 8 more tables added mid-service; tab 1 to tab 30 opened by three waiters at once with no number used twice; table 5's party moves to table 14; tables 7 and 8 joined then split; one line moved; a waiter hands six tables to a colleague and only then ends the shift.

**3. Kitchen and bar tickets that close the loop.** Read `02-life-cycles.md` section 4, `04-alerts.md` rows `TICKET_LATE` and `READY_WAITING`, and the as-built ticket code. Build:
- A ticket per send per station (from E1), the station taken from the item; stations listed per branch as settings, with their late times.
- Ready on a ticket; the waiter's list of what is ready for their tables (`GET` for "mine" and for all), with Collected; times kept for sent, ready, collected.
- Bring a ticket back from done. A voided line shows on its ticket (E1). Remake is not in this phase.
- Hold a line and fire it: Send skips held lines; fire sends them; a fire can be undone for 3 seconds.
- An allergy flag and a takeaway flag on a line, carried to the ticket and kept for later rounds on that table.
- The table's state for the Floor is derived on the server: not sent, sent, ready, late.
- Rights: tickets are worked by Chef and Bartender for their own stations, and by Supervisor and Manager.
Real case as an e2e test, **"Starters now, mains later"**: starters sent and mains held; the kitchen sees only starters; Ready reaches the waiter's list; Collected; mains fired, one fire undone inside 3 seconds; a nut allergy shows on both tickets; a second round of drinks makes a bar ticket; a ticket bumped by mistake is brought back.

## Not in it

No web change. No stock, no alerts table, no printing, no tax, no stock-driven sold out. No change to E1's rules except review fixes.

## Done when

1. Phase 1's twelve lines hold.
2. "A busy Friday" and "Starters now, mains later" each pass three runs in a row, and "Table 12's evening" and "Lamb chops" still pass.
3. Each phase has one additive migration; applying all of them to a database that already holds orders and tables keeps every row.
4. The seed diff per phase shows only the grants named above.
5. Review findings in your files are fixed with their probes passing, or answered.
6. API typecheck 0, build 0, unit tests 0 failed, `eslint` clean on changed files, `pnpm check:event` green.
7. `git diff --stat origin/e1/order-truth...HEAD` stays inside what you own.
8. The report has, for track T3 and T1, a short list of every new endpoint with its path, body and answer.
