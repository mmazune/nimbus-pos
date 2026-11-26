-- T2 phase 1 (E2): offers, sold out, a number left. Additive only: new enums, new tables, nullable or defaulted columns.
-- CreateEnum
CREATE TYPE "MenuAvailabilityState" AS ENUM ('AVAILABLE', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "MenuAvailabilitySource" AS ENUM ('MANUAL', 'COUNT');

-- CreateEnum
CREATE TYPE "MenuAvailabilityChange" AS ENUM ('SOLD_OUT', 'AVAILABLE', 'SET_LEFT', 'TAKEN', 'LOW', 'GIVEN_BACK', 'RESET');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "is_offer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offer_note" TEXT,
ADD COLUMN     "offer_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "normal_price" DECIMAL(10,2),
ADD COLUMN     "offer_base_price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "menu_item_availability" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "state" "MenuAvailabilityState" NOT NULL DEFAULT 'AVAILABLE',
    "source" "MenuAvailabilitySource" NOT NULL DEFAULT 'MANUAL',
    "left" INTEGER,
    "low_at" INTEGER NOT NULL DEFAULT 5,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_availability_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "change" "MenuAvailabilityChange" NOT NULL,
    "from_state" "MenuAvailabilityState" NOT NULL,
    "to_state" "MenuAvailabilityState" NOT NULL,
    "source" "MenuAvailabilitySource" NOT NULL,
    "left_before" INTEGER,
    "left_after" INTEGER,
    "by_user_id" TEXT,
    "order_id" TEXT,
    "order_item_id" TEXT,
    "batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_availability_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_availability_menu_item_id_key" ON "menu_item_availability"("menu_item_id");

-- CreateIndex
CREATE INDEX "menu_item_availability_branch_id_idx" ON "menu_item_availability"("branch_id");

-- CreateIndex
CREATE INDEX "menu_availability_logs_branch_id_created_at_idx" ON "menu_availability_logs"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "menu_availability_logs_menu_item_id_created_at_idx" ON "menu_availability_logs"("menu_item_id", "created_at");

-- CreateIndex
CREATE INDEX "menu_availability_logs_batch_id_idx" ON "menu_availability_logs"("batch_id");

-- AddForeignKey
ALTER TABLE "menu_item_availability" ADD CONSTRAINT "menu_item_availability_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_availability_logs" ADD CONSTRAINT "menu_availability_logs_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

