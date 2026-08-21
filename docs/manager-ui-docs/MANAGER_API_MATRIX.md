# Manager API Matrix

This matrix documents the backend API endpoints exposed to the Manager role (`roleName: 'Manager'`), including required permissions, branch/organization scoping, data sensitivity, and readiness for the Manager MVP.

---

## 2026-08-21 — TRACK B5.4: Accounting core (Journals) + Review rows now CONSUMED by surfaces

Track B5.4 (`ai/ENTERPRISE_B5_4_ACCOUNTING_CORE_COMPLETION_REPORT.md`) turns the four rows
`lib/accounting/menu.ts` tagged "B5.4" since B5.1 into real surfaces — and only those four. An
operator brief for this phase described fiscal periods/posting-source-maps/tax-config as B5.4
deliverables; the menu tree's own tags (unchanged since B5.1) say those are B5.5/B5.6, and this
matrix follows the tags, not the brief (see the completion report §0).

| Route | Permission | Scope | Envelope | Used for |
| --- | --- | --- | --- | --- |
| `GET /api/accounting/journals?status=&sourceKey=&from=&to=&skip=&take=` | `pos:accounting:journals:read` | branch (⚠️ BGB3-L3: strict equality on a nullable column, latent) | `{data,total,skip,take}`, real server total | Journal entries list |
| `GET /api/accounting/journals/:id` | `pos:accounting:journals:read` | 🔴 **C-25**: no branch predicate at all — `{id, orgId}` only | object | Journal entries detail |
| `GET /api/accounting/posting-runs?skip=&take=` | `pos:accounting:posting-runs:read` | branch | `{data,total,skip,take}`, real server total, **no filter of any kind** | Posting runs list (no detail route exists) |
| `GET /api/accounting/posting-errors?status=&skip=&take=` | `pos:accounting:posting-errors:read` | branch (`branchOrOrgScope`) | `{data,total,skip,take}`, real server total | Posting errors list |
| `GET /api/accounting/posting-errors/:id` | `pos:accounting:posting-errors:read` | branch (`branchOrOrgScope`) | object | Posting errors detail |
| `GET /api/audit/timeline?entityType=&page=&pageSize=` | `audit:read` | branch (✅ fixed by batch 3's B5-F4; the B5.1-era registry note calling this "organisation" was stale, corrected this pass) | `{data,total,page,pageSize,filters}` — ⚠️ pages with `page`/`pageSize`, not `skip`/`take` like every other route in this table | Review → Audit trail, scoped to `entityType` ∈ {`JournalEntry`,`PostingRun`,`PostingError`} |

**No trial balance or general-ledger-as-a-statement route exists anywhere in this API.** "General
ledger" in the Manager UI **is** the Journal entries list — the same one the B5.1 dashboard card
already counted.

🔴 **Two new findings, both live-proven, neither fixed (out of scope for a frontend-only phase):**
- **C-25** — `getJournal` has no branch predicate, so a journal id from one branch's list stays
  readable under a different branch's header. Mitigated client-side (`isJournalReadableInBranch`).
- **C-26** — `ledger.service.ts`'s six `audit.log(...)` calls never stamp `metadata.branchId`, so
  `GET /api/audit/timeline`'s branch-scoped default (fixed by batch 3) can never surface a
  journal/posting-run/posting-error event — proven by creating 8 fresh events via this phase's own
  fixtures and finding every resulting `AuditLog` row's `branchId` NULL. The Audit trail screen's
  empty state names this by disclosure rather than reading as "nothing happened".

**B5.4-D1** (recorded, not a route defect): no endpoint exists anywhere in this API to resolve or
dismiss a `PostingError`, for any role — only `pos:accounting:posting-errors:read` is seeded, no
`:resolve`/`:dismiss`/`:write` string exists. The Posting errors detail screen states this plainly
rather than implying it is a Manager-specific permission gap.

**Live fixture note**: created live via the API (Owner token — Manager holds no accounting write) on
Tapas Downtown: 2 manual balanced journals (one later reversed), 1 SUCCEEDED posting run (via
`POST /accounting/posting/replay` with a real `sourceKey`), 1 FAILED posting run + 1 OPEN posting
error (via replay with an unknown `sourceKey`). No live shape drift was found on any of the six GET
routes.

---

## 2026-08-21 — TRACK B5.3: Bank rows now CONSUMED by list/detail surfaces

Track B5.3 (`ai/ENTERPRISE_B5_3_BANK_RECONCILIATION_COMPLETION_REPORT.md`) turns the three Bank
menu rows B5.1 shipped as not-yet placeholders into real surfaces. Every route below was already
present in the 38-route registry (B5.1 built it for exactly this purpose); B5.3 adds no new
registry entries — it consumes the last three of the nine originally reserved for it.

| Route | Permission | Scope | Envelope | Used for |
| --- | --- | --- | --- | --- |
| `GET /api/accounting/bank-accounts` | `pos:accounting:bank-accounts:read` | branch | **bare array** (PC-06) | Bank → Bank accounts list (list-only — no `bank.account` detail key exists) |
| `GET /api/accounting/bank-statements?bankAccountId=` | `pos:accounting:bank-statements:read` | branch | **bare array** (PC-06) | Bank → Bank statements list |
| `GET /api/accounting/bank-statements/:id` | `pos:accounting:bank-statements:read` | branch | object (list `include` + full `lines[]`) | Statement detail |
| `GET /api/accounting/reconciliation?bankAccountId=` | `pos:accounting:reconciliation:read` | branch | **bare array** (PC-06) | Bank → Reconciliation list |
| `GET /api/accounting/reconciliation/:id` | `pos:accounting:reconciliation:read` | branch | object (widens `bankStatement` to its full `lines[]`; adds a computed `difference` string) | Reconciliation detail |

**Neither bare-array Bank list accepts a server-side status filter** — only the optional
`?bankAccountId=` narrowing param. The status chip on Bank statements/Reconciliation therefore
filters the already-fetched complete array CLIENT-side; it is never forwarded as a query parameter
(proven by `e2e/manager-accounting/bank.spec.ts`: the captured-request count is unchanged after
filtering, and no captured request URL ever carries `?status=`). The filter VALUE is still validated
through `readManagerEnum()` before it reaches the browser-side filter, same discipline as every
server-validated accounting filter.

**No pager binds to any of the three lists** — all are PC-06 bare arrays with no `total` field.
`BankStatementsScreen.tsx`/`ReconciliationScreen.tsx` still carry a `ManagerBreadcrumbs` RECORD
pager on their detail panels (walking the already-fetched `pageRows`, the same legitimate exception
B5.2 established), but neither calls `toAccountingPager(` — see `docs/UI_SYSTEM.md` §8g.

**Live fixture note**: the demo dataset carries zero bank accounts/statements/reconciliations by
default. Every row above was verified against fixtures created live via the API (Owner token —
Manager holds no accounting write) on the isolated stack for this pass: 2 bank accounts, 2
statements (5+1 lines), 2 reconciliations (one `IN_PROGRESS` with a live-proven UGX 6,350,000
non-zero `difference`, one `COMPLETED` with a zero `difference`). No live shape drift was found on
any of the five GET routes.

**One stale B5.1 type fixed in this phase**: `BankAccountRow.currentBalance` did not exist on the
`BankAccount` Prisma model at all (confirmed by reading `packages/db/prisma/schema.prisma`) — B5.1
never caught it because the Bank dashboard card only ever rendered a count. Removed.

---

## 2026-08-21 — TRACK B5.2: Customers + Vendors rows now CONSUMED by list/detail surfaces

Track B5.2 (`ai/ENTERPRISE_B5_2_CUSTOMERS_VENDORS_COMPLETION_REPORT.md`) turns nine of B5.1's
not-yet Customers/Vendors menu rows into real list (and, for four of them, detail) surfaces, plus
pulls the Reporting group's "Aged receivable"/"Aged payable" rows forward from B5.6. Every route
below was already present in the 38-route registry (B5.1 built it for exactly this purpose); B5.2
adds no new registry entries — it consumes ones that already existed unconsumed.

| Route | Permission | Scope | Envelope | Used for |
| --- | --- | --- | --- | --- |
| `GET /api/accounting/ar/invoices?status=&skip=&take=` | `accounting:ar:invoice:read` | branch | `{data,total,skip,take}` | Customers → Invoices list |
| `GET /api/accounting/ar/invoices/:id` | `accounting:ar:invoice:read` | branch | object | Invoice detail (line items + `receiptAllocs[].receipt`) |
| `GET /api/accounting/ar/accounts?status=&type=&skip=&take=` | `accounting:ar:account:read` | branch | `{data,total,skip,take}` | Customers → Customer accounts list |
| `GET /api/accounting/ar/accounts/:id` | `accounting:ar:account:read` | branch | object | Account detail (`_count.invoices/receipts/creditNotes`) |
| `GET /api/accounting/ar/credit-notes?status=&skip=&take=` | `accounting:ar:credit-note:read` | branch | `{data,total,skip,take}` | Customers → Credit notes list (list-only, `total:0` on the reference dataset) |
| `GET /api/accounting/ap/bills?status=&skip=&take=` | `accounting:ap:bill:read` | branch | `{data,total,skip,take}` | Vendors → Bills list |
| `GET /api/accounting/ap/bills/:id` | `accounting:ap:bill:read` | branch | object | Bill detail (line items + `paymentAllocs[].vendorPayment`) |
| `GET /api/accounting/ap/suppliers?counterpartyType=&skip=&take=` | `accounting:ap:bill:read` | branch | `{data,total,skip,take}` | Vendors → Suppliers list |
| `GET /api/accounting/ap/suppliers/:id` | `accounting:ap:bill:read` | branch | `{supplier,summary,recentBills,recentPayments}` — the one non-flat detail shape in the module | Supplier detail |
| `GET /api/accounting/ap/credit-notes?status=&skip=&take=` | `accounting:ap:credit-note:read` | branch | `{data,total,skip,take}` | Vendors → Credit notes list (list-only, `total:0` on the reference dataset) |
| `GET /api/accounting/ap/payments?status=&skip=&take=` | `accounting:ap:bill:read` | branch | `{data,total,skip,take}` | Vendors → Payments list (list-only, 12 rows on Tapas Downtown) |
| `GET /api/accounting/ap/recurring-profiles?isActive=&skip=&take=` | `accounting:ap:recurring:read` | branch | `{data,total,skip,take}` | Vendors → Recurring profiles list (list-only, `total:0` on the reference dataset) |
| `GET /api/accounting/ap/reminders?status=&skip=&take=` | `accounting:ap:reminder:read` | branch | `{data,total,skip,take}` | Vendors → Payment reminders list (list-only, `total:0` on the reference dataset) |
| `GET /api/accounting/ar/aging?take=100` | `accounting:ar:aging:read` | branch | `{asOf,total,skip,take,summary,accounts}` | Reporting → Aged receivable (full-page; same route the B5.1 dashboard card already reads, separate query key) |
| `GET /api/accounting/ap/aging` | `accounting:ap:bill:read` | branch | `{asOf,buckets,bySupplier,billCount}` | Reporting → Aged payable (full-page; unpaged, no completeness caveat) |

**Status/type enum values are read-time validated, never forwarded raw**: every `status`/`type`/
`counterpartyType` query param is built from a hard-coded const array matching the live Prisma enum
(`AR_INVOICE_STATUSES`, `AR_ACCOUNT_STATUSES`/`AR_ACCOUNT_TYPES`, `AR_CREDIT_NOTE_STATUSES`,
`AP_BILL_STATUSES`, `AP_COUNTERPARTY_TYPES`, `AP_CREDIT_NOTE_STATUSES`, `AP_PAYMENT_STATUSES`, plus
a local reminder-status array) via `readManagerEnum()`, so a hand-edited URL with an invalid value
resolves to "no filter" client-side rather than depending on the backend's post-batch-3 `@IsEnum`
400 as the only guard.

**`take` is clamped to 100 client-side** (`clampAccountingTake`, mirroring the backend's
`MAX_ACCOUNTING_LIST_PAGE_SIZE` from batch 3) before every request — a list screen can never send a
`take` that would 400.

**One live-QA-caught frontend defect, fixed in this phase**: the shared `detailRequest()` helper in
`lib/accounting/api.ts` blindly appended `/${id}` to every detail route's path. For `ar.invoice`,
`ar.account` and `ap.bill` — whose registry `path` already carries a literal `:id` placeholder
(`/api/accounting/ar/invoices/:id`) — this produced a malformed double-id URL
(`.../invoices/:id/<realId>`), which 404'd and surfaced as an honest-looking "Invoice unavailable"
screen for what was actually a perfectly good id. Caught by opening a real invoice in the browser
against the isolated stack and cross-checking the same id with a direct `curl` (200). Fixed by
having `detailRequest()` replace a literal `:id` in the path when present, and only append `/${id}`
for the one registry entry that has no separate detail key (`ap.suppliers`). Re-verified live for
all four detail-bearing surfaces after the fix.

---

## 2026-08-21 — BACKEND GAP BATCH 3: B5-F1…F4 read-integrity findings FIXED

`ai/BACKEND_GAP_BATCH3_COMPLETION_REPORT.md` is the record. The four findings the B5.1 pass below
recorded are now fixed — **no schema/migration/seed/permission change**:

- ✅ **B5-F1 fixed** — `ar/aging.summary` now aggregates a separate, unpaginated, minimal-column
  query over the identical `where`, independent of `skip`/`take`. Proven page-size independent
  (`take=1`/`take=3`/unpaginated all return the identical total on the same dataset). The
  `Σ accounts[].invoices.length >= total` completeness check below is no longer required for
  correctness, but the withheld-state UI code is harmless to keep.
- ✅ **B5-F2 fixed** — `ar/invoices?status=` (and five sibling routes: `ap/payments`,
  `ap/credit-notes`, `ar/credit-notes`, `ap/suppliers.counterpartyType`, `posting-errors`,
  `finance/procurement-suggestions.{status,urgency}`) now validate via `@IsEnum` DTOs — an invalid
  value is **400**, not 500.
- ✅ **B5-F3 fixed** — every paginated accounting/finance list route (14 total, incl. `ap/bills`,
  `ar/invoices`, `journals`, `ar/aging`) now rejects `take` above **100** (`@Max(100)` + a
  service-side `clampTake()` backstop). `ap/aging` and the ten PC-06 bare-array routes are
  unaffected by design — they have no `take` parameter to bound.
- ✅ **B5-F4 fixed** — `GET /api/audit/timeline` now scopes every read to `X-Branch-Id` by default;
  an explicit `?branchId=` disagreeing with the acting branch returns nothing instead of leaking.

---

## 2026-08-21 — TRACK B5.1: the accounting rows are now CONSUMED by the UI

Track B5.1 (`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`) mounts the Accounting module.
Nine accounting reads are now called by the product, and every route the module references — 38 in
all, including the ones later sub-phases will use — is recorded with its permission, its **real**
scope and its **real** envelope in the executable registry
[`apps/web/src/lib/accounting/route-registry.ts`](../../apps/web/src/lib/accounting/route-registry.ts).
**That file is the canonical accounting contract for the frontend**; it is machine-checked by
`scripts/manager-b5-assertions.ts`, so it cannot drift from what the UI actually calls.

### Consumed by the B5.1 dashboard (9 reads, all live-verified 2026-08-21)

| Route | Permission | Scope | Envelope | Used for |
| --- | --- | --- | --- | --- |
| `GET /api/accounting/ar/aging?take=100` | `accounting:ar:aging:read` | branch | `{asOf,total,skip,take,summary,accounts}` | Receivable card ⚠️ **B5-F1** |
| `GET /api/accounting/ap/aging` | `accounting:ap:bill:read` | branch | `{asOf,buckets,bySupplier,billCount}` | Payable card (unpaged — true branch totals) |
| `GET /api/accounting/journals?take=1` | `pos:accounting:journals:read` | branch | `{data,total,skip,take}` | Ledger card (server `total`) |
| `GET /api/accounting/posting-runs?take=1` | `pos:accounting:posting-runs:read` | branch | `{data,total,skip,take}` | Ledger card |
| `GET /api/accounting/posting-errors?take=1` | `pos:accounting:posting-errors:read` | branch | `{data,total,skip,take}` | Ledger card |
| `GET /api/accounting/bank-accounts` | `pos:accounting:bank-accounts:read` | branch | **bare array** (PC-06) | Bank card |
| `GET /api/accounting/reconciliation` | `pos:accounting:reconciliation:read` | branch | **bare array** (PC-06) | Bank card |
| `GET /api/accounting/periods` | `pos:accounting:periods:read` | **organisation** | **bare array** (PC-06) | Fiscal period card |
| `GET /api/accounting/period-close-runs` | `pos:accounting:period-close-runs:read` | **organisation** | **bare array** (PC-06) | Fiscal period card |

### Corrections to earlier records

- ~~🔴 **B5-F1 — `ar/aging.summary` is PAGE-scoped.**~~ **FIXED 2026-08-21 (batch 3)** — `summary`
  now aggregates a separate unpaginated query over the identical `where`, so it no longer depends
  on `skip`/`take`. See the batch-3 section above.
- ~~🔴 **B5-F2 — `GET /ar/invoices?status=<invalid>` returns 500.**~~ **FIXED 2026-08-21 (batch 3)**
  — `@IsEnum` DTO validation added; an invalid value now returns 400.
- ~~⚠️ **B0's "pagination bound" column is unreliable... no server maximum.**~~ **FIXED 2026-08-21
  (batch 3)** — the probe methodology was the real defect (it combined `take`+`pageSize`+`limit`
  and misread the resulting 400 as a bound); `take` alone now genuinely rejects above 100 on every
  paginated accounting/finance list route.
- ~~⚠️ **`GET /api/audit/timeline`**... **ignores `X-Branch-Id`**.~~ **FIXED 2026-08-21 (batch 3)** —
  now scopes to `X-Branch-Id` by default.
- ⚠️ **`ap/aging`** returns **`billCount`** (not `bills`), and **`/api/franchise/forecast`** is the
  real forecast path (not `/api/finance/forecast`). *(Still true — `ap/aging` has no `take` at all,
  by design; unaffected by the batch-3 pagination fix.)*
- **`ar/receipts` and `manual-bank-entries` are POST-only** — there is no GET to list either.
- **Manager writes re-verified 403** on a representative five (AP supplier, AR invoice, journal, bank
  account, budget) — PC-01 stands. `finance/procurement-suggestions` is **403 to read** — PC-02 stands.

### Empty on a fully seeded + demo-imported database (both probed branches)

`bank-accounts`, `bank-statements`, `reconciliation`, `period-close-runs`, `finance/budgets`,
`finance/demand-calendar`, `ap/credit-notes`, `ap/recurring-profiles`, `ap/reminders`,
`ar/credit-notes`, `posting-runs`, `posting-errors` — all `[]` or `total: 0`. **B5.3 (bank) and
B5.6 (budgets) need a fixture or a generator before those surfaces can be designed against real data.**

---

## 2026-08-20 — PERMISSIONS CUTOVER + Track B0 verification (annotation; matrix not rewritten)

Two things changed for the Manager role on this date. Canonical records:
[`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`](../../ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md)
and [`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`](../../ai/ACCOUNTING_API_VERIFICATION_REPORT.md)
(the **B0** route verification, which supersedes the "not yet live-verified" caveat below **for the
accounting/finance block only**).

### 1. 🔴 Manager LOST `pos:hr:compensation:read` (FU-1)

Any row in this matrix that assumes Manager can read compensation is now **wrong**. Verified live:

| Endpoint | Manager, before | Manager, after |
| --- | --- | --- |
| `GET /api/hr/employees?view=full` | 200 (full compensation + `dateOfBirth` + address) | **403** |
| `GET /api/hr/employees/:id?view=full` | 200 | **403** |
| `GET /api/hr/compensation-profiles` | 200 | **403** |
| `GET /api/hr/employees` (default, safe view) | 200 | **200 — unchanged** |

This enforces the locked "compensation excluded from the Manager MVP" decision at the wire. Owner
and Accountant keep the grant. The B3 Staff surface never called `?view=full` (asserted), so no UI
row changes.

### 2. Manager gained 15 accounting/finance READS, and no writes (C-21 + OD-9)

56 accounting routes previously returned **403 to every role including Owner** because 36
permission strings had no seeded row. They are now seeded. Manager's slice is **read-only**:

`accounting:ap:{bill,credit-note,recurring,reminder}:read` ·
`accounting:ar:{account,invoice,credit-note,aging}:read` ·
`pos:accounting:{bank-accounts,bank-statements,reconciliation,period-close-runs}:read` ·
`finance:budget:read` · `finance:demand-calendar:read` · `franchise:forecast:read`

Verified live: Manager gets **200** on 25 of 26 accounting GET routes and **403** on all 16 write
attempts (AP create/approve/pay, AR invoice/receipt, bank account/import/manual entry,
reconciliation match, period close, period lock, budget create/update-actuals, demand-calendar
create, procurement review). The one Manager read 403 is
`GET /api/finance/procurement-suggestions` — **withheld deliberately**, because
`procurement:advisory:read` also gates the mutation
`PATCH /api/finance/procurement-suggestions/:id/review` (finding **PC-02**).

**Manager still does NOT hold** `journals:create`, `journals:reverse`, `posting:replay`,
`periods:open`, `posting-source-maps:update` or `tax-config:update` — the accounting/GL guides were
correct and are now live-verified. It **does** hold the pre-existing `accounts:create`,
`cost-centers:create` and `periods:create`.

### 3. Rows B5 must not take at face value

- ⚠️ **`GET /api/franchise/forecast`, not `/api/finance/forecast`** — the route sits on a third
  `@Controller('franchise')` class inside `budget.controller.ts`.
- ✅ **PC-03 is FIXED (backend gap batch 2, 2026-08-21).** The four leaking reads
  (`ap/suppliers`, `ap/credit-notes`, `ar/credit-notes`, `bank-statements`) — **and eleven further
  instances of the same class that B0 missed**, including three cross-branch **writes**
  (`POST /ap/bills/:id/approve`, reconciliation `match` / `skip`) and **both aging aggregates** —
  are branch-scoped. Cross-branch targets return **404, never 403** (the B3-F1 precedent).
  Two rules, chosen from the schema and not from preference:
  **NOT NULL `branchId`** (`BankAccount`, `BankStatement`, `BankReconciliation`, `ManualBankEntry`)
  → strict equality; **nullable `branchId`** (suppliers, bills, payments, credit notes, invoices,
  customer accounts, reminders, recurring profiles, posting errors) → *acting branch **or**
  `branchId IS NULL`*, the repo's existing predicate for nullable-branch models, so genuinely
  org-level rows are not orphaned from every branch at once.
  ⚠️ **Four surfaces are org-level BY DESIGN and are NOT branch-scoped** — do not present them as
  branch data and do not "fix" them: `accounting/periods`, `accounting/posting-source-maps`,
  `accounting/tax-config` (these three Prisma models have **no `branch_id` column at all**) and
  `accounting/period-close-runs` (nullable column the close path never stamps — every row is
  `NULL`). See `ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md` §2.
- 🔴 **Ten accounting list routes return a bare array** with no `total` and no pagination bound —
  finding **PC-06**, **still open**. The C4 pager contract cannot bind to them. Ship them as
  explicitly unpaginated ("showing all N loaded") or gain a backend envelope first — **never
  synthesise a server total from `array.length`.**
- 🔴 **Manager holds NO accounting write** (PC-01) and is deliberately denied
  `procurement:advisory:read` because that one string also gates the mutation
  `PATCH /finance/procurement-suggestions/:id/review` (PC-02). B5 must request the five OD-9 writes
  explicitly; neither was changed by batch 2 (no permission change was authorised).
- ✅ **PC-04 is FIXED (batch 2).** `POST /ap/recurring-profiles/:id/generate-bill` no longer
  double-bills: a repeat returns **409**, and the legitimate next-period bill still returns 200. A
  *Generate bill* control may now ship. Measured before → after on three clicks of one MONTHLY
  150,000 profile: **3 bills / 450,000 → 1 bill / 150,000.**
- ⚠️ **C-23** — the M33 GL Postman collection **cannot run** (it sends a literal `{{accountId}}`, so
  journal creation 400s). Proven pre-existing at `bcbabd9`. B5.3's journals surface therefore has
  no Postman verification, only the live B0 matrix.
- ⚠️ `GET /api/accounting/ar/aging` returns its totals under **`summary`**
  (`totalOutstanding` / `current` / `bucket_*`), **not** `totals.grand*` — finding **PC-05**.
- ⚠️ **All 7 `/api/settings*` reads are org-scoped** and readable by Supervisor too
  (`tenancy:org:read`). B6 must label them organisation settings, not branch settings.
- ⚠️ **Manager can read `GET /api/audit/timeline`; Accountant cannot** (403).
- 🔴 **`GET /api/owner/live` is Owner-only** — 403 for Manager and Accountant. B7, not B6.

### 4. Quick-PIN admin rows are now branch-guarded (B3-F1)

`GET /api/hr/frontline-staff/:id/quick-pin-status` and `/quick-pin/{reset,disable,enable}` resolve
the target by org **and** branch. A target in another branch now returns **404** (was **200**), and
`/reset` returns **400** if `body.branchId` is not the active `X-Branch-Id`.

---

## 2026-08-20 — Header note: owner decisions are LOCKED (matrix not rewritten)

The product owner approved the Manager core + MVP scope on **2026-08-20**. The decision register
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md)
now reads **Approved (owner, 2026-08-20)** on every previously-pending row. Constraints this matrix
is now read under:

- Operations rows are **read-only oversight** in MVP — no cashier-checkout and no
  waiter-order-entry clone may be built on them.
- Staff `contracts` rows stay **Deferred** (compensation / contracts / payroll excluded).
- Reports export/download must render a truthful **generator-unavailable** state; **fake downloads
  are forbidden**.
- Settings printer routes are **metadata-only**; terminal pairing is **stub-only**; alert rules are
  **defer-or-read-only**; sync-conflict diff is **deferred**.
- The branch switcher drives **every** branch-scoped row via `X-Branch-Id`.

**This matrix has deliberately NOT been rewritten.** Rows, permissions, and caveats below are the
2026-07-06 Prompt-0 draft. They are **not yet live-verified against today's backend** — verifying
every row is the explicit job of **M-P0** in
[`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md). Do not treat a
row here as proven until M-P0 marks it so.

### Annotation — the two generic Approvals rows (`GET /api/approvals`, `POST /api/approvals/:id/decide`)

**Owner decision (2026-08-20): domain-specific decision routes are PREFERRED over the generic
`POST /api/approvals/:id/decide`.** The generic route may be used only where the DTO mapping is
provably clear (per §7 of the decision register). This aligns Manager with the **Supervisor
Option B precedent**: Supervisor does **not** hold `approvals:read` / `approvals:decide`, so every
Supervisor decision goes through its canonical domain endpoint
(`/pos/discounts/:id/approve|reject`, `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`,
`/analytics/anomalies/:id/acknowledge|resolve`) — see
[`docs/supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`](../supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md)
and `ai/SUPERVISOR_RECONSTRUCTION_PROMPT5_APPROVALS_FINAL_COMPLETION_REPORT.md`.

**Seed verification requested with this note — result: MANAGER *does* hold both permissions.**
Checked `packages/db/prisma/seed.ts` (`ROLE_PERM_MATRIX`, `Manager:` block starting line 758):

```
// BG2: Unified Approvals Inbox + Global Audit Timeline (Manager: full)
'approvals:read',      // seed.ts:974
'approvals:decide',    // seed.ts:975
'audit:read',
```

For contrast, the `Supervisor:` block (line 1090) contains **neither** string — it carries only the
domain permissions (`pos:discount:approve`, `pos:hr:leave:review`, `pos:hr:shift-swaps:approve`,
`pos:analytics:anomalies:acknowledge`). `Owner:` holds both (seed.ts:735–736). The permissions
themselves are defined at seed.ts:443–444.

**Consequence for the Manager build.** Unlike Supervisor, Manager is *not* blocked from the generic
inbox by permissions — `GET /api/approvals` and `POST /api/approvals/:id/decide` will both return
2xx for a seeded Manager. The preference for domain-specific routes is therefore a **product /
safety decision, not a permission constraint**, and it must be enforced in the frontend. The
underlying risk is unchanged and already registered as **MANAGER-GAP-007**: the generic decide
payload takes source-specific dynamic parameters, so a generic decide form can submit an invalid or
unsafe payload. **Recommended shape:** use `GET /api/approvals` (+ `GET /api/approvals/:id`) for the
**read/count** surface that feeds the Overview approval counts, and route every **write** through
the verified domain endpoint. **Do not remove the `approvals:*` grants from the seed** — that is a
permission change and requires its own explicit authorization.

---

## 2026-08-20 — TRACK B3 RE-VERIFICATION (Operations + Staff, live)

Every endpoint the B3 Operations and Staff surfaces read or write was re-probed live against an
isolated disposable stack (`b3-api-matrix.mjs`, **39/39 checks passed** — 27 reads, 12 mutations).
Where B3's result differs from or sharpens an M-P0 row, **this section is newer**.

| Route | B3 live result |
| --- | --- |
| `GET /pos/orders?page=1&pageSize=25` | 200 · 25 rows · **`total: 298`** — the value the control-panel pager is fed |
| `GET /pos/orders/:id` | 200 · `total = subtotal + tax − discount` verified (`32,000 + 5,800 − 0 = 37,800`) → **`total` is tax-inclusive**, which is what the record's totals block states |
| `GET /pos/orders/:id` with another branch's `X-Branch-Id` | **404** — branch isolation holds on the detail route |
| `GET /tables` | 200 · 22 rows (Tapas) |
| `GET /reservations?scope=active` / `?scope=history` | 200 / 200 · totals 15 / 8 |
| `GET /api/tills` · `GET /api/shifts` | **404 · 404** — MP0-02 re-confirmed, not assumed |
| `GET /hr/employees` (default) | 200 · 40 rows · **`view: "safe"`** · **zero forbidden keys on the wire** — C-02 holds |
| — org scoping | rows span **5 distinct `branchId`s**; `?branchId=` → **400**. MP0-06 / C-09 unchanged |
| — ⚠️ `?view=full` **as Manager** | **200, returning `compensationProfile`, `baseAmount`, `salaryBasis`, `allowances`, `deductions`, `dateOfBirth`, `emergencyContact*`, `address`, `notes`.** **FU-1 is real.** The frontend is the only barrier; B3 asserts `view=full` appears nowhere in `components/manager`, `lib/manager` or `pages/manager` |
| `GET /hr/leave` | 200 · embeds a full nested `employee` carrying `dateOfBirth` / `address` / `emergencyContact*` / `notes`. **This is why B3 projects at the API-client boundary rather than at render** |
| `GET /hr/shift-swaps` | 200 · same nested PII on `requester` and `target` |
| `GET /hr/frontline-staff/:id/quick-pin-status` | 200 · 22 keys · **never returns the PIN**. ⚠️ **New finding B3-F1: resolved by `{id, orgId}` only — org-scoped, NOT branch-guarded** (200 from a second branch). Recommend adding `branchId`, matching the shift-swap approve fix. **Not implemented — backend change** |
| `POST /hr/frontline-staff/onboard` | **201** · returns a plaintext 6-digit PIN once (`shownOnce: true`, MP0-14) · the employee echo is compensation- and PII-free (C-02) |
| `POST /:id/quick-pin/reset` | 200 · a **different** PIN than the one issued at onboarding |
| `PATCH /:id/quick-pin/disable` / `enable` | 200 / 200 · a duplicate disable returns 200 `alreadyDisabled: true` — **idempotent, not an error** |
| `PATCH /hr/leave/:id/review` | 200 · a **second** review → **400**, which is why the UI renders terminal rows read-only |
| `PATCH /hr/shift-swaps/:id/approve {status: REJECTED}` | 200 · **`schedule_assignments`: 3 rows before → 3 rows after.** `GET /workforce/roster` byte-identical. **SUP-RG-036/042 re-confirmed: approving would mutate zero roster rows, so B3 ships reject-only (Outcome C)** |
| `POST /hr/leave` · `POST /hr/shift-swaps` | **403 self-service only** — *"can only create leave for their own linked employee profile"*. **New finding B3-F3**: a manager cannot file leave or a swap on an employee's behalf. Correct as designed; recorded so it is not re-discovered as a missing feature. B3 offers no create control for either |
| `GET /dash/open-orders` | `count: 50` · `limit: 50` · **`total: 107`** · `truncated: true` — the MP0-09 fields are live; `/dash/manager.openOrders` **== 107** |
| `GET /dash/manager` | **`grossSales` 33,014,100 ≥ `netSales` 27,978,300**, and `gross = net + tax`. ⚠️ **This inverts the pre-batch meaning** and is what exposed defect **B3-D1** — the B2 Overview was labelling the ex-tax figure "tax-inclusive". Fixed in B3 |

---

## 2026-08-20 — M-P0 LIVE VERIFICATION (the `Verified` column is authoritative)

**Every one of the 62 rows below was verified on 2026-08-20** by
[`ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md`](../../ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md),
twice: statically against `apps/api/src/modules/**/*.controller.ts` (route registration, HTTP
method, the exact `@Permissions(...)` string, `@RequireBranchContext()`, and the service's actual
`where` clause), and live against an isolated QA stack — API `http://localhost:3001` (prefix
`/api`), disposable local Postgres, manager `manager@nimbus.demo` at branch
`cb27be401a2c35dfc0d4e610`. `POST /api/auth/login` returned **201**.

**The `Verified` column supersedes the `Permission`, `Role-scope notes`, and `Caveats` columns
wherever they disagree.** The rest of the row body is the 2026-07-06 draft and was deliberately
**not rewritten**.

### Verified-status legend

| Value | Meaning |
| --- | --- |
| 🟢 | Route exists; method + permission string match; live 2xx (or a decorator-confirmed mutation); response usable by the planned UI. |
| 🟡 | Route exists and is reachable, but the documented scoping / response / permission is materially wrong, or the data the UI needs is only partially available. |
| 🔴 | Documented route does not exist, or the actual response violates a locked constraint. |
| `200`/`201`/`400`/`403`/`404` | HTTP code observed live on 2026-08-20. |
| `not exercised (mutation)` | Deliberately not executed; route + guard confirmed from the cited controller decorator. |

### Result: 🟢 51 · 🟡 7 · 🔴 4

**🔴 rows — read these before planning any phase:**

1. **`GET /api/tills`** — route does not exist (404). `/tills/active` is *operator-scoped*, not
   branch-scoped. **No branch-wide tills list exists.**
2. **`GET /api/shifts`** — route does not exist (404). `/shifts/active` is *operator-scoped*.
   **No branch-wide shifts list exists.**
3. **`PATCH /api/branches/:id`** — route does not exist (404). **M-P6's branch profile is
   read-only.**
4. ✅ **`GET /api/hr/employees`** — **FIXED 2026-08-20 (backend gap batch 1, C-02).** ~~returns
   `compensationProfile{baseAmount, salaryBasis, allowances, deductions}` on **every** row, plus
   `dateOfBirth`, `address`, and private HR `notes`~~. The default payload is now a safe projection
   whose sensitive columns are never selected from Postgres; `?view=full` restores the historical
   payload and requires `pos:hr:compensation:read`. ⚠️ Still **org-scoped with no branch filter**
   (MP0-06 / C-09 — unchanged), and ⚠️ the Manager token *does* hold `pos:hr:compensation:read`, so
   a deliberate `?view=full` still works for Manager (follow-up FU-1); the default payload the Staff
   directory fetches is compensation- and PII-free for every role.

> **Track B4 (2026-08-20) executed all 24 generators live.** Every one returned **201** with
> `status: COMPLETED` synchronously for a Manager token, confirming MP0-16's uniform DTO
> (`{reportWindow!, dateFrom?, dateTo?, parameters?}`, plus `limit?` on `top-items` alone). Also
> re-confirmed live: `GET /api/reports/catalog` returns a **bare array of 37** tagged
> `IMPLEMENTED` 24 / `CONDITIONAL` 1 / `PENDING_LATER` 12, every entry `formats: ["CSV"]`;
> `POST /api/reports/export` with `format: PDF` → **501**; a legacy PDF artifact's download → **404**
> (*"Export file not found on disk"*); `CUSTOM` without dates → **400**; and `GET /api/reports/:id`
> under **another branch's** `X-Branch-Id` → **200** (MP0-12).
> ⚠️ **New (B4-F2), not previously recorded:** `grossSales` carries **two different tax bases** in the
> same payload — `SUM(order.total)` (tax-inclusive) at summary level, but
> `SUM(orderItem.subtotal)` (**ex-tax**) inside `summary.topItems[]` and `summary.categories[]`.
> ⚠️ **New (B4-F3):** MP0-08's "no rows" is true at the top level, but **16 of 24 summaries embed a
> real breakdown array** which the CSV export is generated from. This does **not** unblock a pivot —
> there is still no per-order row payload — so **C-03 stays open**.
> ⚠️ **New (B4-F4):** `GET /api/reports/exports/:id/download` is org-scoped like `/reports/:id`.
> See [`ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`](../../ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md).

**Two further headline corrections to this matrix's body:**

- **Reports: the 17 generator rows below are a subset — the controller exposes 24.** The seven
  undocumented routes are `open-closed-orders` (`pos:reports:daily-sales:generate`),
  `cash-movements` (`pos:reports:cash-movements:generate`), `reservation-deposits` and
  `reservation-no-shows` (both `pos:reports:reservations:generate`), `event-bookings` and
  `event-checkins` (both `pos:reports:events:generate`), and `high-risk-actors`
  (`pos:reports:anomaly-summary:generate`). **Manager holds all 19 distinct generate permissions.**
  `POST /api/reports/cash-movements` has **no row in this matrix at all** — add it from the
  M-P0 report §8.1 when planning M-P5.
- **`GET /api/approvals` is not fully branch-scoped**, and **`POST /api/reports/export` really is
  gated by a *read* permission**. Both are detailed in their rows.

**Permission cross-check: 61 / 61 matrix permission strings are HELD by the seeded Manager**
(214-permission JWT). **There are no matrix rows whose permission the Manager lacks.** Every MVP
restriction (contracts, compensation, generic approvals decide, payroll) is therefore a
**product/safety constraint the frontend must enforce**, never a permission block — so
`lib/manager/permissions.ts` must be a **surface allow-list**, not a `hasPermission()` check.

---

| Surface | Method | Endpoint | Controller/service source | Permission | Role-scope notes | Data sensitivity | Read/write | MVP use | Caveats | Verified (M-P0, 2026-08-20) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | GET | `/api/dash/manager` | `DashboardsController` | `pos:dash:manager:read` | Branch-scoped | High (aggregate sales) | Read | Yes | Returns summary gross/net sales, order count, and counts for open orders, anomalies, and active shifts/tills. | 🟢 **200** — `dashboards.controller.ts:34-40`, perm matches. Response: `today{grossSales,netSales,orderCount,avgOrderValue}`, `openOrders`, `lowStockCount`, `anomalySummary{openCount,highCount}`, `shiftSummary{activeShifts,activeTills}`, `reservationsTodayCount`, `calculatedAt`. ⚠ **No `pendingApprovals` field** — KPI card 6 needs `/api/approvals`. ⚠ `netSales`=SUM(total, inc-tax) **>** `grossSales`=SUM(subtotal, ex-tax) (`dashboards.service.ts:52-53`) — do not label bare Gross/Net (MP0-10). |
| **Overview** | GET | `/api/dash/today-summary` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | High (sales summary) | Read | Yes | Returns branch-specific today summary numbers. | 🟢 **200** — `:44-50`, perm matches. Adds `taxTotal`, `discountTotal`, `refundsTotal`, `paymentMix{cash,card,momo}`, `closedOrders`, `anomalyOpenCount/HighCount`. ✅ **MP0-10 FIXED 2026-08-20:** `grossSales = SUM(order.total)` (tax-inclusive, discount applied) and `netSales = grossSales − taxTotal`, so **gross ≥ net always** (live: gross 33,014,100 / net 27,978,300 / tax 5,035,800, and gross = net + tax). The ex-tax pre-discount figure formerly published as `grossSales` is retained **additively** as **`subtotalSales`** (28,107,000). Same definition on `/dash/owner`, `/dash/manager`, `/stream/metrics`, `POST /dash/kpi/refresh` and the SHIFT_END/DAILY_SALES report summaries. |
| **Overview** | GET | `/api/dash/payment-mix` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Medium (payment mix) | Read | Yes | Returns breakdown by Cash, Card, and Mobile Money today. | 🟢 **200** — `:55-61`. **CONFIRMED** behind `pos:dash:today-summary:read`, not its own permission. Returns `{cash,card,momo,total,date,calculatedAt}`. |
| **Overview** | GET | `/api/dash/open-orders` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Medium (order listing) | Read | Yes | Lists active orders and their timestamps. | 🟢 **200** — `:66-72`. **CONFIRMED** behind `pos:dash:today-summary:read`. ✅ **MP0-09 FIXED 2026-08-20 (additively):** the response now carries **`total`** (the real open-order count, from the same shared `where` the dashboards count with), **`limit`** (50) and **`truncated`**. Live: `total: 107` == `/dash/manager.openOrders: 107` == `/dash/today-summary.openOrders`. ⚠ `count` **deliberately keeps its old meaning — rows in THIS response (page length, ≤50)** — so the B2 Overview keeps working; **use `total` for any number shown to a user**. Row: `{id,orderNumber,status,serviceType,total,createdAt}`. |
| **Overview** | GET | `/api/dash/low-stock` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Low (stock counts) | Read | Yes | Lists items currently below reorder thresholds. | 🟢 **200** — `:77-83`. **CONFIRMED** behind `pos:dash:today-summary:read`. Row: `{id,name,sku,unit,currentStock,reorderLevel,reorderQty}`. |
| **Overview** | POST | `/api/dash/kpi/refresh` | `DashboardsController` | `pos:dash:kpi:refresh` | Branch-scoped | Medium (cached KPIs) | Write | Yes | Forces recalculation of dashboard metrics. | 🟢 **201** — `:100-107`, perm matches. Executed live (MP0-QA). Returns a full `KpiSnapshot` row. |
| **Overview** | SSE | `/api/stream/metrics` | `StreamController` | None (Requires JWT) | Branch-scoped | Medium (activity stream) | Read | Yes | Event stream emitting live branch metrics every 15 seconds. | 🟢 **200** `text/event-stream` — `StreamController` `:122-148`. **Matrix claim CONFIRMED: no `@Permissions` decorator** (JWT + `BranchContextGuard` + `@RequireBranchContext()` only). **15 s interval verified live** (events 15.008 s apart). Payload is a **subset**: `{grossSales,netSales,openOrders,anomalyOpenCount,orderCount,timestamp}` — no lowStock/shift/reservation fields. Branch is captured at subscribe time → a branch switch requires stream teardown+reopen. No branch header → **400**; no token → **401**. ⚠ **`EventSource` cannot send these headers and no SSE client exists in `apps/web`** — M-P2 needs a fetch+ReadableStream reader (MP0-07). |
| **Operations** | GET | `/api/pos/orders` | `OrdersController` | `pos:orders:read` | Branch-scoped | Medium (orders list) | Read | Yes | Returns all active branch orders. | 🟢 **200** — `orders.controller.ts:51-52`, perm matches, branch-scoped. ⚠ `pageSize` **unbounded** (`list-orders-query.dto.ts:64-68` `@Min(1)`, no `@Max`); `?pageSize=500` returned 303 rows (MP0-11). |
| **Operations** | GET | `/api/pos/orders/:id` | `OrdersController` | `pos:orders:read` | Branch-scoped | Medium (order details) | Read | Yes | Returns order lines, status, and linked payments. | 🟢 **200** — `pos:orders:read`, branch-scoped. Keys: `id,orderNumber,status,serviceType,subtotal,tax,total,discount,items,table,user,anomalyFlags,splitFromOrderId,mergedIntoOrderId,notes,metadata`. |
| **Operations** | GET | `/api/tables` | `FloorController` | `pos:table:read` | Branch-scoped | Low (layout) | Read | Yes | Returns active floor plan tables and layout states. | 🟢 **200** — `floor.controller.ts:79-80`, perm matches. 22 rows (Tapas) / 16 (Rooftop). Row: `{id,label,capacity,status,isActive,floorPlan,floorPlanId,branchId,orgId,metadata}`. Related: `GET /api/floor-plans` (`pos:floor:read`) → 200; **`/api/floor/plans` → 404**. |
| **Operations** | GET | `/api/reservations` | `ReservationsController` | `pos:reservation:read` | Branch-scoped | Low (guest data) | Read | Yes | Lists branch reservations. | 🟢 **200** — `reservations.controller.ts:50-51`, perm matches. `pageSize` **clamped to 100** server-side (verified: `?pageSize=500` → response `pageSize: 100`). |
| **Operations** | GET | `/api/tills` | `TillsController` | `pos:till:read` | Branch-scoped | Medium (till register) | Read | Yes | Lists branch tills and active cashier sessions. | 🔴 **404 — ROUTE ABSENT.** `tills.controller.ts` has only `POST open`, `POST :id/safe-drop`, `POST :id/reconcile`, `GET active`, `GET :id`, `GET :id/summary`. `GET /tills/active` is **operator-scoped** (`tills.service.ts:284-297` filters `operatorUserId: userId`) → returns the caller's own till; live it returned **200 with an empty body** for the Manager. **There is no branch-wide tills list** (MP0-02). Use `/dash/manager.shiftSummary.activeTills` **count only**. |
| **Operations** | GET | `/api/shifts` | `ShiftsController` | `pos:shift:read` | Branch-scoped | Medium (staff shifts) | Read | Yes | Lists active and historical branch shifts. | 🔴 **404 — ROUTE ABSENT.** `shifts.controller.ts` has only `POST open`, `POST :id/close`, `GET active`, `GET :id`, `GET :id/summary`. `GET /shifts/active` is **operator-scoped** (`shifts.service.ts:147-161` filters `openedById: userId`) → live it returned the **Manager's own** shift `SH-TAPAS_DOWNTOWN-020` while `/dash/manager` reported `activeShifts: 2`. **No branch-wide shifts list** (MP0-02). Counts only. |
| **Approvals** | GET | `/api/approvals` | `UnifiedApprovalsController` | `approvals:read` | Branch-scoped | High (pending writes) | Read | Yes | Inbox aggregator listing discounts, refunds, leave, shift-swaps, and transfer reviews. **⚠️ 2026-08-20:** owner prefers domain-specific decision routes (Supervisor Option B precedent). Seed **does** grant Manager `approvals:read` (`packages/db/prisma/seed.ts:974`), so this row is permitted — use it for the **read/count** surface only (Overview approval counts). See the header annotation. | 🟡 **200** — `unified-approvals.controller.ts:32-33`, perm matches; Manager **does** hold `approvals:read` (verified in the live 214-perm JWT). Response `{data,total,page,pageSize,filters,registry}`. ⚠ **NOT fully branch-scoped**: `unified-approvals.service.ts:272-273` applies `branchId` only when `source.branchScoped`. Per `approval-source.types.ts`, `discount`/`refund`/`shift_swap` are branch-scoped; **`leave_request`, `vendor_bill`, `inter_branch_transfer` are ORG-scoped**. Live with X-Branch-Id=Tapas: `total: 16` spanning **5 branches**, including `Main Branch` (not a Manager membership) and 5 FINANCE `vendor_bill` rows. M-P2 must filter by `branchId` and/or `domain`/`sourceType` (MP0-05). |
| **Approvals** | GET | `/api/approvals/:id` | `UnifiedApprovalsController` | `approvals:read` | Branch-scoped | High (action details) | Read | Yes | Returns complete payload and reason of a pending escalation. **⚠️ 2026-08-20:** read-only detail is acceptable under the Option B preference; the **decision** must go to the domain endpoint. See the header annotation. | 🟢 **200** — `:53-54`, perm matches. Returns `{id,sourceType,sourceEntityId,summary{...,actionsAvailable},source{full record}}`. Sufficient for a read-only escalation detail panel. |
| **Approvals** | POST | `/api/approvals/:id/decide` | `UnifiedApprovalsController` | `approvals:decide` | Branch-scoped | High (decision write) | Write | Yes | Executes approval or rejection of the target entity. **⚠️ 2026-08-20 — owner prefers domain-specific decision routes** (`/pos/discounts/:id/approve\|reject`, `/pos/refunds/:id/approve`, `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`) over this generic route; use it **only** where the DTO mapping is provably clear (MANAGER-GAP-007). Seed **does** grant Manager `approvals:decide` (`packages/db/prisma/seed.ts:975`) — unlike Supervisor, which holds neither `approvals:*` string — so this is a **product/safety** constraint the frontend must enforce, not a permission block. See the header annotation. | 🟢 not exercised (mutation) — `:74-76`, `@HttpCode(200)`, perm matches; Manager holds `approvals:decide`. **DTO captured** (`dto/decide-approval.dto.ts`): `{decision: 'APPROVE'\|'REJECT' (required), reason?: string 1-500, managerPin?: string 4-12}` — **uniform across all 6 source types**; there are no source-specific dynamic parameters at the DTO boundary, so **MANAGER-GAP-007's payload risk is narrower than documented**. The Option B preference stands as a product/safety decision. |
| **Approvals** | POST | `/api/pos/discounts/:id/approve` | `DiscountsController` | `pos:discount:approve` | Branch-scoped | High | Write | Yes | Direct domain-specific discount override. | 🟢 not exercised (mutation) — `discounts.controller.ts:56-58`, perm matches. Reject counterpart `POST /pos/discounts/:id/reject` (`:72-74`) shares `pos:discount:approve`. Read side `GET /pos/discounts/pending` (`:88-89`, same perm) → live **200** (`[]`). ⚠ **No branch-wide discount list** beyond `/pending` (SUP-RG-035). |
| **Approvals** | POST | `/api/pos/refunds/:id/approve` | `RefundsController` | `pos:refund:approve` | Branch-scoped | High | Write | Yes | Direct domain-specific refund approval. | 🟢 not exercised (mutation) — `refunds.controller.ts:64-66`, perm matches. ⚠ **No branch-wide refunds list endpoint** — only `GET /pos/refunds/:id` and `GET /pos/orders/:id/refunds`. `GET /api/approvals` is the only branch-wide refund-escalation read. |
| **Approvals** | POST | `/api/pos/orders/:id/post-close-void` | `RefundsController` | `pos:void:postclose` | Branch-scoped | High | Write | Yes | Void a closed order (requires manager approval). | 🟢 not exercised (mutation) — `refunds.controller.ts:94-96`, perm `pos:void:postclose` matches. |
| **Staff** | GET | `/api/hr/employees` | `HrController` | `pos:hr:employees:read` | Branch-scoped | Medium | Read | Yes | Lists employee records. | ✅ **200 — C-02 FIXED 2026-08-20 (backend gap batch 1).** ~~`hr.service.ts:252` unconditionally `include: { position: true, compensationProfile: true }`; all 40 live rows returned `compensationProfile{salaryBasis, baseAmount, currency, allowances, deductions}` plus `email, phone, address, dateOfBirth, emergencyContact*, notes, metadata`.~~ The **default** response is the safe projection — `{id, orgId, branchId, userId, employeeCode, firstName, middleName, lastName, phone, email, hireDate, status, employmentType, positionId, compensationProfileId, createdAt, updatedAt, position}` — and the excluded columns are **not selected from Postgres at all**, so no `include` can leak them by accident. Response gains `view: "safe" | "full"`. `?view=full` returns the historical payload and is gated by the pre-existing `pos:hr:compensation:read` (**403** without it, verified live as supervisor); an unknown `view` value is a **400**. Live as manager: 40 rows, **zero** forbidden keys, payload contains no `baseAmount`. ⚠️ Manager DOES hold `pos:hr:compensation:read`, so a deliberate `?view=full` still works for Manager — narrowing that grant is a seed change and is follow-up **FU-1**. ⚠️ Still **ORG-scoped** — `where = { orgId }` with no branch filter; `?branchId=` → **400** (MP0-06 / C-09, unchanged). ⚠️ `take` still unbounded (C-12, unchanged). |
| **Staff** | POST | `/api/hr/employees` | `HrController` | `pos:hr:employees:create` | Branch-scoped | High (PII) | Write | Yes | Creates staff user record. Comp fields must be omitted from UI. | 🟢 not exercised (mutation) — `hr.controller.ts:32-33`, perm matches. | ✅ **C-02:** the create echo is now the safe projection too — it returns `compensationProfileId` (so the caller can confirm the link) but **not** `compensationProfile`, `dateOfBirth`, `address`, `emergencyContact*`, `notes` or `metadata`.
| **Staff** | PATCH | `/api/hr/employees/:id` | `HrController` | `pos:hr:employees:update` | Branch-scoped | High | Write | Yes | Updates staff profile (excludes compensation fields). | 🟢 not exercised (mutation) — `hr.controller.ts:60-61`, perm matches. ⚠ `GET /api/hr/employees/:id` (`:53-54`, same read perm) additionally returns **`contracts[]`** with `salaryBasis` + `salaryAmount` — M-P4 should avoid the detail route when the list row suffices (MP0-01). | ✅ **C-02:** the update echo is the safe projection. `GET /api/hr/employees/:id` no longer returns `contracts[].salaryAmount`/`salaryBasis` on the default path — the contracts array is kept, projected to `{id, contractNumber, contractStatus, startsAt, endsAt, createdAt, updatedAt}`; `?view=full` restores the old payload under `pos:hr:compensation:read`.
| **Staff** | POST | `/api/hr/frontline-staff/onboard` | `HrController` | `hr:frontline-staff:create` | Branch-scoped | High | Write | Yes | One-call endpoint to onboard frontline staff. | 🟢 not exercised (mutation) — `hr.controller.ts:146-147`, `@HttpCode(201)`, perm matches. **DTO decorator-verified** (`dto/frontline-staff-onboard.dto.ts`): `{email? (@IsEmail), firstName! (≤100), lastName! (≤100), phone! (≤30, /^[0-9+()\-\s]{6,30}$/), roleName! (role NAME string), issueQuickPin? (defaults TRUE for frontline roles), enablePasswordLogin? (default FALSE), temporaryPassword? (8-128, required only when enablePasswordLogin=true), employee!: {employeeCode?, hireDate!, employmentType!, positionId?, contractId?, compensationProfileId?}}`. **MANAGER-GAP-005 CONFIRMED** — `frontline-staff-onboarding.service.ts:273-284,361-366` returns `quickPin: {pin (PLAINTEXT), pinLength, tier}` (MP0-14). ⚠ The nested `employee` accepts **`contractId` and `compensationProfileId`** — the Manager form must never expose or send either (MP0-15). |
| **Staff** | GET | `/api/hr/frontline-staff/:id/quick-pin-status` | `HrController` | `auth:quick-pin:read` | Branch-scoped | Medium | Read | Yes | Retrieves whether an employee has a PIN set and is active. | 🟢 **200** — `hr.controller.ts:163-164`, perm matches. Returns `{employeeId,userId,firstName,lastName,phone,email,orgId,branchId,pinEnabled,pinExists,pinIssuedAt,pinLastResetAt,pinLastUsedAt,pinTier,pinLength,failedPinAttempts,...}` — contact PII must be whitelisted away. |
| **Staff** | POST | `/api/hr/frontline-staff/:id/quick-pin/reset` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Resets frontline employee's quick PIN. | 🟢 not exercised (mutation) — `hr.controller.ts:177-178`, `@HttpCode(200)`, perm matches. DTO `FrontlineQuickPinResetDto = { branchId?: string }`. **Returns a fresh plaintext PIN once** (MP0-14). |
| **Staff** | PATCH | `/api/hr/frontline-staff/:id/quick-pin/disable` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Disables frontline PIN login access. | 🟢 not exercised (mutation) — `hr.controller.ts:193-194`, `@HttpCode(200)`, perm matches. |
| **Staff** | PATCH | `/api/hr/frontline-staff/:id/quick-pin/enable` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Re-enables frontline PIN login access. | 🟢 not exercised (mutation) — `hr.controller.ts:208-209`, `@HttpCode(200)`, perm matches. |
| **Staff** | GET | `/api/hr/attendance` | `AttendanceController` | `pos:hr:attendance:read` | Branch-scoped | Medium | Read | Yes | View branch employee clock-in/out timeline. | 🟢 **200** (`total: 28`) — perm matches. ⚠ Embeds a full nested `employee` object carrying `address, dateOfBirth, phone, email, emergencyContact*, notes, metadata, compensationProfileId` (no salary object). Same allow-list projection applies. |
| **Staff** | GET | `/api/hr/leave` | `AttendanceController` | `pos:hr:leave:read` | Branch-scoped | Medium | Read | Yes | View leave requests. | 🟢 **200** (`total: 4`) — perm matches. `pageSize`/`take` **bounded** `@Max(100)` (`list-leave-query.dto.ts:50`). Embeds nested `employee` (PII, no salary object). |
| **Staff** | PATCH | `/api/hr/leave/:id/review` | `AttendanceController` | `pos:hr:leave:review` | Branch-scoped | High | Write | Yes | Manager leave review (Approve/Reject). | 🟢 not exercised (mutation) — perm matches. Org-scoped by design (leave has a nullable branch). **Make no payroll or roster claim** (Supervisor precedent). |
| **Staff** | GET | `/api/hr/shift-swaps` | `AttendanceController` | `pos:hr:shift-swaps:read` | Branch-scoped | Medium | Read | Yes | View shift swap proposals. | 🟢 **200** (`total: 2`) — `attendance.controller.ts:110-111`, perm matches. `@Max(100)` bounded. Embeds nested `requester`/`target` employee objects (PII, no salary object). |
| **Staff** | PATCH | `/api/hr/shift-swaps/:id/approve` | `AttendanceController` | `pos:hr:shift-swaps:approve` | Branch-scoped | High | Write | Yes | Approve or reject shift swaps. | 🟢 not exercised (mutation) — `attendance.controller.ts:121-122`, perm matches. ⚠ **§8 contradiction #5 RE-CONFIRMED (SUP-RG-036/042 still holds).** `attendance.service.ts:555-623` mutates **only** `ShiftSwapRequest` (status/approvedById/approvedAt/reviewNotes via a concurrency-safe `updateMany`) + one audit row. A repo-wide grep finds **six** `scheduleAssignment` call sites, **all reads** (`attendance.service.ts:439,454`; `staff-insights.service.ts:293`; `workforce.service.ts:425,436,467`) — there is **no** create/update/delete anywhere in the API. **Approving mutates ZERO roster rows.** M-P4 must follow Supervisor **Outcome C**: honest notice, no Approve control implying a roster change. |
| **Staff** | GET | `/api/hr/contracts` | `HrController` | `pos:hr:contracts:read` | Branch-scoped | Critical (Compensation) | Read | Deferred | Returns contract records. Defer from MVP to avoid exposing compensation. | 🟢 **200** — `hr.controller.ts:91-92`, perm matches. **Manager DOES hold `pos:hr:contracts:read`** — the deferral is a product decision, not a permission block (like `approvals:*`). Stays **Deferred**; never fetched. |
| **Staff** | POST | `/api/hr/contracts` | `HrController` | `pos:hr:contracts:create` | Branch-scoped | Critical (Salary/Rates) | Write | Deferred | Create contract records. Defer from MVP. | 🟢 not exercised (mutation) — `hr.controller.ts:77-78`, perm matches; Manager holds `pos:hr:contracts:create`. Stays **Deferred**. |
| **Reports** | GET | `/api/reports` | `ReportsController` | `pos:reports:history:read` | Branch-scoped | Medium | Read | Yes | Lists historical runs of generated reports. | 🟢 **200** — `reports.controller.ts:589-591`, perm matches, branch-scoped. Returns `{data,total,page,pageSize}`; rows carry `exportArtifacts[]`. ⚠ `pageSize` **unbounded** (`list-reports-query.dto.ts` `@Min(1)`, no `@Max`) (MP0-11). |
| **Reports** | GET | `/api/reports/:id` | `ReportsController` | `pos:reports:history:read` | Branch-scoped | Medium (report data) | Read | Yes | Retrieves generated report content payload. | 🟡 **200** — `reports.controller.ts:598-600`, perm matches. ⚠ **The matrix's "content payload" claim is FALSE.** The response carries `rowCount` (e.g. 219) and an aggregate `summary` object and **no rows at all** — no `data`/`rows`/`payload` key. `managerui.md` §8's readable row table is **not buildable from this route** (MP0-08). ⚠ Also **org-scoped only** — `getReportById(ctx.organizationId, id)`, no `branchId`; a Rooftop run was fetched live with X-Branch-Id=Tapas → **200** (MP0-12). |
| **Reports** | POST | `/api/reports/shift-end` | `ReportsController` | `pos:reports:shift-end:generate` | Branch-scoped | Medium | Write | Yes | Generates till/cashier session closeout audits. | 🟢 not exercised (mutation) — `:52-54`, perm matches, **held**. DTO = `{reportWindow!: DAY\|WEEK\|MONTH\|CUSTOM, dateFrom?, dateTo?, parameters?}`. |
| **Reports** | POST | `/api/reports/daily-sales` | `ReportsController` | `pos:reports:daily-sales:generate` | Branch-scoped | High (sales totals) | Write | Yes | Generates aggregate branch revenue breakdown. | 🟢 **201 — EXECUTED LIVE (MP0-QA)** — `:73-75`, perm matches. `{reportWindow:'DAY'}` → `status: COMPLETED` synchronously, `rowCount: 219`, `summary{grossSales,netSales,taxTotal,discountTotal,orderCount,avgOrderValue,refundTotal,refundCount,paymentBreakdown{CARD,CASH,BANK_TRANSFER}}`. Generation is **synchronous** — no polling state to build. |
| **Reports** | POST | `/api/reports/payment-mix` | `ReportsController` | `pos:reports:payment-mix:generate` | Branch-scoped | Medium | Write | Yes | Generates cash/card/momo breakdown. | 🟢 not exercised (mutation) — `:94-96`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/top-items` | `ReportsController` | `pos:reports:top-items:generate` | Branch-scoped | Medium | Write | Yes | Generates menu item popularity report. | 🟢 not exercised (mutation) — `:115-117`, perm matches, held. **The only DTO variant** — adds optional `limit?: number` (`@IsInt @Min(1)`). |
| **Reports** | POST | `/api/reports/sales-by-category` | `ReportsController` | `pos:reports:sales-by-category:generate` | Branch-scoped | Medium | Write | Yes | Generates menu category revenue report. | 🟢 not exercised (mutation) — `:137-139`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/sales-by-hour` | `ReportsController` | `pos:reports:sales-by-hour:generate` | Branch-scoped | Medium | Write | Yes | Generates peak hours revenue report. | 🟢 not exercised (mutation) — `:158-160`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/discounts-summary` | `ReportsController` | `pos:reports:discounts:generate` | Branch-scoped | High (margins) | Write | Yes | Generates totals and list of approved discounts. | 🟢 not exercised (mutation) — `:204-206`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/voids-summary` | `ReportsController` | `pos:reports:voids:generate` | Branch-scoped | High (losses) | Write | Yes | Generates totals and list of order voids. | 🟢 not exercised (mutation) — `:225-227`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/refunds-summary` | `ReportsController` | `pos:reports:refunds:generate` | Branch-scoped | High (margins) | Write | Yes | Generates totals and list of order refunds. | 🟢 not exercised (mutation) — `:246-248`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/cash-variance` | `ReportsController` | `pos:reports:cash-variance:generate` | Branch-scoped | High | Write | Yes | Generates till drop/reconcile discrepancies. | 🟢 not exercised (mutation) — `:271-273`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/stock-variance` | `ReportsController` | `pos:reports:stock-variance:generate` | Branch-scoped | High (shrinkage) | Write | Yes | Generates count variance audits. | 🟢 not exercised (mutation) — `:317-319`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/wastage-summary` | `ReportsController` | `pos:reports:wastage:generate` | Branch-scoped | Medium | Write | Yes | Generates inventory write-off logs. | 🟢 not exercised (mutation) — `:338-340`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/low-stock` | `ReportsController` | `pos:reports:low-stock:generate` | Branch-scoped | Low | Write | Yes | Generates inventory replenishment list. | 🟢 not exercised (mutation) — `:359-361`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/reservation-summary` | `ReportsController` | `pos:reports:reservations:generate` | Branch-scoped | Low | Write | Yes | Generates guest seating/booking summary. | 🟢 not exercised (mutation) — `:384-386`, perm matches, held. Same uniform DTO. ⚠ Two **undocumented siblings** share this permission: `POST /reports/reservation-deposits` (`:405-407`) and `POST /reports/reservation-no-shows` (`:426-428`). |
| **Reports** | POST | `/api/reports/event-summary` | `ReportsController` | `pos:reports:events:generate` | Branch-scoped | Low | Write | Yes | Generates ticket revenue/attendance summary. | 🟢 not exercised (mutation) — `:451-453`, perm matches, held. Same uniform DTO. ⚠ Two **undocumented siblings** share this permission: `POST /reports/event-bookings` (`:472-474`) and `POST /reports/event-checkins` (`:493-495`). |
| **Reports** | POST | `/api/reports/anomaly-summary` | `ReportsController` | `pos:reports:anomaly-summary:generate` | Branch-scoped | High (security) | Write | Yes | Generates high-risk operational incident log. | 🟢 not exercised (mutation) — `:518-520`, perm matches, held. Same uniform DTO. ⚠ One **undocumented sibling** shares this permission: `POST /reports/high-risk-actors` (`:539-541`). |
| **Reports** | POST | `/api/reports/staff-operations` | `ReportsController` | `pos:reports:staff-operations:generate` | Branch-scoped | Medium | Write | Yes | Generates speed-of-service/table performance. | 🟢 not exercised (mutation) — `:564-566`, perm matches, held. Same uniform DTO. |
| **Reports** | POST | `/api/reports/export` | `ReportsController` | `pos:reports:exports:read` | Branch-scoped | Medium | Write | Yes | Packages report run payload into an export file. | 🟡 **201 — EXECUTED LIVE (CSV + PDF).** `reports.controller.ts:607-609`. **`pos:reports:exports:read` on a WRITE route CONFIRMED verbatim** — a read permission gating a route that creates an `ExportArtifact` and writes a file. Recorded as a **backend guard defect** (MP0-13); no Manager impact (all export perms held); **not fixed**. DTO `CreateExportDto = {reportRunId!: string, format!: CSV\|PDF}`. ✅ **C-01 / MP0-03 FIXED 2026-08-20** — ~~The PDF is NOT a PDF: `generateTextPdf()` built plain text while the artifact was stamped `application/pdf` at `status: READY`.~~ `format: PDF` now returns **501 Not Implemented** *before* any artifact row is created (no `PENDING`/`FAILED` litter, no file), with a message naming the missing renderer and pointing at CSV; `generateTextPdf` is deleted and all 37 catalog entries advertise `formats: ['CSV']`. The same 501 applies through the BG6 facade `POST /api/exports`. **B4 ships CSV-only by contract, not by UI convention.** No renderer was added (OD-10 open). ⚠️ `ExportArtifact` rows created **before** this change keep their fake `application/pdf` mime type and remain downloadable. ⚠ The CSV is the **summary only** (11 metric rows) despite `rowCount: 219`. Failure modes truthful: unknown run → **404**; non-COMPLETED run → **400**; generator throw → artifact `FAILED` + `failureReason`. ⚠ Lookup is `{id, orgId}` — **no branchId** (MP0-12). |
| **Reports** | GET | `/api/reports/exports/:id/download` | `ReportsController` | `pos:reports:exports:download` | Branch-scoped | Medium | Read | Yes | File download stream for generated reports. | 🟢 **200** — `reports.controller.ts:622-624`, perm matches. CSV: `Content-Type: text/csv`, 254 bytes, well-formed. PDF: **no new PDF artifact can be created since 2026-08-20 (C-01)**; pre-existing rows still stream as `application/pdf` plain text (see the export row). Unknown artifact → **404** `Export artifact not found`. |
| **Reports** | GET | `/api/reports/catalog` | `ReportsController` | `pos:reports:catalog:read` | Branch-scoped | Low | Read | Yes | Retrieves list of printable formats and templates. | 🟢 **200** — `reports.controller.ts:40-42`, perm matches. **37 entries**, each `{key,title,description,status,formats,permission}`. `status` ∈ `IMPLEMENTED` (**24** — exactly the 24 live generator routes), `CONDITIONAL` (1: `MENU_ENGINEERING`), `PENDING_LATER` (12: `CUSTOMER_FEEDBACK, DOCUMENT_EXPORT_PACKS, LABOR_HOURS, PAYROLL_SUMMARY, PROFIT_AND_LOSS, BALANCE_SHEET, CASH_FLOW, AP_AGING, AR_AGING, BUDGET_VS_ACTUAL, FRANCHISE_ROLLUP, SCHEDULED_DIGEST` — all against `pos:reports:history:read`, **no generate route**). **This is the truthful MANAGER-GAP-008 generator-availability source.** ⚠ `PAYROLL_SUMMARY` + the accounting reports are also **out of Manager scope** — exclude by key, not by status. |
| **Settings** | GET | `/api/branches` | `BranchesController` | `tenancy:branch:read` | Organization-scoped | Low | Read | Yes | Lists organization branches. Used for branch context switching. | 🟡 **200** (4 rows) — `tenancy.controller.ts:57-60`. ⚠ **The permission column is wrong**: the route carries **no `@Permissions` decorator at all** — only `@UseGuards(JwtAuthGuard)`. Scoping is `listBranches(user.id)` → membership-filtered. Fields: `{id,organizationId,organization{id,name,slug},name,code,slug,timezone,currencyCode,address,phone,email,status,membershipRole,isDefaultBranch,createdAt,updatedAt}` (MP0-17). M-P1 should prefer `me.memberships` for the switcher (no extra shell request). |
| **Settings** | PATCH | `/api/branches/:id` | `BranchesController` | `tenancy:branch:write` | Branch-scoped | Medium | Write | Yes | Updates branch settings (e.g. name, address). | 🔴 **404 — ROUTE ABSENT.** Live: `Cannot PATCH /api/branches/cb27be...`. `tenancy.controller.ts` exposes `POST orgs`, `GET orgs`, `GET orgs/:orgId`, `POST orgs/:orgId/branches`, `GET branches`, `GET branches/:branchId`, membership routes, `GET me`, `GET branch-test` — **no branch-update route of any method**. **M-P6's branch profile must ship READ-ONLY** (MP0-04). Adding a PATCH is a backend addition — documented, not implemented. |
| **Settings** | GET | `/api/devices` | `DeviceRegistryController` | `devices:read` | Branch-scoped | Low | Read | Yes | Lists registered branch hardware/stubs. | 🟢 **200** — `device-registry.controller.ts:227-228`, perm matches. `{data,total:4,page:1,pageSize:50}`; row `{id,orgId,branchId,type,name,station,activationCode,status,pairedToDeviceId,capabilities,metadata,lastSeenAt,...}`. Rows carry `metadata:{liveHardware:false}` — a truthful signal to surface with the metadata-only copy. |
| **Settings** | POST | `/api/devices/activate` | `DeviceRegistryController` | `devices:write` | Branch-scoped | Medium | Write | Yes | Registers and activates device slots. | 🟢 not exercised (mutation) — `:52-54`, `@HttpCode(200)`, perm matches. |
| **Settings** | POST | `/api/devices/printers/routes` | `DeviceRegistryController` | `devices:routes:write` | Branch-scoped | Medium | Write | Yes | Adds or updates receipt/KDS routing rules. | 🟢 not exercised (mutation) — `:118-120`, perm matches. ⚠ The matrix **omits the read side**: `GET /api/devices/printers/routes` (`:149-150`, `devices:read`) → live **200**, rows `{id,orgId,branchId,printerId,routeType,station,enabled,priority,...}`. M-P6 needs it. |
| **Settings** | POST | `/api/devices/terminals/pair` | `DeviceRegistryController` | `devices:terminals:write` | Branch-scoped | Medium | Write | Yes | Initiates pairing sequence with terminal stub. | 🟢 not exercised (mutation) — `:158-160`, perm matches. Counterpart `PATCH /devices/terminals/:id/unpair` (`:189-191`, same perm). ⚠ `GET /api/devices/terminals` → **404** (no such route; terminals are `type`-filtered devices). Stub-only per the locked decision. |

---

## Addendum (2026-08-20) — Manager-relevant backend endpoints this matrix OMITS

**Author:** Odoo-reference research pass (`ai/ODOO_REFERENCE_RESEARCH.md`, `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md`).
**Why this exists:** the owner's target Manager/Owner experience is a **top-nav module suite** modelled on his Odoo instance (Dashboard · Customers · Vendors · Accounting · Review · Reporting · Configuration). Building that requires read surfaces this matrix never enumerated. Per instruction, **the matrix above is not rewritten** — the omissions are recorded here.

### Method and status

Routes below were found by a **static scan** of `apps/api/src/modules/**/*.controller.ts` (`@Controller` prefix + `@Get/@Post/@Patch/@Put/@Delete` decorators) on 2026-08-20. Unlike the 62 rows above, **none of these were live-probed, permission-checked, or payload-inspected in this pass.**

> 🔴 **Do not treat any row in this addendum as verified.** They are *claimed by code*. An M-P0-style live verification pass is required before any of them is designed against — most urgently the AP/AR/bank-rec/budget block, which is the largest single omission.

### A. Undocumented modules — not mentioned anywhere in this matrix, and marked "⬜ Planned" in `docs/MODULES.md`

`docs/MODULES.md` currently states *"Accounting (COA, GL, AP, AR) — M32–M36 — ⬜ Planned"* and *"Budgets / Forecasts — M37 — ⬜ Planned"*. **The controllers exist and are wired.** That documentation row is stale.

| Module | Controller | Prefix | Routes (verbatim decorators) |
|---|---|---|---|
| `accounts-payable` | `accounts-payable.controller.ts` | `accounting/ap` | `POST/GET suppliers`, `GET suppliers/:id`, `POST/GET bills`, `GET bills/:id`, `POST bills/:id/approve`, `POST/GET payments`, `POST/GET credit-notes`, `GET aging`, `POST/GET recurring-profiles`, `PATCH recurring-profiles/:id`, `POST recurring-profiles/:id/generate-bill`, `POST reminders/generate`, `GET reminders`, `POST reminders/:id/dismiss` |
| `accounts-receivable` | `accounts-receivable.controller.ts` | `accounting/ar` | `POST/GET accounts`, `GET accounts/:id`, `POST/GET invoices`, `GET invoices/:id`, `POST receipts`, `GET aging`, `POST/GET credit-notes` |
| `bank-rec` | `bank-rec.controller.ts` | `accounting` | `GET/POST bank-accounts`, `GET bank-statements`, `GET bank-statements/:id`, `POST bank-statements/import`, `GET reconciliation`, `GET reconciliation/:id`, `POST reconciliation`, `PATCH reconciliation/:id/match`, `PATCH reconciliation/:id/skip`, `POST reconciliation/:id/complete`, `POST manual-bank-entries`, `GET period-close-runs`, `PATCH periods/:id/close`, `PATCH periods/:id/lock` |
| `budget` | `budget.controller.ts` | `finance` (×2), `franchise` | `GET budgets`, `GET budgets/:id`, `POST budgets`, `POST budgets/:id/update-actuals`, `GET procurement-suggestions`, `PATCH procurement-suggestions/:id/review`, `GET/POST demand-calendar`, `GET/PATCH/DELETE demand-calendar/:id`, `GET franchise/forecast` |

### B. Accounting foundation + GL — documented in `docs/` but absent from this matrix

| Controller | Prefix | Routes |
|---|---|---|
| `accounting.controller.ts` | `accounting` | `GET/POST accounts`, `GET/POST cost-centers`, `GET/POST periods`, `PATCH periods/:id/open`, `GET posting-source-maps`, `PATCH posting-source-maps/:id`, `GET/PATCH tax-config` |
| `ledger.controller.ts` | `accounting` | `POST/GET journals`, `GET journals/:id`, `POST journals/:id/reverse`, `POST posting/replay`, `GET posting-runs`, `GET posting-errors`, `GET posting-errors/:id` |

Cross-reference: `docs/ACCOUNTING_FOUNDATION_GUIDE.md` (Manager holds read on accounts/cost-centers/periods/posting-source-maps/tax-config and create on accounts/cost-centers/periods) and `docs/GL_POSTING_ENGINE_GUIDE.md` (Manager holds `journals:read`, `posting-runs:read`, `posting-errors:read`; **not** `journals:create`, `journals:reverse`, `posting:replay`). Those role tables are the guides' claims and were **not re-verified here**.

### C. Settings / administration — omitted read+write surfaces

`settings.controller.ts` uses a bare `@Controller()`, so paths are absolute:

`GET/PATCH /api/settings` · `GET/PUT /api/settings/currency` · `GET/PUT /api/settings/tax-matrix` · `GET/PUT /api/settings/rounding` · `GET/PATCH /api/thresholds` · `GET/PUT /api/settings/platform-access` · `POST /api/settings/exchange-rate` · `GET /api/settings/exchange-rates`

*(Only `thresholds` appears anywhere in the matrix above; the eight settings routes do not.)*

### D. Alerts — the entire module is omitted

`alerts.controller.ts`, bare `@Controller()`:

`GET /api/alerts` · `GET/POST /api/alerts/rules` · `PATCH /api/alerts/rules/:id` · `GET/POST /api/alerts/channels` · `PATCH /api/alerts/channels/:id` · `POST /api/alerts/test` · `GET /api/alerts/deliveries` · `POST /api/alerts/deliveries/:id/retry` · `GET/POST /api/alerts/digests` · `PATCH /api/alerts/digests/:id` · `POST /api/alerts/digests/:id/run` · `GET /api/owner/live`

Note the owner decision locks alert **rules** to defer-or-read-only; the **deliveries**, **channels** and **digests** read surfaces are unaffected by that decision and are needed for a Settings module.

### E. Reliability / sync — omitted

`reliability.controller.ts`, bare `@Controller()`:

`POST /api/sync/replay` · `GET /api/sync/jobs` · `GET /api/sync/jobs/:id` · `POST /api/sync/jobs/:id/retry` · `GET /api/sync/conflicts` · `PATCH /api/sync/conflicts/:id/resolve` · `POST /api/idempotency/inspect`

*(The conflict **diff** is deferred by owner decision; the jobs list and conflict list are not.)*

### F. Audit — omitted

`audit-timeline.controller.ts` → `GET /api/audit/timeline`.

This is the backing endpoint for an Odoo-**chatter**-equivalent surface (see component C6 in `ai/ODOO_REFERENCE_RESEARCH.md`). Manager holds `audit:read` per `packages/db/prisma/seed.ts` as recorded in the header note above.

### G. Analytics — only one route of fourteen is in the matrix

The matrix carries `PATCH /api/analytics/anomalies/:id/acknowledge`. Also present in `analytics.controller.ts` (prefix `analytics`):

`POST/GET anomaly-rules` · `GET anomaly-rules/:id` · `PATCH anomaly-rules/:id` · `GET anomalies` · `GET anomalies/:id` · `PATCH anomalies/:id/resolve` · `GET risk-dashboard` · `GET staff-risk/:userId` · `GET thresholds` · `PATCH thresholds/:id` · `POST anomalies/recalculate`

`GET /api/analytics/anomalies` and `GET /api/analytics/risk-dashboard` are the obvious feeds for a Manager risk surface and are **not listed above**.

### H. HR / workforce / staff — partial coverage

Present in code, absent from the matrix:

- `hr.controller.ts`: `POST/GET /api/hr/positions`, `POST/GET /api/hr/compensation-profiles` — **note both are compensation-adjacent and fall under the locked exclusion; listed for completeness, not for use.**
- `attendance.controller.ts`: `GET/POST /api/hr/attendance/policies`, `PATCH /api/hr/attendance/policies/:id`
- `workforce.controller.ts` (prefix `workforce`): `POST/GET templates`, `POST/GET schedules`, `GET schedules/:id`, `PATCH schedules/:id/publish`, `PATCH schedules/:id/archive`, `GET roster`, `POST/GET coverage-rules`, `GET coverage-gaps`
- `staff-insights.controller.ts` (prefix `staff`): `GET/PATCH weights`, `GET insights`, `GET insights/:employeeId`, `POST insights/generate`, `POST/GET awards`, `POST promotion-suggestions/generate`, `GET promotion-suggestions`, `PATCH promotion-suggestions/:id/decision`

### I. Exports — the generic controller is omitted

`exports.controller.ts` (prefix `exports`): `GET /api/exports/:id`, `GET /api/exports/:id/download`. Distinct from `GET /api/reports/exports/:id/download` which the matrix does carry. **MP0-03 is fixed at the source (C-01, 2026-08-20): this facade delegates to `ReportsService.createExport`, so `format: PDF` returns 501 here too — verified live. Artifacts created before that date keep the fake mime type.**

### J. Franchise / multi-branch rollup — omitted

- `franchise.controller.ts` (prefix `franchise`): `GET overview`, `GET/POST rankings`, `GET budgets`, `POST/GET transfers`, `GET transfers/:id`, `PATCH transfers/:id/status`, `GET procurement-pressure`, `POST/GET digests`, `PATCH digests/:id`
- `franchise-analytics.controller.ts` (prefix `franchise`): `GET consolidated-finance`, `POST consolidated-finance/generate`, `GET financial-comparison`, `GET waste-benchmarks`, `POST waste-benchmarks/generate`, `GET scorecards`, `POST scorecards/generate`, `POST rankings/generate-deep`, `GET drilldown`

Relevant only if the Manager suite ever spans branches; **`GET /api/approvals` org-scoping (MP0-05) is a warning that org-scoped rollups leak across branches**.

### K. Other manager-adjacent controllers not in the matrix

`inventory` (`GET levels`, `POST adjustments`, `POST/GET batches`, `GET items/:id/batches`) · `documents` (`POST upload`, `GET`, `GET/PATCH storage-config`, `GET :id`, `GET :id/download`, `DELETE :id`, `POST :id/link`, `GET :id/links`, `PATCH :id/metadata`) · `feedback` (`POST/GET requests`, `PATCH requests/:id/cancel`, `GET`, `GET nps-summary`, `GET tags`, `GET :id`, `PATCH :id/tag|acknowledge|resolve`) · `receipts` (`GET :id`, `GET :id/history`, `POST :id/reprint`, `POST :id/send`) · `tenancy` (`GET /api/orgs`, `GET /api/orgs/:orgId`, `POST/GET /api/orgs/:orgId/branches/:branchId/memberships`) · `payroll` (14 routes — **excluded by locked owner decision**, listed so nobody re-discovers it as "missing").

### Recommended follow-up

1. Correct `docs/MODULES.md` — the AP/AR/accounting/budgets rows are wrong.
2. Run an **M-P0-style live verification** over sections A and B before any accounting UI design work. That block is ~90 endpoints and is the single largest determinant of the manager suite's true scope.
3. Sections C, D, E, F, G are the Settings/Review-equivalent surfaces a top-nav manager suite needs and should be verified next.
