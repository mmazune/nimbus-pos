# BG4 Design Proposal — Receipts + POS Split/Merge/Transfer/Order Handoff

**Status:** AWAITING APPROVAL — Stage 1 of staged BG4 delivery.
**Author:** GitHub Copilot (Claude).
**Date:** 2026-04-30.
**Source-of-truth basis:** code > schema > Postman > completion reports. Discovery
report references in [ai/BG4_DESIGN_PROPOSAL.md](ai/BG4_DESIGN_PROPOSAL.md) point
to live files in this repo.

---

## 0. Executive summary

BG4 closes the receipt + POS-handoff gaps. The proposal below is **deliberately
narrower than the prompt's superset** in three places where the prompt either
overlapped the existing model or implied schema sprawl. Each narrowing is
flagged so you can override.

| Workstream | What I propose to ship                                     | Migration? |
| ---------- | ----------------------------------------------------------- | ---------- |
| A. Receipts | `Receipt` (1:1 Order) + `ReceiptDelivery` + `ReceiptPrintEvent`; 4 endpoints; auto-issue on Order close. | **Yes (#49)** |
| B. Handoff  | `Order.parentOrderId` + `Order.splitFromOrderId` + `Order.mergedIntoOrderId` + `Order.handoffMetadata Json?`; 6 endpoints. | **Yes (same #49)** |
| C. Partial pay | **Verify-only.** Existing `Order.payments[]` already supports it. No new schema. | No |
| D. History  | Reuse BG2 `audit-timeline` filtered by `entityType in ('order','receipt')`; add `GET /api/receipts/:id/history` as a thin convenience read over `AuditLog` + `ReceiptPrintEvent` + `ReceiptDelivery`. | No |

One Prisma migration (`20260501000000_bg4_receipts_and_pos_handoff`) carries
both A and B.

The four locked rules from BG3 are preserved verbatim: `/api/auth/me` stays
canonical, frontline staff stay PIN-first, public diner payments stay PENDING,
PesaPal stays owner-SaaS-only, no hotel/property-group concept introduced.

---

## 1. Channel reality (from discovery)

Verified in [apps/api/src/modules/alerts/channel-dispatcher.service.ts L119-L145](apps/api/src/modules/alerts/channel-dispatcher.service.ts#L119-L145):

| Channel  | Reality | BG4 surface |
| -------- | ------- | ----------- |
| `EMAIL`     | STUB (only "live" if `SMTP_*` env present; otherwise mock) | **Supported** — reuse `ChannelDispatcherService.dispatchEmail()`. Will return `status: 'QUEUED'` when transport mocked; `status: 'SENT'` when SMTP env present. Frontend gets a deterministic answer. |
| `SMS`       | STUB (only "live" if `SMS_PROVIDER_API_KEY` present)       | **Supported** — same shape as email. |
| `WHATSAPP`  | ABSENT (no dispatcher exists)                              | **`unsupported`** — `POST /receipts/:id/send` with channel `WHATSAPP` returns `400 RECEIPT_CHANNEL_UNSUPPORTED` with `{ channel: 'WHATSAPP', reason: 'NOT_WIRED' }`. No fake delivery row. |
| `PRINT`     | n/a (out of scope for BG4, owned by future BG5 device registry) | **Not a `send` channel.** Reprint endpoint returns printable payload; physical print is the device's job. |

This matches the prompt's rule "if a channel is not truly wired, expose it as
unsupported instead of pretending it works."

---

## 2. Partial payment verification (Workstream C)

**Finding: ALREADY SUPPORTED. No code change required.**

Evidence:
- `Order.payments Payment[]` is a 1:N relation ([packages/db/prisma/schema.prisma L1336](packages/db/prisma/schema.prisma#L1336)).
- `PaymentsService.closeOrderWithPayment` sums all prior `COMPLETED`
  payments for the order, adds the current request's payments, and asserts
  `alreadyPaid + newPayments >= order.total` ([apps/api/src/modules/payments/payments.service.ts L153-L164](apps/api/src/modules/payments/payments.service.ts#L153-L164)).
- Multiple separate `POST /api/payments/manual-reference` and
  `POST /api/payments/intents` calls against the same `orderId` are
  already accepted (each creates its own `Payment` row), and the close
  call is the only operation that enforces the "must equal total" rule.

So **split-bill scenarios where each diner pays their share separately are
already executable today** — the new split-bill endpoint (§4.B.1) just gives
the frontend a structured way to *plan* the split (allocate amounts to
diner-groups, generate guidance/receipts per group), without re-architecting
the payment engine.

**BG4 will document this in the completion report and add an e2e that proves
two partial `POST /api/payments/manual-reference` calls plus one final close
correctly settles a split-bill order.** No new payment migration.

The single narrow gap I will close is on the read side: a new
`GET /api/pos/orders/:id/balance` returning
`{ total, paid, remaining, completedPaymentCount, pendingIntentCount }` — pure
derivation, no schema change. Frontends today have to compute this client-side.

---

## 3. Schema diff (one migration)

Migration name: **`20260501000000_bg4_receipts_and_pos_handoff`**.

### 3.1 New models

```prisma
// ─────────────────── Receipts ───────────────────

enum ReceiptStatus {
  ISSUED        // generated at order close; immutable snapshot
  REISSUED      // reissued after a post-close adjustment (refund/void)
  VOIDED        // marked void (refund full / cancellation)
}

enum ReceiptDeliveryChannel {
  EMAIL
  SMS
  WHATSAPP   // accepted in enum but rejected at runtime as RECEIPT_CHANNEL_UNSUPPORTED
}

enum ReceiptDeliveryStatus {
  QUEUED      // enqueued; transport stub or no real provider env
  SENT        // confirmed accepted by transport
  FAILED      // transport rejected or threw
  UNSUPPORTED // channel known but not wired in this deployment
}

model Receipt {
  id              String        @id @default(cuid())
  orgId           String        @map("org_id")
  branchId        String        @map("branch_id")
  orderId         String        @unique @map("order_id")    // 1:1 with Order
  receiptNumber   String        @map("receipt_number")      // branch-scoped sequential, e.g. "R-000123"
  status          ReceiptStatus @default(ISSUED)
  issuedAt        DateTime      @default(now()) @map("issued_at")
  issuedById      String?       @map("issued_by_id")        // cashier who closed the order
  // Snapshot block — frozen at issue. If order/payments later change
  // (refund / post-close-void), a new Receipt row is created with status=REISSUED
  // and the prior row is marked VOIDED. We never edit a Receipt in place.
  snapshot        Json          // see §3.3 for the exact shape
  reprintCount    Int           @default(0) @map("reprint_count")
  lastReprintedAt DateTime?     @map("last_reprinted_at")
  metadata        Json?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  organization    Organization  @relation(fields: [orgId], references: [id])
  branch          Branch        @relation(fields: [branchId], references: [id])
  order           Order         @relation(fields: [orderId], references: [id])
  issuedBy        User?         @relation("ReceiptIssuedBy", fields: [issuedById], references: [id])
  deliveries      ReceiptDelivery[]
  printEvents     ReceiptPrintEvent[]

  @@unique([branchId, receiptNumber])
  @@index([orgId, branchId, issuedAt])
  @@map("receipts")
}

model ReceiptDelivery {
  id              String                @id @default(cuid())
  receiptId       String                @map("receipt_id")
  channel         ReceiptDeliveryChannel
  destination     String                // email address or phone number
  status          ReceiptDeliveryStatus @default(QUEUED)
  idempotencyKey  String?               @map("idempotency_key")  // M41 dedupe within a channel+receipt
  attemptCount    Int                   @default(0) @map("attempt_count")
  lastAttemptAt   DateTime?             @map("last_attempt_at")
  providerRef     String?               @map("provider_ref")
  errorCode       String?               @map("error_code")
  errorMessage    String?               @map("error_message")
  requestedById   String?               @map("requested_by_id")
  metadata        Json?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  receipt         Receipt               @relation(fields: [receiptId], references: [id])
  requestedBy     User?                 @relation("ReceiptDeliveryRequestedBy", fields: [requestedById], references: [id])

  // Idempotency: same key on same receipt+channel returns the existing row.
  @@unique([receiptId, channel, idempotencyKey])
  @@index([receiptId])
  @@map("receipt_deliveries")
}

model ReceiptPrintEvent {
  id            String   @id @default(cuid())
  receiptId     String   @map("receipt_id")
  printedById   String?  @map("printed_by_id")
  reason        String?  // e.g. "duplicate", "kitchen_copy", "customer_request"
  metadata      Json?
  createdAt     DateTime @default(now())

  receipt       Receipt  @relation(fields: [receiptId], references: [id])
  printedBy     User?    @relation("ReceiptPrintedBy", fields: [printedById], references: [id])

  @@index([receiptId, createdAt])
  @@map("receipt_print_events")
}
```

### 3.2 Diff against existing `Order` model

```diff
 model Order {
   id              String      @id @default(cuid())
   ...
+  parentOrderId      String?  @map("parent_order_id")       // BG4: child of a split parent
+  splitFromOrderId   String?  @map("split_from_order_id")   // BG4: original order this was split from (alias for parentOrderId for clarity in queries)
+  mergedIntoOrderId  String?  @map("merged_into_order_id")  // BG4: when this order is merged into another, points at the survivor
+  handoffMetadata    Json?    @map("handoff_metadata")      // BG4: snapshot of split/merge/transfer history (see §3.4)
   metadata        Json?
   ...
+  parentOrder        Order?   @relation("OrderSplitLineage", fields: [parentOrderId], references: [id])
+  childOrders        Order[]  @relation("OrderSplitLineage")
+  mergedInto         Order?   @relation("OrderMergeLineage", fields: [mergedIntoOrderId], references: [id])
+  mergedFrom         Order[]  @relation("OrderMergeLineage")
+  receipt            Receipt?
+  @@index([parentOrderId])
+  @@index([mergedIntoOrderId])
 }
```

`splitFromOrderId` is intentionally redundant with `parentOrderId`. It exists
because some downstream queries (analytics, refund attribution) want to filter
on "was this an originally-split-out order" without joining through the parent.
If you'd rather keep one field, say so and I'll drop `splitFromOrderId` and
have the service set `parentOrderId` only.

No new enum values are added to `OrderStatus`. Split children inherit the
parent's pre-split status (typically `NEW` or `SENT`). Merged-away orders are
transitioned to `VOIDED` and tagged in `handoffMetadata` with
`{ mergedIntoOrderId, mergedAt, mergedBy }` — keeps the existing state machine
intact.

### 3.3 `Receipt.snapshot` JSON shape (frozen contract)

```jsonc
{
  "schemaVersion": 1,
  "receiptNumber": "R-000123",
  "issuedAt": "2026-04-30T11:45:00.000Z",
  "org":     { "id": "org_…", "name": "…" },
  "branch":  { "id": "br_…",  "name": "…", "addressLines": ["..."], "phone": "..." },
  "cashier": { "id": "u_…",   "name": "...", "displayCode": "..." },
  "waiter":  { "id": "u_…",   "name": "...", "displayCode": "..." },
  "table":   { "id": "tbl_…", "label": "Table 7" } | null,
  "order":   { "id": "ord_…", "orderNumber": "…", "serviceType": "DINE_IN" },
  "lineItems": [
    {
      "menuItemId": "...",
      "name": "...",
      "quantity": 2,
      "unitPrice": "12000.00",
      "lineSubtotal": "24000.00",
      "notes": "...",
      "modifiers": [/* from OrderItem.metadata if present, otherwise [] */]
    }
  ],
  "totals": {
    "subtotal":  "24000.00",
    "discount":  "0.00",
    "tax":       "4320.00",
    "total":     "28320.00",
    "tendered":  "30000.00",
    "change":    "1680.00"
  },
  "payments": [
    { "method": "CASH", "amount": "30000.00", "reference": null }
  ],
  "refunds":  [],     // populated on REISSUED receipts after a refund
  "footer":   { "text": "Thank you. Powered by Nimbus POS." }
}
```

The snapshot is decimal-as-string everywhere to avoid float rounding when the
frontend renders it. All money fields are `Decimal(12,2)` upstream.

### 3.4 `Order.handoffMetadata` JSON shape

```jsonc
{
  "schemaVersion": 1,
  "events": [
    { "type": "SPLIT_BILL",   "at": "...", "by": "u_…", "mode": "EQUAL", "groupCount": 3 },
    { "type": "SPLIT_ITEMS",  "at": "...", "by": "u_…", "childOrderId": "ord_…", "movedItems": [{ "itemId": "...", "qty": 1 }] },
    { "type": "MERGE",        "at": "...", "by": "u_…", "absorbedOrderId": "ord_…" },
    { "type": "TRANSFER_TABLE", "at": "...", "by": "u_…", "fromTableId": "...", "toTableId": "..." },
    { "type": "TRANSFER_SERVER","at": "...", "by": "u_…", "fromUserId": "...", "toUserId": "..." },
    { "type": "MOVE_ITEMS",   "at": "...", "by": "u_…", "toOrderId": "...", "items": [...] }
  ]
}
```

Append-only. Every BG4 mutating endpoint pushes one event AND emits an
`AuditLog` row (see §4 audit table) so the BG2 timeline stays the canonical
cross-cutting view.

---

## 4. Endpoint surface

All routes live under `/api/...`, are JWT + permission guarded, and are
wrapped by `Bg3ReliabilityService.guard()` per the BG3 pattern.

### 4.A Receipts

| # | Method | Path | Permission | BG3 wrapped? | BG3 category | Audit action | Notes |
|---|--------|------|-----------|--------------|--------------|--------------|-------|
| A1 | GET   | `/api/receipts/:id` | `receipt:read` | no (read) | — | `RECEIPT_VIEWED` (fire-and-forget) | Returns `Receipt` + computed `printable` payload + `deliveries[]` summary. |
| A2 | POST  | `/api/receipts/:id/reprint` | `receipt:reprint` | yes (idempotent) | `null` (not a financial write) | `RECEIPT_REPRINTED` | Increments `reprintCount`, inserts `ReceiptPrintEvent`. Idempotency-Key dedupes a single physical reprint event within retries. |
| A3 | POST  | `/api/receipts/:id/send` | `receipt:send` | yes (idempotent) | `null` | `RECEIPT_SENT` | DTO `{ channel, destination, idempotencyKey? }`. Returns 400 `RECEIPT_CHANNEL_UNSUPPORTED` for WhatsApp. EMAIL/SMS may return 200 with delivery `status: 'QUEUED'` when transport not wired. |
| A4 | GET   | `/api/receipts/:id/history` | `receipt:read` | no (read) | — | none | Returns `{ printEvents[], deliveries[], auditLogs[] }`, the latter filtered by `entityType='receipt' AND entityId=:id`. |

**Auto-issue hook:** `PaymentsService.closeOrderWithPayment` (existing) is
extended to call `ReceiptService.issueOnClose(orderId, ctx, actorUserId, tx)`
inside the same `$transaction`. Generates a `Receipt` row with
`receiptNumber = "R-" + zero-padded branch-scoped sequence`.

**Reissue hook:** `RefundsService.processRefund` and
`RefundsService.postCloseVoid` (existing) call
`ReceiptService.reissueAfterRefund(orderId, refundId, tx)`. The previous
`Receipt` is marked `VOIDED`, a new `Receipt` row is inserted with
`status=REISSUED` and a fresh snapshot.

### 4.B POS handoff

| # | Method | Path | Permission | Open-only? | Finalized OK? | BG3 wrapped? | BG3 category | Audit action |
|---|--------|------|-----------|-----------|---------------|--------------|--------------|--------------|
| B1 | POST | `/api/pos/orders/:id/split-bill`     | `pos:order:split`     | yes (status ≠ CLOSED, VOIDED) | no  | yes | `BILLING`        | `ORDER_SPLIT_BILL` |
| B2 | POST | `/api/pos/orders/:id/split-items`    | `pos:order:split`     | yes (status ∈ NEW, SENT)      | no  | yes | `null`           | `ORDER_SPLIT_ITEMS` |
| B3 | POST | `/api/pos/orders/merge`              | `pos:order:merge`     | yes (both NEW or both SENT)   | no  | yes | `null`           | `ORDER_MERGED` |
| B4 | POST | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer`  | yes (status ≠ CLOSED, VOIDED) | no  | yes | `null`           | `ORDER_TRANSFERRED_TABLE` |
| B5 | POST | `/api/pos/orders/:id/transfer-server`| `pos:order:transfer`  | yes (status ≠ CLOSED, VOIDED) | no  | yes | `null`           | `ORDER_TRANSFERRED_SERVER` |
| B6 | POST | `/api/pos/orders/:id/move-items`     | `pos:order:transfer`  | yes (source status ∈ NEW, SENT; target status ∈ NEW, SENT) | no | yes | `null` | `ORDER_ITEMS_MOVED` |

**Why `category: 'BILLING'` only on `split-bill`:** split-bill changes the
financial settlement plan and so should obey BILLING maintenance windows like
`payments/intents` and `pos/orders/:id/close` already do (per BG3 matrix).
The other handoff endpoints are operational moves with no money side-effect.

**Why `null` (no maintenance category) on the other five:** they don't write
financial rows. They're staff-floor operations and locking them under any
existing M42 category would be inappropriate. If you want them under
maintenance, I'll add a new `BG3_CATEGORY.POS_FLOOR` constant — say the word.

**Cross-branch / cross-org safety:** every B1–B6 service method asserts source
and target orders share `orgId` AND `branchId`. Violations → `409
ORDER_HANDOFF_CROSS_BRANCH_FORBIDDEN`. Non-negotiable.

**Finalized-order guard:** B1–B6 reject `CLOSED` and `VOIDED` orders with
`409 ORDER_HANDOFF_FORBIDDEN_STATUS`. Refund and post-close-void remain the
only sanctioned post-close paths (existing M19 contract preserved).

### 4.C Partial-payment derivation read (only "new" non-handoff endpoint)

| # | Method | Path | Permission | Notes |
|---|--------|------|-----------|-------|
| C1 | GET | `/api/pos/orders/:id/balance` | `pos:payment:read` | Returns `{ orderId, total, completedPayments, totalPaid, remaining, pendingIntents, splitGroups? }`. Pure read, no audit row. |

This is the single minimum-viable backend support gap I'm closing for
split-bill correctness, per the prompt's instruction to "implement only the
minimum clean support necessary."

---

## 5. DTOs (canonical surface)

```ts
// Receipts
SendReceiptDto      { channel: 'EMAIL'|'SMS'|'WHATSAPP'; destination: string; idempotencyKey?: string }
ReprintReceiptDto   { reason?: string }                      // body optional; idempotency from header
ReceiptHistoryQueryDto { dateFrom?: string; dateTo?: string; limit?: number }

// Handoff
SplitBillDto        { mode: 'EQUAL'|'CUSTOM'; groupCount?: number; customGroups?: Array<{ amount: string; label?: string }> }
SplitItemsDto       { items: Array<{ orderItemId: string; qty: number }>; childOrder?: { tableId?: string; userId?: string } }
MergeOrdersDto      { sourceOrderId: string; targetOrderId: string }
TransferTableDto    { toTableId: string; reason?: string }
TransferServerDto   { toUserId: string; reason?: string }
MoveOrderItemsDto   { toOrderId: string; items: Array<{ orderItemId: string; qty: number }> }
```

All `class-validator` decorated, all rejecting unknown fields with
`@nestjs/common` `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` per repo convention.

---

## 6. Permissions to add (seed diff)

```ts
// packages/db/prisma/seed.ts — PERMISSIONS_DATA additions
{ action: 'receipt:read',           description: 'Read receipts and their history' },
{ action: 'receipt:reprint',        description: 'Reprint a receipt' },
{ action: 'receipt:send',           description: 'Send a receipt by email/SMS' },
{ action: 'pos:order:split',        description: 'Split a POS order (bill or items)' },
{ action: 'pos:order:merge',        description: 'Merge two POS orders' },
{ action: 'pos:order:transfer',     description: 'Transfer table, server, or items between POS orders' },
```

Role grants:
- **Owner, Manager:** all 6.
- **Cashier:** `receipt:read`, `receipt:reprint`, `receipt:send`,
  `pos:order:split` (split-bill is a cashier action).
- **Waiter:** `receipt:read`, `pos:order:transfer` (table/server reassign +
  move-items are floor actions). NOT `pos:order:split` (cashier-only).
- **Chef, Bartender, Stock Manager:** none (frontline non-POS).

Confirm before I touch the role matrix.

---

## 7. BG3 / M41 / M42 reuse matrix

| Endpoint                     | Idempotency-Key | M42 maintenance | M42 training |
|------------------------------|-----------------|-----------------|--------------|
| A2 reprint                   | optional        | none            | no           |
| A3 send                      | optional (also dedupes per-receipt+channel via `ReceiptDelivery.idempotencyKey` unique constraint) | none | no |
| B1 split-bill                | optional        | `BILLING_WRITES` (423) | no |
| B2 split-items               | optional        | none            | no |
| B3 merge                     | optional        | none            | no |
| B4 transfer-table            | optional        | none            | no |
| B5 transfer-server           | optional        | none            | no |
| B6 move-items                | optional        | none            | no |

`Idempotency-Key` is OPTIONAL on every wrapped surface (BG3 pattern preserved).

---

## 8. Tests plan

E2E spec: `apps/api/test/bg4-receipts-and-pos-handoff.e2e-spec.ts`. Targeted
12 tests, all using the live Neon DB and the existing test bootstrap pattern.

1. **Receipt auto-issue on close** — close a SERVED order with full payment, assert one `Receipt` row exists with `status=ISSUED`, `receiptNumber` matches `^R-\d{6,}$`, snapshot decimal fields are strings.
2. **GET receipt** — owner reads receipt; response has `printable.lineItems`, `printable.totals`, `deliveries:[]`, `printEvents:[]`.
3. **Receipt reprint** — POST reprint twice with same `Idempotency-Key`; assert one `ReceiptPrintEvent` row, `reprintCount === 1`.
4. **Receipt send EMAIL** — POST send `{ channel:'EMAIL', destination:'x@y' }`; assert `ReceiptDelivery` row created with `status ∈ {QUEUED,SENT}` (depends on env).
5. **Receipt send WHATSAPP unsupported** — POST send `{ channel:'WHATSAPP', destination:'+256…' }` → 400 `RECEIPT_CHANNEL_UNSUPPORTED`; no delivery row.
6. **Receipt history** — GET history returns aggregated print + delivery + audit rows.
7. **Split bill EQUAL** — open NEW order, POST `split-bill {mode:'EQUAL', groupCount:3}`; assert 3 `splitGroups` returned + `handoffMetadata.events[]` has SPLIT_BILL event; original order stays NEW.
8. **Split items** — POST `split-items {items:[{orderItemId, qty:1}]}` from a NEW order; assert child order created with `parentOrderId === parent.id` and the item moved (parent qty decremented).
9. **Merge orders** — create two NEW orders same branch/table, POST `merge`; assert source `mergedIntoOrderId === target.id`, source `status === VOIDED`, target items combined.
10. **Transfer table** — POST `transfer-table {toTableId}`; assert `Order.tableId` updated and `handoffMetadata.events` has TRANSFER_TABLE event.
11. **Cross-branch merge denied** — POST merge between two orders in different branches → 409 `ORDER_HANDOFF_CROSS_BRANCH_FORBIDDEN`.
12. **Permission denial** — chef token attempts `POST /api/receipts/:id/send` → 403; waiter attempts `POST /api/pos/orders/:id/split-bill` → 403.

Plus 1 idempotency test (duplicate split-bill key + same payload → cached body)
and 1 conflict test (duplicate split-bill key + different payload → 409
`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`) layered into tests #7 / repeat — total
**~14 e2e tests**.

---

## 9. Postman plan

Single collection: `postman/collections/BG4-Receipts-And-Pos-Handoff.postman_collection.json`.

Folders (all `[STANDALONE]` per R3/R18 except where noted):
- `00 Read Me`
- `A. Auth & Context Baseline` — owner login + `/api/auth/me` resolution.
- `B. Receipt Read / History` — auto-creates a closed-order fixture if no receiptId in env.
- `C. Receipt Reprint / Send` — reprint twice with same key (idempotency proof) + email send + whatsapp unsupported demo.
- `D. Split Bill` — auto-creates a fresh NEW order; POST split-bill EQUAL.
- `E. Split Items` — auto-creates a fresh NEW order with 2 items; moves 1 to a child.
- `F. Merge Orders` — auto-creates two NEW orders same table; merges.
- `G. Transfer Table / Server` — auto-creates a NEW order; transfers table.
- `H. Move Items` — auto-creates two NEW orders; moves an item between them.
- `I. Edge Cases / Conflicts` — finalized-order rejection, cross-branch merge rejection, permission denial via chef login.

R12 / R14 / R16 patterns reused verbatim from BG3 collection. Newman target:
**0 failed assertions, 0 failed requests.**

---

## 10. Files I will add / change in Stage 2

**Add (12):**
- `packages/db/prisma/migrations/20260501000000_bg4_receipts_and_pos_handoff/migration.sql`
- `apps/api/src/modules/receipts/receipt.service.ts`
- `apps/api/src/modules/receipts/receipt-delivery.service.ts`
- `apps/api/src/modules/receipts/receipts.controller.ts`
- `apps/api/src/modules/receipts/receipts.module.ts`
- `apps/api/src/modules/receipts/dto/{send-receipt,reprint-receipt,receipt-history-query,index}.dto.ts`
- `apps/api/src/modules/pos-order-handoff/pos-order-handoff.service.ts`
- `apps/api/src/modules/pos-order-handoff/pos-order-handoff.controller.ts`
- `apps/api/src/modules/pos-order-handoff/pos-order-handoff.module.ts`
- `apps/api/src/modules/pos-order-handoff/dto/{split-bill,split-items,merge-orders,transfer-table,transfer-server,move-order-items,index}.dto.ts`
- `apps/api/test/bg4-receipts-and-pos-handoff.e2e-spec.ts`
- `postman/collections/BG4-Receipts-And-Pos-Handoff.postman_collection.json`
- `ai/BG4_COMPLETION_REPORT.md`

**Modify (6):**
- `packages/db/prisma/schema.prisma` — append models + Order diff per §3.
- `packages/db/prisma/seed.ts` — 6 perms + role grants + `recordSeedRun('bg4-receipts-and-pos-handoff', …)`.
- `apps/api/src/app.module.ts` — register `ReceiptsModule` + `PosOrderHandoffModule`.
- `apps/api/src/modules/payments/payments.service.ts` — call `ReceiptService.issueOnClose` inside the existing `$transaction`.
- `apps/api/src/modules/refunds/refunds.service.ts` — call `ReceiptService.reissueAfterRefund` from `processRefund` and `postCloseVoid`.
- `apps/api/src/modules/orders/orders.service.ts` — extend `getOrder()` to optionally include `receipt`. (No state-machine change.)
- `ai/AI_STATUS.md` — BG4 entry, counts +1 collection, +1 completion report, +1 migration (#49).
- `repo file tree.txt` — refresh.

**Out of scope (explicitly NOT touched, per prompt §I):**
- Device/printer registry — owned by future BG5.
- Export/download consistency — owned by future BG6.
- `OrderItemModifier` snapshot table — flagged in discovery as a gap; deferred (BG4 reads modifiers from `OrderItem.metadata` if present, otherwise omits from snapshot).
- `/api/public/payments/*` — remains scaffold-only per locked rule.
- PesaPal — owner-SaaS-billing-only, untouched.

---

## 11. Open decisions for you

Please confirm or override the four items below. After your answers I'll
proceed to Stage 2 (implementation + e2e) without further questions.

1. **Receipt model**: I propose 3 new tables (`Receipt`, `ReceiptDelivery`, `ReceiptPrintEvent`). Approve, or push reprint/delivery into `AuditLog` only?
2. **Split-bill model**: I propose split-bill **does not** physically split the order — it generates `splitGroups` (allocation plan) so multiple `Payment` rows can be applied per group, and on full payment the order closes once. (Split-items is the physical split.) Approve?
3. **Merge semantics**: source order becomes `VOIDED` with `mergedIntoOrderId` set; target absorbs items + adjusts totals. Acceptable, or do you want source kept as `CLOSED` with a 0-total instead?
4. **Permission scope for cashier vs. waiter** (§6): cashier owns split + receipts, waiter owns transfer-table/server/items. Confirm.
5. **`splitFromOrderId`** redundancy with `parentOrderId` (§3.2): keep both, or drop `splitFromOrderId`?

Reply with answers and I'll start Stage 2.
