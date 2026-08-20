# TESTING_AND_QA.md — Nimbus POS

> How to validate the app and run authenticated QA. Demo accounts are sourced from
> the seed/demo-import (`packages/db/prisma/demo-import.ts`, `demo-data/csv/*`).

> **Supervisor final closure QA (2026-07-31).** Confirms the local-Docker-Postgres path is the
> correct default for **any** sustained browser-automation run, not just Prompt 4D's reservations
> suite: a disposable Neon branch was tried first for the full 4-viewport Prompt 3+4+5 Playwright
> suite and produced 20–27s/test round-trips plus a Windows Chromium
> `STATUS_STACK_BUFFER_OVERRUN` worker-crash cascade after roughly 10–30 tests. Switching to a
> local Docker Postgres (`postgres:16`, a fresh port, migrated + seeded + demo-imported) dropped
> round-trips to 2–5s/test and all four viewports completed cleanly (262/264 executed passed, 0
> unresolved failures — see `ai/SUPERVISOR_FINAL_QA_EVIDENCE_INDEX.md`). Two Chromium stability
> flags (`--disable-gpu --disable-software-rasterizer --disable-dev-shm-usage`) were also added to
> `playwright.config.ts`'s `use.launchOptions.args` as a durable, low-risk mitigation for this
> class of host. **Prisma-CLI isolation note:** unlike the NestJS API (where an inherited shell
> env var overrides a swapped `.env`, per the Prompt 4C/4D lesson below), the **Prisma CLI**
> resolves `DATABASE_URL` from the `.env` file next to `schema.prisma` regardless of an inline
> shell override — the opposite failure direction. To target a disposable database with
> `prisma migrate`/`db:seed`/`db:demo:import` without editing the committed `.env`, use
> `npx dotenv-cli -e <git-ignored-scratch-file> -o -- <command>` (the `-o` override flag is
> required). Verify with `prisma migrate status` before any write — it prints the resolved
> datasource host/db name, so a wrong target is caught before it can mutate anything.

> **Approvals isolated live QA (Prompt 5A, 2026-07-30).** Reuse the Prompt 4D fail-closed launcher
> (`tools/qa/run-isolated-api.mjs` → denylist → DB-identity preflight → spawn `apps/api/dist/main.js`)
> against a **disposable Neon branch** (fork production, add a `_p4d_qa_sentinel` marker row, put the
> connection string in a git-ignored scratchpad secret). Then run `tools/qa/approvals-live-matrix.mjs`
> (env: `PW_API_URL`, `PW_BRANCH_ID`, `QA_SUP_EMAIL/PASSWORD`, `QA_XBRANCH_SWAP_ID`,
> `QA_XBRANCH_ANOMALY_ID`, `QA_DISCOUNTABLE_ORDER_ID`) — covers all four decision lifecycles,
> pagination-400, History windows, required-reason, **branch-isolation 404** (same-org other-branch),
> and duplicate/concurrency 409/400. Browser smoke: `apps/web/e2e/supervisor-approvals/smoke.spec.ts`
> against `next dev` built with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4002` on the CORS-allowed
> `:3101`. Prompt 5A result: **matrix 29/29 + Playwright 8/8 (4 viewports)**; shared `production`
> verified untouched. Never run mutation QA against shared Neon.
>
> **Approvals UI browser QA (Prompt 5B1, 2026-07-30).** Same isolated stack. The full Approvals
> suite is `apps/web/e2e/supervisor-approvals/` (10 spec files + `approvals-fixtures.ts`); run all
> four viewport projects with `PW_BASE_URL=http://localhost:3101 PW_API_URL=http://localhost:4002
> PW_BRANCH_ID=<demo> PW_SUPERVISOR_EMAIL/PASSWORD ... npx playwright test e2e/supervisor-approvals`.
> Notes: the scale-to-zero disposable compute cold-starts on idle — use the **pooled** endpoint
> (`-pooler`, `pgbouncer=true`, `connect_timeout`), a health **keep-warm pinger**, and `--retries=2`
> to absorb transient first-hit login latency (external, not a UI defect). Seed decision data via
> **SQL on the disposable branch** (leave/discount PENDING rows on existing unpaid discountable
> orders) — do **not** rely on `POST /pos/orders` (pre-existing order-number collision on a populated
> branch, SUP-RG-040). Prompt 5B1 result: **80/80 (10 files × 4 viewports)**; shared `production`
> verified untouched (0 QA rows, sentinel absent); disposable branch deleted.
>
> **Approvals closure QA (Prompt 5B2, 2026-07-31).** Same isolated stack; full suite now 15 files
> (5B1 + shift-swap-reject / anomaly-acknowledge-resolve / all-domains-consolidated /
> cross-role-visibility / responsive-closure). Seed shift-swap PENDING + anomaly OPEN & ACKNOWLEDGED
> (+ discount/leave PENDING for regression) via SQL. **Anomaly specs deep-link to a seeded id by status
> (`apiFirstAnomalyId` + `openApprovalDetail`)** rather than depending on queue order — the severity
> sort otherwise pushes OPEN rows past a fixed scan window. Run the live API matrix by curl (shift-swap
> reject/dup/bound + anomaly ack/resolve/dup/stale) and **prove roster integrity** by confirming
> `schedule_assignments` rows touched = 0 after a reject (there is no roster-write path). Prompt 5B2
> result: API matrix **11/11**, roster 0-touched, full Playwright suite × 4 viewports executed; shared
> `production` untouched; branch deleted.

## Required commands (web app)

```bash
corepack pnpm@8.15.0 --version                         # expect 8.15.0
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev      # dev server on :3000
```

The web app has a Playwright browser suite (Supervisor Prompt 3/4/5 + **Cashier Floor
C1**; see the harness sections below) but no Jest unit tests yet (`test` is a stub).
Static and behavioral guards live in `apps/web/scripts/*-assertions.ts` (floor/shell/
profile/prompt3a/**cashier-c1**). Run them from the repo root with tsx:

```bash
npx tsx apps/web/scripts/floor-assertions.ts
npx tsx apps/web/scripts/shell-assertions.ts
npx tsx apps/web/scripts/profile-assertions.ts
npx tsx apps/web/scripts/prompt3a-assertions.ts   # Supervisor 3A: idle parity,
   # action availability, canonical order wiring, confirmation a11y, idempotency intent
npx tsx apps/web/scripts/prompt3b1-assertions.ts  # Supervisor 3B1: split/move/merge
   # availability gating, EQUAL/CUSTOM allocation math, line validation, bounded target selector
npx tsx apps/web/scripts/prompt3b2-assertions.ts  # Supervisor 3B2: transfer-table
   # target-selector bounds/exclusion/non-blocking warnings, URL re-anchor, Find order bounded
   # lookup + status filters + id fallback, tableless/terminal handling, legacy-redirect paths
npx tsx apps/web/scripts/prompt3b3a-assertions.ts # Supervisor 3B3A: void + discount-request
   # availability gating (payment-gated in UI only), void eligible statuses, discount subtotal
   # basis + threshold-estimate deferral + single-pending guard, narrow invalidation, read-only panel
npx tsx apps/web/scripts/prompt3b3b-assertions.ts # Supervisor 3B3B: discount approve/reject +
   # complimentary — inline PENDING-row approve/reject gating (approve payment-gated, reject not),
   # rejectionReason required, whole-order 100% complimentary + metadata, threshold PENDING/APPROVED,
   # self-approval permitted+flagged, narrow discount-approvals invalidation
```

### Supervisor order-action endpoint QA (Prompt 3A)

Authenticated, against a running API (supervisor demo account, `pos:orders:write`):
- `POST /api/pos/orders/:id/request-bill` (no body) → 200 `billRequested:true`;
  duplicate → 200; on a CLOSED/VOIDED order → 409.
- `POST /api/pos/orders/:id/mark-served` on a non-READY order → 409 (invalid
  transition); on a READY order → 200 `status:"SERVED"`.
Mark served mutates one order to SERVED — treat as expected QA-created data.

### Supervisor handoff-action endpoint QA (Prompt 3B1)

Authenticated (supervisor demo account now has `pos:order:split/merge/move-items`):
- `split-bill` EQUAL count=3 → 200, `splitGroups` length 3, `amountAllocated`==total,
  `amountRemaining` "0.00"; replay with the same `Idempotency-Key` → 200; CUSTOM with
  groups not summing to total → 400 `SPLIT_BILL_AMOUNT_MISMATCH`.
- `split-items` → 200 with a NEW `childOrder` (`ORD-…-S1`); idempotent replay returns
  the same child.
- `move-items` → 200 (source/target item counts change); same source/target → 400.
- `merge` → 200 (source `VOIDED`, `mergedIntoOrderId` = target); self-merge → 400;
  source with completed/pending payments → 409 `MERGE_SOURCE_HAS_PAYMENTS`.

These mutate demo orders (a split-bill metadata record, a child split order, a moved
line, and a voided merged source) — expected QA-created data. Merge and move can
empty/void source orders; use clearly identified demo orders.

### Supervisor transfer-table + Find order QA (Prompt 3B2)

Static gates **passed**: web typecheck, lint (no warnings), production build, and
`npx tsx apps/web/scripts/prompt3b2-assertions.ts` (target-selector bounds/exclusion/
non-blocking warnings, URL re-anchor, Find order bounded lookup + status/id-fallback,
tableless/terminal/legacy-redirect handling). No backend logic change (only the
`packages/db/prisma/seed.ts` permission mapping granting Supervisor
`pos:order:transfer`; requires re-seed to apply).

**Live/browser QA is PENDING** (no API/DB/browser automation available in this
environment; API not listening on `:3001`). When run authenticated (supervisor demo
account with `pos:order:transfer`):
- `POST /api/pos/orders/:id/transfer-table` body `{ targetTableId, reason? }` → 200,
  order `tableId` == target; backend does **not** validate target occupancy/capacity
  and does **not** change table status. Idempotency-Key attached (BG3 optional).
- `GET /api/pos/orders` bounded page (pageSize 25) with `excludeStatus=CLOSED,VOIDED`
  (Active) / status / serviceType filters, and `GET /api/pos/orders/:id` id fallback →
  Find order opens takeaway/tableless/closed/voided/exception orders; terminal orders
  open read-only. Prompt 3B1 browser QA also remains pending.

### Supervisor void + discount request QA (Prompt 3B3A)

Static gates **passed**: web typecheck, lint (no warnings), production build, and
`npx tsx apps/web/scripts/prompt3b3a-assertions.ts` (payment-gated availability, void
eligible statuses, discount subtotal basis + threshold-estimate deferral +
single-pending guard, narrow invalidation, read-only Discounts panel). **No permission
and no backend change** — Supervisor already held `pos:orders:void`,
`pos:discount:request`, `pos:discount:read`, `pos:discount:approve`; `seed.ts` was not
modified. Void/discount API contracts are unchanged, so no Postman change (M10 already
carries a void request; M12-Discounts-Approval-Workflow already covers discounts).

**Live/browser QA is PENDING** (no API/DB/browser automation available; API not on
`:3001`). Also pending: `GET /api/health` and the Jest API suite. When run
authenticated (supervisor demo account):
- `POST /api/pos/orders/:id/void` body `{ reason }` on a NEW/SENT/IN_KITCHEN/READY order
  → 200, `status:"VOIDED"` (items/totals unchanged; idle DINE_IN table auto-released).
  SERVED → 409 (can only close); CLOSED/VOIDED → rejected. Not BG3-wrapped; no manager PIN.
- `POST /api/pos/orders/:id/discounts` body `{ type, value, reason }` on a NEW/SENT/
  IN_KITCHEN/READY order → 201; amount within the org threshold (default 5000) returns
  status `APPROVED` (totals mutate) else `PENDING`. PERCENTAGE 0.01–100; FIXED ≥0.01 and
  (UI) ≤ subtotal. SERVED is not discountable.
Void mutates one order to VOIDED and a discount may mutate totals — treat as expected
QA-created data on clearly identified demo orders.

### Supervisor discount approve/reject + complimentary QA (Prompt 3B3B)

Static gates **passed**: web typecheck, lint (no warnings), production build, and
`npx tsx apps/web/scripts/prompt3b3b-assertions.ts` (inline PENDING-row approve/reject
gating — approve payment-gated, reject not; `rejectionReason` required; whole-order 100%
complimentary + metadata; threshold PENDING/APPROVED; self-approval permitted+flagged;
narrow discount-approvals invalidation). **No permission and no backend change** —
Supervisor already held `pos:discount:approve`/`pos:discount:request`; `seed.ts` was not
modified. No Postman change (M12-Discounts-Approval-Workflow already covers approve+reject;
complimentary reuses the existing discounts create); 56/56 collection JSON still valid.

**Consolidated live/browser QA for Prompts 3B1–3B3B is PENDING** (no API/DB/browser
automation available; API not on `:3001`). Also pending: `GET /api/health` and the Jest
API suite. When run authenticated (supervisor demo account):
- `POST /api/pos/discounts/:id/approve` on a **PENDING** discount whose order is still
  discountable (NEW/SENT/IN_KITCHEN/READY) → 200; recalcs order totals (latest approved
  wins). Non-PENDING → 409; SERVED/terminal order → 409. Optional `{ managerPin? (<=8) }`
  re-auths the approver's own quick-PIN (sets `managerPinVerified`); UI does not collect it.
- `POST /api/pos/discounts/:id/reject` body `{ rejectionReason (required, <=500) }` on a
  PENDING discount → 200, status `REJECTED`; order totals unchanged.
- Complimentary → `POST /api/pos/orders/:id/discounts` with `type=PERCENTAGE, value=100`,
  a required reason, and `metadata { complimentary:true, category }` → 201; amount vs the
  org threshold (default 5000) decides APPROVED vs PENDING (whole-order only).
Approve and complimentary mutate totals — treat as expected QA-created data on clearly
identified demo orders.

## API & health

```bash
# Prebuilt dist is the quiet/reliable path (from apps/api):
node dist/main.js                 # API on http://localhost:3001, prefix /api
# or: corepack pnpm@8.15.0 dev:api
curl http://localhost:3001/api/health     # -> {"status":"ok","db":"ok",...}
```

Only **one** API process on `:3001` at a time. Cold boot takes ~10s+; Neon
latency is external (see `docs/KNOWN_LIMITATIONS.md`). If new-milestone endpoints
500 while old ones work, the running process is stale — kill node and restart
(`AGENTS.md` Rule P2).

## Demo accounts

All password logins use password **`Demo1234!`**. Quick PIN login is **per-branch**
(`POST /api/auth/quick-pin-login` with `branchId` + `pin`). `POST /api/auth/login`
returns **HTTP 201** (a Session is created).

| Role | Email | Password | Quick PIN |
| --- | --- | --- | --- |
| Owner | `owner@nimbus.demo` | Demo1234! | — |
| Manager | `manager@nimbus.demo` | Demo1234! | 11223344 |
| **Supervisor** | `supervisor@nimbus.demo` | Demo1234! | 22334455 |
| **Cashier** | `cashier@nimbus.demo` | Demo1234! | 135790 |
| **Waiter** | `waiter@nimbus.demo` | Demo1234! | 246810 |
| Accountant | `accountant@nimbus.demo` | Demo1234! | — |
| Chef | `chef@nimbus.demo` | Demo1234! | 357913 |
| Bartender | `bartender@nimbus.demo` | Demo1234! | 468024 |
| Stock Manager | `stockmanager@nimbus.demo` | Demo1234! | 579135 |
| Procurement | `procurement@nimbus.demo` | Demo1234! | — |
| Event Manager | `eventmanager@nimbus.demo` | Demo1234! | — |
| Franchise Ops | `franchise.ops@nimbus.demo` | Demo1234! | — |
| KDS Screen | `kds.demo@nimbus.demo` | Demo1234! | — |

> Discrepancy to note for QA: `demo-data/csv/02_users.csv` lists the supervisor PIN
> tier as `LOW_6`, but `demo-import.ts` issues an 8-digit PIN (`22334455`). Treat
> `demo-import.ts` as authoritative for what is actually provisioned.

## Viewport matrix (authenticated visual QA)

Run each role's screens at: **1024×768, 1366×768, 1440×900, 1920×1080.**

- **Waiter:** Floor · selected Available table · selected owned table · Reservations · Me.
- **Cashier:** Floor · selected-table settlement boundary · Till · Me (Prompt C1 implemented
  2026-07-31; default `/cashier/floor`). Queue/Receipts are hidden compatibility routes (direct
  URL only). The full target test plan (Find bill, table-to-order resolution, payment/split/close/
  receipt/refund matrices) is `docs/cashier-ui-docs/CASHIER_TEST_PLAN.md` — those cover the
  not-yet-built C2–C6 settlement workspace; the executed C1 browser suite is
  `apps/web/e2e/cashier-floor/` (see the Cashier Floor C1 harness section above). See
  `ai/CASHIER_FLOOR_RECONSTRUCTION_TEST_INVENTORY.md` for the current-vs-target test gap.
- **Supervisor:** Floor · selected table workspace · Reservations · Approvals · Me ·
  legacy Orders redirect state.

Check per screen: header/clock/logout consistency, role identity, branch/workstation/
service-area placement, nav icons + active state, content offsets & bottom-nav
clearance, no horizontal overflow, card dimensions, table identifiers, staff-name
formatting (`First L.`), loading/empty/warning states, focus styling, contrast,
button pending states, drawer/dialog clipping, no stale copy, no duplicate mounted
responsive variants.

## Postman validation

```bash
# All 56 collections parse (3 carry a legacy UTF-8 BOM that Postman/newman tolerate).
# Run one collection with newman:
npx --yes newman run "postman/collections/<file>.postman_collection.json" \
  --reporters json --reporter-json-export _newman_<id>.json
```

Then confirm `run.stats.assertions.failed === 0`, `run.stats.requests.failed === 0`,
`run.failures.length === 0`. Postman conventions (base URL, dual-scope variable
writes, login asserts 201) are governed by `AGENTS.md` and
`docs/POSTMAN_ENDPOINT_GUIDE.md`.

## Performance regression checks

Confirm no reintroduced: duplicate `/api/auth/me`, duplicate shell/readiness
queries, duplicate timers, Floor/reservation request storms, responsive double
mounts, broad invalidation, blocked mutation settlement, full-page loading for
ordinary actions. Cashier startup should stay ~9 requests (not ~101).

## Destructive-data rule

Do **not** run migrations, reseed, or mutate demo data during onboarding/QA passes.
Do not perform destructive operational mutations (payments, closes, voids, refunds)
during authenticated regression QA.

**The shared Neon database is NOT for destructive QA.** For any destructive/mutation
QA, use an **isolated disposable database** (see the Playwright harness below).

## Playwright E2E harness (Supervisor Prompt 3D)

A maintainable browser-QA harness lives at `apps/web/playwright.config.ts` +
`apps/web/e2e/supervisor-prompt3/` (specs: floor, workspace-actions, find-lookup,
role-boundaries, responsive, regression). `@playwright/test` is a **web devDependency**.

- **Four viewport projects:** 1024×768, 1366×768, 1440×900, 1920×1080.
- **Env-driven, no hard-coded secrets:** `PW_BASE_URL`, `PW_API_URL`, `PW_BRANCH_ID`,
  and `PW_{SUPERVISOR,WAITER,CASHIER}_{EMAIL,PASSWORD}` (defaults target the local demo).
- **Artifacts git-ignored:** `apps/web/{test-results,playwright-report}`,
  `apps/web/e2e/.evidence/` (screenshots/traces on failure).

**Recommended isolated stack (used by Prompt 3D):**
1. Disposable Postgres (Docker `postgres:16`) on a non-conflicting port, e.g.
   `docker run -d --name nimbus-p3d-qa -e POSTGRES_PASSWORD=… -e POSTGRES_DB=nimbus_prompt3_qa -p 55432:5432 postgres:16`.
2. `DATABASE_URL=…localhost:55432/nimbus_prompt3_qa` → `prisma migrate deploy` +
   `db:seed` (+ `db:demo:import --write` for a Supervisor login + realistic orders).
3. API: `API_PORT=4001 API_CORS_ORIGINS=http://localhost:3100 node dist/main.js`.
4. Web: build with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4001`, then
   `next start -p 3100`.
5. `pnpm --filter @nimbus-pos/web exec playwright test` (optionally `--project=vp-1440x900`).
6. Tear down: stop processes, `docker rm -f nimbus-p3d-qa`.

Destructive API mutation checks can also be scripted directly against the isolated
API (Node `fetch`) — every Prompt 3 action + rejection case + idempotency replay.
**Never point these at shared Neon.**

## Playwright E2E harness (Manager shell — Prompt M-P1, 2026-08-20)

Manager M-P1 adds `apps/web/e2e/manager-shell/` — **4 spec files, 23 tests × the four viewport
projects = 92 tests** (executed 2026-08-20: **92 passed / 0 failed**), under the same
`apps/web/playwright.config.ts` and the same env-driven credential pattern
(`PW_MANAGER_EMAIL` / `PW_MANAGER_PASSWORD` / `PW_MANAGER_SECOND_BRANCH_ID`, defaulting to the
seeded disposable demo values). Specs:

- `navigation-and-landing.spec.ts` — manager login lands `/manager/overview`; the bottom nav is
  exactly the six locked tabs (no More, no Approvals); every tab navigates and sets `aria-current`;
  `/manager` redirects; foundation pages state the boundary instead of showing fabricated data.
- `branch-switcher.spec.ts` — the switcher lists the four ACTIVE memberships and is accessibly
  labelled; a selection persists to `localStorage` and survives reload **and** route change;
  **request capture proves `X-Branch-Id` changes on subsequent reads** and that `/api/auth/me` is
  NOT re-issued; the readiness strip re-scopes and never renders a Tills/Shifts chip.
- `role-boundaries.spec.ts` — waiter/cashier/supervisor are blocked from `/manager/*`;
  `/login?reason=manager_only` states the boundary; a manager is blocked from
  `/waiter|/cashier|/supervisor` by those roles' own guards; no manager tab exposes a write action.
- `shell-parity.spec.ts` — Manager renders the shared shell regions and brand logomark, no tab
  overflows horizontally, and each of the other three role headers still renders **without** a
  branch switcher.

Cross-role regression for the shared-file edits: `e2e/supervisor-prompt3/{regression,role-boundaries}`
plus `e2e/cashier-floor/{role-boundaries,navigation-and-default-route,cross-role-c2-regression,
till-and-me-regression}` — **68/68** on 2026-08-20.

## Playwright E2E harness (Cashier Floor — Prompt C1, 2026-07-31)

Prompt C1 (Cashier Floor-first: nav Floor/Till/Me, `/cashier/floor` default, Cashier as the third
shared-`OperationalFloor` consumer) and **Prompt C2** (table→bill resolution + read-only settlement
workspace + Find bill) add/extend a browser suite at `apps/web/e2e/cashier-floor/` — **now 20 spec
files, 41 tests × the same four viewport projects** (1024×768, 1366×768, 1440×900, 1920×1080) =
**164 tests** (C2 definitive run: **164 passed / 0 failed / 0 skipped**), run under the same
`apps/web/playwright.config.ts` and the same env-driven credentials (no hard-coded secrets;
artifacts git-ignored). The 12 C2 specs (`zero-one-multiple-bill-resolution`, `selected-bill-url-state`,
`settlement-workspace-readonly`, `split-child-selection`, `payment-state-readonly`, `till-readiness`,
`find-bill-foundation`, `tableless-takeaway-selection`, `legacy-compatibility-regression`,
`request-count-c2`, `responsive-c2`, `cross-role-c2-regression`) create their own synthetic bills via
`e2e/cashier-floor/c2-fixtures.ts` against the isolated API. Reuse/extend it — do **not** fork a new one.

Coverage focus: Floor/Till/Me nav (Queue/Receipts absent from visible nav but reachable by direct
URL), `/cashier` → `/cashier/floor` redirect + Floor landing, shared-`OperationalFloor` parity,
canonical `?tableId=` URL state (push→replace, refresh/Back/Forward restore, invalid/cross-branch
→ "Table unavailable"), the read-only `CashierSelectedTablePanel` boundary ("Select a bill to
continue." — no payment/close/split/refund/receipt action), and shared-safe Floor reads (no guest/
payment/receipt data on cards).

**Executed and passed** on an isolated local Docker Postgres stack (Postgres on **:55432**, API on
**:4001** with `API_CORS_ORIGINS=http://localhost:3100`, web on **:3100**, web built with
`NEXT_PUBLIC_API_BASE_URL=http://localhost:4001`) — **C2 definitive run 164/164 (41 × 4 viewports),
0 failed / 0 skipped**; canonical Supervisor/Waiter cross-role regression 5/5. Shared Neon never
written; no commit/push. Static assertions:

```bash
npx tsx apps/web/scripts/cashier-c1-assertions.ts   # Cashier C1: Floor/Till/Me nav, /cashier/floor
   # default + redirect, shared-OperationalFloor consumption, ?tableId= URL state, read-only
   # boundary, shared-safe Floor reads, Queue/Receipts hidden-compat routes
npx tsx apps/web/scripts/cashier-c2-assertions.ts   # Cashier C2: bounded table→bill resolution
   # (zero/one/multiple, fail-closed, no first-pick), ?tableId=&orderId= URL model, ONE read-only
   # settlement workspace reusing checkout primitives, Find bill sibling, no payment/close/receipt/
   # refund mutation, Queue/Receipts not mounted + still routable
npx tsx apps/web/scripts/manager-p1-assertions.ts   # Manager M-P1: locked six-tab nav + order,
   # registry icons, /manager→/manager/overview, six pages on the shared shell, manager login
   # routing, surface allow-list (no permission lookup), branch resolution + narrow invalidation,
   # optional header switcher slot, unchanged Waiter/Cashier/Supervisor nav+headers, role accent,
   # no fabricated data, no unverified readiness chip
npx tsx apps/web/scripts/shell-assertions.ts        # (also updated for the Cashier Floor-first nav
   # and, since Manager M-P1, the four-role registry)
npx tsx apps/web/scripts/floor-assertions.ts        # (also updated for the third Floor consumer)
```

**Frontend-only — no backend/schema/migration/seed/permission/Postman change** (Cashier already
holds `pos:table:read`/`pos:orders:read`/`pos:reservation:read`). See
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md` +
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`.

## Playwright E2E harness (Supervisor Prompt 4B — Reservations)

Prompt 4B (Reservations page reconstruction) adds a browser suite at
`apps/web/e2e/supervisor-reservations/` — **9 specs**, run under the same
`apps/web/playwright.config.ts` **four viewport projects** (1024×768, 1366×768,
1440×900, 1920×1080) and the same env-driven credentials (no hard-coded secrets;
artifacts git-ignored) as the Prompt 3D harness above. Reuse/extend it — do **not**
fork a new one.

Coverage focus: the four UI **views** (Arriving/Seated/Attention from one bounded
`scope=active` query; **History** lazy `scope=history`), URL-persisted state
(view/date/page/status/from/to/selected id, Back/Forward/refresh stable), lifecycle
actions (create/confirm/assign/seat/cancel/no-show/manual-complete) with availability
mirroring backend `VALID_TRANSITIONS` and terminal read-only rows, Attention derivation
(server overdue + structural SEATED inconsistencies, individual actions only — no bulk),
read-only deposits (create takes an optional `depositRequired` amount only), and
guest-privacy (list rows name-only; contact in workspace/create form).

Static gates **passed**: web typecheck + lint + `next build`; reservation+order Jest
**67/67**; Playwright specs **compile** (72 tests × 4 viewports). **No permission/backend
change** — Supervisor already held every reservation grant; `seed.ts` unchanged.

**Live authenticated browser + 4-viewport execution and the disposable-branch mutation
run remain the outstanding gate** (no running API/web/browser stack in this environment).
⚠️ **Shared-Neon caveat:** the shared `production` branch still lacks
`ReservationEventType.COMPLETED` (migration `20260518000000` unapplied), so **manual
complete** (and auto-completion-on-order-close) will **error on shared Neon** until
deployed — run any completion path only on an isolated branch/DB with the migration
applied. All other reservation actions (create/confirm/assign/seat/cancel/no-show) work
on shared today.

---

## Prompt 4C — shared-Neon cutover & isolation lessons (2026-07-29)

- **Shared/production Prisma deploys:** use **`db:migrate:deploy`** (`prisma migrate
  deploy`) only — NEVER `db:migrate` (= `prisma migrate dev`, unsafe on shared). Use a
  **direct** (non-pooled) Neon connection (strip `-pooler` from the endpoint host).
  Gate every shared write behind a read-only preflight + a retained pre-migration
  **recovery branch**.
- **Disposable-branch QA isolation:** swapping `apps/api/.env` is NOT enough — an
  inherited shell/profile `DATABASE_URL` overrides it (`dotenv` won't override existing
  env). Unset it, point BOTH `apps/api/.env` and `packages/db/.env` at the disposable
  branch, and **verify isolation with a READ before any write**. (In 4C an isolated API
  hit production because of this; one QA row was created and then removed.)
- **Status:** the Prompt 4A `COMPLETED` enum migration + `pos:order:transfer` seed are
  now deployed on `production`; the live authenticated browser + 4-viewport reservations
  run against a properly-isolated stack was **executed in Prompt 4D** (below).

## Prompt 4D — fail-closed isolated QA harness (`tools/qa/`, 2026-07-29)

The durable answer to the 4C isolation incident. **Swapping `.env` cannot isolate a Node
process** — `dotenv`/`ConfigModule.forRoot` never override an already-set `process.env` var,
so an inherited shell/profile `DATABASE_URL` wins. The harness therefore **constructs the
child-process environment explicitly** (deletes every inherited DB/service key, then sets the
disposable values) and refuses to start the API unless a fail-closed identity check passes.

Components (all in `tools/qa/`, no secrets committed):

- `lib/isolation.mjs` — explicit child-env construction, pg-URL parsing, host redaction, and
  the production/shared-target **denylist** (`assertDisposableTarget`).
- `db-identity-preflight.mjs` — executable identity check using the **same generated Prisma
  client the API uses**: denylist → connect → disposable **sentinel** row → required migration
  → `ReservationEventType.COMPLETED` → demo branch row. Exits non-zero on any mismatch.
  **Health alone cannot prove branch identity — this can.**
- `run-isolated-api.mjs` — launcher: build explicit child env → denylist → preflight → **only
  then** spawn `apps/api/dist/main.js`.
- `reservation-live-matrix.mjs` — env-driven live reservation lifecycle mutation matrix
  (marker-tagged synthetic data).

Rules this enforces (also the durable isolation policy):

1. Changing `.env` does **not** override an inherited process environment.
2. Isolated child processes must receive an **explicit** environment map with inherited
   `DATABASE_URL` / `DIRECT_URL` / `DIRECT_DATABASE_URL` / `SHADOW_DATABASE_URL` **removed**.
3. The expected disposable endpoint must be checked (denylist) **before** startup.
4. A disposable-branch **sentinel** must be verified through the API's own DB client.
5. Destructive tests **fail closed** on any identity mismatch; shared Neon stays read-only
   unless a fresh explicit write gate is granted.

**Maintained command — run isolated Reservations QA** (full recipe in `tools/qa/README.md`):

```bash
# 1) create a disposable branch + sentinel, put its URL in a git-ignored secret file, then:
export QA_SECRET_ENV_FILE=/path/to/qa.env.secret
export QA_EXPECTED_HOST_SUBSTR=ep-<disposable> QA_FORBIDDEN_HOST_SUBSTRS=ep-<shared>
export QA_EXPECTED_BRANCH=br-<disposable> QA_SENTINEL_MARKER=<UNIQUE> \
       QA_EXPECTED_BRANCH_ROW=cb27be401a2c35dfc0d4e610 QA_API_PORT=4002 QA_WEB_ORIGIN=http://localhost:4101
node tools/qa/run-isolated-api.mjs                 # fail-closed API on :4002
curl http://localhost:4002/api/health              # -> {"status":"ok","db":"ok"}
PW_API_URL=http://localhost:4002 PW_BRANCH_ID=cb27be401a2c35dfc0d4e610 \
  P4D_MARKER=<UNIQUE> node tools/qa/reservation-live-matrix.mjs   # live mutation matrix
```

**Browser suite:** the disposable Neon branch's latency (EAT ↔ us-east-1, 0.25 CU) exceeds the
app's 30s client abort under the reservations page's concurrent query fan-out, so run the
Playwright suite against a **local Docker Postgres** stack (near-zero latency — the documented
canonical browser-QA path above), built with `NEXT_PUBLIC_API_BASE_URL` pointed at the isolated
API. Playwright timeouts are env-overridable (`PW_TEST_TIMEOUT` / `PW_EXPECT_TIMEOUT` /
`PW_ACTION_TIMEOUT` / `PW_NAV_TIMEOUT`) to give a dev-mode server first-hit-compile headroom.
Use non-reserved ports — Windows reserves ranges (e.g. `3015–3114` covers `3100/3101`); check
`netsh interface ipv4 show excludedportrange protocol=tcp`.
