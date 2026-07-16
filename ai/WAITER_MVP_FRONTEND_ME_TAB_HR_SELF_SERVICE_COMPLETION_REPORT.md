# WAITER-MVP Frontend Me Tab HR / Shift Self-Service Completion Report

Date: 2026-06-30

## Context Snapshot

- Repo: `nimbus-pos`
- Scope: frontend-only Waiter MVP Me tab.
- Page implemented: `/waiter/me`.
- Shell preserved: existing `WaiterShell`, `WaiterSessionGuard`, `WaiterHeader`, and bottom navigation remain in use.
- Backend changes: none.
- Postman changes: none.
- Seed changes: none.
- Deferred areas preserved: manager/admin HR, payroll, scheduling admin, owner/manager/accountant workspaces, Menu tab, mobile behavior, and hardware.

## Existing Backend Endpoints Used

- `GET /api/auth/me`
- `GET /api/shifts/active`
- `POST /api/shifts/open`
- `POST /api/shifts/:id/close`
- `GET /api/hr/attendance?mine=true&take=8`
- `POST /api/hr/attendance/clock`
- `GET /api/hr/leave?mine=true&take=8`
- `POST /api/hr/leave`
- `GET /api/hr/shift-swaps?mine=true&take=8`
- `POST /api/auth/logout`

No invented endpoints were added or called.

## API Contract Notes

Shift start/end payload:

```json
{
  "notes": "Optional waiter note"
}
```

Attendance clock payload supported by the backend:

```json
{
  "employeeId": "<employee id>",
  "notes": "Optional waiter note"
}
```

Leave request payload supported by the backend:

```json
{
  "employeeId": "<employee id>",
  "leaveType": "ANNUAL",
  "startsAt": "2026-06-20T09:00:00.000Z",
  "endsAt": "2026-06-20T17:00:00.000Z",
  "reason": "Optional reason"
}
```

`GET /api/auth/me` currently returns user, role, membership, organization, branch, and session context, but it does not return a safe self `employeeId`. The UI therefore lists self-scoped HR records but blocks employee-ID-dependent write actions until the profile/session contract exposes that identifier.

## Files Added

- `apps/web/src/lib/waiter/me-api.ts`
- `apps/web/src/lib/waiter/me-model.ts`
- `apps/web/src/components/waiter/me/WaiterMeScreen.tsx`
- `apps/web/src/components/waiter/me/index.ts`
- `ai/WAITER_MVP_FRONTEND_ME_TAB_HR_SELF_SERVICE_COMPLETION_REPORT.md`

## Files Modified

- `apps/web/src/pages/waiter/me.tsx`
- `apps/web/README.md`
- `ai/AI_STATUS.md`
- `repo file tree.txt`

## Me / Profile Normalization

`me-model.ts` normalizes the auth profile into waiter-facing display fields:

- display name
- email
- roles
- organization name
- branch name
- branch ID
- service area fallback
- employee ID when a future backend contract exposes one
- employee-unavailable reason when the ID is absent

Safe fallback labels are used instead of inferring missing HR data.

## Shift Behavior

- Active shift status is read from `GET /api/shifts/active`.
- Start shift calls `POST /api/shifts/open` only when no open shift exists and the user has `pos:shift:open`.
- End shift calls `POST /api/shifts/:id/close` only when an active shift exists and the user has `pos:shift:close`.
- Both actions accept optional notes.
- Successful mutations invalidate active shift, floor, orders queue, and reservation query families.

## Attendance Behavior

- Attendance history uses `GET /api/hr/attendance?mine=true&take=8`.
- The clock action is rendered but disabled until `GET /api/auth/me` exposes a self `employeeId`
  and the session has the attendance clock permission.
- No owner/manager employee lookup was added to work around the missing ID.

## Leave Behavior

- Leave history uses `GET /api/hr/leave?mine=true&take=8`.
- The leave form uses the backend leave type enum and date inputs.
- Submit is disabled until a self `employeeId` is available and the session has the leave create
  permission.
- No approval, admin, payroll, or scheduling workflow was added.

## Shift Swap Behavior

- Existing self-scoped shift-swap requests are listed from `GET /api/hr/shift-swaps?mine=true&take=8`.
- New shift-swap creation is intentionally not exposed because the existing backend create DTO requires a `targetEmployeeId`, and the waiter UI has no safe waiter-scoped target employee selector.

## Logout / Session Behavior

- The page exposes the existing logout flow through `useAuth().logout()`.
- Logout attempts `POST /api/auth/logout` through the existing auth client behavior, clears local session state, and routes back to `/login?reason=logged_out`.
- Idle auto-logout remains handled by the existing waiter shell.

## Error, Loading, Empty, and Capability States

- Loading skeletons are shown for profile-adjacent operational cards.
- Empty attendance, leave, and swap lists render non-error empty states.
- API failures show scoped retryable error copy without exposing admin actions.
- Unsupported writes show clear capability reasons instead of hidden or fake success paths.

## Validation

Commands run:

```pwsh
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
```

Results:

- Initial plain `pnpm --filter @nimbus-pos/web typecheck`: blocked before TypeScript by global
  pnpm 11.7.0 lockfile incompatibility with this repo's `pnpm@8.15.0`.
- Typecheck with repo-pinned pnpm: passed.
- Lint: passed.
- Build: passed.

## Browser Smoke

Temporary dev server route smoke on port `3000`:

- `/login` -> HTTP 200
- `/waiter/me` -> HTTP 200
- `/waiter/floor` -> HTTP 200
- `/waiter/orders` -> HTTP 200
- `/waiter/reservations` -> HTTP 200
- `/waiter/orders/new` -> HTTP 200

The frontend build completed, and the dev route smoke proved `/waiter/me` renders. Playwright was
not installed locally and no browser-control MCP was exposed, so client-side unauthenticated redirect
behavior was not JS-automated in this verification pass.

## Live API Limitation

`http://localhost:3001/api/health` was unavailable during verification, so live authenticated start/end shift, attendance, leave, and swap reads/mutations were not run against the API.

## Done Checks

- Frontend-only scope preserved.
- Existing waiter shell and bottom navigation preserved.
- Real endpoints only.
- No backend, Prisma, seed, migration, or Postman changes.
- No manager/admin HR, payroll, scheduling admin, Menu tab, mobile, owner/manager/accountant, or hardware work introduced.
- Documentation and status files updated.
