# M28 Completion Report — Accounting Foundation (COA + Cost Centers + Fiscal Periods)

## Milestone Summary

| Attribute | Value |
|-----------|-------|
| Milestone | M28 |
| Title | Accounting Foundation (COA + Cost Centers + Fiscal Periods) |
| Branch | `milestone/m28-accounting-foundation-coa-cost-centers-periods` |
| Status | ✅ COMPLETE |
| Date | 2026-04-02 |

## Scope

Foundation layer for the accounting subsystem. Chart of Accounts with hierarchical structure, Cost Centers for allocation, Fiscal Periods with status machine, Posting Source Maps to link business events to accounts, and Tax Ledger Configuration.

**Not in scope:** Journal posting, AP/AR subledgers, bank reconciliation, period-close automation.

## Schema Changes

### New Enums (3)
- `AccountType` — ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- `AccountStatus` — ACTIVE, INACTIVE, SYSTEM_LOCKED
- `FiscalPeriodStatus` — DRAFT, OPEN, CLOSED, LOCKED

### New Models (5)
- `Account` — Chart of Accounts entries with org-unique codes and self-referencing hierarchy
- `CostCenter` — Cost allocation buckets per org
- `FiscalPeriod` — Time-bounded periods with DRAFT→OPEN state transition
- `PostingSourceMap` — Maps business event keys to debit/credit account pairs
- `TaxLedgerConfig` — Single-row config linking tax, discount, deposit, and payroll accounts

### Migration
- `#34: 20260402000000_m28_accounting_foundation_coa_cost_centers_periods`

## Endpoints (11)

| # | Method | Path | Permission |
|---|--------|------|------------|
| 1 | GET | `/api/accounting/accounts` | `pos:accounting:accounts:read` |
| 2 | POST | `/api/accounting/accounts` | `pos:accounting:accounts:create` |
| 3 | GET | `/api/accounting/cost-centers` | `pos:accounting:cost-centers:read` |
| 4 | POST | `/api/accounting/cost-centers` | `pos:accounting:cost-centers:create` |
| 5 | GET | `/api/accounting/periods` | `pos:accounting:periods:read` |
| 6 | POST | `/api/accounting/periods` | `pos:accounting:periods:create` |
| 7 | PATCH | `/api/accounting/periods/:id/open` | `pos:accounting:periods:open` |
| 8 | GET | `/api/accounting/posting-source-maps` | `pos:accounting:posting-source-maps:read` |
| 9 | PATCH | `/api/accounting/posting-source-maps/:id` | `pos:accounting:posting-source-maps:update` |
| 10 | GET | `/api/accounting/tax-config` | `pos:accounting:tax-config:read` |
| 11 | PATCH | `/api/accounting/tax-config` | `pos:accounting:tax-config:update` |

## Permissions (11)

All new permissions follow the `pos:accounting:*` namespace.

## Role Matrix

| Role | Access |
|------|--------|
| Owner | All 11 permissions |
| Accountant | All 11 permissions (primary domain) |
| Manager | Read + create subset (no period:open, no posting-source-maps:update, no tax-config:update) |

## Tests

- **Unit tests:** `accounting.service.spec.ts` — 26 tests
- **E2e tests:** `accounting.e2e-spec.ts` — 21 tests

## Seed Data

- 13 system COA accounts
- 1 cost center (CC-KITCHEN)
- 1 fiscal period (current quarter, OPEN)
- 6 posting source maps
- 1 tax ledger config
- 11 permissions + role mappings

## Postman

- `M28-Accounting-Foundation-COA-Cost-Centers-Periods.postman_collection.json` — 15 requests

## Files Created/Modified

### Created
- `apps/api/src/modules/accounting/accounting.module.ts`
- `apps/api/src/modules/accounting/accounting.controller.ts`
- `apps/api/src/modules/accounting/accounting.service.ts`
- `apps/api/src/modules/accounting/accounting.service.spec.ts`
- `apps/api/src/modules/accounting/dto/create-account.dto.ts`
- `apps/api/src/modules/accounting/dto/list-accounts-query.dto.ts`
- `apps/api/src/modules/accounting/dto/create-cost-center.dto.ts`
- `apps/api/src/modules/accounting/dto/create-fiscal-period.dto.ts`
- `apps/api/src/modules/accounting/dto/open-fiscal-period.dto.ts`
- `apps/api/src/modules/accounting/dto/update-posting-source-map.dto.ts`
- `apps/api/src/modules/accounting/dto/update-tax-ledger-config.dto.ts`
- `apps/api/src/modules/accounting/dto/index.ts`
- `apps/api/test/accounting.e2e-spec.ts`
- `packages/db/prisma/migrations/20260402000000_m28_.../migration.sql`
- `postman/collections/M28-Accounting-Foundation-COA-Cost-Centers-Periods.postman_collection.json`
- `docs/ACCOUNTING_FOUNDATION_GUIDE.md`
- `ai/M28_COMPLETION_REPORT.md`

### Modified
- `packages/db/prisma/schema.prisma` — 3 enums, 5 models, relation arrays on Org/Branch/User
- `packages/db/prisma/seed.ts` — 11 permissions, role mappings, seedAccountingFoundationData(), step 43
- `apps/api/src/app.module.ts` — Added AccountingModule import
- `ai/AI_STATUS.md` — M28 checklist
- `docs/MODULES.md` — M28 row

## Closure Gates

- [x] Schema + migration applied
- [x] Prisma client generated
- [x] Service with full business logic
- [x] Controller with guards + permissions
- [x] Module wired into AppModule
- [x] Unit tests written
- [x] E2e tests written
- [x] Seed data idempotent
- [x] Postman collection with test scripts
- [x] AI_STATUS.md updated
- [x] MODULES.md updated
- [x] Guide documentation created
- [x] M13.1/M13.2 remain PENDING
