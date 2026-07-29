# Supervisor Reconstruction — Prompt 4A Completion Report
## Neon Reservation Lifecycle Completion, Active/History Query Repair, Order-Close Sync, Pagination

**Status:** `B. COMPLETE WITH KNOWN LIMITATIONS / READY FOR PROMPT 4B`

> Backend, DTO, controller, order-close integration, frontend contract helpers,
> unit tests, Postman, and documentation are **complete and statically validated**
> (typecheck / lint / web build / 67 API unit tests). The **live isolated Neon QA
> was EXECUTED (2026-07-28)** via Neon MCP: shared-branch read-only data audit,
> disposable QA branch with proven isolation, migration applied + verified on the
> branch, real-data lifecycle (manual complete + order-close auto-complete +
> idempotency + concurrency compare-and-set), active/history separation, and query
> plans — **shared Neon received zero writes**. Reservation lifecycle + queue
> contracts are proven at both the unit-test and live-DB layers. **Remaining
> non-blocking depth:** the HTTP-layer API boot + isolated `/api/health` +
> Playwright smoke were not run (would require booting the API against the QA
> branch); the controller/DTO/permission stack is already unit-tested and the DB
> contract is proven live. See §12.

---

## 1. Repository & worktree

- **Path:** `C:\Users\arman\Desktop\nimbus-pos` (canonical). Forbidden stale path not used.
- **Branch:** `main`. **No commit, no push** performed.
- **Initial state:** ~193 dirty files (authoritative uncommitted worktree). The
  twelve intentional Floor deletions (`SupervisorTable*`, `WaiterTable*`,
  `SupervisorFloor*`) remain deleted. All Waiter / Cashier / shared-shell /
  shared-Floor / shared-profile / Prompt 0–3D work preserved.
- **Pre-existing dirty files NOT attributable to Prompt 4A** (left untouched):
  e.g. `apps/web/src/components/waiter/reservations/WaiterReservationsScreen.tsx`,
  and the untracked `docs/supervisor-ui-docs/SUPERVISOR_RESERVATION_LIFECYCLE.md`
  (created by a prior session; updated here as permitted by §53).
- `git diff --check`: clean for the files changed by this pass.

## 2. Primary problem addressed

Reservation records accumulated indefinitely in the operational list because the
lifecycle and query architecture were incomplete:

- `SEATED → COMPLETED` was defined in the state machine but **unreachable** — no
  service method, no controller route.
- Order close never completed a linked reservation.
- `list()` returned terminal + active rows together, had **no maximum page
  size** (unbounded), no active/history separation, and a `upcoming` flag that
  silently overrode `status`.
- Transitions were read-then-write (not atomic) → concurrency-unsafe.

The repair is at the **lifecycle + backend query layer**, not a frontend filter
that hides accumulated records.

## 3. State machine (verified & final)

`VALID_TRANSITIONS` (unchanged, already correct):

```
PENDING   → CONFIRMED | CANCELLED | NO_SHOW
CONFIRMED → SEATED | CANCELLED | NO_SHOW
SEATED    → COMPLETED
COMPLETED | CANCELLED | NO_SHOW → (terminal)
```

Statuses are unchanged (no new persisted status). `ACTIVE` / `HISTORY` /
`ATTENTION` / `overdue` are **query/UI groupings**, never persisted.

## 4. Backend changes

### 4.1 Manual completion (`SEATED → COMPLETED`)
- **New route:** `POST /api/reservations/:id/complete` (`reservations.controller.ts`),
  `@HttpCode(200)`.
- **Permission:** `pos:reservation:update` — **already seeded** (seed.ts
  permission list) and **already granted to Supervisor** (seed.ts Supervisor
  block, also Owner/Manager). **No new permission, no seed change** (§19 Outcome
  A). Waiter/Cashier are intentionally not granted manual completion.
- **DTO:** `CompleteReservationDto` — optional `note` only; target status is
  never client-supplied.
- **Service `complete()`:** SEATED-only; idempotent (already-COMPLETED returns
  canonical state, no second event); atomic conditional update; emits
  `ReservationEvent(COMPLETED, {source:'manual'})` + `RESERVATION_COMPLETED`
  audit. Supports completion of a SEATED reservation **with or without** a
  linked order (no fabricated order, no payment implication).

### 4.2 Automatic completion on order close
- **`ReservationsService.completeForClosedOrder(orderId, ctx, actorUserId, meta)`**:
  finds the reservation explicitly linked via `seatedOrderId` **and** still
  `SEATED` (never inferred from table/guest/date), completes it atomically,
  emits `ReservationEvent(COMPLETED, {source:'order-close', orderId})` + audit.
  Returns `null` when nothing to do (unlinked / already terminal / lost race).
- **Integration point:** `OrdersService.transitionOrder()` — the single
  canonical order-close choke point (`targetStatus === CLOSED`). Invoked **after**
  the committed status change and table release; **never** in Cashier frontend.
- **Atomicity policy (§22):** the existing order-close is not itself wrapped in a
  DB transaction, so completion uses the **retry-safe after-close reconciliation**
  option: order close stays canonical, completion failure is **logged (not
  silently swallowed)** and never rolls back the close. Duplicate close callbacks
  are safe (conditional update → no duplicate event). Documented limitation:
  a completion failure leaves the reservation SEATED for manual completion (no
  auto-retry, since a closed order cannot be re-closed).
- **DI:** `OrdersModule` now imports `ReservationsModule` (which already exports
  `ReservationsService`). Verified **no circular dependency** (reservations does
  not import orders).

### 4.3 Concurrency-safe transitions
- New private `applyGuardedTransition(id, ctx, from, data)` performs a
  branch-scoped conditional `updateMany({where:{id, status: {in:[from]}}})` —
  a compare-and-set. `confirm`, `seat`, `cancel`, `no-show`, `complete`, and
  `completeForClosedOrder` all use it. A stale request updates zero rows →
  `ConflictException`, no duplicate lifecycle event, no lost update.

### 4.4 Active/History query split + pagination + timezone
- `list()` now supports `scope=active|history` (server-side status grouping),
  explicit `status`, `date` (single day), `from`/`to` (range), `tableId`,
  legacy `upcoming`.
- **Pagination:** default `pageSize = 25`, **clamped to max `100`** in the
  service (chosen over a hard `@Max` 400 to avoid breaking legacy callers /
  Playwright smoke — see §Decisions). Returns
  `{ data, total, page, pageSize, totalPages, scope }`.
- **Deterministic sort:** history `reservationAt desc, id desc`; else
  `reservationAt asc, id asc` (stable pagination tiebreak).
- **Overdue/Attention (§32):** server-derived `overdue` / `overdueByMinutes`
  attached per row (never persisted; terminal rows always `false`). MVP grace
  window **`OVERDUE_GRACE_MINUTES = 15`** in one canonical location; overdue
  **never** auto-transitions the guest outcome (no auto-NO_SHOW).
- `list` include now carries `seatedOrder {id, orderNumber, status}` so Prompt
  4B can derive the "SEATED but order CLOSED" Attention case.
- **Timezone:** boundaries computed server-side. Branch timezone is not modelled
  → day edges use **UTC** (documented limitation, not silently invented).

### 4.5 Query DTO (`ListReservationsQueryDto`)
- Added `scope` (`@IsEnum(['active','history'])`), `from`, `to` (`@IsDateString`).
- Kept the proven `@Type(() => Number)` coercion on `page`/`pageSize` (the same
  pattern that fixed the Prompt 3 discount-list query). Max enforced by service
  clamp (no unbounded page size).

## 5. Reservation / order linkage (verified)

- `Reservation.seatedOrderId → Order` (relation `seatedOrder`); `Order.reservations[]`
  is the reverse. Order does **not** store `reservationId` for the seating bridge.
- `Reservation.completedAt` column **already exists** → no table change for the
  completion timestamp.
- Auto-completion keys **only** off `seatedOrderId + status=SEATED`.

## 6. Schema / migration

- **Only change:** added `COMPLETED` to enum `ReservationEventType`
  (`schema.prisma`), positioned after `SEATED`.
- **Migration:** `packages/db/prisma/migrations/20260518000000_prompt4a_reservation_completed_event/migration.sql`
  → `ALTER TYPE "ReservationEventType" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'SEATED';`
  (matches the repo's prior enum-extension convention, e.g. m20.1).
- **Prisma client regenerated** locally (`db:generate`, v5.22.0) — codegen only,
  no DB connection.
- **Not deployed to shared Neon in this pass** (per §44). Deployment step is
  documented in the shared-Neon audit doc. No index migration was needed — the
  existing `[branchId, status]` and `[branchId, reservationAt]` indexes cover the
  active/history + date queries (query-plan confirmation pending Neon).

## 7. Frontend contract helpers (no UI redesign)

`apps/web/src/lib/supervisor/reservations.ts` (additive only):
- `SupervisorReservationsQuery` gains `scope`, `from`, `to`.
- `SupervisorPaginatedReservations` gains `totalPages`, `scope`.
- `SupervisorReservation` gains optional `overdue`, `overdueByMinutes`.
- New fetchers: `fetchSupervisorActiveReservations`,
  `fetchSupervisorReservationHistory`, `completeSupervisorReservation`.
- `supervisorReservationKeys` query-key factory + `supervisorReservationInvalidationKeys()`
  (scoped so a reservation mutation invalidates only reservation surfaces — never
  menu / profile / auth / shift / approvals / all-orders / cashier queues, §38).
- The legacy triple-query merge (`mergeSupervisorReservationRows`) is left intact
  for the current page but is **no longer the target contract**; Prompt 4B
  consumes `scope=active` / `scope=history` directly. **No Reservations UI
  redesign, no new dialog/layout** was done (that is Prompt 4B).

## 8. Cross-role visibility (contract for 4B, §38)

After a Supervisor create/confirm/assign/seat/cancel/no-show/complete, Prompt 4B
should invalidate only: reservation active query, reservation history query (when
terminal), reservation detail, reservation events, Floor overlays, Waiter
Reservations, Waiter Floor. `supervisorReservationInvalidationKeys()` encodes the
reservation subset. Order-close auto-completion means a closed order removes the
completed reservation from active results without any Cashier-side reservation code.

## 9. Permissions (verified in code; live SQL pending Neon)

- Supervisor block (seed.ts) includes: `pos:reservation:` `create, read, confirm,
  seat, cancel, no-show, deposit:record, deposit:read, update, table:assign`.
  → **`update` present → manual completion authorized. No grant added.**
- Waiter block: `read`, `seat` (+ limited) — intentionally **cannot** manually
  complete. Cashier block: no `update`. Owner/Manager: `update` present.
- Live authenticated `/auth/me` + direct RolePermission SQL verification is part
  of the pending Neon QA.

## 10. Tests

- **`reservations.service.spec.ts` (rewritten):** create, guarded confirm/seat/
  cancel/no-show, **manual complete** (success / reject PENDING / reject
  CONFIRMED / idempotent already-COMPLETED / lost-race), **completeForClosedOrder**
  (linked success / unlinked no-op / lost-race no-duplicate), deposits, assign,
  find, **list** (pagination metadata / scope=active / scope=history+sort /
  pageSize clamp / default pageSize / overdue flag), upcoming, events, state
  guards, **confirm concurrency conflict**.
- **`orders.service.spec.ts` (extended):** close reconciles linked reservation;
  close still succeeds when auto-completion throws (failure-safe).
- **Result:** `2 suites passed, 67 tests passed` (`npx jest reservations.service.spec
  orders.service.spec`).

## 11. Validation results

| Check | Result |
| --- | --- |
| API typecheck (`tsc --noEmit`) — reservations/orders | **Clean** (0 errors in changed modules) |
| API typecheck — repo total | 4 errors, **all pre-existing** in `accounts-receivable.service.spec.ts` (untouched by 4A) |
| API unit tests (reservations + orders) | **67 passed / 67** |
| Web typecheck | **Pass** |
| Web lint | **Pass** (no ESLint warnings or errors) |
| Web build (`next build`) | **Pass** — "Compiled successfully", static pages generated |
| Postman JSON | M16 collection extended (Complete + active/history scope + pageSize-clamp requests); **all 56 collections parse** |
| Isolated Neon QA (SQL layer) | **Executed** — migration/schema/permissions/data/lifecycle/idempotency/active-history/query-plans all pass on a disposable branch; shared unmutated |
| `GET /api/health` | **Not run** — API not booted against the QA branch (non-blocking; see §12) |
| Playwright reservation smoke | **Not run** — non-blocking (see §12) |

## 12. Neon isolated QA — EXECUTED (2026-07-28)

Ran via Neon MCP. Project **nimbus-pos** (`empty-glade-…`, PG 17). The only branch,
**`production`** (`br-holy-darkness-…`, default/primary, live app DB), was
classified **shared/production → read-only for destructive QA**. Disposable branch
**`prompt4a-reservations-qa-20260728`** (`br-weathered-breeze-…`) forked from it.

**Executed & PASSED:**
- **Isolation** — QA branch forked the real baseline (126 reservations, 6 SEATED,
  57 migrations) on distinct compute; all QA writes stayed on the branch.
- **Migration audit** — shared: 57 applied, 0 unfinished, 0 rolled back, latest
  `bg7`. Repo: 58 dirs. Only the 4A migration is unapplied on shared (intended).
  No drift, no orphan/failed migrations.
- **Migration apply on QA branch** — `ALTER TYPE … ADD VALUE 'COMPLETED' AFTER
  'SEATED'` applied; enum now has `COMPLETED` at sort-order 5.5 (between SEATED and
  CANCELLED). Shared enum still lacks it (verified).
- **Schema/permissions** — `ReservationStatus` matches Prisma; `reservations` has
  `seated_order_id`/`completed_at`; Supervisor has `pos:reservation:update`
  (1 perm row, 0 duplicate role-perms).
- **Data audit (shared, read-only, no PII)** — 126 reservations; 9 PENDING (8 past),
  52 CONFIRMED (47 past), 6 SEATED (all order-less, past), 57 COMPLETED, 1 CANCELLED,
  1 NO_SHOW. 55 overdue actives. 0 completed-with-open-order, 0 cross-branch links.
- **Manual completion (real data)** — guarded update SEATED→COMPLETED = 1 row +
  `COMPLETED` event `{source:manual}`; idempotent re-run = **0 rows**.
- **Order-close auto-completion (real fixture)** — linked SEATED+CLOSED order →
  1 row completed + 1 event `{source:order-close, orderId}`; duplicate close =
  0 rows; unlinked close = 0 rows (no-op).
- **Active/history separation (real data)** — active 65 + history 61 = 126, no
  overlap; the 2 completions correctly moved SEATED 6→4, COMPLETED 57→59.
- **Query plans (§43)** — active + history ≈0.07ms; seq-scan optimal at 126 rows;
  existing `[branch_id,status]`/`[branch_id,reservation_at]` indexes cover growth →
  **no index migration warranted**.
- **Shared branch unmutated** — before/after counts identical (126 reservations,
  12 events); shared enum untouched. **Zero destructive writes to shared Neon.**

**Not run (non-blocking depth):** the HTTP-layer API matrix, isolated
`GET /api/health`, and Playwright reservation smoke — these need the API booted
against the QA branch connection string. The controller/DTO/permission stack is
unit-tested (67/67) and the DB contract is proven live, so these are additional
end-to-end confidence, not a contract gap. Can be run on request.

**Cleanup:** disposable branch **DELETED 2026-07-28** (user-authorized);
`describe_project` confirms only the `production` branch remains.

Full evidence: `ai/SUPERVISOR_RESERVATION_SHARED_NEON_DATA_AUDIT.md`,
`ai/SUPERVISOR_RESERVATION_QA_RECORD_REGISTER.md`.

## 13. Decisions / limitations

- **Completion event via enum migration** (chosen over audit-log-only) — user-approved.
- **pageSize clamp, not 400-reject** — avoids breaking legacy callers / smoke.
- **UTC day boundaries** — branch timezone not modelled (documented).
- **Order-close reconciliation is after-close, retry-safe** (not same-transaction)
  because the existing close is non-transactional; failure is logged, reservation
  can be completed manually.
- **No mass shared-Neon data repair** performed; a categorized repair plan is
  deferred to the shared-Neon audit doc (dry-run-first, approval-gated).
- **transfer-server, refund, post-close void, payment collection, order close,
  full Approvals reconstruction, Manager UI, Reservations UI (4B)** — untouched.

## 14. No commit / no push

Confirmed: **no `git commit`, no `git push`.** All changes remain in the dirty
worktree.
