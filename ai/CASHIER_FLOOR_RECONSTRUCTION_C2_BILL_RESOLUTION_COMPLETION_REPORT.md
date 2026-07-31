# Cashier Floor-First Reconstruction — Prompt C2 Completion Report

**Table→Bill Resolution · Canonical Read-Only Settlement Workspace Foundation · orderId URL State · Find Bill Foundation**

- **Date:** 2026-07-31
- **Scope:** Frontend-only. No backend / schema / migration / seed / permission / Postman change.
- **Classification:** **A — C2 COMPLETE / READY FOR C3** (see §Final classification).
- **Commit/push:** ⛔ None. All changes left uncommitted in the working tree for review.

---

## 1. Repository path

`C:\Users\arman\Desktop\nimbus-pos` (canonical). The forbidden stale path
`C:\Users\arman\Desktop\NIMBUS\nimbus-pos` was never used.

## 2. Initial branch and HEAD

- Branch: `main` (ahead of `origin/main` by 11).
- HEAD: `9b374c39b8cc893a26c0dc374418ca008296a13c`.

## 3. Initial dirty worktree

The worktree carried extensive uncommitted Supervisor-final + Cashier-C0/C1 work. All of it was
preserved; C2 is purely additive on top of C1 (plus three superseded C1 e2e assertions updated to
the C2 behaviour, documented in §Deviations).

## 4. Documents read

Root `CLAUDE.md`, `.claude/CLAUDE.md`, `PROGRESS.md`, `ai/AI_STATUS.md`, the Cashier reconstruction
decision/gap-register/roadmap and the C0 audit set, the C1 completion report + QA evidence index,
`docs/cashier-ui-docs/*`, plus the full Cashier Queue/checkout/payment/split/receipt/refund/Till
component and library surface (`order-state`, `order-types`, `orders`, `resolution`, `readiness`,
`queue-filters`, `CashierCheckoutPreview`, `CashierOrderTotals`, `CashierPaymentSummary`), and the
Supervisor Find-order pattern (`SupervisorFindOrderDialog`, `SupervisorFloorScreen`) mirrored for
Find bill.

## 5. Previous selected-table boundary (C1)

C1's `CashierSelectedTablePanel` was a neutral, truthful read-only boundary ("Select a bill to
continue.") that exposed no payment/settlement action. C2 replaces it as the mount point with a
real bill-resolution + settlement-workspace foundation. `CashierSelectedTablePanel.tsx` is retained
(unused, still exported) so the C1 static assertions remain green; the Floor screen no longer imports
it.

## 6. Table-order query

`GET /api/pos/orders?tableId=<id>&pageSize=50` via the existing `listCashierOrders` contract
(branch-scoped, bounded, deterministic). One query per selected table, kept mounted while a bill is
open so "Back to bills" needs no re-fetch. No unbounded list, no per-row detail fetch, no
first-order shortcut, no copy of the Waiter "keep first active order" behaviour.

## 7. Payable-order classification

Central helper `lib/cashier/bill-resolution.ts`:
- `classifyCashierBillStatus(order)` — status-only, safe on every candidate without a payment
  fetch. Terminal (CLOSED/VOIDED/CANCELLED/REFUNDED) → `TERMINAL_READ_ONLY`; NEW/DRAFT →
  `NOT_CASHIER_SETTLEABLE`; SENT/IN_KITCHEN/READY/SERVED → `PAYABLE`; anything else →
  `UNKNOWN_UNSAFE` (fail closed).
- `classifyCashierBillPayment(order, summary)` — settlement-workspace only (summary already loaded):
  `PAYMENT_IN_PROGRESS` / `PARTIALLY_PAID` / `SETTLED` / `PAYABLE`, and `UNKNOWN_UNSAFE` when the
  summary is missing or indeterminate. Unknown state is never shown as unpaid/zero-due.
- `deriveCashierBillCandidates` / `resolveCashierTableBills` split a table's orders into payable
  candidates + terminal orders with a deterministic sort (bill-requested → most-recent → id).

## 8. Zero-order handling

Truthful empty state: "No bill is available for this table." No order is created, no menu opens, no
payment control is shown, Back-to-Floor is available. When terminal orders exist, a read-only
"Recent closed bills" selector is offered (only from the bounded query — never a claim that "no
order exists" when the query failed; query errors show a distinct Retry state).

## 9. One-order handling

Exactly one payable bill auto-resolves into the settlement workspace via `router.replace` (adds
`orderId`, keeps `tableId`, no new history entry, no visible intermediate selector). Canonical order
detail + payment summary each fetch once. No optimistic financials.

## 10. Multiple-order handling

`CashierBillSelector` renders a bounded, deterministic, keyboard-accessible list; the first bill is
**never** auto-selected. Rows show order number, status, service, opened time, total, and a
bill-requested marker — no guest PII, no payment reference, no raw UUID title. Selecting one pushes
`orderId` (browser Back returns to the selector); "Back to bills" replaces to the selector
deterministically.

## 11. Split-child handling

Multiple distinct payable bills on a table (including split children / concurrent orders) surface as
distinct selectable rows via the same selector — never visually merged. Split-payment execution
remains C3.

## 12. Canonical URL model

`/cashier/floor?tableId=<t>&orderId=<o>` (table-linked) or `?orderId=<o>` (tableless/takeaway/Find
bill). Helpers `buildCashierBillQuery` / `clearCashierBillQuery` in `lib/cashier/floor-route.ts`
(the C1 `buildCashierFloorQuery` tableId-only contract is unchanged). Refresh restores the bill;
Back/Forward restore prior selection; invalid/cross-branch orderId fails safe (bill-unavailable
message, never the wrong order — detail is always fetched by orderId).

## 13. Settlement workspace architecture

One canonical `CashierSettlementWorkspace` (read-only) with sections: **Bill** (identity + items),
**Totals**, **Payment state**, **Settlement readiness**, **History & context**. Rendered behind a
table (via `CashierBillResolutionPanel`) and behind a tableless orderId (directly from the screen) —
one workspace, one selected-order model. No C3/C4 mutation control is exposed.

## 14. Reused Queue components

`CashierOrderTotals`, `CashierPaymentSummary`, `CashierQueueStatusBadge`, and
`normalizeCashierOrder` (order-state) are reused directly — no duplicated financial logic. Queue is
NOT mounted, NOT imported wholesale, and runs no background query on Floor.

## 15. Reused Checkout components

The read-only presentation primitives of `CashierCheckoutPreview` (totals + payment summary + status
badge) are reused; its mutation panels (`CashierPaymentPanel`, `CashierResolutionPanel`) are
deliberately NOT imported into the C2 workspace.

## 16. Financial source of truth

Canonical backend amounts via `normalizeCashierOrder` / `deriveCashierPaymentState`. Decimal-safe
`asCashierNumber`; shared `formatCashierMoney` (UGX zero-fraction). No recomputation of authoritative
totals, no NaN/negative-zero/stale artifacts.

## 17. Payment-state presentation

Distinguishes loading / unavailable / no-payments / partially-paid / in-progress / paid. Unavailable
or failed payment state is explicitly labelled ("not shown as paid or unpaid until the summary
loads") and never enables an action. Payment summary is fetched only after a bill is selected — never
per Floor table.

## 18. Till/readiness presentation

Reuses `useCashierReadiness`. Shows shift/till badges + concise blocked messages + a non-navigating
"Open Till" link. Never auto-opens a till or auto-navigates. C3 will consume this to fail closed
before payment mutations.

## 19. Find bill foundation

`CashierFindBillDialog` — a compact Cashier-only sibling above the shared `OperationalFloor` (never
inside it, never affecting Waiter/Supervisor). Bounded branch page (pageSize 25) + client filter +
exact-order-id direct lookup; status/service filters; tableless & takeaway supported; result routes
into the same settlement workspace via orderId. Receipt-reference search is shown as an explicit
later-step capability (deferred to C4).

## 20-22. Tableless / takeaway / terminal handling

Tableless/takeaway bills open by `orderId` only (no fabricated table), refresh-safe. Terminal orders
are read-only (surfaced in the zero-state "Recent closed bills" list and openable read-only).

## 23. Queue / 24. Receipts compatibility

`/cashier/queue` and `/cashier/receipts` remain hidden compatibility routes — not in nav, not
redirected, not deleted, not mounted on Floor. Verified by static assertions + the
legacy-compatibility Playwright spec.

## 25. Privacy

No guest name/phone/email, no payment reference, no card data, no raw-UUID primary label, no
cross-branch data on Floor cards, selector rows, or Find-bill rows. Enforced by C1+C2 assertions and
the shared-floor-parity privacy spec.

## 26. Accessibility

Keyboard-accessible selector and Find-bill results; labelled Find bill control and dialog; workspace
sections use headings; payment state is badge+text (not colour-only); focus moves to the bill
heading on selection and returns on close; Escape closes Find bill and restores focus; `aria-live`
status regions for resolution/loading.

## 27. Responsive results / 28. / 30. Request counts

See `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_QA_EVIDENCE_INDEX.md`.

## 29. Files created / 30. modified / 31. removed

**Created (frontend):**
- `apps/web/src/lib/cashier/bill-resolution.ts`
- `apps/web/src/lib/cashier/bill-query-keys.ts`
- `apps/web/src/components/cashier/floor/CashierBillResolutionPanel.tsx`
- `apps/web/src/components/cashier/floor/CashierBillSelector.tsx`
- `apps/web/src/components/cashier/floor/CashierSettlementWorkspace.tsx`
- `apps/web/src/components/cashier/floor/CashierFindBillDialog.tsx`

**Created (QA / assertions):**
- `apps/web/scripts/cashier-c2-assertions.ts` + `scripts/tsconfig.cashier-c2-assertions.json`
- `apps/web/e2e/cashier-floor/c2-fixtures.ts`
- `apps/web/e2e/cashier-floor/{zero-one-multiple-bill-resolution,selected-bill-url-state,settlement-workspace-readonly,split-child-selection,payment-state-readonly,till-readiness,find-bill-foundation,tableless-takeaway-selection,legacy-compatibility-regression,request-count-c2,responsive-c2,cross-role-c2-regression}.spec.ts`

**Created (docs):** this report, `..._C2_QA_EVIDENCE_INDEX.md`, `..._PROMPT_C3.md`.

**Modified (frontend):**
- `apps/web/src/components/cashier/floor/CashierFloorScreen.tsx` (resolution + Find bill + orderId orchestration)
- `apps/web/src/components/cashier/floor/index.ts` (exports)
- `apps/web/src/lib/cashier/floor-route.ts` (added `buildCashierBillQuery` / `clearCashierBillQuery`; C1 helper unchanged)

**Modified (tests — superseded C1 boundary copy → C2 behaviour):**
- `apps/web/e2e/cashier-floor/{table-selection-routing,role-boundaries,responsive,shared-floor-parity}.spec.ts`

**Removed:** none.

## 32-36. Backend / schema / migration / seed / permission / Postman

None. Zero backend changes. `CashierSelectedTablePanel.tsx` retained (unused).

## 37-45. Validation

- typecheck: PASS. lint: PASS (0 warnings/errors). build: PASS.
- C1 assertions: PASS. C2 assertions: PASS. shell assertions: PASS. floor assertions: PASS.
- Playwright: see QA evidence index (executed on the isolated local Docker stack).
- Isolated API health `GET /api/health` → `{status:ok, db:ok}` on :4001.

## 46. Shared-Neon safety

All mutation/browser QA ran against an **isolated local Docker Postgres** (`nimbus-c2-qa`, port
55432) + isolated API (:4001) + isolated web (:3100). The shell carried no inherited `DATABASE_URL`
(clean isolation). Shared Neon (`ep-empty-paper`, :3001) was never written by C2.

## 47. Remaining C3 gaps

Payment creation/partial/split execution, order close, receipt print/reprint/deliver, refund
execution, Queue/Receipts retirement (C4/C5), and mutation invalidation remain out of scope. The C2
settlement workspace is the read-only mount point for those.

## 48. Readiness for C3

The settlement workspace, fail-closed readiness state, classification helper, and orderId URL model
are the foundation C3 builds payment/close on. See `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C3.md`.

## 49. No commit / no push

⛔ Confirmed — no `git commit`, no `git push`. Working tree left for the orchestrating session.

## Final classification

**A — C2 COMPLETE / READY FOR C3.**
