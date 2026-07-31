# Supervisor Final Demo Data Register

Date: 2026-07-31 · Companion to `ai/SUPERVISOR_FINAL_DEMO_SCRIPT.md`.

> Describes which demo/shared records are safe to reuse for a live Supervisor demo, which are
> disposable-only, and which steps must never be run against shared data. Credentials are not
> repeated here — see `docs/TESTING_AND_QA.md` "Demo accounts" (all passwords are the single
> shared demo password documented there; do not invent or print new credentials).

## Required states for each demo step

| Demo step | Required record state | Where it comes from |
| --- | --- | --- |
| Floor / select table | At least one Occupied table with a live order | Present in shared demo data (Tapas Downtown has 22 tables, a mix of Occupied/Available/Reserved) |
| Request bill / Mark served | An order in `SENT`/`IN_KITCHEN` (for Request bill) or `READY` (for Mark served) | Pick any Occupied table's order; if already billed/served, pick another |
| Split bill / Transfer table | An order with no existing split-bill metadata / a different Available target table | Any live DINE_IN order; Transfer needs at least one Available table (usually several present) |
| Find order | Any order (including closed/voided/takeaway) | Shared demo data already has 1223 orders across all statuses |
| Discount request / approve / reject | An **unpaid** order in `NEW`/`SENT`/`IN_KITCHEN`/`READY` with no existing PENDING discount | Pick a fresh Occupied-table order; avoid orders already carrying a PENDING/APPROVED discount |
| Reservations create/confirm/assign/seat/cancel/no-show | Any date; the create form's Date field enforces "today or later" via the browser itself | No pre-req — create fresh via the Create reservation dialog |
| Reservations Attention | At least one overdue PENDING/CONFIRMED or structurally-inconsistent SEATED row | Shared demo data already has legacy overdue rows (documented in the Prompt 4A data audit) — safe to view, **do not bulk-resolve** |
| Approvals — Discount/Leave/Anomaly | At least one PENDING discount, PENDING leave, or OPEN anomaly on the Supervisor's branch | See "Topping up demo decision rows" below if the queue is empty |
| Approvals — Shift-swap Reject | At least one PENDING shift-swap request on the branch | Shared demo data seeds several; if exhausted, see below |

## Safe, reusable records (shared/demo database)

- **Branch:** Tapas Downtown (`cb27be401a2c35dfc0d4e610`) — the default Supervisor demo branch,
  22 tables, realistic order/reservation history.
- **Reservations:** any row in Arriving/Seated/History is safe to *view*. Creating a **new**
  reservation via the demo script is always safe (each gets a fresh id) — no need to clean up
  afterward; it simply becomes part of the demo dataset's history.
- **Orders:** any Occupied table's live order is safe for Request bill/Mark served/Split/
  Transfer/Discount-request, since these are exactly the actions a real Supervisor performs
  routinely — they do not corrupt demo data, they extend it.

## Disposable-only records (never demo against shared data)

- **Live API mutation matrices** (`tools/qa/reservation-live-matrix.mjs`,
  `tools/qa/approvals-live-matrix.mjs`) — these tag every row with a QA marker
  (`P4D-QA`/`SUPFINALQA`/etc.) and are designed to run **only** against a disposable Neon branch
  or local Docker database, never shared `production`. Do not run them as part of a live demo.
- **Full four-viewport Playwright browser suite** — same rule. Run only against an isolated
  stack (see `docs/TESTING_AND_QA.md` §"Prompt 4D — fail-closed isolated QA harness").
- **SQL-seeded PENDING/OPEN decision rows** used during this closure pass's QA (ids prefixed
  `supfinalqa*`) were inserted only on the disposable Neon branch and the local Docker database,
  both of which were destroyed at cleanup. **None of these rows exist on shared data.**

## Steps that should not be run on shared data

- Do **not** run either live API mutation matrix against shared `production`.
- Do **not** run destructive/mutation Playwright suites against shared `production` — always
  build the web app against an isolated API and run the browser suite against that.
- Do **not** bulk-resolve the legacy overdue/order-less-SEATED reservations visible in Attention
  on shared data — individual, one-at-a-time actions only, matching the locked product decision
  (no bulk resolution without a separately authorized data-repair operation).
- Do **not** seed synthetic decision rows (discount/leave/shift-swap/anomaly) directly via SQL on
  shared `production` — that pattern is disposable-database-only, established in Prompt 5B1 for
  isolated QA, and must stay that way.

## Topping up demo decision rows (isolated QA only — never on shared data)

If a disposable/local QA database's Needs-action queue runs dry for a domain during repeated
testing, seed fresh rows directly via SQL rather than through `POST /pos/orders` (which has the
known order-number collision on a populated branch, see the known-limitations register). Minimal
shape used in this pass (adapt ids to the target isolated database):

- **Discount:** insert into `discounts` with `status='PENDING'`, a `type`/`value` pair, a
  discountable `order_id` (unpaid, no existing discount), and the branch/org ids.
- **Leave:** insert into `leave_requests` with `status='PENDING'`, a branch-scoped `employee_id`,
  and a future `starts_at`/`ends_at`.
- **Shift-swap:** insert into `shift_swap_requests` with `status='PENDING'`, branch-scoped
  `requester_employee_id`/`target_employee_id`, and a `shift_date`.
- **Anomaly:** insert into `anomaly_events` with `status='OPEN'`, a `severity`/`entity_type`/
  `entity_id`, and a non-null `evidence` JSON payload (the column is `NOT NULL`).

This exact pattern was used and verified working throughout this closure pass's browser QA (see
`ai/SUPERVISOR_FINAL_QA_EVIDENCE_INDEX.md` §4).
