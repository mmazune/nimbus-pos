-- M13.1: MTN Native Request-to-Pay + Offline Manual Reference Fallback
-- Adds PaymentCaptureMode, PaymentVerificationStatus enums
-- Extends Payment, PaymentIntent, WebhookEvent models

-- New enums
CREATE TYPE "PaymentCaptureMode" AS ENUM ('ONLINE_PROVIDER', 'MANUAL_REFERENCE');
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('NOT_REQUIRED', 'UNVERIFIED', 'VERIFIED', 'REJECTED');

-- Payment: add new columns
ALTER TABLE "payments" ADD COLUMN "capture_mode" "PaymentCaptureMode" NOT NULL DEFAULT 'ONLINE_PROVIDER';
ALTER TABLE "payments" ADD COLUMN "verification_status" "PaymentVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "payments" ADD COLUMN "external_transaction_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "payer_phone" TEXT;
ALTER TABLE "payments" ADD COLUMN "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN "entered_by_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "verification_note" TEXT;

-- Payment: new indexes
CREATE INDEX "payments_capture_mode_idx" ON "payments"("capture_mode");
CREATE INDEX "payments_verification_status_idx" ON "payments"("verification_status");
CREATE INDEX "payments_external_transaction_id_idx" ON "payments"("external_transaction_id");

-- Payment: FK for enteredById
ALTER TABLE "payments" ADD CONSTRAINT "payments_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PaymentIntent: add new columns
ALTER TABLE "payment_intents" ADD COLUMN "customer_phone" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "external_id" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "provider_transaction_id" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "requested_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_intents" ADD COLUMN "confirmed_amount" DECIMAL(12,2);
ALTER TABLE "payment_intents" ADD COLUMN "requested_msisdn" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "confirmed_msisdn" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "payment_intents" ADD COLUMN "webhook_event_id_last" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "failure_reason" TEXT;

-- PaymentIntent: unique on externalId and new indexes
CREATE UNIQUE INDEX "payment_intents_external_id_key" ON "payment_intents"("external_id");
CREATE INDEX "payment_intents_provider_transaction_id_idx" ON "payment_intents"("provider_transaction_id");
CREATE INDEX "payment_intents_idempotency_key_idx" ON "payment_intents"("idempotency_key");

-- WebhookEvent: add new columns
ALTER TABLE "webhook_events" ADD COLUMN "signature" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN "headers" JSONB;
ALTER TABLE "webhook_events" ADD COLUMN "processing_error" TEXT;
