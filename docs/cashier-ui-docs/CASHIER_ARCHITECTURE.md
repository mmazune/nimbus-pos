# Cashier Floor-First Architecture

> **Status (2026-07-31): Prompt C2 IMPLEMENTED.** Behind a Floor table selection, one bounded
> `GET /pos/orders?tableId=` query is classified by `lib/cashier/bill-resolution.ts` (fail-closed)
> into zero/one/multiple payable bills: one auto-resolves, multiple opens `CashierBillSelector`
> (no silent first-pick), zero shows a truthful empty state. A selected bill opens the single
> read-only `CashierSettlementWorkspace` (Bill/Totals/Payment state/Settlement readiness/History)
> reusing the checkout primitives; a Cashier-only `CashierFindBillDialog` sibling handles
> tableless/takeaway/exact-id lookup. Canonical URL state is `?tableId=&orderId=`. Payment/close
> **execution** is C3.

## Decision status

**Locked target architecture. Prompt C1 IMPLEMENTED (2026-07-31); C2+ pending.**

C1 delivered the shared parts of this document: Cashier nav Floor/Till/Me, `/cashier/floor`
default (bare `/cashier` redirects there), Cashier as the third shared `OperationalFloor` consumer,
the `?tableId=` selection URL model, and a **read-only** truthful selected-table boundary
(`CashierSelectedTablePanel`, copy "Select a bill to continue.") that C2 replaces with the real
settlement workspace. Everything below about **table-to-order resolution, the settlement
workspace, payment, close, receipt context, and Find bill remains the TARGET, not yet built**
(C2–C6). The **legacy route policy** below (redirecting `/cashier/queue` and `/cashier/receipts`)
is also a later-phase target — in C1 those routes are hidden compatibility routes that are **not**
redirected. See `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.

The Cashier rebuild is a workflow recomposition around the shared operational Floor. It
preserves the already-built payment, split, receipt, Till, refund, profile, session, and
performance capabilities while removing Queue and Receipts as standalone navigation and
page concepts.

## Visible navigation

Cashier visible navigation is exactly:

1. **Floor**
2. **Till**
3. **Me**

The default route is `/cashier/floor`.

`/cashier/queue` and `/cashier/receipts` are legacy compatibility routes only. They must
redirect into `/cashier/floor` while preserving safe order, table, receipt, and lookup
context when possible.

## Shared operational model

All three operational roles consume the same default Floor presentation:

| Role | Shared default surface | Result after table selection |
| --- | --- | --- |
| Waiter | OperationalFloor | Menu and order-entry workspace |
| Supervisor | OperationalFloor | Read-first control and exception workspace |
| Cashier | OperationalFloor | Bill settlement, payment, close, and receipt workspace |

The Floor toolbar, search, status filters, floor selector, grid, cards, status labels,
staff formatting, reservation overlay, loading, empty, error, and responsive behaviour
remain shared.

Cashier-specific behaviour must not fork `OperationalFloor`.

## Floor-level Cashier controls

The Cashier Floor page may add compact sibling controls outside the shared Floor component:

- **Find bill** — bounded lookup for tableless, takeaway, closed, partially-paid, failed,
  pending-payment, direct order, and receipt-reference cases.
- optional compact open-bill count only when supplied by an efficient server contract.

These controls must not become a new dashboard, Queue page, or fourth navigation tab.

## Table card contract

Cashier uses the same table card structure as Waiter and Supervisor.

Shared card content may include:

- table label;
- capacity;
- canonical table status;
- assigned staff formatting;
- reservation indicator;
- shared-safe active-order or bill-requested indicator when available from the existing
  bounded Floor summary.

The card must not include:

- guest names;
- full payment history;
- card or mobile-money references;
- one payment fetch per table;
- Cashier-only card layout forks.

Outstanding balance or payment exception detail belongs in the selected workspace unless
an efficient shared summary contract already exists.

## Table-to-order resolution

When the Cashier selects a table, resolve the payable context canonically:

1. Refetch or validate the table summary.
2. Identify active/payable orders scoped to the current branch and table.
3. If there is one payable order, open it.
4. If there are multiple payable orders, show a bounded order selector.
5. If there is no payable order, show an honest no-bill state.
6. If only terminal orders exist, do not silently open history; offer recent receipt
   context only through an explicit action.
7. Preserve `tableId`, `orderId`, and `receiptId` in URL state where relevant.
8. Back, Forward, and refresh must restore understandable context.

Never infer the order from table ID alone when multiple candidates exist.

## Cashier settlement workspace

The selected workspace is the canonical home for all bill and receipt work.

### Header and context

- back to Floor;
- table or service type;
- order number;
- waiter/server where operationally useful;
- canonical order status;
- bill-requested state;
- payment state;
- Till/readiness state.

### Bill review

- item lines and quantities;
- subtotal;
- tax;
- discounts;
- service charge where supported;
- total;
- split allocations;
- payments already recorded;
- outstanding balance;
- refund state where relevant.

### Settlement

Reuse existing verified Cashier flows for:

- split-bill resolution;
- partial payment;
- cash payment;
- card/reference payment where supported;
- mobile-money intent where supported;
- duplicate-payment prevention;
- failed/pending payment recovery;
- outstanding-balance recalculation;
- order close when the backend permits it.

### Receipt context

After payment/close, or when a closed order is opened through Find bill, show:

- receipt preview;
- print;
- reprint;
- send/deliver where supported;
- download/export where supported;
- receipt history for the selected order;
- eligible refund entry point where the current contract permits it.

There is no standalone Receipts page.

## Find bill architecture

Find bill replaces Queue and Receipts navigation without discarding their non-table
responsibilities.

It must be bounded and branch-scoped. Supported lookup fields should be verified from the
backend and may include:

- order number;
- order ID/reference;
- receipt number/reference;
- table;
- service type;
- payment state;
- order status;
- date range;
- tableless/takeaway filter.

A selected result opens the same settlement/receipt workspace. Find bill must not duplicate
payment, receipt, or refund logic.

## Till architecture

Till remains a standalone navigation tab because it represents workstation/cash-session
state rather than a selected order.

Till owns existing verified flows such as:

- open Till/session;
- cash movements;
- current cash position;
- reconciliation/close where supported;
- Till history where supported.

The settlement workspace consumes Till readiness but does not duplicate Till management.

## Me architecture

Me remains the shared profile implementation with Cashier role, branch, readiness, session,
and logout context.

## Role boundaries

Cashier owns payment collection, order close, receipts, Till-dependent cash handling, and
existing refund actions.

Cashier must not gain:

- Waiter menu/order entry;
- Supervisor active-order Void unless an existing verified Cashier contract already owns it;
- Supervisor approval actions;
- transfer-server;
- Manager administration.

Waiter and Supervisor must not gain Cashier payment or close actions.

## Legacy route policy

During migration:

- `/cashier` → `/cashier/floor`;
- `/cashier/queue` → `/cashier/floor` or `/cashier/floor?lookup=...`;
- `/cashier/receipts` → `/cashier/floor?receiptId=...` or Find bill state;
- legacy selected-order parameters must be preserved safely;
- redirects must not loop or trigger mutation.

Obsolete components may be removed only after reference searches and executable regression
prove that every capability is reachable from Floor, Find bill, Till, or Me.

## Performance boundaries

The target must preserve prior Cashier startup hardening.

Required constraints:

- no per-table payment fetch;
- no Queue plus Floor duplicate initial queries;
- no duplicate selected-order detail;
- no duplicate `/auth/me`;
- no responsive double mount;
- no broad invalidation storm after payment or close;
- mutation pending state settles before secondary refreshes;
- table card updates remain narrow and canonical.

## Security and data integrity

- unknown payment state is not unpaid;
- payments and close fail closed on missing readiness/Till/session/branch context;
- monetary values remain Decimal-safe;
- payment writes remain idempotent where contracts support it;
- shared Neon is read-only for destructive QA;
- disposable QA identity must be proven before mutation;
- guest names never appear on Floor cards;
- payment references are not exposed outside operational need.
