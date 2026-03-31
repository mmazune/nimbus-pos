# General Ledger & Posting Engine Guide

## Overview

M29 implements the core General Ledger (GL) with double-entry journal entries and an automated posting engine. It builds on M28's Accounting Foundation (Chart of Accounts, Cost Centers, Fiscal Periods, Posting Source Maps).

## Architecture

```
PostingSourceMap (M28)        JournalEntry           JournalLine
├── sourceKey ──────────┐     ├── journalNumber      ├── direction (DEBIT/CREDIT)
├── debitAccountId      │     ├── status              ├── amount (Decimal 10,2)
├── creditAccountId     │     ├── journalDate         ├── accountId → Account
└── description         │     ├── totalDebits         ├── costCenterId → CostCenter
                        │     ├── totalCredits         └── description
                        ▼     ├── reversedFromId (self)
                   PostingRun └── reversalOfId (self)
                   ├── runKey (unique per org)
                   ├── status (RUNNING/SUCCEEDED/FAILED)
                   ├── journalEntryId → JournalEntry
                   └── durationMs
                        │
                        ▼
                   PostingError
                   ├── errorMessage
                   ├── sourceKey / sourceDocumentId
                   └── status (OPEN/RESOLVED/IGNORED)
```

## Journal Entries

### Double-Entry Rule

Every journal entry must balance: `sum(DEBIT amounts) == sum(CREDIT amounts)`. The API rejects unbalanced entries with HTTP 400.

### Journal Number Sequence

Auto-generated as `JNL-XXXXXX` per organization. Sequence is determined by counting existing journals + 1, zero-padded to 6 digits.

### Status Lifecycle

```
DRAFT → POSTED → REVERSED
```

- **DRAFT**: Reserved for future use. Currently, journals are auto-posted on creation.
- **POSTED**: Active journal entry. Debits and credits are reflected in the ledger.
- **REVERSED**: Original journal that has been reversed by a compensating entry.

### Reversal Flow

1. POST `/api/accounting/journals/:id/reverse` with optional `reason`
2. System validates: original must be POSTED, not already reversed, no existing reversal
3. Within a transaction:
   - Creates compensating entry (DEBIT ↔ CREDIT lines reversed)
   - Links via `reversedFromId` / `reversalOfId`
   - Marks original as REVERSED
4. Returns the new reversal journal entry

### Validation Rules

- Minimum 2 journal lines required
- All amounts must be positive decimals with up to 2 decimal places
- All referenced accounts must exist and be ACTIVE
- Referenced cost centers must exist
- Referenced fiscal period must be OPEN

## Posting Engine

### Purpose

The posting engine translates business events into journal entries using PostingSourceMaps (defined in M28). This enables automated accounting entries for orders, payments, refunds, etc.

### Replay Flow

1. POST `/api/accounting/posting/replay` with `sourceKey` and optional `sourceDocumentId`
2. System generates idempotent `runKey` from `orgId + sourceKey + sourceDocumentId`
3. If a PostingRun already exists for this runKey → return existing (idempotent)
4. Look up PostingSourceMap by sourceKey + orgId
5. If found: create journal entry from map's debit/credit accounts → PostingRun with SUCCEEDED
6. If not found: create PostingRun with FAILED + PostingError record

### Idempotency

PostingRuns are keyed by `runKey` (unique per org). Replaying the same sourceKey + sourceDocumentId returns the existing run without creating duplicates.

### Error Handling

When a posting fails (e.g., PostingSourceMap not found):
- A PostingRun is created with status FAILED
- A PostingError is created with OPEN status
- Errors can be listed and filtered by status (OPEN/RESOLVED/IGNORED)

## Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/accounting/journals` | `journals:create` | Create balanced journal entry |
| GET | `/api/accounting/journals` | `journals:read` | List journals (paginated, filterable) |
| GET | `/api/accounting/journals/:id` | `journals:read` | Get journal with lines |
| POST | `/api/accounting/journals/:id/reverse` | `journals:reverse` | Reverse a posted journal |
| POST | `/api/accounting/posting/replay` | `posting:replay` | Replay posting from source map |
| GET | `/api/accounting/posting-runs` | `posting-runs:read` | List posting runs |
| GET | `/api/accounting/posting-errors` | `posting-errors:read` | List posting errors |
| GET | `/api/accounting/posting-errors/:id` | `posting-errors:read` | Get posting error detail |

## Permissions

All prefixed with `pos:accounting:`:

| Permission | Owner | Manager | Accountant |
|-----------|-------|---------|------------|
| journals:read | ✅ | ✅ | ✅ |
| journals:create | ✅ | — | ✅ |
| journals:reverse | ✅ | — | ✅ |
| posting:replay | ✅ | — | ✅ |
| posting-runs:read | ✅ | ✅ | ✅ |
| posting-errors:read | ✅ | ✅ | ✅ |

## Seed Data

The seed creates 3 demo items:
1. **Opening Balance Journal** (JNL-000001) — $10,000 debit to Account 1000, credit to Account 3000
2. **Succeeded Posting Run** — ORDER_REVENUE source key with linked journal
3. **Failed Posting Run** — SEED_UNKNOWN_KEY with associated PostingError (OPEN status)
