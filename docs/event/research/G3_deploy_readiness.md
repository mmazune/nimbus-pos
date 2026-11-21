# G3 - Nimbus POS deployment and readiness spec input

Scope: read-only audit of `rescued/main-2026-11-15` (tip 5a35a18), export at `/sessions/rcw-016h54ooiszn9pzbzpezf9ht/pos-rescued` (paths below are relative to that export). Date of audit: 2026-11-21. Event: Sat 2026-11-28.
Method notes: no `.env*` file was opened except `.env.example`. One `git ls-remote` was attempted and was blocked by the permission layer (network call, correctly refused); remote state below is therefore from local remote-tracking refs only and may be stale.

---------------------------------------------------------------------
## 1. Git state and the right base

Remotes (credentials not present in URLs):
- `origin`  https://github.com/mmazune/nimbus-pos.git
- `backup`  https://github.com/mmazune/nimbus-pos-backup.git

Local branches: `main` (dbb5e25, tracks origin/main), `rescued/main-2026-11-15` (5a35a18), `backup/wip-2026-11-07` (0db2894).
Remote-tracking: `origin/main` = dbb5e25, `origin/master` d739645, `origin/milestone/m14..m28*`, two stray origin branches (`copilot/update-readme-with-details`, `docs/cashier-three-tab-floor-workflow`); `backup/backup/wip-2026-11-07`, `backup/rescued/main-2026-11-15`.

`git branch -r --contains rescued/main-2026-11-15` returns ONLY `backup/rescued/main-2026-11-15`. So the rescued branch is pushed to the backup remote only, NOT to origin (per local tracking refs; not re-verified over the network).

`main..rescued/main-2026-11-15` = 5 commits (merge-base = dbb5e25 = main tip; rescued is strictly ahead, main is not ahead):
- 5a35a18 feat(backend): B6.7 C-30 Neon fix + Manager-initiated credential reset
- 3be3cd1 feat(manager): B6 Settings, Staff Onboarding, and Credential Management
- 139f1de chore(manager): B5.7-GAP closure - 4-viewport Playwright, Supervisor seed, C-29 triage, B6.5 roadmap
- 015e230 feat(manager): B5.7 accounting write pass + C-28 audit branch-stamp sweep
- 457d02d feat(manager): B5.6 accounting configuration + reporting (write-enabled)
`rescued..main` = 0 commits. rescued has 129 commits total; commit dates 2026-08-22/23 (the "2026-11-15" in the name is the rescue date, not the commit date).

Working tree on the Mac (`$HOME/mnt/Nimbus/POS`): HEAD is `main` (dbb5e25) with 127 dirty entries (many ` M` plus `??`). `git diff --stat rescued/main-2026-11-15` = 60 files, +22/-9982. Interpretation, verified by comparing each "deleted" path against the file on disk: all of the rescued-only files exist on disk as UNTRACKED files and are byte-identical to the rescued commit, except 2 which are MISSING on disk (`apps/web/scripts/tsconfig.manager-b6-assertions.json`, `apps/web/src/lib/manager/invitations-types.ts`). The only files that are NEWER/different in the working tree are `CLAUDE.md` (+20 lines) and `README.md` (+2 lines) - matches the expectation.

VERDICT: a build session must branch from `rescued/main-2026-11-15` (5a35a18), never from the working tree and never from `origin/main`. Reasons: it is a strict superset of main (5 extra commits incl. the "C-30 Neon fix"); the working tree is an uncommitted mixture with 2 files missing; origin/main lacks the Neon fix. Before the build session starts: push it to origin (or create the concert branch locally from it), e.g. `git switch -c concert/2026-11-28 rescued/main-2026-11-15` - this is a write, for the build session to do. Carry over CLAUDE.md/README.md edits from the working tree only if wanted.

---------------------------------------------------------------------
## 2. Everything the API needs to boot (env var NAMES)

Sources: `grep process.env` and ConfigService `get<string>(` in `apps/api/src` (non-spec). `ConfigModule.forRoot({ isGlobal: true })` at `apps/api/src/app.module.ts` (no validation schema, so a missing var NEVER fails boot).

### Required in production (code has insecure defaults, so "required" = must set or it silently runs insecure)
| Name | Use | Default if unset | Where value comes from |
|---|---|---|---|
| DATABASE_URL | Prisma datasource `url = env("DATABASE_URL")` (`packages/db/prisma/schema.prisma:44-48`) | none (Prisma fails) | Neon prod project, POOLED endpoint (`-pooler` host) |
| DIRECT_DATABASE_URL | Prisma `directUrl` (migrations) | none | Neon prod project, DIRECT endpoint (strip `-pooler`). Needed at migrate time; whether runtime client needs it set is UNKNOWN - set it anyway |
| JWT_ACCESS_SECRET | JWT sign+verify (`auth.module.ts:19`, `jwt.strategy.ts:31`, `auth.service.ts:55`, `quick-pin.service.ts:46`) | hard-coded `nimbus-dev-access-secret` | generate (`openssl rand -base64 48`) |
| JWT_REFRESH_SECRET | refresh tokens (`auth.service.ts:56`) | hard-coded `nimbus-dev-refresh-secret` | generate |
| QUICK_PIN_PEPPER | HMAC pepper for the PIN lookup hash (`quick-pin.service.ts:45`; seed uses it at `seed.ts:2128`) | hard-coded `nimbus-dev-pin-pepper` | generate ONCE, never rotate after PINs are issued (all PIN logins would break) |
| API_CORS_ORIGINS | comma list of allowed web origins (`main.ts:8-13`) | `http://localhost:3000,http://127.0.0.1:3000` | owner: exact Vercel/custom domain(s) incl. scheme, no wildcard |
| API_PORT | listen port (`main.ts:31`) | 3001 | `PORT` is NOT read by the app (only `API_PORT`) - matters for PaaS/Dokploy |
| NODE_ENV | must be `production` | unset | set. DANGER: `password-lifecycle.service.ts:117-118` exposes reset tokens in the forgot-password response when `NIMBUS_EXPOSE_RESET_TOKENS==='true' \|\| NODE_ENV!=='production'` |

### Optional
JWT_ACCESS_TTL (default 15m), JWT_REFRESH_TTL (default 7d), NIMBUS_EXPOSE_RESET_TOKENS (leave unset/false).

### Feature flags / provider config (all default OFF, can stay unset for the concert)
- PAY_MTN_ENABLED (default 'false'), PAY_MTN_BASE_URL, PAY_MTN_TARGET_ENV (sandbox), PAY_MTN_ACTIVE_SUBSCRIPTION_KEY, PAY_MTN_API_USER, PAY_MTN_API_KEY, PAY_MTN_CALLBACK_URL, PAY_MTN_PROVIDER_CALLBACK_HOST, PAY_MTN_CURRENCY (UGX), PAY_MTN_PAYER_MESSAGE, PAY_MTN_PAYEE_NOTE (`payments/adapters/mtn.adapter.ts:87-103`)
- PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_BASE_URL, PESAPAL_IPN_CALLBACK_URL, PESAPAL_REDIRECT_URL (`billing-pesapal.service.ts:27-30,140`)
- SMTP_HOST/SMTP_USER/SMTP_PASS, SMS_PROVIDER_API_KEY, SLACK_WEBHOOK_URL (`alerts/channel-dispatcher.service.ts:112,134,146`) - "live providers are intentionally NOT bundled"; falls back to a mock dispatcher (file header comment lines 1-20).

### `.env.example` comparison (root `.env.example`, 18 lines)
Documented: DATABASE_URL, DIRECT_DATABASE_URL, REDIS_URL (NOT read by any code), API_PORT, PORT (not read), WEB_PORT (not read), JWT_SECRET (NOT read - code uses JWT_ACCESS_SECRET), JWT_REFRESH_SECRET.
Undocumented but read: JWT_ACCESS_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL, QUICK_PIN_PEPPER, API_CORS_ORIGINS, NODE_ENV, NIMBUS_EXPOSE_RESET_TOKENS, all PAY_MTN_*, PESAPAL_*, SMTP_*, SMS_PROVIDER_API_KEY, SLACK_WEBHOOK_URL. The CI workflow also sets the stale `JWT_SECRET` (`.github/workflows/branch-validation.yml`).

### apps/web
Only two vars (grep of `apps/web/src`): `NEXT_PUBLIC_API_BASE_URL` (`src/lib/api/client.ts:63`, default `http://localhost:3001`, must NOT include `/api`; the code strips a trailing `/api` at line 60) and `NEXT_PUBLIC_DEFAULT_BRANCH_ID` (optional, Quick-PIN terminals). Both are baked at build time (NEXT_PUBLIC_*): changing the API URL needs a web rebuild. There is no web `.env.example`; they are documented only in `apps/web/README.md:40-49`.

---------------------------------------------------------------------
## 3. External services

Module wiring: `app.module.ts` imports ~55 modules unconditionally (`ConfigModule`, `PrismaModule`, `AuditModule`, Auth, Tenancy, Orders, Payments, Shifts, Tills, Events, Dashboards, Reports, Accounting, Payroll, Billing*, PublicCommerce*, Alerts, Reliability, HmsIntegration, ...). No conditional/dynamic module loading, no feature-flag module switching.

| Dependency | Finding | Needed for event till path? |
|---|---|---|
| Postgres (Neon) | Hard dependency. `PrismaService.onModuleInit` retries `$connect()` 3x with 3 s gaps ("Neon cold start?"), then starts anyway and fails queries (`common/prisma/prisma.service.ts`) | YES |
| Redis / BullMQ | NOT used. `grep` finds no ioredis/bullmq/redis dependency in `apps/api/package.json` or source; `REDIS_URL` in `.env.example` is dead | NO - do not provision Redis |
| Queues/cron/schedulers | No `@nestjs/schedule`, no `@Cron`; only `@nestjs/event-emitter` (in-process). One `setInterval`-style: `interval(15000)` in an SSE endpoint | NO |
| Websockets | None. There is Server-Sent Events: `GET /api/stream/metrics` (`dashboards.controller.ts:125+`, `@Sse('metrics')`, 15 s interval) | Optional; polling is simpler for the live view |
| Email/SMS/Slack | Mock fallback unless env set (see section 2) | NO |
| Object storage | NOT used. Documents are written to local disk `process.cwd()/uploads` (`documents.service.ts:21,92-96`, `StorageProviderType.LOCAL`) | NO (but needs a volume if documents are used; otherwise ephemeral) |
| MTN MoMo / Pesapal | Off by default | NO (cash/manual payment path) |
| Branch-context cache | In-memory 30 s cache per (user, branch) in `branch-context.guard.ts` | Single API instance only is safe; fine for 10 tills (multiple replicas still correct, just more DB reads) |

Conclusion: the API needs ONLY Postgres. Everything else can be absent.

---------------------------------------------------------------------
## 4. Build and run, health, CORS, throttle, helmet, logging

- Build: `pnpm --filter @nimbus-pos/api build` = `nest build` -> `apps/api/dist/main.js` (`apps/api/package.json` scripts; `nest-cli.json`, `tsconfig.build.json` exist). Start: `node dist/main` (`start`/`start:prod`). Port: `API_PORT` (default 3001). Listens on all interfaces (Nest default).
- Prisma client: API imports `@prisma/client` directly (no `@nimbus-pos/db` imports found in `apps/api/src`). `pnpm db:generate` must run before build/after install. `packages/db` "main" is `src/index.ts` (TS consumed, no compile step).
- Global prefix `api` (`main.ts:21`); no versioning. Public health: `GET /api/health` (`app.controller.ts:8`, no guards). It runs `SELECT 1`, but on DB failure still returns HTTP 200 with body `{"status":"error","db":"error"}` (`app.service.ts:20-33`). A Docker/Caddy/Dokploy HTTP-status healthcheck will therefore NOT detect a dead DB; check the body (`"status":"ok"`).
- CORS (`main.ts:15-19`): `origin` = exact list from `API_CORS_ORIGINS`; methods GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS; allowedHeaders `Authorization, Content-Type, X-Branch-Id, X-Platform, Idempotency-Key, X-Request-Id`; no `credentials`. Vercel preview URLs are blocked unless listed. A new custom header added by the new endpoint must be added to this list.
- Validation: global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true})`.
- Rate limiting: NONE. No `@nestjs/throttler` dependency, no `ThrottlerModule`, no `@Throttle`. 10 tills on one venue IP will not be throttled by the app. Conversely, the PIN login has no IP throttle (only per-user lockout: 5 failures -> 5 minutes, `quick-pin.constants.ts:65-66`, and that lockout only triggers when the PIN matches an existing user via lookup hash; a wrong PIN with no matching user just returns 401 - a 6-digit PIN space is guessable without a throttle; mitigate at Caddy/Cloudflare if exposed).
- Helmet: none. Body size: Express/Nest default (100 kb JSON) - no override in `main.ts`. `trust proxy`: not set, so `req.ip` behind Caddy/Vercel will be the proxy IP (audit-log `ipAddress` will be wrong); set `app.set('trust proxy', 1)` if per-till IPs matter.
- Swagger: not installed (no SwaggerModule). Nothing exposed.
- Request logging: no logging middleware/interceptor (`common/interceptors` and `common/filters` are empty dirs). Nest default logger prints startup and route mapping only. PII: `AuditService.log` persists `ipAddress` and `userAgent` into `AuditLog` (`common/audit/audit.service.ts`); `main.ts` has a `console.log` with the port only. Request tail logs will therefore be thin - for event day add access logs at Caddy.

---------------------------------------------------------------------
## 5. Prisma

- Datasource: `provider="postgresql"`, `url=env("DATABASE_URL")`, `directUrl=env("DIRECT_DATABASE_URL")` (`packages/db/prisma/schema.prisma:44-48`). Generator `prisma-client-js`. 163 models. Prisma 5.22.
- Pool settings: none in the repo (no `connection_limit`, `pgbouncer=true`, `pool_timeout` in code/docs; grep hits only in QA docs). UNKNOWN what the user's existing DATABASE_URL carries. For prod use the Neon pooled URL with `?pgbouncer=true&connection_limit=10` (suggest; not in repo).
- Neon rule already documented in `CLAUDE.md:2019-2020`: "Prisma migrations need a DIRECT (non-pooled) Neon connection - strip -pooler"; deploy with `db:migrate:deploy` only (never `db:migrate`); take a recovery branch first (`CLAUDE.md:2015-2022`).
- Commands: root `pnpm db:migrate:deploy` = `pnpm --filter @nimbus-pos/db db:migrate:deploy` = `prisma migrate deploy`; `pnpm db:generate`; seed `pnpm db:seed` = `ts-node --project tsconfig.seed.json prisma/seed.ts`; also `db:demo:validate` / `db:demo:import` (`demo-import.ts`).
- Migrations: 59 directories under `packages/db/prisma/migrations` (first `20260320000000_m1_baseline`, last `20260821200636_b5_4_d1_posting_error_resolution`). No `CREATE EXTENSION` anywhere. Raw SQL present: one migration with a partial unique index (`20260326000001_m15_fix_till_unique_partial`) - plain Postgres, no extension needed. Neon supports it.
- Seed (`prisma/seed.ts`, 8,478 lines, ts-node): roles, permissions (+ role-permission mapping, plus `revokeStaleRolePermissions` deleteMany), demo users, organization `ORG_SEED`, branches, memberships, quick PINs, org settings, exchange rate, floor plans, menu, inventory, reservations, events, HR, payroll, accounting, etc. (main() lines 8041-8330). Demo credentials are hard-coded: passwords like `Owner#123`, `Manager#123`, `Cashier#123`, demo PINs Owner=1234 ... (`seed.ts:1822-1890`, comment line 1822), demo user emails `*@demo.local`. It is idempotent (create-if-missing), but it DOES create known-password owner/manager accounts. There is NO production/host guard in seed.ts (grep for NODE_ENV/neon/host guard/ALLOW_ found nothing in `packages/db` or `apps/api`).
- Is seeding safe on a production DB? Roles+permissions seeding is required (login needs them), but the full seed also creates demo users with public passwords and demo org/data: NOT safe as-is. Recommended: run the full seed against a scratch/staging Neon branch, then either (a) create only the concert org/branch/users/menu through a small purpose-written script, or (b) run the seed on prod and immediately rotate/disable all `*@demo.local` accounts and change PINs. The HMS repo carries an explicit rule "The seed never runs against production" (`HMS/docs/deploy.md`, section 'The seed never runs against production'); POS lacks the equivalent guard.
- CLAUDE.md also states the seed must stay idempotent and a Neon recovery branch be created before any shared migration.

---------------------------------------------------------------------
## 6. Performance notes

- Quick-PIN login: bcrypt `SALT_ROUNDS = 12` (`quick-pin.service.ts:30`), `bcrypt.compare` once per login (line 153). Lookup is by an HMAC "pinLookupHash" unique column (`derivePinLookupHash(branchId, pin)`, line 73), so ONE bcrypt per attempt, not one per user. Cost estimate (not measured): ~200-300 ms CPU per compare on a small VPS, bcrypt runs on the libuv pool (default 4 threads). Ten tills logging in at doors-open = ~3 s of CPU total; acceptable. Do not log in in a retry-storm.
- Login DB trips: 1 `user.findUnique` with deep include (memberships, userRoles -> role -> rolePermissions -> permission; Prisma issues multiple queries, ~5-6) + audit write(s) + `user.update` + `session.create` + `refreshToken.create` => roughly 10-14 round trips. Tokens embed roles+permissions (`quick-pin.service.ts:680`).
- Per-request overhead: `JwtStrategy.validate` (`jwt.strategy.ts:35-112`) does 1 `session.findUnique` with user join (2 queries) on EVERY authenticated request; roles/permissions come from the JWT payload, and the extra user->roles->permissions query only runs when the token lacks them. `lastActivityAt` update is fire-and-forget and throttled to once per 60 s. `PermissionGuard` is pure in-memory (`common/guards/permission.guard.ts`). `BranchContextGuard` caches (user, branch) context for 30 s in memory (`branch-context.guard.ts:35`), so ~0 queries when warm, 2-3 when cold.
- Order hot path (counted from code, `orders.service.ts`, `payments.service.ts`):
  - `createOrder`: assertWaiterShiftOpen (1 query, waiters only), optional table lookup (1), generateOrderNumber (1), `order.create` (1), audit (1) = ~4-5.
  - `addOrderItem`: order lookup (1), shift check (1), computeLinePricing (menuItem 1; +2 per modifier group; recipeIngredient 1), `orderItem.create` (1), recalcOrderTotals (items 1 + discount 1 + order.update 1), audit (1) = ~9-12 per line item.
  - Close with payment (`closeOrderWithPayment`, `payments.service.ts:149`): order lookup, paymentIntent findFirst/findMany (1-2), `$transaction` (payment.create + order.update + begin/commit, ~4), audit (1-2), getOutstandingBalance (2) = ~9-11. `transitionOrder` (status change) is another ~4-6 plus optional table/reservation work.
  - A whole "create + 1 item + pay/close" sale is therefore roughly 25-30 DB round trips + 2 per authenticated HTTP call (3-4 calls => +6-8). ~30-40 round trips total. At Neon same-region RTT of 1-5 ms this is 50-200 ms; across oceans (100+ ms RTT) it is 3-4 s, so the API/VPS MUST be in the same cloud region as Neon.
- Concurrency defect: `generateOrderNumber` is "find last order by createdAt, +1" (`orders.service.ts:68-82`, comment claims "concurrency-safe via DB") with `@@unique([branchId, orderNumber])` (`schema.prisma:1351`). Ten tills creating simultaneously WILL occasionally compute the same number and hit a unique violation (P2002, likely surfaces as 500). The new quick-sale endpoint must not reuse this function without a retry loop, DB sequence, or per-till prefix. Highest-severity code risk found.
- Neon: `PrismaService` eager-connects with retry for cold starts (`prisma.service.ts`). No autosuspend notes in repo beyond the comment. Nothing is cached except the branch-context cache. Dashboards/reports are computed by live queries (no read cache found).
- Other: JWT access TTL 15 m, refresh 7 d - tills will refresh mid-event; make sure the web client handles the 401->refresh path (not verified).

---------------------------------------------------------------------
## 7. Web app deploy

- `apps/web`: Next.js `14` (pages router: `src/pages/{index,login,cashier,manager,supervisor,waiter}`), React 18, Tailwind 3.4, TanStack Query 5. `next.config.mjs` contains only `reactStrictMode` and `modularizeImports` for phosphor icons: no `output` (no standalone), no rewrites, no images config, no headers.
- Build: `next build` (`apps/web/package.json`). No `vercel.json` anywhere in POS (`find -maxdepth 3`). No Dockerfile/compose/Caddyfile/Procfile/fly/render config anywhere in POS.
- Vercel from the monorepo: workable without a config file, via project settings: Root Directory `apps/web`, enable "Include source files outside of the Root Directory" (not required: web has no workspace deps, only `next`, `react`, `@tanstack/react-query`, etc.), Install Command `cd ../.. && pnpm install --frozen-lockfile` (or leave default, Vercel detects `pnpm-lock.yaml` at root), pnpm 8.15.0 per `packageManager` in root `package.json` (Vercel picks pnpm from lockfile version; pin via corepack/`packageManager`), Node 22 (root `engines >=22`; set Node 22.x in Vercel). Build Command default `next build`; turbo is not needed for web. UNKNOWN: whether `next build` passes lint/typecheck cleanly on this branch (not run - read-only); run once in the build session.
- Required env: `NEXT_PUBLIC_API_BASE_URL=https://<api-domain>` (no `/api`), optional `NEXT_PUBLIC_DEFAULT_BRANCH_ID`. Without it the bundle points at `http://localhost:3001` (`client.ts:59`) - the ONLY hard-coded localhost in `apps/web/src` (plus error-message text). 
- PWA: no manifest, no service worker (grep `manifest|serviceWorker|workbox` finds only a match in `_app.tsx`, likely a `<link rel="manifest">`-style or unrelated string; no manifest file in `public/`, which holds `brand/` and `favicon.svg`). Tablets will use the browser tab; "add to home screen" works but without offline support. No offline mode: a venue Wi-Fi drop stops sales.
- Mixed content: the API must be HTTPS if the web app is HTTPS (Vercel), so Caddy/Let's Encrypt on a real domain is required (an IP-only API will be blocked by the browser).

---------------------------------------------------------------------
## 8. CI

`.github/workflows/branch-validation.yml` only (one file): triggers on push to `milestone/**`, `feature/**`, `fix/**` and PRs to `master`/`main`. Job `validate`: checkout, pnpm 8, Node 22, `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm lint`, API unit tests (`--passWithNoTests`). Job `e2e` (PRs only): uses secrets DATABASE_URL / DIRECT_DATABASE_URL and the stale `JWT_SECRET`, runs `test:e2e` against a real DB (WARNING: points a test suite at whatever DB the secret names; ensure it is not the production Neon).
Missing for a deploy: no build job (`nest build`, `next build`), no Docker build/push, no deploy step, no migration step, no health-check smoke, no web typecheck, no branch trigger for `concert/**`. Vercel Git integration or Dokploy webhook would cover deploy without new Actions.

---------------------------------------------------------------------
## 9. Hotel-product (HMS) deployment pattern, structure only

Located in `$HOME/mnt/Nimbus/HMS`, mirrored in `demo-deploy` and `pilot-deploy`. Files: `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.caddy.yml`, `Caddyfile`, `.dockerignore`, `.env.example`, `.env.production.example`, `.env.staging.example`, `.vercelignore`, `.vercel/`, `vercel.json` (demo-deploy), `.github/workflows/ttlock-poll.yml`, `scripts/backup.sh`, `docs/deploy.md`, `.githooks/pre-push`.
- Dockerfile: 3 stages on `node:22-bookworm-slim` (Debian, not Alpine, with `openssl` installed for Prisma): `deps` (npm ci + prisma generate) -> `builder` (npm run build) -> `runner` (non-root user uid 1001, copies `.next/standalone`, `.next/static`, `public`, `CMD node server.js`, port 3000). Explicitly does NOT run `prisma migrate deploy` in the image (migrations are a manual step).
- `docker-compose.prod.yml`: services `db` (postgres:16-alpine + volume + healthcheck), `app` (build ., env DATABASE_URL, NODE_ENV=production, UPLOAD_DIR, volume `uploads`, joins default + external network `nimbus-edge`), `toolbox` (profile `tools`, builds the `builder` stage for `migrate deploy`/admin scripts). Run twice with `-p nimbus-production|nimbus-staging --env-file`.
- `docker-compose.caddy.yml`: single shared `caddy:2-alpine` on ports 80/443 with volumes `caddy_data`, `caddy_config`, external network `nimbus-edge`.
- `Caddyfile`: one site block per hostname, `reverse_proxy <stack>-app:3000`; Let's Encrypt automatic; DNS must point at the VPS first.
- `vercel.json` (demo-deploy): only `regions: ["fra1"]` and one cron.
- `docs/deploy.md` sections: VPS setup, pre-deploy check, first deploy, routine deploy, rollback, logs, backups (rclone to B2), uptime monitoring, "seed never runs against production". `scripts/backup.sh` is a host cron job (pg_dump to rclone offsite).
- NOT found: Dokploy artifacts. The pattern is Docker Compose + shared Caddy on a VPS with a local Postgres container (HMS uses its own DB, not Neon). For POS, drop the `db` service and use Neon.
Copyable quickly to POS: the Caddy compose + Caddyfile (change hostname + upstream `pos-api:3001`), the Dockerfile skeleton (adapt: pnpm workspace, `nest build`, `node dist/main`, keep openssl + non-root), the compose `toolbox` profile idea for `prisma migrate deploy`, `docs/deploy.md` structure, `backup.sh` ideas (replace with Neon branch snapshot).

---------------------------------------------------------------------
## 10. Proposed deployment plan (under one day of work) [P]

Target layout:
- Neon: NEW separate production project (region matching the VPS; pooled URL for runtime, direct URL for migrate). Never reuse the dev/shared project.
- API: 1 container on a VPS in the same region as Neon, Docker Compose + shared Caddy (HMS pattern; no Redis, no DB container). Dokploy is an alternative that needs no compose/Caddy files (Dockerfile + env + domain in the UI, set healthcheck on body).
- Web: Vercel project, root dir `apps/web`, env `NEXT_PUBLIC_API_BASE_URL=https://pos-api.<domain>`.
- DNS: `pos-api.<domain>` A-record to the VPS; Caddy auto-TLS. `pos.<domain>` on Vercel.

Files to add (on the concert branch cut from 5a35a18):
1. `apps/api/Dockerfile` (multi-stage from HMS pattern: node:22-bookworm-slim + openssl; corepack pnpm@8.15.0; `pnpm install --frozen-lockfile`; `pnpm db:generate`; `pnpm --filter @nimbus-pos/api build`; runner copies workspace needed for `node apps/api/dist/main.js`, or use `pnpm deploy --prod`; non-root; EXPOSE 3001).
2. `.dockerignore` (node_modules, .git, `Front End`, `*.zip`, `_newman*`, `_qa-logs`, `_to_delete`, `.env*`).
3. `docker-compose.api.yml` (service `pos-api` + `toolbox` profile running `pnpm db:migrate:deploy`; env_file `.env.production`; healthcheck on body; joins external network `nimbus-edge`; restart unless-stopped; volume for `uploads` only if documents used).
4. `docker-compose.caddy.yml` + `Caddyfile` (copy from HMS; upstream `pos-api:3001`; add access log; optional per-IP rate limit on `/api/auth/*`).
5. `.env.production.example` (names only; see checklist).
6. `docs/deploy.md` (runbook: first deploy, routine deploy, rollback, backup, event-day).
7. Vercel: no file needed (project settings), optionally `apps/web/vercel.json` with `{"regions":["fra1"]}` matched to the API region.
8. Small code edits required (separate build tasks): `trust proxy`; health returns HTTP 503 on DB error; quick-sale endpoint with safe order numbering; production seed script/guard.

Env var checklist
- Owner must set: DATABASE_URL (pooled), DIRECT_DATABASE_URL, API_CORS_ORIGINS, NEXT_PUBLIC_API_BASE_URL (Vercel), NEXT_PUBLIC_DEFAULT_BRANCH_ID (Vercel, optional), NODE_ENV=production, API_PORT=3001, domain/DNS.
- Generated (openssl rand, store in password manager, never commit): JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, QUICK_PIN_PEPPER (set before issuing any PIN and never change).
- Leave unset: PAY_MTN_*, PESAPAL_*, SMTP_*, SMS_PROVIDER_API_KEY, SLACK_WEBHOOK_URL, NIMBUS_EXPOSE_RESET_TOKENS, REDIS_URL.

Health checks: Caddy/Docker/uptime monitor on `GET /api/health` and assert `"status":"ok"` in the body (200 even on DB failure today). Add an external pinger (UptimeRobot) with keyword check.

Deploy sequence (day-by-day, evidence-gated)
1. D-6 (Sat 22): cut branch from 5a35a18; add Dockerfile/compose/Caddy; create Neon prod project; set env; run `prisma migrate deploy` (direct URL) from the toolbox; boot API; curl health.
2. D-6/D-5: seed strategy (section 5): roles+permissions+concert org/branch/users/menu only; change all PINs; no demo accounts.
3. D-5: Vercel project, set env, deploy; test login from one tablet over real mobile data.
4. D-4/D-3: land the quick-sale endpoint (build session), rerun migrations, load test.
5. D-2: venue Wi-Fi/4G dry run with 2-3 real tablets; freeze (no deploys after D-2 noon unless fix).
6. D-1 (Fri 27): final deploy, Neon backup branch ("restore point"), full rehearsal, print the rollback card.

Backup / restore-branch step before the event: in Neon, create a branch from the production main branch named `pre-event-2026-11-27` (a copy-on-write restore point) after the final migration+seed; and again at doors-open (`pre-doors-2026-11-28`). Rollback of data = Neon branch restore (or point `DATABASE_URL` at the restore branch); rollback of code = `docker compose` redeploy of the previous image tag (tag every build with the git SHA; keep the last 2 images). Postgres enum values cannot be dropped, so schema rollback = forward-fix or branch restore (`CLAUDE.md:2021`).

Event-day checklist: Neon compute autosuspend OFF (or min compute 0.25+ always-on) on the prod branch; tail `docker logs -f pos-api` and Caddy access log; `/api/health` monitor with phone alert; second device logged in as manager for the live view; a kill switch = in Caddyfile return 503 for `/api/<quick-sale-route>` (or toggle a feature flag/env in the new endpoint), plus a paper/offline fallback (Wi-Fi/4G failure has no offline mode in the web app); 4G hotspot as backup uplink; do not deploy during the event.

Load-test sketch (10 tills): tool k6 (or autocannon). Script outline: setup() logs in 10 distinct cashier PIN users via `POST /api/auth/quick-pin-login` (header `X-Platform: POS_DESKTOP`, body {branchId, pin} - confirm exact DTO), stores each JWT; default function per virtual user (10 VUs, one per till): loop `POST <quick-sale>` with random items and `Idempotency-Key` header, sleep 5-15 s (about 6-12 sales/min/till = 60-120/min total, ~2x the expected peak), plus 1 VU polling the live view every 3-5 s with the manager token. Run 15 min plus a 2-minute spike at 3x. Pass criteria: p95 sale latency < 800 ms and p99 < 1.5 s; error rate 0% on 5xx and 0 duplicate order numbers/sale IDs; no P2002 in logs; API container CPU < 70 % and memory flat; Neon connections < pool max; totals reconcile (sum of sales in live view == sum posted by script); no 401 storms after token expiry (run one test with a 16-minute window to cross the 15 m access TTL). Run it against a Neon branch copy, never the prod event data.

---------------------------------------------------------------------
## 11. Risks and unknowns (most severe first)

1. Order-number race (`orders.service.ts:68-82`): duplicate `branchId+orderNumber` under 10 concurrent tills -> unique violation / failed sale. The new quick-sale endpoint must use a safe sequence. (Severity: sale-loss.)
2. No production seed guard; the seed creates known-password owner/manager accounts and demo data (`seed.ts:1822-1890`). Running it on prod as-is = public credentials; skipping it = no roles/permissions/users and no login.
3. Insecure fallbacks: unset JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / QUICK_PIN_PEPPER silently use public defaults (no boot failure); unset NODE_ENV leaks password-reset tokens in API responses (`password-lifecycle.service.ts:117`). Fail-fast env validation does not exist.
4. Repo has never been deployed; no Dockerfile, no compose, no vercel config, no build CI. Whether `nest build` + `next build` succeed in a clean container and whether the Prisma client resolves in a pnpm container are UNVERIFIED (read-only audit, nothing was built).
5. Rescued branch exists only on the `backup` remote and on the Mac; the working tree is an uncommitted mixture (127 dirty files, 2 files missing). Loss/divergence risk until it is pushed to origin.
6. No offline mode in web, no PWA; venue connectivity is a single point of failure. API has no rate limit and PIN login has no IP throttle (guessable 6-digit PINs if the API is public).
7. Health endpoint returns 200 when the DB is down; default healthchecks will report healthy.
8. Neon cold start/autosuspend: the first request after idle may take seconds; the Prisma retry only covers boot. Needs autosuspend off and a warm-up before doors.
9. `req.ip`/audit IPs will be the proxy address; request logging is minimal, so incident forensics rely on Caddy logs.
10. In-memory branch-context cache and uploads on local disk: fine for one container, wrong if scaled out or if the container is recreated without a volume.
11. Web is baked to one API URL at build time; CORS requires exact origins (preview deployments blocked); mixed-content rules require HTTPS API.
12. CI `e2e` job points at secret DB URLs; stale `JWT_SECRET`; risk of tests touching a real DB if a secret is repointed.
13. UNKNOWN: the quick-sale endpoint does not exist yet in this branch (no `quick-sale` matches in `apps/api/src` or `schema.prisma`); live-view approach (polling vs the existing `GET /api/stream/metrics` SSE) not decided; exact Quick-PIN login request DTO; Neon region/plan of the user's account; whether the runtime Prisma client requires `DIRECT_DATABASE_URL`; whether `.env`-style prod values for other products can be reused (not opened).
