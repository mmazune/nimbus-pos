# Supervisor Icon And Navigation Standard

Status: Prompt 2 implemented navigation and Floor-context standard
Date: 2026-07-18 (verified against code 2026-08-20)

> **Verified 2026-08-20 — nav table is accurate; two clarifications added, nothing removed.**
> The four-tab nav and its icon names were re-checked against
> `apps/web/src/components/pos-shell/{role-icon-config,role-icons,role-navigation}.ts` and
> `lib/supervisor/routes.ts` and are **correct as written**.
>
> 1. **The Aug-2026 rebrand did NOT change this registry.** `Branch` → **`Storefront`** is still
>    live and correct (`operationalIcons.branch = Storefront`). What changed is the header's
>    *brand slot*, which now renders the steering-wheel **`NimbusLogomark`**
>    (`components/pos-shell/NimbusLogomark.tsx`) — a **brand mark, deliberately NOT an entry in
>    `operationalIconNames`**, per `docs/BRAND_IDENTITY.md`. Do not "correct" `Storefront` to the
>    logomark: they are different concepts occupying different slots.
> 2. **The "Shared Icon Registry" table below mixes two tiers.** Only these names exist in the
>    canonical shared registry (`operationalIconNames`): `floor`, `reservations`, `approvals`,
>    `me`, `search`, `back`, `close`, `refresh`, `warning`, `success`, `logout`, `time`, `branch`,
>    `workstation`, `serviceArea`, `table` (plus the Cashier-only `cashierQueue`,
>    `cashierReceipts`, `cashierTill`). The remaining rows — Split `GitBranch`, Merge `GitMerge`,
>    Transfer `ArrowsLeftRight`, Refund `ReceiptX`, Void `Prohibit`, Seat `Armchair`, Leave
>    `CalendarBlank`, Shift swap `ArrowsClockwise`, Anomaly `WarningDiamond` — are a **naming
>    convention for role-owned action icons, not registry entries**; components import those
>    Phosphor glyphs directly (e.g. `Armchair` and `Prohibit` in
>    `components/supervisor/reservations/SupervisorReservationWorkspace.tsx`). The `CLAUDE.md` §13
>    rule "reference by name, never import Phosphor directly" applies to **shared-concept** icons;
>    these role-specific action glyphs are the documented exception. Recorded here so the two
>    tiers are not confused — **no code or doc change is being made for it.**

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
