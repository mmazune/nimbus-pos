# Supervisor Reconstruction — Prompt 5B2 Completion Report
## Shift-swap decision integrity (Outcome C) + Anomaly acknowledge/resolve + Approvals closure

**Final status: B — COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY (Prompt 5 CLOSED)**
Date: 2026-07-31 · No commit · No push

---

### 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). Forbidden path not used.

### 2. Initial git status
Branch `main`, HEAD `6b740d2`. Prior uncommitted work (Waiter/Cashier/shared shell/Floor/profile,
Supervisor 0–5B1, Prompt 3 financial, Prompt 4 reservations, isolation launcher, Playwright, 5A/5B1
artifacts) preserved. Twelve Floor deletions remain absent. No reset/restore/stash/clean.

### 3. Neon baseline (read-only, `production` `br-holy-darkness-a4fg93r2`)
58 migrations / 836 role_permissions / 126 reservations / 1223 orders / 750 payments / 19 users;
discounts 6, leave 15, swap 12 (8 pending), anomaly 21 (7 open / 8 ack); **0 P5B2-QA, sentinel absent**.

### 4. Disposable branch
`br-hidden-king-a4rbwvj0` (`prompt5b2-approvals-qa-20260731`), forked from `production`, endpoint
`ep-delicate-leaf-a4dvlw2s`, deleted at teardown. (Prompt 5B1 branch confirmed already deleted;
Prompt 4C recovery branch retained; Prompt 5A branch still present, set to auto-expire 2026-07-31T18:00Z
— not deleted, as that needs fresh authorization.)

### 5. Isolation proof
Fail-closed launcher: denylist (expected `ep-delicate-leaf-a4dvlw2s`, forbidden `ep-empty-paper-a4sogjap`),
prisma connect, sentinel `P5B2-QA-20260731` = branch id, migration + `COMPLETED` enum + demo branch row.
`/api/health` → `{status:ok, db:ok}`.

### 6. Documents read
Root/`.claude` CLAUDE.md, PROGRESS, roadmap/gap-register/MVP matrix, the 5A + 5B1 completion reports,
shared-Neon audit, QA register, UI QA evidence index, `docs/supervisor-ui-docs/*`, and the actual
ShiftSwapRequest/Schedule/ScheduleAssignment/ShiftTemplate/AnomalyEvent models + attendance/analytics
services/controllers/DTOs + the Approvals workspace + `approvals-contract.ts` + `approvals-workspace.ts`.

### 7. Shift-swap schema findings
`ShiftSwapRequest` = requester/target employee, **`shiftDate` (bare `@db.Date`, no FK to a specific
shift/assignment)**, reason, status, approvedBy/At, reviewNotes. `ShiftSwapStatus` =
PENDING/APPROVED/REJECTED/CANCELLED — **no target-acceptance state**. Roster lives in
`ScheduleAssignment` (schedule + shiftTemplate + employee + shiftDate, unique on all four). Create-swap
validates that BOTH employees have a PUBLISHED `ScheduleAssignment` on the date via `findFirst` (an
employee may have several assignments on a date → ambiguous).

### 8. Shift-swap permission findings
Approve/reject is gated solely by `pos:hr:shift-swaps:approve`. **This permission has never mutated the
roster** (5A confirmed status-only; SUP-RG-036 explicitly deferred the roster change). Verified live:
Supervisor holds it. No schedule/roster-write permission exists in the codebase.

### 9. Selected Shift-swap outcome — **Outcome C (user-authorized)**
Decisive finding: **`ScheduleAssignment` is read-only across the entire API** — every reference is
`findMany`/`count`/`findFirst`; there is **no create/update/delete/reassign of `ScheduleAssignment`
anywhere** (assignments are only ever created by seed/demo data). Combined with the request's lack of a
specific-shift reference (only a date → `findFirst` ambiguity), the absence of role-compat/conflict/lock
infrastructure, and a permission that has never mutated roster, a truthful atomic roster swap would be a
**net-new roster-write capability pulled forward from a deferred feature**. Per §9 (Outcome A requires
existing schema **and services**), this is not available. The user reviewed the evidence and chose
**Outcome C**: no Approve control; **Reject only** (truthful — status + audit, no roster change); truthful
copy; documented limitation.

### 10. Roster mutation design
None. No roster is mutated by any Approvals action (by design). Reject writes only
`shift_swap_requests.status = REJECTED` + audit.

### 11. Atomicity
Reject uses the existing 5A concurrency-safe status-guarded `updateMany` claim (PENDING → REJECTED); the
loser of a race gets 400/409. No roster transaction exists to make atomic.

### 12. Shift-swap state machine
PENDING (Supervisor-actionable — no target-wait state exists) → REJECTED (via Approvals) / APPROVED or
CANCELLED (out of Approvals scope). Approvals exposes Reject for PENDING only; terminal records read-only.

### 13. Shift-swap detail
`ApprovalShiftSwapDetail`: requesting + target employee (names), shift date, reason, requested-at, status,
and — when terminal — reviewer/reviewed-at/notes. No salary/payroll/contact/address; no raw UUID title.

### 14. Shift-swap approval
**Not exposed.** Truthful notice: "Approval isn't available here — this request can't be completed from
Approvals because schedule reassignment is not supported." No Approve button renders.

### 15. Shift-swap rejection
`PATCH /hr/shift-swaps/:id/approve {status:'REJECTED', reviewNotes?}` (reason optional per DTO), gated on
`pos:hr:shift-swaps:approve` + PENDING. Dialog consequence: "No schedule or shift assignment is changed."
On success: invalidate shift-swap queues + counts; toast "Shift swap rejected — No schedule was changed";
selection cleared.

### 16. Target acceptance
N/A — the canonical `ShiftSwapStatus` has no acceptance/decline state; created requests are immediately
Supervisor-actionable (create already validated both employees' published assignments).

### 17. Roster result
**Verified unchanged.** After a live reject, `schedule_assignments` had **0 rows touched** in the window
(and the codebase has no roster-write path). The UI makes no roster claim.

### 18. Shift-swap concurrency
Reject reuses the 5A atomic claim: duplicate reject → 400 (verified live). No roster mutation to duplicate.

### 19. Shift-swap history
Terminal shift-swaps (APPROVED/REJECTED/CANCELLED) render in Resolved/History with reviewer/decision-time/
notes. Approved rows (decided outside Approvals) show status truthfully with **no roster-effect claim**.

### 20. Anomaly schema findings
`AnomalyEvent`: type (`AnomalyRuleType`), status (OPEN/ACKNOWLEDGED/RESOLVED), severity
(LOW/MEDIUM/HIGH/CRITICAL), entityType (`RiskEntityType`)/entityId, actorUser, opened/ack/resolution
fields, `evidence` Json. Acknowledge reuses `acknowledgedBy` for both ack + resolve (no separate resolver
column — a schema limitation carried from 5A).

### 21. Anomaly state machine
OPEN → ACKNOWLEDGED (acknowledge, notes optional) → RESOLVED (resolve, note REQUIRED). Resolve is only
valid from ACKNOWLEDGED (resolve-from-OPEN → 400, verified). Both branch-scoped + concurrency-safe (5A).

### 22. Anomaly detail
`ApprovalAnomalyDetail` (fresh `GET /analytics/anomalies/:id`): type, severity, affected entity, actor,
opened-at, summary, and handling (status/handler/handled-at/notes). Operational fields only — no raw
payment credentials, card data, private employee info, raw payload, or stack traces.

### 23. Acknowledgement
`PATCH /analytics/anomalies/:id/acknowledge` (notes optional), OPEN only. Records actor + timestamp,
preserves evidence, one audit event. Row **stays in Needs action** (still needs resolution); detail
refetches to reveal Resolve; toast "Anomaly acknowledged — It stays actionable until resolved". Not
treated as resolution.

### 24. Resolution
`PATCH /analytics/anomalies/:id/resolve` (note REQUIRED, confirm disabled until entered), ACKNOWLEDGED
only. Dialog states evidence is preserved and the underlying order/till/payment/attendance/shift record is
not changed. On success: RESOLVED, row leaves Needs action, Resolved/History update, counts update, audit,
toast; selection cleared. The underlying entity is never mutated.

### 25. Duplicate safety
Verified live: duplicate acknowledge → 400 (not OPEN), duplicate resolve → 400 (not ACKNOWLEDGED),
resolve-without-note → 400, resolve-from-OPEN → 400. Concurrency-safe claims; no duplicate audit.

### 26. Severity presentation
Canonical labels (Low/Medium/High/Critical) via labelled `Badge` (not colour-only). Anomaly queue rows
sort by the 5A canonical order (severity rank → actionable time → id) — no fabricated risk score.

### 27–29. Needs-action / Resolved / History integration
Both domains use the existing 5B1 workspace. Needs action: shift-swap PENDING; anomaly OPEN + ACKNOWLEDGED
(ack stays). Resolved/History (server-paginated terminal): leave/swap/anomaly (discounts remain omitted,
SUP-RG-035). No separate pages; URL state / pagination / identity / responsive master-detail / counts
preserved.

### 30. Counts
Anomaly needs-action count = OPEN + ACKNOWLEDGED; acknowledging does **not** decrement it (still
actionable); resolving does. Shift-swap reject decrements the shift-swap count. Counts refresh via narrow
invalidation.

### 31. Cache / invalidation
`approvalDecisionInvalidationKeys(branch, domain, id)` — shift-swap/anomaly queues + counts + detail only.
No Reservations/menu/profile/auth/all-orders/all-employees/all-branches invalidation. Mutation awaited
before invalidation; anomaly acknowledge refetches detail (keeps selection).

### 32. Error handling
`mapApprovalErrorToMessage` (400/403/404/409) → safe copy; no raw Prisma/SQL/UUID/endpoint text. Detail
refetches after conflict; recoverable notes preserved in dialog.

### 33. Privacy
Names primary; no contact/salary/payroll/address; raw ids support-only; anomaly rows show operational
fields only (no evidence payload/secrets); branch-scoped (no cross-branch rows). _(Playwright privacy spec
at §51.)_

### 34. Accessibility
Reject/Acknowledge/Resolve buttons clearly named; destructive (Reject, danger) vs non-destructive
(Acknowledge/Resolve) distinct; labelled `role=dialog` (focus enters/returns, Escape); required
resolution-note `aria-required`/`aria-invalid` + confirm disabled until entered; toasts `aria-live`;
status/severity via label + badge.

### 35. Responsive
Shift-swap + anomaly detail and their dialogs verified at 1024×768 / 1366×768 / 1440×900 / 1920×1080 (no
horizontal overflow, dialogs fit, one detail workspace). _(§52.)_

### 36. Request counts
No new query patterns: shift-swap/anomaly reuse the bounded needs-action fetch (loaded once, shared for
counts). Detail opens ≤1 request (anomaly detail; shift-swap from row). No per-row identity lookup, no
history storm, no double mount, no broad invalidation, no permanent pending.

### 37–38. Discount + Leave regression
Preserved unchanged from 5B1 (approve/reject, self-approval notice, payment gate, leave no-payroll-claim).
_(Browser regression at §51.)_

### 39. Files created
`e2e/supervisor-approvals/{shift-swap-reject,anomaly-acknowledge-resolve,all-domains-consolidated,cross-role-visibility,responsive-closure}.spec.ts`;
this report + `ai/SUPERVISOR_RECONSTRUCTION_PROMPT5_APPROVALS_FINAL_COMPLETION_REPORT.md`.

### 40. Files modified
`lib/supervisor/approvals-workspace.ts` (+rejectShiftSwap/acknowledgeAnomaly/resolveAnomaly);
`components/supervisor/approvals/workspace/{ApprovalShiftSwapDetail,ApprovalAnomalyDetail,SupervisorApprovalsWorkspace}.tsx`;
`e2e/supervisor-approvals/approvals-fixtures.ts` (+selectRowWithAction); docs + QA register + evidence index.

### 41. Files removed
None.

### 42–46. Frontend / backend / schema / seed / permission / Postman
**Frontend only.** No backend/service/DTO change. No Prisma schema/migration change. **No seed or
permission change.** No Postman change (no new/changed endpoint; all four decision endpoints pre-existed).

### 47–50. API / DTO / concurrency / assertions
API jest (attendance/analytics/discounts/DTOs) **126/126** + reservations **39/39**. Live API matrix on
the disposable branch — **shift-swap** list 200 / reject 200 / dup-reject 400 / take=101 400; **anomaly**
list 200 / ack 200 / resolve-no-note 400 / resolve 200 / dup-resolve 400 / resolve-from-OPEN 400 / dup-ack
400 (**11/11**). Roster integrity: **0 schedule_assignments touched** by reject.

### 51. Playwright discovered / executed
Discovered 120 tests (15 files × 4 viewports); **executed — all 120 pass, 2 flaky (recovered on retry),
0 real failures, exit 0 (1.7h)**, Chromium, `--retries=2`. The 2 flaky were transient scale-to-zero
compute stalls (first-test cold-start; a one-off pooler stall on leave-reject), both passing on retry
#1 — not UI defects. Anomaly acknowledge/resolve, shift-swap reject + no-Approve notice, consolidated
four-domain filters, cross-role, responsive-closure, and full 5B1 regression all pass live.

### 52. Four-viewport results
All four projects pass: **vp-1024×768, vp-1366×768, vp-1440×900, vp-1920×1080** — 30/30 each; shift-swap
+ anomaly detail and their dialogs fit with no horizontal overflow; one detail workspace per viewport.

### 53. Cross-role shift verification
No employee-facing schedule UI exists to consume roster state; verified via API + DB that reject changes no
`ScheduleAssignment` (0 touched) — consistent with the absence of any roster-write path.

### 54. Anomaly-source verification
Acknowledge does not resolve; resolve marks RESOLVED via the canonical anomaly read; the underlying entity
(synthetic QA entity ids) is not mutated — consistent with the resolve service touching only the anomaly row.

### 55–58. Waiter / Cashier / Prompt 3 / Prompt 4 regression
_(Browser results at §51–52; Waiter no-Approvals + Cashier nav + Prompt 3 Floor + Prompt 4 Reservations
specs included in the executed suite.)_

### 59–62. typecheck / lint / build / API health
typecheck ✓, lint ✓ (0 warnings), build ✓ (`/supervisor/approvals` 16.8 kB). `/api/health` (isolated) →
`{status:ok, db:ok}`.

### 63. Shared before/after
`production` **identical before and after**: 58 migrations / 836 role_permissions / 126 reservations /
1223 orders / 750 payments / 19 users; domain totals unchanged (discounts 6, leave 15, swap 12, anomaly
21); **0 P5B2-QA rows; `_p4d_qa_sentinel` absent**. No shared write.

### 64. QA records
`ai/SUPERVISOR_APPROVALS_QA_RECORD_REGISTER.md` (Prompt 5B2 section): 14 shift-swap PENDING, 8 anomaly OPEN
+ 6 ACKNOWLEDGED, 12 discount PENDING, 10 leave PENDING (all `P5B2-QA`) on the disposable branch.

### 65. Cleanup
Isolated API (:4002) + web (:3101) + keep-warm pinger stopped; ports free (down); no orphan process;
git-ignored secret env removed; **disposable branch `br-hidden-king-a4rbwvj0` deleted**; Prompt 4C
recovery branch retained; Playwright report/traces kept git-ignored. (The Prompt 5A auto-expiring branch
was still present at run time, set to auto-expire 2026-07-31T18:00Z — not deleted, as that needs fresh
authorization.)

### 66. Remaining limitations
- **Shift-swap approval (roster exchange) is not available from Approvals** (Outcome C) — Reject only;
  a real roster swap is a future backend feature (SUP-RG-036 / SUP-RG-042).
- Branch-wide **discount** Resolved/History unavailable (SUP-RG-035).
- Anomaly resolve reuses `acknowledgedBy` (no separate resolver column).
- Discount self-approval backend-permitted (SUP-RG-030; UI flags it).
- Pre-existing `POST /pos/orders` order-number collision on populated branches (SUP-RG-040).

### 67. Prompt 5 final status
**B — COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY.** All four approval domains work; Discount + Leave +
Anomaly are fully actionable; Shift-swap is truthfully **Reject-only (Outcome C)** with no UI claim of an
unsupported roster effect (verified: 0 assignments touched); browser + four-viewport QA pass (120/120,
2 flaky recovered); shared Neon untouched. The one non-demo-ready item — a roster-changing shift-swap
approval — is explicitly Outcome C (deferred backend feature), and the UI states this honestly, so §54's
bar ("must not claim an unsupported roster effect") is met. See the consolidated
`ai/SUPERVISOR_RECONSTRUCTION_PROMPT5_APPROVALS_FINAL_COMPLETION_REPORT.md`.

### 68. Supervisor reconstruction readiness
Approvals is the last operational Supervisor surface; with 5B2 all four domains are integrated (Discount +
Leave + Anomaly fully actionable; Shift-swap reject + truthful read-only). Manager reconstruction is the
next major track (**not started**).

### 69. No commit / no push
Confirmed: no `git commit`, no `git push`. No shared-Neon write. No permission/schema/seed/Postman change.
