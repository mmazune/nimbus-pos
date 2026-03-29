# STAFF_INSIGHTS_GUIDE.md — M27 Staff Insights + Awards + Promotion Suggestions

## Overview

M27 provides **Staff Insights**, a composite scoring engine that aggregates employee performance data (sales, attendance, reliability, wastage, risk flags) into actionable insight snapshots. Managers can award top performers and generate data-driven promotion suggestions.

## Domain Models

### StaffInsightSnapshot

Stores a point-in-time composite performance score for an employee over a given period.

| Field            | Type      | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| id               | cuid      | Primary key                                      |
| orgId            | FK → Org  | Organization scope                               |
| branchId         | FK → Branch | Branch scope                                   |
| employeeId       | FK → Employee | Target employee                               |
| periodStart      | DateTime  | Evaluation period start                          |
| periodEnd        | DateTime  | Evaluation period end                            |
| salesScore       | Decimal   | Score derived from order count (0–100)           |
| reliabilityScore | Decimal   | Score from schedule adherence (0–100)            |
| attendanceScore  | Decimal   | Score from attendance records (0–100)            |
| wastageScore     | Decimal   | Score from anomaly/wastage events (0–100)        |
| riskPenalty      | Decimal   | Penalty from unresolved high/critical anomalies  |
| compositeScore   | Decimal   | Weighted average minus risk penalty              |
| weights          | JSON      | Snapshot of weights used at generation time       |
| sourceSummary    | JSON      | Raw metrics used for scoring                     |
| status           | Enum      | ACTIVE, SUPERSEDED, ARCHIVED                     |
| generatedById    | FK → User | Who triggered generation                         |

**Unique constraint:** `(orgId, employeeId, periodStart, periodEnd)` — one snapshot per employee per period.

### StaffAward

Recognizes employee achievements. Protected by a risk-block rule.

| Field      | Type      | Description                                      |
| ---------- | --------- | ------------------------------------------------ |
| id         | cuid      | Primary key                                      |
| orgId      | FK → Org  | Organization scope                               |
| branchId   | FK → Branch | Branch scope                                   |
| employeeId | FK → Employee | Award recipient                               |
| awardType  | Enum      | EMPLOYEE_OF_MONTH, BEST_UPSELLER, RELIABILITY_STAR, ZERO_WASTE_CHAMPION, CUSTOMER_FAVORITE, CUSTOM |
| title      | String    | Display title                                    |
| reason     | String?   | Optional justification                           |
| periodStart/End | DateTime | Award evaluation period                     |
| createdById | FK → User | Who created the award                           |

**Risk-block rule:** Cannot create an award if the employee has any unresolved `AnomalyEvent` with `status=OPEN` and `severity=HIGH` or `CRITICAL`.

### PromotionSuggestion

Data-driven promotion recommendation generated from insight snapshots.

| Field              | Type      | Description                                      |
| ------------------ | --------- | ------------------------------------------------ |
| id                 | cuid      | Primary key                                      |
| orgId              | FK → Org  | Organization scope                               |
| branchId           | FK → Branch | Branch scope                                   |
| employeeId         | FK → Employee | Suggested employee                             |
| currentPositionId  | FK → Position | Employee's current position at generation time |
| suggestedPositionId| FK → Position? | Target position (optional)                    |
| status             | Enum      | PENDING → ACCEPTED / REJECTED / DISMISSED        |
| rationale          | JSON      | Scoring data that triggered the suggestion        |
| generatedById      | FK → User | Who triggered generation                         |
| decidedById        | FK → User? | Who made the decision                           |
| decidedAt          | DateTime? | When decision was made                           |
| decisionNotes      | String?   | Notes on the decision                            |

**Threshold:** Only employees with `compositeScore >= 70` are suggested for promotion.

## Scoring Formula

```
compositeScore = (salesScore × salesWeight + reliabilityScore × reliabilityWeight
                 + attendanceScore × attendanceWeight + wastageScore × wastageWeight)
                 / totalWeight
                 - (riskPenalty × riskPenaltyWeight / 100)
```

Default weights: `salesWeight=25, reliabilityWeight=25, attendanceWeight=25, wastageWeight=15, riskPenaltyWeight=10`

Stored in `OrgSettings.franchiseWeights.staffInsightWeights` (JSON).

## Source Data

| Score           | Source Model          | Logic                                            |
| --------------- | --------------------- | ------------------------------------------------ |
| salesScore      | Order                 | Count of orders created by employee's linked user |
| attendanceScore | AttendanceRecord      | Penalizes late (−5) and absent (−15) days        |
| reliabilityScore| ScheduleAssignment    | Attendance days / scheduled shifts ratio          |
| wastageScore    | AnomalyEvent          | Penalizes each anomaly (−10 per event)           |
| riskPenalty     | AnomalyEvent (OPEN, HIGH/CRITICAL) | +10 per unresolved high/critical flag |

## API Endpoints

| Method | Path                                     | Permission                       | Description                   |
| ------ | ---------------------------------------- | -------------------------------- | ----------------------------- |
| GET    | `/api/staff/weights`                     | `pos:staff:weights:read`         | Get scoring weights           |
| PATCH  | `/api/staff/weights`                     | `pos:staff:weights:update`       | Update scoring weights        |
| POST   | `/api/staff/insights/generate`           | `pos:staff:insights:read`        | Generate insight snapshots    |
| GET    | `/api/staff/insights`                    | `pos:staff:insights:read`        | List insight snapshots        |
| GET    | `/api/staff/insights/:employeeId`        | `pos:staff:insights:read`        | Get employee insight history  |
| POST   | `/api/staff/awards`                      | `pos:staff:awards:create`        | Create a staff award          |
| GET    | `/api/staff/awards`                      | `pos:staff:awards:read`          | List staff awards             |
| POST   | `/api/staff/promotion-suggestions/generate` | `pos:staff:promotions:generate` | Generate promotion suggestions |
| GET    | `/api/staff/promotion-suggestions`       | `pos:staff:promotions:generate`  | List promotion suggestions    |
| PATCH  | `/api/staff/promotion-suggestions/:id/decision` | `pos:staff:promotions:decide` | Accept/reject/dismiss suggestion |

## Permissions (7)

| Permission                      | Owner | Manager | Accountant | Supervisor | Cashier/Waiter/Chef |
| ------------------------------- | ----- | ------- | ---------- | ---------- | ------------------- |
| `pos:staff:insights:read`       | ✅    | ✅      | —          | ✅         | —                   |
| `pos:staff:awards:create`       | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:awards:read`         | ✅    | ✅      | —          | ✅         | —                   |
| `pos:staff:promotions:generate` | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:promotions:decide`   | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:weights:read`        | ✅    | ✅      | —          | —          | —                   |
| `pos:staff:weights:update`      | ✅    | —       | —          | —          | —                   |

## Seed Data

The seed creates:
- 1 `StaffInsightSnapshot` for the first active employee (March 2025)
- 1 `StaffAward` (EMPLOYEE_OF_MONTH)
- 1 `PromotionSuggestion` (PENDING)

## Testing

- **Unit tests:** `staff-insights.service.spec.ts` — mocked Prisma, covers all service methods including risk-block, idempotent generation, and error paths
- **E2e tests:** `staff-insights.e2e-spec.ts` — integration tests against real DB, covers all endpoints
