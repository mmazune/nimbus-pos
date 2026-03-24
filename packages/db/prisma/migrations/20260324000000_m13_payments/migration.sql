-- M13: Payments — Cash, Card, Mobile Money
-- CreateEnum: PaymentMethod, PaymentStatus, PaymentIntentStatus
-- CreateTable: payments, payment_intents, webhook_events

-- Enums
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOMO', 'BANK_TRANSFER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- Payment table
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- PaymentIntent table
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- WebhookEvent table
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- Indexes: payments
CREATE INDEX "payments_org_id_idx" ON "payments"("org_id");
CREATE INDEX "payments_branch_id_idx" ON "payments"("branch_id");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX "payments_method_idx" ON "payments"("method");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");
CREATE INDEX "payments_transaction_id_idx" ON "payments"("transaction_id");

-- Indexes: payment_intents
CREATE INDEX "payment_intents_org_id_idx" ON "payment_intents"("org_id");
CREATE INDEX "payment_intents_branch_id_idx" ON "payment_intents"("branch_id");
CREATE INDEX "payment_intents_order_id_idx" ON "payment_intents"("order_id");
CREATE INDEX "payment_intents_provider_idx" ON "payment_intents"("provider");
CREATE INDEX "payment_intents_provider_ref_idx" ON "payment_intents"("provider_ref");
CREATE INDEX "payment_intents_status_idx" ON "payment_intents"("status");
CREATE INDEX "payment_intents_created_at_idx" ON "payment_intents"("created_at");

-- Indexes: webhook_events
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at");

-- Foreign keys: payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: payment_intents
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
