# Cashier Floor Reconstruction Decision

**Decision status:** LOCKED

**Decision date:** 2026-07-31

## Superseded model

The previously completed Cashier UI used visible navigation:

- Queue
- Receipts
- Till
- Me

That implementation remains a historical and technical source for existing payment,
split, receipt, Till, refund, session, profile, and performance capabilities. Its
Queue-first information architecture is superseded.

## New canonical model

Cashier visible navigation is exactly:

- **Floor**
- **Till**
- **Me**

Cashier lands on the same shared Floor presentation used by Waiter and Supervisor.

After table selection:

- Waiter opens menu/order entry;
- Supervisor opens read/control/exception handling;
- Cashier opens bill settlement, payment, close, receipt, and eligible refund context.

Queue and Receipts are removed as standalone navigation and pages after their legitimate
capabilities are migrated.

## Exception access

Tableless, takeaway, partially-paid, failed/pending-payment, closed-order, direct-order,
and receipt-reference cases are accessed through a compact **Find bill** control on the
Cashier Floor page.

Find bill is:

- bounded;
- branch-scoped;
- a sibling outside shared `OperationalFloor`;
- not a fourth tab;
- not a new Queue page;
- an entry into the same canonical settlement/receipt workspace.

## Receipt decision

Receipt actions belong to the selected order context:

- initial print;
- reprint;
- supported delivery;
- receipt history for selected order;
- eligible refund entry.

There is no standalone Receipts page in the target architecture.

## Shared-component decision

Cashier becomes the third consumer of:

- shared operational shell;
- shared header/clock/logout;
- shared bottom navigation primitive;
- shared `OperationalFloor`;
- shared table cards;
- shared Floor loading/empty/error/responsive states;
- shared profile primitives.

Role-specific behaviour starts after selection. Cashier-specific Floor controls may be
siblings but must not fork the shared Floor.

## Financial ownership

Cashier remains the sole operational owner of:

- payment collection;
- partial payment;
- split settlement;
- order close;
- receipt actions;
- Till-dependent cash handling;
- existing refund actions.

Waiter and Supervisor remain unable to collect payment or close orders.

## Implementation strategy

Reconstruction occurs in seven prompts C0–C6. Working financial logic is reused and moved
into the new workflow before legacy Queue/Receipts components are removed.

Manager reconstruction remains blocked until Cashier C6 closes.

## Why this decision

The three operational roles should share one spatial table model and diverge only in the
workspace opened after selection. This reduces duplicated navigation concepts, aligns
Cashier with the completed Waiter/Supervisor experience, and keeps bill/receipt actions
attached to the order they affect.

The Find bill exception path preserves operational access to orders that cannot be reached
through a physical table without restoring Queue or Receipts as primary navigation.
