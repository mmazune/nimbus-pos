-- Migration M37: Budgets + Forecasts + Procurement Advisory
-- Creates: budgets, budget_lines, forecast_runs, procurement_suggestions

-- ── Enums ──
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINALIZED', 'ARCHIVED');
CREATE TYPE "BudgetType" AS ENUM ('OPERATIONAL', 'FINANCIAL');
CREATE TYPE "ForecastRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "ForecastType" AS ENUM ('BRANCH', 'ROLLUP', 'FRANCHISE');
CREATE TYPE "ProcurementSuggestionStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- ── budgets ──
CREATE TABLE "budgets" (
    "id"               TEXT NOT NULL,
    "org_id"           TEXT NOT NULL,
    "branch_id"        TEXT NOT NULL,
    "fiscal_period_id" TEXT,
    "name"             TEXT NOT NULL,
    "budget_type"      "BudgetType" NOT NULL DEFAULT 'OPERATIONAL',
    "status"           "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "version"          INTEGER NOT NULL DEFAULT 1,
    "period_start"     TIMESTAMP(3) NOT NULL,
    "period_end"       TIMESTAMP(3) NOT NULL,
    "total_budget"     DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes"            TEXT,
    "metadata"         JSONB,
    "created_by_id"    TEXT NOT NULL,
    "updated_by_id"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budgets_org_id_branch_id_fiscal_period_id_budget_type_version_key"
    ON "budgets"("org_id", "branch_id", "fiscal_period_id", "budget_type", "version");
CREATE INDEX "budgets_org_id_idx" ON "budgets"("org_id");
CREATE INDEX "budgets_branch_id_idx" ON "budgets"("branch_id");
CREATE INDEX "budgets_fiscal_period_id_idx" ON "budgets"("fiscal_period_id");
CREATE INDEX "budgets_status_idx" ON "budgets"("status");
CREATE INDEX "budgets_org_id_branch_id_status_idx" ON "budgets"("org_id", "branch_id", "status");

ALTER TABLE "budgets"
    ADD CONSTRAINT "budgets_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "budgets_branch_id_fkey"
        FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "budgets_fiscal_period_id_fkey"
        FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "budgets_created_by_id_fkey"
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "budgets_updated_by_id_fkey"
        FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── budget_lines ──
CREATE TABLE "budget_lines" (
    "id"                  TEXT NOT NULL,
    "budget_id"           TEXT NOT NULL,
    "account_id"          TEXT,
    "cost_center_id"      TEXT,
    "category"            TEXT NOT NULL,
    "dimension"           TEXT,
    "budget_amount"       DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actual_amount"       DECIMAL(14,2) NOT NULL DEFAULT 0,
    "variance_amount"     DECIMAL(14,2) NOT NULL DEFAULT 0,
    "variance_pct"        DECIMAL(8,4) NOT NULL DEFAULT 0,
    "actuals_updated_at"  TIMESTAMP(3),
    "metadata"            JSONB,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budget_lines_budget_id_idx" ON "budget_lines"("budget_id");
CREATE INDEX "budget_lines_account_id_idx" ON "budget_lines"("account_id");
CREATE INDEX "budget_lines_cost_center_id_idx" ON "budget_lines"("cost_center_id");

ALTER TABLE "budget_lines"
    ADD CONSTRAINT "budget_lines_budget_id_fkey"
        FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "budget_lines_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "budget_lines_cost_center_id_fkey"
        FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── forecast_runs ──
CREATE TABLE "forecast_runs" (
    "id"                   TEXT NOT NULL,
    "org_id"               TEXT NOT NULL,
    "branch_id"            TEXT,
    "fiscal_period_id"     TEXT,
    "forecast_type"        "ForecastType" NOT NULL DEFAULT 'BRANCH',
    "status"               "ForecastRunStatus" NOT NULL DEFAULT 'PENDING',
    "source_window_start"  TIMESTAMP(3) NOT NULL,
    "source_window_end"    TIMESTAMP(3) NOT NULL,
    "assumptions"          JSONB,
    "outputs"              JSONB,
    "error_message"        TEXT,
    "created_by_id"        TEXT NOT NULL,
    "completed_at"         TIMESTAMP(3),
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "forecast_runs_org_id_idx" ON "forecast_runs"("org_id");
CREATE INDEX "forecast_runs_branch_id_idx" ON "forecast_runs"("branch_id");
CREATE INDEX "forecast_runs_fiscal_period_id_idx" ON "forecast_runs"("fiscal_period_id");
CREATE INDEX "forecast_runs_status_idx" ON "forecast_runs"("status");
CREATE INDEX "forecast_runs_org_id_forecast_type_status_idx" ON "forecast_runs"("org_id", "forecast_type", "status");

ALTER TABLE "forecast_runs"
    ADD CONSTRAINT "forecast_runs_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "forecast_runs_branch_id_fkey"
        FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "forecast_runs_fiscal_period_id_fkey"
        FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "forecast_runs_created_by_id_fkey"
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── procurement_suggestions ──
CREATE TABLE "procurement_suggestions" (
    "id"                    TEXT NOT NULL,
    "org_id"                TEXT NOT NULL,
    "branch_id"             TEXT NOT NULL,
    "forecast_run_id"       TEXT,
    "inventory_item_id"     TEXT,
    "supplier_id"           TEXT,
    "status"                "ProcurementSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "suggested_qty"         DECIMAL(12,3) NOT NULL,
    "estimated_unit_cost"   DECIMAL(12,2),
    "estimated_total_cost"  DECIMAL(14,2),
    "priority"              INTEGER NOT NULL DEFAULT 1,
    "rationale"             TEXT NOT NULL,
    "reviewed_by_id"        TEXT,
    "reviewed_at"           TIMESTAMP(3),
    "review_notes"          TEXT,
    "metadata"              JSONB,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "procurement_suggestions_org_id_idx" ON "procurement_suggestions"("org_id");
CREATE INDEX "procurement_suggestions_branch_id_idx" ON "procurement_suggestions"("branch_id");
CREATE INDEX "procurement_suggestions_inventory_item_id_idx" ON "procurement_suggestions"("inventory_item_id");
CREATE INDEX "procurement_suggestions_status_idx" ON "procurement_suggestions"("status");
CREATE INDEX "procurement_suggestions_org_id_branch_id_status_idx" ON "procurement_suggestions"("org_id", "branch_id", "status");

ALTER TABLE "procurement_suggestions"
    ADD CONSTRAINT "procurement_suggestions_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "procurement_suggestions_branch_id_fkey"
        FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "procurement_suggestions_inventory_item_id_fkey"
        FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "procurement_suggestions_reviewed_by_id_fkey"
        FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
