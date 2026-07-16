# Cashier UI Authenticated Demo QA Report

Date: 2026-07-02
Repo: `C:\Users\arman\Desktop\nimbus-pos`

## Scope

Authenticated browser QA for cashier demo readiness after API startup was recovered. This was not a new feature milestone. No backend business logic, Prisma schema, migration, seed, demo import, or Postman collection was changed.

## Validation

- `corepack pnpm@8.15.0 --version` -> `8.15.0`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` -> pass
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` -> pass
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate` -> pass, dry-run only, `zeroDatabaseWrites: true`
- `GET http://localhost:3001/api/health` -> `{"status":"ok","db":"ok"}`

## Cashier Browser QA

| Area | Result | Evidence |
|---|---|---|
| Login | PASS | `/login` rendered `Service terminal`; email mode authenticated seeded cashier and routed to `/cashier/queue`. |
| Expired session | PASS after fix | Expired restore redirects showed user-facing login copy without Next dev overlay. |
| Queue | PASS | `/cashier/queue` showed Main Branch cashier shell, Queue/Receipts/Till/Me nav only, three active payable orders, bill-requested gap copy, checkout preview, payment history, PesaPal exclusion, and split bill/split item boundary copy. |
| Receipts | PASS after fix | `/cashier/receipts` settled to an honest empty state for current closed-order data and no longer held the screen in indefinite loading during the QA pass. |
| Till | PASS | `/cashier/till` showed active shift/till, cash position, safe drop and reconcile forms, deferred paid-in/paid-out/pickup copy, and disabled write buttons until valid inputs. |
| Me | PASS | `/cashier/me` showed profile/session, branch context, checklist, allowed scope, restricted surfaces, known limitations, demo help, and logout/session controls without exposing passwords or PINs. |
| Cashier nav boundary | PASS | No Floor/Menu/Payments nav appeared in cashier shell. |

## Waiter Regression QA

| Area | Result | Evidence |
|---|---|---|
| Waiter Quick PIN login | PASS after API restart | Seeded waiter Quick PIN routed to `/waiter/floor`. |
| Waiter shell | PARTIAL | Waiter shell rendered Tapas Downtown, Brian Kisekka, WAITER, Floor/Orders/Reservations/Me nav. Floor data then showed `Internal server error`. |
| Waiter blocked from cashier | PASS | Navigating to `/cashier/queue` while signed in as waiter showed `Cashier access required.` with no dev overlay. |

## Issues Fixed

- Reduced cashier receipts candidate preload from 100 closed orders to 20 and disabled automatic retries for per-order receipt/payment detail fan-out.
- Caught the already-handled auth restore failure in `AuthProvider` so expired local tokens no longer trigger the Next dev error overlay.

## Issues Remaining

- API startup is slow and quiet on first boot; direct `node dist/main` after `nest build` starts successfully, but the dev command can look stalled for minutes.
- Prisma pool timeouts still occur under some authenticated page request bursts, especially waiter floor regression after login. The visible waiter floor error was `Internal server error`, with API logs showing JWT validation queries timing out while fetching a Prisma connection.
- A narrow in-app browser viewport showed horizontal overflow in the cashier shell. Desktop viewport QA at 1366px exposed header controls normally.

## Status

Cashier authenticated demo QA is substantially complete and cashier demo-ready with known limitations. Waiter regression route/role fencing passed, but waiter floor data remains blocked by Prisma pool pressure and should be handled in a follow-up backend/query-concurrency pass.

