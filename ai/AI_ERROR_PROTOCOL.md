# AI_ERROR_PROTOCOL.md — Nimbus POS Rebuild

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

Attempt one fix at a time.

That means:

1. describe the chosen hypothesis
2. make the smallest fix that proves or disproves it
3. rerun only the relevant command(s)

## Rule 4

If the fix fails:

- do not pile on another speculative patch immediately
- revert to last known good state if necessary
- move to next hypothesis

## Required evidence bundle in every failure report

- command run
- exact error output
- file(s) changed
- why the chosen fix was attempted
- result after rerun

## Preferred debugging order

1. environment / env var issue
2. schema or migration issue
3. dependency / import / build issue
4. validation / DTO issue
5. RBAC / guard issue
6. transaction / concurrency issue
7. test fixture / seed issue

## Special rules by domain

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

## Reset instruction

If the current branch is badly contaminated by failed experiments and the user has not asked to preserve them:

- reset to the last known good commit
- reapply only the selected fix cleanly

## Never do these

- do not silently ignore failing tests
- do not weaken validation just to make tests pass
- do not remove guards to unblock yourself
- do not skip Postman / docs / status updates after a fix

## Postman-specific debugging rules

### Rule P1 — Login returns 201, not 200

`POST /api/auth/login` always returns **201** (a Session record is created). Postman test
scripts must assert `pm.response.to.have.status(201)`. If you write status(200), the Login
test will fail even though the endpoint and token are working correctly.

**When writing a new Postman collection login request, the test script must be:**
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

Pre-existing server processes survive across VS Code restarts and terminal reuse. Always
restart the server when testing a new milestone's endpoints for the first time.

### Rule P3 — Diagnose 500 before patching

When investigation shows a 500, run through this checklist BEFORE editing code:
1. Is the migration applied? (`prisma migrate deploy`)
2. Is the server process current (not stale)? (kill + restart)
3. Is the x-branch-id header being sent?
4. Is the token valid and unexpired?
If all four pass and the endpoint still returns 500, proceed with service-level debugging.
