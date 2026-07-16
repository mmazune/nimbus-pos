# Cashier UI Final QA Report

Date: 2026-07-02
Repo: `C:\Users\arman\Desktop\nimbus-pos`
Prompt: CASHIER_UI_PROMPT10_FINAL_QA

## Context Snapshot

`ai/AI_STATUS.md` before this pass reported: CASHIER_UI_PROMPT9_ME complete / cashier final QA pending (2026-07-02).

This pass reviewed the cashier UI from Prompt 1 through Prompt 9 and stabilized only cashier-facing QA copy. Backend controllers, backend services, Prisma schema, migrations, seed/demo data, Postman collections, payroll/staff/accounting/reporting/franchise/admin features, hardware integrations, provider integrations, and import scripts were not changed.

## Validation Environment

- Package manager check: `corepack pnpm@8.15.0 --version`
- Web typecheck: `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`
- Web lint: `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`
- Browser smoke target: `http://localhost:3000`
- API target: `http://localhost:3001/api/health`

## Static Validation Results

| Check | Result | Evidence |
|---|---|---|
| pnpm version | PASS | `8.15.0` |
| Web typecheck | PASS | Command completed successfully |
| Web lint | PASS | `No ESLint warnings or errors` |
| Cashier Prompt copy scan | PASS | No remaining `Prompt N`, `waiter terminal`, or `Processing...` strings in checked cashier/login UI files |

## Browser QA Results

| Area | Result | Notes |
|---|---|---|
| Login route renders | PASS | `/login` returned the Nimbus POS login page with `Service terminal` heading |
| Quick PIN mode | PASS | Branch input and quick PIN controls are present |
| Email mode | PASS | Email/password fields and `Sign in` submit render correctly |
| Demo credential disclosure | PASS | Login page did not expose full demo credentials in the browser smoke check |
| Unauthenticated cashier guard | PASS | `/cashier/queue` redirected to `/login?reason=session_required` |
| Unauthenticated waiter guard | PASS | `/waiter/floor` redirected to `/login?reason=session_required` |
| Authenticated cashier flow | PASS | API was recovered with `nest build` + `node dist/main`; cashier login, Queue, Receipts, Till, and Me were verified in browser |
| Authenticated waiter regression | PARTIAL | Waiter Quick PIN login and cashier route denial passed; waiter floor data still hit Prisma pool timeout / `Internal server error` |

## Local API Availability

The web dev server reached `/login` successfully on port 3000. The API was recovered by building with Nest and running `node dist/main` from `apps/api`. Health returned `{"status":"ok","db":"ok"}` from `http://localhost:3001/api/health`.

Startup remains slow and quiet because the API build/start path is large and Neon may cold-start. For a full live demo, start the API and confirm:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

## QA Coverage Matrix

| Scope | Result | Notes |
|---|---|---|
| A. Auth/session routing | PASS with browser partial | Cashier compatibility routes to `/cashier/queue`; waiter compatibility still routes to `/waiter/floor`; unauthenticated guards redirect correctly |
| B. Cashier shell/navigation | PASS | Cashier routes are `/cashier/queue`, `/cashier/receipts`, `/cashier/till`, `/cashier/me`; bottom nav labels are Queue, Receipts, Till, Me |
| C. Queue | PASS by code inspection | Uses real POS orders, excludes `NEW`, `CLOSED`, `VOIDED` by default, no fake rows, bill-requested status documented as audit-derived |
| D. Payment entry | PASS with known limitations | Cash/card/MTN/Airtel/bank reference flows are explicit; PesaPal diner checkout is excluded; provider/card caveats are visible |
| E. Split/resolution | PASS with known limitations | Split bill is metadata-only, split items create `NEW` child orders without KDS dispatch, move/transfer table do not republish KDS |
| F. Receipts | PASS with known limitations | Reprint/send flows use existing receipt APIs and visible printer/delivery caveats |
| G. Till | PASS with known limitations | Open till, safe drop, reconcile UI present; paid in/out/pickup remain deferred; safe-drop idempotency caveat retained |
| H. Refunds | PASS with known limitations | Refund create/list UI present; approval and post-close void are boundary-only surfaces |
| I. Me/help/logout | PASS | Cashier-safe profile, readiness, scope, restricted surfaces, limitations, demo help, and logout are present |
| J. Deferred surfaces excluded | PASS | No cashier KDS actions, Floor/Menu/Payments nav, live provider terminal, payroll, accounting, reports, franchise, or admin surfaces were introduced |
| K. Waiter regression | PARTIAL | Waiter Quick PIN routed to `/waiter/floor` and waiter was denied cashier access; waiter floor data returned `Internal server error` from API pool pressure |

## Issues Fixed During QA

| File | Fix |
|---|---|
| `apps/web/src/pages/login.tsx` | Replaced waiter-specific forbidden copy with neutral service terminal copy |
| `apps/web/src/components/cashier/checkout/CashierCloseOrderPanel.tsx` | Removed stale `Prompt 6` product copy |
| `apps/web/src/components/cashier/checkout/CashierPaymentPanel.tsx` | Removed stale `Prompt 6` product copy and replaced noisy loading copy with `Processing` |
| `apps/web/src/components/cashier/receipts/CashierReceiptsScreen.tsx` | Reduced closed-order receipt candidate preload to 20 and disabled retry amplification for per-order receipt/payment detail fan-out |
| `apps/web/src/lib/auth/AuthProvider.tsx` | Caught already-handled restore failures so expired sessions do not open the Next dev error overlay |

## Remaining Known Limitations

The canonical known limitations list is maintained in `ai/CASHIER_UI_KNOWN_LIMITATIONS.md`.

Highest demo-relevant items:

- Live MTN/Airtel diner checkout remains excluded pending provider confirmation.
- PesaPal diner checkout is intentionally excluded from cashier UI.
- Card terminal/acquirer integration is not live.
- Receipt printer and receipt delivery adapters are not live.
- Paid in/out/pickup cash movement UI remains deferred.
- API startup can be slow/quiet; use the startup debug report if the dev command appears stalled.
- Waiter floor regression currently shows an API `Internal server error` under Prisma pool pressure, although waiter login and cashier route denial passed.

## Go / No-Go

GO for authenticated cashier demo readiness with known limitations.

NO-GO for claiming waiter floor data regression is fully healthy until the Prisma pool timeout is fixed.
