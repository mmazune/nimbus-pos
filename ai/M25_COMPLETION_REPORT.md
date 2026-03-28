# M25 Completion Report — Scheduling + Templates + Duty Roster

## Milestone Summary

| Item              | Detail                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| **Milestone**     | M25 — Scheduling + Templates + Duty Roster                            |
| **Branch**        | `milestone/m25-scheduling-templates-duty-roster`                       |
| **Status**        | ✅ Complete — All gates verified ✅                                     |

## Schema Changes

### Enums Added (3)
- `ScheduleStatus` — DRAFT, PUBLISHED, ARCHIVED
- `CoverageRuleStatus` — ACTIVE, INACTIVE
- `CoverageSeverity` — LOW, MEDIUM, HIGH, CRITICAL

### Models Added (4)
- `ShiftTemplate` — Reusable shift definition with code, time window, role, position, headcount (@@unique[orgId, code])
- `Schedule` — Date-range schedule with DRAFT→PUBLISHED→ARCHIVED flow, versioned
- `ScheduleAssignment` — Employee assignment to shift on specific date (@@unique[scheduleId, shiftTemplateId, employeeId, shiftDate])
- `CoverageRule` — Minimum headcount rule per role/position/time window with severity

### Relations Added
- Organization → ShiftTemplate[], Schedule[], ScheduleAssignment[], CoverageRule[]
- Branch → ShiftTemplate[], Schedule[], ScheduleAssignment[], CoverageRule[]
- User → Schedule[] (publishedBy)
- Employee → ScheduleAssignment[]
- Position → ShiftTemplate[], CoverageRule[]

### Migration
- `20260331000000_m25_scheduling_templates_duty_roster` — Applied ✅ (migration #31 of 31)

## Module: WorkforceModule

### Files Created
| File | Purpose |
| ---- | ------- |
| `workforce.module.ts` | NestJS module registration |
| `workforce.controller.ts` | 11 endpoints under `/workforce` |
| `workforce.service.ts` | Business logic + audit logging |
| `dto/create-shift-template.dto.ts` | DTO with HH:mm validation |
| `dto/list-shift-templates-query.dto.ts` | Filter/pagination DTO |
| `dto/create-schedule.dto.ts` | Schedule + nested assignments DTO |
| `dto/publish-schedule.dto.ts` | Optional notes DTO |
| `dto/list-schedules-query.dto.ts` | Filter/pagination DTO |
| `dto/list-roster-query.dto.ts` | Roster filter DTO |
| `dto/create-coverage-rule.dto.ts` | Coverage rule DTO with enums |
| `dto/index.ts` | Barrel export |

### Endpoints (11)
| Method | Path | Permission |
| ------ | ---- | ---------- |
| POST | `/workforce/templates` | `pos:workforce:templates:create` |
| GET | `/workforce/templates` | `pos:workforce:templates:read` |
| POST | `/workforce/schedules` | `pos:workforce:schedules:create` |
| GET | `/workforce/schedules` | `pos:workforce:schedules:read` |
| GET | `/workforce/schedules/:id` | `pos:workforce:schedules:read` |
| PATCH | `/workforce/schedules/:id/publish` | `pos:workforce:schedules:publish` |
| PATCH | `/workforce/schedules/:id/archive` | `pos:workforce:schedules:publish` |
| GET | `/workforce/roster` | `pos:workforce:schedules:read` |
| POST | `/workforce/coverage-rules` | `pos:workforce:coverage-rules:create` |
| GET | `/workforce/coverage-rules` | `pos:workforce:coverage-rules:read` |
| GET | `/workforce/coverage-gaps` | `pos:workforce:coverage-rules:read` |

### Permissions (7)
- `pos:workforce:templates:read`
- `pos:workforce:templates:create`
- `pos:workforce:schedules:read`
- `pos:workforce:schedules:create`
- `pos:workforce:schedules:publish`
- `pos:workforce:coverage-rules:read`
- `pos:workforce:coverage-rules:create`

## Tests

### Unit Tests — 31 tests, all pass ✅
- `workforce.service.spec.ts`
- Covers: template CRUD, duplicate code rejection, schedule create/publish/archive, date validation, assignment validation, coverage rules, roster, coverage gap analysis

### E2e Tests — 32 tests, all pass ✅
- `workforce.e2e-spec.ts`
- Covers: all 11 endpoints, auth/permission checks (401/403), validation (400), not found (404), conflict (409), full lifecycle (create→publish→archive)

## Seed Updates

### Permissions Added (7)
All 7 workforce permissions added to PERMISSIONS_DATA array.

### Role-Permission Matrix Updated
- **Owner**: all 7 permissions
- **Manager**: all 7 permissions
- **Supervisor**: templates:read, schedules:read, schedules:create, coverage-rules:read (4)
- **Cashier**: templates:read, schedules:read (2)
- **Waiter**: templates:read, schedules:read (2)

### Demo Data
- 4 ShiftTemplates: WEEKDAY-AM, WEEKDAY-PM, WEEKEND-BRU, EVENT-NIGHT
- 2 Schedules: Week 26 Draft (DRAFT), Week 25 Published (PUBLISHED with assignments)
- 1 CoverageRule: Kitchen Morning Coverage (COOK, 06:00-14:00, min 2, severity HIGH)

## Postman Collection
- `M25-Scheduling-Templates-Duty-Roster.postman_collection.json` — 13 requests
- Uses `pm.environment.set/get` pattern
- baseUrl = `http://localhost:3001`

## Documentation Updated
- `docs/MODULES.md` — M25 row added
- `docs/POSTMAN_ENDPOINT_GUIDE.md` — M24 + M25 endpoint tables added
- `docs/SCHEDULING_ROSTER_GUIDE.md` — New guide created
- `ai/AI_STATUS.md` — M25 checklist added, M26+ placeholder

## Done Checks

| Check | Status |
| ----- | ------ |
| `pnpm db:generate` | ✅ Pass |
| `pnpm db:migrate` | ✅ Applied (#31 of 31) |
| `pnpm db:seed` (x2 idempotent) | ✅ Pass (Created 7 / Skipped 7) |
| ESLint | ✅ 0 errors, warnings only (pre-existing `no-explicit-any`) |
| Unit tests (31) | ✅ All pass |
| E2e tests (32) | ✅ All pass |
| M13.1 PENDING | ✅ Confirmed |
| M13.2 PENDING | ✅ Confirmed |
