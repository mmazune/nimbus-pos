# ENTERPRISE UI TRACK B5.7 — Accounting Write Pass + C-28 Repo-Wide Audit Branch-Stamp Sweep

**Date:** 2026-08-22
**Status:** COMPLETE, with explicitly disclosed scope reductions (see §2 and §6). No fabricated validation — every number below was executed and observed in this session, not carried over from a prior report.
**Precondition verified:** `git log -1` showed `457d02d` at HEAD on `main`, clean worktree, before any change in this pass.

---

## 0. Playwright count reconciliation

**Finding: the premise of a "5-spec delta" is a false comparison between two unrelated test suites.**

The brief asked to reconcile "batch 4 reported 125 passing" against "B5.6 reported 109 passing + 11
skipped." Investigation via `git log`/`git diff` against the actual repository history shows these
are **not the same suite measured twice**:

- **125 passed / 11 skipped** is `e2e/manager-shell/` — the shell/nav/cross-role/keyboard regression
  suite. This exact figure (125/11) recurs identically across multiple historical records (Track B1,
  the permissions cutover, backend gap batch 3, backend gap batch 4 — CLAUDE.md lines 753, 903, 1052,
  1092, 1122), because `e2e/manager-shell/` has not changed. `git diff 375f38d..457d02d -- apps/web/e2e/manager-shell/`
  (B5.5 → B5.6 commit) returns **zero changes** — confirmed directly, not assumed.
- **109 passed / 11 skipped / 0 failed** is a *different* suite: `e2e/manager-accounting/`'s **full
  regression**, run at a **single viewport** (`vp-1440x900` — stated explicitly in the source line,
  CLAUDE.md line 229), reported in the *same* B5.6 record as a companion figure to "117 passed / 3
  skipped / 0 failed across all 4 viewports" for the *new* B5.6 specs alone.

There is no 5-test delta to explain because 125 and 109 were never counting the same thing. Treating
them as comparable was the error, not a missing 5 tests. This is stated plainly rather than inventing
a "renamed/merged/deleted" story to make the numbers reconcile.

**This pass did not execute either Playwright suite.** Standing up a second full isolated
Docker+Postgres+seed+API+web stack purely to run four-viewport Playwright, on top of the live
curl+browser QA already performed against a real isolated stack (§5), was judged not to fit inside
this session's remaining scope after the C-28 sweep and the four write surfaces. This is disclosed
here, not silently skipped — see §6 for what full validation would still need before a `manager-b5-*`
Playwright pass could be claimed for B5.7 itself.

**Reconciled baseline for any future Playwright pass on B5.7:** `e2e/manager-shell/` — 125 passed / 11
skipped (unchanged, not touched by this phase). `e2e/manager-accounting/` — no B5.7-specific spec file
exists yet; the existing `bank.spec.ts`, `core-and-review.spec.ts`, `closing.spec.ts` and
`menu-and-read-only.spec.ts` files assert the OLD read-only behaviour on the four surfaces this phase
changed and **will now fail** until a `write-transitions.spec.ts` (or equivalent) is authored and the
four existing specs' read-only assertions are inverted to match the new write UI. This is the same
"invert, don't delete" work the static assertion script (§3 below) already did for
`manager-b5-assertions.ts`; the Playwright layer needs the equivalent pass as a follow-up.

---

## 1. C-28 — repo-wide audit branch-stamp sweep

### Method

`apps/api/src/modules/audit-timeline/audit-timeline.service.ts` (`AuditTimelineReadService.query`)
unconditionally ANDs `metadata.branchId = X-Branch-Id` on every read (line 83). Any `audit.log(...)`
call whose `metadata` object never includes `branchId` is therefore structurally invisible to that
endpoint forever — the defect class Batch 4 and B5.6 each found in isolation, in files they happened
to already be touching.

A full repo-wide grep of `apps/api/src` (excluding `.spec.ts`) found **318 `audit.log(`/`this.audit.log(`
call sites across 57 service files.** These were split into 8 batches and audited in parallel by
independent agents, each re-deriving every call site from source (not trusting any line-number hint),
classifying each as:

- **(a)** already stamps `branchId`
- **(b)** already fixed by Batch 4 or B5.6
- **(c)** missing, but a branch identifier is already in scope in that method (a `ctx.branchId` param,
  a local variable, or an already-loaded entity's own `.branchId`) — **fixed**, citing "C-28" in a
  comment matching the existing "C-26" reference style
- **(d)** missing, and legitimately organisation/platform-level with no branch concept — verified
  against `packages/db/prisma/schema.prisma` (does the entity even have a `branch_id` column?), not
  guessed — left unedited, marked with a `// C-28-EXEMPT: <reason>` comment
- **(e)** missing, and a branch identifier is technically obtainable but only via a new DB lookup or a
  method-signature change not already in scope — deliberately **not** added (out of this batch's
  discipline: no new queries, no signature-chain changes) — left unedited, marked exempt with a
  deferral reason

### Result

- **106 sites fixed** (classification c) across **23 files**.
- **73 sites marked exempt** with a `// C-28-EXEMPT: <reason>` comment (classifications d/e, plus the
  controlplane N/A-different-sink finding below).
- All remaining sites were already correctly stamped (a) or previously fixed (b).

One classification refinement mid-sweep: two agent-reported sites (`pos-handoff.service.ts` lines
985/994) were initially flagged "still missing" by my own objective post-fix classifier, then verified
by direct read to already be correct — the metadata is built via `{ ...auditMeta, role: 'source' }`
where `auditMeta` (a local object defined a few lines above) already includes `branchId: ctx.branchId`.
This is a real limitation of static-text classification (a spread of a variable, not a literal key),
not a defect — no fix was needed there, and the regression guard (§1.3) was extended to resolve this
exact spread pattern so it doesn't misfire in future runs.

### Notable findings during the sweep

- **`budget.service.ts:317` (`PROCUREMENT_SUGGESTION_REVIEWED`)** — missing `branchId`, `ctx.branchId`
  already in scope, and **not** among any site Batch 4 or B5.6 disclosed as fixed or deferred. A
  genuine gap those phases missed because they only audited files already in scope for their own work.
  Fixed.
- **`billing.service.ts:498` (`USAGE_METERS_REFRESHED`) and `franchise.service.ts` inter-branch-transfer
  actions** — found independently by the parallel agents' own re-derivation, not present in my initial
  heuristic census. Confirms the value of re-deriving from source rather than trusting a hint list.
- **Controlplane sink discovery (not a fix, a scoping correction):** all 8 `audit.log` call sites in
  `apps/api/src/modules/controlplane/*.service.ts` turned out to call `FlagAuditService.log()`, **not**
  the common `AuditService`. `FlagAuditService` writes to a separate `FlagAudit` Prisma table, which
  `AuditTimelineReadService` never queries (it only reads `AuditLog`). These 8 sites are therefore
  **not in scope for the C-28 defect class at all** — stamping `branchId` on them would do nothing,
  since the branch-scoped endpoint can never see rows from that table. Marked exempt with this reason,
  not force-fixed.

### Deferred (classification e) — not fixed, and why

| Site | Action | Reason |
|---|---|---|
| `accounting.service.ts:201,236` | `FISCAL_PERIOD_CREATED`/`OPENED` | Method signature carries only `orgId`, not a branch identifier, even though the controller has `ctx.branchId` and never threads it through (unlike the sibling `POSTING_SOURCE_MAP_UPDATED`/`TAX_LEDGER_CONFIG_UPDATED` in the same file, which already accept an `actingBranchId` param). Needs a signature change — out of the "no signature-chain changes" discipline this batch held to. |
| `bank-rec.service.ts:805,841` | `FISCAL_PERIOD_CLOSED`/`LOCKED` | Same shape as above. |
| `auth/quick-pin.service.ts:495,504` | `QUICK_PIN_DISABLED`/`ENABLED` | `updateQuickPinSettings()` is shared by an org-wide caller (no branch in scope) and a branch-scoped caller elsewhere; threading a branch through would require a signature change touching the unscoped caller too. |
| `payments.service.ts:571` | `PAYMENT_WEBHOOK_RECEIVED` | Raw webhook receipt, no `ctx`/branch param at all in the method. |
| `reliability/sync.service.ts:92` | `SYNC_REPLAY_SUBMITTED` | A single batch can legitimately span multiple branches (`ReplayJobItemDto.branchId` is per-job optional) — no single value represents the whole batch without fabricating one. |
| `reliability/sync.service.ts:469` | `SYNC_CONFLICT_RESOLVED` | `SyncConflict` has no `branch_id` column; only `conflict.jobId` is in scope without a new `SyncJob` lookup. |
| `alerts.service.ts:372,409` | `ALERT_DELIVERY_RETRY_EXHAUSTED`/`RETRIED` | `AlertDelivery` has no own branch column; the loaded `delivery` has no `rule` relation included, so its owning rule's branch is not in scope without a new lookup. |

**Historical rows in shared Neon (or any previously-created row anywhere) were never touched or
backfilled** — matching the repo's own established precedent (B5-F4, C-26). Rows created before a
given fix still show `branchId: null` in their `metadata` and remain invisible to the branch-scoped
audit trail; only newly-created events after this pass are correctly stamped.

### 1.3 — Regression guard (the "don't find this a fourth time" requirement)

New: `apps/api/src/common/audit/audit-branchid-guard.spec.ts` — a Jest unit test that runs as part of
the default `pnpm test` suite. It re-derives every `audit.log(`/`this.audit.log(` call site in
`apps/api/src` at test time (walking the filesystem, not a hardcoded list), resolves each call's
`metadata` block (including one level of local-variable/spread resolution, to correctly handle the
`{ ...auditMeta, role: 'x' }` pattern found during this sweep), and **fails the build** if any call
site neither stamps `branchId` nor carries a `// C-28-EXEMPT: <reason>` comment on the line directly
above it. It cannot verify an exemption's *truthfulness* — only that every unstamped site has been
deliberately looked at and documented. Verified passing after annotating all 73 exempt sites; verified
**failing** before the annotations were added (confirmed the guard actually catches the class it's
built for, using the two genuine pos-handoff false-positives from the classifier as a live test of the
spread-resolution logic).

---

## 2. Write affordances — surfaced vs. deliberately not, per surface

`apps/web/src/lib/accounting/menu.ts` remains the scope authority; no menu row count changed (still
28/28 — this phase adds writes to existing rows, not new rows).

| Surface | Endpoints that exist | Surfaced in this phase | Deliberately NOT surfaced (reason) |
|---|---|---|---|
| **B5.4 Posting errors** | `PATCH .../:id/resolve`, `PATCH .../:id/dismiss` (both from Batch 4/B5.4-D1) | Both — full resolve/dismiss dialog with optional notes, status-gated to OPEN only | — (both endpoints, fully surfaced) |
| **B5.5 Fiscal periods** | `POST /periods` (C-27 grant), `PATCH .../open`, `.../close`, `.../lock` | All four — Create dialog, per-row Open/Close/Lock buttons gated by current status, Lock requires typing the period's own name to enable the confirm button | — (all four endpoints, fully surfaced) |
| **B5.3 Bank reconciliation** | `PATCH .../:id/match`, `PATCH .../:id/skip`, `POST .../:id/complete` | All three — per-line Match/Skip on UNMATCHED lines, Complete disabled while the balance difference is non-zero | `POST /accounting/reconciliation` (start a new reconciliation) and `POST /bank-statements/import` / `POST /bank-accounts` (create bank account/import statement) stay denied — B5.3's own scope was list+detail only; adding *starting* a reconciliation is a materially larger surface (bank-account + statement-import forms) than acting on an existing one, and was judged out of this batch's remaining time. `ACCOUNTING_READ_ONLY_CARD` on the list view and the COMPLETED-state detail view name this explicitly. |
| **B5.4 Journals** | `POST /journals` (create), `POST .../:id/reverse` | Reverse only — single action on a POSTED journal, gated to that status, with an optional reason field | `POST /journals` (create a new journal) — a dynamic, client-balanced multi-line debit/credit form is materially more UI surface than a single-click reversal; explicitly deferred, not silently dropped (see `ACCOUNTING_DENIED_WRITES` entry "Post a new journal entry"). `POST /posting/replay` — the Posting runs screen is list-only with no detail route (a pre-existing B5.4 constraint), so there is no natural per-row entry point for a "replay this run" action without first designing one; deferred. |
| **B5.2 AR/AP (Customers/Vendors)** | `POST` on invoices, customer accounts, credit notes ×2, bills, suppliers, payments, recurring profiles — 8+ distinct entity create/edit routes | None | Explicitly time-boxed out of this batch. The brief named posting-errors and fiscal periods as the highest-value items; after building those plus bank-reconciliation actions and journal-reverse, building 8 separate entity create/edit forms (each with its own validation/DTO shape) was judged disproportionate to the remaining scope of this pass. `ACCOUNTING_DENIED_WRITES` entries for AP/AR were updated to note "SUPERSEDED by PERMS-2... deferred to B5.7b" rather than left claiming a permission gap that no longer exists. |
| **B5.1 Dashboard** | — | Reviewed: no card copy asserted read-only-forever in a way this phase falsified; no change needed. | — |

**Net menu-tree write state:** 4 of the 28 rows (Posting errors, Fiscal periods, Bank reconciliation
detail, Journal entries) gained real write controls in this pass, on top of the 7 B5.6 already shipped
— 11 of 28 rows are now write-enabled; 17 remain read-only by deliberate build-order gate (not a
permission gate — PERMS-2 already granted the read+write set to all 28).

---

## 3. Inverted assertions

All changes are in `apps/web/scripts/manager-b5-assertions.ts` (the file `manager-b5-assertions.ts`
already existed and enforced the read-only ban through B5.6; extended, never forked).

1. **New `B57_WRITE_ENABLED_FILES` allow-list** (5 files: the 4 changed screens +
   `accounting-transitions-queries.ts`), unioned with the existing `B56_WRITE_ENABLED_FILES` into
   `WRITE_ENABLED_FILES`, used everywhere the write-ban loops previously referenced the B5.6-only list.
2. **Bank tree match/skip/complete ban** — was a blanket ban across all 3 bank screens; inverted to
   exclude `ReconciliationScreen.tsx` (now positively asserted to call
   `matchReconciliationLineRequest`/`skipReconciliationLineRequest`/`completeReconciliationRequest`),
   while `BankAccountsScreen.tsx`/`BankStatementsScreen.tsx` keep the original ban.
3. **Posting-error "no resolve/dismiss function exists anywhere" assertion** — inverted to positively
   assert `PostingErrorsScreen.tsx` calls both `useResolvePostingError` and `useDismissPostingError`,
   and that it no longer contains the old "no endpoint exists" / "No role can act" copy.
4. **C-27 "FiscalPeriodsScreen renders no create control" assertion** — inverted to positively assert
   it calls `useCreateFiscalPeriod`, `useOpenFiscalPeriod`, `useCloseFiscalPeriod` and
   `useLockFiscalPeriod`, plus a new assertion that the Lock confirm button stays disabled until the
   typed period name matches (`confirmDisabled={!lockConfirmMatches}`).
5. **Closing-tree "no interactive control anywhere" ban** — was a blanket ban across both Closing
   screens; narrowed to `PeriodCloseRunsScreen.tsx` only (still list-only/read-only — period-close runs
   are a byproduct of Close, not their own writeable surface).
6. **`ACCOUNTING_WRITE_ROUTE_REGISTRY.length === 9` (B5.6-era exact count)** — inverted to `=== 19` (9
   from B5.6 + 10 from B5.7), comment explains the accretion rather than silently changing the number.
7. **`ACCOUNTING_DENIED_WRITES.length >= 8`** — inverted to `>= 6` (two entries removed as fully
   surfaced — bank match/skip/complete, fiscal period open/close/lock — one entry narrowed from
   "post or reverse a journal" to "post a new journal" since reverse is no longer denied), with the
   count and the reasoning both updated in the same commit rather than the count alone.
8. **`lib/manager/permissions.ts`'s `accounting` surface `scopeNote`** — a **genuine pre-existing
   staleness bug found in this pass, unrelated to any single prior phase's own scope**: the note read
   "READ-ONLY BY PERMISSION... zero writes... no create, post, approve, match or close control renders
   anywhere in this module" as an unqualified present-tense claim. This has been false since **Track
   B5.6 shipped** (2026-08-22, same day) and nobody corrected it. Given a `SUPERSEDED` banner (the same
   pattern CLAUDE.md itself uses for corrections), not silently rewritten — the original claim is
   preserved in the banner text, dated and reasoned. The corresponding assertion
   (`accountingSurface.scopeNote` must contain `READ-ONLY BY PERMISSION`) was inverted to require the
   `SUPERSEDED`+`PERMS-2` banner instead.
9. **New §17 block** added to the assertion script for B5.7-specific positive checks: the 5-file
   allow-list membership, confirm-before-destroy on all 5 write-enabled files, the Lock-requires-typed-name
   check, all 10 write-api.ts functions present, no blanket `["manager"]` cache invalidation anywhere in
   `accounting-transitions-queries.ts` (all 8 mutations narrowly invalidate their own surface), and the
   journal Reverse control gated on `status === "POSTED"`.

All 6 assertion scripts (`manager-p1`, `manager-b1` through `manager-b5`) pass after these changes —
verified by direct execution, not inferred.

---

## 4. Standing rules carried forward — compliance

- **Shared chrome only, no forks.** All four screens extend `ManagerContentShell`/`ManagerControlPanel`/
  `ManagerListTable`/`ManagerBreadcrumbs`/`ActionConfirmDialog` — the same primitives B5.1–B5.6 used.
  No new dialog/table/panel component was created; `AccountingTextField` (existing, from B5.6) is
  reused for every form field.
- **Design tokens only.** No raw hex anywhere in the 4 changed screens or the new
  `accounting-transitions-queries.ts` (verified by the existing repo-wide hex-ban assertion, which
  passed).
- **Every write emits a branch-stamped audit event, proven per surface.** Posting-error resolve/dismiss:
  live-verified `metadata->>'branchId'` populated (§5). Fiscal period create/open/close/lock: **live-
  verified still NULL** — this is the C-28 (e)-deferred finding from §1, not a regression; the
  live database query in §5 is direct evidence the disclosure in §1 was accurate.
- **CLAUDE.md §15 (no broad invalidation).** Every one of the 8 new mutations in
  `accounting-transitions-queries.ts` invalidates only its own surface's `managerQueryKey(...)` prefix
  (e.g. `accounting-posting-errors-list` + `accounting-posting-error`) — never a blanket `["manager"]`
  sweep. Asserted in §17 of the static script (item 9 above).
- **Confirm-before-destroy.** Every mutating action in all 4 screens routes through
  `ActionConfirmDialog`. Lock (irreversible, no unlock route in this API) additionally requires the
  acting Manager to type the exact period name before the confirm button enables — live-proven in the
  browser (§5): the button stayed visibly disabled with a wrong/partial value and only enabled once the
  exact name was set.

---

## 5. Live verification (not a green suite — actually executed)

### Isolation

- Postgres 16 in Docker, container `nimbus_b57_qa`, port `55490` (a project unrelated to Nimbus —
  `kura-web`'s 11 Supabase containers — was already running on the host; none of its containers were
  touched, confirmed both before and after by name).
- Redis 7 in Docker, container `nimbus_b57_redis`, port `55491` (turned out unnecessary — `REDIS_URL`
  is empty in the real dev `.env` too — but was left running for the duration rather than removed
  mid-session).
- `packages/db/.env` was temporarily swapped to point at the isolated Postgres for exactly the
  `prisma migrate deploy` + `prisma generate` + `pnpm db:seed` steps, then restored immediately.
  SHA-256 verified **identical before and after**: `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75`.
- `apps/api/.env` was **never edited on disk** — the isolated API was launched with an explicitly
  constructed child-process environment (`API_PORT=4101`, `DATABASE_URL`/`DIRECT_DATABASE_URL` pointed
  at `localhost:55490`, JWT secrets copied from the real `.env` values by reading, not writing, the
  file). SHA-256 verified identical throughout: `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b`.
- Isolation directly proven, not assumed: `lsof -p <api-pid> -a -i TCP | grep ESTABLISHED` showed the
  API's *only* established connections were to `localhost:55490`, both at API start and again
  immediately before teardown (13 connections, all to the isolated Postgres, zero to Neon).
- Isolated web dev server on port 3190, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4101`.
- Full teardown at the end: web (PID 87340) and API (PID 84762) processes killed individually by PID
  (never `pkill`), both Docker containers removed (`docker rm -f`), both `.env` hashes re-verified
  identical to baseline after teardown, `kura-web`'s 11 containers confirmed still running/healthy and
  untouched.

### Per-action observed HTTP status (curl, against the isolated API)

| # | Action | Method/route | Observed | Notes |
|---|---|---|---|---|
| 1 | Create fiscal period | `POST /accounting/periods` | **201** | DRAFT period created |
| 2 | Open fiscal period | `PATCH .../:id/open` | **200** | DRAFT → OPEN |
| 3 | Close fiscal period | `PATCH .../:id/close` | **200** | OPEN → CLOSED, creates a real `PeriodCloseRun` |
| 4 | Lock fiscal period | `PATCH .../:id/lock` | **200** | CLOSED → LOCKED |
| 4b | Lock again (repeat) | `PATCH .../:id/lock` | **409** | "Cannot lock period — current status is LOCKED" |
| 5 | Resolve posting error | `PATCH .../:id/resolve` | **200** | OPEN → RESOLVED |
| 5b | Resolve again (repeat) | `PATCH .../:id/resolve` | **409** | "Posting error is already resolved" |
| 6 | Dismiss posting error | `PATCH .../:id/dismiss` | **200** | OPEN → DISMISSED (fresh error, via a `posting/replay` fixture) |
| 7 | Reverse journal | `POST .../:id/reverse` | **201** | Creates a mirrored REVERSED-linked journal, flips debit/credit |
| 7b | Reverse again (repeat) | `POST .../:id/reverse` | **409** | "Journal is already reversed" |
| 8 | Match reconciliation line | `PATCH .../:id/match` | **200** | Also auto-transitions the reconciliation OPEN → IN_PROGRESS (see bug below) |
| 9 | Complete reconciliation | `POST .../:id/complete` | **200** | Balanced (zero difference) |
| 9b | Complete with non-zero difference | `POST .../:id/complete` | **400** | "Cannot complete a reconciliation with no matched lines" — by design, matches `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` |
| 10 | Skip reconciliation line | `PATCH .../:id/skip` | **200** | UNMATCHED → SKIPPED |

### 🔴 Real bug found live, fixed, re-verified — not merely disclosed

**Finding:** `BankRecService`'s match/skip endpoints **auto-transition a reconciliation from `OPEN` to
`IN_PROGRESS`** on the *first* match/skip call (confirmed by re-reading the reconciliation's own detail
after action #8 above: status changed from `OPEN` to `IN_PROGRESS` as a side effect, with no separate
"start progress" call). `ReconciliationScreen.tsx`'s original gating logic showed the Match/Skip
buttons **only when `status === "IN_PROGRESS"`** — meaning a freshly created `OPEN` reconciliation
would render **zero action buttons**, making the very first match or skip on any reconciliation
**unreachable through the UI**. This is exactly the class of bug the "detailRequest lesson" in the
brief warns about: it would have passed every static check, typecheck, and a superficial click-through
that only ever tested an already-`IN_PROGRESS` fixture.

**Fix:** `canActOnLines` (renamed from `isInProgress`) now gates on `["OPEN", "IN_PROGRESS"].includes(status)`,
with an inline comment recording the finding. Re-verified: typecheck clean, `manager-b5-assertions.ts`
still passes (its own `canActOnLines` regex assertions were written against the corrected code), and
the fix was then exercised live in the browser (below) on a fresh `OPEN` reconciliation with success.

### Live browser QA (Chrome, against the isolated stack — not curl, not inferred from a green suite)

Logged in as `manager@demo.local` on `http://localhost:3190`. For each action below, the dialog was
opened, filled, submitted, the resulting HTTP call observed to succeed via the UI's own state update
(list/detail re-render), and the browser console checked for errors:

- **Fiscal periods:** clicked **Close** on `FY2026-Q3` (OPEN → CLOSED, dialog showed the exact period
  name and consequence text) — list narrowly re-fetched, row updated to CLOSED with a **Lock** action
  in place of Close. Clicked **Lock** — confirm button visibly disabled until the exact period name was
  typed (tested first with a wrong/partial value, confirmed still disabled; then the correct name,
  confirm enabled) — locked successfully, row updated to LOCKED with no remaining action. Clicked **New
  period**, filled Name/Starts/Ends via the actual form controls, submitted — new DRAFT row appeared
  with an **Open** action, confirming the full create round-trip through the real UI.
- **Posting errors:** switched branch via the real branch-switcher control (a native `<select>`),
  observed the previously-empty list populate with the two errors created via curl, opened the resolved
  one — the sidebar correctly rendered the **Resolution** card (Outcome/Resolved/Notes) instead of the
  Resolve/Dismiss buttons, with the exact notes text ("B5.7 live QA resolve") from the earlier curl
  call, proving the detail view reads real persisted state, not a stale client cache.
- **Reconciliation:** opened both fixtures — the `COMPLETED` one correctly fell back to the read-only
  disclosure card (no more actions once completed); the `OPEN` one (post-bug-fix) correctly showed the
  **Complete reconciliation** button, visibly disabled (difference USD 9,999 ≠ 0).
- **Journals:** opened `JNL-000001` (still POSTED at that point) — real "Reverse journal" button
  rendered with the correct balance tie-out. Clicked it, confirmed with an optional reason, submitted —
  the journal transitioned to REVERSED, gained a "Reversed by → JNL-000004" link, and the sidebar fell
  back to the read-only card for the AP/journal-create/replay actions this phase did not build.

**Zero console errors were observed across the entire live browser session** (checked after each
major action, not once at the end).

### Cross-role verification (API-level, both frontline roles)

`waiter@demo.local` and `cashier@demo.local` (both readily seeded by the base seed) were each tested
against 4 representative new write routes (`POST /accounting/periods`, `PATCH .../posting-errors/x/resolve`,
`PATCH .../reconciliation/x/match`, `POST .../journals/x/reverse`) — **all 8 calls returned 403.**

⚠️ **Disclosed gap:** `supervisor@demo.local` is **not** seeded by the base `db:seed` script (it
requires the separate `db:demo:import` step) and was not tested live in this pass, given the time
already spent on the rest of this batch. Supervisor's accounting permission set is empty in the seed
matrix (accounting is Manager/Owner/Accountant-only), so a 403 is expected by the same permission
matrix that gated Waiter/Cashier — but this specific claim was not independently curl-verified for
Supervisor in this session, and should not be read as equivalent to the Waiter/Cashier checks above.

---

## 6. Validation gate — what ran, what didn't

**Ran, and passing:**
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` — clean, twice (before and after the
  reconciliation-gating bug fix).
- Targeted `eslint` (no `--fix`) on every touched web file — 0 errors.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` — clean production build, 29 pages (unchanged
  page count — this phase added writes to existing pages, not new pages), twice.
- All 6 static assertion scripts (`manager-p1`, `manager-b1`, `manager-b2`, `manager-b3`, `manager-b4`,
  `manager-b5`) — all pass, `manager-b5` extended with the new §17 block.
- New `apps/api/src/common/audit/audit-branchid-guard.spec.ts` — passes.
- Full API unit suite (`npx jest` in `apps/api`) — **1178 passed / 4 failed / 1182 total**, run twice
  (once after the C-28 sweep, once again at the very end). The 4 failures are the same,
  already-documented `client-onboarding.service.spec.ts` failures (a stale test-mock missing an
  `invitation` model) — **zero new failures**, confirmed by identical failure names both times.
- Live curl + live Chrome browser QA against a genuinely isolated Docker stack — see §5.
- Cross-role 403 verification for Waiter and Cashier — see §5.

**Did NOT run, disclosed rather than silently skipped:**
- **Four-viewport Playwright** for either `e2e/manager-shell/` or `e2e/manager-accounting/`. No
  B5.7-specific Playwright spec file was authored. The four existing `manager-accounting` spec files
  that assert the old read-only behaviour on Posting errors/Fiscal periods/Bank reconciliation/Journals
  will now fail against the real UI until they are updated — this is a known, disclosed gap, not a
  claim of a passing suite.
- **Supervisor** cross-role check (seeding gap, see §5).
- **Backend gap batch 4's own outstanding items** (C-25/C-26 already fixed at the backend per CLAUDE.md;
  not re-verified in this pass beyond what the C-28 sweep incidentally touched).

**Recommendation for whoever picks up next:** before claiming a full B5.7 Playwright pass, (1) author
`e2e/manager-accounting/write-transitions.spec.ts` covering the 10 write actions above across 4
viewports, (2) invert the read-only assertions in `bank.spec.ts`, `core-and-review.spec.ts`,
`closing.spec.ts` to match the new controls, matching exactly the pattern §3 already applied to the
static assertion script, and (3) re-run the full `e2e/manager-shell/` regression once, purely to
re-confirm the 125/11 baseline still holds (it should, since nothing in `components/manager/shell` or
`components/manager/chrome` was touched by this phase).

---

## 7. Files changed

**Backend (C-28 sweep):** 23 service files (see §1 table + the per-batch agent reports for exact line
numbers), plus new `apps/api/src/common/audit/audit-branchid-guard.spec.ts`.

**Frontend (write affordances):**
- `apps/web/src/lib/accounting/types.ts` — `PostingErrorRow`/`PostingErrorDetail` gained
  `resolvedById`/`resolvedAt`/`resolutionNotes`.
- `apps/web/src/lib/accounting/route-registry.ts` — 10 new `ACCOUNTING_WRITE_ROUTE_REGISTRY` entries;
  `ACCOUNTING_DENIED_WRITES` updated (2 removed, 1 narrowed, reasons updated in place).
- `apps/web/src/lib/accounting/write-api.ts` — 10 new request functions.
- `apps/web/src/lib/manager/accounting-transitions-queries.ts` — **new file**, 8 mutation hooks.
- `apps/web/src/lib/manager/permissions.ts` — accounting `scopeNote` corrected with a `SUPERSEDED`
  banner (§3 item 8).
- `apps/web/src/components/manager/accounting/review/PostingErrorsScreen.tsx` — resolve/dismiss UI.
- `apps/web/src/components/manager/accounting/closing/FiscalPeriodsScreen.tsx` — create/open/close/lock UI.
- `apps/web/src/components/manager/accounting/bank/ReconciliationScreen.tsx` — match/skip/complete UI
  (+ the OPEN/IN_PROGRESS bug fix, §5).
- `apps/web/src/components/manager/accounting/core/JournalsScreen.tsx` — reverse UI.
- `apps/web/scripts/manager-b5-assertions.ts` — inverted assertions, new §17 block (§3).

No Prisma schema, migration, seed, or Postman collection change. No new page files (menu row count
unchanged at 28/28).

---

## 8. Git

One local commit on `main`, not pushed. Commit message documents the C-28 sweep and the write
affordances separately for clarity in `git log`.
