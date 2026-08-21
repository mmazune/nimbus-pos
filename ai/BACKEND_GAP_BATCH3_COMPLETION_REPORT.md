# Backend gap batch 3 — accounting read-integrity fixes (B5-F1…F4)

**Date:** 2026-08-21
**Phase:** Track C (`ai/ENTERPRISE_UI_ROADMAP.md`) — **C-24**, owner-authorized backend milestone.
**Status:** **COMPLETE**
**Gate:** B5.2 (Customers + Vendors lists) is **unblocked on read integrity** but remains **NOT
started** without separate owner authorisation.

**Scope of change:** backend source + tests + docs, plus a minimal, explicitly-authorized frontend
follow-through (one model function simplified, one card docblock/footnote corrected, two assertions
inverted). **No Prisma schema change, no migration, no seed change, no permission change, no DTO
contract-shape change** (field names are unchanged; only validation/bounds/aggregation-source
changed). Validated on an isolated local Docker stack; **shared Neon was never connected to or
written**.

---

## 1. Headline

Track B5.1 (`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`) shipped the Manager
Accounting dashboard and, in doing so, found four read-integrity defects in routes the dashboard
now actually calls: **B5-F1** (🔴 the AR aging summary was wrong on any branch with more open
invoices than one page), **B5-F2** (🔴 an invalid status filter 500'd instead of 400ing), **B5-F3**
(⚠️ no route had a real server-side page-size maximum), and **B5-F4** (⚠️ the audit timeline ignored
branch context). This batch fixes all four at the source, sweeps every sibling route with the same
defect class, and proves — with real numbers, not just green checkmarks — that the fix works
regardless of dataset size.

**The headline number:** on a live 125-invoice branch (true receivable total **UGX 10,306,400**),
the pre-fix formula would have shown **UGX 10,000** — a single invoice's worth — at the page size
the frontend actually requests when the page happens to be small. The fix shows the correct
10,306,400 at `take=1`, `take=3`, and `take=100` alike. This was reproduced both as a unit test
(synthetic data) and live against the isolated stack (real data, real HTTP calls, real screenshot).

---

## 2. FIX 1 — B5-F1: `ar/aging.summary` now aggregates the full `where`, not the returned page

**Root cause.** `AccountsReceivableService.getAgingSummary()` fetched one paginated page of open
invoices (`skip`/`take`) and reduced `summary.*` from that same page — while `total` came from a
separate, unpaginated `count()`. The two numbers were computed over different result sets, and only
one of them was ever guaranteed to be branch-complete.

**Fix.** A third query — unpaginated, minimal columns (`dueDate`, `outstandingBalance` only) — runs
in the same `Promise.all` over the identical `where` clause, and `summary.*` is now reduced from
that query instead of the paginated one. `accounts[]` (the per-customer display breakdown) is
unchanged and stays genuinely page-limited — pagination on a *display list* is normal; pagination on
a *money total* was the bug.

**Unit proof (`accounts-receivable.service.spec.ts`).** A five-invoice synthetic dataset summing to
the exact historical repro figure (UGX 9,106,400) is queried at `take=1`, `take=3`, and unpaginated:

| `take` | `summary.totalOutstanding` | `accounts[]` returned |
| --- | --- | --- |
| 1 | 9,106,400 | 1 |
| 3 | 9,106,400 | 3 |
| unpaginated | 9,106,400 | 5 |

Identical total at every page size; only the display page varies. `total` (the count) is unaffected.

**Live proof, real dataset exceeding the page size.** 120 additional invoices (UGX 10,000 each,
`sourceDocumentId: "B0-QA-<n>"`, tagged in `notes`) were created via `POST /accounting/ar/invoices`
against the isolated stack's Tapas Downtown branch, bringing it to 125 open invoices. SQL ground
truth: `count=125, sum=10,306,400.00`. Live API:

| `take` | `total` (count) | `summary.totalOutstanding` | invoices on the returned page |
| --- | --- | --- | --- |
| 1 | 125 | **10,306,400** | 1 |
| 3 | 125 | **10,306,400** | 3 |
| 100 | 125 | **10,306,400** | 100 |
| 125 | — | **400 (bounded, FIX 3)** | — |

The single invoice on the `take=1` page is worth UGX 10,000 — that is what the **pre-fix** formula
would have summed and shown as the entire branch's receivable balance, a ~99.9% understatement.

**Frontend follow-through (minimal, required).** `apps/web/src/lib/accounting/model.ts`'s
`isArAgingComplete()` used to *require* the returned page to carry every matching invoice before
showing any money — the UI-side mitigation for the backend bug. Now that the backend guarantees
`summary` correctness unconditionally, that gate would have started **incorrectly withholding** a
now-correct balance on any branch with more than 100 open invoices (the frontend's own page size).
The function is simplified to a well-formed-response guard (response present, `total` and `summary`
readable, `accounts` is an array) with no page-completeness requirement.
`AccountingReceivableCard.tsx`'s docblock and footnote copy were updated to describe the fixed
contract; the withheld-state markup is **kept** as a malformed-response fallback (B4-D1's "a missing
number survives review better than a wrong one" lesson still applies to a genuinely broken read).

**Live browser proof.** Logged into the isolated stack's Manager UI as `manager@nimbus.demo`
(Tapas Downtown), navigated to `/manager/accounting/dashboard` with the 125-invoice dataset live:
the Customers — receivable card renders **UGX 10,306,400 / 125 open invoices / 1 customer with a
balance**, zero console errors. See §7 for the screenshot description.

**Playwright spec updated to match the fixed contract.**
`e2e/manager-accounting/branch-scope-and-failure.spec.ts` had a test — "a partial AR aging page
withholds the balance instead of understating it (B5-F1)" — that mocked the exact pre-fix bug shape
(`total: 9`, one invoice on the page, `summary.totalOutstanding` derived from that one invoice) and
asserted the card withheld the money. That is no longer the correct behaviour: the mocked response
is well-formed, so the fixed frontend now trusts and renders it. The test is **inverted, not
deleted** (renamed to state the 2026-08-21 inversion and the reason), and now asserts the balance
**renders** instead of being withheld.

---

## 3. FIX 2 — B5-F2: unvalidated `status`/`type` filters swept across seven endpoints

**Root cause.** `GET /accounting/ar/invoices?status=<value>` took `status` as a raw `@Query()`
string and handed it straight to Prisma. `InvoiceStatus` doesn't have every value
`VendorBillStatus` has (e.g. `OVERDUE`), so an unrecognised value threw inside Prisma and surfaced
as a 500, not a 400.

**Sweep.** Every accounting/finance list controller was checked for the same
raw-string-to-Prisma-`where` pattern. Seven fields across seven endpoints shared it; all seven now
validate with `@IsEnum` DTOs (matching the pattern `ap/bills` and `journals` already used):

| Route | Field(s) fixed | Enum |
| --- | --- | --- |
| `GET /accounting/ar/invoices` | `status` | `InvoiceStatus` (new `ListInvoicesQueryDto`) |
| `GET /accounting/ar/credit-notes` | `status` | `ArCreditNoteStatus` (new `ListArCreditNotesQueryDto`) |
| `GET /accounting/ap/payments` | `status` | `VendorPaymentStatus` (new `ListApPaymentsQueryDto`) |
| `GET /accounting/ap/credit-notes` | `status` | `CreditNoteStatus` (new `ListApCreditNotesQueryDto`) |
| `GET /accounting/ap/suppliers` | `counterpartyType` | `CounterpartyTypeDto` (new `ListSuppliersQueryDto`) |
| `GET /accounting/posting-errors` | `status` | `PostingErrorStatus` (new `ListPostingErrorsQueryDto`) |
| `GET /finance/procurement-suggestions` | `status`, `urgency` | `ProcurementSuggestionStatus` + `ProcurementUrgency` (new `ListProcurementSuggestionsQueryDto`) |

**Test proof.** Five new DTO-level spec files (`plainToInstance` + `validateSync`, the
`list-leave-query.dto.spec.ts` precedent) assert, per route: an invalid value produces a validation
error (→ 400 at the controller), every real enum value validates clean (→ 200), and an omitted
filter validates clean (→ 200, unfiltered).

---

## 4. FIX 3 — B5-F3: a real server-side page-size maximum on every paginated accounting/finance route

**Root cause, re-diagnosed.** Track B0's original probe (`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`
§5) sent `take`+`pageSize`+`limit` together; `pageSize`/`limit` aren't DTO fields on these routes, so
`whitelist: true` 400'd on the unrecognised keys and the route was **misread as bounded**. Re-probed
with `take` alone: `ap/bills`, `ar/invoices`, `journals`, and `ar/aging` all returned **200 at
`take=5000`** — none had a real maximum. The bug was in the measurement, but the absence of a real
bound was itself real and needed fixing regardless.

**Fix.** A shared helper, `apps/api/src/common/pagination/list-bounds.ts` (`MAX_ACCOUNTING_LIST_PAGE_SIZE
= 100`, `clampTake()`), mirrors the existing `MAX_LEAVE_PAGE_SIZE` precedent in
`attendance.service.ts`: a DTO-level `@Max(100)` (rejects out-of-range input with 400) plus a
service-side `clampTake()` backstop (defensive — no caller, validated or not, can force an unbounded
read). Applied to all **fourteen** paginated accounting/finance list routes:

`ar/invoices` · `ar/aging` · `ar/credit-notes` · `ar/accounts` · `ap/bills` · `ap/suppliers` ·
`ap/payments` · `ap/credit-notes` · `ap/recurring-profiles` · `ap/reminders` ·
`accounting/accounts` · `journals` · `posting-runs` · `posting-errors`

`ap/aging` (genuinely unpaged by design — it reads every open bill for the branch, matching its
"branch total" contract) and the ten PC-06 bare-array routes (no `take` parameter exists) are
unaffected, as intended — this fix does not touch pagination behaviour that was never present.

**Test proof.** A `clampTake()` unit spec (`common/pagination/list-bounds.spec.ts`) plus DTO-level
specs per route assert `take=10000`/`take=5000` is rejected (400) while `take=100` (the max) and
normal paging (`take=25`, etc.) validate clean; `ledger.service.spec.ts` adds a service-level test
proving `listPostingErrors({ take: 10000 })` clamps to `take: 100` in the actual Prisma call while
`take: 25` passes through unchanged.

**Regression this fix caused, and the fix for the fix.** Backend gap batch 2's own
`accounting-branch-scoping.e2e-spec.ts` used `take=500` in fourteen places to fetch "everything" for
its tiny (1–3 row) fixtures. With a real 100-row maximum, `take=500` now correctly 400s. Updated to
`take=100` (still "all of it" for these fixtures) with a comment explaining the change — no
assertion was weakened, the fixture's own page size just moved to fit inside the new, correct bound.

---

## 5. FIX 4 — B5-F4: `GET /api/audit/timeline` now honours `X-Branch-Id`

**Root cause.** `AuditTimelineReadService.query()` only added a branch filter when the caller
explicitly passed `?branchId=`; by default every branch in the org was mixed into one read. No
frontend consumer exists yet (`route-registry.ts` cites it for the future B5.4 audit rail, not
mounted), and the `bg2-approvals-and-audit.e2e-spec.ts` e2e test never exercised branch isolation,
so nothing depended on the old behaviour.

**Fix.** The service now unconditionally ANDs `metadata.branchId = X-Branch-Id` (mirroring the
AR/AP "header scopes it; the query param survives as a narrowing filter inside that scope" pattern
from batch 2). If the caller also passes `?branchId=` and it disagrees with the acting branch, the
two ANDed equality clauses are unsatisfiable and the query correctly returns nothing — `?branchId=`
can no longer be used to read another branch's audit trail. `pageSize`/`page` pagination (already
bounded to 200 via `@Max`) is unchanged.

**Test proof.** A new `audit-timeline.service.spec.ts` (mocked Prisma) asserts: the default read
(no `?branchId=`) adds the acting branch's `AND` clause; a matching `?branchId=` is a no-op; a
disagreeing `?branchId=` ANDs *both* clauses (provably unsatisfiable, i.e. no leak); org scoping via
`callerCtx.organizationId` is unaffected.

---

## 6. Docs corrected

- `docs/manager-ui-docs/MANAGER_API_MATRIX.md` — new dated section marking B5-F1…F4 fixed; the
  original "Corrections to earlier records" bullets for B5-F1/F2/the pagination-bound note/audit
  timeline are struck through with `FIXED 2026-08-21 (batch 3)` pointers. The `ap/aging` → `billCount`
  and `ar/receipts`/`manual-bank-entries` POST-only notes were **already correct** in this file from
  the B5.1 pass — confirmed unchanged, not re-written.
- `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` — §5's shape/pagination table corrected (`ap/aging`
  field name, the stale `take=5000` column marked corrected-and-superseded with an explanation of
  *why* the original probe was wrong); §7's findings table gained B5-F1…F4 rows, all marked FIXED;
  §9's verdict section gained a batch-3 update block (mirroring the existing batch-2 block); §10's
  audit-timeline row annotated fixed.
- `ai/ENTERPRISE_UI_ROADMAP.md` — new Track C row **C-24** (DONE); the B5 summary row and the B5.4
  sub-phase row updated to reflect the fixes; the Track C rollup line extended to `C-01…C-24`.
- `docs/KNOWN_LIMITATIONS.md` — new "Backend gap batch 3" block in the same style as batches 1/2,
  including a **BGB3-L3** finding recorded-not-fixed (see §8) and the `accounting-branch-scoping`
  test's `take=500`→`take=100` update (**BGB3-L2**).

---

## 7. Frontend follow-through — multi-page dataset proof

Per the owner brief, the Receivable and Payable cards were re-verified against a dataset **larger
than one page** on the isolated stack (not the primary QA database — a second isolated Postgres +
API + web trio, so the primary stack used for the API e2e/unit regression comparisons stayed
pristine).

- **Seeded:** 120 additional invoices (UGX 10,000 each) on Tapas Downtown via the live
  `POST /accounting/ar/invoices` endpoint, `sourceDocumentId: "B0-QA-<n>"`, tagged in `notes` as
  "B0-QA multi-page dataset proof (backend gap batch 3)". Branch total after seeding: **125 open
  invoices, UGX 10,306,400** (SQL ground truth, cross-checked against the live API in §2).
- **Before/after on the card:** logged into `/manager/accounting/dashboard` as
  `manager@nimbus.demo` (Manager, Tapas Downtown). The Customers — receivable card renders **UGX
  10,306,400**, **125** open invoices, **1** customer with a balance, aging bars matching the
  branch's real 1–30/31–60 distribution — the full branch figure, not a page subtotal. Zero browser
  console errors on load. The Vendors — payable card is unaffected (unpaged endpoint, never had the
  bug) and continued to show the unchanged UGX 1,282,400 / 3 open bills.
- **Card binding change:** `isArAgingComplete()` simplified (§2) plus docblock/footnote text
  corrections — no shape change, no new query, no new request.
- **Re-ran the accounting e2e:** `e2e/manager-accounting` Playwright suite against the primary
  (unmodified, pristine) isolated stack — see §9 for the run.

---

## 8. Findings recorded, **not implemented** in this batch

| ID | Severity | Finding |
| --- | --- | --- |
| **BGB3-L3** | Low | `LedgerService.listJournals`/`listPostingRuns` still use strict
`where.branchId = branchId` on **nullable** `JournalEntry.branchId`/`PostingRun.branchId` columns —
the exact PC-03 defect class (strict equality on a nullable column orphans org-level rows from every
branch at once). Out of this batch's authorised scope (B5-F1…F4 only, not a general branch-scoping
re-audit). A future pass should apply `branchOrOrgScope` here, matching `listPostingErrors`, which
already got this fix under PC-03. |
| **PC-06** | Low | Unchanged, still open. Ten bare-array accounting/finance routes have no `take`
parameter and no server `total`; this batch's pagination fix does not add pagination where none
existed. |
| **PC-01 / PC-02** | Medium | Unchanged. Manager still holds no accounting write; `procurement:advisory:read`
is still withheld from Manager because it also gates a mutation. |
| **C-23** | Low | Unchanged, still pre-existing. The M33 GL Postman collection cannot run
(`{{accountId}}` never resolved). |

---

## 9. Validation

Isolated local Docker stack — primary Postgres 16 `:55436` (`nimbus_b3`), API `:4041`, web `:3130`;
a second isolated Postgres `:55437` (`nimbus_b3b`), API `:4042`, web `:3131` for the multi-page
dataset proof only (kept separate so the 120 synthetic B0-QA invoices never touched the dataset used
for the e2e/unit regression comparisons). **Shared Neon was never connected to or written.**
`apps/api/.env` SHA-256 `0f7cfb12…`, `packages/db/.env` SHA-256 `2dad4d3c…` — **identical before and
after** (isolation via explicit child-process environment construction, matching `tools/qa/`
precedent; neither file was ever opened for writing).

| Gate | Result |
| --- | --- |
| `tsc --noEmit` (API) | ✅ 0 errors |
| API lint (touched files only, no `--fix`) | ✅ 0 new errors — 3 pre-existing errors in untouched files confirmed identical to `6e284e9` |
| Touched/new unit suites | ✅ **237/237** passed across 14 suites (7 new spec files: 5 DTO query-dto specs, `list-bounds.spec.ts`, `audit-timeline.service.spec.ts`; 3 touched: AR service, ledger service, AR/AP/ledger DTOs) |
| Full API unit suite, after | **1165 tests / 1161 passed / 4 failed** (64 suites, 63 passed) |
| Full API unit suite, `6e284e9` baseline (throwaway worktree) | **1104 tests / 1100 passed / 4 failed** (57 suites, 56 passed) — the same 4 `client-onboarding.service.spec.ts` failures, identical test names, proven pre-existing |
| AP/AR/branch-scoping e2e | ✅ **122/122** (after the `take=500→100` fixture fix in §4) |
| Full API e2e suite, after | **1043 tests / 922 passed / 121 failed** (50 suites, 35 passed) |
| Full API e2e suite, `6e284e9` baseline (same clean-DB recipe) | **1043 tests / 922 passed / 121 failed** — **byte-identical failing test-name set** (0 new failures, 0 failures fixed as a side effect) |
| Newman — M32 (Accounting Foundation) | ✅ 17 requests / 34 assertions / 0 failed |
| Newman — M34 (AP) | ✅ 23 requests / 46 assertions / 0 failed |
| Newman — M35 (AR) | ✅ 21 requests / 45 assertions / 0 failed |
| Newman — M36 (Bank-Rec/Period-Close) | ✅ 18 requests / 24 assertions / 0 failed |
| Newman — M37 (Budgets/Forecast/Procurement) | ✅ 24 requests / 44 assertions / 0 failed |
| Newman — BG2 (Unified Approvals + Audit Timeline) | ✅ 22 requests / 48 assertions / 0 failed |
| Newman — M33 (General Ledger) | 18 requests / 43 assertions / **20 failed — pre-existing C-23**, unaffected by this batch |
| Web `typecheck` | ✅ 0 errors |
| Web `lint` | ✅ 0 warnings, 0 errors |
| Web `build` | ✅ compiled; `/manager/accounting/dashboard` 7.57 kB |
| Assertion scripts | ✅ **17/17** (`manager-b5-assertions.ts` updated: two B5-F1 assertions inverted per §2, not deleted) |
| `e2e/manager-accounting` Playwright | ✅ **25/25** at `vp-1440x900` against the primary (pristine) isolated stack, after the two spec updates in §2/§4 (one B5-F1 assertion inverted per the fixed contract; one first-run failure did not reproduce on re-run in isolation or on a full clean re-run — dev-server timing flake, not a product defect) |
| `e2e/manager-dashboard` regression | ✅ **21/21** at `vp-1440x900` — B2 dashboard untouched |
| `/api/health` | ✅ `ok` on both isolated stacks throughout |
| Live money cross-check | Tapas Downtown pristine: receivable 9,106,400 / payable 1,282,400 / 5 journals — matches every prior pass exactly, confirming the fix changes correctness under load, not baseline values |
| Live money cross-check, 125-invoice dataset | receivable **10,306,400** at `take=1`/`3`/`100` (API) and on the rendered Manager dashboard card (browser) |
| Pre-existing dev servers | `:3000`, `:3001`, `:3003`, `:3008`, `:3009` verified running and healthy before and after; `:3001` `/api/health` → `ok` |
| `git diff --check` | clean |

**⚠️ Self-inflicted incident, caught and reverted before any test run relied on it:** the first
`pnpm lint` invocation used the package's own `--fix` script, which reformatted **193 unrelated,
untouched files** across the API tree (a pre-existing repo-wide prettier drift this batch did not
introduce and was not authorised to fix). Caught immediately via `git status`; every collateral file
was reverted to `HEAD` with `git checkout HEAD --`, verified by diffing the modified-file list
against the batch's own 23-file change list until they matched exactly. All subsequent lint checks
in this report ran targeted `eslint` (no `--fix`) against only the files this batch touches.

---

## 10. Deferred, and gated

- **B5.2 (Customers + Vendors lists) is unblocked on read integrity but remains NOT started.** Do
  not build a list, a record form, a pager, or any write control without explicit owner
  authorisation.
- **B5.3 / B5.4 / B5.5 / B5.6, B6, B7 are NOT started.**
- **BGB3-L3** (JournalEntry/PostingRun strict-equality-on-nullable-branchId) is recorded, not fixed
  — see §8.
- **PC-01/PC-02/PC-06/C-23 remain open, unaffected by this batch** — see §8.
- **Shared-Neon deploy remains gated**, same as batches 1 and 2 — none of batch 3's fixes have been
  applied there.
