# Backend Gap Batch 2 — PC-03 branch scoping + PC-04 duplicate-bill guard

**Date:** 2026-08-21
**Phase:** Track C, owner-authorized batch 2 — clears the two 🔴 blocking conditions on the
**B5 gate** recorded in `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` §9.
**Status:** **COMPLETE**
**B5 verdict:** 🟡 CONDITIONAL GO → 🟢 **GO** (see §8 — two 🟡 non-blocking conditions remain
recorded as B5 design decisions, exactly as B0 framed them).

**Scope discipline.** Backend source + tests + docs only. **No Prisma schema change, no migration,
no seed change, no permission change, no `demo-import.ts` change, no Postman collection edited, no
frontend file touched.** Validated on an isolated local Docker Postgres stack; **shared Neon was
never connected to or written**, and **neither `.env` was modified** (SHA-256 identical before and
after — §7).

---

## 1. What was blocking, and what the fix had to prove

B0 gave B5 a **conditional** go on two 🔴 findings:

| | Finding | Why it blocked B5 |
| --- | --- | --- |
| **PC-03** | Four accounting reads returned **another branch's rows** regardless of `X-Branch-Id`, plus list/detail pairs that disagreed about scope | *"An accounting UI that silently mixes branches is worse than no accounting UI."* |
| **PC-04** | The AP recurring-bill duplicate guard was **unreachable dead code**; a second call issued a **second bill for the same supplier** | B5.1 could not ship a "Generate bill" control at all |

Both are now fixed, and both are proven by executing the **same** test against the **unmodified code
at `bcbabd9`** and against this change on **equally clean databases**. A fix that is only asserted
after the fact is not evidence; every claim below has a measured "before".

---

## 2. FIX 1 — PC-03, per-entity rulings

The brief required that each entity be ruled on from **schema truth** rather than preference:
enforce branch scoping where the model carries `branchId`, and where a model is genuinely org-level
by design, **document that rather than invent a column**. Every model in the accounting block was
read out of `packages/db/prisma/schema.prisma` first.

That produced **three** categories, not two — and the third is the one B0's static scan conflated:

| Category | Schema | Rule applied |
| --- | --- | --- |
| **A — branch-owned** | `branchId String` (NOT NULL) | Strict equality: `branchId = <acting branch>` |
| **B — branch-owned, org-level allowed** | `branchId String?` (nullable) | `branchId = <acting branch> OR branchId IS NULL` |
| **C — org-level by design** | **no `branchId` column at all**, or a nullable column the write path never stamps | Left org-scoped, **documented**, sub-item of PC-03 **downgraded** |

**Category B is not a novel pattern.** `OR: [{ branchId }, { branchId: null }]` is already the
repo's predicate for nullable-branch models in `attendance`, `workforce`, `payroll`,
`staff-insights` and `analytics`. The alternative — strict equality on a nullable column — would
orphan every `NULL`-branch row from **every** branch simultaneously, which is a data-hiding defect,
not a scoping fix. The e2e asserts this directly (*"keeps org-level (NULL-branch) suppliers visible
from BOTH branches"*).

Both rules live in one new file, `apps/api/src/common/scope/branch-scope.ts`, so a list and its
detail sibling **cannot drift apart again** — they call the same helper with the same context.

### 2.1 The four entities PC-03 named

| Entity | Schema truth | Ruling | Before → After |
| --- | --- | --- | --- |
| **`ap/suppliers`** | `Supplier.branchId String?` — and the demo data stamps a branch on **every** supplier (`demo-import.ts` `17_suppliers.csv`), while `createSupplier` stamps `ctx.branchId`. Suppliers are branch-owned **in this product**, whatever ERP convention says elsewhere. | **B — branch + org-null.** Not downgraded: the schema, the seed data and the create path all say branch-owned. | Branch B saw branch A's supplier → **not listed**; detail **404** |
| **`ap/credit-notes`** | `CreditNote.branchId String?`, stamped on create | **B — branch + org-null** | Listed under branch B → **not listed** |
| **`ar/credit-notes`** | `ArCreditNote.branchId String?`, stamped on create | **B — branch + org-null** | Listed under branch B → **not listed** |
| **`bank-statements`** | `BankStatement.branchId String` — **NOT NULL** | **A — strict.** Unambiguous: there is no org-level statement to accommodate. | Listed under branch B → **not listed**; detail **404** |

⚠️ **A correction to B0.** The report stated *"`listBankStatements` is org-scoped while
`getBankStatement` is branch-scoped — the list shows another branch's statements, but opening one
404s."* Reading the source, **`getBankStatement` was org-scoped too** (`where: { id, orgId }`) — it
did **not** 404, it leaked as well. The pair did not disagree; both were wrong. Verified by running
the new suite at `bcbabd9`, where the detail assertion fails with a **200** where a 404 was expected.

### 2.2 Category C — org-level by design, downgraded with justification

| Surface | Why it is genuinely org-level | Evidence |
| --- | --- | --- |
| `accounting/periods` (`FiscalPeriod`) | **No `branch_id` column exists** on the model | e2e asserts both branches return byte-identical payloads |
| `accounting/posting-source-maps` (`PostingSourceMap`) | **No `branch_id` column** | same |
| `accounting/tax-config` (`TaxLedgerConfig`) | **No `branch_id` column** | same |
| `accounting/period-close-runs` (`PeriodCloseRun`) | Column is nullable but **the close path never sets it** (`bank-rec.service.ts` `periodCloseRun.create` omits `branchId`), so every row is `NULL` | e2e asserts `count(branchId IS NOT NULL) === 0` against the table, not merely against the endpoint |

**No `branchId` was invented for any of these.** B0's static list of "9 methods filtering on `orgId`
only" mixed these four in with the genuine leaks; they are now separated and each ruled on
explicitly. `getTaxLedgerConfig`, `listFiscalPeriods`, `listPostingSourceMaps` and
`listPeriodCloseRuns` are **unchanged by design**.

### 2.3 Extensions — same defect class, found while making the families consistent

The brief asked that the behaviour be *"consistent across its whole family"*. Applying that honestly
surfaced **more instances of the same defect than PC-03 recorded**, including three that are
strictly worse than a read leak because they are **writes**:

| Surface | What was wrong | Severity |
| --- | --- | --- |
| `GET /ap/bills/:id` | Detail resolved by `orgId` alone while its **list was already branch-scoped** — the MP0-12 shape, inverted | 🔴 read leak |
| `GET /ar/invoices/:id` | Same shape | 🔴 read leak |
| `GET /ar/accounts` | Honoured **only** the optional `?branchId=` query param and **ignored `X-Branch-Id` entirely** — so the default read every UI issues was org-wide. B0's scan missed it because a `branchId` filter *was* present; it just came from the wrong place. The query param now narrows **within** the header scope and can no longer be used as an alternative scope. | 🔴 read leak |
| `GET /ar/accounts/:id`, `GET /ap/suppliers/:id` | Org-scoped details | 🔴 read leak |
| `GET /ap/payments`, `GET /ap/recurring-profiles`, `GET /accounting/reconciliation` (+ detail) | `orgId` alone. `BankReconciliation.branchId` is **NOT NULL**, so this one had no excuse in the schema either. | 🔴 read leak |
| `GET /ap/aging`, `GET /ar/aging` | Aggregated **every branch's** open bills/invoices while the list beneath showed one branch's. A headline money figure that cannot be reconciled against the rows under it. | 🔴 **wrong money on screen** |
| `POST /ap/bills/:id/approve` | Resolved its target by `orgId` alone — **a cross-branch approval was reachable by id** | 🔴 **cross-branch write** |
| `PATCH /accounting/reconciliation/:id/match` and `/skip` | Same — a cross-branch match against another branch's books | 🔴 **cross-branch write** |
| `POST /ap/bills`, `/ap/payments`, `/ap/credit-notes`, `/ap/recurring-profiles`, `/ar/invoices`, `/ar/receipts`, `/ar/credit-notes`, `/bank-statements/import`, `/manual-bank-entries` | Referenced-entity lookups (supplier / customer / bill / invoice / bank account) resolved org-wide, so a document could be raised **against another branch's counterparty** | 🔴 cross-branch write |
| `GET /accounting/posting-errors/:id` | The one PC-03 item B0 could only verify **statically** (0 posting-error rows on the dataset). Now covered by a unit test asserting the list and detail predicates are identical. | 🟡 read leak |
| `GET /ap/bills`, `/ar/invoices`, `/ap/reminders`, `/accounting/posting-errors` | Used **strict** equality on a **nullable** column, hiding unattributed org-level rows from every branch at once | 🟡 data-hiding |

Fail-closed, twice over: the helpers **throw** rather than degrade to an org-wide read if a branch
is ever missing, and cross-branch targets return **404, never 403** — a 403 would confirm the id
exists in another branch (the **B3-F1** precedent from the permissions cutover).

### 2.4 Create paths verified to stamp the operating branch

Required by the brief. Every create path already took the branch from `req.branchContext.branchId`
(never from the body — the `reset()` defect B3-F1 closed has no analogue here). This is now
**asserted rather than assumed**: the e2e checks `res.body.branchId === branchA` on supplier, bill,
AP credit note, customer account, invoice, AR credit note, bank statement and reconciliation
creates.

### 2.5 PC-03 before → after

Executed twice — once against `bcbabd9` in a throwaway worktree, once against this change — using
the **same spec** and **the same isolated database**:

| | Failed | Passed |
| --- | ---: | ---: |
| `bcbabd9` (unmodified) | **19** | 12 |
| Backend gap batch 2 | **0** | **31** |

The 12 that passed at HEAD are exactly the creates (already stamping correctly), the org-level
supplier visibility case, and the two Category-C cases — i.e. the parts that were already right.

---

## 3. FIX 2 — PC-04, the duplicate-bill guard

### 3.1 Why the old guard could never fire

```ts
if (lastBill && lastBill.dueDate.getTime() === profile.nextDueDate.getTime()) throw new ConflictException(...)
```

The generating transaction **advances** `nextDueDate` to the following cycle in the same breath. So
after any generation the two values can never be equal again: the `ConflictException` was
unreachable dead code.

### 3.2 The fix — two checks, because one cannot do the job

Repairing the comparison alone does **not** produce a 409 on a repeat: after the first call the
profile points at the *next* cycle, for which no bill exists. Two independent checks are therefore
evaluated **before anything is written**:

1. **Cycle already billed.** Asks the **bill table** — *"does a bill generated from this profile
   already carry the due date I am about to bill?"* — instead of trusting the profile's own mutable
   pointer. This is the honest form of the original intent, and unlike the original it survives a
   `PATCH` that rewinds `nextDueDate`.
2. **Cadence has not elapsed.** A profile may produce at most one bill per cadence period of real
   time, measured from `lastGeneratedAt`. This is the check that makes an immediate repeat a 409.

The escape hatch for a genuinely extra bill is the ad-hoc route `POST /api/accounting/ap/bills`,
which is unaffected. This endpoint enforces the cadence the profile itself declares.

### 3.3 Before → after, with explicit numbers

The same probe — create one MONTHLY profile at 150,000 UGX, then click *Generate bill* three times —
run against both builds on from-scratch databases:

| | Call 1 | Call 2 | Call 3 | Bills issued | Billed to the supplier |
| --- | --- | --- | --- | ---: | ---: |
| **`bcbabd9`** | `200` → 1 bill | **`200` → 2 bills** | **`200` → 3 bills** | **3** | **450,000** |
| **Batch 2** | `200` → 1 bill | **`409` → 1 bill** | **`409` → 1 bill** | **1** | **150,000** |

At HEAD the three bills were `BILL-000001@2025-03-01`, `BILL-000002@2025-04-01`,
`BILL-000003@2025-05-01` — a quarter's billing issued to one supplier in under a second.

### 3.4 The deliberately-red test is now green

`accounts-payable.e2e-spec.ts` → *"should return 409 when generating duplicate for same cycle"* was
left failing on purpose by B0 to document the correct contract. It **passes**. Its comment block has
been rewritten from "KNOWN FAILING" to a record of the resolution, and it **retains** the warning not
to relax the expectation to 200.

Three further cases were added rather than relying on that one assertion:

- **`should still generate the next-period bill once the cadence has elapsed`** — backdates
  `lastGeneratedAt` by 35 days and asserts `200`, that the bill count goes **1 → 2 (not 1 → 3)**, and
  that the two bills carry **different** due dates. This is the "legitimate next-period bill still
  succeeds" leg; it manipulates the one piece of state no caller can reach through the API, which is
  why it is asserted here rather than by waiting a month.
- **`should return 409 when the targeted cycle has already been billed`** — rewinds `nextDueDate`
  onto an already-billed cycle while the cadence clock says the profile is eligible, isolating
  check 1 from check 2.
- Three unit cases stating each leg with explicit dates against a mocked Prisma, including
  `expect(prisma.$transaction).not.toHaveBeenCalled()` so a refusal is proven to write nothing.

---

## 4. PC-01…PC-07 sweep

| ID | B0 status | Batch 2 disposition |
| --- | --- | --- |
| **PC-01** — Manager holds no accounting write | Recorded | **Still recorded, deliberately not implemented.** Granting Manager the five OD-9 writes is a **seed/permission** change, explicitly outside this batch (*"NO new permissions"*) and outside the cutover's owner-approved OD-9 resolution (Owner FULL · Accountant FULL · **Manager READ-ONLY**). **B5 must request them explicitly.** Tracked in the roadmap's B5 row. |
| **PC-02** — `procurement:advisory:read` gates a read **and** a write | Recorded | **Still recorded.** Splitting the string is a permission change. Manager remains granted neither. Tracked in the roadmap's B5 row. |
| **PC-03** — cross-branch leakage | 🔴 **Blocking** | ✅ **FIXED** — §2. All four named entities plus eleven further instances of the same class; four Category-C surfaces downgraded with written justification. |
| **PC-04** — duplicate vendor bills | 🔴 **Blocking** | ✅ **FIXED** — §3. |
| **PC-05** — `ar/aging` renamed `totals.grand*` → `summary.*` | e2e + Postman fixed; **unit spec left failing to compile** | ✅ **CLOSED.** Fixed as a *precondition*, not scope creep: the stale names meant the entire `accounts-receivable.service.spec.ts` suite **could not compile**, so the AR unit suite was dead and the new AR scoping tests had nowhere to live. Two test-only corrections (`type: CustomerAccountTypeEnum.CORPORATE`, `result.summary.*`) — no product code, no contract change. |
| **PC-06** — ten list routes return a bare array with no server `total` | Recorded | **Still recorded, deliberately not implemented.** Adding an envelope changes the response **shape** of ten routes — a contract change with no authorization in this batch, and one B5 may prefer to resolve per surface ("showing all N loaded"). 🟡 non-blocking; still the B5 design decision B0 framed. |
| **PC-07** — fiscal periods are `DRAFT`, no unlock route | Documented | **Unchanged and re-verified.** `DRAFT → OPEN → CLOSED → LOCKED`, `LOCKED` terminal. Documentation-only; B5.4 must model four states. |

**There was no other blocking item.** The two remaining conditions on the B5 gate (**PC-06**,
**PC-01/PC-02**) were marked 🟡 by B0 as *decisions B5 must make*, not defects to repair — and both
are now carried as explicit roadmap entries.

### New findings from this batch

| ID | Finding | Status |
| --- | --- | --- |
| **C-22** | 37 further guard permissions (`franchise:*` 12, `ops:*` 8, `dev:*` 5, `merchant:*` 4, `billing:*` 3, `onboarding:*` 2, `support:*` 2) still have no seeded row. Previously only mentioned in the roadmap's phase list; **now a proper Track C register row** with the **B7-must-budget** note and a warning not to re-derive the count with a prefix match. | **Recorded, not implemented** — those modules are all deferred |
| **C-23** | **`M33-General-Ledger-Journals-Posting-Engine` cannot run.** It sends a literal `{{accountId}}`, so `POST /accounting/journals` returns **400 `"Account {{accountId}} not found or inactive"`**, cascading into **20 failed assertions over 18 requests**. It needs the **R17** folder pre-request the other accounting collections carry. **Proven pre-existing**: byte-identical 20-failure set at `bcbabd9` on a from-scratch database. B0 never ran M33. | **Recorded, not implemented** — a Postman-hygiene defect, and the repo rule is not to edit collections absent a real contract change |
| **GB2-N1** | B0's §6 description of `bank-statements` was wrong in the caller's favour — the detail leaked too, rather than 404ing (§2.1). | Corrected in `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` |

---

## 5. Files changed

Backend source + tests + docs only.

| File | Change |
| --- | --- |
| `apps/api/src/common/scope/branch-scope.ts` **(new)** | `strictBranchScope` / `branchOrOrgScope` + `MissingBranchScopeError`; the rule, the schema categories and the fail-closed rationale documented in one place |
| `apps/api/src/common/scope/index.ts` **(new)** | barrel |
| `apps/api/src/modules/accounts-payable/accounts-payable.{service,controller}.ts` | PC-03 scoping across suppliers/bills/payments/credit-notes/aging/recurring/reminders; **PC-04** guard |
| `apps/api/src/modules/accounts-receivable/accounts-receivable.{service,controller}.ts` | PC-03 scoping across accounts/invoices/receipts/aging/credit-notes |
| `apps/api/src/modules/bank-rec/bank-rec.service.ts` | PC-03 strict scoping across statements/reconciliations + write-target lookups |
| `apps/api/src/modules/ledger/ledger.{service,controller}.ts` | PC-03 posting-error list/detail parity |
| `…/accounts-payable.service.spec.ts` | +4 PC-04 cases, +2 PC-03 cases, branch threaded through existing calls |
| `…/accounts-receivable.service.spec.ts` | **PC-05 compile repair** + 4 PC-03 cases |
| `…/bank-rec.service.spec.ts`, `…/ledger.service.spec.ts` | +4 / +2 PC-03 cases |
| `apps/api/test/accounting-branch-scoping.e2e-spec.ts` **(new)** | 31 cross-branch cases |
| `apps/api/test/accounts-payable.e2e-spec.ts` | red test → green + 2 new PC-04 cases |
| `ai/ENTERPRISE_UI_ROADMAP.md` | **C-22** and **C-23** register rows; B5 gate → GO |

**Not touched:** `packages/db/prisma/schema.prisma`, any migration, `seed.ts`, `demo-import.ts`, any
`postman/collections/*`, any file under `apps/web/`.

---

## 6. Validation

All executed. Isolated local Docker `postgres:16` (`nimbus-gap2-pg`, port **55433**, DB
`nimbus_gap2`), API on **:4021**, web on **:3100**. A second container (`nimbus-gap2-base`, port
**55434**) carried a `bcbabd9` worktree on **:4022** for the before-measurements.

| Check | Result |
| --- | --- |
| **AP + AR e2e** | **91 passed / 0 failed / 91**. Baseline at `bcbabd9` on a from-scratch DB: **1 failed / 88 passed / 89**, the single failure being the deliberately-red PC-04 test — matching B0's record exactly. 91 rather than the briefed 89 because two PC-04 legs were added. |
| **Cross-branch e2e** (new) | **31 passed / 0 failed**; **19 failed / 12 passed** at `bcbabd9` |
| **Full API e2e** | **98 failed / 1043 total** vs **99 failed / 1010 total** at `bcbabd9`, both from freshly reset+seeded databases. Failing **test-name sets diffed**: the only difference is the PC-04 test moving from fail to pass. **Zero regressions** — `comm -13` returns empty. Count reconciles exactly: 1010 + 33 new tests = 1043. ⚠️ The 98 pre-existing failures are full-suite cross-suite interference in `billing`, `bg7-hms`, `quick-pin`, `franchise`, `franchise-analytics`, `attendance`, `bg1-onboarding`, `tenancy`, `orders`, `control-plane` — **none in accounting**, and identically present at HEAD. B0's "272/273" was a subset run, not the full suite. |
| **Touched unit suites** (AP, AR, bank-rec, ledger) | **148 passed / 148** |
| **Full API unit** | **1100 passed / 4 failed / 1104**, 57 suites. The 4 are `client-onboarding.service.spec.ts` and are **proven pre-existing** — re-run at `bcbabd9` in a throwaway worktree: identical 4 failures, identical test names. ⚠️ The AR suite now **compiles and runs** (PC-05), which is why the passing count exceeds B0's 1057. |
| **API typecheck** | `tsc --noEmit` — **0 errors** (B0's 4 AR compile errors are gone; re-proven present at `bcbabd9`) |
| **newman M34 (AP)** | 23 requests **0 failed**, 46 assertions **0 failed** |
| **newman M35 (AR)** | 21 requests **0 failed**, 45 assertions **0 failed** |
| **newman M32 (Accounting foundation)** | 17 requests 0 failed, 34 assertions 0 failed |
| **newman M36 (Bank-rec)** | 18 requests 0 failed, 24 assertions 0 failed |
| **newman M33 (GL)** | 18 requests 0 failed, **42 assertions / 20 failed** — 🔴 **pre-existing, not caused by this batch**: identical 20-failure set at `bcbabd9` on a from-scratch DB. Recorded as **C-23**. |
| **Postman collections parse** | **56 / 56** |
| **Web typecheck** | pass |
| **Web assertion scripts** | **16 / 16** |
| **`/api/health`** | QA `:4021` → `{"status":"ok","db":"ok"}` |
| **`git diff --check`** | clean |

---

## 7. Isolation proof

- The QA API process (pid 92701) held **exactly one** established TCP connection:
  `127.0.0.1:49571 → 127.0.0.1:55433` — the local container. **Zero** connections to any remote
  `:5432`. Measured with `lsof -a -nP -p <pid> -iTCP -sTCP:ESTABLISHED` (the `-a` matters: without
  it `lsof` ORs its selectors and reports the machine's whole TCP table).
- The only remote `:5432` connection on the machine (`98.85.21.49:5432`) belonged to the
  **pre-existing** shared-Neon dev API on `:3001` — a separate pid (39383), left running throughout.
- Both dev servers were **left alone and verified afterwards**: `:3001` `/api/health` → `ok`,
  `:3003` `/login` → 200. QA used non-conflicting ports (**4021**, **4022**, **3100**, **55433**,
  **55434**).
  ⚠️ **Disclosed:** the first QA API launch used `PORT=4021`, but `main.ts` reads **`API_PORT`**, so
  it defaulted to 3001 and exited with `EADDRINUSE`. It **failed rather than taking the port**; the
  dev API was verified healthy immediately afterwards and no shared-Neon write occurred.
- Neither `.env` was modified — isolation was achieved by constructing the child-process environment
  explicitly (the Prompt 4C lesson: `dotenv` never overrides an already-set env var):

| File | Before | After |
| --- | --- | --- |
| `apps/api/.env` | `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b` | **identical** |
| `packages/db/.env` | `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75` | **identical** |

- Both QA containers and the throwaway `bcbabd9` worktree were removed at teardown.

---

## 8. B5 gate — 🟢 GO

| B0 condition | Now |
| --- | --- |
| 🔴 **PC-03** — branch scoping | ✅ **Cleared.** All four named reads, both list/detail pairs, and eleven further instances of the same class are branch-scoped and proven by a 31-case suite that fails 19 ways against the old code. The four genuinely org-level surfaces are **documented as such**, so B5 can label them honestly rather than work around them. |
| 🔴 **PC-04** — duplicate vendor bills | ✅ **Cleared.** B5.1 may ship a *Generate bill* control. |
| 🟡 **PC-06** — ten bare-array lists | **Unchanged, and still a B5 decision.** Ship them as explicitly unpaginated ("all N loaded") or gain a backend envelope first. **Do not fabricate a server total from `array.length`.** |
| 🟡 **PC-01 / PC-02** — Manager holds no accounting write | **Unchanged.** Manager is read-only across accounting. If B5 needs the five OD-9 writes it must **request them explicitly**; `procurement:advisory` additionally needs splitting before Manager can even *read* procurement suggestions. |

**Sub-phase readiness after this batch**

| Sub-phase | Was | Now |
| --- | --- | --- |
| **B5.1 Customers + Vendors** | 🟡 blocked on PC-03 + PC-04 | 🟢 **Ready** |
| **B5.2 Bank reconciliation** | 🟡 blocked on PC-03 + PC-06 | 🟢 **Ready** on scoping; **PC-06 applies** to its four bare-array lists |
| **B5.3 Accounting core + Review** | 🟢 read-only for Manager | 🟢 unchanged. ⚠️ **C-23**: M33 cannot currently verify the journals surface |
| **B5.4 Closing** | 🟢 with PC-07 | 🟢 unchanged — four states, `LOCKED` terminal, no unlock |
| **B5.5 Reporting + Configuration** | 🟡 | 🟡 unchanged — procurement still unverified (no rows exist to generate); forecast is at **`/api/franchise/forecast`**; aging totals are under **`summary`** |
| **B5.6 Accounting dashboard** | 🟡 | 🟡 unchanged — no bucketed series exists, so cards ship **chartless** rather than synthesise one |

⚠️ **Shared-Neon deploy remains GATED** and is now **behaviour-visible in one more way**: on top of
the cutover's 56 routes changing from 403 to reachable, accounting reads will begin returning
**fewer** rows (branch-scoped rather than org-wide), aging figures will **change value**, and
cross-branch AP approvals / reconciliation matches will stop working. That is the intended
correction, but it must not arrive unannounced.

**B5, B6 and B7 are NOT started — do not begin any of them without explicit owner authorisation.**

---

## 9. Do-not-undo

- **Do not widen any accounting `where` back to `orgId` alone.** Use
  `branchOrOrgScope` / `strictBranchScope`; a list and its detail must call the **same** helper.
- **Do not make the helpers fail open** when a branch is missing. The throw is the point.
- **Do not turn a cross-branch 404 into a 403** — a 403 confirms the id exists elsewhere (B3-F1).
- **Do not use strict equality on a nullable `branchId`** — it orphans org-level rows from every
  branch at once.
- **Do not invent a `branchId`** for `FiscalPeriod`, `PostingSourceMap`, `TaxLedgerConfig` or
  `PeriodCloseRun`. They are org-level by design; §2.2 is the record.
- **Do not relax the PC-04 guard**, and do not "fix" the AP 409 test by expecting 200.
- **Do not seed the C-22 permissions** — those modules are deferred; B7 budgets its own cutover.
