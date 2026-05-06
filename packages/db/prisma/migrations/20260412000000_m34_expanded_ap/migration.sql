-- M34 Expanded AP: CounterpartyType, RecurringBillProfile, PayableReminder, VendorBill extensions

-- Create new enums
CREATE TYPE "CounterpartyType" AS ENUM ('INVENTORY_SUPPLIER', 'SERVICE_PROVIDER', 'UTILITY_PROVIDER', 'SUBSCRIPTION_VENDOR', 'CONTRACTOR', 'FREELANCER', 'ENTERTAINER', 'LANDLORD', 'OTHER');
CREATE TYPE "RecurrenceCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');
CREATE TYPE "PayableReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'EXPIRED');

-- Add counterparty fields to suppliers
ALTER TABLE "suppliers" ADD COLUMN "counterparty_type" "CounterpartyType" NOT NULL DEFAULT 'INVENTORY_SUPPLIER';
ALTER TABLE "suppliers" ADD COLUMN "payment_term_days" INTEGER;
ALTER TABLE "suppliers" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "bank_account_no" TEXT;

-- Add new columns to vendor_bills
ALTER TABLE "vendor_bills" ADD COLUMN "recurring_profile_id" TEXT;
ALTER TABLE "vendor_bills" ADD COLUMN "service_period_start" DATE;
ALTER TABLE "vendor_bills" ADD COLUMN "service_period_end" DATE;

-- Create RecurringBillProfile table (source_type is TEXT initially; we set the column type after enum commit)
CREATE TABLE "recurring_bill_profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "profile_name" TEXT NOT NULL,
    "cadence" "RecurrenceCadence" NOT NULL,
    "expected_amount" DECIMAL(12,2),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "next_due_date" DATE NOT NULL,
    "lead_days" INTEGER NOT NULL DEFAULT 7,
    "start_date" DATE,
    "end_date" DATE,
    "source_type" TEXT NOT NULL DEFAULT 'RECURRING',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_generated_at" TIMESTAMP(3),
    "last_generated_bill_id" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bill_profiles_pkey" PRIMARY KEY ("id")
);

-- Create PayableReminder table
CREATE TABLE "payable_reminders" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "supplier_id" TEXT,
    "vendor_bill_id" TEXT,
    "status" "PayableReminderStatus" NOT NULL DEFAULT 'PENDING',
    "remind_at" TIMESTAMP(3) NOT NULL,
    "due_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payable_reminders_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys for recurring_bill_profiles
ALTER TABLE "recurring_bill_profiles" ADD CONSTRAINT "recurring_bill_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_bill_profiles" ADD CONSTRAINT "recurring_bill_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_bill_profiles" ADD CONSTRAINT "recurring_bill_profiles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys for payable_reminders
ALTER TABLE "payable_reminders" ADD CONSTRAINT "payable_reminders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payable_reminders" ADD CONSTRAINT "payable_reminders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payable_reminders" ADD CONSTRAINT "payable_reminders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payable_reminders" ADD CONSTRAINT "payable_reminders_vendor_bill_id_fkey" FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payable_reminders" ADD CONSTRAINT "payable_reminders_dismissed_by_id_fkey" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Key for vendor_bills.recurring_profile_id
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_recurring_profile_id_fkey" FOREIGN KEY ("recurring_profile_id") REFERENCES "recurring_bill_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for suppliers
CREATE INDEX "suppliers_counterparty_type_idx" ON "suppliers"("counterparty_type");
CREATE INDEX "suppliers_org_id_counterparty_type_idx" ON "suppliers"("org_id", "counterparty_type");

-- Indexes for vendor_bills
CREATE INDEX "vendor_bills_recurring_profile_id_idx" ON "vendor_bills"("recurring_profile_id");

-- Indexes for recurring_bill_profiles
CREATE INDEX "recurring_bill_profiles_org_id_idx" ON "recurring_bill_profiles"("org_id");
CREATE INDEX "recurring_bill_profiles_branch_id_idx" ON "recurring_bill_profiles"("branch_id");
CREATE INDEX "recurring_bill_profiles_supplier_id_idx" ON "recurring_bill_profiles"("supplier_id");
CREATE INDEX "recurring_bill_profiles_is_active_idx" ON "recurring_bill_profiles"("is_active");
CREATE INDEX "recurring_bill_profiles_cadence_idx" ON "recurring_bill_profiles"("cadence");
CREATE INDEX "recurring_bill_profiles_next_due_date_idx" ON "recurring_bill_profiles"("next_due_date");
CREATE INDEX "recurring_bill_profiles_org_id_is_active_idx" ON "recurring_bill_profiles"("org_id", "is_active");
CREATE INDEX "recurring_bill_profiles_org_id_branch_id_cadence_idx" ON "recurring_bill_profiles"("org_id", "branch_id", "cadence");
CREATE INDEX "recurring_bill_profiles_org_id_next_due_date_idx" ON "recurring_bill_profiles"("org_id", "next_due_date");

-- Indexes for payable_reminders
CREATE INDEX "payable_reminders_org_id_idx" ON "payable_reminders"("org_id");
CREATE INDEX "payable_reminders_branch_id_idx" ON "payable_reminders"("branch_id");
CREATE INDEX "payable_reminders_supplier_id_idx" ON "payable_reminders"("supplier_id");
CREATE INDEX "payable_reminders_vendor_bill_id_idx" ON "payable_reminders"("vendor_bill_id");
CREATE INDEX "payable_reminders_status_idx" ON "payable_reminders"("status");
CREATE INDEX "payable_reminders_remind_at_idx" ON "payable_reminders"("remind_at");
CREATE INDEX "payable_reminders_due_date_idx" ON "payable_reminders"("due_date");
CREATE INDEX "payable_reminders_org_id_status_remind_at_idx" ON "payable_reminders"("org_id", "status", "remind_at");
CREATE INDEX "payable_reminders_org_id_branch_id_status_idx" ON "payable_reminders"("org_id", "branch_id", "status");
