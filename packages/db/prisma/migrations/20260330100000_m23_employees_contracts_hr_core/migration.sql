-- M23: Employees + Contracts + HR Core
-- CreateEnum: EmployeeStatus, EmploymentType, ContractStatus, SalaryBasis
-- CreateTable: employees, employment_contracts, positions, compensation_profiles

-- Enums
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'TEMPORARY', 'CASUAL', 'CONTRACTOR');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED');
CREATE TYPE "SalaryBasis" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY', 'SHIFT', 'OTHER');

-- Positions (must exist before employees reference it)
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "level" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- Compensation Profiles (must exist before employees reference it)
CREATE TABLE "compensation_profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "salary_basis" "SalaryBasis" NOT NULL,
    "base_amount" DECIMAL(10,2),
    "currency" TEXT,
    "allowances" JSONB,
    "deductions" JSONB,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_profiles_pkey" PRIMARY KEY ("id")
);

-- Employees
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "user_id" TEXT,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "hire_date" TIMESTAMP(3) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "employment_type" "EmploymentType" NOT NULL,
    "position_id" TEXT,
    "compensation_profile_id" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "address" JSONB,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- Employment Contracts
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "contract_status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "salary_basis" "SalaryBasis" NOT NULL,
    "salary_amount" DECIMAL(10,2),
    "terms_summary" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");
CREATE UNIQUE INDEX "employees_org_id_employee_code_key" ON "employees"("org_id", "employee_code");
CREATE UNIQUE INDEX "employment_contracts_org_id_contract_number_key" ON "employment_contracts"("org_id", "contract_number");
CREATE UNIQUE INDEX "positions_org_id_code_key" ON "positions"("org_id", "code");
CREATE UNIQUE INDEX "compensation_profiles_org_id_code_key" ON "compensation_profiles"("org_id", "code");

-- Indexes: employees
CREATE INDEX "employees_org_id_idx" ON "employees"("org_id");
CREATE INDEX "employees_branch_id_idx" ON "employees"("branch_id");
CREATE INDEX "employees_user_id_idx" ON "employees"("user_id");
CREATE INDEX "employees_status_idx" ON "employees"("status");
CREATE INDEX "employees_employment_type_idx" ON "employees"("employment_type");
CREATE INDEX "employees_position_id_idx" ON "employees"("position_id");
CREATE INDEX "employees_compensation_profile_id_idx" ON "employees"("compensation_profile_id");
CREATE INDEX "employees_org_id_branch_id_status_idx" ON "employees"("org_id", "branch_id", "status");

-- Indexes: employment_contracts
CREATE INDEX "employment_contracts_org_id_idx" ON "employment_contracts"("org_id");
CREATE INDEX "employment_contracts_branch_id_idx" ON "employment_contracts"("branch_id");
CREATE INDEX "employment_contracts_employee_id_idx" ON "employment_contracts"("employee_id");
CREATE INDEX "employment_contracts_contract_status_idx" ON "employment_contracts"("contract_status");
CREATE INDEX "employment_contracts_salary_basis_idx" ON "employment_contracts"("salary_basis");
CREATE INDEX "employment_contracts_created_by_id_idx" ON "employment_contracts"("created_by_id");

-- Indexes: positions
CREATE INDEX "positions_org_id_idx" ON "positions"("org_id");
CREATE INDEX "positions_branch_id_idx" ON "positions"("branch_id");
CREATE INDEX "positions_active_idx" ON "positions"("active");

-- Indexes: compensation_profiles
CREATE INDEX "compensation_profiles_org_id_idx" ON "compensation_profiles"("org_id");
CREATE INDEX "compensation_profiles_branch_id_idx" ON "compensation_profiles"("branch_id");
CREATE INDEX "compensation_profiles_active_idx" ON "compensation_profiles"("active");
CREATE INDEX "compensation_profiles_salary_basis_idx" ON "compensation_profiles"("salary_basis");

-- Foreign keys: employees
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_compensation_profile_id_fkey" FOREIGN KEY ("compensation_profile_id") REFERENCES "compensation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: employment_contracts
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: positions
ALTER TABLE "positions" ADD CONSTRAINT "positions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: compensation_profiles
ALTER TABLE "compensation_profiles" ADD CONSTRAINT "compensation_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compensation_profiles" ADD CONSTRAINT "compensation_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
