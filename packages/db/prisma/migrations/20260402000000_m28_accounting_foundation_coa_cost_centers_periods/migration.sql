-- M28: Accounting Foundation — COA + Cost Centers + Fiscal Periods
-- Enums: AccountType, AccountStatus, FiscalPeriodStatus
-- Models: Account, CostCenter, FiscalPeriod, PostingSourceMap, TaxLedgerConfig

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SYSTEM_LOCKED');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'LOCKED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "parent_account_id" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "system_managed" BOOLEAN NOT NULL DEFAULT false,
    "allow_manual_posting" BOOLEAN NOT NULL DEFAULT true,
    "tax_relevant" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "opened_at" TIMESTAMP(3),
    "opened_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_source_maps" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "debit_account_id" TEXT,
    "credit_account_id" TEXT,
    "cost_center_required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_source_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_ledger_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "output_tax_account_id" TEXT,
    "input_tax_account_id" TEXT,
    "discount_account_id" TEXT,
    "deposit_liability_account_id" TEXT,
    "payroll_payable_account_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_ledger_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: accounts
CREATE UNIQUE INDEX "accounts_org_id_code_key" ON "accounts"("org_id", "code");
CREATE INDEX "accounts_org_id_idx" ON "accounts"("org_id");
CREATE INDEX "accounts_branch_id_idx" ON "accounts"("branch_id");
CREATE INDEX "accounts_account_type_idx" ON "accounts"("account_type");
CREATE INDEX "accounts_status_idx" ON "accounts"("status");
CREATE INDEX "accounts_parent_account_id_idx" ON "accounts"("parent_account_id");
CREATE INDEX "accounts_system_managed_idx" ON "accounts"("system_managed");
CREATE INDEX "accounts_org_id_account_type_status_idx" ON "accounts"("org_id", "account_type", "status");

-- CreateIndex: cost_centers
CREATE UNIQUE INDEX "cost_centers_org_id_code_key" ON "cost_centers"("org_id", "code");
CREATE INDEX "cost_centers_org_id_idx" ON "cost_centers"("org_id");
CREATE INDEX "cost_centers_branch_id_idx" ON "cost_centers"("branch_id");
CREATE INDEX "cost_centers_code_idx" ON "cost_centers"("code");
CREATE INDEX "cost_centers_active_idx" ON "cost_centers"("active");
CREATE INDEX "cost_centers_org_id_active_idx" ON "cost_centers"("org_id", "active");

-- CreateIndex: fiscal_periods
CREATE INDEX "fiscal_periods_org_id_idx" ON "fiscal_periods"("org_id");
CREATE INDEX "fiscal_periods_status_idx" ON "fiscal_periods"("status");
CREATE INDEX "fiscal_periods_starts_at_idx" ON "fiscal_periods"("starts_at");
CREATE INDEX "fiscal_periods_ends_at_idx" ON "fiscal_periods"("ends_at");
CREATE INDEX "fiscal_periods_org_id_status_idx" ON "fiscal_periods"("org_id", "status");
CREATE INDEX "fiscal_periods_org_id_starts_at_ends_at_idx" ON "fiscal_periods"("org_id", "starts_at", "ends_at");

-- CreateIndex: posting_source_maps
CREATE UNIQUE INDEX "posting_source_maps_org_id_source_key_key" ON "posting_source_maps"("org_id", "source_key");
CREATE INDEX "posting_source_maps_org_id_idx" ON "posting_source_maps"("org_id");
CREATE INDEX "posting_source_maps_source_key_idx" ON "posting_source_maps"("source_key");
CREATE INDEX "posting_source_maps_active_idx" ON "posting_source_maps"("active");
CREATE INDEX "posting_source_maps_org_id_active_idx" ON "posting_source_maps"("org_id", "active");

-- CreateIndex: tax_ledger_configs
CREATE INDEX "tax_ledger_configs_org_id_idx" ON "tax_ledger_configs"("org_id");
CREATE INDEX "tax_ledger_configs_active_idx" ON "tax_ledger_configs"("active");
CREATE INDEX "tax_ledger_configs_org_id_active_idx" ON "tax_ledger_configs"("org_id", "active");

-- AddForeignKey constraints
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "posting_source_maps" ADD CONSTRAINT "posting_source_maps_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posting_source_maps" ADD CONSTRAINT "posting_source_maps_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "posting_source_maps" ADD CONSTRAINT "posting_source_maps_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tax_ledger_configs" ADD CONSTRAINT "tax_ledger_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_configs" ADD CONSTRAINT "tax_ledger_configs_output_tax_account_id_fkey" FOREIGN KEY ("output_tax_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_configs" ADD CONSTRAINT "tax_ledger_configs_input_tax_account_id_fkey" FOREIGN KEY ("input_tax_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_configs" ADD CONSTRAINT "tax_ledger_configs_discount_account_id_fkey" FOREIGN KEY ("discount_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_configs" ADD CONSTRAINT "tax_ledger_configs_deposit_liability_account_id_fkey" FOREIGN KEY ("deposit_liability_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_configs" ADD CONSTRAINT "tax_ledger_configs_payroll_payable_account_id_fkey" FOREIGN KEY ("payroll_payable_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
