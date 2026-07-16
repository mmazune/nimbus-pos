# Supervisor UI Implementation Roadmap

Status: repo-verified update  
Date: 2026-07-04  
Scope: future implementation prompts only. This document update did not build UI.

## Prompt 0 - Repo Verification

Completed in this pass.

Outputs:

- `ai/SUPERVISOR_UI_REPO_VERIFICATION_REPORT.md`
- `ai/SUPERVISOR_UI_GAP_CONFIRMATION_MATRIX.md`
- `docs/supervisor-ui-docs/SUPERVISOR_API_MATRIX.md`
- `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md`

Key decisions:

- Supervisor role is `JobRole.SUPERVISOR`, role name `Supervisor`, level `L3`.
- Demo login is `supervisor@nimbus.demo` / `Demo1234!`; Quick PIN is `22334455`.
- Approved nav remains `Floor`, `Orders`, `Reservations`, `Approvals`, `Me`.
- Landing route remains `/supervisor/floor`.
- Reservations is first-class.
- Approvals must be domain-specific, not global `/api/approvals`, because Supervisor lacks `approvals:*`.
- Punch/workforce belongs under Me and Approvals where relevant.
- Receipt/device/global audit surfaces are blocked unless permissions change.
- KDS/payment/till/order-entry permissions exist but must be product-gated to avoid Supervisor becoming Chef/Cashier/Waiter.

## Prompt 1 - Supervisor Shell/Navigation

Implement only:

- `/supervisor/floor`
- `/supervisor/orders`
- `/supervisor/reservations`
- `/supervisor/approvals`
- `/supervisor/me`
- `SupervisorShell`, `SupervisorHeader`, `SupervisorBottomNav`, `SupervisorSessionGuard`
- blocked/empty/failure/caveat primitives
- fixed approved nav only.

Do not add:

- Payments, Menu, Reports, Dashboard, Devices, Accounting, Payroll, Franchise, Billing, or More tabs.

## Prompt 2 - Auth/Session/Context Routing

Implement Supervisor-compatible frontend auth routing:

- add Supervisor role compatibility in auth helpers
- route Supervisor to `/supervisor/floor`
- block non-Supervisor users from `/supervisor/*`
- preserve Waiter and Cashier routes
- read branch/org/default context from `/api/auth/me`
- show session, role, branch, and permission-derived capability state.

No backend changes unless separately requested.

## Prompt 3 - Floor

Build live floor control:

- floor plans/tables/availability
- reservation overlays
- active order summaries
- table status changes with confirmation
- table/order/reservation drawers
- blocked states for missing branch/permission/load failure.

Use:

- `GET /api/floor-plans`
- `GET /api/tables`
- `GET /api/floor/availability`
- `PATCH /api/tables/:id/status`
- read-only reservation/order summaries.

## Prompt 4 - Orders/Resolution

Build exception-oriented Orders:

- active branch order list
- order detail
- split bill/items
- merge
- move items
- transfer table/server
- void/refund/discount boundaries
- payment state read.

Product gates:

- no waiter-style menu-entry unless explicitly enabled
- no cashier-style payment station
- KDS actions hidden unless deliberately selected as Supervisor exception tools.

## Prompt 5 - Reservations

Build reservation book:

- list/search/filter today/upcoming/status
- create
- confirm
- assign table
- seat
- cancel/no-show
- deposits/events if safe.

All high-impact actions require confirmation.

## Prompt 6 - Approvals

Build domain-specific approval surfaces:

- pending discounts
- pending refunds
- post-close void boundary
- leave review
- shift-swap approval
- anomaly acknowledge/resolve.

Do not use `/api/approvals` until Supervisor has `approvals:read` and `approvals:decide`.

## Prompt 7 - Me/Punch/Workforce

Build:

- profile/session
- branch/workstation
- shift readiness
- attendance clock/read
- own leave request/read
- own shift swap read/create only if a safe target employee selector exists
- scope/limitations
- logout.

No payroll runs, staff admin, accounting, reports, franchise, billing, or device admin.

## Prompt 8 - Service Health Polish

Add only permission-safe health/risk summaries:

- KDS queue read
- anomalies/risk read
- shift/till read
- caveats for providers/hardware/receipts.

Do not expose receipt actions unless Supervisor receives `pos:receipt:*`.

## Prompt 9 - Final QA

Run:

- web typecheck/lint
- authenticated Supervisor QA
- Waiter/Cashier login regression
- caveat/deferred-surface audit
- demo walkthrough
- known limitations update.

## Prompt 10 - Commit/PR Prep

Only after final QA and user approval.

