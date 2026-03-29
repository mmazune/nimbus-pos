-- M27: Staff Insights + Awards + Promotion Suggestions

-- Enums
CREATE TYPE "StaffInsightStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AwardType" AS ENUM ('EMPLOYEE_OF_MONTH', 'RELIABILITY', 'SALES_EXCELLENCE', 'CUSTOMER_DELIGHT', 'TEAMWORK', 'OTHER');
CREATE TYPE "PromotionSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DISMISSED');

-- StaffInsightSnapshot
CREATE TABLE "staff_insight_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "StaffInsightStatus" NOT NULL DEFAULT 'ACTIVE',
    "sales_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reliability_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "attendance_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wastage_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "risk_penalty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "composite_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "weights" JSONB NOT NULL,
    "source_summary" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_insight_snapshots_pkey" PRIMARY KEY ("id")
);

-- StaffAward
CREATE TABLE "staff_awards" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "award_type" "AwardType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "staff_awards_pkey" PRIMARY KEY ("id")
);

-- PromotionSuggestion
CREATE TABLE "promotion_suggestions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "current_position_id" TEXT,
    "suggested_position_id" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "PromotionSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "generated_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_notes" TEXT,
    "rationale" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "promotion_suggestions_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "staff_insight_snapshots_org_id_employee_id_period_start_peri_key" ON "staff_insight_snapshots"("org_id", "employee_id", "period_start", "period_end");

-- Indexes: StaffInsightSnapshot
CREATE INDEX "staff_insight_snapshots_org_id_idx" ON "staff_insight_snapshots"("org_id");
CREATE INDEX "staff_insight_snapshots_branch_id_idx" ON "staff_insight_snapshots"("branch_id");
CREATE INDEX "staff_insight_snapshots_employee_id_idx" ON "staff_insight_snapshots"("employee_id");
CREATE INDEX "staff_insight_snapshots_status_idx" ON "staff_insight_snapshots"("status");
CREATE INDEX "staff_insight_snapshots_period_start_idx" ON "staff_insight_snapshots"("period_start");
CREATE INDEX "staff_insight_snapshots_period_end_idx" ON "staff_insight_snapshots"("period_end");
CREATE INDEX "staff_insight_snapshots_composite_score_idx" ON "staff_insight_snapshots"("composite_score");
CREATE INDEX "staff_insight_snapshots_org_id_branch_id_status_idx" ON "staff_insight_snapshots"("org_id", "branch_id", "status");
CREATE INDEX "staff_insight_snapshots_org_id_branch_id_period_start_perio_idx" ON "staff_insight_snapshots"("org_id", "branch_id", "period_start", "period_end");

-- Indexes: StaffAward
CREATE INDEX "staff_awards_org_id_idx" ON "staff_awards"("org_id");
CREATE INDEX "staff_awards_branch_id_idx" ON "staff_awards"("branch_id");
CREATE INDEX "staff_awards_employee_id_idx" ON "staff_awards"("employee_id");
CREATE INDEX "staff_awards_award_type_idx" ON "staff_awards"("award_type");
CREATE INDEX "staff_awards_period_start_idx" ON "staff_awards"("period_start");
CREATE INDEX "staff_awards_period_end_idx" ON "staff_awards"("period_end");
CREATE INDEX "staff_awards_created_by_id_idx" ON "staff_awards"("created_by_id");
CREATE INDEX "staff_awards_org_id_branch_id_award_type_idx" ON "staff_awards"("org_id", "branch_id", "award_type");

-- Indexes: PromotionSuggestion
CREATE INDEX "promotion_suggestions_org_id_idx" ON "promotion_suggestions"("org_id");
CREATE INDEX "promotion_suggestions_branch_id_idx" ON "promotion_suggestions"("branch_id");
CREATE INDEX "promotion_suggestions_employee_id_idx" ON "promotion_suggestions"("employee_id");
CREATE INDEX "promotion_suggestions_status_idx" ON "promotion_suggestions"("status");
CREATE INDEX "promotion_suggestions_period_start_idx" ON "promotion_suggestions"("period_start");
CREATE INDEX "promotion_suggestions_period_end_idx" ON "promotion_suggestions"("period_end");
CREATE INDEX "promotion_suggestions_generated_by_id_idx" ON "promotion_suggestions"("generated_by_id");
CREATE INDEX "promotion_suggestions_decided_by_id_idx" ON "promotion_suggestions"("decided_by_id");
CREATE INDEX "promotion_suggestions_org_id_branch_id_status_idx" ON "promotion_suggestions"("org_id", "branch_id", "status");
CREATE INDEX "promotion_suggestions_org_id_branch_id_period_start_period_idx" ON "promotion_suggestions"("org_id", "branch_id", "period_start", "period_end");

-- Foreign keys: StaffInsightSnapshot
ALTER TABLE "staff_insight_snapshots" ADD CONSTRAINT "staff_insight_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_insight_snapshots" ADD CONSTRAINT "staff_insight_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_insight_snapshots" ADD CONSTRAINT "staff_insight_snapshots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_insight_snapshots" ADD CONSTRAINT "staff_insight_snapshots_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: StaffAward
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: PromotionSuggestion
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_current_position_id_fkey" FOREIGN KEY ("current_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_suggested_position_id_fkey" FOREIGN KEY ("suggested_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
