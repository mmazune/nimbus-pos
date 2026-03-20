# AI_STATUS.md — Live Progress Tracker

## Current State

- Repo name: nimbus-pos
- Current milestone: M0 ✅
- Last completed milestone: M0 — Repo Bootstrap + Workspace Tooling
- Next milestone: M1 — Neon + Prisma Baseline + Seed Framework
- Date updated: 2026-03-20

## Environment

- Node target: 22.x (verified: v22.14.0)
- pnpm target: 8.x (verified: 8.15.0)
- Database target: Neon Postgres (wired in M1)
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

- [ ] Prisma configured
- [ ] Neon connection works
- [ ] migration pipeline works
- [ ] seed runner idempotent
- [ ] DB-backed /health passes
- [ ] DONE checks passed

### M2 — Auth v1 + Sessions + RBAC

- [ ] users / roles / permissions tables
- [ ] JWT access + refresh
- [ ] PIN login
- [ ] session persistence
- [ ] permission guard
- [ ] audit on auth writes
- [ ] DONE checks passed

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
