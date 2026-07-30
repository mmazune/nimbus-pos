# TESTING_AND_QA.md — Nimbus POS

> How to validate the app and run authenticated QA. Demo accounts are sourced from
> the seed/demo-import (`packages/db/prisma/demo-import.ts`, `demo-data/csv/*`).

## Required commands (web app)

```bash
corepack pnpm@8.15.0 --version                         # expect 8.15.0
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev      # dev server on :3000
```

There are **no Jest/browser tests** in the web app yet (`test` is a stub). Static
and behavioral guards live in `apps/web/scripts/*-assertions.ts` (floor/shell/
profile/prompt3a). Run them from the repo root with tsx:

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
- **Cashier:** Queue · Receipts · Till · Me.
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
