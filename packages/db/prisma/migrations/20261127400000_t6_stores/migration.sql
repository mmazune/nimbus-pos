-- T6 phase 5: stores. Additive only.
CREATE TYPE "StoreRequestStatus" AS ENUM ('REQUESTED', 'ISSUED', 'RECEIVED', 'RECEIVED_SHORT', 'DECLINED', 'NOT_ARRIVED');
CREATE TYPE "StockCountKind" AS ENUM ('SPOT', 'FULL', 'BAR_SHIFT');
CREATE TYPE "StockCountStatus" AS ENUM ('OPEN', 'CLOSED');

ALTER TABLE "store_levels" ADD COLUMN "minimum" INTEGER, ADD COLUMN "fill_to" INTEGER;

ALTER TABLE "org_settings"
  ADD COLUMN "count_variance_pct" DECIMAL(5,2) NOT NULL DEFAULT 2,
  ADD COLUMN "count_variance_value" DECIMAL(12,2) NOT NULL DEFAULT 20000,
  ADD COLUMN "cost_change_pct" DECIMAL(5,2) NOT NULL DEFAULT 10;

CREATE TABLE "store_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "from_store_id" TEXT NOT NULL,
    "to_store_id" TEXT NOT NULL,
    "status" "StoreRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "issued_by_id" TEXT,
    "issued_at" TIMESTAMP(3),
    "received_by_id" TEXT,
    "received_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_count_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "store_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "store_requests_branch_id_status_idx" ON "store_requests"("branch_id", "status");

CREATE TABLE "store_request_lines" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "requested" INTEGER NOT NULL,
    "issued" INTEGER,
    "received" INTEGER,
    "short_by" INTEGER,
    "short_value" DECIMAL(14,2),
    "unit_cost" DECIMAL(18,6),
    CONSTRAINT "store_request_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "store_request_lines_request_id_idx" ON "store_request_lines"("request_id");
ALTER TABLE "store_request_lines" ADD CONSTRAINT "store_request_lines_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "store_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_orders_branch_id_idx" ON "purchase_orders"("branch_id");

CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "expected_cost_per_base" DECIMAL(18,6) NOT NULL,
    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "supplier_name" TEXT,
    "received_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "deliveries_branch_id_idx" ON "deliveries"("branch_id");

CREATE TABLE "delivery_lines" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ordered_amount" INTEGER,
    "outcome" TEXT NOT NULL,
    "cost_per_base" DECIMAL(18,6) NOT NULL,
    "expected_cost_per_base" DECIMAL(18,6),
    "average_before" DECIMAL(18,6) NOT NULL,
    "average_after" DECIMAL(18,6) NOT NULL,
    "cost_changed" BOOLEAN NOT NULL DEFAULT false,
    "change_pct" DECIMAL(9,2),
    CONSTRAINT "delivery_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "delivery_lines_delivery_id_idx" ON "delivery_lines"("delivery_id");
CREATE INDEX "delivery_lines_inventory_item_id_cost_changed_idx" ON "delivery_lines"("inventory_item_id", "cost_changed");
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "kind" "StockCountKind" NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'OPEN',
    "blind" BOOLEAN NOT NULL DEFAULT true,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "manager_note" TEXT,
    "manager_note_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_counts_branch_id_status_idx" ON "stock_counts"("branch_id", "status");

CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "count_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "counted" INTEGER,
    "book_at_save" INTEGER,
    "difference" INTEGER,
    "value" DECIMAL(14,2),
    "saved_at" TIMESTAMP(3),
    "saved_by_id" TEXT,
    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_count_lines_count_id_inventory_item_id_key" ON "stock_count_lines"("count_id", "inventory_item_id");
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_fkey"
  FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
