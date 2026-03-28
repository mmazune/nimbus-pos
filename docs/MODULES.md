# MODULES.md — Nimbus POS Planned Module Layout

> All modules listed below are **planned**. Only modules marked as implemented
> have actual code. See [ROADMAP.md](../ROADMAP.md) for milestone details.

## Module → Milestone Map

| Module                              | Location                             | Milestone | Status         |
| ----------------------------------- | ------------------------------------ | --------- | -------------- |
| **Health / Bootstrap**              | `apps/api/src/app.*`                 | M0–M1   | ✅ Implemented |
| **Prisma (shared DB access)**       | `apps/api/src/common/prisma/`        | M1      | ✅ Implemented |
| **Auth**                            | `apps/api/src/modules/auth/`         | M2        | ✅ Implemented |
| **Auth — Quick PIN Login**          | `apps/api/src/modules/auth/`         | M3.1      | ✅ Implemented |
| **Tenancy (Org/Branch/Membership)** | `apps/api/src/modules/tenancy/`      | M3        | ✅ Implemented |
| **Settings / Numbering**            | `apps/api/src/modules/settings/`     | M4        | ✅ Implemented |
| **Floor / Tables / Areas**          | `apps/api/src/modules/floor/`        | M5        | ✅ Implemented |
| **Menu Catalog**                    | `apps/api/src/modules/menu/`         | M6        | ✅ Implemented |
| **Menu Taxonomy + Servings**        | `apps/api/src/modules/menu/`         | M6.1      | ✅ Implemented |
| **Menu Modifiers + Options**         | `apps/api/src/modules/menu/`         | M7        | ✅ Implemented |
| **Recipes / Costing**               | `apps/api/src/modules/recipes/`      | M8        | ✅ Implemented |
| **Inventory (Stock + FIFO)**        | `apps/api/src/modules/inventory/`    | M9        | ✅ Implemented |
| **Purchasing / Suppliers**          | `apps/api/src/modules/purchasing/`   | M11–M12   | ⬜ Planned     |
| **Stock Counts / Wastage**          | `apps/api/src/modules/inventory/`    | M14+      | ⬜ Planned     |
| **POS Orders**                      | `apps/api/src/modules/orders/`       | M10       | ✅ Implemented |
| **KDS / Station Routing**           | `apps/api/src/modules/kds/`          | M11       | ✅ Implemented |
| **Discounts + Approval Workflow**   | `apps/api/src/modules/discounts/`    | M12       | ✅ Implemented |
| **Discounts / Overrides**           | `apps/api/src/modules/pos/`          | M16       | ⬜ Planned     |
| **Shifts / Tills / Cash**           | `apps/api/src/modules/shifts/` + `tills/` | M15       | ✅ Implemented |
| **Payments (Cash/Card/MOMO)**       | `apps/api/src/modules/payments/`     | M13       | ✅ Implemented |
| **Refunds**                         | `apps/api/src/modules/refunds/`      | M14       | ✅ Implemented |
| **Reservations / Deposits**         | `apps/api/src/modules/reservations/` | M16       | ✅ Implemented |
| **Events / Ticketing**              | `apps/api/src/modules/events/`       | M17       | ✅ Implemented |
| **Anomaly Detection**               | `apps/api/src/modules/analytics/`    | M18       | ✅ Implemented |
| **Dashboards / KPIs**               | `apps/api/src/modules/dashboards/`   | M19       | ✅ Implemented |
| **Reports / Exports**               | `apps/api/src/modules/reports/`      | M20       | ✅ Implemented |
| **Reports — Depth Expansion**       | `apps/api/src/modules/reports/`      | M20.1     | ✅ Implemented |
| **Feedback / NPS**                  | `apps/api/src/modules/feedback/`     | M21       | ✅ Implemented |
| **Documents / Uploads**             | `apps/api/src/modules/documents/`    | M22       | ✅ Implemented |
| **HR / Employees**                  | `apps/api/src/modules/hr/`           | M27–M28   | ⬜ Planned     |
| **Scheduling / Roster**             | `apps/api/src/modules/hr/`           | M29       | ⬜ Planned     |
| **Payroll**                         | `apps/api/src/modules/payroll/`      | M30       | ⬜ Planned     |
| **Staff Insights**                  | `apps/api/src/modules/hr/`           | M31       | ⬜ Planned     |
| **Accounting (COA, GL, AP, AR)**    | `apps/api/src/modules/accounting/`   | M32–M36   | ⬜ Planned     |
| **Budgets / Forecasts**             | `apps/api/src/modules/accounting/`   | M37       | ⬜ Planned     |
| **Franchise / Multi-Branch**        | `apps/api/src/modules/franchise/`    | M38       | ⬜ Planned     |
| **Billing / Subscriptions**         | `apps/api/src/modules/billing/`      | M39       | ⬜ Planned     |
| **Alerts / Digests**                | `apps/api/src/modules/alerts/`       | M40       | ⬜ Planned     |
| **Reliability / Offline / Sync**    | cross-cutting                        | M41       | ⬜ Planned     |
| **Feature Flags / Training Mode**   | `apps/api/src/modules/flags/`        | M42       | ⬜ Planned     |
| **Frontend Shell**                  | `apps/web/`                          | M43       | ⬜ Planned     |
| **Frontend POS / KDS / Backoffice** | `apps/web/`                          | M44       | ⬜ Planned     |
| **Passkeys / MFA / SSO**            | `apps/api/src/modules/auth/`         | M45       | ⬜ Planned     |
| **Hardware Wave (MSR/Spouts)**      | `apps/api/src/modules/devices/`      | M46       | ⬜ Planned     |
| **Launch Hardening / CI/CD**        | cross-cutting                        | M47       | ⬜ Planned     |
