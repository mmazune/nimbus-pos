# Completion Report — Waiter Instant Table-to-Menu Flow

## Context Snapshot

- Current milestone: locked waiter interaction decision 8 / instant table-to-menu flow.
- Previous completed milestone: `WAITER_PREMIUM_MENU_ORDER_ENTRY`.
- Next milestone: none assigned; preserve existing waiter scope and deferred hardware waves.

## Summary

- Selecting a waiter-operable table now synchronously renders the full menu workspace instead of a centered draft-resolution card.
- Floor prefetches menu navigation and catalog after authenticated branch resolution and keeps active orders in its table view models.
- Existing waiter-owned orders attach from Floor cache and refresh canonical detail without blocking.
- Available tables render the menu first, then create the backend-authoritative dine-in order in the background. Pending and failure states live only in the order panel.
- Early item selection waits on one shared order-creation promise and commits exactly once after a verified order ID exists.
- Reserved seating forwards the returned linked order directly; other-waiter occupied tables remain blocked.

## Files Added / Changed

- `apps/web/src/lib/waiter/order-api.ts` — shared parallel navigation/catalog loader.
- `apps/web/src/lib/waiter/floor-model.ts` — active-order summary on table models and order-first action resolution.
- `apps/web/src/components/waiter/floor/WaiterFloorScreen.tsx` — menu prefetch, immediate selection override, cache handoff, and performance marks.
- `apps/web/src/components/waiter/floor/WaiterTableWorkspace.tsx` — removed blocking start workspace and forwards cached/created/seated order context.
- `apps/web/src/components/waiter/orders/WaiterOrderBuilderScreen.tsx` — menu-first shell, cached order placeholder, background order creation, queued add, inline retry, and timing measures.
- `apps/web/README.md`, `ai/AI_STATUS.md`, `repo file tree.txt` — current behavior and completion tracking.

## Database

- Prisma models, migrations, and indexes: none.
- Seed updates: none.
- Authenticated QA used the existing demo database and created waiter demo orders as normal workflow data; no schema or seed mutation was made.

## API

- Modules, endpoints, and contracts: unchanged.
- Existing reads used: tables, active orders, reservations, menu navigation/catalog, order detail, and item configuration.
- Existing writes used: dine-in order create and order-item add.
- Existing guards and audit behavior remain authoritative. The frontend prevents duplicate create/add dispatch with one in-flight promise and mutation pending states.

## Tests

- `corepack pnpm@8.15.0 --filter @nimbus-pos/web exec tsc --noEmit --pretty false` — passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` — passed with no warnings/errors.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` — passed.
- `/api/health` — HTTP 200, database healthy.
- Authenticated headless Chromium QA with `waiter@demo.local`:
  - new table click → shell 71.1 ms; warm menu 71.6 ms; inline pending 71.6 ms;
  - cached order click → shell 23.2 ms; menu 23.6 ms; cached order 23.6 ms;
  - menu catalog/navigation requested before click and not after click;
  - no `GET /api/pos/orders?...tableId=...` blocking lookup;
  - one order create, no duplicate on cached reopen;
  - item selected before order ID, then committed once after order resolution;
  - no prohibited checking/preparing/loading/resolving/starting copy, console errors, or request failures.

## Postman

- Collection added/updated: none; no endpoint, payload, status, auth, branch-header, or variable-flow contract changed.
- Existing waiter collection inventory was read before implementation as required.
- Manual checklist: health, password login, canonical branch context, Floor reads, menu reads, order create/detail, and item add were exercised by authenticated browser QA.
- Collection JSON validity is included in final verification; Newman was not rerun because the change is frontend orchestration only.

## Decisions / Deviations

- The Browser plugin was not installed, so the frontend testing skill's documented fallback was used: the existing local `playwright-core` runtime with installed Chromium.
- Wall-clock Playwright locator timings include automation overhead; acceptance is evaluated from in-app `performance.mark` measures at the table click handler and rendered states.
- The existing local API process was slow on item-configuration reads during stress QA, but direct authenticated endpoint checks returned 200 and the final end-to-end queued-item run passed.

## Known Issues

- Authenticated QA created normal demo workflow data, including an open waiter shift and draft orders on demo tables. These were not destructively cleaned up.
- Sent-order additions and serving changes remain governed by previously documented backend contract limitations and were not expanded.

## Next Step

- Run the same timing assertions in CI or a dedicated seeded QA database to avoid accumulating local demo draft orders.
