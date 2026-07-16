# Completion Report - WAITER-MVP Frontend Receipt + Request Bill UI

## Context Snapshot

- Current milestone: WAITER-MVP Frontend Receipt + Request Bill UI
- Previous completed milestone: WAITER-MVP Frontend Orders Queue
- Next recommended prompt: waiter Reservations seating flow or Me-tab self-service utilities, using existing backend contracts only

## Summary

- What was built: polished desktop-first request-bill and receipt surface inside `/waiter/orders/[orderId]`.
- What is now working: waiter can request bill from the order detail right panel, open a receipt drawer, view receipt preview, view receipt history, record reprint metadata, and record pending digital receipt send.

## Files Added / Changed

- `apps/web/src/lib/waiter/receipt-api.ts`
- `apps/web/src/lib/waiter/receipt-model.ts`
- `apps/web/src/components/waiter/receipts/WaiterBillActionPanel.tsx`
- `apps/web/src/components/waiter/receipts/WaiterReceiptActionBar.tsx`
- `apps/web/src/components/waiter/receipts/WaiterReceiptDrawer.tsx`
- `apps/web/src/components/waiter/receipts/WaiterReceiptHistoryTimeline.tsx`
- `apps/web/src/components/waiter/receipts/WaiterReceiptPreview.tsx`
- `apps/web/src/components/waiter/receipts/WaiterReceiptStatusBadge.tsx`
- `apps/web/src/components/waiter/receipts/WaiterReceiptTotals.tsx`
- `apps/web/src/components/waiter/receipts/index.ts`
- `apps/web/src/components/waiter/orders/WaiterOrderBuilderScreen.tsx`
- `apps/web/README.md`
- `ai/AI_STATUS.md`
- `repo file tree.txt`
- `ai/WAITER_MVP_FRONTEND_RECEIPT_REQUEST_BILL_COMPLETION_REPORT.md`

## Database

- Prisma models added/changed: none
- Migration name: none
- Indexes / constraints: none
- Seed updates: none
- Notes: frontend-only milestone

## API

- Existing endpoints used:
  - `POST /api/pos/orders/:id/request-bill`
  - `GET /api/pos/orders/:id`
  - `GET /api/receipts/:id`
  - `GET /api/receipts/:id/history`
  - `POST /api/receipts/:id/reprint`
  - `POST /api/receipts/:id/send`
- Request-bill response shape observed from backend source/Postman: `{ orderId, orderNumber, status, billRequested: true, requestedAt }`.
- Receipt response shape observed from backend source: composed order receipt where `receiptId === orderId`, with organization, branch, table, server, totals, items, payments, footer, timestamps, and history counts.
- `POST /api/receipts/:id/send` supports only `email`, `sms`, and `whatsapp` and returns 202 with `status: "PENDING"`, `supported: false`, and `reason: "NO_LIVE_DELIVERY_ADAPTER"`.
- Backend changes: none.
- Postman changes: none.

## UI Components Added

- `WaiterBillActionPanel`: right-panel bill state, Request Bill, View receipt, and blocked reasons.
- `WaiterReceiptDrawer`: 500px right-side drawer with overlay and receipt footer actions.
- `WaiterReceiptPreview`: printable-style receipt document with itemized lines and totals.
- `WaiterReceiptTotals`: prominent subtotal/tax/discount/service charge/total/paid/outstanding block.
- `WaiterReceiptHistoryTimeline`: Created/viewed/reprinted/send-pending/backend event timeline.
- `WaiterReceiptActionBar`: reprint and pending-send controls with backend-supported channel selection.
- `WaiterReceiptStatusBadge`: shared receipt status badge.

## Behavior

- Not sent orders disable Request Bill with `Send order before requesting bill.`
- Sent/in-progress/served orders can request bill when shift is open and backend allows it.
- Closed/voided orders block duplicate bill request and keep receipt preview available.
- Shift-not-open disables bill/reprint/send write actions where appropriate and explains why.
- Other-waiter ownership remains blocked by the existing order load path and backend guard.
- Request Bill shows `Bill requested.`, refetches the order, and opens receipt preview.
- Reprint calls backend metadata only and shows `Reprint request recorded.` No print driver is invoked.
- Send receipt records backend pending delivery only and shows `Receipt send is pending. No live email/SMS/WhatsApp adapter is connected yet.`

## Error / Loading / Empty States

- Receipt drawer has receipt loading skeleton, receipt unavailable state, history loading skeleton, history unavailable state, and `No receipt events yet.` empty state.
- Request/reprint/send failures map through the existing API error model for shift, ownership, unsafe transition, auth, forbidden, validation/state, and network failures.
- No full-page spinner-only loading was added.

## Route / Navigation Consistency

- `/waiter/orders/[orderId]` still renders the existing order builder.
- `/waiter/orders` and `/waiter/orders/new?tableId=` are unchanged.
- WaiterShell and bottom nav are unchanged.
- No Menu bottom-nav tab or standalone receipt/payment route was added.

## Tests

- Unit tests: none added
- e2e tests: none added
- Commands run:
  - `pnpm --filter @nimbus-pos/web typecheck`
  - `pnpm --filter @nimbus-pos/web lint`
  - `pnpm --filter @nimbus-pos/web build`
  - Chrome/Playwright smoke on a clean dev server at `http://localhost:3003`
- Results:
  - `typecheck`: passed
  - `lint`: passed with no ESLint warnings or errors
  - `build`: passed after rerun with a longer timeout; the first 120s run printed a complete successful route table but the shell timed out before returning
  - Browser smoke: `/login`, `/waiter/orders`, `/waiter/orders/test`, and `/waiter/orders/new?tableId=smoke-table` returned HTTP 200 and rendered the login/session-required surface. The only console error observed was a 404 resource load, likely favicon; no page/runtime error was observed.
  - Live authenticated receipt API flow: not run because no API was listening on port 3001 during this work session

## Postman

- Collection added/updated: none
- Variables/tests added: none
- Manual checklist executed: not applicable; prompt explicitly said not to modify Postman.

## Docs

- Updated `apps/web/README.md` with request-bill and receipt endpoint usage, drawer behavior, reprint metadata behavior, and send-pending caveat.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.

## Decisions / Deviations

- Receipt ID is modeled as order ID because backend BG4.A states `receiptId === orderId`.
- `request-bill` is treated as an audit/action result, not a receipt creation response. The UI refetches order/receipt instead of inventing receipt state.
- Receipt preview is available from the order detail drawer when the backend receipt endpoint returns data. Reprint/send stay disabled until receipt status is CLOSED or VOIDED because backend rejects non-printable states for those actions.
- Send UI requires a recipient because backend `SendReceiptDto` requires one, but the result is still PENDING/no adapter.

## Known Issues

- Live authenticated receipt flow was not executed because the API was not listening on port 3001 during this work session.
- `next start` smoke on port 3002 hit a generated Next vendor-chunk module lookup issue after `next build`; clean `next dev` smoke on port 3003 rendered the relevant routes successfully, and the production build itself passed.
- Receipt history endpoint currently includes receipt-side events and selected order lifecycle events; it does not include `ORDER_BILL_REQUESTED` from the order audit trail.

## Next Step

- Implement waiter Reservations seating or Me-tab self-service utilities, preserving existing-endpoint-only constraints.

## DONE Checks

- Request Bill uses a real backend endpoint.
- Receipt preview uses real backend response data when available.
- Receipt history uses a real backend endpoint.
- Reprint uses a real backend endpoint.
- Reprint does not invoke a print driver.
- Send receipt reflects PENDING/no live adapter honestly.
- No fake receipt delivery.
- No payment/mobile-money implementation.
- No PesaPal owner billing implementation.
- No split/merge/transfer implementation.
- Other-waiter order remains blocked by existing guard flow.
- Shift-not-open blocks unsafe write actions.
- Existing order builder still works at type level.
- Existing Orders Queue unchanged.
- Existing bottom nav unchanged.
- No Menu bottom-nav tab added.
- No backend code changed.
- No Postman changed.
- No invented endpoints.
