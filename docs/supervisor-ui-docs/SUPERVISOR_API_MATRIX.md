# Supervisor API Matrix

Status: repo-verified research update  
Date: 2026-07-04  
Source note: root `docs/supervisor-ui-docs/*` did not exist before this pass. Draft source files were under `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/*`.

## Rules

- Use existing endpoints only.
- All protected branch-operational endpoints require auth and `X-Branch-Id`.
- Use `Idempotency-Key` for BG3-wrapped/high-risk writes where supported.
- Do not expose routes whose permissions are not present in Supervisor seed.
- Keep approved nav only: `Floor`, `Orders`, `Reservations`, `Approvals`, `Me`.

## Permitted Supervisor Endpoints

| Area | Method | Path | Permission | DTO/query fields | Response shape | Idempotency/caveats |
|---|---|---|---|---|---|---|
| Auth | POST | `/api/auth/login` | public | `email`, `password`, `platform?` | tokens, user roles/permissions, session | returns 201 |
| Auth | POST | `/api/auth/quick-pin/login` | public | `branchId`, `pin`, `platform` | tokens, user roles/permissions, session | POS desktop only |
| Auth | GET | `/api/auth/me` | auth | none | user, roles, permissions, memberships, context, session | canonical context |
| Auth | POST | `/api/auth/logout` | auth | none | message | safe |
| Floor | GET | `/api/floor-plans` | `pos:floor:read` | none | floor plan list | branch-scoped |
| Floor | GET | `/api/floor-plans/:id` | `pos:floor:read` | `id` | floor plan detail | branch-scoped |
| Floor | GET | `/api/floor/availability` | `pos:floor:read` | none | availability/table state | branch-scoped |
| Tables | GET | `/api/tables` | `pos:table:read` | none | table list | branch-scoped |
| Tables | GET | `/api/tables/:id` | `pos:table:read` | `id` | table detail | branch-scoped |
| Tables | PATCH | `/api/tables/:id/status` | `pos:table:write` | `status` enum | updated table | high-impact UI confirmation |
| Orders | GET | `/api/pos/orders` | `pos:orders:read` | `status?`, `serviceType?`, `tableId?`, `userId?`, `excludeStatus?`, `page?`, `pageSize?` | paginated/list orders | branch-scoped |
| Orders | GET | `/api/pos/orders/:id` | `pos:orders:read` | `id` | order detail | branch-scoped |
| Orders | POST | `/api/pos/orders` | `pos:orders:write` | `serviceType`, `tableId?`, `notes?`, `metadata?` | created order | permitted but avoid waiter-clone UX |
| Orders | POST | `/api/pos/orders/:id/items` | `pos:orders:write` | `menuItemId`, `menuItemServingId?`, `quantity?`, `notes?`, `metadata?` | updated order | product-gate |
| Orders | PATCH | `/api/pos/orders/:id/items/:itemId` | `pos:orders:write` | `quantity?`, `notes?`, `metadata?` | updated item/order | product-gate |
| Orders | DELETE | `/api/pos/orders/:id/items/:itemId` | `pos:orders:write` | ids | updated order | product-gate |
| Orders | POST | `/api/pos/orders/:id/send` | `pos:orders:write` | `reason?` | order transition | KDS send; product-gate |
| Orders | POST | `/api/pos/orders/:id/mark-served` | `pos:orders:write` | `reason?` | order transition | service exception only |
| Orders | POST | `/api/pos/orders/:id/request-bill` | `pos:orders:write` | `reason?` | order transition/audit | useful for Orders |
| Orders | POST | `/api/pos/orders/:id/void` | `pos:orders:void` | `reason?` | voided order | high impact |
| Handoff | POST | `/api/pos/orders/merge` | `pos:order:merge` | `sourceOrderId`, `targetOrderId`, `reason?` | merged/voided source | BG3-wrapped |
| Handoff | POST | `/api/pos/orders/:id/split-bill` | `pos:order:split` | `mode`, `count?`, `groups?`, `reason?` | allocation metadata | BG3-wrapped; not physical split |
| Handoff | POST | `/api/pos/orders/:id/split-items` | `pos:order:split` | `items[]`, `targetTableId?`, `reason?`, `notes?` | child order | BG3-wrapped; child starts NEW |
| Handoff | POST | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer` | `targetTableId`, `reason?` | transferred order | BG3-wrapped |
| Handoff | POST | `/api/pos/orders/:id/transfer-server` | `pos:order:transfer` | `targetUserId`, `reason?` | transferred order | needs staff selector |
| Handoff | POST | `/api/pos/orders/:id/move-items` | `pos:order:move-items` | `targetOrderId`, `items[]`, `reason?` | updated orders | BG3-wrapped |
| Payments | GET | `/api/pos/orders/:id/payments` | `pos:payment:read` | order id | payments summary | read in Orders |
| Payments | POST | `/api/pos/orders/:id/close` | `pos:orders:close` | `payments[]`, `reason?` | closed order | BG3-wrapped; avoid Payments tab |
| Payments | POST | `/api/payments/intents` | `pos:payment:intent` | `orderId`, `provider`, `amount`, `currency?`, `phoneNumber`, `idempotencyKey?`, `metadata?` | payment intent | provider-gated |
| Payments | GET | `/api/payments/intents/:intentId` | `pos:payment:read` | id | payment intent | read |
| Payments | GET | `/api/payments/intents/:intentId/status` | `pos:payment:read` | id | status | read |
| Payments | POST | `/api/payments/intents/:intentId/cancel` | `pos:payment:cancel` | `reason?` | cancelled intent | exception-only |
| Payments | POST | `/api/payments/manual-reference` | `pos:payment:manual-reference` | `orderId`, `method`, `provider?`, `amount`, `externalTransactionId`, `payerPhone?`, `postedAt?`, `note?` | payment | avoid Cashier clone |
| Discounts | POST | `/api/pos/orders/:id/discounts` | `pos:discount:request` | `type`, `value`, `reason`, `metadata?` | discount | threshold may auto-approve |
| Discounts | GET | `/api/pos/orders/:id/discounts` | `pos:discount:read` | `status?`, `page?`, `pageSize?` | discounts | read |
| Discounts | GET | `/api/pos/discounts/pending` | `pos:discount:approve` | none | pending discounts | Approvals tab |
| Discounts | GET | `/api/pos/discounts/:id` | `pos:discount:read` | id | discount detail | read |
| Discounts | POST | `/api/pos/discounts/:id/approve` | `pos:discount:approve` | `managerPin?` | approved discount/order totals | high impact |
| Discounts | POST | `/api/pos/discounts/:id/reject` | `pos:discount:approve` | `rejectionReason` | rejected discount | high impact |
| Refunds | POST | `/api/pos/orders/:id/refunds` | `pos:refund:create` | `paymentId`, `amount`, `reason`, `provider?`, `metadata?` | refund | BG3-wrapped |
| Refunds | GET | `/api/pos/orders/:id/refunds` | `pos:refund:read` | order id | refunds | read |
| Refunds | GET | `/api/pos/refunds/:id` | `pos:refund:read` | id | refund detail | read |
| Refunds | POST | `/api/pos/refunds/:id/approve` | `pos:refund:approve` | `managerPin?` | approved refund | high impact |
| Void | POST | `/api/pos/orders/:id/post-close-void` | `pos:void:postclose` | `reason`, `managerPin` | void result | high impact, PIN required |
| Reservations | GET | `/api/reservations` | `pos:reservation:read` | `status?`, `date?`, `upcoming?`, `tableId?`, `page?`, `pageSize?` | reservations | branch-scoped |
| Reservations | GET | `/api/reservations/upcoming` | `pos:reservation:read` | none/query | upcoming reservations | Floor/Reservations |
| Reservations | POST | `/api/reservations` | `pos:reservation:create` | customer, party, time, table/deposit/notes fields | reservation | use confirmation |
| Reservations | GET | `/api/reservations/:id` | `pos:reservation:read` | id | reservation detail | read |
| Reservations | PATCH | `/api/reservations/:id/confirm` | `pos:reservation:confirm` | `notes?` | confirmed reservation | high impact |
| Reservations | PATCH | `/api/reservations/:id/seat` | `pos:reservation:seat` | `tableId?`, `createOrder?`, `orderNotes?` | seated reservation/order? | high impact |
| Reservations | PATCH | `/api/reservations/:id/cancel` | `pos:reservation:cancel` | `reason`, `depositOutcome?` | cancelled reservation | high impact |
| Reservations | PATCH | `/api/reservations/:id/no-show` | `pos:reservation:no-show` | `depositOutcome?`, `reason?` | no-show | high impact |
| Reservations | PATCH | `/api/reservations/:id/assign-table` | `pos:reservation:table:assign` | `tableId` | assigned reservation | high impact |
| Reservations | POST | `/api/reservations/:id/deposits` | `pos:reservation:deposit:record` | `amount`, `method?`, `reference?`, `paymentId?`, `notes?` | deposit | money-adjacent |
| Reservations | GET | `/api/reservations/:id/deposits` | `pos:reservation:deposit:read` | id | deposits | read |
| Reservations | GET | `/api/reservations/:id/events` | `pos:reservation:read` | id | event timeline | read |
| Shifts | GET | `/api/shifts/active` | `pos:shift:read` | none | active shift | Header/Me |
| Shifts | POST | `/api/shifts/open` | `pos:shift:open` | `notes?` | opened shift | BG3-wrapped |
| Shifts | POST | `/api/shifts/:id/close` | `pos:shift:close` | `notes?` | closed shift | BG3-wrapped |
| Shifts | GET | `/api/shifts/:id` | `pos:shift:read` | id | shift detail | read |
| Shifts | GET | `/api/shifts/:id/summary` | `pos:shift:read` | id | summary | read |
| Tills | GET | `/api/tills/active` | `pos:till:read` | none | active till | readiness only |
| Tills | POST | `/api/tills/open` | `pos:till:open` | `tillCode`, `openingFloat`, `notes?` | opened till | BG3-wrapped; avoid Cashier clone |
| Tills | POST | `/api/tills/:id/safe-drop` | `pos:till:safe-drop` | `amount`, `reason` | safe drop | high impact |
| Tills | POST | `/api/tills/:id/reconcile` | `pos:till:reconcile` | `countedCash`, `varianceReason?`, `notes?` | reconciled till | high impact |
| Tills | GET | `/api/tills/:id` | `pos:till:read` | id | till detail | read |
| Tills | GET | `/api/tills/:id/summary` | `pos:till:read` | id | till summary | read |
| Attendance | POST | `/api/hr/attendance/clock` | `pos:hr:attendance:clock` | `employeeId`, `notes?` | clock result | Me tab |
| Attendance | GET | `/api/hr/attendance` | `pos:hr:attendance:read` | `employeeId?`, `status?`, `dateFrom?`, `dateTo?`, `mine?`, `skip?`, `take?` | attendance list | prefer `mine=true` for Me |
| Leave | POST | `/api/hr/leave` | `pos:hr:leave:create` | `employeeId`, `leaveType`, `startsAt`, `endsAt`, `reason?` | request | Me |
| Leave | GET | `/api/hr/leave` | `pos:hr:leave:read` | `employeeId?`, `status?`, `leaveType?`, `mine?`, `skip?`, `take?` | leave list | Me/Approvals |
| Leave | PATCH | `/api/hr/leave/:id/review` | `pos:hr:leave:review` | `status`, `reviewNotes?` | reviewed leave | Approvals |
| Swaps | POST | `/api/hr/shift-swaps` | `pos:hr:shift-swaps:create` | `requesterEmployeeId`, `targetEmployeeId`, `shiftDate`, `reason?` | swap request | needs safe target selector |
| Swaps | GET | `/api/hr/shift-swaps` | `pos:hr:shift-swaps:read` | `employeeId?`, `status?`, `mine?`, `skip?`, `take?` | swaps | Me/Approvals |
| Swaps | PATCH | `/api/hr/shift-swaps/:id/approve` | `pos:hr:shift-swaps:approve` | `status`, `reviewNotes?` | approved/rejected swap | Approvals |
| Swaps | GET | `/api/hr/shift-swaps/eligible-options` | not implemented | would need current-user eligible source shifts and same-branch eligible targets | not available | final QA Outcome B: selector contract deferred; broad staff selector forbidden |
| KDS | GET | `/api/kds/queue` | `pos:kds:read` | `station?`, `status?`, `page?`, `pageSize?` | queue | service health |
| KDS | POST | `/api/kds/tickets/:id/mark-ready` | `pos:kds:write` | id | ticket | product-gate |
| KDS | POST | `/api/kds/tickets/:id/recall` | `pos:kds:write` | id | ticket | product-gate |
| Analytics | GET | `/api/analytics/anomalies` | `pos:analytics:anomalies:read` | `status?`, `type?`, `severity?`, `actorUserId?`, `limit?`, `offset?` | anomalies | Approvals/risk |
| Analytics | GET | `/api/analytics/anomalies/:id` | `pos:analytics:anomalies:read` | id | anomaly detail | read |
| Analytics | PATCH | `/api/analytics/anomalies/:id/acknowledge` | `pos:analytics:anomalies:acknowledge` | `resolutionNotes?` | acknowledged | Approvals |
| Analytics | PATCH | `/api/analytics/anomalies/:id/resolve` | `pos:analytics:anomalies:acknowledge` | `resolutionNotes` | resolved | Approvals |
| Analytics | GET | `/api/analytics/risk-dashboard` | `pos:analytics:risk-dashboard:read` | `userId?` | risk dashboard | avoid manager dashboard creep |
| Analytics | GET | `/api/analytics/thresholds` | `pos:analytics:thresholds:read` | none | thresholds | read-only |
| Reports | GET | `/api/reports/catalog` | `pos:reports:catalog:read` | none | catalog | no Supervisor nav tab |

## Explicitly Blocked For Supervisor

| Area | Endpoint | Reason |
|---|---|---|
| Global approvals | `/api/approvals*` | Supervisor lacks `approvals:read` / `approvals:decide` |
| Audit timeline | `/api/audit/timeline` | Supervisor lacks `audit:read` |
| Receipts | `/api/receipts*` | Supervisor lacks `pos:receipt:*` |
| Devices | `/api/devices*` | Supervisor lacks `devices:*` |
| Accounting/AP/AR/GL | `/api/accounting*` and related modules | no Supervisor accounting permissions |
| Franchise | `/api/franchise*` | no Supervisor franchise permissions |
| Billing/PesaPal | `/api/billing*`, `/api/billing/pesapal*` | owner SaaS billing only |
| Public payments | `/api/public/payments*` | pending MTN/Airtel provider confirmation |
