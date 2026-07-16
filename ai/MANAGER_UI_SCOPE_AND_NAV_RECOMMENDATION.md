# Manager UI Scope & Nav Recommendation

This document outlines the scope, role boundaries, and user interface recommendations for the **Manager / Branch Manager** workspace.

---

## 1. Recommended Role Target: MANAGER
- **Role Verification**: The target system role is named `Manager` in seed data (`roleName: 'Manager'`), mapping to the enum value `JobRole.MANAGER`.
- **Branch Manager Separation**: There is no distinct `BRANCH_MANAGER` enum or database role. The single `MANAGER` role handles all branch-level and multi-branch management functions.

---

## 2. Recommended Navigation Model
We recommend a six-tab navigation architecture for the bottom navigation bar (matching Waiter/Cashier/Supervisor visual layout styles):
1. **Overview**
2. **Operations**
3. **Staff**
4. **Reports**
5. **Settings**
6. **Me**

---

## 3. Tab-by-Tab Scope Definition

### A. Overview (Dashboard)
- **Purpose**: Displays the branch’s daily performance summary, active operations indicators, open order counts, and active alert rules.
- **APIs**:
  - `GET /api/dash/manager` (manager dashboard metrics)
  - `GET /api/dash/today-summary` (today's revenue summary)
  - `GET /api/dash/payment-mix` (momo/card/cash mix)
  - `GET /api/stream/metrics` (live updates SSE)
- **Permissions**: `pos:dash:manager:read`, `pos:dash:today-summary:read`
- **Data Sensitivity**: High (contains aggregate sales revenue).
- **MVP Status**: Safe.
- **Deferred Features**: Historical sales comparisons, forecasting charts.
- **Forbidden Features**: Global organization financials, SaaS subscription totals.

### B. Operations Oversight
- **Purpose**: Provides real-time visibility into branch floors, orders, cashier queues, tills, and active shifts.
- **APIs**:
  - `GET /api/pos/orders` (active branch orders)
  - `GET /api/tables` (active table statuses)
  - `GET /api/tills` (till drawer balances)
  - `GET /api/shifts` (active staff shifts)
- **Permissions**: `pos:orders:read`, `pos:table:read`, `pos:till:read`, `pos:shift:read`
- **Data Sensitivity**: Medium.
- **MVP Status**: Safe.
- **Deferred Features**: Void execution, order item modifications, checkout/settlement clones.
- **Forbidden Features**: Live card payment terminal pairing, physical receipt printing.

### C. Staff Management
- **Purpose**: Staff roster directory, frontline onboarding, Quick PIN reset, and leave / shift swap reviews.
- **APIs**:
  - `GET /api/hr/employees` (list staff)
  - `POST /api/hr/frontline-staff/onboard` (onboard new frontline workers)
  - `GET/POST/PATCH` `/api/hr/frontline-staff/:id/quick-pin...` (reset/disable/enable PINs)
  - `GET /api/hr/leave` and `PATCH /api/hr/leave/:id/review` (leave requests review)
  - `GET /api/hr/shift-swaps` and `PATCH /api/hr/shift-swaps/:id/approve` (shift swaps approval)
- **Permissions**: `pos:hr:employees:read`, `hr:frontline-staff:create`, `auth:quick-pin:read/write`, `pos:hr:leave:read/review`, `pos:hr:shift-swaps:read/approve`
- **Data Sensitivity**: High (contains user details, addresses, and PIN control credentials).
- **MVP Status**: Safe.
- **Deferred Features**: Compensation/Salary profiles list, employment contracts list (deferred to prevent payroll leakage).
- **Forbidden Features**: Payroll calculations, payslip distributions.

### D. Reports & Exports
- **Purpose**: Requesting new PDF/Excel reports, viewing history, and downloading outputs.
- **APIs**:
  - `GET /api/reports/catalog` (listing templates)
  - `POST /api/reports/<type>` (generating shift-end, daily-sales, payments, stock-variance, anomaly reports)
  - `GET /api/reports` and `GET /api/reports/:id` (runs history)
  - `POST /api/reports/export` and `GET /api/reports/exports/:id/download` (downloads)
- **Permissions**: `pos:reports:catalog:read`, `pos:reports:history:read`, `pos:reports:exports:read`, `pos:reports:exports:download`, plus report-specific generate permissions.
- **Data Sensitivity**: High.
- **MVP Status**: Safe.
- **Deferred Features**: Interactive report customization builders.
- **Forbidden Features**: SaaS billing subscriptions invoices, corporate group consolidated reports.

### E. Settings & Devices
- **Purpose**: Modifying the branch public profile, listing devices, configuring printer routes, and card terminal pairing.
- **APIs**:
  - `PATCH /api/branches/:id` (branch profile edit)
  - `GET /api/devices` (device inventory)
  - `POST /api/devices/activate` (activate slot metadata)
  - `POST /api/devices/printers/routes` (printer routing config)
  - `POST /api/devices/terminals/pair` (stub-only pairing)
- **Permissions**: `tenancy:branch:write`, `devices:read`, `devices:write`, `devices:routes:write`, `devices:terminals:write`
- **Data Sensitivity**: Medium.
- **MVP Status**: Safe.
- **Deferred Features**: Live acquirer integrations, driver setups.
- **Forbidden Features**: Global organization-level tenancy profiles, SaaS settings.

### F. Me (Profile & Context)
- **Purpose**: Manager session profile card, branch switching context, and logout.
- **APIs**:
  - `GET /api/auth/me` (session user context)
  - `POST /api/auth/logout` (session destroy)
  - `GET /api/branches` (list organization branches for switching context)
- **Permissions**: `identity:session:read`, `tenancy:branch:read`
- **Data Sensitivity**: Low.
- **MVP Status**: Safe.
- **Deferred Features**: Personal attendance performance analytics.
- **Forbidden Features**: Editing general system roles permissions.

---

## 4. Role Boundaries & Exclusions
The Manager UI is a branch-level operations control dashboard. It must NOT contain:
1. **Franchise Consolidated Portals**: Consolidated multitenant billing reports are out of scope.
2. **SaaS Subscriptions or Invoicing**: No billing/PesaPal SaaS plan checkout surfaces.
3. **Cashier / Waiter Action Clones**: No order builder menus or checkout swipe controls.
4. **Compensation / Salary Configuration**: Employee compensation and payment settings are excluded.

---

## 5. Comparison with Supervisor Workspace

| Feature Area | Supervisor UI Scope | Manager UI Scope | Added Value for Manager |
| :--- | :--- | :--- | :--- |
| **Landing Route** | `/supervisor/floor` | `/manager/overview` | Manager lands on high-level operational metrics overview instead of a floor layout grid. |
| **Branch Context** | Locked to `defaultBranchId`. | Switching between org branches enabled. | Manager can toggle view between `MAIN` and `DOWNTOWN` branches. |
| **Frontline Auth Control** | None (Read-only). | Reset, enable, or disable frontline PINs. | Direct control over frontline credentials on the floor. |
| **Onboarding** | None. | Onboard new frontline staff directly. | Ability to add employees to the workspace. |
| **Approvals** | Read-only warnings. | Full decide actions (Approve/Reject). | Direct resolution of pending overrides and leaves. |
| **Reports** | Exposes 4 basic templates. | Exposes all 15+ templates + downloads. | Full audit, variance, and financial download access. |
| **Settings** | Locked (no access). | Editable branch settings and printer routing. | Manager manages hardware slots and printer routes. |

---

## 6. Suggested Prompt 1 Scope
- **Target**: Shell, Navigation, Guards, and Session Context.
- **Tasks**:
  1. Add routing mapping in `apps/web/src/lib/auth/role.ts` and `pages/login.tsx` to redirect valid Manager logins to `/manager/overview`.
  2. Implement `ManagerShell` layout with a top header and bottom tabs.
  3. Implement `ManagerSessionGuard` to check for `isManager` compatibility.
  4. Create page stubs at `/manager/overview`, `/manager/operations`, `/manager/staff`, `/manager/reports`, `/manager/settings`, `/manager/me`.
  5. Implement dynamic branch switcher context in `ManagerHeader` showing memberships.
