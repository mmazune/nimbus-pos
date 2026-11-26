# E2 — The menu in one call, offers, and sold out that everyone sees

Model: Sonnet. If you are not Sonnet, say so and stop.
Size: one session, four parts, one demo (the e2e test "Lamb chops, 2 left, then gone").
Base: `rebuild/main` **with E1 merged**. If `OrderItem.sentAt` is not in `packages/db/prisma/schema.prisma`, E1 is not merged: say so and stop.
You may change: `apps/api/**`, `packages/db/**` (one new migration and the seed), `reports/**`. Nothing else.
Runs beside: one screens session in `apps/web`. Do not touch it.
Branch: before your first commit run `git switch -c e2/menu-and-availability`. Never commit on `rebuild/main`.
Ship policy: commit per part on that branch and push it after each part with exactly `git push -u origin e2/menu-and-availability`. The owner's go-ahead for that push is this line and the message that started you; do not wait to be asked again. Never push `rebuild/main` or any other branch, never force-push, open no pull request, merge nothing, deploy nothing.

Database: a throwaway one inside this container only (`service postgresql start` or Docker). Set `DATABASE_URL` and `DIRECT_DATABASE_URL` in the shell, never in a file; if the host is not `localhost` or `127.0.0.1`, stop. Never read, print or write `.env*`. Never Neon. `db:seed` on the throwaway database only.
Commands: `corepack pnpm@8.15.0`. Never a lint script with `--fix`; run `eslint` on the files you changed. Record PIDs; never `pkill -f`.

First: load `moses-build-standards`, say so, and read §0 and §1.3. If it is not listed, say that in your report and carry on with this prompt.

## Why

- "If lamb chops are done, they'll disappear from the menu, or they'll be grayed out in the menu." (Moses, 26 Nov 2026)
- "The system should not be rigid. It should be flexible." (Moses, 26 Nov 2026)
- "Big, clear menu buttons… Starters, offers of the day… you can search the menu." (Moses, 25 Nov 2026)

The real case. At 19:20 the chef has two portions of lamb chops left and says so. Waiter A sends one: every terminal now shows "1 left". Waiters B and C each send one in the same second: one of them gets it, the other is told at once that it is sold out and the rest of their order still goes to the kitchen. The button is grey for everyone. Next morning the chef is asked whether lamb chops are still off. Today none of this exists: an item is either active or deleted from the menu (`MenuItem.isActive`), and the waiter's screen needs two calls (`/menu/catalog` for items without choices, `/menu/navigation` for the groups without items).

This milestone is sources 1 and 2 of R19 (by hand, and a counted-down number). Stock-driven sold-out is E10; do not start it.

## Read first

`docs/direction/01-decisions.md` (R3, R19, R20, R27), `docs/direction/02-life-cycles.md` section 5, `docs/direction/03-stock-stores-availability.md` section 6, `docs/direction/04-alerts.md` (rows `ITEM_LOW`, `ITEM_SOLD_OUT`, `LINE_UNSENDABLE`); `research/A3_backend_as_built.md` on the menu; `apps/api/src/modules/menu/`, `orders/` (the send path from E1); schema models `MenuItem`, `MenuBrowseGroup`, `MenuBrowseSubgroup`, `MenuItemServing`, `ModifierGroup`, `ModifierOption`, `MenuItemOnGroup`; the permission seed.

## Read-back (before any code)

`reports/E2_READ_BACK.md`, 60 lines at most: what each menu endpoint returns today and its size on the seed; how the send path from E1 can check and take a count inside its own transaction; where permissions for Chef and Bartender are seeded; contradictions and which document won; questions with defaults. Baseline: API typecheck, unit tests, e2e, build, as you find them on this base. Then continue unless blocked.

## Parts

**a. One call for the waiter's menu.** `GET /api/menu/workspace` (read permission as `/menu/catalog` today) returns, for the branch: the two sections, their groups and sub-groups in order, and every active item once with price, station, servings, choice groups with their options and price changes, `initials` (first letters of its words, for search) and its availability. Add `popular`: per section, up to 20 item ids ranked by quantity sent in this branch over the last 14 days, falling back to menu order when there are no sales. Add a `version` that changes whenever anything in the answer would; `If-None-Match` gives 304. Build a 200-item test menu in a test helper (never in the seed) and record the response size and time. The old endpoints stay. Commit.

**b. Offers.** One additive migration for this whole milestone. On `MenuItem`: `isOffer`, `offerPrice` (optional, Decimal), `offerNote` (optional). The workspace lists `offers` per section. When a line is added the server uses the offer price if one is set; the line keeps the normal price beside it. Set through the existing menu write endpoints and permission. Commit.

**c. Sold out, back on, a number left.** Per item per branch: manual state, `left` (optional), `lowAt` (default 5), since, by whom; and an append-only log row for every change (`03` section 6). Endpoints: mark sold out, mark available, set a number, list everything not available, and `GET /api/menu/availability?since=` returning only what changed (terminals poll it; the browser cannot use the existing event stream). New key `pos:menu:availability:write`, seeded for Owner, Manager, Supervisor, Chef and Bartender, nobody else; a chef or bartender may only change items of their own station kind. Emit `menu.availability.changed` on the app's event emitter for later milestones. Reset: `POST /api/menu/availability/reset` (Owner, Manager) clears manual marks and numbers and returns what was cleared; `GET …/yesterday` gives the opening list. Commit.

**d. Send respects it.** Inside E1's send transaction: a line whose item is sold out is skipped and reported; a line whose item has a number takes its quantity from it with a guarded update, so two sends in the same instant cannot both take the last one; reaching zero marks the item sold out and logs it; crossing `lowAt` logs `LOW`. The answer lists `sent` and `skipped` lines with the reason; if nothing could be sent it is a 409 that names the items. An unsent line whose item is sold out carries `unsendable: true` in the order payload. A void of a sent line marked "not made" gives its quantity back to the number, if the item still has one. Commit.

Then the e2e test **"Lamb chops, 2 left, then gone"**: the real case above, step by step, including the two sends fired together, the log rows, the changed-since answer after each step, a waiter and a cashier getting 403 on the write endpoints, and the reset list next morning.

## Not in it

No web change. No stock, no servings-left from ingredients, no alerts table (E10). No happy hour or timed prices (E13). No images. No change to how categories work. No change to E1's rules beyond the hook in part d. No new dependency. No edit to an existing migration.

## Done when

1. The read-back exists with the baseline.
2. `/api/menu/workspace` returns sections, groups, sub-groups, items with servings and choices, initials, availability, `popular`, `offers` and `version`; a second call with the version gives 304; size and time on 200 items are in the report.
3. An offer price is applied on the server when the line is added, and the normal price is kept on the line.
4. Sold out, available and set-a-number work with the rights in part c; a chef cannot change a bar item; every change has a log row with who and when.
5. `?since=` returns exactly the items changed after that moment.
6. Two sends racing for the last serving: exactly one line is sent, the other is skipped with the reason, the item is sold out, the number is never below zero. The test repeats this 20 times.
7. Skipped lines do not stop the rest of an order; nothing sendable gives a 409 naming the items.
8. Reset clears marks and numbers and the opening list shows what was cleared.
9. The seed diff shows the one new key for the five roles and no other grant.
10. "Lamb chops, 2 left, then gone" passes three runs in a row; E1's "Table 12's evening" still passes.
11. API typecheck 0, build 0, unit and e2e suites 0 failed, `eslint` clean on changed files, `pnpm check:event` green, the migration only adds.
12. `git diff --stat rebuild/main...HEAD` shows changes only in the allowed places, and `git log origin/e2/menu-and-availability -1` shows your last commit is on GitHub.

## Proof and report

`reports/E2_REPORT.md`: gate outputs, the three runs, the seed diff, the migration SQL, the workspace measurements. Grade every claim [live], [emulation], [code] or [asserted]. Name the way back. Finish in chat with 8 lines at most, opening with the verdict and ending `You need to: …`.

Then STOP.
