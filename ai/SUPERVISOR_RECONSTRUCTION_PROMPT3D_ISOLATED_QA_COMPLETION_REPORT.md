# Supervisor Reconstruction — Prompt 3D

## Isolated QA Database, Browser Automation, Destructive Workflow Validation & Prompt 3 Closure

**Date:** 2026-07-28
**Agent:** Claude (Opus 4.8), highest reasoning effort
**Type:** QA-enablement + closure (no new product capabilities)
**Result:** **B. COMPLETE WITH KNOWN LIMITATIONS** — see §51.

---

## Executive summary

Prompt 3D closed the QA debt that left Prompt 3 at *IMPLEMENTED / QA BLOCKED*. Using
the user's explicit authorization, I stood up an **isolated, disposable stack** — a
local Docker **Postgres 16** (`nimbus_prompt3_qa`, host port 55432), a fresh API on
**:4001**, and the built web app on **:3100** — applied all migrations + `db:seed` +
`db:demo:import`, installed **Playwright + Chromium**, and executed the full
destructive matrix **against the disposable DB only**. **The shared Neon database
received no writes of any kind this pass.**

- **Runtime permissions:** on the isolated DB the Supervisor role holds all 10
  in-scope grants **including `pos:order:transfer`** — so Transfer table works at
  runtime here (the shared-Neon gap from Prompt 3C is purely an unapplied seed).
- **API mutation matrix:** every Prompt 3 action + its rejection cases + idempotency
  replays pass (41-check script; 3 initial items were harness/expectation issues,
  all reconciled below).
- **Defect found & fixed:** the discounts-list read (`?pageSize=N`) returned **400**
  (query numbers not coerced) — the exact read the Supervisor **Discounts panel**
  uses, so the panel read was broken at runtime. Fixed with a one-line-pattern DTO
  change + a focused Jest spec. Verified 200 + complimentary metadata now round-trips.
- **Browser QA:** Playwright across **four viewports** (1024×768 / 1366×768 /
  1440×900 / 1920×1080) — auth, Floor + 4-tab nav (no Orders), Find order, workspace
  actions, Request bill through the UI, legacy-route redirect, role boundaries,
  responsive overflow, Waiter/Cashier regression.

Residual non-blocking limitations (payment-safety is a UI-only boundary, backend
self-approval is permitted, transfer-server API/permission coupling, transfer-table
warns-not-blocks on occupied targets) keep the honest classification at **B**, not A.

---

## 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). Stale path not used.

## 2. Initial git status
Branch **main**; extensive uncommitted work preserved. No reset/restore/stash/clean/
checkout/commit/push. 12 intentional Floor deletions present; all Prompt 3 files present.

## 3. Isolated database decision (§6 Path B — local Postgres)
- Docker available (v29.2.0) with unrelated `cinemax-*` containers (**left untouched**).
- Chose a **disposable local Postgres 16 container**: `nimbus-p3d-qa`, DB
  `nimbus_prompt3_qa`, host **55432** (cinemax uses 5434 — no conflict). Throwaway
  password passed inline (never written to a tracked file).
- Redacted identity: `postgresql://postgres:***@localhost:55432/nimbus_prompt3_qa`.

## 4. Proof the shared Neon DB was NOT mutated
Every migrate/seed/demo-import/API process was launched with `DATABASE_URL` pointed
at `localhost:55432`. The isolated API booted in ~150ms with **no Neon cold-start
retry** (the shared-Neon boots log a cold-start retry), confirming it used the local
DB. No script wrote to the Neon host. The Prompt 3C classifier block on Neon writes
was never circumvented.

## 5. Migration + seed results
- `prisma migrate deploy` → **All migrations applied** (full history through BG7).
- `db:seed` → exit 0 (idempotent base seed: 6 role users, roles, permissions,
  role-permission matrix incl. the Supervisor→`pos:order:transfer` mapping).
- `db:demo:import --write` → exit 0 (13 users incl. `supervisor@nimbus.demo`, 40
  employees, 119 menu items, 1198 orders, 750 payments, 125 reservations — realistic
  demo dataset for QA).

## 6. Runtime permission results
Direct DB read AND `/auth/me` on the isolated API confirm Supervisor holds all 10:
`pos:orders:read/write/void`, `pos:order:split/merge/move-items/transfer`,
`pos:discount:request/read/approve` — **LACKS: none**. Login **201**;
`HAS_TRANSFER=true`; branch `cb27be401a2c35dfc0d4e610`.

## 7. Browser tooling installed
`@playwright/test` added as a **devDependency** of `@nimbus-pos/web` (pnpm), Chromium
downloaded (both steps exit 0). Config: `apps/web/playwright.config.ts` — 4 viewport
projects, env-driven base URLs/credentials (no hard-coded secrets), screenshots +
traces on failure to a git-ignored evidence dir.

## 8. Services / ports
| Service | Port | DB | Health |
|---|---|---|---|
| Isolated API (`node dist/main.js`) | 4001 | local 55432 | `/api/health` → `{status:ok, db:ok}` |
| Isolated web (`next start`, built with `NEXT_PUBLIC_API_BASE_URL=:4001`) | 3100 | via API | `/login` → 200 |
| Disposable Postgres 16 (Docker `nimbus-p3d-qa`) | 55432 | — | `pg_isready` OK |
CORS: `API_CORS_ORIGINS=http://localhost:3100`. All three role logins → 201.

## 9. QA data created
Via safe API paths only, marker `P3D-QA-<timestamp>` (notes/reason). ~24 transient
DINE_IN/TAKEAWAY orders + multiple discounts on the **disposable DB**. IDs recorded in
`ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`. Demo seed/import were **not** modified
to fabricate scenarios.

## 10–25. Live API mutation matrix (executed against the isolated stack)
41-check script (`request-bill` … `complimentary`). **Result: all in-scope actions,
rejection cases, and idempotency replays PASS.** Highlights:

| Action | Evidence |
|---|---|
| Request bill | SENT→success 200; duplicate 200 (safe); VOIDED→409 |
| Mark served | send→in-kitchen→ready→**SERVED** 200; NEW→409 (invalid) |
| Split bill EQUAL | 200, 2 groups, **allocated == total (44000)**; idempotent replay same |
| Split bill CUSTOM | valid 200; **mismatch → 400** |
| Split items | child order created; **idempotent replay → same child**; qty-too-high → 400 |
| Move items | source→target 200; same-order → 400; idempotent replay 200 |
| Merge | source **VOIDED**, mergedIntoOrderId=target; self-merge → 400 |
| Transfer table | 200, newTableId set (**perm GRANTED**); same-table → 400; idempotent replay 200; VOIDED source → 409 |
| Lookup | exact 200; bounded list `pageSize=25` → 25 rows; missing → 404; **tableless TAKEAWAY** created + readable |
| Active Void | 200 → VOIDED; repeated → 409 |
| Discount % / FIXED | 201 auto-APPROVED within threshold; total reduced, discount applied |
| Discount validation | value 0 → 400; % 150 → 400 |
| Discount PENDING | FIXED 160000 (> threshold 150000) → **PENDING**; total unchanged while pending |
| Approve | 200 → APPROVED, **totals recalculated**; duplicate approve → 409 |
| Reject | 200 → REJECTED, **total UNCHANGED**; missing reason → 400 |
| Self-approval | permitted by backend (200); documented governance limitation |
| Complimentary | 201; **metadata `{complimentary,category}` persists + round-trips**; total floors at 0 |

Three initial "failures" reconciled:
1. **mark-served** — harness skipped `in-kitchen`; with the real state path
   (send→in-kitchen→ready→mark-served) it **passes** (final status SERVED).
2. **FIXED > subtotal** — the **backend does not reject it** (201 PENDING); the UI is
   the cap. On approve the effective discount is **capped at subtotal so the total
   floors at 0 — never negative** (financial integrity holds). Documented UI-only
   boundary, not a defect.
3. **complimentary metadata `{}`** — caused by the discounts-read 400 (defect #34),
   not a persistence gap. After the fix, metadata round-trips (see §34).

## 12/17. Transfer safety review (§12)
Confirmed on the isolated DB that `transfer-table` **only moves `order.tableId`** and
the backend does **not** validate target occupancy/reservation/capacity or change
table status (a transfer to an occupied/reserved table returns 200). The
Supervisor UI (Prompt 3B2) surfaces occupied/reserved targets as **honest
non-blocking warnings** and never claims a guarantee the backend lacks. This is a
**documented design choice, not a data-corruption defect** (only the order's table
pointer moves; totals/items are untouched, nothing goes negative, the state is
operationally recoverable). No unsafe *irrecoverable* outcome was observed, so **no
code change was made** — the warn-not-block behavior is preserved and documented as a
known limitation (SUP-RG, KNOWN_LIMITATIONS). Adding a hard block would change a
locked 3B2 design decision and is left for explicit product approval.

## 26. Financial integrity
Totals stayed canonical after every mutation: `discount` reduces `total`; approve
recalculates, reject leaves unchanged; PENDING never changes totals pre-approval;
**no total went negative** (100%/over-subtotal discounts floor at 0). Payment state
stayed read-only in every Supervisor path.

## 27. Shared Floor parity
Verified in code (`SupervisorFloorScreen` renders the shared
`@/components/floor/OperationalFloor`, "never forks") and in the browser: the Waiter
and Supervisor Floors render the same toolbar/grid/table-card presentation; the
Supervisor-only **Find order** control is a sibling above the shared Floor.

## 28/29. Cross-role regression (browser)
- **Waiter:** lands on Waiter Floor (Floor/Reservations/Me); **no Find order / no
  Supervisor actions**; cannot reach the Supervisor workspace (guard renders
  "Supervisor access required").
- **Cashier:** lands on Cashier Queue; nav Queue/Receipts/Till/Me; surfaces load; no
  Supervisor controls.

## 30. Browser QA + 34/43. Playwright results
Suite: `apps/web/e2e/supervisor-prompt3/` — floor, workspace-actions, find-lookup,
role-boundaries, responsive, regression. **16 tests × 4 viewport projects = 64/64
PASSED** (4.6m, 0 failed, 0 flaky). Covered per viewport (1024×768, 1366×768,
1440×900, 1920×1080): Supervisor login → Floor; 4-tab nav with **no Orders**; shared
Floor toolbar+grid; **Find order** opens/dismisses; workspace shows in-scope actions
and **no** payment-collect/close/refund/post-close controls; **Request bill** fires +
settles cleanly (no permanent pending, no page errors); legacy `/supervisor/orders`
(+`?tableId=`) **redirects into Floor**; Waiter/Cashier cannot see Supervisor
controls; Waiter is **blocked** from the Supervisor workspace (access-required state);
**no horizontal overflow** on Floor / workspace / Find-order dialog at any viewport;
Waiter Floor + Cashier Queue/Receipts/Till load without regression.

## 34/35. Defects found & fixes made
1. **[FIXED — backend] Discounts-list pagination 400.**
   `GET /api/pos/orders/:id/discounts?pageSize=N` (and `?page=N`) returned **400**
   ("pageSize must be an integer number") because `ListOrderDiscountsQueryDto` typed
   `page`/`pageSize` as `number` with `@IsInt` but **no `@Type(() => Number)`** — the
   global ValidationPipe transforms but doesn't implicitly convert query strings. The
   Supervisor Discounts panel calls this exact endpoint with `?pageSize=50`, so the
   panel read (list + Approve/Reject on PENDING rows + complimentary metadata) was
   **broken at runtime**. **Fix:** added `@Type(() => Number)` to both fields
   (mirrors `list-orders-query.dto.ts`). Now returns **200**; complimentary metadata
   round-trips. **Focused Jest spec added** (`list-order-discounts-query.dto.spec.ts`,
   6 tests, pass). No contract change (the param was always documented), so no Postman
   change.
2. **[test-only] mark-served / FIXED-over-subtotal / complimentary-read** — harness
   or expectation issues, reconciled above; no product change.

## 36/37. Files created / modified
**Created (kept, maintainable):**
- `apps/api/src/modules/discounts/dto/list-order-discounts-query.dto.spec.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/supervisor-prompt3/{fixtures.ts,floor.spec.ts,workspace-actions.spec.ts,find-lookup.spec.ts,role-boundaries.spec.ts,responsive.spec.ts,regression.spec.ts}`
- `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3D_ISOLATED_QA_COMPLETION_REPORT.md` (this file)
**Modified:**
- `apps/api/src/modules/discounts/dto/list-order-discounts-query.dto.ts` (the fix)
- `.gitignore` (Playwright artifacts / `.env.p3dqa`)
- Docs: `ai/AI_STATUS.md`, `PROGRESS.md`, `docs/TESTING_AND_QA.md`,
  `docs/KNOWN_LIMITATIONS.md`, `docs/ROLE_CAPABILITY_MATRIX.md`, `docs/DECISIONS.md`,
  `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md`,
  `ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`.
**Removed:** none.

## 38. Dependency changes
`@playwright/test` added as a **devDependency** of `apps/web` (+ Chromium binary).
No production dependency changed.

## 39/40. Backend / Postman changes
Backend: the single DTO transform fix + its spec. **No** Prisma schema, migration,
permission identifier, or role-grant change. **Postman: unchanged** (no contract change).

## 44–47. Static gates + API health
| Gate | Result |
|---|---|
| `@nimbus-pos/web typecheck` | **PASS** (0) |
| `@nimbus-pos/web lint` | **PASS** (0) |
| `@nimbus-pos/web build` | **PASS** (Compiled successfully) |
| API `list-order-discounts-query.dto.spec.ts` (Jest) | **PASS** (6 tests) |
| API `orders.service.spec.ts` (Jest) | **PASS** (26 tests) |
| Isolated `/api/health` | **ok / db:ok** |
| `git diff --check` | clean |
| Postman JSON | 53/56 valid (+3 pre-existing BOM); **unchanged** |
| Playwright | **64/64** across 4 viewports |

## 48. QA record register
`ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md` updated (Prompt 3D section; transient
records live on the disposable DB, destroyed at cleanup).

## 49. Cleanup
Prompt 3D API/web processes stopped; disposable Postgres container removed;
temporary inline credentials never persisted to tracked files; Playwright config +
specs retained (maintainable); evidence (screenshots/traces/report) git-ignored;
shared dev processes unaffected. Final `git status` recorded below.

## 50. Remaining limitations (non-blocking)
1. **Transfer-table warns-not-blocks** on occupied/reserved targets (backend moves
   `order.tableId` only; no occupancy/reservation validation). Documented; recoverable.
2. **Payment safety is a UI-only boundary** — void/discount/approve/complimentary
   endpoints don't self-check payment; the UI blocks money-attached orders (fail-closed).
3. **Backend permits discount self-approval** (no maker-checker); UI flags it.
4. **`pos:order:transfer` gates both transfer-table and transfer-server**; transfer-server
   is API-reachable with **no UI** (Outcome B).
5. **Shared Neon still lacks the `pos:order:transfer` mapping** — apply `db:seed`
   there before a Neon-backed demo (the isolated DB proves the mapping is correct).

## 51. Final Prompt 3 status
**B. COMPLETE WITH KNOWN LIMITATIONS.** All critical Supervisor workflows pass under
live destructive API QA and authenticated four-viewport browser QA on an isolated
stack; one real runtime defect (discounts pagination) was found and fixed with a test;
the residual items above are documented, non-blocking boundaries.

## 52. Readiness for Reservations Prompt 4A
Ready to consider — **not started** (out of scope). Recommended pre-demo on Neon:
apply `db:seed` (transfer mapping) to the shared DB.

## 53. No commit / no push
**Confirmed** — no commit, no push, no reset/restore/stash/clean. Shared Neon
untouched. Disposable DB + processes cleaned up.
