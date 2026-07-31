# Supervisor Final Known Limitations (Reconciled)

Date: 2026-07-31 · Consolidates every open Supervisor gap as of the final closure pass.

> This is the single reconciled register. `docs/KNOWN_LIMITATIONS.md` and
> `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md` remain the detailed historical records (with
> per-prompt provenance); this file classifies every item still open at closure and removes
> duplication. Nothing here is hidden or softened.

## Classification legend

- **Closed** — resolved, verified, no longer a limitation.
- **Non-blocking known limitation** — real, documented, does not block demo/handoff.
- **Deferred Manager feature** — belongs to a future Manager-role or later phase, intentionally
  out of Supervisor reconstruction scope.
- **Requires backend redesign** — needs a schema/service change outside a frontend-only pass.
- **Demo blocker** — would prevent a clean demo. (None found in this pass.)

| ID | Item | Classification | Detail |
| --- | --- | --- | --- |
| SUP-RG-035 | No branch-wide Discount Resolved/History endpoint | Non-blocking known limitation | Discounts only expose `/pos/discounts/pending` + per-order lists; Resolved/History omit the Discounts domain with a truthful "available from the related order" notice. Verified still accurate in this pass (`filters-pagination-routing.spec.ts`). |
| SUP-RG-030 | Discount self-approval is backend-permitted | Non-blocking known limitation (governance) | The backend does not block a requester from approving their own discount; the UI matches and flags it truthfully. Recommended: a backend maker-checker guard. Verified still accurate (`discount-self-approval.spec.ts`). |
| SUP-RG-025 | `pos:order:transfer` also gates transfer-server at the API level | Non-blocking known limitation | transfer-server has no UI (Outcome B — no safe branch-scoped server selector), but the endpoint is API-reachable because the two actions share one permission. Unchanged this pass. |
| — | Payment-safety gate is UI-only | Non-blocking known limitation | Void/Discount/Complimentary are blocked in the UI when payment state indicates money is present or can't be confirmed; the backend endpoints do not themselves check payment. Documented frontend safeguard, not a backend guarantee. Unchanged this pass. |
| — | Reservations search is bounded/page-local | Non-blocking known limitation | No cross-page/free-text reservation search exists server-side; search filters the loaded, bounded page only. Unchanged this pass. |
| SUP-RG-034 | Concurrent identical reservation creates can 500 instead of 409 | Non-blocking known limitation (recommended backend hardening) | Reconfirmed live in this pass's reservation matrix (`create-reservation: concurrent duplicate-submit` case). Root cause: `generateReservationNumber` is read-increment against a unique constraint, so a true race hits the DB unique violation raw. Non-blocking because the Create UI single-submit-guards; no normal path fires two identical concurrent creates. |
| — | Order-number generation collision on a populated branch | Non-blocking known limitation (recommended backend hardening) | Same class as SUP-RG-034, on `POST /pos/orders`. QA seeds decision-domain rows via SQL instead of the order API for this reason (established since Prompt 5B1). Unchanged this pass. |
| SUP-RG-036 / SUP-RG-042 | Shift-swap approval does not (and structurally cannot) reassign the roster | Requires backend redesign (deferred backend feature) | `ScheduleAssignment` is read-only across the entire API (no create/update/delete/reassign path); `ShiftSwapRequest` references only a date, not a specific shift; `pos:hr:shift-swaps:approve` has never mutated the roster. The Approvals UI exposes **Reject only** (Outcome C, user-authorized) with honest copy. Reconfirmed live in this pass: a reject changes 0 `schedule_assignments` rows. **Do not add an Approve/roster-mutation control without a new backend capability and explicit authorization.** |
| — | Anomaly resolve reuses `acknowledgedBy` (no separate resolver column) | Non-blocking known limitation | Cosmetic/audit-precision gap only; both acknowledge and resolve are otherwise fully live and branch-scoped. Unchanged this pass. |
| SUP-RG-013 / SUP-RG-014 | No pending-refund queue; no post-close-void candidate queue | Deferred Manager/future feature | Both require new backend candidate-discovery endpoints; out of scope for a frontend-only Supervisor pass. Unchanged. |
| SUP-RG-025 (transfer-server) | Transfer-server UI | Deferred (Outcome B) | No safe branch-scoped operational-role server selector exists yet (tenancy memberships are admin-gated; HR/workforce directories leak PII/payroll). Unchanged. |
| — | Branch timezone not modelled for reservation day-boundaries | Non-blocking known limitation | Operational-day edges use UTC, not branch-local time. Unchanged. |
| — | Stale shared reservations (order-less SEATED + overdue) | Non-blocking known limitation | Individually surfaced in Attention; no bulk repair offered by design (would require an explicit, separately-authorized data-repair operation). Unchanged. |
| — | Neon disposable-branch latency exceeds sustained browser-automation budgets | Non-blocking, environment/infra | Reconfirmed and root-caused further in this pass (see completion report §8, defect 3): round-trips of 20–27s/test against a scale-to-zero disposable branch, plus a Windows-host Chromium worker-crash pattern under that load. The established local-Docker-Postgres path is the correct, already-documented mitigation and is what this pass's final browser-QA numbers reflect. |
| — (new, this pass) | `docs/KNOWN_LIMITATIONS.md` "leave is org-scoped by design" wording is imprecise | Non-blocking documentation-precision fix | Live QA observed the Approvals UI/API list filters leave to the Supervisor's current branch context (an empty branch's Needs-action queue for leave stayed empty until branch-scoped PENDING rows were seeded). The *backend model* is correctly org-scoped (`branchId` nullable on `LeaveRequest`), but the *operational list a Supervisor sees* is branch-filtered in practice — reasonable behavior, previously imprecisely worded. Corrected in `docs/KNOWN_LIMITATIONS.md`. |
| — | `accounts-receivable.service.spec.ts` fails to compile | Non-blocking, pre-existing, out of scope | Confirmed via `git log`/`git diff` unchanged since an old BG milestone commit, no diff this session. Accounting module, not Supervisor. Recommend a separate accounting-module pass reconcile the DTO/test drift. |
| — | `client-onboarding.service.spec.ts` has 4 failing tests | Non-blocking, pre-existing, out of scope | Same provenance as above (incomplete Prisma mock for `invitation.updateMany`). Owner-onboarding module, not Supervisor. |

## Demo blockers found

**None.** Every workflow in `ai/SUPERVISOR_FINAL_DEMO_SCRIPT.md` completed successfully in live
QA at all four viewports.

## Explicitly reaffirmed locked boundaries (not limitations — deliberate, do not "fix")

- No Orders navigation tab (Waiter or Supervisor).
- No payment collection, order close, refund creation/approval, or post-close void in Supervisor.
- No Shift-swap Approve / roster-mutation control (see SUP-RG-036/042 above).
- No generic `/api/approvals/:id/decide` inbox — domain-specific architecture is intentional
  (see `docs/DECISIONS.md`).
- No bulk reservation or bulk approval resolution.
