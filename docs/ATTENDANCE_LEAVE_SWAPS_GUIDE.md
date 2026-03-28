# Attendance, Leave & Shift Swaps Guide (M24)

> Module location: `apps/api/src/modules/attendance/`

## Overview

M24 adds workforce tracking on top of M23's HR Core: daily attendance clock-in/out with automatic late detection, leave-request workflows with manager review, shift-swap negotiation between employees, and configurable attendance policies per organization and branch.

## Data Model

### AttendanceRecord

| Field          | Type             | Notes                             |
| -------------- | ---------------- | --------------------------------- |
| id             | String (cuid)    | Primary key                       |
| employeeId     | FK → Employee    |                                   |
| orgId          | FK → Organization|                                   |
| branchId       | FK → Branch (opt)|                                   |
| attendanceDate | DateTime         | Date only (start of day)          |
| clockInAt      | DateTime         | When employee clocked in          |
| clockOutAt     | DateTime?        | Null until clock-out              |
| status         | AttendanceStatus | CLOCKED_IN → CLOCKED_OUT or LATE  |
| notes          | String?          | Optional notes                    |

**Unique constraint:** `[employeeId, attendanceDate]` — one record per employee per day.

### LeaveRequest

| Field        | Type               | Notes                                |
| ------------ | ------------------ | ------------------------------------ |
| id           | String (cuid)      | Primary key                          |
| employeeId   | FK → Employee      |                                      |
| orgId        | FK → Organization  |                                      |
| branchId     | FK → Branch (opt)  |                                      |
| leaveType    | LeaveType          | ANNUAL, SICK, UNPAID, EMERGENCY, OTHER |
| startsAt     | DateTime (@db.Date) | Leave start date                    |
| endsAt       | DateTime (@db.Date) | Leave end date                      |
| reason       | String?            | Optional reason                      |
| status       | LeaveRequestStatus | PENDING → APPROVED / REJECTED / CANCELLED |
| reviewedById | FK → User?         | Who reviewed the request             |
| reviewNotes  | String?            | Reviewer notes                       |
| requestedById| FK → User          | Who submitted the request            |

### ShiftSwapRequest

| Field               | Type             | Notes                            |
| ------------------- | ---------------- | -------------------------------- |
| id                  | String (cuid)    | Primary key                      |
| requesterEmployeeId | FK → Employee    | Who wants to swap                |
| targetEmployeeId    | FK → Employee    | Who they want to swap with       |
| orgId               | FK → Organization|                                  |
| branchId            | FK → Branch (opt)|                                  |
| shiftDate           | DateTime (@db.Date)| Date of the shift to swap      |
| reason              | String?          | Optional reason                  |
| status              | ShiftSwapStatus  | PENDING → APPROVED / REJECTED / CANCELLED |
| approvedById        | FK → User?       | Who approved/rejected            |
| reviewNotes         | String?          | Reviewer notes                   |

### AttendancePolicy

| Field                | Type             | Notes                           |
| -------------------- | ---------------- | ------------------------------- |
| id                   | String (cuid)    | Primary key                     |
| orgId                | FK → Organization|                                 |
| branchId             | FK → Branch (opt)| Null = org-wide default         |
| name                 | String (max 200) | Policy name                     |
| graceMinutes         | Int (default 0)  | Grace period (0-120 min)        |
| autoLateAfterMinutes | Int (default 0)  | Mark late after N min (1-480)   |
| allowSelfClockOutFix | Boolean (false)  | Allow employees to fix clock-out|
| active               | Boolean (true)   | Enable/disable policy           |

## Enums

| Enum                | Values                                          |
| ------------------- | ----------------------------------------------- |
| AttendanceStatus    | CLOCKED_IN, CLOCKED_OUT, LATE, ABSENT, ON_LEAVE |
| LeaveRequestStatus  | PENDING, APPROVED, REJECTED, CANCELLED           |
| LeaveType           | ANNUAL, SICK, UNPAID, EMERGENCY, OTHER           |
| ShiftSwapStatus     | PENDING, APPROVED, REJECTED, CANCELLED           |

## Endpoints

All 11 endpoints are under `/api/hr`, protected by JwtAuthGuard + PermissionGuard + BranchContextGuard.

### Attendance

| Method | Path                           | Permission                     | Description                  |
| ------ | ------------------------------ | ------------------------------ | ---------------------------- |
| POST   | /api/hr/attendance/clock       | pos:hr:attendance:clock        | Clock in or out (toggle)     |
| GET    | /api/hr/attendance             | pos:hr:attendance:read         | List attendance records      |

### Leave Requests

| Method | Path                           | Permission                     | Description                  |
| ------ | ------------------------------ | ------------------------------ | ---------------------------- |
| POST   | /api/hr/leave                  | pos:hr:leave:create            | Create leave request         |
| GET    | /api/hr/leave                  | pos:hr:leave:read              | List leave requests          |
| PATCH  | /api/hr/leave/:id/review       | pos:hr:leave:review            | Approve/reject leave request |

### Shift Swaps

| Method | Path                           | Permission                     | Description                  |
| ------ | ------------------------------ | ------------------------------ | ---------------------------- |
| POST   | /api/hr/shift-swaps            | pos:hr:shift-swaps:create      | Create shift swap request    |
| GET    | /api/hr/shift-swaps            | pos:hr:shift-swaps:read        | List shift swap requests     |
| PATCH  | /api/hr/shift-swaps/:id/approve| pos:hr:shift-swaps:approve     | Approve/reject shift swap    |

### Attendance Policies

| Method | Path                           | Permission                        | Description             |
| ------ | ------------------------------ | --------------------------------- | ----------------------- |
| POST   | /api/hr/attendance/policies    | pos:hr:attendance-policy:create   | Create policy           |
| GET    | /api/hr/attendance/policies    | pos:hr:attendance-policy:read     | List policies           |
| PATCH  | /api/hr/attendance/policies/:id| pos:hr:attendance-policy:update   | Update policy           |

## Business Logic

### Clock In/Out (Toggle)

1. Look up existing record for the employee today.
2. **No record** → Create new record with `CLOCKED_IN` status. If an active policy has `autoLateAfterMinutes > 0`, compare current time against policy threshold and set `LATE` if applicable.
3. **CLOCKED_IN** → Update to `CLOCKED_OUT` with `clockOutAt = now()`.
4. **CLOCKED_OUT** → 409 Conflict (already completed for today).

### Leave Request Review

- Only `PENDING` requests can be reviewed. Attempting to review an already-reviewed request returns 400.
- The reviewer's user ID is recorded automatically via `@CurrentUser()`.

### Shift Swap Validation

- Requester and target must be different employees (400 if same).
- Both employees must exist in the same org (404 if not found).
- Duplicate pending swaps (same requester, target, date) are rejected (409).

## Seed Data

The seed creates:
- 1 attendance policy ("Default Shift Policy": 15 min grace, 30 min auto-late)
- 2 attendance records (yesterday, for first 2 employees)
- 1 leave request (SICK type for employee 3)
- 1 shift swap request (employee 1 ↔ employee 2)

## Tests

- **Unit**: 36 tests in `attendance.service.spec.ts`
- **E2E**: 36 tests in `test/attendance.e2e-spec.ts`
