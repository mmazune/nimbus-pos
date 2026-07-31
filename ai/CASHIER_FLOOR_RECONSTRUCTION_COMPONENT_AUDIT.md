# Cashier Floor Reconstruction — Component Audit (Prompt C0)

**Status:** Audit only. No runtime code was modified to produce this document. Read against the
local dirty worktree on 2026-07-31.

**Scope:** (1) the shared `OperationalFloor` interface and how Waiter/Supervisor consume it, to
establish exactly what a `CashierFloorScreen` adapter must implement; (2) a full file-by-file
inventory of `apps/web/src/components/cashier/**` and `apps/web/src/lib/cashier/**` classified
against the target architecture in `docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md`,
`CASHIER_COMPONENT_REUSE_MAP.md`, and `CASHIER_ROLE_BEHAVIOUR_MATRIX.md`.

---

## Part 1 — Shared Floor interface (deep dive)

### 1.1 The `OperationalFloor` prop/interface contract

Source: `apps/web/src/components/floor/OperationalFloor.tsx` (lines 20–103).

```ts
type OperationalFloorProps<T extends OperationalTableViewModel> = {
  branchName?: string | null;
  readinessLabel: string;
  readinessTone: "neutral" | "success" | "warning" | "danger" | "info";
  tables: T[];
  isLoading?: boolean;
  error?: OperationalFloorErrorCopy | null;
  selectedTableId?: string;
  onSelectTable: (table: T) => void;
  onRetry?: () => void;
};
```

`OperationalFloor` is generic over `T extends OperationalTableViewModel` — a consuming role may
attach extra fields to its own table view-model (Waiter does this for `guestName`/`orderNumber`/
`billState`; Supervisor attaches `raw`/`activeOrder`/`reservation`) as long as the base shape is
satisfied. The component itself owns: search query state, status filter state (`all` / `available`
/ `occupied` / `reserved` / `mine`), floor-plan selector state, and derives `counts` +
`filteredTables` from `formatters.ts` (`countOperationalTables`, `filterOperationalTables`,
`getOperationalFloorPlans`). None of that state is lifted to the consumer — the consumer only
supplies raw `tables`, loading/error state, and the two callbacks.

`OperationalTableViewModel` (source: `apps/web/src/components/floor/types.ts`, lines 10–27) is the
base contract every table row must satisfy:

```ts
export type OperationalTableViewModel = {
  id: string;
  label: string;
  floorPlanId?: string | null;
  floorPlanName?: string | null;
  capacity: number | null;
  status: OperationalTableStatus;                 // "available"|"occupied"|"reserved"|"blocked"
  assignedStaffName?: string | null;
  assignedStaffId?: string | null;
  isMine?: boolean;
  activeOrderId?: string | null;
  activeOrderStatus?: string | null;
  reservationId?: string | null;
  reservationStatus?: string | null;
  reservationTime?: string | null;
  attentionState?: string | null;
  disabledReason?: string | null;
};
```

Query-key convention: each role owns its own top-level Floor query key
(`["waiter","floor",branchId]` in `WaiterFloorScreen.tsx:71`, `["supervisor","floor",branchId]` in
`SupervisorFloorScreen.tsx:58`). A `CashierFloorScreen` should follow the same pattern —
`["cashier","floor",branchId]` — feeding `apiRequest` calls to `/api/tables`,
`/api/pos/orders?excludeStatus=...`, and (optionally) `/api/reservations` in parallel, mirrored
after `loadWaiterFloorData` (`apps/web/src/lib/waiter/floor-api.ts:97-105`) / 
`loadSupervisorFloorData` (`apps/web/src/lib/supervisor/floor.ts:110-124`). No Floor-adjacent query
should be duplicated with the future settlement workspace's own selected-order query.

### 1.2 Table card contents today — no guest names; no payment/bill indicator rendered

`OperationalTableCard` (`apps/web/src/components/floor/OperationalTableCard.tsx`) renders, per
status:

- `available` → "Ready for seating"
- `reserved` → "Reservation" + `reservationTime`
- `blocked` → "Temporarily unavailable"
- `occupied` (default branch, lines 36-49) → `assignedStaffName` (`First L.` formatting) + an
  optional `Mine` badge

Plus the table `label`, `OperationalTableStatusBadge`, and `capacity`. **There is no guest name
field rendered anywhere in this component, and no payment/bill-requested indicator rendered
today** — confirming the CLAUDE.md/docs invariant. `OperationalTableViewModel` itself also carries
no bill/payment field.

**CASH-FR-024 feasibility finding.** Although the *shared* type/card has no bill signal, both
existing per-role table view-models already derive a bill-state string from order metadata,
sourced from data the Floor query already fetches (no extra request):

- Waiter: `apps/web/src/lib/waiter/floor-model.ts` — `WaiterTableViewModel.billState` (line 19),
  populated by `normalizeBillState()` (lines 53-56) which reads
  `order.metadata.billState | billStatus | bill_state`.
- Cashier (pre-reconstruction, in the current Queue implementation):
  `apps/web/src/lib/cashier/order-types.ts` — `CashierOrderViewModel.billRequestedLabel` (line
  187), populated in `apps/web/src/lib/cashier/order-state.ts:187` via
  `metadataString(order.metadata, ["billState","billStatus","bill_requested","billRequested"])`.

Both derivations run client-side against the **same already-fetched active-orders list**
(`GET /api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100`), not a per-table payment call.
This means CASH-FR-024's target ("shared-safe optional indicator only... no N+1/per-table payment
calls") is structurally achievable — **if** the backend reliably populates that metadata key (this
is a client-side convention today, not a documented backend contract; the Cashier Queue page itself
carries a live caveat about this — see `CashierQueueScreen.tsx:188-190`, *"Bill-requested is
audit-derived. Until a dedicated filter exists, Queue shows active payable branch orders."*). To
surface it on the shared card, `OperationalTableViewModel` would need a new optional field (e.g.
`billRequestedLabel?: string | null`) and `OperationalTableCard`'s `TableMiddle` would need a small
render branch — both are **shared-component changes** requiring the full Waiter/Supervisor/Cashier
regression gate in `CASHIER_COMPONENT_REUSE_MAP.md`'s "Shared-component change gate" section, plus
verification that the backend field is trustworthy (currently unverified/audit-derived per the
Queue page's own caveat).

### 1.3 Loading / empty / error / responsive state contracts

- **Loading:** `OperationalTableGrid` renders 12 skeleton cards in the same
  `grid-cols-[repeat(auto-fill,minmax(220px,1fr))]` grid (`OperationalTableGrid.tsx:21-41`).
- **Empty (filtered to zero):** `EmptyState` with a `SquaresFour` icon, "No tables match this
  view" (`OperationalTableGrid.tsx:43-51`).
- **Empty (zero tables returned entirely):** `OperationalFloor` itself renders an inline
  `WarningCircle` + "No active operational tables were returned for this branch." row below the
  grid (`OperationalFloor.tsx:95-100`) — distinct from the filtered-empty state.
- **Error:** `OperationalFloorErrorState` — a `Card` with `role="alert"`, title/description from an
  `OperationalFloorErrorCopy` object the consumer builds (see each role's `getErrorCopy()`), plus an
  optional `Retry` button (`OperationalFloorErrorState.tsx`). When `error` is set, the grid is not
  rendered at all (`OperationalFloor.tsx:84-93`).
- **Responsive:** the grid is a CSS auto-fill grid (`minmax(220px,1fr)`), so column count is purely
  a function of container width — no JS breakpoint logic, no responsive double-mount. Card min-height
  is locked at 176px (`min-h-[176px]`, `OperationalTableCard.tsx:66`), matching the CLAUDE.md-locked
  "176px card height" invariant.
- **Selected-table workspace shell:** `OperationalTableWorkspaceFrame` is a separate shared
  component — a right-anchored overlay (`fixed inset-0` scrim + `absolute … w-[min(1180px,…)]`
  panel) that every role's selected-table workspace renders into, with an `immersive` flag that
  removes the default padding/scroll for full-bleed workspaces
  (`OperationalTableWorkspaceFrame.tsx`).

### 1.4 Waiter's adapter pattern (exact quote)

`apps/web/src/components/waiter/floor/WaiterFloorScreen.tsx` (62-232):

- Fetches its own Floor data via `useQuery({ queryKey: ["waiter","floor",branchId], queryFn: () =>
  loadWaiterFloorData(...) })` and normalizes it with `normalizeWaiterTables(...)`.
- Table-selection callback (`handleSelectTable`, lines 125-147): clears/marks performance timing
  marks, sets a local `selectionOverride` state, then does `router.push`/`router.replace` on
  `/waiter/floor?tableId=…` (push only on the *first* selection from a clean Floor; replace on
  subsequent selections — this is what makes Back/Forward behave correctly).
- Renders `<OperationalFloor ... onSelectTable={handleSelectTable} />` unconditionally, then
  conditionally renders `<OperationalTableWorkspaceFrame immersive={opensOrderWorkspace}
  onClose={handleCloseWorkspace}><WaiterTableWorkspace .../></OperationalTableWorkspaceFrame>` only
  when a `selectedAction` exists (lines 196-229).
- Role-specific behaviour begins entirely *inside* `WaiterTableWorkspace` — chosen by
  `getWaiterTableAction()`, which maps table state → `start-order | reservation-detail | own-order |
  ownership-blocked | disabled`. Waiter has **no sibling control** outside `OperationalFloor`.

### 1.5 Supervisor's adapter pattern (exact quote) + Find order placement

`apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx` (43-240):

- Same shape: own `useQuery(["supervisor","floor",branchId])`, own
  `normalizeSupervisorFloorTables(...)`, its own `handleSelectTable` push/replace logic
  (lines 112-121), and an additional `handleFindSelect`/`handleNavigateToOrder` pair for
  order-first entry (tableless/takeaway orders opened via Find order, or via a
  `?orderId=` deep link resolved through a **separate** `orderContextQuery`
  (`["supervisor","order-detail",branchId,requestedOrderId]`, lines 82-89) that only fires when a
  `requestedOrderId` is present).
- **Find order placement (the pattern Cashier's Find bill must copy):**

```tsx
{/* Supervisor-only workspace control. Rendered as a sibling ABOVE the shared
    OperationalFloor — it never forks the shared Floor presentation. */}
<div className="-mb-2 flex justify-end">
  <Button variant="secondary" size="compact" onClick={() => setFindOpen(true)} disabled={!canQuery}>
    <span className="inline-flex items-center gap-2">
      <MagnifyingGlass size={18} weight="bold" aria-hidden />
      Find order
    </span>
  </Button>
</div>

<OperationalFloor ... />

{findOpen && accessToken && branchId ? (
  <SupervisorFindOrderDialog token={accessToken} branchId={branchId}
    onClose={() => setFindOpen(false)} onSelectOrder={handleFindSelect} />
) : null}
```

(`SupervisorFloorScreen.tsx:170-206`). The control is a plain `Button` sibling placed in a
`flex justify-end` row **immediately above** `<OperationalFloor>` in the JSX tree — not inside it,
not a new page, not a new nav tab. Its result handler (`handleFindSelect`, lines 133-143) sets the
same `selectionOverride`/URL-query state the table-click handler uses, so a Find-order result opens
through the exact same `OperationalTableWorkspaceFrame` + workspace component as a direct table
click. `SupervisorFindOrderDialog` itself (`apps/web/src/components/supervisor/floor/
SupervisorFindOrderDialog.tsx`) is a bounded/paginated modal search — this is the direct structural
precedent for `CashierFindBillControl` + `CashierBillLookupDialog`.

### 1.6 What `CashierFloorScreen` / `CashierFloorPageAdapter` needs to implement

To become the third consumer without forking anything, a Cashier adapter must:

1. Fetch its own bounded Floor dataset (tables + active orders [+ reservations if useful for
   read-only context]) behind `["cashier","floor",branchId]`, normalized into a
   `CashierFloorTableViewModel extends OperationalTableViewModel` (mirroring
   `WaiterTableViewModel`/`SupervisorFloorTableViewModel`'s pattern in `floor-model.ts`).
2. Own local `selectionOverride` + URL (`tableId`/`orderId` query param) state with the same
   push-once/replace-after pattern as `handleSelectTable` in both existing adapters, so Back/
   Forward/refresh behave identically.
3. Render `<OperationalFloor branchName=... readinessLabel=... readinessTone=... tables={...}
   isLoading={...} error={...} selectedTableId={...} onSelectTable={...} onRetry={...} />`
   unchanged — no new props, no fork.
4. Render `CashierFindBillControl` as a sibling `Button` positioned exactly like Supervisor's
   Find order button (above `<OperationalFloor>`, `flex justify-end`), opening a
   `CashierBillLookupDialog` modal modeled on `SupervisorFindOrderDialog`.
5. On table selection, resolve the payable order per the "Table-to-order resolution" contract in
   `CASHIER_ARCHITECTURE.md` (0/1/many payable orders) **before** opening
   `OperationalTableWorkspaceFrame` — this order-resolution step does not exist in either Waiter's
   or Supervisor's adapter today (Waiter trusts one active order per table from
   `ACTIVE_ORDER_STATUSES`; Supervisor does the same) and is new Cashier-specific logic, most
   naturally expressed as `CashierPayableOrderSelector`.
6. Render the settlement workspace inside the same shared `OperationalTableWorkspaceFrame` used by
   the other two roles (immersive or padded, to be decided in a later prompt) — never a new frame
   component.
7. Add `cashier` routes = `Floor / Till / Me` to `apps/web/src/lib/cashier/routes.ts`
   (`cashierRoutes`, currently `Queue/Receipts/Till/Me` — see Part 2 finding below) so
   `CashierBottomNav` (which already just forwards `getOperationalRoleNavigation("cashier")` to the
   shared `OperationalBottomNav`, `apps/web/src/components/cashier/shell/CashierBottomNav.tsx`)
   picks up the new nav automatically — no change needed inside `CashierBottomNav` itself.

No new page currently exists at `apps/web/pages/cashier/floor.tsx` or `apps/web/pages/cashier.tsx`
(confirmed via glob — only `queue.tsx`, `receipts.tsx`, `till.tsx`, `me.tsx` exist under
`apps/web/src/pages/cashier/`). `cashierRoutes` in `apps/web/src/lib/cashier/routes.ts:4-29` still
lists `Queue / Receipts / Till / Me`, confirming CASH-FR-001/002 are still fully **Open** — Cashier
has not begun consuming `OperationalFloor` at all yet (CASH-FR-003 evidence: no import of
`OperationalFloor` anywhere under `components/cashier/**` — verified by inspection, none of the 100
files import it).

---

## Part 2 — Cashier component inventory and classification

Buckets used: **Shared-shell reuse**, **Migrate to settlement workspace**, **Migrate to Find
bill**, **Migrate to Till tab**, **Migrate to receipt panel**, **Obsolete after migration**,
**Needs further investigation / ambiguous**.

### 2.1 `components/cashier/shell/` (7 files)

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierIdleLogoutHandler.tsx` | Re-exports `WaiterIdleLogoutHandler` (shared idle mechanism) | Shared-shell reuse | unchanged | Already a 4-line pass-through; correct pattern. |
| `index.ts` | Barrel export | Shared-shell reuse | unchanged | — |
| `CashierReadinessStrip.tsx` | Renders shift/till/provider badges from `CashierReadinessItem[]` | Shared-shell reuse | unchanged | Generic readiness strip; role-agnostic shape. |
| `CashierSessionGuard.tsx` | Role/branch/session gate before rendering children | Shared-shell reuse | unchanged | Same responsibility shape as Waiter/Supervisor session guards. |
| `CashierHeader.tsx` | Thin adapter over shared `OperationalHeader` | Shared-shell reuse | unchanged | `OperationalHeader` imported directly, correct thin-adapter pattern (CASH-FR-004 verified: no duplication). |
| `CashierBottomNav.tsx` | Thin adapter over shared `OperationalBottomNav` via `getOperationalRoleNavigation("cashier")` | Shared-shell reuse | unchanged | Component itself is correct; **the data it reads (`cashierRoutes`) is stale** — see `lib/routes.ts` row below (CASH-FR-002 evidence). |
| `CashierShell.tsx` | Composes `OperationalShell` + guard + header + readiness strip + bottom nav + idle handler | Shared-shell reuse | unchanged | Correct thin composition; no fork of `OperationalShell`. |

### 2.2 `components/cashier/states/` (4 files)

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierCaveatBanner.tsx` | Generic tone/icon banner (receipt/printer/terminal/mobile-money/excluded) | Shared-shell reuse | unchanged | Cross-cutting presentational primitive, no page coupling. |
| `CashierEmptyState.tsx` | Generic titled empty-state card | Shared-shell reuse | unchanged | Used by Till and Receipts screens today; reusable in Find bill/settlement. |
| `CashierBlockedState.tsx` | Generic full-page blocked/locked state | Shared-shell reuse | unchanged | — |
| `index.ts` | Barrel | Shared-shell reuse | unchanged | — |

### 2.3 `components/cashier/queue/` (11 files) — the page being retired

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierQueueSearch.tsx` | Search input bound to Queue's free-text filter | Migrate to Find bill | `CashierBillLookupDialog` | Same input pattern Find bill needs; not table/order-status specific. |
| `CashierQueueStatusBadge.tsx` | Generic status badge wrapper (`Badge` + tone) | Migrate to settlement workspace | Bill review header | Reused for order status; also reusable in Find bill result rows. |
| `CashierQueueFilterChips.tsx` | Renders `CASHIER_QUEUE_FILTERS` chip row | Migrate to Find bill | `CashierBillLookupDialog` filters | `CASHIER_ARCHITECTURE.md`: "Queue filters/search → Find bill bounded lookup." |
| `CashierQueueToolbar.tsx` | Composes search + filter chips into Queue-page toolbar | Obsolete after migration | — | Page-chrome composition only; its two children migrate individually (row above). |
| `CashierOrderTotals.tsx` | Subtotal/tax/discount/total/paid/outstanding rows | Migrate to settlement workspace | Bill review totals | Pure presentational, order-model driven — direct reuse. |
| `CashierPaymentSummary.tsx` | Renders payment + provider-intent rows for the selected order | Migrate to settlement workspace | Bill review / payment summary | Duplicate-ish of `checkout/CashierPaymentHistory.tsx` — **needs de-duplication** during C2/C3, not before. |
| `CashierOrderCard.tsx` | Queue list row (table, status badges, server, guest name, readiness, elapsed, total) | Obsolete after migration | — | Queue-list-specific layout with an "open" affordance; **do not port the guest-name display to any Floor-adjacent surface** (privacy rule). Row pattern may inform Find bill's result row but is not a direct reuse. |
| `CashierOrderList.tsx` | Loading/error/empty/list wrapper around `CashierOrderCard` | Obsolete after migration | — | Queue-page-specific; Find bill needs its own bounded/paginated result list, not this one (Queue here is unbounded/pageSize=100, which Find bill must not repeat — CASH-FR-023). |
| `index.ts` | Barrel | Obsolete after migration | — | Whole folder is retired as a page; barrel goes with it. |
| `CashierCheckoutPreview.tsx` | **Selected-order preview pane**: header/status/totals/payment summary/line items/receipt link/refund entry point, hosts `CashierPaymentPanel` + `CashierResolutionPanel` | Migrate to settlement workspace | `CashierTableSettlementWorkspace` | This is the closest existing thing to the target settlement workspace already — strong candidate to rename/relocate rather than rebuild (`CASHIER_COMPONENT_REUSE_MAP.md`: "Audit before creating new abstractions"). |
| `CashierQueueScreen.tsx` | Queue page orchestrator: order list query, selected-order detail + payments queries, refresh/invalidate wiring, renders toolbar+list+preview+refund panel | Obsolete after migration | — | Page itself retires, but its query orchestration (list/detail/payments query keys, `refreshCheckoutState` invalidation pattern) is the direct template for `CashierFloorPageAdapter`'s settlement-side data layer — port the *pattern*, not the file. |

### 2.4 `components/cashier/checkout/` (10 files) — the payment engine, direct reuse

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierPaymentBlockedBanner.tsx` | Lists reasons a payment action is blocked | Migrate to settlement workspace | Payment entry | Pure presentational, order/readiness-driven. |
| `CashierPaymentResultNotice.tsx` | Success/danger result banner after a payment mutation | Migrate to settlement workspace | Payment entry | — |
| `CashierPaymentMethodSelector.tsx` | Cash/Card/MTN/Airtel/Bank method picker with `caveat` copy | Migrate to settlement workspace | Payment entry | — |
| `CashierPaymentAmountField.tsx` | Amount input + outstanding-balance readout | Migrate to settlement workspace | Payment entry | — |
| `CashierManualReferenceFields.tsx` | Reference/phone/note fields for non-cash methods | Migrate to settlement workspace | Payment entry | — |
| `CashierSettlementSummary.tsx` | Total/Paid/Remaining mini-summary | Migrate to settlement workspace | Payment entry | Near-duplicate of `queue/CashierOrderTotals.tsx` — flag for de-dup, not a blocker. |
| `CashierPaymentHistory.tsx` | Payment + intent history rows (payment-entry-scoped variant) | Migrate to settlement workspace | Payment entry | Near-duplicate of `queue/CashierPaymentSummary.tsx` — same de-dup flag. |
| `index.ts` | Barrel | Migrate to settlement workspace | — | — |
| `CashierCloseOrderPanel.tsx` | Close-order state/reason panel (settled/blocked/closed) | Migrate to settlement workspace | Payment entry | — |
| `CashierPaymentPanel.tsx` | **The full payment-entry form**: method select, amount, manual reference fields, submit → `closeCashierOrder`/`createCashierManualReferencePayment`, result notice, history, close panel | Migrate to settlement workspace | `CashierTableSettlementWorkspace` (payment section) | Core reuse target — this is the "existing verified payment flow" the docs say must be reused, not rewritten. |

### 2.5 `components/cashier/resolution/` (16 files) — mixed: in-scope split logic vs. out-of-scope transfer/merge/move

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierResolutionBlockedBanner.tsx` | Generic blocked-reasons banner | Migrate to settlement workspace | Split-bill section | — |
| `CashierResolutionResultNotice.tsx` | Generic result notice | Migrate to settlement workspace | Split-bill section | — |
| `CashierSplitItemSelector.tsx` | Line-item quantity picker, shared by split-items and move-items | Needs further investigation / ambiguous | TBD | Feeds both the in-scope split-items flow and the out-of-scope move-items flow; must be re-scoped once split-items' status is decided (see next row). |
| `CashierSplitBillSummary.tsx` | Reads `order.metadata.splitBill` and renders recorded allocation | Migrate to settlement workspace | Split-bill section | `CASHIER_COMPONENT_REUSE_MAP.md`: "Split resolution → Settlement workspace, reuse current allocation logic." |
| `CashierSplitBillEqualForm.tsx` | Equal-split guest-count form + preview | Migrate to settlement workspace | Split-bill section | — |
| `CashierSplitBillCustomForm.tsx` | Custom per-guest amount split form + preview | Migrate to settlement workspace | Split-bill section | — |
| `CashierSplitItemsPanel.tsx` | Splits selected line quantities into a new **child order** (`POST /pos/orders/:id/split-items`) | Needs further investigation / ambiguous | TBD | `CASHIER_ROLE_BEHAVIOUR_MATRIX.md` only explicitly green-lights "Split bill/items… resolve existing **payable allocations**" for Cashier — it does not clearly authorize Cashier-initiated **child-order creation**, which is structurally the same capability Supervisor Prompt 3B1 owns. Component's own copy already flags the KDS boundary honestly (lines 130-135), but scope authorization is unclear — flag for explicit decision, do not assume in/out. |
| `CashierMergeOrdersPanel.tsx` | Merges (voids) a source order into a target order | **Obsolete after migration** | — | `CASHIER_ROLE_BEHAVIOUR_MATRIX.md` row "Move/merge/transfer": Waiter=No, Supervisor=Yes, **Cashier=No**. This file is a scope violation against the locked target and is currently live/reachable (see §2.5 finding below). |
| `CashierMoveItemsPanel.tsx` | Moves selected quantities to another active order | **Obsolete after migration** | — | Same matrix row — Cashier=No for move/merge/transfer. Scope violation, currently live/reachable. |
| `CashierTransferTablePanel.tsx` | Calls `POST /pos/orders/:id/transfer-table` to reassign the order's table | **Obsolete after migration** | — | Same matrix row. Also collides with CLAUDE.md's Supervisor-owned Prompt 3B2 "Transfer table" (`pos:order:transfer`) — Cashier having an independent transfer-table UI predates/contradicts the locked Supervisor-exclusive framing. Currently live/reachable. |
| `CashierTransferServerPanel.tsx` | Static disabled/deferred notice card, **no mutation wired** | **Obsolete after migration** | — | See dedicated finding below — currently live/reachable but inert by design. |
| `CashierAdvancedResolutionPanel.tsx` | Collapsible section composing Merge + Move + Transfer-table + Transfer-server | **Obsolete after migration** | — | The entire "Advanced resolution" concept sits outside Cashier's locked target scope; drop wholesale once C-series work reaches this panel. |
| `CashierResolutionPanel.tsx` | Top-level composer: gates on session/branch/shift, then renders Split-bill + Split-items + Advanced-resolution | Needs further investigation / ambiguous | TBD | Must be decomposed: split-bill piece survives into the settlement workspace; advanced-resolution piece is dropped; split-items piece is pending the decision above. |
| `index.ts` | Barrel (`CashierResolutionPanel` only) | Needs further investigation / ambiguous | — | Follows the container's fate. |
| `CashierSplitBillPanel.tsx` | Equal/Custom mode switch + submit → `splitCashierBill` (`POST /pos/orders/:id/split-bill`, metadata-only, no child order) | Migrate to settlement workspace | Split-bill section | Clearly in-scope: pure allocation metadata, no order mutation, matches "Resolve existing payable allocations" exactly. |
| `CashierResolutionConfirmDialog.tsx` | Generic confirm-before-mutate dialog | Migrate to settlement workspace | Shared confirm primitive | Reusable regardless of which resolution actions survive. |

**Finding — `CashierTransferServerPanel` / `CashierTransferTablePanel` wiring (explicit
investigation requested).**

Both are **wired into a live, reachable render path today**, not dead code:

```
CashierAdvancedResolutionPanel.tsx:79-80
  <CashierTransferTablePanel order={order} disabledReasons={disabledReasons} onRefresh={onRefresh} />
  <CashierTransferServerPanel />
```

`CashierAdvancedResolutionPanel` is rendered by `CashierResolutionPanel.tsx:89-94`, which is
rendered by `CashierCheckoutPreview.tsx:280-289`, which is rendered by
`CashierQueueScreen.tsx:251-265` — i.e. today, opening any order from `/cashier/queue` and
expanding "Advanced resolution" exposes both panels in the current build.

- `CashierTransferTablePanel.tsx` is **fully functional**: it queries `/api/tables`, builds a
  reason-gated form, and on submit calls `transferCashierOrderTable()` →
  `POST /api/pos/orders/:id/transfer-table` (`lib/cashier/resolution.ts:111-131`). This is a real,
  live Cashier-side duplicate of the transfer-table capability the docs frame as Supervisor-owned
  (CLAUDE.md Prompt 3B2).
- `CashierTransferServerPanel.tsx` is a **static, inert notice** — no `useMutation`, no API call, no
  form. It renders a fixed "Deferred" badge and copy explaining "No safe staff-list endpoint is
  exposed for this surface, so the action is intentionally disabled." This mirrors CLAUDE.md's
  transfer-server-deferred stance, but for the *wrong role* — the deferred-transfer-server framing
  in CLAUDE.md is about **Supervisor's** `pos:order:transfer` gate being shared with
  transfer-server; nothing in the canonical docs authorizes a Cashier-side transfer-server surface
  at all, live or disabled.
- The underlying API client function `transferCashierOrderServer()`
  (`lib/cashier/resolution.ts:133-153`, calling `POST /api/pos/orders/:id/transfer-server`) **is
  defined but never called from any component** — confirmed by
  `grep -n "transferCashierOrderServer" apps/web/src` returning only its own definition. This is
  dead library code, separate from the (used, but out-of-scope) `CashierTransferServerPanel`
  component.

**Conclusion:** this is a genuine pre-existing scope violation against
`CASHIER_ROLE_BEHAVIOUR_MATRIX.md`'s "Move/merge/transfer: No" row for Cashier, not a
misunderstanding on the auditor's part — `CashierTransferTablePanel` performs a real mutation Cashier
is not supposed to own, and `CashierTransferServerPanel` + the unused `transferCashierOrderServer()`
scaffold a capability with no basis in any canonical doc for this role. All three (plus
`CashierMergeOrdersPanel`/`CashierMoveItemsPanel`, same matrix row) should be treated as **Obsolete
after migration** pending explicit confirmation, not carried forward silently.

### 2.6 `components/cashier/receipts/` (15 files) — becomes the receipt panel, page itself retires

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierReceiptStatusBadge.tsx` | Generic receipt status badge | Migrate to receipt panel | Receipt panel | — |
| `CashierReceiptsToolbar.tsx` | Receipts-page search + filter chips (today/closed/paid/pending-send/reprinted) | Obsolete after migration | — | Page chrome; filter *semantics* may inform Find bill's payment-state filters, but the component is page-specific. |
| `CashierReceiptCard.tsx` | Receipts-page list row | Obsolete after migration | — | Superseded by Find bill result rows / direct receipt-panel entry from settlement workspace. |
| `CashierReceiptList.tsx` | Receipts-page loading/error/empty/list wrapper | Obsolete after migration | — | Same reasoning as `CashierOrderList`. |
| `CashierReceiptLineItems.tsx` | Receipt line-item detail | Migrate to receipt panel | Receipt panel | — |
| `CashierReceiptTotals.tsx` | Receipt totals block | Migrate to receipt panel | Receipt panel | — |
| `CashierReceiptHistory.tsx` | Receipt audit-event timeline | Migrate to receipt panel | Receipt panel | — |
| `CashierReceiptPaymentSummary.tsx` | Receipt-scoped payment rows | Migrate to receipt panel | Receipt panel | — |
| `CashierReceiptReprintDialog.tsx` | Metadata-only reprint request form | Migrate to receipt panel | Receipt panel | Backend caveat already honest: "Metadata only — no print-driver invocation." |
| `CashierReceiptSendDialog.tsx` | Pending digital-send request form | Migrate to receipt panel | Receipt panel | Backend caveat already honest: "PENDING — no live adapter." |
| `CashierReceiptDetail.tsx` | Composes identity + line items + totals + payment summary + footer + caveats | Migrate to receipt panel | Receipt panel | — |
| `index.ts` | Barrel | Migrate to receipt panel | — | Will need pruning once list/toolbar/card entries retire. |
| `CashierReceiptCaveatBanner.tsx` | Print/send caveat banner | Migrate to receipt panel | Receipt panel | — |
| `CashierReceiptDrawer.tsx` | **Full slide-over**: header, detail+history body, footer with Reprint/Send/Refund actions | Migrate to receipt panel | `CashierReceiptPanel` | This *is* the target `CashierReceiptPanel` already — strong direct-reuse candidate, just needs to be openable from the settlement workspace / Find bill result instead of only from the Receipts page. |
| `CashierReceiptsScreen.tsx` | Receipts page orchestrator: closed-order candidate query, receipt/history queries, reprint/send handlers, refund panel wiring | Obsolete after migration | — | Page retires; its query/mutation orchestration (receipt read, history read, reprint/send idempotent mutations, `refreshReceiptState` invalidation) is the template to port into whatever hosts `CashierReceiptDrawer` next. |

### 2.7 `components/cashier/till/` (14 files) — unchanged, Till stays a standalone tab

| File | Current responsibility | Classification | Target location |
| --- | --- | --- | --- |
| `CashierTillStatusBadge.tsx` | Till status badge | Migrate to Till tab | unchanged |
| `CashierVarianceBadge.tsx` | Reconciliation variance badge | Migrate to Till tab | unchanged |
| `CashierTillResultNotice.tsx` | Till mutation result notice | Migrate to Till tab | unchanged |
| `CashierTillBlockedBanner.tsx` | Till action blocked-reasons banner | Migrate to Till tab | unchanged |
| `CashierTillConfirmDialog.tsx` | Generic confirm dialog for till actions | Migrate to Till tab | unchanged |
| `CashierTillToolbar.tsx` | Branch/workstation + shift/till badges + refresh | Migrate to Till tab | unchanged |
| `CashierTillOverview.tsx` | Till identity + opening float/expected cash/safe drops cards | Migrate to Till tab | unchanged |
| `CashierTillSummaryCards.tsx` | Cash-position metric cards | Migrate to Till tab | unchanged |
| `CashierDeferredCashMovements.tsx` | Static "Paid In/Out/Pickup deferred" notice | Migrate to Till tab | unchanged |
| `CashierOpenTillPanel.tsx` | Open-till form | Migrate to Till tab | unchanged |
| `CashierSafeDropPanel.tsx` | Safe-drop form | Migrate to Till tab | unchanged |
| `CashierReconcilePanel.tsx` | Reconcile/close-till form | Migrate to Till tab | unchanged |
| `index.ts` | Barrel | Migrate to Till tab | unchanged |
| `CashierTillScreen.tsx` | Till page orchestrator | Migrate to Till tab | unchanged (page stays under `/cashier/till`) |

### 2.8 `components/cashier/refunds/` (12 files) — already correctly cross-context

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierRefundStatusBadge.tsx` | Refund status badge | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundThresholdNotice.tsx` | Auto-approval threshold notice | Migrate to settlement workspace | Refund entry | Threshold constant `CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD = 5000` lives in `lib/cashier/refund-types.ts:3`. |
| `CashierRefundResultNotice.tsx` | Refund mutation result notice | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundBlockedBanner.tsx` | Refund-blocked reason banner | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundSummary.tsx` | Total paid / already refunded / remaining refundable | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundPaymentSelector.tsx` | Refundable-payment radio list | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundConfirmDialog.tsx` | Confirm-before-create-refund dialog | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundForm.tsx` | Amount/reason form + submit | Migrate to settlement workspace | Refund entry | — |
| `CashierRefundHistory.tsx` | Refund history list for the order | Migrate to settlement workspace | Refund entry | — |
| `index.ts` | Barrel | Migrate to settlement workspace | — | — |
| `CashierRefundBoundaryCard.tsx` | "Manager approval" / "Post-close void" boundary notices | Migrate to settlement workspace | Refund entry | Correctly documents refund-approval and post-close-void as out of Cashier scope already. |
| `CashierRefundPanel.tsx` | **Full refund slide-over**, already opened from both `CashierCheckoutPreview` (Queue) and `CashierReceiptDrawer` (Receipts) | Migrate to settlement workspace | Refund entry (dual-reachable from settlement workspace and receipt panel) | Already architecturally correct per `CASHIER_ARCHITECTURE.md` ("Refunds… Selected closed order/receipt context") — no rework needed, just re-point its two current callers at the new workspace/panel hosts. |

### 2.9 `components/cashier/me/` (11 files) — already correct

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `CashierProfileCard.tsx` | Identity + terminal context card | Shared-shell reuse | unchanged | — |
| `CashierWorkflowChecklist.tsx` | Static 11-step workflow checklist | Shared-shell reuse | unchanged | **Copy references "Work Queue"** — needs a wording update post-migration (content-only, not structural). |
| `CashierScopeCard.tsx` | Permission-gated "Cashier can do" list | Shared-shell reuse | unchanged | — |
| `CashierRestrictedSurfacesCard.tsx` | Static restricted-surfaces list | Shared-shell reuse | unchanged | — |
| `CashierKnownLimitationsCard.tsx` | Static known-limitations list | Shared-shell reuse | unchanged | **Copy references "Queue uses active payable orders"** and "Transfer server deferred…" — needs a wording update post-migration; the transfer-server line should probably be removed entirely per the §2.5 finding rather than reworded. |
| `CashierDemoHelpCard.tsx` | Demo-credentials pointer card | Shared-shell reuse | unchanged | — |
| `index.ts` | Barrel | Shared-shell reuse | unchanged | — |
| `CashierSessionCard.tsx` | Session state rows + logout action | Shared-shell reuse | unchanged | — |
| `CashierReadinessSummaryCard.tsx` | Shift/Till readiness blocks | Shared-shell reuse | unchanged | — |
| `CashierLogoutPanel.tsx` | Logout copy + action slot | Shared-shell reuse | unchanged | — |
| `CashierMeScreen.tsx` | Me page — reuses shared `profile/*` primitives (`RoleProfileHero`, `ProfileSection`, `SessionCard`, etc.) | Shared-shell reuse | unchanged | Correctly built on the shared profile system per CLAUDE.md §13; no fork. |

### 2.10 `lib/cashier/*.ts` (30 files)

| File | Current responsibility | Classification | Target location | Notes/evidence |
| --- | --- | --- | --- | --- |
| `permissions.ts` | `hasCashierPermission`/`requireCashierContext` helpers | Shared-shell reuse | unchanged | Role-generic, no page coupling. |
| `api.ts` | `getCashierActiveShift`/`getCashierActiveTill` (`/api/shifts/active`, `/api/tills/active`) | Shared-shell reuse | unchanged | Consumed by `readiness.ts`, used shell-wide (strip, settlement preflight, Till, Me). |
| `state.ts` | Readiness tone/item types + `defaultCashierReadiness` | Shared-shell reuse | unchanged | — |
| `readiness.ts` | `useCashierReadiness()` hook (shift+till derived state) | Shared-shell reuse | unchanged | Cross-cutting; consumed by Shell, Queue/settlement, Till, Me. |
| `formatters.ts` | Money/date/elapsed/title-case/initials formatters | Shared-shell reuse | unchanged | Generic, used everywhere. |
| `orders.ts` | `listCashierOrders`/`getCashierOrder`/`getCashierOrderPayments` (`/api/pos/orders*`) | Needs further investigation / ambiguous | Find bill (list) + settlement workspace (detail/payments) | One list function serves two very different future callers with very different pagination/bound requirements (Find bill = bounded/filtered lookup; settlement = single-order reads) — should likely split rather than share one unbounded `listCashierOrders`. |
| `context.ts` | `useCashierContext()` workspace-identity hook | Shared-shell reuse | unchanged | — |
| `routes.ts` | `cashierRoutes` nav config: **Queue / Receipts / Till / Me** | **Obsolete after migration** | replace with Floor/Till/Me | Direct evidence for CASH-FR-002 — this file is the literal source of today's wrong 4-tab nav; `CashierBottomNav` will pick up the fix automatically once this array changes. |
| `queue-filters.ts` | `CASHIER_QUEUE_FILTERS` + filter/search functions | Migrate to Find bill | Find bill filter logic | Filter semantics (active-payable/ready-served/in-progress/partially-paid/closed-today) map onto Find bill's payment-state/order-status filters per `CASHIER_ARCHITECTURE.md`. |
| `payment-types.ts` | Payment method/DTO/response types | Migrate to settlement workspace | unchanged | — |
| `payment-validation.ts` | `CASHIER_PAYMENT_METHODS`, amount/readiness validation, error mapping | Migrate to settlement workspace | unchanged | — |
| `idempotency.ts` | `buildCashierIdempotencyKey()` | Shared-shell reuse | unchanged | Cross-domain (payments/resolution/receipts/till/refunds all use it). |
| `payments.ts` | `createCashierManualReferencePayment`/`createCashierPaymentIntent`/`closeCashierOrder` API wrappers | Migrate to settlement workspace | unchanged | — |
| `resolution-types.ts` | Split-bill/split-items types **+** merge/move/transfer-table/transfer-server types | Needs further investigation / ambiguous | TBD | Mixed in-scope/out-of-scope types in one file — split when the resolution-panel decision (§2.5) is made. |
| `resolution.ts` | `splitCashierBill`/`splitCashierItems`/`listCashierTables` **+** `mergeCashierOrders`/`moveCashierOrderItems`/`transferCashierOrderTable`/`transferCashierOrderServer` API wrappers | Needs further investigation / ambiguous | TBD | Same mixed file; `transferCashierOrderServer` is additionally **dead code** (defined, never called — see §2.5 finding). |
| `resolution-validation.ts` | Validation/error-mapping for all of the above | Needs further investigation / ambiguous | TBD | Same reasoning. |
| `order-types.ts` | `CashierOrderApi`/`CashierOrderViewModel` — the canonical selected-order shape (incl. `billRequestedLabel`) | Migrate to settlement workspace | unchanged | Also the type Find bill result rows would map into; see §1.2 CASH-FR-024 evidence. |
| `order-state.ts` | `normalizeCashierOrder()` API→viewmodel mapper (bill-state derivation, payment-state derivation, line normalization) | Migrate to settlement workspace | unchanged | Also feeds Find bill. |
| `receipt-types.ts` | Receipt API/viewmodel types | Migrate to receipt panel | unchanged | — |
| `receipt-validation.ts` | Reprint/send input validation | Migrate to receipt panel | unchanged | — |
| `receipt-state.ts` | `normalizeCashierReceipt`/`normalizeReceiptHistory` **+** `normalizeReceiptCandidate`/`filterCashierReceipts`/`searchCashierReceipts` | Needs further investigation / ambiguous | Receipt panel (normalize/history) vs. Find bill (candidate/filter/search) | Two different concerns bundled in one module — the receipt-detail normalizers stay with the panel; the candidate-derivation/filter/search functions are Receipts-page-list-specific and map to Find bill instead. |
| `receipts.ts` | `getCashierReceipt`/`getCashierReceiptHistory`/`requestCashierReceiptReprint`/`requestCashierReceiptSend` API wrappers | Migrate to receipt panel | unchanged | — |
| `till-types.ts` | Till API/viewmodel/input types | Migrate to Till tab | unchanged | — |
| `till-validation.ts` | Open/safe-drop/reconcile validation | Migrate to Till tab | unchanged | — |
| `till-state.ts` | `normalizeCashierTill()` mapper + till error mapping | Migrate to Till tab | unchanged | — |
| `tills.ts` | Till API wrappers (`/api/tills/*`) | Migrate to Till tab | unchanged | — |
| `refund-types.ts` | Refund API/viewmodel types + threshold constant | Migrate to settlement workspace | unchanged | — |
| `refunds.ts` | Refund API wrappers (`/api/pos/orders/:id/refunds`, `/api/pos/refunds/:id`) | Migrate to settlement workspace | unchanged | — |
| `refund-state.ts` | `deriveRefundStatus`/`deriveRefundableAmount`/`normalizeCashierRefund` | Migrate to settlement workspace | unchanged | — |
| `refund-validation.ts` | Refund form validation | Migrate to settlement workspace | unchanged | — |

---

## Summary counts

Across the two folders (100 component files + 30 lib files = 130 files total):

| Classification | Count | Notes |
| --- | --- | --- |
| Shared-shell reuse | 41 | shell/ (7) + states/ (4) + me/ (11) + lib: permissions, api, state, readiness, formatters, context, idempotency (7) — **all already correctly built on shared primitives; no Floor-adjacent work needed here.** |
| Migrate to settlement workspace | 46 | checkout/ (10) + refunds/ (12) + resolution's clearly-in-scope split-bill pieces (5: BlockedBanner, ResultNotice, SplitBillSummary/Equal/Custom form + SplitBillPanel = 6, ResolutionConfirmDialog = 1) + queue/'s reusable presentational pieces (CashierQueueStatusBadge, CashierOrderTotals, CashierPaymentSummary, CashierCheckoutPreview = 4) + lib: payment-types, payment-validation, payments, order-types, order-state, refund-types, refunds, refund-state, refund-validation (9) |
| Migrate to Find bill | 4 | CashierQueueSearch, CashierQueueFilterChips, lib/queue-filters.ts, and half of lib/orders.ts's responsibility |
| Migrate to Till tab | 18 | till/ (14 files) + lib: till-types, till-validation, till-state, tills (4) — **entirely unchanged, no reclassification risk.** |
| Migrate to receipt panel | 15 | receipts/'s detail-oriented pieces (StatusBadge, LineItems, Totals, History, PaymentSummary, ReprintDialog, SendDialog, Detail, index, CaveatBanner, Drawer = 11) + lib: receipt-types, receipt-validation, receipts.ts (3) + part of receipt-state.ts |
| Obsolete after migration | 15 | queue/'s page-chrome pieces (Toolbar, OrderCard, OrderList, index, QueueScreen = 5) + receipts/'s page-chrome pieces (Toolbar, Card, List, ReceiptsScreen = 4) + resolution/'s out-of-scope transfer/merge/move pieces (MergeOrdersPanel, MoveItemsPanel, TransferTablePanel, TransferServerPanel, AdvancedResolutionPanel = 5) + lib/routes.ts (1) |
| Needs further investigation / ambiguous | 9 | CashierSplitItemSelector, CashierSplitItemsPanel, CashierResolutionPanel + its index.ts, lib: resolution-types, resolution, resolution-validation, orders.ts, receipt-state.ts |

(Counts are approximate at the margins because a handful of files legitimately serve two future
targets — e.g. `CashierRefundPanel` is reachable from both the settlement workspace and the receipt
panel by design, and `receipt-state.ts` bundles two different concerns. Those are called out
individually in the tables above rather than force-fit into one bucket.)

### Headline finding: `CashierTransferServerPanel` / `CashierTransferTablePanel`

Both are **live and reachable today** from `/cashier/queue` → select an order → expand "Advanced
resolution" (`CashierAdvancedResolutionPanel.tsx:79-80`, rendered via `CashierResolutionPanel` →
`CashierCheckoutPreview` → `CashierQueueScreen`). `CashierTransferTablePanel` performs a real
mutation (`POST /api/pos/orders/:id/transfer-table`) that duplicates a capability
`CASHIER_ROLE_BEHAVIOUR_MATRIX.md` explicitly reserves for Supervisor ("Move/merge/transfer: No" for
Cashier). `CashierTransferServerPanel` is a static, non-mutating "Deferred" notice with no basis in
any canonical Cashier doc, and its backing library function `transferCashierOrderServer()`
(`lib/cashier/resolution.ts:133-153`) is defined but never invoked from any component — dead code
distinct from the (used, but out-of-scope) panel. Both panels, plus the same-scope
`CashierMergeOrdersPanel`/`CashierMoveItemsPanel`, are classified **Obsolete after migration** and
should not be carried into the reconstructed Cashier without an explicit authorization, per
CLAUDE.md's "Do not implement out-of-scope order-resolution actions" rule and the locked role
matrix.

### Secondary finding: split-items scope is genuinely ambiguous

Unlike the transfer/merge/move panels (clearly out of scope) and split-**bill** (clearly in scope,
metadata-only), `CashierSplitItemsPanel`'s child-order-creation behavior sits in a gap between
`CASHIER_ARCHITECTURE.md`'s "reuse existing verified Cashier flows… split-bill resolution" wording
and `CASHIER_ROLE_BEHAVIOUR_MATRIX.md`'s narrower "resolve existing payable allocations; do not
duplicate Supervisor split logic." This audit does not resolve that ambiguity — it is flagged for an
explicit decision in a later prompt rather than assumed either way.
