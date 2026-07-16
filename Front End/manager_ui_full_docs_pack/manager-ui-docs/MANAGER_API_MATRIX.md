# MANAGER_API_MATRIX.md — Nimbus POS Manager API Matrix

Status: Verified draft v1  
Date: 2026-07-06  
Scope: Manager-relevant endpoint matrix verified from Prompt 0 repository verification.

## 1. General rules

- Use existing endpoints only.
- All branch-scoped endpoints must use the active Manager branch context.
- Manager users may belong to multiple branches, so the frontend must not assume a single static branch.
- Mutating actions require confirmation and must use backend-supported DTOs.
- Use idempotency headers where supported; otherwise block double-submit with in-flight state.
- Do not expose payroll, compensation, contracts detail, bank, tax, or sensitive HR data.
- Do not present live provider/hardware behavior unless backend integration is verified.
- Public MTN/Airtel execution, PesaPal diner checkout, real print driver, and real card acquirer traffic are excluded.

## 2. API matrix

# Manager API Matrix

This matrix documents the backend API endpoints exposed to the Manager role (`roleName: 'Manager'`), including required permissions, branch/organization scoping, data sensitivity, and readiness for the Manager MVP.

| Surface | Method | Endpoint | Controller/service source | Permission | Role-scope notes | Data sensitivity | Read/write | MVP use | Caveats |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | GET | `/api/dash/manager` | `DashboardsController` | `pos:dash:manager:read` | Branch-scoped | High (aggregate sales) | Read | Yes | Returns summary gross/net sales, order count, and counts for open orders, anomalies, and active shifts/tills. |
| **Overview** | GET | `/api/dash/today-summary` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | High (sales summary) | Read | Yes | Returns branch-specific today summary numbers. |
| **Overview** | GET | `/api/dash/payment-mix` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Medium (payment mix) | Read | Yes | Returns breakdown by Cash, Card, and Mobile Money today. |
| **Overview** | GET | `/api/dash/open-orders` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Medium (order listing) | Read | Yes | Lists active orders and their timestamps. |
| **Overview** | GET | `/api/dash/low-stock` | `DashboardsController` | `pos:dash:today-summary:read` | Branch-scoped | Low (stock counts) | Read | Yes | Lists items currently below reorder thresholds. |
| **Overview** | POST | `/api/dash/kpi/refresh` | `DashboardsController` | `pos:dash:kpi:refresh` | Branch-scoped | Medium (cached KPIs) | Write | Yes | Forces recalculation of dashboard metrics. |
| **Overview** | SSE | `/api/stream/metrics` | `StreamController` | None (Requires JWT) | Branch-scoped | Medium (activity stream) | Read | Yes | Event stream emitting live branch metrics every 15 seconds. |
| **Operations** | GET | `/api/pos/orders` | `OrdersController` | `pos:orders:read` | Branch-scoped | Medium (orders list) | Read | Yes | Returns all active branch orders. |
| **Operations** | GET | `/api/pos/orders/:id` | `OrdersController` | `pos:orders:read` | Branch-scoped | Medium (order details) | Read | Yes | Returns order lines, status, and linked payments. |
| **Operations** | GET | `/api/tables` | `FloorController` | `pos:table:read` | Branch-scoped | Low (layout) | Read | Yes | Returns active floor plan tables and layout states. |
| **Operations** | GET | `/api/reservations` | `ReservationsController` | `pos:reservation:read` | Branch-scoped | Low (guest data) | Read | Yes | Lists branch reservations. |
| **Operations** | GET | `/api/tills` | `TillsController` | `pos:till:read` | Branch-scoped | Medium (till register) | Read | Yes | Lists branch tills and active cashier sessions. |
| **Operations** | GET | `/api/shifts` | `ShiftsController` | `pos:shift:read` | Branch-scoped | Medium (staff shifts) | Read | Yes | Lists active and historical branch shifts. |
| **Approvals** | GET | `/api/approvals` | `UnifiedApprovalsController` | `approvals:read` | Branch-scoped | High (pending writes) | Read | Yes | Inbox aggregator listing discounts, refunds, leave, shift-swaps, and transfer reviews. |
| **Approvals** | GET | `/api/approvals/:id` | `UnifiedApprovalsController` | `approvals:read` | Branch-scoped | High (action details) | Read | Yes | Returns complete payload and reason of a pending escalation. |
| **Approvals** | POST | `/api/approvals/:id/decide` | `UnifiedApprovalsController` | `approvals:decide` | Branch-scoped | High (decision write) | Write | Yes | Executes approval or rejection of the target entity. |
| **Approvals** | POST | `/api/pos/discounts/:id/approve` | `DiscountsController` | `pos:discount:approve` | Branch-scoped | High | Write | Yes | Direct domain-specific discount override. |
| **Approvals** | POST | `/api/pos/refunds/:id/approve` | `RefundsController` | `pos:refund:approve` | Branch-scoped | High | Write | Yes | Direct domain-specific refund approval. |
| **Approvals** | POST | `/api/pos/orders/:id/post-close-void` | `RefundsController` | `pos:void:postclose` | Branch-scoped | High | Write | Yes | Void a closed order (requires manager approval). |
| **Staff** | GET | `/api/hr/employees` | `HrController` | `pos:hr:employees:read` | Branch-scoped | Medium | Read | Yes | Lists employee records. |
| **Staff** | POST | `/api/hr/employees` | `HrController` | `pos:hr:employees:create` | Branch-scoped | High (PII) | Write | Yes | Creates staff user record. Comp fields must be omitted from UI. |
| **Staff** | PATCH | `/api/hr/employees/:id` | `HrController` | `pos:hr:employees:update` | Branch-scoped | High | Write | Yes | Updates staff profile (excludes compensation fields). |
| **Staff** | POST | `/api/hr/frontline-staff/onboard` | `HrController` | `hr:frontline-staff:create` | Branch-scoped | High | Write | Yes | One-call endpoint to onboard frontline staff. |
| **Staff** | GET | `/api/hr/frontline-staff/:id/quick-pin-status` | `HrController` | `auth:quick-pin:read` | Branch-scoped | Medium | Read | Yes | Retrieves whether an employee has a PIN set and is active. |
| **Staff** | POST | `/api/hr/frontline-staff/:id/quick-pin/reset` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Resets frontline employee's quick PIN. |
| **Staff** | PATCH | `/api/hr/frontline-staff/:id/quick-pin/disable` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Disables frontline PIN login access. |
| **Staff** | PATCH | `/api/hr/frontline-staff/:id/quick-pin/enable` | `HrController` | `auth:quick-pin:write` | Branch-scoped | High | Write | Yes | Re-enables frontline PIN login access. |
| **Staff** | GET | `/api/hr/attendance` | `AttendanceController` | `pos:hr:attendance:read` | Branch-scoped | Medium | Read | Yes | View branch employee clock-in/out timeline. |
| **Staff** | GET | `/api/hr/leave` | `AttendanceController` | `pos:hr:leave:read` | Branch-scoped | Medium | Read | Yes | View leave requests. |
| **Staff** | PATCH | `/api/hr/leave/:id/review` | `AttendanceController` | `pos:hr:leave:review` | Branch-scoped | High | Write | Yes | Manager leave review (Approve/Reject). |
| **Staff** | GET | `/api/hr/shift-swaps` | `AttendanceController` | `pos:hr:shift-swaps:read` | Branch-scoped | Medium | Read | Yes | View shift swap proposals. |
| **Staff** | PATCH | `/api/hr/shift-swaps/:id/approve` | `AttendanceController` | `pos:hr:shift-swaps:approve` | Branch-scoped | High | Write | Yes | Approve or reject shift swaps. |
| **Staff** | GET | `/api/hr/contracts` | `HrController` | `pos:hr:contracts:read` | Branch-scoped | Critical (Compensation) | Read | Deferred | Returns contract records. Defer from MVP to avoid exposing compensation. |
| **Staff** | POST | `/api/hr/contracts` | `HrController` | `pos:hr:contracts:create` | Branch-scoped | Critical (Salary/Rates) | Write | Deferred | Create contract records. Defer from MVP. |
| **Reports** | GET | `/api/reports` | `ReportsController` | `pos:reports:history:read` | Branch-scoped | Medium | Read | Yes | Lists historical runs of generated reports. |
| **Reports** | GET | `/api/reports/:id` | `ReportsController` | `pos:reports:history:read` | Branch-scoped | Medium (report data) | Read | Yes | Retrieves generated report content payload. |
| **Reports** | POST | `/api/reports/shift-end` | `ReportsController` | `pos:reports:shift-end:generate` | Branch-scoped | Medium | Write | Yes | Generates till/cashier session closeout audits. |
| **Reports** | POST | `/api/reports/daily-sales` | `ReportsController` | `pos:reports:daily-sales:generate` | Branch-scoped | High (sales totals) | Write | Yes | Generates aggregate branch revenue breakdown. |
| **Reports** | POST | `/api/reports/payment-mix` | `ReportsController` | `pos:reports:payment-mix:generate` | Branch-scoped | Medium | Write | Yes | Generates cash/card/momo breakdown. |
| **Reports** | POST | `/api/reports/top-items` | `ReportsController` | `pos:reports:top-items:generate` | Branch-scoped | Medium | Write | Yes | Generates menu item popularity report. |
| **Reports** | POST | `/api/reports/sales-by-category` | `ReportsController` | `pos:reports:sales-by-category:generate` | Branch-scoped | Medium | Write | Yes | Generates menu category revenue report. |
| **Reports** | POST | `/api/reports/sales-by-hour` | `ReportsController` | `pos:reports:sales-by-hour:generate` | Branch-scoped | Medium | Write | Yes | Generates peak hours revenue report. |
| **Reports** | POST | `/api/reports/discounts-summary` | `ReportsController` | `pos:reports:discounts:generate` | Branch-scoped | High (margins) | Write | Yes | Generates totals and list of approved discounts. |
| **Reports** | POST | `/api/reports/voids-summary` | `ReportsController` | `pos:reports:voids:generate` | Branch-scoped | High (losses) | Write | Yes | Generates totals and list of order voids. |
| **Reports** | POST | `/api/reports/refunds-summary` | `ReportsController` | `pos:reports:refunds:generate` | Branch-scoped | High (margins) | Write | Yes | Generates totals and list of order refunds. |
| **Reports** | POST | `/api/reports/cash-variance` | `ReportsController` | `pos:reports:cash-variance:generate` | Branch-scoped | High | Write | Yes | Generates till drop/reconcile discrepancies. |
| **Reports** | POST | `/api/reports/stock-variance` | `ReportsController` | `pos:reports:stock-variance:generate` | Branch-scoped | High (shrinkage) | Write | Yes | Generates count variance audits. |
| **Reports** | POST | `/api/reports/wastage-summary` | `ReportsController` | `pos:reports:wastage:generate` | Branch-scoped | Medium | Write | Yes | Generates inventory write-off logs. |
| **Reports** | POST | `/api/reports/low-stock` | `ReportsController` | `pos:reports:low-stock:generate` | Branch-scoped | Low | Write | Yes | Generates inventory replenishment list. |
| **Reports** | POST | `/api/reports/reservation-summary` | `ReportsController` | `pos:reports:reservations:generate` | Branch-scoped | Low | Write | Yes | Generates guest seating/booking summary. |
| **Reports** | POST | `/api/reports/event-summary` | `ReportsController` | `pos:reports:events:generate` | Branch-scoped | Low | Write | Yes | Generates ticket revenue/attendance summary. |
| **Reports** | POST | `/api/reports/anomaly-summary` | `ReportsController` | `pos:reports:anomaly-summary:generate` | Branch-scoped | High (security) | Write | Yes | Generates high-risk operational incident log. |
| **Reports** | POST | `/api/reports/staff-operations` | `ReportsController` | `pos:reports:staff-operations:generate` | Branch-scoped | Medium | Write | Yes | Generates speed-of-service/table performance. |
| **Reports** | POST | `/api/reports/export` | `ReportsController` | `pos:reports:exports:read` | Branch-scoped | Medium | Write | Yes | Packages report run payload into an export file. |
| **Reports** | GET | `/api/reports/exports/:id/download` | `ReportsController` | `pos:reports:exports:download` | Branch-scoped | Medium | Read | Yes | File download stream for generated reports. |
| **Reports** | GET | `/api/reports/catalog` | `ReportsController` | `pos:reports:catalog:read` | Branch-scoped | Low | Read | Yes | Retrieves list of printable formats and templates. |
| **Settings** | GET | `/api/branches` | `BranchesController` | `tenancy:branch:read` | Organization-scoped | Low | Read | Yes | Lists organization branches. Used for branch context switching. |
| **Settings** | PATCH | `/api/branches/:id` | `BranchesController` | `tenancy:branch:write` | Branch-scoped | Medium | Write | Yes | Updates branch settings (e.g. name, address). |
| **Settings** | GET | `/api/devices` | `DeviceRegistryController` | `devices:read` | Branch-scoped | Low | Read | Yes | Lists registered branch hardware/stubs. |
| **Settings** | POST | `/api/devices/activate` | `DeviceRegistryController` | `devices:write` | Branch-scoped | Medium | Write | Yes | Registers and activates device slots. |
| **Settings** | POST | `/api/devices/printers/routes` | `DeviceRegistryController` | `devices:routes:write` | Branch-scoped | Medium | Write | Yes | Adds or updates receipt/KDS routing rules. |
| **Settings** | POST | `/api/devices/terminals/pair` | `DeviceRegistryController` | `devices:terminals:write` | Branch-scoped | Medium | Write | Yes | Initiates pairing sequence with terminal stub. |


## 3. Domain implementation notes

### Overview

The Overview page should initially prioritize read endpoints. `POST /api/dash/kpi/refresh` is allowed only after a clear confirmation and in-flight state.

### Operations

Operations should remain read-only in early prompts. It may link to domain details but must not add Waiter menu entry or Cashier checkout flows.

### Staff

Staff is powerful. Employee create/update, onboarding, and Quick PIN controls require exact DTO verification, confirmation, and sensitive-field filtering.

### Approvals

Manager has unified approval access, but GAP-05 says generic decide payloads can be source-specific. Prefer domain-specific write endpoints when DTOs are clearer.

### Reports

Reports are first-class. The UI must handle generator/export failure honestly.

### Settings

Device/printer/terminal settings are metadata/stub unless integrations are confirmed.
