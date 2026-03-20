# AI_CONTEXT.md — Nimbus POS Clean Rebuild

## Goal

Build Nimbus POS again from scratch using a strict milestone system, while preserving the real product depth:
POS, KDS, inventory, procurement, reservations, events, HR/workforce, payroll, accounting, franchise, billing,
developer portal, reporting, alerts, offline reliability, and later hardware integrations.

## Non-negotiables

- Neon Postgres
- Prisma schema + committed migrations
- NestJS modules and service-first business logic
- Postman collection for every milestone
- Idempotent seeds
- Audit coverage on sensitive writes
- Accounting-ready contracts early, full accounting later
- MSR / badge login deferred to late hardware wave
- Smart spouts deferred to late hardware wave

## Locked technical decisions

- IDs: `cuid2`
- Validation: `class-validator` + `class-transformer`
- Auth v1: JWT access + refresh
- Repo: pnpm workspaces + Turborepo
- Backend: NestJS
- ORM: Prisma
- Database: Neon Postgres
- Frontend: Next.js Pages Router + React Query + Tailwind
- Jobs/cache: Redis + BullMQ
- Tests: Jest + Supertest

## Architecture rules

1. Most business data is `orgId` scoped.
2. Branch-operational data must usually include `branchId`.
3. Controllers stay thin; services own rules and state transitions.
4. Stock, money, approvals, payroll, and sync flows are transaction-first.
5. Critical operational ledgers should be append-only where possible.
6. Every write path that can materially affect money, stock, auth, or compliance must be auditable.
7. Build software-only foundations first; hardware integrations come much later.

## Operational domains to cover

- Identity & RBAC
- Organizations / branches / settings
- Floor plans / tables / service areas
- Menu / modifiers / combos / recipes
- Inventory / batches / FIFO / counts / wastage / purchasing
- POS / KDS / payments / refunds / shifts / tills
- Reservations / deposits / events / ticketing
- Analytics / anti-theft / reporting / exports / feedback
- Documents
- HR / attendance / leave / scheduling / payroll / staff insights
- Accounting / AP / AR / bank rec / period close / budgets
- Franchise / billing / dev portal / alerts / reliability / flags
- Frontend workspaces
- Passkeys / MFA / SSO
- Deferred hardware: badges / MSR / spouts / peripherals

## What the coding AI must read before coding

- `ROADMAP.md`
- `repo file tree.txt`
- `ai/AI_CONTEXT.md`
- `ai/AI_STATUS.md`
- `ai/AI_ERROR_PROTOCOL.md`
- `ai/AI_COMPLETION_REPORT_TEMPLATE.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONVENTIONS.md`

## Build order inside every milestone

DB → service → controller → tests → seed → Postman → docs → status update → completion report

## Hard warnings

- Do not skip Postman.
- Do not skip seed updates.
- Do not invent features outside milestone scope.
- Do not pull deferred hardware work into early milestones.
- Do not implement full accounting before operational source documents are stable.
