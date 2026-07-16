# SUPERVISOR_API_MATRIX.md — Nimbus POS Supervisor API Matrix

Status: Draft v1  
Date: 2026-07-03  
Scope: Supervisor-relevant endpoint matrix from uploaded audit/register resources and cashier/waiter research. Final coding must verify live controllers, DTOs, permissions, seed data, and Postman.

## 1. Rules

- Use existing endpoints only.
- Do not invent routes.
- Treat this as a research matrix, not final permission truth.
- The uploaded role endpoint matrix did not contain dedicated Supervisor rows.
- Verify `SUPERVISOR` or equivalent permissions in `packages/db/prisma/seed.ts` before any UI action is built.
- Hide or block any action without verified permission.
- Risky writes should use `Idempotency-Key` where supported.
- Public MTN/Airtel execution, PesaPal diner checkout, live printer, and live terminal traffic remain excluded.

## 2. API matrix

| Area | Method | Path | Purpose | Proposed Supervisor UI | Verification status |
|---|---:|---|---|---|---|
| Auth | POST | `/api/auth/login` | Email/password login | Shared login fallback | Verify Supervisor credentials |
| Auth | POST | `/api/auth/quick-pin-login` | Quick PIN login | Supervisor PIN login if seeded | Verify role/PIN |
| Auth | GET | `/api/auth/me` | Canonical context | Role guard/header context | Required |
| Auth | POST | `/api/auth/logout` | Logout | Me/logout | Safe if existing |
| Auth | POST | `/api/auth/refresh` | Refresh token | Auth restore | Verify current frontend pattern |
| Floor | GET | `/api/floor-plans` | Floor plan list | Floor map source | Verify route/permission |
| Floor | GET | `/api/floor-plans/:id` | Floor plan detail | Floor map | Verify route/permission |
| Floor | GET | `/api/floor/availability` | Table/floor availability | Service state overlay | Verify route/permission |
| Tables | GET | `/api/tables` | List tables | Floor/table selector | Verify branch filter |
| Tables | GET | `/api/tables/:id` | Table detail | Table drawer | Verify |
| Tables | PATCH | `/api/tables/:id/status` | Change table status | Supervisor table exception | Verify write permission |
| Orders | GET | `/api/pos/orders` | List orders | Orders/Floor active orders | Verify filters |
| Orders | POST | `/api/pos/orders` | Create order | Exclude unless verified | Open |
| Orders | GET | `/api/pos/orders/:id` | Order detail | Order drawer | Verify |
| Orders | POST | `/api/pos/orders/:id/items` | Add item | Exclude unless order-entry verified | Open |
| Orders | PATCH | `/api/pos/orders/:id/items/:orderItemId` | Edit item | Exclude unless verified | Open |
| Orders | DELETE | `/api/pos/orders/:id/items/:orderItemId` | Remove item | Exclude unless verified | Open |
| Orders | POST | `/api/pos/orders/:id/send` | Send to KDS | Exclude unless KDS/order-entry permission verified | Open |
| Orders | POST | `/api/pos/orders/:id/mark-served` | Mark served | Verify if service supervision scope | Open |
| Orders | POST | `/api/pos/orders/:id/void` | Void order | Supervisor exception if permitted | Critical verify |
| Orders | POST | `/api/pos/orders/:id/post-close-void` | Post-close void | Supervisor/manager boundary | Critical verify |
| Orders | GET | `/api/pos/orders/:id/payments` | Payment summary | Read payment state | Verify read |
| Close | POST | `/api/pos/orders/:id/close` | Close order | Exclude by default; Cashier scope unless verified | Open |
| Split | POST | `/api/pos/orders/:id/split-bill` | Allocation split | Order resolution | Verify Supervisor permission |
| Split | POST | `/api/pos/orders/:id/split-items` | Create child order | Order resolution | Verify Supervisor permission |
| Handoff | POST | `/api/pos/orders/merge` | Merge orders | Advanced resolution | Verify Supervisor permission |
| Handoff | POST | `/api/pos/orders/:id/move-items` | Move items | Advanced resolution | Verify Supervisor permission |
| Handoff | POST | `/api/pos/orders/:id/transfer-table` | Transfer table | Floor/order resolution | Verify Supervisor permission |
| Handoff | POST | `/api/pos/orders/:id/transfer-server` | Transfer server | Floor/order resolution | Verify Supervisor permission and staff selector |
| Payments | GET | `/api/payments/intents/:intentId` | Intent detail | Payment state review | Read only unless verified |
| Payments | GET | `/api/payments/intents/:intentId/status` | Intent status | Payment state review | Read only unless verified |
| Payments | POST | `/api/payments/intents/:intentId/cancel` | Cancel pending intent | Exception if permitted | Verify |
| Payments | POST | `/api/payments/intents` | Create intent | Exclude by default; Cashier scope | Open |
| Payments | POST | `/api/payments/manual-reference` | Manual reference | Exclude by default; Cashier scope | Open |
| Refunds | GET | `/api/pos/orders/:id/refunds` | Refund history | Approvals/detail | Verify read |
| Refunds | POST | `/api/pos/orders/:id/refunds` | Create refund | Maybe Supervisor; verify | Open |
| Refunds | GET | `/api/pos/refunds/:refundId` | Refund detail | Approvals/detail | Verify |
| Refunds | POST | `/api/pos/refunds/:refundId/approve` | Approve refund | Supervisor approval candidate | Critical verify |
| Discounts | GET | `/api/pos/orders/:id/discounts` | Discount history | Order detail/approvals | Verify |
| Discounts | POST | `/api/pos/orders/:id/discounts` | Request discount | Maybe Supervisor; verify | Open |
| Discounts | GET | `/api/pos/discounts/pending` | Pending discounts | Approvals | Critical verify |
| Discounts | GET | `/api/pos/discounts/:id` | Discount detail | Approvals/detail | Verify |
| Discounts | POST | `/api/pos/discounts/:id/approve` | Approve discount | Supervisor approval candidate | Critical verify |
| Discounts | POST | `/api/pos/discounts/:id/reject` | Reject discount | Supervisor approval candidate | Critical verify |
| Receipts | GET | `/api/receipts/:id` | Receipt detail | Receipt/audit drawer | Verify read |
| Receipts | GET | `/api/receipts/:id/history` | Receipt history | Audit trail | Verify read |
| Receipts | POST | `/api/receipts/:id/reprint` | Reprint request | Metadata-only | Verify write |
| Receipts | POST | `/api/receipts/:id/send` | Send request | Pending/no adapter | Verify write |
| Reservations | GET | `/api/reservations` | List reservations | Reservations tab | Verify |
| Reservations | POST | `/api/reservations` | Create reservation | Reservations tab | Verify |
| Reservations | GET | `/api/reservations/upcoming` | Upcoming reservations | Floor/reservations | Verify |
| Reservations | GET | `/api/reservations/:reservationId` | Detail | Reservation drawer | Verify |
| Reservations | PATCH | `/api/reservations/:reservationId/confirm` | Confirm | Reservations action | Verify |
| Reservations | PATCH | `/api/reservations/:reservationId/assign-table` | Assign table | Reservations/floor action | Verify |
| Reservations | PATCH | `/api/reservations/:reservationId/seat` | Seat guest | Reservations/floor action | Verify |
| Reservations | PATCH | `/api/reservations/:reservationId/cancel` | Cancel | High-impact | Verify |
| Reservations | PATCH | `/api/reservations/:reservationId/no-show` | Mark no-show | High-impact | Verify |
| Reservations | GET | `/api/reservations/:reservationId/deposits` | Deposit history | Reservation detail | Verify |
| Reservations | POST | `/api/reservations/:reservationId/deposits` | Record deposit | Verify; maybe Cashier/Manager only | Open |
| Reservations | GET | `/api/reservations/:reservationId/events` | Event timeline | Reservation audit | Verify |
| Attendance | GET | `/api/hr/attendance` | Attendance list/self | Me/punch | Verify own/team scope |
| Attendance | POST | `/api/hr/attendance/clock` | Clock/punch | Me | Verify DTO/permission |
| Leave | GET | `/api/hr/leave` | Leave requests | Me/Approvals | Verify own/team scope |
| Leave | POST | `/api/hr/leave` | Create leave request | Me | Verify |
| Leave | PATCH | `/api/hr/leave/:leaveRequestId/review` | Review leave | Approvals candidate | Verify Supervisor permission |
| Swaps | GET | `/api/hr/shift-swaps` | Shift swaps | Me/Approvals | Verify own/team scope |
| Swaps | POST | `/api/hr/shift-swaps` | Create swap | Me | Verify |
| Swaps | PATCH | `/api/hr/shift-swaps/:shiftSwapId/approve` | Approve swap | Approvals candidate | Verify Supervisor permission |
| Shifts | GET | `/api/shifts/active` | Active shift | Header/Me readiness | Verify |
| Shifts | POST | `/api/shifts/open` | Open shift | Me if permitted | Verify Supervisor scope |
| Shifts | POST | `/api/shifts/:id/close` | Close shift | Me if permitted | Verify Supervisor scope |
| Shifts | GET | `/api/shifts/:id/summary` | Shift summary | Me/service health | Verify |
| Tills | GET | `/api/tills/active` | Active till | Readiness only | Verify read |
| Tills | GET | `/api/tills/:id` | Till detail | Read-only health | Verify read |
| Tills | GET | `/api/tills/:id/summary` | Till summary | Read-only health | Verify read |
| KDS | GET | `/api/kds/queue` | KDS queue | Service health read | Verify read |
| KDS | POST | `/api/kds/tickets/:kdsTicketId/mark-ready` | KDS write | Exclude unless verified | Open |
| KDS | POST | `/api/kds/tickets/:kdsTicketId/recall` | KDS write | Exclude unless verified | Open |
| Analytics | GET | `/api/analytics/anomalies` | Anomaly list | Approvals/risk if permitted | Verify; avoid manager dashboard creep |
| Analytics | GET | `/api/analytics/anomalies/:id` | Anomaly detail | Risk detail | Verify |
| Analytics | PATCH | `/api/analytics/anomalies/:id/acknowledge` | Acknowledge | Approval/risk if permitted | Verify |
| Analytics | PATCH | `/api/analytics/anomalies/:id/resolve` | Resolve | Approval/risk if permitted | Verify |
| Approvals | GET | `/api/approvals` | Global approvals | Do not expose until Supervisor permission verified | Likely Owner/Manager-only |
| Approvals | POST | `/api/approvals/:id/decide` | Decide approval | Do not expose until verified | Likely Owner/Manager-only |
| Devices | GET | `/api/devices` | Device list | Read-only metadata if permitted | Verify |
| Devices | GET | `/api/devices/printers/routes` | Printer routes | Read-only caveat if permitted | Metadata only |
| Devices | POST | `/api/devices/terminals/pair` | Pair terminal | Exclude by default | STUB only |
| Public payments | any | `/api/public/payments/*` | Public MTN/Airtel | Exclude | Pending provider |
| PesaPal | any | `/api/billing/pesapal/*` | SaaS billing | Exclude | Owner billing only |

## 3. Permission families to verify

- `pos:orders:*`
- `pos:order:split`
- `pos:order:merge`
- `pos:order:transfer`
- `pos:order:move-items`
- `pos:void:*`
- `pos:discount:*`
- `pos:refund:*`
- `pos:receipt:*`
- `pos:reservation:*`
- `pos:shift:*`
- `pos:till:*`
- `hr:attendance:*`
- `hr:leave:*`
- `hr:shift-swap:*`
- `floor:*`
- `tables:*`
- `kds:*`
- `analytics:*`
- `approvals:*`
- `devices:*`

## 4. Explicit exclusions until verified

- Accounting/AP/AR/GL/tax/fiscal periods/posting.
- Payroll.
- Reports/franchise dashboards.
- Owner SaaS billing.
- Live provider/hardware execution.
- Global approvals inbox.
- KDS write actions.
- Cashier payment settlement.
- Waiter menu-entry.
