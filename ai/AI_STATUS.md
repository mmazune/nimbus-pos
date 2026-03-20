# AI_STATUS.md — Live Progress Tracker

## Current State

- Repo name: nimbus-pos
- Current milestone: M4 ✅
- Last completed milestone: M4 — Org Settings + Configuration
- Next milestone: M5 — Branch Settings + Number Sequences
- Date updated: 2026-03-20

## Environment

- Node target: 22.x (verified: v22.14.0)
- pnpm target: 8.x (verified: 8.15.0)
- Database target: Neon Postgres (wired in M1 ✅, verified M3.1 ✅)
- Prisma version: 5.22.0
- Redis target: docker-compose for local dev (wired later)
- API port target: 3001
- Web port target: 3000

## Locked Decisions

- Stack: Node 22 + TypeScript + NestJS + Prisma + Neon + Redis + BullMQ
- ID type: cuid2
- Validation: class-validator + class-transformer
- Auth v1: JWT access + refresh
- Frontend: Next.js Pages Router
- Deferred until late wave: MSR badge login, smart spouts

## Milestone Checklist

### M0 — Repo Bootstrap + Workspace Tooling

- [x] Workspace created (pnpm workspaces + Turbo)
- [x] API scaffold created (NestJS under apps/api)
- [x] Shared packages scaffolded (packages/db, packages/shared)
- [x] lint / format / test scripts wired
- [x] docs scaffolded (ARCHITECTURE, API_CONVENTIONS, MODULES)
- [x] Health endpoint working (GET /api/health)
- [x] Unit test passing (app.controller.spec.ts)
- [x] e2e test passing (app.e2e-spec.ts)
- [x] Postman collection + environment created
- [x] DONE checks passed

### M1 — Neon + Prisma Baseline + Seed Framework

- [x] Prisma configured (schema.prisma with AppConfig + SeedHistory)
- [x] Neon connection works (via DATABASE_URL env var)
- [x] Migration pipeline works (20260320000000_m1_baseline committed)
- [x] Seed runner idempotent (safe to run multiple times)
- [x] DB-backed /health passes (SELECT 1 check)
- [x] PrismaModule + PrismaService in apps/api/src/common/prisma/
- [x] Root db:generate / db:migrate / db:seed / db:studio scripts wired
- [x] Postman M1-Health-DB collection created
- [x] Docs updated (README, ARCHITECTURE, MODULES, repo file tree)
- [x] pnpm lint clean
- [x] pnpm test clean (2 unit + 2 e2e tests passing)
- [x] DONE checks passed

### M2 — Auth v1 + Sessions + RBAC

- [x] Prisma schema: User, Role, Permission, RolePermission, UserRole, Session, RefreshToken, AuditLog
- [x] Migration: 20260320065959_m2_auth_rbac_sessions committed
- [x] JWT access (15m) + opaque refresh (7d) with rotation + family revocation
- [x] PIN login (4–6 digit, bcrypt hashed)
- [x] Session persistence (jti, platform, source, IP, user-agent, lastActivityAt)
- [x] RBAC: 5 levels (L1–L5), 11 job roles, 6 permissions
- [x] PermissionGuard (decorator-driven)
- [x] PlatformAccessGuard (X-Platform header, level-based matrix)
- [x] AuditService (global module, 10 action types)
- [x] Common decorators (@CurrentUser, @Permissions, @Roles)
- [x] Seed: 11 roles, 6 permissions, 27 role-permission mappings, 6 demo users (idempotent)
- [x] Unit tests: 20 passing (auth.service, permission.guard, platform-access.guard)
- [x] E2e tests: 16 passing (auth flows, RBAC denial, platform denial)
- [x] pnpm lint clean (0 errors)
- [x] Manual API verification (health, login, me, pin-login, 403s)
- [x] Postman M2-Auth-RBAC collection + environment + guide
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, README, repo file tree)
- [x] DONE checks passed

### M3 — Multi-Tenancy Core

- [x] Prisma schema: Organization, Branch, Membership models + enums (OrganizationStatus, BranchStatus, MembershipStatus)
- [x] Migration: 20260320073537_m3_tenancy_org_branch_membership committed
- [x] TenancyModule: service + controller with full CRUD for orgs, branches, memberships
- [x] DTOs: create-org, create-branch, create-membership (class-validator)
- [x] BranchContextGuard: reads X-Branch-Id header, validates branch exists + ACTIVE + user has ACTIVE membership
- [x] @RequireBranchContext decorator for controller routes
- [x] Auth integration: GET /api/me returns full tenancy context (orgs, branches, memberships, roles, permissions, session)
- [x] 5 M3 permissions: tenancy:org:read/write, tenancy:branch:read/write, tenancy:membership:manage
- [x] Role-permission matrix updated for all 11 roles
- [x] Audit events: ORG_CREATED, BRANCH_CREATED, MEMBERSHIP_CREATED, BRANCH_ACCESS_DENIED
- [x] Seed: 1 org, 2 branches, 6 memberships (idempotent)
- [x] Unit tests: tenancy.service.spec (7 tests) + branch-context.guard.spec (4 tests)
- [x] E2e tests: tenancy.e2e-spec (13 tests across 3 suites)
- [x] Postman M3-Tenancy collection + environment updated
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, README, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed

### M3.1 — Quick PIN Login for POS Desktop

- [x] Prisma schema: QuickPinTier enum + 13 new User fields (quickPinHash, pinLookupHash, pinTier, pinLength, displayName, employeeCode, avatarUrl, quickPinEnabled, failedPinAttempts, pinLockedUntil, lastPinChangedAt, quickPinIssuedAt, quickPinIssuedById)
- [x] Migration: 20260320100000_m3_1_quick_pin_login (SQL created manually — apply when Neon online)
- [x] QuickPinService: quickPinLogin, issueQuickPin, resetQuickPin, updateQuickPinSettings, getQuickPinStatus
- [x] Dual-hash security: HMAC-SHA256 pinLookupHash (indexed) + bcrypt quickPinHash
- [x] Role-tier policy: LOW_6 (6-digit) = WAITER/CASHIER/BARTENDER, HIGH_8 (8-digit) = SUPERVISOR/MANAGER
- [x] Platform enforcement: POS_DESKTOP only for quick PIN login
- [x] Lockout policy: 5 failed attempts → 5-minute lock
- [x] 4 DTOs: QuickPinLoginDto, IssueQuickPinDto, ResetQuickPinDto, UpdateQuickPinSettingsDto
- [x] 5 controller endpoints: POST quick-pin-login, POST issue, POST reset, PATCH settings, GET status
- [x] Audit logging: QUICK_PIN_LOGIN, QUICK_PIN_ISSUED, QUICK_PIN_RESET, QUICK_PIN_SETTINGS_UPDATED, QUICK_PIN_LOCKOUT
- [x] Seed: 3 demo quick PINs (waiter=123456/LOW_6, cashier=654321/LOW_6, manager=12345678/HIGH_8)
- [x] Unit tests: 15 tests in quick-pin.service.spec.ts (+ 48 total across 7 suites)
- [x] E2e tests: 16 tests in quick-pin.e2e-spec.ts (+ 44 total across 4 suites)
- [x] Postman: M3_1-Quick-PIN-Login collection (17 requests) + environment updated
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed (2026-03-20: all green — generate, migrate, seed×2, lint, test, test:e2e, dev:api, health, manual PIN login verified)

### M4 — Org Settings + Configuration

- [x] Prisma schema: OrgSettings model (19 fields including Decimal, JSON, scalar) + ExchangeRate model (8 fields, composite index)
- [x] Migration: 20260320120000_m4_org_settings (SQL created manually — apply when Neon online)
- [x] SettingsModule: service + controller with 14 endpoints
- [x] Sub-resource endpoints: /settings, /settings/currency, /settings/tax-matrix, /settings/rounding, /thresholds, /settings/platform-access, /settings/exchange-rate, /settings/exchange-rates
- [x] DTOs: 7 validated DTOs (UpdateOrgSettings, UpdateCurrency, UpdateTaxMatrix, UpdateRounding, UpdateThresholds, UpdatePlatformAccess, CreateExchangeRate)
- [x] New permission: tenancy:settings:manage (assigned to Owner + Manager roles)
- [x] Audit events: SETTINGS_UPDATED, CURRENCY_UPDATED, TAX_MATRIX_UPDATED, ROUNDING_UPDATED, THRESHOLDS_UPDATED, PLATFORM_ACCESS_UPDATED, EXCHANGE_RATE_CREATED
- [x] Decimal safety: all monetary/rate fields use Prisma Decimal, never float
- [x] Seed: OrgSettings defaults (vatPercent=18, currency=UGX, discountApprovalThreshold=5000, reservationHoldMinutes=30) + ExchangeRate (USD/UGX @ 3700.000000)
- [x] Unit tests: 10 tests in settings.service.spec.ts
- [x] E2e tests: 16 tests in settings.e2e-spec.ts (auth, RBAC denial, payload validation, exchange rates)
- [x] Postman: M4-Org-Settings collection (17 requests) + environment updated
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed (2026-03-20: generate ✅, migrate ✅, seed×2 ✅, lint 0 errors ✅, test 60/60 ✅, e2e 16/16 M4 tests ✅, dev:api ✅, manual hits ✅)

### M5-M47

Track each milestone in order as it is completed. Add one checklist block per milestone as implementation proceeds.

## Known Blockers

- None. M4 fully verified.

## Notes

- The roadmap is software-first.
- Do not start M46 hardware work until the software stack is stable.
- Repo structure normalized: API under apps/api (not services/api), shared under packages/shared (not packages/contracts).
- **Windows DLL lock**: Prisma engine DLLs may be locked by stale `node.exe` processes (from `nest --watch`, turbo, or VS Code). Stop all node processes before running `pnpm db:generate`.
- **Neon suspend**: Neon Postgres suspends after inactivity. First request after suspension may return P1001; retry after 2-3 seconds.
- **E2e PIN data**: Running e2e tests modifies quick PIN data. Re-seed after e2e runs to restore demo PINs.
