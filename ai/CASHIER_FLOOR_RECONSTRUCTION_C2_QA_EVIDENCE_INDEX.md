# Cashier Floor-First Reconstruction — Prompt C2 QA Evidence Index

**Date:** 2026-07-31 · **Classification:** A — C2 COMPLETE / READY FOR C3 · **Commit/push:** none.

All executable validation below was run against the **canonical worktree**
(`C:\Users\arman\Desktop\nimbus-pos`). Browser/mutation QA ran on an **isolated local Docker
Postgres** stack — the shared Neon `production` API (`ep-empty-paper`, :3001) was never written.

## 1. Isolated stack (fail-closed, shared Neon untouched)

| Component | Value |
| --- | --- |
| Postgres | Docker `postgres:16-alpine`, container `nimbus-c2-qa`, host port **55432**, db `nimbus_c2` |
| DB provisioning | `prisma migrate deploy` (59 migrations) + `db:seed` + `db:demo:import` (branches 6, users 13, orders 1198, payments 750, reservations 125) |
| API | `apps/api/dist/main.js`, **:4001**, explicit isolated env (`DATABASE_URL`/`DIRECT_DATABASE_URL` → local; shell carried no inherited `DATABASE_URL`), `API_CORS_ORIGINS=http://localhost:3100` |
| Web | `next build` + `next start -p 3100` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4001` |
| Isolation proof | `GET http://localhost:4001/api/health` → `{status:ok, db:ok}`; cashier login → 201; branch `cb27be401a2c35dfc0d4e610` (Tapas Downtown) present |

## 2. Static / executable gates (repo root)

| Gate | Command | Result |
| --- | --- | --- |
| Web typecheck | `pnpm --filter @nimbus-pos/web typecheck` | PASS |
| Web lint | `pnpm --filter @nimbus-pos/web lint` | PASS (0 warnings/errors) |
| Web build | `pnpm --filter @nimbus-pos/web build` | PASS |
| C1 assertions | `npx tsx apps/web/scripts/cashier-c1-assertions.ts` | PASS |
| C2 assertions | `npx tsx apps/web/scripts/cashier-c2-assertions.ts` | PASS |
| Shell assertions | `npx tsx apps/web/scripts/shell-assertions.ts` | PASS |
| Floor assertions | `npx tsx apps/web/scripts/floor-assertions.ts` | PASS |
| Git hygiene | `git diff --check` | clean |

## 3. Playwright — `e2e/cashier-floor/` full four-viewport matrix

**Definitive run: 164 passed / 0 failed / 0 skipped** (41 tests × 4 viewport projects
`vp-1024x768`, `vp-1366x768`, `vp-1440x900`, `vp-1920x1080`). Reporter JSON archived to the QA
scratchpad. 20 spec files:

- C1 (retained, some assertions updated to the C2 behaviour): `navigation-and-default-route`,
  `hidden-legacy-routes`, `shared-floor-parity`, `table-selection-routing`, `role-boundaries`,
  `responsive`, `performance-request-count`, `till-and-me-regression`.
- C2 (new): `zero-one-multiple-bill-resolution`, `selected-bill-url-state`,
  `settlement-workspace-readonly`, `split-child-selection`, `payment-state-readonly`,
  `till-readiness`, `find-bill-foundation`, `tableless-takeaway-selection`,
  `legacy-compatibility-regression`, `request-count-c2`, `responsive-c2`, `cross-role-c2-regression`.

Coverage highlights (all green ×4 viewports):
- **Zero/one/multiple resolution** — one payable auto-resolves (URL gains `orderId`); multiple opens
  the explicit selector and does NOT auto-carry an `orderId` (no silent first-pick); a selector pick
  opens the workspace.
- **orderId URL state** — refresh restores the bill; Back returns to Floor; invalid orderId shows a
  fail-safe "Bill unavailable" (never another bill).
- **Read-only settlement workspace** — Bill / Totals / Payment state / Settlement readiness sections
  render; a "Read-only" badge shows; zero payment/close/split/refund/receipt/transfer/void controls.
- **Payment state read-only + fail-closed** — a fresh SENT bill shows a truthful action-free state,
  never "Settled".
- **Till/readiness** — shift/till badges + non-navigating "Open Till" link; no auto-navigation.
- **Find bill** — bounded dialog opens, routes a result into the workspace via `orderId`; absent for
  Waiter/Supervisor.
- **Tableless/takeaway** — a takeaway bill opens by `orderId` only (no `tableId`), refresh-safe.
- **Legacy compatibility** — `/cashier/queue` + `/cashier/receipts` render by direct URL, absent
  from nav; nav is exactly Floor/Till/Me.
- **Cross-role** — Waiter table→menu (no Cashier settlement sections, no Find bill); Supervisor
  table→control (Find order present, no Find bill); Cashier Floor exposes no Supervisor/Waiter
  controls.

## 4. Cross-role regression (canonical Supervisor suite)

`e2e/supervisor-prompt3/regression.spec.ts` + `role-boundaries.spec.ts` (vp-1440x900): **5 passed /
0 failed** — Waiter Floor/nav intact, Cashier surfaces (Floor default + Till nav + Queue/Receipts by
direct URL) intact, Waiter cannot reach the Supervisor Floor workspace (guard).

## 5. Request budget (enforced by `request-count-c2.spec.ts` + `performance-request-count.spec.ts`)

- Default Cashier Floor load: NO receipt-history call, NO per-table payment call, NO selected-order
  detail call; the bounded orders list is the only order read.
- Opening a table bill: ONE table-bills query (`?tableId=`, bounded ≤3 incl. refetch), ONE
  selected-bill detail query, ONE payment-state query domain — no storms.

## 6. Payment-per-table distribution (isolated branch, informational)

Across the 22 demo tables: `{1:5, 2:1, 3:3, 4:6, 5:4, 7:1, 10:1, 18:1}` payable bills — several
single-bill tables exist, so the table→single auto-resolve QA reuses an existing one (data-
independent) and never spuriously skips.

## 7. Shared-Neon safety

Shared Neon (`ep-empty-paper`, :3001) received **no writes** from C2. All synthetic bills were
created only against the isolated :4001 API / :55432 Postgres. The isolated stack is torn down after
QA.
