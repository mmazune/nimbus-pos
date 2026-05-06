-- M37 Refactor: Demand Calendar + Forecast Enhancements + Procurement Advisory Enhancements
-- Adds DemandCalendarEntry, new enums, and enhances ForecastRun + ProcurementSuggestion

-- New enum types
CREATE TYPE "DemandCalendarType" AS ENUM ('BRUNCH', 'SPORTS_NIGHT', 'DJ_NIGHT', 'PRIVATE_EVENT', 'HOLIDAY_RUSH', 'PROMOTION', 'LARGE_RESERVATION', 'CUSTOM');
CREATE TYPE "DaypartType" AS ENUM ('BREAKFAST', 'LUNCH', 'AFTERNOON', 'DINNER', 'LATE_NIGHT', 'ALL_DAY');
CREATE TYPE "ProcurementUrgency" AS ENUM ('MONITOR', 'ORDER_NEXT_PO', 'STOCK_UP_BEFORE_EVENT', 'TRANSFER_FROM_BRANCH', 'URGENT_LOCAL_BUY');

-- Add RUNNING status to ForecastRunStatus
ALTER TYPE "ForecastRunStatus" ADD VALUE IF NOT EXISTS 'RUNNING' BEFORE 'COMPLETED';

-- ── DemandCalendarEntry table (created first, referenced by ProcurementSuggestion) ──
CREATE TABLE "demand_calendar_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_id" TEXT,
    "calendar_type" "DemandCalendarType" NOT NULL,
    "daypart" "DaypartType" NOT NULL DEFAULT 'ALL_DAY',
    "title" TEXT NOT NULL,
    "date_start" DATE NOT NULL,
    "date_end" DATE NOT NULL,
    "expected_covers" INTEGER,
    "demand_multiplier" DECIMAL(5,2),
    "revenue_uplift_pct" DECIMAL(5,2),
    "item_notes" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_calendar_entries_pkey" PRIMARY KEY ("id")
);

-- DemandCalendarEntry foreign keys
ALTER TABLE "demand_calendar_entries" ADD CONSTRAINT "demand_calendar_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_calendar_entries" ADD CONSTRAINT "demand_calendar_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_calendar_entries" ADD CONSTRAINT "demand_calendar_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demand_calendar_entries" ADD CONSTRAINT "demand_calendar_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demand_calendar_entries" ADD CONSTRAINT "demand_calendar_entries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DemandCalendarEntry indexes
CREATE INDEX "demand_calendar_entries_org_id_idx" ON "demand_calendar_entries"("org_id");
CREATE INDEX "demand_calendar_entries_branch_id_idx" ON "demand_calendar_entries"("branch_id");
CREATE INDEX "demand_calendar_entries_event_id_idx" ON "demand_calendar_entries"("event_id");
CREATE INDEX "demand_calendar_entries_calendar_type_idx" ON "demand_calendar_entries"("calendar_type");
CREATE INDEX "demand_calendar_entries_daypart_idx" ON "demand_calendar_entries"("daypart");
CREATE INDEX "demand_calendar_entries_date_start_idx" ON "demand_calendar_entries"("date_start");
CREATE INDEX "demand_calendar_entries_date_end_idx" ON "demand_calendar_entries"("date_end");
CREATE INDEX "demand_calendar_entries_is_active_idx" ON "demand_calendar_entries"("is_active");
CREATE INDEX "demand_calendar_entries_org_id_branch_id_date_start_date_end_idx" ON "demand_calendar_entries"("org_id", "branch_id", "date_start", "date_end");
CREATE INDEX "demand_calendar_entries_org_id_branch_id_calendar_type_is_act_idx" ON "demand_calendar_entries"("org_id", "branch_id", "calendar_type", "is_active");

-- ── ForecastRun enhancements ──
ALTER TABLE "forecast_runs" ADD COLUMN "forecast_horizon_start" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "forecast_runs" ADD COLUMN "forecast_horizon_end" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "forecast_runs" ADD COLUMN "demand_signals" JSONB;
ALTER TABLE "forecast_runs" ADD COLUMN "daypart_summaries" JSONB;

-- Backfill existing rows with sensible values
UPDATE "forecast_runs" SET "forecast_horizon_start" = "source_window_end", "forecast_horizon_end" = "source_window_end" + INTERVAL '30 days';

-- Add index on forecast horizon
CREATE INDEX "forecast_runs_org_id_branch_id_forecast_horizon_start_foreca_idx" ON "forecast_runs"("org_id", "branch_id", "forecast_horizon_start", "forecast_horizon_end");

-- ── ProcurementSuggestion enhancements ──
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "demand_calendar_entry_id" TEXT;
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "urgency" "ProcurementUrgency" NOT NULL DEFAULT 'MONITOR';
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "daypart" "DaypartType";
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "projected_usage" DECIMAL(12,3);
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "current_stock" DECIMAL(12,3);
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "inbound_stock" DECIMAL(12,3);
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "safety_stock" DECIMAL(12,3);
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "lead_time_days" INTEGER;
ALTER TABLE "procurement_suggestions" ADD COLUMN IF NOT EXISTS "suggested_action" TEXT;

-- Add FK for forecast_run_id if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'procurement_suggestions_forecast_run_id_fkey'
  ) THEN
    ALTER TABLE "procurement_suggestions" ADD CONSTRAINT "procurement_suggestions_forecast_run_id_fkey" FOREIGN KEY ("forecast_run_id") REFERENCES "forecast_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add FK for demand_calendar_entry_id
ALTER TABLE "procurement_suggestions" ADD CONSTRAINT "procurement_suggestions_demand_calendar_entry_id_fkey" FOREIGN KEY ("demand_calendar_entry_id") REFERENCES "demand_calendar_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New indexes on procurement_suggestions
CREATE INDEX IF NOT EXISTS "procurement_suggestions_forecast_run_id_idx" ON "procurement_suggestions"("forecast_run_id");
CREATE INDEX IF NOT EXISTS "procurement_suggestions_demand_calendar_entry_id_idx" ON "procurement_suggestions"("demand_calendar_entry_id");
CREATE INDEX IF NOT EXISTS "procurement_suggestions_urgency_idx" ON "procurement_suggestions"("urgency");
CREATE INDEX IF NOT EXISTS "procurement_suggestions_org_id_branch_id_urgency_idx" ON "procurement_suggestions"("org_id", "branch_id", "urgency");
