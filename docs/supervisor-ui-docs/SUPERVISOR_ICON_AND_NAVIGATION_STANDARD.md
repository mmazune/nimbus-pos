# Supervisor Icon And Navigation Standard

Status: Prompt 2 implemented navigation and Floor-context standard
Date: 2026-07-18

## Visible Supervisor Nav

Supervisor visible bottom nav must be exactly:

| Order | Label | Route | Icon |
|---|---|---|---|
| 1 | Floor | `/supervisor/floor` | `SquaresFour` |
| 2 | Reservations | `/supervisor/reservations` | `CalendarCheck` |
| 3 | Approvals | `/supervisor/approvals` | `ShieldCheck` |
| 4 | Me | `/supervisor/me` | `UserCircle` |

`/supervisor/orders` is a legacy-only compatibility route. It redirects to Floor, preserves `tableId`, and preserves/resolves `orderId` as Floor workspace context. It has no visible or hidden clickable navigation item.

The shared default Floor and its table cards do not add role-specific decorative icons. Back and Close remain accessible controls inside the single shared workspace frame. Waiter and Supervisor diverge only in the workspace content mounted after selection.

## Shared Icon Registry

| Concept | Icon |
|---|---|
| Floor | `SquaresFour` |
| Reservations | `CalendarCheck` |
| Approvals | `ShieldCheck` |
| Me/Profile | `UserCircle` |
| Search | `MagnifyingGlass` |
| Back | `ArrowLeft` |
| Close | `X` |
| Refresh | `ArrowClockwise` |
| Warning | `WarningCircle` |
| Success | `CheckCircle` |
| Logout | `SignOut` |
| Time | `Clock` |
| Branch | `Storefront` |
| Workstation | `DesktopTower` |
| Service area | `MapPin` |
| Table | `Table` |
| Split | `GitBranch` |
| Merge | `GitMerge` |
| Transfer | `ArrowsLeftRight` |
| Refund | `ReceiptX` |
| Void | `Prohibit` |
| Seat | `Armchair` |
| Leave | `CalendarBlank` |
| Shift swap | `ArrowsClockwise` |
| Anomaly | `WarningDiamond` |

## Rules

- Equivalent concepts must use the registry.
- Icon-only controls need accessible labels or tooltips.
- Do not introduce decorative icon variants per role.
- Nav labels must fit at 390px width without wrapping into adjacent items.
- The active tab indicator must not resize the nav item.
- Bottom-navigation icons use the shared navigation size and weight; compact actions use the smaller shared action size. Page-state illustrations remain a separate documented context.
- Role route registries import canonical icon names. Changing one shared concept updates every consuming role.
