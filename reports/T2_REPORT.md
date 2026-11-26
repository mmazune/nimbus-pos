# T2 report: engines for the menu, tables and tickets

Track T2, branch `t2/engines`, cut from `rebuild/main` `0af95f8`, with `origin/e1/order-truth` merged at `c6983c4`. `OrderItem.sentAt` is present. Run on Opus 5.5. `moses-build-standards` was loaded and §0, §1.3 and §6 were read.

Database: a throwaway Postgres 16 in this container. The databases are `nimbus_event_t2`, `nimbus_event_t2full`, `nimbus_event_t2p2` and `nimbus_event_t2final`, all on `localhost`, with URLs set in the shell only. Neon was never touched. No `.env*` file was read. Test staff are made at load time with random passwords that are never printed.

Grades: **[live]** run here and seen; **[emulation]** a real state written by SQL with the real code run on it; **[code]** read, not run; **[asserted]** someone's word.

## Verdict

All three phases are built, and so are the E1 review fixes. Every Done-when line holds except the one exception below.

The four real cases pass three runs in a row, 54 of 54 tests each [live]. All 29 E1 review probes are green [live].

**Exception:** the full e2e suite is not 0 failed. Every red test in it is a failure named in T4's baseline (see Gates).

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
- **Mutation control:** removing the guard from Ready's update turns the double-Ready race red in 3 of 3 runs (`phase3_mutation_ready_guard.txt`) [live].

## Done when (T2)

1. Phase 1's twelve lines hold: see above [live].
2. "A busy Friday" and "Starters now, mains later" each pass three runs in a row, and so do "Table 12's evening", "Lamb chops", the E1F tests and the probes: **54 of 54, three times** (`all_real_cases_three_runs.txt`) [live].
3. **One additive migration per phase:** `20261126100000_t2_menu_availability`, `20261126200000_t2_areas_tabs`, `20261126300000_t2_tickets`. Each was applied to a database already holding orders and tables, with identical row counts before and after (`phase1/2/3_migration_rows.txt`) [live].
4. **Seed diff per phase.**
   - Phase 1: one key for 5 roles.
   - Phase 2: no grant (one data step that puts tables into areas).
   - Phase 3: none.
   - The E1F S7 data fix stamps `sentAt` on sent demo lines.
   - No other grant changed [live].
5. **Review findings** in my files are fixed with their probes passing (29 of 29), or answered (B5, S1, A1) [live].
6. **Gates:** API typecheck 0, build 0, unit **1,318 passed / 72 suites, 0 failed**, `pnpm check:event` green.
   - eslint has 0 errors on every new file and on every changed file that was clean at base.
   - Two files carry their own base errors:
     - `pos-handoff.service.ts` went from 858 at E1 to 888. The 30 new errors are only on my added lines, which follow that file's 4-space style, as E1 did.
     - `app.module.ts` has 1, which was already there and is untouched, to keep merges clean [live].
7. **`git diff --stat`.**
   - `c6983c4..HEAD` (T2's own commits): 74 files, all in `apps/api/src`, `apps/api/test` (new files, plus unit specs beside the code), `packages/db/prisma` and `reports`. None of T4's e2e tests or helpers was edited.
   - `origin/e1/order-truth...HEAD` also shows `apps/web`, `tools` and `docs`. Those come from the base `rebuild/main` (U0), not from T2's commits (`done_when_7_diff_stat.txt`) [live].
8. **Endpoint list for T3 and T1:** below.

## Gates (final HEAD)

| gate | result |
|---|---|
| API typecheck `tsc --noEmit` | 0 errors [live] |
| API build `nest build` | exit 0 [live] |
| Unit `jest` | 1,318 passed, 72 suites, 0 failed (base 1,309 / 71) [live] |
| `pnpm check:event` | green [live] |
| eslint on changed files (called directly, no `--fix` script) | 0 errors on new files and on files clean at base [live] |
| Four real cases + E1F + probes, three runs | 54 / 54, three times [live] |
| Full e2e, fresh migrated and seeded db, Jest's own order | **1,279 tests: 1,197 passed, 82 failed.** Every failure is in a group T4 named: F1 59, F2 11, F3 1, F4 1, C1 1, and C2 9 (tenancy 4, plus E1's Table 12 spec, which logs in as the reset demo cashier, 5). All T2 and E1F specs pass inside this run. Before T2 (T4 run A, same order rules): 92 failed (`full_e2e_final.txt`) [live] |

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
