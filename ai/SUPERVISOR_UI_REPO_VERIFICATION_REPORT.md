# Supervisor UI Repo Verification Report

Status: complete research pass  
Date: 2026-07-04  
Repo: `C:\Users\arman\Desktop\nimbus-pos`  
Scope: research and documentation only. No backend, frontend, Prisma, migration, Postman, seed, import, demo database, or server changes.

## 1. Context Snapshot

- `ai/AI_STATUS.md` shows the latest frontend work is Waiter/Cashier demo work, with cashier authenticated demo QA mostly complete and a known waiter floor/API pool-pressure risk.
- `ROADMAP.md` says backend and BG milestones through BG7 are complete and M43 is the next frontend shell/role-workspace milestone.
- Supervisor docs were not present at root `docs/supervisor-ui-docs/*`; the current source pack lives under `Front End/supervisor_ui_docs_pack/*`.
- Approved Supervisor nav remains: `Floor`, `Orders`, `Reservations`, `Approvals`, `Me`.

## 2. Read/Verification Inputs

Read first/source docs:

- `ai/AI_STATUS.md`
- `Front End/supervisor_ui_docs_pack/ai/SUPERVISOR_UI_RESEARCH_REPORT.md`
- `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/*`
- `Front End/supervisor_ui_docs_pack/ai/SUPERVISOR_UI_IMPLEMENTATION_ROADMAP.md`
- `README.md`
- `ROADMAP.md`
- `demo-data/DEMO_LOGIN_CREDENTIALS.md`
- mandatory governance docs: `ai/AI_CONTEXT.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`
- all Postman collection files were inventoried/skimmmed by JSON metadata under `postman/collections`.

Searched source areas:

- Prisma schema, seed, demo importer, demo CSV pack
- auth, floor, orders, pos-handoff, payments, refunds, discounts, reservations, receipts, shifts, tills, HR/attendance, KDS, analytics, unified approvals, device registry, reports/accounting modules
- web login/auth, waiter and cashier structural frontend code
- Postman collections and dev environment.

## 3. Identity/Auth Findings

Supervisor role exists exactly as `JobRole.SUPERVISOR` in `packages/db/prisma/schema.prisma`.

Seeded role:

- Role name: `Supervisor`
- Job role: `SUPERVISOR`
- Role level: `L3`
- Description: `Floor supervisor - overrides and approvals`

Demo Supervisor credentials:

- User: Peter Mugisha
- Email: `supervisor@nimbus.demo`
- Password: `Demo1234!`
- Quick PIN: `22334455`
- PIN tier: `HIGH_8`
- Branch: `Tapas Downtown`
- Branch code: `TAPAS_DOWNTOWN`
- Branch ID in docs: `cb27be401a2c35dfc0d4e610`

Quick PIN:

- Supervisor is an elevated Quick PIN role. `HIGH_TIER_ROLES` includes `JobRole.SUPERVISOR` and `JobRole.MANAGER`.
- `QuickPinLoginDto` requires `branchId`, 6-or-8 digit `pin`, and `platform`.
- Quick PIN platform is POS desktop only by policy.

`GET /api/auth/me` shape:

- returns user identity, `roles[]`, aggregated `permissions[]`, active `memberships[]`, `context.defaultOrganizationId`, `context.defaultBranchId`, `context.defaultMembershipId`, and session metadata.
- permissions are aggregated from the user's assigned roles. There is no runtime role inheritance beyond explicit role-permission rows and any multiple roles a user has.

Frontend routing gap:

- `apps/web/src/lib/auth/role.ts` recognizes only `WAITER` and `CASHIER`.
- `apps/web/src/pages/login.tsx` clears the session and shows "This frontend currently supports waiter and cashier workspaces only." for Supervisor.
- Required future change: add Supervisor compatibility/routing and route Supervisor to `/supervisor/floor`.

## 4. Supervisor Permissions From Seed

Supervisor's permissions are explicitly listed in `ROLE_PERM_MATRIX.Supervisor`; they are not inherited from Manager.

Permitted operational permissions include:

- Auth/read context: `identity:user:read`, `identity:session:read`, `identity:access-matrix:read`, `tenancy:org:read`, `tenancy:branch:read`
- Floor/tables: `pos:floor:read`, `pos:floor:write`, `pos:table:read`, `pos:table:write`
- Menu/tax/recipe/inventory: read and write permissions are present
- Orders: `pos:orders:read`, `pos:orders:write`, `pos:orders:close`, `pos:orders:void`
- KDS: `pos:kds:read`, `pos:kds:write`, `pos:kds:sla:write`
- Discounts: `pos:discount:request`, `pos:discount:approve`, `pos:discount:read`
- Payments/refunds/void: `pos:payment:*`, `pos:refund:create`, `pos:refund:approve`, `pos:refund:read`, `pos:void:postclose`
- Shifts/tills: open/close/read/reconcile/safe-drop permissions are present
- Reservations: create/read/confirm/seat/cancel/no-show/deposit/update/table-assign
- Analytics/dashboards/reports: selected operational analytics and report permissions are present
- HR/workforce: employee/contract/position reads, attendance clock/read, leave create/read/review, shift-swap create/read/approve, schedule read/create
- Payroll/staff: payroll read/adjustment-create and staff insight/award reads are present.

Important exclusions:

- `approvals:read`, `approvals:decide`, and `audit:read` are not in Supervisor's seed list.
- `pos:receipt:read`, `pos:receipt:reprint`, and `pos:receipt:send` are not in Supervisor's seed list.
- `devices:read` and device write permissions are not in Supervisor's seed list.
- Accounting/AP/AR/GL/franchise/billing/dev/ops/export/device global permissions are not Supervisor-seeded.

## 5. Floor/Table Findings

Supervisor can read and write floor/table state.

Safe endpoints:

- `GET /api/floor-plans`
- `GET /api/floor-plans/:id`
- `GET /api/floor/availability`
- `GET /api/tables`
- `GET /api/tables/:id`
- `PATCH /api/tables/:id/status` with body `{ status }`

Implementation caveat:

- Table status write is real and auditable; UI should use confirmations or clear blocked states for status changes that could disrupt seating.

## 6. Orders/Resolution Findings

Supervisor can technically use broad order and settlement permissions. Product scope should still keep Supervisor centered on exception resolution, not waiter/cashier cloning.

Allowed by seed:

- Read all branch orders via `GET /api/pos/orders`.
- Create/edit/send/serve/request-bill/void orders via order permissions.
- Close orders and create/cancel/read payment intents/manual references.
- Split bill, split items, merge, transfer table, transfer server, move items through BG4.B handoff permissions.

Resolution endpoints are BG3-wrapped and should send `Idempotency-Key`.

High-risk product decision:

- Although `pos:orders:close`, `pos:payment:*`, `pos:till:*`, and `pos:kds:write` are seeded, the approved Supervisor UI should not add a Payments or KDS tab. If used, keep them as exception-only controls inside Orders/Approvals with explicit caveats and confirmations.

## 7. Reservations Findings

Reservations deserve a first-class Supervisor tab.

Supervisor has all core reservation permissions:

- create, read, confirm, seat, cancel, no-show
- record/read deposits
- update and assign table.

Endpoints and DTOs are verified in `apps/api/src/modules/reservations`. Seating can optionally create an order via `{ tableId?, createOrder?, orderNotes? }`.

## 8. Approvals/Refund/Discount/Void Findings

Global approvals:

- `GET /api/approvals` and `POST /api/approvals/:id/decide` require `approvals:read` / `approvals:decide`.
- Supervisor does not have those global permissions.
- Do not build a global approval inbox for Supervisor unless seed changes.

Domain-specific approvals:

- Supervisor can list/approve/reject pending discounts with `pos:discount:approve`.
- Supervisor can create/read/approve refunds with `pos:refund:*`.
- Supervisor can execute post-close void with `pos:void:postclose`, but DTO requires `reason` and `managerPin`.
- Leave review and shift-swap approval are permitted with `pos:hr:leave:review` and `pos:hr:shift-swaps:approve`.
- Anomaly acknowledge/resolve is allowed by `pos:analytics:anomalies:acknowledge`.

Recommended Approvals tab:

- Use domain-specific queues: discounts, refunds, post-close void boundary, leave/shift swaps, anomalies.
- Hide or block global `/api/approvals` until Supervisor is granted `approvals:*`.

## 9. Punch/Workforce Findings

Supervisor can punch/clock and read attendance. DTO requires `employeeId` and optional `notes`.

Me tab can include:

- shift active/readiness
- punch/attendance
- own leave request
- own shift swap request, if a safe target employee selector exists
- leave review and shift-swap approval only if framed as operational approval, not HR admin.

Caveat:

- Employee identity must be resolved safely; Waiter prior work used `mine=true` for self scopes and blocked create paths without a safe `employeeId`.

## 10. Receipts/Audit/Device Findings

Receipts:

- Backend has receipt view/history/reprint/send endpoints.
- Receipt send is pending/no live adapter.
- Supervisor is not granted `pos:receipt:*` in current seed.
- Supervisor UI should not expose receipt actions unless seed changes; at most show an access-limited caveat.

Audit:

- Global audit timeline exists at `/api/audit/timeline`, but requires `audit:read`.
- Supervisor is not granted `audit:read`.

Devices:

- Device registry exists under `/api/devices`.
- Device read/write permissions are not granted to Supervisor.
- Printer routes are metadata only; terminal pairing is STUB only.
- Supervisor should not manage devices.

## 11. Safety/Deferred Surfaces

Confirmed caveats:

- MTN/Airtel public/diner payment execution remains pending provider confirmation.
- PesaPal is owner SaaS subscription billing only, not diner checkout.
- Receipt send returns pending/no adapter and records audit metadata.
- Printer routes are metadata/configuration only and do not invoke a print driver.
- Terminal pairing is a stub and does not create acquirer/card-terminal traffic.
- Hardware wave, MSR/badge login, and smart spouts remain late/deferred.

## 12. Demo-Data Readiness

Dry-run demo validation passed with zero writes:

- CSV files discovered: 63
- Rows parsed: 9,243
- Floor plans: 9
- Tables: 68
- Orders: 1,192
- Refunds: 15
- Reservations: 120
- Reservation deposits: 40
- Attendance rows: 108
- Leave requests: 12
- Shift swaps: 8
- Anomalies: 20
- Devices: 16
- Printer routes: 12

Supervisor-specific readiness:

- credentials and membership exist in docs/CSV/importer
- Supervisor-created orders exist in demo CSV
- floor/table, reservations, attendance, leave/swap, anomaly/device fixtures exist
- dedicated Supervisor UI workflow/Postman collection does not exist yet.

## 13. Go/No-Go

Go for Supervisor UI implementation planning after this documentation update, with constraints:

- Go for approved nav: `Floor`, `Orders`, `Reservations`, `Approvals`, `Me`.
- Go for landing route: `/supervisor/floor`.
- Go for Reservations as first-class.
- Go for Approvals only as domain-specific queues/boundaries; no global `/api/approvals` yet.
- Go for punch under Me.
- No-go for receipt actions, device management, global audit, accounting, franchise, billing/dev portal, and global approvals unless permissions are changed.
- Caution for KDS/payment/till/order-entry writes: allowed by seed but should be product-gated to exception workflows, not separate nav surfaces.

## 14. Validation Performed

Commands run:

```pwsh
corepack pnpm@8.15.0 --version
corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate
```

Results:

- pnpm version: `8.15.0`
- demo validation: passed dry run, `zeroDatabaseWrites: true`

Not run by instruction:

- migrations
- seed
- demo import writes
- Newman
- API/web servers

## 15. Recommended Next Prompt

Build Supervisor Prompt 1: create Supervisor shell/navigation only, using `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, `/supervisor/me`, and add guarded role routing without changing backend, Prisma, seed, or Postman.

