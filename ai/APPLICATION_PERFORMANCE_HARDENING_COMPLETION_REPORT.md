# Application Performance Hardening Completion Report

Date: 2026-07-18  
Repo: `C:\Users\arman\Desktop\nimbus-pos`  
Status: Prompt 4 browser-pending blocker closed; shared performance foundation hardened; strict local latency targets partially unmet. No commit or push.

## Initial State

- Confirmed repo path: `C:\Users\arman\Desktop\nimbus-pos`.
- Initial branch: `main...origin/main`.
- Preserved existing Prompt 1-4 worktree changes and untracked waiter reports/components.
- Running processes found: Nimbus API on `3001` from old compiled `apps/api/dist/main`, Nimbus web dev on `3000`, unrelated Kura web app on `3002`, and MCP/plugin Node processes. Only Nimbus API/web processes were restarted.
- Temporary diagnostics used: `.codex-temp/perf-qa.spec.js`, Playwright `test-results/`, and temp logs under `%TEMP%`.

## Measurement Method

- Direct Prisma timing for connect/query/auth/floor probes.
- Direct HTTP timing with Node `fetch` for auth, `/auth/me`, floor/menu, cashier, supervisor reads.
- Browser QA through a temp Playwright runner outside the repo at 1440x900, collecting request counts, duplicate requests, failures, console errors, and slow endpoints.
- Cold and warm samples were recorded separately after API/web restarts.

## Root Causes Found

- JWT validation reloaded the full user role-permission graph and touched session activity on every protected request.
- `/api/auth/me` repeated user/session role work already completed by JWT validation.
- `BranchContextGuard` did duplicate membership and branch lookups for every branch-scoped request.
- Quick PIN login performed a duplicate branch lookup even though membership already included branch/org context.
- Frontend mutations awaited broad invalidation/refetch groups before clearing pending UI.
- Cashier queue mounted per-order payment reads for the whole order list: browser QA showed 101 API requests and 15s tail latency.
- Cashier receipts and Supervisor orders had similar list-level fan-out patterns.
- The shared API client had no bounded timeout/correlation support before this pass.
- Local Next dev served a stale `.next` chunk once; clearing `.next` and restarting fixed the dev-only blocker.

## Changes Made

- Added role/permission claims to access tokens and reused those claims in JWT validation.
- Reduced `/auth/me` to reuse current request user/session claims and fetch memberships + employee concurrently.
- Added short-lived branch-context cache and in-flight dedupe to `BranchContextGuard`.
- Removed duplicate branch lookup from Quick PIN success path and parallelized success session creation with failed-attempt reset.
- Added `X-Request-Id`, timeout support, empty-body-safe parsing, AbortController wiring, and retryable timeout errors to the web API client.
- Quick PIN login now routes immediately from branch/org session context and hydrates richer `/auth/me` profile in the background.
- Converted waiter, cashier, supervisor mutation-success invalidations to non-blocking targeted invalidation where canonical response was already secured.
- Removed list-level N+1 payment/receipt fan-outs from Cashier Queue, Cashier Receipts, and Supervisor Orders; selected rows still fetch detail/payment data.
- Increased the bounded default API timeout to 30s to avoid false local cold-start failures while still releasing the UI with Retry.

## Timings

Baseline direct HTTP before hardening:

- Health: 3.5s.
- Waiter Quick PIN: 7.0s in one early run; previous Prompt 4 status recorded ~12.3s.
- Waiter `/auth/me`: 7.9s; previous Prompt 4 status recorded ~9.1s.
- Waiter menu navigation/catalog: 3.6s / 5.8s in early corrected probe; previous Prompt 4 status recorded ~10.8s / ~18.9s.
- Cashier queue startup had 101 browser API requests due per-order payment fan-out.

After hardening, direct warm samples:

- Health: 238-503ms warm after initial 1.1s sample.
- Quick PIN: 9.9s cold-ish, then 6.1s, then 3.8s warm.
- `/auth/me` after Quick PIN: 3.1s cold-ish, then 2.4s, then 1.46s warm.
- Cashier password login: 3.9s, 2.8s, 2.9s warm samples.
- `/auth/me` after password: 2.9s, 1.48s, 1.94s.

Browser QA after hardening at 1440x900:

- Waiter: login-to-floor 14.0s cold/local, table-to-workspace 182ms, configurator open 5.6s because item detail endpoint took 5.4s. Request count 13; no duplicate API responses; no console errors. One background `/auth/me` was aborted by navigation and did not block shell.
- Cashier: startup request count reduced from 101 to 9. Slowest list read after N+1 removal was the primary order list at 4.5s; selected order/payment reads were single-row only.
- Supervisor: startup request count 7; slowest API login 3.5s, `/auth/me` 2.6s, tables 1.7s.

## Prisma / API Findings

- Direct Prisma showed Neon/local DB round trips around ~470ms warm, with heavier role/membership includes taking 1.6-2.6s.
- One Prisma client per API process remained the intended model; the main issue was request count and repeated graph reads, not new speculative indexes.
- No schema migration or index was added because evidence pointed to repeated remote round trips and frontend fan-out, not a missing index.
- Audit writes remain awaited for auth success/failure paths; no audit guarantee was weakened.

## API Client / React Query / Render Changes

- API client now sends correlation IDs and supports bounded cancellation/timeout.
- Shared React Query defaults already had `staleTime: 30_000`, `refetchOnWindowFocus: false`, and one retry; role screens now avoid large list fan-out and broad awaited invalidation.
- Mutations now clear local pending state after the required canonical response, while secondary refreshes continue in the background.
- No redesign was performed; waiter Floor/menu, Cashier, Supervisor workflows and visual decisions were preserved.

## Validation

- `corepack pnpm@8.15.0 --version`: 8.15.0.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`: passed.
- Focused API tests: `quick-pin.service.spec.ts` passed after the final Quick PIN edit; earlier focused auth/branch/orders tests passed in the same pass.
- Postman JSON validation: 56 collection files parsed successfully.
- `GET http://localhost:3001/api/health`: 200 with `db:"ok"`.
- Authenticated Playwright smoke: Waiter/Cashier/Supervisor passed at 1440x900.

## Remaining Limitations

- Neon/local warm latency still prevents every target from passing: Quick PIN can still exceed 3s and menu item detail can exceed 5s under this environment.
- Browser QA at 1366x768 and 1920x1080 was attempted earlier but not rerun after the final N+1 fix due runtime budget; the passed automated smoke is 1440x900.
- Password login still blocks on `/auth/me` for branch resolution; Quick PIN avoids that for branch-bound sessions.
- Cashier and Supervisor list payment state is no longer eagerly enriched for every row; selected-row details remain authoritative.
- A future backend pass should add aggregated payment/receipt summary fields to list endpoints if list enrichment is required without N+1 calls.

## Final Status

The Prompt 4 browser-pending blocker is closed: browser mutations no longer wait on unrelated invalidations, list request storms are removed, role shells render more promptly, and validation passed. Strict local latency targets are not fully met in this environment: Quick PIN, catalog/detail, and some list reads can still exceed target during cold or noisy Neon/local runs. Residual latency is documented as external/backend round-trip cost requiring future aggregate endpoints or local DB/pool work, not frontend pending-state deadlock.
