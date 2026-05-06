-- M40: Alerts + Digests + Real-Time Owner Views
-- Migration #44

-- ── New enums ──
CREATE TYPE "AlertRuleType" AS ENUM (
    'LOW_STOCK',
    'CASH_VARIANCE',
    'BOOKING_REMINDER',
    'BILLING_PAYMENT_FAILURE',
    'OVERDUE_VENDOR_BILL',
    'UPCOMING_EVENT_STOCK_RISK',
    'SHIFT_NOT_CLOSED',
    'LARGE_WASTAGE_SPIKE',
    'FAILED_WEBHOOK_DELIVERY',
    'FRANCHISE_BRANCH_AT_RISK'
);

CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TYPE "AlertRuleStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "AlertChannelType" AS ENUM ('EMAIL', 'SMS', 'SLACK');

CREATE TYPE "AlertChannelStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "AlertDeliveryStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED',
    'RETRY_SCHEDULED',
    'RETRY_EXHAUSTED',
    'NON_RETRYABLE',
    'SKIPPED'
);

CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'WEEKLY');

CREATE TYPE "DigestScheduleStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "OwnerLiveEventType" AS ENUM (
    'LOW_STOCK',
    'CASH_VARIANCE',
    'BOOKING_REMINDER',
    'BILLING_PAYMENT_FAILURE',
    'WASTAGE_SPIKE',
    'SHIFT_OPEN_LATE',
    'FRANCHISE_BRANCH_RISK',
    'INFO'
);

-- ── AlertRule ──
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AlertRuleType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_module" TEXT NOT NULL,
    "threshold_config" JSONB,
    "channel_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "escalation_config" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_rules_org_id_code_key" ON "alert_rules"("org_id", "code");
CREATE INDEX "alert_rules_org_id_idx" ON "alert_rules"("org_id");
CREATE INDEX "alert_rules_branch_id_idx" ON "alert_rules"("branch_id");
CREATE INDEX "alert_rules_org_id_type_status_idx" ON "alert_rules"("org_id", "type", "status");
CREATE INDEX "alert_rules_status_idx" ON "alert_rules"("status");

ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── AlertChannel ──
CREATE TABLE "alert_channels" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertChannelType" NOT NULL,
    "status" "AlertChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alert_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_channels_org_id_code_key" ON "alert_channels"("org_id", "code");
CREATE INDEX "alert_channels_org_id_idx" ON "alert_channels"("org_id");
CREATE INDEX "alert_channels_org_id_type_status_idx" ON "alert_channels"("org_id", "type", "status");
CREATE INDEX "alert_channels_status_idx" ON "alert_channels"("status");

ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AlertDelivery ──
CREATE TABLE "alert_deliveries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "channel_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB NOT NULL,
    "last_error" TEXT,
    "failure_reason" TEXT,
    "dedupe_key" TEXT,
    "sent_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "triggered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_deliveries_org_id_dedupe_key_channel_id_key"
    ON "alert_deliveries"("org_id", "dedupe_key", "channel_id");
CREATE INDEX "alert_deliveries_org_id_idx" ON "alert_deliveries"("org_id");
CREATE INDEX "alert_deliveries_rule_id_idx" ON "alert_deliveries"("rule_id");
CREATE INDEX "alert_deliveries_channel_id_idx" ON "alert_deliveries"("channel_id");
CREATE INDEX "alert_deliveries_org_id_status_created_at_idx"
    ON "alert_deliveries"("org_id", "status", "created_at");
CREATE INDEX "alert_deliveries_status_idx" ON "alert_deliveries"("status");
CREATE INDEX "alert_deliveries_next_retry_at_idx" ON "alert_deliveries"("next_retry_at");

ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "alert_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── DigestSchedule ──
CREATE TABLE "digest_schedules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "digest_type" TEXT NOT NULL,
    "frequency" "DigestFrequency" NOT NULL DEFAULT 'DAILY',
    "hour_local" INTEGER NOT NULL DEFAULT 7,
    "day_of_week" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "channel_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "DigestScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "digest_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "digest_schedules_org_id_code_key" ON "digest_schedules"("org_id", "code");
CREATE INDEX "digest_schedules_org_id_idx" ON "digest_schedules"("org_id");
CREATE INDEX "digest_schedules_branch_id_idx" ON "digest_schedules"("branch_id");
CREATE INDEX "digest_schedules_org_id_frequency_status_idx"
    ON "digest_schedules"("org_id", "frequency", "status");
CREATE INDEX "digest_schedules_status_idx" ON "digest_schedules"("status");

ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── OwnerLiveEvent ──
CREATE TABLE "owner_live_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "type" "OwnerLiveEventType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "source_module" TEXT NOT NULL,
    "source_ref" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_live_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "owner_live_events_org_id_created_at_idx"
    ON "owner_live_events"("org_id", "created_at");
CREATE INDEX "owner_live_events_org_id_branch_id_type_created_at_idx"
    ON "owner_live_events"("org_id", "branch_id", "type", "created_at");
CREATE INDEX "owner_live_events_org_id_severity_created_at_idx"
    ON "owner_live_events"("org_id", "severity", "created_at");

ALTER TABLE "owner_live_events" ADD CONSTRAINT "owner_live_events_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_live_events" ADD CONSTRAINT "owner_live_events_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
