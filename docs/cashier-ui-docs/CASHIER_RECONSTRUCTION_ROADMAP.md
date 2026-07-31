# Cashier Floor-First Reconstruction Roadmap

## Total prompt count

The reconstruction is **seven prompts total**, numbered **C0 through C6**.

Do not combine removal, financial migration, and final QA into one oversized pass. Each
prompt has an independent completion gate and report.

## C0 — Pull, reconcile, and current-worktree audit

**Type:** documentation and verification only.

Objectives:

- fetch and fast-forward the canonical documentation branch;
- verify the dirty local worktree remains intact;
- read the new canonical Cashier docs;
- audit the actual current Cashier routes, shell, Queue, Receipts, payment, split, Till,
  refund, Me, tests, and permissions;
- map existing components to the new architecture;
- confirm the exact implementation sequence;
- update local canonical docs to record the locked Floor/Till/Me decision;
- create the current-worktree gap register and C1 implementation prompt.

No runtime code, database, permission, migration, or Postman change.

**Completion result:** current code disproves or confirms every architectural assumption;
C1 is unblocked.

## C1 — Shared Cashier Floor, shell, navigation, and routing

**Status: COMPLETE (2026-07-31) — A. C1 COMPLETE / READY FOR C2.** Delivered nav Floor/Till/Me,
`/cashier/floor` default (+ `/cashier`→`/cashier/floor` redirect), Cashier as the third shared
`OperationalFloor` consumer, `?tableId=` selection state, and a read-only settlement boundary.
One deviation from the objective list below, per the authorized C1 spec: Queue/Receipts are kept
as hidden compatibility routes **without** legacy redirects (redirects are deferred to C4/C5 with
their capability migration). Browser QA executed (88/88 cashier + 40/40 cross-role × 4 viewports).
See `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.

Objectives:

- make Cashier the third consumer of the shared operational shell and `OperationalFloor`;
- add `/cashier/floor`;
- make Cashier default route Floor;
- change visible navigation to exactly Floor/Till/Me;
- add a thin Cashier Floor adapter;
- preserve matching Waiter/Supervisor Floor presentation;
- implement URL-backed table selection foundation;
- add temporary legacy redirects for Queue/Receipts without deleting working components;
- add shared-Floor parity tests across all three roles.

No payment-workspace rewrite in C1.

**Completion result:** Cashier lands on the shared Floor and can select a table into a
placeholder/canonical workspace boundary while Queue/Receipts capabilities remain
temporarily reachable for migration safety.

## C2 — Table-to-order resolution and settlement workspace foundation — ✅ COMPLETE (2026-07-31)

**Result:** A — C2 COMPLETE / READY FOR C3. Delivered `lib/cashier/bill-resolution.ts` (fail-closed
classifier), `bill-query-keys.ts`, `CashierBillResolutionPanel`, `CashierBillSelector`,
`CashierSettlementWorkspace` (read-only, reuses checkout primitives), and `CashierFindBillDialog`;
canonical `?tableId=&orderId=` URL state; zero/one/multiple handling with no silent first-pick.
See `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`.

Objectives:

- implement table selection → canonical payable order resolution;
- handle zero, one, and multiple payable orders safely;
- build the Cashier settlement master-detail/full-screen workspace;
- preserve table/order URL state, refresh, Back, and Forward;
- integrate order detail, item lines, totals, discounts, payment read state, and bill split
  read state;
- implement readiness/Till/payment preflight;
- fail closed on unknown payment or readiness state;
- create the `Find bill` bounded lookup foundation for non-table cases.

No removal of old Queue/Receipts pages yet.

**Completion result:** physical-table and direct-lookup orders open the same canonical
settlement workspace with truthful read state.

## C3 — Payment, split settlement, partial payment, and close integration

Objectives:

- move/reuse existing payment entry inside the settlement workspace;
- reuse split-resolution and allocation logic;
- support existing verified payment methods;
- support partial payment and outstanding balance;
- preserve idempotency and duplicate-submit prevention;
- expose Close only when canonical financial/order state permits it;
- update shared Floor, Waiter Floor, Supervisor Floor, selected order, and payment caches
  narrowly;
- run live disposable-database payment/close QA.

No standalone Receipts removal in C3.

**Completion result:** Cashier can settle and close a selected order entirely from the
Floor-selected workspace.

## C4 — Receipt, reprint, delivery, closed-order, and refund integration

Objectives:

- move/reuse receipt preview and receipt actions into the selected workspace;
- support initial print, reprint, and verified delivery channels;
- support receipt/order lookup through Find bill;
- integrate existing eligible refund workflow from selected closed order/receipt context;
- preserve audit, permission, and eligibility boundaries;
- redirect legacy `/cashier/receipts` to the new context;
- remove obsolete Receipts page/components only after reference and executable QA gates.

**Completion result:** every existing receipt/refund responsibility is reachable without a
Receipts tab or standalone Receipts page.

## C5 — Queue retirement and Find bill completion

Objectives:

- migrate remaining Queue responsibilities into shared Floor, settlement workspace, and
  bounded Find bill;
- support takeaway, tableless, direct reference, partially-paid, failed/pending-payment,
  and closed-order cases;
- preserve branch scoping, bounded pagination/search, and performance;
- redirect legacy `/cashier/queue` safely;
- remove obsolete Queue page/components only after reference and executable QA gates;
- verify no initial Floor + Queue duplicate request pattern remains;
- update demo walkthrough and known limitations.

**Completion result:** no visible or standalone Queue remains; all legitimate exception
paths open the canonical settlement/receipt workspace.

## C6 — Integrated live QA, cross-role regression, and Cashier closure

Objectives:

- execute a continuous Cashier journey on fail-closed disposable infrastructure;
- execute payment, split, partial payment, close, print/reprint, refund, Till, Find bill,
  tableless, and takeaway scenarios;
- run all four viewports;
- verify shared Floor parity with Waiter/Supervisor;
- run Waiter and Supervisor regressions;
- verify role, privacy, payment, and branch boundaries;
- reconcile all Cashier limitations;
- create final demo script, demo-data register, evidence index, and canonical completion
  report;
- prove shared Neon unchanged;
- clean up disposable infrastructure.

**Completion result:** Cashier reconstruction closed as demo-ready or honestly classified.
Manager reconstruction remains blocked until C6 passes.

## Phase dependency graph

```text
C0 audit/docs
  ↓
C1 shared Floor/nav/routes
  ↓
C2 settlement workspace foundation + Find bill foundation
  ↓
C3 payment/split/close
  ↓
C4 receipt/reprint/refund + Receipts retirement
  ↓
C5 Queue retirement + exception lookup completion
  ↓
C6 final integrated QA and closure
```

## Scope locks across all prompts

- visible Cashier nav remains Floor/Till/Me;
- Queue and Receipts are not restored as tabs;
- shared Floor is never forked;
- guest names never appear on Floor cards;
- payment and close remain Cashier-only;
- working financial logic is reused, not rewritten without evidence;
- no permission change is silent;
- no shared-Neon destructive QA;
- no Manager UI before C6 closure;
- no commit/push unless explicitly instructed.

## Expected artifacts per prompt

Each phase must create:

- a focused completion report;
- updated gap/status documentation;
- focused assertions/tests;
- honest QA evidence;
- the next prompt only after the current gate passes.
