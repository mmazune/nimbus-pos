-- T6 phase 1: one-time PIN setup tokens (additive only).
CREATE TYPE "PinSetupPurpose" AS ENUM ('ONBOARDING', 'RESET');

CREATE TABLE "pin_setup_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" "PinSetupPurpose" NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "invalidated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pin_setup_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pin_setup_tokens_token_hash_key" ON "pin_setup_tokens"("token_hash");
CREATE INDEX "pin_setup_tokens_user_id_consumed_at_idx" ON "pin_setup_tokens"("user_id", "consumed_at");
