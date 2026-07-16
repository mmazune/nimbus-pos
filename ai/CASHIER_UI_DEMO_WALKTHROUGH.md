# Cashier UI Demo Walkthrough

Date: 2026-07-02
Repo: `C:\Users\arman\Desktop\nimbus-pos`

Use this walkthrough for a guided cashier demo after the API and web app are both running.

## Startup Checklist

1. Confirm package manager:

```powershell
corepack pnpm@8.15.0 --version
```

2. Start the API from the repo:

```powershell
corepack pnpm@8.15.0 --filter @nimbus-pos/api dev
```

If the dev command appears silent for several minutes, run a build and start the compiled API:

```powershell
cd apps/api
npx nest build --builder tsc --path tsconfig.build.json
node dist/main
```

3. Confirm health:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

4. Start the web app:

```powershell
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev
```

5. Open:

```text
http://localhost:3000/login
```

## Login

1. Select the cashier-compatible sign-in mode needed for the demo.
2. Confirm the page says `Service terminal`, not waiter-only language.
3. Sign in with a seeded cashier-compatible demo user.
4. Confirm successful cashier users land on:

```text
/cashier/queue
```

Do not show full passwords or PINs inside the product UI. Use the controlled demo credential file outside the product surface when needed.

## Queue

1. Confirm the cashier shell header shows organization, branch, workstation/session context, and readiness indicators.
2. Confirm bottom navigation contains only Queue, Receipts, Till, and Me.
3. Review active order rows from real POS order data.
4. Use search and filters to show order triage.
5. Explain that default queue excludes `NEW`, `CLOSED`, and `VOIDED` orders.
6. If bill-requested state appears, disclose that it is derived from existing order/audit signals.

Do not claim the cashier can create kitchen orders, edit menus, or operate KDS from this surface.

## Payment Entry

1. Open an eligible served order from the queue.
2. Review payment summary and settlement readiness.
3. Demonstrate full cash settlement only when an active till exists and the order is eligible.
4. Demonstrate card/mobile/bank reference entry as external reference capture, not live acquiring.
5. Confirm overpayment, missing reference, pending provider intent, closed/voided status, and partial cash are blocked.

Demo wording:

- Cash is local cashier tender.
- Card is external terminal/reference capture.
- MTN/Airtel are pending provider-confirmed flows.
- PesaPal diner checkout is not part of cashier payment entry.

## Split And Resolution

1. Show split bill as allocation metadata.
2. Show split items only as child order preparation that does not send to KDS.
3. Show move/transfer table as table metadata/state handling without KDS republish.
4. Point out transfer server as deferred.

Do not claim split item child orders are live kitchen-dispatched orders.

## Receipts

1. Open Receipts.
2. Select a closed order.
3. Show receipt detail/history.
4. Trigger reprint/send only as metadata/API request behavior.
5. Disclose that physical printing and SMS/email delivery adapters remain pending.

## Till

1. Open Till.
2. Show active till status or open a till if the API data allows it.
3. Demonstrate safe drop and reconcile only with suitable seeded data.
4. Enter a variance reason when reconciliation variance exists.
5. Point to paid in/out/pickup as deferred boundary work.

## Refunds

1. Open a refundable closed order from Receipts or Queue context.
2. Select an existing captured payment.
3. Enter amount and reason.
4. Confirm over-refund validation and threshold messaging.
5. Explain that manager approval and post-close void are boundary-only in the cashier UI.

## Me

1. Open Me.
2. Show cashier profile, branch/session context, readiness, scope, restricted surfaces, known limitations, demo help, and logout.
3. Confirm payroll, accounting, reporting, franchise, manager approval, KDS admin, and hardware admin surfaces are not exposed as cashier actions.
4. Logout and confirm the session returns to login.

## Waiter Regression Check

1. Log out.
2. Sign in with a waiter-compatible demo user.
3. Confirm the waiter lands on:

```text
/waiter/floor
```

4. Confirm waiter navigation remains waiter-specific and cashier routes remain protected for non-cashier users.

Known QA note: waiter login and cashier route denial passed on 2026-07-02, but waiter floor data returned `Internal server error` under Prisma pool pressure. Do not present waiter floor data as freshly verified until that backend/runtime issue is resolved.

## Demo No-Claim List

Do not claim these are complete:

- Live MTN/Airtel diner checkout.
- PesaPal cashier checkout.
- Card terminal/acquirer capture.
- Physical receipt printing.
- SMS/email receipt delivery.
- Paid in/out/pickup till movements.
- Manager approval execution.
- Post-close void execution.
- Server transfer execution.
- KDS dispatch from split-item child orders.
- Payroll, accounting, reporting, franchise, or admin operations from cashier UI.
