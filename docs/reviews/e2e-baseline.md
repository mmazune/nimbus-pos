# API e2e baseline (track T4, phase 2), 26 Nov 2026

**Result: every remaining red test is a named real fault below; none is caused by this container.** Two order causes were found and fixed in the e2e configuration (C1, C2), which turned 20 red tests green (base → T4: exactly those 20 changed, nothing else; `reports/proof/T4/e2e_base_vs_t4.txt`). With the fixed order the result is the same by name on two fresh clones.

## How it was measured
- Container: Postgres 16 started by `tools/test-env.sh`, one throwaway `nimbus_event_*` database per run, each a fresh `CREATE DATABASE … TEMPLATE` copy of one database migrated and seeded by the code under test. Redis on 127.0.0.1:6379 (no suite needed it to pass). No `.env` exists in the container; the API falls back to its dev defaults for secrets. `maxWorkers: 1`.
- Commands: `eval "$(tools/test-env.sh)"`, then in `packages/db` `prisma migrate deploy` and `db:seed`, then in `apps/api` `npx jest --config ./test/jest-e2e.json --json --outputFile=…`. Compared by suite file + full test name (script in the T4 report).
- Trees: **base** = `origin/rebuild/main` `0af95f8` (scratch worktree); **E1** = `origin/e1/order-truth` `19e1eee` (this branch, before T4's config change); **T4** = this branch with `test/support/e2e-sequencer.js`.

| run | suites | tests | passed | failed | grade |
|---|---|---|---|---|---|
| base, Jest's own order | 54 | 1,225 | 1,133 | **92** | [live] |
| E1, Jest's own order | 55 | 1,230 | 1,138 | **92** — the same 92 names as base | [live] |
| T4 (E1 + fixed order + the R-E1 probes), run 2 | 57 | 1,257 | 1,174 | **83** = 72 pre-existing + 11 R-E1 probes | [live] |
| T4, run 3 (fresh clone, same command) | 57 | 1,257 | 1,174 | **83** — the same 83 names as run 2 (`reports/proof/T4/e2e_t4_run3.txt`) | [live] |

**The owner's "166 of 166" is the three quick-sale specs**, not the whole suite: `quick-sale.e2e`, `quick-sale.h1f.e2e` and `quick-sale.review.e2e` hold exactly 166 tests. Here they are 166 of 166 when `quick-sale.e2e` runs first, and 165 of 166 on a fresh database when Jest happens to start with the review spec (C1). The rest of the suite was never 0-red on any machine recorded in the repo (`CLAUDE.md` logs 98–121 red under older numbering).

## Container and order causes (fixed)

| id | cause | tests | fix | proof |
|---|---|---|---|---|
| C1 | **Order of tests.** `quick-sale.review` C10 audits every quick-sale row and requires the 200-sale night that `quick-sale.e2e` writes (`quick-sale.review.e2e-spec.ts:880-884`). Jest orders files by size and cached duration, so on a fresh container the review spec often runs first. | 1 | `test/support/e2e-sequencer.js` runs the three quick-sale specs first, in order; `test/jest-e2e.json` names it as `testSequencer`. | red on 3 of 3 fresh clones with Jest's order; green with the sequencer [live] |
| C2 | **A spec changes a shared demo user and never restores it.** `bg1-onboarding.e2e-spec.ts:145-178` resets `cashier@demo.local`'s password (forgot/reset flow). Every later spec that signs in as the cashier gets 401: all 15 of `quick-pin` (its `beforeAll` logs in as cashier) and 4 of `tenancy`. | 19 | The sequencer runs `bg1-onboarding` last. (The lasting fix is for that spec to reset a user it creates; that spec is not T4's to edit.) | `bg1-onboarding` then `quick-pin`,`tenancy`: 19 red; `bg1.1`/`waiter-mvp` first: 0 red; each suite alone: green [live] |

Not a cause here: missing services (Redis was up; nothing called an outside host), the clock, ports (Nest test apps bind an ephemeral port), missing `.env`.

## Real faults that remain red (for track T2 and the seed owner)

| id | suite (tests) | what is wrong | file and line | probe (reproduce) |
|---|---|---|---|---|
| F1 | `billing` (17), `franchise` (13), `franchise-analytics` (12), `bg7-hms-integration` (17) | **Guard keys the seed never grants.** 22 keys used by `@Permissions` on these routes have no permission row at all, and `hms:read:*` has a row but no grant, so every role, Owner included, gets 403. `bg7` fails at its first step, creating an API key (`dev:api-key:write`). These are 23 of the 35 keys ruled on in `docs/direction/10-people-and-access.md` (T4 phase 4). | `billing/billing.controller.ts:33-…`, `franchise/*.controller.ts`, `franchise-analytics/*.controller.ts`, `hms-integration/hms-integration.controller.ts:44`; `packages/db/prisma/seed.ts` `PERMISSIONS_DATA` | `select action from permissions where action in ('billing:read','dev:api-key:write','franchise:overview:read','franchise:analytics:read')` → 0 rows; `hms:read:*` → 1 row, 0 grants [live] |
| F2 | `attendance` (11) | **Stale test against a deliberate rule.** The service lets a person clock, request leave or request a swap only for their **own** linked employee profile (`attendance.service.ts:55-57`, `:222-226`, `:415-419`). The spec signs in as Owner and acts for two arbitrary seeded employees (`attendance.e2e-spec.ts:76-81`), so 7 tests get 403 and the 4 that review what they created get 404. Either the spec must act as each employee's own user, or a manager-on-behalf path must exist (ruling for T2; the Manager B3-F3 note already says leave/swap creation is self-service only). | spec `:76-81`, `:200-290` | run `attendance` alone on a fresh clone: 11 red [live] |
| F3 | `control-plane` (1) | **Two training short-circuits disagree on the answer.** With `x-training-session-id`, `POST /api/inventory/adjustments` now returns the BG3 simulator's shape `{id: 'sim-adj-…', status: 'SIMULATED'}` (`inventory.controller.ts:41-66`), not M42's `{inTraining: true, simulated: true, sessionId}` (`controlplane.service.ts:100-110`) that the spec and the M42 Postman collection expect. One contract must be chosen. | `inventory.controller.ts:41-66`; spec `control-plane.e2e-spec.ts:269-283` | run `control-plane` alone: `res.body.inTraining` is `undefined` [live] |
| F4 | `orders` (1) | **Stale test data.** "close — SERVED → CLOSED" pays a fixed 9,999 cash on whatever menu item the seed lists first (`orders.e2e-spec.ts:70`, `:266`); that item now costs more, so the close is 400 "Insufficient payment". The spec should pay the order's own total. | spec `:70`, `:266` | run `orders` alone: 400 [live] |
| F5 | `e1-review.probes` (11), `e1-review.writers` (2) | The R-E1 review's red probes (13 since the review's second push; 11 in the runs above): faults in E1 (B1–B4, S2–S6, S8, N1, N2). | see `docs/reviews/e1-order-truth.md` | those specs [live] |

## Every red test by name (T4 run 2)

#### `attendance.e2e-spec.ts` (11)
- Attendance + Leave + Shift Swaps (e2e) POST /hr/attendance/clock should clock in an employee — Error: expected 201 "Created", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) POST /hr/attendance/clock should clock out the same employee (toggle) — Error: expected 201 "Created", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) POST /hr/attendance/clock should 409 if employee already clocked out today — Error: expected 409 "Conflict", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) POST /hr/leave should create a leave request — Error: expected 201 "Created", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) POST /hr/leave should 400 if endsAt before startsAt — Error: expected 400 "Bad Request", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) POST /hr/leave should 409 for overlapping leave — Error: expected 409 "Conflict", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) PATCH /hr/leave/:id/review should approve a pending leave request — Error: expected 200 "OK", got 404 "Not Found"
- Attendance + Leave + Shift Swaps (e2e) PATCH /hr/leave/:id/review should 400 when reviewing an already-reviewed request — Error: expected 400 "Bad Request", got 404 "Not Found"
- Attendance + Leave + Shift Swaps (e2e) POST /hr/shift-swaps should create a shift swap request — Error: expected 201 "Created", got 403 "Forbidden"
- Attendance + Leave + Shift Swaps (e2e) PATCH /hr/shift-swaps/:id/approve should approve a pending shift swap — Error: expected 200 "OK", got 404 "Not Found"
- Attendance + Leave + Shift Swaps (e2e) PATCH /hr/shift-swaps/:id/approve should 400 when reviewing an already-reviewed swap — Error: expected 400 "Bad Request", got 404 "Not Found"

#### `bg7-hms-integration.e2e-spec.ts` (17)
- BG7 HMS Integration (e2e) Authentication rejects request with no key (401) — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Authentication rejects unknown key (401) — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Authentication rejects revoked key (401) — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Authentication accepts Authorization: ApiKey <key> form — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Whoami + scope org-wide key reports ORGANIZATION scope and lists all branches — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Whoami + scope branch-scoped key reports BRANCH scope and lists exactly one branch — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/organization returns org + branchScope — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/orders is paginated and scoped — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/payments is paginated — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/sales/summary returns totals — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/reservations responds 200 — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/menu responds 200 — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/inventory responds 200 — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/shifts responds 200 — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Read façade GET /api/hms/accounting/accounts responds 200 — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Access journal writes access logs that surface via /api/hms/access-logs — Error: expected 201 "Created", got 403 "Forbidden"
- BG7 HMS Integration (e2e) Tenancy isolation (branch-scoped key) returns same /branches list (single) regardless of any client filter — Error: expected 201 "Created", got 403 "Forbidden"

#### `billing.e2e-spec.ts` (17)
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/billing 200 — owner sees billing overview — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/billing/plans 200 — lists active plans — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E PATCH /api/billing/subscription 200 — update billing cycle — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E POST /api/dev/api-keys 201 — creates API key and returns plaintext — Error: expected 201 "Created", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/dev/api-keys 200 — lists API keys — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E POST /api/dev/api-keys/:id/revoke 200 — revokes API key — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E POST /api/dev/api-keys/:id/revoke 409 — cannot revoke already-revoked key — Error: expected 409 "Conflict", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E POST /api/dev/webhooks 201 — creates webhook with signing secret — Error: expected 201 "Created", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E POST /api/dev/webhooks 400 — rejects non-HTTPS URL — Error: expected 400 "Bad Request", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/dev/webhooks 200 — lists webhooks — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E PATCH /api/dev/webhooks/:id 200 — updates webhook status — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/dev/usage 200 — returns usage with plan limits — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E POST /api/support/sessions 201 — opens support session — Error: expected 201 "Created", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/support/sessions 200 — lists support sessions — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E PATCH /api/support/sessions/:id/close 200 — closes support session — Error: expected 200 "OK", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E PATCH /api/support/sessions/:id/close 409 — cannot close already-closed session — Error: expected 409 "Conflict", got 403 "Forbidden"
- Billing + Subscription + Dev Portal (M39) – E2E GET /api/dev/admins 200 — lists dev admins — Error: expected 200 "OK", got 403 "Forbidden"

#### `control-plane.e2e-spec.ts` (1)
- M42 Control Plane (e2e) x-training-session-id short-circuits inventory adjustment (no real row persisted) — Expected: true

#### `e1-review.probes.e2e-spec.ts` (10)
- R-E1 probes (e2e) P5 a line added while a cash close is in flight must not land on the closed order — Expected: 409
- R-E1 probes (e2e) P6 a manual-reference payment racing a cash close must not post money on the closed order — Expected: 409
- R-E1 probes (e2e) P7 a whole-order void racing a cash close must not void a paid order — Expected: 409
- R-E1 probes (e2e) P8 closing one order while the other order on the same table is voided frees the table — Expected: "AVAILABLE"
- R-E1 probes (e2e) P11 a voided order leaves no reservation SEATED behind — Expected: not "SEATED"
- R-E1 probes (e2e) P15 a non-cash manual reference above the balance is refused — Expected: 400
- R-E1 probes (e2e) P20 the last line voided: the order is left open at zero and still has a way out — Expected: true
- R-E1 probes (e2e) P22 the item-edit route (pos:orders:write, which waiters hold) cannot lower a sent line — Expected: 409
- R-E1 probes (e2e) P24 a reservation linked to a different order is not completed by this close — - Expected  - 1
- R-E1 probes (e2e) P25 cash beyond the column limit is a 400, never a 500 — Expected: 400

#### `e1-review.writers.e2e-spec.ts` (1)
- R-E1 writers probe (static) W2 only the close door frees a table to AVAILABLE (the audited manual floor action aside) — - Expected  - 1

#### `franchise-analytics.e2e-spec.ts` (12)
- Franchise Analytics (M38.1) – E2E GET /api/franchise/consolidated-finance 200 — owner gets consolidated finance — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/consolidated-finance 200 — with window params — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E POST /api/franchise/consolidated-finance/generate 200 — generates snapshot and persists — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/financial-comparison 200 — returns comparison with portfolio averages — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/waste-benchmarks 200 — returns waste benchmarks with rankings — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/scorecards 200 — returns scorecards with domains and tiers — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E POST /api/franchise/rankings/generate-deep 200 — generates all 6 ranking types — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E POST /api/franchise/rankings/generate-deep 200 — deterministic: same input gives same rankings — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/drilldown 400 — missing branchId — Error: expected 400 "Bad Request", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/drilldown 200 — revenue drilldown returns category + item breakdowns — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/drilldown 200 — COGS drilldown — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise Analytics (M38.1) – E2E GET /api/franchise/drilldown 200 — PRIME_COST drilldown returns cogs + labor — Error: expected 200 "OK", got 403 "Forbidden"

#### `franchise.e2e-spec.ts` (13)
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/overview should return overview for owner — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/rankings should return rankings for owner — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) POST /api/franchise/rankings/generate should generate rankings — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/budgets should return budget rollups for owner — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/budgets should filter by branchId — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) POST /api/franchise/transfers should create a transfer — Error: expected 201 "Created", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) POST /api/franchise/transfers should reject same-branch transfer — Error: expected 400 "Bad Request", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/transfers should list transfers — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/transfers/:id should return 404 for nonexistent transfer — Error: expected 404 "Not Found", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/procurement-pressure should return procurement pressure for owner — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) POST /api/franchise/digests should create a digest subscription — Error: expected 201 "Created", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) GET /api/franchise/digests should list digest subscriptions — Error: expected 200 "OK", got 403 "Forbidden"
- Franchise + Multi-Branch Suite (e2e) PATCH /api/franchise/digests/:id should return 404 for wrong subscription — Error: expected 404 "Not Found", got 403 "Forbidden"

#### `orders.e2e-spec.ts` (1)
- POS Orders (e2e) POST /api/pos/orders/:id/close — SERVED → CLOSED — Error: expected 200 "OK", got 400 "Bad Request"
