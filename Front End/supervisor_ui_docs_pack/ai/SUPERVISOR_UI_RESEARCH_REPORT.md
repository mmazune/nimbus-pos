# SUPERVISOR_UI_RESEARCH_REPORT.md — Nimbus POS Supervisor UI Research Report

Status: Draft v1  
Date: 2026-07-03  
Scope: Research-only Supervisor UI direction before live repo verification

## 1. Context snapshot

Supervisor research begins after Waiter MVP completion, Cashier documentation pack, Cashier UI implementation prompts 1–10, Cashier authenticated demo QA, and current backend follow-up around Prisma pool pressure and waiter floor data.

The user approved the five-tab Supervisor nav:

```txt
Floor · Orders · Reservations · Approvals · Me
```

No implementation files have been generated in the Windows repo by this document pack.

## 2. Research conclusion

Supervisor should be a **floor-control and exception-resolution role**.

Supervisor should control live service flow, reservations, order exceptions, and approvals within verified permission boundaries. It should not become a Manager dashboard, Cashier checkout, or Waiter order-entry surface unless live repo permissions prove those scopes.

## 3. Key audit observation

The uploaded endpoint register contains many `Cashier/Waiter/Supervisor` role hints, but the uploaded role endpoint matrix does not contain dedicated Supervisor rows. Therefore, uploaded audit files are not sufficient for exact permission truth.

Live repo verification is mandatory before build.

## 4. Recommended navigation

```txt
Floor · Orders · Reservations · Approvals · Me
```

Rationale:

- **Floor**: Supervisor landing surface and live service control.
- **Orders**: active branch orders and exception resolution.
- **Reservations**: guest arrival, table assignment, seating, cancellations/no-shows.
- **Approvals**: supervisor-authorized refunds, discounts, void boundaries, shift swaps/leave if verified.
- **Me**: profile, punch, session, scope, limitations, logout.

## 5. Supervisor can-do hypothesis

Pending verification, Supervisor may be able to authenticate, view branch floor/tables, monitor active branch orders, inspect service risk, manage reservations, split/merge/move/transfer orders, approve or escalate discounts/refunds/voids, punch/clock, request leave or shift swap, view receipt/audit history, and view device/printer metadata.

## 6. Supervisor cannot-do default

By default, Supervisor should not access accounting, payroll, reports, franchise, owner billing, live provider execution, PesaPal diner checkout, live card terminal traffic, fake print/delivery states, manager/admin settings, KDS write actions, waiter menu item editing, or cashier settlement unless verified.

## 7. API families to verify

1. Auth/session.
2. Floor/tables.
3. POS orders.
4. Split/handoff.
5. Reservations/deposits.
6. Discounts/refunds/voids.
7. Receipts/audit.
8. Attendance/punch.
9. Leave/shift swaps.
10. Shifts/tills read scope.
11. KDS service health.
12. Analytics/anomalies.
13. Approvals.
14. Devices metadata.

## 8. Main product risks

| Risk | Mitigation |
|---|---|
| Supervisor becomes Manager | Block accounting/reports/payroll/franchise/admin by default |
| Supervisor becomes Cashier | Exclude payment settlement unless verified |
| Supervisor becomes Waiter | Exclude menu/order-entry unless verified |
| Fake approvals | Require exact permission/DTO before approve/reject UI |
| Fake hardware/provider state | Preserve caveat tags |
| Floor blocker from current Prisma issue | Fix backend pool/waiter floor blocker before Supervisor Floor QA |

## 9. Recommended next step

Run `ai/SUPERVISOR_UI_REPO_VERIFICATION_PROMPT.md` in Codex against:

```txt
C:\Users\arman\Desktop\nimbus-pos
```

Do not build Supervisor UI until that verification report is complete.
