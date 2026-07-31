# Cashier Floor-First Reconstruction — Test & Performance Inventory (Prompt C0)

**Status:** Audit only. No runtime code, tests, migrations, or seed were run or modified.
**Scope:** Gap-analysis of existing test coverage and request/cache topology against
`docs/cashier-ui-docs/CASHIER_TEST_PLAN.md` and the "Performance boundaries" section of
`docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md`, ahead of the Cashier Queue→Floor-first
reconstruction (C1–C6).

---

## Part 1 — Test inventory

### 1.1 Cashier-specific Jest/unit tests (apps/web)

**None exist.** `apps/web/package.json` has `"test": "echo \"No frontend tests yet\""` — there is
no Jest/unit test runner wired up for the web app at all (matches `CLAUDE.md` §4: "The web app has
no automated tests yet"). A repo-wide search for `*.spec.ts(x)` / `*.test.ts(x)` under `apps/web`
referencing "cashier" (case-insensitive) returned zero files. This applies to every Cashier
sub-area: queue, receipts, till, refunds, resolution (split/merge/move/transfer), checkout.

### 1.2 Cashier Playwright/e2e specs

**Confirmed: none exist.** `apps/web/e2e/` contains exactly three top-level suites:
`supervisor-prompt3/`, `supervisor-reservations/`, `supervisor-approvals/` (plus a git-ignored
`.evidence/` output dir). No `*cashier*` directory or spec file exists anywhere under
`apps/web/e2e/`.

Cashier is touched only **incidentally**, inside Supervisor suites, as a cross-role smoke check
(not a Cashier feature test):

- `apps/web/e2e/supervisor-prompt3/regression.spec.ts:14-26` — `"Cashier surfaces load: Queue,
  Receipts, Till"` — logs in as Cashier, clicks each of Receipts/Till/Queue, asserts no API-error
  banner. This is presence-only, not a behavior test.
- `apps/web/e2e/supervisor-prompt3/role-boundaries.spec.ts:12-19` — `"Cashier lands on Cashier
  Queue with the Cashier nav (Queue/Receipts/Till/Me)"` — asserts the **current Queue-first nav
  labels** and that no "find order" button exists for Cashier.
- `apps/web/e2e/supervisor-approvals/cross-role-visibility.spec.ts:11-16` — `"Cashier has its own
  nav and no Approvals"` — asserts a `queue` nav link exists and no `approvals` link.

**Important for C1–C6 scoping:** all three of the above specs hard-code assertions that will
become **false** once Floor-first nav ships (`Queue/Receipts/Till/Me` → `Floor/Till/Me`,
`/cashier/queue` default → `/cashier/floor` default, no "Queue" link). These are pre-existing
Supervisor-owned regression tests that the Cashier reconstruction will break and must update
in-place (not new coverage — an update obligation). `apps/web/playwright.config.ts` already
declares `PW_CASHIER_EMAIL`/`PW_CASHIER_PASSWORD` env vars and `uiLogin(page, "cashier")` is a
working fixture helper (`apps/web/e2e/supervisor-prompt3/fixtures.ts:15-18,36-59`), so the login
plumbing for Cashier already exists and is reusable — only Cashier-specific spec files are
missing.

### 1.3 Shared shell/Floor assertion tests

No dedicated unit or component tests exist for `OperationalFloor`, `OperationalShell`, or
`OperationalBottomNav` (no Jest runner, see 1.1). The only executable coverage is indirect, inside
`apps/web/e2e/supervisor-prompt3/floor.spec.ts`:

- `floor.spec.ts:4-13` — 4-tab nav assertion (Supervisor-specific: Floor/Reservations/Approvals/Me,
  no Orders tab).
- `floor.spec.ts:15-25` — shared toolbar search box + Supervisor-only "Find order" control +
  no-API-error assertion.
- `floor.spec.ts:27-36` — Find order dialog open/dismiss.

This is Supervisor-flavored (asserts the Supervisor-only sibling control), not a generic
shared-Floor-parity test. There is no cross-role visual/structural parity test today (e.g.
"toolbar/grid/cards/status-labels are pixel-for-pixel identical across Waiter/Supervisor/Cashier")
— this is exactly the "Shared Floor parity" section of the target test plan and is entirely
missing.

### 1.4 Waiter and Supervisor Floor Playwright specs (parity pattern reference)

- **Waiter:** no dedicated Waiter e2e directory exists. Waiter Floor is covered only inside
  Supervisor's cross-role regression: `supervisor-prompt3/regression.spec.ts:5-12` ("Waiter Floor
  loads with the Waiter nav") and `supervisor-prompt3/role-boundaries.spec.ts:5-10,21-28`
  (Waiter has no Find-order/Supervisor controls; Waiter is blocked from `/supervisor/floor`).
  `supervisor-reservations/waiter-visibility.spec.ts` covers Waiter's read visibility into
  Supervisor-created reservations (Floor overlay), not Waiter Floor itself.
- **Supervisor:** full suites exist and are the best available parity template —
  `apps/web/e2e/supervisor-prompt3/{floor,find-lookup,responsive,regression,role-boundaries,
  workspace-actions}.spec.ts` and `apps/web/e2e/supervisor-reservations/*.spec.ts` (9 files) and
  `apps/web/e2e/supervisor-approvals/*.spec.ts` (13 files). These establish the reusable patterns
  the Cashier suite should follow: a `fixtures.ts` per suite exporting `uiLogin`, API helper
  functions for self-contained QA data setup, `expectNoHorizontalOverflow`, and per-concern spec
  files (navigation/default-view, responsive, regression, role-boundaries/privacy,
  filters-pagination-routing, cross-role-visibility). `supervisor-prompt3/responsive.spec.ts` and
  `supervisor-approvals/responsive.spec.ts` / `responsive-closure.spec.ts` are the direct template
  for the Cashier viewport-matrix requirement.

### 1.5 API Jest tests for payment/split/close/receipt/Till/refund logic

| File | Coverage (describe/it summary) |
| --- | --- |
| `apps/api/src/modules/payments/payments.service.spec.ts` (39 `it`s) | Cash close (exact, overpay+changeDue, split-method), insufficient/overpayment rejection, close guards (NEW/VOIDED reject, pending-intent block, already-paid accounting), MOMO intent create/duplicate-idempotency/adapter success-failure, intent cancel (REQUIRES_ACTION/PENDING/SUCCEEDED-reject), webhook persist/dedupe/PAYMENT_FAILED emit, `getOrderPayments` (balance+404), manual-reference payment (create/duplicate externalTransactionId reject/VOIDED reject/auto-settle on full coverage), branch isolation (`should not find order from different branch`), audit.log + SSE emit on close. |
| `apps/api/src/modules/orders/orders.service.spec.ts` (26 `it`s) | Order create (dine-in/takeaway/invalid-table), get/list/filter, add/delete item + recalculation (+ CLOSED/VOIDED guards), full status-transition chain `sendOrder→markInKitchen→markReady→markServed→closeOrder` with invalid-transition rejections, **reservation auto-completion on close** (success + non-fatal-throw cases), `voidOrder` (NEW no-reason / IN_KITCHEN with-reason / post-kitchen-without-reason reject / SERVED+CLOSED reject). **No split-bill/merge/move-items/transfer-table coverage here** — see gap below. |
| `apps/api/src/modules/refunds/refunds.service.spec.ts` (16 `it`s) | Auto-complete refund below threshold, PENDING refund above threshold, 404 order/payment, amount-exceeds-balance reject, PIN-gated approval (valid/invalid PIN), reject approval of non-PENDING, list refunds for order, **post-close void** (valid PIN / 15-min-window reject / invalid-PIN reject / non-CLOSED reject), get-by-id (+404). |
| `apps/api/src/modules/tills/tills.service.spec.ts` (16 `it`s) | Open till (success, block-without-active-shift, block-duplicate-active-till-per-tillCode), safe drop (success, reject-on-closed-till, 404), reconcile (matched/SHORT/OVER variance, require-reason-on-mismatch, reject-on-closed), active-till lookups (return/null), branch-scoped queries, has-active-till-in-branch true/false. |
| `apps/api/src/modules/discounts/discounts.service.spec.ts` (~20+ `it`s) | Discount auto-approve/PENDING threshold (FIXED/PERCENTAGE), >100% reject, CLOSED/VOIDED/SERVED-order reject, approve/reject lifecycle incl. **concurrency** (`updateMany count 0` → ConflictException) for both approve and reject, HEAVY_DISCOUNT anomaly flag, manager-PIN verification on approval (valid/invalid). Feeds the payment-total math Cashier settlement will display. |
| `apps/api/src/modules/merchant-payments/merchant-payments.service.spec.ts` | `"MerchantPaymentsService (readiness model — not live PesaPal)"` — scaffold/readiness only, **not** the in-person Cashier settlement path; out of scope for C1–C6 unless the plan changes. |
| `apps/api/src/modules/public-commerce-payments/public-commerce-payments.service.spec.ts` | `"PublicCommercePaymentsService (scaffold — pending mobile-money)"` — public/online diner checkout scaffold, deferred per `CLAUDE.md` §18, not in-person Cashier scope. |

**Gap — no receipts module Jest coverage at all.** `apps/api/src/modules/receipts/` has
`receipts.controller.ts`, `receipts.module.ts`, `receipts.service.ts`, and three DTOs
(`receipt-history-query.dto.ts`, `reprint-receipt.dto.ts`, `send-receipt.dto.ts`) but **no
`receipts.service.spec.ts` or any other `.spec.ts` file**. The Cashier receipt-preview/
reprint/send UI (`apps/web/src/lib/cashier/receipts.ts`,
`apps/web/src/components/cashier/receipts/*`) rests entirely on an untested backend service.

**Gap — no Jest coverage for split-bill/merge/move-items/transfer-table at all.** These live in
`apps/api/src/modules/pos-handoff/` (`pos-handoff.controller.ts`, `pos-handoff.service.ts`, DTOs
`split-bill.dto.ts`, `merge-orders.dto.ts`, `transfer-table.dto.ts`, `move-items` DTO under
`dto/index.ts`) — **zero `.spec.ts` files exist in `apps/api/src/modules/pos-handoff/`**. This is
the backend the Cashier `CashierSplitBillPanel` / `CashierSplitItemsPanel` /
`CashierMergeOrdersPanel` / `CashierMoveItemsPanel` / `CashierTransferTablePanel` /
`CashierTransferServerPanel` components call into
(`apps/web/src/components/cashier/resolution/*`). Confirmed via `orders.controller.ts` and
`orders.service.spec.ts` — no split/merge/transfer/move references there; the logic is entirely in
the untested `pos-handoff` module.

### 1.6 Reusable QA-tooling patterns (`tools/qa/`)

| File | Role |
| --- | --- |
| `tools/qa/lib/isolation.mjs` | Explicit child-env construction (strips inherited DB/service env vars) + production/shared denylist (`assertDisposableTarget`). |
| `tools/qa/db-identity-preflight.mjs` | Fail-closed identity check via the API's own generated Prisma client (denylist + connect + disposable sentinel + required migration + demo-branch row) before any mutating process starts. |
| `tools/qa/run-isolated-api.mjs` | Launcher: build env → denylist → preflight → only then spawn `apps/api/dist/main.js`. |
| `tools/qa/reservation-live-matrix.mjs` | Env-driven live mutation matrix (Prompt 4D pattern), tags synthetic rows with a marker (`P4D-QA`), records pass/fail per case, writes JSON. |
| `tools/qa/approvals-live-matrix.mjs` | Same pattern for the four Approval domains (Prompt 5A): branch isolation, concurrency/duplicate-guard, required-reason, identity resolution. |

`tools/qa/README.md` documents the full recipe: disposable Neon branch → sentinel table →
git-ignored secret env file → `run-isolated-api.mjs` (fail-closed) → live-matrix script → isolated
web build (`NEXT_PUBLIC_API_BASE_URL` baked at build time) → Playwright against the isolated
stack → teardown (delete disposable branch). **This is the exact reusable pattern C3/C6 should
clone for a `payment-live-matrix.mjs` / `close-order-live-matrix.mjs` / `receipt-live-matrix.mjs`**
covering payment/close/receipt/refund/Till mutations against a disposable branch, following the
Prompt 4D/5A precedent rather than inventing new isolation machinery.

### 1.7 `apps/web/playwright.config.ts` — viewport projects

Read in full (`apps/web/playwright.config.ts:56-61`). Four projects are configured, matching the
target test plan's required matrix exactly:

```
vp-1024x768   → 1024×768
vp-1366x768   → 1366×768
vp-1440x900   → 1440×900
vp-1920x1080  → 1920×1080
```

All use `devices["Desktop Chrome"]` with an explicit `viewport` override. Other relevant config:
`fullyParallel: false`, `workers: 1` (serialized — matters because destructive specs share
table/order state), `retries: 0`, env-overridable timeouts
(`PW_TEST_TIMEOUT`/`PW_EXPECT_TIMEOUT`/`PW_ACTION_TIMEOUT`/`PW_NAV_TIMEOUT`), `baseURL` from
`PW_BASE_URL` (default `http://localhost:3100`), screenshots on failure only, trace
retain-on-failure, video off, and Windows GPU-stability launch flags. **No changes needed to this
file for C1–C6** — the viewport matrix is already correct and Cashier specs can run under the
existing config unmodified (point `testDir`/spec globs at a new `e2e/cashier-*/` directory the
same way the three existing suites coexist today).

---

## Part 2 — Missing coverage (mapped to roadmap phases)

Legend: ☐ = not present anywhere today (new test required); ⚠ = existing test asserts the
*old* Queue-first behavior and must be rewritten, not just extended.

### C1 — Shared Floor adoption / nav change
- ☐ Cashier shared-Floor parity tests (toolbar/search/grid/cards/status-labels/staff-formatting/
  breakpoints identical to Waiter & Supervisor at matching data state) — Part 1.3 confirmed this
  doesn't exist for any role pair today, not just Cashier.
- ☐ Three-role nav parity test (Waiter Floor/Reservations/Me, Supervisor
  Floor/Reservations/Approvals/Me, Cashier Floor/Till/Me — all sharing one shell/bottom-nav
  component).
- ☐ Floor/Till/Me navigation smoke test for Cashier (replaces the Queue/Receipts/Till/Me nav
  check).
- ⚠ `supervisor-prompt3/role-boundaries.spec.ts:12-19` and
  `supervisor-approvals/cross-role-visibility.spec.ts:11-16` assert the Cashier nav contains
  "Queue" — must be updated to assert Floor/Till/Me once C1 ships, or they will start failing
  (false negative regression signal, not a real defect).

### C2 — Table-to-order resolution / table card contract
- ☐ Zero-table-order, one-active-payable-order, multiple-payable-order-selector tests.
- ☐ Split-child-order and merged-order-context resolution tests.
- ☐ Partially-paid / failed-pending-payment / terminal-order-only / reservation-without-order /
  stale-Floor-summary / cross-branch-order-rejection cases (full "Table selection matrix" from the
  test plan — none exist).
- ☐ Table card contract test (no guest names, no payment references, no per-table payment fetch,
  no Cashier-only card fork) — Part 3 below shows the *current* Queue-based code already avoids a
  per-row payment fetch, but there is no executable assertion locking that in for the new Floor
  card.

### C3 — Find bill
- ☐ Find bill lookup matrix: order number, order ID/reference, receipt reference, table,
  takeaway, tableless, partially-paid, pending-payment, failed-payment, closed-order,
  missing-result, cross-branch-result, pagination/max-page-size, URL persistence.
- ☐ Test that Find bill opens the *same* settlement/receipt workspace rather than a parallel page.
- (QA tooling) ☐ A `find-bill-live-matrix.mjs` on the `tools/qa/` pattern (Part 1.6) for the
  bounded-lookup backend contract, if Find bill is backed by a new/adjusted endpoint.

### C4 — Settlement workspace relocation (payment/close/receipt in new location)
- ☐ "Payment workspace in new location" tests — the existing payment/split/close/receipt logic
  (Parts 1.5, 1.6) is well-covered at the *service* layer but has never been exercised through a
  Floor-anchored UI; every current payment-flow assertion is Queue-page-shaped
  (`CashierQueueScreen` → `CashierCheckoutPreview`) and will need to be re-authored against the
  new selected-table/selected-order workspace.
- ☐ Close-to-receipt flow test (order close → receipt panel opens automatically in the same
  workspace, no navigation to a separate Receipts route).
- ☐ Reprint tests: reprint from a selected closed order (Floor-reached) and reprint via Find bill
  receipt lookup — reuse `CashierReceiptReprintDialog` (already built,
  `apps/web/src/components/cashier/receipts/CashierReceiptReprintDialog.tsx`) but no e2e exists
  for either entry path today.
- ☐ Backend live-matrix for payment/close/receipt against a disposable branch
  (`tools/qa/` pattern, Part 1.6) — none exists yet for Cashier; the closest precedent is
  `reservation-live-matrix.mjs`/`approvals-live-matrix.mjs`.
- ☐ Jest coverage for `pos-handoff` (split/merge/move/transfer) and `receipts` — currently **zero**
  (Part 1.5 gaps). This should land before or alongside C4 since the settlement workspace directly
  exercises both.

### C5 — Legacy route removal / redirects
- ☐ `/cashier` → `/cashier/floor` redirect test.
- ☐ `/cashier/queue` and `/cashier/receipts` legacy-redirect-without-loop tests, including
  preserved `tableId`/`orderId`/`receiptId`/lookup-state context through the redirect.
- ☐ Reference-search test/gate proving no remaining code path requires the standalone Queue or
  Receipts pages before their components are deleted (the architecture doc explicitly requires
  "reference searches and executable regression" before removing obsolete components —
  `docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md` "Legacy route policy" section).
- ☐ Role-guard test: Waiter/Supervisor denied access to Cashier settlement routes.

### C6 — Final closure
- ☐ Cross-role Floor update test: a Cashier payment/close mutation is reflected on Waiter's and
  Supervisor's Floor view via the existing narrow-invalidation pattern (no broad invalidation —
  Part 3 confirms today's Cashier code already invalidates narrowly, but there is no cross-role
  *observation* test proving Waiter/Supervisor actually see the update).
- ☐ Full four-viewport executed Playwright totals, API/Jest totals, live payment/close/receipt/
  refund matrix results, shared-Floor parity screenshots, request-count evidence, shared-Neon
  before/after evidence, cleanup proof — none of this exists yet because none of C1–C5's
  prerequisite tests exist yet.

---

## Part 3 — Cache/performance topology

### 3.1 What fires on Cashier login/startup today

Every Cashier page is wrapped in `CashierShell` (`apps/web/src/components/cashier/shell/
CashierShell.tsx:15-30`), which always renders `useCashierReadiness()`
(`apps/web/src/lib/cashier/readiness.ts:53-71`). That hook fires exactly two queries, gated on
`accessToken && branchId && isAuthenticated && isCashier`:

- `["cashier", "active-shift", branchId]` → `getCashierActiveShift`
- `["cashier", "active-till", branchId]` → `getCashierActiveTill`

`/api/auth/me` itself is resolved once, centrally, by `AuthProvider`
(`apps/web/src/lib/auth/AuthProvider.tsx`) — it is not called from any Cashier-specific file
(confirmed: no `auth/me` string anywhere under `apps/web/src/lib/cashier`), so Cashier does not
introduce a duplicate `/auth/me` call.

Startup total = 1 (`/auth/me`, shared shell bootstrap) + 2 (readiness: shift + till) + whatever the
landing page itself fires (see 3.2). For today's default landing page, Queue, that adds the
`ordersQuery` (1) plus, once a row auto-selects (`CashierQueueScreen.tsx:89-93` auto-selects
`visibleOrders[0]` the instant the list resolves), `detailQuery` + `selectedPaymentsQuery` (2 more)
— i.e. **≈6 Cashier-specific requests** (2 readiness + 1 list + 2 detail/payments) plus `/auth/me`
and health/session bootstrap calls from the shared shell, which is consistent with (and does not
contradict) `CLAUDE.md`'s "~9 requests" figure for Cashier startup. No direct instrumentation/
request-id log output was inspected to get an exact number — this is inferred from the query graph,
not measured live (no test run was performed per this audit's read-only constraint).

### 3.2 Per-page mount queries (today's Queue-first routes)

| Page | Component | Queries fired on mount |
| --- | --- | --- |
| `/cashier/queue` | `CashierQueueScreen.tsx:42-117` | `orders` (list, pageSize 100) always; `order-detail` + `order-payments` (`...,"selected"`) once a row auto-selects or is clicked |
| `/cashier/receipts` | `CashierReceiptsScreen.tsx:77-137` | `receipt-candidate-orders` (CLOSED, pageSize 20) always; `receipt` + `receipt-history` only when `router.query.receiptId` is present |
| `/cashier/till` | `CashierTillScreen.tsx:128-142` | `till-detail` + `till-summary`, both gated on `activeTillId` (i.e. only fire once `readiness.tillQuery` has resolved an active till) |
| `/cashier/me` | not inspected in detail (shared profile primitives per `CLAUDE.md` §11) | shared `Me` queries only |

**Queue and Receipts never mount together** — confirmed: they are separate Next.js Pages Router
routes (`pages/cashier/queue.tsx`, `pages/cashier/receipts.tsx`), each rendering a distinct screen
component; Next.js unmounts the previous page's component tree on route change, so there is no
overlapping fetch/prefetch between them today. No shared prefetch call was found in either file.

### 3.3 N+1 / per-row fetch check

**No N+1 pattern found.** Both `CashierQueueScreen.tsx:66-69` and
`CashierReceiptsScreen.tsx:97-104` build a `paymentState`/`paymentsByOrder`/`receiptsByOrder` map
via `useMemo(() => ({ data: new Map(), errors: new Map(), ... }), [])` that is **always empty** —
there is no `.map()` + `useQuery` loop anywhere in `apps/web/src/components/cashier` (grep
confirmed zero matches for `useQuery` inside any per-row render path). Only the single *selected*
row gets a detail/payments fetch. This already satisfies the target architecture's "no per-table
payment fetch" / "no one-payment-query-per-table" requirement.

Note as a secondary (non-blocking) observation: because `paymentState`/`paymentsByOrder` are
permanently-empty static maps, the "some payment summaries did not load" / "some receipt details
did not load" warning banners (`CashierQueueScreen.tsx:236-240`,
`CashierReceiptsScreen.tsx:277-281`) can never actually trigger — this reads as either dead/
vestigial code or an incomplete feature, not a performance problem, but worth flagging since the
Floor-first card contract (Part 2, C2) will need a real answer for how/whether table cards obtain
any payment-exception indicator.

### 3.4 Broad-invalidation check

**No broad (`invalidateQueries()` with no key filter) calls found anywhere in `apps/web/src`** —
a repo-wide grep for `invalidateQueries\(\s*\)` (empty-argument form) returned zero matches. Every
Cashier `invalidateQueries` call is scoped by an explicit `queryKey` array:

- `CashierQueueScreen.tsx:159-160` — `["cashier","order-payments",branchId]`,
  `["cashier","orders",branchId]`
- `CashierReceiptsScreen.tsx:168-171` — `["cashier","receipt",branchId,receiptId]`,
  `["cashier","receipt-history",branchId,receiptId]`,
  `["cashier","receipt-candidate-orders",branchId]`,
  `["cashier","order-payments",branchId,receiptId]`
- `CashierTillScreen.tsx:206-209` — `["cashier","active-shift",branchId]`,
  `["cashier","active-till",branchId]`, `["cashier","till-detail",branchId]`,
  `["cashier","till-summary",branchId]`
- `CashierRefundPanel.tsx:161-167` — `["cashier","order-refunds",branchId,orderId]`,
  `["cashier","order-detail",branchId,orderId]`, `["cashier","order-payments",branchId,orderId]`,
  `["cashier","receipt",branchId,orderId]`, `["cashier","receipt-history",branchId,orderId]`,
  `["cashier","receipt-candidate-orders",branchId]`, `["cashier","orders",branchId]`

This is compliant with the target plan's "no broad invalidation storm" requirement today.

### 3.5 Duplicate selected-order detail — one real finding

`CashierRefundPanel.tsx:67-73` and `:75-81` fetch order detail and order payments under the keys
`["cashier","order-detail",branchId,orderId,"refund"]` and
`["cashier","order-payments",branchId,orderId,"refund"]` — a **different cache key** (trailing
`"refund"` tag) than the Queue screen's own `["cashier","order-detail",branchId,selectedOrderId]`
(`CashierQueueScreen.tsx:103-109`) and `["cashier","order-payments",branchId,selectedOrderId,
"selected"]` (`CashierQueueScreen.tsx:111-117`) for the *same order*. When a Cashier opens the
refund panel for the currently-selected Queue order, this causes **two independent fetches of the
same order detail and the same order payments** (no cache sharing, because the keys differ) rather
than reusing the already-loaded Queue selection data.

This is a direct, if minor, violation of `CASHIER_ARCHITECTURE.md`'s explicit performance
constraint "no duplicate selected-order detail" and of the test plan's "Reject regressions
including: ... duplicate selected-order detail". It is pre-existing in the current Queue-based
build (not introduced by the reconstruction), but the Floor-first settlement workspace (C4) should
either unify these keys or pass the already-fetched detail/payments down as props instead of
re-querying, to avoid carrying the duplication forward.

### 3.6 Other observations relevant to C1–C6 scoping

- `CashierQueueScreen.tsx:46-54` fetches with `pageSize: 100` for both the default active-payable
  filter and the closed-today filter — this is the Queue page's own list size, not a Floor-load
  concern today (Queue and Floor are different routes), but it is a pattern the new Cashier Floor
  page must **not** inherit as a "list all orders" prefetch; the Floor card contract should stay
  on the existing bounded Floor-summary contract shared with Waiter/Supervisor instead.
- Multiple components call `useCashierReadiness()` independently (`CashierShell`,
  `CashierQueueScreen`, `CashierTillScreen`) with identical query keys
  (`["cashier","active-shift",branchId]` / `["cashier","active-till",branchId]`). This is **not**
  a duplicate-network-request bug — React Query dedupes concurrent subscribers to an identical
  `queryKey` into one shared cache entry/one in-flight request — but it is worth calling out
  explicitly in C1 so a future refactor doesn't accidentally diverge the keys (which would
  silently reintroduce duplicate requests, as already happened once for the refund-panel keys in
  3.5).
- No `useMutation` calls exist in the Cashier payment/till/receipt/refund write paths inspected
  (`CashierTillScreen.tsx`, `CashierReceiptsScreen.tsx`, `CashierRefundPanel.tsx`,
  `CashierCheckoutPreview.tsx`) — all writes are plain async functions with manual
  `try/catch`/`setState` loading flags, followed by an explicit narrow `refreshXState()` call. This
  is a consistent, deliberate pattern across the module and should be preserved rather than
  introduced piecemeal as `useMutation` in the reconstruction, to avoid two different mutation
  idioms coexisting.

---

## Files referenced in this audit (for follow-up)

- `docs/cashier-ui-docs/CASHIER_TEST_PLAN.md`, `docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/supervisor-prompt3/{fixtures,floor,regression,role-boundaries}.spec.ts`
- `apps/web/e2e/supervisor-approvals/cross-role-visibility.spec.ts`
- `apps/web/src/components/cashier/shell/{CashierShell,CashierSessionGuard}.tsx`
- `apps/web/src/lib/cashier/readiness.ts`
- `apps/web/src/components/cashier/queue/{CashierQueueScreen,CashierCheckoutPreview}.tsx`
- `apps/web/src/components/cashier/receipts/CashierReceiptsScreen.tsx`
- `apps/web/src/components/cashier/till/CashierTillScreen.tsx`
- `apps/web/src/components/cashier/refunds/CashierRefundPanel.tsx`
- `apps/web/src/components/cashier/resolution/*` (split/merge/move/transfer panels)
- `apps/api/src/modules/{orders,payments,refunds,tills,discounts}/*.service.spec.ts`
- `apps/api/src/modules/{receipts,pos-handoff}/*` (no `.spec.ts` present in either)
- `tools/qa/{README.md,lib/isolation.mjs,db-identity-preflight.mjs,run-isolated-api.mjs,
  reservation-live-matrix.mjs,approvals-live-matrix.mjs}`
