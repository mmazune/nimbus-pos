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
| A probe for each | `apps/api/test/e1-review.probes.e2e-spec.ts` (P1–P25, N2, A1), `e1-review.writers.e2e-spec.ts` (W1, W2, S6), `tools/probes/e1-migration-on-live-data.sh`, `tools/probes/base-double-send.e2e-spec.ts.txt`; 4 findings without a probe are named with the reason (S9, S10, S11, N3) |
| The five rulings answered | review section "The five rulings asked for" (by-name e2e comparison; the late read-back; the two `pos-handoff` lines; one route prefix; the three events) |

The blockers, all **[live]**:
- **B1** a sent line's quantity can be lowered through the plain item edit (`pos:orders:write`, which waiters hold): 2 → 1, bill 12,000 → 6,000, no void record.
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
- Final run on HEAD: **86 red = 72 + 14 T4 probes**, the same names as the earlier runs plus the three probes added later (`reports/proof/T4/e2e_final_vs_run2.txt`) [live].

## Phase 3 — The demo venue

| Done-when 4 | proof |
|---|---|
| Loads into an empty throwaway database in one command | `eval "$(tools/test-env.sh)"; packages/db/demo-venue/run.sh` — three fresh runs, exit 0 in 25 s each (`reports/proof/T4/demo_venue_three_runs.txt`) [live] |
| Validator green | green on the data, **red on five planted faults** (broken reference, duplicate name, non-whole price, phone outside the block, brand word), exit 1 then 0 (`demo_venue_validator.txt`) [live] |
| Counts met, shown by queries | `demo_venue_counts.txt` (`packages/db/demo-venue/check.sql`) [live]: see table |
| No credential in any file | PINs and passwords random at load, shown once on stderr; scan of the working tree for every loaded secret: 0 passwords anywhere; 2 six-digit PINs coincide with digit runs in an untracked vendored file and a build file, 0 in the repository's own files (`demo_venue_secret_scan.txt`) [live] |

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

Every bad-state check from the review returns 0 for the venue [live]. The API smoke (`apps/api/test/demo-venue.smoke.e2e-spec.ts`) passed **5/5 on each of three fresh loads** [live]: every PIN role signs in by PIN and owner/accountant by password; a loaded waiter's send tickets exactly the unsent lines; cash on a bill-asked table gives change, frees the table and completes the booking; new order and booking numbers continue from the loaded ones.

## Phase 4 — People and access

| Done-when 5 | proof |
|---|---|
| `10-people-and-access.md` and `rights-matrix.json` exist | `docs/direction/` (matrix: 314 keys, current holders read from the seeded database, 67 changes ruled) |
| All 35 keys have a ruling | **36** guard keys are held by no role: 35 with no permission row (the 35 named) plus `hms:read:*` (row, no grant); each has its endpoints and a ruling: 27 granted (Owner, Manager; Accountant on 3), 8 `ops:*` moved behind the platform-operator guard, `hms:read:*` stays an API-key scope [live] |
| R14 breaches listed | Line 1: Manager lacks **15** seeded rights beyond the exception. Line 2: no accounting or procurement key, but Supervisor holds 5 payroll rights and Cashier and Waiter `pos:payroll:slips:read`, which lists **everyone's** payslips in the branch: probe A1, Waiter 200, Cashier 200 [live] |

Also found against the rules: PINs are shown to the manager on onboarding and reset (the rule is by token only, nobody sees another's PIN); waiters hold payment, till and refund rights; supervisors take payment, write recipes and see cost; chefs see cost; chef, bartender and store keeper cannot start a shift.

## Done-when 6 and the gates

- `git diff --stat origin/e1/order-truth...HEAD`: 40 files, all under `docs/reviews/`, `apps/api/test/`, `tools/`, `packages/db/demo-venue/`, `docs/direction/10-people-and-access.md`, `docs/direction/rights-matrix.json`, `reports/`; **no file under `apps/api/src`, `apps/web` or `packages/db/prisma`** [live].
- `reports/proof/T4/final_gates.txt` (HEAD, this turn) [live]: API typecheck exit 0; API build exit 0; unit **1,309 passed / 71 suites**; ESLint on T4's 4 changed API files 0 errors (2 warnings); demo-venue strict `tsc` 0 and Prettier clean (no ESLint config covers `packages/db`); `check:event` green.
- T4's own e2e: the venue smoke 5/5 three times; the sequencer turns C1 and C2 green; the review probes are red by design (each is a fault).
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
- The e2e suite is now deterministic; all 86 red tests are named real faults (72 pre-existing, 14 review probes).
- Tapas Downtown loads in one command in 25 s, every count met, smoke green three times.
- 36 ungranted keys ruled; R14 breached by 15 Manager gaps and frontline payroll rights.
- No product code changed; no credential in any file.
You need to: ask the architect for E1F from the review's B1–B5, and authorise the seed change in `rights-matrix.json`.
