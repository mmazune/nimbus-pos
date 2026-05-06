-- M38.1 — Franchise Analytics + Consolidation
-- Adds consolidated franchise KPI snapshots, branch scorecards,
-- waste/variance benchmarks, consolidation audit trail,
-- and extended ranking types.

-- ── New Enums ──

CREATE TYPE "FranchiseMetricFamily" AS ENUM ('REVENUE', 'COGS', 'GROSS_PROFIT', 'LABOR', 'PRIME_COST', 'OVERHEAD', 'UTILITIES', 'REPAIRS', 'BUDGET_VARIANCE', 'AP_EXPOSURE');
CREATE TYPE "ConsolidationRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "ScorecardDomain" AS ENUM ('FINANCIAL', 'PRIME_COST', 'WASTE_VARIANCE', 'STOCK_HEALTH', 'PROCUREMENT_READINESS', 'DEMAND_READINESS', 'OPERATIONAL_RISK');
CREATE TYPE "PerformanceTier" AS ENUM ('STRONG', 'WATCH', 'AT_RISK');
CREATE TYPE "WasteMetricType" AS ENUM ('WASTE_VALUE', 'WASTE_PCT_COGS', 'WASTE_PCT_SALES', 'ACTUAL_VS_THEORETICAL', 'WASTE_TREND');

-- ── Extend FranchiseRankingType ──

ALTER TYPE "FranchiseRankingType" ADD VALUE 'PRIME_COST';
ALTER TYPE "FranchiseRankingType" ADD VALUE 'WASTE_EFFICIENCY';
ALTER TYPE "FranchiseRankingType" ADD VALUE 'THEORETICAL_VARIANCE';
ALTER TYPE "FranchiseRankingType" ADD VALUE 'GROSS_MARGIN';
ALTER TYPE "FranchiseRankingType" ADD VALUE 'LABOR_EFFICIENCY';
ALTER TYPE "FranchiseRankingType" ADD VALUE 'OVERALL_FINANCIAL_DISCIPLINE';

-- ── FranchiseConsolidationRun ──

CREATE TABLE "franchise_consolidation_runs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "window_type" "FranchiseWindowType" NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "status" "ConsolidationRunStatus" NOT NULL DEFAULT 'PENDING',
    "branch_count" INTEGER NOT NULL DEFAULT 0,
    "metrics_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "summary" JSONB,
    "generated_by_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_consolidation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "franchise_consolidation_runs_org_id_window_type_window_start_window_end_key" ON "franchise_consolidation_runs"("org_id", "window_type", "window_start", "window_end");
CREATE INDEX "franchise_consolidation_runs_org_id_idx" ON "franchise_consolidation_runs"("org_id");
CREATE INDEX "franchise_consolidation_runs_status_idx" ON "franchise_consolidation_runs"("status");
CREATE INDEX "franchise_consolidation_runs_org_id_window_type_window_start_idx" ON "franchise_consolidation_runs"("org_id", "window_type", "window_start");

ALTER TABLE "franchise_consolidation_runs" ADD CONSTRAINT "franchise_consolidation_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "franchise_consolidation_runs" ADD CONSTRAINT "franchise_consolidation_runs_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── FranchiseKpiSnapshot ──

CREATE TABLE "franchise_kpi_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "consolidation_run_id" TEXT,
    "metric_family" "FranchiseMetricFamily" NOT NULL,
    "window_type" "FranchiseWindowType" NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "previous_value" DECIMAL(14,2),
    "change_percent" DECIMAL(8,4),
    "branch_breakdown" JSONB,
    "calculation_basis" TEXT,
    "source_query" TEXT,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "franchise_kpi_snapshots_org_id_metric_family_window_type_window_start_window_end_key" ON "franchise_kpi_snapshots"("org_id", "metric_family", "window_type", "window_start", "window_end");
CREATE INDEX "franchise_kpi_snapshots_org_id_idx" ON "franchise_kpi_snapshots"("org_id");
CREATE INDEX "franchise_kpi_snapshots_metric_family_idx" ON "franchise_kpi_snapshots"("metric_family");
CREATE INDEX "franchise_kpi_snapshots_window_start_window_end_idx" ON "franchise_kpi_snapshots"("window_start", "window_end");
CREATE INDEX "franchise_kpi_snapshots_org_id_metric_family_window_start_idx" ON "franchise_kpi_snapshots"("org_id", "metric_family", "window_start");
CREATE INDEX "franchise_kpi_snapshots_consolidation_run_id_idx" ON "franchise_kpi_snapshots"("consolidation_run_id");

ALTER TABLE "franchise_kpi_snapshots" ADD CONSTRAINT "franchise_kpi_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "franchise_kpi_snapshots" ADD CONSTRAINT "franchise_kpi_snapshots_consolidation_run_id_fkey" FOREIGN KEY ("consolidation_run_id") REFERENCES "franchise_consolidation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── BranchPerformanceScorecard ──

CREATE TABLE "branch_performance_scorecards" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "domain" "ScorecardDomain" NOT NULL,
    "window_type" "FranchiseWindowType" NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "tier" "PerformanceTier" NOT NULL DEFAULT 'WATCH',
    "rank" INTEGER,
    "percentile" DECIMAL(5,2),
    "kpi_values" JSONB NOT NULL,
    "thresholds" JSONB,
    "drilldown_hint" JSONB,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_performance_scorecards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_performance_scorecards_org_branch_domain_window_key" ON "branch_performance_scorecards"("org_id", "branch_id", "domain", "window_type", "window_start", "window_end");
CREATE INDEX "branch_performance_scorecards_org_id_idx" ON "branch_performance_scorecards"("org_id");
CREATE INDEX "branch_performance_scorecards_branch_id_idx" ON "branch_performance_scorecards"("branch_id");
CREATE INDEX "branch_performance_scorecards_domain_idx" ON "branch_performance_scorecards"("domain");
CREATE INDEX "branch_performance_scorecards_tier_idx" ON "branch_performance_scorecards"("tier");
CREATE INDEX "branch_performance_scorecards_org_id_branch_id_domain_idx" ON "branch_performance_scorecards"("org_id", "branch_id", "domain");
CREATE INDEX "branch_performance_scorecards_org_id_window_start_window_end_idx" ON "branch_performance_scorecards"("org_id", "window_start", "window_end");

ALTER TABLE "branch_performance_scorecards" ADD CONSTRAINT "branch_performance_scorecards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_performance_scorecards" ADD CONSTRAINT "branch_performance_scorecards_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── WasteBenchmarkSnapshot ──

CREATE TABLE "waste_benchmark_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "window_type" "FranchiseWindowType" NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "waste_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "waste_pct_cogs" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "waste_pct_sales" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "theoretical_cogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actual_cogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "variance_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "variance_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "top_waste_reasons" JSONB,
    "top_wasted_items" JSONB,
    "portfolio_avg_waste_pct" DECIMAL(8,4),
    "rank" INTEGER,
    "metadata" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waste_benchmark_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waste_benchmark_snapshots_org_branch_window_key" ON "waste_benchmark_snapshots"("org_id", "branch_id", "window_type", "window_start", "window_end");
CREATE INDEX "waste_benchmark_snapshots_org_id_idx" ON "waste_benchmark_snapshots"("org_id");
CREATE INDEX "waste_benchmark_snapshots_branch_id_idx" ON "waste_benchmark_snapshots"("branch_id");
CREATE INDEX "waste_benchmark_snapshots_org_id_branch_id_window_start_idx" ON "waste_benchmark_snapshots"("org_id", "branch_id", "window_start");
CREATE INDEX "waste_benchmark_snapshots_org_id_window_start_window_end_idx" ON "waste_benchmark_snapshots"("org_id", "window_start", "window_end");

ALTER TABLE "waste_benchmark_snapshots" ADD CONSTRAINT "waste_benchmark_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_benchmark_snapshots" ADD CONSTRAINT "waste_benchmark_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
