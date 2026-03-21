-- CreateEnum
CREATE TYPE "QuickPinTier" AS ENUM ('LOW_6', 'HIGH_8');

-- AlterTable: Add M3.1 quick PIN fields to users
ALTER TABLE "users" ADD COLUMN "display_name" TEXT;
ALTER TABLE "users" ADD COLUMN "employee_code" TEXT;
ALTER TABLE "users" ADD COLUMN "quick_pin_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "pin_lookup_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "pin_length" INTEGER;
ALTER TABLE "users" ADD COLUMN "pin_tier" "QuickPinTier";
ALTER TABLE "users" ADD COLUMN "quick_pin_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "last_pin_changed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "pin_locked_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "failed_pin_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "users" ADD COLUMN "quick_pin_issued_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "quick_pin_issued_by_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_pin_lookup_hash_key" ON "users"("pin_lookup_hash");
