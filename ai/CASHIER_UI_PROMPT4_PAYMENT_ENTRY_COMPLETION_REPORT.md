# CASHIER_UI_PROMPT4_PAYMENT_ENTRY Completion Report

## 1. Context snapshot

- Starting status: `CASHIER_UI_PROMPT3_QUEUE complete / checkout payment build pending`.
- Completed status: `CASHIER_UI_PROMPT4_PAYMENT_ENTRY complete / split bill build pending`.
- Scope: frontend-only cashier checkout payment entry on top of Prompt 3 Queue.

## 2. Repo path confirmed

- Used only `C:\Users\arman\Desktop\nimbus-pos`.
- Did not use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.
- Existing dirty backend, Postman, package, demo, and untracked files were left untouched.

## 3. Codex skills read

- `emil-design-eng`
- `frontend-design`
- `make-interfaces-feel-better` plus typography/surfaces/animations/performance references
- `impeccable` product register reference; no local `PRODUCT.md` or `DESIGN.md` existed
- `web-design-guidelines` latest source

## 4. Files read

- Governance/status: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`.
- Postman: every collection under `postman/collections/` was listed and skimmed for naming, URL, variable, and idempotency conventions.
- Cashier docs/reports: Prompt 1, 2, and 3 completion reports, cashier repo verification report, gap matrix, and fallback docs under `Front End/cashier_ui_docs_pack`.
- Frontend: `apps/web/src/lib/cashier/*`, cashier shell/states/queue components, cashier pages, auth lib, login page, UI primitives, and `apps/web/package.json`.
- Backend contracts: order/payment/shift/till/receipt controllers, payment DTOs/service logic, Prisma payment/order schema excerpts, seed permission excerpts, and demo credentials.

## 5. Files changed

- Added `apps/web/src/lib/cashier/idempotency.ts`.
- Added `apps/web/src/lib/cashier/payment-types.ts`.
- Added `apps/web/src/lib/cashier/payment-validation.ts`.
- Added `apps/web/src/lib/cashier/payments.ts`.
- Added `apps/web/src/components/cashier/checkout/*`.
- Updated `apps/web/src/components/cashier/queue/CashierCheckoutPreview.tsx`.
- Updated `apps/web/src/components/cashier/queue/CashierQueueScreen.tsx`.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.
- Added this report.

## 6. Backend DTO/endpoint confirmation

- `POST /api/payments/manual-reference` uses `CreateManualReferencePaymentDto` with `orderId`, `method`, `provider`, `amount`, `externalTransactionId`, `payerPhone`, `postedAt`, and `note`.
- Manual-reference method enum is only `MOMO`, `CARD`, `BANK_TRANSFER`; it does not allow `CASH`.
- `POST /api/pos/orders/:id/close` uses `CloseOrderDto` with a non-empty `payments` array; each payment supports `CASH`, `CARD`, `MOMO`, `BANK_TRANSFER`, `amount`, `transactionId`, and `metadata`.
- Close endpoint requires `pos:orders:close`, is BG3-wrapped, and uses `Idempotency-Key`.
- Payment intent DTO supports `MTN` and `AIRTEL`, but live diner checkout remains provider-gated and was not exposed as live push.

## 7. Payment method implementation

- Added Cash, Card reference, MTN MoMo reference, Airtel Money reference, and Bank transfer reference.
- PesaPal is explicitly excluded from diner checkout copy.
- All method cards are keyboard-accessible radio controls with visible blocked/caveat states.

## 8. Split tender implementation

- Split tender is supported safely through repeated manual-reference payments for card, MTN, Airtel, and bank transfer.
- Cash can be used only as the final tender through the close endpoint because partial cash would require recording a payment without closing, which the verified DTOs do not support.

## 9. Cash/till gating

- Cash is blocked unless active shift and active till are confirmed.
- Cash amount must equal outstanding and order status must be `SERVED`.
- Overpayment is blocked in the frontend to avoid unclear change-due behavior.

## 10. Card/manual reference handling

- Card is manual-reference only.
- Reference ID is required.
- UI copy states no live acquirer/card-terminal traffic.

## 11. MTN/Airtel provider-gated handling

- MTN and Airtel are manual-reference only in this UI.
- Payer phone is available for those methods.
- UI copy states MTN/Airtel diner checkout is pending provider confirmation.
- No live Request-to-Pay flow was exposed or triggered.

## 12. Bank transfer handling

- Implemented because `CreateManualReferencePaymentDto` and the Prisma `PaymentMethod` enum both support `BANK_TRANSFER`.
- Reference ID is required.

## 13. Idempotency handling

- Added `buildCashierIdempotencyKey`.
- Payment and close mutations send an `Idempotency-Key` header.
- Payment intent helper also sends the header and body idempotency key, though the live intent UI is not exposed in Prompt 4.
- Idempotency conflict/in-flight/maintenance errors are mapped to short operational copy.

## 14. Order close implementation

- Final cash settlement calls `POST /api/pos/orders/:id/close` with a cash payment payload and idempotency header.
- Manual-reference final payment relies on backend `autoSettleIfFullyPaid`, then refreshes queue, order detail, payment summary, shift, and till state.
- The close panel points to Receipts after a closed order and avoids duplicate close/payment rows.

## 15. Error/blocked states

- Blocks no active shift, no active till for cash, closed/voided orders, failed/loading payment summary, pending provider intents, invalid amount, overpayment, missing manual reference, partial cash, and non-`SERVED` cash close.
- Backend validation and idempotency errors are shown inline after mutation failure.

## 16. Deferred surfaces preserved

- No split bill allocation UI.
- No split item UI.
- No merge/move/transfer UI.
- No receipt send/reprint mutations.
- No till open/safe-drop/reconcile mutations.
- No refund flow.
- No backend controller/service changes, Prisma schema edits, migrations, Postman edits, seed/demo-data writes, live mobile-money, live card terminal, printer driver, or fake receipt delivery.

## 17. Validation performed

- `corepack pnpm@8.15.0 --version` -> `8.15.0`.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` -> passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` -> passed with no warnings or errors.

## 18. Issues/blockers

- Browser/manual demo verification was not run because the prompt disallowed starting duplicate servers and I did not attach to an existing authenticated browser session.
- Partial cash split tender is explicitly deferred because the backend has no safe standalone cash-payment endpoint.
- Separate close-without-new-payment is not supported by `CloseOrderDto`; the UI avoids duplicate payment rows.

## 19. Recommended next prompt

- CASHIER_UI_PROMPT5_SPLIT_RESOLUTION: build split bill allocation, split items, and advanced resolution tools using only verified backend endpoints, keeping them outside bottom navigation.

## 20. DONE checks

- Used only `C:\Users\arman\Desktop\nimbus-pos`.
- Protected unrelated worktree changes.
- Read Prompt 1, Prompt 2, and Prompt 3 completion reports.
- Read cashier verification docs and fallback cashier UI docs.
- Read backend payment/order DTOs before implementing mutations.
- Read required Codex skills.
- Did not weaken cashier auth/session guard or waiter routing.
- Payment panel implemented.
- Cash implemented as final close only; partial cash deferred based on DTOs.
- Card manual reference implemented.
- MTN/Airtel provider-gated manual reference implemented.
- PesaPal excluded.
- Bank transfer implemented.
- Amount validation implemented.
- Split tender implemented where safe.
- Cash blocked without active till.
- Close blocked until settled/final cash conditions are safe.
- Payment and close mutations use `Idempotency-Key`.
- Payment summary refreshes after payment.
- Order/queue/readiness refresh after payment/close.
- Backend validation/idempotency errors shown.
- No split bill/items, merge/move/transfer, till write, refund, receipt send/reprint, backend business logic, Prisma schema, migrations, Postman, demo-data writes, fake live mobile-money, fake card terminal, fake printer driver, or fake receipt delivery.
- Typecheck passed.
- Lint passed.
