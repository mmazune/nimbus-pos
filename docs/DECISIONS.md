# DECISIONS.md — Nimbus POS locked decisions

> Locked product/technical decisions, superseded decisions, rationale, and source.
> Do not change a locked decision without explicit approval. History is preserved
> (superseded entries are struck, not deleted).

> **LOCKED (Prompt 5A, 2026-07-30) — Supervisor Approvals architecture = domain-specific
> (Option B).** The Supervisor role does **not** hold `approvals:read`/`approvals:decide`, so the
> generic `unified-approvals` inbox (`POST /api/approvals/:id/decide`) is **not** used — every
> approval decision uses its canonical domain endpoint (`/pos/discounts/:id/approve|reject`,
> `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`, `/analytics/anomalies/:id/acknowledge|resolve`).
> `Needs action` / `Resolved` / `History` are **UI groupings over each domain's real statuses**,
> never persisted statuses. Each domain's single decision permission gates BOTH approve+reject (or
> ack+resolve). Prompt 5A hardened these paths (bounded pagination `Max 100`, branch isolation on
> shift-swap approve + anomaly ack/resolve with **leave intentionally org-scoped**, concurrency-safe
> conditional-claim writes, History date filters) with **no permission/schema/migration/seed/Postman
> change**. Rationale: smallest architecture that avoids duplicated lifecycle logic and preserves
> per-domain permissions/DTOs; verified live (matrix 29/29). Source: 5A completion report + gap
> register SUP-RG-011/012/035–039.

> **LOCKED (Prompt 5B1, 2026-07-30) — Supervisor Approvals UI = premium master-detail workspace,
> Discount + Leave actionable.** The former read-only Approvals page is replaced by a
> `SupervisorApprovalsWorkspace` on the 5A `approvals-contract.ts`: **Needs action / Resolved /
> History** scope tabs, All + per-domain filters, server-`total` counts, one shared identity-safe
> queue row shell, and a responsive master-detail layout (desktop split / mobile stack — one detail
> workspace). URL-persisted `scope`/`domain`/`page`/`from`/`to`/`selDomain`/`selId` (default = Needs
> action / All / page 1; **never** History; filter changes use `router.replace`, so Back returns to
> the prior page, not a filter state). **Discounts + Leave are fully actionable** (reusing the
> Prompt 3 `/pos/discounts/:id/approve|reject` + financials with the UI-only payment-safety gate and
> truthful self-approval notice; and `PATCH /hr/leave/:id/review` with no payroll/roster claim).
> **Shift-swap + Anomaly render read-only in 5B1** (no decision controls — Prompt 5B2 activates them).
> **Discounts are omitted from Resolved/History** (no branch-wide endpoint, SUP-RG-035) — a truthful
> "available from the related order" notice shows if forced. **No permission / schema / migration /
> seed / backend / Postman change.** Source: 5B1 completion report + QA evidence index.

> **LOCKED (Supervisor final closure, 2026-07-31) — Supervisor reconstruction is COMPLETE WITH
> KNOWN LIMITATIONS / DEMO-READY; Manager reconstruction is the next major track.** An integrated
> final QA pass re-verified every locked decision below live, across all four viewports, on an
> isolated stack (disposable Neon branch for API matrices, local Docker Postgres for the browser
> suite — see `docs/TESTING_AND_QA.md`). 262/264 executed browser tests passed (0 unresolved
> failures); two test-harness defects were found and fixed (zero product-code changes); shared
> Neon verified unchanged. **Do not reopen or re-litigate any decision below without explicit
> approval** — this closure pass exists to verify, not to change, Supervisor scope. See
> `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`.

> **LOCKED (Cashier Floor-First Reconstruction Decision, 2026-07-31) — Cashier nav target changes
> from Queue-first to Floor-first; reconstruction not yet implemented.** The currently-implemented
> Cashier nav (Queue · Receipts · Till · Me, see D-NAV below) is historically complete and
> demo-ready but is **superseded as the target architecture**. The locked target nav is **Floor ·
> Till · Me** (default route `/cashier/floor`), landing on the same shared `OperationalFloor` as
> Waiter/Supervisor; a physical table selection opens a settlement/payment/close/receipt workspace
> (Cashier becomes the sole payment/close/receipt-owning role, unchanged); a compact **Find bill**
> sibling control (never a fourth tab, never forking the shared Floor) reaches tableless/takeaway/
> direct-lookup/receipt-reference/closed-order/partially-paid/failed-pending-payment cases. Queue
> and Receipts are removed as standalone navigation/pages only **after** every capability is
> migrated. Reconstruction is seven prompts **C0–C6**; **C0 (documentation + current-worktree audit
> only) is complete (2026-07-31)** — no runtime/backend/schema/permission/Postman change occurred.
> Previously-built payment, split, receipt, Till, refund, session, profile, and performance logic
> is reused, not rewritten. Manager reconstruction remains blocked until Cashier C6 closes. **Do
> not begin C1 or any later prompt without explicit authorization.** Source:
> `ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`, `ai/CASHIER_FLOOR_RECONSTRUCTION_ROADMAP.md`,
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C0_REPO_VERIFICATION_REPORT.md`.

> **LOCKED (Cashier Floor-First Prompt C1 — IMPLEMENTED, 2026-07-31) — Cashier is now Floor-first.**
> The locked target above is now **implemented for C1** (frontend-only; no backend/schema/migration/
> seed/permission/Postman change). Cashier visible nav is exactly **Floor · Till · Me** (Queue +
> Receipts removed from the nav); the Floor tab uses the same canonical `floor` icon as Waiter/
> Supervisor. Default route is **`/cashier/floor`** and `/cashier` redirects there
> (`getCashierLandingPath()` → `/cashier/floor`, so login/landing goes to Floor). Cashier is the
> **third `OperationalFloor` consumer** (via `CashierFloorScreen`) — no Cashier-specific Floor card/
> grid/toolbar; the shared toolbar/search/status-filters/floor-selector/grid/cards/loading/empty/
> error/responsive behaviour is reused byte-for-byte, and **role behaviour differs only AFTER table
> selection**. Table selection uses canonical URL state `/cashier/floor?tableId=<id>` (push then
> replace, `shallow:true`; refresh/Back/Forward restore context; invalid/cross-branch id fails safe
> with a "Table unavailable" state). After selecting a table Cashier opens a **read-only, truthful
> settlement BOUNDARY** (`CashierSelectedTablePanel`, copy "Select a bill to continue.") that exposes
> **no** payment/close/split/refund/receipt/void/discount/transfer action — the architectural mount
> point C2 replaces with the real settlement workspace (**no premature payment UI**). The Floor reads
> only shared-safe data (tables + active orders + reservations via one bounded query domain); **no**
> per-table payment fetch and **no** guest name/contact/payment-reference/receipt-reference on cards.
> Cashier already holds `pos:table:read`/`pos:orders:read`/`pos:reservation:read` — **no new grant**.
> **Queue and Receipts are NOT deleted and NOT redirected in C1** — they remain **hidden compatibility
> routes** reachable only by direct URL (`/cashier/queue`, `/cashier/receipts`), removed from visible
> nav (planned retirement: Receipts C4, Queue C5). Till + Me are unchanged and unregressed. The
> previously-built payment/split/receipt/Till/refund/session/profile logic is preserved and reused.
> **Do not begin C2 or remove Queue/Receipts without explicit authorization.** Classification: **A.
> C1 COMPLETE / READY FOR C2.** Source: `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_
> REPORT.md`, `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`,
> `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C2.md`.

> **LOCKED (Cashier Floor-First Prompt C2 — IMPLEMENTED, 2026-07-31) — table→bill resolution + a
> read-only settlement workspace.** C2 replaces C1's neutral selected-table boundary
> (`CashierSelectedTablePanel`, now unused/retained) with the resolution + settlement foundation
> (frontend-only; no backend/schema/migration/seed/permission/Postman change). Selecting a table
> runs ONE bounded, branch-scoped `GET /pos/orders?tableId=&pageSize=50` and classifies results
> through the central FAIL-CLOSED helper `lib/cashier/bill-resolution.ts`
> (PAYABLE / PAYMENT_IN_PROGRESS / PARTIALLY_PAID / SETTLED / TERMINAL_READ_ONLY /
> NOT_CASHIER_SETTLEABLE / UNKNOWN_UNSAFE): **zero** payable → "No bill is available for this table."
> (+ read-only closed-bill list when present); **one** → auto-resolve into the workspace (URL gains
> `orderId`, no visible selector); **multiple** → an explicit bounded selector (`CashierBillSelector`)
> — the first is **never** auto-selected. Canonical URL state is `?tableId=&orderId=` (or `?orderId=`
> for tableless/takeaway/Find bill), refresh/Back/Forward safe, invalid/cross-branch orderId fails
> safe (bill detail is always fetched by orderId, never the wrong order). There is exactly **one**
> canonical `CashierSettlementWorkspace` (read-only: Bill / Totals / Payment state / Settlement
> readiness / History) that **reuses** the existing checkout primitives (`CashierOrderTotals`,
> `CashierPaymentSummary`, `normalizeCashierOrder`) — it exposes **no** payment/split/close/receipt/
> refund/transfer/void control, and payment state **fails closed** (unavailable is never shown as
> unpaid/zero-due). A compact Cashier-only **Find bill** dialog (`CashierFindBillDialog`) is a sibling
> ABOVE the shared `OperationalFloor` (never a fork), bounded + branch-scoped, supports tableless +
> takeaway + exact-id lookup, routes results into the same workspace via `orderId`; receipt-reference
> search is deferred to C4. Queue and Receipts remain hidden compatibility routes (not deleted, not
> redirected, not mounted on Floor). **Do not begin C3 (payment/close execution) or remove
> Queue/Receipts without explicit authorization.** Classification: **A. C2 COMPLETE / READY FOR C3.**
> Source: `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`,
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_QA_EVIDENCE_INDEX.md`,
> `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C3.md`.

> **LOCKED (Prompt 5B2, 2026-07-31) — Approvals closure: Anomaly actionable, Shift-swap Outcome C.**
> **Anomaly** Acknowledge (OPEN→ACKNOWLEDGED, note optional; row stays in Needs action) + Resolve
> (ACKNOWLEDGED→RESOLVED, note required) are live via `pos:analytics:anomalies:acknowledge`; evidence
> is preserved and the underlying order/till/payment/attendance/shift record is not mutated.
> **Shift-swap = Outcome C (user-authorized):** the workspace exposes **Reject only** (truthful —
> status + audit, no roster change) and **never an Approve control**, because a truthful atomic roster
> swap is unsupported (`ScheduleAssignment` is read-only across the whole API — no roster-mutation
> service; the request references only a date, not a specific shift; and `pos:hr:shift-swaps:approve`
> has never mutated the roster). The UI states this honestly. A real roster swap stays a deferred
> backend feature (SUP-RG-036/042). **No permission / schema / migration / seed / backend / Postman
> change.** Prompt 5 Approvals closed at **B — COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY** (no UI
> falsely claims an unsupported roster/financial effect). Source: 5B2 + Prompt 5 final reports.

## Locked technical decisions (from AI_CONTEXT / ROADMAP)

| Decision | Value | Source |
| --- | --- | --- |
| IDs | `cuid2` | AI_CONTEXT |
| Validation | `class-validator` + `class-transformer` | AI_CONTEXT |
| Auth v1 | JWT access + refresh (+ per-branch Quick PIN) | AI_CONTEXT |
| Monorepo | pnpm workspaces + Turborepo, pnpm `8.15.0`, Node ≥ 22 | package.json |
| Backend | NestJS, service-first | AI_CONTEXT |
| ORM / DB | Prisma → Neon Postgres | AI_CONTEXT |
| Frontend | Next.js **Pages Router** + React Query + Tailwind | AI_CONTEXT |
| Jobs/cache | Redis + BullMQ | AI_CONTEXT |
| Money | Decimal-safe end-to-end | AI_CONTEXT |
| Deferred hardware | MSR/badge login, smart spouts (late wave M46) | ROADMAP |

## Locked product / UI decisions

### D-NAV — Per-role navigation (locked)
- Waiter: **Floor · Reservations · Me**
- Cashier: **Floor · Till · Me** — **implemented in Prompt C1 (2026-07-31)**, default route
  `/cashier/floor`, Cashier as the third shared-`OperationalFloor` consumer. The former
  ~~Queue · Receipts · Till · Me~~ nav is superseded; Queue/Receipts survive only as **hidden
  compatibility routes** (direct URL, off the visible nav — retire Receipts C4 / Queue C5).
- Supervisor: **Floor · Reservations · Approvals · Me**
- Source: `lib/<role>/routes.ts`; `ai/SUPERVISOR_RECONSTRUCTION_*`; date 2026-07-18; Cashier target
  superseded 2026-07-31, see `ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`.

### D-NOORDERS — No visible Orders tab (Waiter & Supervisor) (locked)
Order work is reached from **Floor after a table is selected**, never as a primary
tab. Legacy `/waiter/orders*` and `/supervisor/orders` are **redirects** into Floor
(supervisor resolves `orderId`→`tableId`). Rationale: table-centric workflow; avoid
a parallel order-list surface. Source: Supervisor Reconstruction Repo Verification.

### D-FLOOR — Shared Floor parity (locked)
Waiter, Supervisor, **and Cashier (Prompt C1, 2026-07-31)** render **one**
`OperationalFloor` presentation (toolbar, grid, cards, status labels, staff formatting,
breakpoints, 176px cards). **Role behaviour diverges only after table selection**
(Cashier → C1 read-only boundary, superseded in **C2** by table→bill resolution + a
read-only settlement workspace; payment/close execution arrives C3).
Presentation is shared; data access (queries/permissions/mutations) is role-owned.
Changes to shared Floor propagate to all consuming roles. Source: Prompt 2 completion
report; Cashier C1 completion report; `components/floor/*`.

### D-SHELL — Shared operational shell (locked)
One `OperationalShell`/`OperationalHeader`/`CurrentTime`/logout/`OperationalBottomNav`
+ canonical icon registry serve all three roles via thin adapters. Source: Prompt 1.

### D-ICONS — Canonical icon registry (locked)
Icons referenced by name from `pos-shell/role-icon-config.ts` + `role-icons.ts`;
never import Phosphor directly in routes/screens; registry sizes/weights only.

### D-TAXONOMY — Manager-configured menu taxonomy (locked)
Customer browse taxonomy (`/api/menu/navigation` → groups → subgroups) is separate
from internal routing/reporting categories. The UI honours manager order/active
state and **never hard-codes fallback categories**; empty navigation shows an honest
"manager configuration" state. Internal category/tax/station/key/ID fields are not
rendered.

### D-CURRENCY — UGX, zero-fraction (locked)
Default currency UGX; one central waiter currency formatter with branch currency
context and zero-fraction rendering (fixed prior `UGX 8.5`-style bugs). Money fields
are Decimal strings end-to-end. (Gap: Supervisor formatters still hardcode UGX and
should reuse the shared formatter — SUP-RG-017.)

### D-BOUNDARY — Role boundaries (locked)
Payment collection / order close / till are **Cashier-owned**; Supervisor may only
**read** payment/order state; Waiter cannot collect payment or close. Supervisor
excludes the global `/api/approvals` (uses domain queues; lacks `approvals:*`).

### D-PRIVACY — Floor cards never show guest names (locked)
Staff names on cards are `First L.` (e.g. "Peter M."); guest identity is never on
a Floor card.

### D-PERF — Performance foundation (locked, preserve)
JWT carries roles/permissions (skip RBAC re-query); `/auth/me` reuses claims +
parallelises; branch guard caches/dedupes; session `lastActivityAt` throttled
(>60s) + fire-and-forget; API client has request IDs + bounded 30s timeout +
AbortController; secondary invalidations non-blocking; list N+1 fan-outs removed
(cashier startup ~101→~9). Source: `ai/APPLICATION_PERFORMANCE_HARDENING_COMPLETION_REPORT.md`.

## Superseded decisions (history — do NOT treat as current)

### ~~D-SUP5TAB — Supervisor 5-tab nav with a dedicated Orders screen~~ (SUPERSEDED 2026-07-18)
The original Supervisor UI (2026-07-03/06 build) shipped **Floor · Orders ·
Reservations · Approvals · Me** with a standalone Orders screen and role-specific
Floor components. **Superseded by D-NAV + D-NOORDERS + D-FLOOR.** Legacy docs that
still describe it: `Front End/supervisor_ui_docs_pack/**` and the `ai/SUPERVISOR_UI_*`
prompt reports (see `docs/DOCUMENT_INDEX.md`). Historical evidence retained.

### D-SUP-3A — Supervisor order-action foundation + safe service actions (2026-07-27)
Prompt 3A locked decisions:
- **Idle parity:** all three operational roles use the shared
  `OperationalIdleLogoutHandler`; idle constants live in `@/components/pos-shell/idle`
  (`OPERATIONAL_IDLE_TIMEOUT_MS` = 15 min, `OPERATIONAL_ACTIVITY_EVENTS`), with
  deprecated `WAITER_*` aliases retained. No role-specific idle implementation.
- **Single action-availability source:** `lib/supervisor/order-actions.ts` is the
  only place that decides an order action's visible/enabled/reason and its
  confirmation/reason/manager-PIN/idempotency requirements. UI must not
  re-implement per-button conditions.
- **Live 3A actions:** only **Request bill** and **Mark served** (both
  `pos:orders:write`). Request bill sends no body and is audit-only on the backend
  (no persisted bill state — the acknowledgment is the server's response, never a
  fabricated local state). Mark served is order-level READY→SERVED with explicit
  confirmation and optional reason.
- **Idempotency:** the idempotency-intent utility (`lib/pos-shell/idempotency.ts`)
  is foundation for Prompt 3B. It is **not** attached to request-bill/mark-served
  because those endpoints are not BG3-wrapped and do not honor `Idempotency-Key`.
  Duplicate submits are prevented via mutation-pending state instead.
- **Payment stays read-only for Supervisor** (reaffirms D-BOUNDARY).
- **transfer-server deferred/blocked:** no safe narrow, branch-scoped,
  operational-role server selector exists (only admin-gated/unfiltered tenancy
  memberships or an org-wide HR directory). It stays unavailable even in 3B until
  such a selector exists.

### D-SUP-3B1 — Supervisor split / split-items / move / merge (2026-07-27)
- **RBAC grant (user-authorized; overrode the "no permission change" rule):** the
  Supervisor role was mapped to the existing `pos:order:split`, `pos:order:merge`,
  `pos:order:move-items` permission rows in `seed.ts` and re-seeded. No Prisma
  schema/migration change; no new permission definitions. Verified live (403 → 400).
- **Split bill is non-physical:** records payable allocation groups on order
  metadata for the cashier; creates NO new orders and collects no payment. UI copy
  must reflect this (never "new orders"/"separate checks").
- **Split items** creates a NEW child order (re-send to KDS); **Move items** targets
  an existing open order; **Merge** voids the source into the surviving target and
  the workspace navigates to the survivor.
- **Idempotency:** these four endpoints ARE BG3-wrapped, so the idempotency-intent
  utility is used (Idempotency-Key attached; reused on retry, renewed on material
  change) — unlike the 3A service actions.
- **Bounded targets:** the order-target selector excludes CLOSED/VOIDED and the
  source order, paginated (page size 25) + searchable — never a full-history fetch.
  Branch/eligibility enforced server-side. Payment stays read-only; no order close.

### D-SUP-3B2 — Supervisor transfer table + Find order (2026-07-28)
- **RBAC grant (user-authorized via AskUserQuestion — "Grant + enable
  transfer-table"; overrode the "no permission change" rule):** the Supervisor role
  was granted `pos:order:transfer` in `seed.ts`. No schema/migration; re-seed to
  apply.
- **⚠️ Single-gate exposure:** `pos:order:transfer` is ONE backend permission
  gating BOTH `transfer-table` AND `transfer-server`. Enabling transfer-table for
  Supervisor therefore also makes the transfer-server endpoint API-reachable
  (audit-logged, active-same-branch-membership required) even though no UI exposes
  it. Accepted by the user. A future backend split into per-action permissions would
  let transfer-server be gated independently.
- **Transfer table is a table-only move:** the backend sets `order.tableId` and does
  NOT validate target occupancy/reservation/capacity or change table status. The UI
  surfaces honest **non-blocking** occupied/reserved warnings — it must NOT claim a
  conflict-free transfer or frontend-block a transfer the API accepts.
- **Idempotency:** transfer-table is BG3 `idempotencyMode: 'optional'` → the
  idempotency-intent utility attaches an `Idempotency-Key` (reused on retry, renewed
  on target change).
- **Canonical navigation:** on success the workspace re-anchors to the returned
  table via `router.replace` ({tableId,orderId}); source/target Floor cards update by
  reassigning the order's `tableId` in cache; no redirect loop; refresh-stable.
- **Find order is NOT an Orders tab:** a compact Supervisor-only control rendered as
  a sibling ABOVE the shared `OperationalFloor` (never a fork). Bounded/paginated
  branch lookup + status/service filters + client text filter + exact-order-ID
  fallback. The backend has NO order-number/date/free-text search (`GET /pos/orders`
  filters only; `:id` is id-only) — documented, not faked. Tableless orders open
  with `orderId` only (no fabricated table); terminal orders are read-only.
- **transfer-server — Outcome B (deferred):** no safe branch-scoped server selector
  exists (tenancy memberships need admin `tenancy:membership:manage`; HR/workforce
  lists leak PII/payroll and have nullable `userId`). Stays UI-hidden + hard-blocked.
  Minimum future contract: a `Membership`-backed endpoint returning only
  `{ userId, name, roleName, active }` for the current branch, gated by a
  Supervisor-holdable permission.

### D-SUP-3B3A — Supervisor active-order void + order-level discount request (2026-07-28)
- **No permission or backend change:** Supervisor already held `pos:orders:void`,
  `pos:discount:request`, `pos:discount:read`, `pos:discount:approve`. No Section 6
  stop condition, no seed edit, no controller/service/DTO/schema change.
- **Void is status-only and clearly bounded:** `POST /pos/orders/:id/void`
  (`pos:orders:void`, HTTP 200, NOT BG3). Valid NEW/SENT/IN_KITCHEN/READY; SERVED goes
  only to CLOSED; CLOSED/VOIDED rejected. Reason required in the UI (backend requires it
  for IN_KITCHEN/READY); no manager PIN. Backend sets `status=VOIDED` only and
  auto-releases an idle DINE_IN table. **Void is NOT a refund, NOT complimentary, NOT
  post-close void, NOT item deletion** — these terms must never be used interchangeably
  in code/UI/docs.
- **Discount request is backend-authoritative:** `POST /pos/orders/:id/discounts`
  (`pos:discount:request`, HTTP 201, NOT BG3). Type PERCENTAGE(0.01–100)/FIXED(≥0.01,
  ≤subtotal); reason required; **basis = order.subtotal (pre-tax)**. The backend
  AUTO-APPROVES when the amount is within the org threshold (default 5000) else returns
  PENDING — **amount-based, not permission-based**. The UI shows a labelled estimate and
  defers the final APPROVED/PENDING status + totals to the response (no optimistic final
  total; re-fetch the order). Response is the bare Discount (no totals).
- **Payment safety gate is UI-only and documented:** the backend does NOT check payment
  state on void or discount. The availability module adds a deliberate frontend boundary
  — both are blocked when payment state indicates money (settled/partially-paid/pending/
  failed/refunded) or cannot be confirmed (loading/errored). It never assumes "unpaid"
  on a failed payment read. This is a UI safeguard, not a claimed backend behaviour.
- **Duplicate discounts:** the backend allows multiple pending discounts (latest
  APPROVED wins); the UI blocks a second request while a PENDING one exists to prevent
  accidental duplicates.
- **Narrow invalidation:** discount request touches only order-detail + order-discounts
  + (when approved) Floor + the `["supervisor","approvals","discounts",branchId]` count.
  Never leave/shift-swap/anomaly/reservation/profile/auth/shift. The Discounts panel is
  **read-only** — no approve/reject controls (Prompt 3B3B).

### D-SUP-3B3B — Supervisor discount approve/reject + complimentary (2026-07-28)
- **No permission or backend change:** Supervisor already held `pos:discount:approve`
  (gates BOTH approve + reject — one permission), `pos:discount:request`,
  `pos:discount:read`. No stop condition, no seed edit, no controller/service/DTO/schema
  change.
- **Approve/Reject are per-discount, PENDING-only, rendered inline** on the read-only
  Discounts panel rows (only with `pos:discount:approve`). Approve (`POST /pos/discounts/
  :id/approve`, 200, not BG3) recalcs order totals (latest approved wins, tax ignored) and
  is **payment-gated**; the order must still be discountable (SERVED/terminal → 409).
  Reject (`POST /pos/discounts/:id/reject`, 200, not BG3) requires `rejectionReason` and
  **leaves totals unchanged** (so it is NOT payment-gated). Both return the bare Discount →
  re-fetch for canonical values.
- **Self-approval — Outcome B (backend PERMITS it):** the service never blocks a requester
  from approving their own discount (small ones are even auto-approved by the creator). The
  UI **matches the backend** (does not invent a stricter rule) but **surfaces a truthful
  self-approval note**. ⚠️ **Governance recommendation:** add a backend self-approval /
  maker-checker guard for stronger financial control. This is a known limitation, not a
  frontend-enforced policy.
- **Manager PIN is optional, not a separate gate:** the approve `managerPin` re-authenticates
  the approver against their OWN quick-PIN and only sets `managerPinVerified`. Not required →
  the UI does not collect it (per "do not expose manager PIN unless the endpoint requires it").
- **Complimentary = Outcome B:** no dedicated comp type exists, but `Discount.metadata (Json?)`
  is persisted AND returned by all three read endpoints (top-level `include`), and a 100%
  whole-order discount drives `total` to exactly 0. So Complimentary = a whole-order
  `PERCENTAGE value=100` discount request + `metadata { complimentary, category }` + a required
  reason (constrained category list). **Whole-order only** (no backend line-level targeting);
  it follows the discount lifecycle and **may return PENDING** above the org threshold; it is
  **NOT a void and NOT a refund**; no optimistic zero total (totals are backend-authoritative).
- **Narrow invalidation:** approve/reject/complimentary touch only order-discounts +
  order-detail (approve/comp) + Floor (approve/comp) + `["supervisor","approvals","discounts",
  branchId]` + the approval-detail key. Never leave/shift-swaps/anomalies/reservations/profile/
  auth/shift. The Approvals page keeps its existing read-only layout (not redesigned here).

## Open decisions (deferred to a future phase)

- **Backend self-approval / maker-checker guard for discounts** — recommended (currently the
  backend permits self-approval; the UI matches + flags it). See D-SUP-3B3B.
- **transfer-server** — UI-blocked until a safe narrow server selector endpoint exists (its
  endpoint is now API-reachable via `pos:order:transfer`; see D-SUP-3B2).
- **Refund, post-close void, payment collection, order close** — out of Supervisor scope
  (Cashier-owned / separate terminal workflows).
- Aggregated list-summary endpoints (payment/receipt) to reduce list latency.

## Resolved decisions

- ~~Supervisor idle-logout omission~~ — **RESOLVED (Prompt 3A, 2026-07-27):**
  SupervisorShell now injects the shared idle handler (see D-SUP-3A).
- ~~Supervisor lacks `pos:order:*` handoff perms~~ — **RESOLVED (Prompt 3B1,
  2026-07-27):** granted via seed mapping (see D-SUP-3B1).
- ~~Supervisor transfer-table deferred~~ — **RESOLVED (Prompt 3B2, 2026-07-28):**
  transfer-table live via authorized `pos:order:transfer` grant (see D-SUP-3B2).
- ~~Exception order lookup not Floor-contained~~ — **RESOLVED (Prompt 3B2):**
  the compact **Find order** Floor control opens takeaway/tableless/closed/voided/
  exception orders without an Orders tab (see D-SUP-3B2).
- ~~Supervisor active-order void + discount request deferred~~ — **RESOLVED
  (Prompt 3B3A, 2026-07-28):** both live in the Floor workspace Adjustments group;
  no permission/backend change (perms pre-existed). See D-SUP-3B3A.
- ~~Supervisor discount approve/reject + complimentary deferred~~ — **RESOLVED
  (Prompt 3B3B, 2026-07-28):** approve/reject inline on PENDING rows + whole-order
  complimentary (Outcome B) in the Adjustments group; no permission/backend change.
  See D-SUP-3B3B. (Self-approval remains backend-permitted — governance recommendation open.)
- ~~Reservation-completion contract (endpoint + `ReservationEventType.COMPLETED`
  enum + migration)~~ — **RESOLVED (Prompt 4A, 2026-07-28):** see D-SUP-4A.

---

## D-SUP-4A — Reservation lifecycle completion + active/history query architecture (2026-07-28)

**Context:** Reservations accumulated indefinitely in the operational list;
`SEATED → COMPLETED` was defined in the service state machine but unreachable,
and `list()` mixed active + terminal rows with no maximum page size.

**Decisions (locked):**
1. **Manual completion** is `POST /api/reservations/:id/complete` (200), gated by
   the pre-existing **`pos:reservation:update`** permission (already granted to
   Supervisor/Owner/Manager) — **no new permission and no seed change** (Outcome A).
   Waiter/Cashier intentionally cannot manually complete. SEATED-only, idempotent,
   atomic; completion is valid **with or without** a linked order.
2. **Automatic completion on order close** lives at the single canonical
   `OrdersService.transitionOrder()` CLOSED choke point, keyed **only** off the
   explicit `Reservation.seatedOrderId` (+`status=SEATED`) — never inferred from
   table/guest/date, and **never** in Cashier frontend code. It is retry-safe /
   idempotent; because order close is not itself transactional, completion is an
   **after-close reconciliation** — the close stays canonical and a completion
   failure is **logged, not swallowed**, leaving the reservation completable manually.
3. **All transitions are concurrency-safe** via a guarded conditional
   `updateMany({where:{id,status:{in:[from]}}})` compare-and-set.
4. **Active vs. History is separated server-side** (`scope=active|history`);
   history includes only terminal states, active only non-terminal. **No
   browser-side triple-query merge** is the target contract (Prompt 4B consumes
   scopes directly).
5. **Pagination is bounded:** default `pageSize=25`, **clamped to max 100** in the
   service (chosen over a hard `@Max` 400-reject to avoid breaking legacy callers).
6. **Overdue is derived, never persisted** (grace `OVERDUE_GRACE_MINUTES=15`, one
   canonical location); overdue enters Attention and **never** auto-transitions the
   guest outcome (no auto-NO_SHOW).
7. **Only schema change** is the `ReservationEventType.COMPLETED` enum value +
   migration `20260518000000_prompt4a_reservation_completed_event`; **not deployed
   to shared Neon in this pass**. No index migration (existing indexes suffice).
8. **No mass shared-Neon data repair** — a categorized, dry-run-first, approval-
   gated repair plan is deferred to `ai/SUPERVISOR_RESERVATION_SHARED_NEON_DATA_AUDIT.md`.
9. **Reservations UI is untouched** — the premium Reservations reconstruction is
   Prompt 4B, gated on the 4A isolated-Neon QA close.

**Known limitation:** branch timezone is not modelled → date/day boundaries use
UTC (documented).

---

## Supervisor Reservations UI (Prompt 4B) — 2026-07-28

**Decision:** Rebuild the Supervisor Reservations page as a premium master-detail
workspace on the Prompt 4A `scope=active|history` contracts; expose the full
already-permitted reservation lifecycle from the UI.

- **Four views (Arriving / Seated / Attention / History) are UI groupings, not
  persisted statuses.** Arriving/Seated/Attention derive from **one bounded
  `scope=active` query** (client derivation — no all/today/upcoming triple-fetch,
  no browser merge, no overlapping requests). History is a **separate lazy
  `scope=history` query** (server-paginated, default 25 / max 100). Default =
  Arriving + today + page 1; never All/all-dates/all-statuses/full-history/pageSize-100.
  Rationale: kills the indefinite operational-list pile-up at its root and matches
  the Prompt 4A anti-triple-query design.
- **No permission change, no backend change.** The Supervisor role already holds
  every `pos:reservation:*` permission (seed Supervisor block). Action availability
  mirrors backend `VALID_TRANSITIONS` exactly (PENDING→CONFIRMED/CANCELLED/NO_SHOW;
  CONFIRMED→SEATED/CANCELLED/NO_SHOW; SEATED→COMPLETED). No-show is **never** offered
  for SEATED and **never** automatic; Seat fabricates **no** order.
- **Attention** = server-derived overdue (grace 15 min, PENDING/CONFIRMED only) +
  structural SEATED issues (no linked order / linked-order closed / no table).
  **Individual actions only — no bulk resolution.** The 6 order-less SEATED + 55
  overdue shared records surface individually (no mass repair without approval).
- **Guest privacy:** names in list rows; contact detail only in the workspace /
  create form; no PII on Floor cards or table selectors; synthetic QA guests only.
- **Deposit boundary:** create accepts the verified optional `depositRequired`
  amount; deposits render read-only; no payment/deposit capture.
- **Cross-role invalidation is narrow:** Supervisor active/history/detail/events +
  Supervisor Floor overlay + Waiter reservations/floor only.
- **Shared-Neon gate:** manual complete + order-close auto-completion require
  migration `20260518000000_prompt4a_reservation_completed_event` on shared Neon
  (verified read-only via Neon MCP that the shared `production` enum lacks
  `COMPLETED`). All other actions + Attention/overdue work on shared today.
- **Removed** the 6 superseded read-only components (Card/List/Summary/Toolbar/
  DetailPanel/StatusBadge); replaced by the new reservations workspace components.

---

## Shared-Neon migration cutover (Prompt 4C) — 2026-07-29

**Decision:** Deploy the Prompt 4A `ReservationEventType.COMPLETED` migration + the
authorized `pos:order:transfer` seed mapping to the shared Neon `production` branch,
under an explicit authorization gate.

- **Deploy command is `db:migrate:deploy` (`prisma migrate deploy`), never `db:migrate`**
  (which is `prisma migrate dev` — unsafe on shared: shadow DB, drift reset). Prisma
  migrations require a **direct** (non-pooled) Neon connection.
- **Authorization gate before any shared write:** full read-only preflight (identity,
  migration state, enum, permissions, counts) + a **pre-migration recovery branch** must
  precede the migration. Postgres cannot drop an enum value → recovery = branch restore /
  forward-fix, not enum-value removal. The recovery branch is retained until explicit
  removal.
- **Destructive/mutation QA never runs against `production`.** It uses a disposable branch.
  A Node process is **not** isolated by swapping `apps/api/.env` alone — an inherited
  shell/profile `DATABASE_URL` overrides it (`dotenv` won't override existing env).
  Isolate by clearing that env + pointing `packages/db/.env` too, and verify with a read
  before writing.
- **Stale shared records** (6 order-less SEATED + 55 overdue) are **not** bulk-repaired;
  they surface individually in the 4B Attention view. Any repair is a separate, approved,
  dry-run-first operation.
