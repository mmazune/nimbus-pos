# Completion Report — Enterprise UI Track B2: Manager Overview Dashboard

**Date:** 2026-08-20
**Status: B2 COMPLETE / B3 GATED.** Frontend-only. No backend / DTO / Prisma schema / migration /
seed / permission / auth-semantics / branch-isolation / Postman change.

> The roadmap names this file `ai/ENTERPRISE_B2_OVERVIEW_COMPLETION_REPORT.md`; the owner's B2 brief
> asked for `ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`. This file is the canonical B2 record and
> the roadmap has been updated to point at it.

## Context Snapshot

- Current milestone: **Track B2** — Manager Overview dashboard (`ai/ENTERPRISE_UI_ROADMAP.md`).
- Previous completed milestone: **Track B1** — Manager top-nav shell conversion + Manager chrome
  primitives (`ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`).
- Next milestone: **B3** (Operations + Staff list/kanban/form patterns) and **B0** (API verification,
  docs-only, parallel). **Neither is started.**

## Summary

`/manager/overview` stops being the honest "not built yet" foundation screen and becomes a real
branch dashboard: an Odoo-style **3-column grid of eight bordered cards with a coloured left accent
bar**, each with its own actions, KPI rows, and either a mini visualization, a checklist, or —
where nothing honest can be drawn — nothing at all. Every rendered figure resolves through a
**machine-checked registry** that binds it to a verified endpoint field and a drill-in target;
a figure with no registry entry throws rather than renders. The page is **polled, not streamed**,
and says so. Nine bounded, branch-scoped requests back the whole surface, and a failing endpoint
degrades exactly one card, fail-closed, with no number at all rather than a stale or zeroed one.

---

## 1. Design research (required first step)

### Kits studied — patterns only, nothing imported

No kit code was copied, no kit was added as a dependency, and no kit's palette was ported. What was
taken is **layout and composition grammar**, re-expressed in Nimbus tokens and the §1c density system.

| Kit | License / access | Pattern taken |
| --- | --- | --- |
| **Tremor** (tremor.so) | Open source | The **KPI card anatomy** that the Odoo reference only half-states: *label → large metric → secondary ratio line → micro-visualization inside the card* (data bars, spark charts, progress circles at fixed small sizes rather than a stretched chart region). Nimbus's `ManagerCardPrimaryKpi` + `ManagerCardStatList` + a ≤96px mark follow it. Also the "18.5% \| 1.85 of 10GB" **value-with-its-denominator** line, which became low stock's `14.13 kg / 15 kg` + ratio meter. |
| **Preline** (preline.co) | Free tier, MIT core | **Card framing conventions**: `p-4` body padding with a `border-t` divider before a footer region, `divide-*` for grouped stats, and the **top/edge accent variant** (`border-t-4 border-t-primary`) used as a status carrier. Nimbus rotates that accent to the **left edge** to match the Odoo journal card, and the footer divider is what the per-card provenance footnote sits above. Also Preline's `min-h` icon-centred **empty-state** shape. |
| **TailAdmin** (free React build) | **MIT** | Dashboard **flow**: a metric row first, detail/visualization below, list-style detail last — which is why Sales/Orders/Payment mix lead the grid and Coverage/Readiness close it. Its metric-card icon+label+value+change-chip arrangement informed the card header (icon + title + right-aligned action cluster). Its change-chip itself was **rejected** — see §4. |
| **Flowbite Blocks** | Checked; page returned no usable content over WebFetch | Nothing taken. Recorded so the list is honest rather than padded. |

### The "blkit" lookup — result

**"blkit" does not exist as a named kit; the near-match is "Bklit UI" (`bklit.com`,
`github.com/bklit/bklit-ui`)** — an open-source charts/data-visualization component library built on
**shadcn/ui**, MIT-licensed for its chart components (Bklit Studio, the hosted product, is
proprietary). It ships ~17 chart types (area, bar, candlestick, ring, radar, gauge, sankey…) through
a composable API, and is part of the Vercel OSS program.

**Not usable here, for two independent reasons:** Nimbus is not on shadcn/ui or Radix (it has its
own token-driven `components/ui` kit), so adopting it would mean importing a second design system;
and the standing rule for this phase is patterns only, no kit imports. Its *composable primitive*
idea (Grid / XAxis / Tooltip as separate components rather than one monolithic `<Chart>`) is,
however, the shape `ManagerDashboardCharts.tsx` follows.

### Chart library decision — **hand-rolled SVG, recharts NOT added**

The allowance was one MIT charting library if hand-rolling would be materially worse. It would not
be, and the library would have cost more than it returned:

1. **Only three marks are needed** — a composition ring, a four-bucket bar series, and a ratio
   meter. Each is ~20 lines of geometry. There is no axis, no zoom, no brush, no tooltip layer, no
   time scale.
2. **There is no time series to plot.** Nimbus exposes no bucketed series on any dashboard endpoint
   (NG-05), and `/dash/snapshots` — the only candidate — is gated behind `pos:dash:owner:read`,
   which the Manager **does not hold**. The one capability a chart library really buys (fast, correct
   time-series rendering) has no data to render.
3. **Responsive-container remounts.** Recharts' `ResponsiveContainer` re-measures and re-renders on
   every breakpoint change — precisely the responsive double-mount class of regression the
   performance-preservation rules (CLAUDE.md §15) exist to prevent.
4. **SSR.** Pages Router + `getServerSideProps` would force a `dynamic(..., { ssr: false })` wrapper
   per chart, adding a client-only boundary and a loading flash to a surface that already has real
   loading states.
5. **A second theming system.** Recharts is styled by props, not classes, so every token would have
   to be read out of CSS and passed in by hand — the tokens would leave the token layer.

Cost of the decision: no free tooltips/animation, and any future graph/pivot surface (B4) must
re-open this question. `manager-b2-assertions.ts` fails if `recharts`, `chart.js`, `apexcharts`,
`d3`, `victory` or `nivo` ever appears in `apps/web/package.json`, so a future addition is a
deliberate act, not a drift.

---

## 2. Scope checklist vs. roadmap B2

| Roadmap item | Status |
| --- | --- |
| **(a)** 3-column grid of bordered cards with a coloured left accent bar; Odoo card skeleton | ✅ 8 cards, `xl:grid-cols-3` / `md:grid-cols-2` / 1-up |
| **(a)** Counts are drill-in links, amounts are plain data | ✅ `ManagerCardStatList` links the **label**, never the amount |
| **(a)** Mixed-weight actions (one primary, rest outlined secondaries) | ✅ Control panel `Recalculate` is the only filled button; card actions are outlined |
| **(a)** A card may have no chart, or a checklist instead | ✅ Sales/Orders/Coverage have no chart (no honest series); Branch readiness is a checklist |
| **(b)** Every card backed by a verified field | ✅ 26 registry bindings, asserted (§3) |
| **(b)** `/dash/manager.openOrders` for the open count (MP0-09) | ✅ Asserted, and the capped preview is disclosed in card copy |
| **(b)** Never a bare Gross/Net (MP0-10) | ✅ "Sales today (tax-inclusive)" / "Sales excluding tax"; asserted in the script AND live |
| **(b)** Approval counts branch-filtered before display (MP0-05) | ✅ Four **canonical domain endpoints**, each branch-scoped in its own service; the generic `/api/approvals` inbox is never called (asserted live) |
| **(b)** Tills/shifts are counts only (MP0-02) | ✅ Counts from `shiftSummary`, no list, **no drill-in**, and the card says why |
| **(b)** Charts: prove a real series or ship chartless; never synthetic | ✅ No revenue trend (see §4). Payment mix ring and open-order aging are both derived from real returned rows |
| **(b)** Checklist card is honest | ✅ Built from the three already-verified M-P1 chips; adds **zero requests** |
| **(c)** Live data with a truthful degraded state | ✅ Polled at 60 s; "Live stream unavailable — showing the latest fetched data." rendered permanently; **no SSE code exists** (asserted) |
| **(d)** Loading / empty / failure / degraded-stream / no-branch states | ✅ All five |
| **(e)** `POST /dash/kpi/refresh` behind explicit confirmation + in-flight lock | ✅ Shared `ActionConfirmDialog`; the mutation short-circuits while pending; live-proven to POST exactly once |
| **Out of scope:** other menus, approval **decisions**, unbacked KPIs, owner/franchise, graph/pivot, accounting cards | ✅ None built |

---

## 3. KPI → endpoint field → drill-in target

Generated from `MANAGER_KPI_BINDINGS` (`apps/web/src/lib/manager/dashboard-model.ts`). Every entry is
enforced at runtime (`getManagerKpiBinding` throws for an unregistered key) and statically
(`manager-b2-assertions.ts`).

| Card | KPI | Endpoint | Field | Drill-in |
| --- | --- | --- | --- | --- |
| Sales today | Sales today (tax-inclusive) | `GET /api/dash/manager` | `today.netSales` | `/manager/reports` |
| Sales today | Sales excluding tax | `GET /api/dash/manager` | `today.grossSales` | `/manager/reports` |
| Sales today | Tax collected | `GET /api/dash/today-summary` | `taxTotal` | `/manager/reports` |
| Sales today | Discounts given | `GET /api/dash/today-summary` | `discountTotal` | `/manager/reports` |
| Sales today | Refunds | `GET /api/dash/today-summary` | `refundsTotal` | `/manager/reports` |
| Orders today | Orders served or closed today | `GET /api/dash/manager` | `today.orderCount` | `/manager/operations` |
| Orders today | Average order value (tax-inclusive) | `GET /api/dash/manager` | `today.avgOrderValue` | `/manager/reports` |
| Orders today | Closed today | `GET /api/dash/today-summary` | `closedOrders` | `/manager/operations` |
| Payment mix | Cash / Card / Mobile money | `GET /api/dash/payment-mix` | `cash` / `card` / `momo` | `/manager/reports` |
| Payment mix | Payments collected today | `GET /api/dash/payment-mix` | `total` | `/manager/reports` |
| Open orders | Open orders right now | `GET /api/dash/manager` | `openOrders` | `/manager/operations` |
| Open orders | Open-order aging | `GET /api/dash/open-orders` | `orders[].createdAt` | `/manager/operations` |
| Open orders | Oldest open order | `GET /api/dash/open-orders` | `orders[].createdAt` | `/manager/operations` |
| Low stock | Items at or below reorder level | `GET /api/dash/low-stock` | `count` | `/manager/reports` |
| Low stock | Deepest shortfalls | `GET /api/dash/low-stock` | `items[].currentStock` / `items[].reorderLevel` | `/manager/reports` |
| Needs a decision | Items awaiting a decision | the four below | client-side sum | `/manager/operations` |
| Needs a decision | Discount approvals | `GET /api/pos/discounts/pending` | `length` | `/manager/operations` |
| Needs a decision | Leave requests | `GET /api/hr/leave?status=PENDING&take=1` | `total` | `/manager/staff` |
| Needs a decision | Shift swaps | `GET /api/hr/shift-swaps?status=PENDING&take=1` | `total` | `/manager/staff` |
| Needs a decision | Anomalies | `GET /api/analytics/anomalies?status=OPEN&limit=1` | `total` | `/manager/operations` |
| Needs a decision | High or critical severity | `GET /api/dash/manager` | `anomalySummary.highCount` | `/manager/operations` |
| Shift & till coverage | Shifts open now | `GET /api/dash/manager` | `shiftSummary.activeShifts` | **none** — MP0-02, no branch-wide shifts surface exists |
| Shift & till coverage | Tills open now | `GET /api/dash/manager` | `shiftSummary.activeTills` | **none** — MP0-02, no branch-wide tills surface exists |
| Shift & till coverage | Reservations booked today | `GET /api/dash/manager` | `reservationsTodayCount` | `/manager/operations` |
| Branch readiness | Branch / Reports / Devices | `me.memberships` · `GET /api/reports/catalog` · `GET /api/devices` | selected branch · `status` distribution · `total` | `/manager/settings` |

The assertion script proves that **exactly two** bindings may lack a drill-in, that both are the
till/shift ones, and that each records a written reason.

### Privacy at the wire (MP0-01 / NG-02)

The leave and shift-swap list endpoints embed a full nested `employee` object carrying `address`,
`dateOfBirth`, contact details and private HR `notes`. Two mitigations are applied together:

1. **The page is bound to one row** (`take=1` / `limit=1`, the server minimum) so at most a single
   record can cross the wire instead of a default page of 50.
2. **`data` is discarded at the API-client boundary.** `getManagerPendingLeaveCountRequest` and its
   siblings resolve to `{ domain, count }` and nothing else, so no employee field reaches React
   state, the React Query cache, or a devtools dump.

The number is unaffected: `total` is the server's own count for the filtered `where`. Verified live —
`?status=PENDING&take=1` returned `data: [1 row], total: 2`.

---

## 4. What was NOT cloned from the Odoo reference, and why

| Odoo feature | Decision |
| --- | --- |
| **A revenue trend / bucketed bar chart on the money cards** (Sales, Purchases, Bank in screenshot `02`) | **Not built.** Nimbus has no bucketed time series on any dashboard endpoint (NG-05), and `/dash/snapshots` — the only candidate — requires `pos:dash:owner:read`, which the Manager does **not** hold (M-P0 verified 403). Drawing a trend would mean inventing one. The Sales and Orders cards therefore ship chartless, which the reference itself permits (its own Salaries card has no chart). |
| **The per-card kebab (⋮) menu** | **Not built.** Every action Overview can honestly offer is already a visible link; an empty kebab implies record actions that do not exist until B3. |
| **The dark palette** (teal accents, purple primary, `#16181e` canvas) | **Not ported**, per the roadmap's explicit instruction. Odoo's hexes are a layout/hierarchy reference. Nimbus stays navy/silver/graphite. |
| **A "kanban of journals" pager + search + Favorites chip on the dashboard** | **Not built.** Odoo's dashboard is literally a kanban view of journal records, so a pager `1-6/6` is meaningful there. The Nimbus Overview is a fixed set of eight computed cards — there is no record list to page or search, and `ManagerControlPanel` omits those slots rather than showing inert ones (the same rule B1 applied). |
| **Graph and pivot views** (screenshots `13`/`14`) | **Out of scope — B4**, and blocked on NG-06 (report runs return no rows). |
| **TailAdmin-style "+12.4% vs yesterday" change chips** | **Rejected.** There is no prior-period figure on any of these endpoints. A delta would require either a second dated query that does not exist or a client-side memory of the last poll — both fabrications. |

---

## 5. Files

**Added — data layer:**
- `apps/web/src/lib/manager/dashboard-types.ts` — response shapes, re-read from
  `apps/api/src/modules/dashboards/dashboards.service.ts` and confirmed live.
- `apps/web/src/lib/manager/dashboard-model.ts` — pure model: Decimal parsing, money/count/percent
  formatting, payment-mix slices, aging buckets, low-stock ranking, the KPI registry. No React, no
  aliases, so the assertion script executes it directly.
- `apps/web/src/lib/manager/dashboard-api.ts` — the five `/dash/*` reads, the KPI refresh write, and
  the four count-only approval projections.
- `apps/web/src/lib/manager/dashboard-context.ts` — the nine React Query bindings, the polling
  contract, and the narrow nine-key refresh invalidation.

**Added — components:**
- `apps/web/src/components/manager/dashboard/ManagerDashboardCard.tsx` — the card primitive
  (accent bar, title, actions, primary KPI, stat list, checklist, four states).
- `apps/web/src/components/manager/dashboard/ManagerDashboardCharts.tsx` — donut, bar series, ratio
  meter. Hand-rolled SVG, tokens only, `role="img"` + `<title>` + `<desc>` on every mark.
- `apps/web/src/components/manager/dashboard/ManagerOverviewDashboard.tsx` — grid, provenance strip,
  refresh confirmation, no-branch state.
- `apps/web/src/components/manager/dashboard/cards/*.tsx` — the eight cards.
- `apps/web/src/components/manager/dashboard/index.ts`

**Added — validation:**
- `apps/web/scripts/manager-b2-assertions.ts` (+ `tsconfig.manager-b2-assertions.json`) — ~90 checks.
- `apps/web/e2e/manager-dashboard/` — `fixtures.ts`, `dashboard-cards.spec.ts`,
  `branch-scope-and-refresh.spec.ts`, `states-and-performance.spec.ts`, `capture-evidence.spec.ts`.

**Changed:**
- `apps/web/src/pages/manager/overview.tsx` — renders the dashboard instead of the foundation screen.
- `apps/web/src/lib/manager/branch-context.ts` — exposes the branch's `currencyCode`; the switch
  invalidation gained `refetchType: "none"` (see §7).
- `apps/web/src/lib/manager/permissions.ts` — `liveFrom` re-tagged from the superseded M-P* numbering
  to the canonical Track B phases; Overview is now `"live"`.
- `apps/web/src/styles/globals.css` + `tailwind.config.ts` — the `chart-series-1…4` + `chart-track`
  token ramp.
- `apps/web/src/components/pos-shell/role-icon-config.ts` + `role-icons.ts` — two canonical names
  added (`revenue` → `Coins`, `inventory` → `Package`).
- `apps/web/scripts/manager-p1-assertions.ts`, `apps/web/e2e/manager-shell/navigation-and-landing.spec.ts`
  — updated for the two intended B2 changes (see §7).

---

## 6. Validation — executed, with real numbers

**Static:**

```
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck    → pass
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint         → pass (0 warnings, 0 errors)
corepack pnpm@8.15.0 --filter @nimbus-pos/web build        → pass (/manager/overview 12.3 kB, 143 kB first load)
npx tsc -p apps/web/scripts/tsconfig.manager-b2-assertions.json --noEmit → pass
```

**Assertion scripts — 14/14 pass**, including the new one:

```
manager-b2-assertions   PASS  → "26 KPI bindings, 8 cards, 9 bounded queries, 0 SSE clients."
manager-b1-assertions   PASS      shell-assertions        PASS      floor-assertions      PASS
manager-p1-assertions   PASS      profile-assertions      PASS      cashier-c1/c2/c3      PASS
prompt3a / 3b1 / 3b2 / 3b3a / 3b3b                                                        PASS
```

**Playwright — executed live on an isolated stack.** Disposable local Docker `postgres:16` on
`:55434` (DB `nimbus_b2_qa`) → `prisma migrate deploy` + `db:seed` + `db:demo:import --write`
(1198 orders / 750 payments / 40 employees); API on `:4001` from `dist/main.js`; web built with
`NEXT_PUBLIC_API_BASE_URL=http://localhost:4001` and served on `:3100`.
`GET /api/health` → `{"status":"ok","db":"ok"}` before and after the run. **Shared Neon was never
pointed at, read, or written.**

| Suite | Result |
| --- | --- |
| `e2e/manager-dashboard/` (21 tests × 4 viewport projects) | **84 passed / 0 failed** |
| `e2e/manager-shell/` (B1 regression) | **125 passed / 11 skipped / 0 failed** (the 11 are B1's documented OD-4 desktop-only skips) |
| `e2e/supervisor-prompt3/` (cross-role) | **64 / 64 passed** |
| `e2e/cashier-floor/{role-boundaries,navigation-and-default-route,cross-role-c2-regression,till-and-me-regression}` | **48 / 48 passed** |

**Measured request budget (live, not estimated).** One clean navigation to `/manager/overview`
issues **12** requests total: `1 × /api/auth/me` + `2` shell readiness reads (`/reports/catalog`,
`/devices`) + **9** dashboard reads. `/api/auth/me` is fetched exactly once — the hardening rule
holds. The spec fails the build if the dashboard set exceeds 12 or drops below 9.

**Live data proof (isolated stack, Tapas Downtown):**

- `/dash/manager` → `netSales "33014100"`, `grossSales "28107000"` — **the MP0-10 inversion
  reproduced live**, which is exactly why neither label is bare.
- `/dash/manager.openOrders` = **107** while `/dash/open-orders.count` = **50** — **MP0-09
  reproduced live**; the card takes the 107 and labels the aging as a 50-row preview.
- Branch switch to Rooftop Bar re-scoped every card (sales `27,685,200`, low stock `2` items with
  different names, approvals `5`), with every captured request carrying the new `X-Branch-Id`.
- `POST /api/dash/kpi/refresh` fired **exactly once** per confirmation, and **zero times** on cancel.

**Screenshots — captured AND viewed** (`apps/web/e2e/.evidence/b2-screenshots/`, git-ignored):

1. `01-dashboard-1440x900.png` — full dashboard, all eight cards with live data.
2. `02-dashboard-1280x680.png` — same at the density floor; no horizontal scroll, cards reflow to
   3-up with the whole grid still readable.
3. `03-dashboard-branch-switched-1440x900.png` — Rooftop Bar; every figure differs from Tapas.
4. `04-dashboard-card-error-1440x900.png` — forced 500 on `/dash/low-stock` and `/hr/leave`: the
   low-stock card shows the fail-closed error with **no figure**, the approvals card shows
   "Leave requests — Unavailable" and "Across 3 of 4 queues that could be read", and the six
   healthy cards are untouched.
5. `05-recalculate-confirmation-1440x900.png` — the confirmation dialog.

**Zero console errors** across every dashboard spec and every capture (`console`/`pageerror`
listeners asserted empty, not eyeballed).

**Isolation hygiene:** both `.env` files were backed up before the swap and restored **byte-for-byte**
after (SHA-256 verified identical); the container was removed; `git diff --check` is clean.

---

## 7. Decisions / deviations

1. **`refetchType: "none"` on the branch-switch invalidation — a real defect found by this phase's
   own e2e.** M-P1's `selectBranch` called `invalidateQueries({ queryKey: ["manager"] })` inside the
   state updater, i.e. while the observers still held the **outgoing** branch's keys. React Query
   therefore refetched them — **measured live as 9 wasted requests against the branch the manager had
   just left**, before the new keys mounted and fetched again. With two M-P1 queries it cost 2
   requests and went unnoticed; with B2 it became a switch-time request storm. Marking the namespace
   stale without refetching preserves the intent exactly (nothing cached survives a switch
   unchallenged) and costs nothing: every Manager key carries its `branchId`, so the new branch
   fetches on mount and a return visit refetches because its entry is already stale. Locked in by a
   new `manager-p1-assertions.ts` check.
2. **`liveFrom` re-tagged to Track B phases.** The foundation badges said "Live data arrives in
   M-P3/M-P4/M-P5/M-P6" — numbering the roadmap superseded. They now read B3/B3/B4/B6, matching the
   phase labels the B1 top-nav tree already shows, and Overview reads `"live"`. One `manager-shell`
   spec asserted the old string and was updated with a comment stating why.
3. **`manager-p1-assertions.ts` updated, not weakened.** Its "every non-Me surface renders the
   foundation screen" loop now excludes Overview and asserts instead that Overview renders the
   dashboard — plus a new assertion that the other four surfaces *still* render the foundation
   screen. Same precedent B1 set when it updated the shell-composition assertions.
4. **Two icon-registry names added** (`revenue` → Phosphor `Coins`, `inventory` → `Package`). Added
   in `role-icon-config.ts` + `role-icons.ts`, which docs/UI_SYSTEM.md §4 makes the only place a
   glyph may be chosen. No component imports Phosphor directly (asserted).
5. **New chart-series tokens rather than reusing role accents.** Role tokens are role-semantic;
   using `--color-role-supervisor` as a chart series would overload it. The new
   `--color-chart-series-1…4` ramp is brand-monochrome (navy → silver), so series separate by
   **lightness** as well as hue, and every series still carries its own text label and value.
6. **Anomalies are counted at `status=OPEN` only**, and the row says "Anomalies", not "anomalies
   needing action". `ACKNOWLEDGED` rows are decided-but-unresolved; folding them into an "open"
   number would overstate it, and a second request for a number Overview cannot act on is not worth
   the round trip. The full lifecycle belongs to the surface that owns the decision.
7. **The money formatter is reused, not forked.** `formatManagerMoney` wraps the shared
   `formatWaiterMoney` (the formatter the locked decision names) with Decimal-string parsing, rather
   than becoming a fourth per-role money formatter.
8. **The refresh button is labelled "Recalculate", not "Refresh".** `POST /dash/kpi/refresh` is a
   real write — it persists a `KpiSnapshot` row and an audit event — so the label names what happens,
   and the dialog states plainly that it changes no order, payment, stock or staff record.

---

## 8. Known issues / deferred

- **No live stream.** Gated on **C-04 (NG-14)**: `/api/stream/metrics` needs `Authorization` +
  `X-Branch-Id`, `EventSource` can send neither, and `apps/web` has no SSE reader. B2 ships polled at
  60 s and states it on screen. When C-04 lands, the provenance strip is the single place to change.
- **No revenue trend.** Blocked at the permission boundary (`pos:dash:owner:read` not held) as well
  as the data boundary (no bucketed series). If the owner wants a trend, the cheapest route is a
  Track C item exposing `/dash/snapshots` (or a bounded series) under a permission the Manager holds.
- **Open-order aging covers the 50 oldest rows**, not the branch, whenever more than 50 are open.
  Disclosed in card copy. A real fix is a backend `groupBy` or a raised/paged cap — Track C.
- **Payment mix cannot split MTN from Airtel.** `MOMO` is one backend enum value. Card copy says so.
- **`ManagerSearchFilterMenu` and `ManagerBreadcrumbs` remain unmounted** — Overview has no record
  list to search or page. First consumer is still B3, unchanged from B1.
- **The dashboard makes no approval decision** by design; the counts link into the owning surface,
  which is itself still a B3 foundation screen.

## 9. Next step

**B3** (Operations + Staff list/kanban/form patterns) and **B0** (API verification, docs-only, may
run in parallel) are the roadmap-designated next prompts. **Neither may start without an explicit
owner go for that specific prompt.** Cashier **C4** remains independently gated.
