# CASHIER_GAP_REGISTER.md — Nimbus POS Cashier UI Gap Register

Status: Updated v1 (post-verification)  
Date: 2026-07-01  

This document tracks unresolved development gaps, API discrepancies, and safety constraints for the Cashier UI build.

| ID | Area | Gap | Evidence | Impact | Proposed Action / Finding | Status |
|---|---|---|---|---|---|---|
| **CASHIER-GAP-001** | Repo verification | Live Windows repo was not mounted here; docs use uploaded resources. | Verified codebase in active workspace. | None. All schemas and controllers match expectations. | Verified. Scanned schema, seed, DTOs, and controllers. | **Resolved** |
| **CASHIER-GAP-002** | Credentials | Exact cashier demo PIN unknown in mounted resources. | Found `cashier@nimbus.demo` (PIN `135790`) and `cashier@demo.local` (PIN `654321`). | Login QA risk. | Verified cashier credentials in seed and importer. | **Resolved** |
| **CASHIER-GAP-003** | Permissions | Exact seeded Cashier permissions need verification. | Cashier has `pos:payment:close` in `seed.ts` but the controller enforcment requires `pos:orders:close` for close order. | **403 Rejection** on order close. | Grant `pos:orders:close` to Cashier in seed, or update controller guard. | **Open (Critical)** |
| **CASHIER-GAP-004** | Payment enum | Exact `PaymentMethod`/DTO values unknown. | `PaymentMethod` enum in `schema.prisma` is `CASH`, `CARD`, `MOMO`, `BANK_TRANSFER`. | API payload mismatch. | Verified PaymentMethod and PaymentStatus enums. | **Resolved** |
| **CASHIER-GAP-005** | MTN/Airtel | User wants method assignment, but live execution pending. | Outbound collections push is disabled by default via config. | Misleading live payment risk. | MTN and Airtel will be displayed as manual reference or mock only. | Locked caveat |
| **CASHIER-GAP-006** | PesaPal | Existing PesaPal is SaaS billing only. | Confirmed PesaPal endpoints are under `/billing/pesapal/`. | Wrong diner method risk. | Exclude PesaPal from diner payment selection. | Locked exclusion |
| **CASHIER-GAP-007** | Split tender | Payment summary suggests paid/remaining/isSettled, but multiple tender behavior needs verification. | Verified `closeOrderWithPayment` and `createManualReferencePayment` support multiple payment logs. | None. Split tender works. | Verified: Multiple payments are added to Order.payments. | **Resolved** |
| **CASHIER-GAP-008** | Split bill DTO | Exact allocation DTO unknown. | `SplitBillDto` has EQUAL and CUSTOM modes. EQUAL requires `count`. CUSTOM requires `groups`. | Split math mismatch. | Verified: split-bill is non-physical and updates Order.metadata. | **Resolved** |
| **CASHIER-GAP-009** | Split items DTO | Exact item quantity payload unknown. | `SplitItemsDto` expects an array of item IDs and quantities to move. | Bad payload risk. | Verified: split-items copies items to new order and decrements source. | **Resolved** |
| **CASHIER-GAP-010** | Advanced handoff | Cashier has split/merge/transfer/move permissions, but product is payment-focused. | Verified Cashier permissions in `seed.ts`. | UI clutter/waiter clone risk. | Keep handoff features under advanced checkout panels. | Proposed |
| **CASHIER-GAP-011** | Bill-requested filter | Need exact order list filter/field. | There is no `billRequested` column on `Order`. `requestBill` only writes an AuditLog. | Queue accuracy risk. | Cashier queue must fetch all open/served orders. | **Open** |
| **CASHIER-GAP-012** | Close rules | Exact close preconditions need verification. | Order must be in payable states. Balance must be <= 0. | Close could unlock too early. | Recalc outstanding balance during payments; block close if balance > 0. | **Resolved** |
| **CASHIER-GAP-013** | Cash till requirement | Product rule says cash requires active till; code must confirm. | `hasActiveTillInBranch` is not called in the payments service. | Wrong cash enablement risk. | Enforce till open check strictly in frontend client. | **Open** |
| **CASHIER-GAP-014** | Cash movements | Only safe-drop/reconcile confirmed in uploaded resources. | No controller endpoints for paid-in/paid-out/pickup exist. | Missing drawer workflows. | Hide or defer paid-in/paid-out/pickup. | **Open** |
| **CASHIER-GAP-015** | Refund approval | Cashier create/view likely; approval unclear. | Cashier has `pos:refund:create` but NOT `pos:refund:approve`. | Unauthorized approval risk. | Hide approve refund actions from Cashier; require supervisor PIN. | **Resolved** |
| **CASHIER-GAP-016** | Discount approval | Request/approve endpoints exist; cashier permission unclear. | Cashier has `pos:discount:request` but NOT `pos:discount:approve`. | Unauthorized discount risk. | Auto-approve if <= 5000 UGX, request approval if > 5000 UGX. | **Resolved** |
| **CASHIER-GAP-017** | Receipt printer | No print driver. | Verified printer routes are metadata-only. | Fake print risk. | Metadata-only copy print layout. | Locked caveat |
| **CASHIER-GAP-018** | Receipt send | No live adapter. | `sendReceipt` returns status `PENDING` with supported: false. | Fake delivery risk. | Display digital send as pending / mock only. | Locked caveat |
| **CASHIER-GAP-019** | Card terminal | Terminal is STUB. | Terminal pairing is stub-only. | Fake acquirer risk. | Card payment recorded as manual reference only. | Locked caveat |
| **CASHIER-GAP-020** | Reservation deposits | Deposit endpoints exist but cashier MVP scope unclear. | Deferred from MVP tabs. | Scope creep. | Defer all reservations from cashier UI nav. | Deferred |
| **CASHIER-GAP-021** | Demo fixtures | Need cashier-safe orders/tills/receipts/refunds. | Cash movements are NOT imported by `demo-import.ts`. | Empty demo screens. | Import cash movements in `demo-import.ts` seed. | **Open** |
| **CASHIER-GAP-022** | Dedicated Postman | Cashier-specific workflow collection not provided. | Only global and waiter collections exist. | QA gap. | Create a dedicated cashier flow Postman collection. | **Open** |
| **CASHIER-GAP-023** | Path normalization | Both `:id` and `{orderId}` styles appear in audit. | Verified all routes are normalized to standard NestJS path shapes. | Wrong client path risk. | Normalize routes in client. | **Resolved** |
| **CASHIER-GAP-024** | Offline recovery | Idempotency exists; frontend recovery design must be implemented. | Verified idempotency key header is supported. | Double-submit risk. | Frontend must pass Idempotency-Key header on mutations. | **Open** |
