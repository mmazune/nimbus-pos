# Enterprise UI Track B5.4 — Manager Accounting core (Journal entries) + Review surfaces

**Date:** 2026-08-21
**Phase:** `ai/ENTERPRISE_UI_ROADMAP.md` Track **B5.4** (Accounting core + Review), owner-approved.
**Status:** **COMPLETE**
**Gate:** B5.5 (Closing) and the remainder of B5.6 (Configuration/Reporting) are **NOT started** and
must not begin without explicit owner authorisation.

**Scope of change:** frontend + docs only. **No backend, schema, migration, seed, permission, DTO or
Postman change.** No commit to shared Neon; all live work ran on an isolated local Docker stack.

---

## 0. Scope correction — read this before the rest of the report

The operator brief that opened this phase described **fiscal periods (open/close/lock status
pipeline), period close runs, posting source maps and tax configuration** as B5.4 deliverables. They
are not. `lib/accounting/menu.ts`'s own `ACCOUNTING_SUBPHASES` tags — set in **B5.1** and unchanged by
any later phase — assign Fiscal periods and Period close runs to **B5.5 (Closing)**, and Chart of
accounts, Cost centres, Posting source maps and Tax configuration to **B5.6 (Configuration)**. The
roadmap's own B5.4/B5.5 table rows agree with the tags, not the brief (`ai/ENTERPRISE_UI_ROADMAP.md`
line 720: *"B5.4 — Accounting core + Review: Journal entries … posting runs, posting errors, the
audit-trail rail"*; line 721: *"B5.5 — Closing: Fiscal periods open/close/lock + period-close runs"*).

Per CLAUDE.md §19 ("when documentation conflicts with code … trust the local worktree code"), this
phase built **exactly the four rows `menu.ts` already tagged "B5.4"** — Journal entries, Posting runs,
Posting errors, Audit trail — and did **not** touch fiscal periods, period close runs, posting source
maps or tax configuration. Confirming this was the right call: **none of the four real B5.4 surfaces
are organisation-level** (all four registry entries are `scope: "branch"`), so Owner Ruling #3 in the
brief (the org-level-labelling requirement) never actually applies to anything this phase built — a
strong signal the brief had conflated B5.4 with B5.5/B5.6. This is recorded here, not silently
corrected, so whoever starts B5.5/B5.6 next reads the real scope split rather than re-deriving it.

There is also **no trial balance or general-ledger-as-a-statement surface**, and there will not be
one: no such endpoint exists anywhere in the API (`ACCOUNTING_OMITTED_ITEMS` in `menu.ts` already
records this, NG-07 → C-11). "General ledger" in this app **is** the Journal entries list — the same
surface the B5.1 dashboard's "General ledger" card already counted.

---

## 1. Headline

The four Accounting/Review menu rows B5.1 shipped as honest not-yet placeholders — Journal entries,
Posting runs, Posting errors, Audit trail — are now real surfaces. **The Accounting menu goes from 15
live rows to 19** (of 28 total). Manager accounting stays **read-only by permission** — the same 15
read strings, zero writes (PC-01/OD-9, re-verified live: journal create/reverse and posting replay all
403 for Manager); the no-write-affordance guard was extended over the new tree, never relaxed.

**Journal entries** — list + detail (`GET /accounting/journals` + `/:id`), a real server-total
paginated list (status filter: DRAFT/POSTED/REVERSED) and a detail view with **separate, unambiguous
Debit and Credit columns** (never one signed amount), a **Balance tie-out card** showing two
independently computed figures side by side (the journal's own stored `totalDebit`/`totalCredit`, and
a fresh client-side sum over its lines), and reversal linkage (`Reverses` / `Reversed by`, each a link
into the same list). **Posting runs** — list only (`GET /accounting/posting-runs`; the API declares no
detail route for this entity), a server-total paginated list with **no filter of any kind** (the
endpoint accepts none, not even status), each row's linked journal — when present — opening the
Journal entries detail. **Posting errors** — list + detail (`GET /accounting/posting-errors` + `/:id`,
status filter OPEN/RESOLVED/DISMISSED), the raised `code`/`message`/`details` JSON and its owning
posting run. **Audit trail** — list only (`GET /api/audit/timeline`, reused BG2 endpoint), scoped to
three curated entity types verified against `ledger.service.ts`'s own source (`JournalEntry`,
`PostingRun`, `PostingError` — not the org-wide feed every other domain also writes to).

🔴 **Two new findings, both live-proven, neither implemented (out of scope for a frontend-only
phase):**

- **C-25** — `getJournal` (the `:id` detail route) resolves by `{id, orgId}` alone, with **no branch
  predicate at all**, unlike every other accounting detail route in this registry and unlike
  `listJournals` (which does filter by branch, albeit with the pre-existing BGB3-L3 strict-equality
  defect). A journal id copied from one branch's list is still readable by the *same* id under a
  *different* branch's `X-Branch-Id` header. Mitigated client-side: `isJournalReadableInBranch()`
  compares the fetched journal's own `branchId` against the active branch and renders "unavailable"
  on a mismatch — the same MP0-12 fail-safe Track B4 used for cross-branch report runs — rather than
  trusting the backend to have already refused.
- **C-26** — `ledger.service.ts`'s six `audit.log(...)` calls (`JOURNAL_CREATED`, `JOURNAL_REVERSED`,
  `POSTING_RUN_STARTED`, `POSTING_RUN_FINISHED`, `POSTING_ERROR_CREATED`) stamp `metadata.orgId` but
  **never `metadata.branchId`**. Batch 3's B5-F4 fix made `GET /api/audit/timeline`'s default read
  unconditionally AND `metadata.branchId = X-Branch-Id`, so this rail can **structurally never**
  surface a ledger-domain event — proven live by creating 8 fresh journal/reversal/posting-run/
  posting-error events via this phase's own fixtures and finding every one of the resulting
  `AuditLog` rows' `branchId` is `NULL` (direct `psql` query against the isolated database, §3). This
  is not a data-freshness gap — it reproduces on data created seconds earlier through the live API.
  The Audit trail screen's empty state and footnote **name the gap explicitly** rather than reading
  as "nothing happened" (verified live and by Playwright, §6).

Also disclosed, a smaller but real gap: **B5.4-D1** — there is genuinely **no resolve/dismiss
endpoint for `PostingError` anywhere in the API**, for any role (confirmed by grepping every
`apps/api/src/modules/**/*.controller.ts` for a mutation on this entity: none exists; only
`pos:accounting:posting-errors:read` is seeded, no `:resolve`/`:dismiss`/`:write` string exists at
all). The Posting errors detail therefore does **not** reuse `AccountingReadOnlyCard`'s "an Owner or
Accountant performs this" copy — that would be false here — and instead states the genuine API gap in
its own words ("No role can act on this record … a genuine gap in this API").

---

## 2. Scope checklist against the roadmap's real B5.4 row

| Requirement | Status |
| --- | --- |
| Journal entries: list + detail with entry lines, debit/credit columns, balanced-entry indication | ✅ shipped — separate Debit/Credit columns, a Balance tie-out card computing the header total AND a fresh line-sum independently, `isJournalBalanced()`/`sumJournalLineAmounts()` |
| Posting runs, posting errors, the audit-trail rail | ✅ all three shipped, exactly as `menu.ts` scoped B5.4 |
| General ledger / trial balance | ✅ **correctly NOT built** — no such endpoint exists (§0); "General ledger" is the Journal entries list, matching what the B5.1 dashboard card already counted |
| Fiscal periods, period close runs, posting source maps, tax configuration | ✅ **correctly NOT built** — B5.5/B5.6 per `menu.ts`'s own tags (§0); still honest not-yet rows, phase tags unchanged |
| Money presentation: never a single signed column; UGX zero-fraction; totals tie out | ✅ Debit/Credit are always two columns; `formatAccountingMoney` (the one shared formatter, zero-fraction UGX); live tie-out proof in §3 |
| Wire the B5.1 "General ledger" dashboard card to the real surface | ✅ `ledger.journals`/`ledger.postingRuns`/`ledger.postingErrors` KPI bindings now carry a real `drillIn` (were `noDrillInReason: NOT_YET("B5.4", …)`); the card's copy updated, no logic change |
| Fiscal period dashboard card | **Correctly untouched** — it stays `NOT_YET("B5.5", …)`; wiring it now would be unauthorised B5.5 work |
| Reuse the B5.1–B5.3 shared primitives; no new component family | ✅ `AccountingListScreen`, `ManagerListTable`/`ManagerBreadcrumbs`/`ManagerSearchFilterMenu`/`ManagerFilterChip`, `AccountingFieldRow`/`AccountingBackLink`/`AccountingReadOnlyCard`, `toAccountingPager`, `accountingStatusTone` |
| C-23 disclosure (no Postman verification for journals) | ✅ stated here (§8) and in the roadmap; the M33 collection was **not** touched |

---

## 3. Fixtures created, live shape drift, and the tie-out proof

Created live via the API on the isolated stack, using the **Owner** token (`owner@nimbus.demo` —
Manager holds no accounting write) against **Tapas Downtown** (`cb27be401a2c35dfc0d4e610`), which
already carried 5 real journals from `db:demo:import` (`journals: 42` in the import summary, spread
across all 6 branches by the seed/import scripts, which bypass the audit-log service layer entirely):

- **`JNL-000044`** — a manual 2-line balanced journal (Cash on Hand DEBIT / Sales Revenue CREDIT, UGX
  620,000 each). This is the record toured in the live browser QA below.
- **`JNL-000045`** → **reversed** into **`JNL-000046`** — proves the `Reverses`/`Reversed by` linkage
  renders and navigates in both directions, and that a `REVERSED` status badge renders distinctly.
- **`POST /accounting/posting/replay`** with `sourceKey: "DEPOSIT_COLLECTED"` (a real, active posting
  source map) → **SUCCEEDED** posting run, auto-created journal `JNL-000047` (UGX 0.01 — small enough
  to round to "UGX 0" under the shared zero-fraction UGX formatter, confirmed intentional, not a bug).
- **`POST /accounting/posting/replay`** with an unknown `sourceKey` → **FAILED** posting run + one
  **OPEN** `POSTING_FAILED` posting error, code+message+`details.stack` all real.

**Final Tapas Downtown counts**: **9** journals, **2** posting runs (1 SUCCEEDED, 1 FAILED), **1**
posting error (OPEN). Rooftop Bar was independently confirmed to carry its own **8** unrelated
journals and **0** posting runs/errors — proving a branch switch re-scopes to genuinely different data,
not a client-side filter (§6, and pinned by the new Playwright branch-switch spec).

**The tie-out proof** (`JNL-000044`, live screenshot viewed): Header total debit **UGX 620,000** =
Sum of debit lines **UGX 620,000**; Header total credit **UGX 620,000** = Sum of credit lines
**UGX 620,000**. The list page's own column-totals row independently confirms the same invariant
across all 9 journals on the page: **This page — UGX 5,574,000 / UGX 5,574,000** (debit total exactly
equals credit total). Both figures are computed by genuinely separate code paths — the journal's own
stored total field, and a fresh client-side reduction over `lines[]` — so the agreement is a real
proof, not two reads of the same number.

**Live shape drift found**: none for the four GET routes this phase reads — every field `types.ts`
declares (`JournalRow`/`JournalDetail`/`JournalLineRow`/`PostingRunRow`/`PostingErrorRow`/
`PostingErrorDetail`/`AuditTimelineItem`) was confirmed present, correctly named and correctly typed
against real, freshly-created API responses, not just against the source code read during design.

---

## 4. C-25 and C-26 — the discovery method, in full

Both findings were discovered the same way every prior B5.x finding was: by consuming the endpoint
this phase's own code needed to render, not by auditing the backend independently.

- **C-25** was noticed while writing `getJournal`'s Prisma query in `ledger.service.ts` during route
  design (`where: { id: params.journalId, orgId: params.orgId }` — no `branchId`), then **confirmed
  live**: a journal id fetched under Tapas Downtown's header remained readable when the same id was
  requested with Rooftop Bar's `X-Branch-Id` (curl, isolated stack, not screenshotted since it is a
  negative-space proof).
- **C-26** was noticed when the Audit trail screen's own list rendered empty against a branch that had
  *just* received 8 real journal/posting-run/posting-error events from this phase's own fixtures
  (§3). A direct `psql` query against the isolated database's `audit_logs` table confirmed: of 26
  total rows (all from this session — seed/demo-import writes bypass the service layer's `audit.log`
  entirely, confirmed separately), **zero** carry a non-null `metadata->>'branchId'`, and the six
  `ledger.service.ts` `audit.log(...)` call sites were then read directly and confirmed to omit
  `branchId` from every metadata object they build.

Both are recorded in `route-registry.ts` by name (`accounting.journal`'s note cites C-25;
`audit.timeline`'s note cites C-26) and pinned by new `manager-b5-assertions.ts` §14 checks so neither
disclosure can silently regress.

---

## 5. Read-only proof

Manager holds the same 15 accounting read strings and zero writes as B5.1–B5.3 (PC-01/OD-9 unchanged;
no permission touched). Live-verified: `POST /accounting/journals`, `POST /accounting/journals/:id/
reverse` and `POST /accounting/posting/replay` all → **403** for Manager (re-confirming B0 §3.4 on
this isolated stack).

- Row selection, pagination and filtering are callback PROPS into already-built chrome components —
  no `onClick=`/`<Button`/`<IconButton`/`type="submit"` literal exists anywhere in
  `components/manager/accounting/core/` or `components/manager/accounting/review/`.
- `manager-b5-assertions.ts` §14 (new): all four B5.4 routes stay declared `data-total`/
  `serverTotal: true`; `audit.timeline`'s registry `scope` is INVERTED to `"branch"` (was
  `"organization"`, a stale B5.1-era note — batch 3 fixed the underlying behaviour, this pass
  corrected the stale label); journal/posting-error status filters go through `readManagerEnum(`;
  the audit trail's entity filter goes through a locally-validated closed set
  (`readAuditEntityType`/`AUDIT_ENTITY_TYPES`); Posting runs offers **no** filter menu at all (the
  endpoint supports none — a client-side filter over one page of a real paginated list would
  misrepresent completeness, unlike the PC-06 bare-array precedent); the journal detail table always
  renders separate `debit`/`credit` columns; `isJournalBalanced`/`sumJournalLineAmounts`/
  `isJournalReadableInBranch` are exercised against concrete vectors including the fail-closed and
  fail-safe cases; `ACCOUNTING_DENIED_WRITES` now names posting-run replay, not only journal
  post/reverse; Posting errors never renders `AccountingReadOnlyCard` and states the B5.4-D1 gap in
  its own words; the C-25 and C-26 disclosures are pinned by name.
- Live network capture during the manual QA tour and the automated `core-and-review.spec.ts` GET-only
  spec: every request across the four new surfaces was `GET` or `OPTIONS` (CORS preflight) — zero
  `POST`/`PATCH`/`PUT`/`DELETE`.

---

## 6. Live browser QA (isolated stack, Manager login)

Logged in as `manager@nimbus.demo` (Daniel Okello, Tapas Downtown, per `demo-data/DEMO_LOGIN_
CREDENTIALS.md`), toured all four new pages plus the dashboard's updated General ledger card:

1. **Dashboard** — General ledger card now reads "9 · Journal entries in this branch", "2 · Posting
   runs recorded", "1 · Posting errors outstanding" (danger tone, non-zero) — all three now real
   links (previously inert). Clicking "9" opened Journal entries.
2. **Journal entries list** — 9 rows, JNL-000045 shown with a `Reversed` (amber) badge, JNL-000046
   (its reversal) `Posted`, JNL-000047 (replay-created) `Posted`; column-totals row **UGX 5,574,000 /
   UGX 5,574,000**, balanced.
3. **Journal detail (JNL-000044)** — separate Debit/Credit columns (dashes on the non-applicable
   side, never a signed number), Balance tie-out card showing all four figures agreeing at
   UGX 620,000, `Balanced` badge, read-only card naming posting/reversing/replaying.
4. **Reversal linkage** — JNL-000045's detail showed `Reversed by → JNL-000046`; clicking it
   navigated to JNL-000046, whose detail showed `Reverses → JNL-000045` and its lines correctly
   flipped (Inventory DEBIT↔CREDIT relative to the original).
5. **Posting runs list** — 2 rows (`FAILED`/`Succeeded` badges), no filter control of any kind, the
   `SUCCEEDED` row's journal (`JNL-000047`) rendered as a working link back into Journal entries.
6. **Posting errors list → detail** — 1 `OPEN` row; detail rendered the full `code`/`message`/
   `details` JSON (including the raw stack trace, passed through honestly, not reformatted) and the
   **"No role can act on this record"** disclosure card (B5.4-D1) — distinct wording from
   `AccountingReadOnlyCard`, confirmed absent on this screen.
7. **Audit trail** — genuinely empty (0/0), with the C-26 disclosure visible in both the empty-state
   card and the page footnote — confirmed this reads as "a verified gap", not "nothing happened".
8. **Branch switch (Tapas Downtown → Rooftop Bar)** — Journal entries re-scoped to a **different**
   8-row set (none of the Tapas fixtures), column totals recomputed to **UGX 8,223,600 /
   UGX 8,223,600**, still balanced — a genuine re-scope, not a client filter.
9. **Accounting dropdown menu** — Journal entries live under "Accounting"; Fiscal periods/Period
   close runs still greyed with `B5.5` tags; Posting runs/Posting errors/Audit trail live under
   "Review"; Budgets vs actuals/Demand calendar still greyed with `B5.6` tags — visual confirmation
   of the §0 scope correction.

**Console errors**: zero, across every page (checked via `read_console_messages` after a fresh
navigation on each surface). **Request budget**: the Journal entries list issues exactly **1** real
GET (`/accounting/journals?skip=0&take=25`) plus the shared shell's pre-existing `/auth/me`/
`/reports/catalog`/`/devices` readiness reads — no duplicate or storm; Posting runs and Posting
errors each issue exactly **1** real GET.

---

## 7. Files

**New — `components/manager/accounting/core/`:** `JournalsScreen.tsx` (list + detail).

**New — `components/manager/accounting/review/`:** `PostingRunsScreen.tsx` (list only),
`PostingErrorsScreen.tsx` (list + detail), `AuditTrailScreen.tsx` (list only).

**New — `pages/manager/accounting/`:** `journals.tsx`; **`pages/manager/accounting/review/`:**
`posting-runs.tsx`, `posting-errors.tsx`, `audit-trail.tsx` (2-line `GetServerSideProps` +
`ManagerShell` wrapper, matching every prior B5 page's exact pattern).

**New — QA:** `e2e/manager-accounting/core-and-review.spec.ts` (13 new specs).

**Modified:**
`lib/accounting/types.ts` (six new/extended types: `JournalLineRow`/`JournalRow`/`JournalDetail`/
`PostingRunRow`/`PostingErrorRow`/`PostingErrorDetail`/`AuditTimelineItem`/`AuditTimelineResponse`;
four new status/entity-type enum const arrays) ·
`lib/accounting/api.ts` (`listJournalsRequest`/`getJournalRequest`/`listPostingRunsRequest`/
`listPostingErrorsRequest`/`getPostingErrorRequest`/`getAuditTimelineRequest`; a distinct
`AUDIT_TIMELINE_PAGE_SIZE`/max, since the audit endpoint's own ceiling (200) differs from the shared
accounting clamp (100)) ·
`lib/accounting/routes.ts` (4 new route constants) ·
`lib/accounting/menu.ts` (4 rows turned `available:true`; docblock records the §0 scope correction) ·
`lib/accounting/route-registry.ts` (`audit.timeline`'s stale `scope: "organization"` INVERTED to
`"branch"` with the C-26 note; `accounting.journal`'s note gained the C-25 disclosure;
`ACCOUNTING_DENIED_WRITES` gained a "Replay a posting run" entry) ·
`lib/accounting/model.ts` (four new status-tone entries on the ONE shared map; `isJournalBalanced`/
`sumJournalLineAmounts`/`isJournalReadableInBranch`; three `ledger.*` KPI bindings gained a real
`drillIn`) ·
`lib/manager/accounting-surface-queries.ts` (six new React Query hooks) ·
`components/manager/accounting/cards/AccountingLedgerCard.tsx` (docblock update only, no logic
change — the card already rendered through the KPI bindings, which now carry real links) ·
`scripts/manager-b5-assertions.ts` (page/menu-count updates 16→20 pages, 15→19 available rows; new
§14 of B5.4-specific checks) ·
`e2e/manager-accounting/{fixtures.ts,menu-and-read-only.spec.ts}` (4 new route constants + 2
status-value arrays; menu-row-count/order assertions updated 15→19, not-yet-label list re-picked) ·
`docs/UI_SYSTEM.md` (new §8h — the debit/credit-column and org-level-labelling patterns) ·
`docs/manager-ui-docs/MANAGER_API_MATRIX.md` (new "Consumed by B5.4" section).

---

## 8. Validation

Isolated local Docker stack — Postgres 16 on **`:55460`** (`nimbus_b54_qa`), API on **`:4071`**, web
(`next start`, production build) on **`:3160`**. **Shared Neon was never connected to or written.**
`apps/api/.env` was never edited on disk (the isolated database target was supplied by an explicitly
constructed child-process environment, per the documented isolation rule — `apps/api/.env` SHA-256
**`0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b`**, unchanged throughout).
`packages/db/.env` **was** temporarily swapped for the Prisma CLI steps (`migrate deploy`/`db:seed`/
`db:demo:import`) — the documented, unavoidable exception (`docs/TESTING_AND_QA.md`: "unlike the
NestJS API, the Prisma CLI resolves `DATABASE_URL` from the `.env` file next to `schema.prisma`
regardless of an inline shell override or a `dotenv-cli -o` override — the opposite failure
direction"; `dotenv-cli -e <scratch> -o --` was tried first and confirmed **not** to override Prisma's
own internal env load on this Prisma version) — restored immediately after the three CLI commands
completed, verified byte-identical: SHA-256
**`2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75`**, matching the pre-change
baseline exactly.

| Gate | Result |
| --- | --- |
| `typecheck` | ✅ 0 errors |
| `lint` (`next lint`, no `--fix`) | ✅ 0 warnings, 0 errors |
| `build` | ✅ compiled; `/manager/accounting/journals` 3.21 kB, `/manager/accounting/review/posting-runs` 2.36 kB, `/manager/accounting/review/posting-errors` 2.41 kB, `/manager/accounting/review/audit-trail` 1.54 kB |
| Assertion scripts | ✅ **17/17** (`manager-b5-assertions.ts` extended with the new §14; no other script touched) |
| `e2e/manager-accounting/core-and-review.spec.ts` (new, 13 specs) + `e2e/manager-accounting/menu-and-read-only.spec.ts` (updated, 15→19 row count) | ✅ **81 passed / 3 skipped / 0 failed** across all 4 viewports (84 total, 3.9 min) — the 3 skips are the pre-existing "desktop dropdown only at `xl`" reason at `vp-1024x768`, unrelated to B5.4 (the same skip class B5.1–B5.3's own menu specs already carry) |
| `e2e/manager-accounting/` full regression | ✅ **72 passed / 7 skipped / 0 failed** (79 total) at `vp-1440x900` — customers/vendors/bank/dashboard/reporting/capture-evidence/branch-scope-and-failure specs untouched by this phase, all still green |
| `e2e/manager-shell/` regression | ✅ **34/34** at `vp-1440x900` — includes the cross-role boundary suite (waiter/cashier/supervisor cannot open Manager; Manager cannot open their workspaces), branch switcher, top-nav keyboard operation |
| `/api/health` | ✅ `ok` throughout |
| `git diff --check` | ✅ clean |

**Not run in this pass:** newman/Postman — **C-23 disclosure**: the M33 GL collection cannot run
(`{{accountId}}` never resolves, a pre-existing defect proven pre-existing by backend gap batch 2), so
the journals surface ships **without Postman verification**, exactly as B5.3's completion report
warned. This was **not** silently "fixed" as part of B5.4 — it stays a Track C item. The API Jest
suite was not run (no backend file touched).

⚠️ **Disclosed: an unrelated host-level Docker Desktop instability interrupted Playwright TWICE during
this pass.** Partway through both the `core-and-review.spec.ts`/`menu-and-read-only.spec.ts` 4-viewport
run and, separately, the full-suite regression run, the host's Docker daemon itself became unreachable
(`Cannot connect to the Docker daemon` — confirmed via `docker info` both times, and confirmed both
times to affect every other container on the host, including unrelated `supabase_*`/`cinemax-*`
projects this session never started, all of which auto-restarted on the same recovery events). This was
a **host infrastructure event, not caused by this session's work** — no command this pass issued stops
or restarts Docker, and the crashes recurred even after the first recovery, indicating a pre-existing
host-level Docker Desktop stability issue independent of this session's load. Recovery (repeated
identically both times): `open -a Docker` (daemon back in ~5s), `docker start nimbus-b54-qa` (the
container carries no restart policy, so it had to be started explicitly, unlike the other projects'
auto-restarting containers), waited for Postgres crash-recovery (~1–2s, WAL replay), then verified **all
B5.4 QA data survived intact both times** (`journal_entries` 49 rows, `posting_runs` 4, `posting_errors`
2 — org-wide counts, matching every fixture created in §3, unchanged across both incidents) before
re-running the interrupted Playwright pass from a clean start. The isolated API auto-reconnected to
Postgres without needing a restart, both times. No other host container or process was touched. All
Playwright runs reported in §8 are from the final, clean re-run after both incidents — no result in
this report was collected mid-incident.

---

## 9. Defects found and fixed **in** this phase

| # | Defect | Fix |
| --- | --- | --- |
| **B5.4-D1** | No endpoint exists anywhere in the API to resolve or dismiss a `PostingError` — for any role, not only Manager (confirmed by grepping every controller). `PostingErrorsScreen` would have misrepresented this as a Manager-specific permission gap by reusing `AccountingReadOnlyCard`'s "an Owner or Accountant performs this" copy. | A distinct disclosure card states the genuine API gap in its own words ("No role can act on this record … a genuine gap in this API. `OPEN` is effectively terminal until a resolve/dismiss route is added."); pinned by a `manager-b5-assertions.ts` §14 check that `AccountingReadOnlyCard` never appears on this screen. |
| **Stale registry note** | `route-registry.ts`'s `audit.timeline` entry, written in B5.1 before backend gap batch 3 landed, still said the endpoint ignored `X-Branch-Id` and was organisation-scoped. Batch 3's B5-F4 fix made this false. | INVERTED, not deleted, per house style — `scope` corrected to `"branch"`, the note explains the fix and the date, and a new §14 assertion pins the correction so it cannot silently revert. |

---

## 10. Findings recorded, none implemented

**C-25** (getJournal has no branch predicate — cross-branch reachable by id) and **C-26**
(`ledger.service.ts`'s audit.log calls never stamp `metadata.branchId`, so the Audit trail rail can
never surface a ledger-domain event) are both new, live-proven this phase, recorded in
`route-registry.ts` by name, and **not implemented** — both require a backend change, out of scope for
a frontend-only phase. **B5.4-D1** (no posting-error resolve/dismiss endpoint for any role) is
likewise recorded, not implemented. B5.1–B5.3's carried-forward findings (PC-01, PC-02, PC-06, PC-07,
BGB3-L3, C-23) are unaffected by this phase and remain open exactly as prior passes left them.
**BGB3-L3** is specifically relevant here: `listJournals`/`listPostingRuns` still use strict
`where.branchId = branchId` on a nullable column, which this phase's own fixtures did not trigger
(every fixture journal/run was created with an explicit `branchId`) but remains a latent gap for any
org-level ledger row.

---

## 11. Deferred, and gated

- **B5.5 (Closing — fiscal periods, period close runs) is NOT started.** Model `DRAFT → OPEN →
  CLOSED → LOCKED` with no unlock route (PC-07); both models are organisation-level by design (batch
  2) and must be LABELLED as such, not silently presented as branch data — the org-level-labelling
  pattern this phase's screens never needed is exactly what B5.5 will need.
- **B5.6 (the remainder — Chart of accounts, Cost centres, Posting source maps, Tax configuration,
  Budgets vs actuals, Demand calendar, Forecast) is NOT started.**
- Do not grant Manager any accounting write (PC-01/OD-9) — journal post/reverse and posting replay
  were all re-verified live at 403 for Manager in this phase.
- Do not fix C-25 or C-26 as an incidental side-effect of B5.5/B5.6 work without separate
  authorisation — both are backend changes (adding a branch predicate to `getJournal`; adding
  `branchId` to six `audit.log` calls) and out of scope for a frontend-only phase.
- Do not add a resolve/dismiss control for posting errors without first confirming a real endpoint
  has been added — B5.4-D1 established that none currently exists for any role.
- Do not attempt to "fix" the M33 Postman collection as an incidental part of a later phase — C-23
  stays a separately-authorised Track C item.
