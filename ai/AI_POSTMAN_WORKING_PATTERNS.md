# AI_POSTMAN_WORKING_PATTERNS.md — Mandatory Postman rules for the Nimbus POS rebuild

This document defines the **mandatory Postman conventions** every milestone
prompt and every coding-AI agent must follow when authoring or modifying a
collection in `postman/collections/`. It exists because the M39 split
(M39.1, M39.2, M39.3) repeatedly failed in cold Postman sessions due to
implicit cross-folder dependencies and missing variable resolution.

A second class of failures was discovered during M40: when a Postman
environment is active, **environment-scope values shadow collection-scope
values**. Writes to `pm.collectionVariables` are invisible to Postman's
variable resolver when a same-named env key exists (even if empty). See R16.

These rules are now **non-negotiable** for every future milestone.

---

## R1 — Read every existing collection before editing

Before writing or refactoring a collection, you MUST list and skim every
existing collection in [postman/collections/](postman/collections/). The
goals are to (a) reuse variable names, (b) reuse pre-request patterns,
(c) reuse the auto-login script, and (d) avoid milestone-naming clashes.

If the new collection introduces a variable that already exists with a
different meaning in another collection, rename one of them.

## R2 — Every collection must explain variable flow in `00 Read Me`

Each collection must contain a `00 Read Me` folder whose first item
documents:

- collection-level variables (with default values)
- which folder/request **sets** each variable
- which downstream folder/request **consumes** each variable
- which variables are pre-resolved by the collection-level pre-request
  script (auto-login, branchId via `/api/auth/me`, etc.)
- which folders are **runnable standalone** vs **require prior folders**

## R3 — Folders should run standalone where practical

Default to **standalone resilience**. A user must be able to import the
collection cold, open one folder, hit Run, and get green checkmarks
**without** having manually run an earlier folder first — unless the
folder is explicitly marked `requires prior folders` in its description.

## R4 — Missing `accessToken` → auto-login

The collection-level `prerequest` script must auto-login the configured
owner (or seed demo credentials) whenever:

- `accessToken` is missing or shorter than 20 characters, **and**
- the request is not one of the explicitly-public routes:
  - `POST /api/auth/login`
  - any `/api/public/*`
  - `GET /api/health`

The script must persist `accessToken`, `refreshToken`, and `orgId` into
collection variables **and** into the active environment scope (see R16)
so subsequent requests reuse them regardless of which Postman env is selected.

## R5 — Missing `orgId` / `branchId` → resolve through `/api/auth/me`

If a request body, URL, or header references `{{branchId}}` or
`{{orgId}}` and the corresponding variable is empty, the collection-level
pre-request script must call `GET /api/auth/me` and populate
`orgId` / `branchId` from `context.defaultOrganizationId` /
`context.defaultBranchId` (or fall back to `memberships[0]`).

This is what makes branch-scoped `merchant/*` requests cold-runnable.

## R6 — Missing event / hold / slug IDs → fetch or create upstream when safe

If a request references `{{restaurantSlug}}`, `{{eventSlug}}`,
`{{eventId}}`, `{{reservationHoldId}}`, `{{eventBookingHoldId}}`,
`{{opsOrgId}}`, etc., and the variable is empty:

- For **public read-only** lists (`/api/public/restaurants`,
  `/api/public/events`, `/api/ops/customers`), the collection or folder
  pre-request must call the list endpoint and pick the first row.
- For **upstream creates** that are safe to repeat (e.g. a fresh
  `POST /api/public/reservations/hold`), the folder pre-request may
  create a fresh row to make the downstream request runnable.
- For **destructive or expensive** creates, the folder must instead
  fail with a deliberate, human-readable skip reason (see R11).

## R7 — Doc-only callback / IPN requests must be clearly labeled

Provider callbacks and IPN payloads are documentation contracts; they
are **not** part of the runnable happy path. Each such request must:

- have its name prefixed with `(doc only)` or `(RESERVED FUTURE
  CONTRACT)`
- include a description explaining who actually triggers the call in
  production
- not be the reason a folder Run fails — wrap any test assertions in
  `pm.test('(doc only) ...', ...)` so a non-match is informative, not
  catastrophic

This applies to:

- `GET /api/billing/pesapal/callback` (PesaPal calls this in the diner's
  browser)
- `POST /api/billing/pesapal/ipn` (PesaPal pushes server-to-server)
- `GET /api/public/payments/callback` (reserved future MTN / Airtel)
- `POST /api/public/payments/ipn` (reserved future MTN / Airtel)

## R8 — Postman caches scripts on import

Postman caches collection scripts at import time. If a collection's
`prerequest` or `test` scripts have changed since the last import, the
user MUST **re-import** the JSON file. Re-opening Postman is not enough.

Every `00 Read Me` folder must contain this warning verbatim:

> ⚠️ **Re-import required after any script change.** Postman caches
> pre-request and test scripts at import time. If you previously imported
> this collection and the scripts have since been updated, delete the
> collection from Postman and re-import the JSON.

## R9 — Each collection must include a `00 Read Me` / run-order section

The `00 Read Me` folder must enumerate folders in run order, mark each
as `[STANDALONE]` or `[REQUIRES PRIOR FOLDERS]`, and explicitly call out
any folder whose requests are doc-only (e.g. PesaPal callback / IPN).

## R10 — Test scripts must capture IDs / tokens

Every request that returns a useful identifier must capture it into a
collection variable in its `test` script. Conventions:

- `accessToken`, `refreshToken`, `orgId` ← `POST /api/auth/login`
- `branchId` ← `GET /api/auth/me` (`context.defaultBranchId`)
- `restaurantSlug` ← `GET /api/public/restaurants` (first row)
- `eventSlug` ← `GET /api/public/events` (first row)
- `reservationHoldId` ← `POST /api/public/reservations/hold` (`id`)
- `eventBookingHoldId` ← `POST /api/public/event-bookings/hold` (`id`)
- `opsOrgId` ← `GET /api/ops/customers` (first row)

## R11 — Scripts must fail with meaningful messages

A test or pre-request script that detects an unresolvable dependency
must `console.warn` and `pm.test('skipped: ...', () => pm.expect.fail(...))`
with a one-line human-readable reason such as:

```
[skip] no restaurantSlug — run folder F.1 in M39.2 to publish a profile
```

Do **not** emit vague `pm.environment unset` errors or let a `400 Bad
Request` go unannotated.

## R12 — Login asserts `status(201)` (Rule P1 from AI_ERROR_PROTOCOL)

Per [ai/AI_ERROR_PROTOCOL.md](ai/AI_ERROR_PROTOCOL.md) rule P1,
`POST /api/auth/login` returns **201** because Nest creates a Session
row. Login test scripts must assert `[200, 201]` to cover both Nest
defaults safely, and must use the **dual-scope write** pattern from R16:

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

Owner / manager / accountant credentials in `variable[]` must point at
seeded demo accounts (e.g. `owner.demo@nimbus.test`). Real production
credentials must come from a Postman environment file (NOT committed).

## R14 — Collection-level pre-request canonical helper

Every M39+ collection should embed the same canonical pre-request
helper (or extend it). It performs:

1. Auto-login when `accessToken` is missing on a non-public route.
2. `/api/auth/me` resolution when the request references
   `{{branchId}}` or `{{orgId}}` and the variable is missing.
3. List-first auto-resolution for `{{restaurantSlug}}`, `{{eventSlug}}`,
   `{{opsOrgId}}` against their public / ops list endpoints.
4. **All variable writes use the dual-scope pattern from R16.**
5. The `getVar` helper reads the environment scope first so a populated env
   key is used directly; an empty env key falls through to collection scope.
6. The helper is structured as a **returned Promise chain**
   (`return ensureToken().then(...).catch(...)`) so Postman awaits all
   async work before firing the main request. A callback pyramid
   (`ensureLogin(() => ensureContext(() => {}))`) does NOT await and
   will race the main request on cold sessions → 401.

Folder-level pre-request scripts should add only domain-specific
resolution (e.g. M39.2 folder H auto-creates an event; M39.3 folder E
auto-creates fresh holds).

**Canonical `getVar` / `setVar` helper (copy into every collection):**

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

Each milestone owns exactly one canonical collection. Earlier
experimental collections may remain in the directory for historical
context but must not be the primary entry point. The `AI_STATUS.md`
counter and the milestone completion report must point at the canonical
file.

## R16 — Dual-scope variable writes (environment + collection)

**This is the most common cause of silent 401 failures in Postman.**

Postman resolves `{{variable}}` by checking scopes in priority order:
`environment → collection → globals`. When a Postman environment is
active and contains a key for `accessToken` (even as an empty string),
that empty env value **shadows** the populated collection-scope value.
The request sends `Authorization: Bearer ` (blank) → 401.

**Rule:** every write of `accessToken`, `refreshToken`, `orgId`,
`branchId`, or any other variable referenced as `{{…}}` in a request
MUST be written to **both** collection scope and the active environment
scope if one is selected.

```javascript
// Correct — dual-scope write
const envActive = pm.environment && pm.environment.name;
pm.collectionVariables.set('accessToken', token);
if (envActive) pm.environment.set('accessToken', token);
```

```javascript
// Wrong — single-scope write; broken when any env is selected
pm.collectionVariables.set('accessToken', token); // ← env shadows this
```

This applies to:
- `POST /api/auth/login` test script
- `GET /api/auth/me` test script (for `orgId`, `branchId`)
- The collection-level `setVar` helper in the canonical pre-request
- Any folder-level prerequest that captures an ID used downstream

The `getVar` counterpart must read env-first/collection-fallback so a
non-empty env value wins, but an empty one does not cause a false
"already set" early-return in `ensureMeContext` or `ensureToken`.

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

**History:** this bug was first fixed in the M39.1/M39.2/M39.3
stabilization patch (dual-scope writes added to `Login (owner)`).
It resurfaced identically in M40 because the collection was authored
before this rule was codified. Every new milestone must include these
patterns from day one.

## R17 — Upstream entity resolution before PATCH / DELETE / retry actions

Any request that uses `{{someId}}` in its URL (e.g. `PATCH /api/alerts/rules/{{ruleId}}`,
`POST /api/alerts/deliveries/{{deliveryId}}/retry`) **must not assume the variable
is populated**. Before issuing the main request, the collection or folder pre-request
script must follow this resolution priority:

1. **Already set** — if `getVar('someId')` returns a non-empty value, skip resolution.
2. **List-first capture** — call the corresponding list endpoint
   (`GET /api/alerts/rules`, `GET /api/alerts/deliveries`, etc.), find the first
   row matching any required status filter (e.g. `status === 'RETRY_SCHEDULED'`),
   and `setVar('someId', row.id)`.
3. **Minimal create-if-missing** — if the list returns nothing usable, dispatch a
   minimal safe create (e.g. `POST /api/alerts/rules` with the smallest valid
   payload, or `POST /api/alerts/test` with `forceFailure: true`) and capture the
   returned `id`.

The resolution code must be in the **folder-level** prerequest, **not** inside an
individual request's prerequest, so it runs for the entire folder when the folder
is run standalone.

The folder description in the collection must document which variable is
auto-resolved and the resolution strategy.

**Root cause this rule prevents:** In M40, `Update Alert Rule (disable)` used
`{{ruleId}}` without any fallback. Running folder B cold after skipping the Create
step resulted in a `PATCH .../` request (empty ID in URL) → `404` or URL error.
Fixed in M40 correction patch by adding a folder-B prerequest.

## R18 — Every folder must declare its standalone status clearly

Each folder's description or the `00 Read Me` run-order table must label the
folder as one of:

- `[STANDALONE]` — pre-requests auto-resolve all required variables. User can open
  this folder cold and run without any prior folders.
- `[REQUIRES PRIOR FOLDERS]` — explicitly state which folder(s) and which
  variable(s) they produce. Only use this label if auto-resolution is genuinely
  impractical (e.g. requires irreversible state that should not be repeated).

**Default to `[STANDALONE]`**. A `[REQUIRES PRIOR FOLDERS]` label is a design
smell and requires justification. If auto-resolution is feasible (list-first
capture, create-if-missing), implement it (R17) and label the folder standalone.

**Root cause this rule prevents:** In M40, folder F was labelled
`[REQUIRES PRIOR FOLDERS]` but auto-resolution for `deliveryId` was trivially
achievable. Fixed in M40 correction patch.

## R19 — Alert / delivery channel routing: document intent categories in README

Collections that test alert dispatch must document the **channel intent model**
clearly in their `00 Read Me`, covering:

- Which alert types are sent via **mobile / SMS** (immediate operational: low stock,
  cash variance, shift-not-closed, booking reminder).
- Which alert types are sent via **email digest** (financial + owner: billing payment
  failure, overdue vendor bill, franchise branch at risk, large wastage spike).
- Which alert types are sent via **Slack / webhook** (technical + integration:
  failed webhook delivery, dev escalations).
- Which payment-failure alerts are **live** (owner SaaS billing) vs **pending**
  (public diner mobile-money — gated on future MTN / Airtel milestone).

This prevents reviewers from incorrectly labelling live alert types as "missing"
or wiring diner payment alerts before the mobile-money integration is complete.

## R20 — Re-import warning must appear in the folder description for changed folders

R8 covers the collection-level re-import warning. **In addition**, any folder whose
prerequest or test scripts change must include the following one-line note in the
folder's `description` field (if the Postman schema supports it) or in the first
request's description:

> ⚠️ **Re-import required** if this folder's scripts have changed since last import.

This is especially important for folder-level prerequest scripts (R17, R18) which
Postman also caches at import time.

---

## How to validate a collection

Before submitting a milestone, run:

```pwsh
npx --yes newman run "postman/collections/<file>.postman_collection.json" `
  --reporters json --reporter-json-export _newman_<id>.json
```

Then inspect `_newman_<id>.json` for:

- `run.stats.assertions.failed === 0`
- `run.stats.requests.failed === 0`
- `run.failures.length === 0`

If anything fails, follow [ai/AI_ERROR_PROTOCOL.md](ai/AI_ERROR_PROTOCOL.md)
exactly — diagnose one hypothesis at a time, do not thrash.
