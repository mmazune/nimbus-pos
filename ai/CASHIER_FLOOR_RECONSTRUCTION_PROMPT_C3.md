# Cashier Floor-First Reconstruction — PROMPT C3 (next prompt spec)

**Payment Collection, Partial & Split Payment Execution, Order Close, and Fail-Closed Settlement**

> Prerequisite: **C2 COMPLETE / READY FOR C3** (table→bill resolution + read-only settlement
> workspace foundation + orderId URL state + Find bill foundation are live). Do NOT start C3 without
> explicit authorization. Frontend-only unless a verified blocker requires otherwise. No commit/push
> without instruction.

## 1. Purpose

Turn the C2 read-only settlement workspace into a working, fail-closed **payment + close** surface,
reusing the already-built and verified Cashier payment/split/close logic
(`CashierPaymentPanel`, `CashierResolutionPanel` split-bill/split-items primitives, `CashierCloseOrderPanel`,
payment-validation, till/readiness) — do NOT rewrite it.

## 2. In scope (C3)

1. Payment collection (cash / manual / stub-provider) into the C2 workspace, gated by the C2
   readiness state (active shift + active till) — **fail closed** when readiness is unavailable,
   loading, failed, or owned by another user.
2. Partial payment + remaining-balance handling with canonical backend amounts (no optimistic
   totals; re-read payment summary after each mutation).
3. Split-payment execution reusing the existing split primitives, with truthful child/parent
   representation from C2.
4. Order close at the single verified close choke point (reservation auto-completion already fires
   there — do not duplicate).
5. Narrow, correct mutation invalidation on the C2 query-key model (`bill-query-keys.ts`) — no broad
   invalidation, no request storms, no blocked settlement.
6. Truthful post-mutation UX (payment-in-progress, failure, retry) and receipt-existence transition
   readiness (receipt actions still land in C4).

## 3. Out of scope (still deferred)

- Receipt print/reprint/deliver + receipt search (C4).
- Refund creation/mutation (C4).
- Queue retirement (C5) and Receipts retirement (C4).
- Transfer table/server, active void, discount approval, complimentary (Supervisor-owned; never on
  Cashier).
- Any permission / schema / migration / seed / Postman change without explicit authorization.

## 4. Hard constraints

- Reuse `CashierPaymentPanel` / split / close primitives — one settlement workspace, no second model.
- Every payment mutation must fail closed on readiness (C2 already surfaces the state).
- Canonical amounts only; re-fetch summary after mutations; no optimistic final totals.
- Keep the request budget: no per-table payment fetch, one detail + one payment domain per bill.
- Preserve Queue/Receipts compatibility routes.
- Isolated Docker/Neon QA only; shared Neon read-only.

## 5. Completion gate (must all hold)

Payment collects and reflects canonical balance; partial + split execute truthfully; close works at
the verified choke point; readiness fail-closed proven; invalidation narrow; typecheck/lint/build +
C1/C2/C3 assertions pass; full Cashier Floor Playwright suite executes green on all four viewports;
Waiter/Supervisor regression green; shared Neon untouched; no commit/push.
