# G1 Backend Build Spec Input: Event Till (`POST /pos/quick-sale`) and event reports

Source: clean export of `rescued/main-2026-11-15` at `/sessions/rcw-016h54ooiszn9pzbzpezf9ht/pos-rescued` (read-only). The export has no `.git`, so tip 5a35a18 is NOT verified from here (UNKNOWN). All paths below are relative to that root. Line numbers come from the export. Base API prefix is `/api` (apps/api/src/main.ts:26 `app.setGlobalPrefix('api')`).

Global fact that affects every DTO: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` (apps/api/src/main.ts:28-34). Any field not declared in a DTO returns 400. Every new field must be declared.

---

## 1. Order creation path today

### Routes (apps/api/src/modules/orders/orders.controller.ts)
```
30  @Controller('pos/orders')
31  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
32  @RequireBranchContext()
36  @Post()                 @Permissions('pos:orders:write')   createOrder(@Body() dto: CreateOrderDto, ...)
73  @Post(':id/items')      @Permissions('pos:orders:write')   addOrderItem(...)
122 @Post(':id/send')       @Permissions('pos:orders:write')   -> sendOrder (NEW -> SENT, fires KDS)
210 @Post(':id/void')       @Permissions('pos:orders:void')
208 // M13: close-order endpoint moved to PaymentsController
```

### DTOs
- `CreateOrderDto` (orders/dto/create-order.dto.ts): `serviceType: 'DINE_IN'|'TAKEAWAY'`, optional `tableId`, `notes` (max 500), `metadata`.
- `AddOrderItemDto` (orders/dto/add-order-item.dto.ts): `menuItemId`, optional `menuItemServingId`, `quantity` (int >= 1), `notes`, `metadata` (modifiers go in `metadata.selectedModifiers[].modifierOptionId`).

### Service signatures (apps/api/src/modules/orders/orders.service.ts)
```ts
150  async createOrder(userId: string, ctx: BranchContext, dto: CreateOrderDto, meta: RequestMeta)
67   private async generateOrderNumber(branchId: string): Promise<string>
273  private async computeLinePricing(ctx, menuItemId, menuItemServingId, quantity, modifierMeta?)
432  private async recalcOrderTotals(orderId: string): Promise<void>
472  async addOrderItem(userId, ctx, orderId, dto: AddOrderItemDto, meta)
680  private async transitionOrder(userId, ctx, orderId, targetStatus, auditAction, meta, reason?)
43   const VALID_TRANSITIONS = { NEW:['SENT','VOIDED'], SENT:['IN_KITCHEN','VOIDED'], IN_KITCHEN:['READY','VOIDED'], READY:['SERVED','VOIDED'], SERVED:['CLOSED'], VOIDED:[], CLOSED:[] }
```
`BranchContext = { branchId, organizationId, roleId? }` (orders.service.ts:28-32).

### Order number generation (orders.service.ts:67-81) and its race
```ts
const lastOrder = await this.prisma.order.findFirst({ where: { branchId }, orderBy: { createdAt: 'desc' }, select: { orderNumber: true } });
let nextSeq = 1;
if (lastOrder?.orderNumber) { const match = lastOrder.orderNumber.match(/ORD-(\d+)/); if (match) nextSeq = parseInt(match[1], 10) + 1; }
return `ORD-${String(nextSeq).padStart(6, '0')}`;
```
Not concurrency-safe despite the comment "concurrency-safe via DB". It is read-then-insert with no lock or retry. The only protection is `@@unique([branchId, orderNumber])` (schema.prisma:1351), so two tills in one branch selling at the same time will make one request fail with a P2002 unique violation (500). Also, if the most recent order's number does not match `ORD-\d+`, the counter restarts at 1 and collides. Five tills per branch is exactly the load that triggers this. Quick sale MUST NOT call this as is.

### Price snapshot, servings, modifiers, tax (orders.service.ts:273-428)
- Looks up `MenuItem` (+servings) scoped to `{ id, branchId, orgId }`; 404 if missing; 409 `MENU_ITEM_UNAVAILABLE` if `!isActive`.
- `unitPrice = menuItem.price`; if `menuItemServingId` given, uses `serving.price` (400 if serving not on the item, 409 `MENU_SERVING_INACTIVE`).
- Modifier deltas from `ModifierOption.priceDelta`, validated against `MenuItemOnGroup` (lines 316-357).
- `price = (unitPrice + modifierDelta).toDecimalPlaces(2)`, `subtotal = price * quantity`.
- Cost snapshot from `RecipeIngredient` (lines 362-418): fills `costUnit/costTotal/marginTotal/marginPct`, or leaves them null when the item has no recipe. This is 2 to 4 DB queries per line.
- The snapshot is stored on `OrderItem` (schema.prisma:1365-1391: `price`, `subtotal`, `costUnit`, ...). Name and SKU are NOT snapshotted on the line; reports must join `MenuItem`.
- **There is NO tax calculation anywhere in the order path.** `recalcOrderTotals` (432-468):
  ```ts
  const total = Decimal.max(subtotal.sub(discountAmount), new Decimal(0));
  data: { subtotal, discount, total }   // Order.tax is never written
  ```
  `Order.tax` defaults to 0 (schema.prisma:1315). The comment in dashboards.service.ts:35-38 confirms "OrdersService.recalcOrderTotals is the same identity with tax = 0". `TaxCategory` is only used by the menu CRUD. `OrgSettings.vatPercent` (default 18.00) and `OrgSettings.rounding` are stored (schema.prisma:794, 807) but never read by order or payment code. A grep for `serviceCharge|service_charge|serviceFee` finds nothing, so there is no service charge concept.
- For tax-inclusive round UGX prices, the existing semantics work as is: `subtotal = total`, `tax = 0`. If a VAT figure is wanted on reports, derive it (`total*18/118`) at report time. Do not invent it in the write path.

### Side effects of the order path
| Effect | Where | Fires on |
|---|---|---|
| Audit `ORDER_CREATED` | orders.service.ts:182-196 | create |
| Audit `ORDER_ITEM_ADDED` (needs `metadata.branchId`) | 519-537 | add item |
| Audit per transition | 741-755 | transitions |
| KDS tickets | 779 `void this.kdsService.createTicketsForOrder(...).catch(() => undefined)`; kds.service.ts:72 requires `order.status === 'SENT'` | `sendOrder` only |
| Table occupy/release | 707-712, 116-146 | DINE_IN only |
| Reservation auto-complete | 720-738 `reservationsService.completeForClosedOrder` | `transitionOrder` to CLOSED only (NOT called by `PaymentsService.closeOrderWithPayment`) |
| Payment SSE event | payments.service.ts:143-145, 291-298 `eventEmitter.emit('payment.update', ...)` consumed only by `GET stream/payments` (payments.controller.ts:222) | payment close |
| GL posting | none | `PaymentsService` and `OrdersService` never reference ledger or accounting (grep of orders/ and payments/ is empty). `LedgerService.createJournal` is invoked from its own endpoints only. |
| Anomaly signals | none in orders/payments (grep empty) | |
| `@Cron`/`@Interval`/queues | none in the repo | |
| `@OnEvent` listeners | none in the repo | |

### What a quick sale MUST keep vs may skip
Keep:
- Audit rows with `metadata.branchId`. The repo-wide guard test `apps/api/src/common/audit/audit-branchid-guard.spec.ts` fails any `audit.log(` call lacking `branchId` in metadata, unless the line above carries `// C-28-EXEMPT: <reason>`.
- Order number (unique per branch).
- `subtotal/discount/tax/total` using the same identity (`total = subtotal - discount`, `tax = 0`).
- `OrderItem` price and cost snapshots (reuse `computeLinePricing`).
- `orgId/branchId/userId` on the order.
- `Order.status = 'CLOSED'` set directly.
- Payment row with `status COMPLETED`.

Skip safely:
- KDS (tickets are created only from status SENT; a CLOSED order is never SENT).
- Table occupy/release (TAKEAWAY, no table).
- Reservation completion.
- The SSE event (optional).
- Modifiers (not needed for concert SKUs, but supported if the pricing helper is reused).

---

## 2. Close and payment path today

### `POST /api/pos/orders/:id/close` (apps/api/src/modules/payments/payments.controller.ts:38-70)
Guards `JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@Permissions('pos:orders:close')`, wrapped in `this.bg3.guard({... scope:'payments.order.close', category: BG3_CATEGORY.BILLING, idempotencyMode:'optional', fingerprintSource:{id,dto} ...})`.

DTO (payments/dto/close-order.dto.ts): `{ payments: [{ method: 'CASH'|'CARD'|'MOMO'|'BANK_TRANSFER', amount: number (max 2dp, >=0.01), transactionId?, metadata? }] (ArrayMinSize 1), reason? }`. There is no field for card scheme, auth code or till.

`PaymentsService.closeOrderWithPayment` (payments.service.ts:149-307):
```ts
34  const CLOSABLE_STATES: string[] = ['SERVED'];
162 if (!CLOSABLE_STATES.includes(order.status)) throw new ConflictException(`Cannot close order in ${order.status} state. Order must be SERVED.`);
173-192 each amount > 0; MOMO requires an existing SUCCEEDED PaymentIntent for the order; hasCash flag
195-206 blocks if PENDING/REQUIRES_ACTION intents exist
208-221 totalCovered = alreadyPaid(COMPLETED) + new; overpayment only allowed when CASH present (changeDue); underpayment -> 400
223-250 prisma.$transaction: for each p -> tx.payment.create({ orgId, branchId, orderId, amount, method, status: COMPLETED,
          captureMode: 'ONLINE_PROVIDER', verificationStatus: 'NOT_REQUIRED', transactionId, postedAt: new Date(), metadata });
          then tx.order.update({ status: CLOSED })
252-289 AFTER commit: audit ORDER_PAID_AND_CLOSED and a PAYMENT_RECORDED per payment (non-transactional)
291 emitEvent ORDER_AUTO_SETTLED
```
Facts relevant to the spec:
- **No till-session requirement exists for cash.** `hasActiveTillInBranch` exists (tills.service.ts:337) but is never called from outside tills (grep). Cash is not linked to a till at write time at all.
- Payment amount stored equals the amount tendered (change is only reported in the response). For cash overpay the Payment row can exceed the order total, so cash reports built from `Payment.amount` can overstate. Quick sale should store `amount = total` and put tendered and change in `metadata`.
- No `closedAt` or `paidAt` on `Order` (schema.prisma:1305-1362 has only `createdAt`, `updatedAt`). `Payment.postedAt` defaults to now. Reports window on `Order.createdAt` and `Payment.createdAt`. Post-close void uses `order.updatedAt` as the closed time (refunds.service.ts:248).
- No GL posting and no receipt row on close. A receipt is a computed view: `ReceiptsService` (receipts.service.ts:52-60) "a closed Order with its captured Payment[] IS the receipt". The receipt id equals the orderId (`GET /api/receipts/:id`, perm `pos:receipt:read`, Cashier has it). Reprint requires status CLOSED or VOIDED (receipts.service.ts:115-119). `ORDER_PAID_AND_CLOSED` is in the receipt-history action set (receipts.service.ts:48-52), so a quick sale should emit that same audit action or a similar one it also lists.

### `POST /api/payments/manual-reference` (payments.controller.ts:161-176; perm `pos:payment:manual-reference`)
DTO `CreateManualReferencePaymentDto` (payments/dto/create-manual-reference.dto.ts): `orderId`, `method: MOMO|CARD|BANK_TRANSFER`, `provider?` (max 50), `amount`, `externalTransactionId` (max 200, required), `payerPhone?`, `postedAt?`, `note?`.
`createManualReferencePayment` (payments.service.ts:774-865):
```ts
785  if (['VOIDED'].includes(order.status)) throw ...      // allows any other status, including NEW and CLOSED
790-801 dedupe: same orderId + branchId + externalTransactionId -> 409
803-820 payment.create({ ..., status: COMPLETED, captureMode: 'MANUAL_REFERENCE', verificationStatus: 'UNVERIFIED',
          externalTransactionId, payerPhone, postedAt, enteredById: userId, verificationNote, metadata: { provider, captureMode } })
858    autoSettleIfFullyPaid -> sets Order.status = CLOSED when outstanding <= 0 (from ANY non-closed state, no SERVED requirement)
```
Not atomic: the payment, the audit, and the auto-settle are separate writes with no transaction. It dedupes only per order, not per terminal or auth code.

### Till and cash models (schema.prisma)
```
1784 model TillSession { id, orgId, branchId, shiftId, tillCode String @map("till_code"), operatorUserId, openedById, closedById?,
       openedAt, reconciledAt?, closedAt?, openingFloat Decimal(10,2), expectedCash Decimal(10,2) @default(0), countedCash?, variance?,
       varianceStatus?, status TillSessionStatus(OPEN|RECONCILED|CLOSED), notes?, metadata? ... @@index([branchId, tillCode]) }
1829 model CashMovement { tillSessionId, shiftId?, type CashMovementType(OPENING_FLOAT|SAFE_DROP|CASH_PICKUP|PAID_IN|PAID_OUT|REFUND_PAYOUT), amount, reason, reference?, createdById, approvedById? }
1749 model Shift {..., shiftNumber @@unique([branchId, shiftNumber]), openedById, status OPEN|CLOSED}
```
There is no `TillTransaction` model. There is NO foreign key or column from `Payment` to `TillSession`. The link is implicit by branch plus time window.

### What reports depend on from close
- `Order.status IN ('CLOSED','SERVED')` as the "sale" test (reports.service.ts:296, 424; dashboards.service.ts:61).
- `Order.createdAt` as the sale time.
- `Payment.status = 'COMPLETED'` (and `createdAt`) as money in.
- `Payment.method`.
- Nothing reads a closed timestamp.

---

## 3. Idempotency

### Existing mechanisms
1. **`IdempotencyKey` table + `IdempotencyService`** (schema.prisma:6696-6722; apps/api/src/modules/reliability/idempotency.service.ts):
   - unique `[scope, key, routeMethod, routePath]`; stores `requestHash`, `status IN_FLIGHT|SUCCEEDED|FAILED|CONFLICT`, `responseBody Json`, `expiresAt`.
   - `begin()` lines 77-133, `wrap()` 185-215, `requireValidKey()` 221-232 (8-128 chars, no whitespace).
   - Exposed via `Bg3ReliabilityService.guard({... idempotencyMode:'optional'|'required'})` (bg3-reliability.service.ts:88-192). Header name `Idempotency-Key` (CORS allowlist in main.ts:19). Used on `/pos/orders/:id/close`, `/payments/intents`, `/tills/open`, receipts reprint/send, handoff endpoints.
   - Per-route wrap is NOT free of defects for this use case. All verified in code:
     a) Failed handler is stored as `FAILED` (idempotency.service.ts:208-213). A retry with the same key and same body falls to the `replay` branch (lines 107-115) and returns `statusCode 500 / body null`, which `wrap` returns as a null 200 (line 191). A transient error would permanently "poison" the key for an offline till. This is the worst case for tills that replay.
     b) `expiresAt` is written (TTL 24h) but never checked in `begin()`.
     c) Same key but different JSON (e.g. client edits a timestamp) returns 409 conflict.
     d) `begin()` is `findUnique` then `create`, so two simultaneous requests can hit a P2002 on the create and return 500.
     e) A crash mid-handler leaves `IN_FLIGHT` forever, giving 409.
2. **Sync module** (`POST /api/sync/replay`, reliability.controller.ts:47-87, perm `sync:jobs:write`):
   - Unique `SyncJob(orgId, clientMutationId)` (schema.prisma:6764). `docs/SYNC_CONTRACT.md:74-81`: resubmit returns the existing job without re-running.
   - `SyncJobType` enum (schema.prisma:6638-6653, mirrored in `SYNC_JOB_TYPES`, reliability/dto/index.ts:19-34): `ORDER_DRAFT_UPDATE, ORDER_SUBMIT, PAYMENT_CAPTURE, REFUND_CREATE, AR_RECEIPT_CREATE, AP_PAYMENT_CREATE, RESERVATION_HOLD, RESERVATION_CONFIRM, EVENT_BOOKING_HOLD, EVENT_BOOKING_CONFIRM, STOCK_ADJUSTMENT, ATTENDANCE_EVENT, SHIFT_ACTION, GENERIC_REPLAY`.
   - Registering a type: `ReplayDispatcherService.register(type, handler: (ctx: ReplayContext) => Promise<ReplayOutcome>)` (replay-dispatcher.service.ts:69). Only `GENERIC_REPLAY` (an echo) is registered, in the constructor. No domain handler is registered anywhere (grep for `.register(` returns only line 58), and SYNC_CONTRACT.md:104-110 says unregistered reserved types "fall through to the generic echo and are classified RETRYABLE".
   - Org resolution is `membership.findFirst({ where:{ userId, status:'ACTIVE' } })` (sync.service.ts:41-49): no `X-Branch-Id`, so the branch cannot be derived reliably. Jobs carry only an optional `branchId` in the body.
   - Permission `sync:jobs:write` is held by Owner (seed.ts:900) and Manager (1179) only. Cashier does NOT have it.
   - Conclusion: sync replay is unusable for the concert as is (needs a new dispatcher handler, an enum migration, a permission grant for Cashier, and branch plumbing).
3. `PaymentIntent.idempotencyKey` (schema.prisma:1638, index 1656) is a domain-level pattern used by `createPaymentIntent` (payments.service.spec.ts:464 "duplicate idempotencyKey"). It is a column on the entity, not a table.

### Recommendation (least risk)
Make idempotency a database constraint on the sale itself, not the generic table:
- Add `Order.clientSaleId String?` with `@@unique([orgId, clientSaleId])`. Postgres treats NULLs as distinct, so every existing order is unaffected.
- In the quick-sale handler: (1) before the transaction, `findFirst({ where:{ orgId, clientSaleId } })`; if found, return the stored sale with `replayed: true`, after checking `branchId` matches (else 409 `CLIENT_SALE_ID_CONFLICT`). (2) Inside the transaction, create the order. (3) Catch `Prisma.PrismaClientKnownRequestError` code `P2002` on `[org_id, client_sale_id]` outside the transaction, re-read, and return the replay. This gives true "same id returns the same sale" semantics, survives 500s and retries, and is race-safe.
- Do NOT wrap the route in `Bg3ReliabilityService.guard` and tell tills NOT to send `Idempotency-Key` (otherwise defects a) and e) above apply). The BG3 maintenance-window check is the only thing lost; it can be called directly if wanted (UNKNOWN whether the owner wants maintenance blocking on tills; likely not).
- The offline queue is client-side: the till retries `POST /pos/quick-sale` with the same `clientSaleId` until it gets a 2xx. No server `SyncJob` is needed.
- Offline caveat for auth: `POST /auth/refresh {refreshToken}` rotates with reuse detection (auth.service.ts:223-229: a reused refresh token revokes the whole family). A till that replays from two tabs or retries a refresh can lock itself out. Access TTL 15m and refresh TTL 7d (auth.service.ts:57-58, quick-pin.service.ts:47-48; env `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`). Consider raising `JWT_ACCESS_TTL` for the event or making the client refresh serially.

---

## 4. Auth and scoping

### Branch and org resolution
- `JwtAuthGuard extends AuthGuard('jwt')` (common/guards/jwt-auth.guard.ts). `JwtStrategy.validate` (auth/jwt.strategy.ts:27-142) loads the `Session` by `jti`, checks revoked and expiry, and returns `{ id, roles, permissions, sessionId, sessionOrgId, sessionBranchId, ... }`. Permissions come from the JWT claim (`permissions` baked in at login) or are reloaded from `UserRole -> Role -> RolePermission` when the claim is empty. They are USER-level, not branch-level.
- `BranchContextGuard` (common/guards/branch-context.guard.ts:38-76) requires header `X-Branch-Id`, then `membership.findFirst({ where:{ userId, branchId, status:'ACTIVE' } })` with branch `status ACTIVE`. Else 403 and a `BRANCH_ACCESS_DENIED` audit. It sets `request.branchContext = { branchId, organizationId, roleId, membershipId }`, cached 30s per `userId:branchId`. Controllers enable it with `@UseGuards(..., BranchContextGuard)` plus `@RequireBranchContext()`.
- `PermissionGuard` (common/guards/permission.guard.ts:7-30) uses `@Permissions(...keys)` metadata and requires EVERY listed key (`requiredPermissions.every(...)`).

### Quick PIN login
- `POST /api/auth/quick-pin-login` (auth.controller.ts:105-111), body `QuickPinLoginDto` `{ branchId: string, pin: string (/^\d{6}(\d{2})?$/), platform: SessionPlatform }`; platform MUST be `POS_DESKTOP` (quick-pin.constants.ts:`QUICK_PIN_ALLOWED_PLATFORMS`). PIN lookup hash is derived from `(branchId, pin)` (quick-pin.service.ts:69), so a PIN is branch-specific.
- Lockout: 5 failures gives a 5 minute lock (quick-pin.constants.ts).
- Tiers: Cashier, Waiter, Bartender, Chef, Stock Manager get 6 digits; Supervisor and Manager get 8. `EXCLUDED_FROM_QUICK_PIN = [OWNER, ACCOUNTANT, PROCUREMENT, EVENT_MANAGER]`, so an Owner or Event Manager cannot use quick PIN (they use `/auth/login` email and password).
- Response: `{ accessToken, refreshToken, user:{ id, roles, permissions }, session:{ id, platform, source, orgId, branchId } }` (quick-pin.service.ts:~690-715).
- Admin issues PINs with `POST /auth/users/:id/issue-quick-pin` (perm `identity:user:write`, body `{ branchId? }`).
- Because the PIN hash is per branch, a cashier PIN is tied to one branch. 10 tills across two branches therefore means separate cashier users, or users with a membership in each branch and a PIN issued per branch (UNKNOWN whether the PIN column supports two branch hashes; `User.pinLookupHash` is a single column, so assume ONE branch per user).

### Permissions (seed.ts)
- Registry `PERMISSIONS_DATA` (seed.ts:132-...). Role grants in `ROLE_PERM_MATRIX` (seed.ts:682): Owner 683, Manager 956, Accountant 1234, Supervisor 1332, Cashier 1487-1559, Chef 1560, Waiter 1581, Bartender 1646, Procurement 1665, Stock Manager 1671, Event Manager 1680-1699. Seed order is in `main()` (seed.ts:8041+): roles, permissions, role-permissions, stale-revoke, then demo users and demo org.
- Cashier has: `pos:menu:read, pos:orders:read, pos:orders:write, pos:orders:close, pos:payment:create, pos:payment:close, pos:payment:intent, pos:payment:read, pos:payment:manual-reference, pos:payment:cancel, pos:refund:create, pos:refund:read, pos:shift:open|close|read, pos:till:open|reconcile|safe-drop|read, pos:receipt:read|reprint|send, pos:order:split|merge|transfer|move-items, devices:read` (seed.ts:1487-1559).
- Cashier does NOT have: `pos:orders:void`, `pos:void:postclose`, `pos:refund:approve`, any `pos:reports:*`, any `pos:dash:*`, `pos:menu:write`, `sync:jobs:write`.
- Bartender has no `pos:orders:write` (seed.ts:1646-1664), so bar tills must be users with the Cashier role.
- Event Manager (seed.ts:1680-1699) has reservations/feedback and `tenancy:org:read`; no reports, no dash, no orders.

### (a) What a Cashier needs to call quick-sale
Zero seed change option: `@Permissions('pos:orders:write', 'pos:orders:close')` (the guard needs all keys; Cashier, Manager, Owner and Supervisor hold both). Cleaner option: new key `pos:quicksale:create`, which needs a `PERMISSIONS_DATA` row, a `ROLE_PERM_MATRIX` entry for Cashier (plus Manager and Owner) and a deploy of the seed (see risk R3). Recommend the existing-keys option for the 7-day window.

### (b) Organiser reads one report across two branches in one call
- Existing org-scoped, multi-branch read pattern: `FranchiseController` (franchise.controller.ts:28-48). It is guarded by `JwtAuthGuard, PermissionGuard` only (no `BranchContextGuard`), and resolves the org with
  ```ts
  // franchise.service.ts:47-56
  async resolveOrgContext(userId) { const membership = await this.prisma.membership.findFirst({ where:{ userId, status:'ACTIVE' }, include:{ role:true } }); ... return { organizationId: membership.organizationId }; }
  // franchise.service.ts:59-63
  private async getOrgBranches(orgId) { return this.prisma.branch.findMany({ where:{ organizationId: orgId, status:'ACTIVE' }, select:{ id, name, code } }); }
  ```
  Then it iterates the branches with `Promise.all` (getOverview, franchise.service.ts:97-105).
- Caveats: (1) `franchise:overview:read` and `franchise:ranking:read` are NOT in seed.ts (a grep across packages/apps/docs finds them only in the controller), so those endpoints are effectively unreachable for any seeded role; do not reuse the keys. (2) `resolveOrgContext` takes the first active membership at random, which is fine for one org. (3) It does not verify the caller is a member of each branch, only of the org.
- `DashboardsService` already has the internal pattern `branchId: string | null` meaning "all branches of the org" (dashboards.service.ts:54-65, 87-97), but its controller always passes `ctx.branchId` (dashboards.controller.ts:23-31).
- For the organiser: new controller with `@UseGuards(JwtAuthGuard, PermissionGuard)`, resolve org by membership (or from `session.orgId`), accept `branchIds[]` (default = all ACTIVE branches of the org), verify each belongs to the org, and query with `branchId: { in: ids }`. New permission key `pos:event-report:read` granted to Owner, Manager, Accountant and Event Manager. Alternative with no seed change: gate on an existing key that Owner/Manager hold (`pos:reports:payment-mix:generate`, seed.ts:778, 1048, 1258), but an Event Manager user would not hold it, so give the organiser an Owner or Manager role.

---

## 5. Reports module

### How a generator is defined and registered
- Controller routes in apps/api/src/modules/reports/reports.controller.ts: `@Controller('reports')`, `@UseGuards(JwtAuthGuard)`, each route adds `@UseGuards(PermissionGuard, BranchContextGuard)`, `@Permissions('pos:reports:<x>:generate')`, `@RequireBranchContext()`. History is `GET /reports` and `GET /reports/:id` (perm `pos:reports:history:read`, lines 589-605). `POST /reports/export` (perm `pos:reports:exports:read`) and `GET /reports/exports/:id/download` (perm `pos:reports:exports:download`).
- A generator is a method on `ReportsService` that calls the shared runner `executeReport(orgId, branchId, requestedById, reportType, reportWindow, dateFrom, dateTo, parameters, generator)` (reports.service.ts:100-175). The runner creates a `ReportRun` (PENDING), runs the generator callback `(range) => { summary, rowCount }`, stores it as `COMPLETED` with `summary Json`, and audits `REPORT_RUN_COMPLETED` (includes `branchId`).
- Registration is three places: (1) the Prisma enum `ReportType` (schema.prisma:2634-2661), so a new report needs a migration with `ALTER TYPE ... ADD VALUE` (non-transactional and irreversible); (2) the catalog array `getReportCatalog()` (reports.service.ts:1663+); (3) the `generateCsv` switch (reports.service.ts:2145+).
- `ReportRun.branchId` is nullable (schema.prisma:2693) but `executeReport` takes a required `branchId: string`, so the existing runner is single-branch.
- CSV export: `createExport` (reports.service.ts:2036-2128) refuses PDF (501), writes `exports/<type>_<ts>.csv` to `process.cwd()/exports` on the API host disk, and creates an `ExportArtifact` row. This relies on a writable local filesystem (a risk on serverless hosting; hosting is UNKNOWN from the code, memory says Vercel to VPS migration is planned).
- `generateCsv` does NO CSV escaping (e.g. line 2191 `lines.push(\`${idx+1},${item.name},...\`)`): an item name with a comma breaks the file. Write a proper escape in any new CSV.
- `resolveRange` for `DAY/WEEK/MONTH` uses server-local `new Date(y, m, d)` (reports.service.ts:81-96). The Branch timezone is never consulted. The server timezone is UNKNOWN (likely UTC); a Kampala (UTC+3) evening event will straddle the UTC day. Use `CUSTOM` with explicit ISO timestamps including `+03:00`, or take `from/to` directly in the new endpoint.

### One small generator end to end (PAYMENT_MIX), copy this
Controller (reports.controller.ts:94-113):
```ts
@Post('payment-mix')
@UseGuards(PermissionGuard, BranchContextGuard)
@Permissions('pos:reports:payment-mix:generate')
@RequireBranchContext()
async generatePaymentMixReport(@Req() req: Request, @Body() dto: CreatePaymentMixReportDto, @CurrentUser() user: any) {
  const ctx = (req as any).branchContext;
  return this.reports.generatePaymentMixReport(ctx.organizationId, ctx.branchId, user.id, dto.reportWindow, dto.dateFrom, dto.dateTo, dto.parameters);
}
```
DTO (reports/dto/create-payment-mix-report.dto.ts): `reportWindow: ReportWindow (@IsEnum)`, optional `dateFrom`, `dateTo` (`@IsDateString`), `parameters` (`@IsObject`).
Service (reports.service.ts:348-396):
```ts
async generatePaymentMixReport(orgId, branchId, requestedById, reportWindow, dateFrom?, dateTo?, parameters?) {
  return this.executeReport(orgId, branchId, requestedById, 'PAYMENT_MIX', reportWindow, dateFrom, dateTo, parameters, async (range) => {
    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { orgId, branchId, status: 'COMPLETED', createdAt: { gte: range.start, lt: range.end } },
      _sum: { amount: true }, _count: true,
    });
    const totalAmount = payments.reduce((acc, p) => acc.add(p._sum.amount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
    const breakdown = payments.map((p) => ({ method: p.method, amount: (p._sum.amount ?? new Prisma.Decimal(0)).toString(), count: p._count ?? 0,
      percentage: totalAmount.gt(0) ? new Prisma.Decimal(p._sum.amount ?? 0).div(totalAmount).mul(100).toFixed(2) : '0.00' }));
    return { summary: { totalAmount: totalAmount.toString(), breakdown }, rowCount: payments.length };
  });
}
```
CSV (reports.service.ts:2180-2186): header `Method,Amount,Count,Percentage`, one row per breakdown entry, then a `Total` row.

### Questions answered
- **Does payment-mix count UNVERIFIED manual-reference payments?** Yes. It filters only `status: 'COMPLETED'` and the window; there is no `verificationStatus` or `captureMode` filter (reports.service.ts:367-376; same in dashboards.service.ts:92-103). Manual reference payments are created `COMPLETED` + `UNVERIFIED` (payments.service.ts:810-812), so they are counted. It also does not join the order, so a payment on an order that is not CLOSED is counted. A fully refunded or post-close-voided payment becomes `REFUNDED` and is excluded, but a PARTIAL refund leaves the payment `COMPLETED` at full value (refunds.service.ts `checkAndMarkPaymentRefunded` at line 305) and refunds are NOT netted in PAYMENT_MIX.
- **Which statuses count as a sale?** `Order.status IN ('CLOSED','SERVED')` (DAILY_SALES reports.service.ts:296; TOP_ITEMS 424; dashboards.service.ts:61). VOIDED and in-flight statuses are excluded. Window is `Order.createdAt`. Top items groups by `menuItemId` per branch (reports.service.ts:418-431), not by SKU.
- **Sales vocabulary:** `salesFigures()` (reports.service.ts:41-52): `grossSales = SUM(order.total)`, `netSales = gross - SUM(tax)`, `taxTotal`, `subtotalSales`.

### `/dash/*` endpoints
`DashboardsController` (`@Controller('dash')`, dashboards.controller.ts:13): `GET owner`, `manager`, `today-summary`, `payment-mix`, `open-orders`, `low-stock`, `snapshots`, `POST kpi/refresh`; plus `@Controller('stream')` `GET stream/metrics` (SSE polling every 15s, lines 125-145). All branch-scoped via `BranchContextGuard` and `ctx.branchId`. Built from LIVE aggregates (`order.aggregate`, `payment.groupBy`) on every call with server-local "today" ranges (dashboards.service.ts:15-28). There is NO cache (no `CacheModule`, `CacheInterceptor` or `@CacheTTL` anywhere in the repo). Persisted KPI snapshots exist (`KpiSnapshot`, `POST dash/kpi/refresh`) but are manual.

---

## 6. Menu

### Models (schema.prisma)
```
914  model Category { id, orgId, branchId, name, sortOrder, isActive; @@unique([branchId, name]) }
957  model MenuItem { id, orgId, branchId, categoryId, taxCategoryId?, browseGroupId?, browseSubgroupId?, name, sku String?, description?,
        price Decimal(10,2), itemType MenuItemType(FOOD|DRINK), station PrepStation @default(NONE), sortOrder, isActive, metadata Json?, ...
        @@unique([categoryId, name]); @@index([orgId]) [branchId] [categoryId] [taxCategoryId] [browseGroupId] [browseSubgroupId] }
1068 model MenuItemServing { id, menuItemId, format ServingFormat, label?, price Decimal(10,2), volumeText?, isDefault, sortOrder, isActive; @@unique([menuItemId, format, label]) }
1024 model MenuBrowseGroup { id, orgId, branchId, section MenuSection, name, internalKey?, sortOrder, isActive; @@unique([branchId, name]) }
1048 model MenuBrowseSubgroup { id, groupId, name, internalKey?; @@unique([groupId, name]) }
935  model TaxCategory { id, orgId, branchId, name, rate Decimal(5,2), efirsTaxCode?; @@unique([branchId, name]) }
```
- `sku` is a plain nullable string. It is NOT unique and NOT indexed (no `@@index` on `sku` in lines 988-994). Menu items are per branch (`branchId`), so the two vendors' menus are two sets of rows, one per branch. There is no `brand` column.
- `PrepStation` default `NONE` means KDS never gets items for them.

### Menu endpoints (apps/api/src/modules/menu/menu.controller.ts, `@Controller('menu')`)
`POST categories` (pos:menu:write, 37), `GET categories` (pos:menu:read), `PATCH categories/:id`; `POST tax-categories` (pos:tax:write, 80); `POST items` (pos:menu:write, 123), `GET items` (pos:menu:read, 137), `GET items/:id`, `PATCH items/:id` (149); `GET catalog` (166), `GET navigation` (312); browse groups and subgroups (174-250, pos:menu:write); `POST items/:id/servings` (256), `PATCH items/:itemId/servings/:servingId` (277); `PATCH items/:id/browse` (295); modifier groups and options (320-420). `CreateMenuItemDto` (menu/dto/create-menu-item.dto.ts): `name, categoryId, taxCategoryId?, sku? (max 50), description?, price, itemType, station?, sortOrder?, isActive?, metadata?`. `menu.service.ts:304` sets `sku: dto.sku ?? null`; no uniqueness check. Cashier has `pos:menu:read` only (seed.ts:1492); `pos:menu:write` is Owner, Manager (and Supervisor, seed.ts:1343).

### `demo-import.ts` (packages/db/prisma/demo-import.ts), NOT suitable for this
- It is a full demo-pack importer. `loadTables()` throws "Missing generated CSV" unless ALL 65 files in `EXPECTED_FILES` (lines 17-82) exist in `DEMO_DATA_DIR` (default `../../demo-data/csv`) (lines 228-235). It also validates exact headers per file (`EXPECTED_HEADERS`, line 59+) and imports demo orders, payments, journals and users.
- Menu item CSV format (`demo-data/csv/09_menu_items.csv`): `organizationSlug,branchCode,categoryName,taxCategoryName,name,price,itemType,station,sortOrder,isActive,sku,description,imageUrl,metadata`. Row mapping at demo-import.ts:943-967: upsert via `prisma.menuItem.upsert({ where:{ categoryId_name }, ...})`, with `sku: optional(row,'sku')`. `--write` flag required, default is dry-run (lines 14-17).
- Commands: `pnpm db:demo:validate`, `pnpm db:demo:import` (packages/db/package.json).

### Smallest path to import two vendor menus keyed by SKU with brand
New standalone script `packages/db/prisma/import-event-menu.ts` (about 120 lines, modelled on demo-import.ts:929-967 and its `--write` dry-run default). Input: one CSV `branchCode,brand,sku,name,category,price,itemType,station`. Steps per row: resolve Branch by `code` and org; upsert `Category` by `branchId_name`; upsert `MenuItem` keyed on `(branchId, sku)` once that unique exists (otherwise `findFirst({ branchId, sku })`); set `station: NONE`, `itemType`, `price` as Decimal 2dp, `brand`, `isActive:true`; fail the dry run on duplicate SKUs within a branch, duplicate names within a category (the `@@unique([categoryId, name])` constraint), or a price that is not a whole UGX. Add `"db:event-menu": "ts-node --project tsconfig.seed.json prisma/import-event-menu.ts"` to packages/db/package.json. Alternative with no new script but more calls: use the API (`POST /menu/categories`, `POST /menu/items`) with an owner token, after adding `brand` to `CreateMenuItemDto`/`UpdateMenuItemDto` and `menu.service.ts:304/479`. Before adding `@@unique([branchId, sku])`, run a duplicate check on the event database (UNKNOWN whether production has duplicate SKUs per branch).

---

## 7. Branch and Organization config

- `Branch` (schema.prisma:603-616): `timezone String @default("UTC")`, `currencyCode String @default("USD")`. Both defaults are wrong for Uganda. Set `timezone='Africa/Kampala'` and `currencyCode='UGX'` on BOTH event branches (via `PATCH` tenancy branch endpoint, perm `tenancy:branch:write`, or SQL). Nothing in orders or payments reads these today (UNKNOWN whether any receipt/report renders `currencyCode`; `Payment.currency` and `PaymentIntent.currency` default to `UGX`, schema.prisma:1626).
- `OrgSettings` (schema.prisma:791-817, one row per org): `vatPercent Decimal(5,2) @default(18.00)`, `currency @default("UGX")`, `discountApprovalThreshold @default(5000)`, `receiptFooter`, `taxMatrix Json?`, `rounding Json?` (`{ mode:"NEAREST"|"UP"|"DOWN", increment }`), `baseCurrencyCode?`. `rounding`, `taxMatrix` and `vatPercent` are not applied by the order path (see section 1).
- For a UGX branch with tax-inclusive round prices and no service charge: nothing needs configuring for totals. Prices are stored as `Decimal(10,2)` (UGX with .00); enter whole-UGX prices; there is no tax or service charge step in the write path; `MenuItem.taxCategoryId` is optional and ignored by the order path (leave null). Set `receiptFooter` if a receipt footer is wanted.
- Money type: Prisma `Decimal` (`Decimal` from `@prisma/client/runtime/library`, orders.service.ts:8; `Prisma.Decimal` in reports). Rounding helper is `toDecimalPlaces(2)` only; there is no shared money util. DTO amounts are `@IsNumber({ maxDecimalPlaces: 2 })` JS numbers converted with `new Decimal(x)`.
- Order number sequence: per branch, `ORD-%06d`, see section 1 for the race. Shift numbers use the same unsafe pattern (`SHF-%06d`, shifts.service.ts:42-53).

---

## 8. Tills

### Model and endpoints (apps/api/src/modules/tills/tills.controller.ts, `@Controller('tills')`, `JwtAuthGuard, PermissionGuard, BranchContextGuard`)
- `POST /tills/open` (perm `pos:till:open`, bg3-wrapped optional): `OpenTillDto { tillCode (max 50), openingFloat (>=0), notes? }`. `TillsService.openTill` (tills.service.ts:39-115): requires an OPEN `Shift` opened by the same user in the branch (else 400 "Open a shift before opening a till"), rejects a second OPEN session with the same `tillCode` in the branch (409), creates the `TillSession` with `expectedCash = openingFloat`, and writes an `OPENING_FLOAT` `CashMovement`. Shifts: `POST /shifts/open` (perm `pos:shift:open`), `POST /shifts/:id/close` (blocks while any till is OPEN, shifts.service.ts:102-114).
- `POST /tills/:id/safe-drop` (`pos:till:safe-drop`), `POST /tills/:id/reconcile` (`pos:till:reconcile`, `ReconcileTillDto { countedCash, varianceReason?, notes? }`), `GET /tills/active` (the caller's OPEN till in the branch), `GET /tills/:id`, `GET /tills/:id/summary` (adds `computedExpectedCash`).
- `reconcileTill` (tills.service.ts:181-282): only on OPEN; computes expected; `variance = counted - expected`; MATCHED if `abs <= 0.01`; a mismatch needs `varianceReason` (400); sets status `RECONCILED`, `closedAt = now`.
- `tillCode` is a free-text label on `TillSession` (index `[branchId, tillCode]`). It is not referenced by `Order` or `Payment` today.

### Expected cash and why it is per branch (tills.service.ts:364-452)
```ts
377 const timeStart = till.openedAt;  const timeEnd = till.closedAt || new Date();
381 const cashPayments = await this.prisma.payment.findMany({ where: { branchId: ctx.branchId, orgId: ctx.organizationId,
        method: PaymentMethod.CASH, status: 'COMPLETED', createdAt: { gte: timeStart, lte: timeEnd } } });
443-451 expected = openingFloat + cashSales + paidIn - safeDrops - cashPickups - refundCashOut - refundPayout - paidOut
```
The cash term sums EVERY completed cash payment in the whole branch during the till's open window; nothing filters by till or operator. With several open tills in a branch, each till's expected cash contains all the other tills' cash. Refunds are also branch-wide and not filtered to cash (comment at lines 427-428). `ShiftCloseSummary` (shifts.service.ts:219-245) has the same branch-wide cash query (UNKNOWN beyond line 245; not read).

### Minimal change so cash is attributed to the ringing till
1. Add `Payment.tillCode String?` (and `Order.tillCode`), written by quick sale from the request.
2. Change the query at tills.service.ts:381-389 to add `OR: [{ tillCode: till.tillCode }, { tillCode: null }]`. Event payments always carry a `tillCode`, so they attribute exactly; legacy null-tillCode payments keep today's behavior. Spec to update: tills.service.spec.ts.
3. Quick sale, for `CASH`, requires a `TillSession` for `(branchId, tillCode)` whose `[openedAt, closedAt ?? now]` window contains the sale time (OPEN at the time of the call normally; an offline replay after reconcile still has to be accepted, so match on `soldAt`, not on status). If none exists, return 409 `TILL_NOT_OPEN`.
4. Optional, stronger: `Payment.tillSessionId String?` FK to `TillSession`, so attribution does not depend on `tillCode` reuse across sessions. The `tillCode` plus time-window approach is sufficient if one tillCode is not shared by two concurrent sessions, which `openTill` already forbids (409 on a second OPEN session with the same code in a branch).
5. The stored `TillSession.expectedCash` is only decremented on safe drop; it is recomputed on reconcile and summary, so quick sale does not need to increment it.

---

## 9. Voids and refunds

- `POST /pos/orders/:id/void` (orders.controller.ts:210, perm `pos:orders:void`): `validateTransition` only allows NEW/SENT/IN_KITCHEN/READY to VOIDED; a CLOSED order throws 409 (orders.service.ts:872). Post-kitchen voids require a `reason`. Cashier does not hold `pos:orders:void` (Owner seed.ts:713, Manager 984, Supervisor 1355).
- **Void of a CLOSED order is `POST /api/pos/orders/:id/post-close-void`** (refunds.controller.ts:94-106, perm `pos:void:postclose`, held by Owner 730, Manager 1001, Supervisor 1385; NOT Cashier), body `PostCloseVoidDto { reason (max 500), managerPin }`. `RefundsService.postCloseVoid` (refunds.service.ts:231-301): order must be CLOSED; window `POST_CLOSE_VOID_WINDOW_MINUTES` (15) measured from `order.updatedAt` (not a closed timestamp); the "manager PIN" is checked against the CALLER's own `quickPinHash` with bcrypt (lines 258-265). So the caller must hold the permission and have a quick PIN; Owner and Event Manager are excluded from quick PIN (quick-pin.constants.ts), so an Owner login without a PIN gets 401 "Manager PIN required". In one transaction it sets `Order.status = VOIDED` and every COMPLETED payment to `REFUNDED`. Audit `ORDER_POST_CLOSE_VOIDED` carries `branchId`.
- Refunds: `POST /pos/orders/:id/refunds` (`pos:refund:create`; Cashier holds it), body `CreateRefundDto` (not read in detail; fields `paymentId`, `amount`, `reason`, `provider` per the model, schema.prisma:1684-1716). The order must be CLOSED. Auto-approved when `amount <= OrgSettings.discountApprovalThreshold` (default 5,000 UGX, refunds.service.ts:88-93); otherwise `PENDING` until `POST /pos/refunds/:id/approve` (`pos:refund:approve`, needs manager PIN, lines 145-180). Completed refunds are subtracted in expected cash (all refunds branch-wide).
- "Void last sale" for a quick-sale order (CLOSED): the API to call is `post-close-void` within 15 minutes, by a Manager or Supervisor user with a quick PIN (8-digit). A cashier cannot do it alone. If the event needs a cashier-initiated void, either grant a supervisor override flow at the till (supervisor enters their PIN, the client calls with the supervisor's token) or add a dedicated endpoint (out of scope for this spec). Note: a voided order leaves sale reports (status not CLOSED/SERVED) and its payment leaves payment reports (`REFUNDED`), so event reports stay consistent.

---

## 10. Migrations, rules, commit conventions

- Prisma 5.22 (packages/db/package.json). Scripts: `pnpm db:generate`, `pnpm db:migrate` (= `prisma migrate dev`, local only), `pnpm db:migrate:deploy` (= `prisma migrate deploy`), `pnpm db:seed`. Migrations live in `packages/db/prisma/migrations/<UTC yyyymmddhhmmss>_<snake_name>/migration.sql` (59 folders; latest `20260821200636_b5_4_d1_posting_error_resolution`). Names like `20260518000000_prompt4a_reservation_completed_event`.
- CLAUDE.md section 14 (lines 2008-2026): "Never edit a shared/applied migration. New migration or (local-only) reset." "Seed (`seed.ts`) is idempotent and must stay so. Money is Decimal-safe end-to-end." "**Shared/production Neon deploys use `db:migrate:deploy` ... ONLY - never `db:migrate`** ... Prisma migrations need a DIRECT (non-pooled) Neon connection - strip `-pooler` from the endpoint host. Any shared-Neon migration/seed requires an explicit per-cutover authorization gate (read-only preflight + a retained pre-migration recovery branch first); Postgres enum values cannot be dropped."
- AGENTS.md:199-201: "never edit an old migration that has already been shared; create a new migration or reset only in clearly non-production local states; verify Decimal handling carefully". AGENTS.md:262-... "Inventory / payments / accounting: verify transaction boundaries first; verify idempotency behavior; verify before/after money math with explicit numbers".
- CLAUDE.md:348-358 precedent: hand-write the migration instead of taking `prisma migrate dev`'s raw diff, because the repo has pre-existing schema drift (FK drop/recreate and index renames on sync/flags/training/maintenance tables) that a raw diff would apply. Follow the `B5.4-D1` migration style (plain `ALTER TABLE ... ADD COLUMN`).
- Enum additions: `ALTER TYPE ... ADD VALUE` runs outside a transaction (see 20260518000000 comment). Creating a NEW enum type with `CREATE TYPE` is fine in a normal migration.
- Test DB guard: UNKNOWN. I found no DATABASE_URL or "test database" guard in apps/api/test or jest configs. `apps/api/test/orders.e2e-spec.ts:7-8` says "Run against real DB; seed must have been run beforehand". CLAUDE.md section 16 (lines ~2062-2072): destructive QA uses an isolated disposable Docker `postgres:16` with `migrate deploy` + `db:seed`, and "Destructive/mutation QA never runs against `production`". Also: shell-inherited `DATABASE_URL` overrides `.env` (CLAUDE.md section 14 isolation bullet).
- Commit conventions: CLAUDE.md section 8 (line 122): "Do not `git commit` or `git push` unless the user explicitly asks." No conventional-commit prefix rule found (UNKNOWN). Add the Co-Authored-By/Claude-Session trailers given in the session system reminder when committing. CLAUDE.md section 20 requires CODEX.md and CLAUDE.md to be updated together when durable project guidance changes. Section 16 requires `ai/AI_STATUS.md`, `PROGRESS.md` updates and a completion report (`ai/AI_COMPLETION_REPORT_TEMPLATE.md`) and Postman collection hygiene when contracts change (AGENTS.md:515-610).
- `db:seed` runs the WHOLE seed (main(), seed.ts:8041+): demo users with known passwords (e.g. `Owner#123`, apps/api/test/orders.e2e-spec.ts:43) and a demo org. Do NOT run it blind on the event database (see risk R3).

---

## 11. Tests

- Unit tests are `*.spec.ts` next to the service (jest config in apps/api/package.json:61-76: `testRegex .*\.spec\.ts$`, ts-jest, node). Orders: apps/api/src/modules/orders/orders.service.spec.ts (462 lines). Payments: apps/api/src/modules/payments/payments.service.spec.ts (1088 lines). Tills: tills.service.spec.ts. Reports: reports.service.spec.ts (1011 lines). Refunds: refunds.service.spec.ts. Auth quick PIN: auth/quick-pin.service.spec.ts. Guard specs in common/guards/*.spec.ts. Repo-wide guard: common/audit/audit-branchid-guard.spec.ts.
- Pattern to reuse (payments.service.spec.ts:10-70): hand-built `prisma` object of `jest.fn()` delegates, `$transaction: jest.fn().mockImplementation((fn) => fn(prisma))`, `audit = { log: jest.fn() }`, `Test.createTestingModule({ providers: [Service, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }, ...] })`, `ctx = { branchId:'branch-1', organizationId:'org-1' }`, Decimal via `new Decimal(100)`. No shared factory or fixture library exists.
- E2E: `apps/api/test/*.e2e-spec.ts` (e.g. orders.e2e-spec.ts, payments.e2e-spec.ts, shifts-tills.e2e-spec.ts, dashboards.e2e-spec.ts, bg3-reliability-rollout.e2e-spec.ts). Config `apps/api/test/jest-e2e.json` (`testTimeout 120000`, `maxWorkers 1`). They boot `AppModule` with `ValidationPipe` and log in with seeded users (`owner@demo.local` / `Owner#123`, `waiter@demo.local` / `Waiter#123`), real DB, seeded. docs/TESTING_AND_QA.md has the disposable DB recipe.
- Commands (from apps/api): `pnpm test` (jest), `pnpm test:e2e` (`jest --config ./test/jest-e2e.json`), `pnpm lint`, `pnpm build` (`nest build`); root: `pnpm test` (turbo), `pnpm db:generate`, `pnpm db:migrate:deploy`. AGENTS.md:529-536 lists the readiness sequence: `db:generate, db:migrate, db:seed (twice), lint, test, test:e2e, dev:api`.
- Tests to add: quick-sale unit spec (new payment/card validations, idempotent replay, P2002 race, atomic rollback when payment fails, cash requires a till window, total/amount equality), tills.service.spec case for per-tillCode cash, event report spec (grouping math), plus one e2e with two branches and two tills.

---

## 12. [P] Proposed file-by-file change list (Event Till backend)

### Schema diff (packages/db/prisma/schema.prisma) [P]
```prisma
+ enum CardScheme  { VISA MASTERCARD OTHER }
+ enum MomoNetwork { MTN AIRTEL }

  model Order {
+   tillCode     String? @map("till_code")
+   clientSaleId String? @map("client_sale_id")
+   @@unique([orgId, clientSaleId])
+   @@index([orgId, branchId, tillCode, createdAt])
  }

  model Payment {
+   cardScheme  CardScheme?  @map("card_scheme")
+   cardLast4   String?      @map("card_last4") @db.VarChar(4)
+   authCode    String?      @map("auth_code")
+   terminalId  String?      @map("terminal_id")
+   tillCode    String?      @map("till_code")
+   momoNetwork MomoNetwork? @map("momo_network")
+   @@index([orgId, branchId, tillCode, createdAt])
+   @@index([orgId, cardScheme])
  }

  model MenuItem {
+   brand String?
+   @@unique([branchId, sku])     // NULL skus stay distinct; pre-check duplicates first
+   @@index([orgId, sku])
  }
```
Migration `packages/db/prisma/migrations/20261122000000_event_till_quick_sale/migration.sql` (hand-written, additive, transaction-safe: no `ADD VALUE` on existing enums):
```sql
CREATE TYPE "CardScheme"  AS ENUM ('VISA','MASTERCARD','OTHER');
CREATE TYPE "MomoNetwork" AS ENUM ('MTN','AIRTEL');
ALTER TABLE "orders"     ADD COLUMN "till_code" TEXT, ADD COLUMN "client_sale_id" TEXT;
ALTER TABLE "payments"   ADD COLUMN "card_scheme" "CardScheme", ADD COLUMN "card_last4" VARCHAR(4), ADD COLUMN "auth_code" TEXT,
                         ADD COLUMN "terminal_id" TEXT, ADD COLUMN "till_code" TEXT, ADD COLUMN "momo_network" "MomoNetwork";
ALTER TABLE "menu_items" ADD COLUMN "brand" TEXT;
CREATE UNIQUE INDEX "orders_org_id_client_sale_id_key" ON "orders"("org_id","client_sale_id");
CREATE INDEX "orders_org_id_branch_id_till_code_created_at_idx" ON "orders"("org_id","branch_id","till_code","created_at");
CREATE INDEX "payments_org_id_branch_id_till_code_created_at_idx" ON "payments"("org_id","branch_id","till_code","created_at");
CREATE INDEX "payments_org_id_card_scheme_idx" ON "payments"("org_id","card_scheme");
CREATE UNIQUE INDEX "menu_items_branch_id_sku_key" ON "menu_items"("branch_id","sku");
CREATE INDEX "menu_items_org_id_sku_idx" ON "menu_items"("org_id","sku");
```
(Index names follow Prisma's truncation rules; confirm with `prisma migrate diff` against a scratch DB, then hand-trim as the B5.4-D1 precedent did. If `@@unique([branchId, sku])` is risky, ship only the plain index and have the import script enforce uniqueness.)

### New files [P]
1. `apps/api/src/modules/quick-sale/quick-sale.module.ts`: imports `OrdersModule`; provides `QuickSaleService`.
2. `apps/api/src/modules/quick-sale/quick-sale.controller.ts`: `@Controller('pos')`, `@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)`, `@RequireBranchContext()`, `@Post('quick-sale') @HttpCode(200) @Permissions('pos:orders:write','pos:orders:close')` (no Bg3 wrap).
3. `apps/api/src/modules/quick-sale/dto/quick-sale.dto.ts`: `QuickSaleDto { clientSaleId (string 8-64, /^[A-Za-z0-9_-]+$/), tillCode (max 50), soldAt? (ISO), notes?, lines: QuickSaleLineDto[] (1..100: menuItemId XOR sku, menuItemServingId?, quantity int>=1), payment: QuickSalePaymentDto }`. `QuickSalePaymentDto { method: CASH|CARD|MOMO, tenderedAmount? (cash, >= total), cardScheme? CardScheme, cardLast4? /^\d{4}$/, authCode?, terminalId?, momoNetwork? MomoNetwork, externalTransactionId?, payerPhone? }` plus conditional rules: CARD requires `cardScheme` and `authCode`; MOMO requires `momoNetwork` and `externalTransactionId`; CASH requires `tillCode` match.
4. `apps/api/src/modules/quick-sale/quick-sale.service.ts`: `quickSale(userId, ctx, dto, meta)`:
   a. replay check `order.findFirst({ orgId, clientSaleId })` (branch must match else 409).
   b. pre-load all menu items and servings for the branch in one query (by id or sku, `isActive`), price in memory; reuse the pricing logic via a tx-aware extraction of `computeLinePricing` (recipe cost queries batched if possible).
   c. validate payment shape; for CASH check TillSession window.
   d. `$transaction(async tx => { advisory lock on branch (`SELECT pg_advisory_xact_lock(hashtext($branchId))`); next order number; `tx.order.create({ data:{ orgId, branchId, userId, serviceType:'TAKEAWAY', status:'CLOSED', orderNumber, tillCode, clientSaleId, subtotal, discount:0, tax:0, total, metadata:{ source:'QUICK_SALE', soldAt, tendered, changeDue }, items:{ create:[...] } } }); `tx.payment.create({ orgId, branchId, orderId, amount: total, method, status:'COMPLETED', captureMode: CASH?'ONLINE_PROVIDER':'MANUAL_REFERENCE', verificationStatus: CASH?'NOT_REQUIRED':'UNVERIFIED', externalTransactionId, transactionId, cardScheme, cardLast4, authCode, terminalId, tillCode, momoNetwork, enteredById: userId, postedAt }) }, { timeout: 15000, maxWait: 5000 })`.
   e. catch P2002 on `client_sale_id` and return the replay; P2002 on `order_number` retry up to 3 times.
   f. after commit: `audit.log({ action:'ORDER_QUICK_SALE', entityType:'order', metadata:{ orgId, branchId, orderNumber, tillCode, clientSaleId, total, method, itemCount } })` (must contain `branchId`) and an `ORDER_PAID_AND_CLOSED`-compatible entry so receipt history shows it; optional `payment.update` event.
   g. response: `{ replayed, order:{ id, orderNumber, status, total, tillCode, createdAt }, items:[...], payment:{...}, changeDue }`; receipt via existing `GET /receipts/:id`.
5. `apps/api/src/modules/quick-sale/quick-sale.service.spec.ts`: unit tests (mock pattern above).
6. `apps/api/src/modules/event-reports/` (`event-reports.module.ts`, `event-reports.controller.ts`, `event-reports.service.ts`, `dto/event-report-query.dto.ts`, `event-reports.service.spec.ts`): `@Controller('event-reports')`, `@UseGuards(JwtAuthGuard, PermissionGuard)` only; endpoints `GET summary` (tender split, card-scheme split with Visa value/share, items by tender/scheme, top items by SKU, per-till cash-up) and `GET lines.csv` (text/csv, streamed, proper escaping, UTF-8 BOM optional). Query: `from`, `to` (ISO with offset, required), `branchIds?` (default all ACTIVE branches of the org), `brand?`. Org from membership (franchise pattern), branches validated against the org. Compute with `$queryRaw`/`groupBy` over `Payment JOIN Order` (`o.status='CLOSED' AND p.status='COMPLETED'`), one payment per order so line value attributes exactly to that payment's tender and scheme; top items grouped by `COALESCE(mi.sku, mi.id)` with `brand`; per-till rows join `TillSession` on `(branch_id, till_code)` for opening float, counted cash, variance. Do NOT persist `ReportRun` (avoids the `ReportType` enum migration) and do NOT write to the exports dir; stream directly.
7. `packages/db/prisma/import-event-menu.ts` (script described in section 6) and a `db:event-menu` script entry in `packages/db/package.json`.
8. Optional one-time ops script or SQL to set both branches to `timezone='Africa/Kampala'`, `currencyCode='UGX'` and create tills/users.

### Edited files [P]
- `packages/db/prisma/schema.prisma` (diff above) and the new migration folder.
- `apps/api/src/app.module.ts`: register `QuickSaleModule`, `EventReportsModule` (not opened; UNKNOWN exact import list).
- `apps/api/src/modules/orders/orders.service.ts`: make `computeLinePricing` and a number allocator usable with a transaction client (add an optional `db: Prisma.TransactionClient | PrismaService = this.prisma` parameter; keep existing callers unchanged), or extract them to a small `OrderPricingService`. Export from `OrdersModule` (already exports `OrdersService`).
- `apps/api/src/modules/tills/tills.service.ts:381-389`: add the `tillCode` OR filter; update `tills.service.spec.ts`.
- `apps/api/src/modules/menu/dto/create-menu-item.dto.ts`, `update-menu-item.dto.ts`, `menu.service.ts:304,479`: accept and persist `brand` (needed only if menus are imported through the API; not needed if the script is used).
- `packages/db/prisma/seed.ts`: only if a new permission key is chosen (`PERMISSIONS_DATA` + `ROLE_PERM_MATRIX`); recommend NOT for the event, see R3.
- Docs/hygiene per CLAUDE.md: `ai/AI_STATUS.md`, `PROGRESS.md`, Postman collection for the new routes (AGENTS.md:515-610 rules).

### Risks (top to bottom) [P]
- **R1 Order number race (certain at 5 tills/branch).** `generateOrderNumber` is read-then-insert. Mitigation: per-branch `pg_advisory_xact_lock` inside the tx plus unique-violation retry; keep the `ORD-` prefix so the legacy generator still parses the last number (a different prefix would reset the legacy counter to 1 and collide).
- **R2 Interactive-transaction timeout.** Prisma's default is 5s with Neon latency; per-line recipe-cost queries multiply it. Mitigation: pre-load and price outside the tx, pass `{ timeout: 15000 }`, keep only writes inside.
- **R3 `db:seed` is not safe to run on the event DB.** `main()` also creates demo users with known passwords and a demo org (seed.ts:8072+). If a new permission is introduced, grant it with a targeted idempotent script or SQL insert into `permissions`/`role_permissions`, or avoid the need by using existing keys (`pos:orders:write`+`pos:orders:close`). Also note the JWT carries a permissions snapshot (15m), so grants apply on next login or refresh.
- **R4 Idempotency pitfalls** of `IdempotencyKey`/BG3 (FAILED key returns null, TTL unchecked, IN_FLIGHT stuck, P2002 race) and unusable `sync/replay` (no handlers, first-membership org, Cashier lacks `sync:jobs:write`). Mitigation: DB unique on `(orgId, clientSaleId)`.
- **R5 Cash cup-up is branch-wide today** (tills.service.ts:381): multiple tills double count. Mitigation: `tillCode` on `Payment` and the OR filter; verify `ShiftCloseSummary` (shifts.service.ts:228-245) which has the same branch-wide logic (not changed here, UNKNOWN impact).
- **R6 Report semantics:** existing PAYMENT_MIX/DAILY_SALES count UNVERIFIED payments, ignore partial refunds, use server-local day windows (timezone UNKNOWN, likely UTC for a UTC+3 event), do not escape CSV, and write files to local disk. Mitigation: the new event report uses explicit offset timestamps, nets completed refunds (or states that it does not), escapes CSV, and streams.
- **R7 Cross-vendor SKU keying:** `sku` is nullable and non-unique; two branches can hold the same SKU with different prices. Report by `(sku, brand)`; enforce uniqueness per branch in the import script before adding the DB unique.
- **R8 Auth for offline tills:** quick PIN is per branch (`pinLookupHash` is one column), access token 15m, refresh rotates with reuse detection (a reused refresh token kills the session family). Owner and Event Manager cannot quick-PIN login. Plan separate Cashier users per branch.
- **R9 Void path:** only Manager or Supervisor (own 8-digit PIN) within 15 minutes of `updatedAt`; Cashier cannot void a closed sale; Owner has no PIN. Decide the supervisor override flow before the event.
- **R10 `forbidNonWhitelisted`:** any extra client field returns 400; keep the DTO and the till client in lockstep. Add fields as optional so an older till build does not break.
- **R11 Hand-written migration** and the shared-DB gate (CLAUDE.md section 14): `migrate deploy` only, direct non-pooled Neon URL, recovery branch first, `ADD VALUE` avoided. Duplicate `(branch_id, sku)` in existing data would make the unique index fail: preflight with `SELECT branch_id, sku, count(*) FROM menu_items WHERE sku IS NOT NULL GROUP BY 1,2 HAVING count(*)>1`.
- **R12 Branch config defaults** (`UTC`, `USD`) must be changed to `Africa/Kampala`, `UGX` on both branches or any future receipt/report that reads them shows USD.
- **R13 Tests hit a real DB** with no guard found; use the disposable Docker `postgres:16` recipe in docs/TESTING_AND_QA.md, never production.
- **R14 `audit-branchid-guard.spec.ts`** fails the build if any new `audit.log(` omits `metadata.branchId` (without a `C-28-EXEMPT` comment).

### UNKNOWN items
- Whether tip 5a35a18 equals this export (no `.git` in the export).
- Server timezone and hosting target for the API at the event; whether `exports/` is writable there.
- `CreateRefundDto` exact fields and `/auth/refresh` response shape (not read).
- Whether any current Event DB data has duplicate `(branch_id, sku)`.
- Exact `AppModule` import list (not opened).
- Whether a user can hold a quick PIN for two branches (single `pinLookupHash` column suggests no).
- Impact of branch-wide cash logic in `ShiftCloseSummary` beyond lines 219-245.
