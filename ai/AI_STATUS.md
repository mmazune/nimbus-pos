# AI_STATUS.md — Live Progress Tracker

## Current State

- Repo name: nimbus-pos
- Current milestone: M2 ✅
- Last completed milestone: M2 — Auth v1 + JWT Sessions + RBAC + Audit Log
- Next milestone: M3 — Multi-Tenancy Core (Org / Branch / Membership)
- Date updated: 2026-03-20

## Environment

- Node target: 22.x (verified: v22.14.0)
- pnpm target: 8.x (verified: 8.15.0)
- Database target: Neon Postgres (wired in M1 ✅)
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

- [ ] organizations
- [ ] branches
- [ ] memberships
- [ ] platform access matrix
- [ ] tenant guard
- [ ] DONE checks passed

### M4 — Settings + Numbering + Accounting Readiness

- [ ] org settings
- [ ] branch settings
- [ ] number sequences
- [ ] tax categories
- [ ] payment method config
- [ ] posting rule contracts
- [ ] DONE checks passed

### M5-M47

Track each milestone in order as it is completed. Add one checklist block per milestone as implementation proceeds.

## Known Blockers

- None.

## Notes

- The roadmap is software-first.
- Do not start M46 hardware work until the software stack is stable.
- Repo structure normalized: API under apps/api (not services/api), shared under packages/shared (not packages/contracts).
