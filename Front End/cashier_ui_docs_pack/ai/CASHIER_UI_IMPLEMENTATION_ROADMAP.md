# CASHIER_UI_IMPLEMENTATION_ROADMAP.md — Nimbus POS Cashier UI Build Roadmap

Status: Updated v1 (post-verification)  
Date: 2026-07-01  
Scope: future cashier UI implementation prompts; docs/research complete, implementation pending

## Prompt 0 — Repo/docs/API orientation

Verify docs against live repo before coding. Read cashier docs, waiter docs, schema, seed, demo credentials, API modules, and Postman. Produce `ai/CASHIER_UI_REPO_VERIFICATION_REPORT.md` with exact credentials, permissions, DTOs, endpoints, split tender support, till/refund behavior, and demo fixture readiness. No UI coding. (Completed)

## Prompt 1 — Cashier shell/design foundation & Permission Alignment

Implement `CashierShell`, `CashierHeader`, `CashierBottomNav`, readiness chips, route guard, state primitives, caveat banners. Routes: `/cashier/queue`, `/cashier/receipts`, `/cashier/till`, `/cashier/me`.
* **Important Backend Alignment:** Resolve the critical permission mismatch on order close (`POST /api/pos/orders/:id/close` requires `pos:orders:close`, but Cashier is only seeded with `pos:payment:close` in `seed.ts` line 1247). Ensure that when seeding, the Cashier role is granted `pos:orders:close` or the cashier client intercepts this correctly.

## Prompt 2 — Auth/session/context routing

Wire Quick PIN and `/api/auth/me` with role validation (checking for `jobRole === 'CASHIER'`); branch/workspace guard; active shift/till queries; idle logout. Cashier lands on Queue.

## Prompt 3 — Queue/orders

Build Queue screen, order list, search/filter chips, payment/bill state badges, checkout open action, loading/empty/failure/blocked states.
* **Filter Rule:** Since there is no database column for `billRequested`, the Queue must load all active orders with statuses `SENT`, `IN_KITCHEN`, `READY`, `SERVED` on this branch.

## Prompt 4 — Checkout/payment entry

Build checkout panel, totals/outstanding, payment history, cash tender, card reference, MTN/Airtel provider-gated/manual-reference panels, close order. Enforce idempotency header on order close. Enforce active till open check locally on cash payments.

## Prompt 5 — Split bill/items/split tender/advanced resolution

Build split bill, split items, split tender if backend supports multiple payments, merge, move items, transfer table/server. Keep advanced actions out of nav.
* **Split Bill:** Saves group allocations to `Order.metadata.splitBill`.
* **Split Items:** Creates a child order starting in status `NEW`.

## Prompt 6 — Receipts

Build receipt search/list/drawer/history/reprint/send-pending. Enforce metadata-only print and pending send caveats.

## Prompt 7 — Till/safe drop/reconciliation

Build active till summary, open till, safe drop, reconcile, variance state. Cash remains blocked without active till (enforced locally on the client). paid-in/paid-out/pickup are deferred as they have no API routes.

## Prompt 8 — Refunds

Build refund drawer with refundable amount, reason, status, previous refunds. Auto-approves if <= 5000 UGX, requests approval if > 5000 UGX. Hide approve refund / post-close void actions from Cashier (require manager Quick PIN verification for manager overrides).

## Prompt 9 — Me tab

Build profile/session/shift/till/self-service/logout. No payroll, staff list, accounting, or reports.

## Prompt 10 — QA/polish/demo readiness

Run cashier login, queue, checkout, payment methods, split, receipt, till, refund, role guard, caveat, and unsupported-action checks. Produce QA report and known limitations.
