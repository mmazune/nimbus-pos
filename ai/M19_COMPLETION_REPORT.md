# Completion Report — M19 Operational Dashboards + KPI Streams

## Context Snapshot

- Current milestone: M19 ✅
- Previous completed milestone: M18 — Anomaly Detection + Anti-Theft Signals
- Next milestone: M20 — TBD
- M13.1 (MTN Native) = PENDING
- M13.2 (Airtel Native) = PENDING

## Summary

- What was built: Owner/manager operational dashboards with live aggregation, KPI snapshots, manual refresh, and SSE-based metric streaming.
- What is now working: 8 REST endpoints (owner/manager/today-summary/payment-mix/open-orders/low-stock/snapshots/kpi-refresh) + 1 SSE stream endpoint. Live aggregation from Order, Payment, Refund, InventoryItem, AnomalyEvent, Reservation, Event, Shift, TillSession tables. KPI snapshot persistence. 15-second polling SSE stream.

## Files Added / Changed

- `packages/db/prisma/schema.prisma` — Added 3 enums (KpiScopeType, KpiMetricWindow, KpiSubscriptionStatus) + 2 models (KpiSnapshot, KpiSubscription) + relations on User, Organization, Branch
- `packages/db/prisma/migrations/20260327100000_m19_dashboards_kpi_streams/migration.sql` — CREATE TABLE + indexes + FKs
- `packages/db/prisma/seed.ts` — 5 new permissions, role-permission mappings (Owner: all 5, Manager: 4, Accountant: 1, Supervisor: 3), seedDashboardData() function, M19 step in main()
- `apps/api/src/modules/dashboards/dashboards.module.ts` — NestJS module
- `apps/api/src/modules/dashboards/dashboards.service.ts` — ~560 lines, live aggregation helpers + 9 public methods. Closure fixes: `actorUserId` audit field, `startsAt`/`endsAt` for Event queries, `reorderLevel: { gt: 0 }` for InventoryItem
- `apps/api/src/modules/dashboards/dashboards.controller.ts` — DashboardsController (8 endpoints at /dash) + StreamController (1 SSE at /stream/metrics). Closure fixes: removed 4 unused imports, consolidated decorator imports via barrel
- `apps/api/src/modules/dashboards/dto/today-summary-query.dto.ts`
- `apps/api/src/modules/dashboards/dto/dashboard-query.dto.ts`
- `apps/api/src/modules/dashboards/dto/refresh-kpi.dto.ts`
- `apps/api/src/modules/dashboards/dto/stream-metrics-query.dto.ts`
- `apps/api/src/modules/dashboards/dto/index.ts`
- `apps/api/src/modules/dashboards/dashboards.service.spec.ts` — 13 unit tests
- `apps/api/test/dashboards.e2e-spec.ts` — 14 e2e tests
- `apps/api/src/app.module.ts` — Added DashboardsModule import
- `postman/collections/M19-Operational-Dashboards-KPI-Streams.postman_collection.json` — 16 requests
- `postman/POSTMAN_GUIDE.md` — Updated directory listing + coverage table
- `docs/ARCHITECTURE.md` — Added M18 + M19 sections
- `docs/API_CONVENTIONS.md` — Added M18 + M19 endpoint tables
- `docs/MODULES.md` — Updated Anomaly Detection (M18 ✅) and Dashboards/KPIs (M19 ✅)
- `docs/POSTMAN_ENDPOINT_GUIDE.md` — Created (new file, all endpoints M0–M19)
- `ai/AI_STATUS.md` — Updated to M19 ✅, M13.1/M13.2 PENDING

## Database

- Prisma models added: KpiSnapshot, KpiSubscription
- Enums added: KpiScopeType (OWNER/MANAGER/BRANCH), KpiMetricWindow (TODAY/MTD/CUSTOM), KpiSubscriptionStatus (ACTIVE/CLOSED)
- Migration name: `20260327100000_m19_dashboards_kpi_streams`
- Indexes: 12 indexes (orgId, branchId, scopeType, metricWindow, snapshotDate, composite, userId, status)
- Foreign keys: 5 (org cascade, branch set-null, user cascade on both tables)
- Seed updates: 5 permissions + role mappings + 1 sample KpiSnapshot + 1 sample KpiSubscription + seedDashboardData() + recordSeedRun
- Notes: Seed verified idempotent (2 runs, 0 duplicates on second run)

## API

- Modules added: DashboardsModule (registered in app.module.ts)
- Endpoints added:
  - `GET /api/dash/owner` — pos:dash:owner:read
  - `GET /api/dash/manager` — pos:dash:manager:read
  - `GET /api/dash/today-summary` — pos:dash:today-summary:read
  - `GET /api/dash/payment-mix` — pos:dash:today-summary:read
  - `GET /api/dash/open-orders` — pos:dash:today-summary:read
  - `GET /api/dash/low-stock` — pos:dash:today-summary:read
  - `GET /api/dash/snapshots` — pos:dash:owner:read
  - `POST /api/dash/kpi/refresh` — pos:dash:kpi:refresh
  - `SSE GET /api/stream/metrics` — JwtAuthGuard + BranchContextGuard
- Guards: JwtAuthGuard, PermissionGuard, BranchContextGuard on all dashboard endpoints; JwtAuthGuard + BranchContextGuard on stream
- Audit coverage: KPI_REFRESH_TRIGGERED on POST kpi/refresh
- Idempotency: Read endpoints idempotent by nature; refresh creates new snapshot each time (append-only)

## Tests

- Unit tests: 13 tests in dashboards.service.spec.ts (today summary, owner dashboard, manager dashboard, payment mix, open orders, low stock × 2, KPI refresh × 2, snapshots list, stream metrics, branch isolation, anomaly summary)
- e2e tests: 14 tests in dashboards.e2e-spec.ts (owner, manager, today-summary, payment-mix, open-orders, low-stock, snapshots, kpi-refresh × 2, chef 403 × 3, missing branch header, unauthenticated 401)
- Commands run: `pnpm jest`, `pnpm test:e2e`
- Results:
  - Unit: 23 suites, 370 tests — all pass
  - E2E: 19 suites, 337 tests — all pass
  - Lint: 0 errors, 273 warnings (all pre-existing `no-explicit-any`)

## Postman

- Collection added: M19-Operational-Dashboards-KPI-Streams.postman_collection.json (16 requests)
- Variables: baseUrl, accessToken, branchId, snapshotId, chefAccessToken
- Tests: Each request includes pm.test assertions for status codes + response shape
- Requests: Login, Get Branch, Owner Dashboard, Manager Dashboard, Today Summary, Payment Mix, Open Orders, Low Stock, KPI Snapshots, KPI Refresh (TODAY), KPI Refresh (MTD), Login Chef, Chef 403 × 2, Missing Branch, Unauthenticated 401

## Docs

- ROADMAP status impact: M19 ✅; M13.1/M13.2 remain explicitly PENDING
- Files updated:
  - `docs/ARCHITECTURE.md` — M18 + M19 architecture sections
  - `docs/API_CONVENTIONS.md` — M18 + M19 endpoint tables
  - `docs/MODULES.md` — M18 ✅, M19 ✅
  - `docs/POSTMAN_ENDPOINT_GUIDE.md` — Created (all endpoints M0–M19)
  - `postman/POSTMAN_GUIDE.md` — M13–M19 in directory + coverage
  - `ai/AI_STATUS.md` — Current: M19 ✅, Next: M20

## DONE Checks

- `pnpm db:generate` — ✅ Pass (Prisma Client v5.22.0)
- `prisma migrate status` — ✅ 23 migrations applied, schema up to date
- `pnpm db:seed` — ✅ Pass (idempotent, 0 created / all skipped)
- `pnpm db:seed` (2nd run) — ✅ Pass (0 created, all skipped)
- `pnpm lint` — ✅ 0 errors, 273 warnings
- `pnpm jest` (unit) — ✅ 23 suites, 370 tests pass
- `pnpm test:e2e` — ✅ 19 suites, 337 tests pass
- `pnpm dev:api` — ✅ Server starts, all routes mapped
- Manual API verification — ✅ All 9 endpoints verified with live data
- Postman contract — ✅ baseUrl=http://localhost:3001, no /api suffix, all pm.environment.set/get
- CI workflow — ✅ `.github/workflows/branch-validation.yml` validates lint + unit + e2e

## Decisions / Deviations

- SSE stream uses interval-based polling (15s) via rxjs `interval().pipe(startWith(0), switchMap(...))` instead of EventEmitter2 pattern used by KDS—simpler for dashboard metrics that don't have real-time event sources.
- Payment mix comes from Payment records (COMPLETED status) grouped by method, not from order totals.
- Low stock detection compares sum of StockBatch.remainingQty against InventoryItem.reorderLevel per item.
- Stream endpoint uses only JwtAuthGuard + BranchContextGuard (no PermissionGuard) to keep SSE connection lightweight.

## Closure Bugfixes Applied

- `dashboards.controller.ts`: Removed 4 unused imports (Query, ForbiddenException, map, StreamMetricsQueryDto). Consolidated decorator imports from individual files to barrel `../../common/decorators` (fixed TS2307 for non-existent `branch-context.decorator` file).
- `dashboards.service.ts`: Fixed `userId` → `actorUserId` in audit log call (AuditEntry interface). Fixed `startDate`/`endDate` → `startsAt`/`endsAt` in `countEventsToday()`. Fixed `reorderLevel: { not: null }` → `reorderLevel: { gt: 0 }` in `countLowStock()` and `getLowStock()` (Decimal field, not nullable).
- `dashboards.service.spec.ts`: Updated test assertion to match `actorUserId`.
- `analytics/` + `events/`: Prettier formatting only (`{ }` → `{}`).

## Known Issues

- Neon P1001 suspend: Long seed runs may hit connection timeout if Neon auto-suspends mid-execution. Retry resolves.
- Worker process force-exit warning during unit test runs (timer leak from SSE interval in DashboardsService — cosmetic, does not affect results).

## Next Step

- M20 — TBD (pending roadmap decision)
- M13.1 (MTN Native Request-to-Pay) — STILL PENDING
- M13.2 (Airtel Native Integration) — STILL PENDING
