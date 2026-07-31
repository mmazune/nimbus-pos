# Supervisor API Matrix

Status: Prompt 5B2 — Approvals UI consumes all four domains' verified decision endpoints (2026-07-31)

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

| Area | Method | Path | Permission | Supervisor use |
|---|---|---|---|---|
| Auth | POST | `/api/auth/login` | public | Email/password login; returns 201. |
| Auth | POST | `/api/auth/quick-pin/login` | public | POS quick PIN login where supported. |
| Auth | POST | `/api/auth/refresh` | auth | Session refresh. |
| Auth | POST | `/api/auth/logout` | auth | Sign out. |
| Auth | GET | `/api/auth/me` | auth | Canonical user, role, permission, branch, org, employee context. |

## Floor And Tables

| Method | Path | Permission | Use |
|---|---|---|---|
| GET | `/api/floor-plans` | `pos:floor:read` | Floor-plan context. |
| GET | `/api/floor-plans/:id` | `pos:floor:read` | Selected plan detail. |
| GET | `/api/floor/availability` | `pos:floor:read` | Operational table availability summary. |
| GET | `/api/tables` | `pos:table:read` | Shared operational table grid. |
| GET | `/api/tables/:id` | `pos:table:read` | Selected table detail. |
| PATCH | `/api/tables/:id/status` | `pos:table:write` | Supervisor table status action, confirmation required. |

## Orders And Exception Workspace

| Method | Path | Permission | Use |
|---|---|---|---|
| GET | `/api/pos/orders` | `pos:orders:read` | Active table orders and exception lookup. Query supports `status`, `serviceType`, `tableId`, `userId`, `excludeStatus`, `page`, `pageSize`. **Prompt 3B2: used by Find order** (one bounded branch page, pageSize 25; Active = `excludeStatus=CLOSED,VOIDED`). No order-number/date-range/free-text search — backend has none. |
| GET | `/api/pos/orders/:id` | `pos:orders:read` | Selected order detail. **Prompt 3B2: also the exact-order-ID fallback for Find order** (id-only). |
| POST | `/api/pos/orders` | `pos:orders:write` | Supervisor exception creation only, not Waiter clone. |
| POST | `/api/pos/orders/:id/items` | `pos:orders:write` | Exception item adjustment, product-gated. |
| PATCH | `/api/pos/orders/:id/items/:itemId` | `pos:orders:write` | Exception item adjustment, product-gated. |
| DELETE | `/api/pos/orders/:id/items/:itemId` | `pos:orders:write` | Exception item removal, product-gated. |
| POST | `/api/pos/orders/:id/send` | `pos:orders:write` | KDS send exception, product-gated. |
| POST | `/api/pos/orders/:id/mark-served` | `pos:orders:write` | Service-state exception. **Prompt 3A: LIVE** (READY→SERVED, explicit confirmation, optional reason; no Idempotency-Key — not BG3-wrapped). |
| POST | `/api/pos/orders/:id/request-bill` | `pos:orders:write` | Bill-request exception. **Prompt 3A: LIVE** (no body; audit-only, duplicate-safe; no Idempotency-Key — not BG3-wrapped). |
| POST | `/api/pos/orders/:id/void` | `pos:orders:void` | Active order void. **Prompt 3B3A: LIVE** (Adjustments group; HTTP 200, **not** BG3; shared danger confirm, `{ reason?: string (<=500) }` required in UI; valid NEW/SENT/IN_KITCHEN/READY, SERVED→409, CLOSED/VOIDED rejected; backend sets `status=VOIDED` only + auto-releases idle DINE_IN table; UI-only payment gate. Distinct from post-close-void/refund/complimentary). |

## Handoff

| Method | Path | Permission | Use |
|---|---|---|---|
| POST | `/api/pos/orders/merge` | `pos:order:merge` | Merge source into target. BG3 idempotency. **Prompt 3B1: LIVE** (source→VOIDED, blocked if source has payments). |
| POST | `/api/pos/orders/:id/split-bill` | `pos:order:split` | Non-physical bill allocation (metadata only; no new orders, no payment). BG3 idempotency. **Prompt 3B1: LIVE**. |
| POST | `/api/pos/orders/:id/split-items` | `pos:order:split` | Physical child order split (child NEW; re-send to KDS). BG3 idempotency. **Prompt 3B1: LIVE**. |
| POST | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer` | Move order to another table. BG3 optional idempotency (Idempotency-Key attached). **Prompt 3B2: LIVE** (bounded branch-scoped target selector excluding current table with non-blocking occupied/reserved warnings, source+target Floor cache reassignment, URL re-anchor). Body `{ targetTableId, reason? (<=200) }`; backend only sets `order.tableId` — no occupancy/reservation/capacity validation, no table-status change. |
| POST | `/api/pos/orders/:id/transfer-server` | `pos:order:transfer` | Move order to another server; **available but not used — deferred (Outcome B)**. No safe branch-scoped server selector. ⚠️ The single `pos:order:transfer` permission gates both transfer-table and transfer-server, so granting it makes this endpoint API-reachable (audit-logged, active-same-branch membership required) even though no UI exposes it. |
| POST | `/api/pos/orders/:id/move-items` | `pos:order:move-items` | Move selected items to an existing open target order. BG3 idempotency. **Prompt 3B1: LIVE**. |

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

| Method | Path | Permission | Supervisor use |
|---|---|---|---|
| GET | `/api/pos/orders/:id/payments` | `pos:payment:read` | Read-only payment context. |
| GET | `/api/pos/orders/:id/refunds` | `pos:refund:read` | Read-only refund context. |
| GET | `/api/pos/refunds/:id` | `pos:refund:read` | Refund detail when an id is known. |
| POST | `/api/pos/orders/:id/refunds` | `pos:refund:create` | Defer from MVP; Cashier/manager workflow risk. |
| POST | `/api/pos/refunds/:id/approve` | `pos:refund:approve` | Defer until pending-refund queue exists. |
| POST | `/api/pos/orders/:id/post-close-void` | `pos:void:postclose` | Defer until candidate queue and PIN UX exist. |
| POST | `/api/pos/orders/:id/close` | `pos:orders:close` | Cashier-owned; do not expose as Supervisor MVP checkout. |

## Discounts

| Method | Path | Permission | Use |
|---|---|---|---|
| POST | `/api/pos/orders/:id/discounts` | `pos:discount:request` | Request discount from selected order. **Prompt 3B3A: LIVE** (Adjustments group; HTTP 201, **not** BG3; `{ type: PERCENTAGE\|FIXED, value, reason (required, <=500), metadata? }`; basis = order **subtotal**; backend amount-based auto-approval within `OrgSettings.discountApprovalThreshold` (default 5000) → APPROVED (totals mutate) else PENDING; response is the bare Discount; UI shows a labelled estimate, re-fetches order detail, blocks a 2nd request while one is PENDING; SERVED not discountable; UI-only payment gate). **Prompt 3B3B:** also backs **Complimentary** (Outcome B) — a whole-order `PERCENTAGE value=100` + `metadata { complimentary:true, category }` + required reason; whole-order only (no line targeting); threshold decides PENDING/APPROVED; payment-gated; not a void/refund. |
| GET | `/api/pos/orders/:id/discounts` | `pos:discount:read` | Order discount history. **Prompt 3B3A: LIVE** (feeds the read-only Discounts panel — type/value/status/reason/requester/created/reviewer. **Prompt 3B3B:** PENDING rows now carry inline Approve/Reject controls (with `pos:discount:approve`); APPROVED/REJECTED rows stay terminal read-only). |
| GET | `/api/pos/discounts/pending` | `pos:discount:approve` | Approvals queue. **Prompt 3B3A:** feeds the Supervisor Approvals discount **count** (Supervisor already holds `pos:discount:approve`); a PENDING request from `/discounts` surfaces here. **Prompt 3B3B:** approve/reject are now live as inline decisions on PENDING rows in the order-workspace Discounts panel (the Approvals **page** stays read-only). |
| GET | `/api/pos/discounts/:id` | `pos:discount:read` | Approval detail. |
| POST | `/api/pos/discounts/:id/approve` | `pos:discount:approve` | Approve a PENDING discount. **Prompt 3B3B: LIVE** (inline Approve on PENDING Discounts-panel rows from the **order workspace**, not the Approvals page; HTTP 200, **not** BG3; PENDING-only else 409 and the order must stay discountable; **recalcs order totals** (latest approved wins) so **payment-gated** in the UI; optional `{ managerPin? (<=8) }` re-auths the approver's **own** quick-PIN (sets `managerPinVerified`) — UI does not collect it; bare response, so re-fetch order+discounts. Backend **permits self-approval** — UI matches and flags it). |
| POST | `/api/pos/discounts/:id/reject` | `pos:discount:approve` | Reject a PENDING discount. **Prompt 3B3B: LIVE** (inline Reject on PENDING rows; HTTP 200, **not** BG3; PENDING-only; `{ rejectionReason: string (required, <=500) }`; does **not** change order totals, so **not** payment-gated; bare response, status REJECTED). |

## Reservations

| Method | Path | Permission | Use |
|---|---|---|---|
| GET | `/api/reservations` | `pos:reservation:read` | Active/history reservation views. **Prompt 4A:** query supports `scope=active\|history` (server-side terminal/active split), `status`, `date`, `from`, `to`, `upcoming`, `tableId`, `page`, `pageSize` (default 25, **clamped max 100**). Response `{data,total,page,pageSize,totalPages,scope}`; rows carry derived `overdue`/`overdueByMinutes`. |
| GET | `/api/reservations/upcoming` | `pos:reservation:read` | Upcoming active reservations. |
| POST | `/api/reservations` | `pos:reservation:create` | Create reservation, product-approved. |
| GET | `/api/reservations/:id` | `pos:reservation:read` | Detail. |
| PATCH | `/api/reservations/:id/confirm` | `pos:reservation:confirm` | Prompt 5 action. |
| PATCH | `/api/reservations/:id/seat` | `pos:reservation:seat` | Prompt 5 action; can create linked order. |
| PATCH | `/api/reservations/:id/cancel` | `pos:reservation:cancel` | Prompt 5 action; deposit outcome required by DTO. |
| PATCH | `/api/reservations/:id/no-show` | `pos:reservation:no-show` | Prompt 5 action. |
| POST | `/api/reservations/:id/complete` | `pos:reservation:update` | **Prompt 4A: LIVE.** Manual SEATED → COMPLETED (200). Idempotent, optional `note`; valid with or without a linked order. Also driven automatically by order close (linked via `seatedOrderId`). Permission pre-existed on Supervisor/Owner/Manager — no seed change. |
| PATCH | `/api/reservations/:id/assign-table` | `pos:reservation:table:assign` | Prompt 5 action. |
| POST | `/api/reservations/:id/deposits` | `pos:reservation:deposit:record` | Money-adjacent action; confirmation required. |
| GET | `/api/reservations/:id/deposits` | `pos:reservation:deposit:read` | Deposit detail. |
| GET | `/api/reservations/:id/events` | `pos:reservation:read` | Reservation timeline. |

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

| Method | Path | Permission | Use |
|---|---|---|---|
| GET | `/api/shifts/active` | `pos:shift:read` | Readiness and Me. |
| POST | `/api/shifts/open` | `pos:shift:open` | Me action where role allows. |
| POST | `/api/shifts/:id/close` | `pos:shift:close` | Me action where role allows. |
| GET | `/api/hr/attendance` | `pos:hr:attendance:read` | Me history with `mine=true`; ops read if product-approved. |
| POST | `/api/hr/attendance/clock` | `pos:hr:attendance:clock` | Self punch; backend enforces linked employee. |
| GET | `/api/hr/leave` | `pos:hr:leave:read` | Me and Approvals. |
| POST | `/api/hr/leave` | `pos:hr:leave:create` | Self leave request. |
| PATCH | `/api/hr/leave/:id/review` | `pos:hr:leave:review` | Prompt 6 approval action. |
| GET | `/api/hr/shift-swaps` | `pos:hr:shift-swaps:read` | Me and Approvals. |
| POST | `/api/hr/shift-swaps` | `pos:hr:shift-swaps:create` | Deferred until safe selector exists. |
| PATCH | `/api/hr/shift-swaps/:id/approve` | `pos:hr:shift-swaps:approve` | Prompt 6 approval action. |

## Analytics Approvals

| Method | Path | Permission | Use |
|---|---|---|---|
| GET | `/api/analytics/anomalies` | `pos:analytics:anomalies:read` | Open anomaly queue. |
| GET | `/api/analytics/anomalies/:id` | `pos:analytics:anomalies:read` | Detail. |
| PATCH | `/api/analytics/anomalies/:id/acknowledge` | `pos:analytics:anomalies:acknowledge` | Prompt 6 action. |
| PATCH | `/api/analytics/anomalies/:id/resolve` | `pos:analytics:anomalies:acknowledge` | Prompt 6 action. |

## Explicit Exclusions

| Area | Endpoint family | Reason |
|---|---|---|
| Visible Orders nav | `/supervisor/orders` as nav | Product decision: order work enters from Floor. |
| Global approvals | `/api/approvals*` | Supervisor lacks global approval permissions; use domain APIs. |
| Audit timeline | `/api/audit/timeline` | Not a Supervisor MVP surface. |
| Receipts/devices/printers | `/api/receipts*`, `/api/devices*` | Cashier/admin/hardware boundary. |
| Accounting/franchise/billing | `/api/accounting*`, `/api/franchise*`, `/api/billing*` | Outside Supervisor MVP. |
| Reports primary tab | `/api/reports*` | Not in four-tab nav. |
