# MANAGER_LIFECYCLE.md — Nimbus POS Manager Branch Operations Lifecycle

Status: Draft v1  
Date: 2026-07-06  
Purpose: exhaustive Manager lifecycle and action contract  
Role: Manager (`JobRole.MANAGER`)

## 1. Main lifecycle

```txt
login → auth context → branch selection → manager shell → overview → operations/staff/reports/settings → approvals/actions where verified → audit/result refresh → logout
```

Manager is the branch operations control layer. Waiter executes service, Cashier settles payments, Supervisor controls floor exceptions, and Manager oversees branch operations, staffing, reports, approvals, and settings.

## 2. Manager can do

- Email/password login;
- high-tier Quick PIN login;
- `/api/auth/me` context resolution;
- branch switching across memberships;
- view branch dashboard KPIs;
- view active operations;
- view tables, orders, reservations, tills, and shifts;
- view and manage safe staff profiles;
- onboard frontline staff;
- manage frontline Quick PIN status;
- view attendance;
- review leave;
- review shift swaps;
- view approval inbox;
- perform verified approval decisions;
- generate reports;
- view report history/details;
- export/download reports when generator is available;
- view/edit branch profile if permitted;
- view device registry;
- configure printer routes as metadata;
- initiate terminal stub pairing;
- view Manager profile and logout.

## 3. Manager cannot do

Locked boundaries:

- no Owner/Admin role permission editing;
- no SaaS billing portal;
- no PesaPal diner checkout;
- no franchise consolidated portal;
- no payroll/pay runs;
- no compensation/salary/wage/bank/tax/contracts detail in MVP;
- no Waiter menu entry;
- no Cashier checkout/tender flow;
- no live MTN/Airtel public diner payment execution;
- no real acquirer/card-terminal traffic;
- no physical print-driver invocation;
- no fake provider/device/report success;
- no global tenant/developer settings.

## 4. Login lifecycle

1. Manager selects email/password or Quick PIN.
2. Backend authenticates.
3. API returns token.
4. Frontend calls `GET /api/auth/me`.
5. Frontend verifies Manager role.
6. Frontend extracts memberships.
7. Frontend selects branch context.
8. Frontend routes to `/manager/overview`.

Failures:

- invalid credentials;
- invalid PIN;
- no Manager role;
- no memberships;
- missing org;
- missing branch;
- network error;
- expired token.

## 5. Branch context lifecycle

Manager users may have multiple branch memberships.

1. On shell mount, read `station_branch_id`.
2. Verify selected branch exists in `/api/auth/me.memberships`.
3. If valid, set active branch.
4. If invalid, choose default branch or first eligible membership.
5. Header branch selector displays memberships.
6. Switching branch:
   - updates Manager context;
   - updates localStorage;
   - invalidates branch-scoped React Query families;
   - refetches overview, operations, staff, reports, settings data.
7. All API calls include correct branch context/header.

Blocked:

- no memberships;
- selected branch not authorized;
- branch context missing.

## 6. Overview lifecycle

1. Load `/api/dash/manager`.
2. Load today summary.
3. Load payment mix.
4. Load open orders.
5. Load low stock.
6. Subscribe to metrics stream if available.
7. Render KPI cards and widgets.
8. Refresh on branch switch.
9. Handle stream degradation without losing last fetched data.

No writes except optional KPI refresh.

KPI refresh:

1. User clicks refresh.
2. Confirm if refresh is expensive.
3. Call `POST /api/dash/kpi/refresh`.
4. Refresh dashboard queries.
5. Show success/failure.

## 7. Operations lifecycle

1. Load active tables.
2. Load active orders.
3. Load tills.
4. Load shifts.
5. Load reservations.
6. Render branch operations overview.
7. Row click opens detail drawer.
8. Branch switch invalidates all operations queries.

Manager may inspect but does not:

- build orders;
- edit menu items;
- tender payments;
- close cashier checkout;
- run KDS actions.

## 8. Staff directory lifecycle

1. Load employees.
2. Filter/search safe fields.
3. Select employee.
4. Open employee drawer.
5. Show safe profile fields only.
6. Hide compensation/contracts/payroll.
7. Load PIN status if needed.
8. Load attendance/leave/swap context if needed.

Employee create/update:

1. Verify DTO.
2. Validate required fields.
3. Confirm branch.
4. Submit.
5. Refresh directory.
6. Show audit/success/failure.

Do not expose payroll fields.

## 9. Frontline onboarding lifecycle

1. Manager opens onboard form.
2. Selects role/jobRole.
3. Enters safe identity fields.
4. Selects branch.
5. Confirms.
6. Calls onboarding endpoint.
7. Shows generated result.
8. Refreshes staff list.
9. Does not display secrets longer than necessary.

No fake credentials.

## 10. Quick PIN lifecycle

1. Manager opens staff detail.
2. Fetches Quick PIN status.
3. Chooses reset/disable/enable.
4. Confirmation shows employee, branch, action, and consequence.
5. Calls verified endpoint.
6. Refreshes status.
7. Shows result.

Never show raw PIN unless backend intentionally returns a one-time value and UI warns user.

## 11. Attendance lifecycle

1. Load attendance by branch.
2. Show clock timeline.
3. Filter by employee/status/date.
4. Detail drawer shows safe attendance fields.
5. No payroll calculations.
6. No manual punch correction in MVP unless verified later.

## 12. Leave review lifecycle

1. Load leave requests.
2. Filter pending/reviewed.
3. Open leave detail.
4. Review dates/reason/employee.
5. Confirm approve/reject.
6. Call review endpoint.
7. Refresh leave and approvals.
8. Show result.

No payroll or leave balance accounting unless verified.

## 13. Shift swap review lifecycle

1. Load shift swap requests.
2. Filter pending/reviewed.
3. Open swap detail.
4. Review requester/target/date/reason.
5. Confirm approve/reject.
6. Call approve endpoint.
7. Refresh swaps and approvals.
8. Show result.

No broad staff selector here; these are submitted requests.

## 14. Approvals lifecycle

1. Load unified approvals inbox.
2. Show type, status, source, requester, amount/date.
3. Open detail.
4. Determine domain-specific source.
5. Prefer domain-specific action endpoint when generic decide DTO is ambiguous.
6. Confirm action.
7. Submit decision.
8. Refresh approvals and affected domain query.
9. Show audit/result.

Decision domains:

- discounts;
- refunds;
- post-close voids;
- leave;
- shift swaps;
- anomalies if supported.

## 15. Reports lifecycle

1. Load report catalog.
2. Manager chooses template.
3. UI renders template-specific filter form.
4. Validate date/branch/filter fields.
5. Confirm generation.
6. Call report generation endpoint.
7. Poll report runs list.
8. Open report detail.
9. Render report payload.
10. Request export.
11. Download file if ready.

Failures:

- generator unavailable;
- report run failed;
- export failed;
- download failed;
- permission denied;
- branch mismatch.

Never fake generated/downloaded files.

## 16. Settings lifecycle

Branch profile:

1. Load branch data.
2. Edit safe fields.
3. Confirm update.
4. Call branch update endpoint.
5. Refresh branch context.

Device registry:

1. Load devices.
2. Open device detail.
3. Activate metadata slot if needed.
4. No live hardware claim.

Printer routes:

1. Load routes.
2. Edit route metadata.
3. Confirm.
4. Save.
5. Show metadata-only caveat.

Terminal pairing:

1. Load terminals.
2. Initiate stub pairing.
3. Show stub-only state.
4. No acquirer/card traffic.

## 17. Me/logout lifecycle

1. Render Manager identity.
2. Show active branch and memberships.
3. Show permission summary.
4. Show restricted surfaces.
5. Logout clears session.
6. Route to login.

Optional localStorage behavior:

- retain station branch only if shared terminal station policy requires;
- otherwise clear on logout.

## 18. Offline/degraded/idempotency lifecycle

For writes:

- disable double submit while in flight;
- send idempotency key where backend supports;
- on network failure, refresh entity before retry;
- never blind-retry approval/refund/void/staff/device writes.

Idempotency outcomes:

| Outcome | UI response |
|---|---|
| replay | show prior result |
| conflict | payload mismatch; stop and require user review |
| in-flight | show processing and poll/refresh |
| maintenance | block write and show maintenance banner |
| denied | show permission/scope reason |

## 19. Denied action matrix

| Action | Manager MVP behavior |
|---|---|
| Cashier checkout | Hidden |
| Waiter order entry | Hidden |
| Owner/Admin access matrix | Hidden |
| Payroll/pay runs | Hidden |
| Compensation/contract details | Hidden/deferred |
| SaaS billing/PesaPal subscription portal | Hidden |
| Franchise portal | Hidden |
| Live MTN/Airtel diner execution | Hidden/blocked |
| Live terminal capture | Hidden/stub |
| Physical print driver | Hidden/metadata only |
| Fake report download | Blocked |
| Generic approval decide with unknown DTO | Disabled; use domain-specific action |
| Report export generator missing | Show generator unavailable |

## 20. Final checklist before implementation

Confirm:

- Manager role enum and seed role;
- Manager demo credentials and Quick PIN;
- branch memberships and branch switcher rules;
- required branch context header;
- dashboard response shapes;
- live metrics stream behavior;
- orders/tables/tills/shifts/reservations shapes;
- employee safe field whitelist;
- compensation/contract exclusion;
- Quick PIN reset response behavior;
- leave review DTO;
- shift swap approve DTO;
- unified approvals source mapping;
- report catalog/filter/generate/export DTOs;
- branch update DTO;
- device activation DTO;
- printer route DTO;
- terminal stub pairing DTO;
- Postman coverage;
- demo data coverage.
