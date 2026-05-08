-- BG7 — HMS Integration: API-Key Inbound Auth + HMS Read Façade
--
-- Two additive changes:
--   1. Extend `api_keys` with `branch_id` (nullable; null = org-wide key,
--      set = single-branch-restricted key) and `last_used_ip` (audit trail
--      for incoming HMS reads). FK to `branches` enforced at the DB layer
--      only — NO Prisma back-relation on Branch (keeps Branch byte-stable
--      per the BG1/BG5 precedent).
--   2. New table `integration_access_logs` — append-only access journal
--      for every inbound API-key authenticated request. Captures who
--      (apiKeyId), what (route/method/status), where (ip), when, and how
--      long. Indexed for org-time and key-time tailing.
--
-- No data migration; all columns nullable / new tables.

ALTER TABLE "api_keys"
    ADD COLUMN "branch_id"     TEXT,
    ADD COLUMN "last_used_ip"  TEXT;

CREATE INDEX "api_keys_branch_id_idx" ON "api_keys"("branch_id");

ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "integration_access_logs" (
    "id"            TEXT    NOT NULL,
    "org_id"        TEXT    NOT NULL,
    "api_key_id"    TEXT    NOT NULL,
    "branch_id"     TEXT,
    "route_method"  TEXT    NOT NULL,
    "route_path"    TEXT    NOT NULL,
    "status_code"   INTEGER NOT NULL,
    "duration_ms"   INTEGER NOT NULL,
    "ip_address"    TEXT,
    "user_agent"    TEXT,
    "request_id"    TEXT,
    "metadata"      JSONB,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_access_logs_org_id_created_at_idx"
    ON "integration_access_logs"("org_id", "created_at" DESC);
CREATE INDEX "integration_access_logs_api_key_id_created_at_idx"
    ON "integration_access_logs"("api_key_id", "created_at" DESC);
CREATE INDEX "integration_access_logs_branch_id_idx"
    ON "integration_access_logs"("branch_id");
CREATE INDEX "integration_access_logs_status_code_idx"
    ON "integration_access_logs"("status_code");

ALTER TABLE "integration_access_logs"
    ADD CONSTRAINT "integration_access_logs_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_access_logs"
    ADD CONSTRAINT "integration_access_logs_api_key_id_fkey"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_access_logs"
    ADD CONSTRAINT "integration_access_logs_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
