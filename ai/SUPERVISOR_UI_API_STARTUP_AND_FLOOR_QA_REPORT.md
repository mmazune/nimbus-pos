# Supervisor UI API Startup and Floor QA Report

Date: 2026-07-04  
Repo: `C:\Users\arman\Desktop\nimbus-pos`  
Scope: API startup/bind diagnosis and authenticated Supervisor Floor QA follow-up. This was not a new feature milestone.

## 1. Context Snapshot

`ai/AI_STATUS.md` previously marked `SUPERVISOR_UI_PROMPT3_FLOOR partial / browser QA follow-up required` because web reached `/login` but the API did not bind to `localhost:3001` inside the 120-second smoke window.

## 2. Guardrails

- No Prisma schema changes.
- No migrations.
- No seed or demo import writes.
- No Postman collection edits.
- No backend business logic changes.
- Existing dirty worktree changes were preserved.

## 3. Skills Used

Read the required investigation and browser/design skills for this follow-up: Vercel investigation mode, browser control, agent-browser fallback notes, impeccable, frontend-design, make-interfaces-feel-better, and web-design-guidelines.

## 4. Startup Diagnosis

Initial port checks found no listener on `3000` or `3001`.

`corepack pnpm@8.15.0 dev` from `apps/api` started Nest watch mode, but the log stayed at:

```text
[21:51:19] Starting compilation in watch mode...
```

No API listener appeared on `localhost:3001` after roughly 150 seconds.

The compiled path worked:

```powershell
corepack pnpm@8.15.0 exec nest build --builder tsc --path tsconfig.build.json
node dist/main
```

The build command exceeded the shell timeout while still compiling, then finished shortly after polling. `apps/api/dist/main.js` existed and the compiled API started successfully.

## 5. Root Cause / Narrowed Cause

The local API issue is narrowed to slow/quiet Nest watch compilation exceeding the QA readiness window. The compiled application itself binds successfully and serves the expected routes.

No startup code change was made because the app already binds correctly through the compiled path and there was no safe, evidence-backed backend fix to apply.

## 6. Health Check

With `node dist/main` from `apps/api`, port `3001` listened on `0.0.0.0` / `::`.

`GET http://localhost:3001/api/health` returned:

```json
{"status":"ok","db":"ok"}
```

Final health check timestamp observed: `2026-07-04T19:47:40.200Z`.

## 7. Web Startup

`corepack pnpm@8.15.0 dev` from `apps/web` started Next on `http://localhost:3000`.

`GET http://localhost:3000/login` returned `200`.

## 8. Browser Tooling Result

The in-app Browser webview failed to attach twice. The documented fallback `agent-browser` binary was unavailable in this workspace. QA therefore used clean headless Chrome through CDP plus direct API checks where CDP interaction proved flaky.

## 9. Auth QA

Verified:

- Supervisor password login: `POST /api/auth/login` returned `201`.
- Supervisor Quick PIN login: `POST /api/auth/quick-pin-login` with `branchId`, `pin`, and `platform=POS_DESKTOP` returned `201`.
- `/api/auth/me` resolved Supervisor default branch `cb27be401a2c35dfc0d4e610`.

## 10. Supervisor Floor Browser QA

Authenticated Chrome/CDP QA loaded `/supervisor/floor` with real API data:

- URL: `http://localhost:3000/supervisor/floor`
- table cards: `28`
- shell nav: Floor, Orders, Reservations, Approvals, Me
- summary: Total `28`, Available `19`, Occupied `6`, Reserved `3`, Blocked `0`, Other `0`
- search check: `QA-OPEN-01` narrowed visible cards to `1`
- Available filter check: `19` visible cards

## 11. Table Detail / Status QA

The browser-rendered table detail panel exposed `Table Status Update`.

The authenticated API status mutation was tested and restored immediately:

```text
QA-OPEN-01: OCCUPIED -> AVAILABLE -> OCCUPIED
RESTORED=True
```

Endpoint used: `PATCH /api/tables/:id/status` with `X-Branch-Id`.

## 12. Placeholder Route QA

Next route HTTP checks returned `200` for:

- `/supervisor/orders`
- `/supervisor/reservations`
- `/supervisor/approvals`
- `/supervisor/me`

The source for those pages was inspected and remains placeholder/shell content without fake operational rows.

## 13. Waiter/Cashier Regression

Waiter authenticated browser check passed:

- `/waiter/floor` loaded for `waiter@nimbus.demo`.
- Waiter was blocked from `/supervisor/floor` by the Supervisor role guard.

Cashier API auth and `/auth/me` context passed for `cashier@nimbus.demo`, including `CASHIER` role, default branch, and cashier permissions. Cashier CDP route verification was inconclusive because the CDP harness timed out/bounced during `/cashier/queue`; no Cashier source files were changed in this follow-up.

## 14. Validation

Passed:

```powershell
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate
```

The demo validation was a dry run with `zeroDatabaseWrites: true`.

API validation used the compiled build/start path:

```powershell
corepack pnpm@8.15.0 exec nest build --builder tsc --path tsconfig.build.json
node dist/main
```

## 15. Postman

No Postman files were changed. This follow-up did not add or alter API contracts.

## 16. Files Changed

- `ai/AI_STATUS.md`
- `ai/SUPERVISOR_UI_API_STARTUP_AND_FLOOR_QA_REPORT.md`
- `ai/SUPERVISOR_UI_PROMPT3_FLOOR_COMPLETION_REPORT.md`
- `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md`
- `repo file tree.txt`

## 17. Commands To Reproduce

```powershell
cd C:\Users\arman\Desktop\nimbus-pos
corepack pnpm@8.15.0 exec nest build --builder tsc --path tsconfig.build.json
cd apps/api
node dist/main
```

In another shell:

```powershell
cd C:\Users\arman\Desktop\nimbus-pos
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev
```

Then verify:

```powershell
Invoke-WebRequest http://localhost:3001/api/health
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate
```

## 18. Remaining Issue

The only remaining issue is local tool/process ergonomics: Nest watch startup is too slow/quiet for the 120-second QA window, and the in-app Browser/CDP harness was intermittently unreliable. The compiled API path is usable for authenticated QA.

## 19. Recommended Next Prompt

Proceed to Supervisor Orders only after accepting this QA handoff:

> Build Supervisor UI Prompt 4: Orders exception oversight. Use existing verified order APIs only; do not clone Waiter order entry or Cashier checkout; preserve no backend, Prisma, migration, seed, or Postman changes unless explicitly requested.

## 20. DONE Checks

- Used only `C:\Users\arman\Desktop\nimbus-pos`.
- Read mandatory context and existing Postman inventory.
- Preserved unrelated dirty worktree changes.
- Diagnosed API dev-watch startup without speculative backend edits.
- Verified compiled API binds to `localhost:3001`.
- Verified `/api/health` returns `db: ok`.
- Verified Supervisor password login.
- Verified Supervisor Quick PIN login.
- Verified authenticated `/supervisor/floor` browser load.
- Verified real floor counts and table cards.
- Verified floor search/filter behavior.
- Verified table detail/status update contract and restored status.
- Verified Supervisor placeholder routes return 200.
- Verified Waiter route/role guard.
- Verified Cashier auth context by API; CDP route run inconclusive.
- Ran web typecheck.
- Ran web lint.
- Ran demo dry-run validation with zero database writes.
- Changed no code, migrations, seed, or Postman files.
