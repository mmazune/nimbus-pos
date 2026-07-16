# AGENTS.md — Nimbus POS Supervisor Frontend Agent Contract

Status: Draft v1  
Date: 2026-07-03  
Applies to: `docs/supervisor-ui-docs/` and any future Supervisor workspace implementation  
Primary build target: **desktop-first front-of-house control terminal**

## 1. Purpose and authority

This file is the instruction contract for Codex or any coding agent working on the Nimbus POS Supervisor workspace.

The Supervisor workspace is a focused **floor-control, service-exception, reservation, approval-boundary, punch/self-service, and operational oversight role**. It is not a waiter clone, not a cashier clone, and not a manager/backoffice dashboard.

Required reading order before coding:

1. `docs/supervisor-ui-docs/AGENTS.md`
2. `docs/supervisor-ui-docs/DESIGN.md`
3. `docs/supervisor-ui-docs/supervisor_design.md`
4. `docs/supervisor-ui-docs/supervisorui.md`
5. `docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md`
6. `docs/supervisor-ui-docs/SUPERVISOR_API_MATRIX.md`
7. `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md`
8. Existing waiter and cashier docs for structural comparison only.
9. Backend/API/Postman/live repository source before implementation.

Source basis:

- Current project conversation history: Waiter MVP, Cashier documentation pack, Cashier implementation prompts, final Cashier QA, authenticated demo QA, and remaining Prisma/waiter floor blocker.
- Uploaded waiter docs and cashier docs were used as structural patterns.
- Uploaded Nimbus audit/register resources were used to identify likely Supervisor-adjacent endpoint families.
- The uploaded role endpoint matrix does not include clean dedicated Supervisor rows; exact permissions must be verified in `C:\Users\arman\Desktop\nimbus-pos` before coding.

## 2. Product position

Supervisor should feel like:

- a live front-of-house control console;
- a floor-service exception resolver;
- a reservations and seating controller;
- a safe approval-boundary workspace;
- a role that can unblock service without becoming Manager, Cashier, Chef, or Waiter.

Supervisor must not feel like:

- a waiter order-entry clone;
- a cashier settlement clone;
- an accounting/reporting/franchise dashboard;
- a generic admin panel;
- a fake approval or hardware simulator.

## 3. Locked Supervisor MVP decisions

1. Desktop-first shared POS terminal.
2. Shared auth shell; verify if Supervisor is Quick PIN-first in the live repo.
3. Email/password remains shared-shell fallback if supported.
4. Call `GET /api/auth/me` after login.
5. Supervisor lands on **Floor**.
6. Fixed top header and fixed bottom nav.
7. Bottom nav is exactly **Floor**, **Orders**, **Reservations**, **Approvals**, **Me**.
8. No Supervisor Menu tab unless live permissions prove Supervisor order-entry scope.
9. No Supervisor Payments tab; payment settlement belongs to Cashier unless live permissions prove otherwise.
10. No Supervisor Dashboard tab; compact service-risk summaries may appear inside Floor/Orders.
11. Supervisor should monitor and resolve service exceptions, not operate every role's workflow.
12. Supervisor may approve or escalate only if exact permission is verified.
13. Supervisor may punch/clock and manage own session under Me.
14. Supervisor may manage reservations only if backend permissions verify it.
15. Supervisor must not expose accounting, reports, franchise, payroll runs, staff list, manager settings, device admin, or provider/hardware admin unless verified.
16. KDS production actions are excluded unless `pos:kds:write` or equivalent is verified.
17. All risky writes must use `Idempotency-Key` where supported.
18. No frontend-only business state that conflicts with backend state.

Locked safety boundaries:

- Public diner MTN/Airtel execution remains `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Receipt reprint/printer routes are metadata/request only: `Metadata only — no print-driver invocation`.
- Card terminal pairing remains `STUB — no acquirer/card-terminal traffic`.
- No fake provider credentials, no fake live delivery, no fake printed/terminal approved states.

## 4. Backend/Postman source of truth

Frontend may call only verified endpoints. Do not invent routes. If a route, DTO, permission, fixture, or role boundary is missing, add it to `SUPERVISOR_GAP_REGISTER.md` and block/hide the UI action.

Live repo verification must inspect:

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/seed.ts`
- `packages/db/prisma/demo-import.ts`
- `demo-data/DEMO_LOGIN_CREDENTIALS.md`
- auth/session modules
- orders/floor/tables/reservations modules
- payments/refunds/discounts/void modules
- shifts/tills/attendance/leave/shift-swap modules
- receipts/devices/KDS/analytics/approvals modules
- Postman collections and environments

## 5. What Supervisor can probably do after verification

If backend permissions and state allow, Supervisor can:

- login and resolve canonical branch/organization context;
- view Floor as the landing surface;
- monitor tables, table ownership, active order state, reservations, and service risk;
- view branch active orders across servers/waiters;
- open order details and payment state read-only;
- resolve service exceptions through split, merge, move-items, transfer-table, transfer-server where verified;
- manage operational reservations: create, confirm, assign table, seat, cancel/no-show where verified;
- view receipts/history and use metadata-only reprint or pending send where verified;
- create/approve/deny discount or refund actions only if exact permissions verify Supervisor scope;
- execute post-close void only if exact Supervisor permission and PIN boundary are verified;
- view active shift/till readiness;
- punch/clock in/out or view own attendance if verified;
- request leave or shift swap if verified;
- approve leave/shift swap only if verified;
- view service-risk/analytics summaries if Supervisor-safe permissions exist;
- use Me tab for profile/session/scope/limitations/logout.

## 6. What Supervisor cannot do by default

Unless live repo verification proves otherwise, Supervisor cannot:

- access accounting/AP/AR/GL/period close;
- access franchise dashboards;
- access payroll runs or payroll approval;
- manage staff list or HR admin;
- manage owner SaaS billing or PesaPal billing;
- perform live MTN/Airtel public mobile-money checkout;
- use live card terminal/acquirer traffic;
- physically print receipts through drivers;
- claim digital receipt delivery;
- pair terminals or edit printer routes;
- run KDS kitchen actions;
- bypass manager/owner approval controls;
- approve refunds/discounts/post-close void unless permission is verified;
- see hidden owner/manager reports;
- use fake demo data as real production state.

## 7. Navigation contract

Supervisor bottom nav is locked as:

```txt
Floor · Orders · Reservations · Approvals · Me
```

No `More` tab. No hidden admin drawer. No bottom-nav `Payments`, `Menu`, `Reports`, or `Dashboard` tab.

## 8. Implementation discipline

Before UI build:

1. Run deep repo verification.
2. Update `SUPERVISOR_API_MATRIX.md` with exact DTOs/permissions.
3. Update `SUPERVISOR_GAP_REGISTER.md`.
4. Produce `ai/SUPERVISOR_UI_REPO_VERIFICATION_REPORT.md`.
5. Only then start implementation prompts.

## 9. Naming convention

Recommended routes:

- `/supervisor/floor`
- `/supervisor/orders`
- `/supervisor/reservations`
- `/supervisor/approvals`
- `/supervisor/me`

Recommended components:

- `SupervisorShell`
- `SupervisorHeader`
- `SupervisorBottomNav`
- `SupervisorSessionGuard`
- `SupervisorReadinessStrip`
- `SupervisorFloorScreen`
- `SupervisorOrdersScreen`
- `SupervisorReservationsScreen`
- `SupervisorApprovalsScreen`
- `SupervisorMeScreen`

Recommended libs:

- `apps/web/src/lib/supervisor/context.ts`
- `apps/web/src/lib/supervisor/routes.ts`
- `apps/web/src/lib/supervisor/permissions.ts`
- `apps/web/src/lib/supervisor/floor.ts`
- `apps/web/src/lib/supervisor/orders.ts`
- `apps/web/src/lib/supervisor/reservations.ts`
- `apps/web/src/lib/supervisor/approvals.ts`
- `apps/web/src/lib/supervisor/workforce.ts`
