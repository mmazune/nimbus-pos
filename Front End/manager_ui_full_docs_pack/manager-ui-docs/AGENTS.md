# AGENTS.md — Nimbus POS Manager Frontend Agent Contract

Status: Draft v1  
Date: 2026-07-06  
Applies to: `docs/manager-ui-docs/` and any future Manager UI implementation  
Primary build target: **desktop-first branch-management POS console**

## 1. Purpose and authority

This file is the instruction contract for Codex or any coding agent working on the Nimbus POS / ChefCloud Manager frontend.

The Manager workspace is a focused **branch operations, staff, reports, approvals, settings, and device metadata workspace**. It is not an Owner/Admin console, not payroll, not SaaS billing, not a cashier checkout clone, and not a waiter order-entry clone.

Required reading order before coding:

1. `docs/manager-ui-docs/AGENTS.md`
2. `docs/manager-ui-docs/DESIGN.md`
3. `docs/manager-ui-docs/manager_design.md`
4. `docs/manager-ui-docs/managerui.md`
5. `docs/manager-ui-docs/MANAGER_LIFECYCLE.md`
6. `docs/manager-ui-docs/MANAGER_API_MATRIX.md`
7. `docs/manager-ui-docs/MANAGER_GAP_REGISTER.md`
8. `docs/manager-ui-docs/MANAGER_NAV_AND_PAGE_MAP.md`
9. `docs/manager-ui-docs/MANAGER_FEATURE_SCOPE.md`
10. Existing Waiter, Cashier, and Supervisor docs for structural comparison only.
11. Backend/API/Postman source before implementation.

## 2. Product position

Manager should feel:

- premium enterprise hospitality POS;
- operational, executive, branch-focused, and fast;
- data-rich but not cluttered;
- safe for shared terminal use;
- powerful, with clear confirmations before impactful writes;
- credible enough for a branch manager during rush, closeout, and audit review.

Manager must not feel:

- like a generic SaaS analytics dashboard;
- like accounting software;
- like payroll/admin;
- like a public checkout website;
- like a fake device simulator;
- like a duplicated Supervisor screen;
- like a Cashier checkout or Waiter menu-entry clone.

## 3. Locked Manager MVP decisions

1. System role target is `JobRole.MANAGER`.
2. There is no separate `BRANCH_MANAGER` enum.
3. Shared auth shell remains the entry point.
4. Email/password and high-tier Quick PIN remain available according to backend auth.
5. `GET /api/auth/me` must be resolved after login.
6. Manager lands on `/manager/overview`.
7. Manager must support branch switching because seeded Manager users can belong to multiple branches.
8. Branch selector is part of the Manager shell/header, not a standalone route.
9. Selected branch must drive all branch-scoped API queries.
10. Bottom nav is exactly:
    - Overview
    - Operations
    - Staff
    - Reports
    - Settings
    - Me
11. Manager can view sales, operations, staff, approvals, reports, and branch settings.
12. Manager can perform selected writes only through verified Manager permissions and confirmed backend DTOs.
13. Compensation, contracts detail, salary, bank, tax, payroll, and pay runs are excluded from MVP.
14. Global Owner/Admin/SaaS/franchise/developer surfaces are excluded.
15. Cashier checkout/payment collection is excluded.
16. Waiter menu/order item entry is excluded.
17. Public diner MTN/Airtel execution is excluded until provider confirmation.
18. PesaPal diner checkout is excluded.
19. Receipt send remains no-adapter/pending.
20. Printer routes and terminal pairing are metadata/stub only unless live integration is verified.
21. No frontend-only business state that conflicts with backend.
22. No fake metrics, reports, devices, employees, orders, approvals, or success states.
23. No sensitive HR/PII fields beyond verified Manager-safe fields.

## 4. Backend/Postman source of truth

Frontend may call only verified endpoints. Do not invent routes.

Before every implementation prompt:

1. Verify controller path.
2. Verify DTO.
3. Verify permission guard.
4. Verify branch/org scoping.
5. Verify response shape.
6. Verify mutation idempotency behavior if relevant.
7. Verify Postman collection coverage.
8. Document missing contracts in `MANAGER_GAP_REGISTER.md`.

Risky writes that should use `Idempotency-Key` where supported or have double-submit protection:

- dashboard KPI refresh;
- approvals decide;
- discount approval;
- refund approval;
- post-close void;
- staff onboarding;
- employee create/update;
- Quick PIN reset/enable/disable;
- leave review;
- shift-swap approval;
- report generation;
- report export;
- branch update;
- device activation;
- printer route update;
- terminal pairing.

## 5. What Manager can do

If backend permissions and state allow, Manager can:

- login by email/password and high-tier Quick PIN;
- resolve `/api/auth/me`;
- switch active branch context among memberships;
- view branch overview KPIs;
- view today summary, payment mix, open orders, low stock, anomalies, active tills, and active shifts;
- refresh dashboard KPIs if permitted;
- subscribe to metrics stream if supported;
- view floor/table state;
- view active orders and order details;
- view reservations;
- view till sessions;
- view shift sessions;
- view employee roster with safe fields only;
- onboard frontline staff if permitted;
- create/update safe employee profile fields if permitted;
- view and manage frontline Quick PIN status;
- view attendance;
- review leave requests;
- review shift swaps;
- view unified approvals;
- use domain-specific approval actions when safer than generic decide;
- approve/reject discounts, refunds, leave, and shift swaps if permissions and DTOs are verified;
- execute post-close void only if permission, manager PIN/confirmation, and route contract are verified;
- view report catalog;
- generate branch reports;
- view report run history;
- view report details;
- export/download generated report files if generator is available;
- view and edit branch profile if permitted;
- view device registry;
- activate device metadata slots if permitted;
- configure printer routes as metadata;
- initiate terminal stub pairing if permitted;
- view Manager Me/profile/session/branch context;
- logout.

## 6. What Manager cannot do

Manager cannot:

- edit role permission matrices;
- act as Owner/Admin;
- manage SaaS billing subscriptions;
- use PesaPal for diner checkout;
- access franchise consolidated portal;
- access developer/API key portal;
- run payroll, pay runs, payslips, compensation setup, bank/tax profiles, or contracts detail in MVP;
- expose salaries/wages/contract details on shared terminals;
- build waiter menu orders;
- run cashier checkout/payment collection;
- perform live MTN/Airtel diner payment execution;
- invoke real card terminal/acquirer traffic;
- invoke physical printer drivers;
- claim digital receipt delivery;
- access real customer/employee PII beyond safe fields;
- use fake data as if live;
- bypass backend permission guards.

## 7. Implementation rules for Codex

1. Start every prompt with `git status`.
2. Preserve unrelated dirty worktree changes.
3. Use only `C:\Users\arman\Desktop\nimbus-pos`.
4. Never use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.
5. Use `corepack pnpm@8.15.0`.
6. Verify exact backend routes and DTOs before building UI.
7. Hide actions Manager can never perform.
8. Disable temporarily unavailable actions with exact reasons.
9. Use backend errors where possible.
10. Use skeletons; avoid full-page spinner-only experiences.
11. Confirm before risky writes.
12. Use idempotency or in-flight prevention for writes.
13. Use branch context headers consistently.
14. Do not leak payroll/compensation/contract fields.
15. Use TypeScript types and narrow unknown backend shapes.
16. Use Phosphor icons only.
17. Use design tokens only; no arbitrary colors.
18. No emojis, glassmorphism, generic neon gradients, or fake provider/hardware states.
19. Preserve Waiter/Cashier/Supervisor guards and routes.
20. Update docs and gap register with every gap discovered.

## 8. Required frontend structure

```txt
src/
  pages/manager/
    overview.tsx
    operations.tsx
    staff.tsx
    reports.tsx
    settings.tsx
    me.tsx
  components/manager/
    shell/
    overview/
    operations/
    staff/
    reports/
    settings/
    me/
    approvals/
    states/
  lib/manager/
    api.ts
    context.ts
    routes.ts
    permissions.ts
    overview.ts
    operations.ts
    staff.ts
    reports.ts
    settings.ts
    approvals.ts
    formatters.ts
    idempotency.ts
```

Required naming:

- `ManagerShell`, `ManagerHeader`, `ManagerBottomNav`
- `ManagerSessionGuard`, `ManagerBranchSwitcher`, `ManagerReadinessStrip`
- `ManagerOverviewScreen`
- `ManagerOperationsScreen`
- `ManagerStaffScreen`
- `ManagerReportsScreen`
- `ManagerSettingsScreen`
- `ManagerMeScreen`
- `ManagerApprovalDrawer`
- `ManagerReportRunDrawer`
- `ManagerDevicePanel`
- `ManagerRestrictedSurfaceCard`

## 9. Required states

Every major Manager screen must handle:

- loading;
- empty;
- success;
- failure;
- partial failure;
- permission denied;
- branch missing;
- organization missing;
- branch switching;
- stale branch context;
- offline/degraded;
- mutation in-flight;
- mutation denied;
- idempotency conflict if supported;
- unsupported adapter/provider/hardware;
- report generator unavailable;
- sensitive data deferred;
- unknown response shape;
- local demo branch mismatch.

## 10. Acceptance criteria

Manager MVP is acceptable when:

1. Manager logs in and resolves `/api/auth/me`.
2. Manager lands on `/manager/overview`.
3. Header shows branch, organization, Manager identity, session, and branch switcher.
4. Bottom nav is Overview / Operations / Staff / Reports / Settings / Me.
5. Branch selector correctly changes active branch context.
6. Overview shows real branch KPIs from verified APIs.
7. Operations shows read-only operational state without checkout/order-entry clones.
8. Staff shows roster/onboarding/PIN/leave/swap controls without payroll exposure.
9. Reports supports catalog/history/generation/download states without fake files.
10. Settings supports branch/device/printer/terminal metadata boundaries.
11. Approval actions use verified domain or unified endpoints with confirmations.
12. No unsupported workflow appears live.
13. No sensitive payroll/contract/bank/tax fields are exposed.
14. Validation, browser smoke, and docs are complete.
