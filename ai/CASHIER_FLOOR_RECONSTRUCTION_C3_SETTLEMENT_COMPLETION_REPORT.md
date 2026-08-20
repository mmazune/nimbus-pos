# Cashier Floor-First Reconstruction — Prompt C3 Completion Report

**Payment Collection · Partial & Split Payment Execution · Order Close · Fail-Closed Settlement**

- **Date:** 2026-08-20
- **Scope:** Frontend-only. **No backend / schema / migration / seed / permission / Postman change.**
- **Classification:** **A — C3 COMPLETE / READY FOR C4** (see §Final classification).
- **Commit/push:** ⛔ None. All changes left uncommitted in the working tree for review.

---

## 1. Repository path

`C:\Users\arman\Desktop\nimbus-pos` (canonical; this pass executed in the QA sandbox mirror at
`/home/claude/nimbus-pos`). The forbidden stale path `…\NIMBUS\nimbus-pos` was never used.

## 2. Initial branch and HEAD

- Branch: `main`.
- HEAD: `e05d944` — *feat(cashier,supervisor): Cashier Floor-First C0-C2 + Supervisor Approvals reconstruction*.

## 3. Initial dirty worktree

The worktree carried extensive uncommitted work from the Aug-2026 rebrand + role-QA wave and the
Cashier C0–C2 wave. **All of it was preserved.** C3 is additive on top of C2; the only pre-existing
files edited are listed in §14 and every edit is scoped to the C3 objective.

## 4. Documents read

`ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C3.md` (the spec), `docs/cashier-ui-docs/`
(`CASHIER_ARCHITECTURE`, `CASHIER_COMPONENT_REUSE_MAP`, `CASHIER_RECONSTRUCTION_ROADMAP`,
`CASHIER_API_MATRIX`, `CASHIER_LIFECYCLE`, `AGENTS`, `README`), the C2 completion report + QA
evidence index, root `CLAUDE.md` / `.claude/CLAUDE.md`, and the C2 code being extended
(`components/cashier/floor/*`, `lib/cashier/{bill-resolution,bill-query-keys,order-state,
payment-validation,payments,resolution,resolution-validation,idempotency,readiness}.ts`), the
existing verified checkout/split primitives (`components/cashier/checkout/*`,
`components/cashier/resolution/*`, `components/cashier/queue/CashierCheckoutPreview.tsx`), and
`lib/pos-shell/idempotency.ts`. Backend contracts were read (not changed):
`apps/api/src/modules/payments/{payments.service,payments.controller,dto/close-order.dto}.ts`,
`apps/api/src/modules/orders/orders.service.ts`.

## 5. Architecture — a mount point, not a rewrite

C3's central decision is that **nothing financial was written from scratch.** The C2 read-only
workspace gains one new child, `CashierSettlementActions`, whose whole job is to compose primitives
that were already built, shipped and verified on the Queue compat path:

```
CashierFloorScreen (C1/C2)
└─ CashierBillResolutionPanel (C2)            zero / one / many payable bills
   └─ CashierSettlementWorkspace (C2 + C3)    ONE canonical settlement surface
      ├─ Bill / Totals / Payment state / Settlement readiness / History   (C2 reads)
      └─ Settlement  ── CashierSettlementActions            ◄── NEW (C3)
                        ├─ CashierPaymentPanel              (existing, unchanged)
                        │   ├─ CashierPaymentMethodSelector / AmountField / ManualReferenceFields
                        │   ├─ CashierPaymentBlockedBanner   (fail-closed reasons)
                        │   ├─ CashierPaymentResultNotice    (truthful success/failure)
                        │   ├─ CashierPaymentHistory
                        │   └─ CashierCloseOrderPanel        (truthful close state)
                        └─ CashierResolutionPanel variant="split-only"   ◄── additive prop
                            ├─ CashierSplitBillPanel        (existing, unchanged)
                            └─ CashierSplitItemsPanel       (existing, unchanged)
```

`CashierAdvancedResolutionPanel` (merge / move items / transfer table) is **not mounted** on the
Floor path — transfer is Supervisor-owned and merge/move are order handoff, not settlement. The
legacy Queue checkout preview is untouched and keeps the default `variant="full"`.

## 6. Payment collection (spec §2.1)

Cash and the four manual/stub reference methods (card, MTN, Airtel, bank) are collected through the
unchanged `CashierPaymentPanel`. The panel's own `validateCashierPaymentInput` remains the single
gate; C3 added no second validation path and no second money model.

Method routing (unchanged, verified live):

| Method | Endpoint | Effect |
| --- | --- | --- |
| Cash | `POST /api/pos/orders/:id/close` | Settles **and** closes in one call. Requires backend status `SERVED`. |
| Card / MTN / Airtel / Bank | `POST /api/payments/manual-reference` | Records an operator-entered external reference. A payment that clears the balance auto-settles the order server-side. |

## 7. Fail-closed readiness (spec §2.1, §4)

Settlement is blocked — with a truthful reason in `CashierPaymentBlockedBanner` — whenever:

- the shift does not read `active` (this covers `loading`, `unavailable`, `failed` **and**
  `inactive`, because the check is `readiness.shift.status !== "active"`);
- cash is selected and the till does not read `active`. **"Owned by another user" is handled for
  free**: `GET /api/tills/active` returns only the OPEN till whose `operatorUserId` is the actor, so
  another operator's till is simply absent → `inactive` → blocked;
- the canonical payment summary has not resolved (`paymentUnavailable || isLoading` is propagated
  from the workspace as a hard block);
- the order is terminal (CLOSED / VOIDED);
- a provider intent is PENDING / REQUIRES_ACTION;
- the amount is missing, malformed, ≤ 0, or exceeds the outstanding balance;
- cash is selected and the amount ≠ outstanding, or the order status is not `SERVED`.

A **terminal bill renders no settlement form at all** — `CashierSettlementActions` returns a
truthful notice instead of a disabled form, so there is nothing to fumble into.

## 8. Partial payment and remaining balance (spec §2.2)

Outstanding always comes from the canonical backend summary
(`getCashierOutstandingAmount` → `order.payment.outstanding ?? order.total`, where `outstanding` is
`remainingBalance` from `GET /pos/orders/:id/payments`). The amount field prefills to that value and
re-prefills whenever it changes. **No optimistic total exists anywhere on this path**: the panel's
"After this payment, remaining balance will be X" line is explicitly labelled as a projection, and
the *actual* numbers only ever change after an awaited re-read (§10).

Verified live: a 213,600 bill part-paid `CARD:100,000` → status stays `SERVED`, `totalPaid
100000.00`, `remainingBalance 113600.00`, badge **Partially paid**; the cash field then prefilled to
113,600 and the close settled the remainder.

## 9. Split settlement (spec §2.3)

- **Split bill** (`POST /pos/orders/:id/split-bill`) records equal/custom allocation groups in
  `metadata.splitBill`. The panel states plainly that it is *metadata only*, creates **no** child
  orders, and that payments still attach to the parent. Verified live on a 304,400 bill split three
  ways (`allocated "304400.00"`), and one group was then collected as a partial payment
  (`BANK_TRANSFER:101,466.66` → remaining 202,933.34).
- **Split items** (`POST /pos/orders/:id/split-items`) creates a child order in `NEW` status. The
  representation is truthful in both directions: the panel warns that the child is not sent to KDS
  from cashier, and the C2 classifier treats `NEW` as `NOT_CASHIER_SETTLEABLE`, so the child never
  appears as a payable candidate on the Floor. Verified live: a 113,300 parent → child
  `…-00374-S1` (`NEW`, 28,000), parent reduced to 85,300.

## 10. Order close at the single verified choke point (spec §2.4)

There is exactly **one** close call site in the frontend: `closeCashierOrder` in
`lib/cashier/payments.ts` → `POST /api/pos/orders/:id/close`. C3 added no second close path and
**never** calls a reservation-completion endpoint (asserted statically).

### Documented deviation — no standalone Close button

The spec's *"Expose Close only when canonical financial/order state permits it"* resolves, against
the real backend, to **never expose a standalone Close**:

- `CloseOrderDto.payments` is `@IsArray() @ArrayMinSize(1)` — a zero-payment close is impossible;
- `closeOrderWithPayment` requires `CLOSABLE_STATES = ['SERVED']` and
  `alreadyPaid + newPaid >= orderTotal`;
- every non-cash path that clears the balance already auto-closes server-side
  (`autoSettleIfFullyPaid`).

So the state "settled but open, awaiting an operator close" is not reachable, and a Close button
would only ever produce a 400/409 or fabricate a bogus payment. `CashierCloseOrderPanel` (reused
unchanged) therefore reports the real close state and its precondition. **Adding a truthful
standalone close would require a backend change, which C3 was not authorized to make.**

### Related backend observation (not implemented)

`OrdersService.transitionOrder` is where reservation auto-completion fires on `CLOSED`. The cashier
close path (`PaymentsService.closeOrderWithPayment`) writes `status: CLOSED` directly via
`tx.order.update` and does **not** go through `transitionOrder` — so **reservation auto-completion
does not fire on a cashier close**. Recorded as finding **F-C3-4**; not fixed (backend, out of
scope). The spec's instruction *"do not duplicate it"* was honoured — the frontend adds nothing.

## 11. Narrow invalidation (spec §2.5)

New module `apps/web/src/lib/cashier/settlement-mutations.ts` owns the only post-mutation refresh.
It is passed to every primitive as the `onRefresh` callback they already expect, and it runs after
**success and failure alike** (a client-side error does not prove the server rejected the write, so
canonical state is always re-read before the operator sees a result).

| Key | Factory | Mode |
| --- | --- | --- |
| `["cashier","order-detail",branchId,orderId]` | `cashierBillQueryKeys.orderDetail` | **awaited** refetch |
| `["cashier","order-payments",branchId,orderId,"settlement"]` | `cashierBillQueryKeys.orderPayments` | **awaited** refetch |
| `["cashier","table-bills",branchId,tableId]` | `cashierBillQueryKeys.tableBills` | invalidate, non-blocking |
| `["cashier","floor",branchId]` | `cashierBillQueryKeys.floor` | invalidate, non-blocking |
| `["cashier","find-bills",branchId]` | prefix of `cashierBillQueryKeys.findBills` | invalidate, non-blocking |
| `["waiter","floor",branchId]` / `["supervisor","floor",branchId]` | cross-role Floor | invalidate, non-blocking (inert in a Cashier session — 0 requests) |

There is **no** bare `invalidateQueries()`, no `["cashier"]` root sweep, and no menu / profile /
auth / receipts / refunds / queue / reservations invalidation. Measured live: a close produced
**9 API requests total** (1 mutation + Floor snapshot ×3 + table bills + order detail + payments +
shift + till). The `request-count-c3.spec.ts` spec enforces an allow-list and a ceiling of 16.

## 12. Idempotency and duplicate-submit prevention (spec §4)

Unchanged and preserved: every settlement write builds a BG3 key with
`buildCashierIdempotencyKey` (`lib/cashier/idempotency.ts`) and sends it as `Idempotency-Key`;
`CashierPaymentPanel` disables submit while `isSubmitting`; the split panels gate on
`mutation.isPending` behind a confirm dialog. `mapCashierMutationError` already maps
`IDEMPOTENCY_IN_FLIGHT` and `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` to plain language.

**Not changed, recorded as finding F-C3-3:** the cashier key builder mints a *fresh* key per
submission, so a retry after a failed/timed-out payment does not reuse the original key (unlike
`lib/pos-shell/idempotency.ts`'s `IdempotencyIntent`, whose `begin()`/`reset()` contract reuses a key
across retries of the same unresolved intent). Adopting the intent model here would change the
behaviour of a verified primitive that the Queue compat path also mounts, which the C3 brief
explicitly forbids. Recommended for C5/C6 with a paired Queue regression.

## 13. Truthful post-mutation UX (spec §2.6)

- In-flight: the submit button reads "Processing" and is disabled.
- Failure: `CashierPaymentResultNotice` (danger) with a mapped message, **after** canonical state
  was re-read — so the numbers on screen are the backend's, not a guess.
- Success on a bill that stays open (partial): success notice + refreshed **Partially paid** state
  and remaining balance.
- Success on a bill that closes: the settlement form unmounts and is replaced by a persistent
  green "This bill is closed. Payment and close are complete — no further settlement action is
  available here.", the Payment state section shows **Settled** plus every payment row, and the
  History section flips to "A receipt exists for this bill." The workspace's single `aria-live`
  region now announces the classification alongside the bill number, so the transition is spoken.
- Receipt-existence transition readiness: the workspace states that a receipt exists; **no receipt
  action is offered** (C4). Verified live that `GET /api/receipts/:orderId` returns **200** with the
  correct order number, items and payments immediately after close.

## 14. Files created / modified / removed

**Created (frontend):**
- `apps/web/src/lib/cashier/settlement-mutations.ts`
- `apps/web/src/components/cashier/floor/CashierSettlementActions.tsx`

**Created (QA / assertions):**
- `apps/web/scripts/cashier-c3-assertions.ts` + `apps/web/scripts/tsconfig.cashier-c3-assertions.json`
- `apps/web/e2e/cashier-floor/c3-fixtures.ts`
- `apps/web/e2e/cashier-floor/settlement-payment-cash-close.spec.ts`
- `apps/web/e2e/cashier-floor/settlement-partial-payment.spec.ts`
- `apps/web/e2e/cashier-floor/settlement-split-execution.spec.ts`
- `apps/web/e2e/cashier-floor/settlement-fail-closed.spec.ts`
- `apps/web/e2e/cashier-floor/request-count-c3.spec.ts`

**Created (docs):** this report, `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

**Modified (frontend):**
- `apps/web/src/components/cashier/floor/CashierSettlementWorkspace.tsx` — mounts the Settlement
  section, threads `tableId`, wires `useCashierSettlementRefresh`, drops the "Read-only" badge and
  the C2 "read-only foundation" copy, live-region announces classification.
- `apps/web/src/components/cashier/floor/CashierBillResolutionPanel.tsx` — passes `tableId`.
- `apps/web/src/components/cashier/floor/CashierFloorScreen.tsx` — passes `tableId` on the direct
  (tableless / Find-bill) workspace mount; doc comment updated.
- `apps/web/src/components/cashier/floor/index.ts` — export.
- `apps/web/src/components/cashier/resolution/CashierResolutionPanel.tsx` — **additive** optional
  `variant?: "full" | "split-only"` (default `"full"`, so the Queue compat path is unchanged).

**Modified (QA harness / tests):**
- `apps/web/playwright.config.ts` — optional `PW_CHROMIUM_PATH` launch override (unset ⇒ existing
  behaviour, byte-for-byte).
- `apps/web/scripts/cashier-c2-assertions.ts` — the C2 "no payment/split/close control" boundary is
  explicitly marked superseded by C3; the forbidden-token list now covers only what is still out of
  scope (receipt, refund, merge/move/transfer, void, discount) and also scans the new
  `CashierSettlementActions`.
- `apps/web/e2e/cashier-floor/settlement-workspace-readonly.spec.ts` → **renamed**
  `settlement-workspace-scope.spec.ts`; its read-only premise is superseded, its section-set and
  out-of-scope assertions are kept and extended.

**Removed:** none. `/cashier/queue` and `/cashier/receipts` remain hidden compatibility routes —
not deleted, not redirected.

## 15. Backend / schema / migration / seed / permission / Postman

**None.** Zero changes. The cashier role already held every permission used
(`pos:orders:close`, `pos:payment:manual-reference`, `pos:order:split`, `pos:payment:read`,
`pos:orders:read`, `pos:shift:*`, `pos:till:*` — confirmed live in `GET /api/auth/me`, 63
permissions).

## 16. Validation results

| Gate | Command | Result |
| --- | --- | --- |
| Web typecheck | `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | **PASS** |
| Web lint | `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` | **PASS** (0 warnings / 0 errors) |
| Web build | `next build` | **NOT RUN** — the QA brief forbids `next build` in this environment. Typecheck + lint were run instead; this is stated, not implied. |
| Shell assertions | `npx tsx apps/web/scripts/shell-assertions.ts` | **PASS** |
| Floor assertions | `npx tsx apps/web/scripts/floor-assertions.ts` | **PASS** |
| Profile assertions | `npx tsx apps/web/scripts/profile-assertions.ts` | **PASS** |
| C1 assertions | `npx tsx apps/web/scripts/cashier-c1-assertions.ts` | **PASS** |
| C2 assertions (C3-adjusted) | `npx tsx apps/web/scripts/cashier-c2-assertions.ts` | **PASS** |
| **C3 assertions (new)** | `npx tsx apps/web/scripts/cashier-c3-assertions.ts` | **PASS** |
| Playwright — `e2e/cashier-floor/` | 4 viewport projects | **192 passed / 0 failed / 0 skipped** (48 tests × 4), 14.7 min |
| Playwright — cross-role regression | `e2e/supervisor-prompt3/{regression,role-boundaries}.spec.ts` × 4 viewports | **20 passed / 0 failed** (5 tests × 4), 1.4 min |
| API health | `GET http://localhost:3001/api/health` | `{status:"ok", db:"ok"}` |
| Git hygiene | `git diff --check -- apps/web docs/cashier-ui-docs` | clean |

Live QA transcript, screenshots and per-mutation evidence:
`ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

## 17. Console / network cleanliness

Every touched surface was driven with console + network listeners attached. Across the Floor,
settlement workspace (payable / partially paid / closed / summary-unavailable), Me shift open, and
both viewports: **0 console errors, 0 console warnings, 0 failed network requests** — except two
deliberately induced cases, both expected: the simulated `500` payment-summary outage (fail-closed
proof) and the `404`s for an intentionally invalid `orderId` (fail-safe proof).

## 18. Findings (documented, not implemented)

| # | Finding | Where | Disposition |
| --- | --- | --- | --- |
| **F-C3-1** | `POST /api/pos/orders` can **500** with `Unique constraint failed on (branch_id, order_number)`. `OrdersService.generateOrderNumber` reads the newest order by `createdAt` and parses `/ORD-(\d+)/`; a branch-prefixed demo number (`ORD-TAPAS_DOWNTOWN-00374`) does not match, so the sequence resets to `ORD-000001`, which already exists. | `apps/api/src/modules/orders/orders.service.ts:67` | Backend; **not fixed** (frontend-only pass). No Cashier UI impact (cashier never creates orders); it breaks QA fixtures, so `c3-fixtures.ts` falls back to adopting an existing unpaid payable bill. Recorded as **M8** in `CASHIER_API_MATRIX.md`. |
| **F-C3-2** | `POST /api/payments/manual-reference` accepts a payment on an **already-CLOSED** order (only `VOIDED` is refused), producing an overpayment with no close event. Verified: a closed 122,700 bill accepted a further `CARD:1,000` (**201**) → `totalPaid 123,700`. The equivalent close probe correctly returned **409**. | `apps/api/src/modules/payments/payments.service.ts:763` | Backend hardening recommended; **not fixed**. The Cashier UI fails closed (no settlement control on a terminal bill), so it is unreachable from the product. Recorded as **M7** in `CASHIER_API_MATRIX.md`. |
| **F-C3-3** | Cashier idempotency keys are minted fresh per submission, so a retry after a failed/timed-out payment does not reuse the original key (the shared `pos-shell` `IdempotencyIntent` model does reuse). | `apps/web/src/lib/cashier/idempotency.ts` + `CashierPaymentPanel` | **Not changed** — altering a verified primitive that Queue also mounts is outside the C3 brief. Recommend adopting the intent model in C5/C6 with a paired Queue regression. |
| **F-C3-4** | Reservation auto-completion does **not** fire on a cashier close: it lives in `OrdersService.transitionOrder`, but `PaymentsService.closeOrderWithPayment` sets `status: CLOSED` directly. | `apps/api/src/modules/payments/payments.service.ts:246` vs `orders.service.ts:700` | Backend; **not fixed**. The frontend correctly does not duplicate it. |
| **F-C3-5** | A split allocation of an amount not divisible by the group count yields sub-unit UGX amounts (e.g. `101,466.66`), which the established formatter renders with 2 decimals (it renders whole amounts zero-fraction, as required). | backend split-bill maths, surfaced by `formatCashierMoney` | **Not changed** — truthful rendering of a real Decimal is correct; suppressing it would hide money. Flagged for the C6 UGX review. |
| **F-C3-6** | The Cashier readiness strip badge still reads *"Read-only readiness"*. It is accurate (the strip itself is not actionable) but sits above a surface where money now moves. | `components/cashier/shell/CashierReadinessStrip.tsx` | **Not changed** — a shared cashier-shell component also used by Queue/Till/Me; out of C3's scope. Cosmetic copy candidate for C5/C6. |

## 19. Scope discipline

Implemented exactly the C3 in-scope list. **Not** implemented (spec §3): receipt print / reprint /
deliver / search, refund creation, Queue retirement, Receipts retirement, transfer table/server,
active void, discount approval, complimentary. The shared Floor was not forked; `pos-shell/`,
`floor/`, `profile/` and `ui/` were not modified.

## 20. Readiness for C4

The settlement workspace now reaches a real CLOSED bill with a real receipt in existence, and the
History section already names the receipt/refund boundary. C4 (receipt preview / print / reprint /
deliver, refund from the closed-bill context, receipt search in Find bill, Receipts retirement)
mounts on exactly that state. **C4 is NOT started.**

Two observations for C4, from verifying that C3-closed bills produce viewable receipts: the
hidden `/cashier/receipts` compat route does list and open the bills C3 closed (verified live —
`ORD-000137`, `ORD-TAPAS_DOWNTOWN-00195`; console/network clean), and its list rows render
*"Paid — Unavailable / Outstanding — Unavailable"* because the Receipts list does not fetch a
payment summary per row. That is pre-existing Receipts-screen behaviour, **not** a C3 regression,
but C4 should not carry it into the Floor path.

**No C4 prompt spec was created.** `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C3.md` contains no
instruction to author the next prompt (unlike the C2 spec, which did), and the C3 brief said to
create one only if the spec instructs it. The roadmap's generic *"Expected artifacts per prompt"*
list does mention a next prompt — flagged here so the owner can commission a C4 spec explicitly.

## 21. No commit / no push

⛔ Confirmed — no `git commit`, no `git push`, no branch change. The working tree is left for the
orchestrating session.

## Final classification

**A — C3 COMPLETE / READY FOR C4.**
