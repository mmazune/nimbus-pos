-- T6 phase 4: stock that moves. Additive only: enums, nullable or defaulted columns, new tables.
CREATE TYPE "StockKind" AS ENUM ('COUNT', 'WEIGHT', 'VOLUME');
CREATE TYPE "SoldAs" AS ENUM ('AS_BOUGHT', 'MEASURE', 'RECIPE', 'NOT_TRACKED');
CREATE TYPE "StoreKind" AS ENUM ('MAIN', 'SECONDARY', 'POINT');
CREATE TYPE "StockMovementType" AS ENUM ('RECEIVE', 'ISSUE_OUT', 'ISSUE_IN', 'SALE', 'SALE_REVERSAL',
  'REMAKE', 'WASTE', 'STAFF_MEAL', 'ON_THE_HOUSE', 'MISSING', 'FOUND', 'COUNT_ADJUST',
  'RETURN_TO_SUPPLIER', 'OPENING');

ALTER TABLE "inventory_items"
  ADD COLUMN "stock_kind" "StockKind",
  ADD COLUMN "pack_size" INTEGER,
  ADD COLUMN "cost_per_base" DECIMAL(18,6) NOT NULL DEFAULT 0;

ALTER TABLE "recipe_ingredients" ADD COLUMN "amount_base" INTEGER;

ALTER TABLE "menu_items"
  ADD COLUMN "sold_as" "SoldAs" NOT NULL DEFAULT 'NOT_TRACKED',
  ADD COLUMN "stock_item_id" TEXT;

ALTER TABLE "menu_item_servings" ADD COLUMN "stock_amount" INTEGER;

ALTER TABLE "org_settings" ADD COLUMN "waste_value_limit" DECIMAL(12,2) NOT NULL DEFAULT 50000;

CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StoreKind" NOT NULL,
    "feeds_from_store_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stores_branch_id_idx" ON "stores"("branch_id");

CREATE TABLE "station_stores" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "station" "PrepStation" NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "station_stores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "station_stores_branch_id_station_key" ON "station_stores"("branch_id", "station");

CREATE TABLE "store_levels" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "store_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "store_levels_store_id_inventory_item_id_key" ON "store_levels"("store_id", "inventory_item_id");

CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "order_item_id" TEXT,
    "user_id" TEXT,
    "approved_by_id" TEXT,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_movements_dedupe_key_key" ON "stock_movements"("dedupe_key");
CREATE INDEX "stock_movements_branch_id_inventory_item_id_idx" ON "stock_movements"("branch_id", "inventory_item_id");
CREATE INDEX "stock_movements_store_id_inventory_item_id_idx" ON "stock_movements"("store_id", "inventory_item_id");
CREATE INDEX "stock_movements_order_item_id_idx" ON "stock_movements"("order_item_id");
CREATE INDEX "stock_movements_ref_type_ref_id_idx" ON "stock_movements"("ref_type", "ref_id");

-- The ledger is append only (R17): a correction is a new row, never an edit or a delete.
CREATE FUNCTION "stock_movements_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append only: % refused', TG_OP;
END;
$$;
CREATE TRIGGER "stock_movements_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION "stock_movements_append_only"();
