# Manager UI Docs — Nimbus POS

Status: Draft v1  
Date: 2026-07-06  
Role: Manager / Branch Manager  
System role target: `JobRole.MANAGER`  
Primary build target: **desktop-first branch-management POS console with multi-branch context switching**

This folder contains Codex-ready documentation for the Nimbus POS / ChefCloud **Manager** workspace.

The Manager workspace is the branch-level control layer above Waiter, Cashier, and Supervisor. It covers operational overview, active service oversight, staff administration, reports, settings/devices, approvals, and manager identity/context.

## Files

1. `AGENTS.md` — coding-agent contract and guardrails for Manager implementation.
2. `DESIGN.md` — Manager extension of the global Nimbus POS design system.
3. `manager_design.md` — Manager role-specific shell, page, component, and state contract.
4. `managerui.md` — screen-by-screen Manager UI blueprint.
5. `MANAGER_LIFECYCLE.md` — full Manager branch-management lifecycle and action contract.
6. `MANAGER_API_MATRIX.md` — verified Manager API matrix, permissions, sensitivity, and caveats.
7. `MANAGER_GAP_REGISTER.md` — unresolved gaps and deferred/unsafe surfaces.
8. `MANAGER_NAV_AND_PAGE_MAP.md` — final navigation, routes, page sections, and build sequence.
9. `MANAGER_FEATURE_SCOPE.md` — all Manager capabilities, visible data, writes, and exclusions.
10. `MANAGER_APPROVAL_DECISIONS.md` — decisions the product owner should approve before Prompt 1.

## Required reading order before Manager implementation

1. `docs/manager-ui-docs/AGENTS.md`
2. `docs/manager-ui-docs/DESIGN.md`
3. `docs/manager-ui-docs/manager_design.md`
4. `docs/manager-ui-docs/managerui.md`
5. `docs/manager-ui-docs/MANAGER_LIFECYCLE.md`
6. `docs/manager-ui-docs/MANAGER_API_MATRIX.md`
7. `docs/manager-ui-docs/MANAGER_GAP_REGISTER.md`
8. `docs/manager-ui-docs/MANAGER_NAV_AND_PAGE_MAP.md`
9. `docs/manager-ui-docs/MANAGER_FEATURE_SCOPE.md`
10. `docs/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`
11. Existing Waiter/Cashier/Supervisor docs for structural comparison only.
12. Backend/API/Postman source before implementation.

## Locked Manager decisions

- Role target is `JobRole.MANAGER`.
- There is no separate `BRANCH_MANAGER` enum.
- Manager lands on `/manager/overview`.
- Manager must support a branch context switcher in the shell/header.
- Bottom nav is exactly: **Overview**, **Operations**, **Staff**, **Reports**, **Settings**, **Me**.
- Manager is branch/multi-branch operations control, not Owner/Admin.
- Manager can access powerful write actions only through verified permissions, DTOs, branch context, confirmations, and idempotency where supported.
- Manager must not expose compensation, payroll, bank, tax, contract, or sensitive HR fields in MVP.
- Manager must not clone Waiter menu entry or Cashier checkout.
- Device/printer/terminal areas remain metadata/stub unless live integrations are verified.

## Most important boundaries

- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING PROVIDER CONFIRMATION`.
- PesaPal is owner SaaS subscription billing only; exclude from diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes are metadata-only unless physical driver invocation is verified.
- Terminal pairing/card traffic is stub-only unless live acquirer integration is verified.
- No fake provider credentials.
- No real customer/employee PII.
- No payroll/compensation/bank/tax exposure.
- Do not weaken Waiter/Cashier/Supervisor role guards.

## Suggested implementation phases

1. Repo/docs/API orientation — complete.
2. Manager shell, guard, branch selector, and route stubs.
3. Overview dashboard.
4. Operations oversight.
5. Staff administration.
6. Reports and downloads.
7. Settings and devices.
8. Approval action hardening.
9. Final QA, screenshots, demo walkthrough, and known-limitations closeout.
