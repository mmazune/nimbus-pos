-- H1 (21 Nov 2026): event till quick sale. Hand-written and additive.
-- New enums, nullable columns and new indexes only; nothing existing is removed or
-- altered, and no existing enum is extended. Not the raw `prisma migrate dev` diff (the repo carries unrelated
-- schema drift that a raw diff would apply).

-- CreateEnum
CREATE TYPE "CardScheme" AS ENUM ('VISA', 'MASTERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "MomoNetwork" AS ENUM ('MTN', 'AIRTEL');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "till_code" TEXT,
ADD COLUMN     "client_sale_id" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "card_scheme" "CardScheme",
ADD COLUMN     "card_last4" VARCHAR(4),
ADD COLUMN     "auth_code" TEXT,
ADD COLUMN     "terminal_id" TEXT,
ADD COLUMN     "till_code" TEXT,
ADD COLUMN     "momo_network" "MomoNetwork";

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "brand" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_org_id_client_sale_id_key" ON "orders"("org_id", "client_sale_id");

-- CreateIndex
CREATE INDEX "orders_org_id_branch_id_till_code_created_at_idx" ON "orders"("org_id", "branch_id", "till_code", "created_at");

-- CreateIndex
CREATE INDEX "payments_org_id_branch_id_till_code_created_at_idx" ON "payments"("org_id", "branch_id", "till_code", "created_at");

-- CreateIndex
CREATE INDEX "payments_org_id_card_scheme_idx" ON "payments"("org_id", "card_scheme");

-- CreateIndex
CREATE INDEX "menu_items_org_id_sku_idx" ON "menu_items"("org_id", "sku");
