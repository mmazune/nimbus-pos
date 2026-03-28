-- M22: Documents + Uploads + Attachments

-- Enums
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'DELETED');
CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'INVOICE', 'CONTRACT', 'PAYSLIP', 'REPORT_EXPORT', 'ATTACHMENT', 'OTHER');
CREATE TYPE "DocumentLinkType" AS ENUM ('ORDER', 'RESERVATION', 'EVENT', 'REPORT_RUN', 'EXPORT_ARTIFACT', 'USER', 'EMPLOYEE', 'VENDOR', 'CUSTOMER', 'OTHER');
CREATE TYPE "StorageProviderType" AS ENUM ('LOCAL', 'S3', 'GCS', 'OTHER');

-- Documents table
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "file_name" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_extension" TEXT,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storage_provider" "StorageProviderType" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Document links table
CREATE TABLE "document_links" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "document_id" TEXT NOT NULL,
    "link_type" "DocumentLinkType" NOT NULL,
    "linked_record_id" TEXT NOT NULL,
    "linked_record_label" TEXT,
    "created_by_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- Storage provider configs table
CREATE TABLE "storage_provider_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "provider_type" "StorageProviderType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "bucket_or_container" TEXT,
    "base_path" TEXT,
    "public_base_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_provider_configs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "document_links_document_id_link_type_linked_record_id_key" ON "document_links"("document_id", "link_type", "linked_record_id");
CREATE UNIQUE INDEX "storage_provider_configs_org_id_provider_type_key" ON "storage_provider_configs"("org_id", "provider_type");

-- Indexes: documents
CREATE INDEX "documents_org_id_idx" ON "documents"("org_id");
CREATE INDEX "documents_branch_id_idx" ON "documents"("branch_id");
CREATE INDEX "documents_document_type_idx" ON "documents"("document_type");
CREATE INDEX "documents_status_idx" ON "documents"("status");
CREATE INDEX "documents_checksum_idx" ON "documents"("checksum");
CREATE INDEX "documents_uploaded_by_id_idx" ON "documents"("uploaded_by_id");
CREATE INDEX "documents_org_id_branch_id_status_idx" ON "documents"("org_id", "branch_id", "status");
CREATE INDEX "documents_org_id_checksum_idx" ON "documents"("org_id", "checksum");

-- Indexes: document_links
CREATE INDEX "document_links_org_id_idx" ON "document_links"("org_id");
CREATE INDEX "document_links_branch_id_idx" ON "document_links"("branch_id");
CREATE INDEX "document_links_document_id_idx" ON "document_links"("document_id");
CREATE INDEX "document_links_link_type_idx" ON "document_links"("link_type");
CREATE INDEX "document_links_linked_record_id_idx" ON "document_links"("linked_record_id");
CREATE INDEX "document_links_link_type_linked_record_id_idx" ON "document_links"("link_type", "linked_record_id");

-- Indexes: storage_provider_configs
CREATE INDEX "storage_provider_configs_org_id_idx" ON "storage_provider_configs"("org_id");
CREATE INDEX "storage_provider_configs_provider_type_idx" ON "storage_provider_configs"("provider_type");

-- Foreign keys: documents
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: document_links
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: storage_provider_configs
ALTER TABLE "storage_provider_configs" ADD CONSTRAINT "storage_provider_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
