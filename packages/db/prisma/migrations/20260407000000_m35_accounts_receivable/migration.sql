-- CreateEnum
CREATE TYPE "CustomerAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CustomerAccountType" AS ENUM ('CORPORATE', 'HOUSE', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'CREDIT_ADJUSTED');

-- CreateEnum
CREATE TYPE "InvoiceSourceType" AS ENUM ('DIRECT_BILL', 'EVENT', 'RESERVATION', 'CORPORATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ArCreditNoteStatus" AS ENUM ('OPEN', 'PARTIALLY_APPLIED', 'FULLY_APPLIED', 'VOID');

-- AlterEnum
BEGIN;
CREATE TYPE "PostingErrorStatus_new" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
ALTER TABLE "posting_errors" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "posting_errors" ALTER COLUMN "status" TYPE "PostingErrorStatus_new" USING ("status"::text::"PostingErrorStatus_new");
ALTER TYPE "PostingErrorStatus" RENAME TO "PostingErrorStatus_old";
ALTER TYPE "PostingErrorStatus_new" RENAME TO "PostingErrorStatus";
DROP TYPE "PostingErrorStatus_old";
ALTER TABLE "posting_errors" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterEnum
ALTER TYPE "PostingRunStatus" ADD VALUE 'PARTIAL';

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_reversal_of_id_fkey";

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "CustomerAccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "CustomerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tax_id" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "credit_limit" DECIMAL(12,2),
    "open_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "metadata" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "customer_account_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "source_type" "InvoiceSourceType" NOT NULL DEFAULT 'MANUAL',
    "source_document_id" TEXT,
    "invoice_date" DATE NOT NULL,
    "issue_date" DATE,
    "due_date" DATE NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMP(3),
    "issued_by_id" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,
    "account_id" TEXT,
    "cost_center_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_receipts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "customer_account_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "receipt_date" DATE NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(12,2) NOT NULL,
    "remaining_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL,
    "reference" TEXT,
    "journal_entry_id" TEXT,
    "received_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ar_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_allocations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(12,2) NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_credit_notes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "customer_account_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "credit_note_number" TEXT NOT NULL,
    "status" "ArCreditNoteStatus" NOT NULL DEFAULT 'OPEN',
    "credit_note_date" DATE NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(12,2) NOT NULL,
    "applied_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "issued_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ar_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_accounts_org_id_idx" ON "customer_accounts"("org_id");

-- CreateIndex
CREATE INDEX "customer_accounts_branch_id_idx" ON "customer_accounts"("branch_id");

-- CreateIndex
CREATE INDEX "customer_accounts_type_idx" ON "customer_accounts"("type");

-- CreateIndex
CREATE INDEX "customer_accounts_status_idx" ON "customer_accounts"("status");

-- CreateIndex
CREATE INDEX "customer_accounts_org_id_status_idx" ON "customer_accounts"("org_id", "status");

-- CreateIndex
CREATE INDEX "customer_accounts_org_id_type_status_idx" ON "customer_accounts"("org_id", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_org_id_code_key" ON "customer_accounts"("org_id", "code");

-- CreateIndex
CREATE INDEX "invoices_org_id_idx" ON "invoices"("org_id");

-- CreateIndex
CREATE INDEX "invoices_branch_id_idx" ON "invoices"("branch_id");

-- CreateIndex
CREATE INDEX "invoices_customer_account_id_idx" ON "invoices"("customer_account_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoices_source_type_idx" ON "invoices"("source_type");

-- CreateIndex
CREATE INDEX "invoices_source_document_id_idx" ON "invoices"("source_document_id");

-- CreateIndex
CREATE INDEX "invoices_org_id_status_idx" ON "invoices"("org_id", "status");

-- CreateIndex
CREATE INDEX "invoices_org_id_customer_account_id_status_idx" ON "invoices"("org_id", "customer_account_id", "status");

-- CreateIndex
CREATE INDEX "invoices_org_id_due_date_idx" ON "invoices"("org_id", "due_date");

-- CreateIndex
CREATE INDEX "invoices_org_id_customer_account_id_due_date_idx" ON "invoices"("org_id", "customer_account_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_org_id_invoice_number_key" ON "invoices"("org_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_org_id_idx" ON "invoice_lines"("org_id");

-- CreateIndex
CREATE INDEX "ar_receipts_org_id_idx" ON "ar_receipts"("org_id");

-- CreateIndex
CREATE INDEX "ar_receipts_branch_id_idx" ON "ar_receipts"("branch_id");

-- CreateIndex
CREATE INDEX "ar_receipts_customer_account_id_idx" ON "ar_receipts"("customer_account_id");

-- CreateIndex
CREATE INDEX "ar_receipts_status_idx" ON "ar_receipts"("status");

-- CreateIndex
CREATE INDEX "ar_receipts_receipt_date_idx" ON "ar_receipts"("receipt_date");

-- CreateIndex
CREATE INDEX "ar_receipts_journal_entry_id_idx" ON "ar_receipts"("journal_entry_id");

-- CreateIndex
CREATE INDEX "ar_receipts_org_id_status_idx" ON "ar_receipts"("org_id", "status");

-- CreateIndex
CREATE INDEX "ar_receipts_org_id_customer_account_id_status_idx" ON "ar_receipts"("org_id", "customer_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ar_receipts_org_id_receipt_number_key" ON "ar_receipts"("org_id", "receipt_number");

-- CreateIndex
CREATE INDEX "receipt_allocations_org_id_idx" ON "receipt_allocations"("org_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_receipt_id_idx" ON "receipt_allocations"("receipt_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_invoice_id_idx" ON "receipt_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_org_id_receipt_id_idx" ON "receipt_allocations"("org_id", "receipt_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_org_id_invoice_id_idx" ON "receipt_allocations"("org_id", "invoice_id");

-- CreateIndex
CREATE INDEX "ar_credit_notes_org_id_idx" ON "ar_credit_notes"("org_id");

-- CreateIndex
CREATE INDEX "ar_credit_notes_branch_id_idx" ON "ar_credit_notes"("branch_id");

-- CreateIndex
CREATE INDEX "ar_credit_notes_customer_account_id_idx" ON "ar_credit_notes"("customer_account_id");

-- CreateIndex
CREATE INDEX "ar_credit_notes_invoice_id_idx" ON "ar_credit_notes"("invoice_id");

-- CreateIndex
CREATE INDEX "ar_credit_notes_status_idx" ON "ar_credit_notes"("status");

-- CreateIndex
CREATE INDEX "ar_credit_notes_credit_note_date_idx" ON "ar_credit_notes"("credit_note_date");

-- CreateIndex
CREATE INDEX "ar_credit_notes_org_id_status_idx" ON "ar_credit_notes"("org_id", "status");

-- CreateIndex
CREATE INDEX "ar_credit_notes_org_id_customer_account_id_status_idx" ON "ar_credit_notes"("org_id", "customer_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ar_credit_notes_org_id_credit_note_number_key" ON "ar_credit_notes"("org_id", "credit_note_number");

-- CreateIndex
CREATE INDEX "till_sessions_branch_id_till_code_idx" ON "till_sessions"("branch_id", "till_code");

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "ar_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_credit_notes" ADD CONSTRAINT "ar_credit_notes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_credit_notes" ADD CONSTRAINT "ar_credit_notes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_credit_notes" ADD CONSTRAINT "ar_credit_notes_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_credit_notes" ADD CONSTRAINT "ar_credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_credit_notes" ADD CONSTRAINT "ar_credit_notes_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "exchange_rates_org_id_base_currency_code_quote_currency_code_id" RENAME TO "exchange_rates_org_id_base_currency_code_quote_currency_cod_idx";

-- RenameIndex
ALTER INDEX "kpi_snapshots_org_id_branch_id_scope_type_metric_window_snaps_i" RENAME TO "kpi_snapshots_org_id_branch_id_scope_type_metric_window_sna_idx";

-- RenameIndex
ALTER INDEX "promotion_suggestions_org_id_branch_id_period_start_period_idx" RENAME TO "promotion_suggestions_org_id_branch_id_period_start_period__idx";

-- RenameIndex
ALTER INDEX "schedule_assignments_schedule_id_shift_template_id_employee__ke" RENAME TO "schedule_assignments_schedule_id_shift_template_id_employee_key";

-- RenameIndex
ALTER INDEX "staff_insight_snapshots_org_id_employee_id_period_start_peri_ke" RENAME TO "staff_insight_snapshots_org_id_employee_id_period_start_per_key";

-- RenameIndex
ALTER INDEX "staff_risk_snapshots_org_id_branch_id_user_id_window_start_wind" RENAME TO "staff_risk_snapshots_org_id_branch_id_user_id_window_start__key";

