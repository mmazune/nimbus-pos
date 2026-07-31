# Cashier Floor-First Reconstruction Test Plan

## Test principles

- Execute tests; compilation or discovery is not a pass.
- Destructive payment/order tests use fail-closed disposable infrastructure.
- Shared Neon remains read-only unless a fresh explicit write gate is granted.
- Shared component changes require all consuming roles to regress.
- Financial state is canonical from backend responses and refetches.
- Test artifacts must not contain guest or payment PII.

## Static gates for every implementation prompt

Run:

```bash
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
```

Run API build/typecheck when API code changes.

Always run:

- focused assertions;
- relevant Jest suites;
- Postman JSON parsing;
- `git diff --check`.

## Required viewport matrix

- 1024 × 768
- 1366 × 768
- 1440 × 900
- 1920 × 1080

At every viewport verify:

- shared shell;
- three-item navigation;
- Floor toolbar/grid/cards;
- Find bill;
- table-selected workspace;
- multiple-order selector;
- payment form;
- split allocation UI;
- receipt panel;
- Till;
- Me;
- no horizontal overflow;
- no bottom-nav obstruction;
- no duplicated responsive mount;
- visible focus;
- dialogs remain within viewport.

## Shared Floor parity

At matching branch/data state capture and compare Waiter, Supervisor, and Cashier:

- toolbar;
- search/filter controls;
- floor selector;
- grid geometry;
- table cards;
- status labels;
- staff formatting;
- capacity;
- reservation indicator;
- spacing;
- typography;
- loading/empty/error states;
- responsive breakpoints.

Only role-specific sibling controls may differ:

- Supervisor Find order;
- Cashier Find bill.

## Routing tests

Verify:

- `/cashier` → `/cashier/floor`;
- Floor is default after login;
- `/cashier/queue` redirects without loop;
- `/cashier/receipts` redirects without loop;
- `tableId`, `orderId`, `receiptId`, and lookup state preserve safely;
- refresh restores selected context;
- Back and Forward remain understandable;
- role guards deny Waiter/Supervisor access to Cashier settlement routes.

## Table selection matrix

Test:

- available table with no order;
- one active payable order;
- multiple payable orders;
- split child orders;
- merged order context;
- partially paid order;
- failed/pending payment;
- terminal order only;
- reservation without order;
- stale Floor summary;
- cross-branch order rejection.

No case may silently select the wrong order.

## Find bill matrix

Test bounded lookup for:

- order number;
- exact order ID/reference;
- receipt reference;
- table;
- takeaway;
- tableless;
- partially paid;
- pending payment;
- failed payment;
- closed order;
- missing result;
- cross-branch result;
- pagination/maximum page size;
- URL persistence.

Verify it opens the same settlement/receipt workspace rather than a parallel page.

## Payment matrix

Test existing supported contracts for:

- cash;
- card/reference;
- mobile-money intent where supported;
- partial payment;
- split allocation payment;
- exact remaining balance;
- overpayment rejection/handling;
- zero/negative amount rejection;
- duplicate submit;
- idempotent replay where supported;
- pending result;
- failed result;
- retry;
- session expiry;
- missing branch;
- Till required/unavailable;
- unknown payment state fail-closed.

Verify Decimal-safe totals and no negative balance.

## Close-order matrix

Verify:

- fully settled closable order succeeds;
- unpaid order rejected;
- partially paid order rejected;
- pending payment blocks;
- invalid status rejected;
- duplicate close safe;
- table releases canonically;
- linked SEATED reservation auto-completes;
- unlinked order does not alter reservations;
- receipt context opens;
- Waiter/Supervisor Floor updates.

## Receipt matrix

Verify:

- initial receipt preview;
- print request;
- printer unavailable boundary;
- reprint from selected closed order;
- reprint via Find bill receipt lookup;
- supported delivery action;
- missing receipt;
- duplicate print/reprint semantics;
- receipt data privacy;
- no standalone Receipts page required.

## Refund matrix

Run only existing verified refund contracts:

- eligible receipt/order;
- ineligible order;
- already refunded state;
- partial/full refund where supported;
- reason requirement;
- permission denial;
- duplicate submission;
- canonical payment/receipt state update;
- no Supervisor/Waiter refund controls.

## Till matrix

Verify:

- Till tab visible;
- current Till state;
- open session where supported;
- wrong-user Till handling;
- cash payment preflight;
- non-cash method policy;
- cash movement/reconciliation paths where already shipped;
- no automatic Till creation;
- settlement cache updates after Till state changes.

## Performance/request counts

Record cold and warm counts for:

- login;
- Cashier Floor load;
- table selection;
- selected order load;
- payment state load;
- Find bill open/search;
- payment mutation;
- close;
- receipt panel;
- return to Floor.

Reject regressions including:

- Queue and Floor both loading at startup;
- one payment query per table;
- duplicate `/auth/me`;
- duplicate selected-order detail;
- responsive double mount;
- full receipt history on Floor load;
- broad invalidation storm;
- permanent pending state.

## Cross-role regression

### Waiter

- shared Floor remains identical;
- instant table-to-menu remains;
- order entry remains;
- no payment/close/receipt/refund controls;
- reservation overlays remain;
- Me/idle remain.

### Supervisor

- shared Floor remains identical;
- table selection opens control workspace;
- Prompt 3 actions remain;
- Reservations and Approvals remain;
- payment read-only;
- no Cashier settlement controls.

### Cashier

- Floor/Till/Me only;
- no Queue/Receipts nav;
- table selection opens settlement;
- Find bill covers non-table cases;
- payment, close, receipts, refunds, Till, and Me remain functional.

## Privacy and security

Verify:

- no guest names on Floor cards;
- no payment references on Floor cards;
- no full card data anywhere;
- no guest contact data in logs/screenshots;
- no cross-branch bill lookup;
- no role leakage;
- unknown payment state fails closed;
- shared Neon before/after counts match;
- disposable sentinel never appears on shared.

## Final closure evidence

C6 must produce:

- executed Playwright totals across all four viewports;
- API/Jest totals;
- live payment/close/receipt/refund matrix results;
- shared Floor parity screenshots;
- request-count evidence;
- shared-Neon before/after evidence;
- cleanup proof;
- final demo script;
- final known-limitations register;
- final Cashier completion report.
