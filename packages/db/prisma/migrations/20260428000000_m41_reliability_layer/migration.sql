-- M41 — Reliability Layer (Idempotency + Offline Contracts + Sync)

-- Enums
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'CONFLICT');

CREATE TYPE "SyncJobType" AS ENUM (
  'ORDER_DRAFT_UPDATE','ORDER_SUBMIT','PAYMENT_CAPTURE','REFUND_CREATE',
  'AR_RECEIPT_CREATE','AP_PAYMENT_CREATE','RESERVATION_HOLD','RESERVATION_CONFIRM',
  'EVENT_BOOKING_HOLD','EVENT_BOOKING_CONFIRM','STOCK_ADJUSTMENT','ATTENDANCE_EVENT',
  'SHIFT_ACTION','GENERIC_REPLAY'
);

CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED','IN_PROGRESS','SUCCEEDED','FAILED','RETRYABLE','CONFLICT','CANCELLED');
CREATE TYPE "SyncJobOrigin" AS ENUM ('OFFLINE_CLIENT','SERVICE_WORKER','SUPPORT_REPLAY','SYSTEM_RETRY');
CREATE TYPE "SyncConflictStatus" AS ENUM ('OPEN','RESOLVED','DISMISSED');
CREATE TYPE "SyncConflictResolution" AS ENUM ('SERVER_TRUTH_KEPT','CLIENT_PAYLOAD_APPLIED','MANUAL_MERGE','DISCARDED');
CREATE TYPE "RetryDisposition" AS ENUM ('RETRYABLE','PERMANENT_FAILURE','CONFLICT','DUPLICATE_SUPPRESSED');

-- IdempotencyKey
CREATE TABLE "idempotency_keys" (
  "id"              TEXT PRIMARY KEY,
  "org_id"          TEXT,
  "actor_user_id"   TEXT,
  "route_method"    TEXT NOT NULL,
  "route_path"      TEXT NOT NULL,
  "scope"           TEXT NOT NULL DEFAULT 'default',
  "key"             TEXT NOT NULL,
  "request_hash"    TEXT NOT NULL,
  "status"          "IdempotencyStatus" NOT NULL DEFAULT 'IN_FLIGHT',
  "status_code"     INTEGER,
  "response_body"   JSONB,
  "response_ref"    TEXT,
  "failure_summary" TEXT,
  "expires_at"      TIMESTAMP(3),
  "completed_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "idempotency_keys_scope_key_route_uq" ON "idempotency_keys" ("scope","key","route_method","route_path");
CREATE INDEX "idempotency_keys_org_actor_path_idx" ON "idempotency_keys" ("org_id","actor_user_id","route_path");
CREATE INDEX "idempotency_keys_status_created_idx" ON "idempotency_keys" ("status","created_at");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" ("expires_at");

-- SyncJob
CREATE TABLE "sync_jobs" (
  "id"                 TEXT PRIMARY KEY,
  "org_id"             TEXT NOT NULL,
  "branch_id"          TEXT,
  "actor_user_id"      TEXT,
  "type"               "SyncJobType" NOT NULL,
  "status"             "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
  "origin"             "SyncJobOrigin" NOT NULL DEFAULT 'OFFLINE_CLIENT',
  "client_mutation_id" TEXT NOT NULL,
  "idempotency_key"    TEXT,
  "route_method"       TEXT,
  "route_path"         TEXT,
  "request_body"       JSONB NOT NULL,
  "request_headers"    JSONB,
  "intent_summary"     TEXT,
  "captured_at"        TIMESTAMP(3) NOT NULL,
  "queued_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_attempt_at"    TIMESTAMP(3),
  "next_retry_at"      TIMESTAMP(3),
  "completed_at"       TIMESTAMP(3),
  "attempt_count"      INTEGER NOT NULL DEFAULT 0,
  "max_attempts"       INTEGER NOT NULL DEFAULT 5,
  "result_ref"         TEXT,
  "result_summary"     JSONB,
  "last_error"         TEXT,
  "failure_reason"     TEXT,
  "metadata"           JSONB,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_jobs_org_fk"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "sync_jobs_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id")      ON DELETE SET NULL
);
CREATE UNIQUE INDEX "sync_jobs_org_client_mutation_uq" ON "sync_jobs" ("org_id","client_mutation_id");
CREATE INDEX "sync_jobs_org_status_type_created_idx" ON "sync_jobs" ("org_id","status","type","created_at");
CREATE INDEX "sync_jobs_org_branch_status_idx" ON "sync_jobs" ("org_id","branch_id","status");
CREATE INDEX "sync_jobs_status_next_retry_idx" ON "sync_jobs" ("status","next_retry_at");
CREATE INDEX "sync_jobs_type_idx" ON "sync_jobs" ("type");

-- SyncJobAttempt
CREATE TABLE "sync_job_attempts" (
  "id"          TEXT PRIMARY KEY,
  "job_id"      TEXT NOT NULL,
  "attempt_no"  INTEGER NOT NULL,
  "started_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "disposition" "RetryDisposition" NOT NULL DEFAULT 'RETRYABLE',
  "status_code" INTEGER,
  "error"       TEXT,
  "metadata"    JSONB,
  CONSTRAINT "sync_job_attempts_job_fk" FOREIGN KEY ("job_id") REFERENCES "sync_jobs"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "sync_job_attempts_job_attempt_uq" ON "sync_job_attempts" ("job_id","attempt_no");
CREATE INDEX "sync_job_attempts_job_idx" ON "sync_job_attempts" ("job_id");
CREATE INDEX "sync_job_attempts_disposition_idx" ON "sync_job_attempts" ("disposition");

-- SyncConflict
CREATE TABLE "sync_conflicts" (
  "id"               TEXT PRIMARY KEY,
  "org_id"           TEXT NOT NULL,
  "job_id"           TEXT,
  "type"             "SyncJobType" NOT NULL,
  "status"           "SyncConflictStatus" NOT NULL DEFAULT 'OPEN',
  "resolution"       "SyncConflictResolution",
  "target_entity"    TEXT,
  "target_entity_id" TEXT,
  "client_payload"   JSONB NOT NULL,
  "server_state"     JSONB NOT NULL,
  "diff_summary"     TEXT NOT NULL,
  "reason"           TEXT NOT NULL,
  "detected_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at"      TIMESTAMP(3),
  "resolved_by_id"   TEXT,
  "resolution_note"  TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_conflicts_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "sync_conflicts_job_fk" FOREIGN KEY ("job_id") REFERENCES "sync_jobs"("id")    ON DELETE SET NULL
);
CREATE INDEX "sync_conflicts_org_status_created_idx" ON "sync_conflicts" ("org_id","status","created_at");
CREATE INDEX "sync_conflicts_org_job_idx" ON "sync_conflicts" ("org_id","job_id");
CREATE INDEX "sync_conflicts_type_idx" ON "sync_conflicts" ("type");
