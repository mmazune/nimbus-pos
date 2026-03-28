# Scheduling, Templates & Duty Roster Guide (M25)

## Overview

The Workforce module (`/api/workforce/...`) provides staff scheduling, shift template management, roster views, and coverage gap analysis. It builds on the HR foundation (M23 employees, M24 attendance) to enable proactive workforce planning.

## Models

| Model               | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| **ShiftTemplate**   | Reusable template defining a time window, role, and headcount. |
| **Schedule**        | A date-range schedule for a branch with DRAFT→PUBLISHED flow.  |
| **ScheduleAssignment** | Assignment of an employee to a shift on a specific date.    |
| **CoverageRule**    | Minimum headcount rule for a role/position in a time window.   |

## Enums

| Enum                 | Values                           |
| -------------------- | -------------------------------- |
| `ScheduleStatus`    | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `CoverageRuleStatus` | `ACTIVE`, `INACTIVE`            |
| `CoverageSeverity`  | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |

## Endpoints

| Method | Path                                   | Permission                            | Description                    |
| ------ | -------------------------------------- | ------------------------------------- | ------------------------------ |
| POST   | `/workforce/templates`                 | `pos:workforce:templates:create`      | Create shift template          |
| GET    | `/workforce/templates`                 | `pos:workforce:templates:read`        | List shift templates           |
| POST   | `/workforce/schedules`                 | `pos:workforce:schedules:create`      | Create schedule (+ assignments)|
| GET    | `/workforce/schedules`                 | `pos:workforce:schedules:read`        | List schedules                 |
| GET    | `/workforce/schedules/:id`             | `pos:workforce:schedules:read`        | Get schedule detail            |
| PATCH  | `/workforce/schedules/:id/publish`     | `pos:workforce:schedules:publish`     | Publish a DRAFT schedule       |
| PATCH  | `/workforce/schedules/:id/archive`     | `pos:workforce:schedules:publish`     | Archive a schedule             |
| GET    | `/workforce/roster`                    | `pos:workforce:schedules:read`        | Roster view (published only)   |
| POST   | `/workforce/coverage-rules`            | `pos:workforce:coverage-rules:create` | Create coverage rule           |
| GET    | `/workforce/coverage-rules`            | `pos:workforce:coverage-rules:read`   | List coverage rules            |
| GET    | `/workforce/coverage-gaps`             | `pos:workforce:coverage-rules:read`   | Coverage gap analysis          |

## Business Rules

### Shift Templates
- `code` is unique per organization (@@unique[orgId, code]).
- Templates can be branch-scoped or org-wide (branchId nullable).
- `startsAtTime` / `endsAtTime` use "HH:mm" format.
- `expectedHeadcount` defaults to 1.

### Schedules
- Created as `DRAFT`, transitions to `PUBLISHED`, then optionally `ARCHIVED`.
- Only `DRAFT` schedules can be published.
- Publishing increments `version` and sets `publishedAt` + `publishedById`.
- Assignments can be included at creation time or added later.
- Each assignment is unique per [scheduleId, shiftTemplateId, employeeId, shiftDate].

### Roster
- Roster view returns only assignments from `PUBLISHED` schedules.
- Filterable by dateFrom/dateTo, employeeId, shiftTemplateId.

### Coverage Rules & Gaps
- Coverage rules define minimum headcount for a role/position during a time window.
- Gap analysis compares active rules against published schedule assignments day-by-day.
- Gaps include severity level for prioritization.

## Permissions

| Permission                            | Owner | Manager | Supervisor | Cashier | Waiter |
| ------------------------------------- | ----- | ------- | ---------- | ------- | ------ |
| `pos:workforce:templates:read`        | ✅    | ✅      | ✅         | ✅      | ✅     |
| `pos:workforce:templates:create`      | ✅    | ✅      | ❌         | ❌      | ❌     |
| `pos:workforce:schedules:read`        | ✅    | ✅      | ✅         | ✅      | ✅     |
| `pos:workforce:schedules:create`      | ✅    | ✅      | ✅         | ❌      | ❌     |
| `pos:workforce:schedules:publish`     | ✅    | ✅      | ❌         | ❌      | ❌     |
| `pos:workforce:coverage-rules:read`   | ✅    | ✅      | ✅         | ❌      | ❌     |
| `pos:workforce:coverage-rules:create` | ✅    | ✅      | ❌         | ❌      | ❌     |

## Seed Data

The seed provides:
- 4 shift templates: `WEEKDAY-AM`, `WEEKDAY-PM`, `WEEKEND-BRU`, `EVENT-NIGHT`
- 2 schedules: "Week 26 Draft" (DRAFT) and "Week 25 Published" (PUBLISHED with assignments)
- 1 coverage rule: "Kitchen Morning Coverage" (COOK role, 06:00–14:00, min 2, HIGH severity)
