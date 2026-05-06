-- M34: Accounts Payable + Vendor Bills + Payments
-- Adds: Supplier, VendorBill, VendorBillLine, VendorPayment, VendorPaymentAllocation, CreditNote

-- CreateEnum
CREATE TYPE "VendorBillStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorBillSourceType" AS ENUM ('MANUAL_SERVICE', 'GRN_LINKED', 'EXPENSE');

-- CreateEnum
CREATE TYPE "VendorPaymentStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('OPEN', 'PARTIALLY_APPLIED', 'FULLY_APPLIED', 'VOID');

-- CreateTable: suppliers
CREATE TABLE "suppliers" (
    "id"           TEXT NOT NULL,
    "org_id"       TEXT NOT NULL,
    "branch_id"    TEXT,
    "name"         TEXT NOT NULL,
    "code"         TEXT,
    "contact_name" TEXT,
    "email"        TEXT,
    "phone"        TEXT,
    "address"      TEXT,
    "tax_id"       TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "notes"        TEXT,
    "metadata"     JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_bills
CREATE TABLE "vendor_bills" (
    "id"                 TEXT NOT NULL,
    "org_id"             TEXT NOT NULL,
    "branch_id"          TEXT,
    "supplier_id"        TEXT NOT NULL,
    "bill_number"        TEXT NOT NULL,
    "status"             "VendorBillStatus" NOT NULL DEFAULT 'DRAFT',
    "source_type"        "VendorBillSourceType" NOT NULL,
    "source_document_id" TEXT,
    "bill_date"          DATE NOT NULL,
    "issue_date"         DATE NOT NULL,
    "due_date"           DATE NOT NULL,
    "currency_code"      TEXT NOT NULL DEFAULT 'USD',
    "subtotal"           DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount"         DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approved_at"        TIMESTAMP(3),
    "approved_by_id"     TEXT,
    "notes"              TEXT,
    "metadata"           JSONB,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_bill_lines
CREATE TABLE "vendor_bill_lines" (
    "id"            TEXT NOT NULL,
    "vendor_bill_id" TEXT NOT NULL,
    "org_id"        TEXT NOT NULL,
    "description"   TEXT NOT NULL,
    "quantity"      DECIMAL(10,3) NOT NULL,
    "unit_price"    DECIMAL(12,2) NOT NULL,
    "tax_rate"      DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total"    DECIMAL(12,2) NOT NULL,
    "account_id"    TEXT,
    "cost_center_id" TEXT,
    "item_id"       TEXT,
    "metadata"      JSONB,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_payments
CREATE TABLE "vendor_payments" (
    "id"               TEXT NOT NULL,
    "org_id"           TEXT NOT NULL,
    "branch_id"        TEXT,
    "supplier_id"      TEXT NOT NULL,
    "payment_number"   TEXT NOT NULL,
    "status"           "VendorPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_date"     DATE NOT NULL,
    "currency_code"    TEXT NOT NULL DEFAULT 'USD',
    "amount"           DECIMAL(12,2) NOT NULL,
    "remaining_amount" DECIMAL(12,2) NOT NULL,
    "payment_method"   TEXT NOT NULL,
    "reference"        TEXT,
    "journal_entry_id" TEXT,
    "paid_by_id"       TEXT NOT NULL,
    "notes"            TEXT,
    "metadata"         JSONB,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_payment_allocations
CREATE TABLE "vendor_payment_allocations" (
    "id"               TEXT NOT NULL,
    "vendor_payment_id" TEXT NOT NULL,
    "vendor_bill_id"   TEXT NOT NULL,
    "org_id"           TEXT NOT NULL,
    "amount"           DECIMAL(12,2) NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: credit_notes
CREATE TABLE "credit_notes" (
    "id"                 TEXT NOT NULL,
    "org_id"             TEXT NOT NULL,
    "branch_id"          TEXT,
    "supplier_id"        TEXT NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "status"             "CreditNoteStatus" NOT NULL DEFAULT 'OPEN',
    "issue_date"         DATE NOT NULL,
    "expiry_date"        DATE,
    "currency_code"      TEXT NOT NULL DEFAULT 'USD',
    "total_amount"       DECIMAL(12,2) NOT NULL,
    "applied_amount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remaining_amount"   DECIMAL(12,2) NOT NULL,
    "source_bill_id"     TEXT,
    "reason"             TEXT,
    "notes"              TEXT,
    "metadata"           JSONB,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "suppliers_org_id_code_key" ON "suppliers"("org_id", "code");
CREATE UNIQUE INDEX "vendor_bills_org_id_bill_number_key" ON "vendor_bills"("org_id", "bill_number");
CREATE UNIQUE INDEX "vendor_payments_org_id_payment_number_key" ON "vendor_payments"("org_id", "payment_number");
CREATE UNIQUE INDEX "vendor_payment_allocations_vendor_payment_id_vendor_bill_id_key"
    ON "vendor_payment_allocations"("vendor_payment_id", "vendor_bill_id");
CREATE UNIQUE INDEX "credit_notes_org_id_credit_note_number_key" ON "credit_notes"("org_id", "credit_note_number");

-- CreateIndex
CREATE INDEX "suppliers_org_id_idx" ON "suppliers"("org_id");
CREATE INDEX "suppliers_branch_id_idx" ON "suppliers"("branch_id");
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");
CREATE INDEX "suppliers_org_id_is_active_idx" ON "suppliers"("org_id", "is_active");

CREATE INDEX "vendor_bills_org_id_idx" ON "vendor_bills"("org_id");
CREATE INDEX "vendor_bills_branch_id_idx" ON "vendor_bills"("branch_id");
CREATE INDEX "vendor_bills_supplier_id_idx" ON "vendor_bills"("supplier_id");
CREATE INDEX "vendor_bills_status_idx" ON "vendor_bills"("status");
CREATE INDEX "vendor_bills_due_date_idx" ON "vendor_bills"("due_date");
CREATE INDEX "vendor_bills_source_type_idx" ON "vendor_bills"("source_type");
CREATE INDEX "vendor_bills_source_document_id_idx" ON "vendor_bills"("source_document_id");
CREATE INDEX "vendor_bills_org_id_status_idx" ON "vendor_bills"("org_id", "status");
CREATE INDEX "vendor_bills_org_id_supplier_id_status_idx" ON "vendor_bills"("org_id", "supplier_id", "status");
CREATE INDEX "vendor_bills_org_id_due_date_idx" ON "vendor_bills"("org_id", "due_date");

CREATE INDEX "vendor_bill_lines_vendor_bill_id_idx" ON "vendor_bill_lines"("vendor_bill_id");
CREATE INDEX "vendor_bill_lines_org_id_idx" ON "vendor_bill_lines"("org_id");

CREATE INDEX "vendor_payments_org_id_idx" ON "vendor_payments"("org_id");
CREATE INDEX "vendor_payments_branch_id_idx" ON "vendor_payments"("branch_id");
CREATE INDEX "vendor_payments_supplier_id_idx" ON "vendor_payments"("supplier_id");
CREATE INDEX "vendor_payments_status_idx" ON "vendor_payments"("status");
CREATE INDEX "vendor_payments_payment_date_idx" ON "vendor_payments"("payment_date");
CREATE INDEX "vendor_payments_org_id_supplier_id_idx" ON "vendor_payments"("org_id", "supplier_id");
CREATE INDEX "vendor_payments_org_id_status_idx" ON "vendor_payments"("org_id", "status");

CREATE INDEX "vendor_payment_allocations_vendor_payment_id_idx" ON "vendor_payment_allocations"("vendor_payment_id");
CREATE INDEX "vendor_payment_allocations_vendor_bill_id_idx" ON "vendor_payment_allocations"("vendor_bill_id");
CREATE INDEX "vendor_payment_allocations_org_id_idx" ON "vendor_payment_allocations"("org_id");

CREATE INDEX "credit_notes_org_id_idx" ON "credit_notes"("org_id");
CREATE INDEX "credit_notes_branch_id_idx" ON "credit_notes"("branch_id");
CREATE INDEX "credit_notes_supplier_id_idx" ON "credit_notes"("supplier_id");
CREATE INDEX "credit_notes_status_idx" ON "credit_notes"("status");
CREATE INDEX "credit_notes_issue_date_idx" ON "credit_notes"("issue_date");
CREATE INDEX "credit_notes_org_id_supplier_id_idx" ON "credit_notes"("org_id", "supplier_id");
CREATE INDEX "credit_notes_org_id_status_idx" ON "credit_notes"("org_id", "status");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_vendor_bill_id_fkey"
    FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_paid_by_id_fkey"
    FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_journal_entry_id_fkey"
    FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_vendor_payment_id_fkey"
    FOREIGN KEY ("vendor_payment_id") REFERENCES "vendor_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_vendor_bill_id_fkey"
    FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
