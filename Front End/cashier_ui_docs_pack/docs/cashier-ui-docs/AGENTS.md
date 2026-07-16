# AGENTS.md — Nimbus POS Cashier MVP Frontend Agent Contract

Status: Draft v1  
Date: 2026-07-01  
Applies to: `docs/cashier-ui-docs/` and any future cashier MVP frontend implementation  
Primary build target: **desktop-first shared POS terminal**

## 1. Purpose and authority

This file is the instruction contract for Codex or any coding agent working on the Nimbus POS cashier MVP frontend.

The cashier MVP is a focused **payment, settlement, receipt, till, split, refund-initiation, and closeout workspace**. It is not a waiter floor clone and not a backoffice accounting dashboard.

Required reading order before coding:
1. `docs/cashier-ui-docs/AGENTS.md`
2. `docs/cashier-ui-docs/DESIGN.md`
3. `docs/cashier-ui-docs/cashier_design.md`
4. `docs/cashier-ui-docs/cashierui.md`
5. `docs/cashier-ui-docs/CASHIER_LIFECYCLE.md`
6. `docs/cashier-ui-docs/CASHIER_API_MATRIX.md`
7. `docs/cashier-ui-docs/CASHIER_GAP_REGISTER.md`
8. Existing waiter docs for structural comparison only.
9. Backend/API/Postman source before implementation.

Source basis:
- Uploaded waiter docs were used as the structure template: AGENTS.md, DESIGN.md, waiter_design.md, waiterui.md, WAITER_LIFECYCLE.md.
- Uploaded Nimbus audit/register resources were used for cashier-relevant routes: endpoint register, role endpoint matrix, master audit, gap register, workflow map.
- Live Windows repo path was not mounted in this environment, so exact DTOs/seed permissions must be verified in `C:\Users\arman\Desktop\nimbus-pos` before coding.


## 2. Product position

Cashier should feel:
- premium enterprise hospitality POS;
- precise, fast, controlled, financially safe;
- calm during rush-period settlement;
- touch-friendly at a shared terminal.

Cashier must not feel:
- like waiter Floor/Tables;
- like a generic finance dashboard;
- like a public checkout website;
- like a fake hardware/provider simulator.

## 3. Locked cashier MVP decisions

1. Desktop-first shared POS terminal.
2. Shared auth shell; Cashier defaults to Quick PIN.
3. Email/password remains available only as shared-shell fallback.
4. Call `GET /api/auth/me` after login.
5. Cashier lands on **Queue**.
6. No cashier dashboard.
7. Fixed top header and fixed bottom nav.
8. Bottom nav is exactly **Queue**, **Receipts**, **Till**, **Me**.
9. No Floor tab.
10. No Menu tab.
11. Payment entry opens from a selected order; it is not a bottom-nav tab.
12. Cashier settles bills and closes orders only through backend-supported endpoints.
13. Cashier may assign payment method labels only through backend-supported DTOs.
14. Cash requires active till.
15. Card is manual/stub/reference only.
16. MTN and Airtel are provider-gated/manual-reference only until provider confirmation.
17. PesaPal is excluded from diner checkout.
18. Receipt send remains pending/no adapter.
19. Printer and terminal surfaces are metadata/stub only.
20. Split bill/items/merge/move/transfer are advanced checkout-resolution tools, not waiter service editing.
21. Refunds and discounts must show backend status: auto-approved, pending, denied, or blocked.
22. No KDS/kitchen actions.
23. No owner/accounting/franchise/admin dashboards.
24. No frontend-only payment/order state.
25. Idle timeout returns to login; no switch-user or separate lock-screen mode.

Locked safety boundaries:
- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- MTN/Airtel may appear only as provider-gated or manual-reference-only if the backend DTO supports safe local manual reference capture.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes/reprint are metadata/request only: `Metadata only — no print-driver invocation`.
- Card terminal pairing is `STUB — no live hardware traffic`; no acquirer/card-terminal traffic.
- No fake provider credentials, no fake live delivery, no fake printed/terminal approved states.


## 4. Backend/Postman source of truth

Frontend may call only verified endpoints. Do not invent routes. If a route, DTO, permission, or fixture is missing, add it to `CASHIER_GAP_REGISTER.md`.

Risky writes that should use `Idempotency-Key` where supported:
- `POST /api/payments/intents`
- `POST /api/pos/orders/:id/close`
- `POST /api/pos/orders/:id/refunds`
- `POST /api/tills/open`
- `POST /api/tills/:id/reconcile`
- `POST /api/receipts/:id/reprint`

## 5. What cashier can do

If backend permissions and state allow, Cashier can:
- login by Quick PIN and resolve context;
- view/open shift;
- view/open active till;
- view till summary;
- record safe drops;
- reconcile till;
- view payment/bill queue;
- search by order, table, waiter/server, guest if safe, and payment reference if supported;
- open checkout detail;
- review order lines, subtotal, tax, discount, total, paid, outstanding;
- view payment history;
- record cash/card/manual/mobile-reference payments through backend-supported endpoints;
- split tender if multiple payments are supported;
- split bill allocation groups;
- split selected items to child orders;
- merge/move/transfer orders only as advanced payment resolution;
- close settled orders;
- view receipt/history/reprint/send-pending;
- create/view refunds if permitted;
- use Me tab for identity/session/self-service;
- logout.

## 6. What cashier cannot do

Cashier cannot:
- run live MTN/Airtel public diner payment execution;
- use PesaPal for diner checkout;
- invoke real card terminal/acquirer traffic;
- invoke real print drivers;
- claim digital receipt delivered;
- edit menu/order items like waiter;
- run KDS/kitchen transitions;
- manage reservations except future explicitly approved payment/deposit scope;
- see accounting/admin/franchise/payroll/owner dashboards;
- approve manager-only actions unless seed permissions prove it;
- bypass backend permission guards.

## 7. Implementation rules for Codex

1. Verify exact controllers, DTOs, permissions, and Postman before coding.
2. Hide actions the cashier can never perform.
3. Disable/block temporarily unavailable actions with a visible reason.
4. Use backend error reasons where possible.
5. Use skeletons for known layouts; no full-page spinner-only screens.
6. Use inline progress for payment/till/receipt writes.
7. Never retry payment/close/refund blindly after network failure.
8. Use TypeScript API types where possible.
9. POS touch target minimum 44px, preferred 48px.
10. Use Phosphor icons only.
11. Use design tokens only; no arbitrary colors.
12. No emojis, glassmorphism, generic gradients, or fake provider/hardware states.

## 8. Required frontend structure

```txt
src/
  pages/cashier/
    queue.tsx
    receipts.tsx
    till.tsx
    me.tsx
  components/cashier/
    shell/
    queue/
    checkout/
    payments/
    split/
    receipts/
    till/
    refunds/
    me/
    states/
  lib/cashier/
    api.ts
    permissions.ts
    state.ts
    payment-methods.ts
    formatters.ts
    idempotency.ts
```

Required naming:
- `CashierShell`, `CashierHeader`, `CashierBottomNav`
- `CashierQueueScreen`, `CashierOrderCard`
- `CashierCheckoutPanel`, `CashierPaymentMethodSelector`, `CashierTenderPanel`
- `CashierSplitBillPanel`, `CashierSplitItemsPanel`
- `CashierReceiptDrawer`, `CashierTillScreen`, `CashierRefundPanel`, `CashierMeScreen`

## 9. Required states

Every major screen must handle:
- loading, empty, success, failure, blocked, offline/degraded;
- maintenance, training mode, pending provider/adapter/stub caveats;
- shift not open, till not open, permission denied, route unsupported;
- outstanding balance, pending intent, payment failed, refund pending;
- idempotency replay/conflict/in-flight.

## 10. Acceptance criteria

Cashier MVP is acceptable when:
1. Cashier logs in by PIN and resolves `/api/auth/me`.
2. Cashier lands on Queue.
3. Header shows branch, terminal, cashier, shift, and till readiness.
4. Bottom nav is Queue / Receipts / Till / Me.
5. Queue lists payment-ready/bill-requested orders from verified backend data.
6. Checkout shows lines, totals, paid, outstanding.
7. Cash, card, MTN, Airtel are represented with correct caveats.
8. Cash is blocked without active till.
9. Payments, close, refund, till, and receipt writes use backend state.
10. Split bill/items are available only through verified endpoints.
11. Receipt send/reprint caveats are visible.
12. No unsupported action appears live.
