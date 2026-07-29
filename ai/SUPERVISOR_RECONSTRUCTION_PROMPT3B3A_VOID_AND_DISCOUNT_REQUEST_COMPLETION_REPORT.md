# Supervisor Reconstruction — Prompt 3B3A Completion Report
## Active-Order Void, Order-Level Discount Request, Financial Safety Boundaries

**Date:** 2026-07-28
**Author:** Claude Code (Opus 4.8, 1M context)
**Status:** Implementation + technical (static/executable) validation complete;
authenticated live API/DB and browser/viewport QA **pending** (no API/DB/browser
automation in this environment). No commit, no push. **Prompt 3B3B not started.**

---

1. **Repository path.** `C:\Users\arman\Desktop\nimbus-pos` (canonical). Forbidden
   stale tree untouched.

2. **Initial branch and git status.** Branch `main`, dirty worktree (authoritative).
   170+ pre-existing entries preserved; no reset/restore/stash/clean/checkout/discard.

3. **Pre-existing deletions.** The same 12 intentional role-specific Floor/shell
   deletions (6 Supervisor, 5 Waiter, `waiter/shell/CurrentTime.tsx`) — verified still
   absent, not attributed to 3B3A.

4. **Documents read.** Root `CLAUDE.md`, `PROGRESS.md`, `ai/AI_STATUS.md`, the 3A/3B1/
   3B2 completion reports, `docs/DECISIONS.md`, `docs/KNOWN_LIMITATIONS.md`, the
   central availability module, the workspace, the shared `ActionConfirmDialog`, and
   the supervisor orders/approvals libs. Backend contracts audited via subagent.

5. **Frontend files inspected.** `order-actions.ts`, `orders.ts`, `order-financials.ts`
   (new), `SupervisorTableControlWorkspace.tsx`, `SupervisorFloorScreen.tsx`,
   `approvals.ts` + the approvals page (for the pending-discount query key), the shared
   confirm dialog, and the 3A/3B1/3B2 dialogs (as patterns).

6. **Backend files inspected (read-only; no backend change).**
   `orders.controller.ts` + `orders.service.ts` (`voidOrder`, `VALID_TRANSITIONS`,
   `autoReleaseTableIfIdle`) + `dto/transition-order.dto.ts`; `discounts.controller.ts`
   + `discounts.service.ts` (`requestDiscount`, threshold auto-approval,
   `computeDiscountAmount`, `recalcOrderDiscount`) + `dto/request-discount.dto.ts`;
   `schema.prisma` (Discount model, DiscountType/DiscountStatus, OrgSettings threshold);
   `orders.service.spec.ts` + `discounts.service.spec.ts`; `seed.ts` (permissions).

7. **Postman collections inspected.** `M10-POS-Orders` (has a void request),
   `M12-Discounts-Approval-Workflow` (canonical discount coverage: auto-approve,
   pending, approve, reject, list, pending, detail), `M14-Refunds-Voids` (boundary).
   No Postman file edited (no runtime contract changed).

8. **Permission verification.** Supervisor already holds **`pos:orders:void`**
   (seed ~1113), **`pos:discount:request`** (~1122), **`pos:discount:read`** (~1124),
   and **`pos:discount:approve`** (~1123 — used by the `GET /pos/discounts/pending`
   count). Void = `pos:orders:void`; discount request = `pos:discount:request`; both
   present. A live 403 test was not possible (API not running); confirmed statically.

9. **Permission change / stop decision.** **None — no permission was granted or
   created.** All required permissions pre-existed, so there was no Section 6 stop
   condition. Seed is unchanged in this prompt (the `seed.ts` diff visible in the
   worktree is the Prompt 3B2 `pos:order:transfer` grant, not 3B3A).

10. **Active-void contract.** `POST /api/pos/orders/:id/void` → **200**;
    `TransitionOrderDto { reason?: string ≤500 }` — reason optional overall but
    backend-**required** for `IN_KITCHEN`/`READY`; **no manager PIN**; **NOT
    idempotency-wrapped**. Valid source statuses NEW/SENT/IN_KITCHEN/READY; SERVED→409
    (SERVED only → CLOSED), CLOSED/VOIDED→409. **No payment-state check** (pure status
    machine). Effect: sets `status=VOIDED` only; items/totals unchanged; a `DINE_IN`
    table is auto-released to AVAILABLE if it becomes idle; reservation/payments
    untouched. Returns the bare updated order. Audit `ORDER_VOIDED`.

11. **Active-void availability.** `void` added to the central live set with meta
    `permission: pos:orders:void`, `requiresConfirmation`, `requiresReason`,
    `requiresCleanPayment`, allowedStatuses NEW/SENT/IN_KITCHEN/READY, not idempotent,
    no manager PIN. Unavailable when: no permission (hidden); CLOSED/VOIDED/SERVED
    (disabled + reason "This order can no longer be voided as an active order.");
    a payment exists or payment state can't be confirmed (disabled + reason); a
    conflicting mutation is pending.

12. **Active-void UI.** `SupervisorVoidOrderDialog.tsx` on the shared
    `ActionConfirmDialog` (`tone="danger"`): shows order number, table/Tableless,
    service type, status, item count, total, and read-only payment state; requires a
    reason; the consequence copy states the order enters VOIDED and that this is **not**
    a refund, **not** complimentary, and **not** a post-close void. No manager-PIN field
    (endpoint accepts none).

13. **Active-void submission.** Re-validates the reason at submit; one mutation; no
    idempotency key (endpoint not BG3); duplicate-click prevention via pending state;
    no local VOIDED is manufactured before the canonical response.

14. **Active-void canonical result.** On success the returned bare order (real VOIDED
    status + totals) is merged into the `order-detail` cache; the order is dropped from
    the Supervisor Floor `activeOrders` (terminal) so the source card frees, then Floor
    + Waiter Floor are invalidated for canonical truth. The workspace stays on the now
    read-only voided order (all actions self-suppress). Payment history stays read-only.

15. **Table/Floor state after void.** The backend auto-releases an idle `DINE_IN`
    table; the UI reflects this via the `activeOrders` removal + Floor invalidation. If
    the table is not freed by the backend (other active orders remain), the UI does not
    fabricate an available state — it shows canonical data after refetch.

16. **Payment restriction handling.** Payment stays **read-only**. Void and discount
    both derive a `requiresCleanPayment` gate: because the backend does not itself check
    payment on these endpoints, the UI adds a deliberate, documented safety boundary —
    if payment state indicates money (settled / partially-paid / pending / failed /
    refunded) or can't be confirmed (loading/errored), the action is disabled with an
    operational reason. Never assumes "unpaid" on a failed payment read.

17. **Discount request contract.** `POST /api/pos/orders/:id/discounts` → **201**;
    `RequestDiscountDto { type: 'PERCENTAGE'|'FIXED' (req), value: number ≥0.01 ≤2dp
    (req), reason: string non-empty ≤500 (req), metadata? }`; no line target, no manager
    PIN; **NOT idempotency-wrapped**. Basis = **order.subtotal** (pre-tax). Auto-approval
    is **amount-vs-threshold** (`OrgSettings.discountApprovalThreshold`, default 5000):
    amount ≤ threshold → **APPROVED** (immediately mutates totals), else **PENDING**
    (+`HEAVY_DISCOUNT` flag). NOT permission-based. DISCOUNTABLE_STATES NEW/SENT/
    IN_KITCHEN/READY (SERVED excluded). Multiple discounts may coexist; latest APPROVED
    wins. Response is the bare Discount (no updated totals → re-fetch order). Audit
    `DISCOUNT_REQUESTED` / `DISCOUNT_AUTO_APPROVED`.

18. **Percentage validation.** 0.01–100 (100 allowed, >100 rejected), positive,
    numeric, ≤2 decimals. Preview amount = `round2(subtotal * value / 100)`.

19. **Fixed validation.** ≥0.01, positive, numeric, ≤2 decimals; a fixed value greater
    than the subtotal is rejected with a clear error (no silent cap; prevents a negative
    resulting total). Preview amount = `min(value, subtotal)`.

20. **Discount reason.** Required (`RequestDiscountDto` `@IsNotEmpty`), labelled
    textarea, ≤500 chars, helper copy, preserved after recoverable failure. QA reason
    is "Prompt 3B3A discount validation" (the placeholder). No misuse placeholders.

21. **Discount request UI.** `SupervisorDiscountRequestDialog.tsx`
    (`ActionConfirmDialog`, `size="lg"`): subtotal (basis) + current total, a
    Percentage/Fixed radiogroup, a labelled value input with inline error association,
    a required reason, and a clearly-labelled **estimate** (discount amount + estimated
    new total) marked "confirmed after submit". Uses shared UGX formatting.

22. **Pending status handling.** When the response is `PENDING`, the toast says "sent
    for approval"; the workspace Discounts panel shows the pending row; only the
    Supervisor Approvals discount domain is invalidated; a second request is blocked in
    the UI while a PENDING discount exists (prevents accidental duplicates — the backend
    permits multiples, but the UI guards against them).

23. **Approved status handling.** When the response is `APPROVED`, the toast says
    "Discount applied"; the order is re-fetched for canonical totals; the UI never
    describes this as a frontend-performed approval (it was the backend's threshold
    auto-approval), and audit identity stays backend-owned.

24. **Canonical totals.** No optimistic final total is written. The dialog invalidates
    `order-detail` (and Floor when approved) to pull backend-authoritative totals; the
    preview is explicitly an estimate until the response returns.

25. **Selected-order discount presentation.** A new read-only **Discounts** panel in
    the workspace lists each discount's type + value, status badge, reason, requester,
    created time, and reviewer (when returned). No UUIDs as primary labels. **No
    approve/reject controls** (deferred to 3B3B); the panel notes approval/rejection
    remain in Approvals.

26. **Approvals discount-domain invalidation.** A discount request invalidates only
    `["supervisor","approvals","discounts",branchId]` (the pending-discount count) and
    the order/order-discount caches — never leave, shift-swap, anomaly, reservation,
    profile, auth, or shift keys. Approvals UI stays read-only (3B3B / Prompt 5).

27. **Payment-state boundary.** No Take payment / Add payment / Close / Refund /
    Reverse / Till / Receipt controls. Payment reads drive gating only; a failed payment
    read disables the payment-dependent actions with a warning rather than assuming
    unpaid.

28. **Tableless-order behaviour.** A tableless active order can be voided/discounted if
    the contract permits (both are status-only). No table state is fabricated; order +
    service-type context is preserved.

29. **Terminal-order behaviour.** CLOSED/VOIDED orders: void unavailable; discount
    unavailable; post-close void deferred; financials read-only. Actions render
    disabled-with-reason (never look actionable).

30. **Error handling.** Operational copy via `voidOrderErrorCopy` /
    `discountRequestErrorCopy` (invalid transition, post-kitchen reason, discount >100,
    invalid state, not found, generic). Recoverable form input preserved; canonical
    state refetched after stale/conflict; success only on canonical success; no raw
    controller/DB errors as primary copy.

31. **Cache and invalidation.** Narrow: void → order-detail (canonical merge) + Floor
    activeOrders removal + Floor/Waiter-Floor invalidate; discount → order-detail +
    order-discounts + (approved) Floor + approvals-discount count. No broad Supervisor
    invalidation; no menu/auth/profile/shift/all-reservations/all-approvals.

32. **Performance measurements.** Static/architectural: the discount panel is one
    bounded read; availability is pure/synchronous; dialogs reuse cached order/payment
    data; no per-row fan-out. Wall-clock numbers require a running API/DB — **pending**
    (Neon/local latency to be reported separately when available).

33. **Responsive findings.** Both dialogs use `max-w-*` + `max-h-[calc(100vh-2rem)]`
    scroll; the Adjustments group reuses the responsive 2-col action grid; shared Floor
    is unchanged. Four-viewport visual QA **pending** browser tooling.

34. **Accessibility findings.** Dialogs are labelled `role="dialog"`/`aria-modal`,
    focus-trapped with return, Escape-to-close-when-safe; destructive void uses a danger
    confirm; the discount type is a labelled radiogroup; the value input has a label +
    `aria-invalid` + `aria-describedby` error association; reason is labelled/required;
    status shown as text + badge (not colour-only).

35. **Files created.** `apps/web/src/lib/supervisor/order-financials.ts`;
    `apps/web/src/components/supervisor/floor/SupervisorVoidOrderDialog.tsx`;
    `apps/web/src/components/supervisor/floor/SupervisorDiscountRequestDialog.tsx`;
    `apps/web/scripts/prompt3b3a-assertions.ts`;
    `apps/web/scripts/tsconfig.prompt3b3a-assertions.json`; this report.

36. **Files modified.** `apps/web/src/lib/supervisor/order-actions.ts` (void +
    request-discount live + payment/pending/positive-total gating);
    `apps/web/src/lib/supervisor/orders.ts` (void + discount-request API + types);
    `apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx`
    (Adjustments group, Discounts panel, dialogs, payment/pending context, deferred-
    notice copy); `apps/web/scripts/prompt3a-assertions.ts` +
    `apps/web/scripts/prompt3b1-assertions.ts` (void + request-discount left the
    "stays hidden" sets); docs (see §37 doc list).

37. **Files removed.** None.

38. **Backend changes.** **None** — no controller/service/DTO/schema/migration change.

39. **Seed / permission changes.** **None** in 3B3A (all required permissions
    pre-existed). No demo-data change.

40. **Postman changes.** None (no runtime contract changed; M10 void + M12 discount
    already cover these endpoints).

41. **Tests and assertions.** `prompt3b3a-assertions.ts` — availability gating
    (permission/status/payment/pending/positive-total), PERCENTAGE + FIXED validation,
    backend-mirrored preview math, reason validation, error mapping, structural wiring
    (Adjustments group, dialogs mounted, discount-domain-only invalidation, pure
    financials, no approve/reject controls, no Orders nav, permissions not silently
    granted). `prompt3a` + `prompt3b1` updated and still pass. Backend `voidOrder` +
    `requestDiscount` are already covered by `orders.service.spec.ts` +
    `discounts.service.spec.ts` (unchanged; no backend code touched) — running the Jest
    suite needs a DB not available here.

42. **typecheck.** `--filter @nimbus-pos/web typecheck` → **pass** (clean).

43. **lint.** `--filter @nimbus-pos/web lint` → **pass** (no warnings/errors).

44. **build.** `--filter @nimbus-pos/web build` → **pass**.

45. **API health.** **Pending** — API not listening on `:3001`, no DB available;
    `GET /api/health` could not be run. Not fabricated.

46. **Authenticated Supervisor QA.** **Pending** — requires a running API/DB. Void +
    discount flows are covered statically by the assertion suite; live endpoint QA
    (void eligible/ineligible, discount PERCENTAGE/FIXED valid/invalid, pending vs
    approved, duplicate handling) is outstanding.

47. **Waiter regression.** Shared Floor + Waiter menu/order flow unchanged; Waiter has
    no Supervisor void/discount controls. Static gates pass; authenticated Waiter
    regression **pending**.

48. **Cashier regression.** No Cashier file changed; payment collection remains
    Cashier-owned. Static gates pass; authenticated Cashier regression **pending**.

49. **Browser and viewport QA.** **Pending** — no browser automation. Consolidated
    3B1–3B3A sweep (four viewports) is owed. No screenshots fabricated.

50. **QA-created data.** None (no live mutations executed in this environment).

51. **Remaining limitations.** Live/browser/viewport QA + `/api/health` outstanding
    (also for 3B1/3B2). Backend does not itself check payment on void/discount — the UI
    adds the documented payment safety gate. Discount auto-approval threshold is
    org-config (default 5000) and is not fetched, so the UI shows an estimate and defers
    the final APPROVED/PENDING status to the response. Multiple pending discounts are
    backend-allowed but UI-guarded against.

52. **Prompt 3B3B prerequisites.** Discount approve/reject contracts (manager-PIN
    path), complimentary contract, and refund + post-close-void contracts; a safe
    branch-scoped server selector for transfer-server. None started.

53. **Final status.** **Prompt 3B3A implementation and technical validation complete;
    authenticated visual QA for Prompts 3B1–3B3A remains pending.**

54. **No-commit / no-push confirmation.** No `git commit`, no `git push`. Dirty
    worktree preserved.
