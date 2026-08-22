-- Backend gap batch 4 — B5.4-D1 (2026-08-21): PostingError had no resolve/dismiss
-- write path anywhere in the API, for any role. Adds the columns needed to record who
-- resolved/dismissed an OPEN posting error, when, and why.
--
-- Hand-written (not `prisma migrate dev`'s raw diff): the raw diff against the current
-- migration history also included a large amount of pre-existing, unrelated schema
-- drift (FK drop/recreate cycles and index renames on sync/flags/training/maintenance
-- tables) that predates this change. Bundling that drift into this migration would
-- silently apply unrelated changes to production on the next deploy — out of scope for
-- B5.4-D1 and not something this batch is authorized to touch. Only the PostingError
-- change is included here.

-- AlterTable
ALTER TABLE "posting_errors" ADD COLUMN     "resolution_notes" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "posting_errors" ADD CONSTRAINT "posting_errors_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
