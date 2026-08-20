> ⚠️ **SUPERSEDED IN PART (2026-08-20).** Historical record; the brand palette and favicon were rebranded Aug 2026 — see `docs/BRAND_IDENTITY.md`. Kept for history.

# CASHIER_UI_REPO_VERIFICATION_REPORT.md — Cashier UI Repository Verification Report

## 1. Context Snapshot

* **Date:** 2026-07-01
* **Status:** Complete (Deep Research and Verification Phase Only)
* **Goal:** Verify cashier UI gaps, deferred surfaces, permissions, endpoints, DTOs, payments/till/receipt/refund behavior, and demo data readiness before any cashier frontend implementation begins.
* **Summary of Result:** Verification successful. We identified critical permission mismatches (such as the order close endpoint requiring `pos:orders:close` while the cashier is only seeded with `pos:payment:close`) and verified DTO schemas, shift/till requirements, and mobile money / printer safety boundaries. A definitive Go recommendation is provided, subject to resolved constraints.

## 2. Repo Path Confirmed

* **Active Workspace Path:** `C:\Users\arman\Desktop\nimbus-pos` (excluding `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`)
* **Environment:** local demo environment, corepack pnpm@8.15.0 verified.

## 3. Files Scanned

1. `packages/db/prisma/schema.prisma`
2. `packages/db/prisma/seed.ts`
3. `packages/db/prisma/demo-import.ts`
4. `demo-data/DEMO_LOGIN_CREDENTIALS.md`
5. `demo-data/csv/*.csv`
6. `apps/api/src/modules/auth/**/*`
7. `apps/api/src/modules/shifts/**/*`
8. `apps/api/src/modules/tills/**/*`
9. `apps/api/src/modules/orders/**/*`
10. `apps/api/src/modules/payments/**/*`
11. `apps/api/src/modules/receipts/**/*`
12. `apps/api/src/modules/refunds/**/*`
13. `apps/api/src/modules/discounts/**/*`
14. `apps/api/src/modules/reservations/**/*`
15. `apps/api/src/modules/device-registry/**/*`
16. `apps/api/src/modules/pos-handoff/**/*`
17. `apps/web/src/pages/login.tsx`
18. `apps/web/src/lib/auth/**/*`
19. `apps/web/src/lib/api/**/*`
20. `apps/web/src/lib/waiter/**/*`
21. `apps/web/src/components/ui/**/*`

## 4. Search Commands Used

* `list_dir` to inspect file and folder trees.
* `grep_search` to find enums, decorators, method names, error codes, and CSV mappings in backend and schema files.
* `view_file` to review specific segments of services, controllers, DTOs, and configs.
* `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate` for dry-run verification.

---

## 5. Cashier Identity / Auth Findings

1. **Job Roles/Enums:** The `JobRole` enum in `schema.prisma` contains `CASHIER`.
2. **Demo Cashier Users:**
   * **Sarah Namutebi** (`cashier@nimbus.demo`), password `Demo1234!`, Quick PIN `135790`, PIN tier `LOW_6`, Branch `Tapas Downtown` (branchId `cb27be401a2c35dfc0d4e610` in csv).
   * **Demo Cashier** (`cashier@demo.local`), password `Cashier#123`, Quick PIN `654321`, PIN tier `LOW_6`, Branch `Main Branch` (branchId `cmqlcjlo700umwp6lodyywf56` in seed).
3. **Quick PIN Credentials:** Checked and validated. Sarah Namutebi's PIN is `135790` and Demo Cashier's PIN is `654321`.
4. **Email/Password Fallback:** Yes, both cashier accounts have valid emails and passwords seeded, allowing email/password login.
5. **Login Endpoints:**
   * `POST /api/auth/login` (Email/password login)
   * `POST /api/auth/quick-pin-login` (Quick PIN login with fields: `branchId`, `pin`, `platform`)
   * `POST /api/auth/pin-login` (Legacy/email+PIN login)
6. **`/api/auth/me` Response Shape:** Returns the user details, an array of `roles` (including `jobRole`), `permissions`, `memberships` (with branch and organization info), `context` (defaultOrganizationId, defaultBranchId, defaultMembershipId), and `session` metadata.
7. **Seeded Branch/Workspace:** Sarah Namutebi is mapped to `Tapas Downtown` and Demo Cashier is mapped to `Main Branch`.
8. **Role-Based Redirects:** Currently, `apps/web/src/pages/login.tsx` only allows routing to `/waiter/floor` for waiter-compatible roles (`isWaiterCompatible`).
9. **Current Login Redirection for Cashier:** There is no current frontend route or view for Cashier. Trying to log in with a Cashier user yields a blocked message: `"This frontend MVP currently supports waiter workspace only."`
10. **Cashier Landing Location:** The cashier must land on the **Queue** screen (e.g. `/cashier/queue`).

## 6. Cashier Permission Findings

1. **Seeded Permissions:** The `Cashier` role in `seed.ts` is granted `pos:orders:read`, `pos:orders:write`, `pos:payment:create`, `pos:payment:read`, `pos:payment:close`, `pos:payment:intent`, `pos:payment:manual-reference`, `pos:payment:cancel`, `pos:refund:create`, `pos:refund:read`, `pos:shift:open`, `pos:shift:close`, `pos:shift:read`, `pos:till:open`, `pos:till:reconcile`, `pos:till:safe-drop`, `pos:till:read`, `pos:order:split`, `pos:order:merge`, `pos:order:transfer`, `pos:order:move-items`, `pos:receipt:read`, `pos:receipt:reprint`, `pos:receipt:send`, `devices:read`, etc.
2. **Inheritance vs Direct:** Mapped directly to the `Cashier` role in `seed.ts` (direct role mapping).
3. **Read POS Orders:** Yes, Cashier has `pos:orders:read`.
4. **Close Orders:** Cashier has `pos:payment:close` in `seed.ts`, but **PaymentsController requires `pos:orders:close`** for `POST /api/pos/orders/:id/close`. This is a critical mismatch gap.
5. **Create Payments:** Yes, `pos:payment:create`.
6. **Create Payment Intents:** Yes, `pos:payment:intent`.
7. **Record Manual References:** Yes, `pos:payment:manual-reference`.
8. **Cash Payment Endpoints:** Yes, cash payments are submitted through the close-order endpoint, which requires `pos:orders:close` (mismatch).
9. **Card/Manual Reference Endpoints:** Yes, through `pos:payment:manual-reference`.
10. **Mobile-Money Endpoints:** Yes, through `pos:payment:intent`.
11. **Refund:** Yes, `pos:refund:create`.
12. **Post-Close Void:** **NO**. Cashier does not have `pos:void:postclose`. This is manager/supervisor/owner only.
13. **Apply Discounts:** Yes, `pos:discount:request`.
14. **Approve Discounts:** **NO**. Cashier does not have `pos:discount:approve`.
15. **Split Bills:** Yes, `pos:order:split`.
16. **Split Items:** Yes, `pos:order:split`.
17. **Merge Orders:** Yes, `pos:order:merge`.
18. **Transfer Tables:** Yes, `pos:order:transfer`.
19. **Transfer Servers:** Yes, `pos:order:transfer`.
20. **Move Items:** Yes, `pos:order:move-items`.
21. **Read Receipts:** Yes, `pos:receipt:read`.
22. **Reprint Receipts:** Yes, `pos:receipt:reprint`.
23. **Send Receipts:** Yes, `pos:receipt:send`.
24. **Open Tills:** Yes, `pos:till:open`.
25. **Reconcile Tills:** Yes, `pos:till:reconcile`.
26. **Create Cash Movements:** Yes, through tills endpoints (`pos:till:safe-drop`, `pos:till:open` for float, and `pos:till:reconcile`).
27. **Read Device/Printer/Terminal Metadata:** Yes, `devices:read`.
28. **Modify Printer Routes or Pair Terminals:** **NO**. Cashier does not have `devices:write` or `terminals:write`.
29. **Excluded Owner/Manager Permissions:** `pos:void:postclose`, `pos:discount:approve`, `pos:refund:approve`, `devices:write`, `terminals:write`, `routes:write`, `pos:payroll:*`, and reports generation must remain hidden.

## 7. Shift / Till Requirement Findings

1. **Active Shift for Payments:** In the backend, `assertWaiterShiftOpen` only applies to waiter-only actors. Cashier is exempt from shift checks in payments/order close.
2. **Shift Error Codes:** `SHIFT_NOT_OPEN` is thrown when a waiter attempts an write without a shift.
3. **Active Till for Cash Payments:** The backend `closeOrderWithPayment` does **NOT** validate if there is an active open till. The active till requirement is a frontend product/UI constraint only.
4. **Active Till for Card / Mobile-Money / Manual Reference:** Same as above; not enforced in the backend payments service.
5. **Shift Lookup Endpoints:** `GET /api/shifts/active`
6. **Open Shift Endpoint:** `POST /api/shifts/open`
7. **Close Shift Endpoint:** `POST /api/shifts/:id/close`
8. **Till Lookup Endpoints:** `GET /api/tills/active`
9. **Open Till Endpoint:** `POST /api/tills/open`
10. **Till Summary Endpoint:** `GET /api/tills/:id/summary`
11. **Safe Drop Endpoint:** `POST /api/tills/:id/safe-drop`
12. **Pickup/Pay-in/Pay-out Endpoints:** There are no dedicated controller endpoints for paid-in/paid-out/pickup cash movements. They are only defined in `CashMovementType` enum and processed inside `tills.service.ts` calculations.
13. **Till Reconciliation Endpoint:** `POST /api/tills/:id/reconcile`
14. **Float / Counted / Expected / Variance DTOs:**
    * `OpenTillDto`: `tillCode` (string, max 50), `openingFloat` (number, min 0, max 2 decimal places), `notes` (optional).
    * `ReconcileTillDto`: `countedCash` (number, min 0), `varianceReason` (optional), `notes` (optional).
    * `SafeDropDto`: `amount` (number, min 0.01), `reason` (string).
15. **Seeded Open Cashier Shift and Till:** Open shift `SHF-000002` and open till `TILL-01` are seeded for cashier `cashier@demo.local` in `seed.ts`.

## 8. Order Queue / Bill Request Findings

1. **List Cashier-Visible Orders:** `GET /api/pos/orders`
2. **List Order Filters:** Supports `status`, `serviceType`, `tableId`, `userId`, `excludeStatus`, `page`, and `pageSize`.
3. **Bill-Requested State Storage:** **NO database column exists**. Waiter bill request (`POST /api/pos/orders/:id/request-bill`) only writes an `AuditEvent` with action `'ORDER_BILL_REQUESTED'`. It does not mutate the order status or metadata in the database.
4. **Filter Cashier Queue for Bill Requests:** There is no query parameter or column in `ListOrdersQueryDto` or the `Order` model to filter for bill requests.
5. **Relationship with Checkout:** `requestBill` is an advisory waiter action that emits an audit event. The order status remains unchanged (usually `SERVED`). Cashier checkout processes the payment and calls `POST /api/pos/orders/:id/close` to settle.
6. **Order Queue Statuses:** Show `SENT`, `IN_KITCHEN`, `READY`, `SERVED`.
7. **Hidden Order Statuses:** Hide `NEW` (drafts), `CLOSED`, and `VOIDED` from the active Queue, although `CLOSED` history is visible in the Receipts tab.
8. **Open New/Draft Orders:** No, cashier cannot create drafts (no `pos:orders:write` menu operations).
9. **Open Sent/Ready/Served Orders:** Yes, these are checkout-ready.
10. **Open Closed Orders:** Closed orders are read-only receipts.
11. **Order Detail Response:** `GET /api/pos/orders/:id` returns order details including lines (`OrderItem` array), subtotal, tax, discount, total, table (label), and user (waiter).
12. **Waiter/Table/Guest Info:** Includes waiter details and table labels. Guest names/PII are not stored on POS orders.
13. **Dedicated Payment Queue Endpoint:** No dedicated cashier queue endpoint exists; Cashier must filter orders using status filters (e.g. `status=SERVED` or `excludeStatus=NEW,CLOSED,VOIDED`).

## 9. Payment Methods and Settlement Findings

1. **Payment Methods Enum:** `CASH`, `CARD`, `MOMO`, `BANK_TRANSFER`.
2. **Payment Statuses:** `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`.
3. **Payment Intent Statuses:** `PENDING`, `REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`, `CANCELLED`.
4. **Create Payment Intent Endpoint:** `POST /api/payments/intents` (body: `orderId`, `provider`, `amount`, `phoneNumber`, `currency`, `idempotencyKey`).
5. **Record Cash / Card / MoMo Payment Endpoints:**
   * Cash and card are recorded on order settlement via `POST /api/pos/orders/:id/close` (body: `payments` array).
   * Manual card / MoMo reference payments are recorded via `POST /api/payments/manual-reference` (body: `orderId`, `method`, `provider`, `amount`, `externalTransactionId`, `payerPhone`, `note`).
6. **Direct Payment Record vs Intent:** Both are supported. Cash/card/transfer are recorded directly as `COMPLETED` payments (or `UNVERIFIED` for manual references), whereas mobile money uses intents (`PaymentIntent`) first.
7. **Split Tender Support:** Yes, `closeOrderWithPayment` allows passing multiple payment entries in the `payments` array.
8. **Multiple Payments per Order:** Yes, `createManualReferencePayment` can be called repeatedly, which decrements the outstanding balance.
9. **Partial Payment:** Yes, balance is calculated dynamically.
10. **Outstanding Amount Calculation:** Outstanding balance is `order.total - sum(completed payments)`.
11. **Block Overpayment:** Yes, `closeOrderWithPayment` blocks overpayment unless `CASH` is included in the methods.
12. **Cash Change Due:** Calculated on order close: `changeDue = totalCovered - orderTotal` (returned if cash is used).
13. **Underpayment Handling:** Blocks closing order: throws `BadRequestException` if total payments are less than order total.
14. **Idempotency Key:** Optional header `Idempotency-Key` is supported for close order, payment intents, and till actions via the `Bg3ReliabilityService`.
15. **Payment Creation Payload:**
    * Intent: `orderId`, `provider`, `amount`, `phoneNumber`, `currency`, `idempotencyKey`.
    * Manual Reference: `orderId`, `method`, `provider`, `amount`, `externalTransactionId`, `payerPhone`, `note`.
16. **Order Close Payload:** `payments` (array of method/amount/transactionId/metadata), `reason` (optional).
17. **Assign Payment Method before Close:** Yes, in split-tender checkout flows.
18. **Close Order after Settlement:** Settlement and closing happen in a single transaction in `closeOrderWithPayment`.
19. **Close Validation:** Verifies total paid equals or exceeds payable total.
20. **Local-Demo-Safe Methods:** Cash and manual reference payments (card reference, manual MoMo reference).
21. **Stub/Manual Labels:** Card is reference-only; printer and terminal are stubs.
22. **PesaPal diner checkout:** Excluded. PesaPal is only used for SaaS owner billing.

## 10. Mobile-Money / Card / Hardware Safety Findings

1. **MTN/Airtel Endpoints:**
   * Webhook receivers: `POST /api/webhooks/mtn`, `POST /api/webhooks/airtel`.
   * Outbound calls: Only MTN RequestToPay outbound call is implemented in `mtn.adapter.ts`. Airtel has no adapter.
2. **Diner MoMo Endpoints Status:** Outbound MoMo push is **disabled by default** via `PAY_MTN_ENABLED=false` config. If disabled, it only records `REQUIRES_ACTION` in the database, acting as a stub/mock.
3. **MoMo Webhooks Status:** Webhooks verify signatures, but since outbound push is mock/disabled, they act as stubs.
4. **Card Terminal Pairing:** Pairings use `PAYMENT_TERMINAL_STUB` device type and do not trigger live terminal transactions.
5. **Printer Integration:** `PrinterRoute` records print config. Receipt reprint creates an audit event `RECEIPT_REPRINTED` but does not invoke hardware print drivers.
6. **Receipt Reprint / Send Caveats:**
   * Reprint: `"Metadata only — no print-driver invocation"`
   * Send: `"Pending — no live email/SMS/WhatsApp adapter"` (returns `supported: false` + `NO_LIVE_DELIVERY_ADAPTER`).

## 11. Split Bill / Split Items / Split Tender / Handoff Findings

1. **Split Bill Endpoint:** `POST /api/pos/orders/:id/split-bill`
2. **Split Bill Payload:** `mode` ('EQUAL' | 'CUSTOM'), `count` (optional, 2..20), `groups` (optional array of label/amount).
3. **Split Bill Side-Effect:** Does **NOT** create child orders. It stores the allocation groups inside `Order.metadata.splitBill` JSON.
4. **Split Items Endpoint:** `POST /api/pos/orders/:id/split-items`
5. **Split Items Payload:** `items` (array of `orderItemId` and `quantity`), `targetTableId` (optional), `reason`, `notes`.
6. **Split Items Side-Effect:** **Creates a child order** with status `NEW` and `splitFromOrderId` pointing to the source. Source items are decremented.
7. **Cashier Split Permission:** Yes, Cashier has `pos:order:split`.
8. **Merge Orders Endpoint:** `POST /api/pos/orders/merge` (body: `sourceOrderId`, `targetOrderId`).
9. **Move Items Endpoint:** `POST /api/pos/orders/:id/move-items`
10. **Transfer Table Endpoint:** `POST /api/pos/orders/:id/transfer-table`
11. **Transfer Server Endpoint:** `POST /api/pos/orders/:id/transfer-server`
12. **Split Tender vs Split Bill:** Split tender (multiple payments on one order) is supported out of the box in payments. Split bill is an advisory division of total order balance into group claims.

## 13. Receipt Findings

1. **View Receipt Endpoint:** `GET /api/receipts/:id`
2. **Receipt History Endpoint:** `GET /api/receipts/:id/history`
3. **Reprint Endpoint:** `POST /api/receipts/:id/reprint`
4. **Send Endpoint:** `POST /api/receipts/:id/send`
5. **Cashier Permissions for Receipts:** Cashier has `pos:receipt:read`, `pos:receipt:reprint`, `pos:receipt:send`.
6. **Reprint DTO:** `copies` (number), `reason` (string).
7. **Send DTO:** `channel` ('EMAIL' | 'SMS' | 'WHATSAPP'), `recipient` (string), `locale`, `note`.
8. **Send Response:** Returns status `PENDING`, `supported: false`, `reason: 'NO_LIVE_DELIVERY_ADAPTER'`.
9. **Receipt ID:** Equals `orderId` (closed orders represent receipts).
10. **Receipt Content:** Includes payments, totals, table, waiter, branch/org.
11. **Reprint Driver:** Metadata-only. No print driver is invoked.

## 14. Refund / Void / Discount Findings

1. **Refund Endpoints:**
   * `POST /api/pos/orders/:id/refunds` (create refund)
   * `POST /api/pos/refunds/:id/approve` (approve refund)
   * `GET /api/pos/refunds/:id` (refund details)
   * `GET /api/pos/orders/:id/refunds` (list order refunds)
2. **Create Refund Payload:** `paymentId` (string), `amount` (number), `reason` (string), `provider` (optional), `metadata` (optional).
3. **Cashier Refund Creation:** Cashier has `pos:refund:create`.
4. **Refund Approval Threshold:** Checked against `discountApprovalThreshold` (default 5,000 UGX). Amounts <= 5,000 are auto-approved (`status = COMPLETED`). Amounts > 5,000 require manager approval (`status = PENDING`).
5. **Manager PIN Approval:** Approved via `POST /api/pos/refunds/:id/approve` with optional `managerPin`. PIN verification uses `bcrypt.compare`.
6. **Cashier Approve Refund:** **NO**. Cashier does not have `pos:refund:approve`.
7. **Post-Close Void Endpoint:** `POST /api/pos/orders/:id/post-close-void` (body: `managerPin`, `reason`).
8. **Post-Close Void Window:** 15 minutes from when the order was closed (enforced in `refunds.service.ts`).
9. **Cashier Post-Close Void:** **NO**. Cashier does not have `pos:void:postclose`.
10. **Discount Endpoints:**
    * `POST /api/pos/orders/:id/discounts` (request discount)
    * `POST /api/pos/discounts/:id/approve` (approve discount)
    * `POST /api/pos/discounts/:id/reject` (reject discount)
    * `GET /api/pos/discounts/pending` (list pending discounts)
11. **Discount Approval Threshold:** Same as refunds: value <= 5,000 UGX is auto-approved, value > 5,000 UGX is pending approval.
12. **Cashier Discount Approval:** **NO**. Cashier can request (`pos:discount:request`), but not approve.

## 15. Reservation / Deposit Findings

* Cashier has all reservation/deposit permissions.
* However, reservations/deposits are **deferred** from the Cashier MVP scope, as there is no bottom tab or Floor UI for reservations.

## 16. Frontend Infrastructure Findings

1. **Shared Auth Utilities:** `isWaiterCompatible`, `getDisplayName`, `resolveDefaultMembership` in `apps/web/src/lib/auth/role.ts`.
2. **Shared API Client:** `apiRequest` in `apps/web/src/lib/api/client.ts`.
3. **UI Components:** Suite of prebuilt elements under `components/ui/` (LoadingState, ErrorState, EmptyState, Badge, StatusBadge, Button, Input, PageShell, etc.).
4. **Design Tokens:** Tailwind configuration and `globals.css` provide the brand color theme (navy/silver/slate).
5. **Phosphor Icons:** Installed and active.
6. **React Query:** `@tanstack/react-query` is configured.
7. **Cashier Route Folder:** Future implementation should go in `apps/web/src/pages/cashier/` and `apps/web/src/components/cashier/`.

## 17. Demo-Data Readiness Findings

1. **Cashier Demo Users:** Yes, `cashier@nimbus.demo` and `cashier@demo.local` are seeded with correct credentials.
2. **Cashier PIN Credentials:** Yes, Sarah Namutebi (`135790`) and Demo Cashier (`654321`).
3. **Open Cashier Shift/Till:** Yes, open shift `SHF-000002` and open till `TILL-01` are seeded in `seed.ts` for `cashier@demo.local`.
4. **Bill-Requested Orders:** Since bill-requested status is not stored in the database, no orders are stored as "bill-requested". However, orders in `SERVED` state are seeded, which are ready for payment.
5. **Partially Paid Orders:** Yes.
6. **Refundable Orders:** Yes, multiple closed orders exist.
7. **Cash Movement Examples:** Seeded in `seed.ts`, but **NOT imported by `demo-import.ts`** (this is a fixture gap).
8. **`db:demo:validate`:** Passed successfully.

---

## 18. Deferred / Unsafe Surfaces Confirmed

* Outbound MoMo push is mock/disabled by default (`PAY_MTN_ENABLED=false`).
* Airtel Collections push is un-implemented.
* PesaPal is SaaS subscription billing only; excluded from checkout.
* Receipt send is pending (returns `supported: false` + `NO_LIVE_DELIVERY_ADAPTER`).
* Printer routes and terminal pairing are stub/metadata only.
* No print driver is invoked; no card hardware traffic is triggered.
* No HMS secrets, customer PII, or real financial identities.
* Accounting, backoffice, KDS, and item-edit pages are hidden from Cashier.

## 19. Gap Register Updates Required

1. **CASHIER-GAP-001 (Repo verification):** Mark as **Resolved**. Scanned and verified code.
2. **CASHIER-GAP-002 (Credentials):** Mark as **Resolved**. Sarah Namutebi (`135790`) and Demo Cashier (`654321`) confirmed.
3. **CASHIER-GAP-003 (Permissions Mismatch):** Mark as **Critical Mismatch Gap**. The close order endpoint requires `pos:orders:close`, but Cashier is only seeded with `pos:payment:close`.
4. **CASHIER-GAP-004 (Payment Enum):** Mark as **Resolved**. Enum is `CASH`, `CARD`, `MOMO`, `BANK_TRANSFER`.
5. **CASHIER-GAP-007 (Split Tender):** Mark as **Resolved**. Split tender is fully supported in payments.
6. **CASHIER-GAP-008 & 009 (Split DTOs):** Mark as **Resolved**. Verified the DTO properties.
7. **CASHIER-GAP-011 (Bill-requested Filter):** Mark as **Confirmed Gap**. Bill requested status is not saved in the database, so we cannot filter list results by it.
8. **CASHIER-GAP-013 (Cash till check):** Mark as **Confirmed Gap**. Till open check is not enforced on payments in the backend; must be handled on the frontend.
9. **CASHIER-GAP-014 (Cash movements):** Mark as **Confirmed Gap**. paid-in/paid-out/pickup have no dedicated controller endpoints.
10. **CASHIER-GAP-021 (Demo fixtures):** Mark as **Gap**. Cash movements are not imported by `demo-import.ts`.

## 20. API Matrix Updates Required

* Map `POST /api/pos/orders/:id/close` with permission `pos:orders:close` and flag the permission mismatch.

## 21. Roadmap Changes Required

* Add a step to resolve the `pos:orders:close` / `pos:payment:close` permission mismatch on the backend, or grant `pos:orders:close` to Cashier in `seed.ts`.

## 22. Recommended Implementation Constraints

* Enforce active open till session check for cash payments strictly on the frontend (since backend does not enforce it).
* Intercept `POST /api/pos/orders/:id/close` calls and map cashier permissions accordingly.
* Display clear caveat banners for MTN/Airtel payments, printer reprint, receipt send, and card terminal.

## 23. Final Go / No-Go for Cashier UI Build

* **Recommendation: GO** (with reservation that backend seed or guard must align on `pos:orders:close` permission). The database schema, DTOs, and services are fully ready to support cashier UI development.
