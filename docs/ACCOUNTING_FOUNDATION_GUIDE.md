# Accounting Foundation Guide — M28

## Overview

M28 introduces the **Accounting Foundation** layer: a Chart of Accounts (COA), Cost Centers, Fiscal Periods, Posting Source Maps, and Tax Ledger Configuration. This is the structural scaffolding upon which future journal-posting, AP/AR, bank reconciliation, and period-close milestones will build.

**Scope boundary:** M28 is foundation only — no journal entries, no AP/AR, no bank rec, no period-close automation.

## Models

| Model | Purpose |
|-------|---------|
| `Account` | Chart of Accounts entries (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE) |
| `CostCenter` | Organizational cost allocation buckets |
| `FiscalPeriod` | Time-bounded accounting periods (DRAFT → OPEN → CLOSED → LOCKED) |
| `PostingSourceMap` | Maps business events (e.g., ORDER_REVENUE) to debit/credit accounts |
| `TaxLedgerConfig` | Links tax-related, discount, deposit, and payroll accounts for auto-posting |

## Enums

- **AccountType**: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`
- **AccountStatus**: `ACTIVE`, `INACTIVE`, `SYSTEM_LOCKED`
- **FiscalPeriodStatus**: `DRAFT`, `OPEN`, `CLOSED`, `LOCKED`

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/accounting/accounts` | `pos:accounting:accounts:read` | List accounts (filterable by type, status, parent) |
| POST | `/api/accounting/accounts` | `pos:accounting:accounts:create` | Create a new account |
| GET | `/api/accounting/cost-centers` | `pos:accounting:cost-centers:read` | List active cost centers |
| POST | `/api/accounting/cost-centers` | `pos:accounting:cost-centers:create` | Create a new cost center |
| GET | `/api/accounting/periods` | `pos:accounting:periods:read` | List fiscal periods |
| POST | `/api/accounting/periods` | `pos:accounting:periods:create` | Create a new fiscal period |
| PATCH | `/api/accounting/periods/:id/open` | `pos:accounting:periods:open` | Transition period from DRAFT → OPEN |
| GET | `/api/accounting/posting-source-maps` | `pos:accounting:posting-source-maps:read` | List posting source maps |
| PATCH | `/api/accounting/posting-source-maps/:id` | `pos:accounting:posting-source-maps:update` | Update a posting source map |
| GET | `/api/accounting/tax-config` | `pos:accounting:tax-config:read` | Get active tax ledger config |
| PATCH | `/api/accounting/tax-config` | `pos:accounting:tax-config:update` | Update/create tax ledger config |

## Permissions (11 total)

```
pos:accounting:accounts:read
pos:accounting:accounts:create
pos:accounting:cost-centers:read
pos:accounting:cost-centers:create
pos:accounting:periods:read
pos:accounting:periods:create
pos:accounting:periods:open
pos:accounting:posting-source-maps:read
pos:accounting:posting-source-maps:update
pos:accounting:tax-config:read
pos:accounting:tax-config:update
```

## Role Matrix

| Role | Permissions |
|------|------------|
| **Owner** | All 11 |
| **Accountant** | All 11 (primary domain) |
| **Manager** | Read + create accounts/cost-centers/periods + posting-source-maps:read + tax-config:read |
| Others | No accounting access |

## Business Rules

1. **Account codes** are unique per organization (`@@unique([orgId, code])`)
2. Accounts support **self-referencing hierarchy** via `parentAccountId`
3. `systemManaged` accounts are created by seed — not editable via API
4. Fiscal period **overlap detection** prevents creating overlapping periods in same org
5. Fiscal period status machine: `DRAFT → OPEN` (CLOSED/LOCKED reserved for future milestones)
6. Posting source maps link business events to debit/credit account pairs
7. Tax ledger config provides a single-row configuration per org linking 5 account types
8. All write operations produce **audit log** entries

## Seed Data

The seed creates:
- 13 system COA accounts (Cash, Bank, Inventory, AR, AP, Deposit Liability, Output Tax, Payroll Payable, Owner Equity, Revenue, COGS, Discounts, Input Tax)
- 1 cost center (CC-KITCHEN)
- 1 fiscal period (current quarter, status OPEN)
- 6 posting source maps (ORDER_REVENUE, PAYMENT_RECEIVED, REFUND_ISSUED, INVENTORY_PURCHASE, PAYROLL_EXPENSE, DEPOSIT_COLLECTED)
- 1 tax ledger config linking the relevant system accounts

## Future Milestones

- **M29+**: Journal posting engine, AP/AR subledgers, bank reconciliation, period-close automation — all will build on M28 foundation models.
