-- M38 — Franchise + Multi-Branch Suite
-- Creates franchise_rankings, branch_budget_rollups, inter_branch_transfers, hq_digest_subscriptions

-- Enums
CREATE TYPE "FranchiseRankingType" AS ENUM ('REVENUE', 'BUDGET_VARIANCE', 'FORECAST_ACCURACY', 'PROCUREMENT_PREPAREDNESS', 'STOCK_HEALTH', 'DEMAND_READINESS');
CREATE TYPE "FranchiseWindowType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM');
CREATE TYPE "InterBranchTransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "InterBranchTransferType" AS ENUM ('STOCK', 'VALUE');
CREATE TYPE "TransferUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "HqDigestFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ON_DEMAND');

-- FranchiseRanking
CREATE TABLE "franchise_rankings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "ranking_type" "FranchiseRankingType" NOT NULL,
    "window_type" "FranchiseWindowType" NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(14,4) NOT NULL,
    "normalization_basis" TEXT,
    "source_signals" JSONB,
    "branch_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_rankings_pkey" PRIMARY KEY ("id")
);

-- BranchBudgetRollup
CREATE TABLE "branch_budget_rollups" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "window_type" "FranchiseWindowType" NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "total_budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_actual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_variance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "variance_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "branch_count" INTEGER NOT NULL DEFAULT 0,
    "branch_summaries" JSONB,
    "metadata" JSONB,
    "generated_by_id" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_budget_rollups_pkey" PRIMARY KEY ("id")
);

-- InterBranchTransfer
CREATE TABLE "inter_branch_transfers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "from_branch_id" TEXT NOT NULL,
    "to_branch_id" TEXT NOT NULL,
    "transfer_type" "InterBranchTransferType" NOT NULL DEFAULT 'STOCK',
    "status" "InterBranchTransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "urgency" "TransferUrgency" NOT NULL DEFAULT 'MEDIUM',
    "inventory_item_id" TEXT,
    "item_category" TEXT,
    "quantity" DECIMAL(12,3),
    "estimated_value" DECIMAL(14,2),
    "rationale" TEXT NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inter_branch_transfers_pkey" PRIMARY KEY ("id")
);

-- HqDigestSubscription
CREATE TABLE "hq_digest_subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "frequency" "HqDigestFrequency" NOT NULL DEFAULT 'WEEKLY',
    "digest_type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preferences" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hq_digest_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "franchise_rankings_org_id_branch_id_ranking_type_window_typ_key" ON "franchise_rankings"("org_id", "branch_id", "ranking_type", "window_type", "window_start", "window_end");
CREATE UNIQUE INDEX "branch_budget_rollups_org_id_window_type_window_start_windo_key" ON "branch_budget_rollups"("org_id", "window_type", "window_start", "window_end", "version");
CREATE UNIQUE INDEX "inter_branch_transfers_org_id_transfer_number_key" ON "inter_branch_transfers"("org_id", "transfer_number");
CREATE UNIQUE INDEX "hq_digest_subscriptions_org_id_user_id_channel_digest_type_key" ON "hq_digest_subscriptions"("org_id", "user_id", "channel", "digest_type");

-- Indexes: FranchiseRanking
CREATE INDEX "franchise_rankings_org_id_idx" ON "franchise_rankings"("org_id");
CREATE INDEX "franchise_rankings_branch_id_idx" ON "franchise_rankings"("branch_id");
CREATE INDEX "franchise_rankings_ranking_type_idx" ON "franchise_rankings"("ranking_type");
CREATE INDEX "franchise_rankings_window_start_window_end_idx" ON "franchise_rankings"("window_start", "window_end");
CREATE INDEX "franchise_rankings_org_id_ranking_type_window_start_window_end_idx" ON "franchise_rankings"("org_id", "ranking_type", "window_start", "window_end");
CREATE INDEX "franchise_rankings_org_id_branch_id_ranking_type_idx" ON "franchise_rankings"("org_id", "branch_id", "ranking_type");

-- Indexes: BranchBudgetRollup
CREATE INDEX "branch_budget_rollups_org_id_idx" ON "branch_budget_rollups"("org_id");
CREATE INDEX "branch_budget_rollups_window_type_idx" ON "branch_budget_rollups"("window_type");
CREATE INDEX "branch_budget_rollups_window_start_window_end_idx" ON "branch_budget_rollups"("window_start", "window_end");
CREATE INDEX "branch_budget_rollups_org_id_window_type_window_start_window_end_idx" ON "branch_budget_rollups"("org_id", "window_type", "window_start", "window_end");

-- Indexes: InterBranchTransfer
CREATE INDEX "inter_branch_transfers_org_id_idx" ON "inter_branch_transfers"("org_id");
CREATE INDEX "inter_branch_transfers_from_branch_id_idx" ON "inter_branch_transfers"("from_branch_id");
CREATE INDEX "inter_branch_transfers_to_branch_id_idx" ON "inter_branch_transfers"("to_branch_id");
CREATE INDEX "inter_branch_transfers_status_idx" ON "inter_branch_transfers"("status");
CREATE INDEX "inter_branch_transfers_urgency_idx" ON "inter_branch_transfers"("urgency");
CREATE INDEX "inter_branch_transfers_inventory_item_id_idx" ON "inter_branch_transfers"("inventory_item_id");
CREATE INDEX "inter_branch_transfers_org_id_status_idx" ON "inter_branch_transfers"("org_id", "status");
CREATE INDEX "inter_branch_transfers_org_id_from_branch_id_status_idx" ON "inter_branch_transfers"("org_id", "from_branch_id", "status");
CREATE INDEX "inter_branch_transfers_org_id_to_branch_id_status_idx" ON "inter_branch_transfers"("org_id", "to_branch_id", "status");
CREATE INDEX "inter_branch_transfers_org_id_from_branch_id_to_branch_id_st_idx" ON "inter_branch_transfers"("org_id", "from_branch_id", "to_branch_id", "status");

-- Indexes: HqDigestSubscription
CREATE INDEX "hq_digest_subscriptions_org_id_idx" ON "hq_digest_subscriptions"("org_id");
CREATE INDEX "hq_digest_subscriptions_user_id_idx" ON "hq_digest_subscriptions"("user_id");
CREATE INDEX "hq_digest_subscriptions_frequency_idx" ON "hq_digest_subscriptions"("frequency");
CREATE INDEX "hq_digest_subscriptions_is_active_idx" ON "hq_digest_subscriptions"("is_active");
CREATE INDEX "hq_digest_subscriptions_org_id_user_id_idx" ON "hq_digest_subscriptions"("org_id", "user_id");
CREATE INDEX "hq_digest_subscriptions_org_id_digest_type_is_active_idx" ON "hq_digest_subscriptions"("org_id", "digest_type", "is_active");

-- Foreign keys: FranchiseRanking
ALTER TABLE "franchise_rankings" ADD CONSTRAINT "franchise_rankings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "franchise_rankings" ADD CONSTRAINT "franchise_rankings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: BranchBudgetRollup
ALTER TABLE "branch_budget_rollups" ADD CONSTRAINT "branch_budget_rollups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_budget_rollups" ADD CONSTRAINT "branch_budget_rollups_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: InterBranchTransfer
ALTER TABLE "inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: HqDigestSubscription
ALTER TABLE "hq_digest_subscriptions" ADD CONSTRAINT "hq_digest_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hq_digest_subscriptions" ADD CONSTRAINT "hq_digest_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
