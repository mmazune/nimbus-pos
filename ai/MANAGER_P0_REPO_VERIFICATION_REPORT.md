# Manager Reconstruction — Prompt M-P0 Repo, API, and Permission Verification Report

**Canonical M-P0 completion record.** M-P0 (documentation and verification only — no runtime,
backend, schema, migration, seed, permission, or Postman change) executed **2026-08-20** against
the authoritative dirty local worktree and a **live isolated QA stack**.

Format follows [`ai/CASHIER_FLOOR_RECONSTRUCTION_C0_REPO_VERIFICATION_REPORT.md`](CASHIER_FLOOR_RECONSTRUCTION_C0_REPO_VERIFICATION_REPORT.md).

---

## 1. Scope and method

Every row of [`docs/manager-ui-docs/MANAGER_API_MATRIX.md`](../docs/manager-ui-docs/MANAGER_API_MATRIX.md)
(**62 rows**) was verified twice:

1. **Static** — against `apps/api/src/modules/**/*.controller.ts`: route registration, HTTP method,
   the exact `@Permissions(...)` string on the guard, `@RequireBranchContext()`, and the service's
   actual `where` clause (org vs branch scoping).
2. **Live** — against the running QA API `http://localhost:3001` (prefix `/api`) with the seeded
   demo Manager, recording the observed HTTP code and the actual response field set.

`GET /api/health` → `{"status":"ok","db":"ok"}` before and after the pass.

### Verified-status legend

| Value | Meaning |
| --- | --- |
| `200` / `201` / `400` / `401` / `403` / `404` | HTTP code observed live 2026-08-20 on the isolated stack. |
| `not exercised (mutation)` | Deliberately not executed; route + guard confirmed from the cited controller decorator. |
| `ROUTE ABSENT` | The documented route does not exist in the API. Verified live (404) **and** by controller inspection. |

### Live session facts

- `POST /api/auth/login` (`manager@nimbus.demo` / `Demo1234!`) → **201**, returns
  `{accessToken, refreshToken, user, session}`.
- JWT subject `c6058bbe0d4c5e60545be4e9`, role `Manager` (`level: L4`, `jobRole: MANAGER`),
  **214 permissions** in the token claim.
- Every protected call carried `Authorization: Bearer <token>` + `X-Branch-Id`.
- Writes executed: **exactly three** — `POST /api/reports/daily-sales` (tagged `MP0-QA`),
  `POST /api/reports/export` (×2, CSV + PDF), and `POST /api/dash/kpi/refresh`. All on the
  disposable QA Postgres. No other mutation was executed.

---

## 2. Verification counts

| Verdict | Count | Meaning |
| --- | --- | --- |
| 🟢 **GREEN** | **51** | Route exists, method + permission string match the matrix, live 2xx (or decorator-confirmed mutation), response usable by the planned UI. |
| 🟡 **AMBER** | **7** | Route exists and is reachable, but the matrix's scoping / response / permission description is materially wrong, or the data the UI needs is only partially available. |
| 🔴 **RED** | **4** | Documented route does not exist, or a locked constraint is violated by the actual response. |

**RED rows:** `GET /api/tills`, `GET /api/shifts`, `PATCH /api/branches/:id`,
`GET /api/hr/employees` (compensation leak — see §6).

---

## 3. Dashboards — GREEN (with two labelling cautions)

Source: `apps/api/src/modules/dashboards/dashboards.controller.ts` (`@Controller('dash')`,
class-level `@UseGuards(JwtAuthGuard)`; every route additionally
`@UseGuards(PermissionGuard, BranchContextGuard)` + `@RequireBranchContext()`).

| Route | Line | `@Permissions` | Matrix claim | Live |
| --- | --- | --- | --- | --- |
| `GET /api/dash/manager` | 34–40 | `pos:dash:manager:read` | matches | **200** |
| `GET /api/dash/today-summary` | 44–50 | `pos:dash:today-summary:read` | matches | **200** |
| `GET /api/dash/payment-mix` | 55–61 | `pos:dash:today-summary:read` | matches | **200** |
| `GET /api/dash/open-orders` | 66–72 | `pos:dash:today-summary:read` | matches | **200** |
| `GET /api/dash/low-stock` | 77–83 | `pos:dash:today-summary:read` | matches | **200** |
| `POST /api/dash/kpi/refresh` | 100–107 | `pos:dash:kpi:refresh` | matches | **201** |

**Confirmed:** `payment-mix`, `open-orders`, and `low-stock` do all sit behind
`pos:dash:today-summary:read`, not their own permission. The matrix is correct.

Not in the matrix but present on the same controller: `GET /dash/owner` and `GET /dash/snapshots`
(both `pos:dash:owner:read`). Manager does **not** hold `pos:dash:owner:read` —
`GET /api/dash/snapshots` → **403** live. Correct and desirable; do not surface either route.

### Actual `/dash/manager` response (verified live)

```json
{ "today": { "grossSales": "28107000", "netSales": "33014100", "orderCount": 219,
             "avgOrderValue": "150749.315068493151" },
  "openOrders": 112, "lowStockCount": 4,
  "anomalySummary": { "openCount": 2, "highCount": 1 },
  "shiftSummary": { "activeShifts": 2, "activeTills": 1 },
  "reservationsTodayCount": 0, "calculatedAt": "2026-08-20T03:03:23.086Z" }
```

### `managerui.md` §5 — the 8 Overview KPI cards, proven against reality

| # | KPI card | Verified source | Status |
| --- | --- | --- | --- |
| 1 | Gross sales | `/dash/manager` → `today.grossSales` | 🟢 |
| 2 | Net sales | `/dash/manager` → `today.netSales` | 🟢 ⚠ see caution A |
| 3 | Open orders | `/dash/manager` → `openOrders` | 🟢 |
| 4 | Active tills | `/dash/manager` → `shiftSummary.activeTills` | 🟢 (count only — no list endpoint, §5) |
| 5 | Active shifts | `/dash/manager` → `shiftSummary.activeShifts` | 🟢 (count only — no list endpoint, §5) |
| 6 | Pending approvals | **Not on `/dash/manager`.** Only `GET /api/approvals?status=PENDING` → `.total` | 🟡 second query + org-scope caveat (§4) |
| 7 | Low stock | `/dash/manager` → `lowStockCount` | 🟢 |
| 8 | Anomalies | `/dash/manager` → `anomalySummary.openCount` / `.highCount` | 🟢 |

All 8 cards are buildable. Card 6 is the only one requiring a second request, and it carries the
org-scope caveat in §4.

**Caution A — `netSales` > `grossSales`.** `dashboards.service.ts:52-53` defines
`grossSales = SUM(order.subtotal)` and `netSales = SUM(order.total)`. Because `total` includes tax,
`netSales` (33,014,100) is **larger** than `grossSales` (28,107,000). This is the opposite of the
ordinary hospitality meaning. **M-P2 must not label these "Gross" and "Net" without qualification** —
recommended copy: "Subtotal (ex-tax)" and "Total (inc-tax)", or a tooltip stating the definition.
Backend rename is a backend change and is therefore **documented, not implemented**.

**Caution B — `/dash/open-orders` is truncated at 50 and `count` lies.**
`dashboards.service.ts:402` hard-codes `take: 50` and `:405` returns `{ count: orders.length, orders }`.
Live: `/dash/open-orders` → `count: 50` while `/dash/manager` → `openOrders: 112`. The `count` field
is the **page length, not the total**. M-P2's open-orders snapshot must render the `/dash/manager`
`openOrders` total for the number and treat `/dash/open-orders` as a capped preview list, or the
dashboard will contradict itself on screen.

---

## 4. SSE `/api/stream/metrics` — GREEN, with a browser-transport blocker for M-P2

`StreamController` (`@Controller('stream')`, same file, lines 122–148):

```ts
@Controller('stream')
@UseGuards(JwtAuthGuard)
export class StreamController {
  @Sse('metrics')
  @UseGuards(BranchContextGuard)
  @RequireBranchContext()
  metricsStream(...)
}
```

- **Matrix claim "None (Requires JWT)" is CONFIRMED** — there is no `@Permissions(...)` decorator
  on this route. Access is JWT + branch membership only.
- **Branch scoping mechanism CONFIRMED:** `BranchContextGuard` + `@RequireBranchContext()` resolve
  `req.branchContext` from the `X-Branch-Id` header; `orgId`/`branchId` are captured once at
  subscription time and closed over for the stream's life. **A branch switch therefore requires
  tearing down and re-opening the stream** — it will not re-scope itself.
- **15-second interval CONFIRMED live.** Two events captured 15.008 s apart:

```
id: 1
data: {"grossSales":"28107000","netSales":"33014100","openOrders":112,"anomalyOpenCount":2,"orderCount":219,"timestamp":"2026-08-20T03:04:14.660Z"}

id: 2
data: {"grossSales":"28107000","netSales":"33014100","openOrders":112,"anomalyOpenCount":2,"orderCount":219,"timestamp":"2026-08-20T03:04:29.668Z"}
```

- Response headers: `Content-Type: text/event-stream`, `Connection: keep-alive`,
  `X-Accel-Buffering: no`, `Transfer-Encoding: chunked`, `Cache-Control: no-store`. **HTTP 200.**
- **Payload is a strict subset of `/dash/manager`** — `grossSales`, `netSales`, `openOrders`,
  `anomalyOpenCount`, `orderCount`, `timestamp`. It carries **no** `lowStockCount`, no
  `shiftSummary`, no `reservationsTodayCount`. M-P2 must only live-update the five fields the
  stream actually emits and leave the rest on their fetched values.
- **Unavailability modes verified live:** no `X-Branch-Id` → **400** `X-Branch-Id header is
  required`; no token → **401**. Both are clean JSON errors, so MANAGER-GAP-015's truthful degraded
  state is implementable.

### 🟡 M-P2 blocker — EventSource cannot carry the required headers

The route needs **both** `Authorization: Bearer` and `X-Branch-Id`. The browser `EventSource` API
supports neither custom headers nor a request body. Grep of `apps/web/src` for
`EventSource|text/event-stream|stream/metrics` returns **zero hits** — there is no existing SSE
client in the web app to copy.

**M-P2 must implement a fetch + `ReadableStream` SSE reader** (`fetch()` with the headers, then
`response.body.getReader()` and manual `\n\n` frame parsing), with abort-on-unmount and
abort-on-branch-change. Budget for this; it is new infrastructure, not a wiring task.

---

## 5. Operations reads — 2 RED, rest GREEN

| Matrix row | Reality | Verdict |
| --- | --- | --- |
| `GET /api/pos/orders` — `pos:orders:read` | `orders.controller.ts:51-52` — matches. Live **200**. | 🟢 |
| `GET /api/pos/orders/:id` — `pos:orders:read` | matches. Live **200**. | 🟢 |
| `GET /api/tables` — `pos:table:read` | `floor.controller.ts:79-80` — matches. Live **200**, 22 rows (Tapas). | 🟢 |
| `GET /api/reservations` — `pos:reservation:read` | `reservations.controller.ts:50-51` — matches. Live **200**. | 🟢 |
| **`GET /api/tills`** — `pos:till:read` | **ROUTE ABSENT.** Live **404**. | 🔴 |
| **`GET /api/shifts`** — `pos:shift:read` | **ROUTE ABSENT.** Live **404**. | 🔴 |

### 🔴 There is no branch-wide tills list and no branch-wide shifts list

`tills.controller.ts` (`@Controller('tills')`) exposes only: `POST open`, `POST :id/safe-drop`,
`POST :id/reconcile`, `GET active`, `GET :id`, `GET :id/summary`.
`shifts.controller.ts` (`@Controller('shifts')`) exposes only: `POST open`, `POST :id/close`,
`GET active`, `GET :id`, `GET :id/summary`.

Worse, the two `active` routes are **operator-scoped, not branch-scoped**:

```ts
// tills.service.ts:284-297
findFirst({ where: { branchId: ctx.branchId, operatorUserId: userId, status: OPEN } })
// shifts.service.ts:147-161
findFirst({ where: { branchId: ctx.branchId, openedById: userId, status: OPEN } })
```

They return **the calling user's own** single till/shift, not the branch's. Verified live:
`GET /api/tills/active` → **200** with an **empty body** (the Manager operates no till);
`GET /api/shifts/active` → **200** returning exactly one object — shift `SH-TAPAS_DOWNTOWN-020`,
whose `openedById` is the Manager's own user id — while `/dash/manager` reports
`activeShifts: 2, activeTills: 1` for the same branch.

**Impact.** `managerui.md` §6's **"tills table"** and **"active shifts table"**, and the
`MANAGER_NAV_AND_PAGE_MAP.md` §3 readiness chips **"tills status"** and **"shifts status"**, have
**no data source**. Only the two integer counts on `/dash/manager` exist.

**M-P3/M-P1 resolution (recommended, no backend change):** render tills and shifts as **counts
only**, with an honest note that a per-till / per-shift branch roster is not exposed by the API.
Do **not** present the Manager's own single shift as "the branch's active shifts" — that is a fake
state. A branch-wide `GET /tills?branchId` / `GET /shifts?branchId` is a **backend addition** and is
recorded here as a gap, **not implemented**.

### Floor plans

`GET /api/floor/plans` → **404**. The real route is `GET /api/floor-plans`
(`floor.controller.ts:36-37`, `pos:floor:read`) → live **200**. Manager holds `pos:floor:read`.
Also present: `GET /floor-plans/:id`, `GET /tables/:id`, `GET /floor/availability`.

### Pagination bounds

| Endpoint | DTO bound | Live probe | Verdict |
| --- | --- | --- | --- |
| `GET /pos/orders` | `list-orders-query.dto.ts:64-68` — `@Min(1)`, **no `@Max`**, no service clamp | `?pageSize=500` → 200, `pageSize: 500`, **303 rows** | 🟡 **unbounded** |
| `GET /reports` | `list-reports-query.dto.ts` — `@Min(1)`, **no `@Max`** | `?pageSize=500` → 200, `pageSize: 500` | 🟡 **unbounded** |
| `GET /hr/employees` | `list-employees-query.dto.ts` — `take` is `@IsNumberString()` only, **no `@Max`** | `?take=500` → 200, `take: 500` | 🟡 **unbounded** |
| `GET /reservations` | clamped | `?pageSize=500` → 200, response `pageSize: **100**` | 🟢 clamped |
| `GET /hr/leave`, `GET /hr/shift-swaps` | `@Max(100)` in `list-leave-query.dto.ts:50` / `list-shift-swaps-query.dto.ts` | — | 🟢 |
| `GET /approvals` | `total` / `page` / `pageSize` in response, default 20 | — | 🟢 |

M-P3/M-P4/M-P5 must send an explicit bounded `pageSize`/`take` on orders, reports, and employees.
Adding `@Max` is a backend change — **documented, not implemented**.

---

## 6. Approvals — GREEN on access, AMBER on scoping

### Manager holds both generic permissions — CONFIRMED LIVE

The seed finding is re-confirmed at two levels. `packages/db/prisma/seed.ts` Manager block:
`approvals:read` (line 974) and `approvals:decide` (line 975) — verified by reading lines 970–976.
And live: both strings are present in the Manager's 214-permission JWT claim, and
`GET /api/approvals` → **200**.

| Route | Controller | Permission | Live |
| --- | --- | --- | --- |
| `GET /api/approvals` | `unified-approvals.controller.ts:32-33` | `approvals:read` | **200** |
| `GET /api/approvals/:id` | `:53-54` | `approvals:read` | **200** |
| `POST /api/approvals/:id/decide` | `:74-76`, `@HttpCode(200)` | `approvals:decide` | not exercised (mutation) |
| `POST /api/pos/discounts/:id/approve` | `discounts.controller.ts:56-58` | `pos:discount:approve` | not exercised (mutation) |
| `POST /api/pos/discounts/:id/reject` | `:72-74` | `pos:discount:approve` | not exercised (mutation) |
| `GET /api/pos/discounts/pending` | `:88-89` | `pos:discount:approve` | **200** (`[]`) |
| `POST /api/pos/refunds/:id/approve` | `refunds.controller.ts:64-66` | `pos:refund:approve` | not exercised (mutation) |
| `POST /api/pos/orders/:id/post-close-void` | `refunds.controller.ts:94-96` | `pos:void:postclose` | not exercised (mutation) |
| `PATCH /api/hr/leave/:id/review` | `attendance.controller.ts` | `pos:hr:leave:review` | not exercised (mutation) |
| `PATCH /api/hr/shift-swaps/:id/approve` | `attendance.controller.ts:121-122` | `pos:hr:shift-swaps:approve` | not exercised (mutation) |
| `GET /api/analytics/anomalies` | analytics module | `pos:analytics:anomalies:read` | **200** |

Every documented permission string matches the decorator exactly.

### The generic decide DTO (MANAGER-GAP-007) — captured

`modules/unified-approvals/dto/decide-approval.dto.ts`:

```ts
export class DecideApprovalDto {
  @IsEnum(['APPROVE','REJECT']) decision!: 'APPROVE'|'REJECT';
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MinLength(4) @MaxLength(12) managerPin?: string;
}
```

The DTO is **uniform across all six source types** — there are no source-specific dynamic
parameters at the DTO boundary. MANAGER-GAP-007's stated risk ("the generic decide payload takes
source-specific dynamic parameters") is **narrower than documented**; the real variability is in
what the downstream service does per source, not in what the client must send. The Option B
preference remains a product/safety decision and stands, but the payload risk is low.

### 🟡 `GET /api/approvals` is NOT fully branch-scoped

The matrix says "Branch-scoped". `unified-approvals.service.ts:272-273` reads:

```ts
const where: Record<string, unknown> = { orgId };
if (source.branchScoped) where.branchId = branchId;
```

Per `approval-source.types.ts`:

| Source | Domain | `branchScoped` |
| --- | --- | --- |
| `discount` | POS | **true** |
| `refund` | POS | **true** |
| `shift_swap` | HR | **true** |
| `leave_request` | HR | **false** (org-scoped on the model side) |
| `vendor_bill` | FINANCE | **false** |
| `inter_branch_transfer` | FINANCE | **false** |

Verified live with `X-Branch-Id: cb27be401a2c35dfc0d4e610` (Tapas Downtown), `?status=PENDING`
returned `total: 16` spanning **five** branches:

```
leave_request  Tapas Downtown              PENDING  1
leave_request  Rooftop Bar                 PENDING  2
leave_request  Garden Cafe                 PENDING  2
leave_request  Events Kitchen              PENDING  2
leave_request  Main Branch                 PENDING  1      ← NOT a Manager membership
shift_swap     Tapas Downtown              PENDING  2
refund         Tapas Downtown              PENDING  1
vendor_bill    Rooftop Bar                 DRAFT    2
vendor_bill    Garden Cafe                 DRAFT    1
vendor_bill    Events Kitchen              DRAFT    2
```

**Three consequences for M-P2/M-P3/M-P4:**

1. An unfiltered "Pending approvals" KPI would show **16** for a branch that actually has **4**.
   M-P2 must either filter client-side by `branchId === activeBranchId`, or use
   `?domain=POS` + `?sourceType=shift_swap`, and label the card honestly.
2. The list surfaces `vendor_bill` / `inter_branch_transfer` **FINANCE** rows. These are outside the
   approved Manager MVP scope. M-P2/M-P3 must filter them out explicitly, not rely on them being
   absent.
3. The org-scoped `leave_request` source returned a row from **Main Branch**, a branch the Manager
   is **not** a member of. This is by design (leave is org-scoped, nullable branch) but the UI must
   never present it as branch data.

`ListApprovalsDto` does accept `branchId`, `sourceType`, `domain`, `dateFrom`, `dateTo`, `page`,
`pageSize` — but overriding `branchId` only re-targets the branch-scoped sources; it cannot make
`leave_request` or `vendor_bill` branch-scoped.

### `GET /api/approvals/:id` — verified

Live **200**. Returns `{ id, sourceType, sourceEntityId, summary{...}, source{...} }` — the full
underlying record plus the list-item summary, including `actionsAvailable` (`["APPROVE","REJECT"]`
for leave). Sufficient for a read-only escalation detail panel.

---

## 7. Staff / HR — 🔴 compensation and PII are returned on the wire

### 🔴 CRITICAL — `GET /api/hr/employees` returns full compensation for every employee

`hr.service.ts:227-257`:

```ts
const orgId = ctx.organizationId;
const where: any = { orgId };            // ← line 232: NO branchId filter, ever
...
this.prisma.employee.findMany({
  where,
  include: { position: true, compensationProfile: true },   // ← line 252: unconditional
  skip, take,
})
```

**Exact field list returned by `GET /api/hr/employees` (verified live, union across all 40 rows):**

| Field | Sensitivity |
| --- | --- |
| `id`, `orgId`, `branchId`, `employeeCode`, `status` | safe |
| `firstName`, `middleName`, `lastName` | safe |
| `employmentType`, `hireDate` | safe |
| `positionId`, `position` `{id, orgId, branchId, code, title, department, level, description, active, createdAt, updatedAt}` | safe |
| `userId` | safe (linked-user state) |
| `createdAt`, `updatedAt` | safe |
| **`email`** | PII — contact |
| **`phone`** | PII — contact |
| **`address`** | PII |
| **`dateOfBirth`** | PII |
| **`emergencyContactName`** | PII |
| **`emergencyContactPhone`** | PII |
| **`notes`** | **private HR notes — explicitly excluded by the locked scope** |
| **`metadata`** | unbounded free-form; treat as sensitive |
| **`compensationProfileId`** | compensation FK |
| **`compensationProfile`** — nested object: `{id, orgId, branchId, code, `**`salaryBasis`**`, `**`baseAmount`**`, `**`currency`**`, `**`allowances`**`, `**`deductions`**`, notes, active, createdAt, updatedAt}` | **🔴 COMPENSATION — explicitly excluded by the locked scope** |

Sample value observed: `compensationProfile.baseAmount = "2800000"`, `salaryBasis = "MONTHLY"`,
`currency = "UGX"`. **40 of 40 rows carried a populated `compensationProfile`.**

`GET /api/hr/employees/:id` is worse — it additionally returns a **`contracts[]`** array whose rows
carry `contractNumber`, `contractStatus`, `startsAt`, `endsAt`, **`salaryBasis`**,
**`salaryAmount`** (observed `"1200000"`), `termsSummary`.

**Why this matters for M-P4.** The roadmap's mitigation is a *frontend* safe-field whitelist
(MANAGER-GAP-004). A frontend whitelist prevents **rendering** but it does **not** prevent the
salary from crossing the wire, entering the React Query cache, appearing in devtools, or landing in
a browser HAR/error report. Against the locked constraint *"Compensation / contracts / payroll
never rendered, **never fetched**"*, a whitelist alone is **not compliant**.

**M-P4 must (all of these):**
- implement the whitelist as a strict **allow-list projection applied at the API-client boundary**
  (`lib/manager/staff.ts`), so the raw object never reaches component state or the query cache;
- **never** call `GET /api/hr/employees/:id` for the directory drawer if the list row suffices —
  the detail route adds `contracts[]`;
- state plainly in the §7 sensitive-fields exclusion card that compensation exists server-side and
  is discarded client-side;
- and **record the backend projection as the real fix.** Adding a `?include=` / safe-projection to
  `hr.service.ts` is a backend change and is **documented here, not implemented**.

### 🟡 `GET /api/hr/employees` is org-scoped and cannot be branch-filtered

Live with `X-Branch-Id: cb27be401a2c35dfc0d4e610`, the 40 rows spanned five branches:
Events Kitchen 9, Garden Cafe 9, Rooftop Bar 9, Tapas Downtown 9, **Main Branch 4** (again, a
branch the Manager is not a member of).

`ListEmployeesQueryDto` accepts only `status`, `employmentType`, `search`, `positionId`, `skip`,
`take`. **There is no `branchId` filter** — `GET /api/hr/employees?branchId=...` → **400**
(non-whitelisted property). The Manager Staff directory therefore **cannot be branch-scoped
server-side**; M-P4 must filter `row.branchId === activeBranchId` client-side and say so, or the
branch switcher will appear not to work on the Staff tab.

### Nested employee objects in HR lists — PII but no salary

`GET /hr/attendance`, `GET /hr/leave`, `GET /hr/shift-swaps` each embed full `employee` /
`requester` / `target` objects. Verified live, those nested objects carry
`address`, `dateOfBirth`, `phone`, `email`, `emergencyContactName`, `emergencyContactPhone`,
`notes`, `metadata`, and `compensationProfileId` — but **not** the `compensationProfile` object and
**not** `contracts`. Still PII; the same allow-list projection applies.

### HR route verification

| Matrix row | Controller line | Permission | Match | Live |
| --- | --- | --- | --- | --- |
| `GET /api/hr/employees` | `hr.controller.ts:46-47` | `pos:hr:employees:read` | ✅ | **200** |
| `POST /api/hr/employees` | `:32-33` | `pos:hr:employees:create` | ✅ | not exercised (mutation) |
| `PATCH /api/hr/employees/:id` | `:60-61` | `pos:hr:employees:update` | ✅ | not exercised (mutation) |
| `POST /api/hr/frontline-staff/onboard` | `:146-147`, `@HttpCode(201)` | `hr:frontline-staff:create` | ✅ | not exercised (mutation) |
| `GET /api/hr/frontline-staff/:id/quick-pin-status` | `:163-164` | `auth:quick-pin:read` | ✅ | **200** |
| `POST /api/hr/frontline-staff/:id/quick-pin/reset` | `:177-178`, `@HttpCode(200)` | `auth:quick-pin:write` | ✅ | not exercised (mutation) |
| `PATCH /api/hr/frontline-staff/:id/quick-pin/disable` | `:193-194`, `@HttpCode(200)` | `auth:quick-pin:write` | ✅ | not exercised (mutation) |
| `PATCH /api/hr/frontline-staff/:id/quick-pin/enable` | `:208-209`, `@HttpCode(200)` | `auth:quick-pin:write` | ✅ | not exercised (mutation) |
| `GET /api/hr/attendance` | attendance controller | `pos:hr:attendance:read` | ✅ | **200** (`total: 28`) |
| `GET /api/hr/leave` | attendance controller | `pos:hr:leave:read` | ✅ | **200** (`total: 4`) |
| `PATCH /api/hr/leave/:id/review` | attendance controller | `pos:hr:leave:review` | ✅ | not exercised (mutation) |
| `GET /api/hr/shift-swaps` | `attendance.controller.ts:110-111` | `pos:hr:shift-swaps:read` | ✅ | **200** (`total: 2`) |
| `PATCH /api/hr/shift-swaps/:id/approve` | `:121-122` | `pos:hr:shift-swaps:approve` | ✅ | not exercised (mutation) |
| `GET /api/hr/contracts` (Deferred) | `:91-92` | `pos:hr:contracts:read` | ✅ | **200** — Manager **holds** it |
| `POST /api/hr/contracts` (Deferred) | `:77-78` | `pos:hr:contracts:create` | ✅ | not exercised (mutation) |

Note: Manager also holds `pos:hr:compensation:read` and `pos:hr:positions:read`;
`GET /api/hr/compensation-profiles` → **200** live. Both stay **out of scope**; the deferral is a
product decision, not a permission block — exactly as with `approvals:*`.

`GET /api/hr/frontline-staff/:id/quick-pin-status` verified live returns:
`{employeeId, userId, firstName, lastName, phone, email, orgId, branchId, pinEnabled, pinExists,
pinIssuedAt, pinLastResetAt, pinLastUsedAt, pinTier, pinLength, failedPinAttempts, ...}` — exactly
the PIN-status surface M-P4 needs, plus contact PII to whitelist away.

### 🟡 MANAGER-GAP-005 CONFIRMED — onboarding returns a plaintext one-time PIN

`frontline-staff-onboarding.service.ts:273-284, 324, 361-366` returns
`quickPin: { pin, pinLength, tier }` where `pin` is the **plaintext PIN**. `issueQuickPin` defaults
to **true** for frontline job roles (`:72-73`). The service's own instruction text (`:404`) states
the reset endpoint *"returns a fresh PIN once"*.

`FrontlineStaffOnboardDto` (decorator-verified, **not executed**):
`email?` (`@IsEmail @IsOptional`), `firstName!`, `lastName!` (`@MaxLength(100)`),
`phone!` (`@IsNotEmpty @MaxLength(30) @Matches(/^[0-9+()\-\s]{6,30}$/)`),
`roleName!` (role **name** string, e.g. `"Waiter"`), `issueQuickPin?`, `enablePasswordLogin?`
(default false), `temporaryPassword?` (`@MinLength(8) @MaxLength(128)`, required only when
`enablePasswordLogin=true`), and nested `employee!` =
`{ employeeCode?, hireDate!, employmentType!, positionId?, contractId?, compensationProfileId? }`.

⚠️ The nested employee part accepts `contractId` and `compensationProfileId`. **M-P4's onboarding
form must never expose or send either** — sending them would attach compensation from a Manager
surface, violating the locked scope.

`FrontlineQuickPinResetDto` = `{ branchId?: string }` only.

### ✅ §8 Contradiction #5 RE-CONFIRMED — approving a shift swap mutates ZERO roster rows

Repo-wide grep for `scheduleAssignment` across `apps/api/src` (excluding specs) returns **six**
call sites, **all read-only**:

```
attendance.service.ts:439  prisma.scheduleAssignment.findFirst   (createShiftSwap validation)
attendance.service.ts:454  prisma.scheduleAssignment.findFirst   (createShiftSwap validation)
staff-insights.service.ts:293  prisma.scheduleAssignment.count
workforce.service.ts:425   prisma.scheduleAssignment.findMany
workforce.service.ts:436   prisma.scheduleAssignment.count
workforce.service.ts:467   prisma.scheduleAssignment.findMany
```

There is **no** `scheduleAssignment.create/update/updateMany/delete/upsert` anywhere in the API.

`attendance.service.ts:555-623` (`approveShiftSwap`) does exactly three things: a branch-scoped
`findFirst` guard, a concurrency-safe `shiftSwapRequest.updateMany({ where: {id, orgId, branchId,
status:'PENDING'}, data: { status, approvedById, approvedAt, reviewNotes }})`, and an
`audit.log({ action: 'SHIFT_SWAP_' + status })`. **Zero roster writes.**

**SUP-RG-036/042 still holds.** M-P4 must follow the Supervisor **Outcome C** precedent: an honest
notice that schedule reassignment is not supported, and **no Approve control that implies a roster
change**. Reject-only + truthful notice satisfies the approved "shift-swap review" scope.

---

## 8. Reports — 24 generators (not 17), and a fabricated PDF

### 8.1 Complete generator enumeration

`reports.controller.ts` exposes **24** generator POST routes — 7 more than the matrix's 17. Every
one is class-guarded `@UseGuards(PermissionGuard, BranchContextGuard)` + `@RequireBranchContext()`.

| # | Route | Line | `@Permissions` | In matrix? | Manager holds? |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /reports/shift-end` | 52 | `pos:reports:shift-end:generate` | ✅ | ✅ |
| 2 | `POST /reports/daily-sales` | 73 | `pos:reports:daily-sales:generate` | ✅ | ✅ |
| 3 | `POST /reports/payment-mix` | 94 | `pos:reports:payment-mix:generate` | ✅ | ✅ |
| 4 | `POST /reports/top-items` | 115 | `pos:reports:top-items:generate` | ✅ | ✅ |
| 5 | `POST /reports/sales-by-category` | 137 | `pos:reports:sales-by-category:generate` | ✅ | ✅ |
| 6 | `POST /reports/sales-by-hour` | 158 | `pos:reports:sales-by-hour:generate` | ✅ | ✅ |
| 7 | **`POST /reports/open-closed-orders`** | 179 | `pos:reports:daily-sales:generate` | ❌ **missing** | ✅ |
| 8 | `POST /reports/discounts-summary` | 204 | `pos:reports:discounts:generate` | ✅ | ✅ |
| 9 | `POST /reports/voids-summary` | 225 | `pos:reports:voids:generate` | ✅ | ✅ |
| 10 | `POST /reports/refunds-summary` | 246 | `pos:reports:refunds:generate` | ✅ | ✅ |
| 11 | `POST /reports/cash-variance` | 271 | `pos:reports:cash-variance:generate` | ✅ | ✅ |
| 12 | **`POST /reports/cash-movements`** | 292 | `pos:reports:cash-movements:generate` | ❌ **missing** | ✅ |
| 13 | `POST /reports/stock-variance` | 317 | `pos:reports:stock-variance:generate` | ✅ | ✅ |
| 14 | `POST /reports/wastage-summary` | 338 | `pos:reports:wastage:generate` | ✅ | ✅ |
| 15 | `POST /reports/low-stock` | 359 | `pos:reports:low-stock:generate` | ✅ | ✅ |
| 16 | `POST /reports/reservation-summary` | 384 | `pos:reports:reservations:generate` | ✅ | ✅ |
| 17 | **`POST /reports/reservation-deposits`** | 405 | `pos:reports:reservations:generate` | ❌ **missing** | ✅ |
| 18 | **`POST /reports/reservation-no-shows`** | 426 | `pos:reports:reservations:generate` | ❌ **missing** | ✅ |
| 19 | `POST /reports/event-summary` | 451 | `pos:reports:events:generate` | ✅ | ✅ |
| 20 | **`POST /reports/event-bookings`** | 472 | `pos:reports:events:generate` | ❌ **missing** | ✅ |
| 21 | **`POST /reports/event-checkins`** | 493 | `pos:reports:events:generate` | ❌ **missing** | ✅ |
| 22 | `POST /reports/anomaly-summary` | 518 | `pos:reports:anomaly-summary:generate` | ✅ | ✅ |
| 23 | **`POST /reports/high-risk-actors`** | 539 | `pos:reports:anomaly-summary:generate` | ❌ **missing** | ✅ |
| 24 | `POST /reports/staff-operations` | 564 | `pos:reports:staff-operations:generate` | ✅ | ✅ |

**Manager holds all 19 distinct generate permissions.** Note the sharing: `open-closed-orders`
rides `daily-sales:generate`; the three reservation reports share `reservations:generate`; the three
event reports share `events:generate`; `high-risk-actors` rides `anomaly-summary:generate`.

Non-generator report routes:

| Route | Line | Permission | Live |
| --- | --- | --- | --- |
| `GET /reports/catalog` | 40–42 | `pos:reports:catalog:read` | **200** |
| `GET /reports` | 589–591 | `pos:reports:history:read` | **200** |
| `GET /reports/:id` | 598–600 | `pos:reports:history:read` | **200** |
| `POST /reports/export` | 607–609 | **`pos:reports:exports:read`** | **201** |
| `GET /reports/exports/:id/download` | 622–624 | `pos:reports:exports:download` | **200** |

### 8.2 ✅ The `pos:reports:exports:read` oddity — CONFIRMED

`reports.controller.ts:607-609` is verbatim:

```ts
@Post('export')
@UseGuards(PermissionGuard, BranchContextGuard)
@Permissions('pos:reports:exports:read')
```

A **read** permission gating a **write** route that creates an `ExportArtifact` row and writes a
file to disk. Confirmed both statically and live (201). This is a **backend guard defect** —
recorded, **not fixed**. It has no practical effect on Manager (all three export permissions are
held), but any future role granted read-only export access would silently gain write.

### 8.3 ❗ MANAGER-GAP-009 is DISPROVED — the generator DTOs are uniform

Every one of the 19 generator DTO files in `modules/reports/dto/` is byte-for-byte equivalent:

```ts
{ reportWindow!: ReportWindow;   // @IsEnum — DAY | WEEK | MONTH | CUSTOM
  dateFrom?: string;             // @IsOptional @IsDateString
  dateTo?: string;               // @IsOptional @IsDateString
  parameters?: Record<string,any> }  // @IsOptional @IsObject
```

The **only** divergence in the entire set is `CreateTopItemsReportDto`, which adds one optional
field: `limit?: number` (`@Type(()=>Number) @IsInt @Min(1)`).

The 5 generator routes with no dedicated DTO file (`open-closed-orders`, `reservation-deposits`,
`reservation-no-shows`, `event-bookings`, `event-checkins`, `high-risk-actors`) reuse an existing
one — e.g. `open-closed-orders` binds `@Body() dto: CreateDailySalesReportDto`
(`reports.controller.ts:186`).

**Consequence for M-P5.** The roadmap's premise — *"templates have different filter requirements —
a generic form will send wrong payloads"* — **is not true against today's controller**. A single
generic generate form (window + optional date range + an optional `limit` shown only for
`TOP_ITEMS`) is **DTO-correct for all 24 generators**. M-P5 should be re-scoped accordingly and
should record this reversal explicitly rather than building 24 bespoke forms. (The
`parameters` free-form object is accepted by every route and is not required by any.)

### 8.4 🟢 `GET /reports/catalog` is the truthful generator-availability source

Live **200**, returns a **37-entry array**, each `{key, title, description, status, formats,
permission}`. `status` is one of:

- **`IMPLEMENTED`** — 24 entries, exactly matching the 24 generator routes above.
- **`CONDITIONAL`** — 1: `MENU_ENGINEERING` (`pos:reports:sales-by-category:generate`).
- **`PENDING_LATER`** — 12: `CUSTOMER_FEEDBACK`, `DOCUMENT_EXPORT_PACKS`, `LABOR_HOURS`,
  `PAYROLL_SUMMARY`, `PROFIT_AND_LOSS`, `BALANCE_SHEET`, `CASH_FLOW`, `AP_AGING`, `AR_AGING`,
  `BUDGET_VS_ACTUAL`, `FRANCHISE_ROLLUP`, `SCHEDULED_DIGEST` — all listed against
  `pos:reports:history:read` with **no generate route**.

**This is the MANAGER-GAP-008 "generator unavailable" data source M-P5 needs, and it is already
truthful.** M-P5 must drive its template list from the catalog and render `PENDING_LATER` /
`CONDITIONAL` entries in an explicit unavailable state rather than offering a Generate button.
⚠️ `PAYROLL_SUMMARY` and the four accounting reports are `PENDING_LATER` **and** out of Manager
scope — M-P5 must exclude them by key, not rely on the status.

### 8.5 Live request → record → detail flow — PROVEN

```
POST /api/reports/daily-sales  {"reportWindow":"DAY","parameters":{"tag":"MP0-QA"}}   → 201
  → { id: "cmt0xxr0700jk1ckq8kmvnnig", reportType: "DAILY_SALES", reportWindow: "DAY",
      status: "COMPLETED", branchId: "cb27be401a2c35dfc0d4e610",
      dateFrom: "2026-08-20T00:00:00.000Z", dateTo: "2026-08-21T00:00:00.000Z",
      rowCount: 219, parameters: {"tag":"MP0-QA"},
      summary: { grossSales, netSales, taxTotal, discountTotal, orderCount, avgOrderValue,
                 refundTotal, refundCount,
                 paymentBreakdown: {CARD, CASH, BANK_TRANSFER} },
      generatedAt, failedAt: null, failureReason: null }

GET /api/reports/{id}          → 200  (same fields + exportArtifacts: [])
GET /api/reports               → 200  { data[], total, page, pageSize }
```

Generation is **synchronous** — `status` is already `COMPLETED` in the 201 response. There is no
polling state to build. `failedAt` / `failureReason` exist for the failure path.

### 8.6 🔴 `GET /reports/:id` returns NO row payload — the matrix claim is wrong

The matrix says `GET /api/reports/:id` *"Retrieves generated report content payload."* It does not.
The verified response contains `rowCount: 219` and an aggregate `summary` object — **and no rows**.
There is no `data`, `rows`, or `payload` key.

`managerui.md` §8's *"detail rendered as a readable table"* is therefore **not buildable from
`GET /reports/:id`**. M-P5 has exactly two honest options: render the `summary` object as a
key/value panel (recommended), or fetch and parse the CSV export. **Do not fabricate rows.**

### 8.7 🔴 The PDF export is NOT a PDF

Live sequence:

```
POST /api/reports/export {"reportRunId":"...","format":"CSV"} → 201
  { status: "READY", fileName: "daily_sales_2026-08-20T03-08-27-362Z.csv",
    mimeType: "text/csv", fileSizeBytes: 254, checksum: "9222383c...", readyAt: ... }
GET  /api/reports/exports/{id}/download → 200, Content-Type: text/csv, 254 bytes
```

The CSV is real and well-formed — but it is the **summary only**, 11 metric rows, despite
`rowCount: 219`:

```csv
Metric,Value
Gross Sales,28107000
Net Sales,33014100
Tax Total,5035800
Discount Total,128700
Order Count,219
Avg Order Value,150749.315068493151
Refund Total,0
Refund Count,0
Payment (CARD),16691800
Payment (CASH),10317500
Payment (BANK_TRANSFER),2300900
```

Then:

```
POST /api/reports/export {"reportRunId":"...","format":"PDF"} → 201
  { status: "READY", fileName: "daily_sales_...pdf", mimeType: "application/pdf",
    fileSizeBytes: 790, checksum: "a9fe244b..." }
GET  /api/reports/exports/{id}/download → 200, Content-Type: application/pdf, 790 bytes
```

`file(1)` on the downloaded artifact reports **`Unicode text, UTF-8 text`**. The first bytes are:

```
============================================================
NIMBUS POS — DAILY SALES REPORT
============================================================
Report ID: cmt0xxr0700jk1ckq8kmvnnig
```

There is **no `%PDF-` header**. The source is `reports.service.ts:2056` →
`generateExportContent()` → **`this.generateTextPdf(...)`** — a plain-text builder. The API stamps
`mimeType: 'application/pdf'` and a `.pdf` extension on a text file
(`reports.service.ts:1997-1999`).

**This is a fake success state of exactly the kind §2 forbids.** A Manager who clicks "Download PDF"
receives a file no PDF reader can open, while the UI (and the API) claim `status: "READY"`.

**M-P5 resolution (no backend change):** **offer CSV only.** Either hide the PDF format entirely, or
render it in the truthful generator-unavailable state with copy stating PDF rendering is not
implemented. Do **not** surface a PDF download button. A real PDF renderer is a backend addition —
**documented, not implemented.**

### 8.8 Export failure modes — clean

| Probe | Result |
| --- | --- |
| `POST /reports/export` with unknown `reportRunId` | **404** `{"message":"Report run not found"}` |
| `GET /reports/exports/does-not-exist/download` | **404** `{"message":"Export artifact not found"}` |
| Export of a non-`COMPLETED` run | `reports.service.ts:1995` → **400** `"Can only export completed reports"` |
| Generator throws | artifact set `status: FAILED` + `failedAt` + `failureReason` (`:2044-2050`) |

All four are truthful and renderable. MANAGER-GAP-008's honest-failure surface is implementable.

### 8.9 🟡 Branch-isolation defect on report reads

`reports.service.ts` looks report runs up by **`orgId` only**:

- `getReportById(ctx.organizationId, id)` — the controller (`:604`) never passes `branchId`.
- `createExport(...)` — `findFirst({ where: { id: reportRunId, orgId } })` (`:1992`).

**Verified live:** a report run belonging to **Rooftop Bar**
(`c137ccedaa7b1d5481c2bc3a`, `RESERVATION_SUMMARY`) was fetched successfully with
`X-Branch-Id: cb27be401a2c35dfc0d4e610` (**Tapas Downtown**) → **200**, response `branchId` =
the Rooftop id.

`GET /reports` (list) *is* branch-scoped; only `:id` and `export` leak across branches within the
same org. Low severity for a same-org Manager who is a member of all four branches, but M-P5 must
**not** assume the detail it renders belongs to the active branch — display the row's own
`branchId`, and never link into a run whose `branchId` differs from the switcher's selection.
Backend fix (add `branchId` to the lookup) is **documented, not implemented**.

---

## 9. Settings — one RED, rest GREEN

| Matrix row | Reality | Verdict |
| --- | --- | --- |
| `GET /api/branches` — `tenancy:branch:read` | `tenancy.controller.ts:57-60` — **no `@Permissions` decorator at all**, only `@UseGuards(JwtAuthGuard)`. Scoped by `listBranches(user.id)` → membership-filtered. Live **200**, 4 rows. | 🟡 permission string in matrix is wrong (route is JWT-only) |
| **`PATCH /api/branches/:id`** — `tenancy:branch:write` | **ROUTE ABSENT.** Live **404** `Cannot PATCH /api/branches/...`. The tenancy controller has `POST orgs`, `GET orgs`, `GET orgs/:orgId`, `POST orgs/:orgId/branches`, `GET branches`, `GET branches/:branchId`, membership routes, `GET me`, `GET branch-test` — **no branch update route of any method.** | 🔴 |
| `GET /api/devices` — `devices:read` | `device-registry.controller.ts:227-228` — matches. Live **200**, `{data, total: 4, page: 1, pageSize: 50}`. | 🟢 |
| `POST /api/devices/activate` — `devices:write` | `:52-54`, `@HttpCode(200)`. Matches. | 🟢 not exercised (mutation) |
| `POST /api/devices/printers/routes` — `devices:routes:write` | `:118-120`. Matches. | 🟢 not exercised (mutation) |
| `POST /api/devices/terminals/pair` — `devices:terminals:write` | `:158-160`. Matches. | 🟢 not exercised (mutation) |

### 🔴 M-P6's "Branch profile — PATCH name/address/phone/active with confirmation" is BLOCKED

There is no branch-update endpoint. `GET /api/branches` returns everything M-P6 needs to **display**
a branch profile — `{id, organizationId, organization{id,name,slug}, name, code, slug, timezone,
currencyCode, address, phone, email, status, membershipRole, isDefaultBranch, createdAt, updatedAt}` —
but it is **read-only**. M-P6 must ship the branch profile as a **read-only card**. Adding a
`PATCH /branches/:id` is a backend addition — **documented, not implemented.**

### Additional device routes not in the matrix (all `devices:*`, all held by Manager)

`GET /devices/printers/routes` (`devices:read`) — live **200**, returns
`{data:[{id, orgId, branchId, printerId, routeType, station, enabled, priority, ...}]}`. This is the
**read** side of printer routes that M-P6 needs and the matrix omits.
Also: `POST /devices/kds/register` (`devices:write`), `PATCH /devices/terminals/:id/unpair`
(`devices:terminals:write`), `GET /devices/:id`, `GET /devices/:id/history` (`devices:read`),
`PATCH /devices/:id/status` (`devices:status:write` — **held**).
`GET /api/devices/terminals` → **404** (no such route; terminals are `type`-filtered devices).

Device rows carry `metadata: {"liveHardware": false}` — a truthful signal M-P6 should surface
alongside the metadata-only / stub-only copy.

---

## 10. Auth / session / seeded demo account

| Route | Controller | Live |
| --- | --- | --- |
| `POST /api/auth/login` | `auth.controller.ts:32` | **201** (as documented) |
| `POST /api/auth/quick-pin-login` | `:105` | **201** — path is `quick-pin-login`, **not** `quick-pin/login`. Supervisor audit re-confirmed. |
| `GET /api/auth/me` | `:74` | **200** |
| `POST /api/auth/logout` | `:56` | not exercised |
| `GET /api/auth/users/:id/quick-pin-status` | `:158-160`, `identity:user:read` | **200** |

### 🟢 The seeded Manager demo account is multi-branch — the switcher is fully exercisable

`GET /api/auth/me` returned **4 ACTIVE memberships**, all role `Manager` / `jobRole: MANAGER` /
`roleLevel: L4`, all in org `Nimbus Hospitality Group` (`cmt0scpcs00upn3ruoezd77ci`):

| Branch | id | default |
| --- | --- | --- |
| Tapas Downtown | `cb27be401a2c35dfc0d4e610` | **true** |
| Rooftop Bar | `c1f953ca4a21f8e0ba97abdd` | false |
| Garden Cafe | `c1447054fb9697e3c795cd8c` | false |
| Events Kitchen / Banquet Hall | `caf457a06f600c5bb4581fa3` | false |

`context` = `{organizationCount: 1, branchCount: 4, requiresContextSelection: true,
defaultOrganizationId: ..., defaultBranchId: "cb27be401a2c35dfc0d4e610", defaultMembershipId: ...}`.
`/auth/me` also returns an `employee` block (`EMP-002`, Daniel Okello).

**M-P1 should source the branch switcher from `me.memberships`** (already fetched by
`AuthProvider`) rather than adding a `GET /api/branches` call — this preserves the performance
hardening (no extra shell request). `GET /branches` remains available and returns the same 4
branches with richer fields (`address`, `phone`, `timezone`, `currencyCode`) if M-P6's Settings
profile needs them.

### 🟢 The advertised Manager Quick PIN is real (unlike the Waiter QA finding)

`demo-data/DEMO_LOGIN_CREDENTIALS.md` line 14 advertises `manager@nimbus.demo` / `Demo1234!` /
PIN **`11223344`** (HIGH_8, 8 digits) at Tapas Downtown. **Verified live:**

```
POST /api/auth/quick-pin-login {"branchId":"cb27be401a2c35dfc0d4e610","pin":"11223344","platform":"POS_DESKTOP"} → 201
  → accessToken for sub c6058bbe0d4c5e60545be4e9 (manager@nimbus.demo), role Manager
```

`GET /api/auth/users/c6058bbe.../quick-pin-status` → `{quickPinEnabled: true, pinTier: "HIGH_8",
pinLength: 8, hasPin: true, isLocked: false, failedPinAttempts: 0}`.

Provenance note: `packages/db/prisma/seed.ts` `DEMO_QUICK_PINS` (line 1846-1849) seeds
`manager@demo.local` / `12345678` — a **different** account, on Main Branch. The
`manager@nimbus.demo` PIN comes from the demo-data import. Both are real; do not conflate them.

---

## 11. Branch switching — 🟢 VERIFIED, fail-closed

| Probe | Result |
| --- | --- |
| `GET /api/tables` with `X-Branch-Id: cb27be...` (Tapas) | **200** — 22 tables, labels `TD-01…` |
| `GET /api/tables` with `X-Branch-Id: c1f953...` (Rooftop) | **200** — 16 tables, labels `RB-01…` |
| `GET /api/dash/manager` Tapas | gross `28107000`, orderCount 219, openOrders 112, lowStock 4 |
| `GET /api/dash/manager` Rooftop | gross `23709000`, orderCount 216, openOrders 111, lowStock 2 |
| `X-Branch-Id` = `cmt0scpcz00urn3ru5pmwkwcs` (**Main Branch — not a membership**) | **403** `{"message":"Not a member of this branch"}` |
| `X-Branch-Id: bogus123` | **400** `{"message":"Branch not found or inactive"}` |
| No `X-Branch-Id` header | **400** `{"message":"X-Branch-Id header is required"}` |
| No token | **401** `{"message":"Unauthorized"}` |

**Conclusion.** The demo Manager is **not** single-branch. Branch switching materially changes
branch-scoped results, membership is enforced fail-closed, and the branch-switcher design in M-P1
is fully supported. `apps/web/src/lib/api/client.ts:151` (`headers["X-Branch-Id"] = options.branchId`)
is the single injection point.

⚠️ Three surfaces **ignore** the branch header and must be filtered client-side or labelled
org-wide: `GET /hr/employees` (§7), `GET /approvals` for `leave_request` / `vendor_bill` /
`inter_branch_transfer` (§6), and `GET /reports/:id` (§8.9). The branch switcher will look broken on
Staff unless M-P4 handles this explicitly.

---

## 12. Permission cross-check — zero mismatches on matrix rows

The Manager JWT carries **214** permissions. Every permission string named by a
`MANAGER_API_MATRIX.md` row was checked against that list.

**Result: 61 / 61 matrix permission strings are HELD.** There are **no** matrix rows whose
permission the Manager lacks.

The only tested string **not** held is `pos:dash:owner:read` — which is **not** a matrix row. It
gates `GET /dash/owner` and `GET /dash/snapshots`; both correctly return **403** for Manager.

Additional strings the Manager holds that fall **outside** the approved MVP scope and must therefore
be enforced in the frontend, exactly as `approvals:*` is:

`pos:hr:contracts:read`, `pos:hr:contracts:create`, `pos:hr:compensation:read`,
`pos:hr:positions:read`, `tenancy:membership:manage`, `devices:status:write`,
`pos:receipt:read/reprint/send`, `audit:read`, `approvals:read`, `approvals:decide`.

**Every Manager MVP restriction is a product/safety constraint, not a permission block.** M-P1's
`lib/manager/permissions.ts` must therefore be an **allow-list of surfaces**, never a
"can-I?" permission check — a permission check would return `true` for payroll-adjacent surfaces.

---

## 13. Frontend readiness — Manager is absent and blocked

### 13.1 Confirmed: no Manager entries in the shared shell

`apps/web/src/components/pos-shell/types.ts:5`:

```ts
export type OperationalRole = "waiter" | "cashier" | "supervisor";
```

`apps/web/src/components/pos-shell/role-navigation.ts` registers exactly three:

```ts
export const operationalRoleNavigation: Record<OperationalRole, readonly OperationalNavItem[]> = {
  cashier: cashierRoutes, supervisor: supervisorRoutes, waiter: waiterRoutes,
};
```

`ls` confirms **`apps/web/src/pages/manager/`, `components/manager/`, and `lib/manager/` do not
exist.** A repo-wide grep for `manager` in `apps/web/src` returns only unrelated hits
(`managerPin` fields on `ActionConfirmDialog`, copy strings such as *"pending manager approval"*).

### 13.2 Confirmed: `login.tsx` blocks Manager users today

`apps/web/src/pages/login.tsx:143-151`:

```ts
const isWaiterUser = isWaiterCompatible(me);
const isCashierUser = isCashierCompatible(me);
const isSupervisorUser = isSupervisorCompatible(me);

if (!isWaiterUser && !isCashierUser && !isSupervisorUser) {
  clearSession();
  setBlockedMessage("This frontend currently supports waiter, cashier, and supervisor workspaces only.");
  return;
}
```

A `jobRole: MANAGER` user authenticates successfully against the API, then has its session
**cleared** and is shown that message. Four call sites are affected: the redirect `useEffect`
(lines ~108–116) and the three-way ternary at lines ~160, ~168–173.

### 13.3 The `getSupervisorLandingPath`-style pattern for M-P1

`apps/web/src/lib/auth/role.ts` is the exact template:

```ts
const SUPERVISOR_COMPATIBLE_JOB_ROLES = new Set(["SUPERVISOR"]);

export function isSupervisorCompatible(user: AuthMeResponse | null) {
  if (!user) return false;
  return user.roles.some((role) => {
    const jobRole = role.jobRole?.toUpperCase();
    const roleName = role.name?.toUpperCase();
    return (!!jobRole && SUPERVISOR_COMPATIBLE_JOB_ROLES.has(jobRole)) || roleName === "SUPERVISOR";
  });
}
export function getSupervisorLandingPath() { return "/supervisor/floor"; }
```

Note the difference the roadmap flags: `isWaiterCompatible` matches on `jobRole` **only**, while
`isCashierCompatible` and `isSupervisorCompatible` **also** accept `roleName`. For Manager, the
seeded account has **both** `jobRole === "MANAGER"` **and** `roles[0].name === "Manager"`, so either
form works. **Recommendation: mirror the cashier/supervisor form** (accept both) for consistency,
and record the decision. `resolveDefaultMembership()` in the same file already implements the
`defaultBranchId → isDefaultBranch → first` resolution the Manager context needs.

### 13.4 Icon registry — 5 new entries required

`components/pos-shell/role-icon-config.ts` currently defines 19 names: `approvals, back, branch,
cashierQueue, cashierReceipts, cashierTill, close, floor, logout, me, refresh, reservations, search,
serviceArea, success, table, time, warning, workstation`.

Manager's six tabs need: Overview, Operations, Staff, Reports, Settings, Me.
**Only `me` exists.** M-P1 must add **5** names to `role-icon-config.ts` **and** their Phosphor
bindings in `role-icons.ts`. Sizes/weights come from the existing tokens (bottomNav 24 /
compactAction 18 / pageState 32; active `fill`, inactive `bold`). `branch` already exists and should
be reused for the branch switcher.

### 13.5 Header has no switcher slot

`components/pos-shell/OperationalHeader.tsx` renders a fixed
`grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` — `BranchContextLabel` | `CurrentTime` |
identity+logout — and its props (`OperationalHeaderContext`) are
`{branchLabel, contextKind, contextLabel, displayName, initials, roleLabel}`. There is **no
children/slot prop**. M-P1 must add an **optional** slot (e.g. `branchSwitcher?: ReactNode`) that
defaults to nothing, so Waiter/Cashier/Supervisor render byte-identically. This is a **shared-file
change** — the cross-role regression in §14 is mandatory, and Cashier C3 runs in parallel.

### 13.6 Readiness strip feasibility (`MANAGER_NAV_AND_PAGE_MAP.md` §3)

| Chip | Verified source | Ship in M-P1? |
| --- | --- | --- |
| Branch selected | `me.memberships` + active branch | ✅ yes |
| Tills status | **count only** — `/dash/manager.shiftSummary.activeTills`. No list. | ⚠️ count-only, or omit |
| Shifts status | **count only** — `/dash/manager.shiftSummary.activeShifts`. No list. | ⚠️ count-only, or omit |
| Pending approvals count | `GET /approvals?status=PENDING` → `.total` (org-scope caveat, §6) | ✅ yes, branch-filtered |
| Report generator health | `GET /reports/catalog` → `status` distribution | ✅ yes |
| Device metadata health | `GET /devices` → `total` + `status` | ✅ yes |

Per the M-P1 rule *"a chip with no verified source is omitted, not faked"*, tills/shifts chips are
count-only or omitted — they must never imply a per-till/per-shift roster.

### 13.7 🔴 Complete M-P1 file-touch list

**New files (13):**

| Path | Purpose |
| --- | --- |
| `apps/web/src/lib/manager/routes.ts` | 6 nav items, icons by name |
| `apps/web/src/lib/manager/context.ts` | branch/org/permission context; `station_branch_id` resolution |
| `apps/web/src/lib/manager/permissions.ts` | **surface allow-list** (§12 — not a permission check) |
| `apps/web/src/lib/manager/state.ts` | branch-switch state + narrow invalidation keys |
| `apps/web/src/components/manager/shell/ManagerShell.tsx` | wraps `OperationalShell` |
| `apps/web/src/components/manager/shell/ManagerSessionGuard.tsx` | modelled on `CashierSessionGuard` |
| `apps/web/src/components/manager/shell/ManagerBranchSwitcher.tsx` | the one new affordance |
| `apps/web/src/components/manager/shell/index.ts` | barrel |
| `apps/web/src/pages/manager/index.tsx` | → `/manager/overview` redirect |
| `apps/web/src/pages/manager/{overview,operations,staff,reports,settings,me}.tsx` | 6 honest stubs |
| `apps/web/scripts/manager-p1-assertions.ts` | + `tsconfig.manager-p1-assertions.json` |
| `apps/web/e2e/manager-shell/` | new Playwright specs |

**Modified — shared, regress all four roles (6):**

| Path | Change |
| --- | --- |
| `apps/web/src/components/pos-shell/types.ts` | add `"manager"` to `OperationalRole` (line 5); add optional header slot to `OperationalHeaderContext` |
| `apps/web/src/components/pos-shell/role-navigation.ts` | register `manager: managerRoutes` |
| `apps/web/src/components/pos-shell/role-icon-config.ts` | +5 icon names |
| `apps/web/src/components/pos-shell/role-icons.ts` | +5 Phosphor bindings |
| `apps/web/src/components/pos-shell/OperationalHeader.tsx` | optional branch-switcher slot (defaults to nothing) |
| `apps/web/src/pages/login.tsx` | 4 call sites: `useEffect` redirect (~108–116), block guard (~143–151), 2 ternaries (~160, ~168–173) |

**Modified — role helpers (1):**

| Path | Change |
| --- | --- |
| `apps/web/src/lib/auth/role.ts` | `MANAGER_COMPATIBLE_JOB_ROLES`, `isManagerCompatible()`, `getManagerLandingPath()` → `/manager/overview` |

**Regression suites that must re-run** (shared files touched):
`apps/web/scripts/shell-assertions.ts`, `floor-assertions.ts`, `profile-assertions.ts`,
`cashier-c1/c2/c3-assertions.ts`, `prompt3a/3b1/3b2/3b3a/3b3b-assertions.ts`, and the Playwright
suites `e2e/cashier-floor/`, `e2e/supervisor-prompt3/`, `e2e/supervisor-approvals/`,
`e2e/supervisor-reservations/` across all four viewports.

---

## 14. §8 roadmap contradiction checks — resolved

| # | Contradiction | M-P0 verdict |
| --- | --- | --- |
| 1 | Unified approvals inbox vs Option B | **Stands, but the risk is smaller than documented.** Manager holds both `approvals:*` strings (verified live). The generic decide DTO is **uniform** across all 6 sources (§6), so the payload risk is low. Keep the preference: generic route for **read/counts**, domain routes for **writes**. |
| 2 | Escalations in Operations vs read-only Operations | **Ship read-only in M-P3.** Domain DTOs for discount/refund/post-close-void were **not** DTO-verified in this pass (they were not in scope for execution) — under the roadmap's own rule *"If M-P0 did not verify the DTO, ship the read-only surface and defer the write"*, M-P3 surfaces escalations and routes to a decision affordance **without** a write. Note also there is **no branch-wide refunds list** (only `GET /pos/refunds/:id` and `GET /pos/orders/:id/refunds`) and discounts have only `/pending` — mirroring SUP-RG-035. `GET /api/approvals` is the only branch-wide escalation read. |
| 3 | 8-prompt / 9-phase sequences | Superseded by M-P0…M-P6. No new evidence. |
| 4 | GAP-06 "mock/stub downloads" | **Contradiction sharpened.** §8.7 proves the backend *itself* already ships a fake PDF. M-P5 must not compound it. Truthful unavailable state only. |
| 5 | "approve/reject shift swaps" | **RE-CONFIRMED read-only.** Zero `scheduleAssignment` writes exist anywhere in the API; `approveShiftSwap` mutates only `ShiftSwapRequest` + audit (§7). **Supervisor Outcome C applies to Manager.** |
| 6 | Cashier-C6 gating | Superseded by the 2026-08-20 owner decision. Shared-file coordination with Cashier C3 remains mandatory. |
| 7 | 17 generators / export read-permission | **Both confirmed and quantified.** 24 generators, not 17 — the 7 missing rows are enumerated in §8.1. `POST /reports/export` is gated by `pos:reports:exports:read` verbatim at `reports.controller.ts:609`. |

---

## 15. (a) Verified-green list

1. `POST /api/auth/login` → 201; `GET /api/auth/me` → 200 with 4 memberships + context.
2. `POST /api/auth/quick-pin-login` → 201 with the **documented** PIN `11223344`.
3. `GET /api/dash/manager` → 200; 7 of 8 `managerui.md` §5 KPI cards sourced directly.
4. `GET /api/dash/today-summary` / `payment-mix` / `open-orders` / `low-stock` → 200; all three
   secondary routes confirmed behind `pos:dash:today-summary:read`.
5. `POST /api/dash/kpi/refresh` → 201, returns a full `KpiSnapshot` row.
6. `SSE /api/stream/metrics` → 200, `text/event-stream`, **15 s interval verified**, no
   `@Permissions`, fail-closed 400/401.
7. `GET /api/pos/orders`, `/pos/orders/:id`, `/tables`, `/floor-plans`, `/reservations` → 200,
   branch-scoped, permissions match.
8. `GET /api/approvals` + `/approvals/:id` → 200; Manager holds `approvals:read` and
   `approvals:decide` (seed lines 974/975 + live JWT).
9. `GET /api/pos/discounts/pending` → 200; `GET /api/analytics/anomalies` → 200.
10. All 8 HR read routes → 200 (`employees`, `employees/:id`, `attendance`, `leave`, `shift-swaps`,
    `contracts`, `compensation-profiles`, `positions`, `frontline-staff/:id/quick-pin-status`).
11. All quick-PIN admin + onboarding routes decorator-verified; DTOs captured.
12. **24** report generators enumerated with permissions; Manager holds **all 19** distinct strings.
13. `GET /reports/catalog` → 200, **37 entries with truthful `IMPLEMENTED` / `CONDITIONAL` /
    `PENDING_LATER` status** — the generator-availability source M-P5 needs.
14. Live **request → record → detail → CSV export → download** proven end to end (201/200/201/200).
15. Export failure modes truthful: 404 unknown run, 404 unknown artifact, 400 non-completed,
    `FAILED` + `failureReason` on generator error.
16. `GET /api/branches` (4 rows), `GET /api/devices` (4 rows), `GET /api/devices/printers/routes`
    → 200; the three device write routes decorator-verified.
17. **Branch switching verified** — Tapas vs Rooftop return different tables/dashboards;
    non-member 403, invalid 400, missing header 400, missing token 401.
18. **61/61 matrix permission strings held** — zero mismatches.
19. **Shift-swap roster immutability re-confirmed** — 0 `ScheduleAssignment` writes API-wide.
20. Frontend baseline confirmed: `OperationalRole` has no `"manager"`; no `pages/manager` /
    `components/manager` / `lib/manager`; `login.tsx` blocks Manager with a clear message.

## 15. (b) Gaps and blockers for M-P1…M-P6

| ID | Severity | Phase | Finding | Required handling |
| --- | --- | --- | --- | --- |
| **MP0-01** | 🔴 **Critical** | M-P4 | `GET /hr/employees` returns full `compensationProfile` (`baseAmount`, `salaryBasis`, `allowances`, `deductions`) on **all 40 rows**; `/hr/employees/:id` adds `contracts[]` with `salaryAmount`. Violates *"never fetched"*. | Allow-list projection **at the API-client boundary** so raw data never reaches cache/state; avoid `/employees/:id`; disclose in the exclusion card. Backend projection recommended — **not implemented**. |
| **MP0-02** | 🔴 **High** | M-P3, M-P1 | `GET /api/tills` and `GET /api/shifts` **do not exist** (404). `/tills/active` and `/shifts/active` are **operator-scoped** — they return the caller's own row, not the branch's. | Tills/shifts as **counts only** from `/dash/manager`. No per-till/per-shift table. Never present the Manager's own shift as the branch's. |
| **MP0-03** | 🔴 **High** | M-P5 | `POST /reports/export` with `format: PDF` produces a **plain-text file** stamped `application/pdf`. `status: READY`. A fake success state. | **Offer CSV only.** Hide PDF or render it unavailable with honest copy. Real renderer = backend addition, **not implemented**. |
| **MP0-04** | 🔴 **High** | M-P6 | `PATCH /api/branches/:id` **does not exist** (404). No branch-update route of any method. | Branch profile ships **read-only**. Do not build an edit form. |
| **MP0-05** | 🟡 Medium | M-P2, M-P3 | `GET /api/approvals` is **org-scoped** for `leave_request`, `vendor_bill`, `inter_branch_transfer`. Live: `total: 16` across 5 branches (incl. a non-membership branch) while X-Branch-Id said Tapas. | Filter by `branchId === activeBranchId` and/or `domain`/`sourceType`. Exclude FINANCE rows explicitly. Label the KPI honestly. |
| **MP0-06** | 🟡 Medium | M-P4 | `GET /hr/employees` is **org-scoped** and accepts **no** `branchId` filter (`?branchId=` → 400). | Client-side branch filter + explicit note, or the branch switcher will look broken on Staff. |
| **MP0-07** | 🟡 Medium | M-P2 | SSE needs `Authorization` **and** `X-Branch-Id`; `EventSource` supports neither. No SSE client exists in `apps/web`. | Build a `fetch` + `ReadableStream` SSE reader with abort-on-branch-change. Budget it as new infrastructure. |
| **MP0-08** | 🟡 Medium | M-P5 | `GET /reports/:id` returns **no rows** — only `summary` + `rowCount`. The matrix's "content payload" claim is false. | Render `summary` as a key/value panel. **Do not fabricate a row table.** |
| **MP0-09** | 🟡 Medium | M-P2 | `/dash/open-orders` hard-caps at `take: 50` and returns `count = page length`, contradicting `/dash/manager.openOrders`. | Use `/dash/manager.openOrders` for the number; treat the list as a capped preview. |
| **MP0-10** | 🟡 Medium | M-P2 | `netSales` (`SUM(total)`, inc-tax) > `grossSales` (`SUM(subtotal)`, ex-tax) — inverted vs. hospitality convention. | Do not label bare "Gross"/"Net". Qualify or tooltip. Backend rename **not implemented**. |
| **MP0-11** | 🟡 Low | M-P3, M-P4, M-P5 | Unbounded `pageSize`/`take` on `/pos/orders`, `/reports`, `/hr/employees` (no `@Max`, no clamp). | Always send an explicit bounded page size. `@Max` = backend change, **not implemented**. |
| **MP0-12** | 🟡 Low | M-P5 | `GET /reports/:id` and `POST /reports/export` look up by `orgId` only — **cross-branch read verified live**. | Display the row's own `branchId`; never link into a run outside the active branch. |
| **MP0-13** | 🟡 Low | — | `POST /reports/export` is gated by `pos:reports:exports:read` — a **read** permission on a write route (`reports.controller.ts:609`). | Recorded as a backend guard defect. No Manager impact (all export perms held). **Not fixed.** |
| **MP0-14** | 🟡 Low | M-P4 | `POST /hr/frontline-staff/onboard` returns a **plaintext** `quickPin.pin`; `issueQuickPin` defaults **true**. Reset likewise returns a fresh PIN once. | Masked, copy-once, expiry copy. Never log, never persist, never put in a query cache. |
| **MP0-15** | 🟡 Low | M-P4 | The onboard DTO's nested `employee` accepts `contractId` and `compensationProfileId`. | The Manager form must never expose or send either. Assert it in `manager-p4-assertions.ts`. |
| **MP0-16** | 🟢 Info | M-P5 | **MANAGER-GAP-009 is DISPROVED** — all 24 generator DTOs are `{reportWindow, dateFrom?, dateTo?, parameters?}`; only `top-items` adds `limit?`. | A single generic form is DTO-correct. **Re-scope M-P5 down** and record the reversal. |
| **MP0-17** | 🟢 Info | M-P1 | `GET /branches` has **no** `@Permissions` decorator (JWT-only), not `tenancy:branch:read` as the matrix claims. | Matrix annotation only. Prefer `me.memberships` for the switcher (no extra request). |
| **MP0-18** | 🟢 Info | M-P1 | Icon registry has **none** of Overview/Operations/Staff/Reports/Settings — 5 new entries needed; `OperationalHeader` has no slot prop. | Add to the registry (not a Manager-local file) + an **optional** header slot; full cross-role regression. |

## 15. (c) GO / NO-GO for M-P1

# ✅ GO for M-P1 — with four conditions

M-P1's scope (shell, six-tab nav, session guard, branch switcher, honest stubs) is **fully
supported by verified reality**:

- The demo Manager is **multi-branch (4 ACTIVE memberships)** and branch switching demonstrably
  re-scopes data, with fail-closed 403/400/401 boundaries. The branch switcher — the single genuinely
  new affordance and the biggest unknown going in — is **de-risked**.
- **Zero permission mismatches.** Every matrix permission is held; nothing M-P1 mounts will 403.
- The blocking frontend state is exactly as the roadmap assumed: no `"manager"` role in the
  registry, no `pages/manager`, and a clean four-call-site block in `login.tsx`.
- Every M-P0 RED finding lands in **M-P3 / M-P4 / M-P5 / M-P6** — **none** blocks M-P1.

**Conditions:**

1. **`lib/manager/permissions.ts` must be a surface allow-list, not a permission check.** The
   Manager holds `pos:hr:contracts:*`, `pos:hr:compensation:read`, `approvals:decide`,
   `tenancy:membership:manage`, and `devices:status:write`. Every MVP restriction is a product
   constraint, not a permission block (§12). A `hasPermission()`-driven UI would open payroll-adjacent
   surfaces.
2. **Shared-file changes are coordinated with Cashier C3 and fully regressed.** M-P1 touches
   `pos-shell/types.ts`, `role-navigation.ts`, `role-icon-config.ts`, `role-icons.ts`,
   `OperationalHeader.tsx`, and `login.tsx`. The header slot must be **optional** so the other three
   roles render byte-identically, and the full cross-role assertion + Playwright regression in §13.7
   must run and be reported.
3. **The readiness strip omits or count-limits the tills/shifts chips** (MP0-02). No chip may imply
   a per-till or per-shift branch roster, and the Manager's own `/shifts/active` row must never be
   presented as "the branch's active shifts."
4. **`ai/MANAGER_RECONSTRUCTION_ROADMAP.md` is amended before M-P5 begins** to record MP0-16
   (MANAGER-GAP-009 disproved — one generic generate form is DTO-correct), MP0-03 (CSV-only export),
   and MP0-08 (no row payload on `/reports/:id`). M-P5's scope shrinks materially and should not be
   planned against the stale premise.

**Downstream gating (not M-P1 blockers):** M-P4 must not start until the MP0-01 client-boundary
projection design is agreed. M-P6's Settings must be planned as read-only branch profile (MP0-04).

---

## 16. Change discipline

- **No runtime code changed.** No file under `apps/web/src/**` or `apps/api/src/**` was modified.
- **No backend / DTO / Prisma schema / migration / seed / permission / Postman change.**
- **No commit, no push.** HEAD remains `e05d944d532aac4ca7a3e75b740616cf170c3727`.
- **Writes executed:** three, all on the disposable QA Postgres — one `DAILY_SALES` report run
  (`parameters: {"tag":"MP0-QA"}`), two `ExportArtifact` rows derived from it (CSV + PDF), and one
  `KpiSnapshot` row from `POST /dash/kpi/refresh`. No shared Neon contact at any point.
- **`git diff --check`:** reports four pre-existing trailing-whitespace hits in
  `Front End/cashier_ui_docs_pack/.../CASHIER_API_MATRIX.md:20`,
  `Front End/manager_ui_full_docs_pack/.../MANAGER_APPROVAL_DECISIONS.md:3`,
  `Front End/waiter-ui-docs/.../DESIGN.md:4`, and
  `Front End/waiter-ui-docs/.../WAITER_LIFECYCLE.md:14`. All four are markdown hard-line-break
  syntax in files **not touched by this pass** and predate it. **No new whitespace error was
  introduced.**
- **Files written by M-P0:** this report; `Verified` annotations appended to
  `docs/manager-ui-docs/MANAGER_API_MATRIX.md`; the M-P0 status block in
  `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`; a catalog row in `docs/DOCUMENT_INDEX.md`.

## Final classification

# A. M-P0 COMPLETE / GO FOR M-P1 (4 conditions)
