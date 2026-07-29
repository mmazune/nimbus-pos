# CASHIER_LIFECYCLE.md — Nimbus POS Cashier Payment + Closeout Lifecycle

Status: Draft v1  
Date: 2026-07-01  
Purpose: exhaustive cashier MVP lifecycle and action contract

## Shared operational shell status (2026-07-18)

Cashier consumes the shared `OperationalShell`, `OperationalHeader`, `OperationalBottomNav`, `CurrentTime`, navigation presentation, and canonical operational icon registry also used by Waiter and Supervisor. Cashier navigation remains Queue, Receipts, Till, Me. Cashier guards, shift/till readiness, payment behavior, permissions, queries, and mutations remain role-owned; the shared-shell migration does not change settlement scope.

## 1. Main lifecycle

```txt
login → context → shift readiness → till readiness → queue → checkout → payment method selection → settlement → split/merge if needed → close order → receipt/reprint/send-pending → refund if needed → till movement/reconcile → logout
```

This lifecycle keeps waiter service and cashier money-handling separate. Waiter requests bill. Cashier settles bill.

## 2. Cashier can do

- Quick PIN login and `/api/auth/me` context;
- open/view shift and till if permitted;
- view Queue;
- search order/table/waiter/guest-safe/reference;
- open checkout;
- review lines, totals, paid, outstanding;
- assign supported method: cash, card/manual reference, MTN manual reference, Airtel manual reference, other backend-configured method;
- split tender if backend supports multiple payments;
- split bill allocation groups;
- split selected items into child order;
- merge/move/transfer as advanced payment-resolution;
- close settled orders;
- view receipt/history;
- record reprint and send-pending;
- create/view refunds if permitted;
- safe drop/reconcile till;
- logout.

## 3. Cashier cannot do

Locked safety boundaries:
- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- MTN/Airtel may appear only as provider-gated or manual-reference-only if the backend DTO supports safe local manual reference capture.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes/reprint are metadata/request only: `Metadata only — no print-driver invocation`.
- Card terminal pairing is `STUB — no live hardware traffic`; no acquirer/card-terminal traffic.
- No fake provider credentials, no fake live delivery, no fake printed/terminal approved states.

- No waiter-style menu/item editing.
- No KDS state actions.
- No accounting/admin/franchise/payroll dashboards.
- No manager approval actions unless seed permissions prove it.

## 4. Login lifecycle

1. Cashier selects Quick PIN.
2. Enters PIN.
3. Backend authenticates.
4. App stores token.
5. App calls `GET /api/auth/me`.
6. App verifies role/branch.
7. App routes to `/cashier/queue`.

Failures: wrong PIN, no branch, non-cashier role, network error, expired session.

## 5. Shift readiness lifecycle

After context:
1. call active shift endpoint;
2. if open, continue;
3. if not open, show `Shift not started — settlement actions disabled.`

Allowed without shift:
- read-safe Queue/Receipts if backend allows;
- Me/logout;
- Start shift if permitted.

Blocked:
- payment creation;
- order close;
- refund creation;
- till writes if backend requires shift.

## 6. Till readiness lifecycle

After shift:
1. call active till endpoint;
2. if till open, cash method unlocks;
3. if not open, show `Till not open — cash payments disabled.`

Open till:
- `POST /api/tills/open`;
- opening float/till ID/note as DTO requires;
- idempotency key if supported.

Cash payment is blocked without active till.

## 7. Queue lifecycle

Load Queue from `GET /api/pos/orders` and backend-supported filters. Do not invent a payment queue endpoint. If bill-requested filter is missing, use safe fields from loaded orders and record a gap.

Queue states:
- Bill requested;
- Ready to pay;
- Partially paid;
- Paid not closed;
- Closed today;
- Refund review;
- All active.

Open order:
1. load order detail;
2. load payment summary/history;
3. show checkout panel.

Blocked: not payable, already closed, no permission, branch mismatch, order not found.

## 8. Checkout lifecycle

Cashier reviews:
- order number/table/takeaway;
- waiter/server;
- line items;
- subtotal/tax/discount/total;
- paid and outstanding;
- payment history;
- split status.

No waiter menu editing.

## 9. Payment method lifecycle

Cash:
- requires shift and till;
- amount received/change due;
- backend records payment;
- updates payment history and till.

Card:
- manual/stub/reference only;
- reference required if DTO requires;
- no acquirer traffic.

MTN/Airtel:
- provider-gated;
- manual reference only if backend supports it;
- no live Request-to-Pay;
- show critical caveat.

PesaPal:
- excluded.

## 10. Payment intent/status lifecycle

Create payment:
- use `POST /api/payments/intents` or `POST /api/payments/manual-reference` as verified;
- send idempotency key where supported;
- show inline progress;
- prevent double submit.

Status:
- pending/processing/completed/failed/cancelled.
- use intent status route where applicable.
- pending intent blocks close.

## 11. Split bill and split tender lifecycle

Split bill:
1. open Split bill;
2. create allocation groups;
3. preview amounts;
4. confirm via `POST /api/pos/orders/:id/split-bill`;
5. return to checkout.

Split tender:
1. record first payment;
2. outstanding updates;
3. record next method;
4. close only when settled.
If backend denies multiple payments, hide split tender.

Split items:
1. choose item quantities;
2. preview child order;
3. call `POST /api/pos/orders/:id/split-items`;
4. settle source and child independently.

Merge/move/transfer:
- advanced only;
- confirm source/destination/impact;
- use verified endpoints.

## 12. Discount lifecycle

If cashier can request discounts:
1. open discount panel;
2. enter reason/type/amount;
3. backend returns applied or pending.
Approval remains hidden unless cashier permission is verified.

Copy:
- `Discount applied.`
- `Discount pending manager approval.`
- `Discount rejected.`

## 13. Order close lifecycle

Preconditions:
- order is close-eligible;
- outstanding is zero unless backend permits otherwise;
- no pending intent;
- cashier has permission;
- shift/till state satisfies backend.

Close:
1. show summary confirmation;
2. call close endpoint;
3. refresh order;
4. show `Order closed.`;
5. open receipt drawer.

Failures:
- outstanding balance;
- pending intent;
- maintenance;
- idempotency conflict;
- permission denied.

## 14. Receipt lifecycle

View: `GET /api/receipts/:id`  
History: `GET /api/receipts/:id/history`  
Reprint: `POST /api/receipts/:id/reprint` with metadata-only caveat.  
Send: `POST /api/receipts/:id/send` with pending/no adapter caveat.

Never claim printed or delivered.

## 15. Refund lifecycle

Preconditions:
- closed/paid/refundable order;
- refundable balance remains;
- cashier permission;
- reason if required.

Create refund:
- use verified refund endpoint;
- send idempotency key where supported;
- show exact backend result.

Copy:
- `Refund completed.`
- `Refund pending manager approval.`
- `Refund denied.`

No cashier approval controls unless verified.

## 16. Safe drop lifecycle

Preconditions:
- active shift and till;
- valid amount;
- permission.

Flow:
1. cashier opens Till;
2. enters amount/reason;
3. calls safe-drop endpoint;
4. UI shows `Safe drop recorded.`;
5. expected cash updates.

## 17. Till reconciliation lifecycle

Flow:
1. open Till;
2. review expected cash;
3. enter counted cash;
4. show variance;
5. enter reason if required;
6. call reconcile endpoint;
7. show `Till reconciled.`

Show expected, counted, difference, and status.

## 18. Offline/degraded/idempotency lifecycle

Do not blind-retry money writes. On network failure:
- refresh payment/order status;
- use idempotency recovery if available;
- show pending/retry-safe state.

Idempotency outcomes:
| Outcome | UI response |
|---|---|
| replay | show prior result |
| conflict | payload mismatch; do not retry automatically |
| in-flight | show processing and refresh |
| maintenance | block write and show banner |

## 19. Denied action matrix

| Action | Cashier MVP behavior |
|---|---|
| Cash without till | Blocked |
| Close with outstanding | Blocked unless backend permits |
| Close with pending intent | Blocked |
| Live MTN/Airtel | Hidden/blocked |
| PesaPal diner checkout | Hidden |
| Real terminal capture | Hidden/stub |
| Physical print driver | Hidden/metadata only |
| Delivered digital receipt | Hidden/pending only |
| KDS actions | Hidden |
| Waiter item editing | Hidden |
| Accounting/admin dashboards | Hidden |
| Manager approvals | Hidden unless verified |

## 20. Final checklist before implementation

Confirm:
- cashier demo credentials/PIN;
- cashier seed permissions;
- payment method enum;
- payment intent/manual reference DTOs;
- order payments shape;
- close preconditions;
- split bill/items DTOs;
- split tender support;
- till DTOs;
- refund and discount approval behavior;
- demo records for queue/payment/receipt/till/refund.
