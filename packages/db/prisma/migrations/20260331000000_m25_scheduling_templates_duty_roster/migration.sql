-- M25: Scheduling + Templates + Duty Roster
-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CoverageRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CoverageSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable: shift_templates
CREATE TABLE "shift_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at_time" TEXT NOT NULL,
    "ends_at_time" TEXT NOT NULL,
    "role_key" TEXT,
    "position_id" TEXT,
    "expected_headcount" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: schedules
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: schedule_assignments
CREATE TABLE "schedule_assignments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "shift_template_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_date" DATE NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "role_key" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: coverage_rules
CREATE TABLE "coverage_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "role_key" TEXT,
    "position_id" TEXT,
    "minimum_headcount" INTEGER NOT NULL DEFAULT 1,
    "applies_from_time" TEXT,
    "applies_to_time" TEXT,
    "status" "CoverageRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity" "CoverageSeverity" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverage_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: shift_templates
CREATE UNIQUE INDEX "shift_templates_org_id_code_key" ON "shift_templates"("org_id", "code");
CREATE INDEX "shift_templates_org_id_idx" ON "shift_templates"("org_id");
CREATE INDEX "shift_templates_branch_id_idx" ON "shift_templates"("branch_id");
CREATE INDEX "shift_templates_code_idx" ON "shift_templates"("code");
CREATE INDEX "shift_templates_role_key_idx" ON "shift_templates"("role_key");
CREATE INDEX "shift_templates_position_id_idx" ON "shift_templates"("position_id");
CREATE INDEX "shift_templates_active_idx" ON "shift_templates"("active");
CREATE INDEX "shift_templates_org_id_branch_id_active_idx" ON "shift_templates"("org_id", "branch_id", "active");

-- CreateIndex: schedules
CREATE INDEX "schedules_org_id_idx" ON "schedules"("org_id");
CREATE INDEX "schedules_branch_id_idx" ON "schedules"("branch_id");
CREATE INDEX "schedules_status_idx" ON "schedules"("status");
CREATE INDEX "schedules_date_from_idx" ON "schedules"("date_from");
CREATE INDEX "schedules_date_to_idx" ON "schedules"("date_to");
CREATE INDEX "schedules_org_id_branch_id_status_idx" ON "schedules"("org_id", "branch_id", "status");
CREATE INDEX "schedules_org_id_branch_id_date_from_date_to_idx" ON "schedules"("org_id", "branch_id", "date_from", "date_to");

-- CreateIndex: schedule_assignments
CREATE UNIQUE INDEX "schedule_assignments_schedule_id_shift_template_id_employee__key" ON "schedule_assignments"("schedule_id", "shift_template_id", "employee_id", "shift_date");
CREATE INDEX "schedule_assignments_org_id_idx" ON "schedule_assignments"("org_id");
CREATE INDEX "schedule_assignments_branch_id_idx" ON "schedule_assignments"("branch_id");
CREATE INDEX "schedule_assignments_schedule_id_idx" ON "schedule_assignments"("schedule_id");
CREATE INDEX "schedule_assignments_shift_template_id_idx" ON "schedule_assignments"("shift_template_id");
CREATE INDEX "schedule_assignments_employee_id_idx" ON "schedule_assignments"("employee_id");
CREATE INDEX "schedule_assignments_shift_date_idx" ON "schedule_assignments"("shift_date");
CREATE INDEX "schedule_assignments_status_idx" ON "schedule_assignments"("status");
CREATE INDEX "schedule_assignments_role_key_idx" ON "schedule_assignments"("role_key");
CREATE INDEX "schedule_assignments_org_id_branch_id_shift_date_idx" ON "schedule_assignments"("org_id", "branch_id", "shift_date");

-- CreateIndex: coverage_rules
CREATE INDEX "coverage_rules_org_id_idx" ON "coverage_rules"("org_id");
CREATE INDEX "coverage_rules_branch_id_idx" ON "coverage_rules"("branch_id");
CREATE INDEX "coverage_rules_role_key_idx" ON "coverage_rules"("role_key");
CREATE INDEX "coverage_rules_position_id_idx" ON "coverage_rules"("position_id");
CREATE INDEX "coverage_rules_status_idx" ON "coverage_rules"("status");
CREATE INDEX "coverage_rules_org_id_branch_id_status_idx" ON "coverage_rules"("org_id", "branch_id", "status");

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schedules" ADD CONSTRAINT "schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_shift_template_id_fkey" FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coverage_rules" ADD CONSTRAINT "coverage_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coverage_rules" ADD CONSTRAINT "coverage_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coverage_rules" ADD CONSTRAINT "coverage_rules_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
