# Supervisor Reconstruction Gap Register

Status: Prompt 3C consolidated live-QA pass updated gap register  
Date: 2026-07-18 (updated 2026-07-28)

| ID | Area | Gap | Evidence | Recommendation |
|---|---|---|---|---|
| SUP-RG-001 | Nav | Resolved in Prompt 1: Orders is absent from visible Supervisor navigation. | Four-tab route assertion and authenticated shell QA passed. | Keep `/supervisor/orders` compatibility-only. |
| SUP-RG-002 | Floor | Resolved in Prompt 2: Supervisor and Waiter share one Floor presentation tree. | Shared imports, executable assertions, and equal four-viewport geometry. | Keep data access role-owned and presentation shared. |
| SUP-RG-003 | Floor | Resolved in Prompt 2: selection opens the responsive Supervisor table-control workspace. | URL/history browser QA and one-workspace assertion passed. | Expand only through later verified action prompts. |
| SUP-RG-004 | Orders | Resolved in Prompt 3B2: **Find order** is a Supervisor-only compact control above the shared Floor (not an Orders tab) covering tableless, takeaway, closed, voided, direct-reference, and post-close review via a bounded page + exact-id fallback. | `SupervisorFindOrderDialog.tsx`; `GET /api/pos/orders` (page 25) + `GET /api/pos/orders/:id`. | Backend has no order-number/date-range/free-text search — accept bounded lookup until a search contract exists. |
| SUP-RG-005 | Orders | Further resolved in Prompt 3B2: **Transfer table** is live behind Floor selection (`pos:order:transfer`, BG3 optional idempotency, bounded branch-scoped target selector with non-blocking occupied/reserved warnings, source+target cache reassignment, URL re-anchor). Prompt 3B1 shipped split/move/merge; Prompt 3A shipped Request bill + Mark served. | `lib/supervisor/transfer-table.ts`, `SupervisorTableTargetSelector.tsx`, `SupervisorTransferTableDialog.tsx`, authenticated endpoint QA (PENDING). | Wire remaining actions (transfer-server, discount approve/reject, complimentary, refund, post-close void) in Prompt 3B3B on the same foundation. |
| SUP-RG-026 | Orders | Resolved in Prompt 3B3A: **Active-order void** is live in the Floor **Adjustments** group (`POST /api/pos/orders/:id/void`, `pos:orders:void`, HTTP 200, not BG3; shared danger confirm, reason required). Backend sets `status=VOIDED` only + auto-releases an idle DINE_IN table; explicitly distinct from refund/complimentary/post-close void. No permission/backend change (Supervisor already held the grant). | `lib/supervisor/order-financials.ts`, `SupervisorVoidOrderDialog.tsx`; authenticated void QA (PENDING). | Keep post-close void (`pos:void:postclose`) and refund (`pos:refund:create`) separate — do not conflate with active-order void. |
| SUP-RG-027 | Orders | Resolved in Prompt 3B3A: **Discount request** is live in the Floor Adjustments group (`POST /api/pos/orders/:id/discounts`, `pos:discount:request`, HTTP 201, not BG3; basis = order subtotal). Backend amount-based auto-approval within `OrgSettings.discountApprovalThreshold` (default 5000) returns APPROVED else PENDING; the UI shows a labelled estimate and defers the final status/totals (no optimistic final total). A read-only **Discounts** panel lists history (`GET .../discounts`, `pos:discount:read`). No permission/backend change. | `lib/supervisor/order-financials.ts`, `SupervisorDiscountRequestDialog.tsx`; authenticated discount QA (PENDING). | Discount approve/reject resolved in Prompt 3B3B (SUP-RG-028); the Approvals **page** remains read-only. |
| SUP-RG-028 | Orders | Resolved in Prompt 3B3B: **Discount approve/reject** are live as **inline Approve/Reject controls on PENDING discount rows** in the read-only Discounts panel (shown only with `pos:discount:approve` and when order-level availability permits). Approve (`POST /api/pos/discounts/:id/approve`, HTTP 200, not BG3) is PENDING-only (else 409, order must stay discountable), recalcs order totals (latest approved wins) and is **payment-gated** in the UI; optional `{ managerPin? (<=8) }` re-auths the approver's own PIN (UI does not collect it). Reject (`POST /api/pos/discounts/:id/reject`, HTTP 200) requires `{ rejectionReason (<=500) }`, leaves totals unchanged and is **not** payment-gated. **No permission/backend change** (Supervisor already held `pos:discount:approve`). Narrow invalidation of the discount approvals domain only; the Approvals page keeps its read-only layout. | `lib/supervisor/order-financials.ts`, `SupervisorApproveDiscountDialog.tsx`, `SupervisorRejectDiscountDialog.tsx`; authenticated decision QA (PENDING). | Keep decisions in the order workspace; do not redesign the read-only Approvals page here. See SUP-RG-030 for the self-approval governance recommendation. |
| SUP-RG-029 | Orders | Resolved in Prompt 3B3B (**Outcome B**): **Complimentary** is live in the Adjustments group. No comp `DiscountType` exists (PERCENTAGE\|FIXED), so it is a whole-order `PERCENTAGE value=100` discount request (`POST /api/pos/orders/:id/discounts`, `pos:discount:request`) + `metadata { complimentary:true, category }` (persisted and returned by the discount reads) + a required reason from a constrained category list. Whole-order only (no backend line-level targeting); may return PENDING above the org threshold (default 5000); payment-gated; shows a labelled estimate (no optimistic zero total); it is **not** a void and **not** a refund. | `lib/supervisor/order-financials.ts`, `SupervisorComplimentaryDialog.tsx`; authenticated comp QA (PENDING). | If a dedicated comp type/line-level comp is ever needed, add a backend contract; until then the whole-order metadata approach is the honest option. |
| SUP-RG-030 | Governance | **Open (recommended):** the backend **permits a requester to approve their own discount** (no maker-checker guard). The 3B3B UI **matches** the backend (it does not invent a stricter block) but surfaces a truthful self-approval note. | No self-approval guard on `POST /api/pos/discounts/:id/approve`; UI flags but does not enforce. | Add a backend self-approval / maker-checker guard (approver ≠ requester) to strengthen control; documented as an open recommendation, **not** an enforced policy. |
| SUP-RG-031 | RBAC / Deploy | **Open on shared Neon only (proven correct on the isolated DB in Prompt 3D):** the Supervisor role **lacks `pos:order:transfer` on the shared Neon database**, so Transfer table would 403 there until `db:seed` is applied. **Prompt 3D confirmed the mapping is correct and complete** — on a fresh disposable DB seeded from the repo, Supervisor `HAS_TRANSFER=true` and transfer-table returns 200 end-to-end. This is purely a **seed-application step on Neon, not a code/data defect.** | Prompt 3C: shared-Neon `/auth/me` LACKS transfer + live 403. Prompt 3D: isolated DB `/auth/me` HAS transfer + transfer-table 200 (matrix) + idempotent replay. | Before a Neon-backed demo, run `corepack pnpm@8.15.0 db:seed` against Neon (idempotent, additive) — or insert one `role_permissions` row (roleId × `pos:order:transfer`). No schema/migration. |
| SUP-RG-032 | Backend / Discounts | **RESOLVED in Prompt 3D (defect found by live QA + fixed):** `GET /api/pos/orders/:id/discounts?pageSize=N` (and `?page=N`) returned **400** because `ListOrderDiscountsQueryDto` typed `page`/`pageSize` as numbers with `@IsInt` but lacked `@Type(() => Number)` — the global ValidationPipe transforms but does not implicitly convert query strings. The Supervisor **Discounts panel** calls this endpoint with `?pageSize=50`, so its read (list + inline Approve/Reject + complimentary metadata) was broken at runtime. | Live isolated-stack QA: `?pageSize=50` → 400 ("pageSize must be an integer number"); no-param → 200. | **Fixed:** added `@Type(() => Number)` to both fields (mirrors `list-orders-query.dto.ts`); now 200 and complimentary metadata round-trips. Focused Jest spec `list-order-discounts-query.dto.spec.ts` (6 tests) added. No contract/Postman change. |
| SUP-RG-025 | Orders | transfer-server unavailable (Outcome B): no safe branch-scoped server selector — tenancy memberships need admin `tenancy:membership:manage` (Supervisor lacks it) and HR/workforce lists leak PII/payroll with nullable userId. | ⚠️ `pos:order:transfer` is a single backend permission gating **both** transfer-table and transfer-server, so granting it makes the transfer-server endpoint API-reachable (audit-logged, active-same-branch membership required) though no UI exposes it. | Add a Membership-backed endpoint returning only `{ userId, name, roleName, active }` for the current branch, gated by a Supervisor-holdable permission, before exposing transfer-server. |
| SUP-RG-006 | Payments | Supervisor could drift into Cashier workflows. | Payment/till endpoints exist but role boundary excludes checkout. Prompt 3B3A adds a **UI-only** payment safety gate: the availability module blocks void + discount request when payment state indicates money (settled/partially-paid/pending/failed/refunded) or can't be confirmed (loading/errored) — it never assumes "unpaid" on a failed read. This is a frontend safeguard, **not** a backend guarantee (the void/discount endpoints do not check payment state). | Read payment state only; keep collection/close/till in Cashier unless explicitly approved. Keep the UI payment gate on financial adjustments. |
| SUP-RG-007 | Reservations | Active and historical rows pile up together. | UI merges all/today/upcoming and defaults to all. | Split Active, Today, Upcoming, Deposit watch, and History. |
| SUP-RG-008 | Reservations | No verified complete endpoint. | Service transition mentions SEATED to COMPLETED; controller endpoint not verified. | Add backend contract later or render completion as unavailable. |
| SUP-RG-009 | Reservations | No `ReservationEventType.COMPLETED`. | Prisma enum lacks completion event. | Schema/migration required before auditable completion. |
| SUP-RG-010 | Reservations | Completed rows are not counted as terminal in current frontend count helper. | Terminal helper excludes COMPLETED in one count path. | Normalize terminal statuses as COMPLETED, CANCELLED, NO_SHOW. |
| SUP-RG-011 | Approvals | Mixed domains lack a common lifecycle model. | Discounts, leave, swaps, anomalies are normalized separately into one list. | Introduce domain action model and terminal state handling. |
| SUP-RG-012 | Approvals | Decision actions are not wired. | UI says approve/reject/review/acknowledge/resolve unavailable. | Wire domain actions in one prompt after UX confirmation. |
| SUP-RG-013 | Approvals | Refund queue unavailable. | Only order-level refund history and refund detail verified. | Keep unavailable until pending-refunds list endpoint exists. |
| SUP-RG-014 | Approvals | Post-close void candidate queue unavailable. | Execution endpoint exists; no candidate read endpoint. | Keep unavailable until safe candidate queue exists. |
| SUP-RG-015 | Approvals | Global approvals remains blocked. | Supervisor lacks `approvals:*`; UI excludes `/api/approvals`. | Continue domain-specific model. |
| SUP-RG-016 | Identity | Cards fall back to raw IDs. | Order/table/anomaly display fallbacks use ids when includes are absent. | Improve projections or frontend display model. |
| SUP-RG-017 | Formatting | Supervisor money formatting is separate and hardcodes UGX. | Supervisor order/approval formatters duplicate currency logic. | Reuse shared currency formatter with branch context. |
| SUP-RG-018 | Shell | Waiter, Cashier, Supervisor shells are similar but separate. | Header/readiness/nav implementations are role-specific. | Extract shared shell primitives. |
| SUP-RG-019 | Icons | Equivalent concepts use different icons. | Floor uses `SquaresFour` and `GridFour`; warnings vary. | Add shared icon registry. |
| SUP-RG-020 | Session | Resolved in Prompt 3A: SupervisorShell injects the shared `OperationalIdleLogoutHandler`; idle constants moved to `@/components/pos-shell/idle` (15-min timeout preserved). | prompt3a assertions + shell parity. | Keep one shared idle mechanism; no role-specific idle implementations. |
| SUP-RG-021 | Shift swaps | Create remains unavailable due selector contract. | DTO requires target employee; no eligible target endpoint verified. | Keep read/review only until selector endpoint exists. |
| SUP-RG-022 | Postman | No Supervisor reconstruction collection exists. | Existing collections cover backend domains but not reconstructed UI flow. | Add/update only once action flows are implemented. |
| SUP-RG-023 | Demo data | Reservation CSV contains many active/historical rows. | 57 COMPLETED, 50 CONFIRMED, 8 PENDING, 5 SEATED. | Use lifecycle UI split instead of deleting data. |
| SUP-RG-024 | Docs | Resolved for current reconstruction docs: four-tab nav and shared Floor are documented. | Prompt 1-2 docs and completion reports. | Historical documents remain evidence only. |

## Prompt 4B closure — Reservations UI (2026-07-28)

Prompt 4B (Reservations page reconstruction) **closes the reservations-UI gaps** below.
The old read-only page (triple all/today/upcoming fetch + browser merge, pageSize 100)
is replaced by a master-detail workspace on the Prompt 4A `scope=active`/`scope=history`
contracts: four UI **views** (Arriving/Seated/Attention from one bounded `scope=active`
query; History lazy `scope=history`), URL-persisted state, and lifecycle actions
(create/confirm/assign/seat/cancel/no-show/manual-complete) wired to already-verified
endpoints with **no permission and no backend change** (Supervisor already held all
grants). Availability mirrors backend `VALID_TRANSITIONS`; terminal rows read-only;
Attention = server overdue + structural SEATED inconsistencies, individual actions only.

| ID | Status after Prompt 4B | Residual |
|---|---|---|
| SUP-RG-007 | **Closed.** Active/historical rows no longer pile up — Arriving/Seated/Attention (one `scope=active` query, no browser merge) + separate lazy History; default view = Arriving, current date, page 1. | None. |
| SUP-RG-008 | **Closed (UI wired).** Manual complete (`POST /api/reservations/:id/complete`, `pos:reservation:update`, SEATED→COMPLETED) is verified (Prompt 4A) and now exposed in the UI. | Errors on **shared Neon** until the `COMPLETED`-event migration deploys (see SUP-RG-033). |
| SUP-RG-009 | **Closed in code; deploy residual.** `ReservationEventType.COMPLETED` + migration `20260518000000_prompt4a_reservation_completed_event` exist. | **Unapplied on shared Neon `production`** — enum still lacks `COMPLETED`. Tracked as SUP-RG-033. |
| SUP-RG-010 | **Closed.** Terminal statuses normalized as COMPLETED/CANCELLED/NO_SHOW in the History view and grouping helpers. | None. |
| SUP-RG-033 (new) | **Open on shared Neon only:** manual complete + auto-completion-on-order-close **error on shared Neon** because migration `20260518000000` is unapplied (verified read-only via Neon MCP). All other reservation actions (create/confirm/assign/seat/cancel/no-show) and Attention/overdue work on shared today. | Deploy the migration to shared Neon before a Neon-backed demo of completion; all other Prompt 4B flows are demo-safe now. |

**Deferred (unchanged):** deposit capture / payment collection remain out of scope
(deposits are read-only; create takes an optional `depositRequired` amount only). Live
authenticated browser + 4-viewport execution and the disposable-branch mutation run
remain the outstanding QA gate (no API/DB/browser stack in this environment).

## Prompt 4C closure — shared-Neon migration cutover (2026-07-29)

Prompt 4C (shared-Neon deployment + QA closure, built on Prompt 4A/4B) **closes the two
shared-Neon deploy residuals** below. Under explicit user authorization, migration
`20260518000000_prompt4a_reservation_completed_event` was deployed to the shared Neon
`production` branch with `prisma migrate deploy` (repo script `db:migrate:deploy`), and an
idempotent user-authorized `db:seed` was applied. Net shared-Neon change: **+1 migration**
(COMPLETED enum) and **+1 role_permission** (`pos:order:transfer`, role_permissions
835→836); reservation data unchanged (126). A pre-migration Neon recovery branch is
retained (Postgres enum values cannot be dropped).

| ID | Status after Prompt 4C | Residual |
|---|---|---|
| SUP-RG-031 | **Closed.** `db:seed` on shared Neon added the Supervisor `pos:order:transfer` mapping (+1 role_permission), so **Transfer table** now returns 200 on shared Neon instead of 403. The mapping was already proven correct on an isolated DB in Prompt 3D; this applied the pending seed step to Neon. | None. |
| SUP-RG-033 | **Closed.** Migration `20260518000000` deployed to shared Neon `production` via `db:migrate:deploy`; enum `ReservationEventType` now contains `COMPLETED` (verified via Neon MCP: recorded in `_prisma_migrations`, finished/not rolled back, checksum matches repo, 10 enum values, 58 migrations / 0 rolled back). **Manual complete + auto-completion-on-order-close now work on shared Neon** — Prompt 4 reservations is demo-ready on shared. | None (deploy applied). |
| SUP-RG-008 | **Fully closed** (was: "errors on shared until migration"). Manual complete now works on shared Neon post-4C. | None. |

**Durable safety fix:** shared/production deploys must use `db:migrate:deploy` (`prisma
migrate deploy`); the repo `db:migrate` script = `prisma migrate dev`, which is **unsafe**
on shared/production (shadow DB, drift reset) — corrected in the deployment-readiness doc.

**Still open — live-browser-QA gate (SUP-RG, carried forward):** the disposable-branch
live-API matrix + Playwright four-viewport browser run were **not** completed. An isolation
slip (a shell/profile `DATABASE_URL` overrode the swapped `.env`, so an isolated API
connected to production) was caught by the isolation check after it created ONE marked QA
reservation on production, which was then deleted (user-authorized), restoring production
to exactly 126 reservations / 12 events. Per user decision Prompt 4C was closed at **B**;
the lifecycle stays proven by 67/67 reservation+order Jest tests + the compiled Prompt 4B
Playwright suite (72 tests × 4 viewports). Live browser/API execution against a
properly-isolated stack remains the outstanding QA gate. Web typecheck + lint + build pass;
Postman 56/56 parse; `git diff --check` clean; no code change; no commit/push.
