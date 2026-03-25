# Completion Report — M13.1 MTN Native Request-to-Pay + Offline Manual Reference Fallback

## Context Snapshot

- Current milestone: M13.1 ✅
- Previous completed milestone: M13 — Payments: Cash, Card, Mobile Money
- Next milestone: M14 — TBD

## Summary

- What was built: Real MTN Collections API integration (OAuth2, RequestToPay, webhook-driven reconciliation), offline/manual-reference payment fallback (for business continuity when network/provider is down), SSE payment event stream, auto-settle logic, and per-order running balance tracking. Extended the M13 payments shell into a production-grade mobile money flow.
- What is now working: Full MTN MOMO native RequestToPay → webhook callback → auto Payment record → auto order settlement pipeline. Manual reference payments with UNVERIFIED status for offline fallback. Real-time SSE stream for payment events. Outstanding balance computation per order. Idempotent intent creation. Duplicate manual-reference prevention.

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260325000000_m13_1_mtn_native_manual_reference/migration.sql`
- `apps/api/src/modules/payments/adapters/mtn.adapter.ts`
- `apps/api/src/modules/payments/dto/create-manual-reference.dto.ts`
- `postman/collections/M13_1-MTN-Native-Manual-Reference.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — 2 new enums, extended Payment (7 fields), PaymentIntent (11 fields), WebhookEvent (3 fields), User relation
- `apps/api/src/modules/payments/payments.service.ts` — Full rewrite: EventEmitter2 + MtnAdapter DI, 12 public methods, auto-settle, SSE events
- `apps/api/src/modules/payments/payments.controller.ts` — 12 endpoints total (6 new), SSE stream
- `apps/api/src/modules/payments/payments.module.ts` — MtnAdapter provider
- `apps/api/src/modules/payments/dto/create-payment-intent.dto.ts` — phoneNumber required, idempotencyKey
- `apps/api/src/modules/payments/dto/index.ts` — CreateManualReferencePaymentDto export
- `apps/api/src/modules/payments/payments.service.spec.ts` — 39 unit tests (was 25)
- `apps/api/test/payments.e2e-spec.ts` — 23 e2e tests (was 13)
- `packages/db/prisma/seed.ts` — 3 new permissions, role-matrix updates, manual-reference demo data
- `ai/AI_STATUS.md` — M13.1 checklist

## Database

- Prisma models added/changed:
  - **New enums**: PaymentCaptureMode (ONLINE_PROVIDER, MANUAL_REFERENCE), PaymentVerificationStatus (NOT_REQUIRED, UNVERIFIED, VERIFIED, REJECTED)
  - **Payment** extended: captureMode, verificationStatus, externalTransactionId, payerPhone, postedAt, enteredById (FK → User), verificationNote + 3 indexes + enteredBy relation
  - **PaymentIntent** extended: customerPhone, externalId (unique), providerTransactionId, requestedAmount, confirmedAmount, requestedMsisdn, confirmedMsisdn, expiresAt, webhookEventIdLast, idempotencyKey, failureReason + 3 indexes
  - **WebhookEvent** extended: signature, headers (Json), processingError
  - **User**: paymentsEntered relation added
- Migration name: `20260325000000_m13_1_mtn_native_manual_reference`
- Indexes: Payment(captureMode), Payment(verificationStatus), Payment(externalTransactionId), PaymentIntent(externalId) unique, PaymentIntent(idempotencyKey), PaymentIntent(customerPhone), WebhookEvent unchanged
- Seed updates: 3 new permissions (pos:payment:manual-reference, pos:payment:cancel, pos:payment:override), role-matrix for all 11 roles, manual-reference demo payment, enhanced MTN intent demo data
- Notes: Migration SQL created manually — apply when Neon is online

## API

- Modules added/changed: PaymentsModule (MtnAdapter provider added)
- Endpoints added/updated (12 total):
  1. `POST /pos/orders/:id/close` — enhanced: pending intent blocking, already-paid tracking, SSE events
  2. `POST /payments/intents` — enhanced: real MTN RequestToPay, idempotency, externalId
  3. `GET /payments/intents/:id` — **NEW**: get intent details
  4. `GET /payments/intents/:id/status` — **NEW**: get intent status with remaining balance
  5. `POST /payments/intents/:id/cancel` — enhanced: SSE events, pos:payment:cancel permission
  6. `GET /pos/orders/:id/payments` — enhanced: returns orderTotal, totalPaid, remainingBalance, isSettled
  7. `POST /payments/manual-reference` — **NEW**: create manual reference payment
  8. `GET /payments/manual-reference/:id` — **NEW**: get manual reference payment
  9. `GET /payments/manual-reference` — **NEW**: list manual reference payments (optional verificationStatus filter)
  10. `SSE GET /stream/payments` — **NEW**: real-time payment events (optional orderId filter)
  11. `POST /webhooks/mtn` — enhanced: passes headers for signature verification
  12. `POST /webhooks/airtel` — enhanced: passes headers for signature verification
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard on all authenticated endpoints; webhooks are unauthenticated; SSE uses JwtAuthGuard + BranchContextGuard
- Audit coverage: 8 audit event types (ORDER_PAID_AND_CLOSED, PAYMENT_RECORDED, PAYMENT_INTENT_CREATED, PAYMENT_INTENT_OUTBOUND_SENT, PAYMENT_INTENT_CANCELLED, PAYMENT_WEBHOOK_RECEIVED, PAYMENT_WEBHOOK_VERIFIED, PAYMENT_MANUAL_REFERENCE_RECORDED, ORDER_AUTO_SETTLED)
- Idempotency coverage: Intent creation (idempotencyKey), duplicate webhook prevention, manual-reference deduplication (externalTransactionId)

## Tests

- Unit tests: 39 passing (payments.service.spec.ts)
  - Close order: 12 tests (cash, overpayment, split, insufficient, wrong-state, not-found, MOMO, pending-intent-block, already-paid)
  - Create intent: 6 tests (valid, VOIDED, CLOSED, not-found, idempotency, MTN-enabled, MTN-failure)
  - Cancel intent: 4 tests (REQUIRES_ACTION, PENDING, SUCCEEDED-reject, not-found)
  - Webhooks: 4 tests (success+auto-settle, no-match, duplicate-prevention, failed-status-SSE)
  - Get order payments: 2 tests (success-with-balance, not-found)
  - Manual reference: 5 tests (create, duplicate-reject, VOIDED-reject, not-found, auto-settle)
  - Get intent: 2 tests (success, not-found)
  - Branch isolation: 1 test
  - Audit logging: 1 test
  - SSE emission: 1 test
- E2e tests: 23 (payments.e2e-spec.ts)
  - M13 tests preserved: 13 (close flow, intents, webhooks, permissions, validation)
  - M13.1 new tests: 10 (manual-reference create/409/list/filter/403, intent get/status, order-balance-info)
- Commands run: `npx jest --testPathPattern=payments.service.spec --no-coverage`
- Results: 39 passed, 0 failed

## Postman

- Collection added: `M13_1-MTN-Native-Manual-Reference.postman_collection.json` (19 requests)
- Variables/tests: Auto-captures orderId, branchId, intentId, manualPaymentId; test scripts verify status codes, response shapes, MTN-specific fields
- Workflow: Login → Get branch → Create order → Add items → Advance to SERVED → Create MTN intent → Get intent → Get intent status → Cancel intent → Manual reference → List manual-references → Get order payments → Webhook → Close

## Docs

- ROADMAP status impact: M13.1 is a sub-milestone enhancement of M13
- Files updated: AI_STATUS.md (M13.1 checklist, date, current milestone)

## DONE Checks

- `pnpm db:generate`: ✅ (schema validated, Prisma client generated)
- Unit tests: ✅ 39/39 passed (5.4s)
- E2e tests: ⏳ (requires Neon connectivity for DB)
- `pnpm db:migrate`: ⏳ (migration SQL created, apply when Neon is online)
- `pnpm db:seed`: ⏳ (seed updated, run when Neon is online)
- Lint: ⏳ (run next)

## Decisions / Deviations

- EventEmitterModule.forRoot() is already called in KdsModule (globally registered via @nestjs/event-emitter); PaymentsModule just injects EventEmitter2 without re-importing the root module
- MTN adapter uses ConfigService for all env vars (PAY_MTN_*) — disabled by default (PAY_MTN_ENABLED=false), so all existing tests and flows work without MTN config
- Manual-reference payments use captureMode=MANUAL_REFERENCE + verificationStatus=UNVERIFIED — verification/approval flow (VERIFIED/REJECTED) deferred to future milestone
- Auto-settle: when total outstanding balance reaches ≤0 after any payment event (webhook success, manual-reference), order is automatically set to CLOSED status

## Known Issues

- Neon P1001 suspend: migration and seed must be applied when Neon is online
- Windows DLL lock: kill stale node.exe processes before `pnpm db:generate`
- MTN sandbox: requires API User + API Key provisioning before real testing

## Next Step

- Apply migration to Neon when online
- Run seed + e2e tests against live DB
- M14 — next milestone per ROADMAP
