-- M11: KDS + Station Routing + SLA Timers
-- CreateEnum: KdsTicketStatus, KdsUrgencyState
-- CreateTable: kds_tickets, kds_ticket_items, kds_sla_configs

-- Enums
CREATE TYPE "KdsTicketStatus" AS ENUM ('QUEUED', 'READY', 'RECALLED');
CREATE TYPE "KdsUrgencyState" AS ENUM ('GREEN', 'AMBER', 'RED');

-- KDS Tickets
CREATE TABLE "kds_tickets" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "status" "KdsTicketStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ready_at" TIMESTAMP(3),
    "recalled_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kds_tickets_pkey" PRIMARY KEY ("id")
);

-- KDS Ticket Items
CREATE TABLE "kds_ticket_items" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kds_ticket_items_pkey" PRIMARY KEY ("id")
);

-- KDS SLA Configs
CREATE TABLE "kds_sla_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "green_seconds" INTEGER NOT NULL,
    "amber_seconds" INTEGER NOT NULL,
    "red_seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kds_sla_configs_pkey" PRIMARY KEY ("id")
);

-- Indexes: kds_tickets
CREATE INDEX "kds_tickets_org_id_idx" ON "kds_tickets"("org_id");
CREATE INDEX "kds_tickets_branch_id_idx" ON "kds_tickets"("branch_id");
CREATE INDEX "kds_tickets_order_id_idx" ON "kds_tickets"("order_id");
CREATE INDEX "kds_tickets_station_idx" ON "kds_tickets"("station");
CREATE INDEX "kds_tickets_status_idx" ON "kds_tickets"("status");
CREATE INDEX "kds_tickets_branch_id_station_status_idx" ON "kds_tickets"("branch_id", "station", "status");
CREATE INDEX "kds_tickets_created_at_idx" ON "kds_tickets"("created_at");

-- Indexes: kds_ticket_items
CREATE INDEX "kds_ticket_items_ticket_id_idx" ON "kds_ticket_items"("ticket_id");
CREATE INDEX "kds_ticket_items_order_item_id_idx" ON "kds_ticket_items"("order_item_id");

-- Indexes: kds_sla_configs
CREATE UNIQUE INDEX "kds_sla_configs_branch_id_station_key" ON "kds_sla_configs"("branch_id", "station");
CREATE INDEX "kds_sla_configs_org_id_idx" ON "kds_sla_configs"("org_id");
CREATE INDEX "kds_sla_configs_branch_id_idx" ON "kds_sla_configs"("branch_id");

-- Foreign Keys: kds_tickets
ALTER TABLE "kds_tickets" ADD CONSTRAINT "kds_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kds_tickets" ADD CONSTRAINT "kds_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kds_tickets" ADD CONSTRAINT "kds_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys: kds_ticket_items
ALTER TABLE "kds_ticket_items" ADD CONSTRAINT "kds_ticket_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "kds_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kds_ticket_items" ADD CONSTRAINT "kds_ticket_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys: kds_sla_configs
ALTER TABLE "kds_sla_configs" ADD CONSTRAINT "kds_sla_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kds_sla_configs" ADD CONSTRAINT "kds_sla_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
