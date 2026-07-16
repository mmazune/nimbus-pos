# manager_design.md — Nimbus POS Manager Workspace Design Contract

Status: Draft v1  
Date: 2026-07-06  
Extends: `DESIGN.md`  
Primary surface: fullscreen desktop POS terminal and manager office terminal  
Role: Manager / Branch Manager (`JobRole.MANAGER`)

## 1. Purpose

This document defines Manager-specific shell, layout, components, states, icon registry, density, and acceptance criteria.

Manager is a high-power branch role. Its UI must make broad capabilities understandable without hiding risk.

## 2. Locked decisions

- Manager uses shared login.
- Manager may use email/password or high-tier Quick PIN.
- `/api/auth/me` is resolved after login.
- Manager lands on `/manager/overview`.
- Fixed header and fixed bottom nav.
- Header includes active branch selector.
- Branch switcher is required because Manager has multi-branch memberships.
- Bottom nav: Overview, Operations, Staff, Reports, Settings, Me.
- No separate `BRANCH_MANAGER` role.
- No Owner/Admin/SaaS billing/franchise/developer pages.
- No payroll/compensation/contract detail in MVP.
- No Cashier checkout/payment collection.
- No Waiter menu/order-entry.
- Hardware/provider features remain metadata/stub where applicable.
- Manager writes require confirmations and backend-supported DTOs.

## 3. Shell

Header:

- brand/logo;
- workspace label `Manager`;
- selected branch;
- branch switcher dropdown;
- organization chip;
- current time optional;
- Manager name/avatar;
- session/logout.

Readiness strip:

| Signal | Copy |
|---|---|
| Branch selected | `Branch selected` |
| No branch | `Select branch` |
| Active tills | `Tills active` / `No active tills` |
| Active shifts | `Staff on shift` / `No active shifts` |
| Pending approvals | `Approvals pending` / `No pending approvals` |
| Report service | `Reports ready` / `Report generator unavailable` |
| Device metadata | `Devices registered` / `No devices registered` |

Bottom nav:

1. Overview — `ChartLineUp`
2. Operations — `SquaresFour`
3. Staff — `UsersThree`
4. Reports — `FileText`
5. Settings — `GearSix`
6. Me — `UserCircle`

## 4. Overview layout

Overview is Manager home.

Sections:

1. Branch context summary.
2. Today KPIs.
3. Payment mix.
4. Open orders.
5. Active tills.
6. Active shifts.
7. Pending approvals.
8. Low stock.
9. Anomaly summary.
10. Live metrics stream status.

Toolbar:

- branch selector in header;
- refresh;
- date scope if backend supports;
- last updated timestamp.

KPI cards:

- gross sales;
- net sales;
- open orders;
- active tills;
- active shifts;
- pending approvals;
- low stock items;
- anomalies.

No fake comparisons.

## 5. Operations layout

Operations is a read-heavy branch control desk.

Sections:

1. Floor/table status.
2. Active orders.
3. Tills.
4. Shifts.
5. Reservations.
6. Operational exceptions.

Each list supports:

- search;
- filters;
- sort;
- detail drawer;
- branch context;
- loading/empty/error states.

Manager does not build orders or close checkout from this route unless a future prompt explicitly adds verified Manager escalation actions.

## 6. Staff layout

Staff is Manager HR operations without payroll.

Sections:

1. Employee directory.
2. Frontline onboarding.
3. Quick PIN controls.
4. Attendance.
5. Leave review.
6. Shift swap review.
7. Staff safety caveats.

Employee list safe fields:

- name;
- role/jobRole;
- branch;
- status;
- contact summary only if policy allows;
- linked user status;
- PIN status.

Never show:

- salary;
- wage rate;
- bank;
- tax;
- contracts detail;
- compensation profile;
- pay run status.

## 7. Reports layout

Reports is a first-class Manager page.

Sections:

1. Report catalog.
2. Generate report form.
3. Report run history.
4. Report detail drawer.
5. Export/download area.
6. Generator-unavailable warning.

Group report types:

- Sales;
- Payments;
- Inventory;
- Variance;
- Staff operations;
- Reservations/events;
- Anomalies;
- Audit/loss prevention.

## 8. Settings layout

Settings is branch/device scoped.

Sections:

1. Branch profile.
2. Device registry.
3. Printer routing metadata.
4. Terminal pairing stub.
5. Alerts read/deferred state.
6. Sync jobs read/deferred state.
7. Owner/Admin exclusions.

Settings must not show:

- SaaS billing;
- global organization settings;
- franchise settings;
- developer settings;
- access matrix.

## 9. Me layout

Me is identity and context.

Sections:

1. Manager profile.
2. Session context.
3. Branch memberships.
4. Active branch selector shortcut.
5. Permission summary.
6. Restricted surfaces.
7. Logout.

No personal payroll or HR details.

## 10. Component inventory

Shell:

- `ManagerShell`
- `ManagerHeader`
- `ManagerBottomNav`
- `ManagerSessionGuard`
- `ManagerBranchSwitcher`
- `ManagerReadinessStrip`
- `ManagerContextProvider`

Overview:

- `ManagerOverviewScreen`
- `ManagerKpiCard`
- `ManagerPaymentMixCard`
- `ManagerOpenOrdersWidget`
- `ManagerLowStockWidget`
- `ManagerAnomalyWidget`
- `ManagerLiveMetricsStatus`

Operations:

- `ManagerOperationsScreen`
- `ManagerFloorStatusPanel`
- `ManagerOrdersTable`
- `ManagerOrderDetailDrawer`
- `ManagerTillsTable`
- `ManagerShiftsTable`
- `ManagerReservationsPanel`

Staff:

- `ManagerStaffScreen`
- `ManagerEmployeeDirectory`
- `ManagerEmployeeDetailDrawer`
- `ManagerFrontlineOnboardForm`
- `ManagerQuickPinPanel`
- `ManagerAttendanceTable`
- `ManagerLeaveReviewPanel`
- `ManagerShiftSwapReviewPanel`

Reports:

- `ManagerReportsScreen`
- `ManagerReportCatalog`
- `ManagerReportGenerateForm`
- `ManagerReportRunsTable`
- `ManagerReportDetailDrawer`
- `ManagerReportExportPanel`

Settings:

- `ManagerSettingsScreen`
- `ManagerBranchProfileForm`
- `ManagerDeviceRegistryTable`
- `ManagerPrinterRoutesPanel`
- `ManagerTerminalPairingPanel`
- `ManagerSettingsDeferredCard`

Me:

- `ManagerMeScreen`
- `ManagerProfileCard`
- `ManagerMembershipsPanel`
- `ManagerRestrictedSurfacesCard`

States:

- `ManagerLoadingState`
- `ManagerEmptyState`
- `ManagerErrorState`
- `ManagerForbiddenState`
- `ManagerBranchMissingState`
- `ManagerDeferredSurfaceCard`

## 11. Acceptance criteria

- Manager logs in and lands on Overview.
- Header/nav match contract.
- Branch selector works and refetches branch-scoped data.
- Overview uses real KPIs.
- Operations is read-only unless verified action prompt enables writes.
- Staff excludes compensation/contract/payroll.
- Reports handle generator/download limitations.
- Settings stays branch/device scoped.
- Me is context/profile only.
- No Owner/Admin/SaaS/franchise/payroll/checkout/order-builder surfaces.
