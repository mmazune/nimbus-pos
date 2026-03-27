-- CreateEnum
CREATE TYPE "KpiScopeType" AS ENUM ('OWNER', 'MANAGER', 'BRANCH');

-- CreateEnum
CREATE TYPE "KpiMetricWindow" AS ENUM ('TODAY', 'MTD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "KpiSubscriptionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "scope_type" "KpiScopeType" NOT NULL,
    "metric_window" "KpiMetricWindow" NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "gross_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_cash" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_card" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_momo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refunds_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orders_open_count" INTEGER NOT NULL DEFAULT 0,
    "orders_closed_count" INTEGER NOT NULL DEFAULT 0,
    "low_stock_count" INTEGER NOT NULL DEFAULT 0,
    "anomaly_open_count" INTEGER NOT NULL DEFAULT 0,
    "anomaly_high_count" INTEGER NOT NULL DEFAULT 0,
    "reservations_today_count" INTEGER NOT NULL DEFAULT 0,
    "events_today_count" INTEGER NOT NULL DEFAULT 0,
    "avg_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "scope_type" "KpiScopeType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "KpiSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_ping_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_snapshots_org_id_idx" ON "kpi_snapshots"("org_id");
CREATE INDEX "kpi_snapshots_branch_id_idx" ON "kpi_snapshots"("branch_id");
CREATE INDEX "kpi_snapshots_scope_type_idx" ON "kpi_snapshots"("scope_type");
CREATE INDEX "kpi_snapshots_metric_window_idx" ON "kpi_snapshots"("metric_window");
CREATE INDEX "kpi_snapshots_snapshot_date_idx" ON "kpi_snapshots"("snapshot_date");
CREATE INDEX "kpi_snapshots_org_id_branch_id_scope_type_metric_window_snaps_idx" ON "kpi_snapshots"("org_id", "branch_id", "scope_type", "metric_window", "snapshot_date");

-- CreateIndex
CREATE INDEX "kpi_subscriptions_org_id_idx" ON "kpi_subscriptions"("org_id");
CREATE INDEX "kpi_subscriptions_branch_id_idx" ON "kpi_subscriptions"("branch_id");
CREATE INDEX "kpi_subscriptions_user_id_idx" ON "kpi_subscriptions"("user_id");
CREATE INDEX "kpi_subscriptions_status_idx" ON "kpi_subscriptions"("status");
CREATE INDEX "kpi_subscriptions_scope_type_idx" ON "kpi_subscriptions"("scope_type");
CREATE INDEX "kpi_subscriptions_org_id_branch_id_user_id_status_idx" ON "kpi_subscriptions"("org_id", "branch_id", "user_id", "status");

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_subscriptions" ADD CONSTRAINT "kpi_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kpi_subscriptions" ADD CONSTRAINT "kpi_subscriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kpi_subscriptions" ADD CONSTRAINT "kpi_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
