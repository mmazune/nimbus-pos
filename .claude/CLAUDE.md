# Project Memory

Instructions here apply to this project and are shared with team members.

## Context

Today's date is 2026-05-18.

---

# Project Context (from AI_CONTEXT.md)

## Goal

Build Nimbus POS from scratch using a strict milestone system, preserving full product depth:
POS, KDS, inventory, procurement, reservations, events, HR/workforce, payroll, accounting, franchise, billing,
developer portal, reporting, alerts, offline reliability, and later hardware integrations.

## Non-negotiables

- Neon Postgres
- Prisma schema + committed migrations
- NestJS modules and service-first business logic
- Postman collection for every milestone
- Idempotent seeds
- Audit coverage on sensitive writes
- Accounting-ready contracts early, full accounting later
- MSR / badge login deferred to late hardware wave
- Smart spouts deferred to late hardware wave

## Locked Technical Decisions (DO NOT CHANGE)

- IDs: `cuid2`
- Validation: `class-validator` + `class-transformer`
- Auth v1: JWT access + refresh
- Repo: pnpm workspaces + Turborepo
- Backend: NestJS
- ORM: Prisma
- Database: Neon Postgres
- Frontend: Next.js Pages Router + React Query + Tailwind
- Jobs/cache: Redis + BullMQ
- Tests: Jest + Supertest
- Deferred until late wave: MSR login and smart spouts

## Architecture Rules

1. Most business data is `orgId` scoped.
2. Branch-operational data must usually include `branchId`.
3. Controllers stay thin; services own rules and state transitions.
4. Stock, money, approvals, payroll, and sync flows are transaction-first.
5. Critical operational ledgers should be append-only where possible.
6. Every write path that can materially affect money, stock, auth, or compliance must be auditable.
7. Build software-only foundations first; hardware integrations come much later.

## Hard Warnings

- Do not skip Postman.
- Do not skip seed updates.
- Do not invent features outside milestone scope.
- Do not pull deferred hardware work into early milestones.
- Do not implement full accounting before operational source documents are stable.

---

# Governance & Mandatory Procedures (from AI_GOVERNANCE_PROMPT_UPDATED.md)

## Mandatory Context Read

You MUST open and read before any code changes:

- ROADMAP.md
- repo file tree.txt
- ai/AI_CONTEXT.md
- ai/AI_STATUS.md
- ai/AI_ERROR_PROTOCOL.md
- ai/AI_COMPLETION_REPORT_TEMPLATE.md
- docs/ARCHITECTURE.md
- docs/API_CONVENTIONS.md
- docs/POSTMAN_ENDPOINT_GUIDE.md
- postman/collections/ (all existing collections)

## Regression Protection Checklist

Confirm these whenever the relevant milestones exist:

- `/api/health` returns db ok
- `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/pin-login` work
- permission guard works on at least one protected route
- audit events are written for write endpoints
- seed remains idempotent
- money uses Decimal-safe handling
- stock does not go negative without an explicit controlled override
- late hardware milestones are not pulled forward

## Mandatory Procedure (every milestone)

1. Print a context snapshot from `ai/AI_STATUS.md`.
2. Implement ONLY the requested milestone scope.
3. Deliver in this order: DB → services → controllers → tests → seed → Postman → docs.
4. Postman is mandatory:
   - create/update a collection under `postman/collections/`
   - add every endpoint with example payloads
   - add tests to capture tokens / IDs where relevant
   - provide a human checklist and confirm manual execution
5. Git discipline: at least two sensible checkpoints per milestone if working locally.
6. Error protocol: generate 3-4 hypotheses, attempt one fix at a time, revert if needed before trying next.
7. Completion:
   - update `ai/AI_STATUS.md`
   - update `repo file tree.txt` if structure changed
   - write milestone completion report

## Build Order Inside Every Milestone

DB → service → controller → tests → seed → Postman → docs → status update → completion report

## Required Output from the Coding LLM

- commands to run
- file-by-file changes
- tests and how to run them
- Postman checklist + JSON changes
- updated `ai/AI_STATUS.md`
- completion report contents

---

# Error Protocol (from AI_ERROR_PROTOCOL.md)

Use this exact protocol whenever a milestone fails during implementation.

## Rule 1

Do not thrash. Do not keep making random edits.

## Rule 2

Generate 3-4 grounded hypotheses before fixing anything.

For each hypothesis:

- what likely failed
- evidence for it
- evidence against it
- how to test it quickly

## Rule 3

Attempt one fix at a time:

1. describe the chosen hypothesis
2. make the smallest fix that proves or disproves it
3. rerun only the relevant command(s)

## Rule 4

If the fix fails:

- do not pile on another speculative patch immediately
- revert to last known good state if necessary
- move to next hypothesis

## Required Evidence Bundle in Every Failure Report

- command run
- exact error output
- file(s) changed
- why the chosen fix was attempted
- result after rerun

## Preferred Debugging Order

1. environment / env var issue
2. schema or migration issue
3. dependency / import / build issue
4. validation / DTO issue
5. RBAC / guard issue
6. transaction / concurrency issue
7. test fixture / seed issue

## Special Rules by Domain

### Prisma / DB

- never edit an old migration that has already been shared
- create a new migration or reset only in clearly non-production local states
- verify Decimal handling carefully

### Auth / session

- confirm token payload and guard expectations
- confirm refresh token hashing / storage rules
- confirm permission strings and role bindings

### Inventory / payments / accounting

- verify transaction boundaries first
- verify idempotency behavior
- verify before/after stock or money math with explicit numbers

### Frontend / offline

- check contract mismatch with backend first
- confirm cache / query invalidation paths
- confirm optimistic update rollback paths

## Reset Instruction

If the current branch is badly contaminated by failed experiments and the user has not asked to preserve them:

- reset to the last known good commit
- reapply only the selected fix cleanly

## Never Do These

- do not silently ignore failing tests
- do not weaken validation just to make tests pass
- do not remove guards to unblock yourself
- do not skip Postman / docs / status updates after a fix

---

# Postman Error Rules (from AI_ERROR_PROTOCOL.md)

### Rule P1 — Login returns 201, not 200

`POST /api/auth/login` always returns **201** (a Session record is created). Postman test
scripts must assert `pm.response.to.have.status(201)`. If you write status(200), the Login
test will fail even though the endpoint and token are working correctly.

When writing a new Postman collection login request, the test script must be:

```javascript
const body = pm.response.json();
pm.environment.set('accessToken', body.accessToken);
pm.test('Login OK', () => pm.response.to.have.status(201));
```

### Rule P2 — 500 on new milestone endpoints = stale server process

If new milestone endpoints return 500 while endpoints from older milestones work:

1. The dev server is running a compiled build from BEFORE the new milestone code was added
2. Kill all node processes: `Get-Process node | Stop-Process -Force`
3. Restart the API: `npx nest start` from `apps/api`
4. Re-run Postman tests

### Rule P3 — Diagnose 500 before patching

When investigation shows a 500, run through this checklist BEFORE editing code:

1. Is the migration applied? (`prisma migrate deploy`)
2. Is the server process current (not stale)? (kill + restart)
3. Is the x-branch-id header being sent?
4. Is the token valid and unexpired?

If all four pass and the endpoint still returns 500, proceed with service-level debugging.

---

# Postman Working Patterns (from AI_POSTMAN_WORKING_PATTERNS.md)

These are mandatory Postman conventions every milestone prompt and every coding-AI agent must follow.

## R1 — Read every existing collection before editing

Before writing or refactoring a collection, list and skim every existing collection in `postman/collections/`. Goals: (a) reuse variable names, (b) reuse pre-request patterns, (c) reuse the auto-login script, (d) avoid milestone-naming clashes.

## R2 — Every collection must explain variable flow in `00 Read Me`

Each collection must contain a `00 Read Me` folder documenting: collection-level variables (with defaults), which folder/request sets each variable, which downstream folder/request consumes each variable, which variables are pre-resolved by the collection-level pre-request script, which folders are standalone vs require prior folders.

## R3 — Folders should run standalone where practical

Default to standalone resilience. A user must be able to import the collection cold, open one folder, hit Run, and get green checkmarks without having manually run an earlier folder first — unless explicitly marked `requires prior folders`.

## R4 — Missing `accessToken` → auto-login

The collection-level `prerequest` script must auto-login whenever `accessToken` is missing or shorter than 20 characters, and the request is not one of: `POST /api/auth/login`, any `/api/public/*`, `GET /api/health`.

The script must persist `accessToken`, `refreshToken`, and `orgId` into both collection variables AND the active environment scope (see R16).

## R5 — Missing `orgId` / `branchId` → resolve through `/api/auth/me`

If a request references `{{branchId}}` or `{{orgId}}` and the variable is empty, the collection-level pre-request script must call `GET /api/auth/me` and populate from `context.defaultOrganizationId` / `context.defaultBranchId`.

## R6 — Missing event / hold / slug IDs → fetch or create upstream when safe

If a request references `{{restaurantSlug}}`, `{{eventSlug}}`, `{{eventId}}`, `{{reservationHoldId}}`, etc., and the variable is empty:

- For public read-only lists, call the list endpoint and pick the first row.
- For upstream creates that are safe to repeat, the folder pre-request may create a fresh row.
- For destructive or expensive creates, fail with a deliberate human-readable skip reason (see R11).

## R7 — Doc-only callback / IPN requests must be clearly labeled

Provider callbacks and IPN payloads must have names prefixed with `(doc only)` or `(RESERVED FUTURE CONTRACT)`. They must not be the reason a folder Run fails.

This applies to:
- `GET /api/billing/pesapal/callback`
- `POST /api/billing/pesapal/ipn`
- `GET /api/public/payments/callback`
- `POST /api/public/payments/ipn`

## R8 — Postman caches scripts on import

Postman caches collection scripts at import time. Every `00 Read Me` folder must contain this warning:

> ⚠️ **Re-import required after any script change.** Postman caches pre-request and test scripts at import time. If you previously imported this collection and the scripts have since been updated, delete the collection from Postman and re-import the JSON.

## R9 — Each collection must include a `00 Read Me` / run-order section

The `00 Read Me` folder must enumerate folders in run order, mark each as `[STANDALONE]` or `[REQUIRES PRIOR FOLDERS]`, and call out any doc-only folders.

## R10 — Test scripts must capture IDs / tokens

Every request that returns a useful identifier must capture it into a collection variable. Conventions:

- `accessToken`, `refreshToken`, `orgId` ← `POST /api/auth/login`
- `branchId` ← `GET /api/auth/me` (`context.defaultBranchId`)
- `restaurantSlug` ← `GET /api/public/restaurants` (first row)
- `eventSlug` ← `GET /api/public/events` (first row)
- `reservationHoldId` ← `POST /api/public/reservations/hold` (`id`)
- `eventBookingHoldId` ← `POST /api/public/event-bookings/hold` (`id`)
- `opsOrgId` ← `GET /api/ops/customers` (first row)

## R11 — Scripts must fail with meaningful messages

A test or pre-request script that detects an unresolvable dependency must `console.warn` and `pm.test('skipped: ...', () => pm.expect.fail(...))` with a one-line human-readable reason.

## R12 — Login asserts `status(201)`

Per Rule P1, `POST /api/auth/login` returns **201**. Login test scripts must assert `[200, 201]` and use the dual-scope write pattern from R16:

```javascript
const body = pm.response.json();
const envActive = pm.environment && pm.environment.name;
pm.test('Login OK', () => pm.expect([200, 201]).to.include(pm.response.code));
pm.collectionVariables.set('accessToken', body.accessToken);
if (envActive) pm.environment.set('accessToken', body.accessToken);
if (body.refreshToken) {
  pm.collectionVariables.set('refreshToken', body.refreshToken);
  if (envActive) pm.environment.set('refreshToken', body.refreshToken);
}
```

## R13 — Never hard-code real production credentials

Owner / manager / accountant credentials in `variable[]` must point at seeded demo accounts (e.g. `owner.demo@nimbus.test`). Real production credentials must come from a Postman environment file (NOT committed).

## R14 — Collection-level pre-request canonical helper

Every M39+ collection should embed the canonical pre-request helper performing:

1. Auto-login when `accessToken` is missing on a non-public route.
2. `/api/auth/me` resolution when `{{branchId}}` or `{{orgId}}` is missing.
3. List-first auto-resolution for `{{restaurantSlug}}`, `{{eventSlug}}`, `{{opsOrgId}}`.
4. All variable writes use the dual-scope pattern from R16.
5. The `getVar` helper reads environment scope first.
6. Structured as a returned Promise chain (NOT a callback pyramid).

**Canonical `getVar` / `setVar` helper:**

```javascript
function getVar(k) {
  if (pm.environment && pm.environment.name) {
    const ev = pm.environment.get(k);
    if (ev !== undefined && ev !== null && ev !== '') return ev;
  }
  return pm.collectionVariables.get(k);
}
function setVar(k, v) {
  if (v === undefined || v === null || v === '') return;
  pm.collectionVariables.set(k, v);
  if (pm.environment && pm.environment.name) pm.environment.set(k, v);
}
```

## R15 — One canonical collection per milestone

Each milestone owns exactly one canonical collection.

## R16 — Dual-scope variable writes (environment + collection)

**This is the most common cause of silent 401 failures in Postman.**

When a Postman environment is active and contains a key for `accessToken` (even as an empty string), that empty env value shadows the populated collection-scope value → 401.

**Rule:** every write of `accessToken`, `refreshToken`, `orgId`, `branchId`, or any variable referenced as `{{…}}` MUST be written to both collection scope and the active environment scope.

```javascript
// Correct — dual-scope write
const envActive = pm.environment && pm.environment.name;
pm.collectionVariables.set('accessToken', token);
if (envActive) pm.environment.set('accessToken', token);
```

```javascript
// Wrong — single-scope write; broken when any env is selected
pm.collectionVariables.set('accessToken', token);
```

```javascript
// Correct — env-first read
function getVar(k) {
  if (pm.environment && pm.environment.name) {
    const ev = pm.environment.get(k);
    if (ev !== undefined && ev !== null && ev !== '') return ev;
  }
  return pm.collectionVariables.get(k);
}
```

## R17 — Upstream entity resolution before PATCH / DELETE / retry actions

Any request using `{{someId}}` in its URL must not assume the variable is populated. Before issuing the main request, the folder pre-request script must follow this resolution priority:

1. Already set — if `getVar('someId')` returns non-empty, skip resolution.
2. List-first capture — call the corresponding list endpoint, find the first row, and `setVar('someId', row.id)`.
3. Minimal create-if-missing — if the list returns nothing usable, dispatch a minimal safe create.

The resolution code must be in the folder-level prerequest, not inside an individual request's prerequest.

## R18 — Every folder must declare its standalone status clearly

Each folder's description or the `00 Read Me` must label the folder as:

- `[STANDALONE]` — pre-requests auto-resolve all required variables.
- `[REQUIRES PRIOR FOLDERS]` — explicitly state which folder(s) and which variable(s) they produce.

**Default to `[STANDALONE]`**. `[REQUIRES PRIOR FOLDERS]` is a design smell requiring justification.

## R19 — Alert / delivery channel routing: document intent categories in README

Collections testing alert dispatch must document the channel intent model covering: mobile/SMS (operational), email digest (financial), Slack/webhook (technical).

## R20 — Re-import warning must appear in the folder description for changed folders

Any folder whose prerequest or test scripts change must include in the folder's description:

> ⚠️ **Re-import required** if this folder's scripts have changed since last import.

## How to Validate a Collection

Before submitting a milestone, run:

```pwsh
npx --yes newman run "postman/collections/<file>.postman_collection.json" `
  --reporters json --reporter-json-export _newman_<id>.json
```

Then inspect `_newman_<id>.json` for:

- `run.stats.assertions.failed === 0`
- `run.stats.requests.failed === 0`
- `run.failures.length === 0`

---

# Postman Endpoint Contract Guide (from POSTMAN_ENDPOINT_GUIDE.md)

## Base API Contract

- API port: `3001`
- Global prefix: `/api`
- Effective base origin: `http://localhost:3001`
- Effective route shape: `http://localhost:3001/api/<route>`

**`baseUrl` must be:** `http://localhost:3001` — never include `/api` in `baseUrl`.

Correct: `{{baseUrl}}/api/auth/login`
Incorrect: `{{baseUrl}}/auth/login`, `{{baseUrl}}/api/api/auth/login`, `http://localhost:3000/...`

## Required Postman URL Structure

Every raw URL must start with `{{baseUrl}}/api/`. Every URL `path` array must begin with `["api", ...]`.

## Environment vs Collection Variables

Postman resolves variables in order: `local → data → environment → collection → global`.

If the environment contains `accessToken = ""` and the collection script does `pm.collectionVariables.set('accessToken', token)`, then `{{accessToken}}` still resolves from the environment as blank → 401.

**Always use environment scope for:** `accessToken`, `branchId`, `reservationId`, `orderId`, `refundId`, `eventId`, `bookingId`, `ticketId`, `ruleId`, `anomalyId`, and any entity ID captured from one request and reused later.

## Required Environment Keys

```text
baseUrl = http://localhost:3001
accessToken =
branchId =
```

## Auth Contract

- Login hits `{{baseUrl}}/api/auth/login`
- Captures `accessToken` using `pm.environment.set`
- Protected requests send `Authorization: Bearer {{accessToken}}`
- `POST /api/auth/login` returns **HTTP 201** — always assert 201

```javascript
const body = pm.response.json();
pm.environment.set('accessToken', body.accessToken);
pm.test('Login OK', () => pm.response.to.have.status(201));
```

## Branch Context Contract

For branch-scoped endpoints: `X-Branch-Id: {{branchId}}`

## Mandatory Backend-Readiness Checks Before Postman Testing

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:seed
pnpm lint
pnpm test
pnpm test:e2e
pnpm dev:api
```

Also required before Postman runs:
- verify new permission rows exist in DB
- verify role-permission mappings exist in DB
- verify login user has the needed permission
- verify seed created demo users, quick PINs, branches, and milestone entities
- verify API boot log shows expected routes registered

## Standard Failure Diagnosis

| Status | Likely cause | Check |
|--------|-------------|-------|
| 401 | blank/wrong `accessToken`, collection var shadowed by env, expired token | login result, active env value, auth header |
| 403 | missing permission, wrong role, branch guard rejection | permission row, role mapping, `X-Branch-Id` |
| 404 | wrong URL path, missing `/api`, wrong port, route not wired | raw URL, path array, backend route exists |
| 400 | DTO validation, missing field, invalid enum, missing branch header | request body, DTO rules, content type |
| 409 | duplicate state transition, unique key conflict | state machine, uniqueness constraints |
| 500 new endpoint | stale server process | kill node + restart, re-run |

## Mandatory Collection Audit Rules

Any LLM editing or generating Postman collections must automatically verify:

1. No `localhost:3000` appears anywhere unless explicitly justified
2. No `baseUrl` contains `/api`
3. Every raw URL begins `{{baseUrl}}/api/`
4. Every path array begins with `"api"`
5. No `pm.collectionVariables.set(` remains for runtime IDs/tokens
6. No `pm.collectionVariables.get(` remains for runtime IDs/tokens
7. Auth token capture uses environment scope
8. Branch ID capture uses environment scope
9. JSON remains valid
10. Collection names and request names still match milestone scope

## Before Claiming Milestone Complete

- run migrate
- run seed
- run seed again
- verify permission rows in DB
- verify role-permission mappings in DB
- verify login works in Postman
- verify `GET /api/health`
- verify at least one protected endpoint with auth + branch header
- verify collection variables are not masking environment variables

## Quick Repair Checklist

When a collection is broken, fix in this order:

1. confirm `baseUrl` = `http://localhost:3001`
2. confirm raw URLs use `{{baseUrl}}/api/...`
3. confirm path arrays begin with `"api"`
4. replace all `pm.collectionVariables.set/get` with `pm.environment.set/get` for runtime values
5. run migrate + seed twice
6. verify permissions exist
7. verify login credentials exist
8. verify branch membership exists
9. verify backend route registration
10. rerun Postman collection end to end

## POSTMAN / ENDPOINT SAFETY RULE

Before generating or updating any Postman collection, verify:

- baseUrl = http://localhost:3001 with no /api suffix
- every raw URL uses `{{baseUrl}}/api/<route>`
- every path array begins with `"api"`
- all captured runtime variables use `pm.environment.set/get`, not `pm.collectionVariables`
- db:migrate and db:seed have run
- seed has run a second time successfully
- required permissions and role mappings exist in DB
- login credentials and branch membership used by the collection are actually seeded
- the backend route exists and is registered before assuming a Postman bug
