# Cashier Floor Reconstruction — Route, Navigation, and Shell Audit

**Prompt:** C0 (audit/documentation only, no code changes)
**Scope:** Route/navigation model, shell composition, legacy redirect readiness for the
Cashier Floor-first rebuild (target: nav = Floor/Till/Me, default route `/cashier/floor`,
Cashier as third `OperationalFloor` consumer).
**Method:** Direct inspection of the local dirty worktree (`apps/web/src`). No code was
modified. All line numbers refer to the files as they exist in the worktree at audit time.

---

## 1. Cashier routing

### 1.1 `apps/web/src/lib/cashier/routes.ts` — current route table

The entire file (29 lines) is the nav-item source consumed by
`getOperationalRoleNavigation("cashier")`:

```ts
export const cashierRoutes = [
  { href: "/cashier/queue",    label: "Queue",    icon: operationalIconNames.cashierQueue,    match: (p) => p === "/cashier/queue" },
  { href: "/cashier/receipts", label: "Receipts", icon: operationalIconNames.cashierReceipts, match: (p) => p === "/cashier/receipts" },
  { href: "/cashier/till",     label: "Till",     icon: operationalIconNames.cashierTill,     match: (p) => p === "/cashier/till" },
  { href: "/cashier/me",       label: "Me",       icon: operationalIconNames.me,               match: (p) => p === "/cashier/me" },
] as const satisfies readonly OperationalNavItem[];
```

- 4 items, no `href`/`match` for `/cashier/floor` anywhere.
- No URL param model in the route table itself — items are plain `href`/`label`/`icon`/`match`.
- The icon keys `cashierQueue`, `cashierReceipts`, `cashierTill` are the only Cashier-specific
  icon-registry entries (see §2.5) — there is **no `cashierFloor` icon key yet**, and no
  `cashierFindBill` key. C1 must add these to
  `apps/web/src/components/pos-shell/role-icon-config.ts` +
  `apps/web/src/components/pos-shell/role-icons.ts`.
- `OperationalNavItem`/`OperationalRole` types live in
  `apps/web/src/components/pos-shell/types.ts:5-12` (`OperationalRole = "waiter" | "cashier" | "supervisor"`).
- Wiring: `apps/web/src/components/pos-shell/role-navigation.ts` maps
  `cashier: cashierRoutes` into `operationalRoleNavigation`, consumed by
  `CashierBottomNav` via `getOperationalRoleNavigation("cashier")`.

### 1.2 `apps/web/src/pages/cashier/*.tsx` — confirmed page inventory

```
apps/web/src/pages/cashier/queue.tsx
apps/web/src/pages/cashier/receipts.tsx
apps/web/src/pages/cashier/till.tsx
apps/web/src/pages/cashier/me.tsx
```

**Confirmed: no `index.tsx` and no `floor.tsx` exist** under `apps/web/src/pages/cashier/`
(glob returned exactly the 4 files above). There is also no `apps/web/src/pages/cashier.tsx`
(bare-file route) — confirmed via a separate glob that returned no matches.

Each existing page is a thin two-line composition: `<CashierShell><Cashier*Screen /></CashierShell>`,
with a no-op `getServerSideProps` returning `{ props: {} }`. Example (`queue.tsx`):

```tsx
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });
export default function CashierQueuePage() {
  return (
    <CashierShell>
      <CashierQueueScreen />
    </CashierShell>
  );
}
```

`till.tsx` and `me.tsx` follow the identical pattern (`CashierTillScreen`, `CashierMeScreen`).

### 1.3 What does bare `/cashier` currently resolve to?

There is no `pages/cashier/index.tsx` and no `pages/cashier.tsx`. Next.js Pages Router has
**no implicit fallback** for a directory with files but no `index` — `/cashier` will 404
(standard Next.js 404 page) today. This differs from Waiter, which has an explicit
`pages/waiter/index.tsx` that server-side-redirects to `/waiter/floor` (see §1.4). Supervisor
has no `pages/supervisor/index.tsx` either — bare `/supervisor` also 404s today; Supervisor's
default landing is reached only through the login redirect (`getSupervisorLandingPath()` →
`/supervisor/floor`), not through a bare-route redirect.

### 1.4 Current default landing route after Cashier login

Traced through `apps/web/src/pages/login.tsx` and `apps/web/src/lib/auth/role.ts`:

```ts
// apps/web/src/lib/auth/role.ts:54-56
export function getCashierLandingPath() {
  return "/cashier/queue";
}
// apps/web/src/lib/auth/role.ts:58-60
export function getSupervisorLandingPath() {
  return "/supervisor/floor";
}
```

`login.tsx` calls this in two places:

- An already-authenticated redirect effect (lines 107-117):
  ```ts
  if (!isLoading && isAuthenticated && isWaiter) void router.replace("/waiter/floor");
  if (!isLoading && isAuthenticated && isCashier) void router.replace(getCashierLandingPath());
  if (!isLoading && isAuthenticated && isSupervisor) void router.replace(getSupervisorLandingPath());
  ```
- The post-login `completeLogin` handler (lines 157-174), which prefers
  `window.location.replace` (hard navigation) and falls back to `router.replace`:
  ```ts
  window.location.replace(
    isSupervisorUser ? getSupervisorLandingPath()
      : isCashierUser ? getCashierLandingPath()
      : "/waiter/floor",
  );
  ```

**Confirmed: Cashier's current default landing route is `/cashier/queue`.** Waiter is
hard-coded inline to `/waiter/floor` (not via a `role.ts` helper — an existing inconsistency,
not introduced by this audit). Role compatibility is decided by `isWaiterCompatible`,
`isCashierCompatible`, `isSupervisorCompatible` in `role.ts:19-52`, which check
`role.jobRole` (upper-cased) against a per-role `Set` and, for Cashier/Supervisor, also
accept `role.name === "CASHIER"/"SUPERVISOR"`.

**Gap for C1:** `getCashierLandingPath()` must change its return value from `/cashier/queue`
to `/cashier/floor`. This is a single-function change with two call sites in `login.tsx`.

### 1.5 Cashier route guards

`CashierSessionGuard` (`apps/web/src/components/cashier/shell/CashierSessionGuard.tsx`,
87 lines) is the only route guard; it is composed once per page via `CashierShell` (§2.1), not
per-route custom logic. Behaviour:

1. `isLoading` → renders `LoadingState` ("Restoring cashier session"), no redirect yet.
2. `!accessToken || !isAuthenticated` → `useEffect` fires `router.replace("/login?reason=session_required")`
   and, while that resolves, renders `LoadingState` ("Returning to login").
3. `!isCashier` → renders `BlockedState` ("Cashier access required.") with a manual
   "Return to login" button that calls `clearSession()` then
   `router.replace("/login?reason=cashier_only")`. **This is not an automatic redirect** —
   unlike case 2, the user must click through.
4. `!branchId` → renders `BlockedState` ("Branch context unavailable.") with the same
   manual "Return to login" pattern, `reason=session_required`.
5. Otherwise renders `children`.

This is a **role-only + branch-presence guard**, not a permission-string guard — there is no
`pos:*` permission check anywhere in `CashierSessionGuard.tsx` (grep for
`permission|pos:orders|hasPermission` in that file returned no matches). This mirrors
`WaiterSessionGuard.tsx` (63 lines, role-only + `isWaiter`) and (by the same pattern, not
independently re-quoted here) `SupervisorSessionGuard.tsx`. **No divergence found** — Cashier's
guard shape is structurally identical to Waiter's, just with an added `branchId` check that
Waiter's guard doesn't have. This guard pattern can carry over unchanged into C1 (no route-guard
rework required for the nav change itself).

### 1.6 Current selected-order/tableId/orderId/receiptId URL param model

This is the most consequential finding for C2/C3 planning — **the two existing screens use two
different, inconsistent models**:

**Queue (`CashierQueueScreen.tsx`, lines 37-38, 89-99, 260):**
`selectedOrderId` is **plain React `useState`, never read from or written to the URL**.
```ts
const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
```
There is no `useRouter()` call anywhere in `CashierQueueScreen.tsx` (grep-confirmed by absence
of `router.query`/`router.replace`/`router.push` in the file's 293 lines). A page refresh loses
the selected order entirely and always falls back to auto-selecting the first visible order
(lines 89-93: `useEffect` auto-selects `visibleOrders[0]` when `!selectedOrderId`).

**Receipts (`CashierReceiptsScreen.tsx`, lines 54-56, 59, 74, 153-165):**
`selectedReceiptId` **is** URL-param-backed, via `router.query.receiptId`, using
`router.replace` with `shallow: true`:
```ts
function selectedReceiptIdFromQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || null;
}
const selectedReceiptId = selectedReceiptIdFromQuery(router.query.receiptId);
...
const setSelectedReceipt = useCallback((receiptId: string | null) => {
  const nextQuery = { ...router.query };
  if (receiptId) nextQuery.receiptId = receiptId;
  else delete nextQuery.receiptId;
  if (!receiptId) setRefundOpen(false);
  void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
}, [router]);
```
This survives refresh (receipt ID round-trips through the URL) and uses `replace` (not `push`,
so selecting receipts doesn't pollute browser history) with `shallow: true` (no
`getServerSideProps` re-run).

**No `tableId` query param exists anywhere in current Cashier code** — expected, since Cashier
has no Floor/table concept today. Grep across `apps/web/src/components/cashier` and
`apps/web/src/pages/cashier` for `tableId` found no matches.

**Gap for C2:** the target `tableId`/`orderId`/`receiptId` URL contract described in
`docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md` (§"Table-to-order resolution", point 7: "Preserve
`tableId`, `orderId`, and `receiptId` in URL state where relevant") must standardize on the
Receipts pattern (`router.replace` + `shallow: true`, spread existing query, delete-key-when-null)
project-wide — Queue's plain-`useState` model does not meet the architecture doc's refresh/Back/
Forward requirement and cannot be reused as-is.

### 1.7 Existing `/cashier/floor` references

Repo-wide case-insensitive grep for `/cashier/floor` returns exactly 7 files, **all
documentation, none of them code**:

```
docs/cashier-ui-docs/CASHIER_TEST_PLAN.md
docs/cashier-ui-docs/CASHIER_ROLE_BEHAVIOUR_MATRIX.md
docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md
docs/cashier-ui-docs/CASHIER_LIFECYCLE.md
docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md
ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C0.md
ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md
```

No `.tsx`/`.ts` file, no Postman collection, and no e2e spec currently references
`/cashier/floor`. This confirms the page truly does not exist yet anywhere in the runtime
surface — C1 is building from zero, not toggling a flag or un-commenting a stub.

### 1.8 Back/Forward and refresh behavior as currently implemented

- **Queue:** state-only selection (§1.6) → refresh always resets to "first visible order
  auto-selected"; Back/Forward do nothing (no history entries are pushed for selection changes,
  since there's no router call at all).
- **Receipts:** URL-backed selection via `router.replace` (§1.6) → refresh restores the same
  receipt (subject to the receipt still being a valid candidate in the freshly-refetched list);
  Back/Forward are inert for receipt selection specifically because `replace` (not `push`) is
  used — intentional (no history spam) but means there is no "Back to previous receipt" browser
  gesture, only a `Close` UI action that clears the query key.
- **Till:** `CashierTillScreen.tsx` (lines 1-60 read; no `useRouter` import present) — Till has
  no selection state at all in its current form (it operates on "the" active till for the branch,
  not a selected entity), so it has no URL-param model to migrate.
- Legacy Supervisor precedent (§3) shows the intended pattern: `router.replace({ pathname, query })`
  for context-preserving navigation, never `push`, and always guarding on `router.isReady` before
  reading `router.query`.

---

## 2. Cashier shell composition

### 2.1 `CashierShell.tsx` — reuse vs fork

Full file (30 lines):

```tsx
import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { CashierBottomNav } from "@/components/cashier/shell/CashierBottomNav";
import { CashierHeader } from "@/components/cashier/shell/CashierHeader";
import { CashierIdleLogoutHandler } from "@/components/cashier/shell/CashierIdleLogoutHandler";
import { CashierReadinessStrip } from "@/components/cashier/shell/CashierReadinessStrip";
import { CashierSessionGuard } from "@/components/cashier/shell/CashierSessionGuard";
import { useCashierReadiness } from "@/lib/cashier/readiness";

export function CashierShell({ children }: CashierShellProps) {
  const readiness = useCashierReadiness();
  return (
    <CashierSessionGuard>
      <OperationalShell
        header={<CashierHeader />}
        readiness={<CashierReadinessStrip items={readiness.items} />}
        bottomNavigation={<CashierBottomNav />}
        idleHandler={<CashierIdleLogoutHandler />}
      >
        {children}
      </OperationalShell>
    </CashierSessionGuard>
  );
}
```

**Verdict: thin adapter — directly imports and renders the shared `OperationalShell`** from
`@/components/pos-shell/OperationalShell`, passing role-specific header/readiness/nav/idle as
props. Structurally identical to `SupervisorShell.tsx` (§2.6 comparison) and (by extension)
`WaiterShell`. No shell-layout/chrome duplication found.

### 2.2 `CashierBottomNav.tsx` — reuse vs fork

Full file (11 lines):

```tsx
import { OperationalBottomNav } from "@/components/pos-shell/OperationalBottomNav";
import { getOperationalRoleNavigation } from "@/components/pos-shell/role-navigation";

export function CashierBottomNav() {
  return (
    <OperationalBottomNav
      ariaLabel="Cashier navigation"
      items={getOperationalRoleNavigation("cashier")}
    />
  );
}
```

**Verdict: pure reuse.** Directly renders the shared `OperationalBottomNav` primitive; the only
Cashier-specific input is the `items` array from `cashierRoutes` (§1.1). **Current nav items:
Queue / Receipts / Till / Me** (labels/icons/routes exactly as in §1.1). Target: Floor / Till /
Me. This is purely a data change to `cashierRoutes` (remove Queue+Receipts entries, add a Floor
entry as the first item) — the component itself needs no change.

### 2.3 `CashierHeader.tsx` — reuse vs fork

Full file (19 lines):

```tsx
import { OperationalHeader } from "@/components/pos-shell/OperationalHeader";
import { useCashierContext } from "@/lib/cashier/context";
import { getProfileInitials } from "@/lib/profile/profile-model";

export function CashierHeader() {
  const cashierContext = useCashierContext();
  return (
    <OperationalHeader
      branchLabel={cashierContext.branchName}
      contextKind="workstation"
      contextLabel={cashierContext.workstationLabel}
      displayName={cashierContext.displayName}
      initials={getProfileInitials(cashierContext.displayName)}
      roleLabel={cashierContext.roleLabel}
    />
  );
}
```

**Verdict: pure reuse of `OperationalHeader`.** No divergence — no rebuild needed for C1.
(Note `cashierContext.workstationLabel` currently resolves to the literal string
`"Workstation unavailable"` unconditionally — `apps/web/src/lib/cashier/context.ts:48` — a
pre-existing cosmetic gap unrelated to navigation, noted here only because it's visible in the
header every screen renders.)

### 2.4 Idle-session handling — shared mechanism or separate implementation?

**Cashier indirects through Waiter rather than calling the shared primitive directly:**

```tsx
// apps/web/src/components/cashier/shell/CashierIdleLogoutHandler.tsx (full file)
import { WaiterIdleLogoutHandler } from "@/components/waiter/shell/WaiterIdleLogoutHandler";
export function CashierIdleLogoutHandler() {
  return <WaiterIdleLogoutHandler />;
}
```
```tsx
// apps/web/src/components/waiter/shell/WaiterIdleLogoutHandler.tsx (full file)
import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
export function WaiterIdleLogoutHandler() {
  return <OperationalIdleLogoutHandler />;
}
```

Both are trivial pass-through wrappers around the same shared
`OperationalIdleLogoutHandler` (`apps/web/src/components/pos-shell/OperationalIdleLogoutHandler.tsx`,
which itself imports `OPERATIONAL_ACTIVITY_EVENTS`/`OPERATIONAL_IDLE_TIMEOUT_MS` from
`@/components/pos-shell/idle` — the one shared idle mechanism CLAUDE.md §16 references). **The
runtime behaviour is identical to Waiter/Supervisor** — same timeout constants, same activity
events, same `logout()` + hard `window.location.replace("/login?reason=idle_timeout")`. However,
by contrast, `SupervisorShell.tsx` imports `OperationalIdleLogoutHandler` **directly** (no
`SupervisorIdleLogoutHandler` wrapper exists — see §2.6 quote). So there are, in effect, three
files implementing zero net divergent logic for two roles (Waiter, Cashier) where Supervisor
needs zero. This is a naming/indirection inconsistency, not a functional gap, but worth
flagging as a cleanup opportunity for C1 (Cashier's wrapper could import
`OperationalIdleLogoutHandler` directly the way Supervisor's does, dropping the
Cashier→Waiter dependency, which is conceptually backwards for two peer roles).

### 2.5 Icon registry usage — direct Phosphor imports in Cashier files

CLAUDE.md §13 prohibits importing Phosphor icons directly outside the canonical registry
(`pos-shell/role-icon-config.ts` + `role-icons.ts`). A repo grep for
`from "@phosphor-icons/react"` under `apps/web/src/components/cashier` returns **56 files**
that import Phosphor directly — i.e. essentially the entire existing Cashier component tree,
including shell files:

- `CashierSessionGuard.tsx` (imports `ArrowLeft` directly for its blocked-state button)
- `CashierReadinessStrip.tsx` (imports `ClockClockwise, Plugs, Wallet` directly, keyed by a
  local `icons` map rather than the registry)

...and all of Queue/Receipts/Till/Refunds/Checkout/Resolution/Me screen components (full list
captured during the audit: `CashierReceiptsScreen`, `CashierQueueScreen`, `CashierTillScreen`,
`CashierRefundPanel`, `CashierCloseOrderPanel`, all 6 `me/Cashier*Card` files, all `refunds/`,
`till/`, `receipts/`, `resolution/`, `checkout/`, `queue/`, and `states/` components). This is a
**pre-existing, pervasive violation** — not introduced by this audit and not something C0 is
scoped to fix — but it is directly relevant to C1 because:
1. It confirms the icon registry is *not* actually enforced in the existing Cashier codebase
   today, so a literal reading of CLAUDE.md §13 would require a large unrelated cleanup that is
   explicitly out of scope for a nav-only C1 change.
2. Any **new** C1 code (the Floor page, `CashierFloorScreen`, a `CashierFindBill` sibling
   control) should use the registry correctly from the start rather than compounding the debt,
   since C1 is new-file authorship, not modification of the legacy 56.

For contrast, `queue.tsx`/`receipts.tsx`/`till.tsx`/`me.tsx` (the 4 page-level files under
`apps/web/src/pages/cashier/`) contain **zero** direct Phosphor imports — the violation is
confined to `components/cashier/**`, never the route files themselves.

### 2.6 Comparison with Waiter/Supervisor shell composition

`SupervisorShell.tsx` (full file, 31 lines):

```tsx
import { OperationalIdleLogoutHandler } from "@/components/pos-shell/OperationalIdleLogoutHandler";
import { OperationalShell } from "@/components/pos-shell/OperationalShell";
import { SupervisorBottomNav } from "@/components/supervisor/shell/SupervisorBottomNav";
import { SupervisorHeader } from "@/components/supervisor/shell/SupervisorHeader";
import { SupervisorReadinessStrip } from "@/components/supervisor/shell/SupervisorReadinessStrip";
import { SupervisorSessionGuard } from "@/components/supervisor/shell/SupervisorSessionGuard";
import { useSupervisorReadiness } from "@/lib/supervisor/context";

export function SupervisorShell({ children }: SupervisorShellProps) {
  const readiness = useSupervisorReadiness();
  return (
    <SupervisorSessionGuard>
      <OperationalShell
        header={<SupervisorHeader />}
        readiness={<SupervisorReadinessStrip items={readiness.items} />}
        bottomNavigation={<SupervisorBottomNav />}
        idleHandler={<OperationalIdleLogoutHandler />}
      >
        {children}
      </OperationalShell>
    </SupervisorSessionGuard>
  );
}
```

This is **byte-for-byte the same structural shape as `CashierShell.tsx`** (§2.1) — same 5-slot
composition (guard wraps `OperationalShell` with header/readiness/bottomNavigation/idleHandler
props), differing only in (a) Supervisor imports `OperationalIdleLogoutHandler` directly instead
of through a role-named wrapper (§2.4), and (b) the readiness hook name
(`useSupervisorReadiness` vs `useCashierReadiness`). **No structural divergence — Cashier's
shell pattern is already the established thin-adapter pattern; C1 does not need to redesign
`CashierShell.tsx` itself**, only the nav-item data (`cashierRoutes`) and, per the target
architecture, the default-landing helper (`getCashierLandingPath`).

`Floor` page composition is likewise structurally parallel across the two existing Floor
consumers:

```tsx
// apps/web/src/pages/supervisor/floor.tsx
export default function SupervisorFloorPage() {
  return (<SupervisorShell><SupervisorFloorScreen /></SupervisorShell>);
}
// apps/web/src/pages/waiter/floor.tsx
export default function WaiterFloorPage() {
  return (<WaiterShell><WaiterFloorScreen /></WaiterShell>);
}
```

A future `apps/web/src/pages/cashier/floor.tsx` should follow this exact 2-line shape:
`<CashierShell><CashierFloorScreen /></CashierShell>`.

**Confirmed via grep:** `OperationalFloor` (the shared Floor presentation component,
`apps/web/src/components/floor/OperationalFloor.tsx`) is currently imported by exactly 2
consumer screens — `SupervisorFloorScreen.tsx` and `WaiterFloorScreen.tsx` — plus its own
internal files (`floor/index.ts`, `OperationalFloorErrorState.tsx`,
`OperationalFloorToolbar.tsx`, `formatters.ts`, `types.ts`). **No Cashier file imports
`OperationalFloor` today** — this directly confirms gap register row CASH-FR-003
("Cashier not yet verified as `OperationalFloor` consumer") as still fully open, with zero
partial progress.

---

## 3. Legacy redirect readiness

### 3.1 Existing redirect pattern: `apps/web/src/pages/supervisor/orders.tsx`

Supervisor's `/supervisor/orders` legacy route is exactly the kind of "old page → new Floor
page, preserving context" redirect the Cashier `/cashier/queue`→`/cashier/floor` and
`/cashier/receipts`→`/cashier/floor` migrations should reuse. Full implementation:

```tsx
// apps/web/src/pages/supervisor/orders.tsx
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });
export default function SupervisorOrdersPage() {
  return <SupervisorLegacyOrdersRedirect />;
}
```

```tsx
// apps/web/src/components/supervisor/orders/SupervisorLegacyOrdersRedirect.tsx (71 lines, quoted in full)
export function SupervisorLegacyOrdersRedirect() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const orderId = firstLegacyQueryValue(router.query.orderId);
  const suppliedTableId = firstLegacyQueryValue(router.query.tableId);
  const canResolveOrder = Boolean(
    router.isReady && orderId && !suppliedTableId && accessToken && branchId && isAuthenticated && isSupervisor,
  );

  const orderQuery = useQuery({
    queryKey: ["supervisor", "order-detail", branchId, orderId],
    enabled: canResolveOrder,
    queryFn: () => fetchSupervisorOrderDetail(accessToken as string, branchId as string, orderId as string),
    retry: 1,
    staleTime: 8_000,
  });

  useEffect(() => {
    if (orderQuery.error instanceof ApiError && orderQuery.error.isAuthError) clearSession();
  }, [clearSession, orderQuery.error]);

  useEffect(() => {
    if (!router.isReady) return;
    if (orderId && !suppliedTableId && !orderQuery.isError && !orderQuery.isSuccess) return;
    const resolvedTableId = orderQuery.data?.table?.id || orderQuery.data?.tableId || null;
    const query = buildSupervisorFloorContextQuery(router.query, resolvedTableId);
    void router.replace({ pathname: "/supervisor/floor", query });
  }, [orderId, orderQuery.data?.table?.id, orderQuery.data?.tableId, orderQuery.isError,
      orderQuery.isSuccess, router, router.isReady, router.query, suppliedTableId]);

  return (
    <SupervisorSessionGuard>
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <LoadingState title={canResolveOrder ? "Opening order context on Floor" : "Returning to Supervisor Floor"} />
      </main>
    </SupervisorSessionGuard>
  );
}
```

Supporting pure helpers, `apps/web/src/lib/supervisor/legacy-orders-route.ts` (full file, 24 lines):

```ts
export function firstLegacyQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

export function buildSupervisorFloorContextQuery(
  query: LegacySupervisorOrdersQuery,
  resolvedTableId?: string | null,
) {
  const orderId = firstLegacyQueryValue(query.orderId);
  const tableId = firstLegacyQueryValue(query.tableId) || resolvedTableId?.trim() || null;
  const floorQuery: Record<string, string> = {};
  if (tableId) floorQuery.tableId = tableId;
  if (orderId) floorQuery.orderId = orderId;
  return floorQuery;
}
```

**Pattern summary (directly reusable for Cashier verbatim, with `Cashier`-prefixed renames):**
1. Old page → tiny wrapper component rendered inside the *old* page's own session guard.
2. Read legacy query params via a `firstLegacyQueryValue` helper (handles Next's
   `string | string[] | undefined` query shape).
3. If a legacy `orderId` is present and no `tableId` was supplied, do a **bounded, single**
   detail fetch to resolve the order's current table (`enabled` gated on `router.isReady` +
   auth + role, `retry: 1`, short `staleTime`).
4. On auth error, `clearSession()` (does not itself redirect — `SupervisorSessionGuard` inside
   the same tree handles the login redirect).
5. Once ready (either no orderId to resolve, or the resolution query has settled
   success/error), build a minimal `{ tableId?, orderId? }` query object and
   `router.replace({ pathname: "/supervisor/floor", query })` — **`replace`, never `push`**
   (no redirect-loop history entries), and **only known-safe keys are forwarded** (no blind
   spread of the entire legacy query string).
6. Renders a `LoadingState` the whole time — no flash of old-page content.

**Important scope note:** CLAUDE.md §9 references "legacy `/waiter/orders` and
`/supervisor/orders` routes exist only as redirects into Floor" — this audit confirms
`/supervisor/orders` matches that description exactly, but **`apps/web/src/pages/waiter/orders.tsx`
does not exist** (glob for `apps/web/src/pages/waiter/orders*` returned no files). CLAUDE.md's
claim of a Waiter-side redirect is stale/inaccurate against the current worktree — only the
Supervisor redirect exists as a concrete pattern today. The Cashier migration should model
itself on the verified Supervisor implementation, not on the unverified Waiter claim.

### 3.2 Applicability to Cashier's two legacy routes

- **`/cashier/queue` → `/cashier/floor`**: Queue currently carries no URL-param selection
  state at all (§1.6) — there is no `orderId`/`tableId` to preserve from Queue itself. The
  redirect can be simpler than Supervisor's: no order-detail resolution fetch is needed unless
  C1/C2 decide legacy deep links with a manually-appended `?orderId=` should still resolve (not
  currently possible since Queue never emits such a link). Recommend still building the
  `firstLegacyQueryValue`-based forwarding for defense against hand-typed/bookmarked URLs.
- **`/cashier/receipts` → `/cashier/floor?receiptId=...`**: Receipts already emits and consumes
  `receiptId` via `router.query`/`router.replace` (§1.6) — a redirect here should forward
  `receiptId` (and, per `CASHIER_ARCHITECTURE.md`'s stated legacy policy, land on
  `/cashier/floor?receiptId=...` or an equivalent Find-bill lookup state) using the exact same
  `firstLegacyQueryValue` + `router.replace({ pathname, query })` shape as
  `SupervisorLegacyOrdersRedirect`.
- Neither legacy Cashier redirect can reuse `buildSupervisorFloorContextQuery` directly (it's
  Supervisor-specific and table/order-shaped, not receipt-shaped), but a
  `apps/web/src/lib/cashier/legacy-floor-route.ts` mirroring its two pure helpers
  (`firstLegacyQueryValue` re-exported or duplicated + a Cashier-specific
  `buildCashierFloorContextQuery` covering `tableId`/`orderId`/`receiptId`) is the direct,
  low-risk path.

---

## Gap summary

| ID | Description | Current state | Target state | Severity |
| --- | --- | --- | --- | --- |
| CASH-FR-001 | Default route / landing helper | `getCashierLandingPath()` returns `/cashier/queue` (`apps/web/src/lib/auth/role.ts:54-56`); 2 call sites in `login.tsx` (lines 109-117, 157-174) | Returns `/cashier/floor` | High |
| CASH-FR-002 | Visible navigation data | `cashierRoutes` = Queue/Receipts/Till/Me (`apps/web/src/lib/cashier/routes.ts`) | Floor/Till/Me; `CashierBottomNav.tsx` needs zero change (pure reuse of `OperationalBottomNav`) | High |
| CASH-FR-003 | Shared `OperationalFloor` consumption | Zero Cashier files import `OperationalFloor` (grep-confirmed; only Supervisor + Waiter Floor screens do) | Cashier is the third consumer via a new `CashierFloorScreen` | High |
| CASH-FR-004 | Shell duplication risk | `CashierShell.tsx`/`CashierBottomNav.tsx`/`CashierHeader.tsx` are all pure thin adapters over shared `pos-shell` primitives, structurally identical to `SupervisorShell.tsx` | No rework needed — verified as already a thin adapter, downgrade risk | Medium → Verified low-risk |
| CASH-FR-NAV-01 | Bare `/cashier` route | No `pages/cashier/index.tsx` or `pages/cashier.tsx` exists → 404s today (no `getServerSideProps` redirect, unlike `pages/waiter/index.tsx`) | Add `pages/cashier/index.tsx` mirroring `waiter/index.tsx`'s `getServerSideProps` redirect to `/cashier/floor` | High |
| CASH-FR-NAV-02 | Selected-order URL param inconsistency | Queue screen uses plain `useState` (no URL persistence, no Back/Forward/refresh survival); Receipts screen uses `router.query.receiptId` + `router.replace({shallow:true})` (survives refresh) | Standardize the new Floor/settlement workspace on the Receipts pattern for `tableId`/`orderId`/`receiptId` | Critical |
| CASH-FR-NAV-03 | Idle-handler indirection | `CashierIdleLogoutHandler` → `WaiterIdleLogoutHandler` → `OperationalIdleLogoutHandler` (2 layers of pass-through); Supervisor imports `OperationalIdleLogoutHandler` directly with no wrapper | Functionally identical today (no fix required for C1 to proceed), but recommend Cashier import the shared primitive directly, matching Supervisor, to remove the conceptually-backwards Cashier→Waiter dependency | Medium |
| CASH-FR-NAV-04 | Icon-registry violations | 56 files under `apps/web/src/components/cashier/**` import `@phosphor-icons/react` directly, including shell files `CashierSessionGuard.tsx` and `CashierReadinessStrip.tsx`; the 4 page-level files under `pages/cashier/` are clean | Pre-existing, out of scope to bulk-fix in C1; new C1 files (Floor screen, Find bill control) must use the registry correctly from creation, and the registry needs new `cashierFloor`/`cashierFindBill` keys added to `role-icon-config.ts` + `role-icons.ts` | Medium |
| CASH-FR-NAV-05 | Route guard shape | `CashierSessionGuard` is role-only (`isCashier`) + `branchId`-presence, no `pos:*` permission check; structurally identical to `WaiterSessionGuard` | No change needed — reusable as-is for the new Floor route | Verified / no gap |
| CASH-FR-026 | Legacy redirect pattern availability | A concrete, fully-working reference implementation exists at `pages/supervisor/orders.tsx` + `SupervisorLegacyOrdersRedirect.tsx` + `lib/supervisor/legacy-orders-route.ts`; CLAUDE.md's claim of an equivalent `/waiter/orders` redirect is **stale** — no such file exists in the worktree | Build `pages/cashier/queue.tsx` and `pages/cashier/receipts.tsx` legacy-redirect wrappers (or convert the existing files) modeled directly on the verified Supervisor pattern, with a new `lib/cashier/legacy-floor-route.ts` covering `tableId`/`orderId`/`receiptId` | High |
| CASH-FR-028 | Test harness readiness | No `apps/web/e2e/cashier*` directory exists at all (playwright config's `PW_CASHIER_EMAIL`/`PW_CASHIER_PASSWORD` env vars are already wired from the Prompt 3D Supervisor harness reuse, but zero Cashier specs exist) | New shared Floor/settlement Playwright suite, modeled on `e2e/supervisor-prompt3/` | High |

---

## Files referenced in this audit (all read directly, absolute paths)

- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\lib\cashier\routes.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\lib\auth\role.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\login.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\cashier\queue.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\cashier\receipts.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\cashier\till.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\cashier\me.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\waiter\index.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\waiter\floor.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\supervisor\floor.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\pages\supervisor\orders.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\shell\CashierShell.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\shell\CashierBottomNav.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\shell\CashierHeader.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\shell\CashierIdleLogoutHandler.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\shell\CashierSessionGuard.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\shell\CashierReadinessStrip.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\queue\CashierQueueScreen.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\receipts\CashierReceiptsScreen.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\cashier\till\CashierTillScreen.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\supervisor\shell\SupervisorShell.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\supervisor\orders\SupervisorLegacyOrdersRedirect.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\lib\supervisor\legacy-orders-route.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\waiter\shell\WaiterIdleLogoutHandler.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\waiter\shell\WaiterSessionGuard.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\pos-shell\OperationalIdleLogoutHandler.tsx`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\pos-shell\role-navigation.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\pos-shell\types.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\pos-shell\role-icon-config.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\components\pos-shell\role-icons.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\src\lib\cashier\context.ts`
- `C:\Users\arman\Desktop\nimbus-pos\apps\web\playwright.config.ts`
