-- M20: Reporting v1 + Exports
-- Adds ReportRun and ExportArtifact tables with enums

-- CreateEnum "ReportType"
CREATE TYPE "ReportType" AS ENUM ('SHIFT_END', 'DAILY_SALES', 'PAYMENT_MIX', 'TOP_ITEMS', 'STOCK_VARIANCE', 'ANOMALY_SUMMARY', 'RESERVATION_SUMMARY', 'EVENT_SUMMARY');

-- CreateEnum "ReportWindow"
CREATE TYPE "ReportWindow" AS ENUM ('DAY', 'WEEK', 'MONTH', 'CUSTOM');

-- CreateEnum "ExportFormat"
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'PDF');

-- CreateEnum "ReportRunStatus"
CREATE TYPE "ReportRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum "ExportArtifactStatus"
CREATE TYPE "ExportArtifactStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable "report_runs"
CREATE TABLE "report_runs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "report_type" "ReportType" NOT NULL,
    "report_window" "ReportWindow" NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "status" "ReportRunStatus" NOT NULL DEFAULT 'PENDING',
    "date_from" TIMESTAMP(3),
    "date_to" TIMESTAMP(3),
    "parameters" JSONB,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "generated_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable "export_artifacts"
CREATE TABLE "export_artifacts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "report_run_id" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportArtifactStatus" NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "checksum" TEXT,
    "generated_by_id" TEXT NOT NULL,
    "ready_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex "report_runs"
CREATE INDEX "report_runs_org_id_idx" ON "report_runs"("org_id");
CREATE INDEX "report_runs_branch_id_idx" ON "report_runs"("branch_id");
CREATE INDEX "report_runs_report_type_idx" ON "report_runs"("report_type");
CREATE INDEX "report_runs_report_window_idx" ON "report_runs"("report_window");
CREATE INDEX "report_runs_requested_by_id_idx" ON "report_runs"("requested_by_id");
CREATE INDEX "report_runs_status_idx" ON "report_runs"("status");
CREATE INDEX "report_runs_created_at_idx" ON "report_runs"("created_at");
CREATE INDEX "report_runs_org_id_branch_id_report_type_status_idx" ON "report_runs"("org_id", "branch_id", "report_type", "status");

-- CreateIndex "export_artifacts"
CREATE INDEX "export_artifacts_org_id_idx" ON "export_artifacts"("org_id");
CREATE INDEX "export_artifacts_branch_id_idx" ON "export_artifacts"("branch_id");
CREATE INDEX "export_artifacts_report_run_id_idx" ON "export_artifacts"("report_run_id");
CREATE INDEX "export_artifacts_format_idx" ON "export_artifacts"("format");
CREATE INDEX "export_artifacts_status_idx" ON "export_artifacts"("status");
CREATE INDEX "export_artifacts_generated_by_id_idx" ON "export_artifacts"("generated_by_id");
CREATE INDEX "export_artifacts_created_at_idx" ON "export_artifacts"("created_at");
CREATE INDEX "export_artifacts_org_id_branch_id_report_run_id_format_idx" ON "export_artifacts"("org_id", "branch_id", "report_run_id", "format");

-- AddForeignKey "report_runs"
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "export_artifacts"
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_report_run_id_fkey" FOREIGN KEY ("report_run_id") REFERENCES "report_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
