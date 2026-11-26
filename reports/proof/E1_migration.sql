-- E1 order truth. Additive only: one enum, nullable columns, one unique index, one backfill.
-- Nothing is dropped, renamed or rewritten except the sent_at backfill below.

-- Why a void was made (a closed list; "OTHER" needs a note, enforced by the API).
CREATE TYPE "order_item_void_reason" AS ENUM (
  'GUEST_CHANGED_MIND', 'WRONG_ITEM', 'KITCHEN_RAN_OUT', 'TOOK_TOO_LONG', 'GUEST_COMPLAINT', 'OTHER'
);

-- Send by line and void by line.
ALTER TABLE "order_items"
  ADD COLUMN "sent_at" TIMESTAMP(3),
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "voided_by_id" TEXT,
  ADD COLUMN "void_reason" "order_item_void_reason",
  ADD COLUMN "void_note" TEXT,
  ADD COLUMN "was_made" BOOLEAN;

-- A voided line stays on its kitchen/bar ticket and shows as voided.
ALTER TABLE "kds_ticket_items"
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "void_reason" "order_item_void_reason",
  ADD COLUMN "was_made" BOOLEAN;

-- A line gets a ticket once: the database refuses a second ticket item for the same line.
CREATE UNIQUE INDEX "kds_ticket_items_order_item_id_key" ON "kds_ticket_items"("order_item_id");

-- Cash handed over and change returned.
ALTER TABLE "payments"
  ADD COLUMN "tendered" DECIMAL(12,2),
  ADD COLUMN "change_given" DECIMAL(12,2);

-- Backfill: every line of an order that has left NEW was sent. The order's last update is the
-- best stamp available; the true send time of an old line was never recorded.
UPDATE "order_items" oi
   SET "sent_at" = o."updated_at"
  FROM "orders" o
 WHERE oi."order_id" = o."id"
   AND o."status" <> 'NEW'
   AND oi."sent_at" IS NULL;
