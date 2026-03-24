-- M9: Inventory Stock Batches + Adjustments + Reorder Fields
-- Adds reorder_level, reorder_qty to inventory_items
-- Creates stock_batches and stock_adjustments tables

-- 1) Add reorder columns to inventory_items
ALTER TABLE "inventory_items" ADD COLUMN "reorder_level" DECIMAL(10,3) NOT NULL DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN "reorder_qty" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- 2) Create stock_batches table
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "batch_number" TEXT,
    "received_qty" DECIMAL(10,3) NOT NULL,
    "remaining_qty" DECIMAL(10,3) NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL,
    "goods_receipt_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- 3) Create stock_adjustments table
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qty_delta" DECIMAL(10,3) NOT NULL,
    "reason" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- 4) Indexes for stock_batches
CREATE INDEX "stock_batches_org_id_idx" ON "stock_batches"("org_id");
CREATE INDEX "stock_batches_branch_id_idx" ON "stock_batches"("branch_id");
CREATE INDEX "stock_batches_item_id_idx" ON "stock_batches"("item_id");
CREATE INDEX "stock_batches_expiry_date_idx" ON "stock_batches"("expiry_date");
CREATE INDEX "stock_batches_received_at_idx" ON "stock_batches"("received_at");
CREATE INDEX "stock_batches_branch_id_item_id_idx" ON "stock_batches"("branch_id", "item_id");

-- 5) Indexes for stock_adjustments
CREATE INDEX "stock_adjustments_org_id_idx" ON "stock_adjustments"("org_id");
CREATE INDEX "stock_adjustments_branch_id_idx" ON "stock_adjustments"("branch_id");
CREATE INDEX "stock_adjustments_item_id_idx" ON "stock_adjustments"("item_id");
CREATE INDEX "stock_adjustments_user_id_idx" ON "stock_adjustments"("user_id");

-- 6) Foreign keys for stock_batches
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) Foreign keys for stock_adjustments
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
