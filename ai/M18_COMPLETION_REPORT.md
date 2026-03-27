# M18 Completion Report — Anomaly Detection + Anti-Theft Signals

## Milestone Summary

| Field              | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Milestone          | M18                                                      |
| Title              | Anomaly Detection + Anti-Theft Signals                   |
| Branch             | `milestone/m18-anomaly-anti-theft-signals`               |
| Status             | ✅ COMPLETE                                               |
| Date               | 2026-03-27                                               |
| Commits            | `m18 scaffold ok`, `m18 tests + ci ok`, `m18 milestone complete` |

## Scope Delivered

### Database Layer

- **5 enums**: `AnomalyRuleStatus` (ACTIVE/INACTIVE), `AnomalyRuleType` (10 values), `AnomalySeverity` (4 levels), `AnomalyEventStatus` (OPEN/ACKNOWLEDGED/RESOLVED), `RiskEntityType` (8 entity types)
- **4 models**: `AnomalyRule`, `RiskThreshold`, `AnomalyEvent`, `StaffRiskSnapshot`
- **Migration**: `20260327000000_m18_anomaly_anti_theft` — 4 tables, 5 enums, 3 unique constraints, 27 indexes, 12 foreign keys

### Module Implementation

- **AnalyticsModule** (`apps/api/src/modules/analytics/`)
  - `analytics.module.ts` — NestJS module registration
  - `analytics.service.ts` — Full service with rule CRUD, anomaly lifecycle, signal detection, dashboard aggregation
  - `analytics.controller.ts` — 13 thin controller endpoints
  - `dto/` — 7 DTO files with class-validator decorators

### API Endpoints (13 total)

| Method | Path                                   | Permission                              |
| ------ | -------------------------------------- | --------------------------------------- |
| POST   | `/analytics/anomaly-rules`             | `pos:analytics:anomaly-rules:create`    |
| GET    | `/analytics/anomaly-rules`             | `pos:analytics:anomalies:read`          |
| GET    | `/analytics/anomaly-rules/:id`         | `pos:analytics:anomalies:read`          |
| PATCH  | `/analytics/anomaly-rules/:id`         | `pos:analytics:anomaly-rules:update`    |
| GET    | `/analytics/anomalies`                 | `pos:analytics:anomalies:read`          |
| GET    | `/analytics/anomalies/:id`             | `pos:analytics:anomalies:read`          |
| PATCH  | `/analytics/anomalies/:id/acknowledge` | `pos:analytics:anomalies:acknowledge`   |
| PATCH  | `/analytics/anomalies/:id/resolve`     | `pos:analytics:anomalies:acknowledge`   |
| GET    | `/analytics/risk-dashboard`            | `pos:analytics:risk-dashboard:read`     |
| GET    | `/analytics/staff-risk/:userId`        | `pos:analytics:risk-dashboard:read`     |
| GET    | `/analytics/thresholds`                | `pos:analytics:thresholds:read`         |
| PATCH  | `/analytics/thresholds/:id`            | `pos:analytics:thresholds:update`       |
| POST   | `/analytics/anomalies/recalculate`     | `pos:analytics:anomalies:recalculate`   |

### Signal Implementations

| Signal Type      | Detection Logic                                            |
| ---------------- | ---------------------------------------------------------- |
| VOID_SPIKE       | Groups voided orders by userId in window, flags threshold  |
| DISCOUNT_ABUSE   | Groups discounts by createdById in window, flags threshold |
| CASH_VARIANCE    | Checks TillSession variance on close, flags abs >= threshold |
| LATE_CLOSE       | Checks Shift duration (openedAt → closedAt), flags >= hours |
| REFUND_SPIKE     | Groups refunds by createdById in window, flags threshold   |

All signals are **advisory-first** — no automated punishment flow.

### Permissions (8 new)

| Permission                              | Owner | Manager | Supervisor | Accountant | Event Mgr |
| --------------------------------------- | ----- | ------- | ---------- | ---------- | --------- |
| `pos:analytics:anomalies:read`          | ✅     | ✅       | ✅          | ✅          | ✅         |
| `pos:analytics:anomaly-rules:create`    | ✅     | ✅       | ❌          | ❌          | ❌         |
| `pos:analytics:anomaly-rules:update`    | ✅     | ✅       | ❌          | ❌          | ❌         |
| `pos:analytics:anomalies:acknowledge`   | ✅     | ✅       | ✅          | ❌          | ❌         |
| `pos:analytics:risk-dashboard:read`     | ✅     | ✅       | ✅          | ✅          | ❌         |
| `pos:analytics:anomalies:recalculate`   | ✅     | ✅       | ✅          | ❌          | ❌         |
| `pos:analytics:thresholds:read`         | ✅     | ✅       | ✅          | ✅          | ❌         |
| `pos:analytics:thresholds:update`       | ✅     | ✅       | ❌          | ❌          | ❌         |

### Seed Data

- 8 permissions + role mappings for 5 roles
- 6 risk thresholds (void_rate_pct, discount_limit_per_hour, cash_variance_limit, late_close_hours, refund_spike_per_hour, price_override_enabled)
- 5 anomaly rules (VOID-SPIKE-01, DISC-ABUSE-01, CASH-VAR-01, LATE-CLOSE-01, REFUND-SPIKE-01)
- 1 sample anomaly event (VOID_SPIKE, OPEN status)

### Audit Coverage

All write operations emit audit events via AuditService:
- `anomaly-rule.create`, `anomaly-rule.update`
- `anomaly-event.acknowledge`, `anomaly-event.resolve`
- `risk-threshold.update`
- `anomaly.recalculate`

## Test Results

### Unit Tests

- **22 suites, 357 tests** — all passing (19 new in analytics.service.spec.ts)
- Zero regressions across M1–M17 suites

### E2E Tests

- `analytics.e2e-spec.ts` — rule CRUD, anomaly lifecycle, dashboard, thresholds, recalculate, permission denial, validation

### Postman

- `M18-Anomaly-Detection-Anti-Theft.postman_collection.json` — 14 requests with auto-capture variables and assertions

## Dependency Status

- **M13.1** (MTN Native Request-to-Pay): PENDING
- **M13.2** (Airtel Native): PENDING

## Files Changed

### New Files
- `apps/api/src/modules/analytics/analytics.module.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.service.spec.ts`
- `apps/api/src/modules/analytics/dto/create-anomaly-rule.dto.ts`
- `apps/api/src/modules/analytics/dto/update-anomaly-rule.dto.ts`
- `apps/api/src/modules/analytics/dto/acknowledge-anomaly.dto.ts`
- `apps/api/src/modules/analytics/dto/resolve-anomaly.dto.ts`
- `apps/api/src/modules/analytics/dto/list-anomalies-query.dto.ts`
- `apps/api/src/modules/analytics/dto/risk-dashboard-query.dto.ts`
- `apps/api/src/modules/analytics/dto/update-threshold.dto.ts`
- `apps/api/src/modules/analytics/dto/index.ts`
- `apps/api/test/analytics.e2e-spec.ts`
- `packages/db/prisma/migrations/20260327000000_m18_anomaly_anti_theft/migration.sql`
- `postman/collections/M18-Anomaly-Detection-Anti-Theft.postman_collection.json`
- `ai/M18_COMPLETION_REPORT.md`

### Modified Files
- `packages/db/prisma/schema.prisma` — M18 enums + 4 models + Organization/Branch/User relations
- `packages/db/prisma/seed.ts` — 8 permissions, role mappings, seedAnalyticsData() step 34
- `apps/api/src/app.module.ts` — AnalyticsModule registered
- `ai/AI_STATUS.md` — M18 checklist added
