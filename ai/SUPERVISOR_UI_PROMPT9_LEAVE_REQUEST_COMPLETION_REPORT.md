# Supervisor UI Prompt 9 - Leave Request Completion Report

Date: 2026-07-06  
Repo: `C:\Users\arman\Desktop\nimbus-pos`

## Context Snapshot

Prompt 8 was complete: `/api/auth/me` exposes the linked Supervisor employee profile, attendance self-punch is ownership-guarded, and leave plus shift-swap creation were still deferred. Prompt 9 scope was limited to safe Supervisor leave request creation. Shift-swap creation, staff selectors, payroll, accounting, billing, franchise, developer, device, receipt, global approvals, cashier clone, and waiter clone surfaces remained out of scope.

## Implementation Summary

- Added `SupervisorLeaveRequestForm` under Supervisor Me.
- Enabled `POST /api/hr/leave` only for the authenticated Supervisor's linked employee profile.
- Required branch/org context and `pos:hr:leave:create`.
- Added client validation for leave type, start date, end date, end-before-start, and reason length.
- Added confirmation text: `Submit leave request for review?`.
- Reset the form only after successful creation.
- Refreshed Supervisor leave and approvals query families after creation.
- Kept leave history read-only.
- Kept shift-swap creation visibly deferred.

## Leave API Contract

- Route: `POST /api/hr/leave`.
- Global prefix: `/api`.
- Header: `Authorization: Bearer <token>`.
- Header: `X-Branch-Id: <branchId>`.
- Permission: `pos:hr:leave:create`.
- Payload fields: `employeeId`, `leaveType`, `startsAt`, `endsAt`, optional `reason`.
- Leave types: `ANNUAL`, `SICK`, `UNPAID`, `EMERGENCY`, `OTHER`.
- Response: created `LeaveRequest` with `PENDING` status.
- Idempotency key support was not present on the backend contract; the UI prevents duplicate in-flight submit.

## Security Finding And Fix

`AttendanceService.createLeaveRequest` previously validated organization membership but trusted arbitrary same-org `employeeId` values. That allowed a caller with create permission to submit leave for another employee. The service now rejects leave creation unless `employee.userId` matches the authenticated user id.

## Files Changed

- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/attendance.service.spec.ts`
- `apps/web/src/components/supervisor/me/SupervisorLeaveRequestForm.tsx`
- `apps/web/src/components/supervisor/me/SupervisorMeScreen.tsx`
- `apps/web/src/components/supervisor/me/index.ts`
- `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md`
- `ai/AI_STATUS.md`
- `repo file tree.txt`
- `ai/SUPERVISOR_UI_PROMPT9_LEAVE_REQUEST_COMPLETION_REPORT.md`

## Validation

Passed:

```pwsh
corepack pnpm@8.15.0 --filter @nimbus-pos/api test -- attendance.service.spec.ts
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/api build
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate
```

The API build initially exceeded the 120-second command timeout with no compiler error. It completed in the background and passed when rerun with a longer timeout.

## HTTP QA

- `/api/health` returned `status: ok`, `db: ok`.
- Supervisor login succeeded for `supervisor@nimbus.demo`.
- `/api/auth/me` returned employee `EMP-004` / Peter Mugisha.
- `POST /api/hr/leave` created a `PENDING` current-user leave request for `2027-02-17` to `2027-02-18`.
- `GET /api/hr/leave?mine=true&take=10` listed the created request.
- HTTP route smoke returned 200 for:
  - `/supervisor/me`
  - `/supervisor/floor`
  - `/supervisor/orders`
  - `/supervisor/reservations`
  - `/supervisor/approvals`
  - `/waiter/me`
  - `/cashier/me`

## Postman

Postman collections were read and inventoried. No collection was changed because the route path and payload contract did not change. The backend behavior was hardened to require current-user employee ownership.

## Deferred

- Shift-swap creation remains deferred.
- Safe target employee selector remains open.
- No broad staff selector was added.
- No migrations, seed, demo import, package files, or Postman changes were made.
