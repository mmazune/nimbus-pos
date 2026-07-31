# Cashier Component Reuse Map

> **Status (2026-07-31): Prompt C2 IMPLEMENTED.** C2 added `CashierBillResolutionPanel`,
> `CashierBillSelector`, `CashierSettlementWorkspace`, and `CashierFindBillDialog`. The settlement
> workspace **reuses** existing checkout primitives (`queue/CashierOrderTotals`,
> `queue/CashierPaymentSummary`, `queue/CashierQueueStatusBadge`, `lib/cashier/order-state`)
> rather than forking them — no duplicated financial logic, one selected-order model.
>
> **(Superseded) Status (2026-07-31): Prompt C1 IMPLEMENTED.** C1 added the Cashier shared-Floor consumer
> (`components/cashier/floor/CashierFloorScreen.tsx` + `CashierSelectedTablePanel.tsx`) and its
> data layer (`lib/cashier/floor-api.ts`, `floor-model.ts`, `floor-route.ts`), all reusing the
> shared `OperationalFloor`/`OperationalTableWorkspaceFrame`/floor formatters — no forked Floor
> primitives. `CashierCheckoutPreview` reuse for the settlement workspace is a C2/C3 step (not yet
> wired). `CashierTransferTablePanel` stays out of the new Floor/settlement architecture.

## Objective

Recompose the existing Cashier capability set into a shared Floor-first workflow without
forking the operational shell/Floor or rewriting proven financial logic.

## Shared shell

| Concern | Required source | Cashier action |
| --- | --- | --- |
| Header | `components/pos-shell/OperationalHeader` or current shared equivalent | Reuse through thin Cashier adapter |
| Clock | shared `CurrentTime` | Reuse; one timer only |
| Logout | shared logout primitive | Reuse |
| Bottom nav | shared `OperationalBottomNav` | Configure exactly Floor/Till/Me |
| Icons | canonical role icon registry | Add/reuse names; no direct route-level icon imports |
| Idle handling | shared `pos-shell/idle` mechanism | Reuse; one handler |
| Page container | shared operational shell spacing | Reuse |
| Profile | shared profile primitives | Preserve current Cashier Me adapter |

## Shared Floor

| Concern | Required source | Cashier action |
| --- | --- | --- |
| Floor page core | `components/floor/OperationalFloor` | Add Cashier as third consumer |
| Toolbar/search/filter | shared Floor components | Reuse unchanged where possible |
| Floor selector | shared selector | Reuse |
| Table grid | shared grid | Reuse |
| Table card | shared card | Reuse; no Cashier fork |
| Status/staff formatting | shared formatters | Reuse |
| Reservation overlay | shared Floor data | Reuse; no guest names |
| Loading/empty/error | shared states | Reuse |
| Responsive breakpoints | shared Floor layout | Reuse |
| Table selection callback | role adapter | Route Cashier to settlement workspace |
| Find bill | Cashier-only sibling outside `OperationalFloor` | New bounded control, similar architectural placement to Supervisor Find order |

## Selected order and workspace primitives

Audit before creating new abstractions. Prefer reuse of:

- selected-order query keys;
- order header/context components;
- item-line presentation;
- totals/financial formatting;
- payment-state read components;
- confirmation/dialog primitives;
- URL selection helpers;
- pending/error notification patterns.

Where Waiter and Supervisor already share a selected-order shell, extend it carefully for
Cashier. Do not force financial controls into a shared component that would expose them to
other roles.

## Existing Cashier capability migration

| Existing capability | Target location | Rule |
| --- | --- | --- |
| Queue order list | Remove as page; responsibilities split between Floor and Find bill | Do not delete until all paths migrated |
| Queue filters/search | Find bill bounded lookup and optional Floor filters | Preserve tableless/takeaway/direct lookup |
| Payment entry | Settlement workspace | Reuse existing mutations and validation |
| Split resolution | Settlement workspace | Reuse current allocation logic |
| Partial payment | Settlement workspace | Reuse current payment state logic |
| Close order | Settlement workspace | Reuse canonical endpoint/gating |
| Receipts list/detail | Selected receipt panel + Find bill | Remove standalone page after migration |
| Print/reprint/delivery | Selected receipt panel | Reuse current contracts |
| Refunds | Selected closed order/receipt context | Reuse existing eligibility and mutations |
| Till | Till tab | Preserve as standalone surface |
| Me | Me tab | Preserve shared profile implementation |
| Session/readiness | Shared shell + settlement preflight | Preserve existing request hardening |

## New Cashier-specific components likely required

Names are conceptual; follow repository conventions after audit.

- `CashierFloorPageAdapter`
- `CashierFindBillControl`
- `CashierBillLookupDialog` or drawer
- `CashierTableSettlementWorkspace`
- `CashierPayableOrderSelector`
- `CashierSettlementPreflight`
- `CashierBillSummary`
- `CashierPaymentWorkspaceAdapter`
- `CashierReceiptPanel`
- legacy Queue/Receipts redirect pages

Do not create all of these automatically. First identify existing components that already
satisfy each responsibility.

## Query reuse

Prefer canonical query domains for:

- shared Floor;
- selected order detail;
- order payments;
- bill splits/allocations;
- receipt detail/history for selected order;
- Till state;
- bounded Find bill results.

Avoid:

- one payment query per table;
- Queue and Floor loading the same active orders at startup;
- duplicate selected-order requests;
- receipt list loading on Floor entry;
- broad `invalidateQueries()` across every Cashier domain.

## Removal gate

A previous Queue or Receipts component may be deleted only when:

1. no route imports it except a redirect scheduled for removal;
2. no current Cashier capability depends on it;
3. corresponding functionality is executable from Floor/Find bill/settlement;
4. tests cover its migrated responsibility;
5. four-viewport browser QA passes;
6. Waiter/Supervisor shared components remain unchanged or regressions pass.

## Shared-component change gate

Any change under shared shell, Floor, profile, or selected-order primitives requires:

- Waiter regression;
- Supervisor regression;
- Cashier regression;
- responsive matrix;
- request-count comparison;
- accessibility check;
- privacy check.
