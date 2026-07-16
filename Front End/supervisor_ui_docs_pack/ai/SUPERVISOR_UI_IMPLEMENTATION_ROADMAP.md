# SUPERVISOR_UI_IMPLEMENTATION_ROADMAP.md — Nimbus POS Supervisor UI Build Roadmap

Status: Draft v1  
Date: 2026-07-03  
Scope: Future Supervisor UI implementation prompts after live repo verification

## Prompt 0 — Supervisor repo verification

Verify exact Supervisor credentials, role enum, permissions, DTOs, endpoints, demo fixtures, and Postman coverage. Produce `ai/SUPERVISOR_UI_REPO_VERIFICATION_REPORT.md` and `ai/SUPERVISOR_UI_GAP_CONFIRMATION_MATRIX.md`. No UI coding.

## Prompt 1 — Supervisor shell/design foundation

Implement `SupervisorShell`, `SupervisorHeader`, `SupervisorBottomNav`, `SupervisorSessionGuard`, state primitives, caveats, and routes: `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, `/supervisor/me`.

## Prompt 2 — Auth/session/context routing

Wire shared login, `/api/auth/me`, Supervisor role guard, branch/workstation context, readiness strip, logout, and non-Supervisor blocked state. Supervisor lands on Floor.

## Prompt 3 — Floor

Build live Floor surface: floor/table state, reservations due, active order summaries, service risk, table detail drawer, safe action blockers. No waiter order-entry unless verified.

## Prompt 4 — Orders/resolution

Build active branch orders screen and exception resolution: split bill/items, merge, move items, transfer table/server, void/discount/refund boundaries where verified. No KDS or payment settlement unless verified.

## Prompt 5 — Reservations

Build reservation book: list, search, create, confirm, assign table, seat, cancel/no-show, deposits/events if verified.

## Prompt 6 — Approvals

Build approval surfaces only after permissions verify: discounts, refunds, post-close void, leave, shift swaps, anomalies. Do not expose global approvals unless Supervisor has permission.

## Prompt 7 — Me / punch / workforce

Build Supervisor profile, punch/attendance, own leave/swap request, readiness, scope, limitations, logout. No payroll/staff/accounting/reports.

## Prompt 8 — Receipts/audit and service health polish

Add receipt/audit support and service-health summaries where permission-safe. Preserve metadata-only and pending-send caveats.

## Prompt 9 — Final QA / known limitations

Run Supervisor authenticated QA, waiter/cashier regression, deferred-surface checks, known limitations, and demo walkthrough.

## Prompt 10 — Commit/PR preparation

Only after final QA is complete and approved.
