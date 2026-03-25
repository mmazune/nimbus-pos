-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "refunds" (
    "id"              TEXT NOT NULL,
    "org_id"          TEXT NOT NULL,
    "branch_id"       TEXT NOT NULL,
    "order_id"        TEXT NOT NULL,
    "payment_id"      TEXT NOT NULL,
    "provider"        TEXT NOT NULL,
    "amount"          DECIMAL(10,2) NOT NULL,
    "reason"          TEXT NOT NULL,
    "status"          "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id"   TEXT NOT NULL,
    "approved_by_id"  TEXT,
    "metadata"        JSONB,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refunds_org_id_idx" ON "refunds"("org_id");
CREATE INDEX "refunds_branch_id_idx" ON "refunds"("branch_id");
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");
CREATE INDEX "refunds_status_idx" ON "refunds"("status");
CREATE INDEX "refunds_created_by_id_idx" ON "refunds"("created_by_id");
CREATE INDEX "refunds_approved_by_id_idx" ON "refunds"("approved_by_id");
CREATE INDEX "refunds_created_at_idx" ON "refunds"("created_at");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
