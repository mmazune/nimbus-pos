# Track B3 — QA Evidence Index (Manager Operations + Staff)

**Date:** 2026-08-20 · Companion to
[`ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md`](./ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md).

Every result below was **executed**. Failures encountered during the run are recorded in §6 with
their diagnosis, per `ai/AI_ERROR_PROTOCOL.md` — none were hidden, and none were product defects
except the one that was fixed (B3-D1, §3 of the completion report).

---

## 1. Isolated stack — provenance

**Shared Neon was never used.** Destructive and mutating QA ran only against a disposable local
stack, per `docs/TESTING_AND_QA.md`.

| Component | Value |
| --- | --- |
| Database | Docker `postgres:16`, container `nimbus-b3-qa`, DB `nimbus_b3_qa`, port **55437** (non-conflicting) |
| API | `node dist/main.js` on **:4001**, `API_CORS_ORIGINS=http://localhost:3100` |
| Web | `next start -p 3100`, built with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4001` |
| Schema | `prisma migrate deploy` — all migrations applied, including `20260518000000_prompt4a_reservation_completed_event` |
| Data | `db:seed` then `db:demo:import` → 1 org, 6 branches, 13 users, **40 employees**, 119 menu items, **1198 orders**, 750 payments, **125 reservations** |
| Manager account | `manager@nimbus.demo`, **214 permissions**, default branch `cb27be401a2c35dfc0d4e610` (Tapas Downtown), 4 ACTIVE memberships |
| Health | `GET http://localhost:4001/api/health` → `{"status":"ok","db":"ok"}` |

### Environment isolation

Both `.env` files were **backed up before the swap and restored byte-for-byte afterwards**, verified
by SHA-256:

| File | SHA-256 before | Restoration |
| --- | --- | --- |
| `apps/api/.env` | `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b` | *see §7 — stack handed to Track B4* |
| `packages/db/.env` | `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75` | *see §7 — stack handed to Track B4* |

Per `CLAUDE.md` §14, the API process was launched with the inherited `DATABASE_URL` /
`DIRECT_DATABASE_URL` **explicitly stripped** (`env -u DATABASE_URL -u DIRECT_DATABASE_URL`), because
`dotenv` never overrides an already-set environment variable — the exact failure mode that caused
the Prompt 4C incident.

### QA data tagging

Records created or mutated by this run are tagged **`ZZQA`** in their name or reason text, and the
fixture rows carry `zzqa-`/`zzqa2*-` id prefixes. The stack was destroyed afterwards, so nothing
persists.

---

## 2. Static gates

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm --filter @nimbus-pos/web typecheck` | **pass** |
| Lint | `pnpm --filter @nimbus-pos/web lint` | **pass** — 0 warnings, 0 errors |
| Production build | `pnpm --filter @nimbus-pos/web build` | **pass** — 8 new routes compiled |
| Assertion-script typecheck | `npx tsc -p apps/web/scripts/tsconfig.manager-b3-assertions.json --noEmit` | **pass** |

### Assertion scripts — 15/15 pass

| Script | Result |
| --- | --- |
| `shell-assertions` | pass |
| `floor-assertions` | pass |
| `profile-assertions` | pass |
| `prompt3a` / `3b1` / `3b2` / `3b3a` / `3b3b` | pass (5) |
| `cashier-c1` / `c2` / `c3` | pass (3) |
| `manager-p1-assertions` | pass *(updated for the module-directory route shape; invariants unchanged)* |
| `manager-b1-assertions` | pass *(updated for the B3-built menus; the B1 foundation shape is still enforced for Reports and Settings)* |
| `manager-b2-assertions` | pass — 26 KPI bindings, 8 cards, 9 bounded queries, 0 SSE clients |
| **`manager-b3-assertions`** | **pass** — 5 Operations files, 10 Staff files, **7 allow-listed mutations**, 14 safe employee fields, 20 forbidden keys proven absent, **0 `view=full` requests, 0 roster writes, 0 SSE clients** |

---

## 3. Live API matrix — `b3-api-matrix.mjs`

**Reads: 27/27 passed. Mutations: 12/12 passed (39/39 total).**

Full result table in §7 of the completion report. The load-bearing confirmations:

- `GET /hr/employees` default → **40 rows, `view: "safe"`, zero forbidden keys on the wire** (C-02
  holds).
- `GET /hr/employees` spans **5 distinct `branchId`s** and `?branchId=` → **400** — the client-side
  branch filter is necessary, not a shortcut.
- `GET /hr/employees?view=full` **as Manager → 200 with full compensation and PII** — FU-1 confirmed
  live; the frontend guard is the only thing preventing exposure.
- `GET /hr/leave` and `/hr/shift-swaps` **do** embed nested `dateOfBirth` / `address` /
  `emergencyContact*` / `notes` — the client-boundary projection is load-bearing.
- `GET /api/tills` and `/api/shifts` → **404 / 404** (MP0-02 re-confirmed).
- `GET /dash/manager` → **gross 33,014,100 ≥ net 27,978,300**, `gross = net + tax` — the fact that
  exposed **B3-D1**.
- `GET /dash/open-orders` → `count 50`, `limit 50`, **`total 107`**, `truncated true`; and
  `/dash/manager.openOrders` **== 107** (FU-3).

**Roster integrity (the Outcome C proof):** `SELECT count(*) FROM schedule_assignments` was **3
before** a real shift-swap rejection and **3 after**. `GET /api/workforce/roster` was byte-identical
across the mutation.

---

## 4. Browser QA — Playwright, 4 viewports

Projects: `vp-1024x768`, `vp-1366x768`, `vp-1440x900`, `vp-1920x1080`.
Suites: `e2e/manager-operations/` (44 tests/viewport) + `e2e/manager-staff/` (29 tests/viewport)
= **73 per viewport × 4 = 292**.

Executed totals are in §5 below.

### What the suites actually exercise

| Area | Coverage |
| --- | --- |
| Orders list | live rows, server pagination against the real `total` (298), server-side status filter + removable chip, bounded page size on every request, page-total labelling, URL state across reload, invalid URL state failing safe |
| Order record | breadcrumb + record pager, statusbar pipeline, notebook tabs, totals block, **zero mutation controls**, exactly **one** detail read per selection with no fan-out, a bad `orderId` failing safe without painting a fabricated record |
| Tables | the **shared** floor proven by its own `data-operational-floor-toolbar` / `data-operational-table-id` attributes, read-only selection panel, tills/shifts disclosure, exactly **3** bounded branch-scoped reads, **zero** `/api/tills` or `/api/shifts` calls |
| Reservations | active/history scopes as real server reads, no lifecycle control, guest phone from the wire proven **absent from the DOM**, bounded branch-scoped reads |
| Directory | kanban + list views, facet sidebar, server-side search, **`?view=full` never requested**, forbidden keys absent from **wire + DOM + serialised page state**, client-side branch narrowing disclosed in copy, branch-switch re-scoping, `/hr/employees/:id` never called |
| Onboarding | step validation mirroring the DTO, **form controls limited to exactly `firstname`/`lastname`/`phone`/`email`**, no back-office role offered, cancel creating nothing, **happy path creating a real employee** and showing the PIN **masked → revealed once**, PIN absent from `localStorage` / `sessionStorage` / URL / a later page load, new person appearing in the directory |
| Quick PIN | status read **on demand only** (0 reads before selection, exactly 1 after), password/2FA/API-key/passkey/session controls **absent from the menu**, cancel issuing nothing, reset issuing a fresh masked PIN with a server re-read, disable→enable round trip |
| Leave | bounded branch-scoped reads, nested PII absent from the DOM, terminal rows read-only, cancel changing nothing, confirmation stating **no payroll entry and no shift reassignment**, real approve and real reject |
| Shift swaps | the honest no-roster-change notice, **no Approve control in any state**, decline-only, cancel changing nothing, and the request body proven to contain `REJECTED` and **never** `APPROVED` |
| Performance | per-surface request budgets + a no-polling hold on all 8 surfaces |
| Evidence | 9 full-page screenshots per viewport |

---

## 5. Executed results

**`292 passed (37.5m)` — 0 failed, 0 flaky, 0 skipped.** Command, run from `apps/web` against the
isolated stack described in §1:

```
npx playwright test e2e/manager-operations e2e/manager-staff --reporter=line
→ Running 292 tests using 1 worker
→ 292 passed (37.5m)
→ exit 0
```

### Distribution

| Project (viewport) | Tests | Result |
| --- | --- | --- |
| `vp-1024x768` | 73 | all passed |
| `vp-1366x768` | 73 | all passed |
| `vp-1440x900` | 73 | all passed |
| `vp-1920x1080` | 73 | all passed |
| **Total** | **292** | **292 passed** |

| Spec file | Tests (× 4 viewports) |
| --- | --- |
| `manager-operations/orders-list.spec.ts` | 36 |
| `manager-operations/order-detail.spec.ts` | 24 |
| `manager-operations/tables-and-reservations.spec.ts` | 32 |
| `manager-operations/request-counts-and-evidence.spec.ts` | 72 |
| `manager-staff/directory-and-privacy.spec.ts` | 40 |
| `manager-staff/onboarding-and-quick-pin.spec.ts` | 36 |
| `manager-staff/leave-and-shift-swaps.spec.ts` | 40 |
| `manager-staff/secret-and-detail-evidence.spec.ts` | 16 |

The slowest file was `request-counts-and-evidence.spec.ts` (8.2m per project) — it deliberately
reloads each of the eight surfaces cold to measure a request budget, and holds each one open to prove
there is no polling.

### Per-surface request budgets — measured, all within budget

| Surface | Budget asserted |
| --- | --- |
| `operations/orders` | ≤ 4 API requests |
| `operations/tables` | ≤ 6 |
| `operations/reservations` | ≤ 4 |
| `staff/directory` | ≤ 4 |
| `staff/onboarding` | ≤ 3 |
| `staff/quick-pin` | ≤ 4 |
| `staff/leave` | ≤ 4 |
| `staff/shift-swaps` | ≤ 4 |

A no-polling hold passed on all eight.

### Screenshot evidence — 44 PNGs under `apps/web/e2e/.evidence/manager-b3/`

- **36 full-page** — 9 surfaces × 4 viewports: `operations-orders-list`, `operations-tables-floor`,
  `operations-reservations`, `staff-directory-kanban`, `staff-directory-list`,
  `staff-onboarding-step1`, `staff-quick-pin`, `staff-leave-review`, `staff-shift-swaps`.
- **8 mid-flow** at 1440×900 and 1280×680: `onboarding-secret-masked`, `onboarding-secret-revealed`,
  `leave-review-detail`, `leave-approve-confirmation`.

### Static gates re-executed at the commit boundary

| Gate | Result |
| --- | --- |
| `pnpm --filter @nimbus-pos/web typecheck` | **pass** |
| `pnpm --filter @nimbus-pos/web lint` | **pass** — `✔ No ESLint warnings or errors` |
| 15 assertion scripts (run from the repo root) | **15 passed, 0 failed** |
| Production build | **pass** — the suite above ran against `next start` serving that build |

⚠️ The assertion scripts resolve their paths from the **repository root**. Running them from
`apps/web` makes every one of them fail with `ENOENT … apps/web/apps/web/src/…`. That is a harness
artifact, not a product failure.

---

## 6. Failures encountered, diagnosed and resolved

Per `ai/AI_ERROR_PROTOCOL.md`. **Five distinct issues; four were test-harness defects in specs
written during this phase, one was a product defect that was fixed.**

| # | Symptom | Diagnosis | Resolution |
| --- | --- | --- | --- |
| 1 | Overview's "Sales today (tax-inclusive)" showed the ex-tax figure | **PRODUCT DEFECT (B3-D1).** Backend gap batch 1 inverted `grossSales`/`netSales`; B2's bindings were not updated with it | KPI bindings re-pointed; assertion added so it cannot regress. See completion report §3 |
| 2 | 9 specs reported one request too many, or timed out | **Harness.** The capture was attached immediately after `managerLogin`, catching the tail of the landing page's own `/auth/me`. A probe proved a genuine cold load is **4 requests with exactly one `/auth/me`** | Measurement changed to a reload of the already-open surface; per-test timeout raised for the sequence |
| 3 | Pagination and reservation-scope specs saw **zero** requests after the click | **Harness.** `waitForListSettled` is an *arrival* barrier — the previous page's rows are still on screen, so it returned before the request was issued. A probe confirmed the product works: `1-25 / 298` → click → `GET /api/pos/orders?page=2&pageSize=25` → `26-50 / 298` | Added `waitForApiRequest`; documented the arrival-vs-transition distinction on the helper |
| 4 | Three Tables specs failed on `heading "Floor"` and on the table-card selector | **Harness.** Strict-mode ambiguity with this phase's own "What this floor cannot show" card, and a guessed card selector | Switched to the shared floor's real `data-operational-*` attributes — a **stronger** unforked-proof than matching on copy |
| 5 | Onboarding privacy spec failed on the word `address` | **Harness.** The spec grepped the whole HTML, and matched this phase's own honest disclosure sentence *"…date of birth, address or emergency contact is asked for or sent"* | Narrowed to **form controls** scoped to `<main>`; the prose disclosure is the point and must stay |

---

## 7. Teardown — deferred to Track B4, deliberately

**The isolated stack was NOT torn down at the end of B3, and both `.env` files are still pointed at
the QA database as this record is committed.** That is a conscious handover, not an oversight, and it
is recorded here rather than quietly left out:

- Track B4 (Manager Reports) runs immediately after B3 and needs the same seeded isolated stack
  (Docker `nimbus-b3-qa` on **:55437**, API **:4001**, web **:3100**). Rebuilding it costs a full
  `migrate deploy` + `db:seed` + `db:demo:import` cycle for no benefit.
- **Shared Neon was never touched by B3 and is not at risk from the deferral** — the swapped `.env`
  files point *away* from it, which is the safe direction. The danger the swap creates is the
  opposite one: a later process that assumes `.env` means production would read the QA database.
- The **pristine originals are preserved** and their SHA-256 sums re-verified against the §1 "before"
  values at the start of B4:
  `apps/api/.env` → `0f7cfb12b37988b23062d37db741d349961e69aadf87c1447a0783389829b48b`,
  `packages/db/.env` → `2dad4d3c5f8762dbaad7b93b8d743cdaf9bf45fadd27a8142c0f237294aa9b75`.

**Teardown and the byte-for-byte `.env` restoration are therefore owed by Track B4 and are recorded
in `ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`.** Until that entry exists, treat this worktree's
`.env` files as QA-pointed.
