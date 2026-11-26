# T4 report: review E1, repair the test run, the demo venue, people and access

Track T4, branch `t4/review-and-data` (cut from `origin/e1/order-truth` `19e1eee`), 26 Nov 2026.
`moses-build-standards` was loaded first (§0, §1.3 review format, §8). An advisor model was consulted
at the start of phase 1, at the phase 2/3 boundary and on the money and rights work.
Database: the container's own Postgres 16, throwaway `nimbus_event_*` databases made by
`tools/test-env.sh`, `localhost` only. Neon never touched; no `.env*` read (none exists here).
Grades: **[live]** run here and seen · **[emulation]** a real state written by SQL, the real code run
on it · **[code]** read, not run · **[asserted]** someone's word.

## Phase 1 — Review E1

**Verdict: blockers** (first line of `docs/reviews/e1-order-truth.md`). Pushed in the first hour
(`964500b`), added to three times since.

| Done-when 1 | proof |
|---|---|
| Review pushed with a verdict | `docs/reviews/e1-order-truth.md`, line 1 [live: `git log origin/t4/review-and-data`] |
| Findings with file and line | 5 blockers, 11 should-fix, 3 notes, each with file:line and the smallest fix |
| A probe for each | `apps/api/test/e1-review.probes.e2e-spec.ts` (P1–P25, P22b, N2, A1), `e1-review.writers.e2e-spec.ts` (W1, W2, S6): 31 tests, 15 red, each a fault (`re1_probes_run.txt`); `tools/probes/e1-migration-on-live-data.sh`, `tools/probes/base-double-send.e2e-spec.ts.txt`; 4 findings without a probe are named with the reason (S9, S10, S11, N3) |
| The five rulings answered | review section "The five rulings asked for" (by-name e2e comparison; the late read-back; the two `pos-handoff` lines; one route prefix; the three events) |

The blockers, all **[live]**:
- **B1** a sent line's quantity can be lowered through the plain item edit (`pos:orders:write`, which waiters hold): 2 → 1, bill 12,000 → 6,000, no void record; shown as Owner and as a waiter on their own order with an open shift (P22b).
- **B2** a line added while a payment closes lands on the closed, paid order (total 32,000, paid 25,000).
- **B3** a manual-reference payment racing a cash close is posted on the closed order (80,000 paid on 40,000).
- **B4** a whole-order void racing a cash close voids a paid order (18,000 of payments on a VOIDED order).
- **B5** E1's migration aborts on any line already on two tickets; pre-E1 code left one on **27 of 30** doubled sends.

Races were forced deterministically (a probe holds the linked reservation's row lock, parking the payment inside the close door), not left to timing. E1's own claims were re-run and hold: typecheck 0, build 0, unit 1,309 / 71, Table 12 three runs 5/5, eslint counts as reported, `check:event` green [live].

## Phase 2 — Repair the test run

| Done-when | proof |
|---|---|
| 2. `tools/test-env.sh` works from a fresh container and refuses a non-local address | `reports/proof/T4/test_env_sh.txt`: Postgres stopped first, the script starts it, makes an empty `nimbus_event_*` database with a random-password role and prints two exports; refuses a Neon host, `10.0.0.5` and `db.example.invalid`; accepts `::1` [live] |
| 3. Suite green, or every red named | `docs/reviews/e2e-baseline.md` names every red test by name with cause, file:line and a probe [live] |

- Base (`origin/rebuild/main`) **92 red**, E1 **92 red**: the same 92 names [live].
- Two order causes were found and fixed in config only (`apps/api/test/support/e2e-sequencer.js`, named in `test/jest-e2e.json`): **C1** `quick-sale.review` C10 needs `quick-sale.e2e`'s night first; **C2** `bg1-onboarding` resets the shared cashier's password, breaking `quick-pin` (15) and `tenancy` (4). 20 tests turned green, nothing else changed [live].
- Remaining pre-existing red: **72**, all real faults: **F1** 59 tests behind guard keys the seed never grants (billing, franchise, franchise-analytics, bg7 HMS); **F2** 11 attendance tests act for other employees against a deliberate self-only rule; **F3** 1 control-plane test, two training short-circuits disagree on the reply; **F4** 1 orders test pays a fixed 9,999 on a dearer seeded item.
- The owner's "166 of 166" is the three quick-sale specs: 166 tests, green here when ordered [live].
- Final run on HEAD: **87 red = 72 + 15 T4 probes** (1,267 tests, 6 venue-smoke tests skipped without a loaded venue), the same names as runs 2 and 3 plus the four probes added later (`reports/proof/T4/e2e_final_vs_run2.txt`) [live].

## Phase 3 — The demo venue

| Done-when 4 | proof |
|---|---|
| Loads into an empty throwaway database in one command | `eval "$(tools/test-env.sh)"; packages/db/demo-venue/run.sh` — three fresh runs, exit 0 in 25–27 s each (`reports/proof/T4/demo_venue_three_runs.txt`) [live]. It refuses: nothing in the shell, a remote host, a non-throwaway local database, a remote `DIRECT_DATABASE_URL` (the guard runs before Prisma loads), an env file where the Prisma CLI looks, and a second load; after migrating it confirms the E1 migration row in the guarded database itself (`demo_venue_refusals.txt`) [live] |
| Validator green | green on the data, **red on five planted faults** (broken reference, duplicate name, non-whole price, phone outside the block, brand word), exit 1 then 0 (`demo_venue_validator.txt`) [live] |
| Counts met, shown by queries | `demo_venue_counts.txt` (`packages/db/demo-venue/check.sql`) [live]: see table |
| No credential in any file | PINs and passwords random at load, shown once on stderr, written nowhere. Scans of the working tree for every loaded secret, on several loads: **0 passwords anywhere**; PINs: a few 6-digit chance matches with digit runs in vendored, build or lock files (the repository's own files hold 5,621 distinct 6-digit runs, so about 9 % of loads show one by chance); a diagnostic reload found 0 (`demo_venue_secret_scan.txt`) [live] |

| Asked | Loaded [live, query] |
|---|---|
| ≥ 2 people per role (owner, manager, supervisor, cashier, waiter, bartender, chef, store keeper, accountant) | 2, 2, 2, 2, **4**, 2, **3**, 2, 2 (21); phones `+256 700 000 101`–`121` |
| 64 tables: Main hall 32, Terrace 16, Bar 10, VIP 6 | 32, 16, 10, 6, one floor plan per area (the Floor groups by floor plan name) |
| ≥ 220 items, Food and Drinks with groups and sub-groups | **242** (Food 132, Drinks 110), 13 groups, 36 sub-groups; 36 spirits by tot, double and bottle; 16 wines by glass and bottle; beer, draught, cider, sodas, juices, water; 0 non-whole prices |
| ≥ 30 items with choices | **83** (how cooked, side, sauce, extras, leave out, spice, milk, mixer…) |
| ≥ 120 stock items, ≥ 40 recipes with believable costs | **149** stock items in kg, l, pc, ml; **57** recipes, 229 lines, cost 9–45 % of price, costed exactly as the API costs a sold line |
| ~17 open tables over three waiters in every Floor state | **17** over 3 waiters: not sent, sent, sent with new lines, in kitchen, ready, served, bill asked (2) |
| 9 bookings today incl. one late and one whose table is in use | **9**: 2 seated, 1 completed, 1 late (35 min ago, not seated), 1 on M04 which has an open bill, 1 confirmed later, 1 pending, 1 cancelled, 1 no-show |
| Till open with sales, a few paid bills | TILL-1 open, float 200,000, expected cash 402,000; **4** paid bills (cash with change, card, mobile money, card + cash) |

Every bad-state check from the review returns 0 for the venue [live]. The API smoke (`apps/api/test/demo-venue.smoke.e2e-spec.ts`) passed **6/6 on each of three fresh loads** [live]: every PIN role signs in by PIN and owner/accountant by password; a loaded waiter's send tickets exactly the unsent lines; the API's own till sum (`GET /api/tills/:id/summary`) equals the loaded expected cash; cash on a bill-asked table gives change, frees the table and completes the booking; new order and booking numbers continue from the loaded ones. The loader writes the till's `OPENING_FLOAT` cash movement and one reservation event per booking step, as the API does.

### Validator output (red on planted faults, then green)

```
## planted faults (copy of the data with five faults)
demo-venue validator: <scratch>/venue_bad
  people             21
  tables             64
  areas              4
  menuItems          245
  itemsWithChoices   83
  servings           157
  stockItems         149
  recipes            57
  openTables         17
  bookingsToday      9
  paidBills          4
  recipe cost as % of price: lowest 8.3, median 20.8, highest 45.2
RED: 5 error(s)
  - person owner1: phone +256 772 123 456 is outside +256 700 000 xxx
  - duplicate menu item: "Cola"
  - item Lemon squash price: 4999.5 is not a whole UGX amount ≥ 500
  - item: "Coca cola zero" contains brand word "coca"
  - recipe Beef burger: unknown stock sku MEAT-DOES-NOT-EXIST
validator exit code: 1

## the real data
demo-venue validator: packages/db/demo-venue/data
  people             21
  tables             64
  areas              4
  menuItems          242
  itemsWithChoices   83
  servings           157
  stockItems         149
  recipes            57
  openTables         17
  bookingsToday      9
  paidBills          4
  recipe cost as % of price: lowest 9.3, median 20.8, highest 45.2
GREEN: 0 errors
validator exit code: 0
```

### The three loads

```
secret scan (run 1): passwords found in any file under the working tree: 0; PINs found in tracked or untracked repository files: 1
run 1: run.sh exit 0 in 27 s; GREEN: 0 errors; holds the E1 migration; loaded tables=64 people=21 menuItems=242 stockItems=149 recipes=57 paidBills=4 openTables=17 bookingsToday=9 ; venue bad-state counts: 0 0 0 0 0 0 0 2 (the last is the 2 expected); smoke: Tests:       6 passed, 6 total
run 2: run.sh exit 0 in 25 s; GREEN: 0 errors; holds the E1 migration; loaded tables=64 people=21 menuItems=242 stockItems=149 recipes=57 paidBills=4 openTables=17 bookingsToday=9 ; venue bad-state counts: 0 0 0 0 0 0 0 2 (the last is the 2 expected); smoke: Tests:       6 passed, 6 total
run 3: run.sh exit 0 in 26 s; GREEN: 0 errors; holds the E1 migration; loaded tables=64 people=21 menuItems=242 stockItems=149 recipes=57 paidBills=4 openTables=17 bookingsToday=9 ; venue bad-state counts: 0 0 0 0 0 0 0 2 (the last is the 2 expected); smoke: Tests:       6 passed, 6 total
```

### Count queries (`packages/db/demo-venue/check.sql`, run 1, before the smoke)

```
-- people per role
     role      | count
---------------+-------
 Accountant    |     2
 Bartender     |     2
 Cashier       |     2
 Chef          |     3
 Manager       |     2
 Owner         |     2
 Stock Manager |     2
 Supervisor    |     2
 Waiter        |     4
-- tables per area (floor plan)
   area    | count
-----------+-------
 Main hall |    32
 Terrace   |    16
 Bar       |    10
 VIP       |     6
-- menu
 section | items
---------+-------
 FOOD    |   132
 DRINKS  |   110
 groups | subgroups
--------+-----------
     13 |        36
 items_with_choices
--------------------
                 83
 spirits_with_tot_double_bottle
--------------------------------
                             36
 wines_by_glass_and_bottle
---------------------------
                        16
   subgroup   | count
--------------+-------
 Bottled beer |     6
 Cider        |     2
 Draught      |     3
 Juices       |     6
 Sodas        |    10
 Water        |     3
 non_whole_prices
------------------
                0
-- stock and recipes
 stock_items | units
-------------+-------
         149 |     4
 recipes | recipe_lines
---------+--------------
      57 |          229
-- the service in progress
 waiter |   status   | count
--------+------------+-------
 Brian  | NEW        |     1
 Brian  | SENT       |     2
 Brian  | IN_KITCHEN |     1
 Brian  | READY      |     1
 Brian  | SERVED     |     1
 Gloria | NEW        |     1
 Gloria | SENT       |     1
 Gloria | IN_KITCHEN |     2
 Gloria | SERVED     |     1
 Sanyu  | NEW        |     1
 Sanyu  | SENT       |     2
 Sanyu  | READY      |     1
 Sanyu  | SERVED     |     2
 open_tables | waiters
-------------+---------
          17 |       3
 bill_asked
------------
          2
  status   | bookings_today
-----------+----------------
 PENDING   |              1
 CONFIRMED |              3
 SEATED    |              2
 COMPLETED |              1
 CANCELLED |              1
 NO_SHOW   |              1
 reservation_number |  status   | label | in_the_past | table_in_use
--------------------+-----------+-------+-------------+--------------
 RES-000005         | CONFIRMED | V03   | t           | f
 RES-000006         | CONFIRMED | M04   | f           | t
 RES-000008         | CONFIRMED | V01   | f           | f
 till_code | status | opening_float | expected_cash
-----------+--------+---------------+---------------
 TILL-1    | OPEN   |     200000.00 |     402000.00
 paid_bills | payment_rows |  applied  | cash_handed_over | change_given
------------+--------------+-----------+------------------+--------------
          4 |            5 | 402000.00 |        210000.00 |      8000.00
-- bad states in Tapas Downtown (the R-E1 review queries); each must be 0, the last 2 (two tables with lines added after the send)
 closed_with_unsent_line
-------------------------
                       0
 closed_paid_not_total
-----------------------
                     0
 voided_with_payment
---------------------
                   0
 occupied_with_no_open_order
-----------------------------
                           0
 line_on_two_tickets
---------------------
                   0
 sent_station_line_without_ticket
----------------------------------
                                0
 order_total_not_live_lines
----------------------------
                          0
 sent_order_with_unsent_lines_expected_2
-----------------------------------------
                                       2
-- the same checks on the rest of this database (db:seed demo org; not loaded by demo-venue; see R-E1 S7)
 closed_with_unsent_line
-------------------------
                       1
 closed_paid_not_total
-----------------------
                     1
 voided_with_payment
---------------------
                   0
 occupied_with_no_open_order
-----------------------------
                           1
 line_on_two_tickets
---------------------
                   0
 sent_station_line_without_ticket
----------------------------------
                                0
 order_total_not_live_lines
----------------------------
                          0
 sent_order_with_unsent_lines
------------------------------
                            2
```

## Phase 4 — People and access

| Done-when 5 | proof |
|---|---|
| `10-people-and-access.md` and `rights-matrix.json` exist | `docs/direction/` (matrix: 314 keys, current holders read from the seeded database, 71 changes ruled; Owner 277 → 304, Manager 261 → 303, Supervisor 134 → 120, Cashier 63 → 61, Waiter 51 → 43) |
| All 35 keys have a ruling | **36** guard keys are held by no role: 35 with no permission row (the 35 named) plus `hms:read:*` (row, no grant); each has its endpoints and a ruling: 27 granted (Owner, Manager; Accountant on 3), 8 `ops:*` moved behind the platform-operator guard, `hms:read:*` stays an API-key scope [live] |
| R14 breaches listed | Line 1: Manager lacks **15** seeded rights beyond the exception. Line 2, checked by key name and by module (every key guarding the accounting, AP, AR, bank-rec, budget, ledger and payroll modules and every supplier/purchase/cost route): no accounting or procurement key, but Supervisor holds 5 payroll rights and `pos:cost:read` and Cashier and Waiter `pos:payroll:slips:read`, which lists **everyone's** payslips in the branch: probe A1, Waiter 200, Cashier 200 [live] |

Also found against the rules: PINs are shown to the manager on onboarding and reset (the rule is by token only, nobody sees another's PIN); waiters hold payment, till and refund rights; supervisors take payment (the whole `pos:payment:*` family, ruled off; `override` kept for the PIN method change), write recipes and see cost; chefs see cost; chef, bartender and store keeper cannot start a shift. No sibling prompt (T1–T3) expects anything of the venue's names, labels or areas; T2 reads the review.

## Done-when 6 and the gates

- `git diff --stat origin/e1/order-truth...HEAD`: 40 files, all under `docs/reviews/`, `apps/api/test/`, `tools/`, `packages/db/demo-venue/`, `docs/direction/10-people-and-access.md`, `docs/direction/rights-matrix.json`, `reports/`; **no file under `apps/api/src`, `apps/web` or `packages/db/prisma`** [live].
- Gate output, `reports/proof/T4/final_gates.txt` (HEAD, this turn) [live]:

```
Final gates on HEAD e506716, 2026-11-26T11:07:40Z
API typecheck (tsc --noEmit) exit 0
API build (nest build) exit 0
Test Suites: 71 passed, 71 total
Tests:       1309 passed, 1309 total
eslint (no --fix) on T4's 4 changed API files:
  exit 0 — ✖ 2 problems (0 errors, 2 warnings)
demo-venue strict tsc exit 0 (no ESLint config covers packages/db)
prettier: All matched files use Prettier code style!
check:event green
shell scripts: bash -n ok
JSON files parse: rights-matrix.json + 7 venue data files
outside T4 folders: 0 files; product code (apps/api/src, apps/web, packages/db/prisma): 0 files
git diff --check origin/e1/order-truth...HEAD: clean (after stripping psql's trailing spaces from the proof files)
```
- T4's own e2e: the venue smoke 6/6 three times; the sequencer turns C1 and C2 green; the review probes are red by design (each is a fault).
- No screen was built or changed in T4, so rule 10 (driving screens in Chromium) did not apply.

## Left out, and why

- No product fix: every fault is written down for T2 (rule of the T4 prompt).
- The seed is not changed: `rights-matrix.json` is the input for a later, authorised seed step.
- "Bill asked" exists only as an audit row; no API reads it back (venue README).
- No stock on hand in the venue (stock movement is E6).
- Probes not written for S9, S10, S11, N3 (provider webhooks, a millisecond window, a live MoMo intent, a lock with no visible effect).

## Decisions taken
In `reports/T4_PROGRESS.md`; the main ones: the five rulings come from `rebuild/main`'s RE1 copy; fixes live in e2e config, not in other people's specs; the venue is built fresh in `packages/db/demo-venue/` (the old importer is outside T4's folders and breaks the phone, guard and credential rules); a new fictional cast; store keeper = role "Stock Manager"; areas = floor plans; R14 applied literally, with `pos:hr:compensation:create` flagged for the owner.

## For other tracks
- **T2**: read `docs/reviews/e1-order-truth.md` (B1–B5 first), `e2e-baseline.md` F1–F4, `10-people-and-access.md` section 9.
- **Seed owner**: `seed.ts` writes SENT/IN_KITCHEN/CLOSED demo orders with unsent lines and a CLOSED order with no payment (review S7; `check.sql` second block).
- **Everyone**: `tools/test-env.sh` for a throwaway database; the venue loader needs E1's migration; the e2e suite now runs in one fixed order.
- **Before E1 reaches any database with history**: run B5's duplicate query first.

## Verdict
**E1: blockers. T4: all four phases done, every Done-when proven.**
- E1 has five live blockers in money and rights paths; do not deploy or build on it before E1F.
- The e2e suite is now deterministic; all 87 red tests are named real faults (72 pre-existing, 15 review probes).
- Tapas Downtown loads in one command in ~25 s, every count met, smoke 6/6 three times.
- 36 ungranted keys ruled; R14 breached by 15 Manager gaps and frontline payroll rights.
- No product code changed; no credential in any file.
You need to: ask the architect for E1F from the review's B1–B5, and authorise the seed change in `rights-matrix.json`.
