
# Nimbus Backend Gap-Fix Implementation Prompts (Pre-M43/M44)

## BG0 — Route Verification + Contract Cleanup
You are a senior NestJS/Prisma engineer working in the Nimbus POS repo.

Read first:
- ROADMAP.md
- nimbus_final_master_audit_m0_m42.md
- nimbus_final_report_vs_postman_reconciliation_m0_m42.csv
- nimbus_final_endpoint_register_verified_m0_m42.csv
- nimbus_final_postman_request_register_m0_m42.csv
- nimbus_final_postman_issues_m0_m42.csv
- all completion reports for the milestone rows touched by the 42 report-only entries

Goal:
- verify every report-only row against NestJS source code / controller decorators / route scan
- classify each row as:
  - VERIFIED_IN_CODE
  - MISSING_IMPLEMENT
  - SUPERSEDED_OR_DOC_ARTIFACT
  - INTERNAL_OR_DEV_ONLY
  - PENDING_PROVIDER
- reconcile the 11 Postman-only rows
- update the endpoint register, reconciliation CSV, AI status, and Postman where needed

Rules:
- do not mark a row VERIFIED without code evidence
- normalize placeholder path params (`{id}` vs `:id`) without inventing routes
- standardize `/api/auth/me` as canonical frontend context resolver
- keep `/api/public/payments/*` labelled CRITICAL — PENDING PROVIDER CONFIRMATION

Deliverables:
- updated route verification checklist
- code route scan summary
- fixed Postman rows
- updated reconciliation register
- completion report

## BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding
Read first:
- ROADMAP.md
- M39.2 completion report
- auth, onboarding, HR, tenancy, and quick-PIN Postman collections
- final missing endpoint recommendations

Implement:
1. Invitation lifecycle
- POST /api/auth/invitations/accept
- POST /api/onboarding/invitations/:id/resend
- PATCH /api/onboarding/invitations/:id/revoke
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/force-password-change

2. One-call frontline onboarding
- POST /api/hr/frontline-staff/onboard

Contract for frontline onboarding:
- creates/links User
- Employee profile
- Membership
- Branch access
- Role
- Quick PIN
- optional Position / Contract link
- returns one response shaped for manager UI

Required DTOs:
- AcceptInvitationDto
- ResendInvitationDto
- RevokeInvitationDto
- ForgotPasswordDto
- ResetPasswordDto
- ForcePasswordChangeDto
- FrontlineStaffOnboardDto
- FrontlineStaffOnboardResponseDto

Services:
- InvitationLifecycleService
- PasswordLifecycleService
- FrontlineStaffOnboardingService

Permissions:
- auth:invitation:accept
- onboarding:invitation:write
- auth:password:reset
- hr:frontline-staff:create
- auth:quick-pin:issue

Audit:
- INVITATION_ACCEPTED
- INVITATION_RESENT
- INVITATION_REVOKED
- PASSWORD_RESET_REQUESTED
- PASSWORD_RESET_COMPLETED
- FIRST_PASSWORD_CHANGE_COMPLETED
- FRONTLINE_STAFF_ONBOARDED
- QUICK_PIN_ISSUED

Idempotency:
- required on invitation acceptance, resend, reset-complete, and frontline onboarding

Tests:
- happy path accept/reset/onboard
- invalid token
- revoked invite
- permission denial
- duplicate onboard with same idempotency key
- PIN issuance validation

Postman:
- add owner invite → manager accept flow
- add forgot/reset flow
- add frontline staff one-call onboarding flow

## BG2 — Unified Approvals Inbox + Global Audit Timeline
Read first:
- M16, M19, M28, M30, M34, M38 completion reports
- approvals-related Postman collections
- final audit outputs

Implement:
1. Unified approvals inbox
- GET /api/approvals
- GET /api/approvals/:id
- POST /api/approvals/:id/decide
- optional GET /api/approvals/summary

The inbox must aggregate:
- discounts
- voids
- refunds
- leave
- shift swaps
- purchase orders
- AP/vendor bills
- inter-branch transfers
- post-close voids

2. Global audit timeline
- GET /api/audit/timeline

Required filters:
- entityType
- entityId
- userId
- action
- dateFrom/dateTo
- orgId
- branchId
- limit/cursor

Services:
- UnifiedApprovalsService
- AuditTimelineReadService

Permissions:
- approvals:read
- approvals:decide
- audit:read

Audit:
- APPROVAL_DECIDED_UNIFIED
- AUDIT_TIMELINE_VIEWED (optional/internal)

Idempotency:
- required on approve/reject decision endpoint

Tests:
- cross-domain aggregation
- role filtering
- decision happy path
- duplicate decision conflict
- audit timeline filtering

Postman:
- owner inbox flow
- manager inbox flow
- audit drawer filters

## BG3 — Reliability Rollout (Idempotency + Maintenance/Training Adoption)
Read first:
- M41 completion report
- M42 completion report
- docs/SYNC_CONTRACT.md
- risky-write modules: payments, POS, AP, AR, payroll, public commerce, HR, inventory

Implement in two tracks:

A. Idempotency rollout (no new public routes unless necessary)
Apply/verify Idempotency-Key support on:
- POST /api/payments/intents
- POST /api/public/reservations/hold
- POST /api/public/reservations/confirm
- POST /api/public/event-bookings/hold
- POST /api/public/event-bookings/confirm
- POST /api/pos/orders/:id/close
- POST /api/refunds
- POST /api/inventory/adjustments
- POST /api/shifts/open
- POST /api/shifts/:id/close
- POST /api/tills/open
- POST /api/tills/:id/reconcile
- POST /api/accounting/ar/receipts
- POST /api/accounting/ap/payments
- PATCH /api/payroll/runs/:id/pay
- POST /api/sync/replay

B. Maintenance/training adoption
Inject ControlPlaneService or equivalent into:
- POS order writes
- payments/intents
- refunds
- public booking writes
- AP/AR writes
- payroll pay
- HR clock/leave/swap writes
- stock/procurement writes
- billing/subscription writes where relevant

Rules:
- training mode must simulate writes and never create real accounting/inventory/payment side effects
- maintenance windows may block configured writes with 409 and audit
- public diner payments remain pending and must not become live here

Tests:
- same-key same-payload replay
- same-key different-payload conflict
- maintenance block on selected surfaces
- training short-circuit with zero persisted rows
- public booking pending payment untouched

Postman:
- risky-write idempotency examples
- maintenance block examples
- training simulation examples

## BG4 — Receipts + POS Order Handoff Operations
Read first:
- M18/M19 POS payments/refunds reports
- POS/KDS/floor operations Postman collections
- final missing endpoint recommendations

Implement/verify:
1. Receipt surface
- GET /api/receipts/:id
- POST /api/receipts/:id/reprint
- POST /api/receipts/:id/send
- GET /api/receipts/:id/history

Send channels:
- EMAIL
- SMS
- WHATSAPP (support only if provider-ready; otherwise config-gated stub)

2. POS handoff / bill-structure operations
- POST /api/pos/orders/:id/split-bill
- POST /api/pos/orders/:id/split-items
- POST /api/pos/orders/merge
- POST /api/pos/orders/:id/transfer-table
- POST /api/pos/orders/:id/transfer-server
- POST /api/pos/orders/:id/move-items

Rules:
- preserve financial traceability
- preserve KDS routing integrity
- partial payment state must remain consistent
- post-close restrictions still apply

Permissions:
- receipt:read
- receipt:reprint
- receipt:send
- pos:order:transfer
- pos:order:split
- pos:order:merge

Audit:
- RECEIPT_VIEWED
- RECEIPT_REPRINTED
- RECEIPT_SENT
- ORDER_SPLIT
- ORDER_MERGED
- ORDER_TRANSFERRED_TABLE
- ORDER_TRANSFERRED_SERVER
- ORDER_ITEM_MOVED

Idempotency:
- required on send/reprint and split/merge/transfer writes

## BG5 — Device / Printer / Terminal Registry
Read first:
- roadmap deferred hardware notice
- KDS, POS, control-plane, and postman audit outputs

Implement/verify:
- POST /api/devices/activate
- GET /api/devices
- GET /api/devices/:id
- PATCH /api/devices/:id/status
- POST /api/devices/kds/register
- POST /api/devices/printers/routes
- GET /api/devices/printers/routes
- POST /api/devices/terminals/pair
- PATCH /api/devices/terminals/:id/unpair
- GET /api/devices/:id/history

Rules:
- keep advanced MSR/badges/spouts deferred
- support printer routing and terminal pairing stubs only
- device audit/history is mandatory

## BG6 — Export / Download Consistency
Read first:
- reporting, documents, payroll, accounting completion reports
- final endpoint register
- reusable component map

Implement a consistent export/download contract:
Option A (preferred):
- POST /api/exports
- GET /api/exports
- GET /api/exports/:id
- GET /api/exports/:id/download

or, if preserving generators per domain:
- standardize all domain generators to register artifacts into one common artifact listing/downloader

Minimum required outcome:
- one shared frontend ExportButton / DownloadCenter can work across:
  - reports
  - accounting
  - payroll
  - documents
  - finance / HQ exports

Also verify and document legacy aliases:
- /api/reports/export
- /api/reports/exports/:artifactId/download
- /api/documents/:documentId/download

Audit:
- EXPORT_REQUESTED
- EXPORT_READY
- EXPORT_DOWNLOADED
- EXPORT_FAILED
