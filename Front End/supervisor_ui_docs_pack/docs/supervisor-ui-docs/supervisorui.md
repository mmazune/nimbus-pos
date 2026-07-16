# supervisorui.md — Nimbus POS Supervisor UI Blueprint

Status: Draft v1  
Date: 2026-07-03  
Scope: Screen-by-screen Supervisor UI blueprint for review before live repo verification and implementation

## 1. Routes

```txt
/supervisor/floor
/supervisor/orders
/supervisor/reservations
/supervisor/approvals
/supervisor/me
```

## 2. Shared Supervisor shell

Components:

- `SupervisorShell`
- `SupervisorHeader`
- `SupervisorBottomNav`
- `SupervisorSessionGuard`
- `SupervisorReadinessStrip`
- `SupervisorCaveatBanner`
- `SupervisorBlockedState`
- `SupervisorEmptyState`
- `SupervisorFailureState`

Header content: branch, workstation fallback, time, shift status, service-risk status, supervisor identity, logout.

Bottom nav:

```txt
Floor · Orders · Reservations · Approvals · Me
```

## 3. Login / routing

Supervisor uses shared login. It must authenticate using verified Supervisor credentials, call `/api/auth/me`, confirm Supervisor role/permission context, route to `/supervisor/floor`, block non-Supervisor users from `/supervisor/*`, and not break Waiter or Cashier routing.

## 4. Floor screen blueprint

Title: `Floor`  
Subtitle: `Monitor live service, table state, reservations, and exceptions.`

Sections:

1. Readiness strip
2. Service-risk summary
3. Floor map/list
4. Table detail drawer
5. Reservation overlay drawer
6. Order exception drawer

States: loading floor, empty floor, floor load failure, missing branch, unauthorized, service risk present, action blocked by permission, action requires confirmation.

Actions pending verification: change table status, assign/transfer table, transfer server, open active order, seat reservation.

## 5. Orders screen blueprint

Title: `Orders`  
Subtitle: `Review active branch orders and resolve service exceptions.`

Filters: Active, Needs attention, Ready/served, Bill requested if exact data exists, Split/merge candidates, Void review, Closed today if supported.

Order card fields: order number, status, table, server/waiter, elapsed time, total/payment state, exception badges, approval state if applicable.

Panels: order detail, split bill/items, merge/move/transfer, discount/refund/void boundary, receipt history if permitted.

Blocked by default until verified: item/menu editing, KDS send/ready actions, payment settlement, post-close void execution.

## 6. Reservations screen blueprint

Title: `Reservations`  
Subtitle: `Confirm, seat, assign tables, and manage guest arrivals.`

Filters: Today, Upcoming, Pending, Confirmed, Seated, No-show, Cancelled.

Reservation card fields: guest name if safe, party size, time, status, table assignment, deposit status, notes indicator.

Actions pending verification: create, confirm, assign table, seat, cancel, no-show, record/view deposit, view events.

## 7. Approvals screen blueprint

Title: `Approvals`  
Subtitle: `Review supervisor-authorized exceptions and escalations.`

Approval categories after verification: discounts, refunds, post-close void, shift swaps, leave, anomaly acknowledgements.

Each card should show request type, requester, value/amount, context, threshold reason, status, approve/reject only if allowed, escalation copy if blocked.

Do not use global approvals inbox until live source proves Supervisor permission.

## 8. Me screen blueprint

Title: `Supervisor profile`

Sections: Profile/session, branch/workstation, shift readiness, punch/attendance if verified, leave/swap self-service if verified, Supervisor scope, restricted surfaces, known limitations, logout.

Restricted surfaces copy:

```txt
Supervisor cannot access accounting, payroll, reports, franchise dashboards, device admin, provider setup, or manager-only approvals unless explicit permissions are verified.
```

## 9. Caveat placements

Use caveat cards near relevant actions: receipt send, printer metadata, MTN/Airtel provider confirmation, PesaPal exclusion, device/terminal stub.

## 10. Prompt sequence after documentation approval

1. Repo verification.
2. Shell/navigation.
3. Auth/session/readiness.
4. Floor.
5. Orders/resolution.
6. Reservations.
7. Approvals/void/refund/discount boundaries.
8. Me/punch/workforce.
9. Receipts/audit if needed.
10. Final QA.
