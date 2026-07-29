# Supervisor Reconstruction — Prompt 3B3B Completion Report
## Discount Approval & Rejection, Complimentary Treatment, Financial Audit Integrity

**Date:** 2026-07-28
**Author:** Claude Code (Opus 4.8, 1M context)
**Status:** Implementation + technical (static/executable) validation complete;
consolidated live API/DB and browser/viewport QA **pending** (no API/DB/browser
automation in this environment). No commit, no push.

---

1. **Repository path.** `C:\Users\arman\Desktop\nimbus-pos` (canonical). Forbidden
   stale tree untouched.

2. **Initial branch and git status.** Branch `main`, dirty worktree (authoritative);
   all prior work preserved; no reset/restore/stash/clean/checkout/discard.

3. **Pre-existing deletions.** The same 12 intentional role-specific Floor/shell
   deletions — verified still absent, not attributed to 3B3B.

4. **Documents read.** Root `CLAUDE.md`, `PROGRESS.md`, `ai/AI_STATUS.md`, the 3A→3B3A
   completion reports, `docs/DECISIONS.md`, `docs/KNOWN_LIMITATIONS.md`,
   `supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`, the central availability
   module, the workspace, the shared `ActionConfirmDialog`, `approvals.ts` + the
   approvals page (for query keys). Backend contracts re-audited via subagent.

5. **Frontend files inspected.** `order-actions.ts`, `orders.ts`, `order-financials.ts`,
   `SupervisorTableControlWorkspace.tsx` (Discounts panel + Adjustments + dialogs),
   `approvals.ts`, `pages/supervisor/approvals.tsx` (pending-discount key
   `["supervisor","approvals","discounts",branchId]`, detail key
   `["supervisor","approval-detail","discount",branchId,id]`), the 3B3A dialogs.

6. **Backend files inspected (read-only; no backend change).**
   `discounts.controller.ts` + `discounts.service.ts` (`approveDiscount`,
   `rejectDiscount`, `requestDiscount`, `recalcOrderDiscount`, `computeDiscountAmount`)
   + `dto/approve-discount.dto.ts` + `dto/reject-discount.dto.ts` +
   `dto/request-discount.dto.ts`; `schema.prisma` (Discount model + DiscountType/Status,
   OrgSettings threshold); `discounts.service.spec.ts`; `refunds.controller.ts`
   (boundary); `seed.ts` (permissions).

7. **Postman collections inspected.** `M12-Discounts-Approval-Workflow` (canonical —
   Approve Discount, Reject Discount, List, Pending, Detail). No Postman file edited.

8. **Permission verification.** Supervisor already holds `pos:discount:request`,
   `pos:discount:read`, and **`pos:discount:approve`** (seed defs at 175–177; Supervisor
   grant at ~532–534/the Supervisor block ~1122–1124). **`pos:discount:approve` gates
   BOTH approve and reject** (its definition: "Approve or reject pending discounts";
   both controller routes use it). Reads use `pos:discount:read`. Complimentary uses the
   request path (`pos:discount:request`). A live 403 test was not possible (API not
   running); confirmed statically.

9. **Permission change / stop decision.** **None — no permission granted or created.**
   All required permissions pre-existed → no Section 6 stop condition. `seed.ts` is
   unchanged in this prompt.

10. **Approval contract.** `POST /api/pos/discounts/:id/approve` → **200**;
    `ApproveDiscountDto { managerPin?: string ≤8 }` — **optional** (no notes field);
    **NOT BG3-wrapped**. Source must be `PENDING` (else 409 "Cannot approve a discount in
    <status> status") and the order must still be discountable (NEW/SENT/IN_KITCHEN/READY,
    else 409 "Order is no longer in a state that accepts discounts"). Approve runs
    `recalcOrderDiscount` (latest APPROVED wins; `total = max(subtotal − amount, 0)`; tax
    ignored). Returns the **bare updated Discount** (no relations). Audit
    `DISCOUNT_APPROVED`. Errors: 404 not found, 409 not-pending / order-not-discountable,
    401 "Invalid manager PIN" (only when a PIN is supplied).

11. **Rejection contract.** `POST /api/pos/discounts/:id/reject` → **200**;
    `RejectDiscountDto { rejectionReason: string (required, ≤500) }`; **NOT BG3-wrapped**.
    Source PENDING only (else 409). **Does NOT change order totals** (explicit; no recalc).
    Returns the bare updated Discount (status REJECTED, rejectionReason, rejectedById,
    rejectedAt). Audit `DISCOUNT_REJECTED`. Same permission as approve.

12. **Self-approval policy — Outcome B (backend PERMITS self-approval).** The service
    never compares `discount.createdById` to the approver; a requester can approve their
    own discount (and small ones are auto-approved by the creator at request time). No
    product policy mandates blocking it, so **the UI matches the backend (permits it)**
    rather than inventing a stricter frontend rule. The Approve dialog **surfaces a
    truthful self-approval note** ("You requested this discount. Approving your own
    request is permitted but recorded in the audit trail.") when the requester is the
    current user. **Recommendation (governance):** a future backend self-approval guard
    (or maker/checker policy) would strengthen financial control; recorded in
    `docs/DECISIONS.md` + `docs/KNOWN_LIMITATIONS.md`.

13. **Manager-PIN policy.** The approve `managerPin` is **optional** and, when supplied,
    re-authenticates the **approver against their own quick-PIN** (sets
    `managerPinVerified`) — it is NOT a separate manager gate and NOT required. Per the
    prompt ("do not expose manager PIN unless the verified endpoint requires it"), the
    Approve dialog **does not collect a PIN**. Availability `requiresManagerPin: false`.

14. **Central availability changes.** Added `approve-discount`, `reject-discount`,
    `complimentary` to the live set. `approve-discount`: `pos:discount:approve`, statuses
    NEW/SENT/IN_KITCHEN/READY (SERVED excluded — backend re-checks), `requiresCleanPayment`
    (approval mutates totals), not idempotent, PIN not required. `reject-discount`:
    `pos:discount:approve`, statuses OPEN, `requiresReason`, **not** payment-gated
    (non-mutating), not idempotent. `complimentary`: `pos:discount:request` (Outcome B),
    statuses NEW/SENT/IN_KITCHEN/READY, `requiresReason` + `requiresPositiveTotal` +
    `requiresCleanPayment` + `blockedByPendingDiscount`, not idempotent.

15. **Selected-order review UI.** The read-only Discounts panel now shows the rejection
    reason for REJECTED rows and renders **inline Approve/Reject controls on PENDING rows**
    (only when the reviewer holds `pos:discount:approve` and the order-level availability
    permits). Employee names remain the primary identity; APPROVED/REJECTED rows show
    terminal status with no decision controls.

16. **Approval UI.** `SupervisorApproveDiscountDialog.tsx` (shared `ActionConfirmDialog`):
    order number, table/Tableless, requester, type + value, reason, subtotal, current
    total, and a **labelled estimated** resulting total + impact (from the backend-mirrored
    preview). No optimistic final amount; requester/reason never hidden; self-approval note
    shown when applicable.

17. **Approval validation.** Confirm-gated; re-checked server-side (PENDING + discountable
    + payment-safe). The UI does not bypass thresholds/policy; a double-click 409s on the
    second call (de-facto idempotency).

18. **Approval canonical result.** On success: invalidate order-discounts + the Approvals
    discount count + the approval-detail cache + (totals changed) order-detail + Floor. The
    bare response carries no totals, so canonical values come from the re-fetch. The row
    moves to APPROVED and drops out of the pending queue.

19. **Rejection UI.** `SupervisorRejectDiscountDialog.tsx`: order, requester, type/value,
    request reason, unchanged order total, and a **required** rejection reason. Copy states
    the discount will not be applied, the total is unchanged, and the decision is recorded.

20. **Rejection validation.** Confirm + required non-empty reason (≤500). PENDING re-checked
    by the backend.

21. **Rejection canonical result.** On success: invalidate **only** order-discounts +
    Approvals discount count + approval-detail. **order-detail totals are NOT invalidated**
    (rejection changes nothing). The row moves to REJECTED and drops out of the queue.

22. **Approvals discount-domain updates.** approve/reject/complimentary touch only the
    discount domain keys above — never leave / shift-swaps / anomalies / reservations /
    profile / auth / active-shift. The Approvals page keeps its existing read-only layout
    (not redesigned).

23. **Complimentary contract research.** No dedicated comp type (DiscountType =
    PERCENTAGE|FIXED). `Discount.metadata (Json?)` **is persisted on create AND returned by
    all three read endpoints** (all use top-level Prisma `include`). A 100% PERCENTAGE (or
    FIXED = subtotal) whole-order discount drives `total` to exactly 0; the org threshold
    still applies (default 5000 → a full comp usually returns PENDING). `reason` is always
    stored + returned. Audit logs `reason` (not the metadata object).

24. **Complimentary outcome classification — Outcome B.** Metadata persists and round-trips,
    so Complimentary = a truthful whole-order discount request (`type PERCENTAGE`, `value
    100`, `metadata { complimentary: true, category }`, required `reason`), label truthful
    and readable back. Implemented through the discount lifecycle (may return PENDING).

25. **Complimentary implementation.** Added `SupervisorComplimentaryDialog.tsx` in the
    **Adjustments** group: subtotal, estimated resulting total (0, labelled "confirmed after
    submit"), a constrained **category** select (Service recovery / Management hospitality /
    Quality issue / Promotional authorisation / Other — persisted verbatim), and a required
    reason. No arbitrary percent/value controls. Builds the verified request via
    `buildComplimentaryDiscountInput`. Distinct from Void (not a status change) and Refund
    (not a payment reversal); copy states it does not refund an existing payment.

26. **Whole-order / item-level boundary.** **Whole-order only** — the backend has no
    line-level discount targeting, so no item-level comp, no per-line zero pricing, no
    client-only flags, no item deletion presented as comp.

27. **Threshold behaviour.** Re-verified: auto-approval is **amount-vs-threshold**
    (`OrgSettings.discountApprovalThreshold`, default 5000), **not** permission-based. Ordinary
    discount and Complimentary show the real returned status (APPROVED/PENDING); the UI never
    infers status from the entered amount and defers totals to the response / re-fetch.

28. **Payment-state safety.** The UI-only payment gate from 3B3A is retained and extended to
    approve + complimentary (both mutate totals). Reject is intentionally not payment-gated
    (non-mutating). Loading/errored payment reads are treated conservatively (blocked); never
    assumes "unpaid" on a failed read. Payment stays read-only.

29. **Terminal-order handling.** CLOSED/VOIDED: no new discount/comp; approve blocked (order
    not discountable); reject limited to open orders (conservative). Existing discount history
    stays read-only. No post-close void, no refund.

30. **Financial reconciliation.** Every decision secures the response, then re-fetches/updates
    the canonical order + discount list + Approvals discount domain; no authoritative total is
    kept in any dialog/component/queue — frontend figures are previews only.

31. **Cache and invalidation.** Narrow, discount-domain-scoped (see §18/§21/§22). No broad
    Supervisor invalidation; no menu/auth/profile/shift/reservations/other-approval domains.

32. **Error handling.** Operational copy via `approveDiscountErrorCopy` /
    `rejectDiscountErrorCopy` / `discountRequestErrorCopy` (already-decided, order-not-
    discountable, invalid PIN, not found, invalid state, generic). Recoverable input preserved;
    canonical state re-fetched after conflict; success only on canonical success.

33. **Performance measurements.** Static/architectural: inline review reuses the already-loaded
    discount list; dialogs reuse cached order/subtotal; no per-row fan-out; approve/reject/comp
    are single mutations settled on response. Wall-clock numbers require a running API/DB —
    **pending** (Neon/local latency to be reported separately when available).

34. **Responsive findings.** Dialogs use `max-w-*` + scroll; inline review buttons wrap in the
    row; the Adjustments grid is responsive; shared Floor unchanged. Four-viewport visual QA
    **pending** browser tooling.

35. **Accessibility findings.** Dialogs labelled `role="dialog"`/`aria-modal`, focus-trapped
    with return, Escape-to-close-when-safe; approve vs reject distinguished by label + button
    variant (not colour alone); rejection reason required with error association; complimentary
    category + reason labelled; status shown as text + badge.

36. **Files created.** `SupervisorApproveDiscountDialog.tsx`, `SupervisorRejectDiscountDialog.tsx`,
    `SupervisorComplimentaryDialog.tsx`; `apps/web/scripts/prompt3b3b-assertions.ts` +
    `tsconfig.prompt3b3b-assertions.json`; this report.

37. **Files modified.** `order-actions.ts` (approve/reject/complimentary live + gating),
    `orders.ts` (approve/reject API + Discount type fields), `order-financials.ts` (complimentary
    builder + categories + manager-PIN + error copy), `SupervisorTableControlWorkspace.tsx`
    (inline review, Complimentary button, dialogs, deferred-notice copy), `prompt3a` / `prompt3b1`
    / `prompt3b3a` assertion scripts (hidden-set + superseded-structural updates), docs (see §—).

38. **Files removed.** None.

39. **Backend changes.** **None.**

40. **Seed / permission changes.** **None** (all permissions pre-existed).

41. **Postman changes.** None (M12 already covers approve + reject; no runtime contract changed).

42. **Tests and assertions.** `prompt3b3b-assertions.ts` — availability gating
    (permission/status/payment), reject-not-payment-gated, complimentary Outcome-B builder +
    categories, manager-PIN validation, error mapping, inline-review wiring, discount-domain-only
    invalidation, comp ≠ void/refund, no refund/post-close/payment controls, no Orders nav,
    permissions not granted. `prompt3a`/`prompt3b1`/`prompt3b3a` updated and still pass. Backend
    approve/reject/threshold/PIN are covered by `discounts.service.spec.ts` (unchanged; no backend
    change) — running Jest needs a DB not available here.

43. **typecheck.** `--filter @nimbus-pos/web typecheck` → **pass** (clean).

44. **lint.** `--filter @nimbus-pos/web lint` → **pass** (no warnings/errors).

45. **build.** `--filter @nimbus-pos/web build` → **pass**.

46. **API health.** **Pending** — API not listening on `:3001`, no DB; `GET /api/health` not run.

47. **Authenticated Supervisor QA.** **Pending** — requires a running API/DB. Covered statically;
    live approve/reject/self-approval/complimentary QA outstanding.

48. **Waiter regression.** Shared Floor + menu/order flow unchanged; Waiter has no discount
    review / complimentary controls. Static gates pass; authenticated Waiter regression pending.

49. **Cashier regression.** No Cashier file changed; payment collection remains Cashier-owned;
    approved-discount / comp totals are backend-authoritative (Cashier reads canonical order).
    Static gates pass; authenticated Cashier regression pending.

50. **Consolidated browser and viewport QA.** **Pending** — no browser automation. The 3B1–3B3B
    sweep (four viewports) is owed. No screenshots/API responses fabricated.

51. **QA-created data.** None (no live mutations executed in this environment).

52. **Remaining limitations.** Live/browser/viewport QA + `/api/health` outstanding (3B1–3B3B).
    **Self-approval is backend-permitted** (UI matches + flags it; a backend guard is recommended).
    Complimentary is whole-order only (no backend line-level targeting) and above the threshold it
    returns PENDING. Discount recalc ignores tax (backend "tax deferred to M13"). The audit record
    logs `reason` but not the metadata object (comp traceable via reason + persisted metadata).

53. **Prompt 3 final readiness.** Supervisor order-workspace financial actions are feature-complete
    for the reconstruction scope: service (request bill / mark served), handoff (split/split-items/
    move/merge/transfer-table), lookup (Find order + tableless/terminal/legacy), and financial
    adjustments (void, discount request, **approve, reject, complimentary**). Deferred: transfer
    **server** (no safe selector), refund, post-close void, payment collection, order close — all
    out of the Supervisor reconstruction scope. Technical validation is complete; **consolidated
    live + authenticated visual QA for Prompts 3B1–3B3B remains pending.**

54. **Recommended next reconstruction phase.** (a) A consolidated authenticated live + four-viewport
    browser QA sweep across 3B1–3B3B once API/DB/browser tooling is available; (b) a backend
    self-approval guard / maker-checker policy for discounts; then (c) Reservations Prompt 4A/4B or
    the full Approvals-page reconstruction (both explicitly out of scope here). Not started.

55. **No-commit / no-push confirmation.** No `git commit`, no `git push`. Dirty worktree preserved.
