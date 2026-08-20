# Track B4 — Manager REPORTS module — Completion Report

**Date:** 2026-08-20 · **Grade: A — B4 COMPLETE / B5, B0 and the permissions cutover GATED**
**Scope:** frontend + docs only. **No backend, schema, migration, seed, permission or Postman
change.** One commit, no push.

Canonical plan: [`ai/ENTERPRISE_UI_ROADMAP.md`](./ENTERPRISE_UI_ROADMAP.md) §Track B4.
Predecessors: [`ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md`](./ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md),
[`ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`](./BACKEND_GAP_BATCH1_COMPLETION_REPORT.md).

---

## 0. Precondition — B3 was NOT committed, and its e2e evidence was unfinished

The B4 brief required Track B3 to be complete **and committed**, with a finished e2e run and final
numbers in its report. Two of those three were false when this phase started, and that is recorded
here rather than quietly repaired:

| Check | State found |
| --- | --- |
| B3 commit in `git log` | ❌ **Absent.** `HEAD` was `c2ff197` (backend gap batch 1); 57 uncommitted paths carried all of B3. |
| B3 Playwright run finished | ❌ **Cut off at test 245 of 292**, with zero failures up to that point. |
| B3 report has final numbers | ❌ §10 Validation was the placeholder *"(Numbers filled in from the executed runs…)"*, and the evidence index's §5 and §7 were empty. |
| B3 isolated stack | ⚠️ **Still running** — Docker `nimbus-b3-qa` on :55437, API on :4001, web on :3100, and **both `.env` files still pointed at the QA database**. |

Resolution, in order:

1. The interrupted B3 run had in fact completed in the background after its session ended:
   **`292 passed (37.5m)`, exit 0, 0 failed / 0 flaky**. That log was recovered and verified rather
   than assumed.
2. All 15 B3-era assertion scripts, typecheck and lint were re-executed at the commit boundary.
3. The evidence index §5 (executed results, request budgets, 44-screenshot inventory) and §7
   (teardown), and the completion report §10, were **filled in with real numbers**.
4. B3 was committed as **`c34d12e`**.
5. The `.env` originals were located and **SHA-256-verified against the values B3 recorded before
   the swap** (`0f7cfb12…` / `2dad4d3c…`), so restoration is provably byte-exact.

**B4 then reused that same isolated stack**, which is why B3's teardown was deferred to this phase.
Teardown and the byte-for-byte `.env` restoration are recorded in §9 below.

---

## 1. What shipped

`/manager/reports` graduates from the M-P1 honest-foundation screen into a **module of two real
surfaces**, the same conversion B3 applied to Operations and Staff:

| Route | Surface |
| --- | --- |
| `/manager/reports` | redirect → `/manager/reports/catalog` |
| `/manager/reports/catalog` | all **37** catalog entries; `?report=KEY` opens the generate form and its result |
| `/manager/reports/runs` | server-paginated run history; `?runId=…` opens a run's detail |

The B1 top-nav tree's two Reports rows — `Catalog` and `Report runs`, shipped in B1 as honest
`available: false` placeholders tagged **B4** — are now real links, and the `Reports dashboard`
placeholder row is gone.

### The four scope items

**1. Catalog.** A `ManagerListTable` over `GET /api/reports/catalog` with chip search, a category
filter as a removable chip, format badge and availability. **Availability is the API's own `status`
field** — 24 `IMPLEMENTED`, 1 `CONDITIONAL`, 12 `PENDING_LATER` — not a list maintained in the
frontend, so this screen cannot drift from what the backend can actually run. No pagination: the
catalog is a bare 37-entry array and paginating it in the browser would add a control with nothing
behind it.

**2. Generate.** ONE shared `ManagerReportParameterForm`, because **MP0-16 is correct and this phase
re-verified it live against all 24 routes**: every generator DTO is
`{reportWindow!, dateFrom?, dateTo?, parameters?}` and `top-items` alone adds `limit?`. The form
therefore renders exactly three controls — Period (all 24), From/To (CUSTOM only), Rows to return
(`TOP_ITEMS` only). Submitting runs the generator live and renders the result.

**3. History.** **Verified persisted before it was built**, because the brief required an honest
session-only fallback if it were not: `GET /api/reports` returns `{data,total,page,pageSize}` over
real `report_runs` rows, each with its `exportArtifacts[]`. So the list is a genuine server-paginated,
branch-scoped read fed by the endpoint's own `total`, and the copy says the history is stored by the
API and shared with anyone who can read the branch's reports.

**4. Detail + CSV.** Parameters used, period, generated-at, the summary as a key/value panel, an
honest breakdown table where one exists, and a **real** CSV download.

---

## 2. What the live API actually returns — and where the docs were wrong

The brief required verifying response shapes **before** designing. That check changed the design
twice.

| Assumption | Live reality |
| --- | --- |
| `GET /api/reports` is the catalog | ❌ **It is the run HISTORY** — `{data,total,page,pageSize}` of persisted `report_runs`. The catalog is `GET /api/reports/catalog`, and it returns a **bare array**, not a wrapped one. |
| The catalog carries a `category` | ❌ No such field. Fields are `{key,title,description,status,formats,permission}` plus `notes` on CONDITIONAL and `dependencyMilestone` on PENDING_LATER. |
| "24 of 37 verified" is a frontend fact to encode | ✅ It is the API's **own** `status` field, exactly 24/1/12. Better than assumed — B4 drives the UI from it. |
| Uniform generate DTO (MP0-16) | ✅ Confirmed on all 24 routes; **all 24 returned 201** for a Manager token. |
| `/reports/:id` returns no rows (MP0-08 / C-03) | ✅ True **at the top level** — and see B4-F3 below for the nuance that matters. |
| `format: PDF` → 501 (C-01) | ✅ Confirmed live, with an honest message naming CSV. |
| `GET /reports/:id` is org-scoped (MP0-12) | ✅ Re-confirmed live: a Tapas run returned **200** under a Rooftop `X-Branch-Id`. |
| `pageSize` unbounded on `/api/reports` (MP0-11) | ✅ `@Min(1)`, no `@Max`, no service clamp. |

**Docs that were accurate and are now additionally live-verified:** `docs/manager-ui-docs/
MANAGER_API_MATRIX.md` rows for `/api/reports`, `/api/reports/:id` and the generator POSTs;
`docs/REPORT_CATALOG_GUIDE.md`; MP0-08/-11/-12/-16.

### Live matrix executed for this phase

| Call | Result |
| --- | --- |
| `GET /api/reports/catalog` | **200** — 37 entries, `IMPLEMENTED` 24 / `CONDITIONAL` 1 / `PENDING_LATER` 12, every `formats: ["CSV"]` |
| `POST /api/reports/{generator}` × **24** | **201 on all 24**, `status: COMPLETED` synchronously |
| `GET /api/reports?page=1&pageSize=5` | **200** — `total` real, branch-scoped |
| `GET /api/reports/:id` | **200** — run + `exportArtifacts[]` |
| `GET /api/reports/:id` under ANOTHER branch's header | **200** ⚠️ — MP0-12 reproduced |
| `POST /api/reports/daily-sales` `{reportWindow:"CUSTOM"}` with no dates | **400** *"dateFrom and dateTo required for CUSTOM window"* |
| `POST /api/reports/export` `{format:"CSV"}` | **201** — artifact `READY`, real `fileSizeBytes` + `checksum` |
| `POST /api/reports/export` `{format:"PDF"}` | **501** — *"Nimbus does not have a PDF renderer… Use format \"CSV\""* |
| `GET /api/reports/exports/:id/download` (CSV) | **200** `text/csv`, `Content-Disposition: attachment` |
| `GET /api/reports/exports/:id/download` (legacy **PDF** artifact) | **404** *"Export file not found on disk"* |
| Manager permission set | 27 report/export permissions — **all 24 generators, catalog, history, exports read + download** |

---

## 3. Money, and the defect this phase caught before shipping

B3's headline defect (**B3-D1**) was a number rendered under a label that did not describe it. A
report summary is a far richer opportunity to repeat that — 24 generators, ~90 distinct summary keys,
money and counts and percentages in one flat object — so B4 treats labelling as the primary risk.

### Fail-safe classification

`lib/manager/reports-model.ts` formats a value as money **only if its key is on an explicit money
list** read off live responses. An unrecognised key renders as plain text. The rejected alternative —
a `/total|amount|sales/i` regex — would have formatted `conversionRate` and `noShowRate` as currency.

The three sales keys carry explicit labels that state their tax basis, matching B2's Sales card:

- `grossSales` → **"Sales (tax-inclusive)"**
- `netSales` → **"Sales (ex-tax)"**
- `subtotalSales` → **"Subtotal (ex-tax, before discount)"**

No bare "Gross sales"/"Net sales" exists on any B4 surface, and an assertion fails if one appears.

### 🔴 B4-F2 — the backend uses `grossSales` for two different tax bases

The first breakdown implementation rendered *"every key on the first array in `summary`"* using the
same label map. It **produced a live mislabel**, caught by this phase's own browser check:

| Field | Computed from | Basis |
| --- | --- | --- |
| `summary.grossSales` (DAILY_SALES, SHIFT_END) | `SUM(order.total)` | **tax-INCLUSIVE** |
| `summary.topItems[].grossSales` | `SUM(orderItem.subtotal)` | **ex-tax** |
| `summary.categories[].grossSales` | `SUM(orderItem.subtotal)` | **ex-tax** |
| `summary.hourlyBreakdown[].sales` | `SUM(order.total)` | tax-inclusive |
| `summary.breakdown[].totalValue` | `SUM(order.total)` | tax-inclusive |

The same field name means different things at different depths of the same payload. A single global
label map cannot be correct for both, so **each report now declares its own breakdown columns**, and
the per-item figure is labelled **"Gross sales (ex-tax)"**. Recorded as a finding; **no backend
change was made**.

### The cross-check the brief asked for — three-way agreement

`DAILY_SALES` for today, compared against the endpoint the B2 Overview reads:

| Figure | DAILY_SALES report | `/api/dash/today-summary` | `/api/dash/manager.today` | Rendered |
| --- | --- | --- | --- | --- |
| `grossSales` (tax-inclusive) | 33,014,100 | 33,014,100 | 33,014,100 | `UGX 33,014,100` |
| `netSales` (ex-tax) | 27,978,300 | 27,978,300 | 27,978,300 | `UGX 27,978,300` |
| `taxTotal` | 5,035,800 | 5,035,800 | 5,035,800 | `UGX 5,035,800` |
| `subtotalSales` | 28,107,000 | 28,107,000 | 28,107,000 | `UGX 28,107,000` |
| `orderCount` | 219 | — | 219 | `219` |

`gross = net + tax` (27,978,300 + 5,035,800 = 33,014,100) and `gross ≥ net` both hold. **Reports and
Overview cannot disagree about the same day's money**, and an e2e test asserts it every run.

### `rowCount` is never called a row count

It is whatever each generator counted while aggregating — `shifts.length + tillCount` for SHIFT_END,
`salesAgg._count` (219) for DAILY_SALES, `orders.length` (219) for SALES_BY_HOUR **whose export is 24
rows**. It is labelled **"Records aggregated"** with a sentence saying it is not the CSV's line
count, and an assertion forbids deriving any table from it.

---

## 4. Honesty boundaries

**No PDF affordance.** Not a control, not a badge, not a disabled button. The catalog advertises
`['CSV']` on all 37 entries, and the projection strips PDF even if it reappeared. `createManagerReportCsvExport`
**hard-codes `format: "CSV"` with no format parameter**, so no caller in this app can request one.
Prose *does* name PDF — deliberately, twice: the catalog footnote states Nimbus has no PDF renderer,
and a run carrying a **withdrawn pre-2026-08-20 PDF artifact** discloses it. Those artifacts still
say `status: READY` and `mimeType: application/pdf` but their files **404** (verified live), so they
are disclosed in words and never offered as a download. The assertion script targets *code* — no
`format: "PDF"`, no `application/pdf`, no `.pdf` filename — so the disclosure is allowed to stay,
which is the same lesson B3 learned when an over-broad grep flagged its own privacy disclosure.

**No graph, no pivot, and no advertisement of them.** Gated on **C-03**. They are absent from the
menu entirely rather than listed as not-yet, because a phase-tagged row would advertise a capability
with no backend behind it. `ManagerViewSwitcher` is deliberately **not mounted**.

**Unavailable generators are structurally uncallable.** The 13 non-implemented entries get
`generatorPath: null`, so there is no URL to build. The generate action refuses them, and the request
function throws rather than constructing a path. An unknown catalog status **fails closed**. Each
unavailable report names the milestone the API itself cites (e.g. *"needs M30 — Payroll Engine + Pay
Runs + Payslips"*), and shows **no form and no disabled button** — the control is absent.

**No file is assembled in the browser.** The download streams the server's own bytes via
`response.blob()`. `new Blob(` appears nowhere in the Manager tree, asserted.

**Cross-branch reads fail safe (MP0-12).** `GET /reports/:id` resolves by `orgId` alone, so another
branch's run really does return 200. The **API-client boundary** rejects a run whose own `branchId`
is not the active branch, so it never reaches the cache and its money can never be rendered under
this branch's name. The run's own `branchId` is carried into the UI and disclosed if it ever differs.

**Read-only history.** No delete, edit or rename control exists on any run.

---

## 5. A duplicate-query defect found and fixed (B4-D1)

Measured live during this phase: loading `/manager/reports/catalog` issued
**`2x GET /api/reports/catalog`** in a single page load.

**Cause.** The M-P1 readiness strip already fetches the catalog on **every** Manager page (to count
ready generators) under key `["manager","report-catalog",branchId]`. B4's first implementation added
a *second* fetcher under `["manager","reports-catalog",branchId]` — same endpoint, different key, so
React Query could not dedupe them.

**Fix.** Reports now reuses the readiness strip's **key and request function**, and projects the
shared cache entry with React Query's `select`. One endpoint, one fetcher, one cache entry, two
consumers. `reports-api.ts` no longer references `/api/reports/catalog` at all, and an assertion
pins all of it.

This is exactly the duplicate-query regression CLAUDE.md §15 forbids, and it would have shipped
unnoticed inside a passing 4-request budget.

---

## 6. Files

### Added

```
apps/web/src/lib/manager/reports-{types,catalog,model,api,route,context}.ts
apps/web/src/components/manager/reports/{ManagerReportCatalogScreen,ManagerReportRunsScreen,
  ManagerReportParameterForm,ManagerReportSummaryPanel,index}.tsx|ts
apps/web/src/pages/manager/reports/{index,catalog,runs}.tsx
apps/web/scripts/manager-b4-assertions.ts
apps/web/e2e/manager-reports/{fixtures,catalog.spec,generate-and-export.spec,runs-and-evidence.spec}.ts
```

### Changed

| File | Change |
| --- | --- |
| `lib/manager/routes.ts` | Reports `match` → `startsWith`, so sub-routes keep the module highlighted. **The locked six surfaces are unchanged.** |
| `lib/manager/top-nav.ts` | Reports menu now has two real links; the foundation-page row is gone. No graph/pivot row. |
| `lib/manager/permissions.ts` | Reports `liveFrom` → `"live"`; the documented guard list now names all four report permissions. |
| `lib/manager/state.ts` | `managerCaveats.exports` refreshed — it still said PDF *"returns a plain-text file"*, true before C-01 and **stale after it**. Same conclusion, correct reason. |
| `scripts/manager-b3-assertions.ts` | Mutation allow-list extended by **exactly two**, with the reason recorded inline; count 7 → **9**. |
| `scripts/manager-b1-assertions.ts` | `reports` moves out of the B1 foundation-shape set into the built-module set, as `operations`/`staff` did in B3. **Settings still holds the original B1 shape.** |
| `scripts/manager-p1-assertions.ts` | Reports added to the module-landing map and the built-surface list; one foundation surface remains (Settings). |
| `pages/manager/reports.tsx` | **Deleted** — replaced by a module directory whose `index.tsx` redirects. |
| `e2e/manager-shell/{navigation-and-landing,topnav-keyboard,role-boundaries}.spec.ts` | **Repaired drift, some of it inherited.** See §6.1. |

### 6.1 `e2e/manager-shell/` had drifted — partly since B3, and B4 finished the repair

Running the shell suite as this phase's regression gate produced **7 failures**. They were not all
B4's, and the attribution was proven from the commit history rather than assumed:

- `e2e/manager-shell/` was **last updated at B2 (`be3ac47`)**.
- At the **B3** commit `c34d12e`, the `Operations dashboard` and `Staff dashboard` menu rows were
  **already gone** and the `B3`-tagged not-yet rows with them — so those failures **predate B4**.
  B3 shipped without re-running this suite; its evidence index covers only
  `manager-operations` and `manager-staff`.
- `Reports dashboard` still existed at `c34d12e`, so **that** failure is B4's.

All 7 were fixed by updating the specs to the intended nav, preserving what each one actually
protects:

| Spec | Repair |
| --- | --- |
| *"…navigates through its real link"* | Each module's real link is now its first real surface (`Orders` / `Directory` / `Catalog`); **Settings keeps the B1 `Settings dashboard` shape** until B6. |
| *"not-yet rows … are inert"* | Re-pointed from Operations (built at B3) to **Settings**, the last module whose tree is still mostly not-yet — 6 rows tagged `B6`. |
| *"foundation pages state the boundary"* | Re-pointed to `/manager/settings`, now the **only** surface on the honest foundation screen. |
| *"a route change closes any open dropdown"* | Clicks `Catalog` instead of the removed `Reports dashboard`. |
| *"no operational write affordance"* | ⚠️ **A false positive, and the interesting one.** The loose `/void/i` pattern matched the catalog's **"Voids Summary Report"** row — a read-only navigation target whose *name* contains the word. The patterns are now anchored (`/^void$/i`, `/^approve$/i`, …) to the real control labels, so the boundary is proven exactly instead of accidentally. |

Result: **34/34 passed.**

### Not touched

Backend, Prisma schema, migrations, seed, demo import, permissions, Postman collections, and every
Waiter / Cashier / Supervisor file.

---

## 7. Validation

Every number was executed. The isolated stack is the one described in
`ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md` §1 (Docker `postgres:16` `nimbus-b3-qa` on **:55437**, API on
**:4001**, web on **:3100**) — **never shared Neon**.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm --filter @nimbus-pos/web typecheck` | **pass** |
| Lint | `pnpm --filter @nimbus-pos/web lint` | **pass** — 0 warnings, 0 errors |
| Production build | `pnpm --filter @nimbus-pos/web build` | **pass** — 3 new routes compiled |
| Assertion scripts | `npx tsx apps/web/scripts/*-assertions.ts` *(from the repo root)* | **16 passed, 0 failed** — incl. the new `manager-b4-assertions` |
| Health | `GET http://localhost:4001/api/health` | `{"status":"ok","db":"ok"}` |

*(Browser results, request counts and screenshots — §8.)*

⚠️ The assertion scripts resolve paths from the **repository root**; running them from `apps/web`
fails every one with `ENOENT … apps/web/apps/web/src/…`. Harness artifact, not a product failure.

---

## 8. Browser QA

### `e2e/manager-reports/` — **152/152, four viewports, 0 failed, 0 skipped**

| Project (viewport) | Tests | Result |
| --- | --- | --- |
| `vp-1024x768` | 38 | all passed |
| `vp-1366x768` | 38 | all passed |
| `vp-1440x900` | 38 | all passed |
| `vp-1920x1080` | 38 | all passed |
| **Total** | **152** | **152 passed** |

Three spec files: `catalog.spec.ts` (9), `generate-and-export.spec.ts` (15) and
`runs-and-evidence.spec.ts` (14).

**What the suite actually proves** — each item is a boundary, not a smoke test:

- **All 37 catalog entries render**, and the 24/13 split shown on screen is the API's, not a
  constant.
- **Generate happy-path on three structurally different generators** — `DAILY_SALES` (aggregate, no
  breakdown), `TOP_ITEMS` (the only `limit` DTO, real tabular breakdown) and `PAYMENT_MIX`
  (breakdown-only) — each issuing exactly **one** branch-scoped POST.
- 🔴 **The gross/net cross-check.** `DAILY_SALES` figures are compared against
  `/api/dash/today-summary` **inside the test**, field by field, plus `gross = net + tax` and
  `gross ≥ net`, plus an assertion that no bare `"Gross sales"`/`"Net sales"` label exists.
- 🔴 **CSV contents asserted, not status.** The download event is captured, the file read from disk,
  and its parsed rows compared to the rendered figures (`Gross Sales` → *Sales (tax-inclusive)*,
  `Net Sales` → *Sales (ex-tax)*, `Tax Total` → *Tax*, `Order Count` → *Orders*). The TOP_ITEMS
  export is asserted to be genuinely tabular (`Rank,Item,Quantity Sold,Gross Sales`) with its first
  row matching the preview's first row.
- **The export request body contains `"format":"CSV"` and never `PDF`**, and the download is a GET
  carrying the branch header.
- **The 501 path is exercised.** The UI has no PDF route, so the spec drives the API directly with
  the page's own session to prove a PDF export really does return **501** with a message naming CSV
  — the reason no control is offered is verified, not assumed.
- **The unavailable state offers nothing**: no form, no button (not even a disabled one), the API's
  own `M30` dependency in the copy, and **zero POSTs issued**.
- **A CUSTOM range blocks submission until both dates are set**, issuing no request.
- **A legacy PDF artifact is disclosed and never offered** — the spec walks to the oldest history
  page to find one rather than skipping itself.
- **An out-of-branch run fails safe** and every listed run really belongs to the active branch.
- **No delete/edit/rename control** exists on run history.
- **Server-side pagination** against the endpoint's own `total`, an explicit bounded `pageSize` on
  every request, and an invalid URL status filtered out client-side rather than 400-ing the page.

### Per-surface request counts — measured

| Surface | Requests | Composition |
| --- | --- | --- |
| `/manager/reports/catalog` | **3** | `/auth/me` + `/reports/catalog` + `/devices` |
| `/manager/reports/runs` | **4** | the same 3 + `/api/reports` |

The catalog costs **nothing beyond the shell**: its data read *is* the readiness strip's, after the
B4-D1 fix (it was 4 with a duplicate before). A no-polling hold passed on both surfaces.

### Screenshots — 10 captured and **viewed**, at 1440×900 and 1280×680

`apps/web/e2e/.evidence/manager-b4/{1440x900,1280x680}/`: `01-catalog`, `02-parameter-form`,
`03-generated-report`, `04-unavailable`, `05-run-history`.

Reviewing them caught two real copy defects that no assertion would have: the catalog advertised a
**CSV badge on reports that cannot be generated**, and the detail line said *"exports as CSV"* for
an unavailable report. Both now render `—` and omit the claim.

### Regression suites — all green

| Suite | Result |
| --- | --- |
| `e2e/manager-shell/` | **34/34** *(after repairing the drift in §6.1)* |
| `e2e/manager-dashboard/` (B2) | **21/21** — the Overview dashboard is untouched |
| `e2e/manager-operations/` (B3) | **40/40** *(after de-flaking one spec — below)* |
| `e2e/manager-staff/` (B3) | **33/33** |
| `e2e/cashier-floor/` (cross-role) | **48/48** — Cashier is unaffected |

Zero console errors on every Reports surface; `/api/health` → `{"status":"ok","db":"ok"}`.

### Two harness failures diagnosed, per `ai/AI_ERROR_PROTOCOL.md`

| Symptom | Diagnosis | Resolution |
| --- | --- | --- |
| An early full run showed **84 failures**, all `ERR_CONNECTION_REFUSED` | **Harness.** The QA web server was being killed mid-run — including once by my own foreground command's `pkill` colliding with a background suite. `manager-staff` "failed" 3 tests and took **41 minutes**; re-run alone it was **33/33 in 49.9 s** | Each project now runs against its own freshly started server, and nothing else touches port 3100 during a run |
| `manager-operations` › *"renders the SHARED operational floor, unforked"* failed **reproducibly** with 0 table cards | **Harness, and proven so.** A live probe showed the surface renders **22 cards with zero console errors** and `GET /api/tables` returns 22. The spec used a one-shot `count()` immediately after the grid shell appears, racing the card render | Changed to a retrying `expect.poll`. The product was never wrong |

---

## 9. Teardown and `.env` restoration — **B3's debt, now settled**

Track B3 deferred its teardown and handed the stack to B4 (its evidence index §7). That debt is
discharged here.

| Step | Result |
| --- | --- |
| Web server (`next start -p 3100`) | stopped |
| API (`node dist/main.js` on `:4001`) | stopped |
| Docker `postgres:16` container `nimbus-b3-qa` (`:55437`) | **stopped and removed** — the database and every row this phase created are gone with it |
| QA export artifacts on disk (`apps/api/exports/`) | **92 CSV files deleted** (gitignored, never committed) |
| Listening ports 3100 / 4001 / 55437 | **all down**, verified |

### `.env` restored byte-for-byte, and proven

Both files were restored from the originals B3 preserved, and their SHA-256 sums now match the
values B3 recorded **before** the swap exactly:

| File | Recorded before the swap (B3) | After restoration (verified now) |
| --- | --- | --- |
| `apps/api/.env` | `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b` | `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b` ✅ |
| `packages/db/.env` | `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75` | `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75` ✅ |

**Shared Neon was never touched** by B3 or B4 — no migration, no seed, no write, and for most of
both phases the `.env` files pointed away from it. Every mutation in this phase (322 report runs,
93 export artifacts) lived only in the disposable container that has now been removed.

---

## 10. Findings recorded, none implemented

| # | Finding |
| --- | --- |
| **B4-F1** | `POST /api/reports/export` is guarded by `pos:reports:exports:**read**` — a read permission on a write route (already recorded as MP0-13; re-confirmed live). No Manager impact: all export permissions are held. |
| **B4-F2** | 🔴 `grossSales` denotes **tax-inclusive** at summary level but **ex-tax** inside `topItems[]`/`categories[]`. A backend vocabulary inconsistency; B4 works around it with per-report column labels. Reconciling it is a backend decision. |
| **B4-F3** | MP0-08/C-03 say `/reports/:id` returns "no rows". True at the top level, but **16 of 24 summaries embed a real array** (`topItems`, `hourlyBreakdown`, `categories`, `lowStockItems`, `actors`, `staffBreakdown`, `breakdown`), and the CSV is generated from it. This does **not** unblock a pivot — there is still no per-order row payload and no arbitrary grouping — so **C-03 stays gated**. |
| **B4-F4** | `GET /reports/exports/:id/download` is org-scoped like `/reports/:id` (MP0-12), so an artifact id from another branch is downloadable. B4 never constructs such a link, but the route itself is not branch-guarded. |
| **B4-F5** | Pre-2026-08-20 PDF artifacts remain in `export_artifacts` with `status: READY` and `mimeType: application/pdf` while their files **404**. C-01 correctly left history alone; a cleanup or a status backfill is a separate owner decision. |
| **B4-F6** | `parameters?: Record<string, any>` is accepted by all 24 DTOs but **read by none** — every live run returned `parameters: null`. B4 renders no free-form parameters control rather than shipping one that silently does nothing. |

---

## 11. Deferred, with reasons

- **Graph (C8) and pivot (C9) views** — gated on **C-03**. Not built and **not advertised**.
- **Financial statements** (P&L, balance sheet, cash flow, AP/AR aging) — not among the 24
  generators; they are `PENDING_LATER` in the catalog and the first real ones arrive in **B5**.
- **Scheduled / emailed report delivery** — `SCHEDULED_DIGEST` is `PENDING_LATER` (M40) and there is
  no verified delivery adapter.
- **A catalog pager** — the catalog is a 37-entry array with no server pagination; a pager would be
  a control with nothing behind it.
- **A free-form `parameters` editor** — B4-F6.
- **The chatter rail** — still gated on **B0**.

---

## 12. Do NOT (carried into CLAUDE.md / CODEX.md)

- Do not add a PDF affordance of any kind. `format: PDF` is **501** and there is no renderer
  (OD-10 open). Prose disclosure is allowed; a control is not.
- Do not add a graph or pivot view, or advertise one, until **C-03** lands.
- Do not render a row table derived from `rowCount`, and do not equate it with the CSV's line count.
- Do not relabel `grossSales`/`netSales` as bare "Gross"/"Net", and do not reuse the summary-level
  label for the per-item `grossSales` — the two have **different tax bases** (B4-F2).
- Do not add a second fetcher or query key for `/api/reports/catalog` — it is shared with the M-P1
  readiness strip on purpose (B4-D1).
- Do not build a CSV in the browser; the download must stream the server's bytes.
- Do not open a run whose own `branchId` is not the active branch (MP0-12).
- Do not add a delete/edit control to run history.
- **B5 (Accounting), B0 (API verification) and the permissions cutover are NOT started.** B5 in
  particular must budget a permission/seed cutover first — **C-21: 38 accounting routes are 403 for
  every role, including Owner.**
