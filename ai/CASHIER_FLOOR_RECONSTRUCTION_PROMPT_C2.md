# NIMBUS POS — CASHIER FLOOR-FIRST RECONSTRUCTION — PROMPT C2

Table-to-order resolution and the Cashier settlement-workspace foundation (read-first),
plus the bounded Find bill foundation for non-table cases. Builds directly on C1 (Floor/Till/Me
nav, `/cashier/floor` default, shared `OperationalFloor` consumer, `?tableId=` selection state,
and the read-only `CashierSelectedTablePanel` mount point).

> C1 status when C2 starts: **A. C1 COMPLETE / READY FOR C2** (see
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`). Do not begin C2 until
> C1 is complete. C2 does **not** implement payment, split, or order close (those are C3), and
> does **not** remove/redirect Queue or Receipts (C4/C5).

## 1. Repository & safety

Use only `C:\Users\arman\Desktop\nimbus-pos` (authoritative dirty worktree). Never
reset/restore/stash/clean/discard/checkout-- or overwrite unrelated work. No commit, no push.
**No backend / schema / migration / seed / permission / Postman change** — C2 is frontend-only on
top of existing, C0-verified contracts. Preserve all Waiter/Supervisor/Cashier work, Queue,
Receipts, Till, refunds, shared shell/Floor/profile, performance hardening, and C1.

## 2. Read first (mandatory)

Root + `.claude` `CLAUDE.md`; `PROGRESS.md`; `ai/AI_STATUS.md`; the C1 completion report +
QA evidence index; the full C0 audit set (especially
`CASHIER_FLOOR_RECONSTRUCTION_PERMISSION_AND_API_MATRIX.md` §2.1–2.9 and §4, and
`CAPABILITY_MIGRATION_MATRIX.md`); `docs/cashier-ui-docs/*` (architecture/lifecycle/roadmap/test
plan); the C1 source (`components/cashier/floor/*`, `lib/cashier/floor-{api,model,route}.ts`);
the existing Cashier payment surface to be reused (`components/cashier/checkout/*` —
`CashierCheckoutPreview`, `components/cashier/queue/*`, `lib/cashier/{orders,payments,payment-*,
order-state,order-types}.ts`); the Supervisor order-workspace precedent
(`components/supervisor/floor/SupervisorTableControlWorkspace.tsx`, `SupervisorFindOrderDialog.tsx`).

## 3. Locked target for C2

1. **Table → payable order resolution.** On table selection, resolve the canonical payable
   order(s) for that branch+table using `GET /api/pos/orders?tableId=<id>` (bounded; exclude
   `CLOSED`/`VOIDED` for the active case). No dedicated "bill for this table" endpoint exists —
   derive client-side.
   - **Zero** payable orders → honest no-bill state (never "0 due"; unknown ≠ unpaid).
   - **One** payable order → open it in the settlement workspace.
   - **Multiple** payable orders → a bounded in-workspace order selector (never auto-pick).
   - **Only terminal orders** → do not silently open history; offer recent receipt context only
     via an explicit action (full receipt work is C4).
2. **Settlement workspace foundation (READ-FIRST in C2).** Replace the C1
   `CashierSelectedTablePanel` mount point with the canonical Cashier settlement workspace inside
   the shared `OperationalTableWorkspaceFrame`: header (back to Floor, table/service type, order
   number, server where useful, canonical order status, bill-requested state, payment read state,
   Till/readiness state) + bill review (item lines/qty, subtotal, tax, discounts, service charge
   where supported, total, split read state, payments already recorded, outstanding balance,
   refund read state). **Reuse `CashierCheckoutPreview`** and the existing order/payment read
   models — do not rebuild bill rendering.
3. **Find bill foundation.** A compact Cashier-only sibling control above the shared
   `OperationalFloor` (the exact architectural placement of Supervisor's Find order — never a
   forked Floor, never an Orders/Queue tab), opening tableless/takeaway/direct-lookup/closed cases
   into the same workspace. Bounded/paginated over `ListOrdersQueryDto` (`status`, `serviceType`,
   `tableId`, `userId`, `excludeStatus`, `page`, `pageSize`) + exact-ID fallback via
   `GET /pos/orders/:id` — mirror `SupervisorFindOrderDialog`. Honestly reflect the missing
   contracts (no order-number/free-text search, no payment-state filter, no date range — see C0
   matrix §4; do not fake them).
4. **URL state.** Extend the C1 model to `tableId` + `orderId` (+ optional `receiptId` reserved
   for C4) using the same `router.replace`/`push` `shallow:true` discipline; refresh/Back/Forward
   restore understandable context; a single bounded order-detail query domain (no storms).
5. **Fail closed.** Payment/close preflight surfaces (readiness/Till/session/branch) must read as
   blocked when state is unknown/missing. **No payment, split, or close mutation is wired in C2**
   — those controls are introduced in C3. C2 renders read state + disabled/preflighted affordances
   only.

## 4. Role boundaries (unchanged)

Cashier owns bill review/payment/close/receipts/till/refund (payment+close land C3). Cashier must
NOT gain menu/order entry, Supervisor void/discount-approval/complimentary, transfer-server,
reservation management, or Approvals. **`CashierTransferTablePanel` must not enter the new Floor
or settlement architecture** (still not deleted in C2 while the Queue workflow references it —
record its retirement phase in the gap register).

## 5. Do NOT (C2)

Payment/ split / close mutation (C3); receipt migration, reprint, delivery, refund (C4);
Queue/Receipts deletion or redirect (C4/C5); Till/Me redesign; any backend/schema/migration/seed/
permission/Postman change; Manager UI.

## 6. Validation & completion (executable — do not fabricate)

`typecheck` + `lint` + `build` for `@nimbus-pos/web`; the shell/floor/cashier-c1 assertion scripts
+ new `cashier-c2-assertions.ts`; a new `apps/web/e2e/cashier-settlement/` Playwright suite
**actually executed** across all four viewport projects against an **isolated local Docker
Postgres** stack (never shared Neon — reuse the C1 recipe in `docs/TESTING_AND_QA.md` and
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`); Waiter + Supervisor regression;
`GET /api/health` ok; `git diff --check` clean. Update `CLAUDE.md`/`PROGRESS.md`/`ai/AI_STATUS.md`/
the gap register/`docs/cashier-ui-docs/*`/the `docs/*` set; write
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_*_COMPLETION_REPORT.md` + QA evidence index + the C3 prompt.

## 7. Classification (use one)

A. C2 COMPLETE / READY FOR C3 · B. C2 COMPLETE WITH KNOWN LIMITATIONS / READY FOR C3 ·
C. C2 IMPLEMENTED / QA BLOCKED · D. C2 INCOMPLETE.

## 8. Completion gate (must all hold)

Table selection resolves payable order(s) canonically (zero/one/multiple handled truthfully);
the settlement workspace renders real read state (reusing `CashierCheckoutPreview`); Find bill
opens non-table cases into the same workspace; `tableId`/`orderId` URL state survives
refresh/Back/Forward; unknown payment/readiness reads as blocked, not zero-due; NO payment/split/
close mutation is exposed; shared `OperationalFloor` still consumed by Waiter/Supervisor/Cashier;
no Floor fork; Queue/Receipts still reachable by direct URL (not redirected); Till/Me unregressed;
role boundaries + privacy hold; typecheck/lint/build pass; assertions pass; Playwright executes on
all four viewports; Waiter/Supervisor regression passes; no backend/schema/migration/seed/
permission/Postman change; no commit; no push.
