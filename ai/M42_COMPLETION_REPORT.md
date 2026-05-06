# Completion Report — M42: Feature Flags + Maintenance Windows + Training Mode

## Context Snapshot

- Current milestone: **M42 — Feature Flags + Maintenance Windows + Training Mode**
- Previous completed milestone: **M41 — Reliability Layer (Idempotency + Offline Contracts + Sync)**
- Next milestone: **M43+ from ROADMAP**

## Summary

- What was built:
  - A new `ControlPlaneModule` exposing feature flags, maintenance windows, training sessions, and a flag-audit trail; plus a small `ControlPlaneService` facade that any other write surface can call without coupling to the M42 schema.
  - Inventory write surface (`POST /api/inventory/adjustments`) wired through the facade as the first integration target — proves both block-on-maintenance and short-circuit-on-training behaviours end-to-end.
  - 4 new Prisma models + 7 enums, one new migration applied to Neon, and an idempotent seed function that ships a usable default flag set, one announcement-only maintenance window, one historical training session, and one audit row.
- What is now working:
  - Owners can list / create / patch flags (BRANCH > ORG > GLOBAL precedence) and read the audit trail.
  - Owners can schedule maintenance windows and toggle them ACTIVE; an ACTIVE `BLOCK_WRITES` window covering `INVENTORY_WRITES` makes `POST /api/inventory/adjustments` return `409 MAINTENANCE_WINDOW_ACTIVE`. Patching the window to `COMPLETED` restores writes.
  - Any actor can opt themselves into training by sending `x-training-session-id: <id>` on a guarded write; the inventory adjustment short-circuits with `{ inTraining: true, simulated: true, ... }` and persists no real domain rows. Sessions are time-bounded; expired sessions auto-transition to `EXPIRED` and stop short-circuiting.
  - Every flag mutation, window state change, blocked write, and training short-circuit writes a `FlagAudit` row.
  - Chef token (`pos:order:write`-only role) is rejected at the guard layer for all `flags:*` and write-side control-plane endpoints.

## Files Added / Changed

- `packages/db/prisma/schema.prisma` — header comment block updated; Organization gains `featureFlags`, `maintenanceWindows`, `trainingSessions`, `flagAudits` back-relations; Branch gains `featureFlags`, `maintenanceWindows`, `trainingSessions`; appended 7 enums + 4 models at end of file (`FeatureFlag`, `MaintenanceWindow`, `TrainingSession`, `FlagAudit`).
- `packages/db/prisma/migrations/20260429000000_m42_feature_flags_maintenance_training/migration.sql` — new migration: 8 `CREATE TYPE`, 4 `CREATE TABLE`, ~16 indexes / unique constraints. Applied via `prisma db execute --file` then resolved with `prisma migrate resolve --applied` (the M40/M41 Neon-friendly pattern).
- `packages/db/prisma/seed.ts` — added 8 M42 permissions to `PERMISSIONS_DATA`; updated `ROLE_PERM_MATRIX` for Owner (8) / Manager (5) / Accountant (3); added `seedControlPlaneData()` (5 flags, 1 window, 1 training session, 1 audit row); wired as runner step 47; added `m42-control-plane` `SeedHistory` marker.
- `apps/api/src/app.module.ts` — registered `ControlPlaneModule` after `ReliabilityModule`.
- `apps/api/src/modules/controlplane/controlplane.module.ts` — declares + exports facade and 4 specialised services.
- `apps/api/src/modules/controlplane/controlplane.controller.ts` — all M42 endpoints (`/flags`, `/flags/audit`, `/flags/:key`, `/maintenance-windows`, `/maintenance-windows/:id`, `/training/start`, `/training/:id/end`, `/training/sessions`).
- `apps/api/src/modules/controlplane/controlplane.service.ts` — facade with `assertWriteAllowed` (throws 409 + audits) and `checkTrainingMode` (returns short-circuit + audits).
- `apps/api/src/modules/controlplane/feature-flag.service.ts` — `list / getByKey / create / patchByKey / isEnabled`; isEnabled honours BRANCH > ORG > GLOBAL precedence + `rolloutPercent` ceiling.
- `apps/api/src/modules/controlplane/maintenance-window.service.ts` — `list / get / create / patch / findBlockingWindow`; emits `MAINTENANCE_WINDOW_ACTIVATED` / `_DEACTIVATED` audits on transitions.
- `apps/api/src/modules/controlplane/training-session.service.ts` — `list / start / end / findActiveForActor`; max 1 ACTIVE session per actor; auto-EXPIRES past-deadline rows.
- `apps/api/src/modules/controlplane/flag-audit.service.ts` — `log()` writes to `flagAudit`; `list()` filters by `flagId`, `maintenanceWindowId`, `trainingSessionId`, `action`, `limit`.
- `apps/api/src/modules/controlplane/dto/index.ts` — string-union arrays + 10 class-validator DTOs.
- `apps/api/src/modules/inventory/inventory.module.ts` — imports `ControlPlaneModule`.
- `apps/api/src/modules/inventory/inventory.service.ts` — constructor takes `controlPlane: ControlPlaneService`; `RequestMeta` adds `trainingSessionId?: string | null`; `createStockAdjustment` calls `assertWriteAllowed(...)` first and `checkTrainingMode(...)` second; returns simulated payload (no batch / no adjustment / no audit) when in training.
- `apps/api/src/modules/inventory/inventory.controller.ts` — reads `x-training-session-id` header and forwards into `meta.trainingSessionId`.
- `apps/api/src/modules/inventory/inventory.service.spec.ts` — adds `ControlPlaneService` mock + provider entry; existing `result.id` assertion narrowed to handle the new union return type.
- `apps/api/test/control-plane.e2e-spec.ts` — new 11-case e2e suite.
- `postman/collections/M42-Feature-Flags-Maintenance-Training.postman_collection.json` — new collection (7 folders).
- `ai/AI_STATUS.md` — new M42 LIVE entry; counters bumped (47 migrations, 48 collections, 52 reports).
- `ai/M42_COMPLETION_REPORT.md` — this file.
- `repo file tree.txt` — refreshed.

## Database

- Prisma models added/changed:
  - `FeatureFlag` — `(orgId, branchId, key)` style usage; unique `(orgId, branchId, key)` indexed; status / scope / rolloutPercent.
  - `MaintenanceWindow` — `@@unique([orgId, code])`; index `(orgId, status, startsAt)`, `(branchId, status)`, `(status, startsAt, endsAt)`.
  - `TrainingSession` — `(orgId, actorUserId, status)`; nullable `branchId`; `expiresAt` enforced.
  - `FlagAudit` — links to flag / window / training session by nullable FKs; indexed by `(orgId, createdAt)` and `(action, createdAt)`.
  - `Organization` and `Branch` gained back-relations for the four new models.
- Migration name: `20260429000000_m42_feature_flags_maintenance_training`.
- Indexes / constraints:
  - `FeatureFlag` — unique `(orgId, branchId, key)`; indexes on `(orgId, status)`, `(scope)`.
  - `MaintenanceWindow` — `@@unique([orgId, code])`; indexes on `(orgId, status, startsAt)`, `(branchId, status)`, `(status, startsAt, endsAt)`.
  - `TrainingSession` — indexes on `(actorUserId, status)`, `(orgId, status, expiresAt)`.
  - `FlagAudit` — indexes on `(orgId, createdAt)`, `(flagId)`, `(maintenanceWindowId)`, `(trainingSessionId)`, `(action, createdAt)`.
- Seed updates: 8 new permissions, role assignments, `seedControlPlaneData()` (5 flags + 1 window + 1 training session + 1 audit row), `SeedHistory` marker.
- Notes: Migration created as raw SQL (matches the M40/M41 Neon pattern). Schema file required a one-time UTF-8 byte fix (PowerShell heredoc had emitted em-dashes as 0x97 instead of 0xE2 0x80 0x94).

## API

- Modules added/changed: `ControlPlaneModule` (new), `AppModule`, `InventoryModule`, `InventoryController`, `InventoryService`.
- Endpoints added/updated:
  - `GET /api/flags`, `POST /api/flags`, `GET /api/flags/:key`, `PATCH /api/flags/:key`, `GET /api/flags/audit`
  - `GET /api/maintenance-windows`, `POST /api/maintenance-windows`, `GET /api/maintenance-windows/:id`, `PATCH /api/maintenance-windows/:id`
  - `POST /api/training/start`, `POST /api/training/:id/end`, `GET /api/training/sessions`
  - `POST /api/inventory/adjustments` — now respects maintenance windows + training mode (header: `x-training-session-id`).
- Guards applied: `JwtAuthGuard`, `PermissionGuard` (`@Permissions(...)`), and the existing `BranchContextGuard` for inventory.
- Audit coverage: every flag mutation (`FLAG_CREATED` / `FLAG_ENABLED` / `FLAG_DISABLED` / `FLAG_UPDATED`), every maintenance-window state change (`MAINTENANCE_WINDOW_CREATED` / `_UPDATED` / `_ACTIVATED` / `_DEACTIVATED`), every training session lifecycle event (`TRAINING_SESSION_STARTED` / `_ENDED`), every blocked write (`WRITE_BLOCKED_BY_MAINTENANCE`), every training short-circuit (`REAL_POST_BLOCKED_BY_TRAINING`).
- Idempotency coverage: control-plane mutations are not high-frequency and do not require external idempotency keys; the M41 layer remains the channel for offline-replay scenarios.

## Tests

- Unit tests: `apps/api/src/modules/inventory/inventory.service.spec.ts` (17 / 17 pass after adding the `ControlPlaneService` mock).
- e2e tests: `apps/api/test/control-plane.e2e-spec.ts` (11 / 11 pass) — covers list / create+audit / patch+audit / chef 403 read / chef 403 write / window create / window ACTIVE blocks 409 / window COMPLETED unblocks 201 / training start + concurrent 403 / training short-circuit + zero-row count assertion / training end.
- Commands run:
  - `npx prisma validate`
  - `npx prisma db execute --file ...migration.sql`
  - `npx prisma migrate resolve --applied 20260429000000_m42_feature_flags_maintenance_training`
  - `npx prisma generate`
  - `npx prisma db seed` (twice — second run reports `Created: 0, Skipped: 8` for the M42 block)
  - `npx jest src/modules/inventory/inventory.service.spec.ts` (17 / 17)
  - `npx jest --config test/jest-e2e.json control-plane` (11 / 11)
- Results: all green.

## Postman

- Collection added: `postman/collections/M42-Feature-Flags-Maintenance-Training.postman_collection.json`.
- Variables added: `flagKey`, `flagId`, `windowCode`, `windowId`, `windowStartsAt`, `windowEndsAt`, `trainingSessionId`, `inventoryItemId` (auto-resolved by collection-level pre-request, R17 list-first).
- Tests added: 18 requests across 7 folders — every assertion is a `pm.test`. Folder C proves the 409 path; folder E proves the simulated-only short-circuit.
- Manual checklist: each folder is `[STANDALONE]`-resilient — opening a fresh Postman window and running any folder runs the canonical pre-request chain (auto-login → /auth/me → ensure inventory item → seed flag/window IDs).

## Docs

- ROADMAP status impact: M42 is now LIVE; M43+ remains the next target.
- Files updated:
  - `ai/AI_STATUS.md` (new M42 entry, counters)
  - `ai/M42_COMPLETION_REPORT.md` (this file)
  - `repo file tree.txt`

## DONE Checks

- `pnpm lint` — not re-run; the only edits were typed Nest modules + Postman JSON + Markdown.
- `pnpm test` — `npx jest src/modules/inventory/inventory.service.spec.ts` ✅ 17 / 17; full suite has pre-existing AR test failures unrelated to M42.
- `pnpm db:migrate` — used `prisma db execute --file` + `prisma migrate resolve --applied` (Neon-friendly, matches M40/M41 pattern).
- `pnpm db:seed` — first run created the 8 M42 rows; second run is fully idempotent.
- Local run command: `npx jest --config test/jest-e2e.json control-plane` ✅ 11 / 11.

## Decisions / Deviations

- The seeded `m42-seed-quarterly-maintenance` window is `SCHEDULED` + `ANNOUNCEMENT_ONLY` so that no existing test starts failing because of an unintended block. The "block writes" path is exercised exclusively by tests that opt in by patching their own window to `ACTIVE`.
- Training mode is opt-in **per request** via the `x-training-session-id` header rather than a server-side toggle on the user. This keeps the locked rule "training never persists real rows" trivial to enforce: any caller that does not present the header behaves identically to today.
- Inventory is the single integration target in this milestone. Other write surfaces (billing, AP, AR, payments, public booking) are wire-ready — they only need to inject `ControlPlaneService` and call the same two helpers — but were left untouched here to keep the diff bounded.
- The M42 migration was applied with `prisma db execute --file` because the Neon connection rejects baseline diffs; this matches the proven M40/M41 path. After execution it was resolved with `prisma migrate resolve --applied`.

## Known Issues

- None for M42. The `accounts-receivable.service.spec.ts` TS errors observed during typecheck were pre-existing (M35) and unrelated to this milestone.

## Next Step

- Adopt the `ControlPlaneService` facade in the next high-impact write surface (likely `BillingService` or `PaymentsService`) so that maintenance windows can pause owner SaaS subscription charges or public-checkout submission attempts on demand. Continue per-milestone integration rather than a single sweeping change.
