-- T6 phase 2: requests for approval, the venue settings they use, till sign-off. Additive only.
CREATE TYPE "ApprovalKind" AS ENUM ('REFUND', 'TILL_VARIANCE');
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');
CREATE TYPE "ApprovalLevel" AS ENUM ('SUPERVISOR', 'MANAGER');
CREATE TYPE "ApprovalChannel" AS ENUM ('PIN_ON_DEVICE', 'APPROVALS');

ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "level" "ApprovalLevel" NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "payload" JSONB,
    "requested_by_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "climbs_at" TIMESTAMP(3),
    "climbed_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_via" "ApprovalChannel",
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approval_requests_org_id_branch_id_status_idx" ON "approval_requests"("org_id", "branch_id", "status");
CREATE INDEX "approval_requests_subject_type_subject_id_idx" ON "approval_requests"("subject_type", "subject_id");

ALTER TABLE "org_settings"
  ADD COLUMN "approval_climb_minutes" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "till_variance_limit" DECIMAL(12,2) NOT NULL DEFAULT 10000,
  ADD COLUMN "business_day_ends_hour" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "till_sessions"
  ADD COLUMN "variance_sign_off_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "variance_signed_off_by_id" TEXT,
  ADD COLUMN "variance_signed_off_at" TIMESTAMP(3);
