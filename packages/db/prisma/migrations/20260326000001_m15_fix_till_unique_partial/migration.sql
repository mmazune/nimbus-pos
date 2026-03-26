-- Migration: Replace full unique constraint on (branch_id, till_code, status)
-- with a partial unique index covering only OPEN sessions.
-- A till code can be reused across multiple shifts (after previous session is reconciled/closed).
-- Application-level check (service.openTill) already prevents duplicate OPEN sessions.

-- Drop the original full unique constraint
DROP INDEX "till_sessions_branch_id_till_code_status_key";

-- Add a regular composite index to support efficient lookups by (branch_id, till_code)
-- The existing @@index([branchId, tillCode]) in schema will create this
-- but we add it here explicitly for the partial constraint

-- Add partial unique index: only one OPEN session per till code per branch
CREATE UNIQUE INDEX "till_sessions_open_per_branch" ON "till_sessions" ("branch_id", "till_code") WHERE "status" = 'OPEN';
