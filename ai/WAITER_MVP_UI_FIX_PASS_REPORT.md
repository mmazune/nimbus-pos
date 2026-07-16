# Waiter MVP UI Fix Pass Report

Date: 2026-07-01
Repo: `C:\Users\arman\Desktop\nimbus-pos`

## Scope

Focused waiter UI quality pass only. No backend guard changes, Prisma schema changes, migrations, Postman changes, payment collection, mobile-money checkout, live print driver, terminal/acquirer traffic, split/merge/transfer/move/void/close-order scope, or owner/manager/accountant screens were added.

## Context Snapshot

`ai/AI_STATUS.md` now records:

`WAITER_MVP_UI_FIX_PASS complete / lock screen and table cards polished (2026-07-01)`

The prior baseline was `WAITER_MVP_FINAL_QA complete / demo-ready (2026-07-01)`.

## Changes

- Created `ai/WAITER_MVP_KNOWN_LIMITATIONS.md` as the living limitations register.
- Updated `ai/AI_STATUS.md` with the UI fix pass completion line.
- Updated `repo file tree.txt` with the new waiter UI fix pass documentation files.
- Updated the login lock screen to remove tab/button icons, rename Quick PIN submit to `Enter`, keep Email submit as `Sign in`, and default local Quick PIN branch context to Tapas Downtown.
- Updated `demo-data/WAITER_UI_DEMO_SCRIPT.md` and `apps/web/README.md` to document the Tapas Downtown Quick PIN demo branch behavior.
- Replaced the Orders bottom-nav icon with the Phosphor `List` icon at size 44.
- Cleaned waiter floor table cards: removed couch icon, removed ready/start-order clutter, kept capacity on one line, added truncation/title handling for long table/order/waiter text, and preserved table click behavior.
- Removed the icon from the floor detail `Open order` action while preserving navigation to `/waiter/orders/[orderId]`.

## Known Limitations Register

Created `ai/WAITER_MVP_KNOWN_LIMITATIONS.md` with seeded limitations from the final QA report:

- Backend request-bill accepts NEW orders while the waiter UI blocks correctly.
- Me tab HR writes remain disabled without a safe linked employeeId.
- Shift swap creation remains read-only without a waiter-safe target selector.
- Local QA fixtures are not permanent demo import data.
- Public diner mobile-money remains provider-gated.
- Receipt send remains pending with no live adapter.
- Printer routes remain metadata-only.
- Terminal pairing remains stub-only.

Added one new limitation for this pass:

- Quick PIN local branch context is demo-defaulted to Tapas Downtown until a broader waiter-safe branch/terminal selector exists.

## Verification

Precheck:

- `corepack pnpm@8.15.0 --version` passed with `8.15.0`.
- API and web were not initially listening on ports 3001/3000, so the correct repo servers were started without killing unrelated processes.

Browser verification completed before context compaction:

- Quick PIN tab has no icon.
- Email tab has no icon.
- Branch context resolves to Tapas Downtown.
- Quick PIN `246810` enables `Enter`.
- Quick PIN login routes to `/waiter/floor`.
- Email login with `waiter@nimbus.demo` / `Demo1234!` routes to `/waiter/floor`.
- Floor cards are visually cleaned, no couch icon, no ready/start-order clutter.
- Occupied cards show ownership such as `Mine`, Peter Mugisha, Sarah Namutebi, or `Other waiter`.
- Capacity text stays on one line.
- Floor search and filters work.
- Other-waiter blocked/read-only panel still appears.
- Own occupied table opens order detail.
- `Open order` has no icon and opens `/waiter/orders/[orderId]`.
- Orders bottom nav uses a 44px Phosphor List icon and no Menu tab was added.

API-backed regression checks:

- Login worked for `waiter@nimbus.demo`.
- `/api/auth/me` returned Brian Kisekka with default branch `cb27be401a2c35dfc0d4e610`.
- `/api/shifts/active` returned active shift `DEMO-WAITER-OPEN`.
- Request bill on a sent order returned OK and remained backend-audited.
- Receipt preview/history loaded for a closed order.
- Receipt reprint returned metadata/action output only.
- Receipt send returned `PENDING`, `supported: false`, and `NO_LIVE_DELIVERY_ADAPTER`.
- Upcoming reservations loaded. Seat-guest live mutation was not run because no upcoming reservation was both `CONFIRMED` and table-assigned in the current local demo data.
- Logout endpoint returned successfully.

Validation commands:

- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate` passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` passed.
- `GET http://localhost:3001/api/health` returned `{"status":"ok","db":"ok"}`.
- Route smoke returned HTTP 200 for `/login`, `/waiter/floor`, `/waiter/orders`, `/waiter/reservations`, and `/waiter/me`.

Build/server note:

- Running `next build` while the dev server was active replaced `.next` artifacts and briefly made `/waiter/me` return a stale vendor-chunk 500 from the running dev process.
- Only the web process started for this pass was refreshed.
- After refresh, all route smoke checks returned HTTP 200.

## Servers Left Running

- API: `http://localhost:3001/api`, listener PID 20780.
- Web: `http://localhost:3000`, listener PID 2612.

## Result

Waiter MVP UI fix pass is complete. The lock screen, Quick PIN branch context, bottom nav Orders icon, floor table cards, and Open order panel were polished without changing protected backend scope or adding deferred payment, printer, terminal, Postman, Prisma, or migration work.
