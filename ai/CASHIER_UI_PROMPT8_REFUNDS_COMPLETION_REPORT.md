# CASHIER_UI_PROMPT8_REFUNDS_COMPLETION_REPORT

## 1. Context snapshot

- Starting status: `CASHIER_UI_PROMPT7_TILL complete / refunds build pending`.
- Completed status: `CASHIER_UI_PROMPT8_REFUNDS complete / cashier me polish pending`.
- Scope: frontend-only cashier-safe refund history and refund creation using existing backend endpoints.

## 2. Repo path confirmed

- Used only `C:\Users\arman\Desktop\nimbus-pos`.
- Did not use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.
- Pre-existing unrelated backend, package, Postman, demo-data, and untracked worktree changes were left untouched.

## 3. Codex skills read

- `emil-design-eng`
- `frontend-design`
- `make-interfaces-feel-better` plus typography, surfaces, animations, and performance references
- `impeccable` product-register fallback; root PRODUCT/DESIGN context was not present
- `web-design-guidelines`; latest guideline source was fetched

## 4. Files read

- Governance/status: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`.
- Postman: every collection under `postman/collections/` was listed and skimmed; refund/POS/payment/receipt collections were inspected for route confirmation.
- Cashier reports/docs: Prompt 1 through Prompt 7 completion reports, repo verification report, gap matrix, fallback cashier UI docs, and cashier implementation roadmap.
- Frontend: cashier lib, shell, state, queue, checkout, resolution, receipts, till files; cashier pages; auth lib; login page; `apps/web/package.json`.
- Backend contracts: refund, order, payment, receipt, till, and discount modules; Prisma schema and seed; demo credentials.

## 5. Files changed

- Added `apps/web/src/lib/cashier/refund-types.ts`.
- Added `apps/web/src/lib/cashier/refunds.ts`.
- Added `apps/web/src/lib/cashier/refund-state.ts`.
- Added `apps/web/src/lib/cashier/refund-validation.ts`.
- Added `apps/web/src/components/cashier/refunds/*`.
- Updated `apps/web/src/components/cashier/receipts/CashierReceiptDrawer.tsx`.
- Updated `apps/web/src/components/cashier/receipts/CashierReceiptsScreen.tsx`.
- Updated `apps/web/src/components/cashier/queue/CashierCheckoutPreview.tsx`.
- Updated `apps/web/src/components/cashier/queue/CashierQueueScreen.tsx`.
- Updated `apps/web/src/lib/cashier/queue-filters.ts`.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.
- Added this report.

## 6. Backend DTO/endpoint confirmation

- `CreateRefundDto` requires `paymentId`, `amount`, and `reason`; `provider` and `metadata` are optional.
- Refund status enum is `PENDING`, `APPROVED`, `COMPLETED`, `FAILED`.
- `POST /api/pos/orders/:id/refunds` is BG3-wrapped with optional idempotency and permission `pos:refund:create`.
- Refunds require the order to be `CLOSED` and the selected payment to be `COMPLETED`.
- Amount is checked against selected payment amount minus active refunds.
- Amounts at or below the org threshold, default 5,000 UGX, return `COMPLETED`; above threshold returns `PENDING`.
- `POST /api/pos/refunds/:id/approve` and `POST /api/pos/orders/:id/post-close-void` remain manager/supervisor-only and were not called.

## 7. Refund history implementation

- Refund history uses `GET /api/pos/orders/:id/refunds`.
- The history renders refund id, payment id/provider, amount, status, reason, requester, approver id/name where returned, timestamps, approval-required indicator, and failure reason if metadata includes one.
- Empty state: `No refunds recorded for this order.`
- Failure state: `Could not load refund history.`

## 8. Refund creation implementation

- Refund creation uses only `POST /api/pos/orders/:id/refunds`.
- The form requires payment selection, amount, reason, and confirmation.
- Payment selector is payment-bound because backend requires `paymentId`.
- Failed/non-completed/fully refunded payment rows remain visible but disabled with reasons.

## 9. Threshold/approval handling

- Threshold copy uses 5,000 UGX.
- Amounts at or below threshold show `Refund is within cashier auto-approval threshold.`
- Amounts above threshold show `Refund exceeds cashier auto-approval threshold. It will require manager approval.`
- Success copy distinguishes `Refund recorded.` from `Refund request submitted for manager approval.`

## 10. Manager approval boundary

- Added visible `Manager approval` boundary card.
- Copy: `Cashier can create refund requests. Approval for refunds above threshold is manager/supervisor-only.`
- No manager PIN, approve, reject, or override control was added.

## 11. Post-close void boundary

- Added visible `Post-close void` boundary card.
- Copy: `Post-close void is manager/supervisor-only and remains outside the cashier workflow.`
- No post-close void endpoint is called and no manager PIN input is shown.

## 12. Receipt/queue integration

- Receipt drawer now exposes `Refund` for fully paid closed receipts.
- Queue now has a closed-order review filter for read-only receipt/refund review.
- Closed checkout preview exposes `Open refund`; non-closed orders show `Refunds are available after close.`
- No Refund bottom-nav item was added.

## 13. Idempotency handling

- Refund creation sends `Idempotency-Key` via existing `buildCashierIdempotencyKey`.
- The backend route is BG3-wrapped with optional idempotency.
- UI maps in-flight, payload mismatch, and maintenance-blocked outcomes to cashier-safe copy.

## 14. Error/blocked states

- Blocks auth/session loading, missing token, non-cashier user, missing branch, missing order, order detail failure, payment summary failure, refund history failure, non-closed order, voided order, no refundable payment, invalid selected payment, invalid amount, over-refund, missing reason, in-flight mutation, permission denial, backend validation, idempotency conflict, maintenance block, and network failure.
- Refund history read is allowed to fail visibly, but creation stays blocked when history cannot be trusted.

## 15. Deferred surfaces preserved

- No manager refund approval controls.
- No post-close void execution controls.
- No discount approval controls.
- No reservation/deposit UI.
- No accounting/reporting/franchise UI.
- No backend business logic, Prisma schema, migrations, Postman, seed/demo data, live mobile-money, card terminal, printer driver, or fake receipt delivery changes.

## 16. Validation performed

Commands run:

```pwsh
corepack pnpm@8.15.0 --version
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
```

Results:

- pnpm version: `8.15.0`
- Typecheck: passed.
- Lint: passed with no warnings or errors.

## 17. Issues or blockers

- Browser/manual authenticated demo verification was not run because no duplicate API/web servers were started.
- `GET /api/receipts/:id` payment rows do not include external reference/provider fields, so the refund panel fetches `GET /api/pos/orders/:id/payments` for reliable payment selection.
- Postman collections were not changed per Prompt 8 scope.

## 18. Recommended next prompt

- CASHIER_UI_PROMPT9_ME: polish cashier Me/profile/session/self-service/logout without payroll, staff list, accounting, reporting, franchise, or manager settings.

## 19. DONE checks

- used only `C:\Users\arman\Desktop\nimbus-pos`
- protected unrelated worktree changes
- read Prompt 1 completion report
- read Prompt 2 completion report
- read Prompt 3 completion report
- read Prompt 4 completion report
- read Prompt 5 completion report
- read Prompt 6 completion report
- read Prompt 7 completion report
- read cashier verification docs
- read cashier UI docs/fallback docs
- read backend refund DTOs/controllers/services before implementing mutations
- read required Codex skills
- did not weaken cashier auth/session guard
- did not weaken waiter routing
- refund history implemented
- refund creation implemented
- refund threshold copy implemented
- manager approval boundary implemented
- no manager approval control exposed
- post-close void boundary implemented
- no post-close void execution exposed
- receipt refund entry added where safe
- queue/checkout refund entry added where safe
- refund mutation uses `Idempotency-Key`
- refund data refreshes after success
- no refund overpayment allowed
- no discount approval added
- no reservation/deposit UI added
- no backend business logic changed
- no Prisma schema changed
- no migrations created
- no Postman changed
- no demo database writes/import scripts run
- no fake live mobile-money
- no fake card terminal
- no fake printer driver
- no fake receipt delivery
- no fake manager approval
- typecheck passed
- lint passed
- `ai/CASHIER_UI_PROMPT8_REFUNDS_COMPLETION_REPORT.md` created
- `ai/AI_STATUS.md` updated
