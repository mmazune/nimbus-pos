-- M16: Reservations + Deposits + Seating Bridge
-- CreateEnum: ReservationStatus, ReservationSource, ReservationDepositStatus, ReservationEventType
-- CreateTable: reservations, reservation_deposits, reservation_events

-- Enums
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "ReservationSource" AS ENUM ('WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'MANUAL', 'OTHER');
CREATE TYPE "ReservationDepositStatus" AS ENUM ('PENDING', 'RECEIVED', 'APPLIED', 'REFUNDED', 'FORFEITED', 'VOIDED');
CREATE TYPE "ReservationEventType" AS ENUM ('CREATED', 'CONFIRMED', 'DEPOSIT_RECORDED', 'TABLE_ASSIGNED', 'SEATED', 'CANCELLED', 'NO_SHOW', 'DEPOSIT_REFUNDED', 'DEPOSIT_FORFEITED');

-- Reservations
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "reservation_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "party_size" INTEGER NOT NULL,
    "reservation_at" TIMESTAMP(3) NOT NULL,
    "expected_duration_minutes" INTEGER,
    "source" "ReservationSource" NOT NULL DEFAULT 'MANUAL',
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "special_requests" TEXT,
    "table_id" TEXT,
    "seated_order_id" TEXT,
    "deposit_required" DECIMAL(10,2),
    "confirmed_at" TIMESTAMP(3),
    "seated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "no_show_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- Reservation Deposits
CREATE TABLE "reservation_deposits" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ReservationDepositStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "reference" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "reservation_deposits_pkey" PRIMARY KEY ("id")
);

-- Reservation Events (append-only)
CREATE TABLE "reservation_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "type" "ReservationEventType" NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_events_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "reservations_branch_id_reservation_number_key" ON "reservations"("branch_id", "reservation_number");

-- Indexes: reservations
CREATE INDEX "reservations_org_id_idx" ON "reservations"("org_id");
CREATE INDEX "reservations_branch_id_idx" ON "reservations"("branch_id");
CREATE INDEX "reservations_branch_id_reservation_at_idx" ON "reservations"("branch_id", "reservation_at");
CREATE INDEX "reservations_branch_id_status_idx" ON "reservations"("branch_id", "status");
CREATE INDEX "reservations_table_id_idx" ON "reservations"("table_id");
CREATE INDEX "reservations_seated_order_id_idx" ON "reservations"("seated_order_id");
CREATE INDEX "reservations_created_by_id_idx" ON "reservations"("created_by_id");
CREATE INDEX "reservations_reservation_at_idx" ON "reservations"("reservation_at");
CREATE INDEX "reservations_status_idx" ON "reservations"("status");
CREATE INDEX "reservations_created_at_idx" ON "reservations"("created_at");

-- Indexes: reservation_deposits
CREATE INDEX "reservation_deposits_org_id_idx" ON "reservation_deposits"("org_id");
CREATE INDEX "reservation_deposits_branch_id_idx" ON "reservation_deposits"("branch_id");
CREATE INDEX "reservation_deposits_reservation_id_idx" ON "reservation_deposits"("reservation_id");
CREATE INDEX "reservation_deposits_payment_id_idx" ON "reservation_deposits"("payment_id");
CREATE INDEX "reservation_deposits_recorded_by_id_idx" ON "reservation_deposits"("recorded_by_id");
CREATE INDEX "reservation_deposits_status_idx" ON "reservation_deposits"("status");
CREATE INDEX "reservation_deposits_recorded_at_idx" ON "reservation_deposits"("recorded_at");

-- Indexes: reservation_events
CREATE INDEX "reservation_events_org_id_idx" ON "reservation_events"("org_id");
CREATE INDEX "reservation_events_branch_id_idx" ON "reservation_events"("branch_id");
CREATE INDEX "reservation_events_reservation_id_idx" ON "reservation_events"("reservation_id");
CREATE INDEX "reservation_events_actor_user_id_idx" ON "reservation_events"("actor_user_id");
CREATE INDEX "reservation_events_type_idx" ON "reservation_events"("type");
CREATE INDEX "reservation_events_created_at_idx" ON "reservation_events"("created_at");

-- Foreign keys: reservations
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_seated_order_id_fkey" FOREIGN KEY ("seated_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: reservation_deposits
ALTER TABLE "reservation_deposits" ADD CONSTRAINT "reservation_deposits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_deposits" ADD CONSTRAINT "reservation_deposits_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_deposits" ADD CONSTRAINT "reservation_deposits_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_deposits" ADD CONSTRAINT "reservation_deposits_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservation_deposits" ADD CONSTRAINT "reservation_deposits_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: reservation_events
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
