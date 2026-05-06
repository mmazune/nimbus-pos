-- Migration: M36 — Bank Reconciliation + Period Close + Locks
-- Created: 2026-04-08

-- ── Enums ──

CREATE TYPE "BankStatementStatus" AS ENUM ('PENDING', 'IMPORTED', 'RECONCILED', 'VOIDED');
CREATE TYPE "BankStatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');
CREATE TYPE "BankReconciliationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED');
CREATE TYPE "PeriodCloseRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- ── Tables ──

CREATE TABLE "bank_accounts" (
    "id"           TEXT NOT NULL,
    "org_id"       TEXT NOT NULL,
    "branch_id"    TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "bank_name"    TEXT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'UGX',
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "notes"        TEXT,
    "metadata"     JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_statements" (
    "id"               TEXT NOT NULL,
    "org_id"           TEXT NOT NULL,
    "branch_id"        TEXT NOT NULL,
    "bank_account_id"  TEXT NOT NULL,
    "statement_date"   DATE NOT NULL,
    "period_start"     DATE NOT NULL,
    "period_end"       DATE NOT NULL,
    "opening_balance"  DECIMAL(12,2) NOT NULL,
    "closing_balance"  DECIMAL(12,2) NOT NULL,
    "status"           "BankStatementStatus" NOT NULL DEFAULT 'PENDING',
    "imported_by_id"   TEXT NOT NULL,
    "reference"        TEXT,
    "notes"            TEXT,
    "metadata"         JSONB,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_statement_lines" (
    "id"                     TEXT NOT NULL,
    "org_id"                 TEXT NOT NULL,
    "bank_statement_id"      TEXT NOT NULL,
    "tx_date"                DATE NOT NULL,
    "description"            TEXT NOT NULL,
    "amount"                 DECIMAL(12,2) NOT NULL,
    "direction"              "JournalLineDirection" NOT NULL,
    "reference"              TEXT,
    "status"                 "BankStatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matched_journal_line_id" TEXT,
    "matched_at"             TIMESTAMP(3),
    "metadata"               JSONB,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_reconciliations" (
    "id"               TEXT NOT NULL,
    "org_id"           TEXT NOT NULL,
    "branch_id"        TEXT NOT NULL,
    "bank_account_id"  TEXT NOT NULL,
    "fiscal_period_id" TEXT,
    "status"           "BankReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "started_by_id"    TEXT NOT NULL,
    "completed_at"     TIMESTAMP(3),
    "completed_by_id"  TEXT,
    "notes"            TEXT,
    "metadata"         JSONB,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "period_close_runs" (
    "id"                                TEXT NOT NULL,
    "org_id"                            TEXT NOT NULL,
    "branch_id"                         TEXT,
    "fiscal_period_id"                  TEXT NOT NULL,
    "status"                            "PeriodCloseRunStatus" NOT NULL DEFAULT 'PENDING',
    "retained_earnings_journal_entry_id" TEXT,
    "closed_by_id"                      TEXT NOT NULL,
    "closed_at"                         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary"                           JSONB,
    "notes"                             TEXT,
    "metadata"                          JSONB,
    "created_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_close_runs_pkey" PRIMARY KEY ("id")
);

-- ── Unique Constraints ──

CREATE UNIQUE INDEX "bank_accounts_org_id_account_code_key" ON "bank_accounts"("org_id", "account_code");

-- ── Indexes ──

CREATE INDEX "bank_accounts_org_id_idx" ON "bank_accounts"("org_id");
CREATE INDEX "bank_accounts_branch_id_idx" ON "bank_accounts"("branch_id");
CREATE INDEX "bank_accounts_is_active_idx" ON "bank_accounts"("is_active");
CREATE INDEX "bank_accounts_org_id_branch_id_is_active_idx" ON "bank_accounts"("org_id", "branch_id", "is_active");

CREATE INDEX "bank_statements_org_id_idx" ON "bank_statements"("org_id");
CREATE INDEX "bank_statements_branch_id_idx" ON "bank_statements"("branch_id");
CREATE INDEX "bank_statements_bank_account_id_idx" ON "bank_statements"("bank_account_id");
CREATE INDEX "bank_statements_status_idx" ON "bank_statements"("status");
CREATE INDEX "bank_statements_statement_date_idx" ON "bank_statements"("statement_date");
CREATE INDEX "bank_statements_org_id_bank_account_id_status_idx" ON "bank_statements"("org_id", "bank_account_id", "status");

CREATE INDEX "bank_statement_lines_org_id_idx" ON "bank_statement_lines"("org_id");
CREATE INDEX "bank_statement_lines_bank_statement_id_idx" ON "bank_statement_lines"("bank_statement_id");
CREATE INDEX "bank_statement_lines_tx_date_idx" ON "bank_statement_lines"("tx_date");
CREATE INDEX "bank_statement_lines_status_idx" ON "bank_statement_lines"("status");
CREATE INDEX "bank_statement_lines_matched_journal_line_id_idx" ON "bank_statement_lines"("matched_journal_line_id");
CREATE INDEX "bank_statement_lines_bank_statement_id_status_idx" ON "bank_statement_lines"("bank_statement_id", "status");

CREATE INDEX "bank_reconciliations_org_id_idx" ON "bank_reconciliations"("org_id");
CREATE INDEX "bank_reconciliations_branch_id_idx" ON "bank_reconciliations"("branch_id");
CREATE INDEX "bank_reconciliations_bank_account_id_idx" ON "bank_reconciliations"("bank_account_id");
CREATE INDEX "bank_reconciliations_fiscal_period_id_idx" ON "bank_reconciliations"("fiscal_period_id");
CREATE INDEX "bank_reconciliations_status_idx" ON "bank_reconciliations"("status");
CREATE INDEX "bank_reconciliations_org_id_branch_id_status_idx" ON "bank_reconciliations"("org_id", "branch_id", "status");
CREATE INDEX "bank_reconciliations_org_id_bank_account_id_fiscal_period_id_idx" ON "bank_reconciliations"("org_id", "bank_account_id", "fiscal_period_id");

CREATE INDEX "period_close_runs_org_id_idx" ON "period_close_runs"("org_id");
CREATE INDEX "period_close_runs_branch_id_idx" ON "period_close_runs"("branch_id");
CREATE INDEX "period_close_runs_fiscal_period_id_idx" ON "period_close_runs"("fiscal_period_id");
CREATE INDEX "period_close_runs_status_idx" ON "period_close_runs"("status");
CREATE INDEX "period_close_runs_org_id_fiscal_period_id_idx" ON "period_close_runs"("org_id", "fiscal_period_id");

-- ── Foreign Keys ──

ALTER TABLE "bank_accounts"
    ADD CONSTRAINT "bank_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_accounts"
    ADD CONSTRAINT "bank_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_statements"
    ADD CONSTRAINT "bank_statements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statements"
    ADD CONSTRAINT "bank_statements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statements"
    ADD CONSTRAINT "bank_statements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statements"
    ADD CONSTRAINT "bank_statements_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_statement_lines"
    ADD CONSTRAINT "bank_statement_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines"
    ADD CONSTRAINT "bank_statement_lines_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "period_close_runs"
    ADD CONSTRAINT "period_close_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "period_close_runs"
    ADD CONSTRAINT "period_close_runs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "period_close_runs"
    ADD CONSTRAINT "period_close_runs_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "period_close_runs"
    ADD CONSTRAINT "period_close_runs_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
