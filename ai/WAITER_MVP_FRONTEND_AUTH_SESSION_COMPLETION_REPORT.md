# Completion Report - WAITER-MVP Frontend Auth/Session Foundation

## Context Snapshot

- Current milestone: WAITER-MVP Frontend Auth/Session Foundation
- Previous completed milestone: WAITER-MVP Waiter Role Postman Regeneration
- Next recommended milestone: Waiter Floor/Tables read-only data wiring

## Summary

- Built the desktop-first frontend auth/session foundation for the waiter MVP.
- Shared login now supports Quick PIN and Email + Password.
- Waiter-compatible users route to `/waiter/floor`.
- Non-waiter users are blocked from unfinished workspaces.
- `/waiter/*` routes are guarded.
- Logout and 15-minute idle auto-logout clear local session and return to `/login`.
- Active shift is read as a non-blocking foundation only.

## Files Added / Changed

- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/auth/AuthProvider.tsx`
- `apps/web/src/lib/auth/auth-api.ts`
- `apps/web/src/lib/auth/role.ts`
- `apps/web/src/lib/auth/token-storage.ts`
- `apps/web/src/lib/auth/types.ts`
- `apps/web/src/lib/waiter/idle.ts`
- `apps/web/src/lib/waiter/useActiveShift.ts`
- `apps/web/src/components/providers/AppProviders.tsx`
- `apps/web/src/components/waiter/shell/WaiterHeader.tsx`
- `apps/web/src/components/waiter/shell/WaiterIdleLogoutHandler.tsx`
- `apps/web/src/components/waiter/shell/WaiterPageContainer.tsx`
- `apps/web/src/components/waiter/shell/WaiterSessionGuard.tsx`
- `apps/web/src/components/waiter/shell/WaiterShell.tsx`
- `apps/web/src/components/waiter/shell/WaiterShiftBanner.tsx`
- `apps/web/src/components/waiter/shell/index.ts`
- `apps/web/src/pages/login.tsx`
- `apps/web/src/pages/waiter/floor.tsx`
- `apps/web/src/pages/waiter/me.tsx`
- `apps/web/README.md`
- `repo file tree.txt`
- `ai/AI_STATUS.md`

## Database

- Prisma models added/changed: none
- Migration name: none
- Indexes / constraints: none
- Seed updates: none
- Notes: frontend-only work

## API

- Frontend client methods added for existing endpoints only:
  - `POST /api/auth/login`
  - `POST /api/auth/quick-pin-login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
  - `GET /api/shifts/active`
- Guards applied: frontend `WaiterSessionGuard`
- Audit coverage: unchanged backend audit paths
- Idempotency coverage: unchanged

## Tests

- Unit tests: none added
- e2e tests: none added
- Commands run:
  - `pnpm --filter @nimbus-pos/web typecheck`
  - `pnpm --filter @nimbus-pos/web lint`
  - `pnpm --filter @nimbus-pos/web build`
- Results: all passed

## Postman

- Collection added/updated: none
- Variables/tests added: none
- Manual checklist executed: not applicable, no Postman changes

## Docs

- ROADMAP status impact: frontend waiter auth/session foundation completed inside the waiter MVP frontend phase.
- Files updated:
  - `apps/web/README.md`
  - `repo file tree.txt`
  - `ai/AI_STATUS.md`
  - `ai/WAITER_MVP_FRONTEND_AUTH_SESSION_COMPLETION_REPORT.md`

## DONE Checks

- `pnpm --filter @nimbus-pos/web typecheck`: passed
- `pnpm --filter @nimbus-pos/web lint`: passed
- `pnpm --filter @nimbus-pos/web build`: passed
- Browser smoke:
  - `/login` rendered Quick PIN mode by default
  - Email mode switching worked
  - PIN pad enabled submit after branch context plus 6 digits
  - unauthenticated `/waiter/floor` redirected to `/login?reason=session_required`

## Decisions / Deviations

- Quick PIN requires `branchId` by backend contract, so the login screen exposes a branch context field until terminal provisioning exists.
- Shift state is read and displayed only; no shift open/close UX and no page blocking were implemented in this prompt.
- No owner, manager, accountant, mobile, hardware, orders, floor-data, reservation, receipt, or Me-tab HR flows were implemented.

## Known Issues

- Browser smoke did not perform a real successful login because no local backend session and branch credential run was available in this frontend-only validation.
- Service area is not exposed by `/api/auth/me`; header uses `Service area pending`.

## Next Step

Wire waiter Floor/Tables read-only data using existing backend floor/table endpoints, preserving shift-read gating and ownership-blocked states.
