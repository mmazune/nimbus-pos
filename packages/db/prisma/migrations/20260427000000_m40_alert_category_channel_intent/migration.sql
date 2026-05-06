-- M40 correction: add AlertCategory + AlertChannelIntent enums and columns to alert_rules
-- These columns are nullable (additive) so existing rows stay valid without backfill.

CREATE TYPE "AlertCategory" AS ENUM (
    'OPERATIONAL_IMMEDIATE',
    'OWNER_FINANCE',
    'BOOKING_EVENT',
    'TECHNICAL_INTEGRATION'
);

CREATE TYPE "AlertChannelIntent" AS ENUM (
    'MOBILE_SMS',
    'EMAIL_DIGEST',
    'SLACK_WEBHOOK',
    'ALL_CHANNELS'
);

ALTER TABLE "alert_rules"
    ADD COLUMN "alert_category"  "AlertCategory"      NULL,
    ADD COLUMN "channel_intent"  "AlertChannelIntent" NULL;

CREATE INDEX "alert_rules_org_id_alert_category_status_idx"
    ON "alert_rules" ("org_id", "alert_category", "status");
