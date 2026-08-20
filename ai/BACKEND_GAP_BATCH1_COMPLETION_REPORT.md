# Backend Gap Batch 1 — Completion Report

**Date:** 2026-08-20
**Scope:** `ai/ENTERPRISE_UI_ROADMAP.md` Track C — **C-02** (NG-02 / MP0-01), **MP0-10**, **MP0-09**,
**C-01** (NG-01 / MP0-03)
**Classification:** **A — BATCH 1 COMPLETE / B3 UNBLOCKED ON C-02 / SHARED-NEON DEPLOY STILL GATED**
**Type:** Backend (API service + controller + DTO) + tests + Postman + docs
**Not in this batch:** no schema change, no migration, no seed change, no permission added or
regranted, no frontend code change, no shared-Neon deploy, no Track B phase started.

---

## 1. Summary

Four backend defects from the Track C register are fixed, each with a unit test carrying explicit
numbers and each reproduced live on an isolated local stack before and after.

| # | ID | Defect | Result |
| --- | --- | --- | --- |
| 1 | **C-02** (NG-02 / MP0-01) | `GET /hr/employees` returned `compensationProfile` + `dateOfBirth`/`address`/`emergencyContact*`/private `notes`/`metadata` on every row; `/:id` added `contracts[].salaryAmount` | Default response is now a **safe projection**; the sensitive columns are **not even selected** from Postgres. The historical payload survives behind `?view=full`, gated by the existing `pos:hr:compensation:read` |
| 2 | **MP0-10** | `/dash/today-summary` published `netSales` (33,014,100) **larger than** `grossSales` (28,107,000) | `grossSales = SUM(order.total)`, `netSales = grossSales − taxTotal`. Live after: gross **33,014,100** ≥ net **27,978,300**, and gross = net + tax exactly. The old ex-tax figure is preserved additively as `subtotalSales` |
| 3 | **MP0-09** | `/dash/open-orders` reported `count: 50` (page length) while the branch had 107 open orders | The list gains a real **`total`** (+ `limit`, `truncated`) from the *same* `where` clause the dashboards count with. Live after: `total: 107` == `/dash/manager.openOrders: 107` |
| 4 | **C-01** (NG-01 / MP0-03) | `POST /reports/export` with `format: PDF` wrote a **plain-text file**, stamped it `application/pdf` and marked the artifact `READY` | PDF now returns **501** with a message naming the real reason and the working alternative. `generateTextPdf` is deleted; the catalog no longer advertises PDF. CSV is untouched and verified |

---

## 2. Fix 1 — C-02: employee compensation + PII projection

### Hypothesis → root cause

`HrService.listEmployees` / `getEmployee` used an unconditional
`include: { position: true, compensationProfile: true }` (`hr.service.ts:252`, `:268`) and returned
the full Prisma row. There was no projection anywhere: the leak is at the **wire**, so no
client-side allow-list could fix it. `MP0-01` recorded this as the hard block on the Track B3 Staff
directory.

### Consumer audit (done before changing anything)

| Consumer | Uses `GET /hr/employees`? | Impact |
| --- | --- | --- |
| `apps/web` (Waiter, Cashier, Supervisor, Manager) | **No** — zero references in the whole frontend | None |
| Other API services | **No** — `HrService` is injected nowhere outside `modules/hr` | None |
| `PayrollService` | **No HTTP dependency** — reads `employee.compensationProfile` directly through Prisma (`payroll.service.ts:217`) under its own `pos:payroll:*` routes | Untouched by design |
| `FrontlineStaffOnboardingService` | Returns only `{ id, employeeCode, … }` — already narrow | None |
| `apps/api/test/hr.e2e-spec.ts` | Yes | One assertion updated (create echo now asserts `compensationProfileId`, not `compensationProfile`), four C-02 tests added |
| `postman/M23-Employees-Contracts-HR-Core` | Yes | Updated + extended (see §6) |
| `docs/*` | Documentation only | Updated (see §7) |

Also found and fixed inside the same module: `GET /hr/contracts` and `POST /hr/contracts` embedded
`employee: true`, leaking date of birth / address / private notes through a *contracts* response.
The embedded employee is now projected; the contract's own `salaryAmount` / `salaryBasis` stay
(that route is gated by `pos:hr:contracts:*`).

### The change

New `apps/api/src/modules/hr/employee-projection.ts`:

* `SAFE_EMPLOYEE_SELECT` — the only columns the default path reads: `id, orgId, branchId, userId,
  employeeCode, firstName, middleName, lastName, phone, email, hireDate, status, employmentType,
  positionId, compensationProfileId, createdAt, updatedAt, position`.
  **Excluded:** `compensationProfile` (whole relation), `dateOfBirth`, `address`,
  `emergencyContactName`, `emergencyContactPhone`, `notes`, `metadata`.
* `SAFE_CONTRACT_SELECT` — contracts without `salaryAmount` / `salaryBasis`.
* `resolveEmployeeView(requested, permissions)` — `undefined`/`safe` → `safe`; `full` → `full` only
  with `pos:hr:compensation:read`, else **403 naming the permission** (never a silent downgrade).
* `projectEmployeeSafe()` — rebuilds the object field by field so the guarantee is assertable in
  unit tests and a future `include` cannot silently widen the payload.

Applied to `GET /hr/employees`, `GET /hr/employees/:id`, the `POST` / `PATCH` write echoes, and the
employee embedded in `GET|POST /hr/contracts`. `view` was added to `ListEmployeesQueryDto` as
`@IsIn(['safe','full'])`, so an unknown value is a 400, never a fall-through.

### ⚠️ Honest limitation — the permission that exists does not exclude Manager

The instruction was to gate on an existing compensation-grade permission and not invent one. The
real string is **`pos:hr:compensation:read`** (`packages/db/prisma/seed.ts:344`), which already gates
`GET /api/hr/compensation-profiles`. But the seeded role matrix grants it to **Owner (line 642),
Manager (898) and Accountant (1045)** — the live manager token holds **214** permissions including
this one (verified below). There is **no existing read permission that is compensation-grade and
that Manager lacks**; the only Manager-excluded compensation permission is
`pos:hr:compensation:create`, a write, and using a write permission as a read gate would repeat the
guard defect recorded as C-14.

So the design is **default-deny plus an explicit opt-in**, not role-based filtering:

* the **default** payload — the one a Staff directory fetches — carries no compensation and no
  personal PII **for anybody, including Owner**. This is what unblocks B3, and it is enforced at the
  SQL `select`, not in a mapper that a later `include` could bypass;
* a caller that deliberately asks for `?view=full` and holds `pos:hr:compensation:read` still gets
  the historical payload. A Manager token can therefore still opt in.

Narrowing the Manager grant is a **seed/role change and was not authorised in this batch**. It is
recorded as a follow-up (§8, FU-1).

### Evidence

Live, isolated stack, `manager@nimbus.demo`, branch `cb27be401a2c35dfc0d4e610`, 40 employees:

```
managerHasCompensationRead : true          (214 permissions on the token)
GET /api/hr/employees?take=100  -> 200, view "safe", 40 rows
  leaked keys on ANY row      : []          (checked: compensationProfile, dateOfBirth, address,
                                             emergencyContactName, emergencyContactPhone, notes, metadata)
  row keys                    : id, orgId, branchId, userId, employeeCode, firstName, middleName,
                                lastName, phone, email, hireDate, status, employmentType, positionId,
                                compensationProfileId, createdAt, updatedAt, position
  payload contains "baseAmount": false
GET /api/hr/employees/:id       -> 200, leaked keys [], contracts present with no salary field
GET /api/hr/employees?view=full -> 200 (owner/manager), compensationProfile present
GET /api/hr/employees?view=full -> 403 as supervisor@nimbus.demo:
   "view=full returns compensation and personal data and requires \"pos:hr:compensation:read\""
GET /api/hr/employees?view=everything -> 400
```

Unit tests (`hr.service.spec.ts`, 8 new): the default projection is asserted against a *worst-case*
row with every sensitive column populated (`baseAmount: 2800000`, `metadata.bankAccount`,
`notes`, `address`, `dateOfBirth`) — the serialised row must not contain `2800000` or
`01234567890`; the `select` must not name any sensitive column; `view=full` must still return
`baseAmount: 2800000` for a permission holder and throw `ForbiddenException` without it.

---

## 3. Fix 2 — MP0-10: `netSales` was larger than `grossSales`

### Hypothesis → root cause

Not an aggregation bug and not mismatched populations (both figures come from **one**
`prisma.order.aggregate` over the same `where`). The **labels were inverted**.

The persisted money model is `Order.total = Order.subtotal + Order.tax − Order.discount` — asserted
by the demo importer itself (`packages/db/prisma/demo-import.ts:443`), and the POS write path
(`OrdersService.recalcOrderTotals`, `orders.service.ts:458`) is the same identity with `tax = 0`.
So `subtotal` is **ex-tax** and `total` is **tax-inclusive**. `aggregateSales` published
`grossSales = SUM(subtotal)` (ex-tax) and `netSales = SUM(total)` (inc-tax) — so whenever tax
exceeded discount, "net" exceeded "gross".

### The change (`dashboards.service.ts`, and the same vocabulary in `reports.service.ts`)

```
grossSales    = SUM(order.total)             — billed to the guest, tax included, discount applied
netSales      = grossSales − SUM(order.tax)  — revenue excluding tax
subtotalSales = SUM(order.subtotal)          — ex-tax, before discount   (NEW, additive:
                                               this is the value formerly published as grossSales)
```

Invariant: **`grossSales = netSales + taxTotal`**, and tax is never negative, so
**`grossSales ≥ netSales`** always holds. `taxTotal` / `discountTotal` are unchanged.

The reporting module carried the identical inversion in the `SHIFT_END` and `DAILY_SALES`
summaries. Fixing only the dashboard would have made the Manager Overview disagree with the Daily
Sales report the same manager exports, so both now use one exported helper, `salesFigures()`. This
is a deliberate extension of the stated scope and is called out here so it can be objected to.

### Evidence — before / after, same branch, same day

| Figure | Before | After |
| --- | --- | --- |
| `grossSales` | 28,107,000 (`SUM(subtotal)`) | **33,014,100** (`SUM(total)`) |
| `netSales` | 33,014,100 (`SUM(total)`) | **27,978,300** (gross − tax) |
| `taxTotal` | 5,035,800 | 5,035,800 (unchanged) |
| `subtotalSales` | *(not published)* | **28,107,000** (the old "gross") |
| `gross ≥ net` | ❌ **false** | ✅ true |
| `gross = net + tax` | ❌ n/a | ✅ 27,978,300 + 5,035,800 = 33,014,100 |

Live: `/api/dash/today-summary` and `/api/dash/manager.today` both return the table's "After"
column. Unit tests use a controlled fixture built on the real identity (28,107,000 + 5,059,260 −
152,160 = 33,014,100) and additionally cover a zero-tax POS day and an empty day (zeros, not nulls).

**Callers whose numbers change:** `/dash/today-summary`, `/dash/owner` (today + mtd),
`/dash/manager`, `/stream/metrics`, `POST /dash/kpi/refresh` (the `KpiSnapshot` rows written from
now on), and the `SHIFT_END` / `DAILY_SALES` report summaries + their CSV exports.
`KpiSnapshot` rows written **before** this change keep the old semantics — recorded in
`docs/KNOWN_LIMITATIONS.md`; no backfill was performed (that would be a data migration).

---

## 4. Fix 3 — MP0-09: open-order count parity

### Hypothesis → root cause

`getOpenOrders` rebuilt the open-order filter inline, applied `take: 50`, and returned
`count: orders.length` — the **page length**, not a count. `countOpenOrders` (used by
`/dash/manager`, `/dash/owner`, `/dash/today-summary`, `/stream/metrics`) counted the same statuses
but was a separate copy of the filter, so the two could also drift.

### The change — additive

* One private `openOrdersWhere(orgId, branchId)` is now the single definition of "open"
  (`NEW, SENT, IN_KITCHEN, READY, SERVED`), used by both the count and the list.
* `/dash/open-orders` returns, **in addition to the existing `count` and `orders`**:
  `total` (real count, not capped), `limit` (50), `truncated` (`total > count`).
* `count` deliberately keeps its old meaning (rows in *this* response) so the B2 Overview keeps
  working untouched. It is documented as the page length; `total` is the number.

### Evidence

| Field | Before | After |
| --- | --- | --- |
| `/dash/open-orders.count` | 50 (page length, read as a count) | 50 (page length, now labelled) |
| `/dash/open-orders.total` | *(did not exist)* | **107** |
| `/dash/open-orders.limit` | *(did not exist)* | 50 |
| `/dash/open-orders.truncated` | *(did not exist)* | true |
| `/dash/manager.openOrders` | 107 | 107 |
| Parity | ❌ 50 vs 107 | ✅ 107 == 107 == `/dash/today-summary.openOrders` |

Unit tests build a 107-open-order fixture (50 rows returned) and assert `total === 107`,
`count === orders.length`, `truncated === true`, parity with both `/dash/manager` and
`/dash/today-summary`, and that the list `where` and the count `where` are **deep-equal**.

---

## 5. Fix 4 — C-01: the fake PDF export is withdrawn

### Root cause

`ReportsService.generateExportContent` routed any non-CSV format to `generateTextPdf`, which
produced an ASCII report, wrote it to a `.pdf` file, stamped `application/pdf` and set the artifact
to `READY` — a fabricated success already inside the backend.

### The change

* `createExport` refuses any format other than CSV with **501 `NotImplementedException`**, thrown
  **before** the artifact row is created, so no `PENDING`/`FAILED` record and no file are left
  behind. Message: *"Export format \"PDF\" is not supported. Nimbus does not have a PDF renderer;
  the previous PDF export produced a plain-text file with a .pdf extension and has been withdrawn.
  Use format \"CSV\"."*
* `generateTextPdf` is **deleted** (31 lines), and `generateExportContent` keeps a guard so a future
  caller cannot reach a non-CSV path.
* `mimeType` / `ext` are now unconditionally `text/csv` / `csv`.
* The report catalog advertised `formats: ['CSV','PDF']` on **all 37 entries** → now `['CSV']`.
  Advertising a format that 501s would just move the lie.
* No PDF renderer was added — that stays owner decision **OD-10**.

### Evidence

```
POST /api/reports/export {format:"PDF"} -> 501  (message as above)
POST /api/reports/export {format:"CSV"} -> 201  status READY, mimeType text/csv, *.csv
POST /api/exports {sourceDomain:"reports", format:"PDF"} -> 501   (BG6 facade delegates here)
GET  /api/reports/catalog -> 37 entries, contains "PDF": false
```

Unit tests assert the 501 **and** that `fs.writeFileSync`, `exportArtifact.create` and `audit.log`
were **not** called; that the CSV path still writes a `.csv` file whose content contains
`Gross Sales,33014100` / `Net Sales,27954840`; and that no catalog entry advertises PDF.

**Existing PDF artifacts** already in a database remain listed and downloadable — they are historical
rows, and deleting them would be a data migration. Recorded in `docs/KNOWN_LIMITATIONS.md`.

---

## 6. Validation — commands and real results

All API work was validated on an **isolated local Docker Postgres** stack (`postgres:16`, container
`nimbus-gapbatch1-qa`, port **55436**, db `nimbus_gapbatch1_qa`; API **:4001**; web **:3100**).
Shared Neon was never targeted: both `.env` files were pointed at the disposable database and
restored **byte-for-byte** afterwards (SHA-256 verified identical:
`0f7cfb12…9b48b` api, `2dad4d3c…4aa9b75` db). The container was removed at the end.

### Unit tests (`apps/api`, `npx jest`)

| Suite | Result |
| --- | --- |
| `src/modules/hr` | **34 passed** (8 new C-02 tests) |
| `src/modules/dashboards` | **20 passed** (7 new MP0-09 / MP0-10 tests) |
| `src/modules/reports` | **45 passed** (6 new C-01 / MP0-10 tests) |
| Full API unit suite | **1057 passed / 4 failed / 1061 total, 57 suites** |

The 4 failures are **pre-existing and unrelated** — `client-onboarding.service.spec.ts` (mock lacks
`prisma.invitation`) and `accounts-receivable.service.spec.ts` (TS type errors in the spec). Proven
by checking out `HEAD` (`be3ac47`) into a temporary git worktree and running the same two suites
there: **identical 2 failed suites / 4 failed tests**. The worktree was removed.

### API e2e (`npx jest --config ./test/jest-e2e.json`, against the isolated stack)

| Spec | Result |
| --- | --- |
| `test/hr.e2e-spec.ts` | **25 passed** (4 new C-02 live tests) |
| `test/dashboards.e2e-spec.ts` + `test/reports.e2e-spec.ts` | **53 passed** |
| `test/bg6-exports-and-downloads.e2e-spec.ts` | **15 passed / 3 failed** — the 3 failures are the pre-existing AP-supplier permission gap (§8, FU-2), not this batch. The export group, including the new "PDF → 501" test, passes |

### Frontend regression (the B2 dashboard must survive untouched)

| Check | Result |
| --- | --- |
| `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | **pass** |
| `apps/web/scripts/manager-b2-assertions.ts` | **pass** — 26 KPI bindings, 8 cards, 9 bounded queries, 0 SSE clients |
| All 14 assertion scripts (shell, floor, profile, manager-p1/b1/b2, cashier-c1/c2/c3, prompt3a/3b1/3b2/3b3a/3b3b) | **14/14 pass** |
| Playwright `e2e/manager-dashboard/` | **84 passed / 0 failed** (4 viewports) |
| Playwright `e2e/manager-shell/` | **125 passed / 11 skipped** (the documented OD-4 skips) |
| Cross-role `e2e/cashier-floor/{role-boundaries,cross-role-c2-regression}` + `e2e/supervisor-prompt3/regression` | **36 passed** |

**No frontend file was modified in this batch.**

### Postman / newman (`npx newman run … -e <isolated env at :4001>`)

| Collection | Requests | Assertions | Failed |
| --- | --- | --- | --- |
| `M19-Operational-Dashboards-KPI-Streams` | 16 | 55 | **0** |
| `M20-Reporting-v1-Exports` | 17 | 40 | **0** |
| `M23-Employees-Contracts-HR-Core` | 15 | 39 | **0** |
| `BG6-Exports-And-Downloads` | 27 | 46 | 7 — all in the pre-existing AP-supplier group (§8, FU-2); the new PDF-501 assertion passes |

All **56** collection JSON files still parse (`json.load`, BOM-aware).

Collection changes: **M19** asserts `gross ≥ net`, `gross = net + tax`, `subtotalSales`, and
open-order `total`/`limit`/`truncated` **plus parity with `/dash/manager.openOrders`** (captured
into an environment variable per R16, with an R11 skip message if request 03 was not run).
**M20** asserts the CSV mime type/extension and adds request `10b — [501] PDF export is withdrawn`.
**M23** asserts the safe projection on list + detail + create echo and adds `view=full` (200) and
`view=everything` (400) requests. **BG6** switches its idempotency-replay pair from PDF to CSV,
adds a `[501] PDF withdrawn` request, and corrects its description.

One **pre-existing collection defect** was fixed in passing because it made a permission test lie:
M20 request `13 — [403] Chef tries shift-end report` was returning **201**, because the
collection-level bearer auth (`{{accessToken}}`, the owner) overrode the request's explicit
`{{chefAccessToken}}` header. The request now carries `"auth": { "type": "noauth" }`. Verified
directly: a chef token holds 19 permissions, not `pos:reports:shift-end:generate`, and gets a real
403.

### Health

`GET http://localhost:4001/api/health` → `{"status":"ok","db":"ok"}` before teardown.
`git diff --check` clean.

---

## 7. Documentation updated

* `ai/ENTERPRISE_UI_ROADMAP.md` — Track C: **C-01** and **C-02** marked complete (with the C-02
  caveat); new **C-21** recorded.
* `docs/manager-ui-docs/MANAGER_API_MATRIX.md` — the `/hr/employees`, `/dash/today-summary`,
  `/dash/open-orders` and `/reports/export` rows re-verified and rewritten.
* `docs/KNOWN_LIMITATIONS.md` — PDF export withdrawn; historical `KpiSnapshot` semantics; the
  Manager `view=full` caveat; the unseeded accounting permissions.
* `docs/HR_CORE_GUIDE.md`, `docs/API_CONVENTIONS.md` — employee endpoint contract.
* `PROGRESS.md`, `ai/AI_STATUS.md`, `CLAUDE.md`, `CODEX.md` — status paragraph (paired, per §20).

---

## 8. Follow-ups created (NOT implemented)

| ID | Item | Why it was not done here |
| --- | --- | --- |
| **FU-1** | Manager holds `pos:hr:compensation:read`, so a Manager token can still request `?view=full`. Either remove the grant from the Manager role or introduce a distinct compensation-read permission. | Both are **seed/permission changes**, explicitly out of scope for this batch. The default wire payload is already safe for every role. |
| **FU-2 → proposed Track C entry C-21** | **38 accounting routes are unreachable by every role, including Owner.** `accounts-payable` (19 routes), `accounts-receivable` (10) and `budget` (9) are guarded by 23 permission strings (`accounting:ap:*`, `accounting:ar:*`, `finance:*`) that have **zero rows** in the `permissions` table (237 rows seeded; `accounting:%` → 0, `finance:%` → 0). Live: owner `POST /api/accounting/ap/suppliers` → **403 Insufficient permissions**. `pos:accounting:*` (17 rows) *is* seeded, so `accounting`, `ledger` and `bank-rec` are fine. | Fixing it means seeding permissions + role mappings. **This materially qualifies the roadmap's "~90 accounting endpoints exist with zero UI" headline**: a third of them cannot be called at all today, so Track **B5** must budget a permission/seed cutover before any accounting UI. |
| **FU-3 (B3 doc follow-up)** | Two frontend notes are now stale, though nothing rendered is wrong and all e2e pass: `apps/web/src/lib/manager/dashboard-model.ts` says *"netSales is SUM(order.total) and is tax-INCLUSIVE"* / *"grossSales is SUM(order.subtotal) and is EX-tax"* (MP0-10 binding notes) and *"`/dash/open-orders` returns count = page length capped at 50"*. The Overview can also now use the honest `total` instead of treating the list as a 50-row preview. | **No frontend edit was permitted in this batch.** Fold into B3. |
| **FU-4** | `M23` and `BG6` collections are not re-runnable against the same database (fixture creates 409 on a second run) — an R3 "standalone" violation. | Pre-existing; out of scope. First-run results are the ones reported above. |

## 9. Deploy gate

These fixes are on the **local dev database only**. The shared Neon deploy is **still pending the
cutover gate** (read-only preflight + retained pre-migration recovery branch + explicit
authorisation). No migration is involved — this batch is code-only — but the behaviour change to
`/dash/*` and `/reports/export` is user-visible and must be announced with the deploy.

## 10. Gate

**Track B3 is unblocked on C-02** (the Staff directory can now fetch a payload with no compensation
and no personal PII). B3 itself is **not started** and still needs explicit owner authorisation, as
does every other Track B phase.
