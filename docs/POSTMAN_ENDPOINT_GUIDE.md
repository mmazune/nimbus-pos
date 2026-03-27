# Postman Endpoint Guide — Nimbus POS

Quick-reference of **every API endpoint** with Postman collection mapping.

## Auth & Identity (M2)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/auth/login` | M2-Auth-RBAC |
| POST | `/api/auth/pin-login` | M2-Auth-RBAC |
| POST | `/api/auth/refresh` | M2-Auth-RBAC |
| POST | `/api/auth/logout` | M2-Auth-RBAC |
| POST | `/api/auth/logout-all` | M2-Auth-RBAC |
| GET | `/api/auth/me` | M2-Auth-RBAC |
| GET | `/api/auth/sessions` | M2-Auth-RBAC |
| GET | `/api/auth/_perm-test` | M2-Auth-RBAC |
| GET | `/api/me` | M3-Tenancy |

## Tenancy (M3)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/orgs` | M3-Tenancy |
| GET | `/api/branches` | M3-Tenancy |
| GET | `/api/branches/:id` | M3-Tenancy |
| POST | `/api/orgs/:orgId/branches` | M3-Tenancy |
| POST | `/api/orgs/:orgId/branches/:branchId/memberships` | M3-Tenancy |
| GET | `/api/orgs/:orgId/branches/:branchId/memberships` | M3-Tenancy |

## Quick PIN (M3.1)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/auth/quick-pin/issue` | M3_1-Quick-PIN-Login |
| POST | `/api/auth/quick-pin/login` | M3_1-Quick-PIN-Login |
| POST | `/api/auth/quick-pin/reset` | M3_1-Quick-PIN-Login |
| GET | `/api/auth/quick-pin/status` | M3_1-Quick-PIN-Login |
| PATCH | `/api/auth/quick-pin/settings` | M3_1-Quick-PIN-Login |

## Org Settings (M4)

| Method | Path | Collection |
|--------|------|-----------|
| GET | `/api/settings` | M4-Org-Settings |
| GET/PATCH | `/api/currency` | M4-Org-Settings |
| GET/PATCH | `/api/tax-matrix` | M4-Org-Settings |
| GET/PATCH | `/api/rounding` | M4-Org-Settings |
| GET/PATCH | `/api/thresholds` | M4-Org-Settings |
| GET/PATCH | `/api/platform-access` | M4-Org-Settings |
| POST/GET | `/api/exchange-rates` | M4-Org-Settings |

## Floor Plans & Tables (M5)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/floor-plans` | M5-Floor-Plans-Tables |
| GET/PATCH | `/api/floor-plans/:id` | M5-Floor-Plans-Tables |
| POST/GET | `/api/tables` | M5-Floor-Plans-Tables |
| GET/PATCH | `/api/tables/:id` | M5-Floor-Plans-Tables |
| PATCH | `/api/tables/:id/status` | M5-Floor-Plans-Tables |
| GET | `/api/tables/availability` | M5-Floor-Plans-Tables |

## Menu Catalog (M6)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/categories` | M6-Menu-Catalog |
| GET/PATCH | `/api/categories/:id` | M6-Menu-Catalog |
| POST/GET | `/api/tax-categories` | M6-Menu-Catalog |
| POST/GET | `/api/menu-items` | M6-Menu-Catalog |
| GET/PATCH | `/api/menu-items/:id` | M6-Menu-Catalog |
| GET | `/api/catalog` | M6-Menu-Catalog |

## Recipes & Costing (M8)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/inventory/items` | M8-Recipes-Costing |
| GET/PATCH | `/api/inventory/items/:id` | M8-Recipes-Costing |
| POST/GET | `/api/inventory/recipes/:menuItemId` | M8-Recipes-Costing |
| GET | `/api/inventory/recipes/:menuItemId/cost` | M8-Recipes-Costing |

## Inventory & Stock (M9)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/inventory/stock-batches` | M9-Inventory-Stock |
| GET | `/api/inventory/levels` | M9-Inventory-Stock |
| POST | `/api/inventory/adjustments` | M9-Inventory-Stock |

## POS Orders (M10)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/orders` | M10-POS-Orders |
| GET/PATCH | `/api/orders/:id` | M10-POS-Orders |
| POST | `/api/orders/:id/items` | M10-POS-Orders |
| PATCH | `/api/orders/:id/close` | M10-POS-Orders |
| PATCH | `/api/orders/:id/void` | M10-POS-Orders |

## KDS (M11)

| Method | Path | Collection |
|--------|------|-----------|
| GET | `/api/kds/queue` | M11-KDS-Station-Routing |
| PATCH | `/api/kds/tickets/:id/ready` | M11-KDS-Station-Routing |
| PATCH | `/api/kds/tickets/:id/recall` | M11-KDS-Station-Routing |
| SSE | `/api/kds/stream` | M11-KDS-Station-Routing |

## Discounts (M12)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/discounts` | M12-Discounts-Approval-Workflow |
| PATCH | `/api/discounts/:id/approve` | M12-Discounts-Approval-Workflow |
| PATCH | `/api/discounts/:id/reject` | M12-Discounts-Approval-Workflow |
| GET | `/api/discounts` | M12-Discounts-Approval-Workflow |

## Payments (M13)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/payments` | M13-Payments |
| GET | `/api/payments` | M13-Payments |
| POST | `/api/payments/intents` | M13-Payments |

## Refunds (M14)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/refunds` | M14-Refunds |
| PATCH | `/api/refunds/:id/approve` | M14-Refunds |
| GET | `/api/refunds` | M14-Refunds |
| PATCH | `/api/orders/:id/post-close-void` | M14-Refunds |

## Shifts & Tills (M15)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/shifts` | M15-Shifts-Tills |
| PATCH | `/api/shifts/:id/close` | M15-Shifts-Tills |
| GET | `/api/shifts` | M15-Shifts-Tills |
| POST | `/api/tills` | M15-Shifts-Tills |
| PATCH | `/api/tills/:id/reconcile` | M15-Shifts-Tills |
| POST | `/api/tills/:id/safe-drop` | M15-Shifts-Tills |
| GET | `/api/tills` | M15-Shifts-Tills |

## Reservations & Deposits (M16)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/reservations` | M16-Reservations-Deposits |
| GET/PATCH | `/api/reservations/:id` | M16-Reservations-Deposits |
| PATCH | `/api/reservations/:id/confirm` | M16-Reservations-Deposits |
| PATCH | `/api/reservations/:id/seat` | M16-Reservations-Deposits |
| PATCH | `/api/reservations/:id/cancel` | M16-Reservations-Deposits |
| PATCH | `/api/reservations/:id/no-show` | M16-Reservations-Deposits |
| POST/GET | `/api/reservations/:id/deposits` | M16-Reservations-Deposits |

## Events & Ticketing (M17)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/events` | M17-Events-Booking-Ticketing |
| GET/PATCH | `/api/events/:id` | M17-Events-Booking-Ticketing |
| PATCH | `/api/events/:id/publish` | M17-Events-Booking-Ticketing |
| PATCH | `/api/events/:id/close` | M17-Events-Booking-Ticketing |
| POST/GET | `/api/events/:id/bookings` | M17-Events-Booking-Ticketing |
| POST | `/api/events/bookings/:id/tickets/issue` | M17-Events-Booking-Ticketing |
| POST | `/api/events/tickets/:id/check-in` | M17-Events-Booking-Ticketing |

## Anomaly Detection (M18)

| Method | Path | Collection |
|--------|------|-----------|
| POST/GET | `/api/analytics/anomaly-rules` | M18-Anomaly-Detection-Anti-Theft |
| GET/PATCH | `/api/analytics/anomaly-rules/:id` | M18-Anomaly-Detection-Anti-Theft |
| GET | `/api/analytics/anomalies` | M18-Anomaly-Detection-Anti-Theft |
| PATCH | `/api/analytics/anomalies/:id/acknowledge` | M18-Anomaly-Detection-Anti-Theft |
| PATCH | `/api/analytics/anomalies/:id/resolve` | M18-Anomaly-Detection-Anti-Theft |
| GET | `/api/analytics/risk-dashboard` | M18-Anomaly-Detection-Anti-Theft |
| GET | `/api/analytics/staff-risk/:userId` | M18-Anomaly-Detection-Anti-Theft |
| GET/PATCH | `/api/analytics/thresholds` | M18-Anomaly-Detection-Anti-Theft |
| POST | `/api/analytics/anomalies/recalculate` | M18-Anomaly-Detection-Anti-Theft |

## Operational Dashboards & KPI Streams (M19)

| Method | Path | Collection |
|--------|------|-----------|
| GET | `/api/dash/owner` | M19-Operational-Dashboards-KPI-Streams |
| GET | `/api/dash/manager` | M19-Operational-Dashboards-KPI-Streams |
| GET | `/api/dash/today-summary` | M19-Operational-Dashboards-KPI-Streams |
| GET | `/api/dash/payment-mix` | M19-Operational-Dashboards-KPI-Streams |
| GET | `/api/dash/open-orders` | M19-Operational-Dashboards-KPI-Streams |
| GET | `/api/dash/low-stock` | M19-Operational-Dashboards-KPI-Streams |
| GET | `/api/dash/snapshots` | M19-Operational-Dashboards-KPI-Streams |
| POST | `/api/dash/kpi/refresh` | M19-Operational-Dashboards-KPI-Streams |
| SSE | `/api/stream/metrics` | M19-Operational-Dashboards-KPI-Streams |

## Reporting v1 + Exports (M20)

| Method | Path | Collection |
|--------|------|-----------|
| POST | `/api/reports/shift-end` | M20-Reporting-v1-Exports |
| POST | `/api/reports/daily-sales` | M20-Reporting-v1-Exports |
| POST | `/api/reports/payment-mix` | M20-Reporting-v1-Exports |
| POST | `/api/reports/top-items` | M20-Reporting-v1-Exports |
| POST | `/api/reports/stock-variance` | M20-Reporting-v1-Exports |
| POST | `/api/reports/anomaly-summary` | M20-Reporting-v1-Exports |
| GET | `/api/reports` | M20-Reporting-v1-Exports |
| GET | `/api/reports/:id` | M20-Reporting-v1-Exports |
| POST | `/api/reports/export` | M20-Reporting-v1-Exports |
| GET | `/api/reports/exports/:id/download` | M20-Reporting-v1-Exports |

---

## Common Pitfalls & Known Issues

### 1. Login returns 201, not 200

`POST /api/auth/login` returns **HTTP 201** (Created — a new Session record is created).
Postman test scripts must assert `pm.response.to.have.status(201)`, not `(200)`.

**Affected collections:** M16, M17, M18, M19, M20 — all fixed.
**Rule:** Any time a login or token endpoint creates a session record server-side, expect 201.

### 2. 500 errors on new milestone endpoints after server restart

If Postman gets 500 on endpoints that are part of a newly implemented milestone, the most likely cause is a **stale server process** running a build that predates the milestone.

**Symptoms:** New endpoints return 500, endpoints from previous milestones work fine.  
**Fix:** Kill all node processes and restart: `Get-Process node | Stop-Process -Force`, then restart with `npx nest start` from `apps/api`.  
**Prevention:** After each milestone commit/merge, always restart the dev server before running Postman tests.

### 3. Missing `x-branch-id` header

All protected endpoints require the `x-branch-id` header. Without it the API returns 400.  
The Postman "Get Branch ID" pre-request captures this from `/api/me`.  
If subsequent requests fail with 400 "X-Branch-Id header is required", re-run the "Get Branch ID" request first.

### 4. Token expired mid-run

Access tokens expire after 15 minutes. If a long Postman Runner run fails authentication mid-way, re-run request 00 (Login) to refresh the token environment variable.
