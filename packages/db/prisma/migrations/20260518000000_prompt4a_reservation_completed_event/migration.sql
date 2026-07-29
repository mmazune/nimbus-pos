-- Supervisor Reconstruction Prompt 4A — reservation lifecycle completion
--
-- Adds a COMPLETED lifecycle event type so that both the manual
-- SEATED -> COMPLETED transition and the automatic order-close
-- completion can persist a truthful ReservationEvent row.
--
-- No other schema change is required: Reservation.completed_at already
-- exists, and the branch+status / branch+reservation_at indexes already
-- cover the new active/history query split.
--
-- NOTE: PostgreSQL requires enum-value additions to run outside an
-- explicit transaction block; Prisma Migrate applies this statement on
-- its own, consistent with prior enum-extension migrations in this repo
-- (e.g. 20260328000000_m20_1_reporting_depth).

ALTER TYPE "ReservationEventType" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'SEATED';
