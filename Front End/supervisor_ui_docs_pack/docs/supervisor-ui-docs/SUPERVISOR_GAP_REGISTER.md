# SUPERVISOR_GAP_REGISTER.md — Nimbus POS Supervisor UI Gap Register

Status: Draft v1  
Date: 2026-07-03  
Scope: Supervisor unresolved gaps before live repo verification and documentation approval

| ID | Area | Gap | Why it matters | Required verification | Proposed status |
|---|---|---|---|---|---|
| SUP-GAP-001 | Role | Exact Supervisor role enum/name unknown | Auth guard/routing | `schema.prisma`, auth types, seed | Open critical |
| SUP-GAP-002 | Credentials | Exact Supervisor demo email/password/PIN unknown | Login QA | `demo-data/DEMO_LOGIN_CREDENTIALS.md`, seed/importer | Open critical |
| SUP-GAP-003 | Auth | Supervisor PIN-first vs email-first unknown | Login design | auth module, login page, demo data | Open |
| SUP-GAP-004 | Permissions | Exact Supervisor permission seed unknown | Prevents overexposure | `packages/db/prisma/seed.ts` | Open critical |
| SUP-GAP-005 | Landing route | Supervisor route behavior unknown | Role routing | frontend auth role helpers | Open |
| SUP-GAP-006 | Floor | Supervisor floor/table read/write scope unknown | Floor landing | floor/tables controllers and seed | Open |
| SUP-GAP-007 | Orders | Can Supervisor create/edit/send orders? | Avoid waiter clone | POS order permissions/controllers | Open |
| SUP-GAP-008 | Orders | Can Supervisor view all branch orders? | Orders tab | order list filters/permissions | Open |
| SUP-GAP-009 | Payment | Can Supervisor settle/close bills? | Avoid cashier clone | close/payment permissions | Open |
| SUP-GAP-010 | Split/handoff | Can Supervisor split/merge/move/transfer? | Order resolution | pos-handoff permissions/DTOs | Open critical |
| SUP-GAP-011 | Void | Can Supervisor void pre-close orders? | Exception workflow | void endpoint/permissions | Open critical |
| SUP-GAP-012 | Post-close void | Can Supervisor execute post-close void? | High-risk approval | post-close void controller/permission/PIN | Open critical |
| SUP-GAP-013 | Discounts | Can Supervisor request/approve/reject discounts? | Approvals tab | discount permissions/thresholds | Open critical |
| SUP-GAP-014 | Refunds | Can Supervisor create/approve refunds? | Approvals tab | refund permissions/thresholds | Open critical |
| SUP-GAP-015 | Global approvals | Is `/api/approvals` Supervisor-safe? | Approvals nav design | approvals seed/guards | Likely blocked |
| SUP-GAP-016 | Reservations | Can Supervisor create/confirm/seat/cancel/no-show? | Reservations tab | reservation permissions/DTOs | Open critical |
| SUP-GAP-017 | Deposits | Can Supervisor record/view reservation deposits? | Reservation payments | reservation deposit permissions | Open |
| SUP-GAP-018 | Punch | Can Supervisor clock/punch? | Me scope | attendance endpoints/permissions | Open |
| SUP-GAP-019 | Workforce | Can Supervisor review leave/shift swaps? | Approvals/Me scope | HR permission seed | Open |
| SUP-GAP-020 | KDS | Can Supervisor use KDS write actions? | Avoid kitchen leakage | KDS permissions | Likely blocked |
| SUP-GAP-021 | Receipts | Can Supervisor reprint/send receipts? | Receipt/audit support | receipt permissions | Open |
| SUP-GAP-022 | Devices | Can Supervisor read/manage devices? | Hardware caveats | device permissions | Read-only likely |
| SUP-GAP-023 | Analytics | Which service risk/anomaly APIs are Supervisor-safe? | Floor risk strip | analytics permissions | Open |
| SUP-GAP-024 | Reports | Are any reports Supervisor-safe? | Avoid manager dashboard | report permissions | Likely blocked |
| SUP-GAP-025 | Cashier overlap | Should Supervisor use payment/till writes? | Avoid cashier clone | payment/till permissions | Open |
| SUP-GAP-026 | Waiter overlap | Should Supervisor use menu/order item editing? | Avoid waiter clone | order item permissions | Open |
| SUP-GAP-027 | MTN/Airtel | Live diner checkout not supported | Safety | provider config/docs | Locked caveat |
| SUP-GAP-028 | PesaPal | PesaPal is SaaS billing only | Avoid wrong payment method | billing routes/docs | Locked exclusion |
| SUP-GAP-029 | Printer | No print driver | Avoid fake print | receipt/device routes | Locked caveat |
| SUP-GAP-030 | Terminal | Card terminal stub only | Avoid fake card capture | terminal/device routes | Locked caveat |
| SUP-GAP-031 | Receipt send | No live delivery adapter | Avoid fake delivery | receipt send service | Locked caveat |
| SUP-GAP-032 | Demo fixtures | Supervisor-ready floor/order/reservation/approval fixtures unknown | QA readiness | demo CSVs/importer | Open |
| SUP-GAP-033 | Postman | Dedicated Supervisor workflow collection missing | QA coverage | Postman inventory | Open |
| SUP-GAP-034 | API pool blocker | Current waiter floor Prisma pool pressure blocker may affect Supervisor Floor | Floor QA risk | Prisma/debug follow-up | Open |

## Gap handling rule

If a gap is unresolved at build time:

- hide the action if it would be misleading;
- or show a disabled control with exact reason;
- document the gap in this file;
- do not add frontend-only fake behavior.
