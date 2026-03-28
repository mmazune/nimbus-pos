-- M26: Payroll Engine + Pay Runs + Payslips

-- Enums
CREATE TYPE "PayRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');
CREATE TYPE "PayComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_COST', 'OTHER');
CREATE TYPE "PaySlipStatus" AS ENUM ('DRAFT', 'FINAL', 'PAID');
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONUS', 'OVERTIME', 'ADVANCE', 'DEDUCTION', 'PENALTY', 'OTHER');

-- PayComponent
CREATE TABLE "pay_components" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "component_type" "PayComponentType" NOT NULL,
    "calculation_method" TEXT,
    "default_amount" DECIMAL(10,2),
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pay_components_pkey" PRIMARY KEY ("id")
);

-- PayrollAdjustment
CREATE TABLE "payroll_adjustments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "pay_component_id" TEXT,
    "adjustment_type" "PayrollAdjustmentType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- PayRun
CREATE TABLE "pay_runs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "built_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_by_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "gross_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "posting_payload" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "pay_runs_pkey" PRIMARY KEY ("id")
);

-- PaySlip
CREATE TABLE "pay_slips" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "pay_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "PaySlipStatus" NOT NULL DEFAULT 'DRAFT',
    "gross_pay" DECIMAL(10,2) NOT NULL,
    "total_deductions" DECIMAL(10,2) NOT NULL,
    "net_pay" DECIMAL(10,2) NOT NULL,
    "component_snapshot" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pay_slips_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "pay_components_org_id_code_key" ON "pay_components"("org_id", "code");

-- PayComponent indexes
CREATE INDEX "pay_components_org_id_idx" ON "pay_components"("org_id");
CREATE INDEX "pay_components_branch_id_idx" ON "pay_components"("branch_id");
CREATE INDEX "pay_components_code_idx" ON "pay_components"("code");
CREATE INDEX "pay_components_component_type_idx" ON "pay_components"("component_type");
CREATE INDEX "pay_components_active_idx" ON "pay_components"("active");
CREATE INDEX "pay_components_org_id_branch_id_active_idx" ON "pay_components"("org_id", "branch_id", "active");

-- PayrollAdjustment indexes
CREATE INDEX "payroll_adjustments_org_id_idx" ON "payroll_adjustments"("org_id");
CREATE INDEX "payroll_adjustments_branch_id_idx" ON "payroll_adjustments"("branch_id");
CREATE INDEX "payroll_adjustments_employee_id_idx" ON "payroll_adjustments"("employee_id");
CREATE INDEX "payroll_adjustments_pay_component_id_idx" ON "payroll_adjustments"("pay_component_id");
CREATE INDEX "payroll_adjustments_adjustment_type_idx" ON "payroll_adjustments"("adjustment_type");
CREATE INDEX "payroll_adjustments_effective_date_idx" ON "payroll_adjustments"("effective_date");
CREATE INDEX "payroll_adjustments_created_by_id_idx" ON "payroll_adjustments"("created_by_id");
CREATE INDEX "payroll_adjustments_org_id_branch_id_effective_date_idx" ON "payroll_adjustments"("org_id", "branch_id", "effective_date");

-- PayRun indexes
CREATE INDEX "pay_runs_org_id_idx" ON "pay_runs"("org_id");
CREATE INDEX "pay_runs_branch_id_idx" ON "pay_runs"("branch_id");
CREATE INDEX "pay_runs_status_idx" ON "pay_runs"("status");
CREATE INDEX "pay_runs_period_start_idx" ON "pay_runs"("period_start");
CREATE INDEX "pay_runs_period_end_idx" ON "pay_runs"("period_end");
CREATE INDEX "pay_runs_built_by_id_idx" ON "pay_runs"("built_by_id");
CREATE INDEX "pay_runs_approved_by_id_idx" ON "pay_runs"("approved_by_id");
CREATE INDEX "pay_runs_paid_by_id_idx" ON "pay_runs"("paid_by_id");
CREATE INDEX "pay_runs_org_id_branch_id_status_idx" ON "pay_runs"("org_id", "branch_id", "status");
CREATE INDEX "pay_runs_org_id_branch_id_period_start_period_end_idx" ON "pay_runs"("org_id", "branch_id", "period_start", "period_end");

-- PaySlip indexes
CREATE INDEX "pay_slips_org_id_idx" ON "pay_slips"("org_id");
CREATE INDEX "pay_slips_branch_id_idx" ON "pay_slips"("branch_id");
CREATE INDEX "pay_slips_pay_run_id_idx" ON "pay_slips"("pay_run_id");
CREATE INDEX "pay_slips_employee_id_idx" ON "pay_slips"("employee_id");
CREATE INDEX "pay_slips_status_idx" ON "pay_slips"("status");
CREATE INDEX "pay_slips_org_id_branch_id_status_idx" ON "pay_slips"("org_id", "branch_id", "status");
CREATE INDEX "pay_slips_pay_run_id_employee_id_idx" ON "pay_slips"("pay_run_id", "employee_id");

-- Foreign keys: PayComponent
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: PayrollAdjustment
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_pay_component_id_fkey" FOREIGN KEY ("pay_component_id") REFERENCES "pay_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: PayRun
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_built_by_id_fkey" FOREIGN KEY ("built_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: PaySlip
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_pay_run_id_fkey" FOREIGN KEY ("pay_run_id") REFERENCES "pay_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
