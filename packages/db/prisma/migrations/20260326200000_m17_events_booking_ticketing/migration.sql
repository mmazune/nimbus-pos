-- M17: Events + Booking Portal + Ticketing
-- Creates: EventStatus, EventBookingStatus, TicketStatus, TicketClassType, CheckInStatus enums
-- Creates: events, event_ticket_classes, event_bookings, event_tickets, event_check_ins, event_audit_logs tables

-- Enums
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "EventBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CHECKED_IN', 'NO_SHOW');
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'CANCELLED', 'CHECKED_IN', 'VOIDED');
CREATE TYPE "TicketClassType" AS ENUM ('GENERAL', 'VIP', 'TABLE', 'PACKAGE', 'OTHER');
CREATE TYPE "CheckInStatus" AS ENUM ('SUCCESS', 'DENIED', 'DUPLICATE');

-- Events table
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "portal_key" TEXT,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "booking_opens_at" TIMESTAMP(3),
    "booking_closes_at" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "capacity" INTEGER NOT NULL,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "checked_in_count" INTEGER NOT NULL DEFAULT 0,
    "venue_table_id" TEXT,
    "venue_notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- Event ticket classes table
CREATE TABLE "event_ticket_classes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TicketClassType" NOT NULL DEFAULT 'GENERAL',
    "price" DECIMAL(10,2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_ticket_classes_pkey" PRIMARY KEY ("id")
);

-- Event bookings table
CREATE TABLE "event_bookings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "ticket_class_id" TEXT NOT NULL,
    "reservation_id" TEXT,
    "booking_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2),
    "payment_id" TEXT,
    "status" "EventBookingStatus" NOT NULL DEFAULT 'PENDING',
    "booked_by_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id")
);

-- Event tickets table
CREATE TABLE "event_tickets" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "ticket_class_id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "holder_name" TEXT,
    "holder_phone" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "qr_token" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("id")
);

-- Event check-ins table
CREATE TABLE "event_check_ins" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "ticket_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_check_ins_pkey" PRIMARY KEY ("id")
);

-- Event audit logs table
CREATE TABLE "event_audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "ticket_id" TEXT,
    "type" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "events_portal_key_key" ON "events"("portal_key");
CREATE UNIQUE INDEX "events_branch_id_event_number_key" ON "events"("branch_id", "event_number");
CREATE UNIQUE INDEX "event_ticket_classes_event_id_name_key" ON "event_ticket_classes"("event_id", "name");
CREATE UNIQUE INDEX "event_bookings_branch_id_booking_number_key" ON "event_bookings"("branch_id", "booking_number");
CREATE UNIQUE INDEX "event_tickets_qr_token_key" ON "event_tickets"("qr_token");
CREATE UNIQUE INDEX "event_tickets_branch_id_ticket_number_key" ON "event_tickets"("branch_id", "ticket_number");

-- Indexes: events
CREATE INDEX "events_org_id_idx" ON "events"("org_id");
CREATE INDEX "events_branch_id_idx" ON "events"("branch_id");
CREATE INDEX "events_branch_id_starts_at_idx" ON "events"("branch_id", "starts_at");
CREATE INDEX "events_branch_id_status_idx" ON "events"("branch_id", "status");
CREATE INDEX "events_venue_table_id_idx" ON "events"("venue_table_id");
CREATE INDEX "events_created_by_id_idx" ON "events"("created_by_id");
CREATE INDEX "events_status_idx" ON "events"("status");
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");
CREATE INDEX "events_portal_key_idx" ON "events"("portal_key");
CREATE INDEX "events_created_at_idx" ON "events"("created_at");

-- Indexes: event_ticket_classes
CREATE INDEX "event_ticket_classes_org_id_idx" ON "event_ticket_classes"("org_id");
CREATE INDEX "event_ticket_classes_branch_id_idx" ON "event_ticket_classes"("branch_id");
CREATE INDEX "event_ticket_classes_event_id_idx" ON "event_ticket_classes"("event_id");
CREATE INDEX "event_ticket_classes_type_idx" ON "event_ticket_classes"("type");
CREATE INDEX "event_ticket_classes_created_at_idx" ON "event_ticket_classes"("created_at");

-- Indexes: event_bookings
CREATE INDEX "event_bookings_org_id_idx" ON "event_bookings"("org_id");
CREATE INDEX "event_bookings_branch_id_idx" ON "event_bookings"("branch_id");
CREATE INDEX "event_bookings_event_id_idx" ON "event_bookings"("event_id");
CREATE INDEX "event_bookings_ticket_class_id_idx" ON "event_bookings"("ticket_class_id");
CREATE INDEX "event_bookings_reservation_id_idx" ON "event_bookings"("reservation_id");
CREATE INDEX "event_bookings_payment_id_idx" ON "event_bookings"("payment_id");
CREATE INDEX "event_bookings_booked_by_id_idx" ON "event_bookings"("booked_by_id");
CREATE INDEX "event_bookings_status_idx" ON "event_bookings"("status");
CREATE INDEX "event_bookings_created_at_idx" ON "event_bookings"("created_at");

-- Indexes: event_tickets
CREATE INDEX "event_tickets_org_id_idx" ON "event_tickets"("org_id");
CREATE INDEX "event_tickets_branch_id_idx" ON "event_tickets"("branch_id");
CREATE INDEX "event_tickets_event_id_idx" ON "event_tickets"("event_id");
CREATE INDEX "event_tickets_booking_id_idx" ON "event_tickets"("booking_id");
CREATE INDEX "event_tickets_ticket_class_id_idx" ON "event_tickets"("ticket_class_id");
CREATE INDEX "event_tickets_status_idx" ON "event_tickets"("status");
CREATE INDEX "event_tickets_qr_token_idx" ON "event_tickets"("qr_token");
CREATE INDEX "event_tickets_created_at_idx" ON "event_tickets"("created_at");

-- Indexes: event_check_ins
CREATE INDEX "event_check_ins_org_id_idx" ON "event_check_ins"("org_id");
CREATE INDEX "event_check_ins_branch_id_idx" ON "event_check_ins"("branch_id");
CREATE INDEX "event_check_ins_event_id_idx" ON "event_check_ins"("event_id");
CREATE INDEX "event_check_ins_booking_id_idx" ON "event_check_ins"("booking_id");
CREATE INDEX "event_check_ins_ticket_id_idx" ON "event_check_ins"("ticket_id");
CREATE INDEX "event_check_ins_actor_user_id_idx" ON "event_check_ins"("actor_user_id");
CREATE INDEX "event_check_ins_status_idx" ON "event_check_ins"("status");
CREATE INDEX "event_check_ins_created_at_idx" ON "event_check_ins"("created_at");

-- Indexes: event_audit_logs
CREATE INDEX "event_audit_logs_org_id_idx" ON "event_audit_logs"("org_id");
CREATE INDEX "event_audit_logs_branch_id_idx" ON "event_audit_logs"("branch_id");
CREATE INDEX "event_audit_logs_event_id_idx" ON "event_audit_logs"("event_id");
CREATE INDEX "event_audit_logs_booking_id_idx" ON "event_audit_logs"("booking_id");
CREATE INDEX "event_audit_logs_ticket_id_idx" ON "event_audit_logs"("ticket_id");
CREATE INDEX "event_audit_logs_actor_user_id_idx" ON "event_audit_logs"("actor_user_id");
CREATE INDEX "event_audit_logs_type_idx" ON "event_audit_logs"("type");
CREATE INDEX "event_audit_logs_created_at_idx" ON "event_audit_logs"("created_at");

-- Foreign keys: events
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_venue_table_id_fkey" FOREIGN KEY ("venue_table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: event_ticket_classes
ALTER TABLE "event_ticket_classes" ADD CONSTRAINT "event_ticket_classes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_ticket_classes" ADD CONSTRAINT "event_ticket_classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_ticket_classes" ADD CONSTRAINT "event_ticket_classes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: event_bookings
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_ticket_class_id_fkey" FOREIGN KEY ("ticket_class_id") REFERENCES "event_ticket_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_booked_by_id_fkey" FOREIGN KEY ("booked_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: event_tickets
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "event_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_ticket_class_id_fkey" FOREIGN KEY ("ticket_class_id") REFERENCES "event_ticket_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: event_check_ins
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "event_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "event_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: event_audit_logs
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "event_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "event_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
