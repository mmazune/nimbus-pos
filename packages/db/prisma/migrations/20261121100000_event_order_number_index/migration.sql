-- H1F: the event quick-sale order-number allocator took MAX over the numeric part of every
-- order in the branch while holding the branch lock (a scan that grows with the night).
-- This expression index lets it read one row. Additive: one index, nothing dropped or altered.
--
-- NUMERIC, not INTEGER or BIGINT: an index expression is evaluated for EVERY row written to
-- "orders", so a cast that can overflow would make a long odd order number fail inserts
-- table-wide. NUMERIC cannot overflow, and a number that is not ORD- plus digits gives NULL.
-- Prisma cannot express an expression index in schema.prisma; the allocator query
-- (apps/api/src/modules/orders/order-number.ts) must use exactly this expression.
CREATE INDEX "orders_branch_id_order_number_numeric_idx"
  ON "orders" ("branch_id", ((CAST(SUBSTRING("order_number" FROM '^ORD-([0-9]+)$') AS NUMERIC))));
