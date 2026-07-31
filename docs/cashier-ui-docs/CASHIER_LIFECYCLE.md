# Cashier Lifecycle — Floor to Settlement

> **Status (2026-07-31): Prompt C2 IMPLEMENTED.** A table selection now resolves to zero/one/multiple
> payable bills and opens the read-only `CashierSettlementWorkspace` (bill detail + totals + payment
> state + readiness + history); a Find bill sibling handles tableless/takeaway/exact-id. Canonical
> URL state `?tableId=&orderId=`. Payment collection and order close **execution** arrive in C3.
>
> **(Superseded) Status (2026-07-31): Prompt C1 IMPLEMENTED.** Session entry now lands on `/cashier/floor`
> (shared Floor), and a table selection opens a **read-only** settlement boundary ("Select a bill
> to continue."). Table→order resolution and every settlement/payment/close/receipt step below is
> the locked **target**, delivered in C2–C6 — not yet built. See
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.

## 1. Session entry

1. Cashier authenticates.
2. Role and branch are resolved.
3. Operational readiness and current Till state are loaded through existing shared/session
   contracts.
4. Cashier lands on `/cashier/floor`.
5. Visible navigation is **Floor · Till · Me**.

The application must not send Cashier to Queue or Receipts.

## 2. Floor landing

Cashier sees the same shared Floor presentation as Waiter and Supervisor:

- toolbar;
- search and filters;
- floor selector;
- table grid;
- shared table cards;
- canonical statuses;
- reservation overlays;
- staff formatting;
- loading, empty, and error states;
- responsive behaviour.

Cashier may have a compact **Find bill** control as a sibling above the Floor. It does not
change the shared Floor tree.

## 3. Physical table selection

### 3.1 No payable order

- open an honest table context;
- show that no payable bill is available;
- do not fabricate an order;
- do not open Waiter menu entry;
- permit return to Floor.

### 3.2 One payable order

- set `tableId` and `orderId` in canonical URL state;
- load order, payment, split, receipt, and Till/readiness context;
- open settlement workspace;
- keep payment actions unavailable until all required reads succeed.

### 3.3 Multiple payable orders

- show a bounded order selector;
- identify each order by safe operational context such as order number, status, created time,
  service type, total, and outstanding balance;
- require explicit selection;
- never pick the first order silently.

### 3.4 Only terminal orders

- show no active bill;
- allow explicit recent-receipt access where supported;
- do not silently treat closed orders as payable.

## 4. Bill review

Before payment, Cashier reviews canonical:

- item lines;
- quantities;
- subtotal;
- tax;
- service charge where supported;
- discounts;
- total;
- split allocations;
- payments;
- outstanding balance;
- order status;
- bill-requested state.

Frontend calculations are previews only. The backend response and canonical refetch own
final totals.

## 5. Readiness and Till preflight

Before exposing settlement actions, verify:

- authenticated session;
- current branch;
- Cashier permission;
- operational readiness/shift;
- Till requirement for the selected method;
- current Till ownership;
- order eligibility;
- payment state availability;
- no conflicting pending mutation.

When any critical state is unknown, fail closed and show a recoverable operational message.

## 6. Split settlement

Reuse the existing Cashier split-resolution implementation.

Support only verified contracts:

- existing split-bill allocations;
- equal/custom allocations where already represented;
- outstanding allocation selection;
- partial settlement;
- canonical allocation completion;
- allocation-level payment state.

Do not create a second split model in the Cashier workspace.

## 7. Payment collection

Use the existing verified method contracts.

Possible supported methods include:

- cash;
- card/reference;
- mobile-money intent;
- other configured methods.

For each payment:

1. Cashier selects payable amount/allocation.
2. Method-specific validation runs.
3. A stable idempotency intent is created where supported.
4. Mutation enters one visible pending state.
5. Duplicate submit is blocked.
6. Canonical payment result is read.
7. Outstanding balance updates.
8. Floor and cross-role caches update narrowly.
9. One success or failure notification appears.

Do not represent a pending or failed payment as settled.

## 8. Partial payment

When outstanding balance remains:

- keep order open;
- show recorded payment and remaining balance;
- allow another verified payment;
- preserve split allocation state;
- update the Floor/card signal only through canonical summary data;
- do not close automatically unless the backend contract explicitly does so.

## 9. Order close

Expose Close only when the verified backend contract permits it.

Before close verify:

- balance is fully settled according to canonical state;
- order status is closable;
- no payment is pending;
- no conflicting mutation is active;
- required Till/payment records exist;
- linked reservation behaviour remains canonical.

After close:

- order becomes terminal;
- table releases according to backend lifecycle;
- linked SEATED reservation auto-completes through backend order-close integration;
- receipt context loads;
- Waiter and Supervisor Floor state update;
- Cashier remains in selected order receipt context until returning to Floor.

## 10. Receipt lifecycle

There is no standalone Receipts page.

Receipt actions live in the selected order workspace.

### 10.1 Initial receipt

After successful close or verified receipt creation:

- show receipt preview;
- show canonical receipt number/reference;
- expose Print and other supported delivery actions;
- do not fabricate printer success.

### 10.2 Reprint

Cashier opens a closed order through:

- the selected table's recent context; or
- Find bill using order/receipt reference.

Then:

- open the same receipt panel;
- use the verified reprint endpoint/driver boundary;
- record or display reprint state only where supported;
- preserve audit truthfulness.

### 10.3 Receipt delivery

Email, SMS, download, or other delivery actions appear only when verified by current
contracts. Do not invent delivery channels.

### 10.4 Refund entry

Eligible refund actions appear from the selected closed order/receipt context when existing
permissions and lifecycle allow them.

Refund is not a receipt action shortcut that bypasses canonical refund checks.

## 11. Find bill lifecycle

Find bill handles cases not reachable from a physical table:

- takeaway;
- tableless;
- direct order reference;
- direct receipt reference;
- partially paid orders;
- failed or pending payment;
- closed order receipt work;
- eligible refund context.

Flow:

1. Cashier opens Find bill from Floor.
2. Cashier enters or selects bounded filters.
3. Server-scoped results load.
4. Cashier selects one result.
5. The canonical settlement/receipt workspace opens.
6. URL preserves selected context.
7. Back returns to Floor/lookup state.

Find bill does not become an infinite Queue page.

## 12. Till lifecycle

Till remains a standalone tab.

Cashier may:

- inspect current Till state;
- open a Till session where verified;
- record supported cash movements;
- reconcile or close where verified;
- review permitted Till history.

Settlement reads Till state but does not duplicate Till management.

## 13. Me and logout

Me uses the shared profile primitives.

Cashier can review role/branch/readiness context and log out. Idle-session handling uses the
shared operational mechanism.

## 14. Cross-role lifecycle

### Waiter → Cashier

- Waiter creates/sends order.
- Waiter requests bill.
- Shared Floor reflects canonical state.
- Cashier selects table and settles.

### Supervisor → Cashier

- Supervisor may serve, split, move, merge, transfer, void active order, request/approve
  Discount, or apply Complimentary according to permissions.
- Cashier settlement reads canonical resulting bill.
- Cashier alone collects payment and closes.

### Cashier → Waiter/Supervisor

- partial payment updates payment/bill context;
- close releases table and updates shared Floor;
- receipt remains Cashier context;
- Waiter/Supervisor do not gain payment controls.

## 15. Legacy route lifecycle

- `/cashier` redirects to `/cashier/floor`.
- `/cashier/queue` redirects to Floor/Find bill while preserving safe lookup context.
- `/cashier/receipts` redirects to Floor/receipt context while preserving safe receipt/order
  parameters.
- redirect paths never mutate.
- no loop is permitted.

## 16. Error and recovery lifecycle

Handle:

- order no longer payable;
- payment state changed;
- split allocation changed;
- Till unavailable;
- session expired;
- branch mismatch;
- duplicate payment;
- payment timeout;
- printer unavailable;
- receipt not found;
- refund ineligible;
- stale table selection.

Refresh canonical state after conflicts. Preserve safe form input where possible. Never claim
success before canonical success.
