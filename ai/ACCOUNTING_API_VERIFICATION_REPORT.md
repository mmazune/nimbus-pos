# Accounting / Finance API Verification Report — Track B0

**Date:** 2026-08-20
**Phase:** Track B **B0** (API verification extension, M-P0 pass #2), executed as part of the
**permissions cutover** milestone (Track C: C-21 · FU-1 · B3-F1).
**Status:** **COMPLETE**
**Verdict for B5:** 🟡 **CONDITIONAL GO** — see §9.

> **Why this report exists.** `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` reported that ~90
> accounting/finance endpoints exist with no UI. That finding came from a **static scan only** —
> no runtime probe, no permission check, no payload inspection. `ai/ENTERPRISE_UI_ROADMAP.md`
> §B0 exists so that B5 is not designed against unverified routes. This report is that pass,
> executed live.

---

## 1. What was verified, and how

| | |
| --- | --- |
| **Stack** | Isolated local Docker `postgres:16` (`nimbus-permcut-pg`, port **55432**, DB `nimbus_permcut`), API on **:4011**, web on **:3111**. **Shared Neon was never touched.** |
| **Isolation proof** | The QA API process held exactly **one** TCP connection — `127.0.0.1:55432`. The only external `:5432` connection on the machine belonged to the *pre-existing* shared-Neon dev API on `:3001`, a separate PID. Neither `apps/api/.env` nor `packages/db/.env` was modified at any point (SHA-256 verified — see the completion report §7). |
| **Data** | `prisma migrate deploy` → `db:seed` → `db:demo:import` on a from-scratch database. |
| **Roles probed** | **Owner**, **Accountant**, **Manager** (`*@nimbus.demo`), plus a **Supervisor** 403 spot-check. |
| **Reads** | Live, every GET route, all four roles. |
| **Writes** | Live on `B0-QA` / `ZZQA`-tagged rows for everything reversible or disposable. |
| **Route inventory** | Extracted statically, then **cross-checked against the API's own `RouterExplorer` boot log**: 112 routes claimed, **0** claimed-but-unmapped, **0** mapped-but-missed. |

⚠️ **A parser defect was found and fixed during this pass.** The first extractor took one
`@Controller` prefix per file. `budget.controller.ts` declares **three** controller classes
(`finance`, `finance`, `franchise`), so the forecast route was recorded as
`/api/finance/forecast` when it is really **`/api/franchise/forecast`**. Every route in this
report is now reconciled against the Nest route map, which is why that cross-check is quoted
above rather than assumed.

### Route inventory

| Module | Routes | GET | Write |
| --- | ---: | ---: | ---: |
| `accounts-payable` | 19 | 9 | 10 |
| `accounts-receivable` | 10 | 6 | 4 |
| `bank-rec` | 15 | 6 | 9 |
| `budget` | 12 | 6 | 6 |
| `accounting` | 11 | 5 | 6 |
| `ledger` | 8 | 5 | 3 |
| **Accounting block total** | **75** | **37** | **38** |
| `settings` | 14 | 7 | 7 |
| `alerts` | 15 | 6 | 9 |
| `reliability` (sync) | 7 | 3 | 4 |
| `audit-timeline` | 1 | 1 | 0 |
| **B6-relevant total** | **37** | **17** | **20** |

---

## 2. The headline: 56 of these routes were unreachable by everyone

The gap analysis said the endpoints "exist with zero UI". That understated the problem. Before
the C-21 cutover, **56 of the 75 accounting-block routes returned 403 to every role including
Owner**, because their `@Permissions(...)` strings had no row in the `permissions` table and the
`PermissionGuard` matches on exact string membership.

Measured live on the isolated stack, **before** the cutover:

| Module | GET routes | 403 for Owner | 403 for Manager |
| --- | ---: | ---: | ---: |
| `accounts-payable` | 9 | **9** | **9** |
| `accounts-receivable` | 6 | **6** | **6** |
| `bank-rec` | 6 | **6** | **6** |
| `budget` | 6 | **5** | **5** |
| `accounting` | 5 | 0 | 0 |
| `ledger` | 5 | 0 | 0 |

**After** the cutover: Owner and Accountant 26 × 200 / 11 × 404 (the 404s are `:id` routes probed
with a deliberately non-existent id — a 403 would have fired *before* the lookup, so a 404 proves
the permission passed); Manager 25 × 200 / **1 × 403**, the single deliberate exclusion (§4).

The AP + AR e2e suites make the same point from the other direction:

| | Tests failed | Tests passed |
| --- | ---: | ---: |
| Pre-cutover permission state | **69** | 20 |
| Post-cutover | **1** | 88 |

That single remaining failure is a genuine source defect this pass uncovered — **PC-04**, §7.

⚠️ **The prior count of 23 was wrong.** `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md` FU-2
recorded 23 missing strings across AP/AR/`finance:` and stated *"`pos:accounting:*` (17 rows) is
seeded, so `accounting`, `ledger` and `bank-rec` are fine."* That was a **prefix** check, not a
string check. `bank-rec` references 11 `pos:accounting:*` strings that share the prefix with the
18 seeded ones but are themselves absent, and `budget` references two strings outside the
`finance:` prefix. The real gap was **36 strings over 56 routes**. `bank-rec` was **not** fine:
all 6 of its GET routes were 403 for Owner, measured live.

---

## 3. Verified route matrix — accounting block

`O` = Owner · `A` = Accountant · `M` = Manager · `S` = Supervisor. Status codes are live and
post-cutover. `404*` = probed with a deliberately non-existent id; the permission passed.

### 3.1 Accounts Payable — `/api/accounting/ap/*` (19 routes)

| Method | Path | Permission | O | A | M | S | Live write |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/suppliers` | `accounting:ap:bill:read` | 200 | 200 | 200 | 403 | — |
| GET | `/suppliers/:id` | `accounting:ap:bill:read` | 404* | 404* | 404* | 403 | — |
| POST | `/suppliers` | `accounting:ap:bill:write` | — | **201** | **403** | 403 | AP-W1 ✅ |
| GET | `/bills` | `accounting:ap:bill:read` | 200 | 200 | 200 | 403 | — |
| GET | `/bills/:id` | `accounting:ap:bill:read` | 404* | 404* | 404* | 403 | — |
| POST | `/bills` | `accounting:ap:bill:write` | — | **201** | **403** | 403 | AP-W2 ✅ |
| POST | `/bills/:id/approve` | `accounting:ap:bill:approve` | — | **200** | **403** | 403 | AP-W3 ✅ |
| GET | `/payments` | `accounting:ap:bill:read` | 200 | 200 | 200 | 403 | — |
| POST | `/payments` | `accounting:ap:payment:write` | — | **201** | **403** | 403 | AP-W4 ✅ |
| GET | `/credit-notes` | `accounting:ap:credit-note:read` | 200 | 200 | 200 | 403 | — |
| POST | `/credit-notes` | `accounting:ap:credit-note:write` | — | **201** | 403 | 403 | AP-W5 ✅ |
| GET | `/aging` | `accounting:ap:bill:read` | 200 | 200 | 200 | 403 | — |
| GET | `/recurring-profiles` | `accounting:ap:recurring:read` | 200 | 200 | 200 | 403 | — |
| POST | `/recurring-profiles` | `accounting:ap:recurring:write` | — | **201** | 403 | 403 | AP-W6 ✅ |
| PATCH | `/recurring-profiles/:id` | `accounting:ap:recurring:write` | — | **200** | 403 | 403 | AP-W7 ✅ |
| POST | `/recurring-profiles/:id/generate-bill` | `accounting:ap:recurring:write` | — | **200** | 403 | 403 | AP-W8 ✅ ⚠️ **PC-04** |
| GET | `/reminders` | `accounting:ap:reminder:read` | 200 | 200 | 200 | 403 | — |
| POST | `/reminders/generate` | `accounting:ap:reminder:write` | — | **200** | 403 | 403 | AP-W9 ✅ |
| POST | `/reminders/:id/dismiss` | `accounting:ap:reminder:write` | — | **200** | 403 | 403 | AP-W10 ✅ |

### 3.2 Accounts Receivable — `/api/accounting/ar/*` (10 routes)

| Method | Path | Permission | O | A | M | S | Live write |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/accounts` | `accounting:ar:account:read` | 200 | 200 | 200 | 403 | — |
| GET | `/accounts/:id` | `accounting:ar:account:read` | 404* | 404* | 404* | 403 | — |
| POST | `/accounts` | `accounting:ar:account:write` | — | **201** | 403 | 403 | AR-W1 ✅ |
| GET | `/invoices` | `accounting:ar:invoice:read` | 200 | 200 | 200 | 403 | — |
| GET | `/invoices/:id` | `accounting:ar:invoice:read` | 404* | 404* | 404* | 403 | — |
| POST | `/invoices` | `accounting:ar:invoice:write` | — | **201** | **403** | 403 | AR-W2 ✅ |
| POST | `/receipts` | `accounting:ar:receipt:write` | — | **201** | **403** | 403 | AR-W3 ✅ |
| GET | `/aging` | `accounting:ar:aging:read` | 200 | 200 | 200 | 403 | — |
| GET | `/credit-notes` | `accounting:ar:credit-note:read` | 200 | 200 | 200 | 403 | — |
| POST | `/credit-notes` | `accounting:ar:credit-note:write` | — | **201** | 403 | 403 | AR-W4 ✅ |

### 3.3 Bank reconciliation + period close (15 routes)

| Method | Path | Permission | O | A | M | S | Live write |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/accounting/bank-accounts` | `pos:accounting:bank-accounts:read` | 200 | 200 | 200 | 403 | — |
| POST | `/accounting/bank-accounts` | `pos:accounting:bank-accounts:create` | — | **201** | **403** | 403 | BR-W1 ✅ |
| GET | `/accounting/bank-statements` | `pos:accounting:bank-statements:read` | 200 | 200 | 200 | 403 | — |
| GET | `/accounting/bank-statements/:id` | `pos:accounting:bank-statements:read` | 404* | 404* | 404* | 403 | — |
| POST | `/accounting/bank-statements/import` | `pos:accounting:bank-statements:import` | — | **201** | **403** | 403 | BR-W2 ✅ |
| POST | `/accounting/manual-bank-entries` | `pos:accounting:bank-entry:create` | — | **201** | **403** | 403 | BR-W3 ✅ |
| GET | `/accounting/reconciliation` | `pos:accounting:reconciliation:read` | 200 | 200 | 200 | 403 | — |
| GET | `/accounting/reconciliation/:id` | `pos:accounting:reconciliation:read` | 404* | 404* | 404* | 403 | — |
| POST | `/accounting/reconciliation` | `pos:accounting:reconciliation:create` | — | **201** | 403 | 403 | BR-W4 ✅ |
| PATCH | `/accounting/reconciliation/:id/match` | `pos:accounting:reconciliation:match` | — | **200** | **403** | 403 | BR-W5 ✅ |
| PATCH | `/accounting/reconciliation/:id/skip` | `pos:accounting:reconciliation:match` | — | **200** | 403 | 403 | BR-W6 ✅ |
| POST | `/accounting/reconciliation/:id/complete` | `pos:accounting:reconciliation:create` | — | **200** | 403 | 403 | BR-W7 ✅ |
| GET | `/accounting/period-close-runs` | `pos:accounting:period-close-runs:read` | 200 | 200 | 200 | 403 | — |
| PATCH | `/accounting/periods/:id/close` | `pos:accounting:periods:close` | — | **200** | **403** | 403 | ✅ |
| PATCH | `/accounting/periods/:id/lock` | `pos:accounting:periods:lock` | — | **200** | **403** | 403 | ✅ |

**Reconciliation completion semantics (verified, B5.2 depends on this).**
`statementBalance = bankStatement.closingBalance`; `matchedTotal = Σ(CREDIT) − Σ(DEBIT)` over
**MATCHED lines only** (skipped lines contribute nothing); completion requires
`difference = statementBalance − matchedTotal` to be **exactly zero**, else **400** with the
difference in the message. A first attempt with an unbalanced fixture returned
`400 "Cannot complete reconciliation — difference is 200000.00 (must be zero)"`; a balanced
fixture then completed with `status: COMPLETED`. **The 400 is the endpoint working, not a defect.**

**Fiscal period lifecycle (verified end to end).** `DRAFT → OPEN → CLOSED → LOCKED`.
A period is created **DRAFT**, not OPEN — `close` on a DRAFT period returns **409**
`"Cannot close period — current status is DRAFT (must be OPEN)"`, and `lock` before `close`
returns **409** `"must be CLOSED"`. `PATCH /periods/:id/open` (`pos:accounting:periods:open`)
is the missing step. **B5.4 must model four states, not three.** There is **no unlock route** —
`LOCKED` is terminal.

### 3.4 Accounting foundation + General Ledger (19 routes)

These were already reachable (their permissions were seeded for M28/M29). Verified unchanged.

| Method | Path | Permission | O | A | M | S |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/accounting/accounts` | `pos:accounting:accounts:read` | 200 | 200 | 200 | 403 |
| POST | `/accounting/accounts` | `pos:accounting:accounts:create` | ✔ | ✔ | ✔ | 403 |
| GET | `/accounting/cost-centers` | `pos:accounting:cost-centers:read` | 200 | 200 | 200 | 403 |
| POST | `/accounting/cost-centers` | `pos:accounting:cost-centers:create` | ✔ | ✔ | ✔ | 403 |
| GET | `/accounting/periods` | `pos:accounting:periods:read` | 200 | 200 | 200 | 403 |
| POST | `/accounting/periods` | `pos:accounting:periods:create` | ✔ | **201** | ✔ | 403 |
| PATCH | `/accounting/periods/:id/open` | `pos:accounting:periods:open` | ✔ | **200** | **403** | 403 |
| GET | `/accounting/posting-source-maps` | `pos:accounting:posting-source-maps:read` | 200 | 200 | 200 | 403 |
| PATCH | `/accounting/posting-source-maps/:id` | `…:update` | ✔ | ✔ | **403** | 403 |
| GET | `/accounting/tax-config` | `pos:accounting:tax-config:read` | 200 | 200 | 200 | 403 |
| PATCH | `/accounting/tax-config` | `pos:accounting:tax-config:update` | ✔ | ✔ | **403** | 403 |
| GET | `/accounting/journals` | `pos:accounting:journals:read` | 200 | 200 | **200** | 403 |
| GET | `/accounting/journals/:id` | `pos:accounting:journals:read` | 404* | 404* | 404* | 403 |
| POST | `/accounting/journals` | `pos:accounting:journals:create` | ✔ | ✔ | **403** | 403 |
| POST | `/accounting/journals/:id/reverse` | `pos:accounting:journals:reverse` | ✔ | ✔ | **403** | 403 |
| POST | `/accounting/posting/replay` | `pos:accounting:posting:replay` | ✔ | ✔ | **403** | 403 |
| GET | `/accounting/posting-runs` | `pos:accounting:posting-runs:read` | 200 | 200 | 200 | 403 |
| GET | `/accounting/posting-errors` | `pos:accounting:posting-errors:read` | 200 | 200 | 200 | 403 |
| GET | `/accounting/posting-errors/:id` | `pos:accounting:posting-errors:read` | 404* | 404* | 404* | 403 |

> **OD-9's open question is now answered with live evidence.** The roadmap noted that
> `docs/ACCOUNTING_FOUNDATION_GUIDE.md` and `docs/GL_POSTING_ENGINE_GUIDE.md` *claim* Manager holds
> `journals:read` / `posting-runs:read` / `posting-errors:read` but **not** `journals:create` /
> `journals:reverse` / `posting:replay`, and that "those role tables were never re-verified".
> **They are now, and the guides are correct**: Manager `journals:read` → **200**;
> `journals:create` → **403**; `posting/replay` → **403**. Manager also does **not** hold
> `periods:open`, `posting-source-maps:update` or `tax-config:update`, though it *does* hold
> `accounts:create`, `cost-centers:create` and `periods:create` (pre-existing M28 grants, untouched
> by this cutover). **B5.3 must ship journals read-only for Manager.**

### 3.5 Budgets / forecast / demand calendar / procurement (12 routes)

| Method | Path | Permission | O | A | M | S | Live write |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/finance/budgets` | `finance:budget:read` | 200 | 200 | 200 | 403 | — |
| GET | `/finance/budgets/:id` | `finance:budget:read` | 404* | 404* | 404* | 403 | — |
| POST | `/finance/budgets` | `finance:budget:write` | — | **201** | **403** | 403 | BU-W1 ✅ |
| POST | `/finance/budgets/:id/update-actuals` | `finance:budget:update-actuals` | — | **200** | **403** | 403 | BU-W2 ✅ |
| GET | `/finance/demand-calendar` | `finance:demand-calendar:read` | 200 | 200 | 200 | 403 | — |
| GET | `/finance/demand-calendar/:id` | `finance:demand-calendar:read` | 404* | 404* | 404* | 403 | — |
| POST | `/finance/demand-calendar` | `finance:demand-calendar:write` | — | **201** | **403** | 403 | DC-W1 ✅ |
| PATCH | `/finance/demand-calendar/:id` | `finance:demand-calendar:write` | — | **200** | 403 | 403 | DC-W2 ✅ |
| DELETE | `/finance/demand-calendar/:id` | `finance:demand-calendar:write` | — | — | 403 | 403 | not exercised |
| GET | `/finance/procurement-suggestions` | `procurement:advisory:read` | 200 | 200 | **403** | 403 | — |
| PATCH | `/finance/procurement-suggestions/:id/review` | `procurement:advisory:read` | — | — | **403** | 403 | **not exercised** — no rows (§8) |
| GET | **`/franchise/forecast`** | `franchise:forecast:read` | 200 | 200 | 200 | 403 | — |

⚠️ **`GET /franchise/forecast`, not `/finance/forecast`.** The route lives on a third
`@Controller('franchise')` class inside `budget.controller.ts`. Any B5.5 client that assumes the
`/finance` prefix will 404.

---

## 4. Manager's grant is read-only, and one "read" is deliberately withheld

The cutover applied the owner's stated default for **OD-9**: Owner and Accountant hold all 36
strings; **Manager holds 15 read strings and no writes**. Verified live: **16 Manager write
attempts across AP, AR, bank-rec, period close/lock and budgets all returned 403**, and 5
Supervisor attempts likewise.

**`procurement:advisory:read` is excluded from Manager on purpose** — finding **PC-02**. Despite
its name, that one string gates **both** `GET /finance/procurement-suggestions` **and the mutation**
`PATCH /finance/procurement-suggestions/:id/review`. Granting Manager the read would have silently
granted it the review write and broken the only promise the read-only list makes. It is the single
403 in Manager's read column. Splitting it into `procurement:advisory:read` +
`procurement:advisory:review` is a backend change and is **not** done here.

---

## 5. Response shapes and pagination — B5's list views cannot assume an envelope

Measured live per route (`take=5000&pageSize=5000&limit=5000` probes the bound):

| Route | Envelope | Server `total` | `take=5000` |
| --- | --- | --- | --- |
| `ap/suppliers`, `ap/bills`, `ap/payments`, `ap/credit-notes`, `ap/recurring-profiles`, `ap/reminders` | `{data,total,skip,take}` | ✅ | mixed: bills / recurring / reminders **400** (bounded), others accept |
| `ar/accounts`, `ar/invoices`, `ar/credit-notes` | `{data,total,skip,take}` | ✅ | accounts **400** (bounded) |
| `ar/aging` | `{asOf,total,skip,take,summary,accounts}` | ✅ | **400** (bounded) |
| `ap/aging` | `{asOf,buckets,bySupplier,bills…}` | ❌ | accepts |
| `accounting/accounts` | `{data,total}` | ✅ (no skip/take) | **400** (bounded) |
| `journals`, `posting-runs`, `posting-errors` | `{data,total,skip,take}` | ✅ | journals **400** (bounded) |
| **`bank-accounts`, `bank-statements`, `reconciliation`, `period-close-runs`, `cost-centers`, `periods`, `posting-source-maps`, `finance/budgets`, `finance/demand-calendar`, `finance/procurement-suggestions`** | **bare array** | ❌ **none** | **no bound at all** |
| `tax-config`, `franchise/forecast` | single object | n/a | n/a |

🔴 **Ten list routes return a bare JSON array with no `total` and no server-side pagination.**
This is a direct problem for B5: the `ManagerListTable` (Odoo **C4**) contract established in B3
and reinforced in B4 binds the pager to *the endpoint's own `total`*, and B4-D1/B4 explicitly
forbids deriving a count from a page length. For those ten routes **there is no total to bind
to**. B5 must either ship them as explicitly unpaginated ("showing all N loaded") or gain a
backend envelope first. **Do not synthesise a total from `array.length` and present it as a
server count.**

⚠️ **`ar/aging` renamed its totals block.** It returns `summary{current, bucket_1_30, bucket_31_60,
bucket_61_90, bucket_90_plus, totalOutstanding}` — **not** `totals{grandTotal, grand_current,
grand_1_30}`. Both the e2e spec and the Postman collection still asserted the old names and could
never have run (403). No data was lost; it is a rename. Both were corrected (finding **PC-05**);
the **unit** spec `accounts-receivable.service.spec.ts` still carries the stale name and fails to
compile — pre-existing, see §7.

---

## 6. 🔴 Branch scoping is inconsistent, and four routes leak across branches

Live probe, same Accountant token, only `X-Branch-Id` changed (Tapas Downtown → Rooftop Bar), then
the returned rows' own `branchId` inspected:

| Route | Rows under `X-Branch-Id=ROOFTOP` | Whose data? |
| --- | --- | --- |
| `GET /api/accounting/bank-statements` | 2 | 🔴 **all TAPAS** |
| `GET /api/accounting/ap/credit-notes` | 1 | 🔴 **TAPAS** |
| `GET /api/accounting/ar/credit-notes` | 1 | 🔴 **TAPAS** |
| `GET /api/accounting/ap/suppliers` | 41 | 🔴 **spans all four branches, regardless of header** |

A static scan of the service `where` clauses confirms the cause — **9 of 34 list/get methods filter
on `orgId` only**:

`listSuppliers`, `listCreditNotes` (AP), `listArCreditNotes`, `listBankStatements`,
`listPeriodCloseRuns`, `listFiscalPeriods`, `listPostingSourceMaps`, `getTaxLedgerConfig`,
`getPostingError`.

Some of these are legitimately org-level (**chart of accounts, tax config, fiscal periods, posting
source maps** are org-wide by design, and `period-close-runs` rows carry `branchId: null`). Four
are not, and two are internally inconsistent:

- 🔴 **`listBankStatements` is org-scoped while `getBankStatement` is branch-scoped** — the list
  shows another branch's statements, but opening one 404s. B5.2's master-detail would break.
- 🔴 **`getPostingError` is org-scoped while `listPostingErrors` is branch-scoped** — the exact
  MP0-12 shape (a detail read that resolves by `orgId` alone). Not reproducible on this dataset
  (0 posting errors) so it is recorded as **static-verified, not live-verified**.
- 🔴 **`listSuppliers` ignores the branch header entirely.**

**B5 must not present any of these as branch-scoped.** Either the client narrows and says so (the
C-09 precedent from B3's Staff directory), or the backend gains a branch filter. This is finding
**PC-03** and is the principal condition on the B5 go.

---

## 7. Findings (PC-01 … PC-07)

Numbered `PC-*` (permissions cutover) rather than `BV-*` because this pass shipped a backend +
seed change; the roadmap reserved `BV-*` for a docs-only B0.

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| **PC-01** | Medium | **Manager holds no accounting write at all.** OD-9 named AP bill approve, reconciliation match/skip/complete, period close/lock and budget update-actuals as "operationally necessary", but conditioned them on "B0 proving the permission is held" — a condition that cannot be met, because B0 can only observe what the seed grants. The owner's stated default (Manager read-only) was applied. **B5 must request these five writes explicitly if it needs them.** | **Recorded, not implemented** |
| **PC-02** | Medium | **`procurement:advisory:read` gates a read AND a write** (`PATCH /procurement-suggestions/:id/review`). One string cannot express "Manager may look but not review", so Manager was granted neither. Needs splitting into `…:read` + `…:review`. | **Recorded, not implemented** |
| **PC-03** | 🔴 High | **Cross-branch leakage on 4 accounting reads** (`ap/suppliers`, `ap/credit-notes`, `ar/credit-notes`, `bank-statements`), plus list/detail scope inconsistency on `bank-statements` and `posting-errors`. Proven live for the four; static for `getPostingError`. | **Recorded, not implemented** — §9 condition |
| **PC-04** | 🔴 High | **AP recurring-bill duplicate prevention is dead code.** `generateBillFromProfile` guards duplicates with `lastBill.dueDate === profile.nextDueDate`, but the same transaction **advances** `nextDueDate` to the next cycle, so the two can never be equal and the `ConflictException` is unreachable. A second call issues a **second bill for the same profile**. Invisible until this cutover made AP reachable. | **Recorded, not implemented.** The e2e test is **deliberately left red** with an explanatory comment — it documents the correct contract |
| **PC-05** | Low | **`ar/aging` totals were renamed** `totals.grand*` → `summary.*`. The e2e spec and the M35 Postman collection asserted the old names and could never have run. Both corrected. The **unit** spec still uses `result.totals` and fails to **compile** (pre-existing — see §8). | **e2e + Postman fixed; unit spec left** |
| **PC-06** | Low | **Ten list routes return a bare array** with no `total` and no pagination bound (§5). B5's C4 list contract binds the pager to a server `total`. | **Recorded, not implemented** |
| **PC-07** | Low | **Fiscal periods are created `DRAFT`, not `OPEN`**, and there is **no unlock route**. B5.4 must model `DRAFT → OPEN → CLOSED → LOCKED` and present `LOCKED` as terminal. | **Documented here** |

---

## 8. Not exercised, and why

Honest gaps — these are **not** claimed as verified:

| Route | Reason |
| --- | --- |
| `PATCH /api/finance/procurement-suggestions/:id/review` | **No procurement suggestion rows exist** on a seeded + demo-imported database. Suggestions are *generated* from consumption data, never seeded. The M37 Postman collection now fails with an explicit R11 skip reason (`"procurementSuggestionId is empty — run a consumption/advisory generation first"`) rather than a bare status mismatch, so an empty dataset can never read as a verified route. **B5.5 needs a generator or a fixture before this surface can be designed.** |
| `DELETE /api/finance/demand-calendar/:id` | Not exercised — the created entry was retained as evidence for the PATCH assertion. Permission path is the same `finance:demand-calendar:write` proven by DC-W1/DC-W2. |
| `getPostingError` cross-branch leak | 0 posting-error rows on this dataset. **Static-verified only** (`where: { id, orgId }`). |
| `accounts-receivable.service.spec.ts` (unit) | **Fails to compile** — `type: 'CORPORATE'` vs `CustomerAccountTypeEnum`, and `result.totals` vs `total`. Pre-existing: reproduced identically at commit `30c67aa` in a throwaway worktree, before any change in this milestone. Not fixed — a unit-spec repair is outside this milestone's authorised scope. |

---

## 9. Verdict for B5 — 🟡 CONDITIONAL GO

**GO**, because the block is now genuinely reachable and genuinely works:

- All **75** accounting-block routes are registered and reconciled against the Nest route map.
- **56** previously-unreachable routes now respond; **26 of 26 attempted Accountant writes
  succeeded live**, including the full AP bill → approve → payment chain, the AR invoice →
  receipt → credit-note chain, a bank statement import → match → skip → **completed**
  reconciliation, budget create + update-actuals, and a fiscal period taken
  `DRAFT → OPEN → CLOSED → LOCKED`.
- Role boundaries hold: 16 Manager write attempts and 5 Supervisor attempts all 403.
- AP + AR e2e went from **69 failed / 20 passed** to **1 failed / 88 passed**; the M32/M34/M35
  Postman collections run **0 request failures, 0 assertion failures** on a clean database.

**CONDITIONAL**, on four things B5 must handle rather than discover:

1. 🔴 **PC-03 — branch scoping.** Four reads return another branch's rows and two list/detail
   pairs disagree about scope. **B5.1 and B5.2 must not present these as branch-scoped.** Either
   fix the `where` clauses (backend) or narrow in the client and say so on screen, per the C-09
   precedent. **This is the blocking condition — an accounting UI that silently mixes branches
   is worse than no accounting UI.**
2. 🔴 **PC-04 — duplicate vendor bills.** B5.1 must not ship a "Generate bill" control until the
   dead duplicate guard is fixed; the current endpoint will happily bill a supplier twice.
3. 🟡 **PC-06 — ten unpaginated bare-array routes.** Decide per surface: honest "all N loaded",
   or a backend envelope first. Do not fabricate a server total.
4. 🟡 **PC-01 / PC-02 — writes.** Manager currently has none. If B5 wants the five OD-9 writes, it
   must request them explicitly; `procurement:advisory` additionally needs splitting before
   Manager can even *read* procurement suggestions.

**Sub-phase readiness**

| Sub-phase | Routes | Ready? |
| --- | --- | --- |
| **B5.1 Customers + Vendors** | AR 10 + AP 19 | 🟡 Reads verified. **Blocked on PC-03** (suppliers + both credit-note lists leak) and **PC-04** (no generate-bill control). |
| **B5.2 Bank reconciliation** | bank-rec 12 (excl. period close/lock) | 🟡 Richest verified flow — import → match → skip → complete all live. **Blocked on PC-03** (`bank-statements` list is org-scoped while its detail is branch-scoped) and **PC-06** (all four lists are bare arrays). |
| **B5.3 Accounting core + Review** | `accounting` 11 + `ledger` 8 | 🟢 **Ready, read-only for Manager** — the guides are confirmed correct. Chatter rail still gated on B0's chatter question, which this pass did not cover. |
| **B5.4 Closing** | periods open/close/lock + period-close-runs | 🟢 **Ready** with **PC-07** applied: four states, `LOCKED` terminal, no unlock. Manager cannot close or lock. |
| **B5.5 Reporting + Configuration** | `ar/aging`, `ap/aging`, budgets, demand calendar, procurement, forecast, COA, cost centres, source maps, tax config | 🟡 Aging + budgets + demand calendar ready (mind the `summary` naming, **PC-05**). **Procurement is unverified (§8)** and **forecast is at `/api/franchise/forecast`**. |
| **B5.6 Accounting dashboard** | derived | 🟡 Depends on B5.1–B5.5. **No bucketed time series exists** on any of these endpoints, so the B2 rule stands: **cards ship chartless rather than synthesise a series.** |

---

## 10. B6 / B7-relevant sections (C, D, E, F)

| Route group | Permission | O | A | M | S | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/settings`, `/settings/currency`, `/settings/tax-matrix`, `/settings/rounding`, `/thresholds`, `/settings/platform-access`, `/settings/exchange-rates` (7) | `tenancy:org:read` | 200 | 200 | 200 | **200** | ⚠️ All 7 settings reads are **org-scoped and readable by Supervisor too**. B6 must label them as organisation settings, not branch settings. |
| `GET /api/alerts`, `/alerts/rules` | `alerts:read` | 200 | 200 | 200 | 403 | |
| `GET /api/alerts/channels` | `alerts:channel:read` | 200 | 200 | 200 | 403 | |
| `GET /api/alerts/deliveries` | `alerts:delivery:read` | 200 | 200 | 200 | 403 | |
| `GET /api/alerts/digests` | `alerts:digest:read` | 200 | 200 | 200 | 403 | |
| `GET /api/owner/live` | `owner:live:read` | **200** | 403 | **403** | 403 | **Owner-only** — B7, not B6. |
| `GET /api/sync/jobs`, `/sync/jobs/:id`, `/sync/conflicts` | `sync:jobs:read` / `sync:conflicts:read` | 200 | 200 | 200 | 403 | |
| `GET /api/audit/timeline` | `audit:read` | 200 | **403** | **200** | 403 | ⚠️ **Accountant cannot read the audit timeline** but Manager can. Relevant to B5.3's audit-trail rail. |

`settings` (14), `alerts` (15), `reliability` (7) and `audit-timeline` (1) total **37 routes**;
the **17 GET routes** above are live-verified. Their **20 write routes were not exercised** —
they are outside this milestone's authorised scope (B6 is not started) and several are
genuinely destructive (alert dispatch, sync replay). B6 must verify them before building.

---

## 11. Evidence

All artefacts under the session scratchpad; regenerate with the isolated stack recipe in §1.

| Artefact | Contents |
| --- | --- |
| `BEFORE-reads.json` / `AFTER-reads.json` | 37 accounting GET routes × 4 roles, pre- and post-cutover |
| `AFTER-B6-reads.json` | 54 GET routes × 4 roles incl. settings/alerts/sync/audit |
| `BEFORE-targeted.json` / `AFTER-targeted.json` | FU-1, B3-F1 and the C-21 headline write |
| `WRITES-matrix.json` | 26 Accountant writes + 16 Manager denials + 5 Supervisor denials |
| `RECON-complete.json` | the balanced reconciliation taken to `COMPLETED` |
| `PERIOD-matrix.json` | fiscal period `DRAFT → OPEN → CLOSED → LOCKED` |
| `SHAPES-matrix.json` | envelope, `total`, pagination bound and branch behaviour for 27 lists |
| `clean-M3{2,4,5,7}-*.json` | newman runs on a from-scratch database |
| `e2e-all2.log`, `e2e-apar-precutover.log` | 272/273 post-cutover vs 69-failed pre-cutover |

---

## 12. What this pass did NOT cover

- **The chatter rail** question (B3 deferred it "gated on B0"). Not investigated — no
  chatter/comment endpoint was in the A–G section list and none was found incidentally.
- **Section G (analytics)** — `GET /analytics/anomalies` and `/analytics/risk-dashboard` were not
  re-probed; they were already verified for Supervisor Prompt 5A/5B2.
- **Sections I / J (franchise)** beyond `franchise:forecast:read`. ⚠️ A related discovery: **37
  further permission strings referenced by guards have no seeded row** — `franchise:*` (12),
  `ops:*` (8), `dev:*` (5), `billing:*` (3), `merchant:*` (4), `onboarding:*` (2), `support:*` (2)
  — so the franchise, ops-portal, developer-portal and SaaS-billing surfaces are 403 for every
  role exactly as accounting was. Those modules are all deferred (`docs/KNOWN_LIMITATIONS.md`), so
  **they were deliberately not seeded here**; B7 and any developer-portal work must budget the
  same cutover. Recorded as **C-22**.
- **The 20 B6 write routes** (§10).
