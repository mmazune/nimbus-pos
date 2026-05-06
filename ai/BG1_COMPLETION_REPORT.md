# Completion Report — BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding

## Context Snapshot

- Current milestone: **BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding** (2026-04-30)
- Previous completed milestone: **M42 — Feature Flags + Maintenance Windows + Training Mode** (2026-04-29)
- Next milestone: **BG2 — Unified Approvals Inbox + Global Audit Timeline**

## Summary

- **What was built**: Closed the invited-user lifecycle gap (no DB-tracked
  invitations existed before BG1) and removed the cross-module
  choreography the frontend used to need for normal staff onboarding. The
  frontend can now (a) issue invitations and observe their persisted
  state, (b) drive a self-service password-reset flow for any user, (c)
  force a password change on first login, and (d) onboard a frontline
  cashier in a single POST that creates User + UserRole + Membership +
  Employee, plus an optional Quick PIN, all transactionally.
- **What is now working**:
  - Persisted invitations with hashed tokens, full state machine
    (PENDING / ACCEPTED / REVOKED / EXPIRED), resend with rotation,
    revoke with idempotency, accept with single-transaction password
    set.
  - Anti-enumeration `forgot-password`, single-use `reset-password` that
    revokes every active session and refresh token for the target user,
    JWT-guarded `force-password-change` that clears the
    `mustChangePassword` flag.
  - One-call frontline onboarding under
    `POST /api/hr/frontline-staff/onboard` returning the optional Quick
    PIN inline so the manager can hand it to the new cashier
    immediately.
  - All seven endpoints respect existing branch-context guards and
    permissions; two new permissions were added and granted to Owner +
    Manager.

## Files Added / Changed

**Added**

- `packages/db/prisma/migrations/20260430000000_bg1_invitation_password_lifecycle/migration.sql`
- `apps/api/src/modules/auth/dto/bg1.dto.ts`
- `apps/api/src/modules/auth/invitation-lifecycle.service.ts`
- `apps/api/src/modules/auth/password-lifecycle.service.ts`
- `apps/api/src/modules/hr/dto/frontline-staff-onboard.dto.ts`
- `apps/api/src/modules/hr/frontline-staff-onboarding.service.ts`
- `apps/api/test/bg1-onboarding.e2e-spec.ts`
- `postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`
- `ai/BG1_COMPLETION_REPORT.md` (this file)

**Changed**

- `packages/db/prisma/schema.prisma` — added `User.mustChangePassword`,
  models `Invitation` + `PasswordResetToken`, enums `InvitationStatus`
  + `PasswordResetPurpose`.
- `packages/db/prisma/seed.ts` — added perms
  `onboarding:invitation:write`, `hr:frontline-staff:create`; granted to
  Owner + Manager via `ROLE_PERM_MATRIX`; new SeedHistory marker
  `bg1-invitation-password-frontline`.
- `apps/api/src/modules/auth/auth.module.ts` — providers + exports for
  the two new lifecycle services.
- `apps/api/src/modules/auth/auth.controller.ts` — 4 BG1 endpoints
  wired.
- `apps/api/src/modules/auth/dto/index.ts` — re-exports BG1 DTOs.
- `apps/api/src/modules/client-onboarding/client-onboarding.service.ts`
  — `inviteOne` now persists `Invitation` rows with SHA-256 hashed
  tokens; new `resendInvitation` and `revokeInvitation` methods.
- `apps/api/src/modules/client-onboarding/client-onboarding.controller.ts`
  — 2 new endpoints (`/invitations/:id/resend`,
  `/invitations/:id/revoke`).
- `apps/api/src/modules/client-onboarding/dto/index.ts` —
  `RevokeInvitationDto`.
- `apps/api/src/modules/hr/hr.module.ts` — imports `AuthModule`,
  registers `FrontlineStaffOnboardingService`.
- `apps/api/src/modules/hr/hr.controller.ts` — `frontline-staff/onboard`
  endpoint.
- `apps/api/src/modules/hr/dto/index.ts` — re-exports the onboard DTOs.
- `ai/AI_STATUS.md` — BG1 entry; counts updated (migrations 47→48,
  collections 48→49, completion reports 53→54); BG1 marked done; BG2
  noted as next.

## Database

- **Prisma models added**:
  - `Invitation` — `id` (cuid), `organizationId`, `branchId`, `roleId`,
    `email`, `firstName?`, `lastName?`, `tokenHash` UNIQUE,
    `status InvitationStatus`, `expiresAt`, `acceptedAt?`,
    `acceptedByUserId?`, `revokedAt?`, `revokedByUserId?`,
    `revokedReason?`, `resendCount Int @default(0)`, `lastResentAt?`,
    `invitedByUserId`, `membershipId?`, `userId?`, `metadata Json?`,
    `createdAt`, `updatedAt`.
  - `PasswordResetToken` — `id` (cuid), `userId`, `tokenHash` UNIQUE,
    `purpose PasswordResetPurpose`, `expiresAt`, `consumedAt?`,
    `invalidatedAt?`, `ipAddress?`, `userAgent?`, `metadata Json?`,
    `createdAt`.
- **Prisma model changed**: `User` gained
  `mustChangePassword Boolean @default(false)`.
- **Enums added**:
  - `InvitationStatus { PENDING, ACCEPTED, REVOKED, EXPIRED }`
  - `PasswordResetPurpose { FORGOT_PASSWORD, INVITATION_FIRST_LOGIN, FORCE_RESET_BY_ADMIN }`
- **Migration name**: `20260430000000_bg1_invitation_password_lifecycle`
  (48th migration). Applied via `prisma migrate deploy` →
  "All migrations have been successfully applied."
- **Indexes / constraints**:
  - `invitations.token_hash` UNIQUE.
  - `invitations(organization_id, status)`.
  - `invitations(branch_id)`, `invitations(email)`,
    `invitations(expires_at)`.
  - `password_reset_tokens.token_hash` UNIQUE.
  - `password_reset_tokens(user_id, purpose)`,
    `password_reset_tokens(expires_at)`.
- **Seed updates**: 2 new permissions
  (`onboarding:invitation:write`, `hr:frontline-staff:create`); both
  added to Owner + Manager `ROLE_PERM_MATRIX`. SeedHistory marker
  `bg1-invitation-password-frontline` recorded. `pnpm db:seed`
  completes idempotently.
- **Notes**: No FK back-relations are declared on User / Organization /
  Branch / Role for the new tables; this matches the existing project
  pattern for app-layer tenancy enforcement and avoids relation-name
  churn on hot tables.

## API

- **Modules added/changed**: `AuthModule` (2 new services + 4
  endpoints), `ClientOnboardingModule` (2 new endpoints, refactored
  `inviteOne`), `HrModule` (1 new service + 1 endpoint, now imports
  `AuthModule`).
- **Endpoints added/updated**:
  - `POST /api/auth/invitations/accept` (public, `@HttpCode(200)`)
  - `POST /api/auth/forgot-password` (public, `@HttpCode(200)`)
  - `POST /api/auth/reset-password` (public, `@HttpCode(200)`)
  - `POST /api/auth/force-password-change` (`JwtAuthGuard`,
    `@HttpCode(200)`)
  - `POST /api/onboarding/invitations/:id/resend`
    (`@Permissions('onboarding:invitation:write')`)
  - `PATCH /api/onboarding/invitations/:id/revoke`
    (`@Permissions('onboarding:invitation:write')`)
  - `POST /api/hr/frontline-staff/onboard`
    (`@Permissions('hr:frontline-staff:create')`, `@HttpCode(201)`,
    inherits `@RequireBranchContext` from the HR controller)
- **Guards applied**:
  - Public BG1 endpoints (accept / forgot / reset) bypass the JWT guard;
    state validation lives in the services.
  - `force-password-change` uses `JwtAuthGuard`.
  - Onboarding resend / revoke and frontline onboard go through
    `JwtAuthGuard` + `PermissionsGuard`. Frontline onboard also goes
    through `BranchContextGuard` (via the controller-level
    `@RequireBranchContext`).
- **Audit coverage**: All BG1 services emit `AuditLog` rows via the
  shared `AuditService`:
  - `AUTH_INVITATION_ACCEPTED`
  - `AUTH_PASSWORD_RESET_REQUESTED`
  - `AUTH_PASSWORD_RESET_COMPLETED`
  - `AUTH_PASSWORD_FORCE_CHANGED`
  - `ONBOARDING_INVITATION_RESENT`
  - `ONBOARDING_INVITATION_REVOKED`
  - `HR_FRONTLINE_STAFF_ONBOARDED`
- **Idempotency coverage**:
  - Re-accepting an `ACCEPTED` invitation returns 409 with a stable
    error code; same for `REVOKED` / `EXPIRED`.
  - Re-consuming a reset token returns 409.
  - `revokeInvitation` is idempotent on already-revoked invitations and
    returns the existing row.
  - `frontline-staff/onboard` rejects duplicate (org + email) combos
    with 409 instead of partially creating rows.

## Tests

- **Unit tests**: Existing unit suites unaffected. `pnpm exec tsc
  --noEmit` returns clean for every BG1 file.
- **e2e tests**: `apps/api/test/bg1-onboarding.e2e-spec.ts` — 14/14 pass
  in **134s** against the live Neon DB. Cases:
  1. Create invitation row + return `invitationId` + plaintext token
  2. Resend rotates the token + bumps `resendCount`
  3. Accept invitation + set password
  4. Re-accept already-accepted token → 409
  5. Accepted user can log in with new password
  6. Revoke after accept → 409
  7. Forgot-password unknown email → generic 200
  8. Forgot-password known user → exposes dev `prt_*` token
  9. Reset-password rotates + lets user log in
  10. Re-consume reset token → 409
  11. Frontline onboard creates user + role + membership + employee +
      Quick PIN (mustChangePassword=true)
  12. Onboarded staff can log in with temp password
  13. Force-password-change clears the flag
  14. Onboard without branch context → 400
- **Commands run**:
  - `cd packages/db && pnpm exec prisma migrate deploy`
  - `cd apps/api && pnpm exec tsc --noEmit`
  - `cd apps/api && pnpm exec jest --config ./test/jest-e2e.json --testPathPattern=bg1-onboarding`
  - `cd <repo> && pnpm db:seed`
  - `cd <repo> && pnpm dev:api` (background)
  - `npx newman run postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json --env-var baseUrl=http://localhost:3001`
- **Results**:
  - migrate deploy → "All migrations have been successfully applied."
  - tsc → only pre-existing errors in
    `accounts-receivable.service.spec.ts`; **zero** BG1-related errors.
  - jest e2e → **14/14 pass**.
  - db:seed → "🌱 Seed complete." (idempotent on a re-seeded DB).
  - newman → **20 requests, 41 assertions, 0 failures**.

## Postman

- **Collection added**:
  `postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`.
- **Folders**: `00 Read Me`, `A. Auth & Context Baseline [STANDALONE]`,
  `B. Invitation Lifecycle [STANDALONE]`, `C. Password Lifecycle
  [STANDALONE]`, `D. Frontline Staff Onboarding [STANDALONE]`,
  `E. Login + /api/auth/me Handoff [STANDALONE]`.
- **Variables/tests added**: `bg1Suffix`, `inviteEmail`,
  `frontlineEmail`, `invitationId`, `invitationToken`, `resetToken`,
  `rotatedPassword`, `frontlineRotatedPassword`, `frontlineAccessToken`
  (all auto-populated by the canonical pre-request) plus per-request
  test scripts that assert HTTP code + key payload fields. Login
  requests assert `[200, 201]` per R12. Variable writes are dual-scope
  (collection + active environment) per R16.
- **Manual checklist executed**:
  - Cold-session full run via `npx newman` → 0 failures.
  - Each `[STANDALONE]` folder run individually after a fresh import →
    no missing-variable failures.

## Docs

- **ROADMAP status impact**: BG1 is not part of the M0–M42 roadmap; it
  closes the gap inventory in `ai/nimbus_backend_gap_fix_prompts.md`.
  No ROADMAP rows changed status.
- **Files updated**:
  - `ai/AI_STATUS.md` — BG1 entry added; counts updated; BG2 marked as
    next.
  - `ai/BG1_COMPLETION_REPORT.md` — this file.

## DONE Checks

- `pnpm exec tsc --noEmit` (apps/api) → only the 4 pre-existing
  `accounts-receivable.service.spec.ts` errors; zero BG1 errors.
- `pnpm exec prisma migrate deploy` (packages/db) → "All migrations
  have been successfully applied."
- `pnpm db:seed` → "🌱 Seed complete." (all M40–M42 entries skipped
  idempotently; new BG1 perms + role bindings + history marker
  applied).
- `pnpm exec jest --config ./test/jest-e2e.json --testPathPattern=bg1-onboarding`
  → **14 passed, 14 total** in 134s.
- `npx newman run postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`
  → **20 requests, 41 assertions, 0 failures**.

## Decisions / Deviations

- **No FK back-relations on User / Org / Branch / Role for the new
  tables.** This matches the project's existing app-layer tenancy
  pattern (see `Membership`, `UserRole`) and avoids touching every
  relation name on hot tables.
- **Token plaintext is returned ONCE.** Only the SHA-256 digest is
  persisted. The dev mailer-hook on `forgot-password` is gated by
  `NODE_ENV !== 'production'` OR `NIMBUS_EXPOSE_RESET_TOKENS=true` so
  production responses stay generic.
- **`reset-password` revokes every active session + refresh token** for
  the target user. This is stricter than rotating just the password,
  but it is the correct behavior for an account-takeover-recovery
  endpoint.
- **`frontline-staff/onboard` reuses `QuickPinService.issueQuickPin`**
  rather than reimplementing PIN issuance. The endpoint surfaces the
  same `{ pin, tier, pinLength }` shape that the existing M3.1 flow
  emits, so the frontend has one PIN contract.
- **Permissions granted to Manager** so multi-branch managers can
  invite staff and onboard cashiers without escalating to Owner.
- **No new endpoint competes with `/api/auth/me`.** BG1 reuses the
  canonical context route per R14 and the verified BG0 conclusion.

## Known Issues

- The 4 pre-existing TypeScript errors in
  `apps/api/src/modules/accounts-receivable/accounts-receivable.service.spec.ts`
  predate BG1 and are unrelated. They will be addressed in a separate
  cleanup pass.

## Next Step

- Begin **BG2 — Unified Approvals Inbox + Global Audit Timeline** per
  `ai/nimbus_backend_gap_fix_prompts.md`.
