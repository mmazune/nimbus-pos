# Supervisor Reconstruction — Prompt 5A Completion Report
## Approvals domain audit, lifecycle hardening, identity, queue contracts, and isolated live QA

**Final status: A — COMPLETE / READY FOR PROMPT 5B**
Date: 2026-07-30 · No commit · No push

---

### 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). The forbidden `C:\Users\arman\Desktop\NIMBUS\nimbus-pos` was not used.

### 2. Initial git status
Branch `main`, **working tree clean (0 uncommitted changes)** at start — all prior-wave work already committed; nothing in-flight to preserve. The twelve intentional Floor deletions remain absent (not reintroduced). No `reset`/`restore`/`stash`/`clean`/`checkout --` was run.

### 3. Neon MCP verification
Neon MCP used throughout, **read-only on shared** except a purpose-built disposable branch. Project `nimbus-pos` (`empty-glade-26849299`, aws-us-east-1, pg17).

### 4. Shared branch baseline
`production` `br-holy-darkness-a4fg93r2`: **58 migrations / 0 rolled back / 836 role_permissions / 126 reservations** at start — identical at end (verified). Recovery branch `br-dawn-truth-a4zjs1p7` retained, untouched.

### 5. Disposable branch identity
`br-polished-river-a4ep8bn0` (`prompt5a-approvals-qa-20260730`), forked from `production`, endpoint `ep-little-bread-a4tsyemf`, auto-expiry 2026-07-31T18:00Z.

### 6. Isolation verification
Fail-closed `tools/qa/run-isolated-api.mjs`: explicit child-env (inherited DB keys stripped) → denylist (expected `ep-little-bread-a4tsyemf`, forbidden shared endpoints) → DB-identity preflight (Prisma connect + `_p4d_qa_sentinel` marker `P5A-QA-20260730` + required migration + `COMPLETED` enum + demo branch row) → only then spawn API. `/api/health` → `{status:ok, db:ok}`.

### 7. Documents read
CLAUDE.md (root + `.claude`), PROGRESS.md, the reconstruction ROADMAP/GAP_REGISTER, `docs/supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`, the Prompt 4A–4D reports, plus the actual controllers/services/DTOs/schema/seed (code is authoritative).

### 8. Schema findings
No schema change made or needed. Verified: `discounts` (order-scoped, branch+org, `[branchId,status]` index), `leave_requests` (org-scoped, **nullable** branch_id, `[orgId,branchId,status]`), `shift_swap_requests` (branch+org required, `shiftDate` is a bare date not a FK), `anomaly_events` (branch+org required, `acknowledgedBy` reused for ack+resolve, no separate `resolvedById`, `[branchId,type,status]`). Enums: `DiscountStatus{PENDING,APPROVED,REJECTED}`, `LeaveRequestStatus`/`ShiftSwapStatus{…,CANCELLED}`, `AnomalyEventStatus{OPEN,ACKNOWLEDGED,RESOLVED}`. Leave/swap live in the **attendance** module (not hr/workforce); anomalies in **analytics**. `employees` has **no `display_name`** column (names via first/last).

### 9. Migration findings
58 applied / 0 rolled back on shared; **no new migration** created or deployed. No index migration proposed (existing composite indexes `[branchId,status]` / `[orgId,branchId,status]` / `[branchId,type,status]` already cover the queue queries — verified against the query shapes; no proven deficiency).

### 10. Permission findings
Verified live on shared: Supervisor holds `pos:discount:approve`+`:read`, `pos:hr:leave:review`+`:read`, `pos:hr:shift-swaps:approve`+`:read`, `pos:analytics:anomalies:acknowledge`+`:read` — and does **NOT** hold `approvals:read`/`approvals:decide`. Each decision permission gates BOTH the positive and negative decision. **No permission added, changed, or requested.**

### 11. Shared data audit
See `ai/SUPERVISOR_APPROVALS_SHARED_NEON_DATA_AUDIT.md`. Highlights: queue counts (leave PENDING 9, swap 8, anomaly OPEN 7/ACK 8/RESOLVED 6, discount 6); **all orphan/null-identity checks = 0** (clean identity data); 27/40 employees have no login user (expected, names still resolve); 6 RESOLVED anomalies lack resolution notes (seed provenance); no duplicate decision audits. **No shared write.**

### 12. Endpoint inventory (verified live)
Discount: `GET /pos/discounts/pending`, `GET /pos/discounts/:id`, `POST …/:id/approve|reject`, `POST /pos/orders/:id/discounts`, `GET /pos/orders/:id/discounts`. Leave: `POST/GET /hr/leave`, `PATCH /hr/leave/:id/review`. Shift-swap: `POST/GET /hr/shift-swaps`, `PATCH /hr/shift-swaps/:id/approve`. Anomaly: `GET /analytics/anomalies(/:id)`, `PATCH …/:id/acknowledge|resolve`. Generic `unified-approvals` (`/api/approvals*`, incl. `POST /:id/decide`) exists but Supervisor lacks its permission → **not** the Supervisor path.

### 13. Identity architecture
Names are primary. Backend list endpoints already `include` identity relations (leave: employee+requestedBy+reviewedBy; swap: requester+target+approvedBy) — **no N+1**. **Added** a minimal `actorUser` projection to the anomaly **list** include (it previously resolved only in detail). New FE contract type `ApprovalMinimalIdentity` + `identityFromUser/Employee` resolvers reuse the existing name logic.

### 14. Identity fallback behaviour
`displayName` → name → email/employeeCode → "Requester/Employee unavailable" → "Unknown staff member"; raw ids only via `approvalSupportReference()` (truncated, support context). UUID is never a row title. On current shared data 0 rows hit the unknown fallback.

### 15–22. Lifecycle findings
- **Discount** (§15/§16): PENDING→APPROVED/REJECTED preserved; order eligibility + payment-safety + recalc-on-approve + complimentary metadata intact; self-approval still backend-permitted (UI flags). Now concurrency-safe (atomic conditional claim → duplicate approve returns **409**). No duplicate mutation logic added — 5B reuses the same canonical endpoints.
- **Leave** (§17/§18/§19): PENDING→APPROVED/REJECTED, org-scoped by design (nullable branch). Review made atomic; duplicate review → 400/409; rejected requests retained (History). No payroll/balance/coverage side effects.
- **Shift-swap** (§20/§21/§22): PENDING→APPROVED/REJECTED. Now **branch-scoped** (lookup+claim include branchId) and atomic. No roster reassignment occurs on approve (documented — the domain contract writes status+audit only). Duplicate → 400/409; other-branch decision → **404**.
- **Anomaly** (§23/§24/§25/§26): OPEN→ACKNOWLEDGED→RESOLVED. Acknowledge ≠ resolve; resolve requires notes and requires ACKNOWLEDGED first. Now **branch-scoped** + atomic. Underlying till/order/payment/attendance records are not mutated by ack/resolve.

### 23. Anomaly domain findings
3-state lifecycle with a single reviewer field reused for ack+resolve and a single `resolutionNotes` field. Anomaly types span till/order/payment/attendance/etc.; the queue exposes only operational fields.

### 24. Acknowledgement & 25/26 resolution lifecycle
Acknowledge keeps the row in Needs-action (in-progress lane); resolve moves it to History. Both hardened for branch-scope + concurrency; resolve-without-notes rejected.

### 25. Queue architecture
**Domain-specific (Option B)** — the smallest architecture that avoids duplicated lifecycle logic and preserves per-domain permissions/DTOs. No generic mutation endpoint added; the read-only aggregation stays permission-gated away from Supervisor.

### 26/27/28. Needs-action / Resolved / History contracts
UI groupings over real statuses (`apps/web/src/lib/supervisor/approvals-contract.ts`): `APPROVAL_LIFECYCLE` maps each domain's active/in-progress/terminal statuses; `buildApprovalQueueQuery` emits correct per-domain params (leave/swap `skip`/`take`, anomaly `offset`/`limit`, discount `/pending`), with `dateFrom`/`dateTo` History windows now supported server-side on leave/swap/anomaly. **Contract gap documented:** discounts have no branch-wide list endpoint (only `/pending` + per-order), so discount Resolved/History is not a branch-wide queue without a new endpoint (out of scope).

### 29. Counts contract
Derived from each bounded list's server-computed `total` (request page 1, read `total`) — no full-row fetch, no cross-branch, no N+1. `approvalCountsFromTotals` helper provided. No dedicated count endpoint added (would be net-new surface; the `total` field already answers it efficiently).

### 30. Pagination
Leave/shift-swap DTOs switched from unbounded `@IsNumberString` to coerced, bounded `@Type(()=>Number) @IsInt @Min @Max(100)`; anomaly already bounded. Service clamps `take` to `MAX_LEAVE_PAGE_SIZE=100` defensively. Verified live: `take/limit=101` → 400, `take=abc` → 400.

### 31. Sorting & priority
Each list sorts deterministically by `createdAt desc` with a stable id; `needsActionStatuses()` orders the lanes. No fabricated cross-domain urgency score.

### 32. Resolved window & 33 cross-role visibility
Resolved = recent terminal via the same list + date window (bounded). Cross-role invalidation documented narrowly in `approvalDecisionInvalidationKeys` + `APPROVAL_CROSS_ROLE_INVALIDATION` (discount approve → order detail/discounts/floor + cashier row; reject → discounts only; never global). No new self-service UI added.

### 34/35. Frontend helper & cache contract
New additive module `approvals-contract.ts` (domains, scopes, lifecycle map, endpoints, bounded query builder, minimal identity, query-key factory, counts, narrow invalidation, error mapping). The read-only Approvals page is **visually unchanged** — no dialogs, no redesign.

### 36. Audit integrity
Decision audit events (`LEAVE_REQUEST_*`, `SHIFT_SWAP_*`, `DISCOUNT_*`, `anomaly-event.*`) preserved with truthful attribution; the atomic claim writes audit only on a successful transition (no audit on a lost race). `previousStatus` is deterministic (the guarded pre-status).

### 37/38. Idempotency & concurrency
No `Idempotency-Key` on these endpoints (unchanged). Natural duplicate safety hardened: every decision now uses a **status-guarded conditional `updateMany`**; the loser of a race gets 409 (discount) / 400–409 (leave/swap/anomaly), never a duplicate mutation or audit. Verified live (duplicate approve → 409; duplicate review/ack → 400).

### 39. Error contracts
`mapApprovalErrorToMessage` maps 400/403/404/409/408/504/401 to safe copy; no Prisma/SQL text surfaced. 404 now also covers cross-branch (branch isolation).

### 40. Query plans / index decision
Existing composite indexes cover the Needs-action/History filters (branch+status, org+branch+status, branch+type+status); representative queries ran fast on the disposable branch. **No index migration created** (no proven deficiency).

### 41. Stale-data repair boundary
Read-only classification only; **no shared record mutated/approved/rejected/resolved/deleted**. No orphaned/duplicate/ambiguous rows found; the only imperfections (null resolution notes, seeded-terminal rows without audit) are historical demo provenance to tolerate in UI, not repair.

### 41–46. Files & changes
**Backend modified:** `attendance.service.ts` (review+swap atomic, swap branch-scope, list date-filter+clamp, MAX const), `analytics.service.ts` (ack/resolve atomic+branch-scope, list actorUser include + date filter), `discounts.service.ts` (approve/reject atomic claim), 3 list DTOs (bounds + coercion + date window). **Tests added/updated:** 3 new DTO specs, concurrency+branch-isolation+audit cases in attendance/analytics/discounts specs. **Frontend added:** `lib/supervisor/approvals-contract.ts`, `e2e/supervisor-approvals/smoke.spec.ts`. **QA tooling:** `tools/qa/approvals-live-matrix.mjs`. **Docs:** this report + shared-Neon audit + QA register + tracker updates. **No** Prisma/migration/seed/permission/Postman change. **No** commit/push.

### 47–58. Validation results
- **API tests:** attendance **47/47**, discounts **22/22**, analytics (incl. new concurrency/branch cases) **pass**, 4 DTO specs **35/35**, reservations regression **39/39**. (Full-suite single-process run OOMs the local runner — a runner memory limit, not a failure; suites pass individually with `--runInBand`.)
- **DTO tests:** coercion + Min/Max(100) + ISO date window for leave/shift-swap/anomaly (+ existing discounts) — pass.
- **Concurrency tests:** count-0 conditional-claim → 409/400 for all four domains — pass.
- **Web typecheck / lint / build:** pass (build: compiled successfully, static pages generated).
- **API build (`nest build`):** pass.
- **/api/health (isolated):** `{status:ok, db:ok}`.
- **Live API matrix (disposable branch):** **29/29** (`tools/qa/approvals-live-matrix.mjs`).
- **Playwright smoke (isolated stack, 4 viewports):** **8/8**.
- **Postman:** 56/56 valid JSON (3 have a pre-existing UTF-8 BOM; BOM-tolerant tooling parses them); **no Postman change required** (added params are optional/backward-compatible).
- **`git diff --check`:** clean.

### 59. QA-created records
On the disposable branch only (see QA register): leave `cmr91u87b0007yp5epz94ujza`→APPROVED, swap `c6fee1513a6c68e3d1c79050`→REJECTED, anomaly `c0c27327d8a551718207bdc8`→RESOLVED, discount `cms7sb53g000f6f21xqmjj3be`→APPROVED. All marked `P5A-QA`.

### 60. Cleanup
Isolated API (:4002) + web (:3101) stopped; ports free; no orphan node process; git-ignored secret removed; disposable branch auto-expires (recovery branch retained); shared baseline re-verified unchanged.

### 61. Remaining limitations (non-blocking)
- **Discount Resolved/History** has no branch-wide list endpoint (only `/pending` + per-order) — 5B shows discount Needs-action only unless a future endpoint is added.
- **Shift-swap approve performs no roster reassignment** (writes status+audit only) — matches the existing domain contract; a real swap-executes-schedule change is a future backend feature.
- **Anomaly resolve reuses `acknowledgedBy`** (no separate `resolvedById`) — schema limitation; resolver attribution shares the acknowledger field.
- **Self-approval** on discounts remains backend-permitted (SUP-RG-030) — unchanged; UI flags it.
- Seeded terminal records carry no audit events, and 6 RESOLVED anomalies have null resolution notes (demo provenance; UI must tolerate).

### 62. Readiness for Prompt 5B
Contracts are verified and typed: domain-specific endpoints, bounded queues (Needs-action/Resolved/History), server counts, minimal identity, narrow invalidation, error mapping. Backend is branch-safe and concurrency-safe. 5B can build the premium master-detail workspace directly on `approvals-contract.ts` without further backend work (except the optional discount-history endpoint).

### 63. Final status
**A — COMPLETE / READY FOR PROMPT 5B.** Every required decision lifecycle works (verified live), identities resolve safely, queue/pagination/counts contracts exist, branch isolation and concurrency pass, audit attribution is truthful, no cross-branch leakage, and no critical contract gap remains.

### 64. No commit / no push
Confirmed: no `git commit`, no `git push`. Shared Neon received no write. No permission granted. No shared migration deployed. The full Prompt 5B UI was not started.
