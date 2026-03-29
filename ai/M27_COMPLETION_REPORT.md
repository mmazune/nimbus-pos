# M27 Completion Report — Staff Insights + Awards + Promotion Suggestions

## Milestone Summary

| Item                  | Detail                                                               |
| --------------------- | -------------------------------------------------------------------- |
| Milestone             | M27                                                                  |
| Title                 | Staff Insights + Awards + Promotion Suggestions                      |
| Branch                | `milestone/m27-staff-insights-awards-promotions`                     |
| Date Completed        | 2026-04-01                                                           |
| Schema Changes        | 3 enums, 3 models, migration #33                                    |
| New Module            | `StaffInsightsModule`                                                |
| Endpoints             | 10                                                                   |
| Permissions           | 7 new                                                                |
| Unit Tests            | 20 tests in `staff-insights.service.spec.ts`                         |
| E2e Tests             | 20 tests in `staff-insights.e2e-spec.ts`                             |
| Postman Requests      | 10                                                                   |
| Seed Data             | 3 records (1 snapshot, 1 award, 1 promotion suggestion)              |
| M13.1 (MTN Native)    | PENDING — untouched                                                  |
| M13.2 (Airtel Native) | PENDING — untouched                                                  |

## What Was Built

### 1. Prisma Schema (3 enums + 3 models)

**Enums:**
- `StaffInsightStatus` — ACTIVE, SUPERSEDED, ARCHIVED
- `AwardType` — EMPLOYEE_OF_MONTH, BEST_UPSELLER, RELIABILITY_STAR, ZERO_WASTE_CHAMPION, CUSTOMER_FAVORITE, CUSTOM
- `PromotionSuggestionStatus` — PENDING, ACCEPTED, REJECTED, DISMISSED

**Models:**
- `StaffInsightSnapshot` — Composite scoring snapshot per employee per period
- `StaffAward` — Employee recognition with risk-block protection
- `PromotionSuggestion` — Data-driven promotion recommendation with decision workflow

### 2. Migration #33

`20260401100000_m27_staff_insights_awards_promotions/migration.sql`
- 3 enum types
- 3 tables with all foreign keys and indexes
- Unique constraint: `(orgId, employeeId, periodStart, periodEnd)` on snapshots

### 3. Module Structure

```
apps/api/src/modules/staff-insights/
├── dto/
│   ├── list-staff-insights-query.dto.ts
│   ├── create-staff-award.dto.ts
│   ├── generate-promotion-suggestions.dto.ts
│   ├── decide-promotion-suggestion.dto.ts
│   ├── update-staff-weights.dto.ts
│   └── index.ts
├── staff-insights.controller.ts
├── staff-insights.service.ts
├── staff-insights.service.spec.ts
└── staff-insights.module.ts
```

### 4. API Endpoints (10)

| # | Method | Path                                              | Permission                      |
|---|--------|---------------------------------------------------|---------------------------------|
| 1 | GET    | `/api/staff/weights`                              | `pos:staff:weights:read`        |
| 2 | PATCH  | `/api/staff/weights`                              | `pos:staff:weights:update`      |
| 3 | POST   | `/api/staff/insights/generate`                    | `pos:staff:insights:read`       |
| 4 | GET    | `/api/staff/insights`                             | `pos:staff:insights:read`       |
| 5 | GET    | `/api/staff/insights/:employeeId`                 | `pos:staff:insights:read`       |
| 6 | POST   | `/api/staff/awards`                               | `pos:staff:awards:create`       |
| 7 | GET    | `/api/staff/awards`                               | `pos:staff:awards:read`         |
| 8 | POST   | `/api/staff/promotion-suggestions/generate`       | `pos:staff:promotions:generate` |
| 9 | GET    | `/api/staff/promotion-suggestions`                | `pos:staff:promotions:generate` |
| 10| PATCH  | `/api/staff/promotion-suggestions/:id/decision`   | `pos:staff:promotions:decide`   |

### 5. Permissions (7)

| Permission                        | Owner | Manager | Supervisor | Accountant | Cashier/Waiter/Chef |
|-----------------------------------|-------|---------|------------|------------|---------------------|
| `pos:staff:insights:read`         | ✅    | ✅      | ✅         | —          | —                   |
| `pos:staff:awards:create`         | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:awards:read`           | ✅    | ✅      | ✅         | —          | —                   |
| `pos:staff:promotions:generate`   | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:promotions:decide`     | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:weights:read`          | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:weights:update`        | ✅    | —       | —          | —          | —                   |

### 6. Business Rules

- **Composite scoring:** Weighted average from 4 dimensions (sales, reliability, attendance, wastage) minus risk penalty
- **Risk-block rule:** Cannot create awards for employees with unresolved HIGH/CRITICAL anomaly events
- **Idempotent generation:** If snapshot already exists for the same employee+period, returns existing
- **Promotion threshold:** Only employees with compositeScore >= 70 are suggested
- **Decision workflow:** PENDING → ACCEPTED/REJECTED/DISMISSED (no auto-mutation of Employee position)
- **Configurable weights:** Stored in `OrgSettings.franchiseWeights.staffInsightWeights` JSON field

### 7. Seed Data (Step 42)

- 1 `StaffInsightSnapshot` (March 2025, compositeScore: 84.5)
- 1 `StaffAward` (EMPLOYEE_OF_MONTH)
- 1 `PromotionSuggestion` (PENDING)

### 8. Files Changed / Created

**Created:**
- `packages/db/prisma/migrations/20260401100000_m27_staff_insights_awards_promotions/migration.sql`
- `apps/api/src/modules/staff-insights/` (8 files)
- `apps/api/test/staff-insights.e2e-spec.ts`
- `postman/collections/M27-Staff-Insights-Awards-Promotion-Suggestions.postman_collection.json`
- `docs/STAFF_INSIGHTS_GUIDE.md`
- `ai/M27_COMPLETION_REPORT.md`

**Modified:**
- `packages/db/prisma/schema.prisma` — 3 enums, 3 models, relation additions
- `packages/db/prisma/seed.ts` — 7 permissions, role mappings, `seedStaffInsightsData()`, main() step 42
- `apps/api/src/app.module.ts` — StaffInsightsModule import
- `ai/AI_STATUS.md` — M27 checklist
- `docs/MODULES.md` — M27 row

## Verification Status

- [x] `pnpm lint` — 0 errors, 24 warnings (pre-existing `no-explicit-any`)
- [x] `pnpm jest` — 20/20 unit tests pass
- [x] `pnpm test:e2e` — 20/20 e2e tests pass
- [x] Seed runs idempotently (all 3 M27 records skipped on re-run)
- [x] Postman collection manually validated (10 requests, `baseUrl=http://localhost:3001`, runtime captures)
- [x] `pnpm dev:api` starts cleanly, all 10 routes mapped
- [x] Manual API smoke test: GET/weights ✓, GET/insights ✓, GET/awards ✓, GET/promotions ✓, 401 ✓, 403 ✓
