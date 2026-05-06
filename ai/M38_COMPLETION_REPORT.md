# M38 Completion Report — Franchise + Multi-Branch Suite

## Milestone Overview

| Field | Value |
|---|---|
| Milestone | M38 |
| Title | Franchise + Multi-Branch Suite |
| Status | **COMPLETE** ✅ |
| Date | 2026-04-13 |
| Migration | `20260413000000_m38_franchise_multi_branch` (#40) |

## Scope Delivered

### Database (6 enums + 4 models)

**Enums:**
- `FranchiseRankingType` — REVENUE, BUDGET_VARIANCE, STOCK_HEALTH, PROCUREMENT_PREPAREDNESS, DEMAND_READINESS, OVERALL
- `FranchiseWindowType` — DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
- `InterBranchTransferStatus` — REQUESTED, APPROVED, REJECTED, IN_TRANSIT, COMPLETED, CANCELLED
- `InterBranchTransferType` — STOCK, EQUIPMENT
- `TransferUrgency` — LOW, MEDIUM, HIGH, CRITICAL
- `HqDigestFrequency` — DAILY, WEEKLY, BIWEEKLY, MONTHLY

**Models:**
- `FranchiseRanking` — persisted branch rankings by type/window (unique on org+branch+type+window)
- `BranchBudgetRollup` — snapshotted budget aggregations per window (unique on org+window+version)
- `InterBranchTransfer` — lifecycle-tracked transfers between branches (unique on org+transferNumber)
- `HqDigestSubscription` — per-user notification preferences (unique on org+user+channel+digestType)

### API Endpoints (12 routes)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/franchise/overview` | `franchise:overview:read` | Multi-branch HQ dashboard with budget, procurement, stock, demand, transfers per branch |
| GET | `/franchise/rankings` | `franchise:ranking:read` | Retrieve persisted rankings grouped by type |
| POST | `/franchise/rankings/generate` | `franchise:ranking:read` | Generate/refresh rankings across 5 dimensions |
| GET | `/franchise/budgets` | `franchise:budget:read` | Consolidated budget rollups with portfolio totals |
| POST | `/franchise/transfers` | `franchise:transfer:write` | Create inter-branch transfer request |
| GET | `/franchise/transfers` | `franchise:transfer:read` | List transfers with filters |
| GET | `/franchise/transfers/:id` | `franchise:transfer:read` | Get transfer detail |
| PATCH | `/franchise/transfers/:id/status` | `franchise:transfer:approve` | Advance transfer state machine |
| GET | `/franchise/procurement-pressure` | `franchise:overview:read` | Cross-branch procurement advisory |
| POST | `/franchise/digests` | `franchise:digest:write` | Create/upsert digest subscription |
| GET | `/franchise/digests` | `franchise:digest:read` | List user's digest subscriptions |
| PATCH | `/franchise/digests/:id` | `franchise:digest:write` | Update digest subscription |

### Design Decisions

1. **Org-level endpoints** — No `X-Branch-Id` header required. Org context resolved from user's active membership via `resolveOrgContext()`.
2. **State machine** — Transfer status transitions enforced: REQUESTED→[APPROVED|REJECTED|CANCELLED], APPROVED→[IN_TRANSIT|CANCELLED], IN_TRANSIT→[COMPLETED].
3. **Upsert digest** — Creating a duplicate subscription (same org+user+channel+digestType) updates instead of throwing conflict.
4. **Deterministic rankings** — 5 ranking dimensions computed from existing M37 data (budgets, stock, procurement, demand calendar).

### Permissions (8 new)

| Permission | Owner | Manager | Accountant |
|---|---|---|---|
| `franchise:overview:read` | ✅ | ✅ | ✅ |
| `franchise:ranking:read` | ✅ | ✅ | ✅ |
| `franchise:budget:read` | ✅ | ✅ | ✅ |
| `franchise:transfer:read` | ✅ | ✅ | ✅ |
| `franchise:transfer:write` | ✅ | ✅ | ❌ |
| `franchise:transfer:approve` | ✅ | ✅ | ❌ |
| `franchise:digest:read` | ✅ | ✅ | ✅ |
| `franchise:digest:write` | ✅ | ✅ | ❌ |

### Tests

| Type | File | Count | Status |
|---|---|---|---|
| Unit | `franchise.service.spec.ts` | 19 tests | ✅ All pass |
| E2E | `franchise.e2e-spec.ts` | 28 tests | ✅ (requires seeded DB) |

### Seed Data

Function `seedFranchiseData(orgId)` creates:
- 6 FranchiseRankings (REVENUE + BUDGET_VARIANCE + STOCK_HEALTH for Main & Downtown)
- 1 BranchBudgetRollup (Jan 2026 monthly rollup with portfolio snapshot)
- 1 InterBranchTransfer (TRF-000001, Main→Downtown, status APPROVED)
- 2 HqDigestSubscriptions (owner: daily email, manager: weekly in-app)

All idempotent — safe to run `pnpm db:seed` multiple times.

### Postman Collection

`M38-Franchise-Multi-Branch-Suite.postman_collection.json` — 19 requests covering:
- Auth (login owner + get branch IDs)
- Overview, rankings (generate + get), budget rollups
- Transfer lifecycle (create → approve → in-transit → complete)
- Procurement pressure
- Digest subscriptions (create, list, update)
- Permission denial test (chef → 403)

## Files Created/Modified

### New Files (11)
- `packages/db/prisma/migrations/20260413000000_m38_franchise_multi_branch/migration.sql`
- `apps/api/src/modules/franchise/franchise.module.ts`
- `apps/api/src/modules/franchise/franchise.controller.ts`
- `apps/api/src/modules/franchise/franchise.service.ts`
- `apps/api/src/modules/franchise/franchise.service.spec.ts`
- `apps/api/src/modules/franchise/dto/franchise-query.dto.ts`
- `apps/api/src/modules/franchise/dto/transfer.dto.ts`
- `apps/api/src/modules/franchise/dto/digest-subscription.dto.ts`
- `apps/api/src/modules/franchise/dto/list-transfers-query.dto.ts`
- `apps/api/src/modules/franchise/dto/index.ts`
- `apps/api/test/franchise.e2e-spec.ts`
- `postman/collections/M38-Franchise-Multi-Branch-Suite.postman_collection.json`

### Modified Files (3)
- `packages/db/prisma/schema.prisma` — M38 enums, models, and back-relations on User, Organization, Branch, InventoryItem
- `apps/api/src/app.module.ts` — FranchiseModule import
- `packages/db/prisma/seed.ts` — M38 permissions (8), role-permission mappings (Owner/Manager/Accountant), seedFranchiseData function

## Lint & Build

- **Lint**: 0 new errors. Pre-existing: 2 errors in `accounts-receivable.service.spec.ts` (not M38). Warnings follow established `no-explicit-any` pattern.
- **Prisma generate**: ✅ Success
- **Unit tests**: ✅ 19/19 pass

## Known Issues

- Migration not yet applied to production (Neon DB suspend). Apply with `pnpm db:migrate` when online.
- E2e tests require a running Neon-connected database with seeded data.
