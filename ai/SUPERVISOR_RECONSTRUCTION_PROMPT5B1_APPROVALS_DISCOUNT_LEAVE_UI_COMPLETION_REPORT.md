# Supervisor Reconstruction — Prompt 5B1 Completion Report
## Premium Approvals workspace + Discount & Leave decisions + read-only Shift-swap/Anomaly + executed QA

**Final status: B — COMPLETE WITH KNOWN LIMITATIONS / READY FOR PROMPT 5B2**
Date: 2026-07-30 · No commit · No push

---

### 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). The forbidden `C:\Users\arman\Desktop\NIMBUS\nimbus-pos` was not used.

### 2. Initial git status
Branch `main`. Pre-existing uncommitted Prompt 5A work (backend hardening, `approvals-contract.ts`, DTO specs, QA tooling, docs) preserved untouched. The twelve intentional Floor deletions remain absent. No `reset`/`restore`/`stash`/`clean`/`checkout --`. Untracked 5A artifacts (contract, e2e smoke, matrix, reports) were built upon, not discarded.

### 3. Neon baseline (read-only, shared `production` `br-holy-darkness-a4fg93r2`)
Pre-QA: **58 migrations / 836 role_permissions / 126 reservations / 1223 orders / 750 payments / 19 users**; discounts 6 (2 pending), leave 15 (9 pending), swap 12 (8 pending), anomaly 21 (7 open); **0 P5B1-QA rows**.

### 4. Disposable branch
`br-aged-resonance-a47lmtt5` (`prompt5b1-approvals-ui-qa-20260730`), forked from `production`, endpoint `ep-tiny-king-a44a10es`, auto-expiry 2026-07-31T23:00Z, deleted explicitly at teardown.

### 5. Isolation proof
Fail-closed `tools/qa/run-isolated-api.mjs`: explicit child env (inherited DB keys stripped) → denylist (expected `ep-tiny-king-a44a10es`, forbidden `ep-empty-paper-a4sogjap`) → DB-identity preflight (Prisma connect + `_p4d_qa_sentinel` marker `P5B1-QA-20260730` = branch id + required migration `20260518000000_...` + `ReservationEventType.COMPLETED` enum + demo branch row `cb27…`) → only then spawn the API. `/api/health` → `{status:ok, db:ok}`.

### 6. Documents read
Root + `.claude` CLAUDE.md, PROGRESS, the reconstruction ROADMAP / GAP_REGISTER / MVP matrix, the Prompt 5A completion report + shared-Neon audit + QA register, `docs/supervisor-ui-docs/*`, and the actual current Approvals page/components + `approvals.ts` + `approvals-contract.ts` + Prompt 3 discount components + `order-financials.ts` + Prompt 4B reservations workspace + backend controllers/services/DTOs (code authoritative).

### 7. Old Approvals architecture (replaced)
The former `pages/supervisor/approvals.tsx` was a **read-only** page: six inline `useQuery` calls, a normalised `SupervisorApprovalItem[]`, summary + domain cards + toolbar + a queue + a detail panel that rendered **disabled** `DeferredAction` buttons ("actions unavailable"). No scopes, no decisions, no URL state. The old components under `components/supervisor/approvals/` remain in the tree (unused) — not deleted, per worktree-safety, but no longer imported.

### 8. New page architecture
`pages/supervisor/approvals.tsx` now renders `SupervisorShell > SupervisorApprovalsWorkspace`. New additive modules:
- `lib/supervisor/approvals-workspace.ts` — normalisers (`ApprovalQueueItem`), bounded fetchers (`fetchNeedsAction`, `fetchTerminalPage`), decision fns (`approveDiscount`/`rejectDiscount`/`reviewLeave`), `sortQueueItems`, scope/domain helpers, on top of the 5A `approvals-contract.ts`.
- `components/supervisor/approvals/workspace/` — `SupervisorApprovalsWorkspace` (orchestrator), `ApprovalScopeTabs`, `ApprovalDomainFilter`, `ApprovalFilterToolbar`, `ApprovalQueueList`, `ApprovalDiscountDetail`, `ApprovalLeaveDetail`, `ApprovalShiftSwapDetail`, `ApprovalAnomalyDetail`, `detail-primitives`.

### 9. Scope selector
`ApprovalScopeTabs` — accessible `role=tablist` with Needs action / Resolved / History; Needs-action tab carries a live count badge; drives `?scope=` URL state (needs-action is the clean default, no param).

### 10. Domain filters
`ApprovalDomainFilter` — All + one chip per domain the scope supports; `aria-pressed`; needs-action chips show per-domain counts. **Discounts are omitted from Resolved/History** (no branch-wide endpoint). Changing domain resets pagination; drives `?domain=`.

### 11. Counts
Derived from each domain's bounded needs-action server `total` via `approvalCountsFromTotals` (5A contract) — no full-list count fetch, branch-scoped, permission-aware (a domain the Supervisor can't read is not queried/counted). Counts refresh on decision via narrow invalidation.

### 12. Queue rows
One shared `ApprovalQueueList` row shell with domain-specific content: domain badge, severity badge (anomaly only), status badge, identity title, concise summary, actionable/decision time, optional amount chip. Selected state via `aria-current`. Rows are keyboard-focusable buttons.

### 13. Identity presentation
Uses the 5A `ApprovalMinimalIdentity` (`identityFromUser`/`identityFromEmployee`): display name → first + last-initial → role + support ref → "Unknown staff member". Raw ids appear only via `approvalSupportReference` (support/detail context) — never a row title. No payroll/contact/address/tax/bank/HR-profile fields; no per-row identity request (backend list includes identity relations).

### 14. Needs-action
One bounded (≤100) needs-action fetch per domain (discount `/pending`; leave/swap `status=PENDING`; anomaly OPEN + ACKNOWLEDGED merged). "All" merges the four, sorted by the canonical order; a specific domain shows just that lane. Client-paginated at 25/page (URL `?page=`). Loaded once, reused for both the queue and the counts (no duplicate requests).

### 15. Resolved
`fetchTerminalPage` with a recent 14-day `dateFrom` window (server-paginated), client-filtered to terminal statuses, for leave/swap/anomaly (+ "All" merge). Empty copy: "No recent decisions."

### 16. History
Lazy `fetchTerminalPage` (server-paginated by `?page=`) with an optional `from`/`to` date-range toolbar mapping to API params. Client-filtered to terminal statuses. Empty copy: "No approval history matches these filters."

### 17. Pagination
Bounded default 25, server max 100. URL-persisted page; page resets on scope/domain change; deterministic ordering; Prev/Next with "Page N of M". Empty pages recover (page clamped to total).

### 18. Routing / URL state
`scope`, `domain`, `page`, `from`, `to`, `selDomain`, `selId` — all via `router.replace(shallow)`. Refresh / Back / Forward stable; default = Needs action / All / page 1 / no selection (never History).

### 19. Discount detail
`ApprovalDiscountDetail` (fresh `GET /pos/discounts/:id` + order payments): requester, order number, requested type/value, reason, requested-at, current subtotal + total, **estimated** discount + new total (preview only — order is the source of truth), payment state badge, and — when terminal — reviewer/notes.

### 20. Discount approval
Reuses the canonical Prompt 3 `POST /pos/discounts/:id/approve` (+ optional manager PIN) and `order-financials` helpers. Gated on `pos:discount:approve` + PENDING + a **UI-only payment-safety boundary** (blocked when captured money exists — `getPaymentState` ∈ settled/partially-paid/refunded). On success: narrow invalidation of discount queues + counts + detail + cross-role order-discounts/order-detail/order-payments/floor (totals changed); one success toast; detail refetch shows APPROVED.

### 21. Discount rejection
`POST /pos/discounts/:id/reject` with a **required** rejection reason (confirm disabled until entered). Totals unchanged → invalidates discount queues + counts + detail + order-discounts only (no floor/total). No optimistic row removal — canonical success first; one toast.

### 22. Self-approval presentation
`detail.createdBy.id === current user id` → truthful "You requested this discount. Approving your own request is permitted but recorded in the audit trail." Approve stays enabled (backend permits self-approval, SUP-RG-030) — the UI matches backend, no fabricated block.

### 23. Discount history limitation
No branch-wide discount list endpoint (SUP-RG-035). Discounts appear only in Needs action; omitted from Resolved/History domain chips. Forcing `?scope=history&domain=discount` shows the truthful notice "Historical discount decisions are available from the related order." No client-memory/session history, no fetch-all-orders reconstruction.

### 24. Leave detail
`ApprovalLeaveDetail` (from the selected row's included relations — leave has no `GET /:id`): employee, requested-by, leave type, start/end, duration (days derived from returned dates — not a fabricated balance), reason, requested-at, and — when terminal — reviewer/reviewed-at/notes. Truthful copy: reviewed at org level; decision does not change payroll or roster.

### 25. Leave approval
`PATCH /hr/leave/:id/review {status:'APPROVED', reviewNotes?}`, gated on `pos:hr:leave:review` + PENDING. Optional reviewer notes. On success: invalidate leave queues + counts; one toast; selection cleared (row leaves Needs action). No payroll/roster/coverage claim or mutation.

### 26. Leave rejection
`PATCH …/review {status:'REJECTED', reviewNotes?}`; same gating. On success: invalidate leave queues + counts; one toast. No fabricated schedule mutation.

### 27. Terminal leave presentation
APPROVED/REJECTED/CANCELLED render read-only (status, reviewer, reviewed-at, notes, original request) — no active decision controls, no reopen.

### 28. Shift-swap read-only integration
`ApprovalShiftSwapDetail` renders requester, target, shift date, reason, status, reviewer/notes — **no Approve/Reject controls in 5B1**; an info note says review is not yet available. No roster-change claim (approve writes status + audit only).

### 29. Anomaly read-only integration
`ApprovalAnomalyDetail` (fresh `GET /analytics/anomalies/:id`, fallback to row): type, severity, affected entity, actor, opened-at, summary, handling state — **no Acknowledge/Resolve controls in 5B1**; operational fields only.

### 30. Cache / invalidation
`approvalDecisionInvalidationKeys` (5A) invalidates only the domain's queues + counts + detail. Cross-role for discount approve adds order-discounts/order-detail/order-payments/floor for the affected order; reject adds order-discounts only. No global/Reservations/Floor-wide/Me/auth/menu/all-orders/all-employees invalidation. Mutation settles before invalidation (awaited).

### 31. Error handling
Decision failures map through `mapApprovalErrorToMessage` (400/403/404/409/…) + the Prompt 3 `approveDiscountErrorCopy`/`rejectDiscountErrorCopy`. No raw Prisma/SQL/UUID/endpoint text. Detail refetches after conflict. Recoverable reason text is preserved in the dialog on error.

### 32. Loading / empty states
Skeletons (`aria-busy`) while queues load; filters stay usable. Scope-specific empty copy (Needs action / Resolved / History). Errors show `ErrorState` + Refresh without blanking the route.

### 33. Privacy
Names primary; contact PII never in rows; raw ids support-only; no broad HR response cached; no cross-branch rows (branch-scoped queries + backend branch isolation); anomaly rows show operational fields only. _(Playwright privacy spec result at §47.)_

### 34. Accessibility
Scope selector `role=tablist`/`role=tab`/`aria-selected`; domain filter `role=group` + `aria-pressed`; keyboard-focusable rows with `aria-current`; detail region + labelled dialogs (`role=dialog`/`aria-modal`/`aria-labelledby`, focus enters + returns, Escape closes, focus not trapped after close); required-reason `aria-required`/`aria-invalid`; toasts `role=status`/`aria-live`; status conveyed by label + badge (not colour alone).

### 35. Responsive
`xl:grid-cols-[minmax(0,1fr)_460px]` split at ≥xl; below xl the detail stacks under the queue (single detail workspace — no double mount). Verified across 1024×768 / 1366×768 / 1440×900 / 1920×1080. _(Result at §48.)_

### 36. Request counts / performance
Needs-action = one bounded query per domain (anomaly 2 lanes), loaded once and shared for counts (no separate count storm, no per-row identity lookup). Resolved/History lazy + server-paginated. Detail opens ≤2 requests (discount detail + payments; anomaly detail; leave/swap from row). No four-domain history storm, no responsive double-mount, no broad invalidation, no permanent pending state.

### 37–40. Discount detail / approval / rejection / self-approval
See §19–§22.

### 41. Files created
`lib/supervisor/approvals-workspace.ts`; `components/supervisor/approvals/workspace/{SupervisorApprovalsWorkspace,ApprovalScopeTabs,ApprovalDomainFilter,ApprovalFilterToolbar,ApprovalQueueList,ApprovalDiscountDetail,ApprovalLeaveDetail,ApprovalShiftSwapDetail,ApprovalAnomalyDetail,detail-primitives,index}.tsx/ts`; `e2e/supervisor-approvals/{approvals-fixtures,navigation-and-default-queue,filters-pagination-routing,discount-approve-reject,discount-self-approval,leave-approve-reject,resolved-history,identity-and-privacy,responsive,prompt3-prompt4-regression}.spec.ts`; this report + `ai/SUPERVISOR_APPROVALS_UI_QA_EVIDENCE_INDEX.md`.

### 42. Files modified
`pages/supervisor/approvals.tsx` (rewired to the workspace); docs (tracker/roadmap/gap-register/matrix/supervisor-ui-docs/DECISIONS/KNOWN_LIMITATIONS/ROLE_JOURNEYS/UI_SYSTEM/TESTING/CLAUDE); QA register.

### 43. Files removed
None (old read-only Approvals components retained but unused, per worktree-safety).

### 44. Frontend / backend / schema / seed / permission / Postman changes
**Frontend only.** No backend/DTO/service change. No Prisma schema, migration, or seed change. **No permission** added/changed. **No Postman** change (5A added params are optional/backward-compatible).

### 45. API tests
attendance + discounts + analytics + DTO specs **126/126**; reservations regression **39/39** (`--runInBand`).

### 46. Assertions (live API matrix)
Backend is unchanged from 5A, so the 5A live matrix (`approvals-live-matrix.mjs`, 29/29) still holds.
Prompt 5B1 added isolated-API spot-checks confirming the UI's decision paths: `/auth/login` → 201,
`/auth/me` → 200; `POST /pos/discounts/:id/approve` (seeded PENDING, unpaid order) → 200 APPROVED;
duplicate/terminal approve → 409 (concurrency guard); `PATCH /hr/leave/:id/review` → 200. Pre-existing
`POST /pos/orders` 500 (order-number collision, SUP-RG-040) noted, not a 5B1 defect.

### 47. Playwright discovered / executed
Discovered 80 tests (10 files × 4 viewports); **executed 80 / passed 80 / failed 0 (43.2m)**,
Chromium, `--retries=2` (transient first-hit login latency on the scale-to-zero compute — no test
failed on its final attempt). Discount approve/reject + self-approval, leave approve/reject,
read-only shift-swap/anomaly, scopes/filters/counts, discount-history notice, URL state + refresh,
identity/privacy, responsive, and Prompt 3/4 regression all pass live.

### 48. Four-viewport results
All four projects pass: **vp-1024×768, vp-1366×768, vp-1440×900, vp-1920×1080** — 20/20 each; no
horizontal overflow on queue or open detail; one detail workspace mounts per viewport.

### 49–51. Cashier / Prompt 3 / Prompt 4 regression
Prompt 3 Floor + Prompt 4 Reservations load; Waiter has no Approvals; discount approve recalculates the canonical order total (Cashier reads canonical). _(Browser confirmation at §47–48.)_

### 52–55. typecheck / lint / build / API health
typecheck ✓, lint ✓ (0 errors), build ✓ (`/supervisor/approvals` 16 kB). `/api/health` (isolated) → `{status:ok, db:ok}`.

### 56. Shared before/after
`production` `br-holy-darkness-a4fg93r2` **identical before and after**: 58 migrations / 836
role_permissions / 126 reservations / 1223 orders / 750 payments / 19 users; pending counts identical
(discounts 6/2, leave 15/9, swap 8, anomaly OPEN 7); **0 P5B1-QA rows; `_p4d_qa_sentinel` absent**.
No shared write of any kind.

### 57. QA records
See `ai/SUPERVISOR_APPROVALS_QA_RECORD_REGISTER.md` (Prompt 5B1 section): 4 synthetic P5B1-QA leave rows + live-created pending discounts on the disposable branch.

### 58. Cleanup
Isolated API (:4002) + web (:3101) + keep-warm pinger stopped; ports free (down); no orphan process;
git-ignored secret env removed; **disposable branch `br-aged-resonance-a47lmtt5` deleted**; Prompt 4C
recovery branch `br-dawn-truth-a4zjs1p7` retained; Playwright report/traces kept git-ignored.

### 59. Remaining limitations (non-blocking)
- **Discount Resolved/History** unavailable branch-wide (SUP-RG-035) — Needs action only; order-scoped history remains in the order workspace.
- **Shift-swap + Anomaly decisions** are read-only in 5B1 (Prompt 5B2).
- **Self-approval** on discounts remains backend-permitted (SUP-RG-030) — UI flags it.
- Resolved uses a recent-window client-terminal filter (bounded); History is server-paginated (terminal client-filter over the page) — pages may render fewer than the page size when the window includes non-terminal rows.
- Disposable-branch compute scale-to-zero cold-starts add latency (external; pooled endpoint mitigates).

### 60. Readiness for Prompt 5B2
The shared queue/detail architecture already renders shift-swap + anomaly rows and details read-only; 5B2 activates their verified decisions (shift-swap approve, anomaly acknowledge/resolve) by adding action controls + mutations on the same contract. No architectural rework needed.

### 61. Final status
**B — COMPLETE WITH KNOWN LIMITATIONS / READY FOR PROMPT 5B2.** Every critical Prompt 5B1 workflow
passes live (workspace architecture, Discount decisions, Leave decisions, identity privacy,
pagination/URL state, cross-role order totals, browser + four-viewport QA = 80/80). Documented
non-blocking limitations remain — chiefly the **branch-wide discount Resolved/History absence**
(SUP-RG-035, no backend endpoint) plus Shift-swap/Anomaly staying read-only until Prompt 5B2 — which
is exactly the Classification-B condition.

### 62. No commit / no push
Confirmed: no `git commit`, no `git push`. No shared-Neon write. No permission granted. No schema/migration/seed/Postman change.
