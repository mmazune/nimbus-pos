-- BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding
-- Adds Invitation + PasswordResetToken models and User.must_change_password flag.

-- ── Enums ──
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "PasswordResetPurpose" AS ENUM ('FORGOT_PASSWORD', 'INVITATION_FIRST_LOGIN', 'FORCE_RESET_BY_ADMIN');

-- ── User flag ──
ALTER TABLE "users"
    ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- ── invitations ──
CREATE TABLE "invitations" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id"       TEXT NOT NULL,
    "role_id"         TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "first_name"      TEXT,
    "last_name"       TEXT,
    "token_hash"      TEXT NOT NULL,
    "status"          "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at"      TIMESTAMP(3) NOT NULL,
    "accepted_at"     TIMESTAMP(3),
    "accepted_by_id"  TEXT,
    "revoked_at"      TIMESTAMP(3),
    "revoked_by_id"   TEXT,
    "revoked_reason"  TEXT,
    "resend_count"    INTEGER NOT NULL DEFAULT 0,
    "last_resent_at"  TIMESTAMP(3),
    "invited_by_id"   TEXT NOT NULL,
    "membership_id"   TEXT,
    "user_id"         TEXT,
    "metadata"        JSONB,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations" ("token_hash");
CREATE INDEX "invitations_organization_id_status_idx" ON "invitations" ("organization_id", "status");
CREATE INDEX "invitations_branch_id_idx" ON "invitations" ("branch_id");
CREATE INDEX "invitations_email_idx" ON "invitations" ("email");

-- ── password_reset_tokens ──
CREATE TABLE "password_reset_tokens" (
    "id"             TEXT NOT NULL,
    "user_id"        TEXT NOT NULL,
    "token_hash"     TEXT NOT NULL,
    "purpose"        "PasswordResetPurpose" NOT NULL DEFAULT 'FORGOT_PASSWORD',
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "consumed_at"    TIMESTAMP(3),
    "invalidated_at" TIMESTAMP(3),
    "ip_address"     TEXT,
    "user_agent"     TEXT,
    "metadata"       JSONB,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens" ("token_hash");
CREATE INDEX "password_reset_tokens_user_id_purpose_idx" ON "password_reset_tokens" ("user_id", "purpose");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" ("expires_at");
