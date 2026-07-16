# MANAGER_FEATURE_SCOPE.md — Nimbus POS Manager Capability Documentation

Status: Draft v1  
Date: 2026-07-06

## 1. Purpose

This document summarizes all Manager-visible capabilities, safe actions, sensitive data boundaries, and deferred surfaces.

## 2. Role summary

Manager is the branch-level management workspace. It is more powerful and broader than Supervisor.

Manager owns:

- branch dashboard;
- operational oversight;
- staff management;
- report generation;
- branch settings;
- device metadata;
- approval decisions;
- branch context switching.

Manager does not own:

- Owner/Admin role access matrix;
- franchise consolidation;
- SaaS billing;
- payroll/pay runs;
- accounting ledgers;
- developer settings;
- Cashier checkout;
- Waiter order entry.

## 3. What Manager can see

### Branch performance

- gross sales;
- net sales;
- today summary;
- payment mix;
- open orders;
- low stock;
- anomalies;
- active tills;
- active shifts;
- pending approvals.

### Operations

- active table states;
- floor layouts;
- order lists and detail;
- reservation lists;
- till sessions;
- shift sessions;
- operational exceptions.

### Staff

- employee roster safe fields;
- role/jobRole;
- branch;
- status;
- linked user state;
- Quick PIN status;
- attendance;
- leave requests;
- shift swaps.

### Approvals

- unified approval inbox;
- approval details;
- discount approvals;
- refund approvals;
- post-close void candidates;
- leave review;
- shift swap review.

### Reports

- report catalog;
- report generation forms;
- report run history;
- report details;
- export/download states.

### Settings and devices

- branch profile;
- devices;
- printer route metadata;
- terminal stub pairing metadata;
- alert/sync deferred states.

## 4. What Manager can do

### Overview

- refresh dashboard KPIs if permitted;
- inspect live branch health;
- follow stream status.

### Operations

- inspect operational detail;
- move between floor/order/till/shift/reservation context;
- no direct checkout/order building.

### Staff

- create/update safe staff fields if DTOs allow;
- onboard frontline staff;
- manage Quick PIN status;
- review leave;
- approve/reject shift swaps;
- inspect attendance.

### Approvals

- decide approvals only with verified DTOs;
- prefer domain-specific write endpoints;
- confirm all decisions.

### Reports

- generate reports;
- view historical runs;
- export/download when generator supports it.

### Settings

- update branch metadata;
- activate device metadata slots;
- configure printer route metadata;
- initiate terminal stub pairing.

## 5. What Manager must not see

- salary/wage;
- compensation profiles;
- employment contracts detail;
- bank details;
- tax IDs;
- payroll;
- payslips;
- pay runs;
- private HR notes;
- unrestricted staff PII;
- Owner/Admin permission matrix;
- SaaS billing;
- franchise dashboard;
- developer keys.

## 6. What Manager must not do

- create live diner mobile-money checkout;
- use PesaPal for diner checkout;
- perform Cashier settlement;
- build Waiter orders;
- invoke real printer driver;
- invoke live acquirer/card terminal;
- claim fake report download success;
- fake approval decisions;
- override branch scoping;
- bypass backend permissions.

## 7. Route capability map

| Route | Main capabilities | Writes allowed in MVP | Critical exclusions |
|---|---|---|---|
| `/manager/overview` | KPIs, alerts, live branch status | KPI refresh only if verified | Global financials, forecasts unless returned |
| `/manager/operations` | Tables, orders, tills, shifts, reservations | None initially | Cashier checkout, Waiter order entry |
| `/manager/staff` | Roster, onboarding, PIN, attendance, leave/swap review | Onboard, safe employee update, PIN, leave/swap decisions if verified | Payroll, compensation, contracts |
| `/manager/reports` | Catalog, generation, history, exports | Generate/export reports | Fake downloads, SaaS invoices |
| `/manager/settings` | Branch profile, devices, printer routes, terminal stubs | Branch/device metadata writes if verified | Owner/Admin/franchise/developer settings |
| `/manager/me` | Profile, branch context, logout | Logout only | Personal payroll, staff admin |

## 8. Build priority

1. Shell and branch context.
2. Overview.
3. Operations.
4. Staff.
5. Reports.
6. Settings.
7. Approval action hardening.
8. Final QA.

## 9. Product-owner decisions required

See `MANAGER_APPROVAL_DECISIONS.md`.
