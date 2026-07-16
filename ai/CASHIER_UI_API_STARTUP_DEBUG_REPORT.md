# Cashier UI API Startup Debug Report

Date: 2026-07-02
Repo: `C:\Users\arman\Desktop\nimbus-pos`

## Scope

This was a local startup/debug pass for the cashier demo. It did not change backend controllers, services, Prisma schema, migrations, seeds, demo import data, or Postman collections.

## Findings

- `apps/api/src/main.ts` is configured for `API_PORT || 3001`, global prefix `/api`, and health at `http://localhost:3001/api/health`.
- No conflicting listener was present on ports 3000 or 3001 before startup.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api dev` and `npx nest start` appeared stalled because Nest startup/build was silent and slow.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api exec tsc -p tsconfig.build.json --noEmit --pretty false --diagnostics` completed cleanly in about 77s.
- `npx nest build --builder tsc --path tsconfig.build.json` completed in about 170s and emitted `apps/api/dist`.
- Running `node dist/main` from `apps/api` successfully started the API.
- API boot logs showed Neon cold-start retries before readiness:
  - `DB connect attempt 1 failed (Neon cold start?), retrying in 3s...`
  - `DB connect attempt 2 failed (Neon cold start?), retrying in 3s...`
  - `Nimbus POS API running on http://localhost:3001`

## Confirmed Health

`Invoke-RestMethod http://localhost:3001/api/health` returned:

```json
{"status":"ok","db":"ok"}
```

## Follow-Up Risk

During authenticated browser QA, repeated page-level request bursts produced Prisma pool timeouts from JWT validation, for example `this.prisma.user.findUnique()` and `this.prisma.session.update()` timing out with connection limit 25. A frontend receipts fan-out was reduced in this pass, but waiter floor still hit the same pool timeout during regression testing.

