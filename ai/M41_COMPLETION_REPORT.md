# Completion Report — M41 — Reliability Layer (Idempotency + Offline Contracts + Sync)

## Context Snapshot

- Current milestone: **M41 — Reliability Layer (Idempotency + Offline Contracts + Sync)**
- Previous completed milestone: **M40 — Alerts + Digests + Real-Time Owner Views**
- Next milestone: **M42+ from ROADMAP** (no hotel/property-group milestone planned)

## Summary

- What was built: A generic, reusable reliability primitive in the API. Three
  decoupled services — `IdempotencyService` (key store), `ReplayDispatcherService`
  (type-keyed handler registry), and `SyncService` (queue + replay + conflicts) —
  plus a `ReliabilityController` exposing `POST /sync/replay`, `GET /sync/jobs`,
  `GET /sync/jobs/:id`, `POST /sync/jobs/:id/retry`, `GET /sync/conflicts`,
  `PATCH /sync/conflicts/:id/resolve`, and `POST /idempotency/inspect`.
- What is now working:
  - Offline-captured write intents can be replayed in batches with
    `(orgId, clientMutationId)` server-side dedup.
  - Idempotency keys are scoped, fingerprinted, and produce the four canonical
    outcomes (`first` / `replay` / `conflict` / `in_flight`).
  - Replay handlers can be registered per `SyncJobType`. The built-in
    `GENERIC_REPLAY` echo handler keeps unknown / future types observable.
  - Conflicts are persisted with `clientPayload` vs `serverState`, resolvable
    by an authorized human, and audited.
  - Retry refuses to re-run a job already SUCCEEDED (409).
  - Owner / Manager / Accountant role permissions are seeded.

## Files Added / Changed

- `packages/db/prisma/schema.prisma` — added `IdempotencyKey`, `SyncJob`,
  `SyncJobAttempt`, `SyncConflict` models + 7 enums + relations on
  `Organization` and `Branch`.
- `packages/db/prisma/migrations/20260428000000_m41_reliability_layer/migration.sql` — new.
- `packages/db/prisma/seed.ts` — added M41 permissions to `PERMISSIONS_DATA`,
  Owner/Manager/Accountant arrays, and `seedReliabilityData()` + main runner
  wiring + `m41-reliability-layer` SeedHistory marker.
- `apps/api/src/modules/reliability/dto/index.ts` — new.
- `apps/api/src/modules/reliability/idempotency.service.ts` — new.
- `apps/api/src/modules/reliability/replay-dispatcher.service.ts` — new.
- `apps/api/src/modules/reliability/sync.service.ts` — new.
- `apps/api/src/modules/reliability/reliability.controller.ts` — new.
- `apps/api/src/modules/reliability/reliability.module.ts` — new.
- `apps/api/src/app.module.ts` — registered `ReliabilityModule`.
- `apps/api/test/sync.e2e-spec.ts` — new.
- `postman/collections/M41-Reliability-Idempotency-Offline-Sync.postman_collection.json` — new.
- `docs/SYNC_CONTRACT.md` — new.
- `ai/AI_STATUS.md` — updated to reflect M41 LIVE.
- `ai/M41_COMPLETION_REPORT.md` — this file.
- `repo file tree.txt` — updated.

## Database

- Prisma models added: `IdempotencyKey`, `SyncJob`, `SyncJobAttempt`,
  `SyncConflict`.
- Enums added: `IdempotencyStatus`, `SyncJobType` (14 values),
  `SyncJobStatus`, `SyncJobOrigin`, `SyncConflictStatus`,
  `SyncConflictResolution`, `RetryDisposition`.
- Migration name: `20260428000000_m41_reliability_layer`.
- Indexes / constraints:
  - `IdempotencyKey @@unique([scope, key, routeMethod, routePath])` and indexes
    on `(orgId, actorUserId, routePath)`, `(status, createdAt)`, `expiresAt`.
  - `SyncJob @@unique([orgId, clientMutationId])` and indexes on
    `(orgId, status, type, createdAt)`, `(orgId, branchId, status)`,
    `(status, nextRetryAt)`, `type`.
  - `SyncJobAttempt @@unique([jobId, attemptNo])`.
  - `SyncConflict` indexes on `(orgId, status, createdAt)`, `(orgId, jobId)`,
    `type`.
  - 4 FK constraints (jobs → org/branch/user; attempts → job; conflicts →
    org/job/user).
- Seed updates: 6 new permissions, role-permission rows for Owner / Manager /
  Accountant, and 1 `IdempotencyKey` + 3 `SyncJob` + 1 `SyncConflict` demo rows.
- Notes: Migration applied via direct `prisma db execute` followed by
  `prisma migrate resolve --applied` (drift on early migrations prevents
  `migrate dev` — pattern established by M40 correction patch).

## API

- Modules added: `ReliabilityModule` registered in `AppModule` after `AlertsModule`.
- Endpoints added (all `/api/...`):
  - `POST /sync/replay` (`sync:jobs:write`)
  - `GET /sync/jobs` (`sync:jobs:read`)
  - `GET /sync/jobs/:id` (`sync:jobs:read`)
  - `POST /sync/jobs/:id/retry` (`sync:jobs:retry`) — 409 on already-SUCCEEDED
  - `GET /sync/conflicts` (`sync:conflicts:read`)
  - `PATCH /sync/conflicts/:id/resolve` (`sync:conflicts:resolve`)
  - `POST /idempotency/inspect` (`idempotency:inspect`)
- Guards applied: `JwtAuthGuard`, `PermissionGuard` on every route.
- Audit coverage: `SYNC_REPLAY_SUBMITTED`, `SYNC_JOB_SUCCEEDED`,
  `SYNC_JOB_RETRIED`, `SYNC_CONFLICT_CREATED`, `SYNC_CONFLICT_RESOLVED`.
- Idempotency coverage: `IdempotencyService` is reusable from any controller.
  M41 itself dedups replay batches via `(orgId, clientMutationId)` on
  `SyncJob`. Wiring per-endpoint Idempotency-Key headers (e.g. on
  `POST /payments/intents`) is intentionally left to each owning module so
  M41 doesn't churn unrelated surfaces — the primitive is ready, see
  `docs/SYNC_CONTRACT.md` §6.

## Tests

- e2e: `apps/api/test/sync.e2e-spec.ts` — 8 tests, 8 pass.
- Commands run:
  ```powershell
  cd apps\api
  npx jest --config test/jest-e2e.json test/sync.e2e-spec.ts
  ```
- Results: `Test Suites: 1 passed, 1 total / Tests: 8 passed, 8 total` in 148s.

## Postman

- Collection added: `postman/collections/M41-Reliability-Idempotency-Offline-Sync.postman_collection.json`.
- Folders: 00 Read Me, A. Auth & Context, B. Idempotent Write Contract Demo,
  C. Sync Replay, D. Sync Jobs, E. Retry, F. Conflicts. All [STANDALONE].
- Variables auto-resolved by collection-level prereq: `accessToken`,
  `orgId`, `branchId`, `clientMutationId`, `idempotencyKey`. Folder-level
  prereqs in D/E/F auto-resolve `syncJobId` / `succeededJobId` / `conflictId`
  via list-first lookups (R17).
- newman result: **17 requests, 23 assertions, 0 failures** (1m 7.6s).

## Docs

- ROADMAP status impact: M41 marked complete; M42+ is the next entry.
- Files updated: `ai/AI_STATUS.md`, new `docs/SYNC_CONTRACT.md`, this report,
  `repo file tree.txt`.

## DONE Checks

- `pnpm lint` — not run as a global check this milestone (no lint config
  changes; per-file errors via `get_errors` were 0 across all M41 sources).
- `pnpm test` — focused: `npx jest test/sync.e2e-spec.ts` → 8/8 pass.
- `pnpm db:migrate` — applied via `prisma db execute` + `prisma migrate resolve --applied 20260428000000_m41_reliability_layer`.
- `pnpm db:seed` — first run created M41 permissions and seedReliabilityData
  rows successfully; second run is idempotent for M41 (Neon connection-pool
  timeouts in unrelated early sections are a pre-existing environmental
  issue documented under M3.1).
- API smoke: `pnpm dev:api` → all 7 M41 routes mapped under `ReliabilityController`.

## Decisions / Deviations

- **No per-endpoint `Idempotency-Key` retrofit in this milestone.** The
  reusable primitive is shipped; rolling it out to `POST /payments/intents`,
  `POST /ar/receipts`, etc. is a follow-up that should ship with each owning
  module's next change so M41 doesn't churn unrelated test surfaces.
- **`PAYMENT_CAPTURE` handler not registered for the public-diner path** —
  honors the locked rule that public-diner mobile-money execution stays
  PENDING until the MTN / Airtel native milestones land.
- **No hotel / property-group milestone introduced.** Confirmed.
- **Seed retry under Neon pool pressure** — pre-existing issue in
  `seedQuickPins` / `seedPermissions` that surfaces as `P2024` on the second
  invocation in the same minute. Not caused by M41; documented for visibility.

## Known Issues

- The replay dispatcher only ships with a `GENERIC_REPLAY` handler. All
  RESERVED `SyncJobType` values fall through to the generic echo with
  `RETRYABLE` disposition. Owning modules will register real handlers in
  later milestones. This is intentional and contractually documented.
- Background sweeper for expired `IdempotencyKey` rows is not implemented
  (cron is a future concern).

## Next Step

- Continue with **M42+** per ROADMAP. Where a future milestone owns a write
  surface that benefits from offline replay, register a handler via
  `ReplayDispatcherService.register()` and (optionally) wire an
  `Idempotency-Key` header path through `IdempotencyService.wrap()` from
  inside that module's service.
