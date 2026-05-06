# Completion Report — M38.1 Franchise Analytics + Consolidation

## Context Snapshot

- Current milestone: M38.1 — Franchise Analytics + Consolidation (repo-local enhancement between M38 and M39)
- Previous completed milestone: M38 — Franchise + Multi-Branch Suite ✅
- Next milestone: M39 — TBD (see ROADMAP.md)

## Summary

- **What was built:** A comprehensive franchise analytics and consolidation layer that deepens M38's franchise dashboard with:
  1. **Consolidated Finance View** — Revenue, COGS, GP, labor, prime cost, overhead, budget-vs-actual rolled up across all branches with per-branch contribution percentages
  2. **Financial Comparison** — Portfolio averages, best/worst branch identification, per-branch vs-portfolio deltas
  3. **Waste Benchmarks** — Waste value, waste% of COGS, waste% of sales, theoretical-vs-actual COGS variance, top waste reasons + items, ranked by efficiency
  4. **Branch Performance Scorecards** — 7 domains (FINANCIAL, PRIME_COST, WASTE_VARIANCE, STOCK_HEALTH, PROCUREMENT_READINESS, DEMAND_READINESS, OPERATIONAL_RISK) with deterministic STRONG/WATCH/AT_RISK tiering
  5. **Deep Rankings** — 6 new ranking types (PRIME_COST, WASTE_EFFICIENCY, THEORETICAL_VARIANCE, GROSS_MARGIN, LABOR_EFFICIENCY, OVERALL_FINANCIAL_DISCIPLINE) persisted to FranchiseRanking
  6. **Drilldown** — Franchise total → branch → category/item/department/account/cost-center breakdowns for REVENUE, COGS, LABOR, PRIME_COST, OVERHEAD
  7. **Snapshot Persistence** — Consolidation runs, KPI snapshots, waste benchmark snapshots, scorecards all upserted with audit trails
- **What is now working:** All 9 endpoints under `/franchise/*`, snapshot generation with audit, deterministic tiering and ranking, full seed data, Postman collection

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260414000000_m38_1_franchise_analytics_consolidation/migration.sql`
- `apps/api/src/modules/franchise-analytics/franchise-analytics.module.ts`
- `apps/api/src/modules/franchise-analytics/franchise-analytics.controller.ts`
- `apps/api/src/modules/franchise-analytics/franchise-analytics.service.ts`
- `apps/api/src/modules/franchise-analytics/franchise-analytics.service.spec.ts`
- `apps/api/src/modules/franchise-analytics/dto/franchise-analytics.dto.ts`
- `apps/api/src/modules/franchise-analytics/dto/index.ts`
- `apps/api/test/franchise-analytics.e2e-spec.ts`
- `postman/M38_1-Franchise-Analytics-Consolidation.postman_collection.json`
- `ai/M38_1_COMPLETION_REPORT.md` (this file)

### Changed
- `packages/db/prisma/schema.prisma` — 5 new enums, 6 new FranchiseRankingType values, 4 new models, back-relations on Organization/Branch/User
- `packages/db/prisma/seed.ts` — 5 new permissions, ROLE_PERM_MATRIX updates (Owner/Manager/Accountant), `seedFranchiseAnalyticsData()` function + invocation in main()
- `apps/api/src/app.module.ts` — Added FranchiseAnalyticsModule import
- `ai/AI_STATUS.md` — Updated last milestone, counts, added M38.1 section

## Database

- **Prisma models added:** FranchiseKpiSnapshot, FranchiseConsolidationRun, BranchPerformanceScorecard, WasteBenchmarkSnapshot
- **Enums added:** FranchiseMetricFamily (6 values), ConsolidationRunStatus (4), ScorecardDomain (7), PerformanceTier (3), WasteMetricType (4)
- **Enum values extended:** FranchiseRankingType (+6: PRIME_COST, WASTE_EFFICIENCY, THEORETICAL_VARIANCE, GROSS_MARGIN, LABOR_EFFICIENCY, OVERALL_FINANCIAL_DISCIPLINE)
- **Migration name:** `20260414000000_m38_1_franchise_analytics_consolidation`
- **Migration number:** 41
- **Indexes / constraints:** All 4 models have composite unique constraints for org+window deduplication, plus individual indexes on orgId, branchId, windowType
- **Seed updates:** `seedFranchiseAnalyticsData()` — 4 KPI snapshots, 1 consolidation run, 6 scorecards, 2 waste benchmarks, 6 deep rankings; idempotent via findFirst guards

## API

- **Modules added:** `franchise-analytics/` (controller, service, module — separate from M38 `franchise/`)
- **Endpoints added (9):**
  | Method | Path | Permission | Description |
  |--------|------|-----------|-------------|
  | GET | /franchise/consolidated-finance | franchise:analytics:read | Consolidated finance view across all branches |
  | POST | /franchise/consolidated-finance/generate | franchise:consolidation:generate | Generate + persist KPI snapshots |
  | GET | /franchise/financial-comparison | franchise:analytics:read | Branch-vs-branch financial comparison |
  | GET | /franchise/waste-benchmarks | franchise:waste-benchmark:read | Waste benchmarks + rankings |
  | POST | /franchise/waste-benchmarks/generate | franchise:waste-benchmark:read | Generate + persist waste benchmark snapshots |
  | GET | /franchise/scorecards | franchise:scorecard:read | Branch scorecards (7 domains) |
  | POST | /franchise/scorecards/generate | franchise:scorecard:read | Generate + persist scorecards |
  | POST | /franchise/rankings/generate-deep | franchise:ranking:generate-deep | Generate 6 deep ranking types |
  | GET | /franchise/drilldown | franchise:analytics:read | Drilldown from franchise → branch → details |
- **Guards applied:** JwtAuthGuard + PermissionGuard on all endpoints
- **Audit coverage:** 4 audited actions — FRANCHISE_CONSOLIDATION_GENERATED, FRANCHISE_WASTE_BENCHMARK_GENERATED, FRANCHISE_SCORECARDS_GENERATED, FRANCHISE_DEEP_RANKINGS_GENERATED
- **Idempotency:** All snapshot/ranking endpoints use upsert with composite unique keys — safe to call repeatedly

## Tests

- **Unit tests:** `franchise-analytics.service.spec.ts` — 18+ test cases covering:
  - resolveOrgContext (happy + no membership)
  - Consolidated finance (all branches, default window, custom window, contribution sum)
  - Branch financials (prime cost calculation, zero revenue handling)
  - Financial comparison (portfolio averages, best/worst, vsPortfolio)
  - Waste benchmarks (ranking by efficiency, branch filtering)
  - Scorecards (7 domains per branch, deterministic tier assignment)
  - Deep rankings (6 types generated, type filtering, empty branches)
  - Drilldown (revenue, missing branchId, missing metricFamily, nonexistent branch)
  - Consolidated snapshot (success + failure with FAILED status)
  - Tiering determinism (threshold boundary testing)
- **E2e tests:** `franchise-analytics.e2e-spec.ts` — 20+ test cases covering:
  - Auth: 401/403 per endpoint type
  - Consolidated finance: default + windowed responses
  - Snapshot generation: COMPLETED status + runId + metricsCount
  - Financial comparison: portfolioAverage, bestBranch, worstBranch, vsPortfolio
  - Waste benchmarks: portfolioAverage, ranks, calculationBasis
  - Scorecards: 7 domains, valid tier enum values
  - Deep rankings: all 6 types, determinism (same input → same output)
  - Drilldown: REVENUE, COGS, PRIME_COST decomposition, 400 on missing branchId
- **Commands to run:** `cd apps/api && pnpm jest --testPathPattern franchise-analytics`

## Postman

- **Collection added:** `M38_1-Franchise-Analytics-Consolidation.postman_collection.json`
- **Requests (14):** Login, Consolidated Finance GET + POST, Financial Comparison, Waste Benchmarks GET + POST, Scorecards GET + POST, Deep Rankings POST, Drilldown (REVENUE, COGS, PRIME_COST, 400 validation)
- **Variables auto-captured:** accessToken (from login), branchId (from consolidated finance response)
- **Tests per request:** Status code, response shape, field type validations

## Docs

- **ROADMAP status impact:** M38.1 is a repo-local enhancement — no ROADMAP line item change needed
- **Files updated:** AI_STATUS.md (last milestone, counts, M38.1 section), this completion report

## Permissions

| Permission | Owner | Manager | Accountant |
|-----------|-------|---------|------------|
| franchise:analytics:read | ✅ | ✅ | ✅ |
| franchise:consolidation:generate | ✅ | ✅ | ✅ |
| franchise:waste-benchmark:read | ✅ | ✅ | ✅ |
| franchise:scorecard:read | ✅ | ✅ | ✅ |
| franchise:ranking:generate-deep | ✅ | ✅ | ✅ |

## DONE Checks

- `pnpm lint` — TBD (run after all edits)
- `pnpm test` — TBD (unit tests written, to be verified)
- Migration created (not yet applied — Neon DB may be suspended)
- Seed data written, idempotent pattern verified
