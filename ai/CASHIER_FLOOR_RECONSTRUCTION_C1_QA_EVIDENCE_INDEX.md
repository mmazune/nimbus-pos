# Cashier Floor-First Reconstruction — Prompt C1 QA Evidence Index

**Date:** 2026-07-31 · **Result:** all gates passed · **Classification:** A. C1 COMPLETE / READY FOR C2
· Frontend-only; shared Neon never written; no commit/push.

---

## 1. Static gates

| Command | Result |
| --- | --- |
| `corepack pnpm@8.15.0 --version` | `8.15.0` |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | Pass — `tsc --noEmit`, no output |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` | Pass — "No ESLint warnings or errors" |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` | Pass — compiled; routes `/cashier` (redirect) + `/cashier/floor` (8.8 kB) registered; `/cashier/queue` + `/cashier/receipts` still built |
| `npx tsx apps/web/scripts/shell-assertions.ts` | Pass — Cashier labels now `Floor,Till,Me`, count 3, Queue/Receipts absent, shared Floor icon parity |
| `npx tsx apps/web/scripts/floor-assertions.ts` | Pass — Cashier added to the shared-`OperationalFloor` consumer loop |
| `npx tsx apps/web/scripts/cashier-c1-assertions.ts` | Pass — full C1 invariant set (nav, redirect, landing, shared-Floor consumption, no fork, no premature payment, compatibility routes intact, URL helpers, Floor privacy, no transfer-panel import) |
| `git diff --check` | Clean (only benign LF→CRLF warnings) |

## 2. Isolated stack (browser QA — never shared Neon)

| Component | Detail |
| --- | --- |
| Database | Docker `postgres:16` container `nimbus-c1-qa`, DB `nimbus_c1_qa`, host port `55432` |
| Schema/data | `prisma migrate deploy` (all migrations incl. `20260518000000_prompt4a_reservation_completed_event`) + `db:seed` + `db:demo:import` (1 org, 6 branches, 13 users, 119 menu items, 1198 orders, 750 payments, 125 reservations) |
| API | `node apps/api/dist/main.js` on `:4001`, explicit `DATABASE_URL`/`DIRECT_DATABASE_URL` → Docker DB (overrides shared-Neon `.env`), `API_CORS_ORIGINS=http://localhost:3100` |
| Web | `next start -p 3100`, built with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4001` |
| Isolation proof (READ before writes) | `GET /api/health` → `{"status":"ok","db":"ok"}`; cashier login → 201; `GET /api/tables` → 200, 44 tables; `GET /api/pos/orders?...` → 200, total 107 — all from the disposable branch |
| Teardown | isolated API + web processes killed; `docker rm -f nimbus-c1-qa` |

Credentials via env (no hard-coded secrets): cashier `cashier@nimbus.demo` / waiter
`waiter@nimbus.demo` / supervisor `supervisor@nimbus.demo`, `Demo1234!`, branch
`cb27be401a2c35dfc0d4e610`.

## 3. Cashier C1 Playwright suite — `apps/web/e2e/cashier-floor/`

**88/88 passed** (22 tests × 4 viewport projects `vp-1024x768`, `vp-1366x768`, `vp-1440x900`,
`vp-1920x1080`; workers=1; ~3.2 min). Executed, not merely discovered/listed.

| Spec | Tests (per viewport) | Covers |
| --- | --- | --- |
| `navigation-and-default-route.spec.ts` | 3 | lands `/cashier/floor`; nav Floor/Till/Me; Queue/Receipts/Orders absent; `/cashier`→`/cashier/floor`; Floor tab `aria-current` |
| `shared-floor-parity.spec.ts` | 3 | shared toolbar search + Available/Occupied/Reserved filters + grid; no Find bill/order control; no phone/email/receipt on cards |
| `table-selection-routing.spec.ts` | 4 | select→`?tableId=`; payment-free boundary "Select a bill to continue."; refresh preserves; Back clears / Forward restores; invalid tableId → "Table unavailable" |
| `hidden-legacy-routes.spec.ts` | 3 | `/cashier/queue` + `/cashier/receipts` still load directly (not redirected); no shell nav link on any Cashier surface |
| `till-and-me-regression.spec.ts` | 2 | Till reachable + active; Me reachable + shared logout |
| `role-boundaries.spec.ts` | 4 | no supervisor/waiter order controls; selection ≠ menu/control workspace; Waiter + Supervisor nav unchanged |
| `responsive.spec.ts` | 2 | no horizontal overflow on Floor/Till/Me + selected boundary; bottom nav present |
| `performance-request-count.spec.ts` | 1 | 0 receipt-history, 0 per-table payment, 0 pre-selection order-detail; ≤1 bounded orders-list |

## 4. Cross-role regression — 40/40 passed (× 4 viewports)

- `e2e/supervisor-prompt3/floor.spec.ts` — Supervisor Floor + 4-tab nav + Find order intact.
- `e2e/supervisor-prompt3/regression.spec.ts` — Waiter nav Floor/Reservations/Me; Cashier now
  Floor-first (updated), Queue/Receipts by direct URL.
- `e2e/supervisor-prompt3/role-boundaries.spec.ts` — Cashier lands on Floor with Floor/Till/Me
  (updated); Waiter/Supervisor guards intact.
- `e2e/supervisor-approvals/cross-role-visibility.spec.ts` — Cashier/Waiter have no Approvals
  (Cashier nav check updated to Floor).

## 5. Scope confirmation

No backend / schema / migration / seed / permission / Postman change. Queue and Receipts pages,
components, hooks, helpers, and tests preserved (not deleted, not redirected). No commit. No push.
