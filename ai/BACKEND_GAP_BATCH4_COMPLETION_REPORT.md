# Backend Gap Batch 4 — PERMS-2 · C-25 · C-26 · C-27 · B5.4-D1 · B5.5-F1 — Completion Report

**Date:** 2026-08-21 → 2026-08-22
**Type:** Backend + schema (one new migration) + seed + docs. **No frontend file touched** — the
Manager accounting UI is unchanged and still renders zero write affordances. That is now a
deliberate build-order gate (Track **B5.7**, not started), not a permission gate.
**Status:** **COMPLETE.**

---

## 0. Precondition

`git log -1` showed `375f38d` ("feat(manager): B5.5 accounting closing surfaces") at `HEAD` on
`main`; `git status` was clean. Confirmed before any work began.

---

## 1. PERMS-2 — Manager full accounting/procurement permission set

### Decision

The owner decided: **the Manager role has full access to everything it is responsible for.** This
reverses the 2026-08-20 C-21 cutover's OD-9 read-only resolution for Manager (documented in
`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`), which had granted Manager only 15 read strings while
Owner and Accountant received the full 36.

### What changed

`packages/db/prisma/seed.ts`, `ROLE_PERM_MATRIX.Manager`:

- The C-21 spread changed from `...C21_ACCOUNTING_FINANCE_MANAGER_READ` (15 strings) to
  `...C21_ACCOUNTING_FINANCE_ALL` (36 strings) — now identical to Accountant's grant.
- The M28/M29 block was widened from Manager's previous partial set (`accounts:read/create`,
  `cost-centers:read/create`, `periods:read/create`, `posting-source-maps:read`, `tax-config:read`,
  `journals:read`, `posting-runs:read`, `posting-errors:read` — 11 strings, no `open`/`update`/
  `create`/`reverse`/`replay`) to the full M28/M29 set (`periods:open`,
  `posting-source-maps:update`, `tax-config:update`, `journals:create`, `journals:reverse`,
  `posting:replay` added) plus the new `posting-errors:resolve` (see §5) — 18 strings total.
- `C21_ACCOUNTING_FINANCE_MANAGER_READ` (the old 15-string constant) is **retained in the file** as
  a historical record, with a doc-comment stating it is no longer referenced by any role and should
  not be reintroduced without a fresh, explicit owner decision.
- The `pos:accounting:posting-errors:resolve` permission (new, §5) was also added to Owner's and
  Accountant's M29 blocks, and to the `PERMISSIONS_DATA` catalog.

### The exact list of permission strings granted to Manager (54 total)

**M28/M29 (18):**
`pos:accounting:accounts:read`, `:accounts:create`, `:cost-centers:read`, `:cost-centers:create`,
`:periods:read`, `:periods:create`, `:periods:open`, `:posting-source-maps:read`,
`:posting-source-maps:update`, `:tax-config:read`, `:tax-config:update`, `:journals:read`,
`:journals:create`, `:journals:reverse`, `:posting:replay`, `:posting-runs:read`,
`:posting-errors:read`, `:posting-errors:resolve`

**C-21 cutover, `C21_ACCOUNTING_FINANCE_ALL` (36):**
- AP (10): `accounting:ap:bill:read`, `:bill:write`, `:bill:approve`, `:payment:write`,
  `:credit-note:read`, `:credit-note:write`, `:recurring:read`, `:recurring:write`,
  `:reminder:read`, `:reminder:write`
- AR (8): `accounting:ar:account:read`, `:account:write`, `:invoice:read`, `:invoice:write`,
  `:receipt:write`, `:credit-note:read`, `:credit-note:write`, `:aging:read`
- Bank + period close (11): `pos:accounting:bank-accounts:read`, `:bank-accounts:create`,
  `:bank-statements:read`, `:bank-statements:import`, `:bank-entry:create`,
  `:reconciliation:read`, `:reconciliation:create`, `:reconciliation:match`,
  `:period-close-runs:read`, `:periods:close`, `:periods:lock`
- Budgets/forecast/procurement (7): `finance:budget:read`, `:budget:write`, `:budget:update-actuals`,
  `:demand-calendar:read`, `:demand-calendar:write`, `franchise:forecast:read`,
  `procurement:advisory:read`

18 + 36 = **54**, matching the live-queried count on the isolated stack exactly (see §7).

### `pos:hr:compensation:read` — confirmed NOT granted

Live-queried on the isolated stack after seeding:

```
Accountant | pos:hr:compensation:read
Owner      | pos:hr:compensation:read
```

Manager does **not** appear in that result. No seed change touched this permission; FU-1 (the
2026-08-20 revocation) is untouched and still in force.

### Waiter / Cashier / Supervisor — confirmed zero accounting/finance/procurement grants

Live-queried on the isolated stack (also checked Chef, Bartender, Procurement, Stock Manager, Event
Manager): **zero rows** for any `accounting:%`, `pos:accounting:%`, `finance:%`,
`franchise:forecast:read` or `procurement:advisory:read` string against any of Supervisor, Cashier,
Waiter, Chef, Bartender, Procurement, Stock Manager or Event Manager. No seed edit touched any of
these roles' blocks.

### Idempotence

Seed run twice on a fresh isolated database:
- Run 1: `Permission`/`RolePermission` rows created as expected (permission catalog + role
  mappings), 0 errors.
- Run 2: Manager/Owner/Accountant accounting+finance permission-row counts unchanged at
  **54/54/54**; the seed's own idempotence machinery (`findUnique`-then-create for permissions,
  in-memory dedup + `skipDuplicates: true` for role-permissions) reported 0 net new
  accounting/finance rows. The ~65 "created" lines on the second run are all pre-existing,
  unrelated menu/serving/modifier price-refresh lines (an always-upsert pattern that predates this
  batch and is unrelated to permissions).

---

## 2. C-25 — `getJournal` had no branch predicate

### Before

```ts
async getJournal(params: { orgId: string; journalId: string }) {
  const journal = await this.prisma.journalEntry.findFirst({
    where: { id: params.journalId, orgId: params.orgId },
    ...
```

No branch predicate at all — a journal id from one branch's list stayed readable by the same id
under a different branch's header.

### After

```ts
async getJournal(params: { orgId: string; branchId?: string; journalId: string }) {
  const journal = await this.prisma.journalEntry.findFirst({
    where: {
      id: params.journalId,
      orgId: params.orgId,
      ...branchOrOrgScope(params.branchId, 'journal entry'),
    },
    ...
```

`branchOrOrgScope` (the same helper `listPostingErrors`/`getPostingError` already used) produces
`OR: [{branchId}, {branchId: null}]` — correct for the nullable `JournalEntry.branchId` column, and
fails closed (`MissingBranchScopeError`) if no branch is resolved. `LedgerController.getJournal` now
passes `ctx.branchId`.

### BGB3-L3 fixed in the same pass

`listJournals` and `listPostingRuns` used strict `where.branchId = branchId` (or omitted the filter
entirely when `branchId` was falsy) on the same nullable columns — the exact defect class already
fixed on `listPostingErrors`, called out in CLAUDE.md as still open (BGB3-L3). Both now use
`branchOrOrgScope` identically.

### Checked immediate neighbours for the same omission

Every other read in `ledger.service.ts` (`listPostingErrors`, `getPostingError`) already used
`branchOrOrgScope` from the batch-3 fix — no further instances found. `nextJournalNumber` and the
account/cost-center/fiscal-period lookups inside `createJournal` are intentionally `orgId`-only
(they resolve org-wide sequences and org-level reference data, not branch-scoped records), so they
were left unchanged.

### Live proof

New `describe('journals — C-25: ...')` block in `accounting-branch-scoping.e2e-spec.ts`: a journal
created in branch A is listed under branch A, absent from branch B's list, resolves 200 under branch
A's detail route, and **404s** under branch B's — proven live against the isolated stack, not
mocked.

---

## 3. C-26 — ledger audit events never stamped `metadata.branchId`

### Before → after (all 6 original call sites)

| Event | Before | After |
| --- | --- | --- |
| `JOURNAL_CREATED` | no `branchId` key | `branchId: branchId \|\| null` |
| `JOURNAL_REVERSED` | no `branchId` key | `branchId: original.branchId` |
| `POSTING_RUN_STARTED` | no `branchId` key | `branchId: branchId \|\| null` |
| `POSTING_RUN_FINISHED` (success) | no `branchId` key | `branchId: branchId \|\| null` |
| `POSTING_ERROR_CREATED` | no `branchId` key | `branchId: branchId \|\| null` |
| `POSTING_RUN_FINISHED` (failure) | no `branchId` key | `branchId: branchId \|\| null` |

`branchId` was already in local scope at every one of the six call sites (either a service
parameter or the fetched entity's own column) — this was a pure omission, not a missing-data
problem.

### Why this matters

`audit-timeline.service.ts` (fixed in backend gap batch 3, B5-F4) unconditionally ANDs
`metadata.branchId = X-Branch-Id` on the default read. Any `AuditLog` row whose `metadata` lacked a
`branchId` key could never match that filter — the six ledger events were structurally invisible to
every branch's audit trail, forever, regardless of how many rows existed.

### Live proof

New `describe('C-26 — ledger audit events carry metadata.branchId')` in
`accounting-branch-scoping.e2e-spec.ts`: creates a journal, reads back the resulting `AuditLog` row
directly via Prisma, asserts `metadata.branchId === branchA`, and then calls
`GET /api/audit/timeline` under branch A and asserts the same audit row id is now present in the
response — proving the event is genuinely reachable through the branch-scoped rail, not just that
the metadata key exists.

### Historical rows still missing `branchId`

**Not measurable, and stated precisely rather than guessed:**

- This batch never connects to or reads from shared Neon (per the standing rules), so the
  production count cannot be measured from this environment.
- On this batch's own isolated QA database (fresh Docker Postgres, seeded, then `db:demo:import`
  run), the demo-import script creates its 59 journal entries via **raw `prisma.journalEntry.create`/
  `upsertWithWhere` calls that bypass `LedgerService` entirely** (confirmed by reading
  `packages/db/prisma/demo-import.ts:1646-1662`) — it never calls `audit.log` at all for journals.
  So the isolated database had **zero** pre-existing ledger `AuditLog` rows to begin with, of any
  shape; every ledger `AuditLog` row present in that database was created by this batch's own e2e
  tests, all of which run the fixed code and therefore already carry `branchId`.
- Every prior B5 phase's own fixture creation also happened on isolated, disposable stacks (per
  their own completion reports), so no persistent Nimbus environment this team controls has
  accumulated a body of pre-fix ledger audit history to count.
- **Conclusion: 0 rows lacking `branchId` were found anywhere this batch could observe.** No
  backfill was attempted or needed in the environments this batch could reach; whether shared Neon
  carries any such rows remains genuinely unknown and is explicitly out of this batch's scope to
  determine.

---

## 4. C-27 — legitimising the pre-existing `periods:create` grant, and correcting the record

### a) Legitimised

The pre-existing M28-era grant (`pos:accounting:periods:create`, `accounts:create`,
`cost-centers:create`) is now **explicit and commented** in `seed.ts` rather than an accident — see
the doc-comment added directly above Manager's M28 block (§1). Under PERMS-2 this grant, plus the
newly-added `periods:open`/`periods:close`/`periods:lock`, is deliberate and correct.

Live e2e proof (`describe('PERMS-2 — Manager holds full accounting read+write')`):
- `POST /accounting/periods` as Manager → **201**, with a resolvable `FISCAL_PERIOD_CREATED`
  `AuditLog` row (`entityType: 'FiscalPeriod'`, `actorUserId` set).
- `PATCH /accounting/periods/:id/open` → **200** (previously 403).
- `PATCH /accounting/periods/:id/close` → **200** (previously 403).
- `PATCH /accounting/periods/:id/lock` → **200** (previously 403).
- A further test confirms Manager can also create a journal, reverse it, and (§5) resolve a posting
  error — all previously 403, all now 200/201.

Each of open/close/lock already emitted its own audit event via the pre-existing
`accounting.service.ts` (`FISCAL_PERIOD_CREATED`/`FISCAL_PERIOD_OPENED`) and
`bank-rec.service.ts` (`closeFiscalPeriod`/`lockFiscalPeriod`) audit calls — no new audit-emission
code was needed for these three actions; PERMS-2 only changed who is allowed to call them.

### b) Correcting the record

Grepped the repo for every occurrence of the "Manager performs zero accounting writes" /
"READ-ONLY BY PERMISSION" claim. Scope of correction:

- **CLAUDE.md**: a new top milestone entry (§10) documents this batch; a correction banner was
  added at the top of §12 ("Do NOT") explaining that every "zero writes"/"READ-ONLY BY PERMISSION"
  claim in the Track B5.1–B5.5 boundary paragraphs below described state *as it existed when each
  phase shipped*, and no longer describes current permission state — while explicitly preserving
  the **frontend** no-write-affordance rule (still in force, now a build-order gate pending Track
  B5.7). Three further inline corrections were made: the §9 role table's Manager cell, the
  "permissions cutover is complete" bullet's "Do not grant Manager any accounting WRITE" language
  (struck through with a superseding note), and the "B5 boundaries set by B0" bullet's "Manager
  still holds NO accounting write" line (struck through with a superseding note).
- **CODEX.md**: the same corrections were mirrored per §20 (Claude + Codex synchronization rule) —
  a new top milestone entry in §5, a correction banner at the top of §6 ("Locked role boundaries"),
  and the two matching inline strikethrough corrections.
- **`ai/ENTERPRISE_B5_1…5_*_COMPLETION_REPORT.md`** (all five): each received a dated supersession
  banner immediately after its title, stating that its "READ-ONLY BY PERMISSION"/zero-writes claims
  described state at the time the phase shipped, that PERMS-2 has since changed the backend
  permission state, and that the frontend described in the report is unchanged (zero write
  affordances, now a Track B5.7 build-order gate rather than a permission gate). B5.4's and B5.5's
  banners additionally note their C-25/C-26/B5.4-D1/B5.5-F1 findings are now fixed/resolved/
  investigated respectively.
- **`ai/ENTERPRISE_UI_ROADMAP.md`**: a top-of-file banner; the C-27 and B5.5-F1 rows in the findings
  table were updated in place (C-27 marked ✅ RESOLVED, B5.5-F1 marked "investigated further,
  confirmed dead"); a new **B5.7** phase row was added (see §7 below).
- **`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`**: a top-of-file banner explaining PC-01/PC-02 are
  resolved by the owner's reversal of OD-9.
- **`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`**: a top-of-file banner explaining the OD-9
  resolution it documents has been reversed, and flagging that this same report's own audit missed
  the pre-existing M28-era write that became C-27.

**History was preserved, not deleted, throughout** — every correction is a dated banner or a
struck-through-plus-superseding-note edit, per CLAUDE.md §19 ("update the stale doc... do not
rewrite historical completion reports as if they were current specifications" — read together with
the instruction that the *current-state* sections must reflect reality). Secondary files that also
carry stale PC-01/read-only language (`ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md`,
`ai/BACKEND_GAP_BATCH3_COMPLETION_REPORT.md`, `ai/AI_STATUS.md`, and prose comments inside
`apps/web/src/lib/accounting/*` / `apps/web/src/components/manager/accounting/**`) were identified
by the research pass but **not edited** — they describe historical batch state (2 and 3) or
frontend code whose behaviour is genuinely unchanged (the frontend still enforces read-only), so a
banner there would be noise rather than a correction. This scoping choice is recorded here so a
future pass does not read the omission as an oversight.

---

## 5. B5.4-D1 — PostingError resolve/dismiss endpoint

Followed the AI_GOVERNANCE build order exactly: **DB → service → controller → tests → seed →
Postman → docs → status → completion report.**

### DB

New migration `packages/db/prisma/migrations/20260821200636_b5_4_d1_posting_error_resolution/`
adds three columns to `posting_errors`:

```sql
ALTER TABLE "posting_errors" ADD COLUMN "resolution_notes" TEXT,
ADD COLUMN "resolved_at" TIMESTAMP(3),
ADD COLUMN "resolved_by_id" TEXT;

ALTER TABLE "posting_errors" ADD CONSTRAINT "posting_errors_resolved_by_id_fkey"
FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**This migration is hand-written, not `prisma migrate dev`'s raw diff.** The raw diff against the
current migration history also contained a large amount of pre-existing, unrelated schema drift —
FK drop/recreate cycles and index renames on `sync_jobs`, `sync_conflicts`, `feature_flags`,
`maintenance_windows`, `training_sessions`, `flag_audits`, `idempotency_keys` and several
bank-rec/franchise/budget index names — that predates this batch and was never introduced by it.
Bundling that drift into a migration this batch commits would have silently applied a large set of
unrelated changes to production on the next `migrate deploy`, which is out of this batch's
authorized scope. The hand-written migration was verified to apply cleanly on top of the full
existing 58-migration chain (`prisma migrate deploy` → "All migrations have been successfully
applied") and produces `prisma migrate status` → "Database schema is up to date!" with no
outstanding drift for the change actually made.

`PostingError.resolvedBy` relation added (`@relation("PostingErrorResolvedBy")`), mirroring the
existing `Feedback.resolvedBy` pattern; reverse relation `User.postingErrorsResolved` added.

### Service

`ledger.service.ts`: a private `transitionPostingError()` helper (branch-scoped lookup via
`branchOrOrgScope`, status guard — only `OPEN` may transition, else `ConflictException` — then
`update` + a C-26-correct `audit.log` call stamping `metadata.branchId` from the fetched row) backs
two public methods, `resolvePostingError` and `dismissPostingError`, differing only in target
status (`RESOLVED`/`DISMISSED`) and audit action name (`POSTING_ERROR_RESOLVED`/
`POSTING_ERROR_DISMISSED`).

### Controller

```
PATCH /api/accounting/posting-errors/:id/resolve
PATCH /api/accounting/posting-errors/:id/dismiss
```

Both gated on `@Permissions('pos:accounting:posting-errors:resolve')` — one permission gates the
paired accept/reject action, mirroring the existing `pos:discount:approve` pattern (which gates both
approve and reject).

### Tests

- Unit (`ledger.service.spec.ts`): 8 new cases covering resolve success + audit metadata, dismiss
  success + audit metadata, reject-already-resolved (409), reject-already-dismissed (409),
  cross-branch/unknown → 404, and fail-closed-with-no-branch.
- DTO (`dto/query-dtos.spec.ts`): `ResolvePostingErrorDto`/`DismissPostingErrorDto` validation
  (empty body OK, string `resolutionNotes` OK, non-string rejected).
- e2e (`accounting-branch-scoping.e2e-spec.ts`): cross-branch resolve → 404; resolve → 200 +
  branch-scoped audit row; re-resolve → 409; dismiss (fresh error) → 200.

### Seed

New permission `pos:accounting:posting-errors:resolve`, granted to Owner, Manager, Accountant only
(§1). No grant to Supervisor/Cashier/Waiter/Chef/Bartender/Procurement/Stock Manager/Event Manager.

### Postman

`postman/collections/M33-General-Ledger-Journals-Posting-Engine.postman_collection.json` — four new
requests added to the "Posting Engine" folder: **Resolve Posting Error**, **Resolve Posting
Error — Already Resolved (409)**, **Replay Posting (Unknown Key — For Dismiss)** (produces an
independent second OPEN error so Dismiss has its own row), **Dismiss Posting Error**. The existing
**Replay Posting (Unknown Key — Error)** request's test script gained a dual-scope
(`pm.collectionVariables.set` + `pm.environment.set`, per R16) capture of the produced error id into
`postingErrorId`, which the new Resolve requests consume. `POST /api/auth/login` in this collection
already asserts `status(201)` (R1/P1, unchanged).

⚠️ **This collection carries pre-existing finding C-23** (the M33 collection's `Create Journal
Entry` request sends a literal `{{accountId}}`, so it 400s and cascades into failures across nearly
every downstream request when run cold, top-to-bottom). This was **not fixed** — out of this
batch's authorized scope, matching the explicit CLAUDE.md warning: "do not silently 'fix' the
collection as part of a later phase without separate authorisation." To validate the four new
requests despite this, they were run standalone against the isolated API with an owner token and a
real posting-error id obtained via the "Replay Posting (Unknown Key — Error)" request (which does
not depend on `Create Journal Entry`): **all 4 new requests, 8 assertions, 0 failures.** A full
top-to-bottom collection run was also executed to confirm the *existing* C-23 cascade is unaffected
by this batch's edit: **18 pre-existing assertion failures**, all inside requests this batch did not
touch (`Replay Posting`, `Get Journal by ID`, `Reverse Journal Entry`, etc. — all downstream of the
`Create Journal Entry` 400), none inside the four new requests. Collections still parse (see §8).

### Docs

Covered under §4(b) above and the roadmap update in §7.

---

## 6. B5.5-F1 — investigated further, confirmed genuinely dead, not implemented

**Question posed by the batch brief:** are `PeriodCloseRunStatus.FAILED`/`.PENDING` (a) genuinely
dead enum members, (b) reachable only via a worker path not exposed over HTTP, or (c) reachable but
blocked by a bug?

**Finding: case (a).**

- `BankRecService.closeFiscalPeriod()` is the **only** place in the entire codebase that calls
  `periodCloseRun.create` (confirmed by a repo-wide grep for `periodCloseRun\.`). It is inside a
  single `$transaction` and creates the row with the literal string `status: 'COMPLETED'` —
  overriding the Prisma schema's own `@default(PENDING)`.
- Pre-transaction validation (period must be `OPEN`) throws `ConflictException` *before* any row is
  created, so a refused close leaves **zero** rows, not a `FAILED` one.
- `grep -rn "PeriodCloseRunStatus"` across `apps/api/src` → **zero matches**: the enum type is never
  even imported into application code; the service compares against raw string literals.
- `grep -rln "@Cron("` across `apps/api/src` → **zero matches** — there are no cron jobs anywhere in
  the API.
- `grep -rln "BullMQ|@Processor|@nestjs/bull|Queue("` → only `kds.controller.ts`/`kds.service.ts`
  (KDS ticket queue) and `alerts/digest.service.ts` (alert digest job) — neither references
  `PeriodCloseRun` or fiscal periods in any way.
- No `.update()` call against `periodCloseRun` exists anywhere in the codebase (confirmed by grep),
  so even if a `PENDING` row could somehow be created, nothing would ever transition it to
  `FAILED`/`COMPLETED` later.

**Conclusion:** there is no async worker, queue, or cron path anywhere in `apps/api` that could
independently create a `PENDING` row and later resolve it, and the one synchronous write path can
only ever produce `COMPLETED` (success) or nothing (refused). `FAILED`/`PENDING` are genuinely dead
enum members today, not a bug and not a coverage gap in an as-yet-unbuilt async design.

**No fake transition was added.** Per the brief, this finding is recorded (roadmap §7 update below)
and a future batch may propose removing the two dead enum members — that removal is **not**
performed in this batch.

---

## 7. Roadmap — B5.7 added

`ai/ENTERPRISE_UI_ROADMAP.md`'s B5 sub-phase table gained a new row after B5.6:

> **B5.7 — Accounting write pass.** Retrofits write affordances across every surface B5.1–B5.5
> shipped deliberately read-only, now that Manager holds full accounting read+write at the backend
> (PERMS-2): AP bill create/approve/payment, AR invoice/receipt create, AP/AR credit-note create,
> recurring-profile create/generate, reminder generate/dismiss, bank account/statement/manual-entry
> create, reconciliation create/match/skip/complete, journal create/reverse, posting replay,
> posting-error resolve/dismiss (now live), fiscal period open/close/lock. Also **inverts** the
> no-write-affordance assertions those phases added. Runs **after** B5.6 Configuration.

The B5.6 row itself was annotated: **"Build this phase WRITE-ENABLED from the start... B5.6 needs no
B5.7 retrofit."** Both edits are mirrored consistently — B5.7 is sized **L**, status **NOT
STARTED**, with the same "do not begin without explicit owner authorisation" language every other
gated phase in this file carries.

---

## 8. Validation gate

All commands below were run from repo root unless noted; none used `--fix`.

| Check | Result |
| --- | --- |
| API `tsc --noEmit` | Clean, 0 errors |
| API `eslint` (targeted, no `--fix`) on every touched file | 0 errors; pre-existing `no-explicit-any` warnings only (matching the file's established style); 4 pre-existing prettier errors found on two untouched describe blocks in `accounting-branch-scoping.e2e-spec.ts` (bank-statements/reconciliation, confirmed via `git diff` to predate this batch) — disclosed, not fixed |
| API unit suite (`npx jest`) | **1177 passed / 4 failed / 1181 total.** The 4 failures are all in `client-onboarding.service.spec.ts`, matching the **pre-existing, previously-documented** failure set referenced repeatedly across prior batch reports (batch 2's throwaway-worktree comparison, etc.) |
| Ledger module unit + DTO suites (`ledger.service.spec.ts`, `dto/query-dtos.spec.ts`) | **53/53** (up from the pre-batch 50/50 baseline — 3 new DTO tests + the C-25/C-26/B5.4-D1 unit cases added within the existing 50-test envelope by extending, not duplicating, describe blocks) |
| New/extended `accounting-branch-scoping.e2e-spec.ts` (live, against the isolated stack) | **43/43** — covers C-25 cross-branch 404, BGB3-L3 OR-nullable scoping (journals + posting runs), C-26 audit-timeline reachability, B5.4-D1 resolve/dismiss/409/cross-branch-404, and PERMS-2 Manager writes (period create/open/close/lock, journal create/reverse, posting-error resolve) |
| Web `tsc --noEmit` | Clean (untouched — sanity check only) |
| Web `next lint` (no `--fix` — the script itself has none) | "No ESLint warnings or errors" |
| Web production build (`NEXT_PUBLIC_API_BASE_URL` unset, matching the shared default) | Clean, all routes compiled |
| Web production build (`NEXT_PUBLIC_API_BASE_URL=http://localhost:4091`, for isolated QA) | Clean, all routes compiled |
| Assertion scripts (all 17, via `npx tsx`, the documented invocation from `docs/TESTING_AND_QA.md`) | **17/17 pass** — `manager-b5-assertions.ts` reports "Manager B5.1 + B5.2 + B5.3 + B5.4 + B5.5 assertions: all checks passed" unchanged, since no frontend file was touched |
| Postman collections parse | **56/56** (3 pre-existing BOM-carrying files — `M17`, `M18`, `M19` — confirmed via `git diff --stat` to be untouched by this batch, matching the previously-documented "3 carry a pre-existing BOM" finding); the touched `M33` collection parses cleanly |
| Postman M33 — new requests only (folder-scoped, manual token/branch) | **4/4 requests, 8/8 assertions, 0 failures** |
| Postman M33 — full top-to-bottom run (pre-existing C-23) | **18 pre-existing assertion failures**, all inside requests this batch did not touch, cascading from the pre-existing `Create Journal Entry` `{{accountId}}` literal; none inside the 4 new requests |
| `git diff --check` | Clean |
| `/api/health` (isolated API) | `{"status":"ok","db":"ok",...}` throughout the QA window |

### Playwright — isolated stack, all 4 viewport projects

| Suite | Result |
| --- | --- |
| `e2e/manager-accounting/menu-and-read-only.spec.ts` | **29 passed / 3 skipped** — matches the documented B5.2/B5.3 baseline exactly (the 3 skips are the pre-existing "desktop dropdown only at `xl`" class) |
| `e2e/manager-accounting/closing.spec.ts` + `core-and-review.spec.ts` (combined) | **116 passed / 12 skipped** — no regressions; every B5.4/B5.5 read-only assertion (no create/post/reverse/replay/resolve/open/close/lock control renders anywhere) still passes unchanged, confirming the frontend genuinely did not change |
| `e2e/manager-shell/` (full regression, incl. `role-boundaries.spec.ts`) | **125 passed / 11 skipped** — matches the documented B1/B2 baseline exactly. `role-boundaries.spec.ts` confirms live in the browser: waiter/cashier/supervisor cannot open `/manager/overview`; manager cannot open the waiter/cashier/supervisor workspaces |

No run was cut short; every figure above is a completed run's final tally, not a partial count.

### Direct API cross-role check (supplementing the Playwright role-boundary suite)

```
waiter@nimbus.demo    -> GET /accounting/journals: 403   GET /accounting/posting-errors: 403
cashier@nimbus.demo   -> GET /accounting/journals: 403   GET /accounting/posting-errors: 403
supervisor@nimbus.demo -> GET /accounting/journals: 403   GET /accounting/posting-errors: 403
manager@nimbus.demo   -> GET /accounting/journals: 200   GET /accounting/posting-errors: 200
```

Confirms at the wire level, not just through the UI guard, that PERMS-2 changed nothing for the
three operational roles while genuinely opening the surface for Manager.

---

## 9. Isolation

- **Local Docker Postgres 16**, container `nimbus_b4_qa_pg`, database `nimbus_b4_qa`, port
  `:55480`. Isolated API on `:4091`, isolated web on `:3180`. **Shared Neon was never connected to,
  read from, or written to** — the isolated API's only outbound Postgres connection was to
  `127.0.0.1:55480`.
- `packages/db/.env` was **temporarily swapped** to point at the isolated database, used only for
  the Prisma CLI steps (`migrate deploy` ×2, `generate`, `db:seed`, `db:demo:import`) — the
  documented, unavoidable exception, since the Prisma CLI resolves `DATABASE_URL` from the
  schema-adjacent `.env` regardless of an inline override. **Restored to its original content
  immediately after**, SHA-256 verified **identical** before and after:
  `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75`.
- `apps/api/.env` was **never edited on disk at all** — isolation for the API process (both the live
  server and the Jest e2e run) was achieved by exporting `DATABASE_URL`/`DIRECT_DATABASE_URL`
  directly into the spawning shell (`dotenv` never overrides an already-set `process.env`
  variable), so its SHA-256 is trivially identical throughout by construction:
  `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b`.
- Every process this batch started was tracked by PID and stopped individually at teardown: the
  isolated API (PID 97777) and the isolated web server (PID 1913) were both killed directly; no
  `pkill` pattern-match was used anywhere in this batch. A **pre-existing** shared dev API on
  `:3001` was found running under a different PID (81309) — it was never touched, and its
  `/api/health` was verified `ok` both before this batch discovered it and after teardown, to
  confirm this batch caused it no disruption.
- The Docker container `nimbus_b4_qa_pg` was removed at teardown (`docker rm -f`).
- No lint script was ever invoked with `--fix`; every `eslint` invocation in this batch was targeted
  and flag-free.
- `next build` was never run while a dev server was active on the same port.

---

## 10. Files changed

**Schema/migration:** `packages/db/prisma/schema.prisma`,
`packages/db/prisma/migrations/20260821200636_b5_4_d1_posting_error_resolution/migration.sql` (new)

**Seed:** `packages/db/prisma/seed.ts`

**API:** `apps/api/src/modules/ledger/ledger.service.ts`,
`apps/api/src/modules/ledger/ledger.controller.ts`,
`apps/api/src/modules/ledger/dto/index.ts`,
`apps/api/src/modules/ledger/dto/resolve-posting-error.dto.ts` (new),
`apps/api/src/modules/ledger/dto/dismiss-posting-error.dto.ts` (new)

**Tests:** `apps/api/src/modules/ledger/ledger.service.spec.ts`,
`apps/api/src/modules/ledger/dto/query-dtos.spec.ts`,
`apps/api/test/accounting-branch-scoping.e2e-spec.ts`

**Postman:** `postman/collections/M33-General-Ledger-Journals-Posting-Engine.postman_collection.json`

**Docs:** `CLAUDE.md`, `CODEX.md`, `ai/ENTERPRISE_UI_ROADMAP.md`,
`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`, `ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`,
`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`,
`ai/ENTERPRISE_B5_2_CUSTOMERS_VENDORS_COMPLETION_REPORT.md`,
`ai/ENTERPRISE_B5_3_BANK_RECONCILIATION_COMPLETION_REPORT.md`,
`ai/ENTERPRISE_B5_4_ACCOUNTING_CORE_COMPLETION_REPORT.md`,
`ai/ENTERPRISE_B5_5_CLOSING_COMPLETION_REPORT.md`

**No frontend file was touched.**

---

## 11. What remains gated

- **B5.6 (Configuration + the remainder of Reporting)** — NOT started. Should be built
  write-enabled from the start per this batch's roadmap update.
- **B5.7 (accounting write pass)** — new, NOT started. Requires explicit owner authorisation before
  any write control is added to the Manager accounting frontend.
- **B6 (Settings), B7 (Owner)** — NOT started, unaffected by this batch.
- **B5.5-F1** — the two dead `PeriodCloseRunStatus` enum members are recorded, not removed. A future
  batch may propose removing them.
- **Shared Neon** — this batch's changes (seed grants, the new migration, the new endpoint) have not
  been deployed there. Deploying would require the same explicit per-cutover gate every prior
  shared-Neon deploy in this project has required (read-only preflight + a retained pre-migration
  recovery branch).

No commit was created as part of drafting this report — see the repository's commit history for the
associated commit made after this report was written.
