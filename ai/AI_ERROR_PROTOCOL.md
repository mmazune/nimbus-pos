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
