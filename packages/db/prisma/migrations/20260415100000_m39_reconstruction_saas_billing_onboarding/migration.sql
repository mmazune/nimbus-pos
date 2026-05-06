-- M39 Reconstruction: SaaS Billing + Onboarding + Merchant Payments + Public Commerce + Ops Portal
-- Migration #43

-- Add PENDING_PAYMENT to SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT' BEFORE 'TRIAL';

-- New enums
CREATE TYPE "PesapalTxnStatus" AS ENUM ('INITIATED', 'REDIRECTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'INVALID');
CREATE TYPE "OnboardingStepStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
CREATE TYPE "MerchantPaymentConfigStatus" AS ENUM ('PENDING', 'CONNECTED', 'FAILED', 'DISABLED');
CREATE TYPE "PublicProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');
CREATE TYPE "PublicEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "ReservationHoldStatus" AS ENUM ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "EventBookingHoldStatus" AS ENUM ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PendingPaymentType" AS ENUM ('RESERVATION', 'EVENT_BOOKING');
CREATE TYPE "PendingPaymentStatus" AS ENUM ('PENDING', 'NOT_ENABLED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- PesaPal SaaS Transactions
CREATE TABLE "pesapal_transactions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "order_tracking_id" TEXT NOT NULL,
    "merchant_reference" TEXT NOT NULL,
    "pesapal_txn_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" "PesapalTxnStatus" NOT NULL DEFAULT 'INITIATED',
    "callback_url" TEXT,
    "ipn_id" TEXT,
    "redirect_url" TEXT,
    "payment_method" TEXT,
    "payment_account" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pesapal_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pesapal_transactions_order_tracking_id_key" ON "pesapal_transactions"("order_tracking_id");
CREATE INDEX "pesapal_transactions_org_id_idx" ON "pesapal_transactions"("org_id");
CREATE INDEX "pesapal_transactions_status_idx" ON "pesapal_transactions"("status");
CREATE INDEX "pesapal_transactions_pesapal_txn_id_idx" ON "pesapal_transactions"("pesapal_txn_id");
CREATE INDEX "pesapal_transactions_org_id_status_idx" ON "pesapal_transactions"("org_id", "status");

ALTER TABLE "pesapal_transactions" ADD CONSTRAINT "pesapal_transactions_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PesaPal IPN Logs
CREATE TABLE "pesapal_ipn_logs" (
    "id" TEXT NOT NULL,
    "order_tracking_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "pesapal_txn_id" TEXT,
    "payment_status_code" TEXT,
    "raw_payload" JSONB,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pesapal_ipn_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pesapal_ipn_logs_order_tracking_id_idx" ON "pesapal_ipn_logs"("order_tracking_id");
CREATE INDEX "pesapal_ipn_logs_pesapal_txn_id_idx" ON "pesapal_ipn_logs"("pesapal_txn_id");

-- Onboarding Progress
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "account_created" "OnboardingStepStatus" NOT NULL DEFAULT 'COMPLETED',
    "subscription_paid" "OnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "organization_created" "OnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "first_branch_created" "OnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "business_profile_done" "OnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "core_settings_done" "OnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "team_invited" "OnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_progress_org_id_key" ON "onboarding_progress"("org_id");

ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Merchant Payment Config
CREATE TABLE "merchant_payment_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'pesapal',
    "status" "MerchantPaymentConfigStatus" NOT NULL DEFAULT 'PENDING',
    "config_data" JSONB,
    "connected_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "merchant_payment_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_payment_configs_org_id_key" ON "merchant_payment_configs"("org_id");

ALTER TABLE "merchant_payment_configs" ADD CONSTRAINT "merchant_payment_configs_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Public Profiles
CREATE TABLE "public_profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "cuisine_type" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "opening_hours" JSONB,
    "status" "PublicProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "public_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_profiles_slug_key" ON "public_profiles"("slug");
CREATE UNIQUE INDEX "public_profiles_org_id_branch_id_key" ON "public_profiles"("org_id", "branch_id");
CREATE INDEX "public_profiles_org_id_idx" ON "public_profiles"("org_id");
CREATE INDEX "public_profiles_branch_id_idx" ON "public_profiles"("branch_id");
CREATE INDEX "public_profiles_status_idx" ON "public_profiles"("status");

ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Public Events
CREATE TABLE "public_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "price_amount" DECIMAL(10,2),
    "price_currency" TEXT NOT NULL DEFAULT 'USD',
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "status" "PublicEventStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "image_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "public_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_events_slug_key" ON "public_events"("slug");
CREATE INDEX "public_events_org_id_idx" ON "public_events"("org_id");
CREATE INDEX "public_events_branch_id_idx" ON "public_events"("branch_id");
CREATE INDEX "public_events_status_idx" ON "public_events"("status");
CREATE INDEX "public_events_starts_at_idx" ON "public_events"("starts_at");

ALTER TABLE "public_events" ADD CONSTRAINT "public_events_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_events" ADD CONSTRAINT "public_events_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reservation Holds
CREATE TABLE "reservation_holds" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_email" TEXT,
    "guest_phone" TEXT,
    "party_size" INTEGER NOT NULL,
    "requested_date" TIMESTAMP(3) NOT NULL,
    "requested_time" TEXT NOT NULL,
    "status" "ReservationHoldStatus" NOT NULL DEFAULT 'HELD',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reservation_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reservation_holds_org_id_idx" ON "reservation_holds"("org_id");
CREATE INDEX "reservation_holds_branch_id_idx" ON "reservation_holds"("branch_id");
CREATE INDEX "reservation_holds_status_idx" ON "reservation_holds"("status");
CREATE INDEX "reservation_holds_org_id_branch_id_requested_date_idx" ON "reservation_holds"("org_id", "branch_id", "requested_date");

ALTER TABLE "reservation_holds" ADD CONSTRAINT "reservation_holds_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_holds" ADD CONSTRAINT "reservation_holds_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Event Booking Holds
CREATE TABLE "event_booking_holds" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "public_event_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_email" TEXT,
    "guest_phone" TEXT,
    "ticket_count" INTEGER NOT NULL DEFAULT 1,
    "status" "EventBookingHoldStatus" NOT NULL DEFAULT 'HELD',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_booking_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_booking_holds_org_id_idx" ON "event_booking_holds"("org_id");
CREATE INDEX "event_booking_holds_branch_id_idx" ON "event_booking_holds"("branch_id");
CREATE INDEX "event_booking_holds_public_event_id_idx" ON "event_booking_holds"("public_event_id");
CREATE INDEX "event_booking_holds_status_idx" ON "event_booking_holds"("status");

ALTER TABLE "event_booking_holds" ADD CONSTRAINT "event_booking_holds_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_booking_holds" ADD CONSTRAINT "event_booking_holds_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_booking_holds" ADD CONSTRAINT "event_booking_holds_public_event_id_fkey"
    FOREIGN KEY ("public_event_id") REFERENCES "public_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pending Payment Intents (scaffolded — public commerce payments not yet operational)
CREATE TABLE "pending_payment_intents" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "payment_type" "PendingPaymentType" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PendingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pending_payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_payment_intents_org_id_idx" ON "pending_payment_intents"("org_id");
CREATE INDEX "pending_payment_intents_payment_type_idx" ON "pending_payment_intents"("payment_type");
CREATE INDEX "pending_payment_intents_status_idx" ON "pending_payment_intents"("status");
CREATE INDEX "pending_payment_intents_reference_id_idx" ON "pending_payment_intents"("reference_id");

ALTER TABLE "pending_payment_intents" ADD CONSTRAINT "pending_payment_intents_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
