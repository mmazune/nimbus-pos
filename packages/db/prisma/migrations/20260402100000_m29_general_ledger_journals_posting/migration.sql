-- M29: General Ledger + Journal Entries + Posting Engine
-- Enums: JournalStatus, PostingRunStatus, PostingErrorStatus, JournalLineDirection
-- Models: JournalEntry, JournalLine, PostingRun, PostingError

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PostingRunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PostingErrorStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "JournalLineDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "journal_number" TEXT NOT NULL,
    "journal_date" DATE NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "source_key" TEXT,
    "source_document_id" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "fiscal_period_id" TEXT,
    "reversed_from_id" TEXT,
    "reversal_of_id" TEXT,
    "total_debit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMP(3),
    "posted_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "direction" "JournalLineDirection" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_runs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "source_key" TEXT NOT NULL,
    "source_document_id" TEXT,
    "status" "PostingRunStatus" NOT NULL DEFAULT 'PENDING',
    "journal_entry_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "run_key" TEXT,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_errors" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "posting_run_id" TEXT,
    "source_key" TEXT NOT NULL,
    "source_document_id" TEXT,
    "status" "PostingErrorStatus" NOT NULL DEFAULT 'OPEN',
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: journal_entries
CREATE UNIQUE INDEX "journal_entries_reversed_from_id_key" ON "journal_entries"("reversed_from_id");
CREATE UNIQUE INDEX "journal_entries_reversal_of_id_key" ON "journal_entries"("reversal_of_id");
CREATE UNIQUE INDEX "journal_entries_org_id_journal_number_key" ON "journal_entries"("org_id", "journal_number");
CREATE INDEX "journal_entries_org_id_idx" ON "journal_entries"("org_id");
CREATE INDEX "journal_entries_branch_id_idx" ON "journal_entries"("branch_id");
CREATE INDEX "journal_entries_journal_number_idx" ON "journal_entries"("journal_number");
CREATE INDEX "journal_entries_journal_date_idx" ON "journal_entries"("journal_date");
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");
CREATE INDEX "journal_entries_source_key_idx" ON "journal_entries"("source_key");
CREATE INDEX "journal_entries_source_document_id_idx" ON "journal_entries"("source_document_id");
CREATE INDEX "journal_entries_fiscal_period_id_idx" ON "journal_entries"("fiscal_period_id");
CREATE INDEX "journal_entries_org_id_status_idx" ON "journal_entries"("org_id", "status");
CREATE INDEX "journal_entries_org_id_journal_date_idx" ON "journal_entries"("org_id", "journal_date");
CREATE INDEX "journal_entries_org_id_source_key_source_document_id_idx" ON "journal_entries"("org_id", "source_key", "source_document_id");

-- CreateIndex: journal_lines
CREATE INDEX "journal_lines_org_id_idx" ON "journal_lines"("org_id");
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");
CREATE INDEX "journal_lines_cost_center_id_idx" ON "journal_lines"("cost_center_id");
CREATE INDEX "journal_lines_direction_idx" ON "journal_lines"("direction");
CREATE INDEX "journal_lines_org_id_account_id_idx" ON "journal_lines"("org_id", "account_id");

-- CreateIndex: posting_runs
CREATE INDEX "posting_runs_org_id_idx" ON "posting_runs"("org_id");
CREATE INDEX "posting_runs_branch_id_idx" ON "posting_runs"("branch_id");
CREATE INDEX "posting_runs_source_key_idx" ON "posting_runs"("source_key");
CREATE INDEX "posting_runs_source_document_id_idx" ON "posting_runs"("source_document_id");
CREATE INDEX "posting_runs_status_idx" ON "posting_runs"("status");
CREATE INDEX "posting_runs_run_key_idx" ON "posting_runs"("run_key");
CREATE INDEX "posting_runs_journal_entry_id_idx" ON "posting_runs"("journal_entry_id");
CREATE INDEX "posting_runs_org_id_source_key_source_document_id_idx" ON "posting_runs"("org_id", "source_key", "source_document_id");
CREATE INDEX "posting_runs_org_id_run_key_idx" ON "posting_runs"("org_id", "run_key");

-- CreateIndex: posting_errors
CREATE INDEX "posting_errors_org_id_idx" ON "posting_errors"("org_id");
CREATE INDEX "posting_errors_branch_id_idx" ON "posting_errors"("branch_id");
CREATE INDEX "posting_errors_posting_run_id_idx" ON "posting_errors"("posting_run_id");
CREATE INDEX "posting_errors_source_key_idx" ON "posting_errors"("source_key");
CREATE INDEX "posting_errors_source_document_id_idx" ON "posting_errors"("source_document_id");
CREATE INDEX "posting_errors_status_idx" ON "posting_errors"("status");
CREATE INDEX "posting_errors_code_idx" ON "posting_errors"("code");
CREATE INDEX "posting_errors_org_id_status_idx" ON "posting_errors"("org_id", "status");
CREATE INDEX "posting_errors_org_id_source_key_idx" ON "posting_errors"("org_id", "source_key");

-- AddForeignKey: journal_entries
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_from_id_fkey" FOREIGN KEY ("reversed_from_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: journal_lines
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: posting_runs
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: posting_errors
ALTER TABLE "posting_errors" ADD CONSTRAINT "posting_errors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posting_errors" ADD CONSTRAINT "posting_errors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "posting_errors" ADD CONSTRAINT "posting_errors_posting_run_id_fkey" FOREIGN KEY ("posting_run_id") REFERENCES "posting_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
