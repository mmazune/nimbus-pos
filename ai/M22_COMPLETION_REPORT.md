# M22 Completion Report — Documents + Uploads + Attachments

## Milestone Summary

**M22** implements document storage, file uploads, checksum-based deduplication, linked-record document management, and per-org storage provider configuration for the Nimbus POS system.

## What Was Built

### Database (Prisma Schema)
- **4 new enums**: `DocumentStatus`, `DocumentType`, `DocumentLinkType`, `StorageProviderType`
- **3 new models**: `Document`, `DocumentLink`, `StorageProviderConfig`
- **Migration**: `20260330000000_m22_documents_uploads_attachments`
- Relations added to `User`, `Organization`, `Branch` models

### API Module (`apps/api/src/modules/documents/`)
- **DTOs** (5): `UploadDocumentDto`, `ListDocumentsQueryDto`, `LinkDocumentDto`, `UpdateStorageConfigDto`, `UpdateDocumentMetadataDto`
- **Service**: `documents.service.ts` — 10 methods
- **Controller**: `documents.controller.ts` — 10 endpoints
- **Module**: `documents.module.ts` — registered in `app.module.ts` (27th module)

### Endpoints (10)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/documents/upload` | `pos:documents:upload` |
| GET | `/documents` | `pos:documents:read` |
| GET | `/documents/:id` | `pos:documents:read` |
| GET | `/documents/:id/download` | `pos:documents:download` |
| DELETE | `/documents/:id` | `pos:documents:delete` |
| POST | `/documents/:id/link` | `pos:documents:link` |
| GET | `/documents/:id/links` | `pos:documents:read` |
| PATCH | `/documents/:id/metadata` | `pos:documents:metadata:update` |
| GET | `/documents/storage-config` | `pos:documents:storage-config:read` |
| PATCH | `/documents/storage-config/:providerType` | `pos:documents:storage-config:update` |

### Permissions (8 new → 130 total)
- `pos:documents:upload`
- `pos:documents:read`
- `pos:documents:download`
- `pos:documents:delete`
- `pos:documents:link`
- `pos:documents:metadata:update`
- `pos:documents:storage-config:read`
- `pos:documents:storage-config:update`

### Audit Events (8)
- `DOCUMENT_UPLOADED`, `DOCUMENT_DEDUPE_HIT`, `DOCUMENT_LINKED`, `DOCUMENT_DELETED`
- `DOCUMENT_DOWNLOAD_ACCESSED`, `DOCUMENT_ACCESS_DENIED`, `DOCUMENT_METADATA_UPDATED`, `STORAGE_CONFIG_UPDATED`

### Key Features
- **Checksum deduplication**: SHA-256 hash per-org, prevents duplicate file storage
- **Multipart upload**: `FileInterceptor` with 20MB limit
- **Soft delete**: Status-based (ACTIVE/DELETED) with deletedAt/deletedById tracking
- **Document linking**: Many-to-many between documents and business records (orders, reservations, events, exports, etc.)
- **File streaming**: Download via `fs.createReadStream` with proper Content-Disposition headers
- **Storage config**: Pluggable provider model (LOCAL v1, S3/GCS ready)

### Tests
- **Unit tests**: `documents.service.spec.ts` — upload, dedupe, list, get, download, delete, link, getLinks, updateMetadata, storageConfig
- **E2e tests**: `documents.e2e-spec.ts` — full CRUD through HTTP, permission enforcement, dedupe verification

### Seed Data
- 8 new permissions
- Role-permission mappings for all 11 roles
- `StorageProviderConfig` (LOCAL) for demo org
- 3 sample documents (receipt, invoice, contract)
- Idempotent (safe to run multiple times)

### Postman
- `M22-Documents-Uploads-Attachments.postman_collection.json` — 13 requests

### Documentation
- `docs/DOCUMENTS_ATTACHMENTS_GUIDE.md` — full endpoint, permission, audit, and architecture reference
- `ai/AI_STATUS.md` — updated with M22 checklist
- `ai/M22_COMPLETION_REPORT.md` — this file

## Closure Gates

- [x] Schema valid (`pnpm db:generate` ✅)
- [x] Migration SQL created
- [x] DTOs with class-validator decorators
- [x] Service with audit logging on all writes
- [x] Controller with guards (JwtAuth + Permission + BranchContext)
- [x] Module registered in AppModule
- [x] Unit tests written
- [x] E2e tests written
- [x] Seed updated (permissions + role-perm matrix + demo data)
- [x] Postman collection created
- [x] Docs created
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)

## Branch

`milestone/m22-documents-uploads-attachments`
