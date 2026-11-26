# T2 report: engines for the menu, tables and tickets

Track T2, branch `t2/engines`, cut from `rebuild/main` `0af95f8`, with `origin/e1/order-truth` merged at `c6983c4`. `OrderItem.sentAt` is present. `moses-build-standards` was loaded and §0, §1.3 and §6 were read.

Database: a throwaway Postgres 16 in this container. The databases are `nimbus_event_t2`, `nimbus_event_t2full`, `nimbus_event_t2p2` and `nimbus_event_t2final`, all on `localhost`, with URLs set in the shell only. Neon was never touched. No `.env*` file was read. Test staff are made at load time with random passwords that are never printed.

Grades: **[live]** run here and seen; **[emulation]** a real state written by SQL with the real code run on it; **[code]** read, not run; **[asserted]** someone's word.

## Verdict

All three phases are built, and so are the E1 review fixes. Every Done-when line holds except the two exceptions below.

The four real cases, with the E1F tests and probes, pass three runs in a row at final HEAD `4f87277`: 57 of 57 tests each time (`all_real_cases_three_runs.txt`) [live]. The E1 review probes, refreshed to T4 `e26bb73`, are 30 of 30 green [live].

**eslint is now clean** on all 50 files T2 changed, with 0 errors (`eslint_changed_files_final.txt`). `pos-handoff.service.ts`, `orders.controller.ts`, `inventory.controller.ts` and `app.module.ts` were formatted whole with Prettier (layout only; with whitespace ignored the `pos-handoff` diff is line wrapping). Unit tests, build and the `pos-handoff` e2e suite are unchanged.

**By name, no new red:** subtracting T4's named red list from this branch's 72 failing names leaves only quick-sale C10. That is T4's cause C1, which is green on T4's tree only because of T4's sequencer (`e2e_by_name_vs_t4.txt`) [live].

**Where the whole-suite clause comes from.** T2's Done-when 6 reads "API typecheck 0, build 0, unit tests 0 failed, `eslint` clean on changed files, `pnpm check:event` green", with no e2e clause. LONG-RUN rule 12's gate is "your own e2e green", and it holds. The whole-suite clause appears only in E2's line 11 ("unit and e2e suites 0 failed"), which Done-when 1 pulls in.

**One exception, proven unreachable inside the rules (LONG-RUN rule 2):** the full e2e suite is not 0 failed. On the last fresh run (after the F3 fix below) **72 of 1,282 fail**: F1 59, F2 11, F4 1, C1 1. C2 (9 more) bites only when Jest happens to run `bg1-onboarding` earlier; before F3 the run was 82 of 1,279 (`full_e2e_final.txt`). Each remaining group needs something rule 14, 17, 20 or Done-when 4 forbids T2 to do; see "Why the full e2e suite cannot be 0 failed here". On T4's own tree, with T4's sequencer, it is 83 red (`reports/proof/T4/e2e_t4_run3.txt` on `t4/review-and-data`).

## Phase 1: the menu in one call, offers, sold out and a number left (E2)

E2's Done-when lines 1 to 12:

1. **Read-back** with baseline: `reports/E2_READ_BACK.md` [live].
2. **`GET /api/menu/workspace`** returns sections, groups, sub-groups and items, each item with servings, choices, initials and availability, plus `popular`, `offers` and `version`.
   - With `If-None-Match: <version>` it answers 304. A changed availability gives 200 and a new version [live].
   - On a 239-item menu (the 200-item test menu plus the seed): **188,534 bytes in 34 ms**. An earlier run gave 185,682 bytes and 36 ms (`WORKSPACE_MEASURE` in the test output) [live].
3. **Offer price.** The server applies the offer price when the line is added: 22,000 instead of 28,000, with `normalPrice` 28,000 kept on the line.
   - The offer price stays on later quantity changes, even after the offer ends.
   - A new line added after the offer ends costs 28,000 [live].
4. **Sold out, back on, set a number.**
   - Allowed for Owner, Manager, Supervisor, Chef and Bartender.
   - Waiter and cashier get 403 on all four write routes.
   - A chef setting a bar item gets 403 `NOT_YOUR_STATION`.
   - Every change writes a `menu_availability_logs` row recording who and when [live].
5. **`?since=`** returns exactly the items changed after that moment.
   - It answers with a server `cursor`; polling again with that cursor gives `[]` [live].
6. **Two sends racing for the last serving, 20 rounds.** Each round exactly one line is sent and the other is skipped `SOLD_OUT`. The item ends sold out with `left = 0` and never goes below zero [live].
   - Mutation control: with both guards removed, the round sends twice (red). With only the `left >= qty` guard removed it stays green, because the state guard alone holds (`reports/proof/T2/phase1_mutation_guard_removed.txt`) [live].
7. **Skipped lines don't stop the rest of an order.** The loser's cola or soup still goes out.
   - A send with nothing sendable is a 409 that names "Lamb chops".
   - The order payload flags the unsent line `unsendable: true` [live].
8. **Reset** (Owner, Manager; a supervisor gets 403) clears marks and numbers. `GET /api/menu/availability/yesterday` lists what was cleared [live].
9. **Seed diff:** one new key, `pos:menu:availability:write`, granted to 5 roles. After two seed runs it is held by exactly Bartender, Chef, Manager, Owner and Supervisor (`reports/proof/T2/phase1_seed_diff.txt`) [live].
10. **"Lamb chops, 2 left, then gone"** and E1's **"Table 12's evening"** pass three runs in a row (`reports/proof/T2/phase1_three_runs.txt`; again at the end in `all_real_cases_three_runs.txt`) [live].
11. **Gates:** typecheck 0, build 0, unit 0 failed, `check:event` green, eslint 0 errors on new files. The migration only adds, and row counts are unchanged (`phase1_migration_rows.txt`). The e2e suite is as in Gates below [live].
12. **Changes stay in allowed places** (Done-when 7 below). The branch is on GitHub [live].

## E1 review fixes (R-E1, `docs/reviews/e1-order-truth.md` on `origin/t4/review-and-data`)

The reviewer's probes were copied unchanged into `apps/api/test/e1f-review-probes.e2e-spec.ts` and `e1f-review-writers.e2e-spec.ts`; T4's own files are untouched.

- **Before:** 16 of 27 green.
- **After:** 29 of 29, including the second push's N2 and S6 (`reports/proof/T2/e1f_probes_before_after.txt`) [live].
- **Last check:** against T4 `e26bb73`, which adds P22b (a waiter editing their own sent line). It is green through the B1 fix: **30 of 30**. A1 is left out of my copy and answered below [live].
- **Commits:** `fix(e1f): close the R-E1 blockers…` and `fix(e1f): N2 … S6 …`. There are two because the review was pushed again after my first fix commit, and I never force-push.

| id | done | proof |
|---|---|---|
| B1 | a sent line is changed only by a void (409 `ITEM_ALREADY_SENT`) | P22 [live] |
| B2 | adding a line runs under the order lock, in one transaction | P5 [live] |
| B3 | manual reference: check, balance and insert in one locked transaction | P6 [live] |
| B4 | whole-order void is locked, guarded, and refused when a payment exists | P7 [live] |
| B5 | **answered, not fixed.** The unique index is in E1's applied migration, which I may not edit. Before any deploy with history, run `SELECT order_item_id FROM kds_ticket_items GROUP BY 1 HAVING count(*) > 1`; if any rows come back, set the later duplicates aside first (re-point them and mark them, never delete) | [code] |
| S1 | **answered, not fixed** (E1's migration). The correct backfill: `sent_at` = the ticket item's `created_at` where one exists; otherwise only for a line whose station is `NONE` on an order that is not `VOIDED` | [code] |
| S2 | one locked free-the-table helper inside the close door; lock order is order → reservation → table | P8, W2 [live] |
| S3 | ruling R-a, default taken: a SERVED order left at zero may be voided | P20 [live] |
| S4 | ruling R-b, default taken: a manual reference is never above the balance (400) | P15 [live] |
| S5 | `@Max` on money: a 400, never a 500 | P25 [live] |
| S6 | `IsMoney`: money arrives as a decimal string. A JSON number is still accepted and turned into its exact string, so no client breaks | S6 [live] |
| S7 | the seed stamps `sentAt` on sent demo lines. This is a data fix, not a grant | `e1f_seed_sent_lines.txt` [live] |
| S8 | ruling R-c, default taken: a void completes the seated reservation (`source: order-void`) | P11 [live] |
| S9 | ruling R-d, default taken: auto-settle never closes an order with unsent lines; it closes once they are sent or removed | `e1f-fixes` [emulation] |
| S10 | the table is occupied inside the send | `e1f-fixes` [live]; the race window [code] |
| S11 | no line void while a mobile-money intent is pending (409 `PAYMENT_PENDING`) | `e1f-fixes` [live] |
| N1 | every seated reservation on the order completes | P24 [live] |
| N2 | change comes out of the cash rows from the last one backwards | N2 [live] |
| N3 | order locks are scoped to the branch | [code] |
| ruling 4 | the line void also answers under `/api/pos/orders/:id/items/:itemId/void`; the first path stays | `e1f-fixes` [live] |
| A1 | **answered, not fixed.** T4's rights probe: waiters and cashiers can list every payslip. The fix is a seed revoke or an own-payslip route; Done-when 4 limits my seed diff to my named grants. This belongs to the rights milestone (E9) | — |

## Phase 2: areas, tabs and moving people around (E3)

- **Areas** (`Area`, `Table.areaId`).
  - The migration put existing tables into areas named after their floor plan (the zone marker today), or into a branch "Tables" area.
  - On the main test database every row was kept and 0 tables were left without an area (`phase2_migration_rows.txt`) [live].
  - New tables and seeded tables also get an area: the create-table route and an idempotent seed step [live].
- **Bulk add.** One transaction under a branch lock. A taken number refuses the whole batch with 409 `TABLE_NUMBERS_TAKEN`. **Put away**, never delete: refused while an order is open. **Change seats** [live].
- **Tabs.** The lowest free number in the branch and an optional note. A tab behaves as a table. It is put away when paid, and its number is free again (Tab 1 was paid, the next tab was Tab 1) [live].
- **Moves.**
  - Move a table's order to a free table; the booking moves with it.
  - Join two tables into one bill, then split them again.
  - Move one line, or part of a line, to another table, opening a bill there if the table is free.
  - Split by guest: the new gap filled. Evenly and by amount use the existing `split-bill`. By item uses the existing `split-items`, which now refuses voided lines [live].
- **People.**
  - Change waiter: Supervisor, Manager or Owner by job role, with `pos:order:transfer`.
  - Hand-over: offer one table, several or all to a named colleague, who accepts or declines; the offerer can cancel.
  - A waiter's shift close is refused (409 `OPEN_TABLES`) while they still hold open tables [live].
- **Rights.** Areas and tables use the existing `pos:table:write`, which only Owner, Manager and Supervisor hold. Tabs and hand-overs use `pos:orders:write`. **No new grant.** Every action writes an audit row in its own transaction [live].
- **"A busy Friday"** runs in its own branch each time, so table numbers 1 to 68 and tabs 1 to 30 are real every run.
  - 60 tables in 4 areas plus a tabs area.
  - 8 more tables added mid-service, with a clash refused first.
  - 30 tabs opened by three waiters at once, numbers 1 to 30 each used once.
  - Table 5 to 14, with a move onto a taken table refused.
  - Tables 7 and 8 joined, then split back to the exact totals.
  - The chips moved from table 3 to table 20.
  - Asha's shift close refused, six tables handed to Chloe, then the close accepted.
  - Audit counts checked.
- **Race tests:** two parties moved onto one free table at once (5 rounds) and two clashing bulk adds. Mutation control: removing the table locks from `moveTable` turns it red (`phase2_mutation_move_lock.txt`) [live].
- **A booked table joined, then paid** completes its booking. This guards finding S8 through the join [live].

## Phase 3: kitchen and bar tickets that close the loop (E5)

- **One ticket per send per station** (from E1).
  - Stations are listed per branch with their late times. `GET /api/kds/stations` reads the existing `KdsSlaConfig`; no new model.
  - The kitchen queue can now be filtered by `orderId` [live].
- **Ready, recall and Collected.**
  - Ready and recall ("bring back from done") are guarded: a second tap is a 409.
  - The waiter's list is `GET /api/kds/ready?scope=mine|all`, with Collected. Times are kept for sent, ready and collected.
  - The table and waiter come from the line's **current** order, so Ready reaches the new waiter after a change of waiter [live].
- **Hold and fire.**
  - Send skips held lines.
  - Fire goes out **after a 3-second undo window on the server clock**. It is released by a timer, and by every read of the kitchen queue, the Ready list and the floor, so a restart loses nothing.
  - So the kitchen never sees a ticket that is taken back, and E1's one-ticket-per-line index holds.
  - An undo after the window is 409. A second fire is 409 [live].
  - The release on read without a timer is proven by writing a past `fireAt` directly. The kitchen queue, then the floor state, send the line out with exactly one ticket item [emulation].
- **Allergy and takeaway on a line**, carried to the ticket.
  - The allergy is also kept on the order, so later rounds on the table show it, including after a join.
  - Allergy, takeaway and hold are copied by the void split, both `pos-handoff` copies and the line move [live].
- **Table state for the Floor:** `GET /api/floor/state`, derived and never written.
  - States, strongest first: `LATE`, then `READY`, `NOT_SENT`, `SENT`, `OPEN`, `JOINED`, `FREE`.
  - A line whose station is `NONE` makes no ticket, so it can never hold a table at late.
  - `TICKET_LATE` and `READY_WAITING` are states here, not alert rows [live].
- **Rights.** Tickets are worked by Chef and Bartender for their own stations, and by Supervisor, Manager and Owner.
  - All of them already held `pos:kds:write`, so **no grant was needed**. Waiter and Cashier hold it too and are now refused by the station check (403).
  - The Ready list and Collected use `pos:orders:read` and `pos:orders:write` [live].
- **"Starters now, mains later"**, step by step:
  - starters sent and mains held, so the kitchen sees only starters;
  - Ready reaches the waiter's list (double Ready gives one 201 and one 409), then Collected (double tap 409);
  - mains fired, undone inside 3 seconds (nothing reaches the kitchen), fired again and out after 3 seconds;
  - "nuts" on both kitchen tickets, takeaway on the tilapia;
  - a second round of lagers makes a second bar ticket;
  - the mains bumped by mistake are brought back, then after a change of waiter Ready reaches the new waiter.
  - Further tests: a late table, a not-sent table, a double fire, undo against the fire going out at the 3-second line, and the allergy across a join [live].
- **Bartender availability** (phase 1 rights): a bartender sets a number and marks sold out on a bar item, and gets 403 on a kitchen item [live].
- The Starters spec ends with 6 tests; its three final runs are 6 of 6 each (`phase3_starters_three_runs_final.txt`) [live].
- **Mutation control:** removing the guard from Ready's update turns the double-Ready race red in 3 of 3 runs (`phase3_mutation_ready_guard.txt`) [live].

## Done when (T2)

1. Phase 1's twelve lines hold: see above [live].
2. "A busy Friday" and "Starters now, mains later" each pass three runs in a row, and so do "Table 12's evening", "Lamb chops", the E1F tests and the probes: **57 of 57, three times at `4f87277`** (`all_real_cases_three_runs.txt`) [live].
3. **One additive migration per phase:** `20261126100000_t2_menu_availability`, `20261126200000_t2_areas_tabs`, `20261126300000_t2_tickets`. Each was applied to a database already holding orders and tables, with identical row counts before and after (`phase1/2/3_migration_rows.txt`) [live].
4. **Seed diff per phase.**
   - Phase 1: one key for 5 roles.
   - Phase 2: no grant (one data step that puts tables into areas).
   - Phase 3: none.
   - The E1F S7 data fix stamps `sentAt` on sent demo lines.
   - No other grant changed. The whole diff is in `seed_diff_all_phases.txt`: 6 permission lines, all of them the one key and its five grants [live].
5. **Review findings** in my files are fixed with their probes passing (30 of 30 against T4 `e26bb73`), or answered (B5, S1, A1) [live].
6. **Gates:** API typecheck 0, build 0, unit **1,318 passed / 72 suites, 0 failed**, `pnpm check:event` green.
   - eslint: **0 errors on all 50 files T2 changed** (`eslint_changed_files_final.txt`) [live].
7. **`git diff --stat`.**
   - `c6983c4..HEAD` (T2's own commits): 80 files, all in `apps/api/src`, `apps/api/test` (new files, plus unit specs beside the code), `packages/db/prisma` and `reports`. None of T4's e2e tests or helpers was edited.
   - `origin/e1/order-truth...HEAD` also shows `apps/web`, `tools` and `docs`. Those come from the base `rebuild/main` (U0), not from T2's commits (`done_when_7_diff_stat.txt`) [live].
8. **Endpoint list for T3 and T1:** below.

## Gates (final HEAD)

| gate | result |
|---|---|
| API typecheck `tsc --noEmit` | 0 errors [live] |
| API build `nest build` | exit 0 [live] |
| Unit `jest` | 1,318 passed, 72 suites, 0 failed (base 1,309 / 71) [live] |
| `pnpm check:event` | green [live] |
| eslint on changed files (called directly, no `--fix` script) | 0 errors across all 50 changed files [live] |
| Four real cases + E1F + probes, three runs | 57 / 57, three times at `4f87277` [live] |
| Full e2e, fresh migrated and seeded db, Jest's own order | **1,282 tests: 1,210 passed, 72 failed**, all in T4's named groups F1 (59), F2 (11), F4 (1) and C1 (1). F3 is fixed by T2. All T2 and E1F specs pass inside the run. T4 run A before T2: 92 failed; T4's own tree with its sequencer: 83 (`full_e2e_final.txt`) [live] |

## Why the full e2e suite cannot be 0 failed here

| group (tests) | cause (T4 `docs/reviews/e2e-baseline.md`) | what would fix it | why T2 may not |
|---|---|---|---|
| F1: billing 17, franchise 13, franchise-analytics 12, bg7-hms-integration 17 | guard keys with no permission row, or no grant | add 22+ permission rows and grants to the seed | CLAUDE.md §12 forbids it outright: "Do not seed the 37 `franchise:*` / `ops:*` / `dev:*` / `merchant:*` / `billing:*` / `onboarding:*` / `support:*` strings (C-22) — those modules are deferred". Done-when 4 also limits the seed diff to the grants this prompt names, and T4 says "the seed change itself is a separate, authorised step" |
| F2: attendance 11 | the spec acts for other employees; the service allows self-service only (a deliberate rule) | edit the spec, or build a manager-on-behalf path | the spec is an existing test helper/spec that T4 is repairing (prompt: "do not edit theirs"); a new path is a feature outside T2's phases |
| F3: control-plane 1 | two training answers disagree | **fixed here**: the BG3 simulator answer now also carries M42's `inTraining`, `simulated`, `sessionId` (additive; `bg3-reliability` still green) | — [live] |
| F4: orders 1 | the spec pays a fixed 9,999 on a dearer seeded item | edit the spec | existing spec (T4's to repair) |
| C1: quick-sale.review C10 1 | depends on `quick-sale.e2e` running first | the e2e sequencer | the e2e configuration is T4's (prompt: never touch it) |
| C2: tenancy 4, order-truth 5 | `bg1-onboarding` resets `cashier@demo.local`'s password, so later cashier logins get 401 | the sequencer, or that spec resetting a user it made | T4's configuration and an existing spec. T2's own specs avoid it: they make their own cashier |

## Endpoints for T3 and T1

All answers are JSON. Money is a decimal string. Every route needs `Authorization` and `X-Branch-Id`.

**New**
- `GET /api/menu/workspace` (`pos:menu:read`). Answer: `{version, branchId, sections:[{section, popular[], popularFrom, offers[], groups:[{id,name,sortOrder,itemIds[],subgroups:[{id,name,sortOrder,itemIds[]}]}], ungroupedItemIds[]}], items:[{id,name,description,initials,section,groupId,subgroupId,itemType,station,price,offer:{price,note}|null,tax,servings[],choiceGroups:[{id,name,min,max,required,options[{id,name,priceDelta}]}],availability:{state AVAILABLE|LOW|SOLD_OUT,left,lowAt,source,since,byUserId}}]}`. The `ETag` header is the version; `If-None-Match` gives 304.
- `GET /api/menu/availability?since=<iso>` (`pos:menu:read`): `{cursor, items:[{menuItemId, availability}]}`. Poll with the cursor as `since`.
- `GET /api/menu/availability/unavailable` and `GET /api/menu/availability/yesterday` (`pos:menu:read`).
- `POST /api/menu/items/:id/sold-out`, `POST /api/menu/items/:id/available`, `PUT /api/menu/items/:id/left {left, lowAt?}` (`pos:menu:availability:write`, own station for chef and bartender): `{menuItemId, name, availability}`.
- `POST /api/menu/availability/reset` (Owner, Manager): `{batchId, cleared:[{menuItemId,name,station,wasState,wasLeft}]}`.
- `GET /api/areas?includePutAway=true|false` (`pos:table:read`): `{areas:[{id,name,kind TABLES|TABS,sortOrder,isActive,tables:[{id,label,capacity,status,isActive,isTab,tabNumber,tabNote,joinedToTableId,putAwayAt}]}]}`.
- `POST /api/areas {name, kind?, sortOrder?}`, `PATCH /api/areas/:id {name?, sortOrder?}`, `POST /api/areas/:id/put-away` (`pos:table:write`).
- `POST /api/areas/:id/tables {count, firstNumber, seats}` (`pos:table:write`): 201 `{area, tables[]}`; 409 `TABLE_NUMBERS_TAKEN {numbers}`.
- `POST /api/tables/:id/put-away` and `PATCH /api/tables/:id/seats {seats}` (`pos:table:write`).
- `POST /api/areas/:id/tabs {note?}` (`pos:orders:write`): 201, the tab row (`label "Tab n"`, `tabNumber`). `POST /api/tabs/:id/put-away` (`pos:orders:write`, only when nothing is open on the tab).
- `POST /api/tables/:id/move {toTableId}` (`pos:order:transfer`); 409 if the target is not free.
- `POST /api/tables/:id/join {tableId}` and `POST /api/tables/:id/split {tableId}` (`pos:order:merge`).
- `POST /api/pos/orders/:id/lines/:itemId/move {toTableId, quantity?}` (`pos:order:move-items`): `{fromOrderId, toOrderId, toTable, lineId, quantity, sourceVoided}`.
- `POST /api/pos/orders/:id/split-by-guest` (`pos:order:split`). Lines need a `guest`. Answer: `{orderId, guest, total, children:[{guest, orderId, total}]}`.
- `POST /api/tables/:id/change-waiter {toUserId}` (`pos:order:transfer`, plus Supervisor, Manager or Owner).
- `POST /api/handovers {toUserId, tableIds? | all: true, note?}` (`pos:orders:write`), then `GET /api/handovers` (`{incoming[], outgoing[]}` with table labels and names), and `POST /api/handovers/:id/accept|decline|cancel`.
- `POST /api/pos/orders/:id/lines/:itemId/hold {held}`, `POST /api/pos/orders/:id/fire {itemIds?}` (answer `{fireId, fireAt, undoUntil, itemIds}`), and `POST /api/pos/orders/:id/fire/:fireId/undo`: 200 before `undoUntil`, 409 `FIRE_TOO_LATE` after. All `pos:orders:write`.
- `GET /api/kds/stations` (`pos:kds:read`): `{stations:[{station, greenSeconds, amberSeconds, redSeconds, configured}]}`. Settings are changed with the existing `PATCH /api/kds/sla-config/:station`.
- `GET /api/kds/ready?scope=mine|all` (`pos:orders:read`): `{scope, tickets:[{id,station,orderId,tableId,tableLabel,waiterUserId,waiter,readyAt,items[{name,quantity,allergy,takeaway}]}]}`.
- `POST /api/kds/tickets/:id/collected` (`pos:orders:write`).
- `GET /api/floor/state` (`pos:table:read`): `{at, tables:[{tableId,label,areaId,isTab,joinedToTableId,state,orderIds[],waiterUserIds[],counts{notSent,held,ready,late,tickets}}]}`.

**Changed behaviour on existing routes** (T3 builds against these)
- `POST /api/pos/orders/:id/send` now also answers `sent[]`, `skipped[{orderItemId, menuItemId, name, quantity, reason SOLD_OUT|NOT_ENOUGH_LEFT, left, message}]` and `held[]`.
  - It skips held lines and sold-out lines.
  - It is a 409 `NOTHING_SENDABLE` or `NOTHING_TO_SEND` when nothing can go.
- `POST /api/pos/orders/:id/items` takes `guest?`, `hold?`, `allergy?` and `takeaway?`. It refuses a sold-out item (409 `ITEM_SOLD_OUT`) and prices an offer itself; the line carries `normalPrice`.
- `PATCH /api/pos/orders/:id/items/:itemId` on a **sent** line is a 409 `ITEM_ALREADY_SENT`.
- `GET /api/pos/orders/:id`: unsent lines whose item is sold out carry `unsendable: true`.
- Money on `close`, `manual-reference` and `payment-intent` is a decimal string (a number is still accepted). A manual reference above the balance is a 400.
- `POST /api/pos/orders/:id/void` completes the seated reservation and frees the table. It is refused when a payment exists. A SERVED order left at zero can be voided.
- A waiter's `POST /api/shifts/:id/close` is a 409 `OPEN_TABLES` while they hold open tables.
- `POST /api/kds/tickets/:id/mark-ready` and `/recall` are refused (403) for anyone but the station's chef or bartender, a supervisor, a manager or the owner.
- The `GET /api/kds/queue` items carry `allergy`, `takeaway` and `guest`; the ticket carries `allergies`, `waiterUserId` and `collectedAt`. `table` is the line's current table.
- `POST /api/pos/orders/:id/items/:itemId/void` exists beside `/api/orders/…`.
- `POST /api/inventory/adjustments` with `x-training-session-id` (the training simulator) now also answers `inTraining: true`, `simulated: true` and `sessionId`, beside the existing `id` and `status: SIMULATED` (fixes T4 F3).

## Left out, and which milestone brings it

- **Paying one share of an even or by-amount split.** The close route wants the whole balance, so `split-bill` records the shares only. U3.
- **Locks in the old routes.** `transfer-table`, `merge`, `split-items` and `move-items` (`pos-handoff`) still take no locks and don't touch table state. The new seating routes are the locked way, and the old ones are left as they are (changes least). Their voided-line gap is fixed. Later pass, or U3.
- **E1's migration (B5 and S1).** The SQL is given above, to run before a deploy with history.
- **A1 and T4's section 9 asks:** PIN by token, `/api/ops/*` behind the platform guard, own payslips, store and station on the membership. Outside T2's prompt. E9.
- **A whole-order void doesn't give counts back** (only a "not made" line void does). Not asked.
- **Remake.** Not in this phase. E6.
- **Real alert rows for `TICKET_LATE` and `READY_WAITING`.** E10.
- **Changed-since gap.** A change written inside a transaction that commits after a poll has read can be missed by that poll; the window is milliseconds and was not seen [asserted].

## Decisions taken

- R-a to R-d: the reviewer's defaults (see the table above).
- Q1 to Q5 from the read-back: a sold-out item cannot be added; an offer replaces the item price, not a serving price; `popular` is topped up in menu order; chef stations are kitchen, cold kitchen and dessert; a line wanting more than is left is skipped whole.
- Tabs are numbered per branch with the lowest free number. A put-away tab's label gets its id tail, so the number can be used again.
- **Fire is deferred:** it goes out after the undo window. This was chosen over "make the ticket, then withdraw it" so the kitchen never sees a withdrawn ticket.
- The shift-close guard is for waiters only (rule 07 "People").
- **Attendance (T4 F2, "ruling for T2"):** self-service stands, and the spec is stale (T4's first option). A manager clocking or requesting leave for someone else would weaken a guard that feeds payroll, which the error protocol forbids to make a test pass. CLAUDE.md already records the manager-on-behalf path as a known gap left unbuilt (B3-F3).
- My e2e specs make their own staff and their own Friday branch, so they don't depend on the order of test files (T4 C2).

## For the other tracks

- **T1 (Floor):**
  - Read `GET /api/areas` plus `GET /api/floor/state`.
  - "New tab" is `POST /api/areas/:tabsAreaId/tabs`.
  - A paid tab disappears on its own.
  - Joined tables show `JOINED`.
- **T3 (order screen):**
  - Use `GET /api/menu/workspace` with `If-None-Match`, and poll `GET /api/menu/availability?since=`.
  - Show `skipped[]` from Send.
  - Grey out `availability.state = SOLD_OUT` and show "N left" when `LOW`.
  - Hold, fire and undo are on the routes above. Undo stays possible until `undoUntil`.
- **T4:**
  - The demo-venue loader must give each table an `areaId` (or call the create-table route), or the Floor won't list it. The seed sweeps up tables without an area.
  - `bg1-onboarding` still resets the demo cashier's password (C2).

## Way back

All three migrations only add, so reverting the branch is enough: the new columns are nullable or defaulted, and the new tables are unread by older code. The only data writes are `tables.area_id` (backfill) and the seed's `order_items.sent_at` stamp on demo orders.
