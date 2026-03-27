-- M18: Anomaly Detection + Anti-Theft Signals
-- Creates: AnomalyRuleStatus, AnomalyRuleType, AnomalySeverity, AnomalyEventStatus, RiskEntityType enums
-- Creates: anomaly_rules, risk_thresholds, anomaly_events, staff_risk_snapshots tables

-- Enums
CREATE TYPE "AnomalyRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "AnomalyRuleType" AS ENUM ('VOID_SPIKE', 'DISCOUNT_ABUSE', 'CASH_VARIANCE', 'SHRINKAGE', 'LATE_CLOSE', 'PRICE_OVERRIDE', 'REFUND_SPIKE', 'NO_SHOW_PATTERN', 'CHECKIN_DENIED_PATTERN', 'CUSTOM');

CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "AnomalyEventStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TYPE "RiskEntityType" AS ENUM ('STAFF', 'BRANCH', 'ORDER', 'SHIFT', 'TILL', 'INVENTORY_ITEM', 'EVENT', 'RESERVATION');

-- Anomaly Rules
CREATE TABLE "anomaly_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AnomalyRuleType" NOT NULL,
    "description" TEXT,
    "status" "AnomalyRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity" "AnomalySeverity" NOT NULL,
    "metric_key" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold_value" DECIMAL(10,2),
    "window_minutes" INTEGER,
    "minimum_sample_size" INTEGER,
    "applies_to_entity_type" "RiskEntityType",
    "config" JSONB,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anomaly_rules_pkey" PRIMARY KEY ("id")
);

-- Risk Thresholds
CREATE TABLE "risk_thresholds" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(10,2),
    "int_value" INTEGER,
    "bool_value" BOOLEAN,
    "unit" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_thresholds_pkey" PRIMARY KEY ("id")
);

-- Anomaly Events
CREATE TABLE "anomaly_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "type" "AnomalyRuleType" NOT NULL,
    "status" "AnomalyEventStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "AnomalySeverity" NOT NULL,
    "entity_type" "RiskEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "related_order_id" TEXT,
    "related_shift_id" TEXT,
    "related_till_session_id" TEXT,
    "related_payment_id" TEXT,
    "related_refund_id" TEXT,
    "related_reservation_id" TEXT,
    "related_event_id" TEXT,
    "score" DECIMAL(10,2),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB NOT NULL,
    "metadata" JSONB,
    "acknowledged_by_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anomaly_events_pkey" PRIMARY KEY ("id")
);

-- Staff Risk Snapshots
CREATE TABLE "staff_risk_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "risk_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "anomaly_count" INTEGER NOT NULL DEFAULT 0,
    "high_severity_count" INTEGER NOT NULL DEFAULT 0,
    "void_spike_count" INTEGER NOT NULL DEFAULT 0,
    "discount_abuse_count" INTEGER NOT NULL DEFAULT 0,
    "cash_variance_count" INTEGER NOT NULL DEFAULT 0,
    "refund_spike_count" INTEGER NOT NULL DEFAULT 0,
    "no_show_pattern_count" INTEGER NOT NULL DEFAULT 0,
    "last_evaluated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_risk_snapshots_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "anomaly_rules_org_id_code_key" ON "anomaly_rules"("org_id", "code");
CREATE UNIQUE INDEX "risk_thresholds_org_id_key_key" ON "risk_thresholds"("org_id", "key");
CREATE UNIQUE INDEX "staff_risk_snapshots_org_id_branch_id_user_id_window_start_window_end_key"
    ON "staff_risk_snapshots"("org_id", "branch_id", "user_id", "window_start", "window_end");

-- Anomaly Rules indexes
CREATE INDEX "anomaly_rules_org_id_idx" ON "anomaly_rules"("org_id");
CREATE INDEX "anomaly_rules_branch_id_idx" ON "anomaly_rules"("branch_id");
CREATE INDEX "anomaly_rules_type_idx" ON "anomaly_rules"("type");
CREATE INDEX "anomaly_rules_status_idx" ON "anomaly_rules"("status");
CREATE INDEX "anomaly_rules_severity_idx" ON "anomaly_rules"("severity");
CREATE INDEX "anomaly_rules_created_at_idx" ON "anomaly_rules"("created_at");

-- Risk Thresholds indexes
CREATE INDEX "risk_thresholds_org_id_idx" ON "risk_thresholds"("org_id");
CREATE INDEX "risk_thresholds_branch_id_idx" ON "risk_thresholds"("branch_id");
CREATE INDEX "risk_thresholds_key_idx" ON "risk_thresholds"("key");

-- Anomaly Events indexes
CREATE INDEX "anomaly_events_org_id_idx" ON "anomaly_events"("org_id");
CREATE INDEX "anomaly_events_branch_id_idx" ON "anomaly_events"("branch_id");
CREATE INDEX "anomaly_events_rule_id_idx" ON "anomaly_events"("rule_id");
CREATE INDEX "anomaly_events_type_idx" ON "anomaly_events"("type");
CREATE INDEX "anomaly_events_status_idx" ON "anomaly_events"("status");
CREATE INDEX "anomaly_events_severity_idx" ON "anomaly_events"("severity");
CREATE INDEX "anomaly_events_entity_type_idx" ON "anomaly_events"("entity_type");
CREATE INDEX "anomaly_events_entity_id_idx" ON "anomaly_events"("entity_id");
CREATE INDEX "anomaly_events_actor_user_id_idx" ON "anomaly_events"("actor_user_id");
CREATE INDEX "anomaly_events_acknowledged_by_id_idx" ON "anomaly_events"("acknowledged_by_id");
CREATE INDEX "anomaly_events_branch_id_type_status_idx" ON "anomaly_events"("branch_id", "type", "status");
CREATE INDEX "anomaly_events_branch_id_actor_user_id_idx" ON "anomaly_events"("branch_id", "actor_user_id");
CREATE INDEX "anomaly_events_created_at_idx" ON "anomaly_events"("created_at");

-- Staff Risk Snapshots indexes
CREATE INDEX "staff_risk_snapshots_org_id_idx" ON "staff_risk_snapshots"("org_id");
CREATE INDEX "staff_risk_snapshots_branch_id_idx" ON "staff_risk_snapshots"("branch_id");
CREATE INDEX "staff_risk_snapshots_user_id_idx" ON "staff_risk_snapshots"("user_id");
CREATE INDEX "staff_risk_snapshots_window_start_idx" ON "staff_risk_snapshots"("window_start");
CREATE INDEX "staff_risk_snapshots_window_end_idx" ON "staff_risk_snapshots"("window_end");
CREATE INDEX "staff_risk_snapshots_branch_id_user_id_idx" ON "staff_risk_snapshots"("branch_id", "user_id");
CREATE INDEX "staff_risk_snapshots_created_at_idx" ON "staff_risk_snapshots"("created_at");

-- Foreign keys: anomaly_rules
ALTER TABLE "anomaly_rules" ADD CONSTRAINT "anomaly_rules_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anomaly_rules" ADD CONSTRAINT "anomaly_rules_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anomaly_rules" ADD CONSTRAINT "anomaly_rules_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anomaly_rules" ADD CONSTRAINT "anomaly_rules_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: risk_thresholds
ALTER TABLE "risk_thresholds" ADD CONSTRAINT "risk_thresholds_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_thresholds" ADD CONSTRAINT "risk_thresholds_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: anomaly_events
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "anomaly_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_acknowledged_by_id_fkey"
    FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: staff_risk_snapshots
ALTER TABLE "staff_risk_snapshots" ADD CONSTRAINT "staff_risk_snapshots_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_risk_snapshots" ADD CONSTRAINT "staff_risk_snapshots_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_risk_snapshots" ADD CONSTRAINT "staff_risk_snapshots_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
