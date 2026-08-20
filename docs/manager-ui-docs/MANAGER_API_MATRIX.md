# Manager API Matrix

This matrix documents the backend API endpoints exposed to the Manager role (`roleName: 'Manager'`), including required permissions, branch/organization scoping, data sensitivity, and readiness for the Manager MVP.

---

## 2026-08-20 — Header note: owner decisions are LOCKED (matrix not rewritten)

The product owner approved the Manager core + MVP scope on **2026-08-20**. The decision register
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md)
now reads **Approved (owner, 2026-08-20)** on every previously-pending row. Constraints this matrix
is now read under:

- Operations rows are **read-only oversight** in MVP — no cashier-checkout and no
  waiter-order-entry clone may be built on them.
- Staff `contracts` rows stay **Deferred** (compensation / contracts / payroll excluded).
- Reports export/download must render a truthful **generator-unavailable** state; **fake downloads
  are forbidden**.
- Settings printer routes are **metadata-only**; terminal pairing is **stub-only**; alert rules are
  **defer-or-read-only**; sync-conflict diff is **deferred**.
- The branch switcher drives **every** branch-scoped row via `X-Branch-Id`.

**This matrix has deliberately NOT been rewritten.** Rows, permissions, and caveats below are the
2026-07-06 Prompt-0 draft. They are **not yet live-verified against today's backend** — verifying
every row is the explicit job of **M-P0** in
[`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md). Do not treat a
row here as proven until M-P0 marks it so.

### Annotation — the two generic Approvals rows (`GET /api/approvals`, `POST /api/approvals/:id/decide`)

**Owner decision (2026-08-20): domain-specific decision routes are PREFERRED over the generic
`POST /api/approvals/:id/decide`.** The generic route may be used only where the DTO mapping is
provably clear (per §7 of the decision register). This aligns Manager with the **Supervisor
Option B precedent**: Supervisor does **not** hold `approvals:read` / `approvals:decide`, so every
Supervisor decision goes through its canonical domain endpoint
(`/pos/discounts/:id/approve|reject`, `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`,
`/analytics/anomalies/:id/acknowledge|resolve`) — see
[`docs/supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`](../supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md)
and `ai/SUPERVISOR_RECONSTRUCTION_PROMPT5_APPROVALS_FINAL_COMPLETION_REPORT.md`.

**Seed verification requested with this note — result: MANAGER *does* hold both permissions.**
Checked `packages/db/prisma/seed.ts` (`ROLE_PERM_MATRIX`, `Manager:` block starting line 758):

```
// BG2: Unified Approvals Inbox + Global Audit Timeline (Manager: full)
'approvals:read',      // seed.ts:974
'approvals:decide',    // seed.ts:975
'audit:read',
```

For contrast, the `Supervisor:` block (line 1090) contains **neither** string — it carries only the
domain permissions (`pos:discount:approve`, `pos:hr:leave:review`, `pos:hr:shift-swaps:approve`,
`pos:analytics:anomalies:acknowledge`). `Owner:` holds both (seed.ts:735–736). The permissions
themselves are defined at seed.ts:443–444.

**Consequence for the Manager build.** Unlike Supervisor, Manager is *not* blocked from the generic
inbox by permissions — `GET /api/approvals` and `POST /api/approvals/:id/decide` will both return
2xx for a seeded Manager. The preference for domain-specific routes is therefore a **product /
safety decision, not a permission constraint**, and it must be enforced in the frontend. The
underlying risk is unchanged and already registered as **MANAGER-GAP-007**: the generic decide
payload takes source-specific dynamic parameters, so a generic decide form can submit an invalid or
unsafe payload. **Recommended shape:** use `GET /api/approvals` (+ `GET /api/approvals/:id`) for the
**read/count** surface that feeds the Overview approval counts, and route every **write** through
the verified domain endpoint. **Do not remove the `approvals:*` grants from the seed** — that is a
permission change and requires its own explicit authorization.

---

## 2026-08-20 — TRACK B3 RE-VERIFICATION (Operations + Staff, live)

Every endpoint the B3 Operations and Staff surfaces read or write was re-probed live against an
isolated disposable stack (`b3-api-matrix.mjs`, **39/39 checks passed** — 27 reads, 12 mutations).
Where B3's result differs from or sharpens an M-P0 row, **this section is newer**.

| Route | B3 live result |
| --- | --- |
| `GET /pos/orders?page=1&pageSize=25` | 200 · 25 rows · **`total: 298`** — the value the control-panel pager is fed |
| `GET /pos/orders/:id` | 200 · `total = subtotal + tax − discount` verified (`32,000 + 5,800 − 0 = 37,800`) → **`total` is tax-inclusive**, which is what the record's totals block states |
| `GET /pos/orders/:id` with another branch's `X-Branch-Id` | **404** — branch isolation holds on the detail route |
| `GET /tables` | 200 · 22 rows (Tapas) |
| `GET /reservations?scope=active` / `?scope=history` | 200 / 200 · totals 15 / 8 |
| `GET /api/tills` · `GET /api/shifts` | **404 · 404** — MP0-02 re-confirmed, not assumed |
| `GET /hr/employees` (default) | 200 · 40 rows · **`view: "safe"`** · **zero forbidden keys on the wire** — C-02 holds |
| — org scoping | rows span **5 distinct `branchId`s**; `?branchId=` → **400**. MP0-06 / C-09 unchanged |
| — ⚠️ `?view=full` **as Manager** | **200, returning `compensationProfile`, `baseAmount`, `salaryBasis`, `allowances`, `deductions`, `dateOfBirth`, `emergencyContact*`, `address`, `notes`.** **FU-1 is real.** The frontend is the only barrier; B3 asserts `view=full` appears nowhere in `components/manager`, `lib/manager` or `pages/manager` |
| `GET /hr/leave` | 200 · embeds a full nested `employee` carrying `dateOfBirth` / `address` / `emergencyContact*` / `notes`. **This is why B3 projects at the API-client boundary rather than at render** |
| `GET /hr/shift-swaps` | 200 · same nested PII on `requester` and `target` |
| `GET /hr/frontline-staff/:id/quick-pin-status` | 200 · 22 keys · **never returns the PIN**. ⚠️ **New finding B3-F1: resolved by `{id, orgId}` only — org-scoped, NOT branch-guarded** (200 from a second branch). Recommend adding `branchId`, matching the shift-swap approve fix. **Not implemented — backend change** |
| `POST /hr/frontline-staff/onboard` | **201** · returns a plaintext 6-digit PIN once (`shownOnce: true`, MP0-14) · the employee echo is compensation- and PII-free (C-02) |
| `POST /:id/quick-pin/reset` | 200 · a **different** PIN than the one issued at onboarding |
| `PATCH /:id/quick-pin/disable` / `enable` | 200 / 200 · a duplicate disable returns 200 `alreadyDisabled: true` — **idempotent, not an error** |
| `PATCH /hr/leave/:id/review` | 200 · a **second** review → **400**, which is why the UI renders terminal rows read-only |
| `PATCH /hr/shift-swaps/:id/approve {status: REJECTED}` | 200 · **`schedule_assignments`: 3 rows before → 3 rows after.** `GET /workforce/roster` byte-identical. **SUP-RG-036/042 re-confirmed: approving would mutate zero roster rows, so B3 ships reject-only (Outcome C)** |
| `POST /hr/leave` · `POST /hr/shift-swaps` | **403 self-service only** — *"can only create leave for their own linked employee profile"*. **New finding B3-F3**: a manager cannot file leave or a swap on an employee's behalf. Correct as designed; recorded so it is not re-discovered as a missing feature. B3 offers no create control for either |
| `GET /dash/open-orders` | `count: 50` · `limit: 50` · **`total: 107`** · `truncated: true` — the MP0-09 fields are live; `/dash/manager.openOrders` **== 107** |
| `GET /dash/manager` | **`grossSales` 33,014,100 ≥ `netSales` 27,978,300**, and `gross = net + tax`. ⚠️ **This inverts the pre-batch meaning** and is what exposed defect **B3-D1** — the B2 Overview was labelling the ex-tax figure "tax-inclusive". Fixed in B3 |

---

## 2026-08-20 — M-P0 LIVE VERIFICATION (the `Verified` column is authoritative)

**Every one of the 62 rows below was verified on 2026-08-20** by
[`ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md`](../../ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md),
twice: statically against `apps/api/src/modules/**/*.controller.ts` (route registration, HTTP
method, the exact `@Permissions(...)` string, `@RequireBranchContext()`, and the service's actual
`where` clause), and live against an isolated QA stack — API `http://localhost:3001` (prefix
`/api`), disposable local Postgres, manager `manager@nimbus.demo` at branch
`cb27be401a2c35dfc0d4e610`. `POST /api/auth/login` returned **201**.

**The `Verified` column supersedes the `Permission`, `Role-scope notes`, and `Caveats` columns
wherever they disagree.** The rest of the row body is the 2026-07-06 draft and was deliberately
**not rewritten**.

### Verified-status legend

| Value | Meaning |
| --- | --- |
| 🟢 | Route exists; method + permission string match; live 2xx (or a decorator-confirmed mutation); response usable by the planned UI. |
| 🟡 | Route exists and is reachable, but the documented scoping / response / permission is materially wrong, or the data the UI needs is only partially available. |
| 🔴 | Documented route does not exist, or the actual response violates a locked constraint. |
| `200`/`201`/`400`/`403`/`404` | HTTP code observed live on 2026-08-20. |
| `not exercised (mutation)` | Deliberately not executed; route + guard confirmed from the cited controller decorator. |

### Result: 🟢 51 · 🟡 7 · 🔴 4

**🔴 rows — read these before planning any phase:**

1. **`GET /api/tills`** — route does not exist (404). `/tills/active` is *operator-scoped*, not
   branch-scoped. **No branch-wide tills list exists.**
2. **`GET /api/shifts`** — route does not exist (404). `/shifts/active` is *operator-scoped*.
   **No branch-wide shifts list exists.**
3. **`PATCH /api/branches/:id`** — route does not exist (404). **M-P6's branch profile is
   read-only.**
4. ✅ **`GET /api/hr/employees`** — **FIXED 2026-08-20 (backend gap batch 1, C-02).** ~~returns
   `compensationProfile{baseAmount, salaryBasis, allowances, deductions}` on **every** row, plus
   `dateOfBirth`, `address`, and private HR `notes`~~. The default payload is now a safe projection
   whose sensitive columns are never selected from Postgres; `?view=full` restores the historical
   payload and requires `pos:hr:compensation:read`. ⚠️ Still **org-scoped with no branch filter**
   (MP0-06 / C-09 — unchanged), and ⚠️ the Manager token *does* hold `pos:hr:compensation:read`, so
   a deliberate `?view=full` still works for Manager (follow-up FU-1); the default payload the Staff
   directory fetches is compensation- and PII-free for every role.

> **Track B4 (2026-08-20) executed all 24 generators live.** Every one returned **201** with
> `status: COMPLETED` synchronously for a Manager token, confirming MP0-16's uniform DTO
> (`{reportWindow!, dateFrom?, dateTo?, parameters?}`, plus `limit?` on `top-items` alone). Also
> re-confirmed live: `GET /api/reports/catalog` returns a **bare array of 37** tagged
> `IMPLEMENTED` 24 / `CONDITIONAL` 1 / `PENDING_LATER` 12, every entry `formats: ["CSV"]`;
> `POST /api/reports/export` with `format: PDF` → **501**; a legacy PDF artifact's download → **404**
> (*"Export file not found on disk"*); `CUSTOM` without dates → **400**; and `GET /api/reports/:id`
> under **another branch's** `X-Branch-Id` → **200** (MP0-12).
> ⚠️ **New (B4-F2), not previously recorded:** `grossSales` carries **two different tax bases** in the
> same payload — `SUM(order.total)` (tax-inclusive) at summary level, but
> `SUM(orderItem.subtotal)` (**ex-tax**) inside `summary.topItems[]` and `summary.categories[]`.
> ⚠️ **New (B4-F3):** MP0-08's "no rows" is true at the top level, but **16 of 24 summaries embed a
> real breakdown array** which the CSV export is generated from. This does **not** unblock a pivot —
> there is still no per-order row payload — so **C-03 stays open**.
> ⚠️ **New (B4-F4):** `GET /api/reports/exports/:id/download` is org-scoped like `/reports/:id`.
> See [`ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`](../../ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md).

**Two further headline corrections to this matrix's body:**

- **Reports: the 17 generator rows below are a subset — the controller exposes 24.** The seven
  undocumented routes are `open-closed-orders` (`pos:reports:daily-sales:generate`),
  `cash-movements` (`pos:reports:cash-movements:generate`), `reservation-deposits` and
  `reservation-no-shows` (both `pos:reports:reservations:generate`), `event-bookings` and
  `event-checkins` (both `pos:reports:events:generate`), and `high-risk-actors`
  (`pos:reports:anomaly-summary:generate`). **Manager holds all 19 distinct generate permissions.**
  `POST /api/reports/cash-movements` has **no row in this matrix at all** — add it from the
  M-P0 report §8.1 when planning M-P5.
- **`GET /api/approvals` is not fully branch-scoped**, and **`POST /api/reports/export` really is
  gated by a *read* permission**. Both are detailed in their rows.

**Permission cross-check: 61 / 61 matrix permission strings are HELD by the seeded Manager**
(214-permission JWT). **There are no matrix rows whose permission the Manager lacks.** Every MVP
restriction (contracts, compensation, generic approvals decide, payroll) is therefore a
**product/safety constraint the frontend must enforce**, never a permission block — so
`lib/manager/permissions.ts` must be a **surface allow-list**, not a `hasPermission()` check.

---

| Surface | Method | Endpoint | Controller/service source | Permission | Role-scope notes | Data sensitivity | Read/write | MVP use | Caveats | Verified (M-P0, 2026-08-20) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | GET | `/api/dash/manager` | `DashboardsController` | `pos:dash:manager:read` | Branch-scoped | High (aggregate sales) | Read | Yes | Returns summary gross/net sales, order count, and counts for open orders, anomalies, and active shifts/tills. | 🟢 **200** — `dashboards.controller.ts:34-40`, perm matches. Response: `today{grossSales,netSales,orderCount,avgOrderValue}`, `openOrders`, `lowStockCount`, `anomalySummary{openCount,highCount}`, `shiftSummary{activeShifts,activeTills}`, `reservationsTodayCount`, `calculatedAt`. ⚠ **No `pendingApprovals` field** — KPI card 6 needs `/api/approvals`. ⚠ `netSales`=SUM(total, inc-tax) **>** `grossSales`=SUM(subtotal, ex-tax) (`dashboards.service.ts:52-53`) — do not label bare Gross/Net (MP0-10). |
| **Overview** | GET | `/api/dash/today-summary` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | High (sales summary) | Read | Yes | Returns branch-specific today summary numbers. | 🟢 **200** — `:44-50`, perm matches. Adds `taxTotal`, `discountTotal`, `refundsTotal`, `paymentMix{cash,card,momo}`, `closedOrders`, `anomalyOpenCount/HighCount`. ✅ **MP0-10 FIXED 2026-08-20:** `grossSales = SUM(order.total)` (tax-inclusive, discount applied) and `netSales = grossSales − taxTotal`, so **gross ≥ net always** (live: gross 33,014,100 / net 27,978,300 / tax 5,035,800, and gross = net + tax). The ex-tax pre-discount figure formerly published as `grossSales` is retained **additively** as **`subtotalSales`** (28,107,000). Same definition on `/dash/owner`, `/dash/manager`, `/stream/metrics`, `POST /dash/kpi/refresh` and the SHIFT_END/DAILY_SALES report summaries. |
| **Overview** | GET | `/api/dash/payment-mix` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Medium (payment mix) | Read | Yes | Returns breakdown by Cash, Card, and Mobile Money today. | 🟢 **200** — `:55-61`. **CONFIRMED** behind `pos:dash:today-summary:read`, not its own permission. Returns `{cash,card,momo,total,date,calculatedAt}`. |
| **Overview** | GET | `/api/dash/open-orders` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Medium (order listing) | Read | Yes | Lists active orders and their timestamps. | 🟢 **200** — `:66-72`. **CONFIRMED** behind `pos:dash:today-summary:read`. ✅ **MP0-09 FIXED 2026-08-20 (additively):** the response now carries **`total`** (the real open-order count, from the same shared `where` the dashboards count with), **`limit`** (50) and **`truncated`**. Live: `total: 107` == `/dash/manager.openOrders: 107` == `/dash/today-summary.openOrders`. ⚠ `count` **deliberately keeps its old meaning — rows in THIS response (page length, ≤50)** — so the B2 Overview keeps working; **use `total` for any number shown to a user**. Row: `{id,orderNumber,status,serviceType,total,createdAt}`. |
| **Overview** | GET | `/api/dash/low-stock` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Low (stock counts) | Read | Yes | Lists items currently below reorder thresholds. | 🟢 **200** — `:77-83`. **CONFIRMED** behind `pos:dash:today-summary:read`. Row: `{id,name,sku,unit,currentStock,reorderLevel,reorderQty}`. |
| **Overview** | POST | `/api/dash/kpi/refresh` | `DashboardsController` | `pos:dash:kpi:refresh` | Branch-scoped | Medium (cached KPIs) | Write | Yes | Forces recalculation of dashboard metrics. | 🟢 **201** — `:100-107`, perm matches. Executed live (MP0-QA). Returns a full `KpiSnapshot` row. |
| **Overview** | SSE | `/api/stream/metrics` | `StreamController` | None (Requires JWT) | Branch-scoped | Medium (activity stream) | Read | Yes | Event stream emitting live branch metrics every 15 seconds. | 🟢 **200** `text/event-stream` — `StreamController` `:122-148`. **Matrix claim CONFIRMED: no `@Permissions` decorator** (JWT + `BranchContextGuard` + `@RequireBranchContext()` only). **15 s interval verified live** (events 15.008 s apart). Payload is a **subset**: `{grossSales,netSales,openOrders,anomalyOpenCount,orderCount,timestamp}` — no lowStock/shift/reservation fields. Branch is captured at subscribe time → a branch switch requires stream teardown+reopen. No branch header → **400**; no token → **401**. ⚠ **`EventSource` cannot send these headers and no SSE client exists in `apps/web`** — M-P2 needs a fetch+ReadableStream reader (MP0-07). |
| **Operations** | GET | `/api/pos/orders` | `OrdersController` | `pos:orders:read` | Branch-scoped | Medium (orders list) | Read | Yes | Returns all active branch orders. | 🟢 **200** — `orders.controller.ts:51-52`, perm matches, branch-scoped. ⚠ `pageSize` **unbounded** (`list-orders-query.dto.ts:64-68` `@Min(1)`, no `@Max`); `?pageSize=500` returned 303 rows (MP0-11). |
| **Operations** | GET | `/api/pos/orders/:id` | `OrdersController` | `pos:orders:read` | Branch-scoped | Medium (order details) | Read | Yes | Returns order lines, status, and linked payments. | 🟢 **200** — `pos:orders:read`, branch-scoped. Keys: `id,orderNumber,status,serviceType,subtotal,tax,total,discount,items,table,user,anomalyFlags,splitFromOrderId,mergedIntoOrderId,notes,metadata`. |
| **Operations** | GET | `/api/tables` | `FloorController` | `pos:table:read` | Branch-scoped | Low (layout) | Read | Yes | Returns active floor plan tables and layout states. | 🟢 **200** — `floor.controller.ts:79-80`, perm matches. 22 rows (Tapas) / 16 (Rooftop). Row: `{id,label,capacity,status,isActive,floorPlan,floorPlanId,branchId,orgId,metadata}`. Related: `GET /api/floor-plans` (`pos:floor:read`) → 200; **`/api/floor/plans` → 404**. |
| **Operations** | GET | `/api/reservations` | `ReservationsController` | `pos:reservation:read` | Branch-scoped | Low (guest data) | Read | Yes | Lists branch reservations. | 🟢 **200** — `reservations.controller.ts:50-51`, perm matches. `pageSize` **clamped to 100** server-side (verified: `?pageSize=500` → response `pageSize: 100`). |
| **Operations** | GET | `/api/tills` | `TillsController` | `pos:till:read` | Branch-scoped | Medium (till register) | Read | Yes | Lists branch tills and active cashier sessions. | 🔴 **404 — ROUTE ABSENT.** `tills.controller.ts` has only `POST open`, `POST :id/safe-drop`, `POST :id/reconcile`, `GET active`, `GET :id`, `GET :id/summary`. `GET /tills/active` is **operator-scoped** (`tills.service.ts:284-297` filters `operatorUserId: userId`) → returns the caller's own till; live it returned **200 with an empty body** for the Manager. **There is no branch-wide tills list** (MP0-02). Use `/dash/manager.shiftSummary.activeTills` **count only**. |
| **Operations** | GET | `/api/shifts` | `ShiftsController` | `pos:shift:read` | Branch-scoped | Medium (staff shifts) | Read | Yes | Lists active and historical branch shifts. | 🔴 **404 — ROUTE ABSENT.** `shifts.controller.ts` has only `POST open`, `POST :id/close`, `GET active`, `GET :id`, `GET :id/summary`. `GET /shifts/active` is **operator-scoped** (`shifts.service.ts:147-161` filters `openedById: userId`) → live it returned the **Manager's own** shift `SH-TAPAS_DOWNTOWN-020` while `/dash/manager` reported `activeShifts: 2`. **No branch-wide shifts list** (MP0-02). Counts only. |
| **Approvals** | GET | `/api/approvals` | `UnifiedApprovalsController` | `approvals:read` | Branch-scoped | High (pending writes) | Read | Yes | Inbox aggregator listing discounts, refunds, leave, shift-swaps, and transfer reviews. **⚠️ 2026-08-20:** owner prefers domain-specific decision routes (Supervisor Option B precedent). Seed **does** grant Manager `approvals:read` (`packages/db/prisma/seed.ts:974`), so this row is permitted — use it for the **read/count** surface only (Overview approval counts). See the header annotation. | 🟡 **200** — `unified-approvals.controller.ts:32-33`, perm matches; Manager **does** hold `approvals:read` (verified in the live 214-perm JWT). Response `{data,total,page,pageSize,filters,registry}`. ⚠ **NOT fully branch-scoped**: `unified-approvals.service.ts:272-273` applies `branchId` only when `source.branchScoped`. Per `approval-source.types.ts`, `discount`/`refund`/`shift_swap` are branch-scoped; **`leave_request`, `vendor_bill`, `inter_branch_transfer` are ORG-scoped**. Live with X-Branch-Id=Tapas: `total: 16` spanning **5 branches**, including `Main Branch` (not a Manager membership) and 5 FINANCE `vendor_bill` rows. M-P2 must filter by `branchId` and/or `domain`/`sourceType` (MP0-05). |
| **Approvals** | GET | `/api/approvals/:id` | `UnifiedApprovalsController` | `approvals:read` | Branch-scoped | High (action details) | Read | Yes | Returns complete payload and reason of a pending escalation. **⚠️ 2026-08-20:** read-only detail is acceptable under the Option B preference; the **decision** must go to the domain endpoint. See the header annotation. | 🟢 **200** — `:53-54`, perm matches. Returns `{id,sourceType,sourceEntityId,summary{...,actionsAvailable},source{full record}}`. Sufficient for a read-only escalation detail panel. |
| **Approvals** | POST | `/api/approvals/:id/decide` | `UnifiedApprovalsController` | `approvals:decide` | Branch-scoped | High (decision write) | Write | Yes | Executes approval or rejection of the target entity. **⚠️ 2026-08-20 — owner prefers domain-specific decision routes** (`/pos/discounts/:id/approve\|reject`, `/pos/refunds/:id/approve`, `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`) over this generic route; use it **only** where the DTO mapping is provably clear (MANAGER-GAP-007). Seed **does** grant Manager `approvals:decide` (`packages/db/prisma/seed.ts:975`) — unlike Supervisor, which holds neither `approvals:*` string — so this is a **product/safety** constraint the frontend must enforce, not a permission block. See the header annotation. | 🟢 not exercised (mutation) — `:74-76`, `@HttpCode(200)`, perm matches; Manager holds `approvals:decide`. **DTO captured** (`dto/decide-approval.dto.ts`): `{decision: 'APPROVE'\|'REJECT' (required), reason?: string 1-500, managerPin?: string 4-12}` — **uniform across all 6 source types**; there are no source-specific dynamic parameters at the DTO boundary, so **MANAGER-GAP-007's payload risk is narrower than documented**. The Option B preference stands as a product/safety decision. |
| **Approvals** | POST | `/api/pos/discounts/:id/approve` | `DiscountsController` | `pos:discount:approve` | Branch-scoped | High | Write | Yes | Direct domain-specific discount override. | 🟢 not exercised (mutation) — `discounts.controller.ts:56-58`, perm matches. Reject counterpart `POST /pos/discounts/:id/reject` (`:72-74`) shares `pos:discount:approve`. Read side `GET /pos/discounts/pending` (`:88-89`, same perm) → live **200** (`[]`). ⚠ **No branch-wide discount list** beyond `/pending` (SUP-RG-035). |
| **Approvals** | POST | `/api/pos/refunds/:id/approve` | `RefundsController` | `pos:refund:approve` | Branch-scoped | High | Write | Yes | Direct domain-specific refund approval. | 🟢 not exercised (mutation) — `refunds.controller.ts:64-66`, perm matches. ⚠ **No branch-wide refunds list endpoint** — only `GET /pos/refunds/:id` and `GET /pos/orders/:id/refunds`. `GET /api/approvals` is the only branch-wide refund-escalation read. |
| **Approvals** | POST | `/api/pos/orders/:id/post-close-void` | `RefundsController` | `pos:void:postclose` | Branch-scoped | High | Write | Yes | Void a closed order (requires manager approval). | 🟢 not exercised (mutation) — `refunds.controller.ts:94-96`, perm `pos:void:postclose` matches. |
| **Staff** | GET | `/api/hr/employees` | `HrController` | `pos:hr:employees:read` | Branch-scoped | Medium | Read | Yes | Lists employee records. | ✅ **200 — C-02 FIXED 2026-08-20 (backend gap batch 1).** ~~`hr.service.ts:252` unconditionally `include: { position: true, compensationProfile: true }`; all 40 live rows returned `compensationProfile{salaryBasis, baseAmount, currency, allowances, deductions}` plus `email, phone, address, dateOfBirth, emergencyContact*, notes, metadata`.~~ The **default** response is the safe projection — `{id, orgId, branchId, userId, employeeCode, firstName, middleName, lastName, phone, email, hireDate, status, employmentType, positionId, compensationProfileId, createdAt, updatedAt, position}` — and the excluded columns are **not selected from Postgres at all**, so no `include` can leak them by accident. Response gains `view: "safe" | "full"`. `?view=full` returns the historical payload and is gated by the pre-existing `pos:hr:compensation:read` (**403** without it, verified live as supervisor); an unknown `view` value is a **400**. Live as manager: 40 rows, **zero** forbidden keys, payload contains no `baseAmount`. ⚠️ Manager DOES hold `pos:hr:compensation:read`, so a deliberate `?view=full` still works for Manager — narrowing that grant is a seed change and is follow-up **FU-1**. ⚠️ Still **ORG-scoped** — `where = { orgId }` with no branch filter; `?branchId=` → **400** (MP0-06 / C-09, unchanged). ⚠️ `take` still unbounded (C-12, unchanged). |
| **Staff** | POST | `/api/hr/employees` | `HrController` | `pos:hr:employees:create` | Branch-scoped | High (PII) | Write | Yes | Creates staff user record. Comp fields must be omitted from UI. | 🟢 not exercised (mutation) — `hr.controller.ts:32-33`, perm matches. | ✅ **C-02:** the create echo is now the safe projection too — it returns `compensationProfileId` (so the caller can confirm the link) but **not** `compensationProfile`, `dateOfBirth`, `address`, `emergencyContact*`, `notes` or `metadata`.
| **Staff** | PATCH | `/api/hr/employees/:id` | `HrController` | `pos:hr:employees:update` | Branch-scoped | High | Write | Yes | Updates staff profile (excludes compensation fields). | 🟢 not exercised (mutation) — `hr.controller.ts:60-61`, perm matches. ⚠ `GET /api/hr/employees/:id` (`:53-54`, same read perm) additionally returns **`contracts[]`** with `salaryBasis` + `salaryAmount` — M-P4 should avoid the detail route when the list row suffices (MP0-01). | ✅ **C-02:** the update echo is the safe projection. `GET /api/hr/employees/:id` no longer returns `contracts[].salaryAmount`/`salaryBasis` on the default path — the contracts array is kept, projected to `{id, contractNumber, contractStatus, startsAt, endsAt, createdAt, updatedAt}`; `?view=full` restores the old payload under `pos:hr:compensation:read`.
| **Staff** | POST | `/api/hr/frontline-staff/onboard` | `HrController` | `hr:frontline-staff:create` | Branch-scoped | High | Write | Yes | One-call endpoint to onboard frontline staff. | 🟢 not exercised (mutation) — `hr.controller.ts:146-147`, `@HttpCode(201)`, perm matches. **DTO decorator-verified** (`dto/frontline-staff-onboard.dto.ts`): `{email? (@IsEmail), firstName! (≤100), lastName! (≤100), phone! (≤30, /^[0-9+()\-\s]{6,30}$/), roleName! (role NAME string), issueQuickPin? (defaults TRUE for frontline roles), enablePasswordLogin? (default FALSE), temporaryPassword? (8-128, required only when enablePasswordLogin=true), employee!: {employeeCode?, hireDate!, employmentType!, positionId?, contractId?, compensationProfileId?}}`. **MANAGER-GAP-005 CONFIRMED** — `frontline-staff-onboarding.service.ts:273-284,361-366` returns `quickPin: {pin (PLAINTEXT), pinLength, tier}` (MP0-14). ⚠ The nested `employee` accepts **`contractId` and `compensationProfileId`** — the Manager form must never expose or send either (MP0-15). |
| **Staff** | GET | `/api/hr/frontline-staff/:id/quick-pin-status` | `HrController` | `auth:quick-pin:read` | Branch-scoped | Medium | Read | Yes | Retrieves whether an employee has a PIN set and is active. | 🟢 **200** — `hr.controller.ts:163-164`, perm matches. Returns `{employeeId,userId,firstName,lastName,phone,email,orgId,branchId,pinEnabled,pinExists,pinIssuedAt,pinLastResetAt,pinLastUsedAt,pinTier,pinLength,failedPinAttempts,...}` — contact PII must be whitelisted away. |
| **Staff** | POST | `/api/hr/frontline-staff/:id/quick-pin/reset` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Resets frontline employee's quick PIN. | 🟢 not exercised (mutation) — `hr.controller.ts:177-178`, `@HttpCode(200)`, perm matches. DTO `FrontlineQuickPinResetDto = { branchId?: string }`. **Returns a fresh plaintext PIN once** (MP0-14). |
| **Staff** | PATCH | `/api/hr/frontline-staff/:id/quick-pin/disable` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Disables frontline PIN login access. | 🟢 not exercised (mutation) — `hr.controller.ts:193-194`, `@HttpCode(200)`, perm matches. |
| **Staff** | PATCH | `/api/hr/frontline-staff/:id/quick-pin/enable` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Re-enables frontline PIN login access. | 🟢 not exercised (mutation) — `hr.controller.ts:208-209`, `@HttpCode(200)`, perm matches. |
| **Staff** | GET | `/api/hr/attendance` | `AttendanceController` | `pos:hr:attendance:read` | Branch-scoped | Medium | Read | Yes | View branch employee clock-in/out timeline. | 🟢 **200** (`total: 28`) — perm matches. ⚠ Embeds a full nested `employee` object carrying `address, dateOfBirth, phone, email, emergencyContact*, notes, metadata, compensationProfileId` (no salary object). Same allow-list projection applies. |
| **Staff** | GET | `/api/hr/leave` | `AttendanceController` | `pos:hr:leave:read` | Branch-scoped | Medium | Read | Yes | View leave requests. | 🟢 **200** (`total: 4`) — perm matches. `pageSize`/`take` **bounded** `@Max(100)` (`list-leave-query.dto.ts:50`). Embeds nested `employee` (PII, no salary object). |
| **Staff** | PATCH | `/api/hr/leave/:id/review` | `AttendanceController` | `pos:hr:leave:review` | Branch-scoped | High | Write | Yes | Manager leave review (Approve/Reject). | 🟢 not exercised (mutation) — perm matches. Org-scoped by design (leave has a nullable branch). **Make no payroll or roster claim** (Supervisor precedent). |
| **Staff** | GET | `/api/hr/shift-swaps` | `AttendanceController` | `pos:hr:shift-swaps:read` | Branch-scoped | Medium | Read | Yes | View shift swap proposals. | 🟢 **200** (`total: 2`) — `attendance.controller.ts:110-111`, perm matches. `@Max(100)` bounded. Embeds nested `requester`/`target` employee objects (PII, no salary object). |
| **Staff** | PATCH | `/api/hr/shift-swaps/:id/approve` | `AttendanceController` | `pos:hr:shift-swaps:approve` | Branch-scoped | High | Write | Yes | Approve or reject shift swaps. | 🟢 not exercised (mutation) — `attendance.controller.ts:121-122`, perm matches. ⚠ **§8 contradiction #5 RE-CONFIRMED (SUP-RG-036/042 still holds).** `attendance.service.ts:555-623` mutates **only** `ShiftSwapRequest` (status/approvedById/approvedAt/reviewNotes via a concurrency-safe `updateMany`) + one audit row. A repo-wide grep finds **six** `scheduleAssignment` call sites, **all reads** (`attendance.service.ts:439,454`; `staff-insights.service.ts:293`; `workforce.service.ts:425,436,467`) — there is **no** create/update/delete anywhere in the API. **Approving mutates ZERO roster rows.** M-P4 must follow Supervisor **Outcome C**: honest notice, no Approve control implying a roster change. |
| **Staff** | GET | `/api/hr/contracts` | `HrController` | `pos:hr:contracts:read` | Branch-scoped | Critical (Compensation) | Read | Deferred | Returns contract records. Defer from MVP to avoid exposing compensation. | 🟢 **200** — `hr.controller.ts:91-92`, perm matches. **Manager DOES hold `pos:hr:contracts:read`** — the deferral is a product decision, not a permission block (like `approvals:*`). Stays **Deferred**; never fetched. |
| **Staff** | POST | `/api/hr/contracts` | `HrController` | `pos:hr:contracts:create` | Branch-scoped | Critical (Salary/Rates) | Write | Deferred | Create contract records. Defer from MVP. | 🟢 not exercised (mutation) — `hr.controller.ts:77-78`, perm matches; Manager holds `pos:hr:contracts:create`. Stays **Deferred**. |
| **Reports** | GET | `/api/reports` | `ReportsController` | `pos:reports:history:read` | Branch-scoped | Medium | Read | Yes | Lists historical runs of generated reports. | 🟢 **200** — `reports.controller.ts:589-591`, perm matches, branch-scoped. Returns `{data,total,page,pageSize}`; rows carry `exportArtifacts[]`. ⚠ `pageSize` **unbounded** (`list-reports-query.dto.ts` `@Min(1)`, no `@Max`) (MP0-11). |
| **Reports** | GET | `/api/reports/:id` | `ReportsController` | `pos:reports:history:read` | Branch-scoped | Medium (report data) | Read | Yes | Retrieves generated report content payload. | 🟡 **200** — `reports.controller.ts:598-600`, perm matches. ⚠ **The matrix's "content payload" claim is FALSE.** The response carries `rowCount` (e.g. 219) and an aggregate `summary` object and **no rows at all** — no `data`/`rows`/`payload` key. `managerui.md` §8's readable row table is **not buildable from this route** (MP0-08). ⚠ Also **org-scoped only** — `getReportById(ctx.organizationId, id)`, no `branchId`; a Rooftop run was fetched live with X-Branch-Id=Tapas → **200** (MP0-12). |
| **Reports** | POST | `/api/reports/shift-end` | `ReportsController` | `pos:reports:shift-end:generate` | Branch-scoped | Medium | Write | Yes | Generates till/cashier session closeout audits. | 🟢 not exercised (mutation) — `:52-54`, perm matches, **held**. DTO = `{reportWindow!: DAY\|WEEK\|MONTH\|CUSTOM, dateFrom?, dateTo?, parameters?}`. |
| **Reports** | POST | `/api/reports/daily-sales` | `ReportsController` | `pos:reports:daily-sales:generate` | Branch-scoped | High (sales totals) | Write | Yes | Generates aggregate branch revenue breakdown. | 🟢 **201 — EXECUTED LIVE (MP0-QA)** — `:73-75`, perm matches. `{reportWindow:'DAY'}` → `status: COMPLETED` synchronously, `rowCount: 219`, `summary{grossSales,netSales,taxTotal,discountTotal,orderCount,avgOrderValue,refundTotal,refundCount,paymentBreakdown{CARD,CASH,BANK_TRANSFER}}`. Generation is **synchronous** — no polling state to build. |
| **Reports** | POST | `/api/reports/payment-mix` | `ReportsController` | `pos:reports:payment-mix:generate` | Branch-scoped | Medium | Write | Yes | Generates cash/card/momo breakdown. | 🟢 not exercised (mutation) — `:94-96`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/top-items` | `ReportsController` | `pos:reports:top-items:generate` | Branch-scoped | Medium | Write | Yes | Generates menu item popularity report. | 🟢 not exercised (mutation) — `:115-117`, perm matches, held. **The only DTO variant** — adds optional `limit?: number` (`@IsInt @Min(1)`). |
| **Reports** | POST | `/api/reports/sales-by-category` | `ReportsController` | `pos:reports:sales-by-category:generate` | Branch-scoped | Medium | Write | Yes | Generates menu category revenue report. | 🟢 not exercised (mutation) — `:137-139`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/sales-by-hour` | `ReportsController` | `pos:reports:sales-by-hour:generate` | Branch-scoped | Medium | Write | Yes | Generates peak hours revenue report. | 🟢 not exercised (mutation) — `:158-160`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/discounts-summary` | `ReportsController` | `pos:reports:discounts:generate` | Branch-scoped | High (margins) | Write | Yes | Generates totals and list of approved discounts. | 🟢 not exercised (mutation) — `:204-206`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/voids-summary` | `ReportsController` | `pos:reports:voids:generate` | Branch-scoped | High (losses) | Write | Yes | Generates totals and list of order voids. | 🟢 not exercised (mutation) — `:225-227`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/refunds-summary` | `ReportsController` | `pos:reports:refunds:generate` | Branch-scoped | High (margins) | Write | Yes | Generates totals and list of order refunds. | 🟢 not exercised (mutation) — `:246-248`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/cash-variance` | `ReportsController` | `pos:reports:cash-variance:generate` | Branch-scoped | High | Write | Yes | Generates till drop/reconcile discrepancies. | 🟢 not exercised (mutation) — `:271-273`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/stock-variance` | `ReportsController` | `pos:reports:stock-variance:generate` | Branch-scoped | High (shrinkage) | Write | Yes | Generates count variance audits. | 🟢 not exercised (mutation) — `:317-319`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/wastage-summary` | `ReportsController` | `pos:reports:wastage:generate` | Branch-scoped | Medium | Write | Yes | Generates inventory write-off logs. | 🟢 not exercised (mutation) — `:338-340`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/low-stock` | `ReportsController` | `pos:reports:low-stock:generate` | Branch-scoped | Low | Write | Yes | Generates inventory replenishment list. | 🟢 not exercised (mutation) — `:359-361`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/reservation-summary` | `ReportsController` | `pos:reports:reservations:generate` | Branch-scoped | Low | Write | Yes | Generates guest seating/booking summary. | 🟢 not exercised (mutation) — `:384-386`, perm matches, held. Same uniform DTO. ⚠ Two **undocumented siblings** share this permission: `POST /reports/reservation-deposits` (`:405-407`) and `POST /reports/reservation-no-shows` (`:426-428`). |
| **Reports** | POST | `/api/reports/event-summary` | `ReportsController` | `pos:reports:events:generate` | Branch-scoped | Low | Write | Yes | Generates ticket revenue/attendance summary. | 🟢 not exercised (mutation) — `:451-453`, perm matches, held. Same uniform DTO. ⚠ Two **undocumented siblings** share this permission: `POST /reports/event-bookings` (`:472-474`) and `POST /reports/event-checkins` (`:493-495`). |
| **Reports** | POST | `/api/reports/anomaly-summary` | `ReportsController` | `pos:reports:anomaly-summary:generate` | Branch-scoped | High (security) | Write | Yes | Generates high-risk operational incident log. | 🟢 not exercised (mutation) — `:518-520`, perm matches, held. Same uniform DTO. ⚠ One **undocumented sibling** shares this permission: `POST /reports/high-risk-actors` (`:539-541`). |
| **Reports** | POST | `/api/reports/staff-operations` | `ReportsController` | `pos:reports:staff-operations:generate` | Branch-scoped | Medium | Write | Yes | Generates speed-of-service/table performance. | 🟢 not exercised (mutation) — `:564-566`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/export` | `ReportsController` | `pos:reports:exports:read` | Branch-scoped | Medium | Write | Yes | Packages report run payload into an export file. | 🟡 **201 — EXECUTED LIVE (CSV + PDF).** `reports.controller.ts:607-609`. **`pos:reports:exports:read` on a WRITE route CONFIRMED verbatim** — a read permission gating a route that creates an `ExportArtifact` and writes a file. Recorded as a **backend guard defect** (MP0-13); no Manager impact (all export perms held); **not fixed**. DTO `CreateExportDto = {reportRunId!: string, format!: CSV\|PDF}`. ✅ **C-01 / MP0-03 FIXED 2026-08-20** — ~~The PDF is NOT a PDF: `generateTextPdf()` built plain text while the artifact was stamped `application/pdf` at `status: READY`.~~ `format: PDF` now returns **501 Not Implemented** *before* any artifact row is created (no `PENDING`/`FAILED` litter, no file), with a message naming the missing renderer and pointing at CSV; `generateTextPdf` is deleted and all 37 catalog entries advertise `formats: ['CSV']`. The same 501 applies through the BG6 facade `POST /api/exports`. **B4 ships CSV-only by contract, not by UI convention.** No renderer was added (OD-10 open). ⚠️ `ExportArtifact` rows created **before** this change keep their fake `application/pdf` mime type and remain downloadable. ⚠ The CSV is the **summary only** (11 metric rows) despite `rowCount: 219`. Failure modes truthful: unknown run → **404**; non-COMPLETED run → **400**; generator throw → artifact `FAILED` + `failureReason`. ⚠ Lookup is `{id, orgId}` — **no branchId** (MP0-12). |
| **Reports** | GET | `/api/reports/exports/:id/download` | `ReportsController` | `pos:reports:exports:download` | Branch-scoped | Medium | Read | Yes | File download stream for generated reports. | 🟢 **200** — `reports.controller.ts:622-624`, perm matches. CSV: `Content-Type: text/csv`, 254 bytes, well-formed. PDF: **no new PDF artifact can be created since 2026-08-20 (C-01)**; pre-existing rows still stream as `application/pdf` plain text (see the export row). Unknown artifact → **404** `Export artifact not found`. |
| **Reports** | GET | `/api/reports/catalog` | `ReportsController` | `pos:reports:catalog:read` | Branch-scoped | Low | Read | Yes | Retrieves list of printable formats and templates. | 🟢 **200** — `reports.controller.ts:40-42`, perm matches. **37 entries**, each `{key,title,description,status,formats,permission}`. `status` ∈ `IMPLEMENTED` (**24** — exactly the 24 live generator routes), `CONDITIONAL` (1: `MENU_ENGINEERING`), `PENDING_LATER` (12: `CUSTOMER_FEEDBACK, DOCUMENT_EXPORT_PACKS, LABOR_HOURS, PAYROLL_SUMMARY, PROFIT_AND_LOSS, BALANCE_SHEET, CASH_FLOW, AP_AGING, AR_AGING, BUDGET_VS_ACTUAL, FRANCHISE_ROLLUP, SCHEDULED_DIGEST` — all against `pos:reports:history:read`, **no generate route**). **This is the truthful MANAGER-GAP-008 generator-availability source.** ⚠ `PAYROLL_SUMMARY` + the accounting reports are also **out of Manager scope** — exclude by key, not by status. |
| **Settings** | GET | `/api/branches` | `BranchesController` | `tenancy:branch:read` | Organization-scoped | Low | Read | Yes | Lists organization branches. Used for branch context switching. | 🟡 **200** (4 rows) — `tenancy.controller.ts:57-60`. ⚠ **The permission column is wrong**: the route carries **no `@Permissions` decorator at all** — only `@UseGuards(JwtAuthGuard)`. Scoping is `listBranches(user.id)` → membership-filtered. Fields: `{id,organizationId,organization{id,name,slug},name,code,slug,timezone,currencyCode,address,phone,email,status,membershipRole,isDefaultBranch,createdAt,updatedAt}` (MP0-17). M-P1 should prefer `me.memberships` for the switcher (no extra shell request). |
| **Settings** | PATCH | `/api/branches/:id` | `BranchesController` | `tenancy:branch:write` | Branch-scoped | Medium | Write | Yes | Updates branch settings (e.g. name, address). | 🔴 **404 — ROUTE ABSENT.** Live: `Cannot PATCH /api/branches/cb27be...`. `tenancy.controller.ts` exposes `POST orgs`, `GET orgs`, `GET orgs/:orgId`, `POST orgs/:orgId/branches`, `GET branches`, `GET branches/:branchId`, membership routes, `GET me`, `GET branch-test` — **no branch-update route of any method**. **M-P6's branch profile must ship READ-ONLY** (MP0-04). Adding a PATCH is a backend addition — documented, not implemented. |
| **Settings** | GET | `/api/devices` | `DeviceRegistryController` | `devices:read` | Branch-scoped | Low | Read | Yes | Lists registered branch hardware/stubs. | 🟢 **200** — `device-registry.controller.ts:227-228`, perm matches. `{data,total:4,page:1,pageSize:50}`; row `{id,orgId,branchId,type,name,station,activationCode,status,pairedToDeviceId,capabilities,metadata,lastSeenAt,...}`. Rows carry `metadata:{liveHardware:false}` — a truthful signal to surface with the metadata-only copy. |
| **Settings** | POST | `/api/devices/activate` | `DeviceRegistryController` | `devices:write` | Branch-scoped | Medium | Write | Yes | Registers and activates device slots. | 🟢 not exercised (mutation) — `:52-54`, `@HttpCode(200)`, perm matches. |
| **Settings** | POST | `/api/devices/printers/routes` | `DeviceRegistryController` | `devices:routes:write` | Branch-scoped | Medium | Write | Yes | Adds or updates receipt/KDS routing rules. | 🟢 not exercised (mutation) — `:118-120`, perm matches. ⚠ The matrix **omits the read side**: `GET /api/devices/printers/routes` (`:149-150`, `devices:read`) → live **200**, rows `{id,orgId,branchId,printerId,routeType,station,enabled,priority,...}`. M-P6 needs it. |
| **Settings** | POST | `/api/devices/terminals/pair` | `DeviceRegistryController` | `devices:terminals:write` | Branch-scoped | Medium | Write | Yes | Initiates pairing sequence with terminal stub. | 🟢 not exercised (mutation) — `:158-160`, perm matches. Counterpart `PATCH /devices/terminals/:id/unpair` (`:189-191`, same perm). ⚠ `GET /api/devices/terminals` → **404** (no such route; terminals are `type`-filtered devices). Stub-only per the locked decision. |

---

## Addendum (2026-08-20) — Manager-relevant backend endpoints this matrix OMITS

**Author:** Odoo-reference research pass (`ai/ODOO_REFERENCE_RESEARCH.md`, `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md`).
**Why this exists:** the owner's target Manager/Owner experience is a **top-nav module suite** modelled on his Odoo instance (Dashboard · Customers · Vendors · Accounting · Review · Reporting · Configuration). Building that requires read surfaces this matrix never enumerated. Per instruction, **the matrix above is not rewritten** — the omissions are recorded here.

### Method and status

Routes below were found by a **static scan** of `apps/api/src/modules/**/*.controller.ts` (`@Controller` prefix + `@Get/@Post/@Patch/@Put/@Delete` decorators) on 2026-08-20. Unlike the 62 rows above, **none of these were live-probed, permission-checked, or payload-inspected in this pass.**

> 🔴 **Do not treat any row in this addendum as verified.** They are *claimed by code*. An M-P0-style live verification pass is required before any of them is designed against — most urgently the AP/AR/bank-rec/budget block, which is the largest single omission.

### A. Undocumented modules — not mentioned anywhere in this matrix, and marked "⬜ Planned" in `docs/MODULES.md`

`docs/MODULES.md` currently states *"Accounting (COA, GL, AP, AR) — M32–M36 — ⬜ Planned"* and *"Budgets / Forecasts — M37 — ⬜ Planned"*. **The controllers exist and are wired.** That documentation row is stale.

| Module | Controller | Prefix | Routes (verbatim decorators) |
|---|---|---|---|
| `accounts-payable` | `accounts-payable.controller.ts` | `accounting/ap` | `POST/GET suppliers`, `GET suppliers/:id`, `POST/GET bills`, `GET bills/:id`, `POST bills/:id/approve`, `POST/GET payments`, `POST/GET credit-notes`, `GET aging`, `POST/GET recurring-profiles`, `PATCH recurring-profiles/:id`, `POST recurring-profiles/:id/generate-bill`, `POST reminders/generate`, `GET reminders`, `POST reminders/:id/dismiss` |
| `accounts-receivable` | `accounts-receivable.controller.ts` | `accounting/ar` | `POST/GET accounts`, `GET accounts/:id`, `POST/GET invoices`, `GET invoices/:id`, `POST receipts`, `GET aging`, `POST/GET credit-notes` |
| `bank-rec` | `bank-rec.controller.ts` | `accounting` | `GET/POST bank-accounts`, `GET bank-statements`, `GET bank-statements/:id`, `POST bank-statements/import`, `GET reconciliation`, `GET reconciliation/:id`, `POST reconciliation`, `PATCH reconciliation/:id/match`, `PATCH reconciliation/:id/skip`, `POST reconciliation/:id/complete`, `POST manual-bank-entries`, `GET period-close-runs`, `PATCH periods/:id/close`, `PATCH periods/:id/lock` |
| `budget` | `budget.controller.ts` | `finance` (×2), `franchise` | `GET budgets`, `GET budgets/:id`, `POST budgets`, `POST budgets/:id/update-actuals`, `GET procurement-suggestions`, `PATCH procurement-suggestions/:id/review`, `GET/POST demand-calendar`, `GET/PATCH/DELETE demand-calendar/:id`, `GET franchise/forecast` |

### B. Accounting foundation + GL — documented in `docs/` but absent from this matrix

| Controller | Prefix | Routes |
|---|---|---|
| `accounting.controller.ts` | `accounting` | `GET/POST accounts`, `GET/POST cost-centers`, `GET/POST periods`, `PATCH periods/:id/open`, `GET posting-source-maps`, `PATCH posting-source-maps/:id`, `GET/PATCH tax-config` |
| `ledger.controller.ts` | `accounting` | `POST/GET journals`, `GET journals/:id`, `POST journals/:id/reverse`, `POST posting/replay`, `GET posting-runs`, `GET posting-errors`, `GET posting-errors/:id` |

Cross-reference: `docs/ACCOUNTING_FOUNDATION_GUIDE.md` (Manager holds read on accounts/cost-centers/periods/posting-source-maps/tax-config and create on accounts/cost-centers/periods) and `docs/GL_POSTING_ENGINE_GUIDE.md` (Manager holds `journals:read`, `posting-runs:read`, `posting-errors:read`; **not** `journals:create`, `journals:reverse`, `posting:replay`). Those role tables are the guides' claims and were **not re-verified here**.

### C. Settings / administration — omitted read+write surfaces

`settings.controller.ts` uses a bare `@Controller()`, so paths are absolute:

`GET/PATCH /api/settings` · `GET/PUT /api/settings/currency` · `GET/PUT /api/settings/tax-matrix` · `GET/PUT /api/settings/rounding` · `GET/PATCH /api/thresholds` · `GET/PUT /api/settings/platform-access` · `POST /api/settings/exchange-rate` · `GET /api/settings/exchange-rates`

*(Only `thresholds` appears anywhere in the matrix above; the eight settings routes do not.)*

### D. Alerts — the entire module is omitted

`alerts.controller.ts`, bare `@Controller()`:

`GET /api/alerts` · `GET/POST /api/alerts/rules` · `PATCH /api/alerts/rules/:id` · `GET/POST /api/alerts/channels` · `PATCH /api/alerts/channels/:id` · `POST /api/alerts/test` · `GET /api/alerts/deliveries` · `POST /api/alerts/deliveries/:id/retry` · `GET/POST /api/alerts/digests` · `PATCH /api/alerts/digests/:id` · `POST /api/alerts/digests/:id/run` · `GET /api/owner/live`

Note the owner decision locks alert **rules** to defer-or-read-only; the **deliveries**, **channels** and **digests** read surfaces are unaffected by that decision and are needed for a Settings module.

### E. Reliability / sync — omitted

`reliability.controller.ts`, bare `@Controller()`:

`POST /api/sync/replay` · `GET /api/sync/jobs` · `GET /api/sync/jobs/:id` · `POST /api/sync/jobs/:id/retry` · `GET /api/sync/conflicts` · `PATCH /api/sync/conflicts/:id/resolve` · `POST /api/idempotency/inspect`

*(The conflict **diff** is deferred by owner decision; the jobs list and conflict list are not.)*

### F. Audit — omitted

`audit-timeline.controller.ts` → `GET /api/audit/timeline`.

This is the backing endpoint for an Odoo-**chatter**-equivalent surface (see component C6 in `ai/ODOO_REFERENCE_RESEARCH.md`). Manager holds `audit:read` per `packages/db/prisma/seed.ts` as recorded in the header note above.

### G. Analytics — only one route of fourteen is in the matrix

The matrix carries `PATCH /api/analytics/anomalies/:id/acknowledge`. Also present in `analytics.controller.ts` (prefix `analytics`):

`POST/GET anomaly-rules` · `GET anomaly-rules/:id` · `PATCH anomaly-rules/:id` · `GET anomalies` · `GET anomalies/:id` · `PATCH anomalies/:id/resolve` · `GET risk-dashboard` · `GET staff-risk/:userId` · `GET thresholds` · `PATCH thresholds/:id` · `POST anomalies/recalculate`

`GET /api/analytics/anomalies` and `GET /api/analytics/risk-dashboard` are the obvious feeds for a Manager risk surface and are **not listed above**.

### H. HR / workforce / staff — partial coverage

Present in code, absent from the matrix:

- `hr.controller.ts`: `POST/GET /api/hr/positions`, `POST/GET /api/hr/compensation-profiles` — **note both are compensation-adjacent and fall under the locked exclusion; listed for completeness, not for use.**
- `attendance.controller.ts`: `GET/POST /api/hr/attendance/policies`, `PATCH /api/hr/attendance/policies/:id`
- `workforce.controller.ts` (prefix `workforce`): `POST/GET templates`, `POST/GET schedules`, `GET schedules/:id`, `PATCH schedules/:id/publish`, `PATCH schedules/:id/archive`, `GET roster`, `POST/GET coverage-rules`, `GET coverage-gaps`
- `staff-insights.controller.ts` (prefix `staff`): `GET/PATCH weights`, `GET insights`, `GET insights/:employeeId`, `POST insights/generate`, `POST/GET awards`, `POST promotion-suggestions/generate`, `GET promotion-suggestions`, `PATCH promotion-suggestions/:id/decision`

### I. Exports — the generic controller is omitted

`exports.controller.ts` (prefix `exports`): `GET /api/exports/:id`, `GET /api/exports/:id/download`. Distinct from `GET /api/reports/exports/:id/download` which the matrix does carry. **MP0-03 is fixed at the source (C-01, 2026-08-20): this facade delegates to `ReportsService.createExport`, so `format: PDF` returns 501 here too — verified live. Artifacts created before that date keep the fake mime type.**

### J. Franchise / multi-branch rollup — omitted

- `franchise.controller.ts` (prefix `franchise`): `GET overview`, `GET/POST rankings`, `GET budgets`, `POST/GET transfers`, `GET transfers/:id`, `PATCH transfers/:id/status`, `GET procurement-pressure`, `POST/GET digests`, `PATCH digests/:id`
- `franchise-analytics.controller.ts` (prefix `franchise`): `GET consolidated-finance`, `POST consolidated-finance/generate`, `GET financial-comparison`, `GET waste-benchmarks`, `POST waste-benchmarks/generate`, `GET scorecards`, `POST scorecards/generate`, `POST rankings/generate-deep`, `GET drilldown`

Relevant only if the Manager suite ever spans branches; **`GET /api/approvals` org-scoping (MP0-05) is a warning that org-scoped rollups leak across branches**.

### K. Other manager-adjacent controllers not in the matrix

`inventory` (`GET levels`, `POST adjustments`, `POST/GET batches`, `GET items/:id/batches`) · `documents` (`POST upload`, `GET`, `GET/PATCH storage-config`, `GET :id`, `GET :id/download`, `DELETE :id`, `POST :id/link`, `GET :id/links`, `PATCH :id/metadata`) · `feedback` (`POST/GET requests`, `PATCH requests/:id/cancel`, `GET`, `GET nps-summary`, `GET tags`, `GET :id`, `PATCH :id/tag|acknowledge|resolve`) · `receipts` (`GET :id`, `GET :id/history`, `POST :id/reprint`, `POST :id/send`) · `tenancy` (`GET /api/orgs`, `GET /api/orgs/:orgId`, `POST/GET /api/orgs/:orgId/branches/:branchId/memberships`) · `payroll` (14 routes — **excluded by locked owner decision**, listed so nobody re-discovers it as "missing").

### Recommended follow-up

1. Correct `docs/MODULES.md` — the AP/AR/accounting/budgets rows are wrong.
2. Run an **M-P0-style live verification** over sections A and B before any accounting UI design work. That block is ~90 endpoints and is the single largest determinant of the manager suite's true scope.
3. Sections C, D, E, F, G are the Settings/Review-equivalent surfaces a top-nav manager suite needs and should be verified next.
