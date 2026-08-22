# Permissions Cutover — Completion Report

> ⚠️ **SUPERSEDED IN PART 2026-08-21 (backend gap batch 4 — PERMS-2 / C-27).** This report's OD-9
> resolution ("Owner FULL / Accountant FULL / Manager READ-ONLY, 15 strings") described the owner's
> decision **at the time of the 2026-08-20 cutover**. The owner has since reversed it: Manager now
> has full access to everything it is responsible for. PERMS-2 (2026-08-21) granted Manager the full
> 36-string `C21_ACCOUNTING_FINANCE_ALL` set, matching Accountant, superseding
> `C21_ACCOUNTING_FINANCE_MANAGER_READ` (retained in `seed.ts` only as a historical record). This
> report also **missed a pre-existing gap**: Manager already held a stray, un-audited M28-era write
> (`pos:accounting:periods:create`/`accounts:create`/`cost-centers:create`) that this cutover never
> reviewed — found later as **C-27** (Track B5.5) and legitimised by PERMS-2. The `pos:hr:compensation:read`
> revocation (FU-1) and the Quick-PIN branch guard (B3-F1) described below are UNCHANGED and remain
> in force. See `ai/BACKEND_GAP_BATCH4_COMPLETION_REPORT.md` and CLAUDE.md's C-27 correction note.
> History below is preserved, not rewritten.

**Milestone:** Track C **C-21** + **FU-1** + **B3-F1**, with Track **B0** (API verification) folded in
**Date:** 2026-08-20
**Type:** Backend + **seed data**. **No Prisma schema change. No migration.**
**Grade:** **A — COMPLETE**, with findings recorded and not implemented (§8)
**Deploy state:** local isolated stack only. **Shared Neon deploy is still gated** (§9).

---

## 1. Scope delivered

| Part | Item | Outcome |
| --- | --- | --- |
| **1** | **C-21** — seed the missing accounting/finance permission matrix | ✅ **36** permission rows + **87** role-permission grants. The prior count of 23 was an undercount — see §2.1 |
| **2** | **FU-1** — revoke `pos:hr:compensation:read` from Manager | ✅ Manager `?view=full` → **403** at the wire; Owner + Accountant unchanged |
| **3** | **B3-F1** — branch-guard the Quick-PIN admin routes | ✅ Cross-branch → **404**; a second `body.branchId` escape found and closed → **400** |
| **4** | **B0** — accounting/finance route verification | ✅ 112 routes reconciled, 75-route accounting block verified live → `ai/ACCOUNTING_API_VERIFICATION_REPORT.md`, **CONDITIONAL GO** for B5 |

**Not touched:** Prisma schema, migrations, `demo-import.ts`, any frontend file, any permission
*string* on any guard, auth semantics, branch-isolation mechanics.

---

## 2. PART 1 — C-21

### 2.1 The gap was 36 strings over 56 routes, not 23

`ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md` FU-2 recorded **23** missing strings across AP (19
routes), AR (10) and Budget (9), and asserted:

> *"`pos:accounting:*` (17 rows) is seeded, so `accounting`, `ledger` and `bank-rec` are fine."*

That was a **prefix** check, not a string check. Re-enumerating every `@Permissions(...)` argument
across the API and diffing against the seed catalog found **36** missing strings in the
accounting/finance surface:

| Family | Missing | Routes | Previously reported |
| --- | ---: | ---: | --- |
| `accounting:ap:*` | 10 | 19 | ✅ counted |
| `accounting:ar:*` | 8 | 10 | ✅ counted |
| `pos:accounting:*` (bank-rec + period close) | **11** | **15** | ❌ **missed** — shares the prefix with the 18 seeded M28/M29 rows |
| `finance:*` | 5 | 10 | ✅ counted |
| `franchise:forecast:read`, `procurement:advisory:read` | **2** | **3** | ❌ **missed** — outside the `finance:` prefix but on budget routes |
| **Total** | **36** | **56** | reported as 23 |

**Proven live on the isolated stack before the change** — `bank-rec` was *not* fine:

```
permissions_total = 237
accounting:%      = 0
finance:%         = 0
the 11 bank-rec strings = 0
```

| Module | GET routes | 403 for Owner |
| --- | ---: | ---: |
| accounts-payable | 9 | **9** |
| accounts-receivable | 6 | **6** |
| **bank-rec** | 6 | **6** |
| budget | 6 | 5 |
| accounting | 5 | 0 |
| ledger | 5 | 0 |

`POST /api/accounting/ap/suppliers` as **Owner** → **403 "Insufficient permissions"**, reproducing
the batch-1 report's own probe exactly.

### 2.2 The 36 permission strings seeded

**Accounts Payable (10)**
`accounting:ap:bill:read` · `accounting:ap:bill:write` · `accounting:ap:bill:approve` ·
`accounting:ap:payment:write` · `accounting:ap:credit-note:read` · `accounting:ap:credit-note:write` ·
`accounting:ap:recurring:read` · `accounting:ap:recurring:write` · `accounting:ap:reminder:read` ·
`accounting:ap:reminder:write`

**Accounts Receivable (8)**
`accounting:ar:account:read` · `accounting:ar:account:write` · `accounting:ar:invoice:read` ·
`accounting:ar:invoice:write` · `accounting:ar:receipt:write` · `accounting:ar:credit-note:read` ·
`accounting:ar:credit-note:write` · `accounting:ar:aging:read`

**Bank reconciliation + period close (11)**
`pos:accounting:bank-accounts:read` · `pos:accounting:bank-accounts:create` ·
`pos:accounting:bank-statements:read` · `pos:accounting:bank-statements:import` ·
`pos:accounting:bank-entry:create` · `pos:accounting:reconciliation:read` ·
`pos:accounting:reconciliation:create` · `pos:accounting:reconciliation:match` ·
`pos:accounting:period-close-runs:read` · `pos:accounting:periods:close` ·
`pos:accounting:periods:lock`

**Budgets / forecast / demand calendar / procurement (7)**
`finance:budget:read` · `finance:budget:write` · `finance:budget:update-actuals` ·
`finance:demand-calendar:read` · `finance:demand-calendar:write` · `franchise:forecast:read` ·
`procurement:advisory:read`

### 2.3 Per-role grant table — the OD-9 resolution

OD-9 asks *"how much accounting **write** does Manager get?"* and recommends *"read-first … ship
the operationally-necessary writes only where **B0 proves the permission is held**."*

**That condition could not be satisfied as written.** B0 can only observe what the seed grants, and
the seed is what this milestone writes — so "does Manager hold it?" is *decided* here, not
*discovered* by B0. The owner's stated default was applied instead, and is recorded in the seed
alongside this reasoning:

| Role | Grant | Count |
| --- | --- | ---: |
| **Owner** | **FULL** — all 36 | 36 |
| **Accountant** | **FULL** — all 36 (accounting is its primary domain) | 36 |
| **Manager** | **READ-ONLY** | **15** |
| Supervisor · Cashier · Waiter · Chef · Bartender · Procurement · Stock Manager · Event Manager | **NONE** | 0 |

**Manager's 15 read strings:** `accounting:ap:{bill,credit-note,recurring,reminder}:read` ·
`accounting:ar:{account,invoice,credit-note,aging}:read` ·
`pos:accounting:{bank-accounts,bank-statements,reconciliation,period-close-runs}:read` ·
`finance:budget:read` · `finance:demand-calendar:read` · `franchise:forecast:read`.

**The five OD-9 "operationally necessary" writes (AP bill approve, reconciliation
match/skip/complete, period close/lock, budget update-actuals) were deliberately NOT granted to
Manager.** B5 must request them explicitly — finding **PC-01**.

⚠️ **`procurement:advisory:read` is withheld from Manager on purpose** (finding **PC-02**). Despite
the name, that single string gates **both** `GET /finance/procurement-suggestions` **and the
mutation** `PATCH /finance/procurement-suggestions/:id/review`. Granting the "read" would have
silently granted a write and broken the read-only list's only promise. It is Manager's single 403
in the read column, and the seed says why.

### 2.4 Verified after

| Role | Accounting-block GET results |
| --- | --- |
| Owner | 26 × 200, 11 × 404\* |
| Accountant | 26 × 200, 11 × 404\* |
| Manager | 25 × 200, **1 × 403** (the deliberate `procurement:advisory:read` exclusion), 11 × 404\* |
| Supervisor | **0 × 200**, 36 × 403 |

\* `:id` routes probed with a deliberately non-existent id — a 403 fires *before* the service
lookup, so a 404 proves the permission passed.

**Writes:** 26 Accountant writes attempted, **25 succeeded live** (the 26th is unexercisable — no
procurement-suggestion rows exist, §8). **16 Manager write attempts → 403. 5 Supervisor attempts →
403.** Full matrix in the B0 report §3.

**Demo-import accounts pick the grants up.** Every probe above authenticated as the *demo-import*
users (`owner@nimbus.demo`, `accountant@nimbus.demo`, `manager@nimbus.demo`,
`supervisor@nimbus.demo`), not the seed users — so the grants demonstrably reach demo accounts
through their seeded Role rows. No demo-import change was needed.

### 2.5 Seed idempotence — proven three ways

**(a) Run twice on an existing database.**

| | Permissions | RolePermissions | Revoked |
| --- | --- | --- | --- |
| Run 1 | created **36**, skipped 237 | created **87**, skipped 835 | **1** |
| Run 2 | created **0**, skipped **273** | created **0**, skipped **922** | **0** |

Content fingerprints identical across both runs:

```
permissions       md5=927a9fcfebfac205850949e1b947e12f  count=273
role_permissions  md5=c2b602ceeffd8bf90092af726eb7279d  count=922
diff run1 run2 -> IDENTICAL
```

**(b) Greenfield convergence.** A from-scratch database (`migrate deploy` → `db:seed`) produced
**273 / 922** and the **identical** `c2b602ce…` hash — the incremental upgrade path and the
greenfield path converge on the same state.

**(c) Repair.** 56 role-permission rows were deliberately deleted for the §5 experiment; a single
`db:seed` recreated exactly 56 and restored the same `c2b602ce…` hash.

`87 = Owner 36 + Accountant 36 + Manager 15`.

### 2.6 How the revoke stays idempotent

`seedRolePermissions` only **inserts**. Removing `pos:hr:compensation:read` from Manager's list in
`ROLE_PERM_MATRIX` therefore does nothing to a database that already has the row. The existing
`revokeStaleWaiterPermissions` was generalised into a declarative
`REVOKED_ROLE_PERMISSIONS` table + `revokeStaleRolePermissions()`, carrying the 7 Waiter actions
unchanged and adding the Manager entry with its reason. Both are targeted `deleteMany`s and are
safe to re-run.

---

## 3. PART 2 — FU-1, Manager compensation revoke

**The finding.** C-02 (backend gap batch 1) made the *default* `/hr/employees` payload safe for
everybody, but left `?view=full` reachable by any token holding `pos:hr:compensation:read` — and
the seeded matrix granted that to Owner, **Manager** and Accountant. B3 confirmed it live as
**B3-F2**. The owner's locked decision is that compensation is excluded from the Manager MVP; until
now that was enforced only by the frontend choosing not to ask.

**Before → after, measured live on the same stack:**

| Probe | Before | After |
| --- | --- | --- |
| `GET /hr/employees?view=full` as **Manager** | **200** — `view=full`, `compensationProfile=true`, `dateOfBirth=true` | **403** — *“view=full returns compensation and personal data and requires "pos:hr:compensation:read"”* |
| `GET /hr/employees/:id?view=full` as Manager | 200 | **403** |
| `GET /hr/compensation-profiles` as Manager | 200 | **403** |
| `GET /hr/employees?view=full` as **Owner** | 200 | **200** (unchanged) |
| `GET /hr/employees?view=full` as **Accountant** | 200 | **200** (unchanged) |
| `GET /hr/employees` (default) as Manager | 200, `view=safe`, no compensation | **200**, `view=safe`, no compensation (unchanged) |
| `GET /hr/employees?view=full` as Supervisor | 403 | 403 (unchanged) |

**No frontend change.** The B3 Staff surface never sends `?view=full` and never calls
`GET /hr/employees/:id` — both are pinned by the `manager-b3-assertions` script, which still passes.

**Test coverage added** — 5 new cases in `apps/api/test/hr.e2e-spec.ts` (`FU-1 Manager compensation
revoke (live)`) pinning the 403s, Owner's retained access, and that Manager's ordinary safe read is
untouched.

---

## 4. PART 3 — B3-F1, Quick-PIN branch guard

**The finding.** `frontline-staff-quick-pin.service.ts#loadEmployeeForOrg` resolved the target by
`{ id, orgId }` only. `BranchContextGuard` proves the **caller** is an ACTIVE member of the
`X-Branch-Id` they sent, but nothing tied the **target** to it — so an administrator of branch A
could read and rotate the Quick PIN of a frontline employee in branch B.

**A second escape was found while fixing it.** `reset()` accepted an optional `body.branchId` and
passed it straight into the Quick PIN lookup hash — so a caller could mint a PIN **scoped to a
branch they are not acting in**. This was not in the original B3-F1 write-up.

**Before → after, live** (Manager token, `X-Branch-Id` = Tapas Downtown, target = a Rooftop Bar
employee):

| Probe | Before | After |
| --- | --- | --- |
| `GET .../quick-pin-status` cross-branch | **200** | **404** |
| `PATCH .../quick-pin/disable` cross-branch | **200** | **404** |
| `PATCH .../quick-pin/enable` cross-branch | **200** | **404** |
| `POST .../quick-pin/reset` with `body.branchId` = another branch | **200** | **400** |
| `GET .../quick-pin-status` **same-branch** | 200 | **200** (unchanged) |

**The fix.** `loadEmployeeForBranch(employeeId, ctx)` requires `employee.orgId === ctx.organizationId`
**and** `employee.branchId === ctx.branchId`, mirroring the branch-scoped HR pattern already used by
shift-swap approve. It fails **closed** twice over: a cross-branch employee returns **404**, not a
403 that would confirm the id exists elsewhere; and an employee with a **NULL `branchId`** is also
refused, because there is no branch to check against and PIN issuance is inherently branch-scoped.
`reset()` now rejects any `body.branchId` that is not the active context rather than silently
ignoring it — a caller that asked for another branch is told it was refused.

**Onboarding does NOT share the gap** (checked, not assumed): `frontline-staff-onboarding.service.ts`
takes the branch from `ctx.branchId` only, validates it belongs to the org, and the DTO has no
branch field. No change was needed there.

**Test coverage added** — 5 new cases in `bg1.1-frontline-pin-admin.e2e-spec.ts`.

⚠️ **A hollow pass was found and fixed during this milestone.** The first version of those tests
*looked for* pre-existing employees in a second branch and `console.warn`-skipped when the dataset
had none — which is exactly what happened (3 self-skips, suite still green). The fixture is now
**created** through the public onboarding API in `beforeAll`, so the guard is genuinely exercised on
any seeded database. Re-run: **19/19 passed, 0 skips**, including a control case proving the same
employee id resolves fine (200) once `X-Branch-Id` names its own branch — so the 404 is a
branch-scope decision, not a broken lookup.

**No frontend change and none needed** — the B3 UI only lists employees from the selected branch
and already sends the branch header; the `manager-staff` Playwright suite passes unchanged (§6).

---

## 5. PART 4 — B0

Full report: **`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`**. Headlines:

- **112 routes** extracted and **reconciled against the API's own `RouterExplorer` boot log** — 0
  claimed-but-unmapped, 0 mapped-but-missed. (A parser defect was caught this way:
  `budget.controller.ts` declares **three** `@Controller` classes and the forecast route is
  **`/api/franchise/forecast`**, not `/api/finance/forecast`.)
- **75-route accounting block** verified live across Owner / Accountant / Manager / Supervisor;
  **25 live writes**, including a bank reconciliation taken to `COMPLETED` and a fiscal period taken
  `DRAFT → OPEN → CLOSED → LOCKED`.
- **17 B6-relevant GET routes** (settings, alerts, sync, audit) verified.
- **Verdict: 🟡 CONDITIONAL GO for B5**, blocking on **PC-03** (cross-branch leakage) and
  **PC-04** (duplicate vendor bills).

**The clearest single measure of what C-21 unblocked** — the AP + AR e2e suites, same specs, same
database, only the grants differing:

| | Tests failed | Tests passed |
| --- | ---: | ---: |
| Pre-cutover permission state | **69** | 20 |
| Post-cutover | **1** | 88 |

---

## 6. Validation

All executed on the isolated stack (§7). Commands and exact numbers:

| Check | Command | Result |
| --- | --- | --- |
| API unit | `npx jest` (apps/api) | **1057 passed / 4 failed**, 55 of 57 suites pass |
| ↳ pre-existing? | same 2 suites at `30c67aa` in a throwaway worktree | **identical 4 failures, same test names** — proven pre-existing |
| API e2e (hr, quick-pin, dashboards, reports, accounting, AP, AR, bank-rec, budget) | `jest --config test/jest-e2e.json --runInBand` | **272 passed / 1 failed** of 273; 8 of 9 suites pass |
| ↳ the 1 failure | AP recurring duplicate-bill | **finding PC-04** — deliberately left red, see §8 |
| Web typecheck | `--filter @nimbus-pos/web typecheck` | **pass** |
| Web lint | `--filter @nimbus-pos/web lint` | **pass** — no ESLint warnings or errors |
| Web build | `--filter @nimbus-pos/web build` | **pass** |
| Assertion scripts | all 16 under `apps/web/scripts/*-assertions.ts` | **16 / 16 pass** |
| Playwright `manager-staff` | 4 viewports | **106 passed / 26 skipped / 0 failed** |
| Playwright `manager-shell` | 4 viewports | **125 passed / 11 skipped / 0 failed** — matches the B1/B2 baseline exactly |
| Playwright `manager-dashboard` | 4 viewports | **84 / 84 passed** — matches the B2 baseline exactly |
| Playwright `manager-reports` | 4 viewports | **151 passed / 1 skipped / 0 failed** |
| Playwright `manager-operations` | 4 viewports | see §6.1 |
| newman M32 / M34 / M35 / M37 | clean from-scratch database | **85 requests, 0 request failures**; **166 / 168 assertions pass**; the 2 "failures" are deliberate R11 skip markers (§8) |
| Postman parse | all 56 collections | **56 / 56 parse** (3 carry a pre-existing UTF-8 BOM; untouched by this milestone) |
| `/api/health` | isolated API `:4011` | `{"status":"ok","db":"ok"}` |
| `git diff --check` | | **clean** |

The 4 pre-existing unit failures are all `ClientOnboardingService`; the second failing *suite*,
`accounts-receivable.service.spec.ts`, **fails to compile** (`type: 'CORPORATE'` vs the DTO enum,
and `result.totals` vs `total`) and contributes 0 failing tests. Both were reproduced identically at
`30c67aa` before any change in this milestone.

⚠️ **Three Playwright runs were invalidated by infrastructure, not product, and were re-run.** The
`next start` server on `:3111` was SIGKILLed twice (OOM — the machine reported 94 MB unused with two
API processes, two web servers, Docker Postgres and 4 Playwright workers), producing
`net::ERR_CONNECTION_REFUSED` on every test in the tail of a run. Re-running with `--workers=2`
after restarting the server produced the clean results above. **The failing runs are reported here
rather than discarded silently.**

---

## 7. Isolation and safety

| | |
| --- | --- |
| **Database** | Local Docker `postgres:16` — container `nimbus-permcut-pg`, port **55432**, DB `nimbus_permcut`. Created for this milestone, destroyed at teardown. |
| **Ports** | API **:4011**, web **:3111** — deliberately clear of the pre-existing `:3001` / `:3003` dev servers. |
| **`.env` files** | **Never modified.** Isolation was achieved by constructing the child-process environment explicitly (`DATABASE_URL` / `DIRECT_DATABASE_URL` set in the invoking environment, which `dotenv` cannot override) — the `tools/qa/lib/isolation.mjs` principle, applied without touching either file. |
| **SHA-256 proof** | `apps/api/.env` `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b` · `packages/db/.env` `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75` — **identical before and after**, captured at the start of the session and re-verified at the end. |
| **Connection proof** | The QA API process held exactly **one** TCP connection: `127.0.0.1 → 127.0.0.1:55432`. The only external `:5432` connection on the machine belonged to the separate, pre-existing shared-Neon dev API. |
| **Shared Neon** | **Never connected to by any process this milestone started, and never written.** |

🔴 **Incident, disclosed.** The brief said to leave the pre-existing `:3001` / `:3003` dev servers
alone. **Both went down during the milestone and both were restored.**

- A `pkill -f "node dist/main.js"` intended for the isolated API also matched — and killed — the
  **shared-Neon dev API on `:3001`**. Restarted from the same directory with a clean environment
  and verified: `/api/health` → `{"status":"ok","db":"ok"}`, connected to the **external Neon
  host**, while `:4011` stayed on `127.0.0.1:55432`.
- The **web dev server on `:3003`** was lost later — collateral of background-task process-group
  cleanup and/or the same OOM pressure that killed the QA web server three times. Restarted with
  `next dev -p 3003`; verified `GET /login` → **200**, and it resolves the API through the
  `NEXT_PUBLIC_API_BASE_URL` default of `http://localhost:3001`, i.e. back on shared Neon as before.

**No data was written to shared Neon by this milestone.** Both were process restarts only; no
migration, seed or write ran against that database. The lessons: use **PID-targeted** kills, never a
broad `pkill` pattern, and start long-lived helper servers in a detached session so a finishing task
cannot reap them.

⚠️ **One side effect worth flagging:** the isolated web build ran with
`NEXT_PUBLIC_API_BASE_URL=http://localhost:4011`, which overwrote `apps/web/.next/`. The restored
`:3003` server is a **dev** server and recompiled its own output, so it is unaffected — but a
`next build` will be needed before anything serves `apps/web` in production mode from this
worktree.

---

## 8. Findings — recorded, NOT implemented

Full detail in `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` §7.

| ID | Sev | Finding | Why not fixed here |
| --- | --- | --- | --- |
| **PC-01** | M | **Manager holds no accounting write.** OD-9's five "operationally necessary" writes were not granted, per the owner's stated default. | Granting them is an owner decision, not a verification outcome. **B5 must request them.** |
| **PC-02** | M | **`procurement:advisory:read` gates a read AND a write.** One string cannot express "may look, may not review", so Manager got neither. | Splitting it is a **backend guard change** — outside this milestone's scope. |
| **PC-03** | 🔴 H | **Cross-branch leakage on 4 accounting reads** (`ap/suppliers`, `ap/credit-notes`, `ar/credit-notes`, `bank-statements` — all proven live returning another branch's rows), plus list/detail scope inconsistency on `bank-statements` and `posting-errors`. 9 of 34 list/get service methods filter on `orgId` only. | **Backend `where`-clause changes.** B0 is verification-only; this milestone's authorised scope was C-21/FU-1/B3-F1. **Blocking condition on the B5 go.** |
| **PC-04** | 🔴 H | **AP recurring-bill duplicate prevention is dead code.** The guard compares `lastBill.dueDate === profile.nextDueDate`, but the same transaction advances `nextDueDate`, so the `ConflictException` is unreachable and a second call issues a **second bill for the same profile**. | Behaviour change to AP bill generation, outside scope. **The e2e test is deliberately left RED** with an explanatory comment — it documents the correct contract. Do not "fix" it by relaxing the expectation to 200. |
| **PC-05** | L | **`ar/aging` renamed `totals.grand*` → `summary.*`.** The e2e spec and the M35 collection asserted the old names and could never have run (403). Both **corrected** (test-expectation fixes; no data was lost, verified live). The **unit** spec still carries the stale name and fails to compile. | Unit-spec repair is a pre-existing issue outside scope. |
| **PC-06** | L | **Ten list routes return a bare array** with no `total` and no pagination bound. B5's C4 list contract binds the pager to a server `total`. | Backend envelope change. **Do not fabricate a total from `array.length`.** |
| **PC-07** | L | **Fiscal periods are created `DRAFT`, not `OPEN`**; there is **no unlock route**. | Documented so B5.4 models four states with `LOCKED` terminal. |
| **C-22** | M | **37 further permission strings have no seeded row** — `franchise:*` (12), `ops:*` (8), `dev:*` (5), `merchant:*` (4), `billing:*` (3), `onboarding:*` (2), `support:*` (2). Those surfaces are 403 for every role exactly as accounting was. | All belong to **deferred** modules (franchise, ops-portal, developer portal, owner SaaS billing). **Deliberately not seeded** — seeding permissions for surfaces nobody may use widens the attack surface for no gain. B7 and any developer-portal work must budget the same cutover. |

**Carried forward unchanged:** B3-F3 (leave/shift-swap creation is self-service only), B3-F4 (the
demo dataset has no PENDING leave at Tapas Downtown), FU-4 (M23/BG6 collections are not re-runnable
against the same database — reconfirmed here: M32 went 0 → 16 assertion failures on a second run
against a dirty database, which is why the reported newman numbers are from a **from-scratch**
database).

---

## 9. Deploy gate — shared Neon is NOT updated

Everything above is on the disposable local stack. **Deploying this cutover to shared Neon remains
gated** on an explicit per-cutover authorisation (read-only preflight + a retained pre-migration
recovery branch), together with the still-pending backend gap batch 1.

**No migration is involved** — permissions and role-permissions are seed *data*, applied by
`db:seed`, which is idempotent and additive apart from the two targeted revokes. But the deploy is
**behaviour-visible and must be announced**:

- 56 accounting/finance routes change from **403 to reachable** for Owner and Accountant, and 25 of
  them for Manager.
- **A Manager token loses access** to `GET /hr/compensation-profiles` and to `?view=full` on the
  employee endpoints. Any integration relying on that will break — intentionally.
- Cross-branch Quick-PIN administration stops working (**404**), and `POST .../quick-pin/reset` now
  **400**s on a foreign `body.branchId`.

---

## 10. Files changed

| File | Change |
| --- | --- |
| `packages/db/prisma/seed.ts` | +36 permission rows with route-accurate descriptions; `C21_ACCOUNTING_FINANCE_ALL` (36) + `C21_ACCOUNTING_FINANCE_MANAGER_READ` (15) grant lists with the OD-9 resolution recorded inline; Owner / Accountant / Manager blocks extended; `pos:hr:compensation:read` removed from Manager; `revokeStaleWaiterPermissions` generalised to the declarative `REVOKED_ROLE_PERMISSIONS` + `revokeStaleRolePermissions()` |
| `apps/api/src/modules/hr/frontline-staff-quick-pin.service.ts` | `loadEmployeeForOrg` → `loadEmployeeForBranch` (org **and** branch, fails closed on a NULL branch); `reset()` rejects a foreign `body.branchId` |
| `apps/api/src/modules/hr/dto/frontline-quick-pin-reset.dto.ts` | doc comment updated to the new `branchId` contract |
| `apps/api/test/hr.e2e-spec.ts` | +5 FU-1 cases |
| `apps/api/test/bg1.1-frontline-pin-admin.e2e-spec.ts` | +5 B3-F1 cases with a **created** two-branch fixture |
| `apps/api/test/accounts-receivable.e2e-spec.ts` | aging assertion corrected `totals.grand*` → `summary.*` (PC-05) |
| `apps/api/test/accounts-payable.e2e-spec.ts` | PC-04 documented on the deliberately-red duplicate-bill test |
| `postman/collections/M34-…` | `paymentTermsDays` → `paymentTermDays` (the DTO field; the whitelist 400'd and cascaded into 10 downstream 404s) |
| `postman/collections/M35-…` | aging assertions `totals.grand*` → `summary.*` + a server-`total` assertion |
| `postman/collections/M37-…` | R11 honest-skip guards on the two procurement-review requests |
| `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` | **new** — the B0 report |
| `ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md` | **new** — this file |

**No schema. No migration. No `demo-import.ts` change. No frontend file touched.**

---

## 11. Gate

**C-21, FU-1, B3-F1 and B0 are complete.** **B5 (Accounting) is CONDITIONAL GO** — see the B0
report §9; **PC-03** and **PC-04** must be handled first. **B5, B6 and B7 are NOT started, and must
not be started without explicit owner authorisation.** The shared-Neon deploy of this cutover is
still gated (§9).
