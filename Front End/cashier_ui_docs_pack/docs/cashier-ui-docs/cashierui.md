# cashierui.md — Nimbus POS Cashier UI Blueprint

Status: Draft v1  
Date: 2026-07-01  
Platform: Desktop-first shared POS terminal  
Role: Cashier

## 1. Purpose

This file defines the screen-by-screen cashier UI blueprint. For edge cases, read `CASHIER_LIFECYCLE.md`.

## 2. Current backend truth

Cashier-relevant backend/audit surfaces found:
- auth/login/quick PIN and `/api/auth/me`;
- active shift and till;
- order list/detail/payment summary;
- payment intents and manual reference;
- order close;
- split bill, split items, merge, move items, transfer table/server;
- receipts view/history/reprint/send-pending;
- refunds;
- discounts request/approval endpoints, but cashier approval must be verified;
- devices/printer/terminal metadata/stub.

Locked safety boundaries:
- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- MTN/Airtel may appear only as provider-gated or manual-reference-only if the backend DTO supports safe local manual reference capture.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes/reprint are metadata/request only: `Metadata only — no print-driver invocation`.
- Card terminal pairing is `STUB — no live hardware traffic`; no acquirer/card-terminal traffic.
- No fake provider credentials, no fake live delivery, no fake printed/terminal approved states.


## 3. Login and entry

Shared login shell supports Quick PIN and email/password.

Entry flow:
1. Cashier enters PIN.
2. App authenticates.
3. App calls `GET /api/auth/me`.
4. App resolves org/branch/role.
5. App checks active shift.
6. App checks active till.
7. App routes to Queue.

Blocked:
- wrong PIN;
- no branch;
- not cashier;
- network error;
- session invalid.

## 4. Cashier shell

Header:
- logo/branch/terminal;
- current time;
- shift chip;
- till chip;
- cashier avatar/name;
- logout.

Bottom nav:
1. Queue
2. Receipts
3. Till
4. Me

No Floor, Menu, More, or Payments tab.

## 5. Queue screen

Goal: quickly find bills/orders needing payment, settlement, receipt, refund, split, or closeout.

Toolbar:
- search order/table/waiter/guest if safe/payment reference;
- filters: Bill requested, Ready to pay, Partially paid, Paid not closed, Closed today, Refund review, All active;
- sort: bill requested first, oldest first, highest outstanding.

Queue card:
- order number;
- table/takeaway;
- waiter/server;
- order status;
- bill state;
- payment state;
- total;
- paid;
- outstanding;
- requested/updated time;
- `Open checkout`.

States:
- loading skeleton cards;
- empty `No bills waiting for checkout.`;
- failure `Could not load cashier queue.`;
- blocked `Branch context missing — cashier queue unavailable.`

## 6. Checkout/payment screen

Checkout opens from Queue.

Left/main:
- order identity;
- table/takeaway and waiter/server;
- line items;
- subtotal/tax/discount/total;
- paid/outstanding;
- payment history;
- split/receipt/refund actions.

Right/sticky:
- outstanding;
- tender amount;
- method selector;
- method inputs;
- caveat area;
- payment submit;
- close order;
- receipt shortcut.

No waiter-style add/edit/remove item controls.

## 7. Payment method behavior

Cash:
- enabled only with active till;
- amount due, amount received, change due;
- action `Record cash payment`;
- block copy `Till not open — cash payments disabled.`

Card:
- manual reference/stub only;
- amount + reference;
- caveat `STUB — no live hardware traffic`;
- action `Record card reference`.

MTN:
- provider-gated/manual-reference only;
- caveat `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`;
- action `Record manual MTN reference` only if backend manual-reference supports it;
- no live Request-to-Pay.

Airtel:
- same as MTN;
- action `Record manual Airtel reference` only if supported.

PesaPal:
- never shown in diner checkout.

## 8. Settlement and close

Before payment submit:
- show order, amount, method, reference, outstanding after payment.

After payment:
1. send idempotency key where supported;
2. call backend endpoint;
3. refresh payment history/outstanding;
4. unlock close if backend says settled.

Partial/split tender:
- if backend supports multiple payments, allow multiple tender entries and show running paid/outstanding;
- if backend blocks it, hide and document.

Close:
- call backend close endpoint only;
- block if outstanding remains, pending intent exists, or permission/state denies;
- on success show `Order closed.` and open receipt drawer.

## 9. Split bill/items/advanced resolution

Split bill:
- create allocation groups using `POST /api/pos/orders/:id/split-bill`;
- exact request shape must follow DTO.

Split items:
- select item quantities and create child order using `POST /api/pos/orders/:id/split-items`.

Advanced:
- Merge orders, move items, transfer table/server;
- show source/destination/impact confirmation;
- do not place in nav.

## 10. Receipts tab

Layout:
- search/filter toolbar;
- receipt list;
- receipt drawer.

Search:
- receipt/order number, table, server, reference if supported.

Filters:
- Today, Closed, Reprinted, Send pending, Refunded/voided if available.

Drawer:
- order/receipt number, branch/org, table/order type, server, cashier if returned, lines, subtotal, tax, discount, total, paid, outstanding, payment summary, footer, history.

Actions:
- View;
- History;
- Reprint with `Metadata only — no print-driver invocation`;
- Send receipt with `PENDING — no live email/SMS/WhatsApp adapter`.

## 11. Till tab

Goal: manage drawer readiness.

Show:
- active shift;
- active till;
- opening float;
- cash payments;
- safe drops;
- expected cash;
- counted cash;
- variance.

Actions:
- Open till;
- Record safe drop;
- Reconcile till.

Blocked:
- no active shift;
- no active till;
- maintenance;
- idempotency conflict;
- backend state block.

## 12. Refund drawer

Entry points:
- closed receipt drawer;
- closed Queue item;
- receipt list row.

Show:
- order/receipt identity;
- paid amount;
- previous refunds;
- refundable amount;
- refund amount;
- reason;
- status.

Submit:
- use backend refund endpoint;
- show completed, pending, denied, or blocked based on backend response;
- default no approval action for cashier unless permissions prove it.

## 13. Me tab

Show:
- verified cashier name, initials, account identifier, and role-aware profile status;
- branch;
- terminal;
- current time;
- shift state;
- till state;
- attendance/self-service if supported and self-scoped;
- logout.

Use the shared profile hero, metadata, status-badge, section, and session visual primitives without moving query or mutation ownership out of `CashierMeScreen`. If a till is active while the shift is not active, present `Shift required` as the operational warning rather than treating the account as ready. The shell and bottom navigation must remain usable without horizontal overflow at the supported narrower terminal width.

Do not show payroll, staff list, reports, accounting, owner dashboard, franchise dashboard, manager settings.

## 14. Forbidden actions

Do not show:
- Floor tab;
- Menu tab;
- waiter item editing;
- KDS actions;
- live MTN/Airtel;
- PesaPal diner checkout;
- real card terminal capture;
- physical print success;
- delivered digital receipt success;
- manager approval actions unless role permission is verified.

## 15. Acceptance criteria

Cashier UI is acceptable when:
1. Cashier logs in via PIN and resolves context.
2. Cashier lands on Queue.
3. Header/nav match contract.
4. Queue supports bill/payment search and filters.
5. Checkout shows totals, paid, outstanding.
6. Cash/card/MTN/Airtel are represented accurately.
7. Cash requires till.
8. Live mobile-money, PesaPal diner, live card, live printer, and delivered receipt claims are absent.
9. Split bill/items and split tender are backend-backed.
10. Receipt, till, refund, and Me states are covered.
