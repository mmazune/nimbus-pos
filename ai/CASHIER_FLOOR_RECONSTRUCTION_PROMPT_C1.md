# Cashier Floor Reconstruction — Prompt C1

Use the highest-capability Claude Opus model available with maximum reasoning effort.

## Mission

Implement Prompt C1 of the Cashier Floor-First reconstruction: make Cashier the **third consumer**
of the shared `OperationalShell`/`OperationalFloor` system alongside Waiter and Supervisor, change
Cashier's visible navigation from **Queue · Receipts · Till · Me** to **Floor · Till · Me**, add
`/cashier/floor` as the default route, and add legacy-redirect scaffolding for `/cashier/queue` and
`/cashier/receipts` — all **without** deleting any working Queue/Receipts capability and **without**
rewriting the payment/split/receipt/Till/refund logic those pages currently host.

C1 is scoped to **navigation, shell, and routing only**. Prompt C0
(`ai/CASHIER_FLOOR_RECONSTRUCTION_C0_REPO_VERIFICATION_REPORT.md`, classification A — COMPLETE /
READY FOR C1) verified every assumption below against the actual worktree; this prompt is written
from that verified evidence, not from the aspirational target docs alone. Read the five companion
C0 audit reports before starting — they contain exact file:line evidence for every claim below:

- `ai/CASHIER_FLOOR_RECONSTRUCTION_ROUTE_AND_NAV_AUDIT.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_COMPONENT_AUDIT.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_CAPABILITY_MIGRATION_MATRIX.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_PERMISSION_AND_API_MATRIX.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_TEST_INVENTORY.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md` (Sections A + B — every row below is tagged
  with its gap-register ID)

## Repository

Use only: `C:\Users\arman\Desktop\nimbus-pos`. Never use
`C:\Users\arman\Desktop\NIMBUS\nimbus-pos`. The dirty local worktree is authoritative — never
reset, restore, stash, clean, discard, or overwrite unrelated work (there are ~52 pre-existing
modified/untracked paths from in-progress Supervisor Approvals work; do not touch them). Do not
commit or push unless explicitly instructed.

## What C1 must NOT do (read this before writing any code)

- Do **not** delete `apps/web/src/pages/cashier/{queue,receipts}.tsx` or any component under
  `components/cashier/{queue,receipts}/**` — they stay live and reachable (via legacy redirect,
  §5) until C4/C5 migrate every capability out of them and prove it via reference search +
  executable QA (per `docs/cashier-ui-docs/CASHIER_COMPONENT_REUSE_MAP.md`'s "Removal gate").
- Do **not** build the settlement workspace, table-to-order resolution, Find bill, payment
  relocation, or receipt-panel relocation — that is C2 onward. C1's Floor page opens a placeholder/
  boundary on table selection (see §4.5), nothing more.
- Do **not** touch `apps/web/src/components/cashier/resolution/{CashierTransferTablePanel,
  CashierTransferServerPanel,CashierMergeOrdersPanel,CashierMoveItemsPanel}.tsx` or
  `CashierSplitItemsPanel.tsx` — these are flagged in the gap register (CASH-FR-032, CASH-FR-033)
  as pre-existing scope questions requiring an explicit human decision before C3, not a C1
  concern. Leave them exactly as they are.
- Do **not** bulk-fix the 56-file direct-Phosphor-icon-import violation (CASH-FR-NAV-04) across
  existing `components/cashier/**` files — out of scope for a nav-only prompt. New C1 files must
  use the icon registry correctly from creation (§3).
- Do **not** change any backend file, Prisma schema, migration, seed, permission, or Postman
  collection. C0's permission audit confirmed every permission C1 needs is already granted to
  Cashier — if you find yourself wanting a new endpoint or permission, stop and flag it instead of
  adding it.
- Do **not** add a fourth nav tab, rename Till/Me, or add Orders/Refunds/Reports/Settings/
  Dashboard to visible navigation.

## 1. Route table change (CASH-FR-002)

Edit `apps/web/src/lib/cashier/routes.ts`. Current state (verified, `ROUTE_AND_NAV_AUDIT.md` §1.1):

```ts
export const cashierRoutes = [
  { href: "/cashier/queue",    label: "Queue",    icon: operationalIconNames.cashierQueue, ... },
  { href: "/cashier/receipts", label: "Receipts", icon: operationalIconNames.cashierReceipts, ... },
  { href: "/cashier/till",     label: "Till",     icon: operationalIconNames.cashierTill, ... },
  { href: "/cashier/me",       label: "Me",       icon: operationalIconNames.me, ... },
] as const satisfies readonly OperationalNavItem[];
```

Change to exactly three items: Floor (first), Till (unchanged), Me (unchanged). Remove the Queue
and Receipts entries entirely — `CashierBottomNav.tsx` needs **zero code change**, it already just
forwards `getOperationalRoleNavigation("cashier")` to the shared `OperationalBottomNav`
(`ROUTE_AND_NAV_AUDIT.md` §2.2, confirmed pure reuse).

## 2. Icon registry addition (CASH-FR-NAV-04, new files only)

Add a `cashierFloor` key (and, if you build the Find-bill sibling stub in this prompt — optional,
see §4.6 — a `cashierFindBill` key) to
`apps/web/src/components/pos-shell/role-icon-config.ts` and `role-icons.ts`, following the exact
existing pattern for `cashierQueue`/`cashierReceipts`/`cashierTill`. Reference icons only by
registry name in any new file — never import `@phosphor-icons/react` directly in the new Floor
page/screen (the existing 56-file violation elsewhere in `components/cashier/**` is out of scope,
per the "must not" list above).

## 3. Bare `/cashier` route (CASH-FR-NAV-01)

There is currently no `pages/cashier/index.tsx` and no `pages/cashier.tsx` — bare `/cashier` 404s
today (confirmed, `ROUTE_AND_NAV_AUDIT.md` §1.3). Add `apps/web/src/pages/cashier/index.tsx`
mirroring the existing `apps/web/src/pages/waiter/index.tsx` pattern (a `getServerSideProps`
redirect) — server-side redirect bare `/cashier` to `/cashier/floor`.

## 4. New `/cashier/floor` page + `CashierFloorScreen` adapter (CASH-FR-001, CASH-FR-003, CASH-FR-004)

### 4.1 Page

Add `apps/web/src/pages/cashier/floor.tsx`, following the exact 2-line shape confirmed identical
across both existing Floor consumers (`ROUTE_AND_NAV_AUDIT.md` §2.6):

```tsx
export default function CashierFloorPage() {
  return (<CashierShell><CashierFloorScreen /></CashierShell>);
}
```

with the same no-op `getServerSideProps` pattern the other three Cashier pages already use.

### 4.2 `CashierFloorScreen` — data loading

Create `apps/web/src/components/cashier/floor/CashierFloorScreen.tsx`. Follow the proven
Waiter/Supervisor adapter pattern exactly (`COMPONENT_AUDIT.md` Part 1.4–1.6):

- Own `useQuery({ queryKey: ["cashier","floor",branchId], queryFn: () => loadCashierFloorData(...) })`
  loading tables (`GET /api/tables`) + active orders
  (`GET /api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100`) in parallel — mirror
  `loadWaiterFloorData`/`loadSupervisorFloorData`'s exact `excludeStatus`/`pageSize` convention
  for consistency (`lib/waiter/floor-api.ts:97-105`, `lib/supervisor/floor.ts:110-124`). Do not
  add a reservations fetch (Cashier has no reservation-read plumbing today — confirmed, and out
  of C1's scope).
- Add `apps/web/src/lib/cashier/floor.ts` + `floor-model.ts` (new files, following the existing
  `lib/waiter/floor-model.ts` / `lib/supervisor/floor.ts` naming convention) with a
  `CashierFloorTableViewModel extends OperationalTableViewModel`. **Do not port Waiter's
  `orderByTable` first-match reduction** (`floor-model.ts:89-98`) — it silently drops all but the
  most-recent order per table, which is the exact anti-pattern CASH-FR-006 forbids. For C1's
  scope, a table's card only needs canonical `OperationalTableViewModel` fields (status, capacity,
  staff, reservation indicator) — it does **not** need to resolve "the order" for the card itself;
  that resolution is C2's job, triggered on table selection, not on Floor load.

### 4.3 Table card contract

No guest names, no payment/bill indicator, no per-table payment fetch (matches the invariant
already true of every existing Floor card — `COMPONENT_AUDIT.md` §1.2). Do **not** implement
CASH-FR-024's bill-requested card signal in C1 — it requires a shared-component prop addition
(`OperationalTableViewModel` + `OperationalTableCard`) and a documented-vs-audit-derived backend
trust question that is explicitly out of scope for this prompt; leave it for a later phase to
decide with full 3-role regression.

### 4.4 URL-backed table selection (CASH-FR-NAV-02)

Standardize on the **Receipts** pattern, not Queue's — Queue's plain `useState` selection with no
URL persistence is confirmed broken for refresh/Back/Forward (`ROUTE_AND_NAV_AUDIT.md` §1.6) and
must not be the model. Implement `tableId` (and, once C2 exists, `orderId`) as
`router.query`-backed state using `router.replace({ pathname, query }, undefined, { shallow: true
})`, spreading existing query and deleting the key when cleared — the exact pattern already proven
in `CashierReceiptsScreen.tsx`'s `selectedReceiptId` handling. Mirror Waiter/Supervisor's
push-once/replace-after convention so Back/Forward behave correctly
(`WaiterFloorScreen.tsx:125-147`, `SupervisorFloorScreen.tsx` `handleSelectTable`).

### 4.5 Table selection → C1 boundary (placeholder, not settlement workspace)

On table selection, render into the shared `OperationalTableWorkspaceFrame` (never a new frame
component) — but the content C1 puts inside it is a **minimal placeholder**, not the settlement
workspace: show the selected table's label/status and an honest "Settlement workspace not yet
built — table-to-order resolution and payment/close/receipt actions arrive in a later
reconstruction phase" state. Do not attempt table-to-order resolution, do not render
`CashierPaymentPanel`/`CashierCheckoutPreview`/any existing Queue-sourced financial component
inside this placeholder — that relocation is explicitly C2/C3's job, not C1's. The point of C1 is
proving the Floor/shell/nav/routing skeleton works end-to-end; the workspace content is filled in
later.

### 4.6 Find bill — stub only, optional

You may add a disabled/coming-soon `CashierFindBillControl` sibling `Button` in the same
`flex justify-end` position Supervisor's Find-order button occupies
(`SupervisorFloorScreen.tsx:170-183`, quoted verbatim in `COMPONENT_AUDIT.md` §1.5), with no dialog
wired up yet — this proves the layout slot exists without building C2's lookup logic early. This is
optional; if you skip it, do not reserve dead space for it either — just omit the control entirely
until C2.

## 5. Legacy redirects for `/cashier/queue` and `/cashier/receipts` (CASH-FR-026, CASH-FR-018,
CASH-FR-022)

**Do not delete `queue.tsx`/`receipts.tsx` or their screen components.** Instead, follow the
verified, fully-working Supervisor pattern **exactly** (`ROUTE_AND_NAV_AUDIT.md` §3.1, full
implementation quoted there) — do not invent a new redirect shape:

1. Add `apps/web/src/lib/cashier/legacy-floor-route.ts` with a `firstLegacyQueryValue` helper
   (identical shape to `lib/supervisor/legacy-orders-route.ts`'s) and a
   `buildCashierFloorContextQuery(query, resolvedTableId?)` pure helper covering `tableId`,
   `orderId`, and `receiptId` (Receipts-specific — Supervisor's `buildSupervisorFloorContextQuery`
   is table/order-shaped only and cannot be reused directly, per the audit's explicit note).
2. Add `CashierLegacyQueueRedirect` / `CashierLegacyReceiptsRedirect` components (or one shared
   component parameterized by source page) modeled on `SupervisorLegacyOrdersRedirect.tsx`: read
   legacy query params, `router.replace({ pathname: "/cashier/floor", query })` (never `push`),
   render a `LoadingState` throughout, no flash of old content.
3. Since Queue currently carries **no** URL-param selection state at all (confirmed,
   `ROUTE_AND_NAV_AUDIT.md` §1.6), the Queue redirect can be simpler than Supervisor's — no
   order-detail resolution fetch is required unless you want defense-in-depth for hand-typed/
   bookmarked `?orderId=` links. Receipts **does** already emit/consume `receiptId` via
   `router.query` — forward it.
4. Replace the *content* of `pages/cashier/queue.tsx` and `pages/cashier/receipts.tsx` with these
   redirect wrappers (still rendered inside their existing session guard, same as Supervisor's
   pattern) — but do **not** delete `CashierQueueScreen.tsx`/`CashierReceiptsScreen.tsx` or any
   component they import; they simply become temporarily unreached-by-route until C4/C5 finish
   migrating their capabilities and formally retire them per the removal gate.
5. `router.replace`, never `push` — no redirect-loop history entries, no mutation on redirect.

## 6. Default landing route change (CASH-FR-001)

Change `getCashierLandingPath()` in `apps/web/src/lib/auth/role.ts:54-56` to return
`/cashier/floor` instead of `/cashier/queue`. This is a single-function change; both call sites in
`login.tsx` (the already-authenticated redirect effect and the post-login `completeLogin` handler)
pick it up automatically — no other change needed there.

## 7. Shared-Floor parity tests (CASH-FR-028)

Add a new `apps/web/e2e/cashier-floor/` Playwright suite, modeled on the proven
`apps/web/e2e/supervisor-prompt3/` structure (`fixtures.ts` reusing the existing
`uiLogin(page,"cashier")` helper — already works, confirmed `TEST_INVENTORY.md` §1.2 — plus
per-concern spec files). Minimum coverage for C1:

- Cashier lands on `/cashier/floor` after login (not `/cashier/queue`).
- Visible nav is exactly Floor/Till/Me (no Queue/Receipts labels, no Approvals/Reservations).
- Shared Floor toolbar/grid/cards render identically in structure to Waiter/Supervisor at the same
  viewport (a first pass at the "Shared Floor parity" test category the target test plan requires
  and that currently does not exist for *any* role pair — `TEST_INVENTORY.md` §1.3).
- `/cashier` → `/cashier/floor` redirect (no loop).
- `/cashier/queue` and `/cashier/receipts` → `/cashier/floor` redirects (no loop, no mutation).
- Table selection opens the placeholder workspace frame (not a 404, not a crash).
- All four required viewports (1024×768, 1366×768, 1440×900, 1920×1080) — `playwright.config.ts`
  already has these projects configured, no config change needed.

Also **update** (not just extend) the three pre-existing Supervisor-suite specs that hard-assert
the old Cashier nav and will break once C1 ships (`TEST_INVENTORY.md` §1.2, exact locations):
- `apps/web/e2e/supervisor-prompt3/regression.spec.ts:14-26`
- `apps/web/e2e/supervisor-prompt3/role-boundaries.spec.ts:12-19`
- `apps/web/e2e/supervisor-approvals/cross-role-visibility.spec.ts:11-16`

Change their Cashier-nav assertions from Queue/Receipts/Till/Me to Floor/Till/Me and from
`/cashier/queue` to `/cashier/floor` where applicable. These are pre-existing Supervisor-owned
regression tests, not new Cashier coverage — treat fixing them as a required part of C1's
completion gate, not optional cleanup.

## 8. Validation (every item required before claiming C1 complete)

```bash
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
```

- `git diff --check` clean.
- Actual Playwright execution (not just compilation) of the new `cashier-floor/` suite plus the
  three updated Supervisor-suite specs, across all four required viewports.
- Waiter and Supervisor Floor regression: confirm their shared-Floor presentation, table cards,
  and existing workspace behavior are byte-for-byte unchanged (shared-component change gate per
  `docs/cashier-ui-docs/CASHIER_COMPONENT_REUSE_MAP.md`).
- `GET /api/health` returns ok.
- Confirm via reference search that `CashierQueueScreen.tsx`/`CashierReceiptsScreen.tsx` and every
  component they import are still present and unmodified (only reachability via route changed).
- No permission/schema/migration/seed/Postman file touched — confirm via `git status`.
- Request-count check: cold `/cashier/floor` mount should not exceed the existing Queue-mount
  request count (§13 of the C0 report — ≈6 Cashier-specific + shared bootstrap) plus the new
  Floor query itself; do not introduce a duplicate `/auth/me`, a duplicate readiness fetch, or a
  responsive double-mount.

## 9. Completion report requirements

Write `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_COMPLETION_REPORT.md` covering: what changed (file list),
what was explicitly deferred to C2+ (settlement workspace content, Find bill logic, table-to-order
resolution, the two flagged scope-decision items CASH-FR-032/033), validation results (typecheck/
lint/build/Playwright/regression, with actual pass counts, not just "compiles"), confirmation of
no backend/schema/permission/Postman change, and update `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`
rows CASH-FR-001/002/003/004/NAV-01/NAV-02/NAV-04/026/028 from Open to their new verified state.
Update `PROGRESS.md`/`ai/AI_STATUS.md`/`CLAUDE.md` §9-§10 to reflect C1 completion, following the
same additive-supersession pattern C0 used — do not rewrite the C0 entries, append after them.

## Final classification

Use one of: `C1 COMPLETE / READY FOR C2`, `C1 COMPLETE WITH KNOWN LIMITATIONS`,
`C1 BLOCKED` (name the exact blocker), `C1 INCOMPLETE`. Do not begin C2 in the same run — C2
(table-to-order resolution + settlement-workspace foundation + Find-bill foundation) needs its own
review gate, and the two flagged scope questions (CASH-FR-032 transfer-table/merge/move/
transfer-server, CASH-FR-033 split-items) should be explicitly resolved by the user before C3
touches any financial-action relocation.
