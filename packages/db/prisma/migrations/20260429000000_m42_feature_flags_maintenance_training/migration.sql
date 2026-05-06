-- M42 — Feature Flags + Maintenance Windows + Training Mode

-- ── Enums ─────────────────────────────────────────────────────────────
CREATE TYPE "FeatureFlagScope" AS ENUM ('GLOBAL','ORG','BRANCH');
CREATE TYPE "FeatureFlagStatus" AS ENUM ('ENABLED','DISABLED','ARCHIVED');
CREATE TYPE "MaintenanceWindowStatus" AS ENUM ('SCHEDULED','ACTIVE','COMPLETED','CANCELLED');
CREATE TYPE "MaintenanceWindowMode" AS ENUM ('ANNOUNCEMENT_ONLY','BLOCK_WRITES');
CREATE TYPE "WriteBlockCategory" AS ENUM (
  'BILLING_WRITES','INVENTORY_WRITES','ACCOUNTING_WRITES',
  'PUBLIC_BOOKING_WRITES','ADMIN_CONFIGURATION_WRITES','ALL_WRITES'
);
CREATE TYPE "TrainingSessionStatus" AS ENUM ('ACTIVE','COMPLETED','EXPIRED','CANCELLED');
CREATE TYPE "TrainingSessionMode" AS ENUM ('SANDBOX_ISOLATED','SIMULATION_ONLY');
CREATE TYPE "FlagAuditAction" AS ENUM (
  'FLAG_CREATED','FLAG_UPDATED','FLAG_ENABLED','FLAG_DISABLED','FLAG_ARCHIVED',
  'MAINTENANCE_WINDOW_CREATED','MAINTENANCE_WINDOW_UPDATED',
  'MAINTENANCE_WINDOW_ACTIVATED','MAINTENANCE_WINDOW_DEACTIVATED',
  'TRAINING_SESSION_STARTED','TRAINING_SESSION_ENDED',
  'WRITE_BLOCKED_BY_MAINTENANCE','REAL_POST_BLOCKED_BY_TRAINING'
);

-- ── feature_flags ─────────────────────────────────────────────────────
CREATE TABLE "feature_flags" (
  "id"              TEXT PRIMARY KEY,
  "key"             TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "scope"           "FeatureFlagScope"  NOT NULL DEFAULT 'ORG',
  "org_id"          TEXT,
  "branch_id"       TEXT,
  "status"          "FeatureFlagStatus" NOT NULL DEFAULT 'DISABLED',
  "rollout_percent" INTEGER NOT NULL DEFAULT 0,
  "targeting"       JSONB,
  "metadata"        JSONB,
  "created_by_id"   TEXT,
  "updated_by_id"   TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_org_fk"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "feature_flags_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id")      ON DELETE CASCADE
);
CREATE UNIQUE INDEX "feature_flags_scope_key_org_branch_uq" ON "feature_flags" ("scope","key","org_id","branch_id");
CREATE INDEX "feature_flags_key_idx"             ON "feature_flags" ("key");
CREATE INDEX "feature_flags_org_status_idx"      ON "feature_flags" ("org_id","status");
CREATE INDEX "feature_flags_branch_status_idx"   ON "feature_flags" ("branch_id","status");
CREATE INDEX "feature_flags_scope_status_idx"    ON "feature_flags" ("scope","status");

-- ── maintenance_windows ───────────────────────────────────────────────
CREATE TABLE "maintenance_windows" (
  "id"               TEXT PRIMARY KEY,
  "org_id"           TEXT,
  "branch_id"        TEXT,
  "code"             TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "message"          TEXT,
  "mode"             "MaintenanceWindowMode"   NOT NULL DEFAULT 'ANNOUNCEMENT_ONLY',
  "status"           "MaintenanceWindowStatus" NOT NULL DEFAULT 'SCHEDULED',
  "block_categories" "WriteBlockCategory"[] NOT NULL DEFAULT ARRAY[]::"WriteBlockCategory"[],
  "starts_at"        TIMESTAMP(3) NOT NULL,
  "ends_at"          TIMESTAMP(3) NOT NULL,
  "activated_at"     TIMESTAMP(3),
  "deactivated_at"   TIMESTAMP(3),
  "created_by_id"    TEXT,
  "updated_by_id"    TEXT,
  "metadata"         JSONB,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_windows_org_fk"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "maintenance_windows_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id")      ON DELETE CASCADE
);
CREATE UNIQUE INDEX "maintenance_windows_org_code_uq"        ON "maintenance_windows" ("org_id","code");
CREATE INDEX "maintenance_windows_org_status_starts_idx"     ON "maintenance_windows" ("org_id","status","starts_at");
CREATE INDEX "maintenance_windows_branch_status_idx"         ON "maintenance_windows" ("branch_id","status");
CREATE INDEX "maintenance_windows_status_starts_ends_idx"    ON "maintenance_windows" ("status","starts_at","ends_at");

-- ── training_sessions ─────────────────────────────────────────────────
CREATE TABLE "training_sessions" (
  "id"            TEXT PRIMARY KEY,
  "org_id"        TEXT NOT NULL,
  "branch_id"     TEXT,
  "actor_user_id" TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "purpose"       TEXT,
  "mode"          "TrainingSessionMode"   NOT NULL DEFAULT 'SIMULATION_ONLY',
  "status"        "TrainingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"    TIMESTAMP(3) NOT NULL,
  "ended_at"      TIMESTAMP(3),
  "ended_by_id"   TEXT,
  "metadata"      JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_sessions_org_fk"    FOREIGN KEY ("org_id")    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "training_sessions_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id")      ON DELETE SET NULL
);
CREATE INDEX "training_sessions_org_status_created_idx" ON "training_sessions" ("org_id","status","created_at");
CREATE INDEX "training_sessions_org_branch_status_idx"  ON "training_sessions" ("org_id","branch_id","status");
CREATE INDEX "training_sessions_actor_status_idx"       ON "training_sessions" ("actor_user_id","status");
CREATE INDEX "training_sessions_expires_at_idx"         ON "training_sessions" ("expires_at");

-- ── flag_audits ───────────────────────────────────────────────────────
CREATE TABLE "flag_audits" (
  "id"                    TEXT PRIMARY KEY,
  "org_id"                TEXT,
  "action"                "FlagAuditAction" NOT NULL,
  "flag_id"               TEXT,
  "maintenance_window_id" TEXT,
  "training_session_id"   TEXT,
  "actor_user_id"         TEXT,
  "before_state"          JSONB,
  "after_state"           JSONB,
  "note"                  TEXT,
  "metadata"              JSONB,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flag_audits_org_fk"    FOREIGN KEY ("org_id")                REFERENCES "organizations"("id")      ON DELETE CASCADE,
  CONSTRAINT "flag_audits_flag_fk"   FOREIGN KEY ("flag_id")               REFERENCES "feature_flags"("id")      ON DELETE SET NULL,
  CONSTRAINT "flag_audits_window_fk" FOREIGN KEY ("maintenance_window_id") REFERENCES "maintenance_windows"("id") ON DELETE SET NULL
);
CREATE INDEX "flag_audits_org_created_idx"        ON "flag_audits" ("org_id","created_at");
CREATE INDEX "flag_audits_flag_created_idx"       ON "flag_audits" ("flag_id","created_at");
CREATE INDEX "flag_audits_window_created_idx"     ON "flag_audits" ("maintenance_window_id","created_at");
CREATE INDEX "flag_audits_action_created_idx"     ON "flag_audits" ("action","created_at");
