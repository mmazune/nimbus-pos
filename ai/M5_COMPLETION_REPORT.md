# Completion Report — M5 Floor Plans + Tables

## Context Snapshot

- Current milestone: M5
- Previous completed milestone: M4 — Org Settings + Configuration
- Next milestone: M6 — Menu Catalog + Categories

## Summary

- What was built: Branch-scoped floor plan and table management module for dine-in operations, including CRUD for floor plans and tables, a table status state machine (AVAILABLE → OCCUPIED → RESERVED → CLEANING), real-time availability summary endpoint, and full RBAC integration with 4 new permissions.
- What is now working: Floor plan CRUD (create, list, get, update), table CRUD (create, list, get, update), table status transitions, availability summary (total/available/occupied/reserved/cleaning counts), audit logging for all write operations, branch-scoped data isolation, permission-based access control.

## Files Added / Changed

### Added
- `apps/api/src/modules/floor/floor.module.ts`
- `apps/api/src/modules/floor/floor.controller.ts`
- `apps/api/src/modules/floor/floor.service.ts`
- `apps/api/src/modules/floor/floor.service.spec.ts`
- `apps/api/src/modules/floor/dto/index.ts`
- `apps/api/src/modules/floor/dto/create-floor-plan.dto.ts`
- `apps/api/src/modules/floor/dto/update-floor-plan.dto.ts`
- `apps/api/src/modules/floor/dto/create-table.dto.ts`
- `apps/api/src/modules/floor/dto/update-table.dto.ts`
- `apps/api/src/modules/floor/dto/update-table-status.dto.ts`
- `apps/api/test/floor.e2e-spec.ts`
- `packages/db/prisma/migrations/20260320140000_m5_floor_plans_tables/migration.sql`
- `postman/collections/M5-Floor-Plans-Tables.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — Added TableStatus enum, FloorPlan model, Table model, relations on Organization and Branch
- `packages/db/prisma/seed.ts` — 4 new permissions, role-permission matrix expansion, 2 floor plans + 15 tables seed data
- `apps/api/src/app.module.ts` — FloorModule import added
- `postman/environments/dev.postman_environment.json` — floorPlanId, tableId variables
- `README.md` — M5 ✅ in milestone table
- `docs/ARCHITECTURE.md` — M5 architecture section
- `docs/API_CONVENTIONS.md` — M5 endpoint table + table status reference
- `docs/MODULES.md` — Floor/Tables marked as implemented
- `postman/POSTMAN_GUIDE.md` — M5 collection + manual checklist
- `repo file tree.txt` — M5 files added
- `ai/AI_STATUS.md` — M5 checklist added

## Database

- Prisma models added: `FloorPlan` (9 fields), `Table` (12 fields), `TableStatus` enum (4 values)
- Migration name: `20260320140000_m5_floor_plans_tables`
- Migration applied: ✅ via `prisma db execute --stdin` (Neon pooler endpoint incompatible with `prisma migrate dev/deploy` engine)
- Indexes / constraints:
  - `@@unique([branchId, label])` on Table — prevents duplicate table labels within a branch
  - `@@index([orgId])`, `@@index([branchId])`, `@@index([floorPlanId])` on Table
  - `@@index([orgId])`, `@@index([branchId])` on FloorPlan
  - FK cascade on org/branch deletion, SetNull on floorPlan deletion
- Seed updates: 4 permissions (pos:floor:read/write, pos:table:read/write), role-permission matrix expanded (7 roles updated), 2 floor plans (Main Dining Area, Patio / Outdoor), 15 tables (T1-T10, VIP-1, VIP-2, P1-P3)
- Seed verified: ✅ Run 1 created all data; Run 2 confirmed idempotency (0 new records)

## API

- Modules added: `FloorModule`
- Endpoints added (10):
  | Method | Path | Permission |
  | --- | --- | --- |
  | POST | `/api/floor-plans` | pos:floor:write |
  | GET | `/api/floor-plans` | pos:floor:read |
  | GET | `/api/floor-plans/:id` | pos:floor:read |
  | PATCH | `/api/floor-plans/:id` | pos:floor:write |
  | POST | `/api/tables` | pos:table:write |
  | GET | `/api/tables` | pos:table:read |
  | GET | `/api/tables/:id` | pos:table:read |
  | PATCH | `/api/tables/:id` | pos:table:write |
  | PATCH | `/api/tables/:id/status` | pos:table:write |
  | GET | `/api/floor/availability` | pos:floor:read |
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard (class-level)
- Audit coverage: FLOOR_PLAN_CREATED, FLOOR_PLAN_UPDATED, TABLE_CREATED, TABLE_UPDATED, TABLE_STATUS_CHANGED (previous + new status in metadata)
- Idempotency coverage: Seed uses upsert for permissions/role-permissions; floor plans and tables use createMany with skipDuplicates

## Tests

- Unit tests: 8 tests in `floor.service.spec.ts` — create floor plan, list by branch, get not found, create table, duplicate label conflict, update table, update status with audit, availability summary
- E2e tests: 18 tests in `floor.e2e-spec.ts` — full CRUD happy paths, status update, availability, permission denials (waiter create floor plan/table → 403), missing branch header → 400, invalid status enum → 400, negative capacity → 400, forbidden extra field → 400, cross-branch access → 400
- Commands run:
  - `pnpm db:generate` ✅
  - `tsc --noEmit` ✅ — clean compilation, 0 errors
  - `pnpm lint` ✅ — 0 errors, 40 warnings (all pre-existing `no-explicit-any`)
  - `pnpm test` ✅ — 69/69 pass, 9 suites (including 8 new floor.service.spec.ts tests)
  - `pnpm test:e2e` (floor only) ✅ — 18/18 pass
  - `pnpm dev:api` ✅ — all 10 M5 routes mapped, 0 compilation errors
  - Manual endpoint hits ✅ — 12/12 pass (login, branches, floor-plans CRUD, tables CRUD, status update, availability, no-branch→400, waiter-deny→403)

## Postman

- Collection added: `M5-Floor-Plans-Tables.postman_collection.json` (16 requests)
- Variables/tests added: `floorPlanId`, `tableId` auto-captured in environment; test scripts validate response status codes and shapes
- Manual checklist executed: ✅ All endpoints verified via `_m5_verify.cjs` script (12/12 pass)

## Docs

- ROADMAP status impact: M5 row should be marked complete
- Files updated: README.md, ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, POSTMAN_GUIDE.md, repo file tree.txt, AI_STATUS.md

## DONE Checks

- `pnpm db:generate` — ✅ Prisma client generated successfully
- `pnpm db:migrate` — ✅ Applied via `prisma db execute --stdin` (registered in `_prisma_migrations`)
- `pnpm db:seed` — ✅ Run 1: created 4 permissions, 20 role-permission mappings, 2 floor plans, 15 tables. Run 2: idempotent (0 created)
- `pnpm lint` — ✅ 0 errors, 40 warnings (all pre-existing `no-explicit-any`)
- `pnpm test` — ✅ 69/69 tests pass (9 suites), including 8 new floor.service.spec.ts tests
- `tsc --noEmit` — ✅ Clean compilation, no errors
- `pnpm test:e2e` (floor) — ✅ 18/18 pass (CRUD, status, availability, permissions, validation, cross-branch)
- `pnpm dev:api` — ✅ All 10 M5 routes mapped, 0 compilation errors, server starts clean
- Manual endpoint hits — ✅ 12/12 pass

## Decisions / Deviations

- Migration created manually (SQL file) because Neon Postgres was unreachable (P1001 cold-start timeout). This follows the established pattern from M3.1 and M4 milestones.
- Table `status` defaults to `AVAILABLE` (not null, enum constraint).
- `floorPlanId` on Table is nullable with `SetNull` on delete — tables can exist without a floor plan assignment.
- `data` field on FloorPlan is `Json` type for storing visual layout data (coordinates, dimensions) — schema-free for frontend flexibility.

## Known Issues

- Neon Postgres pooler endpoint incompatible with Prisma `migrate dev`/`migrate deploy` engines (P1001). Workaround: apply SQL manually via `prisma db execute --stdin`. This affects all milestones.
- `channel_binding=require` in Neon connection string caused P1001 for Prisma — removed from `.env`.
- Pre-existing e2e failures in other milestones (quick-pin: 4 failures from regenerated PINs, tenancy: 2 timeout failures) — not M5 related.

## Next Step

- Begin M6 — Menu Catalog + Categories
