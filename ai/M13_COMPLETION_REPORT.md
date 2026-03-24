# M13 Completion Report — Payments: Cash, Card, Mobile Money

## Milestone Summary

M13 adds payment capture for closing POS orders. Supports four payment methods (CASH, CARD, MOMO, BANK_TRANSFER), split payments across methods, Mobile Money async intent lifecycle with webhook-driven status updates, and persistence-first webhook processing.

## Deliverables

### Schema & Migration

- **3 new enums**: `PaymentMethod` (CASH/CARD/MOMO/BANK_TRANSFER), `PaymentStatus` (PENDING/COMPLETED/FAILED/REFUNDED), `PaymentIntentStatus` (PENDING/REQUIRES_ACTION/SUCCEEDED/FAILED/CANCELLED)
- **3 new models**: `Payment` (12 fields, 7 indexes), `PaymentIntent` (13 fields, 7 indexes), `WebhookEvent` (9 fields, 3 indexes)
- Relations added on `Organization`, `Branch`, and `Order`
- Migration: `packages/db/prisma/migrations/20260324000000_m13_payments/migration.sql`
- `pnpm db:generate` passes ✅

### Module Implementation

| File | Purpose |
|------|---------|
| `payments.service.ts` | Core business logic: close order, intents, webhooks |
| `payments.controller.ts` | 6 endpoints (thin delegation) |
| `payments.module.ts` | NestJS module registration |
| `dto/close-order.dto.ts` | Close order with payment array validation |
| `dto/create-payment-intent.dto.ts` | MOMO intent creation validation |
| `dto/cancel-payment-intent.dto.ts` | Intent cancellation validation |
| `dto/index.ts` | Barrel export |

### Endpoints

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| POST | `/api/pos/orders/:id/close` | Yes | `pos:orders:close` | Close order with payment(s) |
| POST | `/api/payments/intents` | Yes | `pos:payment:intent` | Create MOMO payment intent |
| POST | `/api/payments/intents/:id/cancel` | Yes | `pos:payment:intent` | Cancel pending MOMO intent |
| GET | `/api/pos/orders/:id/payments` | Yes | `pos:payment:read` | Get payments + intents for order |
| POST | `/api/webhooks/mtn` | No | — | MTN Mobile Money webhook |
| POST | `/api/webhooks/airtel` | No | — | Airtel Money webhook |

### Business Logic

- **Close order**: Validates SERVED state, payment totals ≥ order total, cash overpayment with changeDue, non-cash overpayment blocked, MOMO requires succeeded intent. All records created in single Prisma transaction.
- **Split payments**: Multiple payment methods per order (e.g., part cash + part card).
- **MOMO intent lifecycle**: Create (REQUIRES_ACTION) → webhook (SUCCEEDED/FAILED) → cancel (CANCELLED). Only PENDING/REQUIRES_ACTION intents cancellable.
- **Webhook processing**: Persistence-first — raw payload saved before any processing. Provider ref resolution supports multiple field name patterns. Duplicate payment prevention. Intent status normalized from provider-specific statuses.

### Permissions

| Permission | Purpose | Roles |
|------------|---------|-------|
| `pos:payment:create` | Create payment records | Owner, Manager, Supervisor, Cashier, Waiter |
| `pos:payment:close` | Close orders with payment | Owner, Manager, Supervisor, Cashier |
| `pos:payment:intent` | Create/cancel MOMO intents | Owner, Manager, Supervisor, Cashier |
| `pos:payment:read` | Read payment/intent records | All roles |

### Audit Events

| Action | Trigger |
|--------|---------|
| `ORDER_PAID_AND_CLOSED` | Order closed with payment(s) |
| `PAYMENT_RECORDED` | Individual payment record created |
| `PAYMENT_INTENT_CREATED` | MOMO payment intent created |
| `PAYMENT_INTENT_CANCELLED` | MOMO payment intent cancelled |
| `PAYMENT_WEBHOOK_RECEIVED` | Webhook received from provider |

### Seed Data

- 4 permissions in `PERMISSIONS_DATA` array
- Role-permission matrix updated for all 11 roles
- Demo data: 2 payments (CASH split + CARD), 1 MOMO intent (MTN/SUCCEEDED) on ORD-000004

### Tests

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| Unit | `payments.service.spec.ts` | 25 | ✅ All pass |
| E2E | `payments.e2e-spec.ts` | 13 | ✅ Created |
| **Total across repo** | 16 suites | **235** | ✅ All pass |

### Postman

- Collection: `M13-Payments-Cash-Card-MOMO.postman_collection.json` (16 requests)
- Workflow: Login → branch → menu items → create order → add items → advance to SERVED → create intent → cancel intent → close order → get payments → webhooks

### Docs Updated

- `ARCHITECTURE.md` — M13 Payments Architecture section
- `API_CONVENTIONS.md` — M13 Payment Endpoints table
- `MODULES.md` — Payments row marked ✅ Implemented at M13
- `AI_STATUS.md` — M13 checklist, current milestone updated

## DONE Checks

| Check | Result |
|-------|--------|
| `pnpm db:generate` | ✅ Pass |
| `pnpm lint` | ✅ 0 new errors (2 pre-existing from M11/M12) |
| `pnpm jest` | ✅ 235 tests, 16 suites, all pass |
| E2E tests created | ✅ 13 tests in payments.e2e-spec.ts |
| Migration SQL | ✅ Created (apply when Neon online) |
| Seed idempotent | ✅ Follows existing pattern |

## Files Changed/Created

### Created
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/payments/payments.module.ts`
- `apps/api/src/modules/payments/dto/close-order.dto.ts`
- `apps/api/src/modules/payments/dto/create-payment-intent.dto.ts`
- `apps/api/src/modules/payments/dto/cancel-payment-intent.dto.ts`
- `apps/api/src/modules/payments/dto/index.ts`
- `apps/api/src/modules/payments/payments.service.spec.ts`
- `apps/api/test/payments.e2e-spec.ts`
- `packages/db/prisma/migrations/20260324000000_m13_payments/migration.sql`
- `postman/collections/M13-Payments-Cash-Card-MOMO.postman_collection.json`
- `ai/M13_COMPLETION_REPORT.md`

### Modified
- `packages/db/prisma/schema.prisma` — Added 3 enums, 3 models, relations
- `packages/db/prisma/seed.ts` — 4 permissions, role matrix, seedPayments(), main() runner
- `apps/api/src/app.module.ts` — PaymentsModule import
- `apps/api/src/modules/orders/orders.controller.ts` — Old close endpoint removed
- `docs/ARCHITECTURE.md` — M13 section
- `docs/API_CONVENTIONS.md` — M13 endpoints table
- `docs/MODULES.md` — Payments row updated
- `ai/AI_STATUS.md` — M13 checklist, current milestone

## What M13 Does NOT Include

- **Refunds** — Deferred to M14+
- **Stock deduction on payment** — Not yet integrated with M9 inventory
- **Real MOMO API integration** — Intent lifecycle is modeled but calls to MTN/Airtel APIs are stubbed (webhook-driven in production)
- **Payment receipt generation** — Deferred to later milestone
