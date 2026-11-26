-- E1 order truth. Additive: one enum, nullable columns, one unique index, a set-aside table for
-- duplicate ticket lines, and the sent_at backfill. Nothing is dropped or renamed.

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

-- Before the unique index: pre-E1 ticketing was check-then-insert, so two sends fired together
-- could put one line on two tickets (review B5: 27 of 30 doubled sends). The earliest ticket
-- item of each line stays; every later one is copied, whole, into kds_ticket_items_set_aside
-- (nothing is lost) and then taken out of the live table, so the index can be built.
-- Corrected in place by T6 (26 Nov 2026): this migration had only been applied to throwaway
-- databases.
CREATE TABLE "kds_ticket_items_set_aside" (
  "id"            TEXT NOT NULL,
  "ticket_id"     TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL,
  "kept_id"       TEXT NOT NULL,
  "set_aside_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"        TEXT NOT NULL DEFAULT 'DUPLICATE_TICKET_LINE',
  CONSTRAINT "kds_ticket_items_set_aside_pkey" PRIMARY KEY ("id")
);

WITH ranked AS (
  SELECT ti."id", ti."ticket_id", ti."order_item_id", ti."created_at",
         first_value(ti."id") OVER w AS kept_id,
         row_number() OVER w AS rn
    FROM "kds_ticket_items" ti
  WINDOW w AS (PARTITION BY ti."order_item_id" ORDER BY ti."created_at", ti."id")
)
INSERT INTO "kds_ticket_items_set_aside" ("id", "ticket_id", "order_item_id", "created_at", "kept_id")
SELECT "id", "ticket_id", "order_item_id", "created_at", kept_id FROM ranked WHERE rn > 1;

DELETE FROM "kds_ticket_items" ti
 USING "kds_ticket_items_set_aside" sa
 WHERE ti."id" = sa."id";

-- A line gets a ticket once: the database refuses a second ticket item for the same line.
CREATE UNIQUE INDEX "kds_ticket_items_order_item_id_key" ON "kds_ticket_items"("order_item_id");

-- Cash handed over and change returned.
ALTER TABLE "payments"
  ADD COLUMN "tendered" DECIMAL(12,2),
  ADD COLUMN "change_given" DECIMAL(12,2);

-- Backfill sent_at (corrected by T6, after review S1): a line was sent when the kitchen or bar
-- got it, so a line with a ticket item takes that ticket item's time. A line that goes to no
-- station (NONE) on an order that left NEW and was not voided never gets a ticket; it is
-- stamped with the earliest ticket time of its order, or the order's last update when the order
-- had no ticket at all. A station line with no ticket was never sent (pre-E1 added it after the
-- first send and never ticketed it), so it stays unsent, as does every line of a NEW order.
UPDATE "order_items" oi
   SET "sent_at" = ti."created_at"
  FROM "kds_ticket_items" ti
 WHERE ti."order_item_id" = oi."id"
   AND oi."sent_at" IS NULL;

UPDATE "order_items" oi
   SET "sent_at" = COALESCE(
         (SELECT min(t2."created_at")
            FROM "kds_ticket_items" t2
            JOIN "order_items" o2 ON o2."id" = t2."order_item_id"
           WHERE o2."order_id" = oi."order_id"),
         o."updated_at")
  FROM "orders" o, "menu_items" m
 WHERE oi."order_id" = o."id"
   AND m."id" = oi."menu_item_id"
   AND m."station" = 'NONE'
   AND o."status" NOT IN ('NEW', 'VOIDED')
   AND oi."sent_at" IS NULL;
