# Completion Report — M37 Budgets + Forecasts + Procurement Advisory

## Context Snapshot

- Current milestone: M37 ✅
- Previous completed milestone: M36 — Bank Reconciliation + Period Close + Locks
- Next milestone: M38 — TBD

## Summary

- What was built: Budget CRUD with GL-sourced actuals refresh, branch/franchise forecast runs with run-rate engine and automatic procurement suggestions, and a procurement advisory review workflow.
- What is now working:
  - Budgets can be created with typed lines (category/dimension/GL account mapping), versioned per fiscal period, and actuals automatically pulled from posted JournalLines in the GL.
  - Forecast runs are generated on-demand or returned from cache; the engine computes a daily run-rate from 90 days of GL history and projects 30 days forward, then auto-creates ProcurementSuggestion rows for inventory items below reorder level.
  - Procurement suggestions are advisory (PENDING → REVIEWED/DISMISSED/ACTIONED) — no stock movements or POs are created.
  - All endpoints require JWT + correct permission + branch context header.

## Files Added / Changed

### New Files
- `packages/db/prisma/migrations/20260409000000_m37_budgets_forecasts_procurement/migration.sql`
- `apps/api/src/modules/budget/budget.module.ts`
- `apps/api/src/modules/budget/budget.service.ts`
- `apps/api/src/modules/budget/budget.controller.ts`
- `apps/api/src/modules/budget/budget.service.spec.ts`
- `apps/api/src/modules/budget/dto/create-budget.dto.ts`
- `apps/api/src/modules/budget/dto/list-budgets-query.dto.ts`
- `apps/api/src/modules/budget/dto/update-actuals.dto.ts`
- `apps/api/src/modules/budget/dto/list-forecast-query.dto.ts`
- `apps/api/src/modules/budget/dto/index.ts`
- `apps/api/test/budget.e2e-spec.ts`
- `postman/collections/M37-Budgets-Forecasts-Procurement-Advisory.postman_collection.json`
- `ai/M37_COMPLETION_REPORT.md` (this file)

### Modified Files
- `packages/db/prisma/schema.prisma` — 5 new enums, 4 new models, relations added to User/Organization/Branch/FiscalPeriod/Account/CostCenter/InventoryItem
- `packages/db/prisma/seed.ts` — 6 new permissions in PERMISSIONS_DATA, M37 entries in ROLE_PERM_MATRIX (Owner/Manager/Accountant), `seedBudgetData()` function, main() call + recordSeedRun
- `apps/api/src/app.module.ts` — BudgetModule imported and registered
- `ai/AI_STATUS.md` — Current milestone updated to M37; M34/M35/M36/M37 checklist blocks added

## Database

- Prisma models added:
  - `Budget` — org/branch/fiscalPeriod scope, DRAFT/ACTIVE/ARCHIVED status, OPERATIONAL/FINANCIAL type, versioned (@@unique on orgId+branchId+fiscalPeriodId+budgetType+version)
  - `BudgetLine` — per-line category/dimension/account/costCenter, budgetAmount/actualAmount/varianceAmount/variancePct
  - `ForecastRun` — org/branch/fiscalPeriod scope, BRANCH/FRANCHISE type, status PENDING/RUNNING/COMPLETED/FAILED, projected revenue/cost/margin fields
  - `ProcurementSuggestion` — per inventory item, suggestedQty/unitCost/totalEstimatedCost, reorderLevel/currentStock, PENDING/REVIEWED/DISMISSED/ACTIONED status
- Migration name: `20260409000000_m37_budgets_forecasts_procurement`
- Indexes: all FK columns, `@@unique` on Budget, composite index on ProcurementSuggestion(orgId, branchId, status)
- Seed updates: `seedBudgetData()` — idempotent, seeds ACTIVE Operational Budget (3 lines), ForecastRun (COMPLETED BRANCH), ProcurementSuggestion (PENDING, first inventory item)
- Notes: Decimal fields use `@db.Decimal(14,2)` for monetary precision; `projectedMarginPct` uses `@db.Decimal(8,4)`

## API

- Modules added: `BudgetModule` (providers: BudgetService; controllers: BudgetController, ForecastController)
- Endpoints added (7):
  - `GET  /api/finance/budgets` — list with status/type/fiscalPeriod/period filters (permission: `finance:budget:read`)
  - `GET  /api/finance/budgets/:id` — get budget with lines + account/costCenter (permission: `finance:budget:read`)
  - `POST /api/finance/budgets` — create budget + lines in $transaction (permission: `finance:budget:write`)
  - `POST /api/finance/budgets/:id/update-actuals` — GL actuals refresh via JournalLine.groupBy (permission: `finance:budget:update-actuals`)
  - `GET  /api/franchise/forecast` — get or generate forecast run with procurement suggestions (permission: `franchise:forecast:read`)
  - `GET  /api/finance/procurement-suggestions` — list PENDING suggestions (permission: `procurement:advisory:read`)
  - `PATCH /api/finance/procurement-suggestions/:id/review` — review/dismiss/action (permission: `procurement:advisory:read`)
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard at class level on both controllers
- Audit coverage: BUDGET_CREATED, ACTUALS_REFRESHED, FORECAST_GENERATED, PROCUREMENT_SUGGESTION_REVIEWED
- Idempotency coverage: createBudget checks @@unique constraint (409 ConflictException on duplicate); getForecast returns cached COMPLETED run unless `refresh=true`

## Tests

- Unit tests: `apps/api/src/modules/budget/budget.service.spec.ts`
  - All 7 service methods covered: listBudgets, getBudget, createBudget, updateActuals, getForecast, listProcurementSuggestions, reviewProcurementSuggestion
  - Error paths: NotFoundException, ConflictException, BadRequestException (archived budget, non-PENDING suggestion, invalid fiscalPeriodId)
- E2e tests: `apps/api/test/budget.e2e-spec.ts`
  - 25+ tests covering: auth (401), RBAC (403 for chef), budget CRUD, conflict/validation errors, actuals refresh, forecast (generate + cache), procurement review lifecycle
  - Cleanup: reverses all created data in `afterAll` (budgetLines → budget, procurementSuggestions, forecastRuns, fiscal period if created)
- Commands to run:
  ```bash
  cd apps/api && pnpm jest budget.service.spec.ts
  cd apps/api && pnpm jest budget.e2e-spec.ts --testTimeout=60000
  ```

## Postman

- Collection added: `postman/collections/M37-Budgets-Forecasts-Procurement-Advisory.postman_collection.json`
- Requests (13):
  1. Auth — Login Owner → captures `{{accessToken}}`
  2. Auth — Get Branch ID → captures `{{branchId}}`
  3. List Budgets
  4. List Budgets (filter status=DRAFT)
  5. Create Budget → captures `{{budgetId}}`
  6. Create Budget — Duplicate (expect 409)
  7. Create Budget — Missing Fields (expect 400)
  8. Get Budget by ID
  9. Get Budget by ID — Not Found (expect 404)
  10. Update Actuals
  11. Update Actuals — Not Found (expect 404)
  12. Get Forecast — Branch (force refresh) → captures `{{forecastRunId}}`
  13. Get Forecast — Branch (cached)
  14. Get Forecast — No Auth (expect 401)
  15. List Procurement Suggestions → captures `{{procurementSuggestionId}}`
  16. Review Procurement Suggestion (REVIEWED)
  17. Review — Already Reviewed (expect 400)
  18. Review — Not Found (expect 404)
- Variables: `budgetId`, `forecastRunId`, `procurementSuggestionId` auto-captured

## Docs

- `ai/AI_STATUS.md` updated: current milestone → M37; M34/M35/M36/M37 checklist blocks added
- `ai/M37_COMPLETION_REPORT.md` created (this file)
- ROADMAP status impact: M37 complete; M38 is next
