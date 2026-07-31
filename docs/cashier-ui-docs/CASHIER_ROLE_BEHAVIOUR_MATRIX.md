# Operational Role Behaviour Matrix

## Shared default surface

| Capability | Waiter | Supervisor | Cashier |
| --- | --- | --- | --- |
| Default route | `/waiter/floor` | `/supervisor/floor` | `/cashier/floor` |
| Shared `OperationalFloor` | Yes | Yes | Target: Yes |
| Shared toolbar/grid/cards | Yes | Yes | Target: Yes |
| Guest names on Floor cards | No | No | No |
| Table selection | Menu/order entry | Read/control workspace | Settlement/payment workspace |
| Tableless exception lookup | No general Orders tab | Find order sibling control | Find bill sibling control |

## Visible navigation

| Role | Visible navigation |
| --- | --- |
| Waiter | Floor · Reservations · Me |
| Supervisor | Floor · Reservations · Approvals · Me |
| Cashier | Floor · Till · Me |

Cashier does not have visible Queue or Receipts navigation.

## Order capabilities after selection

| Capability | Waiter | Supervisor | Cashier |
| --- | --- | --- | --- |
| Review items/totals | Yes | Yes | Yes |
| Add/configure menu items | Yes | No | No |
| Send order | Yes | No | No |
| Request bill | Yes | Yes | Read state; may use existing verified action only if already shipped |
| Mark served | No | Yes | No |
| Split bill/items | Limited to current Waiter contract | Yes, operational control | Resolve existing payable allocations; do not duplicate Supervisor split logic |
| Move/merge/transfer | No | Yes | No |
| Active-order Void | No | Yes | Only if existing Cashier refund/void contract explicitly permits; otherwise No |
| Discount request/decision | No or request per existing contract | Yes | Read canonical result; no Supervisor approval controls |
| Complimentary | No | Yes | Read canonical result |
| Collect payment | No | No | Yes |
| Partial payment | No | No | Yes |
| Close order | No | No | Yes |
| Receipt print/reprint | No | No | Yes |
| Eligible refund | No | No | Yes, through existing verified refund contract |
| Till handling | No | No | Yes |

## Reservation capabilities

| Capability | Waiter | Supervisor | Cashier |
| --- | --- | --- | --- |
| Reservation active view | Yes | Yes | Only order-linked read context where useful |
| Create/manage reservation | Existing Waiter scope | Full verified Supervisor lifecycle | No general reservation management |
| Reservation guest identity | Reservations only | Reservations only | Only selected order/receipt context where contract requires it |
| Guest identity on Floor | Never | Never | Never |
| Order-close auto-completion | Triggered indirectly by Cashier close | Read result | Cashier close triggers backend integration |

## Approval capabilities

| Capability | Waiter | Supervisor | Cashier |
| --- | --- | --- | --- |
| Approvals page | No | Yes | No |
| Discount approval/rejection | No | Yes | No |
| Leave decisions | No | Yes | No |
| Shift-swap reject | No | Yes | No |
| Anomaly acknowledge/resolve | No | Yes | No |

## Receipt access model

| Case | Cashier access path |
| --- | --- |
| Newly closed table order | Receipt panel in selected settlement workspace |
| Reprint for known table/order | Select table or use recent selected context, then open receipt panel |
| Receipt reference only | Floor → Find bill → receipt result → same receipt panel |
| Tableless/takeaway receipt | Floor → Find bill → selected order/receipt workspace |
| Refund from receipt | Selected receipt panel → verified refund flow |

There is no standalone Receipts page.

## Queue responsibility migration

| Previous Queue responsibility | New location |
| --- | --- |
| Physical dine-in bills | Shared Floor table selection |
| Bill review | Settlement workspace |
| Payment entry | Settlement workspace |
| Split settlement | Settlement workspace |
| Partially paid orders | Floor signal when efficient; otherwise Find bill |
| Failed/pending payment | Selected workspace or Find bill |
| Takeaway/tableless | Find bill |
| Direct order lookup | Find bill |
| Closed order lookup | Find bill |
| Receipt reprint | Selected receipt panel |

There is no standalone Queue page after migration.

## Shared component invariants

- All roles share `OperationalShell` primitives.
- All roles share `OperationalFloor` and table cards.
- Role-specific controls may be siblings outside the shared Floor, not forks.
- Role-specific workspace behaviour begins after table/order selection.
- Shared component changes require regression across all consumers.
- Cashier financial logic remains isolated from Waiter/Supervisor action availability.
