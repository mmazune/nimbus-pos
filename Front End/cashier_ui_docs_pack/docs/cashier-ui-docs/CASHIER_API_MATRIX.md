# CASHIER_API_MATRIX.md — Nimbus POS Cashier API Matrix

> ⚠️ **HISTORICAL / SUPERSEDED (2026-08-20).** This is the **pre-reconstruction, Queue-first**
> cashier endpoint matrix (Verified v1, 2026-07-01). It has been **superseded by
> `docs/cashier-ui-docs/CASHIER_API_MATRIX.md`**, which documents the implemented C2
> Floor-first build — Floor/bill-resolution, Find bill, and the read-only settlement workspace
> rows this file has no concept of — adds a **live-verified status** column (2026-08-20,
> isolated local stack), cites the actual controller and `@Permissions` guard per row, and
> separates the endpoints that are now reachable **only** through the hidden compatibility
> routes `/cashier/queue` + `/cashier/receipts` (retire C4/C5).
>
> This file is retained for history: it remains an accurate record of the **pre-reconstruction**
> cashier surface, which is exactly what those hidden compatibility routes still mount. That
> material now lives as §7 of the superseding file. **Do not treat it as current spec** — in
> particular, payment collection, order close, split/merge/move/transfer, receipts and refunds
> are **not** wired on the primary Cashier Floor path by design until C3+.
>
> Body below is unchanged.

Status: Verified v1 (superseded — see banner above)  
Date: 2026-07-01  
Scope: cashier-relevant endpoint matrix verified against repository source code.

## 1. General Rules

- Use existing endpoints only.
- All mutating actions (close order, payment intent, till open, till reconcile) support optional `Idempotency-Key` headers via `Bg3ReliabilityService`.
- Public MTN/Airtel execution push, PesaPal diner checkout, real print driver, and real card acquirer traffic are excluded.

## 2. API Matrix

| Area | Method | Path | Purpose | Required Permission | DTO / Request Body | Status/Caveat |
|---|---|---|---|---|---|---|
| **Auth** | POST | `/api/auth/login` | Email/password login | None (Public) | `LoginDto` (email, password) | Verified |
| **Auth** | POST | `/api/auth/quick-pin-login` | PIN-first login | None (Public) | `QuickPinLoginDto` (branchId, pin, platform) | Verified |
| **Auth** | GET | `/api/auth/me` | Resolve identity & context | None (Auth token) | None | Verified |
| **Auth** | POST | `/api/auth/logout` | Revoke session | None (Auth token) | None | Verified |
| **Shift** | GET | `/api/shifts/active` | Get active operator shift | `pos:shift:read` | None | Verified |
| **Shift** | POST | `/api/shifts/open` | Open shift | `pos:shift:open` | `OpenShiftDto` (notes) | Verified |
| **Shift** | POST | `/api/shifts/:id/close` | Close shift | `pos:shift:close` | `CloseShiftDto` (varianceReason, notes) | Verified |
| **Till** | GET | `/api/tills/active` | Get active till session | `pos:till:read` | None | Verified |
| **Till** | POST | `/api/tills/open` | Open till | `pos:till:open` | `OpenTillDto` (tillCode, openingFloat, notes) | Verified |
| **Till** | GET | `/api/tills/:id` | Get till session details | `pos:till:read` | None | Verified |
| **Till** | GET | `/api/tills/:id/summary` | Expected vs counted float summary | `pos:till:read` | None | Verified |
| **Till** | POST | `/api/tills/:id/safe-drop` | Record cash safe drop | `pos:till:safe-drop` | `SafeDropDto` (amount, reason) | Verified |
| **Till** | POST | `/api/tills/:id/reconcile` | Reconcile till and close session | `pos:till:reconcile` | `ReconcileTillDto` (countedCash, varianceReason, notes) | Verified |
| **Orders** | GET | `/api/pos/orders` | Fetch Queue orders | `pos:orders:read` | `ListOrdersQueryDto` (status, serviceType, tableId, userId, excludeStatus) | Verified |
| **Orders** | GET | `/api/pos/orders/:id` | Order details & totals | `pos:orders:read` | None | Verified |
| **Orders** | GET | `/api/pos/orders/:id/payments` | Paid vs outstanding summary | `pos:payment:read` | None | Verified |
| **Orders** | POST | `/api/pos/orders/:id/close` | Settle and close order | **`pos:orders:close`** | `CloseOrderDto` (payments array of method/amount/transactionId/metadata, reason) | **Permission Mismatch** (Cashier is seeded with `pos:payment:close` instead of `pos:orders:close`) |
| **Payments** | POST | `/api/payments/intents` | Create MoMo payment intent | `pos:payment:intent` | `CreatePaymentIntentDto` (orderId, provider, amount, currency, phoneNumber, idempotencyKey, metadata) | Verified (MTN push is mock/disabled by default; Airtel has no adapter) |
| **Payments** | GET | `/api/payments/intents/:intentId` | Read intent details | `pos:payment:read` | None | Verified |
| **Payments** | GET | `/api/payments/intents/:intentId/status` | Read intent status | `pos:payment:read` | None | Verified |
| **Payments** | POST | `/api/payments/intents/:intentId/cancel` | Cancel pending intent | `pos:payment:cancel` | `CancelPaymentIntentDto` | Verified |
| **Payments** | POST | `/api/payments/manual-reference` | Record card/MoMo manual reference | `pos:payment:manual-reference` | `CreateManualReferencePaymentDto` (orderId, method, provider, amount, externalTransactionId, payerPhone, note) | Verified |
| **Payments** | GET | `/api/payments/manual-reference` | Search reference payments | `pos:payment:read` | Query: `verificationStatus` | Verified |
| **Split** | POST | `/api/pos/orders/:id/split-bill` | Non-physical split (allocation) | `pos:order:split` | `SplitBillDto` (mode, count, groups array, reason) | Verified (saves to `Order.metadata.splitBill`) |
| **Split** | POST | `/api/pos/orders/:id/split-items` | Physical split (creates child) | `pos:order:split` | `SplitItemsDto` (items array of orderItemId/quantity, targetTableId, reason, notes) | Verified (child is created in status `NEW`) |
| **Handoff** | POST | `/api/pos/orders/merge` | Merge two open orders | `pos:order:merge` | `MergeOrdersDto` (sourceOrderId, targetOrderId, reason) | Verified |
| **Handoff** | POST | `/api/pos/orders/:id/move-items` | Move items to existing order | `pos:order:move-items` | `MoveOrderItemsDto` (targetOrderId, items array, reason) | Verified |
| **Handoff** | POST | `/api/pos/orders/:id/transfer-table` | Transfer order to another table | `pos:order:transfer` | `TransferTableDto` (targetTableId) | Verified |
| **Handoff** | POST | `/api/pos/orders/:id/transfer-server` | Transfer order to another server | `pos:order:transfer` | `TransferServerDto` (targetUserId) | Verified |
| **Receipts** | GET | `/api/receipts/:id` | Fetch formatted receipt details | `pos:receipt:read` | None | Verified (receiptId == orderId) |
| **Receipts** | GET | `/api/receipts/:id/history` | Reprint/Send audit log timeline | `pos:receipt:read` | `ReceiptHistoryQueryDto` | Verified |
| **Receipts** | POST | `/api/receipts/:id/reprint` | Log reprint action | `pos:receipt:reprint` | `ReprintReceiptDto` (copies, reason) | Verified (Metadata-only; no hardware printer driver) |
| **Receipts** | POST | `/api/receipts/:id/send` | Log digital send request | `pos:receipt:send` | `SendReceiptDto` (channel, recipient, locale, note) | Verified (Returns `status: PENDING`, supported: false; no adapter) |
| **Refunds** | GET | `/api/pos/orders/:id/refunds` | Get order refunds history | `pos:refund:read` | None | Verified |
| **Refunds** | POST | `/api/pos/orders/:id/refunds` | Create a refund | `pos:refund:create` | `CreateRefundDto` (paymentId, amount, reason, provider, metadata) | Verified (auto-approves if <= 5000 UGX) |
| **Refunds** | POST | `/api/pos/refunds/:id/approve` | Approve a pending refund | `pos:refund:approve` | `ApproveRefundDto` (managerPin) | **Manager/Supervisor Only** (Cashier lacks permission) |
| **Refunds** | POST | `/api/pos/orders/:id/post-close-void` | Void order within 15 mins | `pos:void:postclose` | `PostCloseVoidDto` (managerPin, reason) | **Manager/Supervisor Only** (Cashier lacks permission) |
| **Discounts** | POST | `/api/pos/orders/:id/discounts` | Apply discount to order | `pos:discount:request` | `RequestDiscountDto` (type, value, reason, metadata) | Verified (auto-approves if <= 5000 UGX) |
| **Devices** | GET | `/api/devices` | Read active branch devices | `devices:read` | None | Verified |
| **Devices** | GET | `/api/devices/printers/routes` | Read print routing configs | `devices:read` | None | Verified |
