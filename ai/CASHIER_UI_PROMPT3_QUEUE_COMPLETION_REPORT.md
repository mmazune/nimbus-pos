# CASHIER_UI_PROMPT3_QUEUE Completion Report

## 1. Context snapshot

- Current status before work: `CASHIER_UI_PROMPT2_SESSION_CONTEXT complete / queue build pending`.
- Requested scope: cashier Queue/orders read surface only.
- Required build constraint: existing frontend only, using real read endpoints and no mutation calls.
- Workspace confirmed: `C:\Users\arman\Desktop\nimbus-pos`.

## 2. Repo path confirmed

- Worked only in `C:\Users\arman\Desktop\nimbus-pos`.
- Did not use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.

## 3. Codex skills read

- `emil-design-eng`
- `frontend-design`
- `make-interfaces-feel-better`
- `impeccable`
- `web-design-guidelines`
- `browser:control-in-app-browser` for attempted local browser verification.

## 4. Files read

- Mandatory governance/context docs: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`, and all existing `postman/collections/*.json`.
- Cashier prior work: Prompt 1 and Prompt 2 reports, cashier shell/state/lib/page files.
- API/contracts: order controller/service/list DTO, payment controller/service payment summary path, receipt controller, Prisma order/payment model snippets, seed/permission context, waiter order and receipt UI/API patterns.

## 5. Files changed

- Updated `apps/web/src/lib/cashier/formatters.ts`.
- Added `apps/web/src/lib/cashier/order-types.ts`.
- Added `apps/web/src/lib/cashier/orders.ts`.
- Added `apps/web/src/lib/cashier/order-state.ts`.
- Added `apps/web/src/lib/cashier/queue-filters.ts`.
- Added `apps/web/src/components/cashier/queue/*`.
- Updated `apps/web/src/pages/cashier/queue.tsx`.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.
- Added `ai/CASHIER_UI_PROMPT3_QUEUE_COMPLETION_REPORT.md`.

## 6. Queue API implementation

- `listCashierOrders` calls `GET /api/pos/orders`.
- The Queue query uses `excludeStatus=NEW,CLOSED,VOIDED&pageSize=100`.
- `getCashierOrder` calls `GET /api/pos/orders/:id`.
- `getCashierOrderPayments` calls `GET /api/pos/orders/:id/payments`.
- No POST, PATCH, PUT, or DELETE calls were added.

## 7. Search/filter implementation

- Added local search across order number, ID, table, server, guest, status, service type, and payment label.
- Added local filters for Active payable, Ready / served, In progress, and Partially paid.
- Added disabled Closed today chip with reason: `Closed Today needs a supported date filter before it can be exact.`

## 8. Order card implementation

- Cards show order identity, status, payment state, server, guest, readiness, elapsed/opened time, service type, and total.
- Cards are buttons with visible focus states and selection state.
- Status and payment states use text badges, not color alone.

## 9. Checkout preview implementation

- Added a sticky read-only preview panel.
- Shows order identity, service/table/server/opened metadata, item lines from detail reads, totals, and payment summary.
- Includes retry controls for detail and payment summary read failures.
- Includes no item editing and no checkout mutation controls.

## 10. Payment summary read implementation

- Payment summaries are read per queue order and refreshed for the selected preview.
- The UI derives unpaid, partially paid, settled, and unknown states from `orderTotal`, `totalPaid`, `remainingBalance`, and `isSettled`.
- Existing payments and provider intents are displayed read-only with method/provider, amount, status, reference, and time.

## 11. Bill-requested gap handling

- The Queue displays the exact required note:
  `Bill-requested is audit-derived. Until a dedicated filter exists, Queue shows active payable branch orders.`
- No fake bill-requested filter or invented order field was added.

## 12. Readiness-aware blocking

- No active shift copy: `No active shift. Payment actions will stay blocked.`
- No active till copy: `No active till. Cash payments will stay blocked.`
- Shift/till failed states remain visible and block future checkout confidence.
- Take payment, cash-sensitive messaging, split bill, close order, and refund placeholders remain disabled/read-only.

## 13. Deferred surfaces preserved

- Bottom nav remains exactly Queue, Receipts, Till, Me.
- No Floor, Menu, or Payments cashier tab was added.
- No backend controller/service edits, Prisma schema edits, migrations, Postman edits, seed/demo-data edits, package edits, live mobile-money, print driver, terminal/acquirer, MSR, badge login, or smart spout work was added.

## 14. Validation performed

- `corepack pnpm@8.15.0 --version` -> `8.15.0`.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` -> passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` -> passed with no warnings after one memoization cleanup.
- Port check showed existing listeners on 3000 and 3001; no duplicate servers were started.

## 15. Issues/blockers

- In-app Browser verification was attempted twice against existing local servers, but the Browser webview did not attach.
- No authenticated visual/browser flow was completed because of that tool attach failure.
- CLI validation is green.

## 16. Recommended next prompt

- CASHIER_UI_PROMPT4_PAYMENT_ENTRY: implement the first controlled payment entry surface behind existing readiness checks, using real payment endpoints only if the prompt explicitly authorizes mutations.

## 17. DONE checks

- Queue home implemented with real read data.
- Active payable default excludes `NEW`, `CLOSED`, and `VOIDED`.
- Closed Today is disabled/deferred until safe date filtering exists.
- Bill-requested audit-derived gap is documented in UI.
- Checkout preview is read-only.
- Future payment/split/close actions are disabled with explicit reasons.
- AI status and repo file tree are updated.
- Completion report is written.
