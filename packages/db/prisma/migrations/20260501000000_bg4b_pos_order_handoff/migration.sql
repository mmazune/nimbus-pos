-- BG4.B — POS Order Handoff Operations
-- Adds two self-referencing nullable FK columns to `orders` so that:
--   * a child order produced by POST /api/pos/orders/:id/split-items can record
--     its source via `split_from_order_id`
--   * a source order voided by POST /api/pos/orders/merge can record the order
--     it was absorbed into via `merged_into_order_id`
--
-- Both columns are nullable, additive, and indexed. ON DELETE SET NULL keeps
-- existing rows valid even if a referenced order is later deleted.

ALTER TABLE "orders"
    ADD COLUMN "split_from_order_id"  TEXT,
    ADD COLUMN "merged_into_order_id" TEXT;

CREATE INDEX "orders_split_from_order_id_idx"  ON "orders"("split_from_order_id");
CREATE INDEX "orders_merged_into_order_id_idx" ON "orders"("merged_into_order_id");

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_split_from_order_id_fkey"
    FOREIGN KEY ("split_from_order_id") REFERENCES "orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_merged_into_order_id_fkey"
    FOREIGN KEY ("merged_into_order_id") REFERENCES "orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
