-- T2 phase 3 (E5): hold and fire, allergy and takeaway on a line, allergies kept on the order,
-- Collected on a ticket. Additive only: nullable or defaulted columns and one index.
-- AlterTable
ALTER TABLE "kds_tickets" ADD COLUMN     "collected_at" TIMESTAMP(3),
ADD COLUMN     "collected_by_id" TEXT,
ADD COLUMN     "fire_id" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "allergy" TEXT,
ADD COLUMN     "fire_at" TIMESTAMP(3),
ADD COLUMN     "fire_id" TEXT,
ADD COLUMN     "held_at" TIMESTAMP(3),
ADD COLUMN     "takeaway" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "order_items_fire_at_idx" ON "order_items"("fire_at");

