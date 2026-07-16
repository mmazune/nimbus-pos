# cashier_design.md — Nimbus POS Cashier Workspace Design Contract

Status: Draft v1  
Date: 2026-07-01  
Extends: `DESIGN.md`  
Primary surface: fullscreen desktop POS terminal

## 1. Purpose

This document defines the cashier-specific shell, layout, components, states, icon registry, density, and acceptance criteria. It extends the global design system and does not replace it.

## 2. Locked decisions

- Cashier uses shared login with Quick PIN default.
- `/api/auth/me` is resolved after login.
- Cashier lands on Queue.
- Fixed header and bottom nav.
- Bottom nav: Queue, Receipts, Till, Me.
- No Floor, Menu, More, owner dashboard, accounting dashboard, KDS actions, or waiter item editing.
- Cashier can settle, split, close, receipt, refund, and reconcile only through backend-supported endpoints.
- Cash, card, MTN, Airtel are shown as payment methods with strict caveats and backend mapping.
- PesaPal is excluded from diner checkout.

## 3. Shell

Header:
- brand/logo;
- branch;
- terminal label;
- current time;
- shift readiness chip;
- till readiness chip;
- cashier avatar/name;
- logout.

Readiness chips:
| State | Copy |
|---|---|
| Shift open | `Shift open` |
| No shift | `No shift` |
| Till open | `Till open` |
| No till | `No till` |
| Maintenance | `Maintenance` |
| Training | `Training mode` |
| Offline | `Offline` |

Bottom nav:
1. Queue — `ListChecks` / `Queue`
2. Receipts — `Receipt`
3. Till — `CashRegister`
4. Me — `UserCircle`

## 4. Queue layout

Queue is the cashier home.

Toolbar:
- search by order, table, waiter/server, safe guest field, payment reference if supported;
- filters: Bill requested, Ready to pay, Partially paid, Paid not closed, Closed today, Refund review, All active;
- sort: oldest first, highest outstanding, bill requested first.

Order card:
- order number;
- table/takeaway;
- waiter/server;
- order status;
- bill state;
- payment state;
- total, paid, outstanding;
- updated/bill-requested time;
- primary action: `Open checkout`.

## 5. Checkout detail layout

Two-zone layout:
- left/main: order identity, line items, totals, payment history, split/receipt/refund actions;
- right/sticky: outstanding, tender amount, method selector, input fields, caveat, submit, close order.

Order detail shows quantity, item name, modifiers/notes summary, line total, subtotal, tax, discount, total, paid, outstanding. No menu builder or waiter-style item editing.

## 6. Payment method panel

Method cards:
| Method | State | UI rule |
|---|---|---|
| Cash | Enabled only with active till | amount received, change due, note if supported |
| Card | Manual/stub/reference | reference field, no acquirer traffic |
| MTN | Provider-gated/manual reference | no live request-to-pay |
| Airtel | Provider-gated/manual reference | no live request-to-pay |

Payment action copy:
- `Record cash payment`
- `Record card reference`
- `Record manual MTN reference`
- `Record manual Airtel reference`
- `Close order`

## 7. Split and advanced resolution

Split bill:
- endpoint basis `POST /api/pos/orders/:id/split-bill`;
- allocation groups; exact math follows DTO.

Split items:
- endpoint basis `POST /api/pos/orders/:id/split-items`;
- select item quantities and create child order.

Advanced:
- merge, move items, transfer table/server;
- only under Advanced checkout resolution;
- confirm source, destination, and amount impact.

## 8. Receipts

Receipts screen:
- search/filter receipts;
- open receipt drawer;
- view receipt/history;
- reprint request;
- send-pending.

Caveats:
- `Metadata only — no print-driver invocation`
- `PENDING — no live email/SMS/WhatsApp adapter`

## 9. Till

Till screen:
- active shift;
- active till;
- opening float;
- cash payments;
- safe drops;
- expected cash;
- counted cash;
- variance;
- open till, safe drop, reconcile actions.

Cash payments are blocked without an active till.

## 10. Refund

Refund drawer:
- order/receipt identity;
- paid amount;
- previous refunds;
- refundable balance;
- refund amount;
- reason;
- method/reference if supported;
- status: completed/pending/denied.

Default: cashier can create/view if permitted, but cannot approve manager-gated refunds unless seed permissions prove it.

## 11. Me

Show cashier identity, role, branch, terminal, current time, shift state, till state, self-service if self-scoped, and logout. No payroll, staff list, reports, manager settings, accounting, or franchise data.

## 12. Icon registry

Shell: `Storefront`, `DesktopTower`, `Clock`, `SignOut`  
Queue: `MagnifyingGlass`, `SlidersHorizontal`, `Receipt`, `Armchair`, `UserFocus`, `WarningCircle`, `CheckCircle`  
Payments: `Money`, `CreditCard`, `DeviceMobile`, `WarningDiamond`, `Hash`, `ArrowsSplit`, `ArrowsMerge`, `ArrowsLeftRight`  
Receipts/till/refunds: `ClockCounterClockwise`, `Printer`, `EnvelopeSimple`, `ArrowCounterClockwise`, `Vault`, `Calculator`, `WarningOctagon`

## 13. Component inventory

- `CashierShell`, `CashierHeader`, `CashierBottomNav`, `CashierSessionGuard`
- `CashierQueueScreen`, `CashierQueueToolbar`, `CashierOrderCard`
- `CashierCheckoutPanel`, `CashierTotalsBlock`, `CashierPaymentHistory`
- `CashierPaymentMethodSelector`, `CashierTenderPanel`, `CashierCloseOrderButton`
- `CashierSplitBillPanel`, `CashierSplitItemsPanel`, `CashierMergeOrdersPanel`, `CashierMoveItemsPanel`
- `CashierReceiptsScreen`, `CashierReceiptDrawer`, `CashierReceiptHistory`, `CashierReceiptActions`
- `CashierTillScreen`, `CashierOpenTillPanel`, `CashierSafeDropPanel`, `CashierReconcilePanel`
- `CashierRefundPanel`, `CashierMeScreen`
- `CashierProviderPendingBanner`, `CashierHardwareStubBanner`, `CashierMaintenanceBanner`

## 14. Acceptance criteria

- Queue is landing screen.
- Header/nav match contract.
- Payment states and caveats are visible.
- Cash/card/MTN/Airtel are represented without unsupported live behavior.
- Split bill/items are advanced confirmed actions.
- Receipt/till/refund flows are covered.
- Admin/accounting/KDS/waiter-only actions are absent.
