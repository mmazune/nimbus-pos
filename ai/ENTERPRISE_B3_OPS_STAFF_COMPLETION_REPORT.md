# Completion Report — Enterprise UI Track B3: Manager Operations + Staff

**Date:** 2026-08-20 · **Outcome grade:** **A — B3 COMPLETE / B4 GATED**
**Canonical plan:** [`ai/ENTERPRISE_UI_ROADMAP.md`](./ENTERPRISE_UI_ROADMAP.md) §B3
**Scope class:** frontend + docs only. **No backend, schema, migration, seed, permission or Postman
change.**

---

## 1. Context snapshot

| | |
| --- | --- |
| Previous phase | **B2** — Manager Overview dashboard (`ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`) |
| Backend dependency | **C-02 landed** (commit `c2ff197`, `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`) — `GET /hr/employees` is compensation- and PII-free by default, which is what unblocked the Staff directory |
| This phase | **B3** — Operations (read-only oversight) + Staff (directory, onboarding, Quick-PIN admin, leave & shift-swap review) |
| Next phase | **B4** (Reporting) — **NOT started, and gated on an explicit owner go.** `B0` (API verification, docs-only) may still run in parallel |

---

## 2. Scope checklist against roadmap B3

### Operations — read-only oversight

| Roadmap item | Status | Where |
| --- | --- | --- |
| **Orders list** cloning Odoo **C4** — right-aligned numerics, status pill, optional-column gear, column-totals row, control-panel pager fed by the real `total`, explicit bounded page size | ✅ **Shipped** | `components/manager/operations/ManagerOrdersScreen.tsx`, `chrome/ManagerListTable.tsx` |
| — leading checkbox column | ✅ **Deliberately omitted** | Nimbus has no bulk action to back one; the roadmap says "only if a bulk action actually exists — otherwise omit" |
| **Order detail** cloning **C5** — status pipeline (**C14**), record title, two-column field block, notebook tabs over the line grid, totals block, all read-only | ✅ **Shipped** | `ManagerOrderDetailPanel.tsx` |
| — statusbar ACTION buttons | ✅ **Deliberately omitted** | Operations is oversight; order writes are Waiter/Supervisor/Cashier-owned |
| — smart-button strip | ⛔ **Not built** | Odoo's opens related-record lists. The only candidate Nimbus offers on an order is `GET /pos/orders/:id/refunds` — one extra request per record, for a relation that is empty on almost every order, leading to a surface (refunds) that is outside Manager scope. A one-button strip is furniture; it was omitted rather than padded |
| **Tables / floor** rendering the shared `OperationalFloor` read-only, never a `ManagerFloor*` fork, guest names never on cards | ✅ **Shipped** | `ManagerTablesScreen.tsx` + `lib/manager/operations-model.ts` |
| **Reservations snapshot**, read-only | ✅ **Shipped** | `ManagerReservationsScreen.tsx` |
| **Operational exceptions** | ⏸ **Deferred, with a reason** | Outside the owner's enumerated B3 scope; tagged `Deferred` in the menu tree, not given an invented phase number. See §8 |
| **Escalations** (surface + route to a domain decision route) | ⏸ **Deferred, with a reason** | See §4 — the "read-only vs escalations" tension the roadmap asked B3 to resolve explicitly |
| **Chatter rail (C6)** over `GET /api/audit/timeline` | ⛔ **Blocked, as the roadmap specifies** | Gated on **B0**, which has not run. The endpoint's shape and permission are unverified; building against it is exactly what the roadmap forbids |

### Staff administration

| Roadmap item | Status | Where |
| --- | --- | --- |
| **Directory** cloning **C7** kanban (avatar colour block, stacked icon/value rows, status dot) + left facet sidebar + a C4 list behind the view switcher | ✅ **Shipped** | `ManagerStaffDirectoryScreen.tsx`, `ManagerEmployeeKanban.tsx` |
| **Allow-list projection at the API-client boundary** so raw data never reaches cache or state | ✅ **Shipped** | `lib/manager/staff-projection.ts` — an allow-list, proven by assertion **and** by the live wire/DOM/cache e2e proof |
| `/hr/employees` is org-scoped and rejects `?branchId=` — filter client-side **and say so in the UI** | ✅ **Shipped** | Branch narrowing is client-side, disclosed in `[data-manager-directory-note]`, with an explicit whole-organization view |
| **Staff detail form** cloning **C5** with a statusbar pipeline that is the **real** Nimbus lifecycle, not Odoo's `Invited ▸ Confirmed` | ✅ **Shipped** | `ManagerEmployeeDetailPanel.tsx`; pipeline = `ACTIVE ▸ ON_LEAVE ▸ SUSPENDED`, `TERMINATED` renders as an exit |
| **Frontline onboarding** behind confirmation; PIN masked, copy-once, expiry copy, never logged/persisted/cached; **never** `contractId`/`compensationProfileId` (MP0-15) | ✅ **Shipped** | `ManagerOnboardingScreen.tsx` + `ManagerOneTimeSecretPanel.tsx` |
| **Quick-PIN admin** cloning **C12** with exactly the rows Nimbus can back; password/2FA/API keys/passkeys/session revocation **omitted, not greyed out** | ✅ **Shipped** | `ManagerQuickPinScreen.tsx` |
| **Record-cog actions menu (C13)** with only the actions that exist | ✅ **Shipped** | `chrome/ManagerRecordActionsMenu.tsx` — renders nothing at all when there is no action |
| **Leave review** making **no payroll or roster claim** | ✅ **Shipped** | `ManagerLeaveReviewScreen.tsx` — the confirmation says so in words |
| **Shift-swap review — Outcome C**: honest notice, **no Approve control** | ✅ **Shipped** | `ManagerShiftSwapReviewScreen.tsx`; the request function's parameter is narrowed to the literal `"REJECTED"` so the type system, not a code review, prevents an Approve |
| **Sensitive-fields exclusion card** | ✅ **Shipped** | `ManagerSensitiveFieldsCard.tsx` |
| **Attendance timeline (read)** | ⏸ **Deferred, with a reason** | Outside the owner's enumerated B3 scope; `/hr/attendance` embeds the same nested PII. See §8 |

### FU-3 (carried from backend gap batch 1)

| Item | Status |
| --- | --- |
| Refresh the two stale `dashboard-model.ts` notes | ✅ Done |
| Let the Overview open-orders card use the honest `total`/`truncated` | ✅ Done — **copy and footnote only; the card contract is unchanged**, the KPI still binds `/dash/manager.openOrders` (CLAUDE.md §12) |
| — **and one defect FU-3 understated** | 🔴 **Found and fixed — see §3** |

---

## 3. 🔴 Defect found and fixed: B3-D1 — the Overview's headline money was mislabeled

FU-3 recorded the two `dashboard-model.ts` notes as "stale, though nothing rendered is wrong."
**That was not accurate, and this phase's live verification proves it.**

Backend gap batch 1 did not merely change wording — it **inverted the meaning of both sales fields**:

| Field | Before the batch (what B2 was built against) | After the batch (today) |
| --- | --- | --- |
| `grossSales` | `SUM(order.subtotal)` — **ex-tax** | `SUM(order.total)` — **tax-INCLUSIVE** |
| `netSales` | `SUM(order.total)` — **tax-inclusive** | `grossSales − taxTotal` — **ex-tax** |

B2's KPI bindings were not updated with it, so `/manager/overview` was rendering
**`today.netSales` — the ex-tax figure — under the label "Sales today (tax-inclusive)"**, and the
tax-inclusive figure under "Sales excluding tax". The two headline money figures on the Manager
dashboard were swapped.

**Verified live on the isolated stack** (`b3-api-matrix.mjs`):

```
GET /dash/manager: gross=33,014,100  net=27,978,300  tax=5,035,800
gross >= net ✓        gross = net + tax ✓ (27,978,300 + 5,035,800 = 33,014,100)
```

**Fix (frontend only):** `MANAGER_KPI_BINDINGS` re-points `sales.taxInclusive → today.grossSales`
and `sales.exTax → today.netSales`; `ManagerSalesTodayCard` renders accordingly. The labels are
unchanged, because the labels were always right — the fields behind them were not. The
`manager-b3-assertions.ts` gate now pins both bindings so a future backend change cannot silently
invert them again, and `ManagerDashboardResponse` documents the vocabulary at the type.

`ManagerDashboardResponse.today` also gained the optional `taxTotal` and `subtotalSales` the batch
added, typed as optional so a pre-batch API degrades honestly rather than rendering `undefined`.

### A second untruth, caused by B3 itself and removed in it

M-P1 put a global **"Read-only oversight"** badge in the shell's readiness strip. That was true when
every Manager surface was an honest foundation screen that could not write anything. **B3 makes it
false**: Staff onboarding creates real accounts, resets Quick PINs and decides leave — so the badge
would have sat directly above a **New** button.

Read-only is a property of a **surface**, not of the workspace. The badge was removed from the strip
and now lives in each read-only surface's own control panel (the three Operations screens carry it);
Staff carries nothing of the kind. `manager-b3-assertions.ts` enforces both halves, and
`docs/DECISIONS.md` records it as **D-B3-SURFACECLAIM**.

---

## 4. The tension the roadmap asked B3 to resolve: "Operations is read-only" vs "escalations live in Operations"

The roadmap says both, and required this report to settle it explicitly.

**Resolution: Operations ships strictly read-only, and no escalation *write* was built.**

The reasoning:

1. **The roadmap's own condition was not met.** It permits an escalation write only through a
   verified domain DTO, and says plainly: *"If the DTO is not verified, ship the read-only surface
   and defer the write."* The three candidate routes
   (`/pos/discounts/:id/approve|reject`, `/pos/refunds/:id/approve`,
   `/pos/orders/:id/post-close-void`) were **not** live-verified in this phase, and verifying them
   requires mutations against payment-bearing orders — a materially larger blast radius than the
   rest of B3 combined.
2. **The decisions that WERE in scope already have owners.** Leave and shift-swap review are built
   in Staff, where the roadmap puts them. Discount approval is Supervisor's, already shipped and
   verified (Prompt 3B3B), including a UI-only payment-safety gate that Manager would have had to
   reimplement.
3. **A read-only escalation *list* was also not built**, because there is no honest source for one.
   `GET /api/approvals` is only partly branch-scoped (MP0-05 — a live Tapas-scoped read returned 16
   rows spanning **five branches**, including a branch the manager is not a member of), and
   discounts have no branch-wide list beyond `/pending` (SUP-RG-035). A list that silently mixed
   branches would be worse than no list.

So Operations surfaces **operational state** (orders, tables, reservations) and decides nothing.
Approval **counts** remain on Overview, where B2 already sources them from the four canonical
branch-scoped domain endpoints. Building the escalation surface is a candidate for a later phase and
should be preceded by verifying those three DTOs.

---

## 5. The shift-swap outcome, stated explicitly

**Outcome C — reject only. There is no Approve control, and its absence is deliberate.**

`PATCH /api/hr/shift-swaps/:id/approve` accepts `status: APPROVED | REJECTED`, and the seeded
Manager holds `pos:hr:shift-swaps:approve`. An Approve button would return **200**. It would also be
a lie:

- `attendance.service.ts:555-623` mutates the `ShiftSwapRequest` row and writes one audit event.
  Nothing else.
- A repo-wide grep finds **six** `scheduleAssignment` call sites and **all six are reads**
  (`attendance.service.ts:439,454`; `staff-insights.service.ts:293`;
  `workforce.service.ts:425,436,467`). There is no create, update or delete of a roster row anywhere
  in the API.
- The request references only a `shiftDate`, not a specific shift, so there is not even a target to
  reassign.

**Proven live, not asserted:** the mutation matrix counted `schedule_assignments` in Postgres before
and after a real rejection — **3 rows before, 3 rows after, unchanged** — and the
`GET /api/workforce/roster` response was byte-identical.

This follows the Supervisor precedent exactly (SUP-RG-036/042,
`docs/supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`). **Do not add an Approve control without
a roster-mutation service, a specific-shift reference on the request, and explicit authorization.**

---

## 6. The four hard guards, and how each is proven

| Guard | Mechanism | Proof |
| --- | --- | --- |
| **The UI never calls `?view=full`** | No code path can construct it — `buildManagerDirectoryPath` sets no `view` parameter at all | `manager-b3-assertions.ts` greps every file under `components/manager`, `lib/manager` and `pages/manager`; the e2e suite asserts it on every captured `/hr/employees` request |
| **No compensation / salary / bank / `dateOfBirth` / `address` / `emergencyContact*` key anywhere** | `staff-projection.ts` is an **allow-list** — it constructs 14 named fields and never deletes | Assertion script scans all manager files (only the projection and the two *disclosure* surfaces may name the strings, and even there only as prose — never as a property read or an object key). Live e2e proves it on the **wire**, in the **DOM** and in the **serialised page state** |
| **No roster-mutation call** | No `scheduleAssignment` or `/workforce/schedules\|roster\|templates` reference exists; the swap request function's status parameter is the literal `"REJECTED"` | Assertion script + the live before/after row count in §5 |
| **No till/shift list fabrication** | No manager file references `/api/tills` or `/api/shifts` | Assertion script; e2e asserts zero such requests on the floor surface; the Tables screen **discloses** the absence in words |
| **Mutations only for onboarding, quick-pin, leave review, shift-swap reject** | — | Assertion script counts **7** mutations repo-wide across the whole Manager surface (4 Staff groups + the pre-existing B2 KPI refresh) and requires each to target an allow-listed path. Operations is proven to contain **zero** mutations and **zero** `useMutation` hooks |

Additional gates the assertion script enforces: the safe-field set and the forbidden-key set are
disjoint; every list sends an explicit bounded page size; the shared Floor is consumed unforked and
no `components/manager/floor` directory exists; the PIN never enters a cache key, `localStorage`,
`sessionStorage`, a URL or a log (no manager file contains a `console.*` call at all); no
`EventSource` or `text/event-stream` was added (C-04 still open); every query key goes through
`managerQueryKey`; no blanket invalidation or `queryClient.clear()`; neither module polls.

---

## 7. Live API verification (isolated stack)

`b3-api-matrix.mjs`, run against a disposable local Docker `postgres:16` (port 55437), API on
`:4001`, web on `:3100`. **Shared Neon was never touched**; both `.env` files were backed up before
the swap and restored byte-for-byte afterwards (SHA-256 verified — see §10).

**Reads: 27/27 passed.** Selected results, each of which is load-bearing for a B3 design decision:

| Check | Result |
| --- | --- |
| `GET /pos/orders?page=1&pageSize=25` | 200 · 25 rows · **total 298** (the pager's source) |
| `GET /pos/orders/:id` | 200 · `total = subtotal + tax − discount` → `32,000 + 5,800 − 0 = 37,800` (tax-inclusive, as the detail panel states) |
| `GET /pos/orders/:id` from another branch | **404** — branch isolation holds |
| `GET /tables` | 200 · 22 tables |
| `GET /reservations?scope=active` / `?scope=history` | 200 · 15 / 8 |
| `GET /api/tills`, `GET /api/shifts` | **404 / 404** — MP0-02 re-confirmed live, not assumed |
| `GET /hr/employees` (default) | 200 · 40 rows · `view: "safe"` · **zero forbidden keys on the wire** |
| — org scoping | **5 distinct `branchId`s across 40 rows** — confirms the client-side branch filter is necessary |
| `GET /hr/employees?branchId=…` | **400** — MP0-06 re-confirmed; the client must never send it |
| `GET /hr/employees?view=full` **as Manager** | **200, and it returns `compensationProfile`, `baseAmount`, `salaryBasis`, `allowances`, `deductions`, `dateOfBirth`, `emergencyContact*`, `address`, `notes`** — **FU-1 is real**, and this is exactly why the frontend guard matters |
| `GET /hr/leave` | 200 · embeds nested employee `dateOfBirth`, `address`, `emergencyContact*`, `notes` — **confirms the client projection is load-bearing, not decorative** |
| `GET /hr/shift-swaps` | 200 · same nested PII on `requester`/`target` |
| `GET /hr/frontline-staff/:id/quick-pin-status` | 200 · 22 keys · **never returns the PIN** |
| `GET /dash/open-orders` | `count=50` `limit=50` **`total=107`** `truncated=true` — MP0-09 fields present (FU-3) |
| `GET /dash/manager` | **gross 33,014,100 ≥ net 27,978,300**, `gross = net + tax` — the invariant B3-D1's relabel depends on |
| `/dash/manager.openOrders` vs `/dash/open-orders.total` | **107 == 107** (while `count` is 50) |

**Mutation matrix: 12/12 passed** (isolated stack, records tagged `ZZQA`):

| Check | Result |
| --- | --- |
| `POST /hr/frontline-staff/onboard` | **201**, employee created |
| — plaintext PIN returned once | ✅ `pinLength: 6`, `shownOnce: true` (MP0-14) |
| — create echo | ✅ carries **no** compensation or PII (C-02) |
| `POST /quick-pin/reset` | 200, **a different PIN** than the one issued at onboarding |
| `PATCH /quick-pin/disable` | 200 |
| — duplicate disable | 200 with `alreadyDisabled: true` — **idempotent, not an error** |
| `PATCH /quick-pin/enable` | 200 |
| `PATCH /hr/shift-swaps/:id/approve {REJECTED}` | 200 |
| — **roster integrity** | **`schedule_assignments`: 3 before → 3 after. Zero rows changed.** |
| — duplicate decision | **400** — which is why the UI renders terminal rows read-only |
| `PATCH /hr/leave/:id/review` | 200; a second review → **400** (same read-only consequence) |
| — quick-pin-status from another branch | 200 — **org-scoped, not branch-guarded.** Recorded honestly rather than assumed; see §8 finding B3-F2 |

---

## 8. Deferred items, each with its reason

| Item | Reason | Recorded as |
| --- | --- | --- |
| **Operations → Exceptions** | Outside the owner's enumerated B3 scope (Orders, Tables, Reservations). `/analytics/anomalies` is verified and could back it, but adding scope is the owner's call | Menu row tagged **`Deferred`** — deliberately not a phase number, because inventing one would be a roadmap claim this phase has no authority to make |
| **Staff → Attendance timeline** | Same: outside the enumerated scope. `/hr/attendance` is verified but embeds the same nested PII, so it needs the projection extended | Menu row tagged **`Deferred`** |
| **Chatter rail (C6)** | Gated on **B0**, which has not run. `GET /api/audit/timeline`'s shape and permission are unverified | Roadmap B3 already specifies this gate |
| **Escalation writes** | The roadmap's own precondition (a verified domain DTO) is unmet — see §4 | §4 |
| **Escalation read list** | `GET /api/approvals` is only partly branch-scoped (MP0-05); a list mixing five branches would be worse than none | §4 |
| **Smart-button strip on the order record** | One real button beside empty space; no branch-wide payments read for Manager | §2 |
| **Graph / pivot views** | Impossible until `GET /api/reports/:id` returns rows (**C-03 / NG-06**). The view switcher deliberately does **not** advertise them | `ManagerViewSwitcher` doc comment |
| **Supervisor / Manager roles in the onboarding picker** | Creating an account with approval authority is not "frontline onboarding" and was not in the approved scope. **Omitted from the picker, not disabled in it** | `MANAGER_FRONTLINE_ROLES` |

### New findings recorded, none implemented

| ID | Finding | Recommendation |
| --- | --- | --- |
| **B3-F1** | `GET /hr/frontline-staff/:id/quick-pin-status` and the reset/disable/enable routes resolve the employee by `{ id, orgId }` only — **they are org-scoped, not branch-guarded.** A manager can administer the PIN of an employee in a branch they do not manage by knowing the id. Verified live (200 from a second branch) | Backend: add `branchId` to `loadEmployeeForOrg`, matching the shift-swap approve fix. **Not implemented — backend change, out of B3 scope.** The B3 UI only ever lists employees from the selected branch, so it cannot reach one by accident |
| **B3-F2** | **FU-1 is confirmed live**: `?view=full` returns full compensation and PII to a **Manager** token, because the seeded matrix grants `pos:hr:compensation:read` to Owner, Manager and Accountant | Backend/seed: narrow the grant or introduce a distinct permission. **Not implemented — seed/permission change, explicitly unauthorised** |
| **B3-F3** | `POST /api/hr/leave` and `POST /api/hr/shift-swaps` are **self-service only** — a manager cannot file leave on another employee's behalf (403 `"can only create leave for their own linked employee profile"`). Discovered while seeding QA fixtures | Correct as designed; recorded so nobody re-discovers it as a missing feature. The B3 UI offers no create control for either |
| **B3-F4** | The seeded demo dataset leaves **Tapas Downtown with zero PENDING leave requests**, so the decision path cannot be exercised on a fresh stack without QA fixtures | QA-only. The isolated run inserts `ZZQA`-tagged rows; documented in the evidence index |

---

## 9. Files added / changed

### Added — Operations (5 components, 5 lib modules, 4 pages)

```
apps/web/src/components/manager/operations/ManagerOrdersScreen.tsx
apps/web/src/components/manager/operations/ManagerOrderDetailPanel.tsx
apps/web/src/components/manager/operations/ManagerTablesScreen.tsx
apps/web/src/components/manager/operations/ManagerReservationsScreen.tsx
apps/web/src/components/manager/operations/index.ts
apps/web/src/lib/manager/operations-{api,context,model,route,types}.ts
apps/web/src/pages/manager/operations/{index,orders,tables,reservations}.tsx
```

### Added — Staff (9 components, 6 lib modules, 6 pages)

```
apps/web/src/components/manager/staff/ManagerStaffDirectoryScreen.tsx
apps/web/src/components/manager/staff/ManagerEmployeeKanban.tsx
apps/web/src/components/manager/staff/ManagerEmployeeDetailPanel.tsx
apps/web/src/components/manager/staff/ManagerOnboardingScreen.tsx
apps/web/src/components/manager/staff/ManagerOneTimeSecretPanel.tsx
apps/web/src/components/manager/staff/ManagerQuickPinScreen.tsx
apps/web/src/components/manager/staff/ManagerLeaveReviewScreen.tsx
apps/web/src/components/manager/staff/ManagerShiftSwapReviewScreen.tsx
apps/web/src/components/manager/staff/ManagerSensitiveFieldsCard.tsx
apps/web/src/components/manager/staff/index.ts
apps/web/src/lib/manager/staff-{api,context,model,projection,route,types}.ts
apps/web/src/pages/manager/staff/{index,directory,onboarding,quick-pin,leave,shift-swaps}.tsx
```

### Added — shared Manager chrome (B1 primitives finally mounted, plus four new ones)

```
apps/web/src/components/manager/chrome/ManagerListTable.tsx          (Odoo C4 list)
apps/web/src/components/manager/chrome/ManagerStatusPipeline.tsx     (Odoo C14 statusbar)
apps/web/src/components/manager/chrome/ManagerViewSwitcher.tsx       (control-panel view group)
apps/web/src/components/manager/chrome/ManagerRecordActionsMenu.tsx  (Odoo C13 record cog)
```

### Added — QA

```
apps/web/scripts/manager-b3-assertions.ts (+ tsconfig.manager-b3-assertions.json)
apps/web/e2e/manager-operations/{fixtures,orders-list,order-detail,tables-and-reservations,request-counts-and-evidence}.ts(x)
apps/web/e2e/manager-staff/{fixtures,directory-and-privacy,onboarding-and-quick-pin,leave-and-shift-swaps}.ts(x)
```

### Changed

| File | Change |
| --- | --- |
| `lib/manager/routes.ts` | Operations/Staff nav `match` becomes `startsWith` so the module stays highlighted on its sub-routes. **The locked six surfaces are unchanged.** |
| `lib/manager/top-nav.ts` | Operations/Staff menu trees now point at real routes; grouped menus carry the module `match`. Deferred rows tagged `Deferred` |
| `lib/manager/permissions.ts` | `operations` and `staff` `liveFrom` → `"live"` |
| `lib/manager/state.ts` | `managerCaveats.employees` refreshed — the C-02 wire leak is fixed; the org-scoping constraint is what remains |
| `chrome/ManagerControlPanel.tsx` | Chip-search `value`/`onChange` made **optional**: the input renders only when the endpoint has a text search, and is **omitted rather than greyed out** where it does not. Adds `ManagerFilterChip` |
| `shell/ManagerReadinessStrip.tsx` | The workspace-wide **"Read-only oversight" badge removed** — it became false the moment Staff shipped a create action. See §3 |
| `lib/utils/useDebouncedCallback.ts` *(new)* | `/hr/employees?search=` is a real server filter, so writing it to the URL per keystroke would be one request per character. The input stays responsive; only the URL write (and therefore the refetch) is debounced — CLAUDE.md §15 |
| `chrome/index.ts` | Exports the four new primitives |
| `lib/manager/dashboard-{model,types}.ts`, `cards/ManagerSalesTodayCard.tsx`, `cards/ManagerOpenOrdersCard.tsx` | FU-3 + **B3-D1** (§3) |
| `scripts/manager-p1-assertions.ts`, `scripts/manager-b1-assertions.ts` | Updated for the module-directory route shape, with the supersession recorded inline. **The invariants they protect are unchanged** and still enforced for the surfaces that still have the old shape |
| `pages/manager/operations.tsx`, `pages/manager/staff.tsx` | **Deleted** — replaced by module directories whose `index.tsx` redirects |

### Not touched

Backend, Prisma schema, migrations, seed, demo import, permissions, Postman collections, and every
Waiter / Cashier / Supervisor file.

---

## 10. Validation

Every number below was **executed**, not estimated. Full detail — commands, distribution, request
budgets, screenshot inventory — is in `ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md`.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm --filter @nimbus-pos/web typecheck` | **pass** |
| Lint | `pnpm --filter @nimbus-pos/web lint` | **pass** — 0 warnings, 0 errors |
| Production build | `pnpm --filter @nimbus-pos/web build` | **pass** — 8 new routes; the browser suite ran against this build via `next start` |
| Assertion scripts | `npx tsx apps/web/scripts/*-assertions.ts` *(from the repo root)* | **15 passed, 0 failed** |
| Assertion typecheck | `npx tsc -p apps/web/scripts/tsconfig.manager-b3-assertions.json --noEmit` | **pass** |
| Live API matrix | `b3-api-matrix.mjs` | **39/39** — 27 reads + 12 mutations |
| Browser QA | `npx playwright test e2e/manager-operations e2e/manager-staff` | **292 passed (37.5m)** — 0 failed, 0 flaky, 0 skipped |
| Health | `GET http://localhost:4001/api/health` | `{"status":"ok","db":"ok"}` |

**Browser coverage:** 73 tests per viewport across `vp-1024x768`, `vp-1366x768`, `vp-1440x900`,
`vp-1920x1080`. **44 screenshots** captured under `apps/web/e2e/.evidence/manager-b3/` — 36 full-page
(9 surfaces × 4 viewports) plus 8 mid-flow captures at 1440×900 and 1280×680 covering the one-time
PIN (masked and revealed) and the leave review detail and confirmation.

**Load-bearing live proofs** (each one is a design decision, not a smoke test):

- `?view=full` was **never requested** on any captured `/hr/employees` call, and the 20 forbidden
  employee keys are absent from the **wire**, the **DOM** and the **serialised page state**.
- `GET /hr/employees/:id` was **never called**.
- A real shift-swap rejection left `schedule_assignment` at **3 rows before and 3 after**, and
  `/api/workforce/roster` byte-identical — the Outcome C proof (§5).
- The rejection request body contained `REJECTED` and **never** `APPROVED`; no Approve control exists
  in any state.
- Operations issued **zero** mutations, and **zero** `/api/tills` or `/api/shifts` requests.
- The one-time PIN was absent from `localStorage`, `sessionStorage`, the URL and any later page load.
- `/operations/tables` rendered the shared floor's own `data-operational-*` attributes — an unforked
  proof stronger than matching on copy.

⚠️ **Teardown was deliberately deferred.** The isolated stack was handed intact to Track B4, which
owes the teardown and the byte-for-byte `.env` restoration. See §7 of the evidence index — the
pristine `.env` originals are preserved and hash-verified.

---

## 11. Do NOT (carried into CLAUDE.md / CODEX.md)

- Do not add an **Approve** control to shift swaps, a roster-mutation call, or any
  `scheduleAssignment` write (§5).
- Do not send `?view=full`, widen the safe employee projection, or call `GET /hr/employees/:id`
  (its `contracts[]` array is excluded by the locked owner decision even though C-02 made it safe).
- Do not add a mutation to any Operations surface — it is read-only oversight.
- Do not build an escalation write without first verifying the domain DTO, or an escalation list
  from the partly org-scoped `/api/approvals` (§4).
- Do not add a tills or shifts list, a chatter rail (gated on B0), a graph or pivot view (gated on
  C-03), or a Manager floor fork.
- Do not persist, log, cache or URL-encode a one-time PIN.
- **Do not begin B4 (Reporting) or any later Track B phase without explicit owner authorization.**
