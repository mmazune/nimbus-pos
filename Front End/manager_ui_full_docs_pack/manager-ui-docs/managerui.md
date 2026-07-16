# managerui.md — Nimbus POS Manager UI Blueprint

Status: Draft v1  
Date: 2026-07-06  
Platform: Desktop-first shared POS / manager terminal  
Role: Manager (`JobRole.MANAGER`)

## 1. Purpose

This file defines the screen-by-screen Manager UI blueprint. For edge cases, read `MANAGER_LIFECYCLE.md`.

## 2. Current backend truth

Manager-relevant backend surfaces found:

- auth login, Quick PIN login, and `/api/auth/me`;
- branches and branch context;
- Manager dashboards and KPI streams;
- orders, tables, reservations, tills, shifts;
- HR employees, frontline onboarding, Quick PIN controls;
- attendance, leave, shift swaps;
- unified approvals and domain approvals;
- reports catalog, generate, history, detail, export, download;
- branch profile;
- device registry, printer routing metadata, terminal pairing stub.

Locked safety boundaries:

- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING PROVIDER CONFIRMATION`.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes/reprint are metadata/request only unless driver integration is verified.
- Card terminal pairing is `STUB — no live hardware traffic`; no acquirer/card-terminal traffic.
- No compensation/payroll/bank/tax exposure.
- No fake live delivery, provider, printed, terminal-approved, or report-export success states.

## 3. Login and entry

Shared login shell supports email/password and high-tier Quick PIN.

Entry flow:

1. Manager enters credentials or Quick PIN.
2. Backend authenticates.
3. App stores token.
4. App calls `GET /api/auth/me`.
5. App verifies `JobRole.MANAGER`.
6. App resolves organization and memberships.
7. App selects active branch from `station_branch_id` or default branch.
8. App routes to `/manager/overview`.

Blocked:

- wrong credentials/PIN;
- no Manager role;
- no organization;
- no branch membership;
- branch mismatch;
- network error;
- expired session.

## 4. Manager shell

Header:

- brand;
- Manager workspace label;
- active branch selector;
- organization chip;
- optional clock;
- Manager identity;
- logout.

Bottom nav:

1. Overview
2. Operations
3. Staff
4. Reports
5. Settings
6. Me

No hidden More tab in MVP.

## 5. Overview screen

Goal: show current branch health fast.

Top area:

- title: `Manager overview`;
- subtitle: `Live branch performance, operational load, staff coverage, and pending exceptions.`;
- active branch chip;
- last updated;
- refresh.

KPI cards:

- Gross sales;
- Net sales;
- Open orders;
- Active tills;
- Active shifts;
- Pending approvals;
- Low stock;
- Anomalies.

Widgets:

1. Payment mix.
2. Open orders snapshot.
3. Low stock snapshot.
4. Pending approvals snapshot.
5. Active shifts/tills coverage.
6. Live metrics stream status.

States:

- loading skeleton KPI grid;
- empty: `No metrics available for this branch.`;
- failure: `Could not load Manager overview.`;
- degraded stream: `Live stream unavailable — showing latest fetched data.`;
- no branch: `Select a branch to view Manager overview.`

## 6. Operations screen

Goal: inspect active branch service without becoming Waiter or Cashier.

Sections:

1. Floor/table grid summary.
2. Active orders table.
3. Tills table.
4. Active shifts table.
5. Reservations snapshot.

Toolbar:

- search by order, table, staff, till, reservation if safe;
- filters: Active, Attention, Open orders, Active tills, Active shifts, Reservations today;
- sort: newest, oldest, highest total, table, staff.

Order row:

- order number;
- table/service type;
- server/waiter;
- status;
- total;
- payment state;
- updated time;
- action: `View detail`.

Till row:

- till code;
- cashier;
- status;
- opening float;
- expected cash;
- last activity;
- action: `View till`.

Shift row:

- staff;
- role;
- started time;
- status;
- branch.

No checkout/tender controls.

## 7. Staff screen

Goal: manage frontline staff operations safely.

Sections:

1. Staff directory.
2. Frontline onboarding.
3. Quick PIN management.
4. Attendance timeline.
5. Leave review.
6. Shift swap review.
7. Sensitive fields exclusion card.

Staff directory row:

- name;
- role;
- branch;
- status;
- linked user status;
- PIN status if loaded;
- action: `View staff`.

Employee detail drawer:

- identity;
- role/branch/status;
- safe contact summary if allowed;
- PIN status;
- attendance summary;
- leave/swap summary;
- restricted fields note.

Never display compensation, contract, bank, tax, payroll.

Onboarding:

- first/last name;
- role/jobRole;
- branch;
- email/phone if DTO requires;
- confirmation before create.

Quick PIN:

- status;
- reset;
- disable;
- enable;
- confirmation required.

Leave review:

- pending rows;
- reason;
- dates;
- employee;
- approve/reject with comment if DTO requires.

Shift swap review:

- requester;
- target;
- date/shift;
- approve/reject with comment if DTO requires.

## 8. Reports screen

Goal: generate and retrieve Manager reports.

Sections:

1. Report catalog.
2. Generate report.
3. Report runs history.
4. Report detail drawer.
5. Export/download panel.

Report templates:

- Shift end;
- Daily sales;
- Payment mix;
- Top items;
- Sales by category;
- Sales by hour;
- Discounts summary;
- Voids summary;
- Refunds summary;
- Cash variance;
- Stock variance;
- Wastage summary;
- Low stock;
- Reservation summary;
- Event summary;
- Anomaly summary;
- Staff operations.

Report run row:

- report type;
- branch;
- status;
- created by;
- created time;
- generated time;
- export status;
- action: `Open report`.

Export states:

- ready;
- generating;
- failed;
- generator unavailable;
- downloaded.

Do not fake PDF/Excel downloads if generator fails.

## 9. Settings screen

Goal: branch profile and device metadata.

Sections:

1. Branch profile.
2. Device registry.
3. Printer routes.
4. Terminal pairing.
5. Alert rules limitation.
6. Sync jobs limitation.
7. Owner/Admin exclusions.

Branch profile:

- name;
- address;
- phone;
- active status;
- update with confirmation.

Device registry:

- device id;
- device type;
- status;
- last seen;
- branch;
- action: `View device`.

Printer routes:

- route name;
- printer/device;
- target station;
- metadata only copy;
- update with confirmation if permitted.

Terminal pairing:

- terminal id;
- pairing status;
- stub caveat;
- no acquirer traffic.

## 10. Me screen

Goal: Manager identity and context.

Sections:

1. Profile card.
2. Session card.
3. Branch memberships.
4. Active branch selector shortcut.
5. Permission summary.
6. Restricted surfaces.
7. Known limitations.
8. Logout.

Restricted surfaces:

- Owner/Admin;
- SaaS billing;
- franchise;
- payroll;
- compensation;
- contracts;
- accounting;
- developer tools;
- live payment providers;
- physical printer drivers;
- acquirer traffic.

## 11. Approvals placement

MVP recommendation:

- Overview shows approval counts.
- Operations handles order/void/refund/discount escalations.
- Staff handles leave and shift-swap review.
- No separate Approvals bottom tab initially.

If approvals grow too dense, future nav can add `Approvals`, but it would require replacing or regrouping another tab.

## 12. Forbidden actions

Do not show:

- Waiter menu/order entry;
- Cashier checkout/tender panel;
- live MTN/Airtel;
- PesaPal diner checkout;
- real card terminal capture;
- physical print success;
- delivered receipt success;
- Owner/Admin settings;
- payroll/pay runs;
- compensation/contract detail;
- franchise/SaaS billing/developer surfaces;
- fake dashboard metrics;
- fake report downloads.

## 13. Acceptance criteria

Manager UI is acceptable when:

1. Manager logs in and resolves context.
2. Manager lands on Overview.
3. Branch switcher works and drives branch-scoped queries.
4. Nav is Overview, Operations, Staff, Reports, Settings, Me.
5. Overview shows real branch KPIs.
6. Operations shows real branch operational data without action clones.
7. Staff supports safe staff controls without payroll exposure.
8. Reports support real report workflows and export limitations.
9. Settings support branch/device metadata boundaries.
10. Me shows identity/session/context.
11. Unsupported workflows are absent or clearly blocked.
