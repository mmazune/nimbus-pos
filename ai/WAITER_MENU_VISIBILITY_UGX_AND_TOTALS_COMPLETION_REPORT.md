# Waiter Menu Visibility, UGX, Totals - Prompt 4 Report

Date: 2026-07-18
Repo: `C:\Users\arman\Desktop\nimbus-pos`
Status: Implementation validated; app-wide Prompt 4 browser-pending blocker closed in `ai/APPLICATION_PERFORMANCE_HARDENING_COMPLETION_REPORT.md`, with strict latency targets partially unmet.

## Initial Worktree

- Branch: `main...origin/main`.
- Prompt 1-3 waiter work was already present and preserved, including the instant Floor-to-menu workspace, hidden Orders nav, minimal Floor cards, legacy order redirects, toast provider, waiter formatters, and waiter docs.
- Existing untracked Prompt 1-3 files included `ai/WAITER_INSTANT_TABLE_MENU_FLOW_COMPLETION_REPORT.md`, `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md`, `apps/web/src/components/waiter/floor/WaiterTableWorkspace.tsx`, `apps/web/src/components/waiter/orders/WaiterLegacyOrderRedirect.tsx`, and `apps/web/src/lib/waiter/formatters.ts`.
- Temporary QA artifacts created during this pass: `apps/web/nimbus-waiter-qa.spec.js`, `test-results/`, and normal database rows with `QA-P4-*` table labels.

## Root Causes

- Menu visibility: Tapas Downtown had active menu items but no imported menu browse groups, subgroups, or item browse assignments, so `GET /api/menu/navigation?activeOnly=true` was truthfully empty.
- UGX values: the CSV demo source already used realistic UGX amounts, but the older Prisma seed still hardcoded small decimal prices and skipped existing rows.
- Total inconsistency: item mutations waited for a slow canonical order refetch before updating cache, allowing stale zero/stale totals. A previous `fetchQuery` refresh could also return fresh cached data after delete.
- Send delay: `sendOrder` updated the DB, then awaited best-effort KDS ticket creation before returning to the waiter.

## Changes Made

- Added demo taxonomy CSVs for browse groups, browse subgroups, and item assignments.
- Extended the demo importer to validate/import/upsert menu browse taxonomy and assignments.
- Updated legacy seed prices and old order item snapshots to realistic UGX values.
- Centralized waiter money formatting and threaded branch currency context through auth/session.
- Corrected menu loading/failure/empty states so manager-configuration copy appears only after a successful empty navigation response.
- Replaced mutation cache refresh with direct canonical `getOrder` calls and immediate cache writes.
- Added pending/backend-derived order-line snapshots for item writes, with rollback on error and canonical refresh replacement.
- Made order send return after status transition; KDS ticket creation now runs best-effort in the background.
- Hardened backend order item pricing against inactive item, serving, or modifier option usage.
- Switched waiter React Query retry behavior away from 4xx retries and cached menu/item configuration deliberately.

## API And Postman Findings

- `GET /api/menu/navigation?activeOnly=true` for Tapas Downtown now returns FOOD/DRINKS with API-ordered groups/subgroups.
- `GET /api/menu/catalog` returns realistic prices such as Crispy Plantain Cups `18000`.
- All 56 existing Postman JSON files parsed successfully. No Postman collection was edited because no endpoint path/payload contract was intentionally changed.

## Performance Findings

- After cleanup to one API process, direct local timings were still slow: Quick PIN ~12.3s, `/auth/me` ~9.1s, active shift ~7.3s, tables ~3.9s, active orders ~14.8s, reservations ~15.0s, navigation ~10.8s, catalog ~18.9s.
- Multiple Nest/API processes were found and stopped because they contributed to Prisma connection-pool pressure.
- Browser table-to-shell remains synchronous once Floor data is present; the remaining bottleneck is backend/API response latency.

## Demo Data And QA State

- Importer-created authoritative records: Tapas Downtown browse taxonomy and item assignments from `demo-data/csv/09a_*`, `09b_*`, and `09c_*`.
- Targeted DB update: inactive `Event Platters` browse group where it had no Tapas items.
- Browser/direct QA-created state remains intentionally active and documented: `QA-P4-*` tables, `ORD-000008` on `QA-OPEN-04`, and Prompt 4 test orders such as `ORD-000009` onward.
- These records are normal demo state, not importer-authored fixtures; distinguish them by label prefix and `metadata.source = browser-qa`.

## Validation

- `corepack pnpm@8.15.0 --version`: 8.15.0.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`: passed.
- Focused API tests for orders/menu/auth passed earlier in the pass; orders service test passed after the send-path change.
- `GET http://localhost:3001/api/health`: `{"status":"ok","db":"ok"}`.

## Browser QA

- Verified in browser runs: configured Tapas menu appears, no false menu configuration warning, FOOD/DRINKS render, groups/subgroups follow API, search works, realistic UGX values render, pending add line prevents stale zero display, and created DB order totals are realistic.
- Not completed: full authenticated QA cannot be claimed. Browser add-item confirmation remained pending long enough to keep edit/remove disabled, even though the DB write landed and direct API add returned in about 9s after process cleanup.
- Viewport attempts were made at 1366x768, 1440x900, and 1920x1080. Read-only menu checks reached the workspace in some runs, but final full-flow QA failed due the add-confirmation blocker and local API latency.

## Remaining Limitations

- Serving changes on existing lines remain blocked because the update contract does not accept `menuItemServingId`.
- Post-send additions remain blocked until per-line sent state or a dedicated additions-send contract exists.
- Local browser QA is blocked by API/Prisma/Neon latency and possible browser fetch confirmation behavior under that latency.

## Final Status

The original waiter data/UI fixes remain validated. The follow-up application-wide hardening pass removed the browser-pending mutation blocker, reduced duplicate auth/branch work, eliminated cashier/supervisor list fan-outs, and passed authenticated Waiter/Cashier/Supervisor browser smoke at 1440x900. Strict local latency targets are still partially unmet; residual Neon/local backend latency is documented in `ai/APPLICATION_PERFORMANCE_HARDENING_COMPLETION_REPORT.md`.
