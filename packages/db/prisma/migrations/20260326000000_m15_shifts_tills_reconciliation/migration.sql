-- M15: Shifts + Till Sessions + Cash Reconciliation
-- CreateEnum: ShiftStatus, TillSessionStatus, CashMovementType, VarianceStatus
-- CreateTable: shifts, till_sessions, cash_movements, shift_close_summaries

-- Enums
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "TillSessionStatus" AS ENUM ('OPEN', 'RECONCILED', 'CLOSED');
CREATE TYPE "CashMovementType" AS ENUM ('OPENING_FLOAT', 'SAFE_DROP', 'CASH_PICKUP', 'PAID_IN', 'PAID_OUT', 'REFUND_PAYOUT');
CREATE TYPE "VarianceStatus" AS ENUM ('MATCHED', 'SHORT', 'OVER');

-- Shifts
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "shift_number" TEXT NOT NULL,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- Till Sessions
CREATE TABLE "till_sessions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "till_code" TEXT NOT NULL,
    "operator_user_id" TEXT NOT NULL,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciled_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "opening_float" DECIMAL(10,2) NOT NULL,
    "expected_cash" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "counted_cash" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "variance_status" "VarianceStatus",
    "status" "TillSessionStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "till_sessions_pkey" PRIMARY KEY ("id")
);

-- Cash Movements
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "till_session_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- Shift Close Summaries
CREATE TABLE "shift_close_summaries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "till_session_id" TEXT,
    "generated_by_id" TEXT NOT NULL,
    "gross_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cash_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "momo_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "card_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refund_cash_out" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "safe_drop_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pickup_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expected_cash" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "counted_cash" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "orders_closed_count" INTEGER NOT NULL DEFAULT 0,
    "refunds_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_close_summaries_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "shifts_branch_id_shift_number_key" ON "shifts"("branch_id", "shift_number");
CREATE UNIQUE INDEX "till_sessions_branch_id_till_code_status_key" ON "till_sessions"("branch_id", "till_code", "status");

-- Shifts indexes
CREATE INDEX "shifts_org_id_idx" ON "shifts"("org_id");
CREATE INDEX "shifts_branch_id_idx" ON "shifts"("branch_id");
CREATE INDEX "shifts_opened_by_id_idx" ON "shifts"("opened_by_id");
CREATE INDEX "shifts_closed_by_id_idx" ON "shifts"("closed_by_id");
CREATE INDEX "shifts_status_idx" ON "shifts"("status");
CREATE INDEX "shifts_branch_id_status_idx" ON "shifts"("branch_id", "status");
CREATE INDEX "shifts_created_at_idx" ON "shifts"("created_at");

-- Till Sessions indexes
CREATE INDEX "till_sessions_org_id_idx" ON "till_sessions"("org_id");
CREATE INDEX "till_sessions_branch_id_idx" ON "till_sessions"("branch_id");
CREATE INDEX "till_sessions_shift_id_idx" ON "till_sessions"("shift_id");
CREATE INDEX "till_sessions_operator_user_id_idx" ON "till_sessions"("operator_user_id");
CREATE INDEX "till_sessions_opened_by_id_idx" ON "till_sessions"("opened_by_id");
CREATE INDEX "till_sessions_status_idx" ON "till_sessions"("status");
CREATE INDEX "till_sessions_branch_id_status_idx" ON "till_sessions"("branch_id", "status");
CREATE INDEX "till_sessions_created_at_idx" ON "till_sessions"("created_at");

-- Cash Movements indexes
CREATE INDEX "cash_movements_org_id_idx" ON "cash_movements"("org_id");
CREATE INDEX "cash_movements_branch_id_idx" ON "cash_movements"("branch_id");
CREATE INDEX "cash_movements_till_session_id_idx" ON "cash_movements"("till_session_id");
CREATE INDEX "cash_movements_shift_id_idx" ON "cash_movements"("shift_id");
CREATE INDEX "cash_movements_type_idx" ON "cash_movements"("type");
CREATE INDEX "cash_movements_created_by_id_idx" ON "cash_movements"("created_by_id");
CREATE INDEX "cash_movements_created_at_idx" ON "cash_movements"("created_at");

-- Shift Close Summaries indexes
CREATE INDEX "shift_close_summaries_org_id_idx" ON "shift_close_summaries"("org_id");
CREATE INDEX "shift_close_summaries_branch_id_idx" ON "shift_close_summaries"("branch_id");
CREATE INDEX "shift_close_summaries_shift_id_idx" ON "shift_close_summaries"("shift_id");
CREATE INDEX "shift_close_summaries_till_session_id_idx" ON "shift_close_summaries"("till_session_id");
CREATE INDEX "shift_close_summaries_generated_by_id_idx" ON "shift_close_summaries"("generated_by_id");
CREATE INDEX "shift_close_summaries_created_at_idx" ON "shift_close_summaries"("created_at");

-- Foreign keys: shifts
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: till_sessions
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: cash_movements
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_till_session_id_fkey" FOREIGN KEY ("till_session_id") REFERENCES "till_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: shift_close_summaries
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_till_session_id_fkey" FOREIGN KEY ("till_session_id") REFERENCES "till_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
