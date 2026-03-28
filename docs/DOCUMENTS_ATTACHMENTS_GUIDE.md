# Documents + Uploads + Attachments Guide

## Overview

M22 implements document storage, uploads, downloads, attachments, checksum-based deduplication, and linked-record document management for the Nimbus POS system. Files are stored on the local filesystem (v1) with a pluggable `StorageProviderConfig` model for future S3/GCS integration.

## Models

### Document
- Core document record with file metadata (name, MIME type, size, extension)
- SHA-256 checksum for deduplication
- Storage path and provider tracking
- Soft-delete via `status` (ACTIVE/DELETED) + `deletedAt`/`deletedById`
- Linked to org, branch (optional), and uploader user

### DocumentLink
- Many-to-many junction between Document and business records
- `linkType` (ORDER, RESERVATION, EVENT, REPORT_RUN, EXPORT_ARTIFACT, USER, etc.)
- `linkedRecordId` + unique constraint on [documentId, linkType, linkedRecordId]
- Enables attaching one document to multiple records

### StorageProviderConfig
- Per-org configuration for storage providers (LOCAL, S3, GCS, OTHER)
- Unique constraint on [orgId, providerType]
- Tracks bucket/container, base path, public base URL

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/documents/upload` | `pos:documents:upload` | Upload a document (multipart/form-data) |
| GET | `/documents` | `pos:documents:read` | List documents (paginated, filterable) |
| GET | `/documents/:id` | `pos:documents:read` | Get document by ID with links |
| GET | `/documents/:id/download` | `pos:documents:download` | Download file (streamed) |
| DELETE | `/documents/:id` | `pos:documents:delete` | Soft-delete document |
| POST | `/documents/:id/link` | `pos:documents:link` | Link document to a record |
| GET | `/documents/:id/links` | `pos:documents:read` | List links for a document |
| PATCH | `/documents/:id/metadata` | `pos:documents:metadata:update` | Update document metadata |
| GET | `/documents/storage-config` | `pos:documents:storage-config:read` | View storage configs |
| PATCH | `/documents/storage-config/:providerType` | `pos:documents:storage-config:update` | Update storage config |

## Upload Flow

1. Client sends `POST /documents/upload` with `multipart/form-data`
2. File field: `file` (max 20MB)
3. Body fields: `documentType` (required), `branchId` (optional), `metadata` (optional)
4. Server computes SHA-256 checksum of file buffer
5. Deduplication check: if same org + same checksum + ACTIVE exists → return existing doc with `deduplicated: true`
6. Otherwise: save file to `uploads/{orgId}/{uuid}{ext}`, create Document record
7. Audit: `DOCUMENT_UPLOADED` or `DOCUMENT_DEDUPE_HIT`

## Permissions (8 total)

| Permission | Description |
|-----------|-------------|
| `pos:documents:upload` | Upload documents |
| `pos:documents:read` | List/view documents |
| `pos:documents:download` | Download files |
| `pos:documents:delete` | Soft-delete documents |
| `pos:documents:link` | Link documents to records |
| `pos:documents:metadata:update` | Update document metadata |
| `pos:documents:storage-config:read` | View storage config |
| `pos:documents:storage-config:update` | Update storage config |

## Role Access Matrix

| Role | Upload | Read | Download | Delete | Link | Metadata | Config Read | Config Update |
|------|--------|------|----------|--------|------|----------|-------------|---------------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Accountant | ✅ | ✅ | ✅ | — | ✅ | — | — | — |
| Supervisor | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Cashier | — | ✅ | — | — | — | — | — | — |
| Waiter | — | ✅ | — | — | — | — | — | — |
| Chef | — | — | — | — | — | — | — | — |
| Bartender | — | — | — | — | — | — | — | — |

## Audit Events

| Event | Trigger |
|-------|---------|
| `DOCUMENT_UPLOADED` | New document saved |
| `DOCUMENT_DEDUPE_HIT` | Upload matched existing checksum |
| `DOCUMENT_LINKED` | Document linked to record |
| `DOCUMENT_DELETED` | Document soft-deleted |
| `DOCUMENT_DOWNLOAD_ACCESSED` | File downloaded |
| `DOCUMENT_ACCESS_DENIED` | Download attempt on non-existent/deleted doc |
| `DOCUMENT_METADATA_UPDATED` | Metadata updated |
| `STORAGE_CONFIG_UPDATED` | Storage config changed |

## Storage Architecture (v1)

- **Provider**: LOCAL filesystem
- **Base directory**: `{cwd}/uploads/`
- **Structure**: `uploads/{orgId}/{uuid}{extension}`
- **Future**: S3/GCS via `StorageProviderConfig` (provider-agnostic interface planned)

## Document Types

`RECEIPT`, `INVOICE`, `CONTRACT`, `PAYSLIP`, `REPORT_EXPORT`, `ATTACHMENT`, `OTHER`

## Link Types

`ORDER`, `RESERVATION`, `EVENT`, `REPORT_RUN`, `EXPORT_ARTIFACT`, `USER`, `EMPLOYEE`, `VENDOR`, `CUSTOMER`, `OTHER`
