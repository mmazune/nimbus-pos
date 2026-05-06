# BG4.A — Receipts Surface (View / Reprint / Send / History) — Completion Report

**Date**: 2026-05-01
**Scope**: BG4.A — POS receipt view, reprint, send (record-as-PENDING), history.
**Status**: ✅ Complete. **BG4.B (POS order handoff: split / merge / transfer / move-items) is intentionally deferred to the next prompt** per user direction (BG4 was scope-split because the handoff surface needs ~6 endpoints + a careful permission matrix + KOT-republish semantics + e2e + Postman, and combining it with receipts in one prompt risked regressing the BG3 facade or M42 contracts).

---

## 1. Context Snapshot

- Last completed milestone before this turn: **BG3 — Reliability Rollout (Idempotency + Maintenance/Training across 16 risky write surfaces)**.
- All locked rules continue to hold — see §11.
- This milestone introduces **no schema change**, **no migration**, **no new Prisma model**. Receipt id == order id; the printable view is composed from existing `Order` / `OrderItem` / `Payment` / `Branch` / `Organization` / `OrgSettings.receiptFooter` / `Table.label` / `User`. History is derived from `AuditLog` (entityType `receipt` for the new audit actions + the existing order-lifecycle rows on entityType `order`).

---

## 2. Summary

Cashiers, managers, owners, and waiters can now (re)view, reprint, "send" (record-as-PENDING), and audit-history any closed/voided order receipt via four new endpoints under `/api/receipts`. Reprint and send wrap through the existing BG3 reliability facade (`Bg3ReliabilityService.guard`) so `Idempotency-Key` replay works exactly the same way as it does on every other BG3-wrapped surface.

Three new permissions (`pos:receipt:read | pos:receipt:reprint | pos:receipt:send`) are seeded and granted to **Owner / Manager / Cashier / Waiter**. **Chef is intentionally denied** — both the e2e and Postman suites assert 403 across all three actions.

`POST /api/receipts/:id/send` returns **202 Accepted** with `{ status: 'PENDING', supported: false, reason: 'NO_LIVE_DELIVERY_ADAPTER', deliveryId, ... }`. **No real outbound email/SMS/WhatsApp delivery is attempted this milestone**; integration with a live delivery adapter is intentionally deferred. The `deliveryId` is stable across `Idempotency-Key` replay so frontends can correlate retries.

---

## 3. Files Added / Changed

### Added

- `apps/api/src/modules/receipts/dto/send-receipt.dto.ts`
- `apps/api/src/modules/receipts/dto/reprint-receipt.dto.ts`
- `apps/api/src/modules/receipts/dto/receipt-history-query.dto.ts`
- `apps/api/src/modules/receipts/dto/index.ts`
- `apps/api/src/modules/receipts/receipts.service.ts`
- `apps/api/src/modules/receipts/receipts.controller.ts`
- `apps/api/src/modules/receipts/receipts.module.ts`
- `apps/api/test/bg4-receipts-surface.e2e-spec.ts`
- `postman/collections/BG4-Receipts-Surface.postman_collection.json`
- `ai/BG4_COMPLETION_REPORT.md` (this file)

### Modified

- `apps/api/src/app.module.ts` — registered `ReceiptsModule`.
- `packages/db/prisma/seed.ts` — added 3 permission entries; granted to Owner/Manager/Cashier/Waiter in `ROLE_PERM_MATRIX`; appended `recordSeedRun('bg4a-receipts-surface', ...)` marker after the BG3 marker.
- `ai/AI_STATUS.md` — top counters bumped (collections 52, completion reports 58, last completed milestone = BG4.A); new BG4.A detail section added.

### Not changed

- No schema. No migration. No new Prisma model. No new audit `entityType` enum (audit `entityType` is a free-form `String` column already used for arbitrary domain entities). No change to BG3 facade. No change to M42 maintenance / training. No change to public diner payment flow. No change to PesaPal owner-SaaS billing flow. No hotel structures.

---

## 4. Database

**No schema change. No migration.**

Receipt id is the order id. The receipt view is composed at request time from existing tables. Reprint / send mutations are recorded in `AuditLog` only — no dedicated receipt table is introduced this milestone.

---

## 5. API + Write-Surface Matrix

| Method | Path | Permission | Audit action | BG3 facade | Idempotency | Returns |
|---|---|---|---|---|---|---|
| `GET` | `/api/receipts/:id` | `pos:receipt:read` | `RECEIPT_VIEWED` (fire-and-forget) | — | — | 200 receipt view |
| `GET` | `/api/receipts/:id/history` | `pos:receipt:read` | — | — | — | 200 paginated `{ data, total, page, pageSize }` |
| `POST` | `/api/receipts/:id/reprint` | `pos:receipt:reprint` | `RECEIPT_REPRINTED` | `scope:'receipts.reprint', category:null, idempotencyMode:'optional', fingerprintSource:{id,dto}` | optional | 200 `{ ok, action, receiptId, copies, reason, reprintedAt, printable }` |
| `POST` | `/api/receipts/:id/send` | `pos:receipt:send` | `RECEIPT_SENT` (metadata `{ status:'PENDING', supported:false, reason:'NO_LIVE_DELIVERY_ADAPTER', deliveryId, channel, recipient(masked), requestedAt }`) | `scope:'receipts.send', category:null, idempotencyMode:'optional', fingerprintSource:{id,dto}` | optional | **202** `{ ok, action, receiptId, channel, recipient(masked), status:'PENDING', supported:false, reason, deliveryId, requestedAt, locale, note }` |

`category: null` is intentional on both write surfaces. Reprint and send do not produce billing or accounting mutations — they are read/notify-only — so no M42 maintenance window category applies. Existing BG3 contracts (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, `IDEMPOTENCY_KEY_INVALID`) still apply when an `Idempotency-Key` is supplied.

`POST /:id/send` validates `channel ∈ { email, sms, whatsapp }`. Unknown channels return 400 (`class-validator` `IsEnum`).

`GET /:id` and `POST /:id/reprint` and `POST /:id/send` all assert the order is **printable** (`status ∈ { CLOSED, VOIDED }`). NEW / SENT / IN_KITCHEN / READY / SERVED return 409 from reprint/send.

`GET /:id/history` query merges `entityType:'receipt'` rows (the new BG4 audit actions) with `entityType:'order'` rows whose action ∈ `{ ORDER_PAID_AND_CLOSED, ORDER_AUTO_SETTLED, ORDER_VOIDED }` so a single call yields the full close → reprint → send trail.

---

## 6. Permissions

Three new permissions seeded into `packages/db/prisma/seed.ts`:

| Permission | Owner | Manager | Cashier | Waiter | Chef | Bartender | Stock Mgr |
|---|---|---|---|---|---|---|---|
| `pos:receipt:read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pos:receipt:reprint` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pos:receipt:send` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

Chef-denied is verified by both the e2e and Postman suites (3 × 403 each). The seed marker `bg4a-receipts-surface` is recorded in `SeedRun` after grants succeed.

---

## 7. Tests

### e2e — `apps/api/test/bg4-receipts-surface.e2e-spec.ts`

**12 / 12 passing** (~157s). Boots `AppModule`, logs in `owner@demo.local` and `chef@demo.local`, builds context via `/api/auth/me`, creates a synthetic CLOSED `Order` (`orderNumber: BG4A-${suffix}`, total 22.00) + COMPLETED `Payment` (CASH, 22.00) directly via Prisma in `beforeAll`, cleans up payments + audit rows + order in `afterAll`.

| Section | Test | Status |
|---|---|---|
| A. GET `/api/receipts/:id` | normalized receipt for closed order (Owner) | ✅ |
| A | chef without `pos:receipt:read` → 403 | ✅ |
| A | unknown receipt id → 404 | ✅ |
| B. POST `/api/receipts/:id/reprint` | records `RECEIPT_REPRINTED` audit row + returns printable view | ✅ |
| B | `Idempotency-Key` replay returns cached body, audits once | ✅ |
| B | chef without `pos:receipt:reprint` → 403 | ✅ |
| C. POST `/api/receipts/:id/send` | 202 PENDING with `supported:false` (no live adapter) | ✅ |
| C | rejects unknown channel with 400 | ✅ |
| C | `Idempotency-Key` replay returns same `deliveryId` | ✅ |
| C | chef without `pos:receipt:send` → 403 | ✅ |
| D. GET `/api/receipts/:id/history` | returns audit rows for the receipt (read + reprint + send all seen) | ✅ |
| D | respects pagination (`page=1 pageSize=1`) | ✅ |

### TypeScript

`pnpm exec tsc --noEmit` from `apps/api` — clean for all BG4 files. Only the four pre-existing `accounts-receivable.service.spec.ts` diagnostics remain (out-of-scope, predates BG2/BG3, untouched by BG4).

---

## 8. Postman

`postman/collections/BG4-Receipts-Surface.postman_collection.json` — newman: **19 requests, 37 / 37 assertions, 0 failures** (~2m 21s).

Folders:

- `00 Read Me` — variables, run order, locked rules.
- `A. Auth & Context Baseline` — login owner, `/api/auth/me`, login chef, resolve `receiptOrderId` via `GET /api/pos/orders?status=CLOSED&pageSize=1`.
- `B. Receipt Read & History` — GET `/:id`, GET `/:id/history`.
- `C. Receipt Reprint` — POST `/:id/reprint` + idempotency replay.
- `D. Receipt Send (PENDING — no live adapter)` — POST `/:id/send` (202) + idempotency replay (matching `deliveryId`).
- `E. Permission Denial — Chef` — chef → 403 on read / reprint / send.
- `F. Edge Cases` — unknown receipt id → 404, unknown channel → 400.

Pre-request script mirrors the BG3 canonical pattern (R3 / R4 / R5 / R12 / R14 / R16 from `ai/AI_POSTMAN_WORKING_PATTERNS.md`): dual-scope `getVar` / `setVar`, `[200, 201]` login, `/api/auth/me` canonical context resolver, owner + chef token chaining, auto-resolved `receiptOrderId`.

---

## 9. Docs

- `ai/AI_STATUS.md` — BG4.A entry added; top counters bumped (collections 52, completion reports 58); next milestone now reads BG4.B.
- This file.

---

## 10. DONE Checks

- [x] BG3 idempotency facade reused (not parallelised).
- [x] No schema / migration / new Prisma model.
- [x] `/api/auth/me` remains canonical.
- [x] PIN-first frontline rules intact.
- [x] PesaPal still owner-SaaS-only; public diner payments still pending the MTN/Airtel work.
- [x] Chef denied across all three new permissions; e2e + newman both assert 403.
- [x] Receipt id == order id.
- [x] Receipt history merges receipt-side + order-lifecycle audit rows in one paginated query.
- [x] `POST /:id/send` returns 202 + `supported:false` + `reason:'NO_LIVE_DELIVERY_ADAPTER'` (no real send).
- [x] `Idempotency-Key` replay returns the same `deliveryId` byte-for-byte.
- [x] Seed marker `bg4a-receipts-surface` recorded.
- [x] e2e 12 / 12 passing.
- [x] newman 37 / 37 assertions passing.
- [x] `tsc --noEmit` clean for BG4 files.
- [x] No hotel structures introduced.

---

## 11. Locked Rules — Re-verified

| Rule | Status |
|---|---|
| `/api/auth/me` is the canonical context route for authenticated frontend shells. | ✅ Preserved. BG4.A reads `req.branchContext` exactly the way BG3 does. |
| `POST /api/auth/login` accepts `[200, 201]`. | ✅ Postman pre-request asserts `[200,201].includes(code)`. |
| Public diner payments (`/api/public/payments/*`) are SCAFFOLD ONLY — pending MTN/Airtel native integration. | ✅ Out of scope. No change. |
| PesaPal is reserved for owner-SaaS subscription billing only. | ✅ Out of scope. No change. |
| BG3 facade must not be parallel-implemented; reuse `Bg3ReliabilityService.guard`. | ✅ Reprint and send both wrap through `Bg3ReliabilityService.guard` (not a new facade). |
| BG3 idempotency-key contracts (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, `IDEMPOTENCY_KEY_INVALID`, optional mode by default) preserved. | ✅ Reuses the facade as-is. |
| M42 service-layer maintenance check on `inventory.adjustments` returns 409 `MAINTENANCE_WINDOW_ACTIVE`. | ✅ Untouched. BG4.A endpoints use `category: null` (read/notify-only). |
| No new hotel / property-group concept. | ✅ Confirmed. |
| No new audit `entityType` enum required. | ✅ `entityType` on `AuditLog` is a free-form `String`; receipts use `'receipt'`. |
| No new schema/migration. | ✅ Confirmed. |
| Chef remains denied for any new managerial / cashiering permission. | ✅ All 3 new perms; verified by e2e + newman. |

---

## 12. Decisions / Deviations

- **No-schema-change derivation strategy** (user-confirmed option A in the clarifying questions). Receipt id == order id; printable view composed at request time from existing tables; history derived from `AuditLog`.
- **PENDING-only send** (user-confirmed). `POST /:id/send` is fully wired through audit + idempotency, but no live email/SMS/WhatsApp adapter is invoked. `supported:false` and `reason:'NO_LIVE_DELIVERY_ADAPTER'` make the no-adapter state explicit to the caller.
- **Scope-split into BG4.A + BG4.B** (user-confirmed). BG4.B (split / merge / transfer / move-items) is the next prompt. This kept BG4.A diff small enough to land cleanly without risking BG3/M42 regressions.
- **`category: null` on the BG3 facade** for both reprint and send. These are read/notify-only paths — no billing or accounting mutation occurs — so no M42 maintenance category applies. The facade still supplies `Idempotency-Key` reuse, training-mode short-circuit, and structured 409 reshaping.
- **Permission prefix `pos:receipt:*`** (not `receipt:*`) to match the repo's `pos:` prefix convention seen across orders / payments / refunds / shifts / tills.
- **Recipient masking** on send (e.g. `gu***@example.com`, `256***00`) so audit rows never store full PII.
- **Serialised reads inside `buildReceiptView`** (10 small queries in series, not `Promise.all`) — same pool-friendly pattern BG2 settled on for `UnifiedApprovalsService.list`. The first e2e run hit pool exhaustion under parallel reads; serial reads complete well under 1s in practice and made e2e + newman both green.

---

## 13. Known Issues / Caveats

- `POST /api/receipts/:id/send` is **PENDING-only** by design this milestone. A follow-up prompt may swap `supported:false → true` once a live delivery adapter (Postmark / Twilio / WhatsApp Business) is wired.
- `GET /api/receipts/:id/history` org/branch context is enforced via `BranchContextGuard` on the controller, but the underlying `AuditLog` rows are filtered by `entityId` only (the receipt id, which is globally unique). Cross-branch leakage is not possible because the receipt id is bound to a single order, and the order itself is org/branch-scoped at fetch time.
- `RECEIPT_VIEWED` is fire-and-forget (the GET handler does not await the audit write) — under heavy concurrent reads a small fraction of view audits could in theory be lost on process crash, but the cost (slower GETs) of awaiting outweighs the benefit. Reprint and send always await their audit writes.

---

## 14. Next Step

**BG4.B — POS Order Handoff Operations** (split-bill / split-items / merge / transfer-table / transfer-server / move-items).

Suggested shape for the next prompt:

- 6 new endpoints under `/api/pos/orders/:id/...` (or a sibling `/api/pos/handoff` controller).
- Likely permissions: `pos:order:split`, `pos:order:merge`, `pos:order:transfer-table`, `pos:order:transfer-server`, `pos:order:move-items`. Cashier + Manager + Owner; waiter optional for transfer-table; chef denied across the board.
- Reuse the BG3 facade with `category: 'POS_WRITE'` (a new category) or fall back to `category: null` if no maintenance gating is desired.
- KOT republish semantics: split / move-items must re-print kitchen tickets for affected stations; merge must reconcile two KOTs without double-firing.
- e2e + Postman + completion report mirror BG4.A.

---
---

# BG4.B — POS Order Handoff (Split / Merge / Transfer / Move-Items) — Completion Report

**Date**: 2026-05-01
**Scope**: BG4.B — POS order handoff operations (split-bill, split-items, merge, transfer-table, transfer-server, move-items).
**Status**: ✅ Complete. BG4 is now fully closed (BG4.A Receipts + BG4.B Handoff both landed).

---

## 1. Context Snapshot

- Last completed milestone before this turn: **BG4.A — Receipts Surface** (same date).
- All locked rules continue to hold — see §11.
- This milestone introduces **one additive migration**: 2 nullable self-FKs on `Order` (`splitFromOrderId`, `mergedIntoOrderId`) plus 2 indexes. No existing column is altered. No model is dropped or renamed.

---

## 2. Summary

Cashiers, managers, and owners can now restructure live POS orders through six new endpoints under `/api/pos/orders/*`:

| Operation | Path |
|---|---|
| Split bill (record-only allocation across N pay-groups) | `POST /api/pos/orders/:id/split-bill` |
| Split items (carve a child order off the parent) | `POST /api/pos/orders/:id/split-items` |
| Merge two open orders into one | `POST /api/pos/orders/merge` |
| Transfer to a different table | `POST /api/pos/orders/:id/transfer-table` |
| Transfer to a different server | `POST /api/pos/orders/:id/transfer-server` |
| Move line items between two open orders | `POST /api/pos/orders/:id/move-items` |

All six wrap through the **existing** `Bg3ReliabilityService.guard` facade with `category: null` (handoff is operational POS, not a billing/accounting/inventory mutation; M42 maintenance windows do not apply) and `idempotencyMode: 'optional'`. `Idempotency-Key` replay returns the same payload byte-for-byte on each surface.

KDS strategy: **PRESERVE-AND-MARK** the source ticket(s); the destination/child order requires an explicit `/send` call before kitchen sees it. This avoids double-firing on split/move and keeps merge reconciliation unambiguous.

Four new permissions are seeded and granted to Owner / Manager / Cashier. **Chef is denied** across all four — both the e2e and Postman suites assert 403.

---

## 3. Files Added / Changed

### Added

- `apps/api/src/modules/pos-handoff/dto/split-bill.dto.ts`
- `apps/api/src/modules/pos-handoff/dto/split-items.dto.ts`
- `apps/api/src/modules/pos-handoff/dto/merge-orders.dto.ts`
- `apps/api/src/modules/pos-handoff/dto/transfer-table.dto.ts`
- `apps/api/src/modules/pos-handoff/dto/transfer-server.dto.ts`
- `apps/api/src/modules/pos-handoff/dto/move-order-items.dto.ts`
- `apps/api/src/modules/pos-handoff/dto/index.ts`
- `apps/api/src/modules/pos-handoff/pos-handoff.service.ts`
- `apps/api/src/modules/pos-handoff/pos-handoff.controller.ts`
- `apps/api/src/modules/pos-handoff/pos-handoff.module.ts`
- `apps/api/src/modules/pos-handoff/index.ts`
- `apps/api/test/bg4b-pos-order-handoff.e2e-spec.ts`
- `packages/db/prisma/migrations/20260501000000_bg4b_pos_order_handoff/migration.sql`
- `postman/collections/BG4B-Pos-Order-Handoff.postman_collection.json`

### Modified

- `apps/api/src/app.module.ts` — registered `PosHandoffModule`.
- `packages/db/prisma/schema.prisma` — added 2 nullable self-FKs on `Order` (`splitFromOrderId`, `mergedIntoOrderId`) + 2 indexes + reverse relations.
- `packages/db/prisma/seed.ts` — added 4 permission entries; granted to Owner/Manager/Cashier in `ROLE_PERM_MATRIX`; appended `recordSeedRun('bg4b-pos-order-handoff', ...)` marker after the BG4.A marker.
- `ai/AI_STATUS.md` — top counters bumped (migrations 49, collections 53; last completed milestone = BG4.B); new BG4.B detail section added.
- `ai/BG4_COMPLETION_REPORT.md` (this section appended).

### Not changed

- BG3 facade — reused as-is, not parallel-implemented.
- M42 maintenance / training service — untouched. New surfaces use `category: null`.
- Public diner payment flow — untouched.
- PesaPal owner-SaaS billing flow — untouched.
- Existing `OrdersController` (`POST /api/pos/orders`, `GET /api/pos/orders/:id`, …) — untouched. The new `PosHandoffController` shares the `pos/orders` prefix; Nest merges them at routing time.

---

## 4. Database

**One additive migration**: `packages/db/prisma/migrations/20260501000000_bg4b_pos_order_handoff/migration.sql`

```sql
ALTER TABLE "Order" ADD COLUMN "splitFromOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "mergedIntoOrderId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_splitFromOrderId_fkey"
    FOREIGN KEY ("splitFromOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_mergedIntoOrderId_fkey"
    FOREIGN KEY ("mergedIntoOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_splitFromOrderId_idx" ON "Order"("splitFromOrderId");
CREATE INDEX "Order_mergedIntoOrderId_idx" ON "Order"("mergedIntoOrderId");
```

Both columns are nullable; existing rows are unaffected. `ON DELETE SET NULL` keeps history navigable even if the parent/target is later voided.

---

## 5. API + Write-Surface Matrix

| Method | Path | Permission | Audit action(s) | BG3 scope | Idempotency | Returns |
|---|---|---|---|---|---|---|
| `POST` | `/api/pos/orders/:id/split-bill` | `pos:order:split` | `ORDER_SPLIT_BILL` | `pos.orders.split-bill` | optional | 200 `{ ok, splitMode, splitGroups, amountAllocated, amountRemaining }` |
| `POST` | `/api/pos/orders/:id/split-items` | `pos:order:split` | `ORDER_SPLIT_ITEMS` + `ORDER_SPLIT_CHILD_CREATED` | `pos.orders.split-items` | optional | 200 `{ ok, parentOrder, childOrder }` (child has `splitFromOrderId` set, status `NEW`) |
| `POST` | `/api/pos/orders/merge` | `pos:order:merge` | `ORDER_MERGED` | `pos.orders.merge` | optional | 200 `{ ok, mergedOrder, sourceOrders[] }` (sources get `mergedIntoOrderId` set, status `VOIDED`) |
| `POST` | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer` | `ORDER_TRANSFERRED_TABLE` | `pos.orders.transfer-table` | optional | 200 `{ ok, order }` |
| `POST` | `/api/pos/orders/:id/transfer-server` | `pos:order:transfer` | `ORDER_TRANSFERRED_SERVER` | `pos.orders.transfer-server` | optional | 200 `{ ok, order }` |
| `POST` | `/api/pos/orders/:id/move-items` | `pos:order:move-items` | `ORDER_ITEMS_MOVED` | `pos.orders.move-items` | optional | 200 `{ ok, sourceOrder, targetOrder }` |

`category: null` is intentional on all six surfaces — handoff is operational POS, not a billing / accounting / inventory mutation, so no M42 maintenance window category applies. The facade still supplies `Idempotency-Key` reuse, training-mode short-circuit, and structured 409 reshaping.

All six routes assert the order is in a handoff-eligible status (`NEW | SENT | IN_KITCHEN | READY | SERVED`). `CLOSED` / `VOIDED` orders return 409. Cross-branch / cross-org access returns 404.

The static `/merge` route is registered **before** any `:id`-based route in the controller so Nest treats `merge` as a literal segment, not as an order id.

---

## 6. Permissions

Four new permissions seeded into `packages/db/prisma/seed.ts`:

| Permission | Owner | Manager | Cashier | Waiter | Chef | Bartender | Stock Mgr |
|---|---|---|---|---|---|---|---|
| `pos:order:split` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `pos:order:merge` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `pos:order:transfer` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `pos:order:move-items` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Chef-denied is verified by both the e2e and Postman suites (4 × 403 each). The seed marker `bg4b-pos-order-handoff` is recorded in `SeedRun` after grants succeed.

---

## 7. Tests

### e2e — `apps/api/test/bg4b-pos-order-handoff.e2e-spec.ts`

**15 / 15 passing** (~178s). Boots `AppModule`, logs in `owner@demo.local` and `chef@demo.local`, builds context via `/api/auth/me`, creates synthetic open `Order` + `OrderItem` rows directly via Prisma in fixtures, cleans up in `afterAll`.

| Section | Test count | Status |
|---|---|---|
| split-bill (proportional, custom, equal) | 4 | ✅ |
| split-items (happy path + idempotency replay) | 2 | ✅ |
| merge | 2 | ✅ |
| transfer-table | 2 | ✅ |
| transfer-server | 2 | ✅ |
| move-items | 2 | ✅ |
| chef forbidden across all 4 perms | 1 (multi-assert) | ✅ |

Note: three `prisma.$transaction(...)` calls in `pos-handoff.service.ts` were bumped to `{ timeout: 20000, maxWait: 10000 }` to keep e2e green against Neon under back-to-back fixture/action churn.

### TypeScript

`pnpm exec tsc --noEmit` from `apps/api` — clean for all BG4.B files. Only the four pre-existing `accounts-receivable.service.spec.ts` diagnostics remain (out-of-scope, predates BG2/BG3, untouched by BG4).

---

## 8. Postman

`postman/collections/BG4B-Pos-Order-Handoff.postman_collection.json` — newman: **37 requests, 48 / 48 assertions, 0 failures** (~2m 55s).

Folders:

- `00 Read Me` — variables, run order, locked rules.
- `A. Auth & Context Baseline` — login owner, `/api/auth/me`, login chef + alt cashier; resolve `menuItemId` (via `/api/menu/catalog`), `tableId` (via `/api/tables`), `altUserId`.
- `B. Split Bill` — proportional / custom / equal happy paths + 400.
- `C. Split Items` — fixture create order + fixture add item + `POST /:id/split-items` (200) + idempotency replay (same `childOrder.id`).
- `D. Merge` — fixture two source orders + `POST /merge` (200).
- `E. Transfer Table` — fixture create order + `POST /:id/transfer-table` (200) + invalid-table (404).
- `F. Transfer Server` — fixture create order + `POST /:id/transfer-server` (200) + invalid-user (403).
- `G. Move Items` — fixture create source + add item + create target + `POST /:id/move-items` (200).
- `H. Permission Denial — Chef` — chef → 403 on split-bill / merge / transfer-table / move-items.
- `I. Edge Cases / Conflicts` — split-bill on unknown order id → 404, merge missing required field → 400.

Pre-request script mirrors the BG3 canonical pattern (R3 / R4 / R5 / R12 / R14 / R16 from `ai/AI_POSTMAN_WORKING_PATTERNS.md`): dual-scope `getVar` / `setVar`, `[200, 201]` login, `/api/auth/me` canonical context resolver, owner + chef + alt-cashier token chaining, auto-resolved `menuItemId` / `tableId` / `altUserId`. Folder C and G use **separate sequential request items** for fixture order creation and add-item rather than chained `pm.sendRequest` inside test scripts (Newman does not reliably await Promises returned from test scripts).

---

## 9. Docs

- `ai/AI_STATUS.md` — BG4.B entry added; top counters bumped (migrations 49, collections 53); next milestone now reads BG5.
- This file (BG4.B section appended).

---

## 10. DONE Checks

- [x] BG3 idempotency facade reused (not parallelised).
- [x] Schema change is additive only (2 nullable self-FKs + 2 indexes); no destructive ALTER.
- [x] `/api/auth/me` remains canonical.
- [x] PIN-first frontline rules intact.
- [x] PesaPal still owner-SaaS-only; public diner payments still pending the MTN/Airtel work.
- [x] Chef denied across all four new permissions; e2e + newman both assert 403.
- [x] Static `/merge` route registered before any `:id`-based route.
- [x] KDS strategy: PRESERVE-AND-MARK source tickets; destination requires explicit `/send`.
- [x] `Idempotency-Key` replay on split-items returns the same `childOrder.id` byte-for-byte.
- [x] Seed marker `bg4b-pos-order-handoff` recorded.
- [x] e2e 15 / 15 passing.
- [x] newman 48 / 48 assertions passing.
- [x] `tsc --noEmit` clean for BG4.B files.
- [x] No hotel structures introduced.

---

## 11. Locked Rules — Re-verified

| Rule | Status |
|---|---|
| `/api/auth/me` is the canonical context route. | ✅ Preserved. |
| `POST /api/auth/login` accepts `[200, 201]`. | ✅ Postman pre-request asserts `[200,201].includes(code)`. |
| Public diner payments are SCAFFOLD ONLY pending MTN/Airtel. | ✅ Out of scope. |
| PesaPal is reserved for owner-SaaS subscription billing only. | ✅ Out of scope. |
| BG3 facade must not be parallel-implemented. | ✅ All six new surfaces wrap through `Bg3ReliabilityService.guard`. |
| BG3 idempotency-key contracts preserved (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, `IDEMPOTENCY_KEY_INVALID`, optional mode by default). | ✅ Reuses the facade as-is. |
| M42 service-layer maintenance check on `inventory.adjustments` returns 409 `MAINTENANCE_WINDOW_ACTIVE`. | ✅ Untouched. BG4.B uses `category: null`. |
| No new hotel / property-group concept. | ✅ Confirmed. |
| Chef remains denied for new managerial permissions. | ✅ All 4 new perms; verified by e2e + newman. |

---

## 12. Decisions / Deviations

- **Additive self-FK schema** (`splitFromOrderId`, `mergedIntoOrderId`) chosen over a separate `OrderHandoffEvent` table because lineage queries (e.g. "show me the parent of this child order") are an order-graph traversal, not a generic event-log scan. Two nullable columns + two indexes is the cheapest representation. `ON DELETE SET NULL` keeps history navigable.
- **`category: null` on the BG3 facade** for all six surfaces. Handoff is operational POS, not a billing / accounting / inventory mutation, so no M42 maintenance category applies. Facade still supplies `Idempotency-Key` reuse and training-mode short-circuit.
- **Static `/merge` registered before `:id` routes** in the controller so Nest treats `merge` as a literal segment, not as an order id parameter.
- **PRESERVE-AND-MARK KDS strategy** (rather than auto-republish) — split/move-items mark source tickets as transferred rather than re-firing them; the destination/child requires an explicit `/send` call before the kitchen sees it. This keeps merge reconciliation unambiguous and avoids double-firing.
- **Permission-prefix `pos:order:*`** matches the existing `pos:` prefix convention. `transfer-table` and `transfer-server` share the single `pos:order:transfer` permission (one role decision; no operational benefit to splitting them).
- **Three `$transaction` calls bumped to `{ timeout: 20000, maxWait: 10000 }`** in `pos-handoff.service.ts` (split-items, merge, move-items) to handle Neon-induced timeouts under back-to-back e2e fixture+action churn. Same pattern used elsewhere in the codebase for multi-write transactions on Neon.
- **Postman fixture restructure (folders C and G)** — initial implementation chained `pm.sendRequest` inside test scripts to seed an order item before the action request, but Newman does not reliably await Promises returned from test scripts (the action request fires before the item exists, returning 400 on `orderItemId` validation). Replaced with **separate sequential Postman request items** (`Fixture: create order` → `Fixture: add item` → action). This is the same pattern used elsewhere in BG3 collections.
- **Postman `menuItemId` resolver** — uses `GET /api/menu/catalog` (returns `{categories:[{items:[...]}]}`); `GET /api/menu/items?pageSize=1` returns 400 because the underlying `ListMenuQueryDto` does not accept `pageSize`.

---

## 13. Known Issues / Caveats

- Neon-induced `$transaction` slowness under e2e remains the dominant cost (~178s for 15 tests). Acceptable; same pattern as BG3.
- KDS auto-republish for split/move is **intentionally not implemented** — destination requires an explicit `/send` call. A follow-up could add an opt-in `republishKds: true` flag on the handoff DTOs.
- `splitFromOrderId` / `mergedIntoOrderId` graph traversal (e.g. "show me the full split tree of this order") is not exposed via API this milestone. Frontend can join client-side using existing `GET /api/pos/orders/:id`.

---

## 14. Next Step

BG4 is fully closed. Resume the ROADMAP from the next non-BG slot (or pick up the next BG milestone if one is queued). Public diner mobile-money integration (M13.2 Airtel Native) and a live receipt delivery adapter (BG4.A follow-up) remain the two largest open scopes.

