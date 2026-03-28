-- M21: Customer Feedback + NPS + QR Follow-up

-- Enums
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "FeedbackSource" AS ENUM ('QR', 'ORDER_LINK', 'RESERVATION_LINK', 'EVENT_LINK', 'MANUAL', 'OTHER');
CREATE TYPE "FeedbackSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CRITICAL');
CREATE TYPE "FeedbackRequestStatus" AS ENUM ('PENDING', 'OPENED', 'SUBMITTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "NpsBucket" AS ENUM ('DETRACTOR', 'PASSIVE', 'PROMOTER');

-- FeedbackRequest table (must be created before Feedback since Feedback references it)
CREATE TABLE "feedback_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "order_id" TEXT,
    "reservation_id" TEXT,
    "event_id" TEXT,
    "token" TEXT NOT NULL,
    "source" "FeedbackSource" NOT NULL,
    "status" "FeedbackRequestStatus" NOT NULL DEFAULT 'PENDING',
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "sent_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

-- Feedback table
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "order_id" TEXT,
    "reservation_id" TEXT,
    "event_id" TEXT,
    "feedback_request_id" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "source" "FeedbackSource" NOT NULL,
    "rating" INTEGER,
    "nps_score" INTEGER,
    "nps_bucket" "NpsBucket",
    "sentiment" "FeedbackSentiment" NOT NULL,
    "comment" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "acknowledged_by_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- FeedbackTag table
CREATE TABLE "feedback_tags" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "feedback_id" TEXT NOT NULL,
    "tag_key" TEXT NOT NULL,
    "tag_label" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_tags_pkey" PRIMARY KEY ("id")
);

-- NpsSummary table
CREATE TABLE "nps_summaries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "total_responses" INTEGER NOT NULL DEFAULT 0,
    "promoters" INTEGER NOT NULL DEFAULT 0,
    "passives" INTEGER NOT NULL DEFAULT 0,
    "detractors" INTEGER NOT NULL DEFAULT 0,
    "nps_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(10,2),
    "negative_count" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nps_summaries_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "feedback_requests_token_key" ON "feedback_requests"("token");
CREATE UNIQUE INDEX "feedback_tags_feedback_id_tag_key_key" ON "feedback_tags"("feedback_id", "tag_key");

-- Indexes: feedback_requests
CREATE INDEX "feedback_requests_org_id_idx" ON "feedback_requests"("org_id");
CREATE INDEX "feedback_requests_branch_id_idx" ON "feedback_requests"("branch_id");
CREATE INDEX "feedback_requests_order_id_idx" ON "feedback_requests"("order_id");
CREATE INDEX "feedback_requests_reservation_id_idx" ON "feedback_requests"("reservation_id");
CREATE INDEX "feedback_requests_event_id_idx" ON "feedback_requests"("event_id");
CREATE INDEX "feedback_requests_token_idx" ON "feedback_requests"("token");
CREATE INDEX "feedback_requests_status_idx" ON "feedback_requests"("status");
CREATE INDEX "feedback_requests_source_idx" ON "feedback_requests"("source");
CREATE INDEX "feedback_requests_org_id_branch_id_status_idx" ON "feedback_requests"("org_id", "branch_id", "status");

-- Indexes: feedbacks
CREATE INDEX "feedbacks_org_id_idx" ON "feedbacks"("org_id");
CREATE INDEX "feedbacks_branch_id_idx" ON "feedbacks"("branch_id");
CREATE INDEX "feedbacks_order_id_idx" ON "feedbacks"("order_id");
CREATE INDEX "feedbacks_reservation_id_idx" ON "feedbacks"("reservation_id");
CREATE INDEX "feedbacks_event_id_idx" ON "feedbacks"("event_id");
CREATE INDEX "feedbacks_feedback_request_id_idx" ON "feedbacks"("feedback_request_id");
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");
CREATE INDEX "feedbacks_source_idx" ON "feedbacks"("source");
CREATE INDEX "feedbacks_sentiment_idx" ON "feedbacks"("sentiment");
CREATE INDEX "feedbacks_submitted_at_idx" ON "feedbacks"("submitted_at");
CREATE INDEX "feedbacks_org_id_branch_id_status_idx" ON "feedbacks"("org_id", "branch_id", "status");
CREATE INDEX "feedbacks_org_id_branch_id_sentiment_idx" ON "feedbacks"("org_id", "branch_id", "sentiment");

-- Indexes: feedback_tags
CREATE INDEX "feedback_tags_org_id_idx" ON "feedback_tags"("org_id");
CREATE INDEX "feedback_tags_branch_id_idx" ON "feedback_tags"("branch_id");
CREATE INDEX "feedback_tags_feedback_id_idx" ON "feedback_tags"("feedback_id");
CREATE INDEX "feedback_tags_tag_key_idx" ON "feedback_tags"("tag_key");

-- Indexes: nps_summaries
CREATE INDEX "nps_summaries_org_id_idx" ON "nps_summaries"("org_id");
CREATE INDEX "nps_summaries_branch_id_idx" ON "nps_summaries"("branch_id");
CREATE INDEX "nps_summaries_window_start_window_end_idx" ON "nps_summaries"("window_start", "window_end");
CREATE INDEX "nps_summaries_org_id_branch_id_window_start_window_end_idx" ON "nps_summaries"("org_id", "branch_id", "window_start", "window_end");

-- Foreign keys: feedback_requests
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: feedbacks
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_feedback_request_id_fkey" FOREIGN KEY ("feedback_request_id") REFERENCES "feedback_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: feedback_tags
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: nps_summaries
ALTER TABLE "nps_summaries" ADD CONSTRAINT "nps_summaries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nps_summaries" ADD CONSTRAINT "nps_summaries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
