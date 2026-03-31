# Completion Report — M29 General Ledger + Journal Entries + Posting Engine

## Context Snapshot

- Current milestone: M29
- Previous completed milestone: M28 — Accounting Foundation (COA + Cost Centers + Fiscal Periods)
- Next milestone: M30 — TBD

## Summary

- What was built: Double-entry General Ledger with journal entries (create, list, get, reverse), automated posting engine (replay from PostingSourceMaps, idempotent runs, error tracking), and full test coverage.
- What is now working: 8 REST endpoints under `/api/accounting` for journal CRUD + reversal + posting replay + run/error management. All backed by 4 new Prisma models with proper indexes, audit trail, and permission-based access control.

## Files Added / Changed

### Added
- `packages/db/prisma/migrations/20260402100000_m29_general_ledger_journals_posting/migration.sql`
- `apps/api/src/modules/ledger/ledger.module.ts`
- `apps/api/src/modules/ledger/ledger.service.ts`
- `apps/api/src/modules/ledger/ledger.controller.ts`
- `apps/api/src/modules/ledger/ledger.service.spec.ts`
- `apps/api/src/modules/ledger/dto/create-journal-entry.dto.ts`
- `apps/api/src/modules/ledger/dto/reverse-journal.dto.ts`
- `apps/api/src/modules/ledger/dto/replay-posting.dto.ts`
- `apps/api/src/modules/ledger/dto/list-journals-query.dto.ts`
- `apps/api/src/modules/ledger/dto/index.ts`
- `apps/api/test/ledger.e2e-spec.ts`
- `postman/collections/M29-General-Ledger-Journals-Posting-Engine.postman_collection.json`
- `docs/GL_POSTING_ENGINE_GUIDE.md`
- `ai/M29_COMPLETION_REPORT.md`

### Changed
- `packages/db/prisma/schema.prisma` — 4 enums + 4 models + relations + indexes
- `apps/api/src/app.module.ts` — LedgerModule registered
- `packages/db/prisma/seed.ts` — 6 permissions, 3 role mappings, seedLedgerData()
- `docs/ARCHITECTURE.md` — M29 section added
- `docs/MODULES.md` — M29 row added
- `docs/POSTMAN_ENDPOINT_GUIDE.md` — M29 endpoints added
- `ai/AI_STATUS.md` — M29 checklist added, status updated

## Database

- Prisma models added: JournalEntry, JournalLine, PostingRun, PostingError
- Enums added: JournalStatus, PostingRunStatus, PostingErrorStatus, JournalLineDirection
- Migration name: `20260402100000_m29_general_ledger_journals_posting`
- Indexes: orgId+branchId composite on all tables, unique journalNumber per org, unique runKey per org, unique reversedFromId/reversalOfId
- Constraints: FK to organizations, branches, users, accounts, cost_centers, fiscal_periods with ON DELETE RESTRICT for accounts
- Seed updates: 6 permissions, 3 role mappings (Owner/Manager/Accountant), 3 demo items (opening balance journal, succeeded posting run, failed posting run with error)
- Notes: All tables use snake_case via @@map/@map directives. Money fields use Decimal(10,2). journalDate uses @db.Date.

## API

- Modules added: LedgerModule (controller + service)
- Endpoints added: 8 (POST/GET journals, GET journals/:id, POST journals/:id/reverse, POST posting/replay, GET posting-runs, GET posting-errors, GET posting-errors/:id)
- Guards applied: JwtAuthGuard + PermissionGuard + BranchContextGuard on all endpoints
- Audit coverage: JOURNAL_CREATED, JOURNAL_REVERSED, POSTING_RUN_CREATED, POSTING_ERROR_RECORDED
- Idempotency coverage: PostingRun.runKey ensures replay idempotency; seed uses findUnique/findFirst before create

## Tests

- Unit tests: 24 passing in ledger.service.spec.ts (createJournal balanced/unbalanced/negative/missing-account/missing-costcenter/closed-period, listJournals pagination/status/daterange, getJournal found/notfound, reverseJournal success/already-reversed/draft/existing-reversal/notfound, replayPosting success/idempotent/source-map-not-found, listPostingRuns, listPostingErrors/status-filter, getPostingError found/notfound)
- E2e tests: 26 passing in ledger.e2e-spec.ts
- Commands run: `npx jest --testPathPattern=ledger.service.spec`, `npx jest --config test/jest-e2e.json --testPathPattern=ledger`
- Results: All 24 unit + 26 e2e = 50 tests passing

## Postman

- Collection added: `M29-General-Ledger-Journals-Posting-Engine.postman_collection.json`
- Variables/tests added: journalId, journalNumber, reversalJournalId, postingRunId, postingErrorId captured via pm.environment.set
- Requests: 16 total (2 auth + 8 journal + 6 posting) with pm.test assertions

## Docs

- ROADMAP status impact: M29 now complete in status tracker
- Files updated: ARCHITECTURE.md (M29 section), MODULES.md (M29 row), POSTMAN_ENDPOINT_GUIDE.md (M29 endpoints), AI_STATUS.md (M29 checklist + status)
- Files created: GL_POSTING_ENGINE_GUIDE.md, M29_COMPLETION_REPORT.md

## DONE Checks

- `prisma generate`: ✅
- `prisma migrate deploy`: ✅ (35 migrations, M1-M29)
- `prisma db seed`: ✅ (M29 data created, idempotent on re-run)
- `jest ledger.service.spec`: ✅ 24/24 tests pass
- `jest ledger.e2e-spec`: ✅ 26/26 tests pass

## Decisions / Deviations

- Journals are auto-POSTED on creation (DRAFT status reserved for future use)
- PostingRun.runKey = combination of orgId + sourceKey + sourceDocumentId (deterministic)
- PostingError.postingRunId is nullable to allow orphan error records
- JournalLine includes updatedAt and organization relation for audit completeness

## Known Issues

- Neon Postgres P1001 suspensions during long-running operations (standard workaround: wake with SELECT 1)
- E2e tests take ~207s due to Neon cold start latency

## Next Step

- M30 — TBD (next milestone in roadmap sequence)
- M13.1 (MTN Native) = PENDING
- M13.2 (Airtel Native) = PENDING
