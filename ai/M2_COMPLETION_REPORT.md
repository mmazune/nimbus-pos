# Completion Report — M2: Auth Core + Sessions + RBAC + Audit Log

## Context Snapshot

- Current milestone: M2 ✅
- Previous completed milestone: M1 — Neon + Prisma Baseline + Seed Framework
- Next milestone: M3 — Multi-Tenancy Core (Org / Branch / Membership)

## Summary

- **What was built:** Full authentication system with email/password and PIN login, JWT access + opaque refresh token rotation with family-based revocation, session management, hierarchical RBAC (5 levels, 11 job roles, 6 permissions), platform-access guard, and structured audit logging.
- **What is now working:** Users can log in (email/password or PIN), receive JWT access tokens (15m) and refresh tokens (7d), rotate tokens, view profile/sessions, and log out. Role-based permission checks and platform access restrictions are enforced. All auth events are audit-logged.

## Files Added / Changed

### New files
- `apps/api/src/common/audit/index.ts`
- `apps/api/src/common/audit/audit.module.ts`
- `apps/api/src/common/audit/audit.service.ts`
- `apps/api/src/common/decorators/index.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`
- `apps/api/src/common/decorators/permissions.decorator.ts`
- `apps/api/src/common/decorators/roles.decorator.ts`
- `apps/api/src/common/guards/index.ts`
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/guards/permission.guard.ts`
- `apps/api/src/common/guards/platform-access.guard.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/modules/auth/jwt.strategy.ts`
- `apps/api/src/modules/auth/dto/index.ts`
- `apps/api/src/modules/auth/dto/login.dto.ts`
- `apps/api/src/modules/auth/dto/pin-login.dto.ts`
- `apps/api/src/modules/auth/dto/refresh.dto.ts`
- `apps/api/test/auth.e2e-spec.ts`
- `postman/collections/M2-Auth-RBAC.postman_collection.json`

### Changed files
- `packages/db/prisma/schema.prisma` — added 8 models, 4 enums
- `packages/db/prisma/seed.ts` — rewritten with M2 seed data
- `packages/db/package.json` — added bcrypt dependency
- `apps/api/src/app.module.ts` — imports ConfigModule, AuditModule, AuthModule
- `apps/api/.env.example` — added JWT env vars
- `apps/api/package.json` — added auth dependencies
- `postman/environments/dev.postman_environment.json` — added refreshToken, userId vars
- `postman/POSTMAN_GUIDE.md` — added M2 checklist + updated structure
- `docs/ARCHITECTURE.md` — added Auth Architecture section
- `docs/API_CONVENTIONS.md` — expanded Auth + Audit sections with M2 details
- `docs/MODULES.md` — Auth marked as ✅ Implemented
- `README.md` — M2 marked as ✅ Complete
- `repo file tree.txt` — updated with all M2 files
- `ai/AI_STATUS.md` — M2 checklist completed

## Database

- **Prisma models added:** User, Role, Permission, RolePermission, UserRole, Session, RefreshToken, AuditLog
- **Enums added:** RoleLevel (L1–L5), JobRole (11 values), SessionPlatform (6 values), SessionSource (5 values)
- **Migration name:** `20260320065959_m2_auth_rbac_sessions`
- **Indexes / constraints:** Unique on User.email, Role.name, Permission.action, Session.jti, RefreshToken.tokenHash; composite unique on RolePermission(roleId+permissionId), UserRole(userId+roleId+orgId+branchId)
- **Seed updates:** 11 roles, 6 permissions, 27 role-permission mappings, 6 demo users with bcrypt-hashed passwords and PINs. AppConfig version bumped to M2.
- **Notes:** Idempotent — verified by running seed twice with 0 duplicates. orgId/branchId on UserRole are nullable, ready for M3 scoping.

## API

- **Modules added:** AuthModule, AuditModule (global)
- **Endpoints added:**
  | Method | Path                   | Auth | Description                        |
  | ------ | ---------------------- | ---- | ---------------------------------- |
  | POST   | `/api/auth/login`      | No   | Email + password login             |
  | POST   | `/api/auth/pin-login`  | No   | Email + 4–6 digit PIN login        |
  | POST   | `/api/auth/refresh`    | No   | Rotate refresh token               |
  | POST   | `/api/auth/logout`     | Yes  | Revoke current session             |
  | POST   | `/api/auth/logout-all` | Yes  | Revoke all user sessions           |
  | GET    | `/api/auth/me`         | Yes  | User profile + roles + session     |
  | GET    | `/api/auth/sessions`   | Yes  | List active sessions               |
  | GET    | `/api/auth/_perm-test` | Yes  | Dev-only permission/platform test  |
- **Guards applied:** JwtAuthGuard, PermissionGuard, PlatformAccessGuard
- **Audit coverage:** LOGIN_SUCCESS, LOGIN_FAILED, PIN_LOGIN_SUCCESS, PIN_LOGIN_FAILED, TOKEN_REFRESH, LOGOUT, LOGOUT_ALL, TOKEN_REUSE_DETECTED, SESSION_EXPIRED_ON_VALIDATE, USER_INACTIVE_ON_VALIDATE
- **Idempotency coverage:** N/A for M2 (deferred to M41)

## Tests

- **Unit tests:** 20 passing across 4 suites
  - `auth.service.spec.ts` — 8 tests (login, PIN, refresh, reuse detection, audit)
  - `permission.guard.spec.ts` — 3 tests (allow, deny, no-metadata)
  - `platform-access.guard.spec.ts` — 7 tests (L1–L5 access matrix, defaults)
  - `app.controller.spec.ts` — 2 existing M1 tests preserved
- **E2e tests:** 16 passing across 2 suites
  - `auth.e2e-spec.ts` — 16 tests (login, me, sessions, refresh, PIN, permission 403, platform 403, logout)
  - `app.e2e-spec.ts` — existing M1 e2e preserved
- **Commands run:** `pnpm test`, `pnpm test:e2e` (from apps/api)
- **Results:** All 36 tests passing (20 unit + 16 e2e)

## Postman

- **Collection added:** `M2-Auth-RBAC.postman_collection.json`
- **Variables/tests added:** `accessToken`, `refreshToken`, `userId` auto-captured on login; test scripts on all requests validate response shape
- **Requests:** Health, Login (Owner), PIN Login (Cashier), Me, Sessions, Refresh, Permission Test (Owner), Logout, Logout-All
- **Manual checklist executed:** Yes — all endpoints verified via PowerShell Invoke-RestMethod

## Docs

- **ROADMAP status impact:** M2 now complete
- **Files updated:** ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, README.md, repo file tree.txt, POSTMAN_GUIDE.md, AI_STATUS.md

## DONE Checks

- `pnpm lint` — ✅ 0 errors (2 warnings: unused vars in test mocks)
- `pnpm test` — ✅ 20 unit tests passing
- `pnpm test:e2e` — ✅ 16 e2e tests passing
- `pnpm db:generate` — ✅
- `pnpm db:migrate` — ✅ (migration 20260320065959 applied)
- `pnpm db:seed` — ✅ (run twice, idempotent)
- `pnpm dev:api` — ✅ server starts on :3001
- Manual endpoint verification — ✅ (health 200, login 201, me 200, pin-login 201, permission 403, platform 403)

## Decisions / Deviations

- **`@nestjs/jwt` v11 StringValue type:** Required `as any` casts for `expiresIn` in `auth.module.ts` and `auth.service.ts`. This is a known breaking type change in v11; runtime behavior is correct.
- **Audit service location:** Placed in `apps/api/src/common/audit/` (not `interceptors/`) since it's a service injected by modules, not an HTTP interceptor.
- **MSR/badge login deferred:** Per roadmap, MSR endpoints and badge enrollment are deferred to M46.
- **orgId/branchId nullable:** UserRole has nullable orgId/branchId to support M3 multi-tenant scoping later. Current seed creates roles without org/branch context.

## Known Issues

- E2e auth tests use 15s timeouts due to bcrypt + remote Neon DB latency. This is acceptable for CI but could be reduced with a local test DB.
- 2 ESLint warnings (unused variables in test mock setups) — intentional for test readability.

## Next Step

- M3: Multi-Tenancy Core — organizations, branches, memberships, tenant guard, org/branch-scoped role assignments.
