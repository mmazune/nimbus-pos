# Isolated Reservation QA — fail-closed launcher (Supervisor Prompt 4D)

Durable tooling for running **destructive reservation QA against a disposable Neon branch**
without any risk of hitting shared/production Neon. This directly addresses the Prompt 4C
isolation incident, where an **inherited shell/profile `DATABASE_URL` overrode a swapped
`apps/api/.env`** and an "isolated" API silently connected to shared Neon.

## Why `.env` swapping is not enough

`dotenv` (and NestJS `ConfigModule.forRoot`) **never override an already-set `process.env`
variable**. If your shell/profile exports `DATABASE_URL`, editing `apps/api/.env` does nothing —
the inherited value wins. The only safe isolation is to **construct the child-process environment
explicitly**: delete every inherited DB/service key, then set the disposable values. That is what
`lib/isolation.mjs#buildIsolatedChildEnv` does, and it is enforced fail-closed before any process
that could write is allowed to start.

## Components

| File | Role |
| --- | --- |
| `lib/isolation.mjs` | Explicit child-env construction (strips inherited DB/service keys), pg-URL parsing, host redaction, and the production/shared **denylist** (`assertDisposableTarget`). No secrets. |
| `db-identity-preflight.mjs` | Executable, fail-closed identity check using the **same generated Prisma client the API uses**. Verifies denylist + connect + disposable **sentinel** + required migration + `ReservationEventType.COMPLETED` + demo branch row. Exits non-zero on any mismatch. Health alone cannot prove branch identity — this can. |
| `run-isolated-api.mjs` | Launcher: builds the explicit child env → runs the denylist → runs the preflight → **only then** spawns `apps/api/dist/main.js`. Fail-closed at every step. |
| `reservation-live-matrix.mjs` | Env-driven live reservation lifecycle mutation matrix (create/confirm/assign/seat/cancel/no-show/manual-complete/queries/concurrency). Tags every synthetic row with a `P4D-QA` marker. |

## One-time setup (per QA run)

1. **Create a disposable branch** forked from the migrated shared branch (Neon MCP or console).
   Never run destructive QA against `production`.
2. **Create a disposable-only sentinel** on that branch (Neon MCP), e.g.:
   ```sql
   CREATE TABLE IF NOT EXISTS _p4d_qa_sentinel (marker text PRIMARY KEY, branch_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
   INSERT INTO _p4d_qa_sentinel (marker, branch_id) VALUES ('<UNIQUE-MARKER>', '<disposable-branch-id>') ON CONFLICT DO NOTHING;
   ```
   The sentinel exists **only** on the disposable branch and disappears when the branch is deleted.
3. Put the disposable connection string in a **git-ignored** secret file (never committed):
   ```
   # qa.env.secret  (keep OUTSIDE the repo, e.g. a scratch dir)
   QA_DATABASE_URL=postgresql://<user>:<password>@ep-<disposable>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
   ```

## Run the isolated API (fail-closed)

```bash
export QA_SECRET_ENV_FILE=/path/to/qa.env.secret
export QA_EXPECTED_HOST_SUBSTR=ep-<disposable-endpoint-id>      # must appear in the target host
export QA_FORBIDDEN_HOST_SUBSTRS=ep-<shared-endpoint-id>        # must NOT appear (csv)
export QA_EXPECTED_BRANCH=br-<disposable-branch-id>
export QA_SENTINEL_MARKER=<UNIQUE-MARKER>
export QA_EXPECTED_BRANCH_ROW=cb27be401a2c35dfc0d4e610          # demo branch (Tapas Downtown)
export QA_API_PORT=4002
export QA_WEB_ORIGIN=http://localhost:3101
node tools/qa/run-isolated-api.mjs
```

The launcher refuses to start the API unless the denylist passes **and** the preflight verifies
the disposable sentinel through the exact datasource the API will use. Then verify:

```bash
curl http://localhost:4002/api/health   # -> {"status":"ok","db":"ok",...}
```

## Run the live mutation matrix

```bash
PW_API_URL=http://localhost:4002 PW_BRANCH_ID=cb27be401a2c35dfc0d4e610 \
  P4D_MARKER=<UNIQUE-MARKER> P4D_OUT=/path/to/matrix.json \
  node tools/qa/reservation-live-matrix.mjs
```

## Build + run the isolated web for Playwright

```bash
# Web bakes NEXT_PUBLIC_API_BASE_URL at build time — build it against the isolated API:
NEXT_PUBLIC_API_BASE_URL=http://localhost:4002 corepack pnpm@8.15.0 --filter @nimbus-pos/web build
corepack pnpm@8.15.0 --filter @nimbus-pos/web exec next start -p 3101 &

PW_BASE_URL=http://localhost:3101 PW_API_URL=http://localhost:4002 \
  PW_BRANCH_ID=cb27be401a2c35dfc0d4e610 \
  corepack pnpm@8.15.0 --filter @nimbus-pos/web exec playwright test e2e/supervisor-reservations
```

## Teardown

Stop the API/web/Playwright processes, then **delete the disposable branch** (the sentinel and all
QA data vanish with it). Never delete the retained pre-migration recovery branch. Shared Neon stays
read-only unless a fresh, explicit write gate is granted.
