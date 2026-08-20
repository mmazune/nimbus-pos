# Supervisor Shared Component Architecture

Status: Prompt 2 shared shell and Floor implemented (Prompt 5B2 Approvals closed 2026-07-31)

> **Prompt 5B2 (2026-07-31):** The `Approval{ShiftSwap,Anomaly}Detail` workspace components gained
> decision controls (shift-swap Reject; anomaly Acknowledge/Resolve) reusing the shared
> `ActionConfirmDialog` + `ToastProvider` — no new shell or component families; the four-domain
> master-detail workspace is unchanged structurally.
>
> **Prompt 5B1 (2026-07-30):** New Approvals workspace components under
> `components/supervisor/approvals/workspace/` (`SupervisorApprovalsWorkspace`, `ApprovalScopeTabs`,
> `ApprovalDomainFilter`, `ApprovalFilterToolbar`, `ApprovalQueueList`, `Approval{Discount,Leave,
> ShiftSwap,Anomaly}Detail`, `detail-primitives`). They reuse the shared `ActionConfirmDialog`
> (pos-shell), the shared `ToastProvider`, and the 5A `approvals-contract.ts`; one shared queue-row
> shell serves all four domains. The old `components/supervisor/approvals/*` (read-only page) remain
> in the tree but are no longer imported.
Date: 2026-07-18 (updated 2026-07-30)

> **Prompt 5A (2026-07-30).** New shared, additive Approvals contract layer
> `apps/web/src/lib/supervisor/approvals-contract.ts` — the typed foundation the Prompt 5B workspace
> consumes (domain enums, Needs-action/Resolved/History scopes over real statuses, canonical
> endpoints, bounded per-domain query builder, `ApprovalMinimalIdentity` + resolvers reusing the
> existing name helpers, query-key factory, counts, narrow decision invalidation, error mapping). It
> does NOT modify the existing read-only Approvals page/components; 5B builds on it.

## Goal

Supervisor must feel like part of the same frontline product as Waiter and Cashier. Shared components should handle presentation, layout, icons, status treatments, and responsive behavior. Role-specific modules should keep API queries, permissions, mutations, and business rules.

## Implemented Shared Shell Primitives

| Primitive | Consumers | Responsibility |
|---|---|---|
| `OperationalShell` | Waiter, Cashier, Supervisor | One fixed header slot, role readiness slot, max-width page container, bottom clearance, fixed nav, and safe-area padding. |
| `OperationalHeader` | Waiter, Cashier, Supervisor | Stable brand, branch/context, centered clock, identity, role, and shared logout interaction. **(2026-08-20: the brand slot now renders the steering-wheel `NimbusLogomark` — see note below.)** |
| `OperationalBottomNav` | Waiter, Cashier, Supervisor | Stable equal-width role destinations, active state, focus behavior, icon rendering, and safe-area placement. |
| `CurrentTime` | Login and all operational roles | One memoized, non-live-announced locale time implementation with no API request. |
| `role-icons` / `role-navigation` | All operational roles | Canonical shared-concept icons, centralized sizes/weights, and explicit route matching. |
| Role shell/header/nav wrappers | Waiter, Cashier, Supervisor | Thin role adapters supplying navigation, branch/service-area/workstation context, identity, guards, and readiness content. |

## Implemented Shared Floor Primitives

| Primitive | Consumers | Responsibility |
|---|---|---|
| `OperationalFloorToolbar` | Waiter, Supervisor | Search, status filters, count chips, optional floor-plan selector slot. |
| `OperationalTableGrid` | Waiter, Supervisor | Responsive grid, skeletons, empty state, stable dimensions. |
| `OperationalTableCard` | Waiter, Supervisor | Full table identifier, textual status, shared staff formatting, optional Mine, capacity, focus and selected state; never guest/order identifiers. |
| `OperationalTableWorkspaceFrame` | Waiter, Supervisor | One responsive overlay/aside lifecycle with accessible close and shell/nav clearance. |
| `RoleProfilePrimitives` | Waiter, Cashier, Supervisor | Already started through shared profile components. |

> **Aug-2026 rebrand note (2026-08-20) — presentation only, no Supervisor behavior change.** The
> shared header's brand slot (`components/pos-shell/BranchContextLabel.tsx`) now renders
> **`NimbusLogomark`** — the steering-wheel brand mark from `docs/BRAND_IDENTITY.md` — on a
> `bg-brand-white` / `text-brand-navy-900` chip, and the palette moved to navy `#000033`, light
> grey `#B3B4AF`, dark grey `#6B6B6B`. The logomark is a **brand mark, not an operational icon**:
> it is deliberately excluded from `operationalIconNames`, and it renders with `currentColor` so
> token classes drive its color (never hard-code hex at call sites). The shared shell/Floor/profile
> primitive **inventory, ownership boundaries, and adapter contracts in this document are
> unchanged** — this is a token/asset swap inside an existing slot, and it propagates to Waiter,
> Cashier, and Supervisor identically, exactly as the shared-shell rule intends.

## Ownership Boundaries

| Layer | Shared | Role-specific |
|---|---|---|
| Visual dimensions | Yes | Only role accent tokens. |
| Icons | Yes | Rare role-only icons through registry extension. |
| API calls | No | Owned by Waiter/Cashier/Supervisor libs. |
| React Query keys | No | Owned by role workflow. |
| Permissions | No | Checked by role module. |
| Mutations | No | Owned by role-specific services/components. |
| Copy for caveats | Mostly shared patterns | Exact role caveat text remains role-owned. |

## Floor Adapter Shape

Each role should map backend data into a shared table presentation item:

Prompt 2 implements this boundary as `OperationalTableViewModel`. Waiter maps its table/order/reservation/ownership cache and preserves menu prefetch and instant order entry. Supervisor maps permitted floor-plan/table/active-order/reservation reads and suppresses Mine because ownership is not a Supervisor concept. Queries, permissions, mutations, and React Query keys remain role-owned.

After selection, shared presentation stops at the workspace frame. Waiter mounts `WaiterTableWorkspace`; Supervisor mounts `SupervisorTableControlWorkspace`. The Supervisor workspace is read-first and only preserves the verified table-status mutation. High-impact order actions remain deferred to Prompt 3.

> **Stale-sentence correction (2026-08-20).** The last two sentences of the paragraph above are a
> **Prompt-2 snapshot**. Prompts 3A–3B3B landed and the Supervisor table-control workspace is no
> longer "read-first with only the table-status mutation": it now also exposes **Request bill**,
> **Mark served**, **Split bill / Split items / Move items / Merge**, **Transfer table**,
> **Find order**, and an **Adjustments** group (**Void**, **Discount request**, **Complimentary**,
> inline discount **Approve/Reject**). Nothing "remains deferred to Prompt 3". What is still
> genuinely out of scope: **transfer-server** (Outcome B), refund create/approve, post-close void,
> payment collection, and order close. The architectural boundary this section documents — shared
> presentation stops at the workspace frame, role owns API/permissions/mutations/query keys — is
> **unchanged and still correct**. See `SUPERVISOR_LIFECYCLE.md` and `SUPERVISOR_API_MATRIX.md`.

```ts
type OperationalTableView = {
  id: string;
  label: string;
  status: "available" | "occupied" | "reserved" | "blocked" | "other";
  capacity: number | null;
  waiterName: string | null;
  activeOrder: { id: string; number: string | null; status: string } | null;
  reservation: { id: string; timeLabel: string | null; status: string } | null;
  isMine?: boolean;
  disabledReason?: string | null;
};
```

Waiter maps this into order-entry behavior. Supervisor maps it into table control, order exception, and reservation handoff behavior.

## Prompt 4B — Reservations components (2026-07-28)

The Reservations page reconstruction is **role-specific**, not shared. The shared
shell, Floor, and profile primitives above are **unchanged** by Prompt 4B, and the
locked four-tab nav (Floor · Reservations · Approvals · Me) is untouched.

New role components under `apps/web/src/components/supervisor/reservations/`:
`SupervisorReservationViewSelector`, `SupervisorReservationRow`,
`SupervisorReservationsDateToolbar`, `SupervisorReservationTableSelect`,
`SupervisorReservationWorkspace`, `SupervisorCreateReservationDialog`,
`SupervisorReservationLifecycleDialogs`. The 6 superseded read-only components
(`SupervisorReservationCard/List/Summary/Toolbar/DetailPanel/StatusBadge`) were
**removed**. Reservation queries, permissions, mutations, view grouping, attention
derivation, action availability, and cache invalidation stay role-owned in
`lib/supervisor/reservations.ts` — consistent with the ownership boundaries above (API
calls, React Query keys, permissions, and mutations remain outside the shared shell).

## Extraction Rule

Do not copy Waiter components into Supervisor. Extract shared presentation and keep the existing Waiter behavior green while Supervisor adopts the same primitives.

Shared-shell changes now propagate to every consuming role. Role-specific API, permission, readiness, and mutation logic must remain outside the shared shell. Prompt 1 did not reconstruct Floor, Reservations, Approvals, or Supervisor operational actions.
