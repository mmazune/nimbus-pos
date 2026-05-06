-- BG5 — Device / Printer / Terminal Registry
-- Additive only: 2 new tables, 3 new enums. No existing column is altered.

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('POS_TERMINAL', 'KDS_SCREEN', 'PRINTER', 'PAYMENT_TERMINAL_STUB');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISABLED', 'RETIRED');

-- CreateEnum
CREATE TYPE "PrinterRouteType" AS ENUM ('RECEIPT', 'KITCHEN', 'BAR');

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "name" TEXT NOT NULL,
    "station" TEXT,
    "activation_code" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "paired_to_device_id" TEXT,
    "capabilities" JSONB,
    "metadata" JSONB,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_routes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "route_type" "PrinterRouteType" NOT NULL,
    "station" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printer_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_activation_code_key" ON "devices"("activation_code");

-- CreateIndex
CREATE UNIQUE INDEX "devices_branch_id_name_key" ON "devices"("branch_id", "name");

-- CreateIndex
CREATE INDEX "devices_org_id_branch_id_idx" ON "devices"("org_id", "branch_id");

-- CreateIndex
CREATE INDEX "devices_type_idx" ON "devices"("type");

-- CreateIndex
CREATE INDEX "devices_status_idx" ON "devices"("status");

-- CreateIndex
CREATE INDEX "devices_paired_to_device_id_idx" ON "devices"("paired_to_device_id");

-- CreateIndex
CREATE UNIQUE INDEX "printer_routes_branch_id_route_type_station_printer_id_key" ON "printer_routes"("branch_id", "route_type", "station", "printer_id");

-- CreateIndex
CREATE INDEX "printer_routes_branch_id_route_type_idx" ON "printer_routes"("branch_id", "route_type");

-- CreateIndex
CREATE INDEX "printer_routes_printer_id_idx" ON "printer_routes"("printer_id");

-- AddForeignKey: Device -> Organization
ALTER TABLE "devices" ADD CONSTRAINT "devices_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Device -> Branch
ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Device.pairedToDeviceId -> Device.id (self FK; SET NULL on delete)
ALTER TABLE "devices" ADD CONSTRAINT "devices_paired_to_device_id_fkey"
    FOREIGN KEY ("paired_to_device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PrinterRoute -> Organization
ALTER TABLE "printer_routes" ADD CONSTRAINT "printer_routes_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PrinterRoute -> Branch
ALTER TABLE "printer_routes" ADD CONSTRAINT "printer_routes_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PrinterRoute -> Device (printer)
ALTER TABLE "printer_routes" ADD CONSTRAINT "printer_routes_printer_id_fkey"
    FOREIGN KEY ("printer_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
