# M24 Completion Report — Attendance + Leave + Shift Swaps

| Field            | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| Milestone        | M24                                                           |
| Title            | Attendance + Leave + Shift Swaps                              |
| Branch           | `milestone/m24-attendance-leave-shift-swaps`                  |
| Base Branch      | `milestone/m23-employees-contracts-hr-core`                   |
| Status           | ✅ COMPLETE                                                   |

## Scope

Add workforce tracking on top of M23's HR Core:
- Daily attendance clock-in/out with automatic late-detection from configurable policies
- Leave request workflows with manager review (approve/reject)
- Shift swap negotiation between employees with approval workflow
- Attendance policies per org/branch (grace minutes, auto-late threshold)

## Schema Changes

### Enums (4)

| Enum                | Values                                          |
| ------------------- | ----------------------------------------------- |
| AttendanceStatus    | CLOCKED_IN, CLOCKED_OUT, LATE, ABSENT, ON_LEAVE |
| LeaveRequestStatus  | PENDING, APPROVED, REJECTED, CANCELLED           |
| LeaveType           | ANNUAL, SICK, UNPAID, EMERGENCY, OTHER           |
| ShiftSwapStatus     | PENDING, APPROVED, REJECTED, CANCELLED           |

### Models (4)

| Model              | Key Features                                                        |
| ------------------ | ------------------------------------------------------------------- |
| AttendanceRecord   | @@unique[employeeId, attendanceDate], clockInAt/OutAt, status       |
| LeaveRequest       | Employee → reviewer flow, date range, overlap detection             |
| ShiftSwapRequest   | Requester ↔ target with approval; duplicate-pending guard           |
| AttendancePolicy   | Grace minutes, auto-late, per-org/branch, active toggle             |

### Migration

- **#30**: `20260330200000_m24_attendance_leave_shift_swaps` — applied to Neon ✅

## Endpoints (11)

| # | Method | Path                              | Permission                        |
| - | ------ | --------------------------------- | --------------------------------- |
| 1 | POST   | /api/hr/attendance/clock          | pos:hr:attendance:clock           |
| 2 | GET    | /api/hr/attendance                | pos:hr:attendance:read            |
| 3 | POST   | /api/hr/leave                     | pos:hr:leave:create               |
| 4 | GET    | /api/hr/leave                     | pos:hr:leave:read                 |
| 5 | PATCH  | /api/hr/leave/:id/review          | pos:hr:leave:review               |
| 6 | POST   | /api/hr/shift-swaps               | pos:hr:shift-swaps:create         |
| 7 | GET    | /api/hr/shift-swaps               | pos:hr:shift-swaps:read           |
| 8 | PATCH  | /api/hr/shift-swaps/:id/approve   | pos:hr:shift-swaps:approve        |
| 9 | POST   | /api/hr/attendance/policies       | pos:hr:attendance-policy:create   |
|10 | GET    | /api/hr/attendance/policies       | pos:hr:attendance-policy:read     |
|11 | PATCH  | /api/hr/attendance/policies/:id   | pos:hr:attendance-policy:update   |

## Permissions (11)

| Permission                        | Roles                              |
| --------------------------------- | ---------------------------------- |
| pos:hr:attendance:clock           | Owner, Manager, Supervisor, Cashier, Waiter |
| pos:hr:attendance:read            | Owner, Manager, Accountant, Supervisor, Cashier, Waiter |
| pos:hr:leave:create               | Owner, Manager, Supervisor, Cashier, Waiter |
| pos:hr:leave:read                 | Owner, Manager, Accountant, Supervisor, Cashier, Waiter |
| pos:hr:leave:review               | Owner, Manager, Supervisor         |
| pos:hr:shift-swaps:create         | Owner, Manager, Supervisor, Cashier, Waiter |
| pos:hr:shift-swaps:read           | Owner, Manager, Supervisor, Cashier, Waiter |
| pos:hr:shift-swaps:approve        | Owner, Manager, Supervisor         |
| pos:hr:attendance-policy:read     | Owner, Manager, Supervisor         |
| pos:hr:attendance-policy:create   | Owner                              |
| pos:hr:attendance-policy:update   | Owner                              |

## Files Created

| File                                                     | Purpose                     |
| -------------------------------------------------------- | --------------------------- |
| `apps/api/src/modules/attendance/dto/*.ts` (10 files)    | DTOs + barrel index         |
| `apps/api/src/modules/attendance/attendance.service.ts`  | Service (11 methods)        |
| `apps/api/src/modules/attendance/attendance.controller.ts`| Controller (11 endpoints)  |
| `apps/api/src/modules/attendance/attendance.module.ts`   | Module definition           |
| `apps/api/src/modules/attendance/attendance.service.spec.ts`| Unit tests (36)          |
| `apps/api/test/attendance.e2e-spec.ts`                   | E2E tests (36)              |
| `postman/collections/M24-Attendance-Leave-Shift-Swaps.postman_collection.json` | Postman (15 requests) |
| `docs/ATTENDANCE_LEAVE_SWAPS_GUIDE.md`                   | Feature guide               |
| `packages/db/prisma/migrations/20260330200000_.../migration.sql` | Migration SQL       |

## Files Modified

| File                                    | Changes                                      |
| --------------------------------------- | -------------------------------------------- |
| `packages/db/prisma/schema.prisma`      | 4 enums, 4 models, relations on User/Employee/Org/Branch |
| `apps/api/src/app.module.ts`            | Added AttendanceModule import                |
| `packages/db/prisma/seed.ts`            | 11 permissions, 6 role mappings, seedAttendanceData() |
| `docs/ARCHITECTURE.md`                  | M24 section added                            |
| `docs/MODULES.md`                       | M24 row added                                |
| `docs/POSTMAN_ENDPOINT_GUIDE.md`        | M24 endpoint table added                     |
| `docs/HR_CORE_GUIDE.md`                 | Future milestones updated                    |
| `ai/AI_STATUS.md`                       | M24 checklist added                          |

## Test Results

| Suite                         | Tests | Status |
| ----------------------------- | ----- | ------ |
| attendance.service.spec.ts    | 36    | ✅ Pass |
| attendance.e2e-spec.ts        | 36    | ✅ Pass |

## Seed Verification

- Seed run 1: ✅ Created 5 M24 records (1 policy, 2 attendance, 1 leave, 1 swap)
- Seed run 2: ✅ Idempotent (0 created, 5 skipped)

## Closure Gates

- [x] Prisma schema valid, migration applied
- [x] `prisma generate` succeeds
- [x] Seed idempotent (2 consecutive runs)
- [x] 36 unit tests pass
- [x] 36 e2e tests pass
- [x] Postman collection with 15 requests
- [x] ARCHITECTURE.md updated
- [x] MODULES.md updated
- [x] POSTMAN_ENDPOINT_GUIDE.md updated
- [x] AI_STATUS.md updated
- [x] Feature guide created
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
