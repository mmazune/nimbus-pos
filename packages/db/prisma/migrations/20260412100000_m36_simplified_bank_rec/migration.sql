-- M36 Simplified Bank Reconciliation: schema enhancements for manual-first reconciliation
-- Replaces the expanded enterprise M36 design with a simple accountant-led flow.

-- ── Rename IGNORED → SKIPPED in BankStatementLineStatus ──
-- Since the base migration created IGNORED, we need to rename it to SKIPPED.
ALTER TYPE "BankStatementLineStatus" RENAME VALUE 'IGNORED' TO 'SKIPPED';

-- ── BankAccount: add GL account link ──
ALTER TABLE "bank_accounts" ADD COLUMN "gl_account_id" TEXT;
CREATE INDEX "bank_accounts_gl_account_id_idx" ON "bank_accounts"("gl_account_id");
ALTER TABLE "bank_accounts"
  ADD CONSTRAINT "bank_accounts_gl_account_id_fkey"
  FOREIGN KEY ("gl_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── BankStatementLine: add matchedById and matchedManualEntryId (columns only — FK to manual_bank_entries added later) ──
ALTER TABLE "bank_statement_lines" ADD COLUMN "matched_by_id" TEXT;
ALTER TABLE "bank_statement_lines" ADD COLUMN "matched_manual_entry_id" TEXT;
CREATE INDEX "bank_statement_lines_matched_manual_entry_id_idx" ON "bank_statement_lines"("matched_manual_entry_id");
ALTER TABLE "bank_statement_lines"
  ADD CONSTRAINT "bank_statement_lines_matched_by_id_fkey"
  FOREIGN KEY ("matched_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── BankReconciliation: add bankStatementId, statementBalance, matchedTotal, unmatchedCount, matchedCount ──
ALTER TABLE "bank_reconciliations" ADD COLUMN "bank_statement_id" TEXT;
ALTER TABLE "bank_reconciliations" ADD COLUMN "statement_balance" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "bank_reconciliations" ADD COLUMN "matched_total" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "bank_reconciliations" ADD COLUMN "unmatched_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bank_reconciliations" ADD COLUMN "matched_count" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "bank_reconciliations_bank_statement_id_idx" ON "bank_reconciliations"("bank_statement_id");
ALTER TABLE "bank_reconciliations"
  ADD CONSTRAINT "bank_reconciliations_bank_statement_id_fkey"
  FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── PeriodCloseRun: add retained earnings amounts and failure reason ──
ALTER TABLE "period_close_runs" ADD COLUMN "retained_earnings_amount" DECIMAL(12,2);
ALTER TABLE "period_close_runs" ADD COLUMN "income_total" DECIMAL(12,2);
ALTER TABLE "period_close_runs" ADD COLUMN "expense_total" DECIMAL(12,2);
ALTER TABLE "period_close_runs" ADD COLUMN "failure_reason" TEXT;

-- ── ManualBankEntry: new model for missing bank transactions during reconciliation ──
CREATE TABLE "manual_bank_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "tx_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "JournalLineDirection" NOT NULL,
    "description" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "account_id" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_bank_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manual_bank_entries_org_id_idx" ON "manual_bank_entries"("org_id");
CREATE INDEX "manual_bank_entries_branch_id_idx" ON "manual_bank_entries"("branch_id");
CREATE INDEX "manual_bank_entries_bank_account_id_idx" ON "manual_bank_entries"("bank_account_id");
CREATE INDEX "manual_bank_entries_account_id_idx" ON "manual_bank_entries"("account_id");
CREATE INDEX "manual_bank_entries_tx_date_idx" ON "manual_bank_entries"("tx_date");
CREATE INDEX "manual_bank_entries_org_id_bank_account_id_idx" ON "manual_bank_entries"("org_id", "bank_account_id");

ALTER TABLE "manual_bank_entries"
  ADD CONSTRAINT "manual_bank_entries_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_bank_entries"
  ADD CONSTRAINT "manual_bank_entries_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_bank_entries"
  ADD CONSTRAINT "manual_bank_entries_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_bank_entries"
  ADD CONSTRAINT "manual_bank_entries_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manual_bank_entries"
  ADD CONSTRAINT "manual_bank_entries_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Add FK from bank_statement_lines to manual_bank_entries (now that the table exists) ──
ALTER TABLE "bank_statement_lines"
  ADD CONSTRAINT "bank_statement_lines_matched_manual_entry_id_fkey"
  FOREIGN KEY ("matched_manual_entry_id") REFERENCES "manual_bank_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
