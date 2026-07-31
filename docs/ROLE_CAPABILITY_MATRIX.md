# ROLE_CAPABILITY_MATRIX.md — Nimbus POS

> **Supervisor final closure (2026-07-31):** every capability row for Supervisor below was
> exercised live in the final integrated QA pass (four viewports, isolated stack) and confirmed
> accurate — see `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`. No capability state
> changed; this is a verification pass, not a scope change.

> **Prompt 5B2 (2026-07-31) — Approvals CLOSED:** **Anomaly** Acknowledge + Resolve are now
> **actionable** in the UI (evidence preserved, underlying entity untouched). **Shift-swap = Outcome C**:
> **Reject actionable, Approve NOT exposed** — a roster-changing approval is unsupported (no
> roster-mutation service; SUP-RG-042), and the UI says so truthfully. All four domains integrated; no
> new permission/endpoint. Prompt 5 closed at B / demo-ready.
>
> **Prompt 5B1 (2026-07-30):** The Supervisor Approvals **UI** is now a premium master-detail
> decision workspace. **Discount** approve/reject and **Leave** approve/reject are **actionable** in
> the UI (via their canonical domain endpoints; discount is payment-gated + self-approval-flagged;
> leave makes no payroll/roster claim). **Shift-swap + Anomaly are read-only** in the UI until Prompt
> 5B2. No new permission/endpoint. Discounts have no branch-wide Resolved/History (SUP-RG-035).
>
> **Prompt 5A (2026-07-30):** Supervisor Approvals **decisions** (approve/reject discount, review
> leave, approve/reject shift-swap, acknowledge/resolve anomaly) are **Implemented at the backend
> and verified live** (matrix 29/29) on their canonical domain endpoints; the Approvals **page**
> stays **Read-only** until Prompt 5B wires the UI. Supervisor holds each domain's decision
> permission; it does NOT hold `approvals:*` (no generic inbox). Branch-scoped for swap/anomaly;
> leave org-scoped. Discount **history** is Deferred (no branch-wide endpoint, SUP-RG-035).

> Role × page × capability, with the backing endpoint and its **implementation
> state** as of 2026-07-26. State legend:
> **Implemented** = live & usable · **Read-only** = displayed, no mutation ·
> **Deferred** = planned, not built (needs a future phase/backend contract) ·
> **Excluded** = deliberately not this role's job.
>
> Endpoints are under `http://localhost:3001/api`. This matrix reflects the
> shipped UI; the backend API surface is broader (see `docs/MODULES.md`).

## Waiter

| Page | Capability | Endpoint(s) | State |
| --- | --- | --- | --- |
| Floor | View tables / status / ownership | `GET /orders`, `GET /floor` reads | Implemented |
| Floor→Workspace | Open table order workspace (instant) | (client, URL-backed) | Implemented |
| Order | Browse menu taxonomy | `GET /menu/navigation`, `GET /menu/*` | Implemented |
| Order | Build/configure items, send | `POST /orders`, `PATCH /orders/:id`, send | Implemented |
| Order | Add items **after send** | (needs per-line sent state) | **Deferred** (WKL-010) |
| Order | Edit serving on existing line | `PATCH /orders/:id` (no `menuItemServingId`) | **Deferred** (WKL-012) |
| Receipts | Request bill / preview | receipts reads; request-bill | Implemented (send adapters Deferred) |
| Reservations | View / seat guest | reservations reads + seat | Implemented |
| Me | Profile, shift, self-service | `GET /auth/me`, shifts/HR reads | Implemented (shift-swap create Deferred) |
| — | Collect payment / close | — | **Excluded** (cashier-owned) |

## Cashier

> **Cashier Floor-First reconstruction — Prompt C1+C2 IMPLEMENTED (2026-07-31); C3 not started.**
> Cashier nav is now **Floor · Till · Me**, default route **`/cashier/floor`** (`/cashier`
> redirects there), and Cashier is the **third shared-`OperationalFloor` consumer** alongside
> Waiter/Supervisor. **C2 Floor is read-only:** selecting a physical table resolves to zero/one/
> multiple payable bills (fail-closed, no silent first-pick) and opens ONE **read-only**
> `CashierSettlementWorkspace` (Bill/Totals/Payment state/Settlement readiness/History, reusing the
> checkout primitives) exposing **no payment/close/split/refund/receipt action**; a Cashier-only
> **Find bill** sibling handles tableless/takeaway/exact-id. Payment/close **execution** arrives in
> C3. **No permission change** — Cashier already holds `pos:table:read`, `pos:orders:read`,
> `pos:reservation:read` (the reads the resolution + settlement + Find-bill queries use); no
> backend/schema/migration/seed/Postman change. The payment/split/
> receipt/Till capabilities in the table below are **preserved and still reachable** via the
> **hidden compatibility routes** `/cashier/queue` + `/cashier/receipts` (direct URL only, off the
> visible nav; retire Receipts C4 / Queue C5) — no capability below has been removed or migrated
> yet. See `docs/cashier-ui-docs/*`,
> `ai/CASHIER_FLOOR_RECONSTRUCTION_CAPABILITY_MIGRATION_MATRIX.md`, and
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.

| Page | Capability | Endpoint(s) | State |
| --- | --- | --- | --- |
| Floor (C1) | View tables (shared `OperationalFloor`, shared-safe reads) | `GET /tables`, `GET /pos/orders?excludeStatus=CLOSED,VOIDED`, `GET /reservations` (`pos:table:read`/`pos:orders:read`/`pos:reservation:read`) | **Implemented** (Prompt C1; no guest/payment/receipt data on cards) |
| Floor→Selected table (C1) | Read-only settlement **boundary** ("Select a bill to continue.") | (client, `?tableId=` URL state) | **Read-only** (Prompt C1; no payment/close/split/refund/receipt action — settlement workspace = C2) |
| Queue (hidden compat route) | View payable orders | orders/payments reads | Implemented (direct-URL only; retire C5) |
| Payment | Cash tender | `POST /payments` | Implemented |
| Payment | Mobile money / card | provider adapters | **Deferred** (manual/reference only — LIM-001/003) |
| Payment | Partial cash tender | — | **Deferred** (LIM-011) |
| Payment | Split bill (allocation) | payments split | Implemented (metadata only — LIM-008) |
| Payment | Split items | creates `NEW` child | Read-only/partial (no KDS dispatch — LIM-009) |
| Receipts (hidden compat route) | Issue / preview | receipts | Implemented (delivery adapters Deferred; direct-URL only post-C1, retire C4) |
| Till | Open / close / safe-drop | tills | Implemented (safe-drop idempotency incomplete; paid-in/out Deferred; unchanged by C1) |
| Me | Profile | `GET /auth/me` | Implemented |
| — | Manager approval / post-close void | — | Read-only (boundary cards — LIM-012) |

## Supervisor

| Page | Capability | Endpoint(s) | State |
| --- | --- | --- | --- |
| Floor | View tables (shared Floor) | `GET /orders`, floor reads | Implemented |
| Floor→Workspace | Read order/reservation/bill/payment/table context | reads incl. `fetchSupervisorOrderDetail` | Read-only |
| Floor→Workspace | Change table status (Review/Confirm) | `PATCH /tables/:id/status` | Implemented |
| Floor→Workspace | **Request bill** (service exception) | `POST /pos/orders/:id/request-bill` (`pos:orders:write`) | **Implemented** (Prompt 3A; audit-only, duplicate-safe) |
| Floor→Workspace | **Mark served** (READY→SERVED) | `POST /pos/orders/:id/mark-served` (`pos:orders:write`) | **Implemented** (Prompt 3A; explicit confirmation) |
| Legacy Orders | `/supervisor/orders` redirect into Floor | (client redirect) | Implemented |
| Reservations | View | reservations reads | Read-only (lifecycle split Deferred) |
| Reservations | Complete reservation | (no verified endpoint / enum) | **Deferred** (SUP-RG-008/009, needs migration) |
| Approvals | View domain approval queues | domain approval reads | Read-only (resolution = Prompt 3+) |
| Approvals | Global `/api/approvals` | — | **Excluded** (no `approvals:*` perm) |
| Floor→Workspace | **Split bill** (EQUAL/CUSTOM, non-physical) | `POST /pos/orders/:id/split-bill` (`pos:order:split`) | **Implemented** (Prompt 3B1; BG3 idempotency) |
| Floor→Workspace | **Split items** (→ new child order) | `POST /pos/orders/:id/split-items` (`pos:order:split`) | **Implemented** (Prompt 3B1) |
| Floor→Workspace | **Move items** (→ existing order) | `POST /pos/orders/:id/move-items` (`pos:order:move-items`) | **Implemented** (Prompt 3B1) |
| Floor→Workspace | **Merge orders** (source→VOIDED) | `POST /pos/orders/merge` (`pos:order:merge`) | **Implemented** (Prompt 3B1) |
| Floor→Workspace | **Transfer table** (re-anchor order to another table) | `POST /pos/orders/:id/transfer-table` (`pos:order:transfer`) | **Implemented** (Prompt 3B2; BG3 optional idempotency, bounded branch-scoped target selector with non-blocking occupied/reserved warnings, URL re-anchor. Backend only sets `tableId` — no occupancy/status change) |
| Floor (above grid) | **Find order** (bounded lookup for tableless/takeaway/closed/exception/direct-ref) | `GET /pos/orders` (bounded page 25) + `GET /pos/orders/:id` (id fallback) | **Implemented** (Prompt 3B2; Supervisor-only compact control, not an Orders nav tab. No order-number/date/free-text search — backend lacks it) |
| Floor→Workspace | **Void active order** (Adjustments group) | `POST /pos/orders/:id/void` (`pos:orders:void`) | **Implemented** (Prompt 3B3A; shared danger confirm, reason required, HTTP 200 not BG3-wrapped. Sets `status=VOIDED` only + auto-releases an idle DINE_IN table; distinct from refund/complimentary/post-close void. UI-only payment safety gate) |
| Floor→Workspace | **Discount request** (Adjustments group) | `POST /pos/orders/:id/discounts` (`pos:discount:request`) | **Implemented** (Prompt 3B3A; basis = order subtotal; HTTP 201 not BG3. Backend auto-approves within `OrgSettings.discountApprovalThreshold` (default 5000) else PENDING — UI shows a labelled estimate and defers final status/totals to the response. UI-only payment safety gate; blocks a 2nd request while one is PENDING) |
| Floor→Workspace | **Discounts panel** (per-order history) | `GET /pos/orders/:id/discounts` (`pos:discount:read`) | **Read-only** list (Prompt 3B3A) + **inline Approve/Reject on PENDING rows** (Prompt 3B3B; shown only with `pos:discount:approve` and when order-level availability permits) |
| Floor→Workspace | **Approve discount** (inline on PENDING row) | `POST /pos/discounts/:id/approve` (`pos:discount:approve`) | **Implemented** (Prompt 3B3B; HTTP 200 not BG3; PENDING-only else 409, order must stay discountable; recalcs totals so **payment-gated** in UI; re-fetch order+discounts for canonical totals; optional `managerPin` re-auths approver's own PIN, UI does not collect it. Backend **permits self-approval** — UI matches backend and flags it; a backend maker-checker guard is a recommended future control) |
| Floor→Workspace | **Reject discount** (inline on PENDING row) | `POST /pos/discounts/:id/reject` (`pos:discount:approve`) | **Implemented** (Prompt 3B3B; HTTP 200 not BG3; PENDING-only; `rejectionReason` required (<=500); does **not** change order totals so **not** payment-gated) |
| Floor→Workspace | **Complimentary** (Adjustments; Outcome B) | `POST /pos/orders/:id/discounts` (`pos:discount:request`) | **Implemented** (Prompt 3B3B; no comp DiscountType exists, so = whole-order `PERCENTAGE value=100` + `metadata { complimentary:true, category }` + required reason from a constrained category list; whole-order only (no line targeting); may return PENDING above the org threshold (default 5000); **payment-gated** (mutates totals); not a void, not a refund; labelled estimate, no optimistic zero total) |
| Order actions (high-impact) | refunds / post-close void | refund + post-close-void endpoints | **Deferred** (out of scope for Supervisor reconstruction) |
| Order actions | transfer-server | `POST /pos/orders/:id/transfer-server` | **Deferred/blocked** (Outcome B — no safe narrow branch-scoped server selector; note `pos:order:transfer` gates both transfer-table and transfer-server, so the endpoint is API-reachable though UI-hidden) |
| Payment | Collect / close | — | **Excluded** (cashier-owned) |
| Menu / KDS / receipts control | — | — | **Excluded** |
| Me | Profile | `GET /auth/me` | Implemented |

### Supervisor Reservations — Prompt 4B (2026-07-28)

> The old read-only Supervisor Reservations page is replaced by a premium
> master-detail workspace with four UI **views** (groupings, not new statuses):
> **Arriving / Seated / Attention** (one bounded `scope=active` query) and
> **History** (a lazy `scope=history` query). The Supervisor role already holds
> every permission below (seed Supervisor block) — **no permission and no backend
> change**. Classification: **COMPLETE WITH KNOWN LIMITATIONS** (the shared-Neon
> `ReservationEventType.COMPLETED` migration is unapplied, so **complete** errors on
> shared Neon until deployed; every other action works on shared today).

| Capability | Endpoint(s) | State |
| --- | --- | --- |
| List active views (Arriving/Seated/Attention) | `GET /reservations?scope=active` (`pos:reservation:read`) | **Implemented** (one bounded query, page size 50; no browser merge) |
| List History | `GET /reservations?scope=history` (`pos:reservation:read`) | **Implemented** (lazy, server-paginated, backend default 25 / max 100) |
| Detail / timeline / deposits (read) | `GET /reservations/:id`, `.../events`, `.../deposits` | **Read-only** (contact + deposit shown in workspace only) |
| Create reservation | `POST /reservations` (`pos:reservation:create`) | **Implemented** (optional `depositRequired` amount only; no payment/deposit capture) |
| Confirm (PENDING→CONFIRMED) | `PATCH /reservations/:id/confirm` (`pos:reservation:confirm`) | **Implemented** |
| Assign/Change table (PENDING/CONFIRMED/SEATED) | `PATCH /reservations/:id/assign-table` (`pos:reservation:table:assign`) | **Implemented** |
| Seat (CONFIRMED→SEATED, table required) | `PATCH /reservations/:id/seat` (`pos:reservation:seat`) | **Implemented** |
| Cancel (active→CANCELLED, reason required) | `PATCH /reservations/:id/cancel` (`pos:reservation:cancel`) | **Implemented** |
| No-show (PENDING/CONFIRMED→NO_SHOW) | `PATCH /reservations/:id/no-show` (`pos:reservation:no-show`) | **Implemented** (never offered for SEATED; never automatic) |
| Manual complete (SEATED→COMPLETED) | `POST /reservations/:id/complete` (`pos:reservation:update`) | **Implemented (UI)** — **errors on shared Neon until the `COMPLETED`-event migration is deployed**; auto-completion on order-close is canonical backend, never issued by this page |
| Bulk resolution (Resolve all / Mark all no-show / Complete all) | — | **Excluded** (individual actions only) |
| Deposit capture / payment collection | — | **Excluded** (deposits read-only; cashier-owned money) |

### Supervisor Reservations — Prompt 4C (2026-07-29, shared-Neon cutover)

> Classification: **COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY.** The Prompt 4B
> shared-Neon caveats are now **resolved** — migration + seed were deployed to the
> shared Neon `production` branch under explicit user authorization.

| Capability | Endpoint(s) | State on shared Neon (post-4C) |
| --- | --- | --- |
| Manual complete (SEATED→COMPLETED) | `POST /reservations/:id/complete` (`pos:reservation:update`) | **Now LIVE on shared Neon.** Migration `20260518000000_prompt4a_reservation_completed_event` deployed via `db:migrate:deploy` — enum `ReservationEventType` now contains `COMPLETED` (10 values, 9 prior retained). The 4B "errors on shared until migration" caveat is resolved; every reservation lifecycle action is now fully operable on the shared demo database. |
| Auto-completion on order close (SEATED→COMPLETED) | canonical `OrdersService.transitionOrder` CLOSED choke point | **Now LIVE on shared Neon** (same enum deploy). |
| Transfer table (Prompt 3B2) | `POST /pos/orders/:id/transfer-table` (`pos:order:transfer`) | **Now functional on shared Neon.** `db:seed` (user-authorized, idempotent) added the `pos:order:transfer` Supervisor mapping (role_permissions 835→836, +1). Closes the long-standing shared-Neon seed residual (SUP-RG-031). |

> Shared-Neon net change from Prompt 4C: **+1 migration** (COMPLETED enum) and
> **+1 role_permission** (`pos:order:transfer`); reservation data unchanged (126
> reservations). A pre-migration Neon recovery branch is retained (Postgres enum
> values cannot be dropped — recovery = branch restore / forward-fix). **Outstanding
> QA gate:** the live authenticated browser + 4-viewport execution against a
> properly-isolated stack was **not** completed (an isolation slip was caught and
> reverted); the lifecycle remains proven by 67/67 reservation+order Jest tests and
> the compiled Prompt 4B Playwright suite (72 tests × 4 viewports).

## Cross-cutting / auth

| Capability | Endpoint | State |
| --- | --- | --- |
| Password login | `POST /auth/login` (**returns 201**) | Implemented |
| Quick PIN login (per-branch) | `POST /auth/quick-pin-login` | Implemented |
| Refresh / logout / logout-all | `POST /auth/refresh|logout|logout-all` | Implemented |
| Current user + context | `GET /auth/me` (claims-reuse, parallelised) | Implemented |
| Branch context | `X-Branch-Id` header + `BranchContextGuard` (cached/deduped) | Implemented |
| Health | `GET /health` → `{status, db}` | Implemented |

> RBAC: roles are levelled Owner L5 → Manager/Accountant L4 → Supervisor/
> Procurement/Stock/Event L3 → Cashier/Chef/Bartender L2 → Waiter L1, with
> per-permission mappings seeded in `packages/db/prisma/seed.ts`.
