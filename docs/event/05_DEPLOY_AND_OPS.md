# 05 — Deployment and event operations (H2, dry run, event day)

*21 Nov 2026. Detail: `research/G3_deploy_readiness.md` (G3 s…) and `research/D_event_ops_analytics.md`. Nothing here was built or run; a clean container build is unproven.*

## In short

- One API container behind Caddy on a VPS, the web app on Vercel, a **new** Neon project for the event. No Redis.
- Copy the hotel system's Docker and Caddy setup; it is the same pattern.
- Set three secrets, never run the full seed, take a restore branch before doors.

## 1. Layout

| Part | Where | Notes |
|---|---|---|
| API (`apps/api`) | VPS, Docker Compose + Caddy, HTTPS | `nest build`, `node dist/main`, port from `API_PORT` (default 3001; `PORT` is not read), global prefix `/api`. **Same region as Neon**: a sale is many round trips |
| Web (`apps/web`) | Vercel, root directory `apps/web` | Next 14 builds as is. `NEXT_PUBLIC_API_BASE_URL` is build-time and has no `/api` suffix |
| Database | New Neon project for the event | Pooled URL for runtime, direct URL for migrations. Autosuspend off 27–29 Nov |
| Redis, queues, cron | None | The API has no Redis, BullMQ or cron. `.env.example` lists `REDIS_URL` but nothing reads it |
| Email, SMS, Slack, MoMo, Pesapal | Off | They fall back to mocks or are disabled by default; leave their variables unset |

Files to add (H2): `apps/api/Dockerfile` (three stages, `node:22-bookworm-slim`, openssl, non-root, following `HMS`), `.dockerignore`, `docker-compose.api.yml` (api, plus a `toolbox` profile for `pnpm db:migrate:deploy`), `docker-compose.caddy.yml`, `Caddyfile`, `.env.production.example` (names only), `docs/event/DEPLOY_RUNBOOK.md`.

## 2. Environment variable names

| Name | Set by | Notes |
|---|---|---|
| `DATABASE_URL` | Moses | Pooled |
| `DIRECT_DATABASE_URL` | Moses | Migrations |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Generated (`openssl rand`) | **Have public defaults in code.** Must be set |
| `QUICK_PIN_PEPPER` | Generated | Has a public default. Set once; **never rotate** (it would invalidate every PIN) |
| `API_CORS_ORIGINS` | Moses | Exact origins, comma-separated: the Vercel domain |
| `API_PORT` | Compose | 3001 |
| `NODE_ENV` | Compose | `production`. If unset, password-reset tokens appear in API responses |
| `JWT_ACCESS_TTL` | Compose | `12h` for the event (EV-17) |
| `JWT_REFRESH_TTL` | Optional | Default 7d |
| `NEXT_PUBLIC_API_BASE_URL` | Vercel | `https://<api-domain>` |
| `NEXT_PUBLIC_DEFAULT_BRANCH_ID` | Optional | |
| Leave unset | — | `PAY_MTN_*`, `PESAPAL_*`, `SMTP_*`, `SMS_PROVIDER_API_KEY`, `SLACK_WEBHOOK_URL`, `NIMBUS_EXPOSE_RESET_TOKENS` |

`.env.example` is stale (lists `JWT_SECRET`, `PORT`, `WEB_PORT`, `REDIS_URL`; omits the real names). Secrets are set by Moses from his shell, never pasted into a session, and never printed.

## 3. API facts that matter

| Fact | Consequence |
|---|---|
| No throttler, no helmet, no swagger | Ten tills on one venue IP are not throttled. PIN login has only a per-user lockout (5 failures, 5 minutes): use 8-digit PINs for supervisors and managers |
| CORS allows `Authorization, Content-Type, X-Branch-Id, X-Platform, Idempotency-Key, X-Request-Id` | Enough for the till |
| Health returns HTTP 200 with `status: "error"` when the database is down | H2 changes it to 503; until then monitor by keyword |
| `trust proxy` not set | H2 sets it |
| Body limit 100 kb | Fine: one sale per request |
| 59 migrations, no extensions | `migrate deploy` on the new project |
| bcrypt cost 12, one compare per login | Login is slow (about 3.8 s warm was noted); cashiers log in once |
| Documents and exports write to local disk | Event reports stream instead (EV-24) |

## 4. Seed safety (EV-18)

`db:seed` creates demo owner and manager accounts with known passwords and a demo organisation, with no host guard. **Do not run it on the event database.** Use `event-setup.ts` (`03` §5). If a full seed is ever run on a database that will go live, rotate or delete every demo account before the URL is shared.

## 5. Order of the H2 day

1. Push the working branch to `origin` (Moses).
2. Create the Neon project; note its region; pick the VPS in that region.
3. Build the image locally; fix what a first-ever container build finds (Prisma client in a pnpm workspace is the likely one).
4. `migrate deploy` with the direct URL. Take a restore branch.
5. Run `event-setup.ts --dry-run`, read it, then run it. Print the PIN sheet.
6. Bring up the API behind Caddy. Check `/api/health`.
7. Deploy the web app on Vercel. Log in on a real tablet over mobile data.
8. Run `import-event-menu.ts --dry-run` for both branches, then the real run (needs O9).
9. Measure: p95 of quick-sale from a phone on MTN and on Airtel. Write it down.

## 6. Load test (Thu 26)

k6, against a Neon **branch copy**, not the live data: 10 virtual tills log in by quick PIN and loop `quick-sale` with fresh `clientSaleId`s at 6–12 sales a minute each, plus one poller on the summary; 15 minutes with a 3× spike.

Pass: p95 < 800 ms · no 5xx · no duplicate order numbers · every `clientSaleId` exactly once · CPU < 70% · summary totals equal the sum of the sales sent.

## 7. Before doors, and on the night

| When | Do |
|---|---|
| Thu 26 night | Freeze. Tag the image by git SHA |
| Fri 27 | Restore branch `pre-event`. Devices configured through `/event/setup`. One-hour training: every cashier rings a practice sale, takes cash, tags a card, sees an offline sale sync |
| Sat 28, before doors | Restore branch `doors-open`. Each till opens its shift and till with its float. Supervisor confirms every tablet shows "Synced" |
| During | One person watches `/event/live`, the API log and the Caddy log. Uptime monitor with a keyword check |
| If the API fails | Tills keep selling into their queues. Do not restart tablets. Fix or roll back to the previous image tag |
| If a tablet fails | Spare tablet through `/event/setup` with the same till code. The dead tablet's unsynced queue is lost unless it restarts: note the till and time on the paper sheet |
| If terminals fail | Cash and mobile money; signage |
| Close | Each cashier reconciles at `/cashier/till`. Supervisor fills the paper cash-up sheet: float, counted cash, terminal batch slip total, mobile-money total. Bag the batch slips per till |
| Sun 29 | Export `lines.csv`. Restore branch `post-event`. Do not delete anything |

## 8. Kit for 10 tills

12 tablets (10 + 2 spare) with stands · 16 power banks or docks · 2 dual-SIM routers (MTN and Airtel) plus a spare, 4 backup SIMs · one bank terminal per till plus 2 spares · cash floats, boxes, tamper bags · role-coloured lanyards · paper tally and cash-up sheets · printed mobile-money codes · tape, cables, lights, rain covers. Generator source UNKNOWN. From report D; quantities are its proposal.

## 9. Rollback

| Layer | Rollback |
|---|---|
| API | Previous image tag |
| Web | Previous Vercel deployment |
| Database | Additive migration; no down needed. Data: Neon restore branch |

## What is still unverified

- The Neon region and plan; which VPS (existing or new).
- A first container build and a first `next build` on the rescued branch.
- Whether the runtime Prisma client needs `DIRECT_DATABASE_URL` set.
- Venue connectivity and tablet models.
- Whether the vendors need URA e-receipts (O8).
