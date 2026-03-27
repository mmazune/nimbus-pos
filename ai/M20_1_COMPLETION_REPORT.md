# Completion Report — M20.1 Reporting Depth Expansion + M20 Finalization

## Context Snapshot

- Current milestone: M20.1 ✅
- Previous completed milestone: M20 — Reporting v1 + Exports
- Next milestone: M21 — TBD
- M13.1 (MTN Native) = PENDING
- M13.2 (Airtel Native) = PENDING

## Summary

- What was built: Expanded M20's 6 basic reports into 24 implemented report generators covering core sales/revenue, loss prevention/cash control, inventory, reservations/events, risk/staff. Added a GET /catalog metadata endpoint returning 35+ catalog entries. Added 13 new permissions, 12 new DTOs, and optimized seed RolePermissions from ~1243 individual queries to 3 batch queries.
- What is now working: 24 report types can be generated via POST endpoints, exported as CSV/PDF, and downloaded. The catalog endpoint lists all report types with status/format/permission metadata. All role-based access control enforced. 39 unit tests + 39 e2e tests pass.

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260328000000_m20_1_reporting_depth/migration.sql` — migration 25
- `apps/api/src/modules/reports/dto/create-sales-by-category-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-sales-by-hour-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-discounts-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-voids-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-refunds-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-cash-variance-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-cash-movements-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-wastage-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-low-stock-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-reservation-summary-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-event-summary-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-staff-operations-report.dto.ts`
- `postman/collections/M20_1-Reporting-Depth-Finalization.postman_collection.json`
- `docs/REPORT_CATALOG_GUIDE.md`

### Changed
- `packages/db/prisma/schema.prisma` — ReportType enum expanded from 8 → 25
- `packages/db/prisma/seed.ts` — 13 new permissions, updated role mappings, optimized RolePermissions batch
- `apps/api/src/modules/reports/reports.service.ts` — rewritten: 20+ generators + catalog
- `apps/api/src/modules/reports/reports.controller.ts` — rewritten: 24+ endpoints
- `apps/api/src/modules/reports/dto/index.ts` — barrel export updated
- `apps/api/src/modules/reports/reports.service.spec.ts` — expanded to 39 tests
- `apps/api/test/reports.e2e-spec.ts` — expanded to 39 tests
- `docs/API_CONVENTIONS.md` — M20 + M20.1 endpoint tables added
- `docs/MODULES.md` — M20.1 row added
- `docs/POSTMAN_ENDPOINT_GUIDE.md` — M20.1 endpoint table added
- `ai/AI_STATUS.md` — M20.1 checklist added, current state updated

## Database

- Prisma models added/changed: ReportType enum expanded (17 new values: SALES_BY_CATEGORY, SALES_BY_HOUR, DISCOUNTS_SUMMARY, VOIDS_SUMMARY, REFUNDS_SUMMARY, CASH_VARIANCE, CASH_MOVEMENTS, WASTAGE_SUMMARY, LOW_STOCK, RESERVATION_DEPOSITS, RESERVATION_NO_SHOWS, EVENT_BOOKINGS, EVENT_CHECKINS, STAFF_OPERATIONS, HIGH_RISK_ACTORS, OPEN_CLOSED_ORDERS, REPORT_CATALOG)
- Migration name: 20260328000000_m20_1_reporting_depth (migration 25)
- Indexes / constraints: None new (uses existing ReportRun + ExportArtifact)
- Seed updates: 13 new permissions added, 4 role mappings updated (Owner, Manager, Accountant, Supervisor). RolePermissions function optimized from N×M findUnique to 3 batch queries + 1 createMany.
- Notes: Total permissions = 113, total seed runs x2 idempotent ✅

## API

- Modules added/changed: reports (rewritten service + controller)
- Endpoints added/updated: 19 new (GET /catalog + 18 POST report generators)
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard on all endpoints
- Audit coverage: All report generations logged (REPORT_GENERATED / REPORT_FAILED / EXPORT_GENERATED)
- Idempotency coverage: Reports are additive (each POST creates new run), not destructive

## Tests

- Unit tests: 39 passing (20 new M20.1 tests) in reports.service.spec.ts
- E2e tests: 39 passing (22 new M20.1 tests) in reports.e2e-spec.ts
- Commands run: `npx jest src/modules/reports/reports.service.spec.ts`, `npx jest --config ./test/jest-e2e.json test/reports.e2e-spec.ts`
- Results: All green ✅

## Postman

- Collection added: M20_1-Reporting-Depth-Finalization.postman_collection.json (24 requests)
- Variables: baseUrl, accessToken, branchId, chefAccessToken, reportRunId, exportArtifactId
- Tests: Status code assertions, type assertions, auto-capture variables

## Docs

- ROADMAP status impact: M20.1 complete
- Files updated: API_CONVENTIONS.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md, AI_STATUS.md
- Files created: REPORT_CATALOG_GUIDE.md

## DONE Checks

- `tsc --noEmit`: 0 errors ✅
- `eslint`: 0 errors, 138 warnings (pre-existing no-explicit-any) ✅
- `jest` (unit): 39 passed ✅
- `jest` (e2e): 39 passed ✅
- `prisma migrate deploy`: migration 25 applied ✅
- `prisma db seed` x2: idempotent ✅
- `prisma generate`: v5.22.0 ✅

## Decisions / Deviations

- Optimized seedRolePermissions: Changed from N×M individual findUnique calls (~1243 round trips) to 3 batch fetches (findMany for roles, permissions, existing rolePermissions) + 1 createMany. This resolved persistent Neon P1001 connection drops during the long loop.
- Report catalog uses `key` + `title` naming (not `reportType` + `label`) to stay consistent with enum key naming patterns.
- CatalogEntry interface exported from service for potential reuse by consumers.

## Known Issues

- Neon Postgres free tier: P1001 / P1017 connection drops are expected during long operations. Batch operations minimize impact. DB must be woken (SELECT 1) before first use after inactivity.
- 138 ESLint warnings: All pre-existing `@typescript-eslint/no-explicit-any` on DTO `parameters?: Record<string, any>` fields across M1-M20 code. Not introduced by M20.1.

## Next Step

- M21 — TBD (as defined by roadmap). Do NOT start until explicitly prompted.
- M13.1 (MTN Native) = PENDING — do not reopen.
- M13.2 (Airtel Native) = PENDING — do not reopen.
