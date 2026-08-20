# Supervisor API Matrix

Status: Prompt 5B2 — Approvals UI consumes all four domains' verified decision endpoints (2026-07-31)
· **Live-verified 2026-08-20** (see banner below)

> **Live verification (2026-08-20, isolated local stack).** Every row in the tables below now
> carries a **Verified** column. Checked against a disposable local stack — API
> `http://localhost:3001` (global prefix `api`), local seeded Postgres, supervisor
> `supervisor@nimbus.demo` at branch `cb27be401a2c35dfc0d4e610`. `POST /api/auth/login` returned
> **201**. Every **GET** the Supervisor UI issues was executed with `Authorization: Bearer <token>`
> + `X-Branch-Id` and its observed HTTP code recorded — **all returned 200.** Writes were **not**
> executed; each is marked *not exercised (mutation)* and confirmed by controller route
> registration (`@Post/@Patch/@Delete` + `@Permissions` decorators, cited per row). Rejection
> probes that change no state were used where no seeded row existed
> (`GET /api/pos/discounts/:id` and `GET /api/pos/refunds/:id` → **404** on an unknown id, which
> still proves route + guard). Nothing was created on this stack; no `SUP-DOCS-QA` rows were
> needed.
>
> **DEFECT FIXED (2026-08-20):** the Core table documented `POST /api/auth/quick-pin/login`.
> That path **does not exist** — live probe with a wrong PIN returned **404**
> `Cannot POST /api/auth/quick-pin/login`. The real path is **`/api/auth/quick-pin-login`**
> (no slash), which returned **401** `Invalid credentials` for the same probe. Controller:
> `apps/api/src/modules/auth/auth.controller.ts` `@Post('quick-pin-login')` (public); client:
> `apps/web/src/lib/auth/auth-api.ts` `loginWithPinRequest`. The row is corrected above. This
> matches the note already recorded in `docs/waiter-ui-docs/WAITER_API_MATRIX.md` §1.
>
> **Guards re-confirmed live:** missing `X-Branch-Id` → **400** `X-Branch-Id header is required`;
> missing token → **401**. **Permissions re-confirmed live:** the seeded Supervisor JWT carries
> **133** permissions and holds *every* permission string named in this matrix; it does **not**
> hold `approvals:read` / `approvals:decide` (`GET /api/approvals` → **403**), confirming the
> domain-specific Approvals architecture.
>
> **Bounded-pagination claims re-confirmed live:** `GET /api/hr/leave?take=500` → **400**
> `take must not be greater than 100`; `GET /api/analytics/anomalies?limit=500` → **400**
> `limit must not be greater than 100`; `GET /api/reservations?scope=active&pageSize=500` →
> **200** with the response silently clamped to `pageSize: 100`.
>
> **Client-consumption audit (same pass).** Every path in `apps/web/src/lib/supervisor/*.ts`
> (`floor.ts`, `orders.ts`, `reservations.ts`, `approvals.ts`, `approvals-contract.ts`,
> `approvals-workspace.ts`, `workforce.ts`, `legacy-orders-route.ts`) plus `lib/auth/auth-api.ts`
> was cross-checked against this matrix. **No endpoint the Supervisor client calls is missing
> from the matrix.** The reverse is not true: several documented rows are **not called by any
> supervisor surface** — they are now flagged with ⚠️ in the Verified column rather than removed,
> because the matrix is a *permitted-contract* register, not a call graph. `legacy-orders-route.ts`
> issues **no** API calls (it is pure `/supervisor/orders` → Floor query-param translation).

> **Coverage (2026-08-20):** **68** endpoint rows across the nine tables — **24** live-verified
> `200`, **3** verified by rejection probe (`401`/`404` — quick-pin path, `GET /api/pos/discounts/:id`,
> `GET /api/pos/refunds/:id`), **41** *not exercised (mutation)* with controller-decorator
> confirmation. **0** rows unverified. Of the 68, **15** are flagged ⚠️ as permitted-but-uncalled
> by supervisor client code.

### Verified-status legend

| Value | Meaning |
| --- | --- |
| `200` / `201` / `400` / `401` / `403` / `404` | HTTP code observed live on 2026-08-20 against the isolated local stack. |
| `not exercised (mutation)` | Deliberately not executed; existence + guard confirmed from the controller decorator cited in the row. |
| ⚠️ in the Verified cell | The endpoint is permitted/documented but **no supervisor client code calls it** (deferred, role-boundary, or other-role-owned). |

> **Prompt 5B2 (2026-07-31):** Adds the anomaly + shift-swap decision endpoints to the consumed set —
> Anomaly `PATCH /analytics/anomalies/:id/acknowledge` + `/resolve` (both `pos:analytics:anomalies:acknowledge`),
> and Shift-swap **reject** via `PATCH /hr/shift-swaps/:id/approve {status:'REJECTED'}` (Outcome C —
> approve/roster is not called). **No new endpoint/permission/contract change.**
>
> **Prompt 5B1 (2026-07-30):** The Approvals workspace consumes the already-verified domain endpoints
> — Discount `GET /pos/discounts/pending`, `GET /pos/discounts/:id`, `POST …/:id/approve|reject`
> (+ order `GET /pos/orders/:id/payments` for the payment-safety gate); Leave `GET /hr/leave`,
> `PATCH /hr/leave/:id/review`; Shift-swap `GET /hr/shift-swaps` (read-only in 5B1); Anomaly
> `GET /analytics/anomalies(/:id)` (read-only in 5B1). **No new endpoint, permission, or contract
> change.** Discounts have no branch-wide list endpoint → no discount Resolved/History (SUP-RG-035).
Date: 2026-07-18 (updated 2026-07-30)

> **Prompt 5A (2026-07-30) — verified Approvals decision endpoints (domain-specific; Supervisor
> holds each permission; verified live on a disposable Neon branch, matrix 29/29):**
>
> | Domain | List (Needs action) | Decision endpoint(s) | Permission |
> | --- | --- | --- | --- |
> | Discount | `GET /api/pos/discounts/pending` | `POST /api/pos/discounts/:id/approve` · `/reject` | `pos:discount:approve` |
> | Leave | `GET /api/hr/leave?status=PENDING` | `PATCH /api/hr/leave/:id/review` `{status:APPROVED\|REJECTED}` | `pos:hr:leave:review` |
> | Shift swap | `GET /api/hr/shift-swaps?status=PENDING` | `PATCH /api/hr/shift-swaps/:id/approve` `{status:APPROVED\|REJECTED}` | `pos:hr:shift-swaps:approve` |
> | Anomaly | `GET /api/analytics/anomalies?status=OPEN` | `PATCH /api/analytics/anomalies/:id/acknowledge` · `/resolve` | `pos:analytics:anomalies:acknowledge` |
>
> Lists accept bounded pagination (leave/swap `skip`/`take` ≤100; anomaly `offset`/`limit` ≤100) +
> `dateFrom`/`dateTo` (leave/swap/anomaly) for History. Shift-swap approve + anomaly ack/resolve are
> **branch-scoped**; leave review is **org-scoped** (nullable branch). All decisions are
> concurrency-safe (raced/duplicate → 409/400). Supervisor does **NOT** hold `approvals:read`/
> `approvals:decide` → the generic `unified-approvals` inbox is not used. Discounts have **no
> branch-wide list endpoint** (only `/pending` + `GET /api/pos/orders/:id/discounts`).

## Rules

- Effective base URL is `{{baseUrl}}/api/...`, with `baseUrl = http://localhost:3001`.
- Protected branch-operational endpoints require auth and `X-Branch-Id`.
- Supervisor visible nav is Floor, Reservations, Approvals, Me.
- Orders APIs are available for Floor-contained order work and exception lookup, but not as a visible primary tab.
- Do not call global `/api/approvals` from Supervisor.

## Core

| Area | Method | Path | Permission | Supervisor use | Verified |
|---|---|---|---|---|---|
| Auth | POST | `/api/auth/login` | public | Email/password login; returns 201. | **201** |
| Auth | POST | `/api/auth/quick-pin-login` | public | POS quick PIN login where supported. **Path corrected 2026-08-20** — this row previously read `/api/auth/quick-pin/login`, which does not exist (live: **404** `Cannot POST /api/auth/quick-pin/login`). Real controller route is `auth.controller.ts` `@Post('quick-pin-login')`, and it is what the client calls (`lib/auth/auth-api.ts` `loginWithPinRequest`). | **401** (wrong-PIN probe; real path). Old documented path `/api/auth/quick-pin/login` → **404**. |
| Auth | POST | `/api/auth/refresh` | auth | Session refresh. | not exercised (mutation) — `auth.controller.ts` `@Post('refresh')`. ⚠️ **No supervisor (or any role) client calls it**; documented for completeness. |
| Auth | POST | `/api/auth/logout` | auth | Sign out. | not exercised (mutation) — would invalidate the verification token. `auth.controller.ts` `@Post('logout')`; called by `lib/auth/auth-api.ts` `logoutRequest`. |
| Auth | GET | `/api/auth/me` | auth | Canonical user, role, permission, branch, org, employee context. | **200** |

## Floor And Tables

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| GET | `/api/floor-plans` | `pos:floor:read` | Floor-plan context. | **200** |
| GET | `/api/floor-plans/:id` | `pos:floor:read` | Selected plan detail. | **200** |
| GET | `/api/floor/availability` | `pos:floor:read` | Operational table availability summary. | **200** |
| GET | `/api/tables` | `pos:table:read` | Shared operational table grid. | **200** |
| GET | `/api/tables/:id` | `pos:table:read` | Selected table detail. | **200** |
| PATCH | `/api/tables/:id/status` | `pos:table:write` | Supervisor table status action, confirmation required. | not exercised (mutation) — `floor.controller.ts` `@Patch('tables/:id/status')` `@Permissions('pos:table:write')`. |

## Orders And Exception Workspace

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| GET | `/api/pos/orders` | `pos:orders:read` | Active table orders and exception lookup. Query supports `status`, `serviceType`, `tableId`, `userId`, `excludeStatus`, `page`, `pageSize`. **Prompt 3B2: used by Find order** (one bounded branch page, pageSize 25; Active = `excludeStatus=CLOSED,VOIDED`). No order-number/date-range/free-text search — backend has none. | **200** |
| GET | `/api/pos/orders/:id` | `pos:orders:read` | Selected order detail. **Prompt 3B2: also the exact-order-ID fallback for Find order** (id-only). | **200** |
| POST | `/api/pos/orders` | `pos:orders:write` | Supervisor exception creation only, not Waiter clone. | not exercised (mutation) — `orders.controller.ts` `@Post()` `@Permissions('pos:orders:write')`. ⚠️ **Not called by any supervisor client** (no `lib/supervisor/*` or `components/supervisor/**` caller); consistent with SUP-GAP-007 (order create/edit/send intentionally excluded). |
| POST | `/api/pos/orders/:id/items` | `pos:orders:write` | Exception item adjustment, product-gated. | not exercised (mutation) — `orders.controller.ts` `@Post(':id/items')` `pos:orders:write`. ⚠️ **Not called by any supervisor client.** |
| PATCH | `/api/pos/orders/:id/items/:itemId` | `pos:orders:write` | Exception item adjustment, product-gated. | not exercised (mutation) — `orders.controller.ts` `@Patch(':id/items/:itemId')` `pos:orders:write`. ⚠️ **Not called by any supervisor client.** |
| DELETE | `/api/pos/orders/:id/items/:itemId` | `pos:orders:write` | Exception item removal, product-gated. | not exercised (mutation) — `orders.controller.ts` `@Delete(':id/items/:itemId')` `pos:orders:write`. ⚠️ **Not called by any supervisor client.** |
| POST | `/api/pos/orders/:id/send` | `pos:orders:write` | KDS send exception, product-gated. | not exercised (mutation) — `orders.controller.ts` `@Post(':id/send')` `pos:orders:write`. ⚠️ **Not called by any supervisor client.** |
| POST | `/api/pos/orders/:id/mark-served` | `pos:orders:write` | Service-state exception. **Prompt 3A: LIVE** (READY→SERVED, explicit confirmation, optional reason; no Idempotency-Key — not BG3-wrapped). | not exercised (mutation) — `orders.controller.ts` `@Post(':id/mark-served')` `pos:orders:write`; client `lib/supervisor/orders.ts`. |
| POST | `/api/pos/orders/:id/request-bill` | `pos:orders:write` | Bill-request exception. **Prompt 3A: LIVE** (no body; audit-only, duplicate-safe; no Idempotency-Key — not BG3-wrapped). | not exercised (mutation) — `orders.controller.ts` `@Post(':id/request-bill')` `pos:orders:write`; client `lib/supervisor/orders.ts`. |
| POST | `/api/pos/orders/:id/void` | `pos:orders:void` | Active order void. **Prompt 3B3A: LIVE** (Adjustments group; HTTP 200, **not** BG3; shared danger confirm, `{ reason?: string (<=500) }` required in UI; valid NEW/SENT/IN_KITCHEN/READY, SERVED→409, CLOSED/VOIDED rejected; backend sets `status=VOIDED` only + auto-releases idle DINE_IN table; UI-only payment gate. Distinct from post-close-void/refund/complimentary). | not exercised (mutation) — `orders.controller.ts` `@Post(':id/void')` `@Permissions('pos:orders:void')`; client `lib/supervisor/orders.ts`. |

## Handoff

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| POST | `/api/pos/orders/merge` | `pos:order:merge` | Merge source into target. BG3 idempotency. **Prompt 3B1: LIVE** (source→VOIDED, blocked if source has payments). | not exercised (mutation) — `pos-handoff.controller.ts` `@Post('merge')` `pos:order:merge`; client `lib/supervisor/orders.ts`. |
| POST | `/api/pos/orders/:id/split-bill` | `pos:order:split` | Non-physical bill allocation (metadata only; no new orders, no payment). BG3 idempotency. **Prompt 3B1: LIVE**. | not exercised (mutation) — `pos-handoff.controller.ts` `@Post(':id/split-bill')` `pos:order:split`. |
| POST | `/api/pos/orders/:id/split-items` | `pos:order:split` | Physical child order split (child NEW; re-send to KDS). BG3 idempotency. **Prompt 3B1: LIVE**. | not exercised (mutation) — `pos-handoff.controller.ts` `@Post(':id/split-items')` `pos:order:split`. |
| POST | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer` | Move order to another table. BG3 optional idempotency (Idempotency-Key attached). **Prompt 3B2: LIVE** (bounded branch-scoped target selector excluding current table with non-blocking occupied/reserved warnings, source+target Floor cache reassignment, URL re-anchor). Body `{ targetTableId, reason? (<=200) }`; backend only sets `order.tableId` — no occupancy/reservation/capacity validation, no table-status change. | not exercised (mutation) — `pos-handoff.controller.ts` `@Post(':id/transfer-table')` `pos:order:transfer`. |
| POST | `/api/pos/orders/:id/transfer-server` | `pos:order:transfer` | Move order to another server; **available but not used — deferred (Outcome B)**. No safe branch-scoped server selector. ⚠️ The single `pos:order:transfer` permission gates both transfer-table and transfer-server, so granting it makes this endpoint API-reachable (audit-logged, active-same-branch membership required) even though no UI exposes it. | not exercised (mutation) — `pos-handoff.controller.ts` `@Post(':id/transfer-server')` `pos:order:transfer`. ⚠️ **Not called by any supervisor client** (deferred, Outcome B) but API-reachable — permission confirmed held on this stack. |
| POST | `/api/pos/orders/:id/move-items` | `pos:order:move-items` | Move selected items to an existing open target order. BG3 idempotency. **Prompt 3B1: LIVE**. | not exercised (mutation) — `pos-handoff.controller.ts` `@Post(':id/move-items')` `pos:order:move-items`. |

> **RBAC (Prompt 3B1, 2026-07-27):** the Supervisor role was granted `pos:order:split`,
> `pos:order:merge`, `pos:order:move-items` (seed mapping to existing permission
> rows; re-seeded).
>
> **RBAC (Prompt 3B2, 2026-07-28):** the Supervisor role was additionally granted
> `pos:order:transfer` (user-authorized seed mapping to the existing permission row;
> no schema/migration; requires re-seed to apply). This enables **transfer-table** in
> the UI. ⚠️ Because `pos:order:transfer` is a single backend permission covering both
> transfer-table and transfer-server, the **transfer-server** endpoint is now
> API-reachable even though it stays UI-hidden (Outcome B).

## Payments, Refunds, Voids

| Method | Path | Permission | Supervisor use | Verified |
|---|---|---|---|---|
| GET | `/api/pos/orders/:id/payments` | `pos:payment:read` | Read-only payment context. | **200** |
| GET | `/api/pos/orders/:id/refunds` | `pos:refund:read` | Read-only refund context. | **200** |
| GET | `/api/pos/refunds/:id` | `pos:refund:read` | Refund detail when an id is known. | **404** `Refund not found` (unknown-id probe — route exists and passes the permission guard; no refund seeded on this stack). `refunds.controller.ts` `@Get('refunds/:id')` `pos:refund:read`. |
| POST | `/api/pos/orders/:id/refunds` | `pos:refund:create` | Defer from MVP; Cashier/manager workflow risk. | not exercised (mutation) — `refunds.controller.ts` `@Post('orders/:id/refunds')` `pos:refund:create`. ⚠️ **Not called by any supervisor client** (deferred). |
| POST | `/api/pos/refunds/:id/approve` | `pos:refund:approve` | Defer until pending-refund queue exists. | not exercised (mutation) — `refunds.controller.ts` `@Post('refunds/:id/approve')` `pos:refund:approve`. ⚠️ **Not called by any supervisor client** (deferred). |
| POST | `/api/pos/orders/:id/post-close-void` | `pos:void:postclose` | Defer until candidate queue and PIN UX exist. | not exercised (mutation) — `refunds.controller.ts` `@Post('orders/:id/post-close-void')` `pos:void:postclose`. ⚠️ **Not called by any supervisor client** (deferred). |
| POST | `/api/pos/orders/:id/close` | `pos:orders:close` | Cashier-owned; do not expose as Supervisor MVP checkout. | not exercised (mutation) — `payments.controller.ts` `@Post('pos/orders/:id/close')` `pos:orders:close`. ⚠️ **Not called by any supervisor client** (Cashier-owned). |

## Discounts

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| POST | `/api/pos/orders/:id/discounts` | `pos:discount:request` | Request discount from selected order. **Prompt 3B3A: LIVE** (Adjustments group; HTTP 201, **not** BG3; `{ type: PERCENTAGE\|FIXED, value, reason (required, <=500), metadata? }`; basis = order **subtotal**; backend amount-based auto-approval within `OrgSettings.discountApprovalThreshold` (default 5000) → APPROVED (totals mutate) else PENDING; response is the bare Discount; UI shows a labelled estimate, re-fetches order detail, blocks a 2nd request while one is PENDING; SERVED not discountable; UI-only payment gate). **Prompt 3B3B:** also backs **Complimentary** (Outcome B) — a whole-order `PERCENTAGE value=100` + `metadata { complimentary:true, category }` + required reason; whole-order only (no line targeting); threshold decides PENDING/APPROVED; payment-gated; not a void/refund. | not exercised (mutation) — `discounts.controller.ts` `@Post('orders/:id/discounts')` `pos:discount:request`. |
| GET | `/api/pos/orders/:id/discounts` | `pos:discount:read` | Order discount history. **Prompt 3B3A: LIVE** (feeds the read-only Discounts panel — type/value/status/reason/requester/created/reviewer. **Prompt 3B3B:** PENDING rows now carry inline Approve/Reject controls (with `pos:discount:approve`); APPROVED/REJECTED rows stay terminal read-only). | **200** (client appends `?pageSize=50`). |
| GET | `/api/pos/discounts/pending` | `pos:discount:approve` | Approvals queue. **Prompt 3B3A:** feeds the Supervisor Approvals discount **count** (Supervisor already holds `pos:discount:approve`); a PENDING request from `/discounts` surfaces here. **Prompt 3B3B:** approve/reject are now live as inline decisions on PENDING rows in the order-workspace Discounts panel (the Approvals **page** stays read-only). | **200** (empty on this stack). |
| GET | `/api/pos/discounts/:id` | `pos:discount:read` | Approval detail. | **404** `Discount not found` (unknown-id probe — route + guard confirmed; no PENDING discount seeded). `discounts.controller.ts` `@Get('discounts/:id')` `pos:discount:read`. |
| POST | `/api/pos/discounts/:id/approve` | `pos:discount:approve` | Approve a PENDING discount. **Prompt 3B3B: LIVE** (inline Approve on PENDING Discounts-panel rows from the **order workspace**, not the Approvals page; HTTP 200, **not** BG3; PENDING-only else 409 and the order must stay discountable; **recalcs order totals** (latest approved wins) so **payment-gated** in the UI; optional `{ managerPin? (<=8) }` re-auths the approver's **own** quick-PIN (sets `managerPinVerified`) — UI does not collect it; bare response, so re-fetch order+discounts. Backend **permits self-approval** — UI matches and flags it). | not exercised (mutation) — `discounts.controller.ts` `@Post('discounts/:id/approve')` `pos:discount:approve`. |
| POST | `/api/pos/discounts/:id/reject` | `pos:discount:approve` | Reject a PENDING discount. **Prompt 3B3B: LIVE** (inline Reject on PENDING rows; HTTP 200, **not** BG3; PENDING-only; `{ rejectionReason: string (required, <=500) }`; does **not** change order totals, so **not** payment-gated; bare response, status REJECTED). | not exercised (mutation) — `discounts.controller.ts` `@Post('discounts/:id/reject')` `pos:discount:approve`. |

## Reservations

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| GET | `/api/reservations` | `pos:reservation:read` | Active/history reservation views. **Prompt 4A:** query supports `scope=active\|history` (server-side terminal/active split), `status`, `date`, `from`, `to`, `upcoming`, `tableId`, `page`, `pageSize` (default 25, **clamped max 100**). Response `{data,total,page,pageSize,totalPages,scope}`; rows carry derived `overdue`/`overdueByMinutes`. | **200** for `scope=active` and `scope=history`. Clamp confirmed live: `pageSize=500` → response `pageSize: 100`. |
| GET | `/api/reservations/upcoming` | `pos:reservation:read` | Upcoming active reservations. | **200** (empty on this stack). |
| POST | `/api/reservations` | `pos:reservation:create` | Create reservation, product-approved. | not exercised (mutation) — `reservations.controller.ts` `@Post()` `pos:reservation:create`. |
| GET | `/api/reservations/:id` | `pos:reservation:read` | Detail. | **200** |
| PATCH | `/api/reservations/:id/confirm` | `pos:reservation:confirm` | Prompt 5 action. | not exercised (mutation) — `reservations.controller.ts` `@Patch(':id/confirm')` `pos:reservation:confirm`. |
| PATCH | `/api/reservations/:id/seat` | `pos:reservation:seat` | Prompt 5 action; can create linked order. | not exercised (mutation) — `reservations.controller.ts` `@Patch(':id/seat')` `pos:reservation:seat`. |
| PATCH | `/api/reservations/:id/cancel` | `pos:reservation:cancel` | Prompt 5 action; deposit outcome required by DTO. | not exercised (mutation) — `reservations.controller.ts` `@Patch(':id/cancel')` `pos:reservation:cancel`. |
| PATCH | `/api/reservations/:id/no-show` | `pos:reservation:no-show` | Prompt 5 action. | not exercised (mutation) — `reservations.controller.ts` `@Patch(':id/no-show')` `pos:reservation:no-show`. |
| POST | `/api/reservations/:id/complete` | `pos:reservation:update` | **Prompt 4A: LIVE.** Manual SEATED → COMPLETED (200). Idempotent, optional `note`; valid with or without a linked order. Also driven automatically by order close (linked via `seatedOrderId`). Permission pre-existed on Supervisor/Owner/Manager — no seed change. | not exercised (mutation) — `reservations.controller.ts` `@Post(':id/complete')` `pos:reservation:update`. |
| PATCH | `/api/reservations/:id/assign-table` | `pos:reservation:table:assign` | Prompt 5 action. | not exercised (mutation) — `reservations.controller.ts` `@Patch(':id/assign-table')` `pos:reservation:table:assign`. |
| POST | `/api/reservations/:id/deposits` | `pos:reservation:deposit:record` | Money-adjacent action; confirmation required. | not exercised (mutation) — `reservations.controller.ts` `@Post(':id/deposits')` `pos:reservation:deposit:record`. ⚠️ **Not called by any supervisor client** (deposit capture deferred). |
| GET | `/api/reservations/:id/deposits` | `pos:reservation:deposit:read` | Deposit detail. | **200** |
| GET | `/api/reservations/:id/events` | `pos:reservation:read` | Reservation timeline. | **200** |

> **Prompt 4B (2026-07-28) — reservations UI now consumes these contracts.** The
> Supervisor Reservations page is a master-detail workspace with four UI **views**
> (Arriving/Seated/Attention from **one** `GET /api/reservations?scope=active` query,
> page size 50; **History** from a lazy `GET /api/reservations?scope=history`, backend
> default 25 / max 100). Endpoints consumed and their permissions:
>
> | Method | Path | Permission | Prompt 4B use |
> |---|---|---|---|
> | GET | `/api/reservations?scope=active` | `pos:reservation:read` | Arriving/Seated/Attention (one bounded query; no browser merge). |
> | GET | `/api/reservations?scope=history` | `pos:reservation:read` | History view (lazy, server-paginated). |
> | GET | `/api/reservations/:id` | `pos:reservation:read` | Workspace detail (contact shown here only). |
> | GET | `/api/reservations/:id/events` | `pos:reservation:read` | Workspace timeline. |
> | GET | `/api/reservations/:id/deposits` | `pos:reservation:deposit:read` | Deposits **read-only** in workspace. |
> | POST | `/api/reservations` | `pos:reservation:create` | Create (optional `depositRequired` amount only; **no** capture). |
> | PATCH | `/api/reservations/:id/confirm` | `pos:reservation:confirm` | PENDING→CONFIRMED. |
> | PATCH | `/api/reservations/:id/assign-table` | `pos:reservation:table:assign` | PENDING/CONFIRMED/SEATED. |
> | PATCH | `/api/reservations/:id/seat` | `pos:reservation:seat` | CONFIRMED→SEATED (table required). |
> | PATCH | `/api/reservations/:id/cancel` | `pos:reservation:cancel` | active→CANCELLED (reason required). |
> | PATCH | `/api/reservations/:id/no-show` | `pos:reservation:no-show` | PENDING/CONFIRMED→NO_SHOW (**never** SEATED, never automatic). |
> | POST | `/api/reservations/:id/complete` | `pos:reservation:update` | SEATED→COMPLETED (manual). |
>
> Action availability mirrors backend `VALID_TRANSITIONS` exactly; terminal rows are
> read-only. **No permission and no backend change** — the Supervisor role already
> holds every one of these grants (seed Supervisor block). `POST /api/reservations/:id/deposits`
> (`pos:reservation:deposit:record`) stays **unused** — deposit capture / payment is
> deferred. ⚠️ **Shared-Neon gate:** `POST /.../complete` (and auto-completion on order
> close) **errors on shared Neon** until migration `20260518000000_prompt4a_reservation_completed_event`
> is deployed (the `production` branch enum still lacks `COMPLETED`); all other actions
> work on shared today. **→ Deployed in Prompt 4C (below) — gate cleared.**

> **Prompt 4C (2026-07-29) — shared-Neon migration cutover + seed (gate cleared).**
> Under explicit user authorization, migration
> `20260518000000_prompt4a_reservation_completed_event` was deployed to the shared Neon
> `production` branch with `prisma migrate deploy` (repo script `db:migrate:deploy` —
> **not** `db:migrate`, which is `migrate dev` and unsafe on shared/production). SQL:
> `ALTER TYPE "ReservationEventType" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'SEATED'`.
> Post-deploy verification (Neon MCP): migration recorded in `_prisma_migrations`
> (finished, not rolled back), checksum matches the repo file, enum now contains
> `COMPLETED` (10 values, all 9 prior retained), 58 migrations / 0 rolled back / 0
> unfinished, reservation row counts unchanged (126). **Effect:** `POST /api/reservations/:id/complete`
> and auto-completion-on-order-close now **work on shared Neon** — every reservation
> lifecycle endpoint is fully operable there. A user-authorized idempotent `db:seed`
> also granted Supervisor the `pos:order:transfer` mapping (role_permissions 835→836,
> +1), so `POST /api/pos/orders/:id/transfer-table` is now **functional on shared Neon**
> (previously 403 there — long-standing seed residual). Net shared-Neon change: +1
> migration, +1 role_permission; reservation data unchanged; pre-migration recovery
> branch retained (Postgres enum values cannot be dropped). **Outstanding:** the live
> authenticated browser + disposable-branch API matrix was **not** completed (isolation
> slip caught and reverted) — the contracts remain proven by 67/67 reservation+order
> Jest tests and the compiled Prompt 4B Playwright suite; no code/contract/Postman change.

> **Prompt 4D (2026-07-29) — reservation endpoints live-exercised (gate cleared, B).** The
> reservation endpoints in this section were **live-exercised** against isolated stacks (a
> disposable Neon branch + a local Docker Postgres, behind new fail-closed `tools/qa/`
> DB-isolation tooling): `POST /api/reservations` (create), `PATCH .../confirm`, `PATCH
> .../assign-table` (assign + reassign), `PATCH .../seat`, `PATCH .../cancel`, `PATCH
> .../no-show`, `POST .../complete` (manual, SEATED→COMPLETED, idempotent), and `GET
> /api/reservations?scope=active|history` (pagination + derived `overdue`). **Live mutation
> matrix 53/53 pass** (local, authoritative — incl. branch-isolation + concurrency); 51/53
> on the disposable Neon branch with both near-misses diagnosed (one intentional documented
> idempotency = product-correct; one pre-existing reservation-number create-race, tracked
> SUP-RG-034, non-blocking). Availability mirrored backend `VALID_TRANSITIONS` exactly. **No
> contract/permission/Postman/backend change** — QA + isolation tooling only; shared Neon
> `production` verified untouched (836 role_permissions, 58 migrations, 126 reservations).
> Residual: order-close auto-completion proven by Jest 67/67 + the 4C cutover, not re-driven
> through the live Cashier `pos:orders:close` flow. Reports:
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT4D_ISOLATED_LIVE_QA_COMPLETION_REPORT.md`,
> `ai/PROMPT4D_DATABASE_ISOLATION_EVIDENCE.md`.

## Workforce And Me

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| GET | `/api/shifts/active` | `pos:shift:read` | Readiness and Me. | **200** (empty body — no open shift for this user on this stack). |
| POST | `/api/shifts/open` | `pos:shift:open` | Me action where role allows. | not exercised (mutation) — `shifts.controller.ts` `@Post('open')` `pos:shift:open`. ⚠️ **No supervisor surface calls it** — the only caller is `lib/waiter/me-api.ts`. Supervisor Me shows shift readiness read-only. |
| POST | `/api/shifts/:id/close` | `pos:shift:close` | Me action where role allows. | not exercised (mutation) — `shifts.controller.ts` `@Post(':id/close')` `pos:shift:close`. ⚠️ **No supervisor surface calls it** (waiter-only caller). |
| GET | `/api/hr/attendance` | `pos:hr:attendance:read` | Me history with `mine=true`; ops read if product-approved. | **200** (`?mine=true&take=5`). |
| POST | `/api/hr/attendance/clock` | `pos:hr:attendance:clock` | Self punch; backend enforces linked employee. | not exercised (mutation) — `attendance.controller.ts` `@Post('attendance/clock')` `pos:hr:attendance:clock`; client `lib/supervisor/workforce.ts` `punchSupervisorClock`. |
| GET | `/api/hr/leave` | `pos:hr:leave:read` | Me and Approvals. | **200**. Clamp confirmed live: `take=500` → **400** `take must not be greater than 100`. |
| POST | `/api/hr/leave` | `pos:hr:leave:create` | Self leave request. | not exercised (mutation) — `attendance.controller.ts` `@Post('leave')` `pos:hr:leave:create`. |
| PATCH | `/api/hr/leave/:id/review` | `pos:hr:leave:review` | Prompt 6 approval action. | not exercised (mutation) — `attendance.controller.ts` `@Patch('leave/:id/review')` `pos:hr:leave:review`. |
| GET | `/api/hr/shift-swaps` | `pos:hr:shift-swaps:read` | Me and Approvals. | **200** (also `?status=PENDING&take=50`). |
| POST | `/api/hr/shift-swaps` | `pos:hr:shift-swaps:create` | Deferred until safe selector exists. | not exercised (mutation) — `attendance.controller.ts` `@Post('shift-swaps')` `pos:hr:shift-swaps:create`. ⚠️ A client helper exists (`workforce.ts` `createSupervisorShiftSwap`) but **no component imports it** — deferred, matches SUP-GAP-019. |
| PATCH | `/api/hr/shift-swaps/:id/approve` | `pos:hr:shift-swaps:approve` | Prompt 6 approval action. | not exercised (mutation) — `attendance.controller.ts` `@Patch('shift-swaps/:id/approve')` `pos:hr:shift-swaps:approve`. |

## Analytics Approvals

| Method | Path | Permission | Use | Verified |
|---|---|---|---|---|
| GET | `/api/analytics/anomalies` | `pos:analytics:anomalies:read` | Open anomaly queue. | **200** (also `?status=OPEN` / `?status=ACKNOWLEDGED`). Clamp confirmed live: `limit=500` → **400** `limit must not be greater than 100`. |
| GET | `/api/analytics/anomalies/:id` | `pos:analytics:anomalies:read` | Detail. | **200** |
| PATCH | `/api/analytics/anomalies/:id/acknowledge` | `pos:analytics:anomalies:acknowledge` | Prompt 6 action. | not exercised (mutation) — `analytics.controller.ts` `@Patch('anomalies/:id/acknowledge')` `pos:analytics:anomalies:acknowledge`. |
| PATCH | `/api/analytics/anomalies/:id/resolve` | `pos:analytics:anomalies:acknowledge` | Prompt 6 action. | not exercised (mutation) — `analytics.controller.ts` `@Patch('anomalies/:id/resolve')` `pos:analytics:anomalies:acknowledge`. |

## Explicit Exclusions

| Area | Endpoint family | Reason |
|---|---|---|
| Visible Orders nav | `/supervisor/orders` as nav | Product decision: order work enters from Floor. |
| Global approvals | `/api/approvals*` | Supervisor lacks global approval permissions; use domain APIs. |
| Audit timeline | `/api/audit/timeline` | Not a Supervisor MVP surface. |
| Receipts/devices/printers | `/api/receipts*`, `/api/devices*` | Cashier/admin/hardware boundary. |
| Accounting/franchise/billing | `/api/accounting*`, `/api/franchise*`, `/api/billing*` | Outside Supervisor MVP. |
| Reports primary tab | `/api/reports*` | Not in four-tab nav. |

> **Exclusions live-verified 2026-08-20.** Two exclusions were confirmed by probe, not just by
> reasoning: `GET /api/approvals` → **403** `Insufficient permissions` and
> `GET /api/audit/timeline` → **403** `Insufficient permissions`, with the same supervisor token
> that reads every in-scope endpoint successfully. This is the strongest available confirmation of
> the "domain-specific approvals only" architecture (Prompt 5A Option B) — the Supervisor JWT
> genuinely lacks `approvals:read`/`approvals:decide`. Grep confirms no `/api/approvals`,
> `/api/receipts`, `/api/devices`, `/api/accounting`, `/api/franchise`, `/api/billing`, or
> `/api/reports` call exists anywhere under `apps/web/src/lib/supervisor/**`,
> `apps/web/src/components/supervisor/**`, or `apps/web/src/pages/supervisor/**` — the only two
> matches for `/api/approvals` are prohibition *comments* in `approvals-contract.ts` and
> `permissions.ts`, not requests.
> `/supervisor/orders` remains a redirect-only page (`legacy-orders-route.ts`, no API calls).
