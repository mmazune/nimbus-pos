-- M39: Billing + Subscription Plans + Dev Portal
-- Migration #42

-- Enums
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
CREATE TYPE "UsageMetricType" AS ENUM ('BRANCHES', 'ACTIVE_USERS', 'API_KEYS', 'WEBHOOK_ENDPOINTS', 'ORDERS_PROCESSED', 'EVENTS_PROCESSED');
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "WebhookStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "WebhookEventType" AS ENUM ('ORDER_CREATED', 'ORDER_CLOSED', 'PAYMENT_RECEIVED', 'REFUND_CREATED', 'INVENTORY_LOW', 'SHIFT_OPENED', 'SHIFT_CLOSED', 'RESERVATION_CREATED', 'EVENT_BOOKED', 'ANOMALY_DETECTED', 'SUBSCRIPTION_CHANGED', 'USAGE_LIMIT_APPROACHING');
CREATE TYPE "SupportSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');

-- Plan catalog
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "price_monthly" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_annual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "max_branches" INTEGER NOT NULL DEFAULT 1,
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_api_keys" INTEGER NOT NULL DEFAULT 0,
    "webhooks_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_webhook_endpoints" INTEGER NOT NULL DEFAULT 0,
    "analytics_enabled" BOOLEAN NOT NULL DEFAULT false,
    "franchise_enabled" BOOLEAN NOT NULL DEFAULT false,
    "support_tier" TEXT NOT NULL DEFAULT 'basic',
    "limits" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- Subscription
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "grace_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- UsageMeter
CREATE TABLE "usage_meters" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "metric_type" "UsageMetricType" NOT NULL,
    "current_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "limit_value" DECIMAL(14,2),
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

-- ApiKey
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- WebhookEndpoint
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'ACTIVE',
    "signing_secret" TEXT NOT NULL,
    "events" "WebhookEventType"[],
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_delivered_at" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- SupportSession
CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SupportSessionStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "closed_reason" TEXT,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- DevAdmin (system-protected)
CREATE TABLE "dev_admins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_protected" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_admins_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");
CREATE UNIQUE INDEX "subscriptions_org_id_key" ON "subscriptions"("org_id");
CREATE UNIQUE INDEX "usage_meters_org_id_metric_type_window_start_window_end_key" ON "usage_meters"("org_id", "metric_type", "window_start", "window_end");
CREATE UNIQUE INDEX "dev_admins_user_id_key" ON "dev_admins"("user_id");

-- Indexes: plans
CREATE INDEX "plans_status_idx" ON "plans"("status");
CREATE INDEX "plans_code_idx" ON "plans"("code");

-- Indexes: subscriptions
CREATE INDEX "subscriptions_org_id_status_idx" ON "subscriptions"("org_id", "status");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- Indexes: usage_meters
CREATE INDEX "usage_meters_org_id_idx" ON "usage_meters"("org_id");
CREATE INDEX "usage_meters_metric_type_idx" ON "usage_meters"("metric_type");
CREATE INDEX "usage_meters_org_id_metric_type_window_start_idx" ON "usage_meters"("org_id", "metric_type", "window_start");

-- Indexes: api_keys
CREATE INDEX "api_keys_org_id_idx" ON "api_keys"("org_id");
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");
CREATE INDEX "api_keys_org_id_status_idx" ON "api_keys"("org_id", "status");
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");

-- Indexes: webhook_endpoints
CREATE INDEX "webhook_endpoints_org_id_idx" ON "webhook_endpoints"("org_id");
CREATE INDEX "webhook_endpoints_org_id_status_idx" ON "webhook_endpoints"("org_id", "status");
CREATE INDEX "webhook_endpoints_status_idx" ON "webhook_endpoints"("status");

-- Indexes: support_sessions
CREATE INDEX "support_sessions_org_id_idx" ON "support_sessions"("org_id");
CREATE INDEX "support_sessions_org_id_status_idx" ON "support_sessions"("org_id", "status");
CREATE INDEX "support_sessions_status_idx" ON "support_sessions"("status");
CREATE INDEX "support_sessions_org_id_started_at_idx" ON "support_sessions"("org_id", "started_at");

-- Foreign keys: subscriptions
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: usage_meters
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: api_keys
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: webhook_endpoints
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: support_sessions
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: dev_admins
ALTER TABLE "dev_admins" ADD CONSTRAINT "dev_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
