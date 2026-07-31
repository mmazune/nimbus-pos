# Cashier Floor-First Reconstruction — Prompt C1 Completion Report

**Canonical C1 record.** Shared Cashier Floor, Floor/Till/Me navigation, default-route
reconstruction, shared-shell alignment, table-selection URL state, legacy compatibility
boundaries, cross-role Floor parity, and executed responsive QA.

- **Date:** 2026-07-31
- **Classification:** **A. C1 COMPLETE / READY FOR C2**
- **Change surface:** frontend only. **No** backend / schema / migration / seed / permission /
  Postman change. **No commit. No push.**

---

## 1. Repository, branch, initial state

- Repository: `C:\Users\arman\Desktop\nimbus-pos` (the authoritative dirty worktree).
- Initial branch: `main`, ahead of `origin/main` by 11 commits.
- Initial HEAD: `9b374c39b8cc893a26c0dc374418ca008296a13c`
  (`9b374c3 docs(cashier): add pull-and-audit starting prompt`).
- Initial dirty worktree carried extensive pre-existing uncommitted work (Supervisor Approvals
  Prompt 5 closure, the C0 audit doc set, unrelated api/attendance/analytics/discounts spec work).
  **None of that pre-existing work was reset, restored, stashed, cleaned, or discarded.** All C1
  changes are additive/surgical on top of it. The C0 documentation commits are intact in history.
- Verified before editing: the 12 intentional shared-Floor deletions remain absent; no
  `pages/cashier/floor.tsx` / `pages/cashier/index.tsx` existed; `cashierRoutes` was
  Queue/Receipts/Till/Me; `getCashierLandingPath()` returned `/cashier/queue`; zero Cashier files
  imported `OperationalFloor`.

## 2. Documents read (mandatory context)

Root `CLAUDE.md` + `.claude/CLAUDE.md`; `PROGRESS.md`; `ai/AI_STATUS.md`; the full C0 audit set
(`ai/CASHIER_FLOOR_RECONSTRUCTION_{C0_REPO_VERIFICATION_REPORT,COMPONENT_AUDIT,ROUTE_AND_NAV_AUDIT,
CAPABILITY_MIGRATION_MATRIX,PERMISSION_AND_API_MATRIX,TEST_INVENTORY,GAP_REGISTER,DECISION}`);
`docs/cashier-ui-docs/*`; the shared-shell/shared-Floor source (`components/pos-shell/*`,
`components/floor/*`); the Waiter and Supervisor Floor screens/adapters/data-layers; `login.tsx`;
`lib/auth/role.ts`; `docs/TESTING_AND_QA.md`; the Prompt 3D/4D isolation tooling (`tools/qa/*`).

## 3. Shell architecture

**Previous:** `CashierShell` was already a thin adapter over the shared `OperationalShell`
(guard → header/readiness/bottomNav/idle slots), structurally identical to `SupervisorShell`.
**C1:** unchanged. Cashier remains a thin shared-shell consumer; the new Floor page composes the
existing `CashierShell` exactly like `till.tsx`/`me.tsx`. No header, clock, logout, idle timer,
bottom nav, or page container was duplicated. One idle handler mounts (shared
`OperationalIdleLogoutHandler` via the existing pass-through). No shell rework was required.

## 4. Navigation

- **Previous:** Queue / Receipts / Till / Me (4 items).
- **New:** **Floor / Till / Me** (3 items) — `lib/cashier/routes.ts`. Floor is the first item and
  uses the canonical `operationalIconNames.floor` (SquaresFour), the SAME icon name Waiter and
  Supervisor use for their Floor tab. The shared `OperationalBottomNav` computes
  `gridTemplateColumns: repeat(items.length, …)` so three items distribute correctly with no
  legacy four-item spacing assumption. Active state (`aria-current="page"`), keyboard focus, and
  mobile safe-area spacing are inherited unchanged from the shared primitive.
- Queue and Receipts are absent from visible navigation.

## 5. Default routing + login landing

- `pages/cashier/index.tsx` (new): `getServerSideProps` non-permanent redirect `/cashier` →
  `/cashier/floor` (mirrors `pages/waiter/index.tsx`).
- `getCashierLandingPath()` (`lib/auth/role.ts`) now returns `/cashier/floor` (was
  `/cashier/queue`) — this single change flips both `login.tsx` call sites (the authenticated
  redirect effect and the post-login `completeLogin` hard navigation).
- No redirect loops. Queue/Receipts are **not** redirected in C1.

## 6. Shared `OperationalFloor` integration + Cashier adapter

- `components/cashier/floor/CashierFloorScreen.tsx` (new) is the third `OperationalFloor` consumer
  (Waiter, Supervisor, Cashier). It renders the shared `OperationalFloor` with the canonical props
  (`branchName`, `readinessLabel`/`readinessTone` from the shared `useCashierReadiness` shift
  state, `tables`, `isLoading`, `error`, `selectedTableId`, `onSelectTable`, `onRetry`) and the
  shared `OperationalTableWorkspaceFrame` for the selected-table overlay. No forked Floor
  presentation.
- Data layer (new, self-contained, Cashier-namespaced, reusing shared endpoints + formatters):
  - `lib/cashier/floor-api.ts` — `loadCashierFloorData` = one bounded query domain
    (`GET /api/tables` + `GET /api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100` +
    `GET /api/reservations?pageSize=200`), modeled on `loadWaiterFloorData`. Cashier already holds
    `pos:table:read` / `pos:orders:read` / `pos:reservation:read`.
  - `lib/cashier/floor-model.ts` — `normalizeCashierFloorTables` emits the shared
    `OperationalTableViewModel` (same status derivation as Supervisor: backend table status +
    active-order/active-reservation cross-reference; shared `formatOperationalStaffIdentity`
    `First L.` + `sortOperationalTables`). **Carries no guest name / phone / email / payment /
    receipt field** by design.
  - `lib/cashier/floor-route.ts` — route constants (`CASHIER_FLOOR_ROUTE`, compatibility-route
    map) + pure URL helpers (`firstCashierQueryValue`, `buildCashierFloorQuery`).

## 7. Shared components changed

**None.** No file under `components/pos-shell/*` or `components/floor/*` was modified. Cashier
consumes them unchanged, so Waiter/Supervisor propagation risk is nil (re-verified live — see §12).

## 8. Table-selection URL model + selected-table presentation

- Model: `/cashier/floor?tableId=<id>`, standardised on the Receipts/Supervisor pattern —
  `router.push` for the first selection (one history entry), `router.replace` thereafter, both
  `shallow: true, scroll: false`; a local `selectionOverride` gives instant feedback and is reset
  on route change. Clearing removes `tableId`. Refresh restores selection; Back clears / Forward
  restores; invalid/cross-branch `tableId` renders a fail-safe **"Table unavailable"** state (no
  crash, no fabricated content).
- `components/cashier/floor/CashierSelectedTablePanel.tsx` (new) is the truthful C1 boundary and
  the architectural **mount point C2 replaces**. It shows verified table identity + canonical
  operational status and the copy **"Select a bill to continue."** It exposes **no** payment /
  close / split / refund / receipt / void / discount / transfer action, makes no claim a bill was
  resolved or that any balance is zero, and uses no milestone/developer language.

## 9. Queue / Receipts / Till / Me

- **Queue** (`/cashier/queue`) and **Receipts** (`/cashier/receipts`): pages, components, hooks,
  helpers, and tests are all **preserved and not redirected** — hidden compatibility routes
  reachable by direct URL only (retire Receipts→C4, Queue→C5). Verified live: both still load
  under the Cashier guard, with no shell nav link pointing at them.
- **Till** (`/cashier/till`) and **Me** (`/cashier/me`): unchanged, reachable, active-state
  correct, shared profile + shared logout intact. Verified live.

## 10. Readiness / performance

- Cashier Floor reuses the shared `useCashierReadiness` (shift+till) cache already mounted by the
  shell — no duplicate readiness fetch. Floor does not auto-open a Till and does not block
  rendering on settlement readiness (read-only visibility). No payment is possible in C1.
- Request budget (verified live by a network-capture spec): default Floor load makes **0**
  receipt-history requests, **0** per-table payment requests, **0** selected-order detail requests
  (before selection), and issues the bounded orders-list query at most once (deduped). No Queue or
  Receipts query is started in the background.

## 11. Role boundaries / privacy / accessibility

- **Boundaries (verified live):** Cashier Floor exposes no Find order/bill, transfer, void,
  discount-approval, or menu/order-entry control; table selection opens the settlement boundary,
  never the Waiter menu or the Supervisor control workspace. Waiter stays Floor/Reservations/Me;
  Supervisor stays Floor/Reservations/Approvals/Me.
- **Privacy (verified live):** Floor cards show no guest name, phone, email, payment reference, or
  receipt reference; the Floor body matches no phone-like digit run, email, or "receipt #".
- **Accessibility:** shared `<nav>` semantics + `aria-current` active tab; table cards are native
  `<button aria-pressed>` with visible focus and `data-operational-table-id` focus return; the
  selected panel is a labelled `<section>` with a "Back to Floor" control; status is conveyed by
  label text, not colour alone.

## 12. Validation (all executed)

| Gate | Result |
| --- | --- |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | **Pass** (`tsc --noEmit`, clean) |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` | **Pass** (no ESLint warnings/errors) |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` | **Pass** (`/cashier`, `/cashier/floor` registered; Queue/Receipts still built) |
| `npx tsx apps/web/scripts/shell-assertions.ts` | **Pass** (updated for Floor/Till/Me) |
| `npx tsx apps/web/scripts/floor-assertions.ts` | **Pass** (extended to Cashier consumer) |
| `npx tsx apps/web/scripts/cashier-c1-assertions.ts` | **Pass** (all C1 static invariants) |
| Playwright `e2e/cashier-floor/` × 4 viewports | **88/88 passed** (22 tests × 1024/1366/1440/1920) |
| Playwright cross-role regression (Waiter/Supervisor/Cashier) × 4 viewports | **40/40 passed** |
| `GET http://localhost:4001/api/health` (isolated) | `{"status":"ok","db":"ok"}` |
| `git diff --check` | Clean (only benign LF→CRLF notices) |

**Browser QA executed against an ISOLATED disposable stack** (never shared Neon): local Docker
`postgres:16` `nimbus-c1-qa` on `:55432` (DB `nimbus_c1_qa`) → `prisma migrate deploy` + `db:seed`
+ `db:demo:import`; isolated API `node dist/main.js` on `:4001` with an explicit
`DATABASE_URL`/`DIRECT_DATABASE_URL` pointing at the Docker DB (overriding the shared-Neon `.env`);
web `next start -p 3100` built with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4001`. Isolation
verified by a READ before any test (44 tables, 107 active orders from the disposable branch).
Stack fully torn down afterward (processes killed, container removed). Full evidence:
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`.

## 13. Files

**Created (frontend):**
- `apps/web/src/pages/cashier/floor.tsx`
- `apps/web/src/pages/cashier/index.tsx`
- `apps/web/src/components/cashier/floor/CashierFloorScreen.tsx`
- `apps/web/src/components/cashier/floor/CashierSelectedTablePanel.tsx`
- `apps/web/src/components/cashier/floor/index.ts`
- `apps/web/src/lib/cashier/floor-api.ts`
- `apps/web/src/lib/cashier/floor-model.ts`
- `apps/web/src/lib/cashier/floor-route.ts`

**Created (tests/assertions):**
- `apps/web/scripts/cashier-c1-assertions.ts` + `apps/web/scripts/tsconfig.cashier-c1-assertions.json`
- `apps/web/e2e/cashier-floor/{navigation-and-default-route,shared-floor-parity,table-selection-routing,hidden-legacy-routes,till-and-me-regression,role-boundaries,responsive,performance-request-count}.spec.ts`

**Created (docs):** this report; `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`;
`ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C2.md`; plus doc updates (§below).

**Modified:**
- `apps/web/src/lib/cashier/routes.ts` (nav Floor/Till/Me)
- `apps/web/src/lib/auth/role.ts` (`getCashierLandingPath()` → `/cashier/floor`)
- `apps/web/scripts/shell-assertions.ts`, `apps/web/scripts/floor-assertions.ts` (C1 invariants)
- `apps/web/e2e/supervisor-prompt3/regression.spec.ts`,
  `apps/web/e2e/supervisor-prompt3/role-boundaries.spec.ts`,
  `apps/web/e2e/supervisor-approvals/cross-role-visibility.spec.ts` (updated to the new Cashier nav)
- Documentation: `CLAUDE.md`, `PROGRESS.md`, `ai/AI_STATUS.md`,
  `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`, `docs/cashier-ui-docs/*`, `docs/DOCUMENT_INDEX.md`,
  `docs/REPOSITORY_MAP.md`, `docs/UI_SYSTEM.md`, `docs/ROLE_JOURNEYS.md`, `docs/ROLE_CAPABILITY_MATRIX.md`,
  `docs/DECISIONS.md`, `docs/TESTING_AND_QA.md`, `docs/KNOWN_LIMITATIONS.md`.

**Removed:** none.

**Backend / schema / migration / seed / permission / Postman changes:** none.

## 14. Remaining C2 gaps / readiness

C1 deliberately does not implement: table→order resolution (zero/one/multiple payable orders),
settlement, payment, order close, receipts/receipt context, Find bill, or Queue/Receipts
retirement. The `CashierSelectedTablePanel` is the mount point C2 replaces with the canonical
settlement workspace (reusing `CashierCheckoutPreview` + existing payment/split/close logic). The
`CashierTransferTablePanel` remains a scope violation for the new Floor architecture (retire in a
later phase — see gap register); it is not imported by any C1 Floor file and was not deleted
because the current Queue workflow still references it. **Ready for C2.**

## 15. No-commit / no-push confirmation

No `git commit` and no `git push` were performed. The working tree remains dirty with all prior
work preserved plus the additive C1 changes above.
