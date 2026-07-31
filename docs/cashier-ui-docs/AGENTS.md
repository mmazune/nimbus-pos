# Cashier Floor-First Reconstruction — Agent Instructions

Read this file before modifying Cashier UI code.

## Repository safety

Use only:

`C:\Users\arman\Desktop\nimbus-pos`

Never use:

`C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

The local dirty worktree is authoritative. Never reset, restore, stash, clean, discard,
or overwrite unrelated work. Do not commit or push unless explicitly instructed.

## Locked visible navigation

Cashier visible navigation is exactly:

- **Floor**
- **Till**
- **Me**

Do not retain, recreate, or add visible navigation entries for:

- Queue;
- Receipts;
- Orders;
- Refunds;
- Reports;
- Settings.

Legacy `/cashier/queue` and `/cashier/receipts` routes may remain only as redirects into
the canonical Floor/settlement workflow while preserving safe context parameters.

## Locked default workflow

1. Cashier lands on the shared Floor.
2. Cashier taps a physical table.
3. The application resolves the payable order or presents a bounded order selector.
4. The Cashier settlement workspace opens.
5. Cashier reviews bill, split allocations, discounts, payments, and outstanding balance.
6. Cashier collects payment using existing verified payment logic.
7. Cashier closes the order when the backend contract permits it.
8. The receipt panel appears in the same workspace.
9. Cashier can print, reprint, deliver, or open eligible refund actions from that selected
   order/receipt context.
10. Cashier returns to Floor; table and cross-role state update canonically.

## Tableless and historical exception path

Physical table selection cannot reach takeaway, tableless, or already-closed orders.
Provide a compact **Find bill** control on the Cashier Floor page for:

- takeaway orders;
- tableless orders;
- direct order reference;
- receipt reference;
- partially paid orders;
- failed or pending payment states;
- closed orders requiring receipt reprint or eligible refund work.

Find bill is not a Queue replacement page. It is a bounded lookup that opens the same
canonical settlement/receipt workspace.

## Shared-component rule

Cashier must become the third consumer of the shared operational system.

Reuse, extend, or compose existing shared primitives under:

- `apps/web/src/components/pos-shell/`;
- `apps/web/src/components/floor/`;
- `apps/web/src/components/profile/`;
- shared selected-order/workspace primitives where already available.

Do not fork:

- Floor toolbar;
- Floor selectors;
- table grid;
- table cards;
- table status presentation;
- loading, empty, or error states;
- responsive Floor breakpoints;
- shared header, clock, logout, or bottom-navigation primitives.

Cashier-specific behaviour begins only after table/order selection, except for the compact
Find bill sibling control.

## Shared Floor parity

Waiter, Supervisor, and Cashier must render the same default `OperationalFloor`
presentation for matching branch/data state.

Role outcomes after table selection:

- Waiter → menu and order-entry workspace;
- Supervisor → read-first control and exception workspace;
- Cashier → settlement, payment, close, and receipt workspace.

Do not display guest names on Floor cards.

Do not add per-table payment queries or N+1 order/payment requests. A shared-safe bill
indicator may be added only when it is available from a bounded existing Floor summary.
Otherwise keep payment detail inside the selected settlement workspace.

## Financial ownership

Cashier owns:

- bill review;
- split settlement;
- payment collection;
- partial payment;
- payment retry;
- order close;
- receipt printing/reprinting/delivery;
- Till-dependent cash handling;
- existing eligible refund workflow.

Waiter and Supervisor must not gain payment collection or order close.

Do not rewrite proven payment, split, receipt, Till, or refund logic. Recompose existing
components into the new workspace and preserve idempotency, Decimal safety, payment-state
truthfulness, and fail-closed behaviour.

## Till and payment preflight

Settlement must fail closed when:

- active shift/readiness is unavailable;
- required Till session is unavailable;
- payment state fails to load;
- branch context is missing;
- session is expired;
- selected order is no longer payable;
- another mutation is already pending.

Do not interpret unknown payment state as unpaid.

## Multiple-order table rule

Never silently choose the wrong order.

When a table has:

- zero payable orders → show an honest empty table state;
- one payable order → open it directly;
- multiple payable orders → show a bounded selector inside the Cashier workspace;
- only terminal orders → offer recent/receipt context only when requested;
- stale or conflicting data → refetch and show a clear conflict state.

## Queue and Receipts removal rule

Do not delete working capabilities before they are reachable from the new workflow.

Removal order:

1. build shared Cashier Floor;
2. build table/order settlement workspace;
3. migrate payment/split/close;
4. migrate receipt/reprint/delivery/refund;
5. migrate tableless/takeaway/direct lookup into Find bill;
6. add legacy redirects;
7. remove obsolete Queue/Receipts components only after reference searches and executable QA.

## Cache and performance rules

Use targeted query updates for:

- shared Floor;
- selected order;
- payment state;
- split allocations;
- receipt state;
- Till state;
- Waiter Floor;
- Supervisor Floor.

Do not broadly invalidate all role data. Do not reintroduce duplicate `/auth/me`, responsive
double mounts, per-row identity/payment requests, or blocked mutation settlement.

## Validation

Every implementation phase must run the relevant subset of:

- web typecheck, lint, and build;
- API typecheck/build where touched;
- focused Jest tests;
- Cashier assertions;
- shared shell/Floor assertions;
- actual Playwright execution at 1024×768, 1366×768, 1440×900, 1920×1080;
- Waiter and Supervisor regressions;
- API health;
- Postman JSON validation;
- `git diff --check`.

Destructive payment/order QA must use the established fail-closed disposable database
launcher. Shared Neon remains read-only unless a fresh explicit write gate is granted.

## Phase discipline

The reconstruction is seven prompts, C0 through C6. Do not skip directly to removal or
final QA. Do not begin Manager reconstruction until C6 closes Cashier.
