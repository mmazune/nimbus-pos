# Supervisor UI Gap Confirmation Matrix

Status: complete research pass  
Date: 2026-07-04

| ID | Area | Confirmation | Evidence | Status |
|---|---|---|---|---|
| SUP-GAP-001 | Role | Exact role exists: `JobRole.SUPERVISOR`, role name `Supervisor`, level `L3`. | `schema.prisma`, `seed.ts` | Closed |
| SUP-GAP-002 | Credentials | `supervisor@nimbus.demo` / `Demo1234!` / Quick PIN `22334455`. | `demo-data/DEMO_LOGIN_CREDENTIALS.md`, `demo-import.ts` | Closed |
| SUP-GAP-003 | Auth | Supervisor is Quick PIN capable, `HIGH_8`, POS desktop only. Email/password also exists. | `quick-pin.constants.ts`, `QuickPinLoginDto`, credentials doc | Closed |
| SUP-GAP-004 | Permissions | Exact Supervisor seed permissions verified. Broad operational permissions exist; receipt/device/global approvals do not. | `ROLE_PERM_MATRIX.Supervisor` | Closed |
| SUP-GAP-005 | Landing route | Future route should be `/supervisor/floor`; current frontend does not route Supervisor. | login role helpers | Open implementation |
| SUP-GAP-006 | Floor | Supervisor can read and write floor/table status. | `pos:floor:*`, `pos:table:*` | Closed |
| SUP-GAP-007 | Orders create/edit/send | Supervisor can create/edit/send/serve/request-bill through `pos:orders:write`. | orders controller/seed | Closed, product-gate |
| SUP-GAP-008 | Orders all branch | `GET /api/pos/orders` is branch-scoped and Supervisor has read. | orders controller/seed | Closed |
| SUP-GAP-009 | Payment settlement | Supervisor has close/payment/till permissions, but approved nav should not add Payments tab. | seed/payment controllers | Closed, product-gate |
| SUP-GAP-010 | Split/handoff | Supervisor has split/merge/transfer/move permissions. | pos-handoff controller/seed | Closed |
| SUP-GAP-011 | Void pre-close | Supervisor has `pos:orders:void`. | orders controller/seed | Closed, high impact |
| SUP-GAP-012 | Post-close void | Supervisor has `pos:void:postclose`; DTO requires `reason` and `managerPin`. | refunds controller/DTO/seed | Closed, high impact |
| SUP-GAP-013 | Discounts | Supervisor can request/read/approve/reject discounts. | discounts controller/DTO/seed | Closed |
| SUP-GAP-014 | Refunds | Supervisor can create/read/approve refunds. | refunds controller/DTO/seed | Closed |
| SUP-GAP-015 | Global approvals | Supervisor lacks `approvals:read` and `approvals:decide`. | unified approvals controller/seed | Blocked |
| SUP-GAP-016 | Reservations | Supervisor can create/read/confirm/seat/cancel/no-show. | reservations controller/DTO/seed | Closed |
| SUP-GAP-017 | Deposits | Supervisor can record/read deposits. | reservations controller/DTO/seed | Closed |
| SUP-GAP-018 | Punch | Supervisor can clock and read attendance. | attendance controller/DTO/seed | Closed |
| SUP-GAP-019 | Workforce approvals | Supervisor can review leave and approve shift swaps. | attendance controller/DTO/seed | Closed |
| SUP-GAP-020 | KDS writes | Supervisor has KDS write/SLA permissions, but KDS actions should not become a primary Supervisor surface. | kds controller/seed | Closed, product-gate |
| SUP-GAP-021 | Receipts | Backend exists, but Supervisor lacks `pos:receipt:*`. | receipts controller/seed | Blocked |
| SUP-GAP-022 | Devices | Backend exists, but Supervisor lacks `devices:*`. | device-registry controller/seed | Blocked |
| SUP-GAP-023 | Analytics | Supervisor can read/ack/recalculate anomalies and read risk dashboard/thresholds. | analytics controller/seed | Closed |
| SUP-GAP-024 | Reports | Supervisor has selected operational reports. Avoid nav/reporting dashboard scope creep. | reports controller/seed | Closed, exclude nav |
| SUP-GAP-025 | Cashier overlap | Supervisor has payment/till writes, but UI should keep this as exception-only if used. | seed/payment/tills | Product decision |
| SUP-GAP-026 | Waiter overlap | Supervisor has menu/order write permissions; no Menu nav should be added. | seed/orders/menu | Product decision |
| SUP-GAP-027 | MTN/Airtel | Public diner execution pending provider confirmation. | demo importer/README/public-commerce-payments | Locked caveat |
| SUP-GAP-028 | PesaPal | Owner SaaS billing only, not diner checkout. | ROADMAP/README/billing-pesapal/merchant-payments | Locked exclusion |
| SUP-GAP-029 | Printer | Printer routes metadata only, no driver invocation. | BG5 docs/device registry | Locked caveat |
| SUP-GAP-030 | Terminal | Terminal pairing is STUB only, no acquirer traffic. | BG5 docs/device registry | Locked caveat |
| SUP-GAP-031 | Receipt send | Pending/no live adapter. | receipts service/DTO/demo importer | Locked caveat |
| SUP-GAP-032 | Demo fixtures | Floor/orders/reservations/refunds/attendance/leave/swaps/anomalies/devices exist; dedicated supervisor scenario still absent. | demo validation | Partially closed |
| SUP-GAP-033 | Postman | No dedicated Supervisor workflow collection found. | collection inventory | Open |
| SUP-GAP-034 | API pool blocker | AI_STATUS notes waiter floor Prisma pool pressure; no server testing was run here. | `ai/AI_STATUS.md` | Open risk |

