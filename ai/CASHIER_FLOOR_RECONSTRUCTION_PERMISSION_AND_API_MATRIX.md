# Cashier Floor Reconstruction — Permission + API Contract Matrix

**Status:** Audit-only (Prompt C0 sub-task). Read-only verification against the local dirty
worktree (frontend `apps/web/src/lib/cashier/*`, backend `apps/api/src/modules/*`, RBAC seed
`packages/db/prisma/seed.ts`). **No code, schema, migration, seed, or Postman change was made.**
Purpose: establish exactly what backend contract and RBAC grant already exists for Cashier so the
Floor-first rebuild (nav Queue/Receipts/Till/Me → Floor/Till/Me, shared Floor → table selection →
settlement workspace, Find bill for tableless/takeaway/lookup) invents nothing new without an
explicit future authorization gate. Cross-references `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`
(`CASH-FR-xxx` IDs) and `docs/ROLE_CAPABILITY_MATRIX.md` (Cashier section, Prompt C0 banner).

---

## 1. Frontend surface today (`apps/web/src/lib/cashier/`)

### 1.1 Permission checks

`apps/web/src/lib/cashier/permissions.ts` contains **no hard-coded permission-string gating** —
just `hasCashierPermission(user, permission)` (a generic `user.permissions.includes(...)` check)
and `requireCashierContext` (session + role + branch presence, no permission strings). All actual
permission-string references live in `apps/web/src/components/cashier/me/CashierScopeCard.tsx`,
which is a **display-only** "Cashier Can Do" summary (does not gate any action, just shows
possession):

| UI label | Permission shown |
| --- | --- |
| View active payable queue | `pos:orders:read` |
| Settle supported payments | `pos:payment:create` |
| Record manual references | `pos:payment:manual-reference` |
| Use split tender where supported | `pos:payment:manual-reference` |
| Split bill allocation | `pos:order:split` |
| Split items with KDS boundary warning | `pos:order:split` |
| View/reprint metadata receipts | `pos:receipt:read` |
| Record pending receipt send requests | `pos:receipt:send` |
| Open/review/reconcile till | `pos:till:read` |
| Record safe drops | `pos:till:safe-drop` |
| Create refund requests where authorized | `pos:refund:create` |

This list is **not exhaustive** of what the frontend actually calls (e.g. it omits
`pos:orders:close`, `pos:payment:intent`, `pos:payment:cancel`, `pos:payment:read`,
`pos:refund:read`, `pos:order:merge`, `pos:order:transfer`, `pos:order:move-items`,
`pos:receipt:reprint`, `pos:table:read`, `pos:floor:read`, `pos:till:open`,
`pos:till:reconcile`, `pos:discount:read/request` — all of which the frontend or its backing
endpoints use/require; see §2–§3).

### 1.2 Every API call the Cashier frontend makes today

From `apps/web/src/lib/cashier/{api,orders,payments,resolution,receipts,refunds,tills}.ts`:

| Method | Path | Cashier lib function |
| --- | --- | --- |
| GET | `/api/shifts/active` | `getCashierActiveShift` (`api.ts`) |
| GET | `/api/tills/active` | `getCashierActiveTill` (`api.ts`) |
| GET | `/api/pos/orders?status&serviceType&tableId&userId&page&pageSize&excludeStatus` | `listCashierOrders` (`orders.ts`) |
| GET | `/api/pos/orders/:id` | `getCashierOrder` (`orders.ts`) |
| GET | `/api/pos/orders/:id/payments` | `getCashierOrderPayments` (`orders.ts`) |
| POST | `/api/payments/manual-reference` | `createCashierManualReferencePayment` (`payments.ts`, Idempotency-Key) |
| POST | `/api/payments/intents` | `createCashierPaymentIntent` (`payments.ts`, Idempotency-Key) |
| POST | `/api/pos/orders/:id/close` | `closeCashierOrder` (`payments.ts`, Idempotency-Key) |
| GET | `/api/tables` | `listCashierTables` (`resolution.ts`) |
| POST | `/api/pos/orders/:id/split-bill` | `splitCashierBill` (`resolution.ts`, Idempotency-Key) |
| POST | `/api/pos/orders/:id/split-items` | `splitCashierItems` (`resolution.ts`, Idempotency-Key) |
| POST | `/api/pos/orders/merge` | `mergeCashierOrders` (`resolution.ts`, Idempotency-Key) |
| POST | `/api/pos/orders/:id/move-items` | `moveCashierOrderItems` (`resolution.ts`, Idempotency-Key) |
| POST | `/api/pos/orders/:id/transfer-table` | `transferCashierOrderTable` (`resolution.ts`, Idempotency-Key) |
| POST | `/api/pos/orders/:id/transfer-server` | `transferCashierOrderServer` (`resolution.ts`, Idempotency-Key) |
| GET | `/api/receipts/:id` | `getCashierReceipt` (`receipts.ts`) |
| GET | `/api/receipts/:id/history?pageSize=50` | `getCashierReceiptHistory` (`receipts.ts`) |
| POST | `/api/receipts/:id/reprint` | `requestCashierReceiptReprint` (`receipts.ts`, Idempotency-Key) |
| POST | `/api/receipts/:id/send` | `requestCashierReceiptSend` (`receipts.ts`, Idempotency-Key) |
| GET | `/api/pos/orders/:id/refunds` | `listCashierOrderRefunds` (`refunds.ts`) |
| GET | `/api/pos/refunds/:id` | `getCashierRefund` (`refunds.ts`) |
| POST | `/api/pos/orders/:id/refunds` | `createCashierRefund` (`refunds.ts`, Idempotency-Key) |
| GET | `/api/tills/:id` | `getCashierTill` (`tills.ts`) |
| GET | `/api/tills/:id/summary` | `getCashierTillSummary` (`tills.ts`) |
| POST | `/api/tills/open` | `openCashierTill` (`tills.ts`, Idempotency-Key) |
| POST | `/api/tills/:id/safe-drop` | `recordCashierSafeDrop` (`tills.ts`, Idempotency-Key) |
| POST | `/api/tills/:id/reconcile` | `reconcileCashierTill` (`tills.ts`, Idempotency-Key) |

Notably absent from the Cashier frontend (confirmed by grep — never called): discount
create/approve/reject endpoints, `pos/orders/:id/void`, `pos/refunds/:id/approve`,
`pos/orders/:id/post-close-void`. This matches the RBAC gap in §3 — Cashier holds none of the
permissions those endpoints require, so the frontend correctly never calls them.

---

## 2. Backend contract, domain by domain

Guard stack on every route below (unless noted): `JwtAuthGuard, PermissionGuard,
BranchContextGuard` + `@RequireBranchContext()`. Branch scope = every service query filters
`{ id, branchId: ctx.branchId, orgId: ctx.organizationId }` (verified in each `.service.ts`
read below) — **no org-wide reads/writes exist on any of these routes**.

### 2.1 Floor / table read — `apps/api/src/modules/floor/`

| Method | Path | Permission | DTO / query | Response | Branch scope | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/tables` | `pos:table:read` | none | `Table[]` | branch-filtered | — |
| GET | `/api/tables/:id` | `pos:table:read` | none | `Table` | branch-filtered | 404 |
| PATCH | `/api/tables/:id` | `pos:table:write` | `UpdateTableDto` | `Table` | branch-filtered | 404 |
| PATCH | `/api/tables/:id/status` | `pos:table:write` | `UpdateTableStatusDto` | `Table` | branch-filtered | 404/409 |
| GET | `/api/floor-plans`, `/api/floor-plans/:id` | `pos:floor:read` | none | `FloorPlan[]`/`FloorPlan` | branch-filtered | 404 |
| POST/PATCH | `/api/floor-plans[/:id]` | `pos:floor:write` | Create/UpdateFloorPlanDto | `FloorPlan` | branch-filtered | 404 |
| GET | `/api/floor/availability` | `pos:floor:read` | none | availability summary | branch-filtered | — |

This is the **same** `FloorController`/`FloorService` that Waiter and Supervisor Floor already
consume (`apps/api/src/modules/floor/floor.controller.ts`, `floor.service.ts`) — there is no
separate "Cashier floor" endpoint to build; `GET /api/tables` is the one shared Floor read.
Order/payable-state per table is **not** returned by this endpoint — it is derived client-side by
cross-referencing `GET /api/pos/orders` by `tableId` (see §2.2), exactly as Supervisor's shared
Floor already does. `CreateTableDto` fields: `label` (required, 1–50 chars), `capacity?`,
`floorPlanId?`, `status?` (`TableStatus` enum), `isActive?`, `metadata?`.

### 2.2 Order read (list + detail) — `apps/api/src/modules/orders/`

`OrdersController` (`@Controller('pos/orders')`).

| Method | Path | Permission | DTO / query | Response | Branch scope | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/pos/orders` | `pos:orders:read` | `ListOrdersQueryDto` | `{ data: Order[], total, page, pageSize }` | `branchId`+`orgId` filtered | — |
| GET | `/api/pos/orders/:id` | `pos:orders:read` | none | `Order` incl. `items`, `table`, `user` | branch-filtered | 404 |
| POST | `/api/pos/orders/:id/void` | `pos:orders:void` | `TransitionOrderDto` (`reason?`) | updated `Order` | branch-filtered | 404, 409 invalid transition, 400 (post-kitchen void missing reason) |

**`ListOrdersQueryDto`** (`apps/api/src/modules/orders/dto/list-orders-query.dto.ts`) — the
**entire filter surface** available to any bounded order search today:

```
status?: 'NEW'|'SENT'|'IN_KITCHEN'|'READY'|'SERVED'|'VOIDED'|'CLOSED'
serviceType?: 'DINE_IN'|'TAKEAWAY'
tableId?: string
userId?: string            // 'me' resolves to the authenticated actor
excludeStatus?: string[]   // repeated param or comma-joined
page?: number (>=1)
pageSize?: number (>=1, no upper Max() decorator on this DTO — see gap §4)
```

Order status state machine (`VALID_TRANSITIONS`, `orders.service.ts` line 43):
`NEW→{SENT,VOIDED}`, `SENT→{IN_KITCHEN,VOIDED}`, `IN_KITCHEN→{READY,VOIDED}`,
`READY→{SERVED,VOIDED}`, `SERVED→{CLOSED}`, `VOIDED→[]`, `CLOSED→[]`. Void requires a `reason`
once the order has passed `IN_KITCHEN`/`READY`. No idempotency header on void (plain
`@Post`, not BG3-wrapped). Audit: `AuditService` injected into `OrdersService`; write paths log
via `this.audit.log(...)` (create/item/transition paths — void was not directly confirmed to call
`audit.log` in the excerpt read, but every other mutating method in the file does).

**Cashier does NOT hold `pos:orders:void`** (confirmed absent from the Cashier RBAC block —
§3) — this endpoint exists and is reachable by Waiter/Supervisor/Manager/Owner, but the current
Cashier frontend correctly never calls it, and any Floor-first Cashier void affordance would need
an explicit permission grant.

### 2.3 Payment read/create + order close — `apps/api/src/modules/payments/`

`PaymentsController` (`@Controller()`, routes fully qualified per-method).

| Method | Path | Permission | DTO | Response | Branch scope | Idempotency | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/:id/close` | `pos:orders:close` | `CloseOrderDto` (`payments: CloseOrderPaymentDto[]`, `reason?`) | closed `Order` + `payments` | branch+org filtered | BG3 `optional`, category `BILLING` | 404 order; 409 not `SERVED`/closable; 400 non-positive amount / MOMO without succeeded intent / overpay-without-cash / insufficient payment; 409 pending MOMO intents block close |
| POST | `/api/payments/intents` | `pos:payment:intent` | `CreatePaymentIntentDto` (`orderId, provider: MTN\|AIRTEL, amount, currency?, phoneNumber, idempotencyKey?, metadata?`) | `PaymentIntent` | branch+org filtered | BG3 `optional`, `BILLING`; has a training-simulator stub | — |
| GET | `/api/payments/intents/:intentId` | `pos:payment:read` | none | `PaymentIntent` | branch-filtered | — | 404 |
| GET | `/api/payments/intents/:intentId/status` | `pos:payment:read` | none | status projection | branch-filtered | — | 404 |
| POST | `/api/payments/intents/:intentId/cancel` | `pos:payment:cancel` | `CancelPaymentIntentDto` | updated `PaymentIntent` | branch-filtered | not BG3-wrapped | — |
| GET | `/api/pos/orders/:id/payments` | `pos:payment:read` | none | `Payment[]` for the order | branch-filtered | — | 404 |
| POST | `/api/payments/manual-reference` | `pos:payment:manual-reference` | `CreateManualReferencePaymentDto` (`orderId, method: MOMO\|CARD\|BANK_TRANSFER, provider?, amount, externalTransactionId, payerPhone?, postedAt?, note?`) | `Payment` | branch-filtered | not BG3-wrapped | — |
| GET | `/api/payments/manual-reference/:paymentId` | `pos:payment:read` | none | `Payment` | branch-filtered | — | 404 |
| GET | `/api/payments/manual-reference?verificationStatus=` | `pos:payment:read` | query string | `Payment[]` | branch-filtered | — | — |
| POST | `/api/webhooks/mtn`, `/api/webhooks/airtel` | none (unauthenticated callback) | provider payload | ack | n/a | — | — |
| SSE | `/api/stream/payments?orderId=` | (auth+branch guard only, no `Permissions`) | — | `payment.update` events filtered by branch/orderId | branch-filtered | — | — |

`CloseOrderDto.payments[].method` is restricted to `CASH|CARD|MOMO|BANK_TRANSFER`; MOMO close
requires a prior `SUCCEEDED` `PaymentIntent` row; change is only permitted when a `CASH` line is
present. Close is gated on `CLOSABLE_STATES` (confirmed = must be `SERVED`).

### 2.4 Split / merge / move / transfer — `apps/api/src/modules/pos-handoff/`

`PosHandoffController` (`@Controller('pos/orders')` — merged into the same route table as
`OrdersController`). All six routes are wrapped by `Bg3ReliabilityService.guard` with
`category: null` (not billing/accounting/inventory — M42 maintenance windows don't apply) and
`idempotencyMode: 'optional'` (an `Idempotency-Key` header, when present, makes retries
duplicate-safe; replay returns the cached 200 body, a same-key-different-payload retry returns 409
`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, a concurrent same-key request returns 409
`IDEMPOTENCY_IN_FLIGHT`, a malformed key returns 400 `IDEMPOTENCY_BAD_KEY`).

| Method | Path | Permission | DTO (key fields) | Branch scope | Notes / errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/merge` | `pos:order:merge` | `MergeOrdersDto{ sourceOrderId, targetOrderId, reason? }` | both orders re-checked branch/org | source items move to target; source → `VOIDED` with `mergedIntoOrderId`; 404 if either order missing in branch; audit logged |
| POST | `/api/pos/orders/:id/split-bill` | `pos:order:split` | `SplitBillDto{ mode: EQUAL\|CUSTOM, count?(2–20), groups?[{label?,amount?}], reason? }` | order re-checked | **non-physical** — records payable allocation groups only; order/items/KDS untouched; audit logged |
| POST | `/api/pos/orders/:id/split-items` | `pos:order:split` | `SplitItemsDto{ items[{orderItemId, quantity}](1–100), targetTableId?, reason?, notes? }` | order+table re-checked | physical split → new **child** order in `NEW` status with `splitFromOrderId`; child is NOT auto-sent to KDS; audit logged |
| POST | `/api/pos/orders/:id/move-items` | `pos:order:move-items` | `MoveOrderItemsDto{ targetOrderId, items[{orderItemId,quantity}](1–100), reason? }` | both orders re-checked | moves items onto an **existing** open target order; KDS not auto-republished; audit logged |
| POST | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer` | `TransferTableDto{ targetTableId, reason? }` | order+target table re-checked | 404 target table not in branch; 400 already at target table; audit logged; only sets `tableId` (no occupancy/status side-effect per Supervisor precedent) |
| POST | `/api/pos/orders/:id/transfer-server` | `pos:order:transfer` | `TransferServerDto{ targetUserId, reason? }` | order re-checked | 400 already assigned to target server; audit logged |

**Confirmed: Cashier's frontend calls exactly these same six canonical domain endpoints** — it
does not fork or duplicate the handoff surface Supervisor already exercises (per CLAUDE.md
Prompt 3B1/3B2). `pos:order:transfer` is a single backend gate covering **both**
transfer-table and transfer-server, same as documented for Supervisor — so `transfer-server` is
API-reachable for Cashier today even though (per the current Queue-first build) there is no
transfer-server UI surfaced.

### 2.5 Order close — see §2.3 (`POST /api/pos/orders/:id/close`, lives in `PaymentsController`,
not `OrdersController` — the `orders.controller.ts` file has an explicit comment: `// M13:
close-order endpoint moved to PaymentsController`).

### 2.6 Receipt read/print/reprint/delivery — `apps/api/src/modules/receipts/`

`ReceiptsController` (`@Controller('receipts')`). **Receipt id == order id** (closed orders are
the receipt; no separate `Receipt` entity/table is exposed here — confirmed by the doc comment in
`receipts.controller.ts`).

| Method | Path | Permission | DTO | Response | Branch scope | Idempotency | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/receipts/:id` | `pos:receipt:read` | none | receipt projection of the closed `Order` | branch-filtered | — | 404 "Receipt not found" |
| GET | `/api/receipts/:id/history` | `pos:receipt:read` | `ReceiptHistoryQueryDto{ page?, pageSize?(1–200) }` | paginated audit/history entries | branch-filtered | — | — |
| POST | `/api/receipts/:id/reprint` | `pos:receipt:reprint` | `ReprintReceiptDto{ reason?(≤280), copies?(1–10, default 1) }` | reprint record | branch-filtered | BG3 `optional`, category `null` | audit `REPRINTED` action |
| POST | `/api/receipts/:id/send` | `pos:receipt:send` | `SendReceiptDto{ channel: email\|sms\|whatsapp, recipient(3–160), locale?, note? }` | `202 Accepted`, `{ supported: false, ... }` marker | branch-filtered | BG3 `optional`, category `null` | **No live delivery adapter is wired** — always records a `PENDING` delivery request and returns `supported:false` so the frontend can disable the corresponding affordance honestly (matches `docs/ROLE_CAPABILITY_MATRIX.md` "delivery adapters Deferred") |

### 2.7 Till operations — `apps/api/src/modules/tills/`

`TillsController` (`@Controller('tills')`).

| Method | Path | Permission | DTO | Response | Branch scope | Idempotency | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/tills/open` | `pos:till:open` | `OpenTillDto{ tillCode(≤50), openingFloat(>=0), notes? }` | `TillSession` | branch-filtered | BG3 `optional`, category `null` | audit logged |
| POST | `/api/tills/:id/safe-drop` | `pos:till:safe-drop` | `SafeDropDto{ amount(>=0.01), reason(≤500) }` | `CashMovement` | branch-filtered | not BG3-wrapped (plain, no `Idempotency-Key` handling in controller despite frontend sending the header) | 404 till not found; 409 "Safe drop only allowed on an OPEN till session"; audit logged |
| POST | `/api/tills/:id/reconcile` | `pos:till:reconcile` | `ReconcileTillDto{ countedCash(>=0), varianceReason?, notes? }` | reconciled `TillSession` | branch-filtered | BG3 `optional`, category `null` | 404; 409 "Reconciliation only allowed on an OPEN till session"; audit logged |
| GET | `/api/tills/active` | `pos:till:read` | none | active `TillSession` for the user/branch (nullable) | branch-filtered | — | — |
| GET | `/api/tills/:id` | `pos:till:read` | none | `TillSession` | branch-filtered | — | 404 |
| GET | `/api/tills/:id/summary` | `pos:till:read` | none | till summary aggregate | branch-filtered | — | 404 |

**Gap note (matches `docs/ROLE_CAPABILITY_MATRIX.md` "safe-drop idempotency incomplete"):**
`safeDrop` is the one till mutation NOT wrapped in `this.bg3.guard(...)` in `tills.controller.ts`
— the frontend sends an `Idempotency-Key` header (`recordCashierSafeDrop`), but the controller
method has no BG3 wrap and no visible idempotency handling, so that header is currently a no-op
server-side. This is a pre-existing condition, not something introduced by C0.

### 2.8 Refund read/create — `apps/api/src/modules/refunds/`

`RefundsController` (`@Controller('pos')`).

| Method | Path | Permission | DTO | Response | Branch scope | Idempotency | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/:id/refunds` | `pos:refund:create` | `CreateRefundDto{ paymentId, amount(>=0.01), reason(≤500), provider?, metadata? }` | `Refund` (may be `PENDING_APPROVAL` or approved depending on threshold) | branch+org filtered | BG3 `optional`, category `BILLING`; has training-simulator stub | 404 order/completed-payment not found; 409 "Refunds can only be issued on CLOSED orders"; audit logged |
| POST | `/api/pos/refunds/:id/approve` | `pos:refund:approve` | `ApproveRefundDto` | approved `Refund` | branch-filtered | not BG3-wrapped | 404; 409 wrong status; audit logged. **Cashier does not hold this permission** (§3) |
| GET | `/api/pos/refunds/:id` | `pos:refund:read` | none | `Refund` | branch-filtered | — | 404 |
| GET | `/api/pos/orders/:id/refunds` | `pos:refund:read` | none | `Refund[]` for the order | branch-filtered | — | 404 |
| POST | `/api/pos/orders/:id/post-close-void` | `pos:void:postclose` | `PostCloseVoidDto` | voided-after-close `Order` | branch-filtered | not BG3-wrapped | 404; 409 "Post-close void is only allowed on CLOSED orders"; audit logged. **Cashier does not hold this permission** (§3) |

Refunds are only issuable against **CLOSED** orders and require an existing `COMPLETED` payment
on that order (`paymentId` in the DTO is validated against `Payment` rows filtered by
`{ orderId, branchId, status: COMPLETED }`).

### 2.9 Bounded order/receipt lookup for the future "Find bill"

There is **no dedicated Find-bill/search endpoint**. The only bounded lookup surface is the
same `ListOrdersQueryDto` used by `GET /api/pos/orders` (§2.2), which is also what
Supervisor's existing "Find order" control (`apps/web/src/components/supervisor/floor/
SupervisorFindOrderDialog.tsx`) already relies on — confirmed by reading that component:

- Its `buildQuery()` only ever sets `excludeStatus`/`status` and `serviceType` — the same two
  fields `ListOrdersQueryDto` exposes.
- Its own code comment states: `// backend has no order-number search, so exact-number matching
  is done locally; an exact order ID (paste) resolves through GET /pos/orders/:id.`
- "Exact-ID fallback" = a client-side cuid2-shape check that, when matched, calls
  `GET /api/pos/orders/:id` directly — **not** a server-side search.
- Order-number matching against the visible page happens **client-side**, over the single
  bounded page already fetched (default page size 25 per the Supervisor precedent) — it does not
  search beyond that page.

So today's full server-side filter surface for any bounded order/bill lookup is exactly:
`status, serviceType, tableId, userId(including 'me'), excludeStatus[], page, pageSize`. See §4
for the exact fields a Find-bill control would need that do not exist yet.

---

## 3. Cashier role permission coverage

Source: `packages/db/prisma/seed.ts`, `ROLE_PERM_MATRIX.Cashier` (lines 1245–1317).

| Permission | Held by Cashier in seed? | Evidence |
| --- | --- | --- |
| `pos:floor:read` | Yes | seed.ts:1248 |
| `pos:table:read` | Yes | seed.ts:1249 |
| `pos:table:write` | **No** | not present in Cashier block |
| `pos:orders:read` | Yes | seed.ts:1253 |
| `pos:orders:write` | Yes | seed.ts:1254 |
| `pos:orders:close` | Yes | seed.ts:1261 |
| `pos:orders:void` | **No** | absent from Cashier block (present only in Owner/Manager/Supervisor blocks, e.g. seed.ts:528/786/1113) |
| `pos:payment:create` | Yes | seed.ts:1259 |
| `pos:payment:close` | Yes | seed.ts:1260 |
| `pos:payment:intent` | Yes | seed.ts:1262 |
| `pos:payment:read` | Yes | seed.ts:1263 |
| `pos:payment:manual-reference` | Yes | seed.ts:1264 |
| `pos:payment:cancel` | Yes | seed.ts:1265 |
| `pos:order:split` | Yes | seed.ts:1311 (BG4.B block) |
| `pos:order:merge` | Yes | seed.ts:1312 |
| `pos:order:transfer` | Yes | seed.ts:1313 (gates both transfer-table and transfer-server) |
| `pos:order:move-items` | Yes | seed.ts:1314 |
| `pos:discount:request` | Yes | seed.ts:1257 |
| `pos:discount:read` | Yes | seed.ts:1258 |
| `pos:discount:approve` | **No** | absent from Cashier block (Owner/Manager/Supervisor only, e.g. seed.ts:533/791/1131) |
| `pos:receipt:read` | Yes | seed.ts:1307 |
| `pos:receipt:reprint` | Yes | seed.ts:1308 |
| `pos:receipt:send` | Yes | seed.ts:1309 |
| `pos:till:open` | Yes | seed.ts:1271 |
| `pos:till:reconcile` | Yes | seed.ts:1272 |
| `pos:till:safe-drop` | Yes | seed.ts:1273 |
| `pos:till:read` | Yes | seed.ts:1274 |
| `pos:refund:create` | Yes | seed.ts:1266 |
| `pos:refund:read` | Yes | seed.ts:1267 |
| `pos:refund:approve` | **No** | absent from Cashier block (Owner/Manager/Supervisor only, e.g. seed.ts:543/801/1141) |
| `pos:void:postclose` | **No** | absent from Cashier block (Owner/Manager/Supervisor only, e.g. seed.ts:545/803/1143) |
| `pos:shift:open/close/read` | Yes | seed.ts:1268–1270 |
| `pos:reservation:read/create/confirm/seat/deposit:record/deposit:read/table:assign` | Yes | seed.ts:1275–1281 (out of scope for this audit's Floor/settlement domains, listed for completeness) |
| `devices:read` | Yes | seed.ts:1316 (BG5) |

**Conclusion: every permission the current Cashier frontend actually calls (§1.2) is already
held by the Cashier role.** No RBAC blocker exists for continuing to build the Floor-first
rebuild strictly on top of the endpoints in §2. The four permissions Cashier does **not** hold
(`pos:orders:void`, `pos:discount:approve`, `pos:refund:approve`, `pos:void:postclose`) all
correspond to endpoints the current frontend never calls — consistent with `CLAUDE.md` §12's
prohibition on refund approval / post-close void / order void for non-Supervisor roles, and with
`docs/ROLE_CAPABILITY_MATRIX.md`'s existing Cashier row "Manager approval / post-close void →
Read-only (boundary cards — LIM-012)". If the Floor-first plan wants Cashier to gain any of
these four, that is a new RBAC grant requiring the explicit per-cutover authorization gate in
`CLAUDE.md` §14 — not something this audit authorizes.

---

## 4. Missing/blocked contracts (exact gaps for future authorization)

These are gaps in the **existing backend contract**, not scope decisions — flagging precisely
what would need a new DTO field/endpoint (and hence explicit authorization) before Find bill (or
any Floor-first settlement feature) could support it:

1. **No order-number / free-text search on `GET /api/pos/orders`.** `ListOrdersQueryDto` has no
   `orderNumber`, `search`, or `q` field. Today's only "search by number" is client-side
   substring matching over one bounded page (confirmed via `SupervisorFindOrderDialog.tsx`).
   Find bill's "search by order number, table, server" requirement would need either a new
   `orderNumber` (or partial-match) query field on the DTO/service, or continued reliance on the
   same client-side-page + exact-ID-fallback pattern Supervisor already uses. **CASH-FR-023.**

2. **No receipt-reference filter.** Because receipt id == order id (§2.6), "search by receipt
   reference" is really "search by order id/number" — same gap as #1, no separate receipt
   number/reference field exists anywhere in the schema-facing DTOs read.

3. **No payment-state filter on `GET /api/pos/orders`.** There is no `paymentStatus` /
   `isPaid` / `hasBalance` query field. A Cashier Find-bill view that needs "unpaid / partially
   paid / fully paid" as a first-class filter (rather than deriving it per-order from
   `GET /api/pos/orders/:id/payments`, which is one extra round trip per order) does not exist
   server-side today. **CASH-FR-021.**

4. **No explicit tableless/takeaway boolean.** `serviceType=TAKEAWAY` covers "no table by
   design," but there is no query flag distinguishing "DINE_IN order whose table link was
   removed/never set" from a normal dine-in row — Find bill would need to derive this from
   `tableId == null` client-side (the DTO has no `tableId: null` sentinel filter; `tableId?`
   only matches a specific table id). **CASH-FR-019/020.**

5. **No date-range filter.** `ListOrdersQueryDto` has no `dateFrom`/`dateTo`/`createdAfter`
   fields at all (unlike, for example, the Supervisor reservations/leave/shift-swap list DTOs,
   which do carry optional `dateFrom`/`dateTo`). A Find-bill "look up a bill from earlier today /
   this week" capability has no backend support today.

6. **No upper bound (`@Max`) on `ListOrdersQueryDto.pageSize`.** Unlike
   `ReceiptHistoryQueryDto` (`@Max(200)`), the orders list DTO only has `@Min(1)` on `pageSize`
   — nothing currently prevents an unbounded page request. Not a missing feature, but a latent
   risk worth flagging before Find bill leans on this endpoint at higher call volume
   (`CASH-FR-023` "bounded/paginated lookup" — the boundedness is a frontend discipline today,
   not a backend-enforced one).

7. **`safe-drop` idempotency is a no-op server-side** (§2.7) — the frontend already sends an
   `Idempotency-Key` header that the `TillsController.safeDrop` handler does not consume (no
   `bg3.guard` wrap, unlike `open`/`reconcile`). Pre-existing condition; relevant if Floor-first
   surfaces safe-drop from a new location and assumes duplicate-safety.

8. **No dedicated "payable orders for table X" endpoint.** Table→order resolution for the
   Floor-first settlement workspace (`CASH-FR-005/006`) will have to be done the same way
   Supervisor's Floor workspace already does it: `GET /api/pos/orders?tableId=X` (bounded by
   branch, no separate single-purpose "get the bill for this table" route exists). If a table
   can have more than one non-CLOSED order, the frontend must handle the multi-order case itself
   (no backend disambiguation).

9. **Receipt delivery channels are not live** (§2.6) — `send` always returns `supported: false`.
   Not a Find-bill blocker, but relevant to any Floor-first receipt-delivery affordance
   (`CASH-FR-016`); this is a pre-existing, already-documented deferral (LIM-00x /
   `docs/KNOWN_LIMITATIONS.md`), not a new gap.

No other endpoint required by the domains audited (Floor/table, order read, payment read/create,
split/merge/move/transfer, close, receipts, till, refund read/create) is missing — every mutation
the current Cashier frontend performs already has a matching, permission-covered, branch-scoped,
audited backend route.
