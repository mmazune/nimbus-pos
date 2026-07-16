# Cashier UI Prompt 5 Split + Resolution Completion Report

Date: 2026-07-02
Repo: `C:\Users\arman\Desktop\nimbus-pos`
Status: complete / receipts build pending

## 1. Context snapshot

- Starting state from `ai/AI_STATUS.md`: `CASHIER_UI_PROMPT4_PAYMENT_ENTRY complete / split bill build pending`.
- Final state in `ai/AI_STATUS.md`: `CASHIER_UI_PROMPT5_SPLIT_RESOLUTION complete / receipts build pending`.
- Scope: cashier-safe split bill, split items, and advanced resolution tools inside the existing checkout preview workflow.

## 2. Repo path confirmed

- Used only `C:\Users\arman\Desktop\nimbus-pos`.
- Did not use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.
- Existing unrelated dirty backend, package, Postman, demo-data, and untracked files were left untouched.

## 3. Codex skills read

- `emil-design-eng`
- `frontend-design`
- `make-interfaces-feel-better`
- `impeccable` product-register fallback; no local `PRODUCT.md` or `DESIGN.md` existed.
- `web-design-guidelines`; latest guideline source was fetched.

## 4. Files read

- Governance/status: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`.
- Postman: every collection in `postman/collections/` was listed and skimmed.
- Cashier reports/docs: Prompt 1, 2, 3, and 4 completion reports, `ai/CASHIER_UI_REPO_VERIFICATION_REPORT.md`, `ai/CASHIER_UI_GAP_CONFIRMATION_MATRIX.md`, fallback docs under `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/*`, and fallback `Front End/cashier_ui_docs_pack/ai/CASHIER_UI_IMPLEMENTATION_ROADMAP.md`.
- Frontend: `apps/web/src/lib/cashier/*`, cashier shell/states/queue/checkout/resolution components, cashier pages, auth lib, login page, and `apps/web/package.json`.
- Backend contracts: `apps/api/src/modules/orders/**/*`, `apps/api/src/modules/pos-handoff/**/*`, `apps/api/src/modules/payments/**/*`, `apps/api/src/modules/receipts/**/*`, `apps/api/src/modules/floor/**/*`, `apps/api/src/modules/reservations/**/*`, `apps/api/src/modules/shifts/**/*`, `apps/api/src/modules/tills/**/*`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/seed.ts`, and `demo-data/DEMO_LOGIN_CREDENTIALS.md`.

## 5. Files changed

- Added `apps/web/src/lib/cashier/resolution.ts`.
- Added `apps/web/src/lib/cashier/resolution-types.ts`.
- Added `apps/web/src/lib/cashier/resolution-validation.ts`.
- Updated `apps/web/src/lib/cashier/order-types.ts`.
- Updated `apps/web/src/lib/cashier/order-state.ts`.
- Updated `apps/web/src/components/cashier/queue/CashierCheckoutPreview.tsx`.
- Updated `apps/web/src/components/cashier/queue/CashierQueueScreen.tsx`.
- Added `apps/web/src/components/cashier/resolution/*`.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.
- Added this report.

## 6. Backend DTO/endpoint confirmation

- `POST /api/pos/orders/:id/split-bill` uses `SplitBillDto`: `mode`, optional `count`, optional `groups`, optional `reason`.
- `POST /api/pos/orders/:id/split-items` uses `SplitItemsDto`: `items`, optional `targetTableId`, optional `reason`, optional `notes`.
- `POST /api/pos/orders/merge` uses `MergeOrdersDto`: `sourceOrderId`, `targetOrderId`, optional `reason`.
- `POST /api/pos/orders/:id/move-items` uses `MoveOrderItemsDto`: `targetOrderId`, `items`, optional `reason`.
- `POST /api/pos/orders/:id/transfer-table` uses `TransferTableDto`: `targetTableId`, optional `reason`.
- `POST /api/pos/orders/:id/transfer-server` uses `TransferServerDto`: `targetUserId`, optional `reason`.
- `GET /api/tables` is verified through `FloorController`; no cashier-safe staff selector endpoint was verified.

## 7. Split bill implementation

- Added split bill allocation under checkout preview.
- Equal split supports 2 to 20 guests and previews cent rounding on the last guest.
- Custom split supports labeled amount groups and validates exact total equality against the order total.
- Existing `Order.metadata.splitBill` is displayed with mode, groups, amounts, and reason when present.
- UI states clearly: `Split bill creates cashier allocation groups on this order. It does not create separate child orders.`
- Confirmation states that payments still attach to the parent order.

## 8. Split items implementation

- Added item selector with checkboxes and quantity inputs clamped to available line quantity.
- Requires at least one selected item and a reason.
- Optional target table is enabled only through verified `GET /api/tables`.
- Confirmation warns that a `NEW` child order is created and cashier does not send it to KDS.
- Success notice surfaces the returned child order number/id when available and repeats the no-KDS boundary.

## 9. Merge/move/transfer implementation or deferrals

- Merge orders is implemented for compatible loaded target orders, blocks self-merge, requires reason, and blocks source orders with payments.
- Move items is implemented for compatible loaded target orders, selected quantities, and required reason.
- Transfer table is implemented through verified `GET /api/tables`, excludes the current table, and requires reason.
- Transfer server is visibly deferred with reason: `Transfer server requires a verified cashier-safe staff selector.`

## 10. Idempotency handling

- All resolution mutations send `Idempotency-Key` using the existing `buildCashierIdempotencyKey` helper.
- Error mapping handles idempotency in-flight, payload mismatch, maintenance active/blocked, permission denial, validation, and network/API failures with cashier-safe copy.

## 11. Confirmation/blocking states

- Confirmation dialogs were added for split bill, split items, merge, move items, and transfer table.
- Resolution actions block on auth/session loading, missing session, non-cashier user, missing branch, missing/failed order detail, failed/loading payment summary, no active shift, closed/voided order, settled closed order, invalid status, mutation in flight, invalid selected items, missing target, missing reason, and backend permission/validation failures.

## 12. Queue/order refresh behavior

- Successful mutations call the existing checkout refresh path.
- Refresh covers selected order detail, selected order payment summary, queue list, active shift, and active till readiness.
- Child/target order numbers are surfaced where backend responses include them.
- The UI does not auto-navigate or assume a split child order is payable.

## 13. KDS/waiter-edit boundaries preserved

- No `/send`, `/in-kitchen`, `/ready`, or other KDS action was added.
- No waiter menu editing or order authoring controls were added.
- Split/move/merge copy states that KDS is not republished from cashier.

## 14. Deferred surfaces preserved

- No receipt screen workflow.
- No receipt send/reprint mutation.
- No till open/safe-drop/reconcile mutation.
- No refund or discount flow.
- No reservation/deposit UI.
- No backend business logic, Prisma schema, migration, Postman, seed, demo-data import, live mobile-money, real card-terminal, printer driver, receipt-delivery, MSR, badge login, or smart spout work.

## 15. Validation performed

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

## 16. Issues/blockers

- Browser/manual authenticated demo verification was not run because the prompt disallowed starting duplicate servers and no existing authenticated browser session was used.
- Transfer server remains deferred because no cashier-safe staff selector endpoint was verified.
- Worktree has substantial pre-existing modified/untracked files outside this prompt.

## 17. Recommended next prompt

- CASHIER_UI_PROMPT6_RECEIPTS: build receipt search/list/drawer/history/reprint/send-pending surfaces while preserving metadata-only printer and pending/no-adapter delivery caveats.

## 18. DONE checks

- Used only `C:\Users\arman\Desktop\nimbus-pos`.
- Protected unrelated worktree changes.
- Read Prompt 1 completion report.
- Read Prompt 2 completion report.
- Read Prompt 3 completion report.
- Read Prompt 4 completion report.
- Read cashier verification docs.
- Read cashier UI docs/fallback docs.
- Read backend split/handoff DTOs before implementing/validating mutations.
- Read required Codex skills.
- Did not weaken cashier auth/session guard.
- Did not weaken waiter routing.
- Split bill panel implemented.
- Equal split implemented.
- Custom split implemented.
- Split bill metadata shown if present.
- Split items panel implemented.
- Split items warns child order is NEW and not KDS-sent.
- Merge implemented with compatible target-order selection.
- Move items implemented with compatible target-order selection.
- Transfer table implemented with verified table selector.
- Transfer server deferred with visible reason.
- Resolution mutations use `Idempotency-Key`.
- Confirmation dialogs added for high-impact actions.
- Queue/order/payment summaries refresh after success.
- No KDS send action added.
- No waiter menu editing added.
- No payment behavior from Prompt 4 broken.
- No receipt send/reprint mutation added.
- No till open/safe-drop/reconcile mutation added.
- No refund mutation added.
- No backend business logic changed.
- No Prisma schema changed.
- No migrations created.
- No Postman changed.
- No demo database writes/import scripts run.
- No fake live mobile-money.
- No fake card terminal.
- No fake printer driver.
- No fake receipt delivery.
- Typecheck passed.
- Lint passed.
- `ai/CASHIER_UI_PROMPT5_SPLIT_RESOLUTION_COMPLETION_REPORT.md` created.
- `ai/AI_STATUS.md` updated.
