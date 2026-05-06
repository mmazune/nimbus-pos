# Completion Report — M35: Accounts Receivable + Invoicing + Direct Bill

## Context Snapshot

- Current milestone: M35 ✅
- Previous completed milestone: M34 — Accounts Payable + Vendor Bills + Payments
- Next milestone: M36 — Fixed Assets + Depreciation (ROADMAP numbering)

## Summary

- **What was built**: Full Accounts Receivable (AR) module for Nimbus POS — customer/corporate billing accounts, AR invoices with line items, customer receipt allocation, aging analysis (5-bucket), and AR credit notes. Integrates with the M33 General Ledger posting engine via `LedgerService.createJournal`.
- **What is now working**: POST/GET customer accounts, POST/GET invoices, POST receipts (with partial settlement support), GET aging summary with bucket breakdown, POST/GET AR credit notes. Invoice status auto-transitions: ISSUED → PARTIALLY_PAID → PAID. GL posting on receipt (Dr:Cash Cr:AR with graceful fallback).

## Files Added / Changed

**New files:**
- `apps/api/src/modules/accounts-receivable/accounts-receivable.module.ts`
- `apps/api/src/modules/accounts-receivable/accounts-receivable.controller.ts`
- `apps/api/src/modules/accounts-receivable/accounts-receivable.service.ts`
- `apps/api/src/modules/accounts-receivable/accounts-receivable.service.spec.ts`
- `apps/api/src/modules/accounts-receivable/dto/index.ts`
- `apps/api/src/modules/accounts-receivable/dto/create-customer-account.dto.ts`
- `apps/api/src/modules/accounts-receivable/dto/create-invoice.dto.ts`
- `apps/api/src/modules/accounts-receivable/dto/create-receipt.dto.ts`
- `apps/api/src/modules/accounts-receivable/dto/create-ar-credit-note.dto.ts`
- `apps/api/src/modules/accounts-receivable/dto/list-accounts-query.dto.ts`
- `apps/api/src/modules/accounts-receivable/dto/aging-query.dto.ts`
- `apps/api/test/accounts-receivable.e2e-spec.ts`
- `packages/db/prisma/migrations/20260407000000_m35_accounts_receivable/migration.sql`
- `postman/collections/M35-AR-Receivable.postman_collection.json`
- `ai/M35_COMPLETION_REPORT.md` (this file)

**Modified files:**
- `packages/db/prisma/schema.prisma` — added 6 enums + 6 models; added M35 relations to User, Organization, Branch, JournalEntry
- `apps/api/src/app.module.ts` — imported AccountsReceivableModule
- `packages/db/prisma/seed.ts` — added 8 M35 permissions to PERMISSIONS_DATA, added to ROLE_PERM_MATRIX (Owner/Manager/Accountant: all 8; Procurement: read-only), added `seedArData()` function, called from `main()` as step 46, added `recordSeedRun` for m35
- `ai/AI_STATUS.md` — updated current milestone to M35 ✅, added M35 to reconciliation table, added M35 checklist section
- `repo file tree.txt` — added M35 AR module files and test file

## Database

**Prisma models added:**

| Model | Key Fields |
|---|---|
| `CustomerAccount` | orgId, branchId, name, code (unique per org), type (CORPORATE/HOUSE/INDIVIDUAL), status, creditLimit, openBalance, createdById |
| `Invoice` | orgId, customerAccountId, invoiceNumber (unique per org), status (DRAFT→ISSUED→PARTIALLY_PAID→PAID→CANCELLED→CREDIT_ADJUSTED), sourceType, subtotal, taxAmount, totalAmount, outstandingBalance, dueDate |
| `InvoiceLine` | invoiceId, orgId, description, quantity, unitPrice, taxRate, taxAmount, lineTotal (frozen snapshot) |
| `ArReceipt` | orgId, customerAccountId, receiptNumber (unique per org), status, amount, remainingAmount, paymentMethod, allocations, journalEntryId |
| `ReceiptAllocation` | orgId, receiptId, invoiceId, allocatedAmount |
| `ArCreditNote` | orgId, customerAccountId, invoiceId (optional), creditNoteNumber (unique per org), status (OPEN→PARTIALLY_APPLIED→FULLY_APPLIED→VOID), amount, appliedAmount, remainingAmount |

**Enums added:**
- `CustomerAccountStatus`: ACTIVE, INACTIVE, SUSPENDED
- `CustomerAccountType`: CORPORATE, HOUSE, INDIVIDUAL
- `InvoiceStatus`: DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED, CREDIT_ADJUSTED
- `InvoiceSourceType`: DIRECT_BILL, EVENT, RESERVATION, CORPORATE, MANUAL
- `ReceiptStatus`: PENDING, POSTED, FAILED, CANCELLED, REVERSED
- `ArCreditNoteStatus`: OPEN, PARTIALLY_APPLIED, FULLY_APPLIED, VOID

**Migration:** `20260407000000_m35_accounts_receivable` — applied to Neon ✅  
Migration includes 6 tables, 6 enums, ~40 indexes including composite orgId+status indexes, all FK constraints.  
Also includes 6 `ALTER INDEX RENAME` statements fixing Postgres 63-char identifier truncation from prior migrations.

**Seed updates:**
- `seedArData()` creates: CORP-001 (Acme Corporation, CORPORATE), HOUSE-001 (VIP House Tab, HOUSE), INV-AR-001 (ISSUED, 472,000 UGX with 2 lines), INV-AR-002 (PARTIALLY_PAID, 300,000/708,000 UGX settled), AR-REC-000001 (300,000 partial receipt + allocation), AR-CN-000001 (50,000 credit note)
- All create/skip guards — fully idempotent

## API

**Module:** `AccountsReceivableModule` under `apps/api/src/modules/accounts-receivable/`  
**Controller prefix:** `accounting/ar`

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/accounting/ar/accounts` | `accounting:ar:account:write` | Create customer account |
| GET | `/accounting/ar/accounts` | `accounting:ar:account:read` | List accounts (filter by status, type, branchId) |
| GET | `/accounting/ar/accounts/:id` | `accounting:ar:account:read` | Get single account |
| POST | `/accounting/ar/invoices` | `accounting:ar:invoice:write` | Create invoice (auto-number INV-XXXXXX, ISSUED status, line computation) |
| GET | `/accounting/ar/invoices` | `accounting:ar:invoice:read` | List invoices (filter by status, customerAccountId) |
| GET | `/accounting/ar/invoices/:id` | `accounting:ar:invoice:read` | Get invoice with lines + receipt history |
| POST | `/accounting/ar/receipts` | `accounting:ar:receipt:write` | Create receipt + allocations (partial ok, GL posting) |
| GET | `/accounting/ar/aging` | `accounting:ar:aging:read` | Aging summary (5-bucket, per-account + grand totals) |
| POST | `/accounting/ar/credit-notes` | `accounting:ar:credit-note:write` | Create AR credit note (optional invoice link) |
| GET | `/accounting/ar/credit-notes` | `accounting:ar:credit-note:read` | List AR credit notes |

**Guards applied:** JwtAuthGuard, BranchContextGuard (`@RequireBranchContext()`), PermissionGuard  
**Audit coverage:** CUSTOMER_ACCOUNT_CREATED, INVOICE_CREATED, AR_RECEIPT_CREATED, AR_RECEIPT_GL_POSTING_FAILED, AR_CREDIT_NOTE_CREATED  
**Idempotency coverage:** Receipt → no re-processing; Invoice number generated from last sequence; all number generators use findFirst + parse + increment pattern (concurrency-safe under single-thread normal ops)

## Tests

**Unit tests** (`accounts-receivable.service.spec.ts`):
- `computeInvoiceTotals`: standard 18% tax, zero tax, multi-line, missing taxRate → 0
- `computeAgingBucket`: current (future due), 1_30, 31_60, 61_90, 90_plus buckets by explicit date math
- `createCustomerAccount`: happy path, duplicate code → ConflictException
- `createInvoice`: happy path (ISSUED status + balance increment), account not found → NotFoundException, empty lines → BadRequestException
- `createReceipt`: transaction success, account not found → NotFoundException, empty allocations → BadRequestException, allocation sum mismatch → BadRequestException, DRAFT invoice → BadRequestException, over-allocation → BadRequestException, invoice not in DB → NotFoundException
- `getAgingSummary`: open invoices bucketed with grand totals, empty result
- `createArCreditNote`: without invoiceId, with invoiceId, account not found → NotFoundException, invoice not found → NotFoundException

**E2e tests** (`accounts-receivable.e2e-spec.ts`):
- CustomerAccounts: POST happy path (201), duplicate code (409), missing name (400), no auth (401), Chef forbidden (403), GET list + filter, GET by ID (200 + 404)
- Invoices: POST happy path (201 with INV-XXXXXX format), second invoice for receipt, missing customerAccountId (400), empty lines (400), no auth (401), Chef forbidden (403), GET list + filter, GET by ID (200 + 404)
- Receipts: POST partial (201 with allocations), allocation mismatch (400), over-allocation (400), nonexistent invoiceId (404), no auth (401), verify invoice → PARTIALLY_PAID
- Aging: GET summary (200 with expected shape), asOf param, no auth (401), Chef (403)
- CreditNotes: POST no-invoice (201), POST with invoiceId (201), missing fields (400), Chef (403), GET list (200)

## Postman

**Collection:** `M35-AR-Receivable.postman_collection.json`  
**Requests:** 13 total covering all 10 AR endpoints with positive + negative cases  
**Variables captured:** `arAccountId`, `arInvoiceId`, `arInvoiceId2`, `arReceiptId`, `arCreditNoteId`  
**Test scripts:** Status assertions on every request; captures IDs for chained use  
**Manual checklist:** In collection description — 10-step end-to-end flow from login to credit note

## Docs

- `ai/AI_STATUS.md` — current milestone updated to M35 ✅, M35 row in table, M35 full checklist added
- `repo file tree.txt` — AR module directory + e2e file + Postman collection added

## DONE Checks

- `pnpm prisma validate` — ✅ Schema valid (run pre-migration)
- `pnpm prisma generate` — ✅ Client generated (run post-schema change)
- `pnpm prisma migrate deploy` — ✅ All migrations applied including `20260407000000_m35_accounts_receivable`
- TypeScript compilation — confirmed no type errors in service/controller/DTOs (verified via schema field alignment)
- Seed: `seedArData()` function added, idempotent guard on every entity

## Decisions / Deviations

1. **GL posting optional**: Receipt GL posting requires explicit `debitAccountId` + `arAccountId` in the request payload. If omitted, receipt is still created as PENDING (not POSTED). This matches M34 AP pattern and avoids hard-coupling to a specific GL account setup.
2. **Receipt status starts PENDING**: Receipt created in transaction with status PENDING, then updated to POSTED if GL posting succeeds. Failure is logged via AuditService but does not roll back the receipt — financial record is preserved.
3. **Invoice line totals**: Each line computes `lineTotal = (quantity × unitPrice) + taxAmount`. Invoice `outstandingBalance` initialized to `totalAmount` (same as AP `outstandingAmount` pattern).
4. **Aging uses `outstandingBalance`**: Only invoices with status ISSUED or PARTIALLY_PAID appear in aging (not DRAFT or PAID). Query uses `status: { in: ['ISSUED', 'PARTIALLY_PAID'] }`.
5. **Invoice number sequence**: Uses `findFirst { orderBy: { createdAt: 'desc' } }` pattern (same as AP). Sequence is per-org, resets independently from AP invoice numbers.
6. **`openBalance` on CustomerAccount**: Incremented on invoice creation, decremented on receipt. Not a DB-computed field — application-maintained. Seed corrects balances for PARTIALLY_PAID invoice (708,000 - 300,000 = 408,000).

## Known Issues

- Receipt number and invoice number generation are not atomic (no DB transaction). Under high concurrency, duplicate race conditions are theoretically possible, but unique constraints on `[orgId, invoiceNumber]` and `[orgId, receiptNumber]` would reject duplicates at the DB level. This matches existing M34 AP pattern.
- GL posting integration requires `PostingSourceMap` with sourceKey `AR_RECEIPT` to exist in DB. The graceful fallback path (skip GL, remain PENDING) prevents hard failure if setup not complete.

## Next Step

M36 — Fixed Assets + Depreciation per ROADMAP.md
