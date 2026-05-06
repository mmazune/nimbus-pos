# Completion Report — M37 Refactoring: Demand-Aware Operational Planning

## Context Snapshot

- Current milestone: M37 (Budgets + Forecasts + Procurement Advisory) — **REFACTORING**
- Previous completed milestone: M37 (original generic GL-sourced version)
- Next milestone: M38 — Franchise + Multi-Branch Suite

## Summary

- **What was built**: Refactored M37 from a generic GL-sourced run-rate forecast system into an enterprise-grade operational demand planning system with two planning layers: (1) Financial planning (budgets, actuals, variance from GL) and (2) Operational demand planning (daypart-aware forecasting, event/calendar overlays, reservation/covers overlays, BOM-based item usage projection, urgency-classified procurement advisory). All forecast logic is rules-based and explainable — no AI/ML black boxes.

- **What is now working**:
  - Demand Calendar: CRUD for explicit demand drivers (brunch schedules, sports nights, holiday rushes, private events, large reservations)
  - Daypart-aware forecasting with baseline from same-weekday historical orders
  - Calendar uplift via demandMultiplier and expectedCovers
  - Reservation covers overlay mapped to dayparts
  - Busy period detection (>1.3x baseline or +20 covers)
  - BOM-based item usage projection from RecipeIngredient
  - Calendar item mentions (itemNotes) → 1.5x uplift for mentioned items
  - Urgency classification: URGENT_LOCAL_BUY, STOCK_UP_BEFORE_EVENT, ORDER_NEXT_PO, MONITOR
  - Human-readable suggestedAction and rationale for every procurement suggestion
  - Procurement suggestion urgency filtering
  - Typed ReviewProcurementSuggestionDto (replaces inline body type)

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260413000000_m37_demand_calendar_forecast_refactor/migration.sql`
- `apps/api/src/modules/budget/forecast.service.ts`
- `apps/api/src/modules/budget/forecast.service.spec.ts`
- `apps/api/src/modules/budget/demand-calendar.service.ts`
- `apps/api/src/modules/budget/demand-calendar.service.spec.ts`
- `apps/api/src/modules/budget/dto/demand-calendar.dto.ts`
- `apps/api/src/modules/budget/dto/review-procurement-suggestion.dto.ts`

### Changed
- `packages/db/prisma/schema.prisma` — 3 new enums, RUNNING added to ForecastRunStatus, enhanced ForecastRun model, enhanced ProcurementSuggestion model, new DemandCalendarEntry model, relations on User/Organization/Branch/Event
- `apps/api/src/modules/budget/budget.service.ts` — Removed old getForecast() method, added urgency filter to listProcurementSuggestions, kept budget CRUD + actuals + procurement review
- `apps/api/src/modules/budget/budget.controller.ts` — Added DemandCalendarController, updated ForecastController to use ForecastService, added ReviewProcurementSuggestionDto usage, added urgency query param
- `apps/api/src/modules/budget/budget.module.ts` — Registered ForecastService, DemandCalendarService, DemandCalendarController
- `apps/api/src/modules/budget/budget.service.spec.ts` — Removed getForecast tests, added urgency filter tests
- `apps/api/src/modules/budget/dto/list-forecast-query.dto.ts` — Added ForecastHorizonDto enum + horizon field
- `apps/api/src/modules/budget/dto/index.ts` — Added exports for new DTOs
- `apps/api/test/budget.e2e-spec.ts` — Added demand calendar CRUD tests, updated forecast test for operational summary
- `packages/db/prisma/seed.ts` — Added demand-calendar permissions, demand calendar seed entries (3), updated role matrices
- `postman/collections/M37-Budgets-Forecasts-Procurement-Advisory.postman_collection.json` — Added Demand Calendar section (6 requests)
- `ai/AI_STATUS.md` — Updated M37 section

## Database

- **Prisma models added/changed**: DemandCalendarEntry (new), ForecastRun (enhanced), ProcurementSuggestion (enhanced)
- **New enums**: DemandCalendarType (BRUNCH, SPORTS_NIGHT, DJ_NIGHT, PRIVATE_EVENT, HOLIDAY_RUSH, PROMOTION, LARGE_RESERVATION, CUSTOM), DaypartType (BREAKFAST, LUNCH, AFTERNOON, DINNER, LATE_NIGHT, ALL_DAY), ProcurementUrgency (MONITOR, ORDER_NEXT_PO, STOCK_UP_BEFORE_EVENT, TRANSFER_FROM_BRANCH, URGENT_LOCAL_BUY)
- **Migration name**: `20260413000000_m37_demand_calendar_forecast_refactor`
- **Indexes**: demand_calendar_entries org+branch+dateStart composite; forecast_runs forecastHorizonStart; procurement_suggestions urgency, demandCalendarEntryId
- **Seed updates**: 3 DemandCalendarEntry seed records (Sunday Brunch, Premier League Night, Valentine's Day), 2 new permissions, role matrices updated
- **Notes**: Uses IF NOT EXISTS for safety; backfills default values for new NOT NULL columns

## API

- **Modules added/changed**: BudgetModule (added ForecastService, DemandCalendarService, DemandCalendarController)
- **Endpoints added/updated**:
  - GET /finance/demand-calendar (list, filter by type/daypart/dateRange)
  - GET /finance/demand-calendar/:id
  - POST /finance/demand-calendar
  - PATCH /finance/demand-calendar/:id
  - DELETE /finance/demand-calendar/:id
  - GET /finance/procurement-suggestions?urgency= (added urgency filter)
  - PATCH /finance/procurement-suggestions/:id/review (now uses ReviewProcurementSuggestionDto)
  - GET /franchise/forecast (now uses ForecastService with demand-aware logic, supports horizon param)
- **Guards applied**: JwtAuthGuard + PermissionGuard + BranchContextGuard on all controllers
- **Audit coverage**: DEMAND_CALENDAR_CREATED, DEMAND_CALENDAR_UPDATED, DEMAND_CALENDAR_DELETED, FORECAST_RUN_CREATED, BUDGET_CREATED, BUDGET_ACTUALS_REFRESHED, PROCUREMENT_SUGGESTION_REVIEWED
- **Idempotency coverage**: Seed uses findFirst to skip existing records

## Tests

- **Unit tests**: budget.service.spec.ts (14 tests), forecast.service.spec.ts (12 tests — daypart summaries, calendar uplift, reservation overlay, busy detection, demand signals, urgency classification, item usage projection with BOM, calendar mention uplift, hourToDaypart), demand-calendar.service.spec.ts (8 tests — CRUD + validation)
- **E2e tests**: budget.e2e-spec.ts — expanded with demand calendar CRUD lifecycle, operational forecast output validation
- **Commands run**: (pending — lint + test validation step)

## Postman

- **Collection updated**: M37-Budgets-Forecasts-Procurement-Advisory.postman_collection.json
- **Variables/tests added**: `demandCalendarId` variable, 6 new Demand Calendar requests (List, Create, Get by ID, Update, Delete, Filter by Type)
- **Manual checklist**: Updated to 17 steps (was 12)

## Docs

- **ROADMAP status impact**: M37 remains ✅ — this is a refactoring, not a new milestone
- **Files updated**: ai/AI_STATUS.md (M37 section), ai/M37_REFACTOR_COMPLETION_REPORT.md (this file)

## Decisions / Deviations

- Kept BudgetService for budget CRUD + actuals + procurement review; extracted forecast generation into ForecastService; created DemandCalendarService for demand calendar CRUD
- DemandCalendarService depends on AuditService and PrismaService only (no cross-module deps)
- ForecastService depends on DemandCalendarService (for getEntriesForWindow)
- Used 4-daypart model (BREAKFAST, LUNCH, DINNER, LATE_NIGHT) for summaries; AFTERNOON tracked in hourToDaypart but not used in summary dayparts to match typical restaurant operational focus
- Calendar uplift logic: max(multiplier-based uplift, expectedCovers) — whichever is larger
- Busy detection: >1.3x baseline OR +20 covers (whichever threshold is reached)
- Item usage projection uses 28-day historical window assumption for daily usage calculation

## Known Issues

- Lead time data currently hardcoded to 1 day — proper supplier lead times will come from M38 (Franchise/Multi-Branch)
- TRANSFER_FROM_BRANCH urgency classified but not actionable yet (requires M38 inter-branch inventory)
- AFTERNOON daypart tracked in hourToDaypart but not included in the 4-daypart summary loop (intentional simplification)

## Next Step

- M38 — Franchise + Multi-Branch Suite
