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

## Prompt 4D closure — isolated live QA + fail-closed isolation (2026-07-29)

Prompt 4D **closes the carried-forward live-browser-QA gate** and adds durable isolation
tooling. Classification **B. COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY**; no commit/push.

| ID | Status after Prompt 4D | Residual |
| --- | --- | --- |
| Live-browser-QA gate | **Closed.** Fail-closed isolation tooling (`tools/qa/`: env-isolation lib, DB-identity preflight using the API's own Prisma client, launcher = denylist→preflight→spawn) built and executed. Denylist proven (shared endpoint `ep-empty-paper-a4sogjap` rejected exit 1 no-connect; disposable `ep-frosty-firefly-a4rfugz9` passed). Live reservation mutation matrix **53/53** (local) / 51/53 (disposable Neon, both anomalies diagnosed). Playwright 9 specs × 4 viewports **actually executed** against the isolated local stack; core specs pass; first-run spec fragilities found & fixed. Shared Neon verified untouched (126/12/0-QA). | Residual dev-mode/single-worker Playwright timing + page-local `openReservationByName` can flake individual specs (test-harness, not product). |
| SUP-RG-034 (new) | **Open (recommended, non-blocking):** concurrent *identical* reservation creates can 500 (reservation-number read-increment race vs. `@@unique([branchId, reservationNumber])`) instead of a graceful 409. Surfaced by live QA. The Create UI single-submit-guards; no normal path fires two identical concurrent creates. | Backend hardening (retry / catch P2002 → 409) recommended; out of Prompt 4D scope (backend contract change). |
| Auto-completion live end-to-end | **Partially closed.** Proven by Jest 67/67 + the 4C shared-Neon cutover; not re-driven through the full live Cashier payment/close flow in 4D (Cashier-owned `pos:orders:close`; Supervisor 403 by design). | Optional: drive an end-to-end Cashier close → SEATED-reservation auto-complete in a future live pass. |

**No backend/DTO/schema/migration/seed/permission/Postman change in 4D.** Changes: `tools/qa/*`
(new), env-overridable `apps/web/playwright.config.ts`, reservations E2E spec selector fixes, and
docs. Recovery branch `br-dawn-truth-a4zjs1p7` retained; disposable Neon QA branch deleted.

## Prompt 5A closure — Approvals backend/contract/QA foundation (2026-07-30)

Prompt 5A (Approvals domain audit + lifecycle hardening + queue/identity contracts + isolated
live QA) **closes the Approvals-lifecycle gaps** below. Classification **A — COMPLETE / READY FOR
PROMPT 5B**. No permission/schema/migration/seed/Postman change; no commit/push. Live-verified on a
disposable Neon branch (API matrix 29/29 + Playwright smoke 8/8); shared `production` untouched.

| ID | Status after Prompt 5A | Residual |
| --- | --- | --- |
| SUP-RG-011 | **Closed (foundation).** The four domains keep their **own canonical lifecycle statuses**; Prompt 5A adds the domain-specific Needs-action/Resolved/History **groupings** (UI-only, over real statuses) in `lib/supervisor/approvals-contract.ts` + `APPROVAL_LIFECYCLE`. No generic status model imposed. | 5B renders the workspace on these contracts. |
| SUP-RG-012 | **Verified wired (backend).** All four decision actions work live (approve/reject discount, review leave, approve/reject swap, acknowledge/resolve anomaly) — matrix 29/29. Prompt 5A hardened them (branch isolation + concurrency); the Approvals **page** stays read-only until 5B wires the UI. | 5B adds the decision UI on the verified endpoints. |
| SUP-RG-016 | **Mitigated (API + contract).** Identity relations are included server-side (no N+1); anomaly **list** now includes `actorUser`; `ApprovalMinimalIdentity` + resolvers guarantee names, never a raw UUID title; `approvalSupportReference()` truncates ids for support-only display. | 5B must render the reference/title via the identity helpers (the current read-only page's UUID-as-title is a 5B render fix). |
| SUP-RG-021 | **Unchanged (out of 5A scope).** Shift-swap **create** still needs an eligible-target selector endpoint; 5A covers decisions only, not create. | Deferred — create UI remains a future item. |
| SUP-RG-030 | **Unchanged.** Discount self-approval remains backend-permitted; UI flags it. A maker-checker guard is still a recommended future control. | Deferred. |
| SUP-RG-035 (new) | **Open (non-blocking, documented).** **Discounts have no branch-wide list endpoint** (only `/pos/discounts/pending` + per-order), so a discount **Resolved/History** queue cannot be shown branch-wide without a new backend endpoint. | Add a branch-scoped discount list endpoint if 5B needs discount history; otherwise discount shows Needs-action only. |
| SUP-RG-036 (new) | **Documented (by design).** **Shift-swap approve performs no roster reassignment** — it writes status + audit only (the existing domain contract). A real "swap executes the schedule change" is a future backend feature. | Deferred backend feature. |
| SUP-RG-037 (resolved in 5A) | **Fixed.** Leave/shift-swap list DTOs were **unbounded** (`@IsNumberString` skip/take, no max) — an unbounded-history read. Now coerced + `@Max(100)` + service clamp; anomaly already bounded. Verified live (take/limit=101 → 400). | None. |
| SUP-RG-038 (resolved in 5A) | **Fixed.** Shift-swap approve + anomaly ack/resolve looked up by `orgId` only → a **same-org cross-branch** decision surface. Now `branchId`-scoped; verified live (other-branch decision → 404). Leave stays intentionally org-scoped. | None. |
| SUP-RG-039 (resolved in 5A) | **Fixed.** All four decision writes were check-then-act (race window). Now status-guarded conditional `updateMany` claims; duplicate/concurrent decisions → 409/400, no duplicate mutation or audit. Verified live. | None. |
| SUP-RG-035 (addressed in 5B1 UI) | **Handled in UI.** The premium Approvals workspace omits Discounts from Resolved/History and shows a truthful "Historical discount decisions are available from the related order" notice if the scope is forced via URL. The underlying backend gap (no branch-wide discount list) remains open. | Add a branch-scoped discount list endpoint in a future prompt to enable branch-wide discount history. |
| SUP-RG-040 (new, 5B1 live QA) | **Open (pre-existing backend, non-blocking).** `POST /pos/orders` returns **500** on a heavily-populated branch — `generateOrderNumber` collides on `unique(branch_id, order_number)` (same class as SUP-RG-034's reservation-number race). Surfaced when the 5B1 discount fixture tried to create orders on the production fork; QA discounts were instead seeded via SQL on existing unpaid orders. Not a Prompt 5B1 defect. | Harden order-number generation (retry/transaction/sequence) in a backend prompt. |
| SUP-RG-041 (resolved in 5B2) | **Anomaly actioned.** Anomaly **Acknowledge** (OPEN→ACK, note optional; row stays actionable) + **Resolve** (ACK→RESOLVED, note required) are now live in the Approvals workspace via the canonical `pos:analytics:anomalies:acknowledge`-gated endpoints; verified live (ack 200, resolve 200, dup/stale 400, resolve-from-OPEN 400) + browser QA. Evidence is preserved; the underlying entity is not mutated. | None. |
| **SUP-RG-042** (new, 5B2 — Shift-swap **Outcome C**) | **Open (by design, user-authorized).** Shift-swap **approval with a truthful roster effect is not available from Approvals**: `ScheduleAssignment` is **read-only across the entire API** (no create/update/delete/reassign path — assignments are only seeded), the request references only a `shiftDate` (no specific-shift FK → `findFirst` ambiguity), there is no role-compat/conflict/lock infrastructure, and `pos:hr:shift-swaps:approve` has never mutated the roster (SUP-RG-036 deferred it). The UI therefore exposes **Reject only** (truthful — status + audit, **0 roster rows touched**, verified) with honest copy "schedule reassignment is not supported"; **no Approve control**. | A real atomic roster swap is a future backend feature (new roster-mutation service + a specific-shift reference on the request + role/conflict checks + an explicit permission decision). Until then, keep Reject-only. |

## Final closure — integrated final QA (2026-07-31)

Classification **B — COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY.** Every open item above was
re-verified live in one integrated pass (four viewports, isolated stack — disposable Neon branch
for API matrices, local Docker Postgres for the browser suite). See
`ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md` and
`ai/SUPERVISOR_FINAL_KNOWN_LIMITATIONS.md` for the full reconciled register.

| ID | Status after final closure | Residual |
| --- | --- | --- |
| SUP-RG-034 | **Reconfirmed live, unchanged.** The reservation-number race still returns 500 instead of 409 under concurrent identical creates. Non-blocking (Create UI single-submit-guards). | Backend hardening still recommended, still out of scope for a frontend-only pass. |
| SUP-RG-035 / SUP-RG-030 / SUP-RG-025 (transfer-server) / SUP-RG-036 / SUP-RG-042 | **All reconfirmed live, unchanged.** No new backend contract was added or needed to close these — they remain honest, documented, non-blocking limitations or intentionally deferred backend features. | See `ai/SUPERVISOR_FINAL_KNOWN_LIMITATIONS.md` for the full classification of each. |
| (new) Leave-scoping documentation wording | **Closed (documentation-only fix).** `docs/KNOWN_LIMITATIONS.md`'s "leave stays org-scoped" note was imprecise about what a Supervisor actually sees — the Approvals list is branch-filtered in practice even though `LeaveRequest.branchId` is nullable at the schema level. Corrected wording, no code change. | None. |
| (new) Two test-harness defects | **Fixed, verified across all 4 viewports.** A multi-role `uiLogin` session race (fixed in `supervisor-prompt3/fixtures.ts`) and a reservation-create test asserting nonexistent validation copy while conflating native date-input blocking with app-level validation (fixed in `supervisor-reservations/create-reservation.spec.ts`, split into two correctly-scoped tests). Both are test-infrastructure only — zero product-code changes. | None. |
| (new) Windows Chromium worker-crash pattern under Neon-branch-latency browser automation | **Mitigated.** Root-caused further than Prompt 4D's finding: sustained 20–27s/test round-trips against a scale-to-zero disposable Neon branch triggered a `STATUS_STACK_BUFFER_OVERRUN` Chromium worker-crash cascade after ~10–30 tests on this Windows host. Added Chromium stability launch flags to `playwright.config.ts`; primary fix is using the already-documented local-Docker-Postgres path for any future sustained browser run. | None blocking; keep using the local Docker path for browser QA on Windows hosts. |

**No new gap was introduced by the final closure pass.** Manager reconstruction remains the next
major track (not started).
