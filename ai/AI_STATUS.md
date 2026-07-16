# AI_STATUS.md — Live Progress Tracker

## ⚠️ NUMBERING RULE — READ FIRST

**ROADMAP.md is the ONLY authority for milestone numbers.**

During the rebuild, some milestones were implemented out of ROADMAP order.
The early internal numbering (M22–M29) was offset by 4 from ROADMAP due to
the ROADMAP splitting inventory across M9–M13 while the impl combined them.

**This offset has been fully reconciled as of 2026-04-09.**
All Postman collections, completion reports, and this file now use ROADMAP numbers.
DO NOT create new milestones using internal/offset numbers.
If you see references to "internal M22–M29" in old code comments or migration names,
map them using the table below — but always use ROADMAP numbers going forward.

### Historical Internal → ROADMAP Mapping (CLOSED — do not extend)

| ROADMAP # | ROADMAP Title | Old Internal # | Migration Name Contains |
|---|---|---|---|
| M26 | Documents + Uploads | M22 | `m22_documents` |
| M27 | Employees + Contracts | M23 | `m23_employees` |
| M28 | Attendance + Leave | M24 | `m24_attendance` |
| M29 | Scheduling + Templates | M25 | `m25_scheduling` |
| M30 | Payroll Engine | M26 | `m26_payroll` |
| M31 | Staff Insights + Awards | M27 | `m27_staff_insights` |
| M32 | Accounting Foundation | M28 | `m28_accounting` |
| M33 | General Ledger | M29 | `m29_general_ledger` |

From M34 onward, ROADMAP numbers and migration names are aligned. No more offset.

## Current State

- MANAGER_UI_PROMPT0_REPO_VERIFICATION complete / shell foundation pending (2026-07-06): Manager UI verification and scope mapping has been completed. Checked codebase constraints, verified that the MANAGER role matches 'Manager' roleName and JobRole.MANAGER in schema and seed data. Validated Daniel Okello (manager@nimbus.demo) credentials and PIN 11223344. Documented all 50+ candidate backend endpoints, scoped permissions, and functional gaps. Created a dedicated documentation package under docs/manager-ui-docs (README, API matrix, gap register, lifecycle) and ai/ (verification report, scope and nav recommendations). Confirmed that pnpm typecheck, api build, and db dry-run verification all pass successfully. No frontend pages or backend mutations were written. Report: ai/MANAGER_UI_REPO_VERIFICATION_REPORT.md.

- SUPERVISOR_UI_FINAL_QA complete / demo-ready with known limitations (2026-07-06): Supervisor finalization completed as a UI polish, QA, and closeout pass across the exact Supervisor nav `Floor`, `Orders`, `Reservations`, `Approvals`, and `Me`. The shell no longer forces a 1280px canvas, route detail panels stack on narrow viewports, dense summary/toolbars/cards now collapse responsively, focus states and disabled-state copy were tightened, and internal prompt/build-history wording was removed from user-facing UI. Shift-swap selector decision is Outcome B: creation remains disabled because no narrow Supervisor-safe eligible source shift plus eligible target selector endpoint exists; broad staff selection remains forbidden, and adding an endpoint would be a new API/Postman contract outside this closeout. Role boundaries were re-verified: no Cashier checkout, Waiter menu entry, global approvals call, receipt/device admin, payroll/staff admin, accounting, billing, franchise, developer, live mobile-money checkout, PesaPal diner checkout, printer-driver invocation, or terminal/acquirer traffic is exposed. Postman was inventoried and unchanged because no API path/payload changed. Validation passed for `corepack pnpm@8.15.0 --version`, web typecheck, web lint, API build, and web build. HTTP smoke passed for `/api/health` db ok, Supervisor login, `/api/auth/me`, all five Supervisor routes, Waiter floor, and Cashier queue. Browser screenshots were attempted at 1280x800 and 390x844; several authenticated Supervisor captures were produced, but the full automated browser-auth sweep was limited by local Prisma connection-pool exhaustion after repeated headless login attempts. Report: `ai/SUPERVISOR_UI_FINALIZATION_REPORT.md`.

- SUPERVISOR_UI_PROMPT9_LEAVE_REQUEST complete / shift-swap action pending (2026-07-06): Supervisor Me now exposes a safe current-user leave request form using the verified `POST /api/hr/leave` contract only. The form requires linked employee identity from `/api/auth/me`, branch/org context, and `pos:hr:leave:create`; it submits only the authenticated user's linked `employeeId`, validated leave type, date range, and optional reason, confirms before submit, disables duplicate in-flight submission, resets after success, and refreshes Supervisor leave/approval query families. Backend leave creation was hardened so `AttendanceService.createLeaveRequest` rejects same-org employee IDs not linked to the current authenticated user. Shift swap creation remains visibly deferred because the create contract still requires a safe target employee/shift selector not verified for Supervisor v1. No Prisma schema, migrations, seed/demo import, package files, Postman collections, payroll/accounting/billing/franchise/developer/device/receipt/global approvals, or waiter/cashier clone surfaces were added. Validation passed: `corepack pnpm@8.15.0 --filter @nimbus-pos/api test -- attendance.service.spec.ts`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`, zero-write `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`, `/api/health` returned db ok, supervisor login plus `POST /api/hr/leave` created/listed a PENDING current-user leave request, and HTTP route smoke returned 200 for Supervisor Me/Floor/Orders/Reservations/Approvals plus Waiter Me and Cashier Me. Report: `ai/SUPERVISOR_UI_PROMPT9_LEAVE_REQUEST_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_PROMPT8_EMPLOYEE_IDENTITY_PUNCH complete / leave and shift-swap actions pending (2026-07-05): `/api/auth/me` now exposes a minimal linked `employee` identity from `Employee.userId` when the employee belongs to the current organization, limited to id, employee code, name, status, org/branch ids, and position label/code. Attendance self-clock is now protected server-side so `POST /api/hr/attendance/clock` can only clock the employee linked to the current authenticated user, preventing arbitrary same-org employee punch writes. Supervisor context now carries the safe employee identity and `/supervisor/me` enables the punch control only when the authenticated Supervisor has branch context, the linked employee identity, and `pos:hr:attendance:clock`; the action requires confirmation and refreshes attendance history after success. Leave request creation and shift-swap creation remain visibly deferred because the safe form/target-selector contracts are not part of this prompt. No Prisma schema, migrations, seed/demo import, package files, Postman collections, hardware/provider/accounting/billing/franchise/developer/admin/payroll/pay-run surfaces, or broad HR/admin UI were added. Validation passed: `corepack pnpm@8.15.0 --filter @nimbus-pos/api test -- attendance.service.spec.ts me-membership-context.spec.ts`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`, zero-write `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`, `/api/health` returned db ok, `supervisor@nimbus.demo` login plus `/api/auth/me` returned employee `EMP-004`, `GET /api/hr/attendance?mine=true` returned `data,total`, and HTTP route smoke returned 200 for Supervisor, Waiter, and Cashier Me plus Supervisor Floor/Orders/Reservations/Approvals. Report: `ai/SUPERVISOR_UI_PROMPT8_EMPLOYEE_IDENTITY_PUNCH_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_PROMPT7_ME_WORKFORCE complete / action workflows pending (2026-07-05): Supervisor Me is now a real session, profile, readiness, punch, and workforce self-service surface using existing verified frontend/auth context and HR read endpoints only. Added `apps/web/src/lib/supervisor/workforce.ts`, `apps/web/src/components/supervisor/me/SupervisorMeScreen.tsx`, `apps/web/src/components/supervisor/me/index.ts`, and replaced `/supervisor/me` with a real screen reading `GET /api/hr/attendance?mine=true&take=10`, `GET /api/hr/leave?mine=true&take=10`, and `GET /api/hr/shift-swaps?mine=true&take=10`. Punch, leave creation, and shift-swap creation are visibly disabled because `/api/auth/me` does not expose a verified current-user `employeeId`, while the write DTOs require explicit employee identifiers. No fake rows, no backend business logic, no Prisma schema, migrations, seed/demo import, package files, Postman collections, receipts/devices/admin/accounting/billing/franchise/developer/payroll/pay-run/hardware/provider surfaces, or Waiter/Cashier routes were changed. Validation passed: `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, isolated `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` after an initial timeout, `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`, zero-write `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`, and HTTP smoke returned 200 for `/login`, `/supervisor/me`, `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, `/waiter/me`, and `/cashier/me`. Browser-authenticated visual QA was not completed; temporary web listeners were stopped. Report: `ai/SUPERVISOR_UI_PROMPT7_ME_WORKFORCE_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_PROMPT6_APPROVALS complete / Me and punch build pending (2026-07-05): Supervisor Approvals is now a real read-only domain approvals oversight surface using verified domain APIs only. Added `apps/web/src/lib/supervisor/approvals.ts` plus summary, toolbar, domain cards, queue list, and detail panel components under `apps/web/src/components/supervisor/approvals/`; replaced `/supervisor/approvals` with active reads from `GET /api/pos/discounts/pending`, selected discount detail from `GET /api/pos/discounts/:id`, pending leave reads from `GET /api/hr/leave?status=PENDING&take=50`, pending shift swap reads from `GET /api/hr/shift-swaps?status=PENDING&take=50`, anomaly reads from `GET /api/analytics/anomalies?status=OPEN&limit=50`, and selected anomaly detail from `GET /api/analytics/anomalies/:id`. Global `/api/approvals` remains excluded because Supervisor lacks `approvals:*`; refunds and post-close voids render honest unavailable domain cards because no pending refund queue or read-only void candidate endpoint was verified. Approve/reject/review/acknowledge/resolve/execute, manager PIN, override execution, cashier payment, waiter order entry, receipt/device/admin/accounting/billing/franchise/developer surfaces, backend business logic, Prisma schema, migrations, seed/demo import, package files, and Postman collections were not changed. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`, forbidden client-route scan confirmed no `/api/approvals` call, and HTTP smoke returned 200 for `/login`, `/supervisor/approvals`, `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, and `/supervisor/me`. Browser visual QA was not completed; HTTP route smoke passed and temporary web listeners were stopped. Report: `ai/SUPERVISOR_UI_PROMPT6_APPROVALS_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_PROMPT5_RESERVATIONS complete / approvals build pending (2026-07-05): Supervisor Reservations is now a real read-only oversight surface using existing verified reservation APIs only. Added `apps/web/src/lib/supervisor/reservations.ts` plus reservation summary, toolbar, card/list, status badge, and detail panel components under `apps/web/src/components/supervisor/reservations/`; replaced `/supervisor/reservations` with active reservation reads from `GET /api/reservations`, `GET /api/reservations/upcoming`, selected detail reads from `GET /api/reservations/:id`, deposit reads from `GET /api/reservations/:id/deposits`, and event reads from `GET /api/reservations/:id/events`. Added table-scoped handoff from Supervisor Floor to `/supervisor/reservations?tableId=<id>` and reciprocal reservation detail links back to `/supervisor/floor?tableId=<id>`. Create/edit, confirm, assign table, seat, cancel, no-show, and deposit mutations remain disabled/deferred. No backend controllers/services, Prisma schema, migrations, seed/demo import, Postman collections, package files, cashier/waiter routes, hardware/provider/accounting/franchise/billing/developer surfaces, or full accounting work were changed. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`, `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`, and HTTP smoke for `/supervisor/reservations?tableId=smoke-table` plus `/supervisor/floor?tableId=smoke-table` returned 200 with Next data. Browser QA was attempted twice through the in-app browser and blocked by browser webview attach timeout; the temporary web listener was stopped and logs removed. Report: `ai/SUPERVISOR_UI_PROMPT5_RESERVATIONS_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_PROMPT4_ORDERS complete / reservations build pending (2026-07-05): Supervisor Orders is now a real read-only oversight surface using existing verified APIs only. Added `apps/web/src/lib/supervisor/orders.ts` plus order summary, toolbar, card/list, status/payment badges, and detail panel components under `apps/web/src/components/supervisor/orders/`; replaced `/supervisor/orders` with active order reads from `GET /api/pos/orders?excludeStatus=CLOSED,VOIDED`, payment summary reads from `GET /api/pos/orders/:id/payments`, selected-order detail reads from `GET /api/pos/orders/:id`, refund history reads from `GET /api/pos/orders/:id/refunds`, and discount reads from `GET /api/pos/orders/:id/discounts`. Added floor-to-orders handoff from selected table detail to `/supervisor/orders?tableId=<id>` without adding floor writes. No backend controllers/services, Prisma schema, migrations, seed/demo import, Postman collections, package files, cashier/waiter routes, payment settlement, refund execution, discount approval, split/merge/transfer/void writes, KDS actions, hardware/provider/accounting/franchise/billing/developer surfaces, or full accounting work were changed. Validation passed: `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`, local `/api/health` returned db ok, and HTTP smoke for `/supervisor/orders` returned 200 with Next data after compiling. Browser QA was attempted twice through the in-app browser but blocked by browser webview attach timeout; all local QA listeners were stopped. Report: `ai/SUPERVISOR_UI_PROMPT4_ORDERS_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_FLOOR_AUTH_QA complete / orders build pending (2026-07-04): API startup follow-up narrowed the local blocker to slow/quiet Nest watch compilation exceeding the 120-second QA window; the compiled path `corepack pnpm@8.15.0 exec nest build --builder tsc --path tsconfig.build.json` followed by `node dist/main` from `apps/api` successfully bound `localhost:3001`, and `/api/health` returned `{"status":"ok","db":"ok"}`. Authenticated Supervisor browser QA then loaded `/supervisor/floor` with real floor data: 28 table cards, summary counts Total 28 / Available 19 / Occupied 6 / Reserved 3 / Blocked 0 / Other 0, Floor/Orders/Reservations/Approvals/Me nav, search narrowing for `QA-OPEN-01`, Available filter showing 19 cards, and a table detail panel with status update control. `PATCH /api/tables/:id/status` was verified against `QA-OPEN-01` and restored from `OCCUPIED -> AVAILABLE -> OCCUPIED`. Supervisor password login and Quick PIN login returned 201. Supervisor placeholder routes returned HTTP 200. Waiter authenticated browser guard passed for `/waiter/floor` and was blocked from Supervisor; Cashier API auth/context passed, while Cashier CDP route verification was inconclusive due harness timeout. No backend business logic, Prisma schema, migrations, seed/demo writes, Postman collections, package files, or deferred hardware/provider/accounting/franchise/billing/developer surfaces were changed. Validation passed: `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`, and zero-write `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`. Reports: `ai/SUPERVISOR_UI_PROMPT3_FLOOR_COMPLETION_REPORT.md` and `ai/SUPERVISOR_UI_API_STARTUP_AND_FLOOR_QA_REPORT.md`.

- SUPERVISOR_UI_PROMPT2_SESSION_CONTEXT complete / floor build pending (2026-07-04): Supervisor frontend session/context is now wired through existing auth state and `/api/auth/me` fields with safe profile, role, membership, branch, organization, session, and permission fallbacks. The Supervisor shell blocks missing session, non-Supervisor role, missing branch context, and missing organization context before route content renders. The readiness strip/header show read-only shift readiness through the existing `GET /api/shifts/active` helper plus explicit Floor and Approvals placeholders. `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, and `/supervisor/me` now use truthful Prompt 2 copy, branch/session context, real readiness summaries, broad permission visibility, and restricted-surface caveats without loading fake operational rows or adding write controls. No backend controllers/services, Prisma schema, migrations, seed/demo data, Postman collections, provider/hardware traffic, receipt/device/admin/accounting/franchise/billing/developer shortcuts, or Waiter/Cashier routes were changed. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Browser-authenticated QA was attempted by starting minimum local dev servers; web `/login` returned 200, but API did not bind to `localhost:3001` before timeout and its log was still at Nest watch compilation, so authenticated browser smoke was blocked and all started listeners were stopped. Report: `ai/SUPERVISOR_UI_PROMPT2_SESSION_CONTEXT_COMPLETION_REPORT.md`.

- SUPERVISOR_UI_PROMPT1_SHELL_FOUNDATION complete / session context pending (2026-07-04): Supervisor frontend foundation now has guarded Pages Router routes for `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, and `/supervisor/me`; a Supervisor shell with fixed header, readiness strip, exact Floor/Orders/Reservations/Approvals/Me bottom nav; Supervisor-only session guard; Supervisor auth/routing helpers; neutral read-only readiness chips; and safe placeholder/blocked/caveat states. Login routing now sends valid Supervisor context to `/supervisor/floor` without changing Waiter `/waiter/floor` or Cashier `/cashier/queue` routing. No backend business logic, Prisma schema, migrations, seed/demo data, Postman collections, or forbidden receipt/device/admin/accounting/franchise/billing/developer/provider/hardware surfaces were changed. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/SUPERVISOR_UI_PROMPT1_SHELL_FOUNDATION_COMPLETION_REPORT.md`.

- CASHIER_UI_AUTHENTICATED_DEMO_QA mostly complete / cashier demo-ready with waiter floor blocker (2026-07-02): local API startup was debugged in `C:\Users\arman\Desktop\nimbus-pos` only. `pnpm api dev` / `npx nest start` appeared stalled because the API build/start path is slow and quiet; `npx nest build --builder tsc --path tsconfig.build.json` followed by `node dist/main` from `apps/api` started the API and `/api/health` returned `{"status":"ok","db":"ok"}` after Neon cold-start retries. Web validation passed: `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`; demo dry-run validation passed with zero DB writes. Authenticated cashier browser QA passed for login, Queue, Receipts, Till, and Me. Waiter Quick PIN login routed to `/waiter/floor` and waiter access to `/cashier/queue` was correctly denied, but waiter floor data returned `Internal server error` with API logs showing Prisma connection-pool timeouts during JWT validation. Frontend-only fixes: capped cashier receipt candidate preload/retry fan-out and caught already-handled auth restore failures to prevent the Next dev overlay on expired sessions. No backend business logic, Prisma schema, migrations, seed/demo import data, Postman collections, or deferred hardware/provider/accounting/payroll/franchise/admin surfaces were changed. Reports: `ai/CASHIER_UI_API_STARTUP_DEBUG_REPORT.md` and `ai/CASHIER_UI_AUTHENTICATED_DEMO_QA_REPORT.md`.

- CASHIER_UI_FINAL_QA complete / demo-ready with known limitations (2026-07-02): final cashier UI QA reviewed Prompts 1-9, cashier docs, route/session behavior, deferred boundaries, and waiter regression risk. Only small cashier/login copy polish was changed: neutral forbidden terminal copy, stale prompt-number copy removal, and polished payment loading text. No backend controllers/services, Prisma schema, migrations, Postman collections, seed/demo import data, payroll/staff/accounting/reporting/franchise/admin/hardware/provider integrations, manager approval execution, post-close void execution, or KDS behavior were changed. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Browser smoke passed for login rendering and unauthenticated cashier/waiter guard redirects; full authenticated browser QA was documented as partial because the local API did not bind to `localhost:3001` during this session. Reports: `ai/CASHIER_UI_FINAL_QA_REPORT.md`, `ai/CASHIER_UI_KNOWN_LIMITATIONS.md`, `ai/CASHIER_UI_DEMO_WALKTHROUGH.md`, and `ai/CASHIER_UI_PROMPT10_FINAL_QA_COMPLETION_REPORT.md`.

- CASHIER_UI_PROMPT8_REFUNDS complete / cashier me polish pending (2026-07-02): cashier-safe refunds are now available from closed receipts and closed-order checkout preview using existing backend endpoints only. The refund panel reads order detail through `GET /api/pos/orders/:id`, payments through `GET /api/pos/orders/:id/payments`, and refund history through `GET /api/pos/orders/:id/refunds`; creation calls only `POST /api/pos/orders/:id/refunds` with `Idempotency-Key`. The UI requires payment selection, positive amount, reason, confirmation, and trusted refund history before submit; prevents over-refund against order and selected payment refundable balances; and shows explicit 5,000 UGX threshold copy for cashier auto-approval versus manager approval. Manager refund approval and post-close void are boundary cards only, with no PIN, approve, reject, override, or void execution controls. Receipt and queue integrations refresh order, payment, refund, receipt/history, and queue query families after success. Backend controllers/services, Prisma schema, migrations, Postman, seed/demo data, discount approval, reservation/deposit, accounting/reporting/franchise, live mobile-money, printer, card terminal, and manager approval deferrals were preserved. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT8_REFUNDS_COMPLETION_REPORT.md`.

- CASHIER_UI_PROMPT7_TILL complete / refunds build pending (2026-07-02): cashier `/cashier/till` now renders a real till workflow using existing backend endpoints only. The screen reads active shift/till readiness, loads till detail through `GET /api/tills/:id`, loads computed cash position through `GET /api/tills/:id/summary`, opens tills with `POST /api/tills/open`, records safe drops with `POST /api/tills/:id/safe-drop`, and reconciles tills with `POST /api/tills/:id/reconcile`. Till writes use `Idempotency-Key`, require confirmation dialogs, refresh active shift/till/detail/summary after success, and show expected cash, counted cash, safe drops, computed cash payments where derivable, and variance without treating missing fields as zero. Paid-in, paid-out, and pickup remain visibly deferred because no verified API routes exist. Prompt 4 cash checkout till gating remains intact. Backend controllers/services, Prisma schema, migrations, Postman, seed/demo data, refund, discount, reservation/deposit, printer, card terminal, live mobile-money, and receipt-delivery deferrals were preserved. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT7_TILL_COMPLETION_REPORT.md`.

- CASHIER_UI_PROMPT6_RECEIPTS complete / till build pending (2026-07-02): cashier `/cashier/receipts` now renders a real receipt workflow using existing backend endpoints only. The screen builds receipt candidates from closed POS orders, supports search and Today/Closed/Paid/Pending send/Reprinted filters, opens a receipt drawer using `GET /api/receipts/:id`, loads history through `GET /api/receipts/:id/history`, records metadata-only reprint requests through `POST /api/receipts/:id/reprint`, and records pending/no-adapter digital send requests through `POST /api/receipts/:id/send`. Reprint/send writes use `Idempotency-Key`; copy never claims physical print or digital delivery. Queue checkout preview now links closed/voided orders to receipt detail and shows `Receipt available after close.` otherwise. Backend controllers/services, Prisma schema, migrations, Postman, seed/demo data, till, refund, discount, reservation/deposit, live printer, live email/SMS/WhatsApp, card terminal, and provider-gated payment deferrals were preserved. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT6_RECEIPTS_COMPLETION_REPORT.md`.

- CASHIER_UI_PROMPT5_SPLIT_RESOLUTION complete / receipts build pending (2026-07-02): cashier checkout preview now includes split bill allocation, split items, and advanced resolution surfaces using existing backend endpoints only. Split bill calls `POST /api/pos/orders/:id/split-bill` as allocation metadata only. Split items calls `POST /api/pos/orders/:id/split-items`, shows the child-order `NEW`/no-KDS-send boundary, and can optionally resolve target tables through `GET /api/tables`. Merge calls `POST /api/pos/orders/merge`, move items calls `POST /api/pos/orders/:id/move-items`, and transfer table calls `POST /api/pos/orders/:id/transfer-table` only when compatible live targets are available. Transfer server is visibly deferred because no cashier-safe staff selector endpoint is exposed. All resolution writes use `Idempotency-Key`; auth/session, branch, cashier role, active shift, detail, payment-summary, closed/voided, and settled/closed blocking states are enforced in UI. Backend controllers/services, Prisma schema, migrations, Postman, seed/demo data, KDS send, waiter-edit, receipt, refund, provider, printer, and hardware deferrals were preserved. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT5_SPLIT_RESOLUTION_COMPLETION_REPORT.md`.

- CASHIER_UI_PROMPT4_PAYMENT_ENTRY complete / split bill build pending (2026-07-02): cashier checkout preview now includes controlled payment entry using existing endpoints only. Card, MTN MoMo, Airtel Money, and bank transfer manual references call `POST /api/payments/manual-reference` with required references and post-payment refresh. Cash is blocked without active till and is only available as a final `POST /api/pos/orders/:id/close` cash settlement because the manual-reference DTO does not allow CASH. Split tender is supported through multiple manual-reference payments and a final cash close when needed. Payment and close writes send `Idempotency-Key`; provider, card, PesaPal, receipt, printer, split bill/items, till write, refund, backend, Prisma, migration, Postman, and demo-data deferrals were preserved. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT4_PAYMENT_ENTRY_COMPLETION_REPORT.md`.
- CASHIER_UI_PROMPT3_QUEUE complete / checkout payment build pending (2026-07-02): cashier Queue now reads real active payable branch orders with `GET /api/pos/orders`, excludes `NEW`, `CLOSED`, and `VOIDED` by default, resolves order detail and payment summaries through read-only POS endpoints, supports local search and active/ready/in-progress/partially-paid filters, shows the required audit-derived bill-requested gap note, and renders a read-only checkout preview with readiness-aware disabled Take payment, Split bill, and Close order actions. No backend controllers/services, Prisma schema, migrations, seed/demo data, Postman, package changes, payment/order/till/receipt/refund mutations, live provider traffic, print driver work, or deferred hardware work were added. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Browser verification was attempted against already-listening ports 3000/3001 but the in-app browser webview did not attach. Report: `ai/CASHIER_UI_PROMPT3_QUEUE_COMPLETION_REPORT.md`.
- CASHIER_UI_PROMPT2_SESSION_CONTEXT complete / queue build pending (2026-07-01): cashier auth/session/context now uses `/api/auth/me`-derived context, branch-aware cashier guarding, read-only active shift and till checks via `GET /api/shifts/active` and `GET /api/tills/active`, real readiness chips in the cashier header/strip, readiness-aware Queue/Till pages, and real identity/session/readiness details in `/cashier/me`. No backend business logic, Prisma schema, migrations, Postman, seed/demo-data writes, payment/order close/till/receipt/refund mutations, live mobile-money, print driver, or terminal/acquirer traffic were added. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT2_SESSION_CONTEXT_COMPLETION_REPORT.md`.
- CASHIER_UI_PROMPT1 complete / shell foundation and permission alignment (2026-07-01): cashier routes `/cashier/queue`, `/cashier/receipts`, `/cashier/till`, and `/cashier/me` now render inside a guarded `CashierShell` with fixed header, readiness strip, fixed Queue/Receipts/Till/Me bottom nav, session guard, idle logout reuse, caveat banners, and empty/blocked state primitives. Login routing now supports Cashier landing at `/cashier/queue` without removing Waiter routing. Cashier role seed now includes `pos:orders:close` while retaining `pos:payment:close`. No Prisma schema, migrations, controller/service logic, Postman, demo-data writes, payment workflow, split bill UI, receipt history functionality, till reconciliation functionality, refund flow, live mobile-money, print driver, terminal/acquirer traffic, accounting/reporting/franchise/KDS/admin cashier surfaces, or duplicate servers were added. Validation passed: `corepack pnpm@8.15.0 --version`, `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`, and `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`. Report: `ai/CASHIER_UI_PROMPT1_SHELL_FOUNDATION_COMPLETION_REPORT.md`.
- WAITER_MVP_UI_FIX_PASS complete / lock screen and table cards polished (2026-07-01): living known-limitations register created at `ai/WAITER_MVP_KNOWN_LIMITATIONS.md`; Quick PIN and Email tab icons removed; Quick PIN demo branch defaults to Tapas Downtown; Quick PIN button now reads `Enter`; email button reads `Sign in`; Orders bottom nav uses Phosphor `List` icon; floor cards were cleaned up with no couch icon or ready/start-order clutter, no-wrap capacity, and truncated ownership/order text; Open order action icon removed. No Prisma schema, migrations, backend guards, mobile-money, payment collection, print driver, terminal/acquirer traffic, or Postman changes.
- WAITER_MVP_FINAL_QA complete / demo-ready (2026-07-01): final waiter workflow compliance, API coverage, regression, browser QA, and polish pass completed in `C:\Users\arman\Desktop\nimbus-pos`. Quick PIN and email login for `waiter@nimbus.demo` routed to `/waiter/floor`; Tapas Downtown active shift `DEMO-WAITER-OPEN` verified; Floor/Orders/Order Detail/Receipt/Reservations/Me flows verified against real APIs. Closed Today query returned 200 and did not crash. Receipt preview/history/reprint/send verified with pending/no-adapter copy and no delivered claim. Reservation seat used the real seat endpoint and refetched state. No Prisma schema, migrations, or Postman changes. Validation passed: demo dry-run validation, web typecheck, web lint, web build, API health, and waiter route smoke. Report: `ai/WAITER_MVP_FINAL_QA_POLISH_REGRESSION_REPORT.md`. Demo script: `demo-data/WAITER_UI_DEMO_SCRIPT.md`.
- DEMO_DATA_SCAN complete / pending CSV generation
- DEMO_DATA_IMPORT complete / UI verification partially completed (2026-06-30): enterprise demo pack extracted into `demo-data/`; repo-aware importer added at `packages/db/prisma/demo-import.ts` with default dry-run and explicit write mode. Dry-run validation passed, write import completed, post-import Prisma verification passed for enterprise domains and safety invariants. API health returned `{"status":"ok","db":"ok"}`. Web waiter routes returned HTTP 200; in-app Browser attach was unavailable, so UI verification used route/API smoke. Backoffice/franchise/accounting/inventory UI routes are not implemented yet; data verified through database/API. Web typecheck and lint passed; `next build` failed in the Next build worker with exit code `3221226505` and no TypeScript/ESLint error.
- 2026-06-30 verification refresh: Me tab HR/self-service was rechecked in `C:\Users\arman\Desktop\nimbus-pos`. The plain `pnpm` command resolved to pnpm 11.7.0 and failed before TypeScript due to lockfile incompatibility with the repo's `pnpm@8.15.0`, so validation was rerun with `corepack pnpm@8.15.0`: web typecheck, lint, and build all passed. Dev route smoke on port 3000 returned HTTP 200 for `/login`, `/waiter/me`, `/waiter/floor`, `/waiter/orders`, `/waiter/reservations`, and `/waiter/orders/new`. API port 3001 was unavailable, so live authenticated shift/HR/logout actions remain unverified in this pass. Self-service write capability reasons now also cover missing HR permissions, and the unused shift-swap create helper was removed from the waiter Me API surface.
- Repo name: nimbus-pos
- Latest frontend milestone: **WAITER-MVP Frontend Me Tab HR / Shift Self-Service UI** DONE (2026-06-20). Replaced `/waiter/me` placeholder with a real waiter profile, shift controls, attendance/leave/swap self-service read surface, and logout/session panel using only existing backend endpoints: `GET /api/auth/me`, `GET /api/shifts/active`, `POST /api/shifts/open`, `POST /api/shifts/:id/close`, `GET /api/hr/attendance?mine=true`, `POST /api/hr/attendance/clock`, `GET /api/hr/leave?mine=true`, `POST /api/hr/leave`, `GET /api/hr/shift-swaps?mine=true`, and `POST /api/auth/logout`. Shift start/end use `{ notes?: string }`, require open/close permissions and active shift state, and invalidate waiter query families after success. Attendance clock and leave create are capability-blocked until `GET /api/auth/me` returns a safe self `employeeId`; shift-swap creation remains read-only because the existing create contract needs a `targetEmployeeId` and there is no waiter-safe target selector. No backend, seed, Postman, manager/admin HR, payroll, scheduling admin, owner/manager/accountant, Menu-tab, or mobile work was added. Validation passed: `pnpm --filter @nimbus-pos/web typecheck`, `pnpm --filter @nimbus-pos/web lint`, `pnpm --filter @nimbus-pos/web build`. Dev route smoke on port 3007 returned HTTP 200 for `/login`, `/waiter/me`, `/waiter/floor`, `/waiter/orders`, and `/waiter/reservations`. API port 3001 was unavailable, so live authenticated shift/HR mutations were not run. Existing port 3000 and temporary production `next start` port 3006 returned `/waiter/me` 500 because of the known local `.next` vendor-chunk lookup issue; dev smoke and build passed. Completion report: `ai/WAITER_MVP_FRONTEND_ME_TAB_HR_SELF_SERVICE_COMPLETION_REPORT.md`.
- Previous frontend milestone: **WAITER-MVP Frontend Reservations + Seat Guest UI** DONE (2026-06-20). Replaced `/waiter/reservations` placeholder with a real API-backed reservation workflow using only existing backend endpoints: `GET /api/reservations/upcoming`, `GET /api/reservations`, `GET /api/reservations/:id`, and `PATCH /api/reservations/:id/seat`. Added typed reservation API functions and view-model normalization for guest/contact, party size, time/relative timing, status, table assignment, read-only deposit/notes/source data, seating eligibility, and seat result. Filters implemented: Upcoming, Today, Seated, Late, and All; search runs locally across guest, table, reservation number, contact, source, and status. Seat Guest is disabled when the shift is not open and when backend state is not seatable; the seat payload is `{ tableId?: string, createOrder: true }` using the existing DTO shape. On success, reservations, floor, table, and order queue query families are invalidated; the UI offers Open order when a linked order is returned, Start order when only a table is known, and Go to Floor. Reserved table handoff now routes from Floor to `/waiter/reservations?reservationId=<id>`. No backend, seed, Postman, create/confirm/cancel/no-show/deposit/payment/mobile-money/split/merge/transfer/Menu-tab/admin/mobile work was added. Validation passed: `pnpm --filter @nimbus-pos/web typecheck`, `pnpm --filter @nimbus-pos/web lint`, `pnpm --filter @nimbus-pos/web build`; production route smoke on port 3005 returned HTTP 200 for `/login`, `/waiter/reservations`, `/waiter/floor`, and `/waiter/orders` with the expected Next/session-guard payload. Existing port 3000 returned 500 for waiter routes and was treated as stale. Authenticated live reservation seating was not run because no API was listening on port 3001. Completion report: `ai/WAITER_MVP_FRONTEND_RESERVATIONS_SEAT_GUEST_COMPLETION_REPORT.md`.
- Previous frontend milestone: **WAITER-MVP Frontend Receipt + Request Bill UI** DONE (2026-06-20). Implemented the waiter bill/receipt surface inside `/waiter/orders/[orderId]` using only existing backend endpoints: `POST /api/pos/orders/:id/request-bill`, `GET /api/pos/orders/:id`, `GET /api/receipts/:id`, `GET /api/receipts/:id/history`, `POST /api/receipts/:id/reprint`, and `POST /api/receipts/:id/send`. Added typed waiter receipt API functions and view-model normalization for bill state, receipt document lines/totals, action state, and history events. The order detail right panel now shows Request Bill with clear shift/not-sent/completed blocking, local bill-request success feedback, and a receipt drawer. The drawer renders a printable-style receipt preview, totals, history timeline, reprint metadata action, and send receipt with honest `PENDING`/no-live-adapter copy. Receipt ID follows the backend contract `receiptId === orderId`; request-bill returns an audit/action result, so the frontend refetches order/receipt rather than inventing receipt data. Reprint does not invoke print drivers. Send supports only backend-supported `email`, `sms`, and `whatsapp` channels and never claims delivery. No backend, seed, Postman, payment/mobile-money, PesaPal, split/merge/transfer, reservation seating, mobile, owner/manager/accountant, or Menu-tab work was added. Validation passed: `pnpm --filter @nimbus-pos/web typecheck`, `pnpm --filter @nimbus-pos/web lint`, `pnpm --filter @nimbus-pos/web build`; clean Chrome/Playwright smoke on port 3003 rendered `/login`, `/waiter/orders`, `/waiter/orders/test`, and `/waiter/orders/new?tableId=smoke-table` with HTTP 200 and the login/session-required surface. Authenticated live receipt flow was not run because no API was listening on port 3001. Completion report: `ai/WAITER_MVP_FRONTEND_RECEIPT_REQUEST_BILL_COMPLETION_REPORT.md`.
- Latest frontend fix: **WAITER-MVP Frontend Login Fix + Browser Verification** DONE (2026-06-20). Root cause was API CORS/preflight: direct backend auth worked, but browser `OPTIONS /api/auth/login` from `http://localhost:3000` returned 404 with no CORS headers, surfacing as "Failed to fetch". Fixed Nest local CORS, added `apps/web/.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`, made the web API base URL strip a trailing `/api`, improved login diagnostics for network/CORS, invalid credentials, missing branch, forbidden branch/account, and avoided noisy Next route-cancel console errors on auth boundary redirects. No Postman changed. Browser verification passed for email/password login, Quick PIN login, `/api/auth/me` session restore, Floor rendering, bottom-nav click-around, refresh restore, and logout. Validation passed: `pnpm --filter @nimbus-pos/web typecheck`, `pnpm --filter @nimbus-pos/web lint`, `pnpm --filter @nimbus-pos/web build`, `pnpm --filter @nimbus-pos/api build`. Completion report: `ai/WAITER_MVP_FRONTEND_LOGIN_FIX_AND_BROWSER_VERIFICATION_REPORT.md`.
- Previous frontend milestone: **WAITER-MVP Frontend Order Builder / Menu Flow** DONE (2026-06-19; re-verified 2026-06-20). Added guarded `/waiter/orders/new?tableId=<id>` start-order flow, `/waiter/orders/[orderId]` desktop order builder, real menu catalog loading, category/search filtering, item add/update/remove, item-level notes, serving and modifier metadata payload support using `metadata.selectedModifiers[]`, send-to-kitchen/bar, shift-not-open write blocking, waiter ownership blocked handling, and Floor handoff routes for available and waiter-owned occupied tables. No backend code changed. No Postman changed. Re-verification passed after regenerating stale pnpm workspace `node_modules`: `pnpm --filter @nimbus-pos/web typecheck`, `pnpm --filter @nimbus-pos/web lint`, and `pnpm --filter @nimbus-pos/web build`. In-app browser route-guard smoke passed for `/login`, `/waiter/orders/new?tableId=smoke-table`, and `/waiter/orders/smoke-order`: guarded routes redirected to `/login?reason=session_required`, rendered meaningful login content, had no framework overlay, no console warnings/errors, and keypad interaction remained stable. Screenshot capture was blocked by `Page.captureScreenshot` timeout; authenticated live API smoke was not run because no API was listening on port 3001. Completion report: `ai/WAITER_MVP_FRONTEND_ORDER_BUILDER_COMPLETION_REPORT.md`.
- Last completed milestone: **WAITER-MVP — Waiter Role Postman Regeneration (dedicated waiter-flow collection + Newman 83/83 + light annotations on M10/M16/M24/BG4.B)** ✅ (2026-05-18)
- Prior milestone: **WAITER-MVP — Waiter Backend Hardening (ownership guard, auto-occupy tables, list filters, request-bill, shift gating, HR self-scope, tightened waiter permissions)** ✅ (2026-05-18)
- Pre-WAITER-MVP-backend milestone: **BG7 — HMS Integration (read-only API-key facade for the parallel nimbus-hms property-management system)** ✅ (2026-05-08)
- Pre-BG7 milestone: **BG6 — Unified Exports / Downloads Facade + AP Supplier Detail** ✅ (2026-05-03)
- Pre-BG6 milestone: **BG5 — Device / Printer / Terminal Registry** ✅ (2026-05-02)
- Pre-BG5 milestone: **BG4.B — POS Order Handoff (Split / Merge / Transfer / Move-Items)** ✅ (2026-05-01)
- Pre-BG4.B milestone: **BG4.B — POS Order Handoff (Split / Merge / Transfer / Move-Items)** ✅ (2026-05-01)
- Pre-BG4.B milestone: **BG4.A — Receipts Surface (View / Reprint / Send / History)** ✅ (2026-05-01)
- Pre-BG4.A milestone: **BG3 — Reliability Rollout (Idempotency + Maintenance/Training across 16 risky write surfaces)** ✅ (2026-04-30)
- Pre-BG3 milestone: **BG2 — Unified Approvals Inbox + Global Audit Timeline** ✅ (2026-04-30)
- Pre-BG2 milestone: **BG1.1 — Frontline Quick PIN Admin + PIN-First Login Refinement** ✅ (2026-04-30)
- Pre-BG1.1 milestone: **BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding** ✅ (2026-04-30)
- Pre-BG1 milestone: **M42 — Feature Flags + Maintenance Windows + Training Mode** ✅
- Pre-frontend verification gate: **BG0 — Route Verification + Contract Cleanup** ✅ (2026-04-29)
- Stabilization patch 6 — TBD per ROADMAP** (BG5 closes the device-management gap with `POST /api/devices/activate`, KDS registration, printer-route configuration, and STUB terminal pairing.2 / M39.3 hardened for cold-session standalone execution; all hotel / property-group / `M39.4` references removed; `ai/AI_POSTMAN_WORKING_PATTERNS.md` added as the permanent Postman rule book.
- Next milestone: **BG8 — TBD per ROADMAP** (WAITER-MVP closes the waiter-app backend contract gap with ownership/scope/auto-occupy/shift-gating fixes; the waiter-focused Postman collection regeneration is deferred to Prompt 3). (BG7 closes the HMS-integration gap with the `/api/hms/*` read-only façade authenticated by `x-api-key`; the parallel nimbus-hms LLM consumes `docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md` to drive its sync). (BG6 closes the download-centre gap with `/api/exports/*` and the missing `GET /api/accounting/ap/suppliers/:id` route).
- M13.1 (MTN Native) = DONE (code complete; marked PENDING for external delivery)
- M13.2 (Airtel Native) = NOT STARTED
- Public diner payments r2
- Total migrations: 51 (BG7 adds `20260508000000_bg7_hms_integration` — extends `api_keys` with `branch_id` + `last_used_ip`, creates `integration_access_logs`)
- Total Postman collections: 57 (added `postman/collections/WAITER-MVP-Role-Workflow.postman_collection.json`)
- Total completion reports: 69 (added `ai/WAITER_MVP_FRONTEND_ME_TAB_HR_SELF_SERVICE_COMPLETION_REPORT.md`)

### WAITER-MVP Frontend Me Tab HR / Shift Self-Service UI (2026-06-20)

Frontend-only waiter milestone that replaces the placeholder `/waiter/me` page with a real Me tab inside the existing `WaiterShell` and bottom navigation. Added `apps/web/src/lib/waiter/me-api.ts` for existing backend endpoints only: `GET /api/shifts/active`, `POST /api/shifts/open`, `POST /api/shifts/:id/close`, `GET /api/hr/attendance?mine=true`, `POST /api/hr/attendance/clock`, `GET /api/hr/leave?mine=true`, `POST /api/hr/leave`, and `GET /api/hr/shift-swaps?mine=true`. Added `apps/web/src/lib/waiter/me-model.ts` to normalize auth/profile, branch context, active-shift state, attendance rows, leave requests, shift swaps, and capability reasons with safe fallbacks such as `Employee link pending`, `Shift not started`, and `No records yet`. Added `WaiterMeScreen` under `apps/web/src/components/waiter/me/` with identity/session cards, shift start/end controls, notes, attendance history, leave request history/form shell, shift-swap history, branch context, logout, loading skeletons, empty states, and API failure states. Shift start/end use `{ notes?: string }`, honor `pos:shift:open` / `pos:shift:close`, and invalidate active-shift, floor, orders, and reservations query families after success. Attendance clock and leave creation are disabled until `GET /api/auth/me` exposes a safe self `employeeId`; shift-swap creation is not exposed because the existing contract requires a `targetEmployeeId` and no waiter-safe target selector exists. No backend, Postman, seed, manager/admin HR, payroll, scheduling admin, owner/manager/accountant, Menu-tab, mobile, or hardware work was added. Validation passed: typecheck, lint, build, and dev route smoke on port 3007 for `/login`, `/waiter/me`, `/waiter/floor`, `/waiter/orders`, and `/waiter/reservations`; live authenticated shift/HR calls were blocked because the API was not listening on port 3001.

### WAITER-MVP Frontend Reservations + Seat Guest UI (2026-06-20)

Frontend-only waiter milestone that replaces the placeholder `/waiter/reservations` page with a real reservations seating flow. Added `apps/web/src/lib/waiter/reservation-api.ts` for existing backend endpoints only: `GET /api/reservations/upcoming`, `GET /api/reservations`, `GET /api/reservations/:id`, and `PATCH /api/reservations/:id/seat`. Added `apps/web/src/lib/waiter/reservation-model.ts` to normalize reservation cards/detail data with safe fallbacks such as `Guest not added`, `Table not assigned`, `Time unavailable`, and `Status unavailable`. Added `WaiterReservationsScreen` under `apps/web/src/components/waiter/reservations/` with search, filters, card list, detail panel, skeletons, empty/failure/blocked states, read-only contact/notes/deposit display, and no admin action buttons. Seat Guest requires an active shift, calls the real backend seat endpoint with `{ tableId?: string, createOrder: true }`, shows success feedback, refetches reservation/floor/table/order state through React Query invalidation, and guides to Open order, Start order, or Floor based on the backend response. Floor reserved-table handoff now routes to `/waiter/reservations?reservationId=<id>`. No backend, Postman, seed, reservation create/confirm/cancel/no-show/deposit, payment/mobile-money, PesaPal, split/merge/transfer, Me-tab HR, mobile, owner/manager/accountant, or Menu bottom-nav work was added. Validation passed: typecheck, lint, build, and production route smoke for `/login`, `/waiter/reservations`, `/waiter/floor`, and `/waiter/orders`; live authenticated reservation seating was blocked because the API was not listening on port 3001.

### WAITER-MVP Frontend Receipt + Request Bill UI (2026-06-20)

Frontend-only waiter milestone that adds the bill and receipt workflow inside `/waiter/orders/[orderId]`. Added `apps/web/src/lib/waiter/receipt-api.ts` for existing backend endpoints only: `POST /api/pos/orders/:id/request-bill`, `GET /api/receipts/:id`, `GET /api/receipts/:id/history`, `POST /api/receipts/:id/reprint`, and `POST /api/receipts/:id/send`. Added `apps/web/src/lib/waiter/receipt-model.ts` to normalize `WaiterBillStateViewModel`, `WaiterReceiptViewModel`, receipt lines, history events, and action state with safe fallbacks such as `Receipt unavailable`, `Total unavailable`, `Guest not added`, and `History unavailable`. Added receipt components under `apps/web/src/components/waiter/receipts/`: bill action panel, right-side receipt drawer, printable-style preview, totals block, history timeline, action bar, and status badge. The existing order detail right panel now disables Request Bill for not-sent orders with `Send order before requesting bill.`, disables unsafe writes when shift is not open, blocks duplicate bill requests for closed/voided orders, and opens receipt preview when receipt data is available. Request Bill records backend action success and refetches order/receipt; it does not collect payment. Reprint calls backend metadata only and does not invoke a print driver. Send receipt supports backend channels `email`, `sms`, and `whatsapp`, and successful responses are shown as pending with `Receipt send is pending. No live email/SMS/WhatsApp adapter is connected yet.` No backend, Postman, seed, payment/mobile-money, PesaPal, split/merge/transfer, reservation seating, mobile behavior, owner/manager/accountant screens, or Menu bottom-nav work was added. Validation passed: typecheck, lint, build, and clean Chrome/Playwright smoke for `/login`, `/waiter/orders`, `/waiter/orders/test`, and `/waiter/orders/new?tableId=smoke-table`; live authenticated receipt calls were blocked because the API was not listening on port 3001.

### WAITER-MVP Frontend Orders Queue (2026-06-20) âœ…

Frontend-only waiter milestone that replaces the placeholder Orders tab with a real API-backed waiter queue. `apps/web/src/lib/waiter/order-api.ts` now exposes `listWaiterOrders(query)` over existing `GET /api/pos/orders`, supporting `userId=me`, `status`, `excludeStatus` as comma-separated values, `serviceType`, `tableId`, `page`, and `pageSize`. `apps/web/src/lib/waiter/order-model.ts` adds `WaiterOrderQueueItemViewModel`, queue normalization, status/elapsed/money fallbacks, item-count handling, bill-state metadata reads, ownership-safe `canOpen`, and local search/today filtering helpers. New `WaiterOrdersQueueScreen` implements `/waiter/orders` with Active, Sent, Ready, Served, and Closed Today filters; Active uses `excludeStatus=NEW,CLOSED,VOIDED`, status tabs use backend `status=...`, and Closed Today filters returned closed orders locally by timestamp because no date-window list parameter exists. Rows show table/takeaway context, guest fallback, order number, status, elapsed/time fallback, total fallback, bill state when available, and item count. Clicking an openable order routes to `/waiter/orders/[orderId]`; unexpected non-owned rows show a blocked state instead. Shift-not-open keeps the list readable and adds no write actions. Locked deferrals preserved: no receipts, request-bill UI, payment/mobile-money, reservation seating, Me-tab HR flows, handoff/split/merge/transfer/move-items, unsafe waiter transitions, backend edits, seed edits, or Postman edits. Validation passed: typecheck, lint, and build. Live API queue contract passed with seeded waiter auth. Browser interaction proof was attempted but blocked by empty in-app Browser DOM/screenshot data; fresh port 3002 served routes successfully while existing port 3000 returned 500 for `/waiter/orders`.

### WAITER-MVP — Waiter Role Postman Regeneration (dedicated waiter-flow collection + Newman 83/83 + light annotations on M10/M16/M24/BG4.B) (2026-05-18) ✅

Backend-verification-only milestone (no code, no schema, no migration) that closes the Postman gap deliberately deferred by the 2026-05-18 waiter backend hardening. New canonical collection `postman/collections/WAITER-MVP-Role-Workflow.postman_collection.json` (9 folders, **81 requests, 83/83 assertions passing under Newman**, JSON report at `_newman_waiter_mvp.json`). Folders: `00 Read Me` (variable flow + re-import warning per R8/R20), `A. Auth & Context` (password + quick-PIN login, `/api/auth/me`, refresh, logout), `B. Shift / Readiness` (active shift, open shift, operational write proof), `C. Floor / Tables` (list + detail + reserved-table resolution), `D. Orders` (create dine-in/takeaway, add/update/remove items with note + modifiers, send 200, mark-served, get/list, `?userId=me`, `?excludeStatus=NEW`, request-bill 200 + idempotent re-run), `E. Reservations` (list, upcoming, detail, seat + table-OCCUPIED follow-up), `F. Receipts` (view, history, reprint, send labelled `(PENDING — no live adapter)` asserting 202 + `status:'PENDING'` + `supported:false`), `G. Me / HR Self-Scope` (clock + attendance/leave/shift-swaps with `?mine=true`), `H. Permission Denials / Guard Rails` (cross-waiter `GET /pos/orders/:id` → 403 `ORDER_NOT_OWNED_BY_WAITER`; `/in-kitchen` + `/ready` → 403 `ORDER_TRANSITION_NOT_WAITER_SAFE`; `/void`, `/transfer-server`, `/transfer-table`, `/move-items`, `/split-bill`, `/merge` → 403; `POST /reservations`, `PATCH :id/confirm`, `PATCH :id/cancel`, `POST :id/deposits`, `PATCH :id/assign-table` → 403; probe-and-skip `SHIFT_NOT_OPEN` accepting `[201, 409]` because the seeded waiter may already hold an open shift), `I. Edge Cases / Known Caveats` (PENDING receipt adapter, no combine/uncombine in MVP, reservation admin out of waiter scope, backend-only scope). Variables seeded with the demo credentials (`waiter@demo.local` / `Waiter#123`, PIN `123456`, `owner@demo.local` / `Owner#123`) per R13; runtime entities (`tableId`, `menuItemId`, `reservationId`, `receiptId`, `shiftId`, `attendanceRecordId`, `orderId`, `otherWaiterOrderId`) resolve list-first with create-if-safe fallbacks. Canonical pre-request helpers per R14/R16 — every `setVar` is **dual-scope** (collection + active environment) and every `getVar` is env-first/collection-fallback to prevent the silent-401 shadow bug; login asserts `pm.expect([200,201]).to.include(pm.response.code)` per R12/Rule P1; folder H uses folder-level pre-requests to swap to the owner token to mint the cross-waiter fixture (`otherWaiterOrderId`) and the reservation rows needed for the admin-deny tests, then restores the waiter token before the main request fires. Every folder is `[STANDALONE]` per R18. Light annotations (description-only, no request changes) added to four pre-existing collections so they no longer contradict the hardened waiter contract: `M10-POS-Orders` (notes `request-bill`, `?userId=me`, `?excludeStatus=NEW`, three new error codes), `M16-Reservations-Deposits-Seating` (notes the five waiter-denied admin endpoints + seat→OCCUPIED flip), `BG4B-Pos-Order-Handoff` (notes all six handoff endpoints now 403 for waiter-only actors after seed tightening), `M24-Attendance-Leave-Shift-Swaps` (notes the new `?mine=true` self-scope + empty-result short-circuit). No backend findings — every contract behaved as the brief asserted. Locked rules preserved: no code or schema changes, owner/manager/cashier flows untouched, no deferred hardware work pulled forward, audit-log discipline preserved on every mutate path.


### WAITER-MVP — Waiter Backend Hardening (ownership guard, auto-occupy tables, list filters, request-bill, shift gating, HR self-scope, tightened waiter permissions) (2026-05-18) ✅

Backend-only milestone that lands the audited waiter-MVP contract fixes without any schema changes. New shared util `apps/api/src/common/auth/waiter-scope.ts` exports `isWaiterOnly(actor)` (true iff every `role.jobRole === 'WAITER'`), `assertWaiterOrderOwnership(actor, order)` (throws 403 `ORDER_NOT_OWNED_BY_WAITER`), and `assertWaiterTransitionAllowed(actor, target)` (waiter-only roles may only drive orders into `SENT` and `SERVED`; `IN_KITCHEN/READY/CLOSED/VOIDED` throw 403 `ORDER_TRANSITION_NOT_WAITER_SAFE`). `OrdersService` widens its `RequestMeta` with `actor: ActorLike` and calls the guards on every read/mutate path (`getOrder`, `listOrders`, `addOrderItem`, `updateOrderItem`, `deleteOrderItem`, `transitionOrder`, `voidOrder`, the new `requestBill`); the controller passes `@CurrentUser() user` into every handler so the actor object reaches the service. Auto-occupy: when a `DINE_IN` order transitions to `SENT`, the linked table flips to `OCCUPIED` via `prisma.table.updateMany` (idempotent, never clobbers already-OCCUPIED); when an order reaches a terminal state (`CLOSED` via `transitionOrder`, `VOIDED` via `voidOrder`), the table is released back to `AVAILABLE` only if no other active dine-in orders remain on it. Reservation seat (`reservations.service.ts → seat`) now also flips the seated table to `OCCUPIED` after the reservation update, regardless of whether a linked DINE_IN order was created. `ListOrdersQueryDto` adds `userId?: string` (literal `me` resolves to actor) and `excludeStatus?: string[]` (repeatable param or comma-separated); the list method honors both and merges with the existing `status` filter. New endpoint `POST /api/pos/orders/:id/request-bill` (perm `pos:orders:write`, HTTP 200) emits audit action `ORDER_BILL_REQUESTED` with `{orderNumber, status, tableId, total}` metadata, performs no payment-state mutation, and rejects orders in `CLOSED/VOIDED`. Shift gating: new private `OrdersService.assertWaiterShiftOpen(actor, ctx)` fires `prisma.shift.findFirst({status:'OPEN', openedById:actor.id, branchId})` before `createOrder/addOrderItem/transitionOrder/requestBill`; if actor is waiter-only and no open shift exists, throws 409 `SHIFT_NOT_OPEN`. HR self-scope: `ListAttendanceQueryDto`, `ListLeaveQueryDto`, `ListShiftSwapsQueryDto` gain `mine?: boolean` (with `Transform` boolean coercion); controllers forward `user.id`, and the service's new `resolveMineEmployeeId(actorUserId)` looks up `prisma.employee.findUnique({where:{userId}})` to force-scope the `where` clause (attendance/leave → `employeeId`; shift-swaps → `OR:[{requesterEmployeeId},{targetEmployeeId}]`). When no employee record is linked, the list short-circuits to `{data:[], total:0}` rather than leaking org-wide rows. Seed tightening (`packages/db/prisma/seed.ts` Waiter block): removed `pos:reservation:create`, `pos:reservation:confirm`, `pos:reservation:deposit:record`, `pos:reservation:deposit:read`, `pos:reservation:table:assign`, `pos:order:transfer`, `pos:order:move-items`; kept `pos:reservation:read` + `pos:reservation:seat`. Verified items 11 (free-text item notes) and 12 (structured modifiers) are already wired in the existing `AddOrderItemDto/UpdateOrderItemDto` shape — no code change needed; item 7 (over-broad state actions) is handled inside `assertWaiterTransitionAllowed`. **Deferrals:** waiter-focused Postman collection regeneration to **Prompt 3**; no schema changes (no migration); no shift-of-blame Newman re-run. New e2e scaffold `apps/api/test/waiter-mvp.e2e-spec.ts` covers ownership 403, auto-occupy on send, `?userId=me`, `?excludeStatus=NEW`, request-bill 200/idempotent, waiter 403 on tightened reservation/handoff routes, 409 `SHIFT_NOT_OPEN`, and HR `?mine=true`; run with `pnpm exec jest --config test/jest-e2e.json waiter-mvp` (requires seed re-run so the waiter permission tightening is applied). New error codes added to the public contract: `ORDER_NOT_OWNED_BY_WAITER`, `ORDER_TRANSITION_NOT_WAITER_SAFE`, `SHIFT_NOT_OPEN`; new audit action `ORDER_BILL_REQUESTED`. Locked rules preserved: byte-stable Branch, no schema diff, owner/manager/cashier flows unchanged (guard skips when `isWaiterOnly(actor)===false`), audit-log discipline retained on every mutate.


### BG7 — HMS Integration (read-only `/api/hms/*` façade authenticated by `x-api-key`) (2026-05-08) ✅

Eighteen new GET endpoints under `/api/hms/*` close the previously empty external-integration gap and form the contract surface that the parallel **nimbus-hms** property-management system consumes to keep its folios, restaurant charges, event bookings, and accounting mirrors in sync with this POS. Endpoints are: `/whoami`, `/access-logs`, `/organization`, `/branches`, `/orders`, `/orders/:id`, `/payments`, `/refunds`, `/sales/summary`, `/reservations`, `/events`, `/event-bookings`, `/menu`, `/inventory`, `/shifts`, `/accounting/accounts`, `/accounting/invoices`, `/accounting/vendor-bills`. Authentication is via the new `ApiKeyAuthGuard` reading header `x-api-key` (or `Authorization: ApiKey <key>`) — the guard SHA-256-hashes the inbound key, looks it up in `api_keys`, validates `status='ACTIVE'` and `expiresAt` (codes `API_KEY_MISSING|INVALID|REVOKED|EXPIRED`), then synthesises `req.user = { id:'apikey:<id>', orgId, branchId, permissions:['hms:read:*', ...scopes], source:'API_KEY' }` so the existing `PermissionGuard` enforces the standard `@Permissions('hms:read:*')` decorator without any branching for the HMS path. The existing M39 surface (`POST /api/dev/api-keys`) was extended with an optional `branchId` field — when set, every HMS read is forced into that single branch (`scope:'BRANCH'`); when absent the key is org-wide (`scope:'ORGANIZATION'`) and may filter by `?branchId=` per request. Schema changes are additive only: `api_keys` gains `branch_id TEXT` (FK→branches ON DELETE SET NULL — no Prisma back-relation on `Branch`, preserving the byte-stable BG1/BG5 precedent) and `last_used_ip TEXT`; new table `integration_access_logs` (`id, org_id, api_key_id, branch_id?, route_method, route_path, status_code, duration_ms, ip_address?, user_agent?, request_id?, metadata JSONB?, created_at`) journals every reached HMS request via `HmsAccessLogInterceptor` (best-effort, swallowed on failure). One new permission seeded — `hms:read:*` — granted **to no human role**; it is implicit in any active API key and never appears in JWT claims. **Read-only**: no POST/PATCH/DELETE on `/api/hms/*` — write surfaces (e.g. checking out a folio, syncing back hotel-side adjustments) are deferred to a future BG. All read methods use explicit Prisma `select:` lists — no key hashes, no plaintext secrets, no PII beyond what the HMS legitimately needs (guest names on reservations, customer names on orders). Public diner payments still PENDING M13.2; PesaPal still owner-SaaS-only; no hotel structures introduced inside POS. Locked rules preserved: byte-stable Branch (no Prisma `@relation` back-ref for `branchId`), Organization back-relation added (consistent with existing `apiKeys` line), no audit-log entries on read-only endpoints (HMS journal is the read trail), `/api/auth/me` untouched. Migration `20260508000000_bg7_hms_integration`. Seed marker `bg7-hms-integration`. e2e `bg7-hms-integration.e2e-spec.ts`: TBD pending run. Newman `BG7-HMS-Integration.postman_collection.json`: TBD pending run.


### BG6 — Unified Exports / Downloads Facade + AP Supplier Detail (2026-05-03) ✅

Five new endpoints close two BG0-surfaced gaps. Four endpoints under `/api/exports/*` introduce a normalisation-only "download centre" facade: `POST /` (delegates to `ReportsService.createExport` — today only `sourceDomain=reports` is POST-capable; documents are list/download-only), `GET /` (paginated, unified list across `ExportArtifact` + `Document` with filters `sourceDomain` / `format` / `requestedBy` / `status`), `GET /:id` (detail by composite id `<sourceDomain>:<underlyingId>`), `GET /:id/download` (streams the underlying file). The fifth endpoint `GET /api/accounting/ap/suppliers/:id` closes the missing AP supplier-detail route declared by BG0; returns supplier + roll-up summary + recent 10 bills + recent 10 payments. The single mutating route (`POST /api/exports`) wraps through `Bg3ReliabilityService.guard` with `category: null` (the facade *request* itself is metadata — downstream domain generators carry their own categorisation) and `idempotencyMode: 'optional'`. Reads have no BG3 wrap. **Schema is unchanged** — no migration, no tables, no columns, no enums; the unified `exportId` is encoded as `<sourceDomain>:<id>` so the download endpoint can route without storing a new column. Three new permissions seeded — `exports:read`, `exports:write`, `exports:download` — granted to **Owner / Manager / Accountant**; **Chef intentionally denied** across all four routes (verified by 4 × 403 in both e2e and Postman). Legacy `pos:reports:exports:read` / `pos:reports:exports:download` permissions left intact so direct callers of `/api/reports/export` keep working. Status mapping report→facade is `PENDING→QUEUED`, `READY→COMPLETED`, `FAILED→FAILED`; documents are always `COMPLETED`. e2e validation surfaced and fixed two production bugs in the new `getSupplierDetail`: (1) **Prisma pool exhaustion** on Neon free-tier — eight `Promise.all` queries serialised to sequential `await`s, mirroring the BG2/BG4.A precedent; (2) **invalid `VendorPaymentStatus` enum** — `paidAgg` filtered on non-existent `PAID`/`PARTIAL` members, corrected to `status: 'POSTED'` (the schema enum is `PENDING | POSTED | FAILED | CANCELLED`). Public diner payments still PENDING M13, PesaPal owner-SaaS-only, no hotel structures introduced. e2e `bg6-exports-and-downloads.e2e-spec.ts`: **17/17 passing**. Newman `BG6-Exports-And-Downloads.postman_collection.json`: **26 requests, 44/44 assertions, 0 failures**. Seed marker `bg6-exports-and-downloads-facade` recorded.

### BG5 — Device / Printer / Terminal Registry (2026-05-02) ✅

Ten new endpoints under `/api/devices/*` close the previously empty device-management gap: `POST /activate` (generic activation, idempotent on `activationCode`), `POST /kds/register` (KDS sugar over /activate), `GET /` (paginated list with `type/status/station` filters), `GET /:id` (detail; for PRINTER includes its routes), `GET /:id/history` (registry audit timeline), `PATCH /:id/status` (with RETIRED→other rejection 400 `DEVICE_STATUS_TRANSITION_INVALID`), `POST /printers/routes` (upsert keyed by composite `(branchId, routeType, station, printerId)`), `GET /printers/routes`, `POST /terminals/pair` (STUB pairing with `mode:'STUB'` — no live card-terminal driver invocation), `PATCH /terminals/:id/unpair` (idempotent — returns `TERMINAL_NOT_PAIRED` if already unpaired). All eight mutating endpoints wrap through `Bg3ReliabilityService.guard` with `category: null` (registry writes are configuration, not BILLING/ACCOUNTING/INVENTORY/PUBLIC_BOOKING/SYNC; M42 maintenance windows do not apply) and `idempotencyMode: 'optional'`. Additive schema only: 2 new tables (`devices`, `printer_routes`) + 3 new enums (migration `20260502000000_bg5_device_printer_terminal_registry`); FK constraints to `organizations`/`branches`/`devices` self-FK enforced at the DB layer only — no Prisma back-relations on `Branch` or `Organization`, preserving byte-stability per the BG1 Invitation precedent. Five new permissions seeded — `devices:read`, `devices:write`, `devices:status:write`, `devices:routes:write`, `devices:terminals:write` — granted to **Owner / Manager** in full; **Cashier / Waiter** receive `devices:read` only; **Chef intentionally denied** across all five (verified by 5 × 403 in both e2e and Postman). Eight new audit actions on `entityType:'device'`: `DEVICE_ACTIVATED`, `DEVICE_VIEWED`, `DEVICE_STATUS_CHANGED`, `KDS_DEVICE_REGISTERED`, `PRINTER_ROUTE_CONFIGURED`, `PRINTER_ROUTE_DISABLED`, `TERMINAL_PAIRED`, `TERMINAL_UNPAIRED`. Printer routing is configuration metadata only — no print driver invocation, no impact on existing KDS routing. Terminal pairing is STUB only — no live card-terminal driver invocation, no impact on the public diner mobile-money path (still PENDING M13) or PesaPal owner-SaaS billing. e2e `bg5-device-printer-terminal-registry.e2e-spec.ts`: **27/27 passing**. Newman `BG5-Device-Printer-Terminal-Registry.postman_collection.json`: **33 requests, 68/68 assertions, 0 failures**. Seed marker `bg5-device-printer-terminal-registry` recorded.postman_collection.json`)
- Total completion reports: 59 (added `ai/BG5_COMPLETION_REPORT.md`)

### BG5 — Device / Printer / Terminal Registry (2026-05-02) ✅

Ten new endpoints under `/api/devices/*` close the previously empty device-management gap: `POST /activate` (generic activation, idempotent on `activationCode`), `POST /kds/register` (KDS sugar over /activate), `GET /` (paginated list with `type/status/station` filters), `GET /:id` (detail; for PRINTER includes its routes), `GET /:id/history` (registry audit timeline), `PATCH /:id/status` (with RETIRED→other rejection 400 `DEVICE_STATUS_TRANSITION_INVALID`), `POST /printers/routes` (upsert keyed by composite `(branchId, routeType, station, printerId)`), `GET /printers/routes`, `POST /terminals/pair` (STUB pairing with `mode:'STUB'` — no live card-terminal driver invocation), `PATCH /terminals/:id/unpair` (idempotent — returns `TERMINAL_NOT_PAIRED` if already unpaired). All eight mutating endpoints wrap through `Bg3ReliabilityService.guard` with `category: null` (registry writes are configuration, not BILLING/ACCOUNTING/INVENTORY/PUBLIC_BOOKING/SYNC; M42 maintenance windows do not apply) and `idempotencyMode: 'optional'`. Additive schema only: 2 new tables (`devices`, `printer_routes`) + 3 new enums (migration `20260502000000_bg5_device_printer_terminal_registry`); FK constraints to `organizations`/`branches`/`devices` self-FK enforced at the DB layer only — no Prisma back-relations on `Branch` or `Organization`, preserving byte-stability per the BG1 Invitation precedent. Five new permissions seeded — `devices:read`, `devices:write`, `devices:status:write`, `devices:routes:write`, `devices:terminals:write` — granted to **Owner / Manager** in full; **Cashier / Waiter** receive `devices:read` only; **Chef intentionally denied** across all five (verified by 5 × 403 in both e2e and Postman). Eight new audit actions on `entityType:'device'`: `DEVICE_ACTIVATED`, `DEVICE_VIEWED`, `DEVICE_STATUS_CHANGED`, `KDS_DEVICE_REGISTERED`, `PRINTER_ROUTE_CONFIGURED`, `PRINTER_ROUTE_DISABLED`, `TERMINAL_PAIRED`, `TERMINAL_UNPAIRED`. Printer routing is configuration metadata only — no print driver invocation, no impact on existing KDS routing. Terminal pairing is STUB only — no live card-terminal driver invocation, no impact on the public diner mobile-money path (still PENDING M13) or PesaPal owner-SaaS billing. e2e `bg5-device-printer-terminal-registry.e2e-spec.ts`: **27/27 passing**. Newman `BG5-Device-Printer-Terminal-Registry.postman_collection.json`: **33 requests, 68/68 assertions, 0 failures**. Seed marker `bg5-device-printer-terminal-registry` recorded.

### BG4.B — POS Order Handoff (Split / Merge / Transfer / Move-Items) (2026-05-01) ✅

Six new endpoints under `/api/pos/orders/*` covering split-bill, split-items, merge, transfer-table, transfer-server, and move-items. All routes wrap through the existing `Bg3ReliabilityService.guard` facade with `category: null` (handoff is operational POS, not billing/accounting/inventory; M42 windows do not apply) and `idempotencyMode: 'optional'`. Additive schema only: 2 nullable self-FKs `Order.splitFromOrderId` / `Order.mergedIntoOrderId` + 2 indexes (migration `20260501000000_bg4b_pos_order_handoff`). Four new permissions seeded — `pos:order:split`, `pos:order:merge`, `pos:order:transfer`, `pos:order:move-items` — granted to Owner/Manager/Cashier; **Chef denied** across all four (verified by 4 × 403 in both e2e and Postman). Seven new audit actions (`ORDER_SPLIT_BILL`, `ORDER_SPLIT_ITEMS`, `ORDER_SPLIT_CHILD_CREATED`, `ORDER_MERGED`, `ORDER_TRANSFERRED_TABLE`, `ORDER_TRANSFERRED_SERVER`, `ORDER_ITEMS_MOVED`). KDS strategy: PRESERVE-AND-MARK source tickets; destination requires explicit `/send`. e2e `bg4b-pos-order-handoff.e2e-spec.ts`: 15/15 passing. Newman `BG4B-Pos-Order-Handoff.postman_collection.json`: 37 requests, 48/48 assertions, 0 failures.


can now (re)view, reprint, "send" (record-as-PENDING), and audit-history
any closed/voided order receipt. **No schema/migration change** — receipt
id is the order id, the printable view is composed from existing
`Order` / `OrderItem` / `Payment` / `Branch` / `Organization` /
`OrgSettings.receiptFooter` / `Table.label` / `User`, and history is
derived from `AuditLog` (entityType `receipt` for new actions + the
existing order-lifecycle rows on entityType `order`).

- **New endpoints (4)** under `/api/receipts`:
  - `GET /api/receipts/:id` — normalized receipt view: `receiptId`,
    `orderId`, `orderNumber`, `status`, `serviceType`, `branch`, `org`,
    `footer` (from `OrgSettings.receiptFooter`), `table`, `server`,
    `items[]`, `payments[]`, `totals { subtotal, tax, discount, total,
    paid, outstanding, currencyCode }`, `notes`, `history { viewed,
    reprintCount, sentCount, lastReprintAt, lastSentAt }`. Audits
    `RECEIPT_VIEWED` (fire-and-forget). Permission `pos:receipt:read`.
  - `GET /api/receipts/:id/history` — paginated audit timeline. Merges
    receipt-side rows (`entityType:'receipt'`) with order-lifecycle rows
    (`entityType:'order'`, `action ∈ { ORDER_PAID_AND_CLOSED,
    ORDER_AUTO_SETTLED, ORDER_VOIDED }`) so the cashier sees the full
    close → reprint → send trail in one query. `page` / `pageSize`
    (1–200). Permission `pos:receipt:read`.
  - `POST /api/receipts/:id/reprint` — wrapped via the BG3 facade
    (`Bg3ReliabilityService.guard({ scope:'receipts.reprint',
    category:null, idempotencyMode:'optional', fingerprintSource:{id,dto} })`).
    `Idempotency-Key` is **optional**; replay returns the cached body.
    Asserts the order is printable (`status ∈ { CLOSED, VOIDED }`).
    Audits `RECEIPT_REPRINTED`. Permission `pos:receipt:reprint`. Body
    `{ reason?, copies? (1–10) }`.
  - `POST /api/receipts/:id/send` — **202 Accepted, PENDING-only**.
    Wrapped via the BG3 facade (`scope:'receipts.send'`,
    `category:null`). Returns `{ status:'PENDING', supported:false,
    reason:'NO_LIVE_DELIVERY_ADAPTER', deliveryId, channel,
    recipient (masked), action:'RECEIPT_SENT', requestedAt }`. **No real
    outbound email/SMS/WhatsApp delivery occurs this milestone**;
    integration with a live delivery adapter is intentionally deferred.
    Idempotency-Key replay returns the same `deliveryId`. Permission
    `pos:receipt:send`. Body `{ channel ∈ { email, sms, whatsapp },
    recipient, locale?, note? }`.
- **Audit actions added**: `RECEIPT_VIEWED`, `RECEIPT_REPRINTED`,
  `RECEIPT_SENT` (all on `entityType:'receipt'`, `entityId == orderId`).
- **Permissions seeded**: `pos:receipt:read`, `pos:receipt:reprint`,
  `pos:receipt:send` — granted to **Owner / Manager / Cashier / Waiter**
  in `ROLE_PERM_MATRIX`. **Chef intentionally denied** (verifies role
  gating still enforces 403 at every entry point).
- **Locked rules preserved**:
  - No schema/migration change; receipt id == order id.
  - `/api/auth/me` remains canonical.
  - PIN-first frontline rules intact.
  - PesaPal still owner-SaaS only; public diner payments still PENDING
    the MTN/Airtel work (out of scope here).
  - BG3 idempotency facade is **reused** (not parallelised). Reprint
    and send wrap through `Bg3ReliabilityService.guard()` with
    `category: null` because both endpoints are read/notify-only — no
    new billing mutation occurs, so M42 maintenance windows do not
    block them. Existing BG3 contracts (idempotency replay,
    `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`) still apply when an
    `Idempotency-Key` is supplied.
  - No hotel structures.
- **Validation**:
  - **e2e**: `apps/api/test/bg4-receipts-surface.e2e-spec.ts` —
    **12 / 12 passing** (~157s). Covers GET (200 / chef 403 / 404),
    reprint (200 + audit row + idempotency replay + chef 403), send
    (202 PENDING + 400 unknown channel + idempotency replay
    matching `deliveryId` + chef 403), history (read + pagination).
  - **Postman**: `postman/collections/BG4-Receipts-Surface.postman_collection.json`
    — newman: **19 requests, 37 / 37 assertions, 0 failures** (~2m 21s).
    Folders: `00 Read Me`, `A. Auth & Context Baseline`, `B. Receipt
    Read & History`, `C. Receipt Reprint`, `D. Receipt Send (PENDING —
    no live adapter)`, `E. Permission Denial — Chef`, `F. Edge Cases`.
  - **TypeScript**: `pnpm exec tsc --noEmit` from `apps/api` — clean for
    BG4 files (only the pre-existing `accounts-receivable.service.spec.ts`
    diagnostics from BG2/BG3 remain; not touched by BG4).
- **Files added**:
  - `apps/api/src/modules/receipts/dto/send-receipt.dto.ts`
  - `apps/api/src/modules/receipts/dto/reprint-receipt.dto.ts`
  - `apps/api/src/modules/receipts/dto/receipt-history-query.dto.ts`
  - `apps/api/src/modules/receipts/dto/index.ts`
  - `apps/api/src/modules/receipts/receipts.service.ts`
  - `apps/api/src/modules/receipts/receipts.controller.ts`
  - `apps/api/src/modules/receipts/receipts.module.ts`
  - `apps/api/test/bg4-receipts-surface.e2e-spec.ts`
  - `postman/collections/BG4-Receipts-Surface.postman_collection.json`
  - `ai/BG4_COMPLETION_REPORT.md`
- **Files modified**:
  - `apps/api/src/app.module.ts` — registered `ReceiptsModule`.
  - `packages/db/prisma/seed.ts` — added 3 perms, role grants for
    Owner/Manager/Cashier/Waiter, `recordSeedRun('bg4a-receipts-surface', ...)`
    marker.
- **Known caveats**:
  - The 10 small reads inside `ReceiptsService.buildReceiptView` are
    **serialised** (not `Promise.all`'d) to keep the Prisma connection
    pool healthy under concurrent receipt traffic — same pattern BG2
    settled on for `UnifiedApprovalsService.list`.
  - `POST /api/receipts/:id/send` is **PENDING-only** by design this
    milestone. The `deliveryId` is generated, the request is audited
    (`RECEIPT_SENT` with `metadata.status:'PENDING'`,
    `supported:false`, `reason:'NO_LIVE_DELIVERY_ADAPTER'`), and 202 is
    returned, but **no live email/SMS/WhatsApp adapter is wired**. A
    future milestone may swap `supported:false` for `true` when an
    adapter ships.
  - **BG4.B (POS Order Handoff: split-bill / split-items / merge /
    transfer-table / transfer-server / move-items) is deferred to the
    next prompt** per user direction. BG4 was scope-split because the
    handoff surface alone needs ~6 endpoints + careful permission
    matrix + KOT republish semantics + e2e + Postman, and combining it
    with receipts in a single prompt risked regressing the BG3 facade
    or M42 contracts.

### BG0 — Route Verification + Contract Cleanup (2026-04-29) ✅

Pre-frontend gate. Code-first verification pass against every unresolved
M0–M42 row. No code or migration changes; classification + handoff only.

- **Scope**: classified 42 report-only rows + 11 postman-only rows from
  `ai/nimbus_route_verification_checklist_m0_m42.csv` against live NestJS
  source under `apps/api/src/modules/`.
- **Method**: enumerated every `@Controller(...)` prefix and every
  `@Get/@Post/@Patch/@Put/@Delete/@Sse(...)` decorator across all 46
  controllers; cross-checked against all 48 Postman collections (363
  unique normalized `/api/*` paths). Source-of-truth order: code > Postman
  > completion reports.
- **Classification counts (53 rows total)**:
  - `VERIFIED_IN_CODE`: **31** (27 report-only + 4 owner-SaaS PesaPal)
  - `INTENTIONALLY_REMOVED_OR_SUPERSEDED`: **15** (14 doc shorthand/typo
    + 1 legacy `/api/me`)
  - `MISSING_IMPLEMENT`: **1** (`GET /api/accounting/ap/suppliers/:id`)
  - `DEV_OR_INTERNAL_ONLY`: **2** (`/api/auth/_perm-test`,
    `/api/branch-test`)
  - `BLOCKED_PENDING_PROVIDER`: **5** (all `/api/public/payments/*`)
- **Canonical context route**: `GET /api/auth/me` for every authenticated
  frontend shell. `GET /api/me` is **superseded** (kept in code for
  backwards compat, must not be bound by any new frontend screen).
- **Locked rules confirmed**:
  - `/api/public/payments/*` remain CRITICAL — pending MTN/Airtel
    provider confirmation; controller doc-comment in
    `public-commerce-payments.controller.ts` already enforces the
    "SCAFFOLD ONLY (NOT LIVE) … not PesaPal" wording.
  - `/api/billing/pesapal/*` are LIVE for **owner SaaS subscription
    billing only**; never for public diner flows.
  - No hotel / property-group concept reintroduced.
- **Backend gate for frontend assignment**: **OPEN**. 47 of 53 rows are
  frontend-ready. The 5 pending-provider and 2 dev-only rows are
  excluded from any component-to-API mapping. The 1 missing supplier
  detail GET is non-blocking (frontend may use list+filter until
  implemented).
- **Remaining gap groups** (per `ai/nimbus_backend_gap_fix_prompts.md`):
  - **BG1** Invitation Acceptance + Password Lifecycle + Frontline Staff
    Onboarding ✅ (2026-04-30)
  - **BG2** Unified Approvals Inbox + Global Audit Timeline ✅ (2026-04-30)
  - **BG3** Reliability Rollout (Idempotency + Maintenance/Training
    adoption across more write surfaces) ✅ (2026-04-30)
  - **BG4.A** Receipts Surface (View / Reprint / Send / History) ✅ (2026-05-01)
  - **BG4.B** POS Order Handoff Operations (split-bill / split-items /
    merge / transfer-table / transfer-server / move-items) — **next**
  - **BG5** Device / Printer / Terminal Registry
  - **BG6** Export / Download Consistency
- **Files updated**:
  - `ai/nimbus_route_verification_checklist_m0_m42.csv` — replaced with
    final 12-column classification schema (53 rows).
  - `ai/AI_STATUS.md` — this entry.
  - `ai/BG0_ROUTE_VERIFICATION_COMPLETION_REPORT.md` — new.
- **Files NOT changed**: no code, no Postman JSON, no migration, no
  seed. BG0 is verification-only; downstream BG1–BG6 will edit code.

### BG2 — Unified Approvals Inbox + Global Audit Timeline (2026-04-30) ✅

Manager-facing aggregator over all approval-bearing workflows + a global,
filterable audit timeline. **No schema / migration change** — both modules
are pure read/decide aggregators over existing rows.

- **New endpoints**:
  - `GET /api/approvals` — unified inbox across 6 wired sources
    (`discount`, `refund`, `leave_request`, `shift_swap`, `vendor_bill`,
    `inter_branch_transfer`). Filters: `status`, `sourceType`, `domain`,
    `branchId`, `dateFrom`, `dateTo`, `page`, `pageSize`. Permission
    `approvals:read`. Response includes `data[]`, `total`, `page`,
    `pageSize`, `filters`, `registry.wiredSources`.
  - `GET /api/approvals/:id` — unified detail. Approval ID format
    `${sourceType}--${entityId}` (cuid IDs never contain `--`). Returns
    `{ id, sourceType, sourceEntityId, summary, source }`. Permission
    `approvals:read`.
  - `POST /api/approvals/:id/decide` — approve / reject. Routes to the
    underlying domain service. Permission `approvals:decide`. Returns
    `{ ok, approvalId, source, decision, finalStatus, decidedById,
    decidedAt, reason, underlying }`. **REJECT not supported by `refund`
    or `vendor_bill`** (returns 400 with explicit message — these
    domains intentionally have no reject path).
  - `GET /api/audit/timeline` — global audit timeline read view. Filters:
    `entityType`, `entityId`, `userId`, `action`, `actionPrefix`,
    `dateFrom`, `dateTo`, `orgId`, `branchId`, `page`, `pageSize`
    (1–200). Permission `audit:read`. Defaults `orgId` to caller's org;
    org/branch are filtered via JSON path on `AuditLog.metadata`
    (no schema change). Each row exposes `sourceModule` derived from the
    action string.
- **Audit actions added**: `UNIFIED_APPROVAL_VIEWED` (inbox read,
  fire-and-forget), `UNIFIED_APPROVAL_DECIDED` (decision write).
- **Permissions seeded**: `approvals:read`, `approvals:decide`,
  `audit:read` — all granted to **Owner** and **Manager** roles in
  `ROLE_PERM_MATRIX`. Frontline roles (Waiter/Cashier/Chef/Bartender/
  Stock Manager) are **denied** all three.
- **Locked rules preserved**: no schema/migration change; no new Prisma
  model; `/api/auth/me` remains canonical; PIN-first frontline rules
  intact (chef test asserts 403 on the inbox + timeline); PesaPal still
  owner-SaaS-only; public diner payments still pending; no hotel
  structures.
- **Validation**:
  - **e2e**: `apps/api/test/bg2-approvals-and-audit.e2e-spec.ts` —
    **15 / 15 passing** (339s). Covers list pagination + filter + 400 +
    chef 403, detail 200 / 400 / 404, decide REJECT 200 + 409 repeat +
    400 missing decision, decide APPROVE 200 + chef 403, audit timeline
    actionPrefix + exact action + chef 403.
  - **Postman**: `postman/collections/BG2-Unified-Approvals-And-Audit-Timeline.postman_collection.json`
    — newman: **22 requests, 48 / 48 assertions, 0 failures** (1m 52s).
  - **TypeScript**: `pnpm exec tsc --noEmit` — clean for BG2 files
    (only the pre-existing `accounts-receivable.service.spec.ts`
    diagnostics remain; not touched by BG2).
- **Files added**:
  - `apps/api/src/modules/unified-approvals/approval-source.types.ts`
  - `apps/api/src/modules/unified-approvals/dto/{list-approvals,decide-approval,index}.dto.ts`
  - `apps/api/src/modules/unified-approvals/{approval-routing,unified-approvals}.service.ts`
  - `apps/api/src/modules/unified-approvals/unified-approvals.controller.ts`
  - `apps/api/src/modules/unified-approvals/unified-approvals.module.ts`
  - `apps/api/src/modules/audit-timeline/dto/audit-timeline-query.dto.ts`
  - `apps/api/src/modules/audit-timeline/dto/index.ts`
  - `apps/api/src/modules/audit-timeline/audit-timeline.service.ts`
  - `apps/api/src/modules/audit-timeline/audit-timeline.controller.ts`
  - `apps/api/src/modules/audit-timeline/audit-timeline.module.ts`
  - `apps/api/test/bg2-approvals-and-audit.e2e-spec.ts`
  - `postman/collections/BG2-Unified-Approvals-And-Audit-Timeline.postman_collection.json`
  - `ai/BG2_COMPLETION_REPORT.md`
- **Files modified**:
  - `apps/api/src/app.module.ts` — registered `UnifiedApprovalsModule` +
    `AuditTimelineModule`.
  - `packages/db/prisma/seed.ts` — added 3 perms, role grants,
    `recordSeedRun('bg2-unified-approvals-and-audit-timeline', ...)`
    marker.
- **Known caveats**:
  - Audit org/branch filtering uses JSON path on `metadata.orgId` /
    `metadata.branchId` (Prisma `JsonFilter` `path: ['orgId']`). Rows
    written before BG2 that did not include these keys in `metadata`
    will not appear when `orgId`/`branchId` filters are applied. All
    new BG2-emitted audit rows include both keys.
  - Per-source list fetches are **serialised** (not parallel) inside
    `UnifiedApprovalsService.list` to keep the Prisma connection pool
    healthy under concurrent inbox reads — six small queries in series
    is still well under 1s in practice.
  - REJECT is intentionally unavailable for `refund` and `vendor_bill`
    (the underlying domain services do not expose a reject path);
    surfaced as a clean 400 with an explicit message. APPROVE works for
    all six sources.

### BG1.1 — Frontline Quick PIN Admin + PIN-First Login Refinement (2026-04-30) ✅

Refines BG1 so frontline staff (waiters, cashiers, chefs, bartenders, stock
staff) are PIN-first by default and gives managers safe Quick PIN admin
tools. **No schema/migration change** — synthetic email
`pin-{hex}@nimbus.pin.local` is used internally for PIN-only users and
detected via `FrontlineStaffOnboardingService.isSyntheticEmail()`.

- **Frontline onboard (`POST /api/hr/frontline-staff/onboard`) refined**:
  - Phone + name are now the **primary identity**; `email` is **optional**.
  - PIN-only by default for eligible roles (Waiter, Cashier, Bartender,
    Chef, Stock Manager). Password login is opt-in via
    `enablePasswordLogin: true` (requires `email` + `temporaryPassword`).
  - Response now exposes `authMode` (`PIN_ONLY` | `PIN_PLUS_PASSWORD` |
    `PASSWORD_ONLY`), `user.hasSyntheticEmail`, `branchAccess.branchName`,
    `passwordLogin.enabled`, `quickPin.shownOnce=true`,
    `onboardingInstructions[]`. `mustChangePassword` is `false` in
    PIN-only mode and `true` only when the manager explicitly issues a
    temporary password.
- **Manager Quick PIN admin** (new endpoints under
  `/api/hr/frontline-staff/:id`):
  - `GET .../quick-pin-status` (perm `auth:quick-pin:read`) — returns
    `pinEnabled`, `pinExists`, `pinTier`, `pinLength`,
    `failedPinAttempts`, `isLocked`, `lockedUntil`, `eligibleForPin`,
    `hasPasswordLogin`, `mustChangePassword`, `authMode`. **Never**
    leaks the stored PIN, hash, or lookup hash.
  - `POST .../quick-pin/reset` (perm `auth:quick-pin:write`) — auto-issues
    on first reset; returns the rotated PIN **once**; invalidates the
    prior PIN immediately.
  - `PATCH .../quick-pin/disable` (perm `auth:quick-pin:write`) —
    idempotent (`alreadyDisabled` flag); blocks subsequent
    `/api/auth/quick-pin-login`.
  - `PATCH .../quick-pin/enable` (perm `auth:quick-pin:write`) —
    409 if no `quickPinHash` ever issued; idempotent on already-enabled.
- **Tier policy** (`apps/api/src/modules/auth/quick-pin.constants.ts`):
  Chef and Stock Manager moved from EXCLUDED to LOW_TIER_ROLES;
  helpers `FRONTLINE_PIN_FIRST_ROLES` + `isFrontlinePinFirstRole(jobRole)`
  added. EXCLUDED now {OWNER, ACCOUNTANT, PROCUREMENT, EVENT_MANAGER}.
- **Permissions added** (seed): `auth:quick-pin:read`,
  `auth:quick-pin:write`. Granted to Owner + Manager via
  `ROLE_PERM_MATRIX`. SeedHistory marker:
  `bg1.1-frontline-quick-pin-admin`.
- **Audit**: existing `QUICK_PIN_RESET|DISABLED|ENABLED` reused; new
  `QUICK_PIN_STATUS_VIEWED` recorded on every status read.
- **Locked rules preserved**:
  - `/api/auth/me` remains canonical (R14).
  - `/api/auth/login` keeps `[200, 201]` accept rule (R12).
  - `/api/public/payments/*` SCAFFOLD-ONLY (MTN/Airtel pending).
  - `/api/billing/pesapal/*` owner-SaaS-only.
  - All BG1 invitation/password lifecycle behavior unchanged.
- **Tests**: `apps/api/test/bg1.1-frontline-pin-admin.e2e-spec.ts` —
  **14/14 pass** in 152s against the live Neon DB. BG1 suite still
  **14/14 pass** (patched two onboard payloads with
  `enablePasswordLogin: true` for backward compat). Combined: **28/28**.
- **Postman**: `BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`
  extended with two new folders — `F. BG1.1 Frontline PIN-only Onboarding
  + Quick PIN Admin [STANDALONE]` (10 requests: PIN-only onboard, status,
  reset, old-PIN-fails, disable, idempotent disable, login-while-disabled
  401, enable, missing-phone 400) and `G. BG1.1 Quick PIN Login Handoff
  [STANDALONE]` (login via `/api/auth/quick-pin-login` then
  `/api/auth/me`). Newman: **31 requests, 75 assertions, 0 failures**.
- **Files added**: `apps/api/src/modules/hr/frontline-staff-quick-pin.service.ts`,
  `apps/api/src/modules/hr/dto/frontline-quick-pin-reset.dto.ts`,
  `apps/api/test/bg1.1-frontline-pin-admin.e2e-spec.ts`,
  `ai/BG1_1_COMPLETION_REPORT.md`.
- **Files modified**: `apps/api/src/modules/auth/quick-pin.constants.ts`,
  `apps/api/src/modules/hr/frontline-staff-onboarding.service.ts`,
  `apps/api/src/modules/hr/dto/{frontline-staff-onboard.dto,index}.ts`,
  `apps/api/src/modules/hr/{hr.module,hr.controller}.ts`,
  `packages/db/prisma/seed.ts`,
  `apps/api/test/bg1-onboarding.e2e-spec.ts`,
  `postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`.
- **Items still pending and not changed by BG1.1**: public diner
  mobile-money payments remain blocked on MTN / Airtel provider
  confirmation (M13.1 code complete, M13.2 not started). Next milestone
  is **BG2 — Unified Approvals Inbox + Global Audit Timeline**.

### BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding (2026-04-30) ✅

Closes the invited-user lifecycle gap and removes the cross-module
choreography the frontend used to need for normal staff onboarding.
The frontend can now create a frontline cashier (User + UserRole +
Membership + Employee + optional Quick PIN) in a single POST.

- **Schema** (migration `20260430000000_bg1_invitation_password_lifecycle`,
  48th migration): adds `User.mustChangePassword Boolean @default(false)`;
  new model `Invitation` (id, organizationId, branchId, roleId, email,
  firstName?, lastName?, `tokenHash` UNIQUE, `status` enum, `expiresAt`,
  acceptedAt/By, revokedAt/By/Reason, resendCount, lastResentAt,
  invitedById, membershipId?, userId?, metadata Json?); new model
  `PasswordResetToken` (userId, `tokenHash` UNIQUE, `purpose` enum,
  expiresAt, consumedAt, invalidatedAt, ipAddress, userAgent, metadata).
  Two enums: `InvitationStatus` (PENDING / ACCEPTED / REVOKED / EXPIRED),
  `PasswordResetPurpose` (FORGOT_PASSWORD / INVITATION_FIRST_LOGIN /
  FORCE_RESET_BY_ADMIN). FK enforcement is app-layer only — no
  back-relations on User/Org/Branch/Role models.
- **Endpoints** (all `/api/...`):
  - `POST /api/auth/invitations/accept` — public; SHA-256 hashes the
    plaintext token, validates state machine, sets the user's password
    in a `$transaction`, marks invitation `ACCEPTED`, invalidates any
    outstanding `INVITATION_FIRST_LOGIN` tokens. Returns
    `{ ok, invitationId, userId, organizationId, branchId, nextStep:'login' }`.
  - `POST /api/auth/forgot-password` — public; anti-enumeration generic
    `{ ok: true }` always. When the email matches a user, a
    `prt_<hex>` token is created (60-min TTL) and is exposed in the
    response body **only** when `NODE_ENV !== 'production'` or
    `NIMBUS_EXPOSE_RESET_TOKENS=true` (dev-mode mailer hook).
  - `POST /api/auth/reset-password` — public; validates token state,
    rotates the user's password, marks the token consumed, and
    **revokes every active session and refresh token** for the user.
  - `POST /api/auth/force-password-change` — JWT-guarded; requires
    matching current password, enforces new ≠ current, clears
    `mustChangePassword`.
  - `POST /api/onboarding/invitations/:id/resend` — `onboarding:invitation:write`;
    rotates the token, extends `expiresAt`, increments `resendCount`,
    bumps `lastResentAt`.
  - `PATCH /api/onboarding/invitations/:id/revoke` — `onboarding:invitation:write`;
    sets status `REVOKED` + `revokedReason`. Idempotent on already-revoked.
    Rejects ACCEPTED with 409.
  - `POST /api/hr/frontline-staff/onboard` — `hr:frontline-staff:create`;
    one-call orchestration. Creates / reuses User (sets
    `mustChangePassword=true`), idempotent UserRole, Membership
    (`isDefaultBranch=true` if new user), Employee linked to userId — all
    in `prisma.$transaction`. Post-commit, optionally calls
    `QuickPinService.issueQuickPin` for eligible job roles. Returns
    `{ ok, user{...mustChangePassword,wasNewUser}, membership, employee,
    quickPin{issued, pin?, tier?, pinLength?}, firstLoginHint }`.
- **Services** (under `apps/api/src/modules/auth/` and `.../hr/`):
  - `InvitationLifecycleService.accept(dto, meta)` — single source of
    truth for accept-state-machine + password set.
  - `PasswordLifecycleService` — `forgotPassword`, `resetPassword`,
    `forcePasswordChange`. SALT_ROUNDS=12, RESET_TTL_MINUTES=60.
  - `FrontlineStaffOnboardingService.onboard(actorUserId, ctx, dto, meta)`
    — orchestrator; rejects when no branch context (400), duplicate
    email + role + branch combo (409), unknown role / position /
    compensation profile / employee code collision.
  - `ClientOnboardingService.inviteOne` refactored: persists an
    `Invitation` row with hashed token (plaintext returned ONCE to the
    inviter); also exposes `resendInvitation`, `revokeInvitation`.
- **Permissions added** (seed): `onboarding:invitation:write`,
  `hr:frontline-staff:create`. Granted to Owner + Manager via
  `ROLE_PERM_MATRIX`. SeedHistory marker:
  `bg1-invitation-password-frontline`.
- **Tokens**: plaintext `inv_<hex32>` and `prt_<hex48>`; only the SHA-256
  digest is stored. INVITATION_TTL_DAYS=14, RESET_TTL_MINUTES=60.
- **Locked rules preserved**:
  - `/api/auth/me` remains the canonical context route (R14). BG1 adds no
    competing endpoint.
  - `/api/auth/login` keeps its `[200, 201]` accept rule (R12); the BG1
    e2e and Postman both honor it.
  - No hotel / property-group concept introduced.
  - `/api/public/payments/*` still SCAFFOLD-ONLY pending MTN/Airtel.
  - `/api/billing/pesapal/*` remains owner-SaaS-only.
- **Tests**: `apps/api/test/bg1-onboarding.e2e-spec.ts` — **14/14 pass**
  in 134s against the live Neon DB (invitation create / resend /
  accept / re-accept 409 / accepted-user login / revoke-after-accept
  409 / forgot unknown / forgot known / reset / re-reset 409 / frontline
  onboard with PIN / onboarded login / force-change / no-branch 400).
- **Postman**: `BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`
  — 5 functional folders (`A. Auth & Context Baseline`, `B. Invitation
  Lifecycle`, `C. Password Lifecycle`, `D. Frontline Staff Onboarding`,
  `E. Login + /api/auth/me Handoff`) + `00 Read Me`. Newman: **20
  requests, 41 assertions, 0 failures**. R1–R20 compliant
  (collection-level pre-request, dual-scope variable writes,
  `[STANDALONE]` labels, Login asserts `[200, 201]`).
- **Files added**: 4 new service/DTO files, 1 e2e spec, 1 Postman
  collection, 1 migration, 1 completion report
  (`ai/BG1_COMPLETION_REPORT.md`).
- **Files modified**: `packages/db/prisma/schema.prisma`,
  `packages/db/prisma/seed.ts`, `apps/api/src/modules/auth/{auth.module,auth.controller,dto/index}.ts`,
  `apps/api/src/modules/client-onboarding/{client-onboarding.service,client-onboarding.controller,dto/index}.ts`,
  `apps/api/src/modules/hr/{hr.module,hr.controller,dto/index}.ts`.

### M42 — Feature Flags + Maintenance Windows + Training Mode (2026-04-29)

Cross-cutting control plane. Lets the org owner toggle features at runtime,
schedule and (optionally) enforce maintenance windows that pause specific
write categories, and run actor-bound training sessions whose writes never
persist real domain rows. Inventory is the first integration target;
the `ControlPlaneService` facade is reusable from any other write surface.

- **Module**: `apps/api/src/modules/controlplane/` — `ControlPlaneModule`,
  `ControlPlaneController`, `ControlPlaneService` (facade),
  `FeatureFlagService`, `MaintenanceWindowService`, `TrainingSessionService`,
  `FlagAuditService`, DTOs.
- **Endpoints** (all `/api/...`, JWT-guarded, RBAC-checked):
  - `GET|POST /flags`, `GET|PATCH /flags/:key`, `GET /flags/audit`
  - `GET|POST /maintenance-windows`, `GET|PATCH /maintenance-windows/:id`
  - `POST /training/start`, `POST /training/:id/end`,
    `GET /training/sessions`
- **Schema**: 4 models (`FeatureFlag`, `MaintenanceWindow`,
  `TrainingSession`, `FlagAudit`) + 7 enums (`FeatureFlagScope`,
  `FeatureFlagStatus`, `MaintenanceWindowStatus`, `MaintenanceWindowMode`,
  `WriteBlockCategory`, `TrainingSessionMode`, `TrainingSessionStatus`,
  `FlagAuditAction`); flag precedence is BRANCH > ORG > GLOBAL.
- **Permissions**: `flags:read`, `flags:write`, `flags:audit:read`,
  `maintenance:read`, `maintenance:write`, `training:session:start`,
  `training:session:read`, `training:session:end`. Owner has all 8;
  Manager has 5 (no flag mutations / audit / write windows); Accountant has 3
  read-only.
- **`ControlPlaneService` facade** (the public reuse surface):
  - `assertWriteAllowed({ orgId, branchId, actorUserId, category, operation })`
    throws `409 Conflict` (`MAINTENANCE_WINDOW_ACTIVE`) when an ACTIVE
    `BLOCK_WRITES` window currently covers the category. The block is
    audit-logged via `FLAG_AUDIT.WRITE_BLOCKED_BY_MAINTENANCE`.
  - `checkTrainingMode(orgId, actorUserId, sessionId, operation)` returns a
    short-circuit `{ inTraining: true, simulated: true, sessionId, mode,
    label, ... }` when the actor presents a valid ACTIVE non-expired session
    id via the request `x-training-session-id` header. Auto-EXPIRES rows past
    `expiresAt`. Audit-logged via `FLAG_AUDIT.REAL_POST_BLOCKED_BY_TRAINING`.
- **Inventory integration**: `InventoryService.createStockAdjustment` now
  calls `assertWriteAllowed({ category: 'INVENTORY_WRITES', ... })` first and
  then `checkTrainingMode(...)`; when training is active, no `StockBatch`,
  `StockAdjustment`, or `AuditLog` row is persisted and the response carries
  the simulated payload + the original request body. The
  `x-training-session-id` request header is the new opt-in convention.
- **Locked business rules enforced**:
  - Training mode never persists real accounting/inventory rows (verified by
    e2e — adjustment count unchanged after the simulated POST).
  - Maintenance windows are opt-in (`SCHEDULED` is non-blocking; only
    `ACTIVE` + `BLOCK_WRITES` + matching `blockCategories` blocks writes).
  - The seeded `m42-seed-quarterly-maintenance` window ships as
    `SCHEDULED` + `ANNOUNCEMENT_ONLY` so existing tests are unaffected.
  - No hotel / property-group concept is introduced.
  - Public diner mobile-money payment execution remains PENDING; M42 adds no
    handler for it.
- **Tests**: `apps/api/test/control-plane.e2e-spec.ts` — 11/11 pass (flag
  list / create+audit / patch+audit / chef 403 read / chef 403 write /
  window create / window ACTIVE blocks 409 / window COMPLETED unblocks 201 /
  training start + concurrent 403 / training short-circuit + zero-row /
  training end). `inventory.service.spec.ts` updated to mock the new
  `ControlPlaneService` dependency — all 17 unit cases still green.
- **Postman**: 7 folders (`00 Read Me`, `A. Auth & Context`,
  `B. Feature Flags`, `C. Maintenance Windows`, `D. Training Sessions`,
  `E. Guarded Write Examples`, `F. Flag Audit`); R1-R20-compliant with
  collection-level pre-request that auto-resolves token, `orgId`/`branchId`,
  `inventoryItemId` (R17 list-first), and rotates `flagKey` / `windowCode`
  on each cold run.
- **Seed**: `seedControlPlaneData()` creates 5 feature flags
  (`alerts_owner_live_beta`, `public_booking_beta`,
  `franchise_analytics_beta`, `training_mode_enabled`,
  `maintenance_write_blocking_enabled`), one SCHEDULED ANNOUNCEMENT_ONLY
  maintenance window (`m42-seed-quarterly-maintenance`), one COMPLETED
  training session, and one `FLAG_ENABLED` audit row. Idempotent on second
  run (Created: 0, Skipped: 8). Recorded via `SeedHistory` marker
  `m42-control-plane`.



### M41 — Reliability Layer: Idempotency + Offline Contracts + Sync (2026-04-28)

Generic reliability primitive. Lays the server foundation for offline-safe
writes from a future service worker without committing to per-feature handlers
in this milestone.

- **Module**: `apps/api/src/modules/reliability/` — `ReliabilityModule`,
  `ReliabilityController`, `SyncService`, `IdempotencyService`,
  `ReplayDispatcherService`, DTOs.
- **Endpoints** (all `/api/...`, JWT-guarded, RBAC-checked):
  - `POST /sync/replay` — submit a batch of captured offline write intents
  - `GET /sync/jobs`, `GET /sync/jobs/:id`
  - `POST /sync/jobs/:id/retry` — 409 if already SUCCEEDED
  - `GET /sync/conflicts`
  - `PATCH /sync/conflicts/:id/resolve` — `SERVER_TRUTH_KEPT` /
    `CLIENT_PAYLOAD_APPLIED` / `MANUAL_MERGE` / `DISCARDED`
  - `POST /idempotency/inspect` — debug primitive
- **Schema**: 4 models (`IdempotencyKey`, `SyncJob`, `SyncJobAttempt`,
  `SyncConflict`) + 7 enums; `(orgId, clientMutationId)` is the dedup key;
  `(scope, key, routeMethod, routePath)` uniqueness on idempotency keys.
- **Permissions**: `sync:jobs:read`, `sync:jobs:write`, `sync:jobs:retry`,
  `sync:conflicts:read`, `sync:conflicts:resolve`, `idempotency:inspect`.
  Owner has all six; Manager has all except `idempotency:inspect`; Accountant
  has read-only on jobs and conflicts.
- **Replay dispatcher**: type-keyed registry. Built-in `GENERIC_REPLAY` echo
  handler. Other types (`PAYMENT_CAPTURE`, `RESERVATION_CONFIRM`, etc.) are
  RESERVED — their owning milestones register handlers via
  `ReplayDispatcherService.register()`. Public-diner mobile-money is
  deliberately NOT registered.
- **Tests**: `apps/api/test/sync.e2e-spec.ts` — 8/8 pass (replay + dedup +
  list + 409 retry + 400 + 403 + conflicts list + resolve).
- **Postman**: 6 folders ([STANDALONE] R1-R20-compliant); folder D and E and F
  carry folder-level prereq scripts for cold-session id auto-resolution.
- **Docs**: new `docs/SYNC_CONTRACT.md` is the canonical contract for future
  service-worker clients.
- **Seed**: `seedReliabilityData()` creates one `IdempotencyKey` (SUCCEEDED),
  three `SyncJob` rows (SUCCEEDED / RETRYABLE / CONFLICT) and one open
  `SyncConflict`. Idempotent on second run.



### M40 — Alerts + Digests + Real-Time Owner Views (2026-04-26)

First post-M39 feature milestone. Adds an org-scoped alerting plane over the
data flowing through M9 (inventory), M15 (shifts), M16 (reservations), M34
(AP), M39.1 (SaaS billing), and the audit log, plus a real-time owner feed.

- **Module**: `apps/api/src/modules/alerts/` — `AlertsModule`,
  `AlertsController`, `AlertsService`, `ChannelDispatcherService`,
  `DigestService`, `OwnerLiveService`, `SourceSignalService`, DTOs.
- **Endpoints** (all `/api/...`, JWT-guarded, RBAC-checked):
  - `GET /alerts` — overview (rules + channels + recent deliveries)
  - `GET|POST /alerts/rules`, `PATCH /alerts/rules/:id`
  - `GET|POST /alerts/channels`, `PATCH /alerts/channels/:id`
  - `POST /alerts/test` — synchronous probe with optional `forceFailure`
  - `GET /alerts/deliveries`, `POST /alerts/deliveries/:id/retry`
  - `GET|POST /alerts/digests`, `PATCH /alerts/digests/:id`,
    `POST /alerts/digests/:id/run`
  - `GET /owner/live`
- **Schema** (already on disk via migration
  `20260416000000_m40_alerts_digests_owner_live`): `AlertRule`,
  `AlertChannel`, `AlertDelivery`, `DigestSchedule`, `OwnerLiveEvent`
  with the supporting enums and `@@unique([orgId, code])` constraints.
- **Locked business rules enforced**:
  - Owner SaaS billing payment-failure alerts are LIVE
    (`SourceSignalService.evaluateBillingPaymentFailures` watches only
    `Subscription` rows in `PAST_DUE` / `GRACE_PERIOD`).
  - Public diner mobile-money payment-execution alerts are NOT wired —
    `evaluatePublicDinerPaymentFailures()` returns `[]` and
    `OwnerLiveService` advertises this in `notes.publicDinerPaymentExecution`.
  - No hotel / property-group concept is introduced.
- **Channel dispatcher**: deterministic dev/mock fallback when env
  credentials (`SMTP_*`, `SMS_PROVIDER_API_KEY`, `SLACK_WEBHOOK_URL`)
  are absent, so seed + tests + Newman all run without external
  dependencies. `forceFailure: true` is the e2e+Postman path that
  exercises the retry pipeline.
- **Permissions**: 10 new entries in `PERMISSIONS_DATA` —
  `alerts:read`, `alerts:rule:write`, `alerts:channel:read`,
  `alerts:channel:write`, `alerts:test`, `alerts:delivery:read`,
  `alerts:delivery:retry`, `alerts:digest:read`,
  `alerts:digest:write`, `owner:live:read`. Owner gets all 10;
  Manager gets 8 (no `alerts:channel:write`, no `owner:live:read`);
  Accountant gets 4 read-only.
- **Seed**: `seedAlertsData()` resolves the org via `owner@demo.local`'s
  first ACTIVE membership (so it always lands in the org the API
  resolves at request time), then idempotently creates 3 channels
  (`email-owner`, `sms-manager`, `slack-ops`), 6 rules
  (`low-stock-default` WARNING, `cash-variance-default` CRITICAL fan-out,
  `booking-reminder-24h` INFO, `billing-payment-failure-saas` CRITICAL
  fan-out, `overdue-vendor-bill` WARNING, `shift-not-closed-16h`
  WARNING), 1 digest (`daily-owner-summary` DAILY 07:00),
  3 representative deliveries (`SENT`, `RETRY_SCHEDULED`,
  `RETRY_EXHAUSTED`), and 3 OwnerLiveEvents. `SeedHistory` marker:
  `m40-alerts-digests-owner-live`. Validated twice back-to-back; second
  pass `Created: 0, Skipped: 16` (full idempotency).
- **Tests**:
  - Unit: `alerts.service.spec.ts` (7), `digest.service.spec.ts` (3),
    `owner-live.service.spec.ts` (1) — 13 passing.
  - E2E: `apps/api/test/alerts.e2e-spec.ts` — 13 cases passing
    (overview, CRUD happy + 400 + 403 chef, test-alert SENT + critical
    fan-out + forced failure → RETRY_SCHEDULED, retry refuses already-SENT
    with 409, owner live feed asserts `notes.publicDinerPaymentExecution`
    matches `/pending/i`, chef denied 403, digest list + run).
- **Postman**: `postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json`
  with 7 folders (`00 Read Me`, `A. Auth & Context`, `B. Alert Rules`,
  `C. Alert Channels`, `D. Test Alerts`, `E. Digest Schedules`,
  `F. Alert Deliveries / Retry`, `G. Owner Live View`),
  collection-level pre-request that auto-logs in `owner@demo.local` and
  resolves `orgId` / `branchId` via `/api/me`. Newman result against the
  built API: **19 requests, 34 assertions, 0 failures** — see
  `_newman_m40.json`.
- See `ai/M40_COMPLETION_REPORT.md`.

### M40 Correction Patch (2026-04-27)

Post-release hardening pass on M40. No new endpoints or migrations beyond
the alert model refinement below.

- **Alert model refinement**: Added `AlertCategory` enum
  (`OPERATIONAL_IMMEDIATE | OWNER_FINANCE | BOOKING_EVENT | TECHNICAL_INTEGRATION`)
  and `AlertChannelIntent` enum (`MOBILE_SMS | EMAIL_DIGEST | SLACK_WEBHOOK | ALL_CHANNELS`)
  to schema. Both columns are nullable on `AlertRule` and auto-derived in
  `AlertsService.createRule()` via `deriveAlertCategory()` / `deriveChannelIntent()`
  when not supplied by caller. `UpdateAlertRuleDto` also accepts them.
- **Channel routing mapping**:
  - `LOW_STOCK` / `SHIFT_NOT_CLOSED` → `OPERATIONAL_IMMEDIATE` / `MOBILE_SMS`
  - `CASH_VARIANCE` / `BILLING_PAYMENT_FAILURE` → `OPERATIONAL_IMMEDIATE|OWNER_FINANCE` / `ALL_CHANNELS`
  - `BOOKING_REMINDER` → `BOOKING_EVENT` / `EMAIL_DIGEST`
  - `OVERDUE_VENDOR_BILL` / `FRANCHISE_BRANCH_AT_RISK` / `LARGE_WASTAGE_SPIKE` → `OWNER_FINANCE` / `EMAIL_DIGEST`
  - `FAILED_WEBHOOK_DELIVERY` → `TECHNICAL_INTEGRATION` / `SLACK_WEBHOOK`
- **Seed updated**: all 6 seed AlertRules now carry explicit `alertCategory` and `channelIntent`.
- **Migration**: `20260427000000_m40_alert_category_channel_intent` — applied
  via `prisma db execute` (drift on old migrations prevented `migrate dev`);
  marked resolved; client regenerated.
- **Postman hardening**: folder B prerequest auto-resolves `ruleId` (list-first
  → create-if-missing); folder F prerequest auto-resolves `deliveryId`
  (list RETRY_SCHEDULED first → `POST /alerts/test?forceFailure=true`
  create-if-missing). Both folders are now fully `[STANDALONE]`.
- **Rules added**: R17 (upstream entity resolution), R18 (standalone folder
  status), R19 (alert channel routing documentation), R20 (re-import warning)
  appended to `ai/AI_POSTMAN_WORKING_PATTERNS.md`.
- See `ai/M40_CORRECTION_COMPLETION_REPORT.md`.

### Seed Regression Recovery (2026-04-26 — on top of M39.3 stabilization)

A regression had stripped M34–M39.3 contributions from
`packages/db/prisma/seed.ts`. The seed has been rebuilt to restore full
coverage without regressing any M0–M33 behavior.

- **Permissions**: ~80 new entries added to `PERMISSIONS_DATA`,
  harvested verbatim from `@Permissions(...)` decorators in the
  M34–M39 controllers (AP, AR, BankRec, PeriodClose, Budgets,
  Forecasts, Procurement, Franchise, FranchiseAnalytics, Billing,
  Onboarding, MerchantPayments, PublicCommerce, OpsPortal).
- **Role matrix (`ROLE_PERM_MATRIX`)** extended:
  - **Owner** — full M34–M39 access including `ops:*`.
  - **Manager** — read across most M34–M39 surfaces +
    `finance:demand-calendar:write` + `franchise:transfer:write`.
  - **Accountant** — full AP / AR / BankRec / PeriodClose, plus
    `budget:read`, `billing:read`, scorecard read.
- **Six new seed functions** added (idempotent, deterministic,
  schema-aligned):
  - `seedApData` — Suppliers, VendorBill (APPROVED, partially paid),
    VendorPayment + allocation, RecurringBillProfile (utility),
    PayableReminder.
  - `seedArData` — Corporate + house CustomerAccounts, two Invoices
    (PARTIALLY_PAID + ISSUED) with lines, ArReceipt + allocation.
  - `seedBankRecData` — BankAccount linked to GL 1010,
    BankStatement with three lines (CREDIT + 2× DEBIT),
    ManualBankEntry.
  - `seedBudgetData` — Budget OPERATIONAL (3 lines:
    Revenue / COGS-Food / Labor), ForecastRun, DemandCalendarEntry.
  - `seedFranchiseData` — FranchiseRanking matrix (branches × 5
    types), BranchBudgetRollup, InterBranchTransfer (only when ≥2
    branches), HqDigestSubscription, FranchiseConsolidationRun,
    3 FranchiseKpiSnapshots, BranchPerformanceScorecard,
    WasteBenchmarkSnapshot. All windows pinned to a deterministic
    month boundary so reruns are pure no-ops.
  - `seedBillingData` — Three Plans (`SOLO` $80/$864 maxBranches:1,
    `GROWTH` $150/$1620 maxBranches:3, `FRANCHISE` $200/$2160
    maxBranches:999) with full feature flags
    (`analyticsEnabled / franchiseEnabled / webhooksEnabled` all
    `true`) and locked policy `featureGating: false`,
    `enforcedMetric: 'BRANCHES'`. Plus Subscription (SOLO / ACTIVE),
    OnboardingProgress (all COMPLETED), MerchantPaymentConfig
    (PENDING with `[PENDING_MTN]` notes prefix; PesaPal **not**
    used here — owner-SaaS only), PublicProfile
    (`nimbus-main`, PUBLISHED), PublicEvent
    (`nimbus-live-music-night`, free, PUBLISHED, capacity 100).
- **`SeedHistory` markers** added: `m34-accounts-payable`,
  `m35-accounts-receivable`, `m36-bank-rec-period-close`,
  `m37-budgets-forecasts`, `m38-franchise-suite-analytics`,
  `m39-billing-onboarding-public-ops`.
- **Validation**: `pnpm --filter @nimbus-pos/db db:seed` ran twice
  back-to-back, exit 0 both times; second pass reports `Created: 0`
  for **every** section (full idempotency). Locked rules preserved:
  3 plans only, all features on by default, location-only
  enforcement, public payments PENDING mobile-money, PesaPal
  reserved for owner-SaaS billing.
- See `ai/M39_SEED_RECOVERY_COMPLETION_REPORT.md`.

### M39 Stabilization Patch (on top of M39.3)

This is a **continuity patch**, not a new feature milestone. It locks
down the M39 split before any M40+ work begins.

- **Hotel / property-group / `M39.4` references removed** from
  `ai/AI_STATUS.md`, `ai/M39_1_COMPLETION_REPORT.md`,
  `ai/M39_2_COMPLETION_REPORT.md`, `ai/M39_3_COMPLETION_REPORT.md`,
  and the M39.2 collection description. The POS backend track stays
  restaurant-focused; no `M39.4` is planned.
- **M39.1 / M39.2 / M39.3 Postman collections hardened** with a
  canonical collection-level pre-request that auto-resolves
  `accessToken` (auto-login owner), `orgId` / `branchId` (via
  `GET /api/auth/me`), and `restaurantSlug` / `eventSlug` / `opsOrgId`
  (via the relevant list endpoints). Folder-level scripts on M39.2
  folder H and M39.3 folder E continue to auto-create / refresh upstream
  events and holds.
- **Cold-session standalone execution verified.** 13 hand-picked
  cold-import folder runs across the three collections — all 0
  assertion failures, 0 request failures (see DONE checks below).
- **Permanent Postman rule book added:**
  [ai/AI_POSTMAN_WORKING_PATTERNS.md](ai/AI_POSTMAN_WORKING_PATTERNS.md).
  All future milestone prompts must follow R1–R15 (read existing
  collections first, document variable flow, default to standalone
  resilience, label doc-only requests, warn about Postman script-import
  caching, etc.).
- **Doc-only requests relabelled / kept clearly out of the runnable
  happy path:** `D2 PesaPal callback (browser-redirected, public)`,
  `D3 PesaPal IPN (server-to-server, public)` in M39.1, and `E.0` /
  `E.3` / `E.4` in M39.3 (`RESERVED FUTURE CONTRACT`).
- **No code-side changes.** Nest controllers, services, Prisma schema,
  and seeds are untouched. This patch is docs + Postman scripts only.

### M39.3 Public Booking + Public Commerce (MoMo Pending) + Ops Portal (latest)

M39.3 is the **third** repo-local split milestone after M39.1 and M39.2.
It fully owns the **public diner website surface**, the **public commerce
payment scaffold (NOT LIVE — pending MTN/Airtel mobile-money
integration)**, and the **Nimbus internal Ops Portal**. M39.1 commercial
/ SaaS billing / Developer Portal foundations and M39.2 onboarding /
membership / merchant-setup foundations are **reused unchanged**.

- **Public booking flows complete.** `/public/restaurants`,
  `/public/restaurants/:slug`, `/public/restaurants/:slug/availability`,
  `/public/restaurants/:slug/events`, `/public/events`,
  `/public/events/:slug`, `/public/reservations/{hold,confirm}`, and
  `/public/event-bookings/{hold,confirm}` all run **without auth**.
  Reservation and event-booking holds use a 15-minute `expiresAt`,
  enforce capacity (event), and are now fully audited via six new
  M39.3 actions: `PUBLIC_RESERVATION_HOLD_CREATED`,
  `PUBLIC_RESERVATION_HOLD_EXPIRED`, `PUBLIC_RESERVATION_CONFIRMED`,
  `PUBLIC_EVENT_BOOKING_HOLD_CREATED`,
  `PUBLIC_EVENT_BOOKING_HOLD_EXPIRED`,
  `PUBLIC_EVENT_BOOKING_CONFIRMED`. Free reservations / free event
  bookings confirm cleanly; the paid-event confirm path returns a clear
  `409` (`Public commerce payments are pending implementation.`) until
  M39.x mobile-money execution lands.
- **Public commerce payment contract / scaffold complete.**
  `/public/payments/{reservations,event-bookings}/checkout-session`,
  `/public/payments/callback`, `/public/payments/ipn`, and
  `/public/payments/reconcile-status` are wired. Every request returns
  the locked
  `{ status: "PENDING_INTEGRATION", provider: "MOBILE_MONEY", message: "Public commerce payment execution is not yet enabled pending MTN/Airtel integration confirmation." }`
  response. Each `checkout-session` call still creates a
  `PendingPaymentIntent` row and emits
  `PUBLIC_PAYMENT_CHECKOUT_ATTEMPTED`. **No `/public/payments/*`
  response advertises PesaPal** — PesaPal is reserved exclusively for
  owner SaaS subscription billing (M39.1).
- **Public payment execution still pending MTN/Airtel integration.**
  Callback / IPN routes are explicitly reserved future contracts; they
  acknowledge inbound calls but do not execute any provider flow.
- **Nimbus Ops Portal complete for M39 scope.** `/ops/customers`,
  `/ops/customers/:orgId`, `/ops/subscriptions/{due,grace-period}`,
  `/ops/onboarding/pipeline`, `/ops/merchant-payments/status`,
  `/ops/support/sessions` (GET / POST / PATCH `:id/close`), plus the
  M39-correction `/ops/plans` admin surface. Support open / close are
  audited as `SUPPORT_SESSION_OPENED` / `SUPPORT_SESSION_CLOSED`. Ops
  support sessions are explicitly the internal Nimbus-staff view and are
  kept separate from the owner-facing `/support/sessions` foundation
  introduced in M39.1.
- **Postman:** added
  `M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops.postman_collection.json`
  with 7 folders (00 Read Me, A Public Restaurant Browse, B Public Event
  Browse, C Reservation Holds + Confirm, D Event Booking Holds + Confirm,
  E Public Commerce Payments — Pending Mobile Money Integration, F
  Nimbus Ops Portal). E folder explicitly labelled NOT LIVE; no PesaPal
  wording on any public-diner request.
- **Tests:** **54 tests pass** across 4 affected suites
  (`public-commerce.service` 22, `public-commerce.m393` 7,
  `public-commerce-payments.service` 8, `ops-portal.service` 17). New
  `public-commerce.m393.spec.ts` locks the six M39.3 audit emissions
  and the paid-event refusal wording.
- **No schema migration needed** — M39.3 is a refinement / ownership
  milestone over existing schema.
- **No hotel / property-group milestone is planned in this repo split.** The M39 split is closed at M39.3 and future work resumes in the official ROADMAP order (M40+).

### M39.2 Onboarding + Membership + Merchant Public Setup (latest)

M39.2 is the second repo-local split milestone after M39.1. It owns the
**owner onboarding**, **membership context resolution**, **invited-user
first-login story**, **merchant public-website setup**, and **generic
merchant payment readiness** — explicitly without re-implementing any
M39.1 SaaS billing / Developer Portal foundations (those are reused).

- **`GET /auth/me` enhanced.** The response now includes `memberships[]`
  (with `organizationId/Name/Slug`, `branchId/Name/Slug`, `roleId/Name/Level`,
  `status`, `isDefaultBranch`) and a `context` block with
  `organizationCount`, `branchCount`, `requiresContextSelection`,
  `defaultOrganizationId`, `defaultBranchId`, `defaultMembershipId`. The
  frontend uses this immediately after the global Nimbus login to either
  auto-select (one org, one branch) or prompt the user to pick.
- **Real invitation flow.** `POST /onboarding/invitations` previously only
  marked the step COMPLETED. It now actually creates `User + UserRole +
  Membership` rows (idempotent on `[userId, branchId]`), pins the invitee
  to the first ACTIVE branch as their `isDefaultBranch`, and returns a
  one-time `tempPassword` + `invitationToken` per new invitee. Re-invites
  return `status: 'ALREADY_MEMBER'` with `tempPassword: null`.
- **Locked: only Manager + Accountant invitable here.** Any other role
  returns `400 BadRequest` with a message explaining that Cashier / Waiter
  / Chef / Bartender are added LATER from inside the app — NOT in the
  onboarding wizard.
- **Branch creation enforces M39.1 location-cap.** Confirmed by spec test:
  `client-onboarding.createBranch()` calls `BillingService.checkPlanLimit
  (orgId, 'BRANCH', userId)` whenever a subscription exists; it skips the
  call when no subscription is attached yet (pre-payment onboarding).
- **`PATCH /merchant/booking-settings` is now real.** Settings are
  persisted into `PublicProfile.metadata.bookingSettings`. Auto-creates a
  DRAFT profile if none exists yet so booking rules can be configured
  before publishing. Audited as `MERCHANT_BOOKING_SETTINGS_UPDATED`.
- **Event capacity / pricing strengthened.**
  - `updateEventCapacity` now refuses to drop capacity below current
    `bookedCount` (`409 Conflict`). Audited as
    `PUBLIC_EVENT_CAPACITY_UPDATED`.
  - `updateEventPricing` rejects flipping to paid (`isFree: false`)
    without a positive price. Audited as `PUBLIC_EVENT_PRICING_UPDATED`.
- **Merchant payment readiness reused unchanged from M39 correction.**
  Generic readiness model `NOT_CONFIGURED | PENDING_MTN | PENDING_AIRTEL |
  READY_FOR_INTEGRATION | LIVE | DISABLED` with `provider = 'MOBILE_MONEY'`.
  M39.2 explicitly does NOT touch live diner payment execution — that
  remains pending for M39.3.
- **Postman:** added `M39.2-Onboarding-Membership-Merchant-Public-Setup
  .postman_collection.json` with 9 folders (00 Read Me, A Auth & Context
  Resolution, B Onboarding Status, C Org + Branch Creation, D Profile +
  Settings, E Team Invitations & First Login Story, F Merchant Public
  Profile, G Booking Settings, H Merchant Events, I Merchant Payment
  Readiness). The E folder explicitly walks through invited-Manager
  global login + `/auth/me` auto-resolution.
- **Tests:** **93 tests pass** across 5 affected suites
  (`me-membership-context` 4, `client-onboarding.service` 14,
  `public-commerce.service` 22, `merchant-payments.service` 13,
  `billing.service` 40). New tests cover `/me` membership context shape,
  invitation User + Membership creation, role-restriction enforcement,
  re-invite idempotency, location-cap enforcement during branch creation,
  booking-settings persistence, capacity-below-booked refusal, and
  pricing audit emission.
- **Public diner payment execution remains PENDING** for M39.3.
- **No hotel / property-group milestone is planned in this repo split.** The POS backend track stays restaurant-focused.

### M39.1 Commercial Foundation (latest)

M39.1 is the **commercial and platform-control foundation** of Nimbus. It is a
repo-local split of the previous M39 reconstruction work that consolidates the
SaaS billing surface area into one named milestone. The previous M39 engineering
is preserved — M39.1 adds wording / response-shape alignment, additional
lifecycle tests, and a single canonical Postman collection.

- **Plans locked:** SOLO (1 location), GROWTH (≤3), FRANCHISE (4+).
- **Pricing locked:** SOLO USD 80/mo (864/yr), GROWTH USD 150/mo (1620/yr),
  FRANCHISE USD 200/mo (2160/yr).
- **Location-only enforcement:** the only enforced commercial cap is the
  branch (location) count. There is **no feature gating**. Every plan grants
  the full Nimbus feature set (POS, KDS, inventory, accounting, HR, reporting,
  analytics, reservations, events, developer portal, franchise / HQ analytics).
- **PesaPal LIVE for owner SaaS billing only** — owners pay Nimbus.
  `/billing/pesapal/{checkout-session, callback, ipn, reconcile-status}`.
  No raw card storage; subscription only flips to ACTIVE after a verified
  COMPLETED IPN / reconcile. Credentials read from env only
  (`PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_BASE_URL`,
  `PESAPAL_IPN_CALLBACK_URL`).
- **Subscription lifecycle:** PENDING_PAYMENT, ACTIVE, GRACE_PERIOD, PAST_DUE,
  SUSPENDED, CANCELLED. Monthly ↔ annual + solo ↔ growth ↔ franchise changes
  are validated against active-location count.
- **Developer portal:** `/dev/api-keys`, `/dev/webhooks`, `/dev/usage`,
  `/dev/admins`. Full-access integration keys for trusted backend systems
  (NOT staff, NOT browser embedding, NOT diners). `/dev/usage` leads with the
  location-cap context.
- **Support sessions:** owner-facing `/support/sessions` open / list / close.
  Ops-side extensions remain under `/ops/support/...`.
- **Ops plan-catalog admin:** `/ops/plans` CRUD with refusals on destructive
  cap changes (lower cap when subscribers exceed it; archive when subscribers
  exist without `force`). Annual price ≤ 12 × monthly always enforced.
- **`/public/plans` response refactored** to drop feature-gating fields
  (`maxUsers`, `analyticsEnabled`, `franchiseEnabled`) and surface
  `policy.featureGating: false`, `maxLocations`, and `annualDiscountPct`
  consistently with the ops admin shape.
- **Tests:** added 5 M39.1-targeted assertions to `billing.service.spec.ts`
  (PENDING_PAYMENT → ACTIVE; SOLO → GROWTH always allowed; FRANCHISE → GROWTH
  blocked over cap; GROWTH at cap returns `recommendedNextPlan=franchise`;
  `/dev/usage` leads with `locations`). Pre-existing missing `updateMany` mock
  and `InternalServerErrorException` import in `billing-pesapal.service.spec.ts`
  also fixed. **84 tests pass across the four affected suites
  (billing 32, billing-pesapal 16, public-commerce 19, ops-portal 17).**
- **Postman:** added
  `M39.1-Commercial-Foundation-SaaS-Billing-Dev-Portal.postman_collection.json`
  with 8 folders (00 Read Me, A Auth, B Plan Catalog & Billing Overview,
  C Subscription Change, D SaaS Billing via PesaPal, E Developer Portal,
  F Support Sessions, G Ops Plan Catalog Admin) and per-request descriptions
  covering audience, purpose, and a real-world example.
- **No hotel / property-group milestone is planned** in this repo split (out of M39.1 scope and out of every subsequent M39.x).

### M39 Plan-Catalog Correction (latest — supersedes earlier M39 Correction wording on plans)

The plan model is now locked as **SOLO (1 location) / GROWTH (≤3) / FRANCHISE (4+)**.
All plans grant the **full Nimbus feature set** — POS, KDS, inventory, accounting,
HR, reporting, analytics, reservations, events, developer portal, franchise
analytics, consolidated reporting, HQ-style dashboards. **The only enforced
commercial cap is the location count.** Numeric caps for users, API keys,
and webhook endpoints were raised to a sentinel (999_999) so they never fire.

- **Pricing locked:** SOLO USD 80/mo (864/yr), GROWTH USD 150/mo (1620/yr),
  FRANCHISE USD 200/mo (2160/yr) — annual ≈ 10% discount.
- **Enforcement:** `BillingService.checkPlanLimit('BRANCH', …)` is the single
  enforcement point. It now throws a structured `409` with
  `code: PLAN_LOCATION_LIMIT_REACHED`, `currentPlan`, `currentLocations`,
  `allowedLocations`, and `recommendedNextPlan`. `'API_KEY'` and `'WEBHOOK'`
  variants are no-ops kept for backwards compat.
- **Wired into branch creation:** both `TenancyService.createBranch()` and
  `ClientOnboardingService.createBranch()` now call `checkPlanLimit('BRANCH')`
  before creating a branch (skipped only when no subscription exists yet).
- **Billing overview / usage:** both responses now expose a top-level
  `locationCapacity` / `locations` block with `current`, `allowed`,
  `upgradeRequired`, `recommendedNextPlan`, and a clarifying `note` that
  feature gating is intentionally absent.
- **Ops plan-catalog admin (NEW):** Nimbus internal admins can manage the
  plan catalog without redeploying via:
  - `GET /api/ops/plans` — full catalog with `policy.featureGating: false`
  - `POST /api/ops/plans` — create new plan (DRAFT)
  - `PATCH /api/ops/plans/:id` — update name/price/maxLocations/wording
  - `PATCH /api/ops/plans/:id/status` — flip DRAFT/ACTIVE/ARCHIVED
  - `GET /api/ops/plans/:id/subscribers` — who is on this plan + over-cap flag
  Guarded by 2 new permissions: `ops:plans:read`, `ops:plans:write`.
  Audited as `OPS_PLAN_CREATED`, `OPS_PLAN_UPDATED`, `OPS_PLAN_STATUS_CHANGED`.
- **Seed:** plan catalog is now **upserted** (not skipped) so re-seeding
  reconciles existing rows to the corrected pricing/caps/wording. Solo's
  webhooks/analytics/franchise flags were flipped to TRUE (no feature gating).
  Growth `maxBranches` corrected from 5 → 3. Franchise `maxBranches` raised
  to 999_999.
- **Postman:** added `M39-Plan-Catalog-Correction-Solo-Growth-Franchise.postman_collection.json`
  with 6 folders and per-request descriptions covering audience, purpose,
  and a real-world example for every developer-portal and ops endpoint.
- **Tests:** `billing.service.spec.ts` updated (starter→solo, removed feature
  gating assertions, added location-cap upgrade-target assertion);
  `tenancy.service.spec.ts` and `client-onboarding.service.spec.ts` updated
  to inject `BillingService` mocks. **48 tests pass across the four affected
  suites (billing, tenancy, client-onboarding, ops-portal).**

### M39 Correction Details (still applies — payments wording)

The earlier reconstruction implementation was correct in code but inconsistent
in wording: the Postman collection still implied diners pay through PesaPal.
The correction realigns implementation, docs, and Postman with the locked
business architecture.

- **3 audiences explicitly separated:** restaurant owners, public diners,
  Nimbus internal staff. No blurring in names or descriptions.
- **2 payment domains explicitly separated:**
  - **A. SaaS subscription billing — PesaPal — LIVE** for restaurant owners
    paying Nimbus subscriptions. The only live PesaPal flow in this repo.
  - **B. Public commerce payments — Mobile money (MTN/Airtel) — PENDING.**
    Endpoints exist as scaffolding. Every request returns
    `{ status: "PENDING_INTEGRATION", provider: "MOBILE_MONEY", message: "..." }`.
    These are NOT PesaPal and must NOT be described as live diner checkout.
- **Merchant payment connectivity refactored to a generic readiness model**
  (`NOT_CONFIGURED | PENDING_MTN | PENDING_AIRTEL | READY_FOR_INTEGRATION |
  LIVE | DISABLED`) with `provider = "MOBILE_MONEY"`. Legacy
  `/merchant/payments/pesapal/...` paths are kept for backward compat but
  no longer imply a real PesaPal merchant account.
- **Login & tenancy clarified:** users log into Nimbus globally; backend
  resolves memberships; frontend chooses org/branch context. Invited
  managers/accountants follow the same flow on first login. Branch-scoped
  routes still require `x-branch-id`.
- **Staff creation clarified:** owner invites only the core team
  (Manager + Accountant) during onboarding. Additional staff are added
  later from inside the app, NOT in the onboarding wizard.
- **Webhook semantics clarified and kept separate** in docs and Postman:
  inbound payment callbacks (SaaS — LIVE; public — PENDING) vs. outbound
  developer webhooks (Nimbus → customer URL).
- **Postman collection rebuilt** as a chronological journey:
  `00 README → A Auth → B SaaS PesaPal → C Onboarding → D Invitations →
  E Dev Portal → F Merchant Booking Setup → G Public Booking → H Public
  Payments (PENDING) → I Ops Portal`. Misleading PesaPal-for-diners
  language removed; scaffold folders/requests clearly labelled
  NOT LIVE / PENDING.
- **API workflow spec added:** `docs/M39_API_WORKFLOW_SPEC.md` explains
  every M39 endpoint: who uses it, live vs pending, business meaning.
- **Pricing locked:** SOLO $80/mo ($864/yr), GROWTH $150/mo ($1620/yr),
  FRANCHISE $200/mo ($2160/yr).
- **Tests updated:** `merchant-payments.service.spec.ts` and
  `public-commerce-payments.service.spec.ts` rewritten to assert the
  corrected response shapes (PENDING_INTEGRATION / MOBILE_MONEY,
  readiness model, no PesaPal advertising in public/diner responses).
  All 19 affected unit tests pass.
- **No schema migration needed** — the correction maps the new readiness
  labels onto the existing `MerchantPaymentConfigStatus` enum via a
  prefixed `notes` field.

#### Public commerce payments — explicit status

Public commerce payment execution is **PENDING the MTN / Airtel mobile-money
integration** and is **NOT LIVE**. Any public payment endpoint
(`/api/public/payments/*`) is scaffold only and must not be treated as
complete. PesaPal is reserved exclusively for the SaaS subscription
billing flow described above.

## Environment

- Node target: 22.x (verified: v22.14.0)
- pnpm target: 8.x (verified: 8.15.0)
- Database target: Neon Postgres (wired in M1 ✅, verified M3.1 ✅)
- Prisma version: 5.22.0
- Redis target: docker-compose for local dev (wired later)
- API port target: 3001
- Web port target: 3000

## Locked Decisions

- Stack: Node 22 + TypeScript + NestJS + Prisma + Neon + Redis + BullMQ
- ID type: cuid2
- Validation: class-validator + class-transformer
- Auth v1: JWT access + refresh
- Frontend: Next.js Pages Router
- Deferred until late wave: MSR badge login, smart spouts

## Milestone Checklist

### M0 — Repo Bootstrap + Workspace Tooling

- [x] Workspace created (pnpm workspaces + Turbo)
- [x] API scaffold created (NestJS under apps/api)
- [x] Shared packages scaffolded (packages/db, packages/shared)
- [x] lint / format / test scripts wired
- [x] docs scaffolded (ARCHITECTURE, API_CONVENTIONS, MODULES)
- [x] Health endpoint working (GET /api/health)
- [x] Unit test passing (app.controller.spec.ts)
- [x] e2e test passing (app.e2e-spec.ts)
- [x] Postman collection + environment created
- [x] DONE checks passed

### M1 — Neon + Prisma Baseline + Seed Framework

- [x] Prisma configured (schema.prisma with AppConfig + SeedHistory)
- [x] Neon connection works (via DATABASE_URL env var)
- [x] Migration pipeline works (20260320000000_m1_baseline committed)
- [x] Seed runner idempotent (safe to run multiple times)
- [x] DB-backed /health passes (SELECT 1 check)
- [x] PrismaModule + PrismaService in apps/api/src/common/prisma/
- [x] Root db:generate / db:migrate / db:seed / db:studio scripts wired
- [x] Postman M1-Health-DB collection created
- [x] Docs updated (README, ARCHITECTURE, MODULES, repo file tree)
- [x] pnpm lint clean
- [x] pnpm test clean (2 unit + 2 e2e tests passing)
- [x] DONE checks passed

### M2 — Auth v1 + Sessions + RBAC

- [x] Prisma schema: User, Role, Permission, RolePermission, UserRole, Session, RefreshToken, AuditLog
- [x] Migration: 20260320065959_m2_auth_rbac_sessions committed
- [x] JWT access (15m) + opaque refresh (7d) with rotation + family revocation
- [x] PIN login (4–6 digit, bcrypt hashed)
- [x] Session persistence (jti, platform, source, IP, user-agent, lastActivityAt)
- [x] RBAC: 5 levels (L1–L5), 11 job roles, 6 permissions
- [x] PermissionGuard (decorator-driven)
- [x] PlatformAccessGuard (X-Platform header, level-based matrix)
- [x] AuditService (global module, 10 action types)
- [x] Common decorators (@CurrentUser, @Permissions, @Roles)
- [x] Seed: 11 roles, 6 permissions, 27 role-permission mappings, 6 demo users (idempotent)
- [x] Unit tests: 20 passing (auth.service, permission.guard, platform-access.guard)
- [x] E2e tests: 16 passing (auth flows, RBAC denial, platform denial)
- [x] pnpm lint clean (0 errors)
- [x] Manual API verification (health, login, me, pin-login, 403s)
- [x] Postman M2-Auth-RBAC collection + environment + guide
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, README, repo file tree)
- [x] DONE checks passed

### M3 — Multi-Tenancy Core

- [x] Prisma schema: Organization, Branch, Membership models + enums (OrganizationStatus, BranchStatus, MembershipStatus)
- [x] Migration: 20260320073537_m3_tenancy_org_branch_membership committed
- [x] TenancyModule: service + controller with full CRUD for orgs, branches, memberships
- [x] DTOs: create-org, create-branch, create-membership (class-validator)
- [x] BranchContextGuard: reads X-Branch-Id header, validates branch exists + ACTIVE + user has ACTIVE membership
- [x] @RequireBranchContext decorator for controller routes
- [x] Auth integration: GET /api/me returns full tenancy context (orgs, branches, memberships, roles, permissions, session)
- [x] 5 M3 permissions: tenancy:org:read/write, tenancy:branch:read/write, tenancy:membership:manage
- [x] Role-permission matrix updated for all 11 roles
- [x] Audit events: ORG_CREATED, BRANCH_CREATED, MEMBERSHIP_CREATED, BRANCH_ACCESS_DENIED
- [x] Seed: 1 org, 2 branches, 6 memberships (idempotent)
- [x] Unit tests: tenancy.service.spec (7 tests) + branch-context.guard.spec (4 tests)
- [x] E2e tests: tenancy.e2e-spec (13 tests across 3 suites)
- [x] Postman M3-Tenancy collection + environment updated
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, README, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed

### M3.1 — Quick PIN Login for POS Desktop

- [x] Prisma schema: QuickPinTier enum + 13 new User fields (quickPinHash, pinLookupHash, pinTier, pinLength, displayName, employeeCode, avatarUrl, quickPinEnabled, failedPinAttempts, pinLockedUntil, lastPinChangedAt, quickPinIssuedAt, quickPinIssuedById)
- [x] Migration: 20260320100000_m3_1_quick_pin_login (SQL created manually — apply when Neon online)
- [x] QuickPinService: quickPinLogin, issueQuickPin, resetQuickPin, updateQuickPinSettings, getQuickPinStatus
- [x] Dual-hash security: HMAC-SHA256 pinLookupHash (indexed) + bcrypt quickPinHash
- [x] Role-tier policy: LOW_6 (6-digit) = WAITER/CASHIER/BARTENDER, HIGH_8 (8-digit) = SUPERVISOR/MANAGER
- [x] Platform enforcement: POS_DESKTOP only for quick PIN login
- [x] Lockout policy: 5 failed attempts → 5-minute lock
- [x] 4 DTOs: QuickPinLoginDto, IssueQuickPinDto, ResetQuickPinDto, UpdateQuickPinSettingsDto
- [x] 5 controller endpoints: POST quick-pin-login, POST issue, POST reset, PATCH settings, GET status
- [x] Audit logging: QUICK_PIN_LOGIN, QUICK_PIN_ISSUED, QUICK_PIN_RESET, QUICK_PIN_SETTINGS_UPDATED, QUICK_PIN_LOCKOUT
- [x] Seed: 3 demo quick PINs (waiter=123456/LOW_6, cashier=654321/LOW_6, manager=12345678/HIGH_8)
- [x] Unit tests: 15 tests in quick-pin.service.spec.ts (+ 48 total across 7 suites)
- [x] E2e tests: 16 tests in quick-pin.e2e-spec.ts (+ 44 total across 4 suites)
- [x] Postman: M3_1-Quick-PIN-Login collection (17 requests) + environment updated
- [x] Docs updated (ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed (2026-03-20: all green — generate, migrate, seed×2, lint, test, test:e2e, dev:api, health, manual PIN login verified)

### M4 — Org Settings + Configuration

- [x] Prisma schema: OrgSettings model (19 fields including Decimal, JSON, scalar) + ExchangeRate model (8 fields, composite index)
- [x] Migration: 20260320120000_m4_org_settings (SQL created manually — apply when Neon online)
- [x] SettingsModule: service + controller with 14 endpoints
- [x] Sub-resource endpoints: /settings, /settings/currency, /settings/tax-matrix, /settings/rounding, /thresholds, /settings/platform-access, /settings/exchange-rate, /settings/exchange-rates
- [x] DTOs: 7 validated DTOs (UpdateOrgSettings, UpdateCurrency, UpdateTaxMatrix, UpdateRounding, UpdateThresholds, UpdatePlatformAccess, CreateExchangeRate)
- [x] New permission: tenancy:settings:manage (assigned to Owner + Manager roles)
- [x] Audit events: SETTINGS_UPDATED, CURRENCY_UPDATED, TAX_MATRIX_UPDATED, ROUNDING_UPDATED, THRESHOLDS_UPDATED, PLATFORM_ACCESS_UPDATED, EXCHANGE_RATE_CREATED
- [x] Decimal safety: all monetary/rate fields use Prisma Decimal, never float
- [x] Seed: OrgSettings defaults (vatPercent=18, currency=UGX, discountApprovalThreshold=5000, reservationHoldMinutes=30) + ExchangeRate (USD/UGX @ 3700.000000)
- [x] Unit tests: 10 tests in settings.service.spec.ts
- [x] E2e tests: 16 tests in settings.e2e-spec.ts (auth, RBAC denial, payload validation, exchange rates)
- [x] Postman: M4-Org-Settings collection (17 requests) + environment updated
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks passed (2026-03-20: generate ✅, migrate ✅, seed×2 ✅, lint 0 errors ✅, test 60/60 ✅, e2e 16/16 M4 tests ✅, dev:api ✅, manual hits ✅)

### M5 — Floor Plans + Tables

- [x] Prisma schema: TableStatus enum, FloorPlan model (id, orgId, branchId, name, data Json, isActive, timestamps), Table model (id, orgId, branchId, floorPlanId?, label, capacity, status, isActive, metadata Json?, timestamps)
- [x] Migration: 20260320140000_m5_floor_plans_tables (applied via prisma db execute)
- [x] FloorModule: service + controller with full CRUD for floor plans & tables + availability endpoint
- [x] DTOs: 5 validated DTOs (CreateFloorPlan, UpdateFloorPlan, CreateTable, UpdateTable, UpdateTableStatus)
- [x] BranchContextGuard + PermissionGuard on all endpoints
- [x] 4 new permissions: pos:floor:read/write, pos:table:read/write
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Chef/Waiter/Bartender = read-only
- [x] TableStatus state machine: AVAILABLE, OCCUPIED, RESERVED, CLEANING
- [x] Unique constraint: @@unique([branchId, label]) on Table model
- [x] Audit events: FLOOR_PLAN_CREATED, FLOOR_PLAN_UPDATED, TABLE_CREATED, TABLE_UPDATED, TABLE_STATUS_CHANGED
- [x] Seed: 2 floor plans (Main Dining, Patio) + 15 tables (T1-T10, VIP-1/2, P1-P3) for MAIN branch
- [x] Unit tests: 8 tests in floor.service.spec.ts
- [x] E2e tests: 18 tests in floor.e2e-spec.ts (all pass)
- [x] Postman: M5-Floor-Plans-Tables collection (16 requests) + environment updated
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [x] DONE checks: pending Neon connectivity for migration/seed verification

### M6 — Menu Catalog + Categories + Tax Categories

- [x] Prisma schema: MenuItemType enum (FOOD, DRINK), PrepStation enum (KITCHEN, BAR, COLD_KITCHEN, DESSERT, NONE), Category model (@@unique([branchId, name])), TaxCategory model (@@unique([branchId, name])), MenuItem model (@@unique([categoryId, name]))
- [x] Migration: 20260321000000_m6_menu_catalog (SQL created manually — apply when Neon online)
- [x] MenuModule: service + controller with full CRUD for categories, tax categories, menu items + catalog endpoint
- [x] DTOs: 7 validated DTOs (CreateCategory, UpdateCategory, CreateTaxCategory, UpdateTaxCategory, CreateMenuItem, UpdateMenuItem, ListMenuQuery)
- [x] BranchContextGuard + PermissionGuard on all 13 endpoints
- [x] 4 new permissions: pos:menu:read/write, pos:tax:read/write
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Chef/Waiter/Bartender = read-only
- [x] Catalog endpoint: GET /api/menu/catalog returns POS-friendly grouped payload (categories with items, tax summary)
- [x] Decimal safety: price Decimal(10,2), rate Decimal(5,2)
- [x] Audit events: CATEGORY_CREATED/UPDATED, TAX_CATEGORY_CREATED/UPDATED, MENU_ITEM_CREATED/UPDATED
- [x] Seed: 5 categories (Starters, Mains, Desserts, Drinks, Sides) + 2 tax categories (VAT Standard 18%, VAT Zero 0%) + 20 menu items across all categories
- [x] Unit tests: 10 tests in menu.service.spec.ts (79/79 total across 10 suites)
- [x] E2e tests: 20 tests in menu.e2e-spec.ts
- [x] Postman: M6-Menu-Catalog collection (20 requests) + environment updated (categoryId, taxCategoryId, menuItemId)
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M6.1 — Menu Taxonomy + Serving Formats

- [x] Prisma schema: MenuSection enum (FOOD, DRINKS), ServingFormat enum (12 values), MenuBrowseGroup model (@@unique([branchId, name])), MenuBrowseSubgroup model (@@unique([groupId, name])), MenuItemServing model (@@unique([menuItemId, format, label])), browseGroupId/browseSubgroupId on MenuItem
- [x] Migration: 20260321100000_m6_1_menu_taxonomy_serving_formats (SQL created manually)
- [x] DTOs: 8 new DTOs (CreateBrowseGroup, UpdateBrowseGroup, CreateBrowseSubgroup, UpdateBrowseSubgroup, CreateMenuItemServing, UpdateMenuItemServing, AssignMenuItemBrowse, ListMenuNavigationQuery)
- [x] MenuService: 13 new methods (browse groups CRUD, subgroups CRUD, servings CRUD, assignItemBrowse, getNavigation, upgraded getCatalog)
- [x] MenuController: 12 new endpoints (browse-groups 4, browse-groups/:id/subgroups 3, items/:id/servings 3, items/:id/browse 1, navigation 1)
- [x] Catalog endpoint upgraded: returns { categories: [...], taxCategories: [...] } with browseGroup, browseSubgroup, servings per item
- [x] Navigation endpoint: GET /api/menu/navigation returns POS browse tree grouped by section → groups → subgroups, supports ?section= and ?activeOnly= filters
- [x] Audit events: MENU_BROWSE_GROUP_CREATED/UPDATED, MENU_BROWSE_SUBGROUP_CREATED/UPDATED, MENU_ITEM_SERVING_CREATED/UPDATED, MENU_ITEM_BROWSE_ASSIGNED
- [x] Seed: 8 browse groups (4 FOOD + 4 DRINKS) + 5 subgroups + 20 item-browse assignments + 12 serving formats across 6 items
- [x] Unit tests: 20 tests in menu.service.spec.ts (10 M6 + 10 M6.1)
- [x] E2e tests: 36 tests in menu.e2e-spec.ts (20 M6 + 16 M6.1)
- [x] Postman: M6_1-Menu-Taxonomy-Serving-Formats collection + environment updated (browseGroupId, browseSubgroupId, servingId)
- [x] Docs updated (MODULES, AI_STATUS)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M7 — Menu Modifier Groups + Options

- [x] Prisma schema: ModifierGroup model (@@unique([branchId, name])), ModifierOption model (@@unique([groupId, name]), Decimal(10,2) priceDelta), MenuItemOnGroup join model (@@unique([itemId, groupId]))
- [x] Migration: 20260321200000_m7_modifier_groups_options (SQL created manually)
- [x] DTOs: 5 new DTOs (CreateModifierGroup, UpdateModifierGroup, CreateModifierOption, UpdateModifierOption, AssignItemModifierGroups)
- [x] MenuService: 9 new methods (modifier groups CRUD, options CRUD, item-group assignment + listing)
- [x] MenuController: 10 new endpoints (modifier-groups 4, modifier-groups/:id/options 3, items/:id/modifier-groups 2, item detail upgraded)
- [x] Item detail endpoint: GET /api/menu/items/:id returns flattened modifierGroups[{id, name, min, max, required, sortOrder, options[]}]
- [x] Business rules: min/max validation (min <= max when both > 0), unique name per branch/group, branch context enforcement
- [x] Audit events: MODIFIER_GROUP_CREATED, MODIFIER_GROUP_UPDATED, MODIFIER_OPTION_CREATED, MODIFIER_OPTION_UPDATED, MENU_ITEM_MODIFIER_GROUPS_ASSIGNED
- [x] Seed: 4 modifier groups (Size, Cooking Temp, Extra Toppings, Drink Extras) + 14 options + 7 item-group assignments
- [x] Unit tests: 33 tests in menu.service.spec.ts (20 M6/M6.1 + 13 M7)
- [x] E2e tests: 50 tests in menu.e2e-spec.ts (36 M6/M6.1 + 14 M7)
- [x] Postman: M7-Menu-Modifiers collection (16 requests) + environment updated (modifierGroupId, modifierOptionId)
- [x] Docs updated (MODULES, AI_STATUS)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M8 — Recipes + Ingredient Costing (COGS Foundation)

- [x] Prisma schema: InventoryItem model (13 fields, @@unique([branchId, name])), RecipeIngredient model (14 fields, indexed FKs), updated Organization/Branch/MenuItem/MenuItemServing/ModifierOption relations
- [x] Migration: 20260321300000_m8_recipes_costing (SQL created manually — apply when Neon online)
- [x] RecipesModule: service + controller with 7 endpoints under /inventory prefix
- [x] DTOs: 4 validated DTOs (CreateInventoryItem, UpdateInventoryItem, SetRecipe with nested RecipeIngredientDto, ListRecipeCostQuery)
- [x] Inventory item CRUD: POST/GET/GET-by-id/PATCH at /api/inventory/items
- [x] Recipe set (atomic replace): POST /api/inventory/recipes/:menuItemId — deletes all existing + creates new in a transaction
- [x] Recipe get: GET /api/inventory/recipes/:menuItemId — grouped by base/modifier/serving ingredients
- [x] Cost breakdown: GET /api/inventory/recipes/:menuItemId/cost — effectiveQty, extendedCost, totalCogs, margin, marginPercent
- [x] Visibility masking: L4/L5 always see cost; Chef (L2 CHEF) sees cost only if showCostToChef=true; cost fields omitted when masked
- [x] Validation: serving IDs, modifier option IDs, inventory item IDs all validated against branch scope
- [x] 3 new permissions: pos:recipe:read, pos:recipe:write, pos:cost:read
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 3; Chef = pos:recipe:read + pos:cost:read
- [x] Audit events: INVENTORY_ITEM_CREATED, INVENTORY_ITEM_UPDATED, RECIPE_SET, RECIPE_UPDATED, RECIPE_COST_VIEWED, RECIPE_ACCESS_DENIED
- [x] Decimal safety: theoreticalUnitCost Decimal(10,3), qtyPerUnit Decimal(10,3), wastePct Decimal(5,2)
- [x] Cost formula: effectiveQty = qtyPerUnit × (1 + wastePct/100), extendedCost = effectiveQty × unitCost
- [x] Seed: 24 inventory items, 10 base recipes (31 ingredient rows), 2 modifier-linked recipes, 3 M8 permissions in role matrices
- [x] Unit tests: 25 tests in recipes.service.spec.ts (inventory CRUD, set/replace recipe, cost calculation, visibility masking, permission denial, modifier-linked costing)
- [x] E2e tests: 17 tests in recipes.e2e-spec.ts (inventory CRUD, recipe set/get/cost, atomic replace, error cases, RBAC denial)
- [x] Postman: M8-Recipes-Costing collection (10 requests) + environment updated (inventoryItemId, inventoryItemId2)
- [x] Docs updated (README, ARCHITECTURE, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, repo file tree)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M9 — Inventory Stock + FIFO

- [x] Prisma schema: StockBatch model (14 fields, 6 indexes), StockAdjustment model (8 fields, 4 indexes), added reorderLevel/reorderQty to InventoryItem
- [x] Migration: 20260323000000_m9_inventory_stock_batches (SQL created manually — apply when Neon online)
- [x] InventoryModule: service + controller with 5 endpoints under /inventory prefix
- [x] DTOs: 3 validated DTOs (CreateStockBatch, CreateStockAdjustment, ListInventoryLevelsQuery)
- [x] Updated M8 DTOs: reorderLevel/reorderQty added to CreateInventoryItemDto and UpdateInventoryItemDto
- [x] Stock batch CRUD: POST /api/inventory/batches, GET /api/inventory/batches, GET /api/inventory/items/:id/batches
- [x] Inventory levels: GET /api/inventory/levels — aggregates remainingQty from batches per item, computes belowReorder flag
- [x] Stock adjustments: POST /api/inventory/adjustments — positive adjustments create zero-cost batches, negative use FIFO deduction
- [x] FIFO deduction foundation: fifoDeduct() consumes oldest batches first (receivedAt ASC), returns deduction records
- [x] Negative stock blocking: attempts audited as NEGATIVE_STOCK_ATTEMPT, returns 400
- [x] 3 new permissions: pos:inventory:read, pos:inventory:write, pos:inventory:adjust
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 3; Stock Manager = all 3; Chef/Cashier/Waiter/Bartender = pos:inventory:read only
- [x] Audit events: STOCK_BATCH_CREATED, STOCK_ADJUSTED, NEGATIVE_STOCK_ATTEMPT
- [x] Decimal safety: all quantities use Prisma Decimal(10,3), never float
- [x] Seed: reorderLevel/reorderQty on all 24 inventory items, 30 stock batches (3 for Chicken, 3 for Milk, 2 for Vodka for FIFO demo)
- [x] Unit tests: 14 tests in inventory.service.spec.ts (batch CRUD, levels, FIFO, adjustments, negative stock blocking)
- [x] E2e tests: 13 tests in inventory.e2e-spec.ts (batch CRUD, levels, adjustments, RBAC, error cases)
- [x] Postman: M9-Inventory-Stock collection (10 requests) + token capture + environment vars
- [x] Docs updated (README, API_CONVENTIONS, MODULES, POSTMAN_GUIDE, AI_STATUS)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M10 — POS Orders: Create + Lifecycle + Status Machine

- [x] Prisma schema: OrderStatus enum (7 values), ServiceType enum (2 values), Order model (17 fields, 7 indexes, unique [branchId, orderNumber]), OrderItem model (14 fields, 3 indexes)
- [x] Relations: Order → Organization, Branch, User, Table; OrderItem → MenuItem, MenuItemServing
- [x] Migration: 20260323100000_m10_pos_orders (SQL created manually — apply when Neon online)
- [x] Prisma Client generated (v5.22.0)
- [x] OrdersModule: service + controller + module registered in app.module.ts
- [x] DTOs: 5 validated DTOs (CreateOrder, AddOrderItem, UpdateOrderItem, TransitionOrder, ListOrdersQuery) + barrel index
- [x] Order CRUD: POST /api/pos/orders, GET /api/pos/orders, GET /api/pos/orders/:id
- [x] Order items CRUD: POST /api/pos/orders/:id/items, PATCH /api/pos/orders/:id/items/:itemId, DELETE /api/pos/orders/:id/items/:itemId
- [x] State machine: NEW → SENT → IN_KITCHEN → READY → SERVED → CLOSED, with VOIDED from NEW/SENT/IN_KITCHEN/READY
- [x] Post-kitchen void requires reason (IN_KITCHEN, READY)
- [x] Closed/voided orders block item mutations
- [x] Order number generation: ORD-XXXXXX, branch-scoped sequential
- [x] Line pricing: resolves from serving price or item price + modifier deltas
- [x] Cost snapshots: computed from M8 recipe ingredients with waste%, margin calculation
- [x] Order total recalculation on every item mutation
- [x] 4 new permissions: pos:orders:read, pos:orders:write, pos:orders:close, pos:orders:void
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Waiter = read + write; Chef/Bartender = read only
- [x] Audit events: ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_UPDATED, ORDER_ITEM_REMOVED, ORDER_SENT, ORDER_IN_KITCHEN, ORDER_READY, ORDER_SERVED, ORDER_CLOSED, ORDER_VOIDED
- [x] Seed: 6 demo orders (dine-in + takeaway, various states: NEW/SENT/IN_KITCHEN/SERVED/CLOSED/VOIDED) with line items
- [x] Unit tests: 26 tests in orders.service.spec.ts (create, get, list, add/delete items, all transitions, void rules)
- [x] E2e tests: 16 tests in orders.e2e-spec.ts (order CRUD, items CRUD, full lifecycle, void, error cases)
- [x] Postman: M10-POS-Orders collection (14 requests) with test scripts + POSTMAN_GUIDE updated
- [x] Docs updated: ARCHITECTURE.md (M10 section), API_CONVENTIONS.md (M10 endpoints), MODULES.md (POS Orders → implemented)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M11 — KDS + Station Routing + SLA Timers

- [x] Schema: KdsTicketStatus + KdsUrgencyState enums, KdsTicket, KdsTicketItem, KdsSlaConfig models with relations
- [x] Migration: 20260323200000_m11_kds_station_routing (SQL created manually — apply when Neon online)
- [x] KDS module: kds.module.ts, kds.service.ts, kds.controller.ts, dto/ (ListKdsQueueQueryDto, UpdateKdsSlaDto)
- [x] Station routing: Order items grouped by PrepStation on sendOrder, NONE excluded
- [x] Ticket lifecycle: QUEUED → READY → RECALLED with audit logging + SSE events
- [x] SLA urgency: GREEN/AMBER/RED computed from elapsed time vs per-station thresholds (defaults 300/600/900s)
- [x] Queue sorting: RED first → AMBER → GREEN, oldest first within each band
- [x] SSE stream: GET /api/stream/kds with EventEmitter2 + rxjs (filtered by branch + optional station)
- [x] Order integration: sendOrder() in orders.service.ts creates KDS tickets automatically
- [x] Permissions: pos:kds:read, pos:kds:write, pos:kds:sla:write seeded + role-mapped
- [x] Seed: SLA configs for 4 stations + demo KDS tickets for SENT order
- [x] Unit tests: 20 tests in kds.service.spec.ts (ticket creation, queue enrichment, mark-ready, recall, SLA, urgency)
- [x] E2e tests: 13 tests in kds.e2e-spec.ts (queue, station filter, mark-ready, recall, SLA CRUD, auth/errors)
- [x] Postman: M11-KDS-Station-Routing collection (8 requests)
- [x] Docs updated: ARCHITECTURE.md (M11 section), API_CONVENTIONS.md (KDS endpoints), MODULES.md (KDS → Implemented)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M12 — Discounts + Approval Workflow

- [x] Schema: DiscountType + DiscountStatus enums, Discount model with relations on User, Organization, Branch, Order
- [x] Migration: 20260323300000_m12_discounts_approval (SQL created manually — apply when Neon online)
- [x] Discounts module: discounts.module.ts, discounts.service.ts, discounts.controller.ts, dto/ (RequestDiscountDto, ApproveDiscountDto, RejectDiscountDto, ListOrderDiscountsQueryDto)
- [x] Auto-approve: effective discount ≤ OrgSettings.discountApprovalThreshold → APPROVED immediately
- [x] Pending flow: large discounts → PENDING → manager approve/reject with optional PIN verification
- [x] Manager PIN: bcrypt compare against User.quickPinHash from M3.1
- [x] Heavy discount anomaly: HEAVY_DISCOUNT flag appended to order.anomalyFlags
- [x] State restrictions: discounts blocked on SERVED, VOIDED, CLOSED orders (409)
- [x] Order integration: recalcOrderTotals() incorporates latest approved discount into order.discount and order.total
- [x] Permissions: pos:discount:request, pos:discount:approve, pos:discount:read seeded + role-mapped
- [x] Seed: 3 demo discounts (FIXED/approved, PERCENTAGE/pending, FIXED/rejected) + permissions for all roles
- [x] Unit tests: 20 tests in discounts.service.spec.ts (auto-approve, pending, approve, reject, anomaly, PIN, state limits, branch isolation)
- [x] E2e tests: 13 tests in discounts.e2e-spec.ts (happy paths, permission denial, validation, closed-order rejection)
- [x] Postman: M12-Discounts-Approval-Workflow collection (14 requests)
- [x] Docs updated: ARCHITECTURE.md (M12 section), API_CONVENTIONS.md (discount endpoints), MODULES.md (Discounts → Implemented)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M13 — Payments: Cash, Card, Mobile Money

- [x] Prisma schema: PaymentMethod enum (CASH/CARD/MOMO/BANK_TRANSFER), PaymentStatus enum (PENDING/COMPLETED/FAILED/REFUNDED), PaymentIntentStatus enum (PENDING/REQUIRES_ACTION/SUCCEEDED/FAILED/CANCELLED), Payment model (12 fields, 7 indexes), PaymentIntent model (13 fields, 7 indexes), WebhookEvent model (9 fields, 3 indexes)
- [x] Migration: 20260324000000_m13_payments (SQL created manually — apply when Neon online)
- [x] PaymentsModule: service + controller + module registered in app.module.ts
- [x] DTOs: 3 validated DTOs (CloseOrderDto with nested CloseOrderPaymentDto, CreatePaymentIntentDto, CancelPaymentIntentDto) + barrel index
- [x] Close order with payment: POST /pos/orders/:id/close — validates SERVED state, split payments, cash overpayment/changeDue, blocks non-cash overpayment, MOMO requires succeeded intent
- [x] Payment intent lifecycle: POST /payments/intents (create MOMO intent), POST /payments/intents/:id/cancel
- [x] Webhook persistence-first: POST /webhooks/mtn, POST /webhooks/airtel — raw payload persisted before processing, provider ref resolution, auto-create Payment on SUCCEEDED
- [x] Get order payments: GET /pos/orders/:id/payments — returns payments + intents
- [x] Business rules: split payment (multiple methods), cash change calculation, idempotent webhook processing, duplicate payment prevention
- [x] 4 new permissions: pos:payment:create, pos:payment:close, pos:payment:intent, pos:payment:read
- [x] Role-permission matrix: Owner/Manager/Supervisor/Cashier = all 4; Waiter = create + read; Chef/Bartender = read only; Accountant = read only
- [x] Audit events: ORDER_PAID_AND_CLOSED, PAYMENT_RECORDED, PAYMENT_INTENT_CREATED, PAYMENT_INTENT_CANCELLED, PAYMENT_WEBHOOK_RECEIVED
- [x] Seed: 4 permissions + role mappings (11 roles), 2 demo payments (CASH split + CARD), 1 MOMO intent (MTN/SUCCEEDED)
- [x] Unit tests: 25 tests in payments.service.spec.ts (close order, split, overpayment, underpayment, state checks, MOMO intent, cancel, webhooks, branch isolation, audit)
- [x] E2e tests: 13 tests in payments.e2e-spec.ts (close flow, intents, webhooks, permission denial, validation, branch header)
- [x] Postman: M13-Payments-Cash-Card-MOMO collection (16 requests) with test scripts
- [x] Docs updated: MODULES.md (Payments → Implemented), AI_STATUS.md (M13 checklist)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M13.1 — MTN Native Request-to-Pay + Offline Manual Reference Fallback

- [x] Prisma schema: PaymentCaptureMode enum (ONLINE_PROVIDER/MANUAL_REFERENCE), PaymentVerificationStatus enum (NOT_REQUIRED/UNVERIFIED/VERIFIED/REJECTED), extended Payment (7 new fields: captureMode, verificationStatus, externalTransactionId, payerPhone, postedAt, enteredById, verificationNote + enteredBy relation + 3 indexes), extended PaymentIntent (11 new fields: customerPhone, externalId [unique], providerTransactionId, requestedAmount, confirmedAmount, requestedMsisdn, confirmedMsisdn, expiresAt, webhookEventIdLast, idempotencyKey, failureReason + 3 indexes), extended WebhookEvent (3 new fields: signature, headers, processingError), User.paymentsEntered relation
- [x] Migration: 20260325000000_m13_1_mtn_native_manual_reference (SQL created manually)
- [x] MTN Adapter: adapters/mtn.adapter.ts — real MTN Collections API (OAuth2, RequestToPay, status polling, token caching, sandbox helpers, status normalization)
- [x] DTOs: CreateManualReferencePaymentDto (orderId, method, amount, externalTransactionId, payerPhone?, postedAt?, note?, provider?), updated CreatePaymentIntentDto (phoneNumber required, idempotencyKey optional)
- [x] Service layer rewrite: EventEmitter2 + MtnAdapter DI, getOutstandingBalance(), autoSettleIfFullyPaid(), enhanced closeOrderWithPayment (pending intent blocking, already-paid tracking), createPaymentIntent (real MTN call, idempotency, externalId), getPaymentIntent, getPaymentIntentStatus, cancelPaymentIntent (SSE events), processWebhook (externalId resolution, confirmedAmount, auto-settle, SSE), getOrderPayments (with balance), createManualReferencePayment (UNVERIFIED, dedupe, auto-settle), getManualReferencePayment, listManualReferencePayments
- [x] Controller: 12 endpoints total — GET /payments/intents/:id, GET /payments/intents/:id/status, POST /payments/manual-reference, GET /payments/manual-reference/:id, GET /payments/manual-reference, SSE GET /stream/payments (with orderId filter), updated webhook endpoints (pass headers)
- [x] Module: MtnAdapter provider registered
- [x] 3 new permissions: pos:payment:manual-reference, pos:payment:cancel, pos:payment:override
- [x] Role-permission matrix updated: Owner/Manager/Supervisor get all 7 payment perms; Cashier gets 6 (all except override); Waiter gets intent + manual-reference + read; Chef/Bartender = read only
- [x] SSE stream: payment.update events (8 event types: PAYMENT_INTENT_CREATED, PAYMENT_PENDING, PAYMENT_SUCCEEDED, PAYMENT_FAILED, PAYMENT_CANCELLED, PAYMENT_MANUAL_REFERENCE_RECORDED, ORDER_BALANCE_UPDATED, ORDER_AUTO_SETTLED)
- [x] Seed: 3 new permissions + role mappings, manual-reference demo payment (MOMO/MANUAL_REFERENCE/UNVERIFIED), enhanced MTN intent demo (externalId, customerPhone, amounts, msisdn)
- [x] Unit tests: 39 tests in payments.service.spec.ts (all M13 tests preserved + 14 new: pending intent blocking, already-paid tracking, idempotency, MTN adapter integration, MTN failure handling, SSE events, webhook auto-settle, manual-reference CRUD, dedupe, auto-settle, VOIDED rejection, intent get/status)
- [x] E2e tests: 23 tests in payments.e2e-spec.ts (all M13 tests preserved + 10 new: manual-reference create/list/filter/403, intent get/status, order balance info, duplicate manual-reference 409)
- [x] Postman: M13_1-MTN-Native-Manual-Reference collection (19 requests) with test scripts
- [x] Docs updated: AI_STATUS.md (M13.1 checklist)
- [ ] DONE checks: pending Neon connectivity for migration/seed verification

### M14 — Refunds + Post-Close Void Flows

- [x] Prisma schema: RefundStatus enum (PENDING/APPROVED/COMPLETED/FAILED), Refund model (14 fields, 8 indexes), relations on Organization, Branch, Order, Payment, User (refundsCreated/refundsApproved)
- [x] Migration: 20260325100000_m14_refunds_voids (SQL created manually)
- [x] RefundsModule: refunds.module.ts, refunds.service.ts, refunds.controller.ts, dto/ (CreateRefundDto, ApproveRefundDto, PostCloseVoidDto)
- [x] Refund creation: POST /pos/orders/:id/refunds — only CLOSED orders, validates payment exists + COMPLETED, amount ≤ remaining balance
- [x] Auto-complete: refund amount ≤ OrgSettings.discountApprovalThreshold → COMPLETED immediately
- [x] Pending flow: large refunds → PENDING → manager approve with optional PIN verification
- [x] Approve refund: POST /pos/refunds/:id/approve — PENDING → COMPLETED, optional manager PIN (bcrypt against quickPinHash)
- [x] Get refund: GET /pos/refunds/:id — includes createdBy user info
- [x] List order refunds: GET /pos/orders/:id/refunds — ordered by createdAt DESC
- [x] Post-close void: POST /pos/orders/:id/post-close-void — CLOSED → VOIDED within 15-minute window, requires manager PIN, voids all payments in transaction
- [x] Payment status tracking: checkAndMarkPaymentRefunded() marks payment REFUNDED when total refunds ≥ payment amount
- [x] Anomaly flagging: highValueRefund flag on order.anomalyFlags for above-threshold refunds
- [x] 4 new permissions: pos:refund:create, pos:refund:approve, pos:refund:read, pos:void:postclose
- [x] Role-permission matrix: Owner/Manager/Supervisor = all 4; Cashier/Waiter = create + read; Chef/Bartender/Accountant = read only
- [x] Audit events: REFUND_AUTO_COMPLETED, REFUND_REQUESTED, REFUND_APPROVED, ORDER_POST_CLOSE_VOIDED
- [x] Seed: 4 permissions + role mappings for all roles
- [x] Unit tests: 16 tests in refunds.service.spec.ts (auto-complete, pending, approve, PIN, reject excess, order state checks, post-close void, window expiry, list, get)
- [x] E2e tests: 11 tests in refunds.e2e-spec.ts (create, get, list, state check, excess amount, high-value, approve, post-close void, validation, RBAC)
- [x] CI: .github/workflows/branch-validation.yml (lint + unit on push, e2e on PR)
- [x] Postman: M14-Refunds-Voids collection (18 steps, 25 pm.test assertions — fixed lifecycle URLs + auto-complete threshold logic)
- [x] Docs updated: ARCHITECTURE.md (M14 section), API_CONVENTIONS.md (refund endpoints), MODULES.md (Refunds → Implemented)
- [x] DONE: migration applied to Neon (17/17 migrations up to date), seed idempotent (2× confirmed), e2e 11/11 passing
- [x] Full e2e gate: 14/14 suites PASS, 238/238 tests PASS (EXIT:0)
- [x] Branch-wide pre-existing e2e bugs fixed: payments (stale lifecycle URLs + auto-close), orders (close payload + response shape + TAKEAWAY guard), kds (HTTP 201 status + timeouts), inventory (unitCost decimal regex + Decimal serialization), quick-pin (self-healing PIN issuance in beforeAll); global 10000/15000 ms per-test timeouts raised to 30000 ms across all spec files

### M15 — Shifts / Till Sessions / Cash Reconciliation

> Branch: `milestone/m15-shifts-tills-reconciliation`

- [x] Prisma schema: 4 enums (ShiftStatus, TillSessionStatus, CashMovementType, VarianceStatus) + 4 models (Shift, TillSession, CashMovement, ShiftCloseSummary)
- [x] Migration SQL: `20260326000000_m15_shifts_tills_reconciliation` + `20260326000001_m15_fix_till_unique_partial` (partial unique index fix)
- [x] ShiftsModule: service + controller + DTOs (openShift, closeShift, getActiveShift, getShiftById, getShiftSummary)
- [x] TillsModule: service + controller + DTOs (openTill, safeDrop, reconcileTill, getActiveTill, getTillById, getTillSummary, hasActiveTillInBranch)
- [x] Expected cash formula: openingFloat + cashSales + paidIn − safeDrops − cashPickups − refundCashOut − refundPayout − paidOut
- [x] Variance tracking: MATCHED / SHORT / OVER with mandatory reason on mismatch
- [x] ShiftCloseSummary auto-generation on shift close (aggregates payments by method, refunds, cash movements)
- [x] 7 new permissions: pos:shift:open/close/read, pos:till:open/reconcile/safe-drop/read
- [x] Role mappings: Owner/Manager/Supervisor/Cashier/Waiter = full ops; Chef/Bartender/Accountant = read-only (41 role-permission mappings)
- [x] Unit tests: 29 new (14 shifts + 15 tills); 294 total across 19 suites — all passing
- [x] E2E tests: 22 in shifts-tills.e2e-spec.ts — full lifecycle + cleanup. Full suite: 227/227 pass (orders/inventory = pre-existing Neon P1017 flakiness, 33/33 in isolation)
- [x] Seed: 7 permissions + 41 role mappings + demo shifts/tills/cash movements/summary data (idempotent, 2× confirmed)
- [x] Postman: M15-Shifts-Tills-Reconciliation.postman_collection.json (15 requests with auto-capture + assertions)
- [x] Docs updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md
- [x] Policy hook: `hasActiveTillInBranch()` implemented for future cash-payment gating (not wired into payments service yet — deferred)
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] Append-only CashMovement pattern (no updatedAt, no deletes)
- [x] Lint: 0 errors, 0 warnings (exit 0) — 4 pre-existing unused-var fixes applied in E2E test files
- [x] Manual endpoint hits: All 11 M15 endpoints verified (correct status codes + response shapes)
- [x] dev:api boots: All 11 routes registered, health OK
- [x] DB verified: shift_perms=3, till_perms=4, shifts=2, tills=2, summaries=1, no duplicates
- [x] Schema fix: `@@unique([branchId, tillCode, status])` replaced with partial unique `WHERE status='OPEN'` via migration 20260326000001
- [x] DONE: All 16 verification gates confirmed ✅

### M16 — Reservations + Deposits + Seating Bridge

> Branch: `milestone/m16-reservations-deposits-seating`

- [x] Prisma schema: 4 enums (ReservationStatus, ReservationSource, ReservationDepositStatus, ReservationEventType) + 3 models (Reservation, ReservationDeposit, ReservationEvent)
- [x] Migration SQL: `20260326100000_m16_reservations_deposits_seating`
- [x] ReservationsModule: service + controller + 8 DTOs (create, confirm, seat, cancel, noShow, recordDeposit, listQuery, assignTable)
- [x] 12 endpoints: CRUD + lifecycle transitions + deposits + events + assign-table
- [x] State machine: PENDING → CONFIRMED → SEATED → COMPLETED; cancel/no-show from PENDING/CONFIRMED
- [x] Seating bridge: `createOrder: true` creates DINE_IN order linked via `seatedOrderId`
- [x] Table conflict detection: overlap check by time window (reservationAt ± expectedDurationMinutes)
- [x] Deposit lifecycle: PENDING → RECEIVED → APPLIED/REFUNDED/FORFEITED/VOIDED
- [x] 10 new permissions: pos:reservation:create/read/confirm/seat/cancel/no-show/deposit:record/deposit:read/update/table:assign
- [x] Role mappings: Owner/Manager/Supervisor/Event Manager = all 10; Cashier/Waiter = 7 (create/read/confirm/seat/deposit:record/deposit:read/table:assign); Chef/Bartender = read; Accountant = read+deposit:read
- [x] Unit tests: 24 in reservations.service.spec.ts — all lifecycle + guard scenarios
- [x] E2E tests: reservations.e2e-spec.ts — full lifecycle + seating bridge + permission denial + state machine enforcement
- [x] Seed: 10 permissions + role mappings + 5 demo reservations (PENDING, CONFIRMED+deposit, SEATED, CANCELLED, NO_SHOW)
- [x] Postman: M16-Reservations-Deposits-Seating.postman_collection.json (14 requests with auto-capture + assertions)
- [x] Docs updated: ARCHITECTURE.md (M16 section), API_CONVENTIONS.md (12 endpoints), MODULES.md (Implemented)
- [x] Event log: append-only ReservationEvent for full audit trail
- [x] Reservation number format: RES-XXXXXX (branch-scoped, sequential)
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] Prisma generate: v5.22.0 client generated ✅
- [x] Prisma migrate deploy: migration applied ✅
- [x] Seed 2×: idempotent (10 perms, 58 role-perm mappings, 5 reservations, 1 deposit) ✅
- [x] DB verified: 10 perms, 58 role-perm mappings, 5 reservations (PENDING/CONFIRMED/SEATED/CANCELLED/NO_SHOW) ✅
- [x] Lint: 0 errors, 197 warnings (all pre-existing `no-explicit-any`) ✅
- [x] Unit tests: 319/319 pass across 20 suites ✅
- [x] E2E tests: 281/281 pass across 16 suites ✅
- [x] CI workflow: branch-validation.yml covers lint + unit on push, e2e on PR ✅
- [x] dev:api boots: 12 M16 routes registered, health OK ✅
- [x] Manual endpoint hits: 16/16 passed (all lifecycle + deposits + events + seat with table) ✅
- [x] Postman: 14 requests with auto-capture + assertions ✅
- [x] DONE: All verification gates confirmed ✅

### M17 — Events + Booking Portal + Ticketing

> Branch: `milestone/m17-events-booking-ticketing`

- [x] Prisma schema: 5 enums (EventStatus, EventBookingStatus, TicketStatus, TicketClassType, CheckInStatus) + 6 models (Event, EventTicketClass, EventBooking, EventTicket, EventCheckIn, EventAuditLog)
- [x] Migration SQL: `20260326200000_m17_events_booking_ticketing`
- [x] EventsModule: service + controller + 10 DTOs (create-event, update-event, publish-event, close-event, create-ticket-class, create-booking, cancel-booking, issue-tickets, check-in-ticket, list-events-query)
- [x] 16 endpoints: CRUD + lifecycle (publish/close) + ticket classes + bookings + ticket issuance + check-in + portal
- [x] State machine: DRAFT → PUBLISHED → OPEN → CLOSED/COMPLETED/CANCELLED
- [x] Booking flow: capacity validation, booking window enforcement, CONFIRMED status, sold count tracking
- [x] Ticket issuance: unique QR tokens (crypto.randomBytes), duplicate prevention, TKT-XXXXXX numbering
- [x] Check-in: ADMITTED/DUPLICATE/DENIED logging, auto-completes booking when all tickets checked in
- [x] Portal endpoint: GET /events/portal/:portalKey — public-safe subset with ticket class availability
- [x] Event number format: EVT-XXXXXX, booking: BKG-XXXXXX, ticket: TKT-XXXXXX (branch-scoped, sequential)
- [x] EventAuditLog: dedicated audit table for event lifecycle actions
- [x] 12 new permissions: pos:event:create/read/update/publish/close, pos:event:booking:create/read/cancel, pos:event:ticket:issue/read, pos:event:checkin, pos:event:portal:read
- [x] Role mappings: Owner/Manager/Supervisor get all 12; Cashier/Waiter get 8 (read + booking + ticketing + checkin + portal); Chef/Bartender get read only; Accountant gets read + booking:read + ticket:read
- [x] Unit tests: 19 in events.service.spec.ts — all passing
- [x] E2E tests: events.e2e-spec.ts — full lifecycle + portal + permission denial
- [x] Seed: 12 permissions + role mappings for all roles + 3 demo events (DRAFT, OPEN with full booking/ticket/checkin chain, CANCELLED)
- [x] Postman: M17-Events-Booking-Portal-Ticketing.postman_collection.json (18 requests with auto-capture + assertions)
- [x] Docs updated: ARCHITECTURE.md (M17 section), API_CONVENTIONS.md (16 endpoints), MODULES.md (Events → Implemented)
- [x] Prisma generate: v5.22.0 client generated ✅
- [x] Prisma migrate deploy: migration applied (21 total) ✅
- [x] Seed 2×: idempotent (12 perms, role mappings, 3 events) ✅
- [x] Lint: 0 errors, 219 warnings (all pre-existing `no-explicit-any`) ✅
- [x] Unit tests: 338/338 pass across 21 suites ✅
- [x] E2E tests: 26/26 M17 e2e tests pass ✅
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M18 — Anomaly Detection + Anti-Theft Signals

- [x] Prisma schema: AnomalySeverity/AnomalyStatus/AnomalyRuleType enums, AnomalyRule model, AnomalyEvent model, RiskThreshold model
- [x] Migration applied (22 total)
- [x] AnalyticsModule: anomaly rules CRUD, event detection, acknowledge/recalculate, risk dashboard, thresholds
- [x] Seed: 8 permissions + role mappings + 6 risk thresholds + 5 anomaly rules + 1 demo AnomalyEvent
- [x] Unit tests: analytics.service.spec.ts
- [x] E2E tests: analytics.e2e-spec.ts
- [x] Postman: M18-Anomaly-Detection-Anti-Theft.postman_collection.json
- [x] Docs updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M19 — Operational Dashboards + KPI Streams

- [x] Prisma schema: KpiScopeType/KpiMetricWindow/KpiSubscriptionStatus enums, KpiSnapshot model, KpiSubscription model
- [x] Migration: 20260327100000_m19_dashboards_kpi_streams (23 total)
- [x] DashboardsModule + StreamController: 8 REST endpoints + 1 SSE stream
- [x] Live aggregation from Order, Payment, Refund, InventoryItem, AnomalyEvent, Reservation, Event, Shift, TillSession
- [x] 5 permissions: pos:dash:owner:read, pos:dash:manager:read, pos:dash:today-summary:read, pos:dash:stream:read, pos:dash:kpi:refresh
- [x] Role mappings: Owner (5), Manager (4), Accountant (1), Supervisor (3)
- [x] Seed: 5 permissions + role mappings + 1 KpiSnapshot + 1 KpiSubscription
- [x] Unit tests: 13 in dashboards.service.spec.ts — all passing
- [x] E2E tests: 14 in dashboards.e2e-spec.ts — all passing
- [x] Postman: M19-Operational-Dashboards-KPI-Streams.postman_collection.json (16 requests)
- [x] Docs updated: ARCHITECTURE.md, API_CONVENTIONS.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md (new)
- [x] Prisma generate: v5.22.0 client generated ✅
- [x] Prisma migrate status: 23 migrations applied, schema up to date ✅
- [x] Seed 2×: idempotent (0 created on second run) ✅
- [x] Lint: 0 errors, 273 warnings (all pre-existing `no-explicit-any`) ✅
- [x] Unit tests: 370/370 pass across 23 suites ✅
- [x] E2E tests: 337/337 pass across 19 suites ✅
- [x] Manual API: all 9 endpoints verified (owner, manager, today-summary, payment-mix, open-orders, low-stock, snapshots, kpi/refresh, stream/metrics)
- [x] Permission denial: Chef gets 403 on owner/manager/refresh ✅
- [x] Missing branch header: 400 ✅
- [x] Unauthenticated: 401 ✅
- [x] Postman contract: baseUrl=http://localhost:3001, all pm.environment.set/get, no violations ✅
- [x] CI: .github/workflows/branch-validation.yml validated ✅
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M20 — Reporting v1 + Exports

- [x] Branch: milestone/m20-reporting-exports
- [x] Schema: ReportRun + ExportArtifact models, 5 enums (ReportType, ReportWindow, ExportFormat, ReportRunStatus, ExportArtifactStatus)
- [x] Migration: 20260327200000_m20_reporting_exports (migration 24)
- [x] Prisma generate: v5.22.0 ✅
- [x] DTOs: 8 validation DTOs (shift-end, daily-sales, payment-mix, top-items, stock-variance, anomaly-summary, export, list-query)
- [x] Service: reports.service.ts — 6 report generators + list + get + export + download
- [x] Controller: reports.controller.ts — 10 endpoints under /api/reports
- [x] Module: reports.module.ts registered in app.module.ts
- [x] Permissions: 11 new (shift-end:generate, daily-sales:generate, payment-mix:generate, top-items:generate, stock-variance:generate, anomaly-summary:generate, reservation-summary:generate, event-summary:generate, exports:read, exports:download, history:read)
- [x] Seed: 11 permissions + role mappings (Owner, Manager, Accountant, Supervisor) + sample ReportRun + ExportArtifact
- [x] Unit tests: reports.service.spec.ts — 16 tests
- [x] E2E tests: reports.e2e-spec.ts — 14 tests
- [x] Postman: M20-Reporting-v1-Exports.postman_collection.json (16 requests)
- [x] Docs: ARCHITECTURE.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md updated
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All verification gates confirmed ✅

### M20.1 — Reporting Depth Expansion + Finalization

- [x] Branch: milestone/m20-1-reporting-depth-finalization
- [x] Schema: ReportType enum expanded from 8 → 25 values (17 new types)
- [x] Migration: 20260328000000_m20_1_reporting_depth (migration 25)
- [x] Prisma generate: v5.22.0 ✅
- [x] DTOs: 12 new validation DTOs (sales-by-category, sales-by-hour, discounts, voids, refunds, cash-variance, cash-movements, wastage, low-stock, reservation-summary, event-summary, staff-operations)
- [x] Service: rewritten with 20+ report generators + GET /catalog endpoint
- [x] Controller: rewritten with 24+ endpoints (18 new generate + 1 catalog)
- [x] Permissions: 13 new (sales-by-category:generate, sales-by-hour:generate, discounts:generate, voids:generate, refunds:generate, cash-variance:generate, cash-movements:generate, wastage:generate, low-stock:generate, reservations:generate, events:generate, staff-operations:generate, catalog:read)
- [x] Seed: 13 new permissions + updated role mappings (Owner, Manager, Accountant, Supervisor); optimized RolePermissions to batch queries (3 queries instead of ~1243)
- [x] Unit tests: reports.service.spec.ts — 39 tests (20 new)
- [x] E2e tests: reports.e2e-spec.ts — 39 tests (22 new)
- [x] Postman: M20_1-Reporting-Depth-Finalization.postman_collection.json (24 requests)
- [x] Docs: REPORT_CATALOG_GUIDE.md created; API_CONVENTIONS.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md, AI_STATUS.md updated
- [x] TypeScript: 0 errors, ESLint: 0 errors
- [x] Seed x2 idempotent ✅
- [x] M13.1 (MTN native) = PENDING
- [x] M13.2 (Airtel native) = PENDING
- [x] DONE: All M20.1 verification gates confirmed ✅

### M21+

### M21 — Customer Feedback + NPS + QR Follow-up ✅

- [x] Prisma schema: 5 enums + 4 models (Feedback, FeedbackTag, NpsSummary, FeedbackRequest)
- [x] Migration #26: `20260329000000_m21_feedback_nps_qr_followup`
- [x] DTOs: 7 + barrel export
- [x] Service: `feedback.service.ts` — 15 methods
- [x] Admin controller: 10 endpoints (auth + branch-scoped)
- [x] Public controller: 2 endpoints (no auth, token-protected)
- [x] Module registered in `app.module.ts`
- [x] Permissions: 9 new (pos:feedback:\*) — 122 total
- [x] Role-permission matrix: 33 new mappings — 524 total
- [x] Unit tests: 34/34 passing
- [x] E2e tests: 25/25 passing
- [x] Seed: idempotent (verified x2)
- [x] TypeScript: `tsc --noEmit` → 0 errors
- [x] ESLint: 0 errors (15 pre-existing no-explicit-any warnings)
- [x] Postman collection: M21-Customer-Feedback-NPS-QR-Followup (14 requests)
- [x] Docs: FEEDBACK_NPS_GUIDE.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md, repo file tree.txt updated
- [x] Public flow: safe — no orgId/token/internal ID leaks in public responses
- [x] Guard coverage: 401 (no auth), 400 (missing branch / invalid payload), 403 (insufficient permissions), 409 (duplicate submit) all verified
- [x] CI: branch-validation.yml exists and is valid
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M21 closure gates confirmed ✅

### M22+

### M22 — Documents + Uploads + Attachments ✅

- [x] Prisma schema: 4 enums + 3 models (Document, DocumentLink, StorageProviderConfig)
- [x] Migration #27: `20260330000000_m22_documents_uploads_attachments`
- [x] DTOs: 5 + barrel export
- [x] Service: `documents.service.ts` — 10 methods (upload, list, get, download, delete, link, getLinks, updateMetadata, getStorageConfig, updateStorageConfig)
- [x] Controller: 10 endpoints (auth + branch-scoped, multipart upload)
- [x] Module registered in `app.module.ts` (27 modules total)
- [x] Permissions: 8 new (pos:documents:*) — 130 total
- [x] Role-permission matrix updated for all roles
- [x] Unit tests: documents.service.spec.ts
- [x] E2e tests: documents.e2e-spec.ts
- [x] Seed: idempotent — StorageProviderConfig + 3 sample documents
- [x] Postman collection: M22-Documents-Uploads-Attachments (13 requests)
- [x] Docs: DOCUMENTS_ATTACHMENTS_GUIDE.md created
- [x] Audit events: DOCUMENT_UPLOADED, DOCUMENT_DEDUPE_HIT, DOCUMENT_LINKED, DOCUMENT_DELETED, DOCUMENT_DOWNLOAD_ACCESSED, DOCUMENT_ACCESS_DENIED, DOCUMENT_METADATA_UPDATED, STORAGE_CONFIG_UPDATED
- [x] Checksum dedup: SHA-256 per-org + ACTIVE status check
- [x] File storage: LOCAL filesystem at uploads/{orgId}/{uuid}{ext}
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M22 closure gates confirmed ✅

### M23+

### M23 — Employees + Contracts + HR Core ✅

- [x] Prisma schema: 4 enums (EmployeeStatus, EmploymentType, ContractStatus, SalaryBasis) + 4 models (Employee, EmploymentContract, Position, CompensationProfile)
- [x] Migration #28: `20260330100000_m23_employees_contracts_hr_core`
- [x] DTOs: 7 + barrel export (create/update employee, list employees query, create contract, list contracts query, create position, create compensation profile)
- [x] Service: `hr.service.ts` — 10 methods (createEmployee, updateEmployee, listEmployees, getEmployee, createContract, listContracts, createPosition, listPositions, createCompensationProfile, listCompensationProfiles)
- [x] Controller: 10 endpoints under `/hr` prefix (auth + branch-scoped)
- [x] Module registered in `app.module.ts` (28 modules total)
- [x] Permissions: 9 new (pos:hr:*) — 139 total
- [x] Role-permission matrix updated for Owner, Manager, Accountant, Supervisor
- [x] Unit tests: hr.service.spec.ts (26 tests)
- [x] E2e tests: hr.e2e-spec.ts (20+ tests)
- [x] Seed: idempotent — 8 positions, 4 compensation profiles, 4 employees, 3 contracts
- [x] Postman collection: M23-Employees-Contracts-HR-Core (13 requests)
- [x] Audit events: EMPLOYEE_CREATED, EMPLOYEE_UPDATED, CONTRACT_CREATED, POSITION_CREATED, COMPENSATION_PROFILE_CREATED
- [x] Auto-generation: employee codes (EMP-XXXXX) and contract numbers (CTR-XXXXX)
- [x] Validation: unique codes per org, userId linkage check, position/profile org-scoping
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M23 closure gates confirmed ✅

### M24 — Attendance + Leave + Shift Swaps

- [x] Schema: 4 enums (AttendanceStatus, LeaveRequestStatus, LeaveType, ShiftSwapStatus) + 4 models (AttendanceRecord, LeaveRequest, ShiftSwapRequest, AttendancePolicy)
- [x] Migration #30: `20260330200000_m24_attendance_leave_shift_swaps` — applied to Neon
- [x] DTOs: 10 DTO files + barrel index in `apps/api/src/modules/attendance/dto/`
- [x] Service: `attendance.service.ts` — 11 methods (clock in/out, leave CRUD + review, shift swap CRUD + approve, policy CRUD)
- [x] Controller: `attendance.controller.ts` — 11 endpoints under `/api/hr`
- [x] Module: `attendance.module.ts` — registered in `app.module.ts`
- [x] Permissions: 11 new (pos:hr:attendance:clock, :read, pos:hr:leave:create, :read, :review, pos:hr:shift-swaps:create, :read, :approve, pos:hr:attendance-policy:read, :create, :update)
- [x] Role matrix: Owner (all 11), Manager (9), Supervisor (10), Cashier (7), Waiter (7), Accountant (2)
- [x] Seed: seedAttendanceData() — 1 policy, 2 attendance records, 1 leave request, 1 shift swap
- [x] Unit tests: 36 pass (attendance.service.spec.ts)
- [x] E2E tests: 36 pass (attendance.e2e-spec.ts)
- [x] Postman: M24-Attendance-Leave-Shift-Swaps.postman_collection.json (15 requests)
- [x] Docs: ARCHITECTURE.md, MODULES.md, POSTMAN_ENDPOINT_GUIDE.md, HR_CORE_GUIDE.md, ATTENDANCE_LEAVE_SWAPS_GUIDE.md updated
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M24 closure gates confirmed ✅

### M25 — Scheduling + Templates + Duty Roster

- [x] Schema: 3 enums (ScheduleStatus, CoverageRuleStatus, CoverageSeverity) + 4 models (ShiftTemplate, Schedule, ScheduleAssignment, CoverageRule)
- [x] Migration #31: `20260331000000_m25_scheduling_templates_duty_roster` — Applied ✅
- [x] Module: `WorkforceModule` — controller + service + 7 DTOs
- [x] Endpoints: 11 (POST/GET templates, POST/GET/GET:id schedules, PATCH publish, PATCH archive, GET roster, POST/GET coverage-rules, GET coverage-gaps)
- [x] Permissions: 7 new (`pos:workforce:templates:read/create`, `pos:workforce:schedules:read/create/publish`, `pos:workforce:coverage-rules:read/create`)
- [x] Role matrix updated: Owner/Manager (full), Supervisor (read + create schedules), Cashier/Waiter (read-only)
- [x] Unit tests: 31 tests in `workforce.service.spec.ts` — all pass ✅
- [x] E2e tests: `workforce.e2e-spec.ts` — 32 tests, all pass ✅
- [x] Seed: 4 shift templates, 2 schedules (1 DRAFT + 1 PUBLISHED), 1 coverage rule, 7 permissions
- [x] Postman: `M25-Scheduling-Templates-Duty-Roster.postman_collection.json` (13 requests)
- [x] Docs: MODULES.md, AI_STATUS.md, POSTMAN_ENDPOINT_GUIDE.md, SCHEDULING_ROSTER_GUIDE.md updated
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M25 closure gates confirmed ✅

### M26 — Payroll Engine + Pay Runs + Payslips

- [x] Schema: 4 enums (PayRunStatus, PayComponentType, PaySlipStatus, PayrollAdjustmentType) + 4 models (PayComponent, PayrollAdjustment, PayRun, PaySlip)
- [x] Migration #32: `20260401000000_m26_payroll_engine_pay_runs_payslips` — SQL created
- [x] Module: `PayrollModule` — controller + service + 6 DTOs
- [x] Endpoints: 11 (POST/GET components, POST/GET adjustments, POST build, PATCH approve, PATCH pay, GET/GET:id runs, GET/GET:id slips)
- [x] Permissions: 9 new (`pos:payroll:components:read/create`, `pos:payroll:adjustments:read/create`, `pos:payroll:runs:read/build/approve/pay`, `pos:payroll:slips:read`)
- [x] Role matrix updated: Owner (full), Manager (all except pay), Accountant (read-only), Supervisor (read + adjustments), Cashier/Waiter (slips:read)
- [x] Unit tests: 24 tests in `payroll.service.spec.ts`
- [x] E2e tests: `payroll.e2e-spec.ts` — 20 tests
- [x] Seed: 6 pay components, 1 demo adjustment, idempotent
- [x] Postman: `M26-Payroll-Engine-Pay-Runs-Payslips.postman_collection.json` (13 requests)
- [x] Docs: PAYROLL_PAYRUNS_PAYSLIPS_GUIDE.md, M26_COMPLETION_REPORT.md, AI_STATUS.md updated
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M26 closure gates confirmed ✅

### M27 — Staff Insights + Awards + Promotion Suggestions

- [x] Schema: 3 enums (StaffInsightStatus, AwardType, PromotionSuggestionStatus) + 3 models (StaffInsightSnapshot, StaffAward, PromotionSuggestion)
- [x] Migration #33: `20260401100000_m27_staff_insights_awards_promotions` — SQL created and applied
- [x] Module: `StaffInsightsModule` — controller + service + 5 DTOs
- [x] Endpoints: 10 (GET/PATCH weights, POST generate/GET/GET:id insights, POST/GET awards, POST generate/GET/PATCH:id suggestions)
- [x] Permissions: 7 new (`pos:staff:insights:read`, `pos:staff:awards:create/read`, `pos:staff:promotions:generate/decide`, `pos:staff:weights:read/update`)
- [x] Role matrix updated: Owner (full 7), Manager (6, no weights:update), Supervisor (insights:read + awards:read), Accountant (none)
- [x] Unit tests: `staff-insights.service.spec.ts` — 20 tests covering all service methods + error paths
- [x] E2e tests: `staff-insights.e2e-spec.ts` — 20 tests covering all endpoints
- [x] Seed: 1 insight snapshot, 1 award, 1 promotion suggestion, idempotent
- [x] Postman: `M27-Staff-Insights-Awards-Promotion-Suggestions.postman_collection.json` (10 requests)
- [x] Docs: STAFF_INSIGHTS_GUIDE.md, M27_COMPLETION_REPORT.md, AI_STATUS.md updated
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M27 closure gates confirmed ✅

### M32 — Accounting Foundation (COA + Cost Centers + Fiscal Periods)

> ROADMAP M32 = internal AI_STATUS M28. See reconciliation table above.

- [x] Schema: 3 enums (AccountType, AccountStatus, FiscalPeriodStatus) + 5 models (Account, CostCenter, FiscalPeriod, PostingSourceMap, TaxLedgerConfig)
- [x] Migration #34: `20260402000000_m28_accounting_foundation_coa_cost_centers_periods` — SQL created and applied
- [x] Module: `AccountingModule` — controller + service + 7 DTOs
- [x] Endpoints: 11 (GET/POST accounts, GET/POST cost-centers, GET/POST/PATCH periods, GET/PATCH posting-source-maps, GET/PATCH tax-config)
- [x] Permissions: 11 new (`pos:accounting:accounts:read/create`, `cost-centers:read/create`, `periods:read/create/open`, `posting-source-maps:read/update`, `tax-config:read/update`)
- [x] Role matrix updated: Owner (all 11), Accountant (all 11), Manager (read + create subset)
- [x] Unit tests: `accounting.service.spec.ts` — 26 tests covering all service methods + error paths
- [x] E2e tests: `accounting.e2e-spec.ts` — 20+ tests covering all endpoints
- [x] Seed: 13 system accounts (cash/bank/inventory/AR/AP/equity/revenue/COGS/discounts/tax/deposits/payroll), 1 cost center, 1 fiscal period (OPEN), 9 posting source maps (ORDER_REVENUE, PAYMENT_RECEIVED, REFUND_ISSUED, GOODS_RECEIPT, WASTAGE_ADJUSTMENT, PAYROLL_EXPENSE, DEPOSIT_COLLECTED, VENDOR_BILL_PAYABLE, AR_INVOICE_RECEIVABLE), 1 tax config — idempotent
- [x] Postman: `M28-Accounting-Foundation-COA-Cost-Centers-Periods.postman_collection.json` (15 requests)
- [x] Docs: ACCOUNTING_FOUNDATION_GUIDE.md, AI_STATUS.md updated
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M32 closure gates confirmed ✅

### M29+

Track each milestone in order as it is completed. Add one checklist block per milestone as implementation proceeds.

### M30 — Payroll Engine + Pay Runs + Payslips ✅

> ROADMAP M30 = internal AI_STATUS M26. See reconciliation table above.

- [x] Prisma schema: 4 enums (PayRunStatus, PayComponentType, PaySlipStatus, PayrollAdjustmentType) + 4 models (PayComponent, PayrollAdjustment, PayRun, PaySlip)
- [x] Migration #32: `20260401000000_m26_payroll_engine_pay_runs_payslips` — applied to Neon ✅
- [x] Module: `PayrollModule` — controller + service + 7 DTOs
- [x] Endpoints: 13 (POST/GET components, POST/GET adjustments, POST build, PATCH approve, PATCH pay, GET/GET:id runs, GET/GET:id slips, GET/GET:id payslips — ROADMAP canonical aliases added)
- [x] Minimum API surface per ROADMAP M30:
  - POST /payroll/runs/build ✅
  - PATCH /payroll/runs/:id/approve ✅
  - PATCH /payroll/runs/:id/pay ✅
  - GET /payroll/payslips/:id ✅ (alias added; also available as /payroll/slips/:id)
- [x] Payroll calculation engine: base pay from CompensationProfile, earning/deduction components, adjustments (BONUS/OVERTIME/DEDUCTION/PENALTY/ADVANCE), gross/net computation, component snapshot freeze
- [x] State machine: DRAFT → APPROVED → PAID; blocking on invalid transitions
- [x] Posting-ready payload: postingPayload JSON stored on PayRun on pay event; GL posting deferred
- [x] Snapshot reproducibility: componentSnapshot immutable per payslip (frozen at build time, locked at APPROVED)
- [x] Permissions: 9 (`pos:payroll:components:read/create`, `pos:payroll:adjustments:read/create`, `pos:payroll:runs:read/build/approve/pay`, `pos:payroll:slips:read`)
- [x] Role matrix: Owner (full), Manager (all except pay), Accountant (read-only), Supervisor (read + adjustments), Cashier/Waiter (slips:read)
- [x] Audit events: PAY_COMPONENT_CREATED, PAYROLL_ADJUSTMENT_CREATED, PAY_RUN_BUILT, PAY_RUN_APPROVED, PAY_RUN_PAID
- [x] Unit tests: 24 in `payroll.service.spec.ts` — all passing
- [x] E2e tests: `payroll.e2e-spec.ts` — 20 tests covering all endpoints + state machine + error cases
- [x] Seed: 6 pay components (Basic Salary, Housing, Transport, NSSF, PAYE, Loan Recovery), 1 demo adjustment — idempotent
- [x] Postman: `M30-Payroll-Engine-Pay-Runs-Payslips.postman_collection.json` (25 requests including error cases + canonical /payslips alias)
- [x] Docs: PAYROLL_PAYRUNS_PAYSLIPS_GUIDE.md created
- [x] M13.1 (MTN native) = PENDING (untouched)
- [x] M13.2 (Airtel native) = PENDING (untouched)
- [x] DONE: All M30 closure gates confirmed ✅ (2026-04-03: migration applied, seed ×2 idempotent, 24 unit + 20 e2e passing, lint 0 errors, /payslips alias added)

### M34 — Accounts Payable + Vendor Bills + Payments ✅ (EXPANDED)

- [x] Prisma schema: 7 enums (BillStatus, VendorPaymentStatus, VendorPaymentMethod, CreditNoteType, CounterpartyType, RecurrenceCadence, PayableReminderStatus) + 8 models (Supplier, VendorBill, VendorBillLine, VendorPayment, VendorPaymentAllocation, CreditNote, RecurringBillProfile, PayableReminder)
- [x] VendorBillSourceType expanded: RECURRING, ONE_OFF_EVENT, UTILITY, SUBSCRIPTION
- [x] Supplier expanded: counterpartyType (9 types), paymentTermDays, bankName, bankAccountNo
- [x] VendorBill expanded: servicePeriodStart/End, recurringProfileId FK
- [x] Migration #36: `20260406000000_m34_accounts_payable` — SQL applied ✅
- [x] Migrations #40-43: m34_expanded_ap, m34_enum_source_types, m34_fix_source_type_column, m34_expected_amount_required
- [x] Module: `AccountsPayableModule` — 18 endpoints, 10 permissions
- [x] New endpoints: POST/GET/PATCH recurring-profiles, POST generate-bill, POST/GET reminders, POST dismiss
- [x] AP aging summary (current/0-30/31-60/61-90/90+ buckets per supplier)
- [x] Bill filters: dueSoonDays, counterpartyType, recurring
- [x] Recurring bill generation with duplicate prevention + auto-advance nextDueDate
- [x] Payable reminder generation for due-soon bills (idempotent per bill)
- [x] GL journal integration: Dr:AP Cr:Cash on payment
- [x] Unit tests: 40 | E2e tests: 55+
- [x] Seed: 5 suppliers (INVENTORY_SUPPLIER, UTILITY_PROVIDER, SERVICE_PROVIDER, ENTERTAINER), recurring profile, event bill
- [x] Postman: `M34-Accounts-Payable-Vendor-Bills-Payments.postman_collection.json` (expanded)
- [x] DONE: All M34 closure gates confirmed ✅

### M35 — Accounts Receivable + Invoicing + Direct Bill ✅

- [x] Prisma schema: 6 enums (CustomerAccountStatus, InvoiceStatus, InvoiceType, ArReceiptStatus, ArReceiptMethod, ArCreditNoteStatus) + 6 models (CustomerAccount, Invoice, InvoiceLine, ArReceipt, ReceiptAllocation, ArCreditNote)
- [x] Migration #37: `20260407000000_m35_accounts_receivable` — SQL applied ✅
- [x] Module: `AccountsReceivableModule` — 10 endpoints, 8 permissions
- [x] Aging summary: 5-bucket per-account (current/0-30/31-60/61-90/90+)
- [x] GL posting on receipt: Dr:Cash Cr:AR
- [x] Auto-status: ISSUED → PARTIALLY_PAID → PAID
- [x] Unit tests: 25+ | E2e tests: 30+
- [x] Postman: `M35-AR-Receivable.postman_collection.json`
- [x] DONE: All M35 closure gates confirmed ✅

### M36 — Bank Reconciliation + Period Close + Locks ✅ (REBUILT — simplified)

- [x] Prisma schema: 5 enums (BankAccountStatus, BankStatementStatus, BankStatementLineStatus, BankStatementLineDirection, ReconciliationStatus) + 6 models (BankAccount, BankStatement, BankStatementLine, BankReconciliation, ManualBankEntry, PeriodCloseRun)
- [x] Migration: `20260412100000_m36_simplified_bank_rec` — SQL ready ✅ (old expanded migration removed)
- [x] Module: `BankRecModule` — 15 endpoints, manual-first reconciliation (no candidate scoring, no auto-matching, no exception sub-workflows)
- [x] Endpoints: bank accounts (list/create), bank statements (list/get/import), manual bank entries (create), reconciliation (list/get/create/match/skip/complete), period close (list/close/lock)
- [x] Live difference tracking: `getReconciliation` returns `difference = statementBalance - matchedTotal`
- [x] `matchLine` supports journalLineId OR manualEntryId, checks fiscal period lock
- [x] `_recomputeTotals` private helper: CREDIT adds, DEBIT subtracts for matchedTotal
- [x] `closeFiscalPeriod`: retained earnings = revenue credits - expense debits
- [x] Permissions: 7 permissions — Owner + Manager + Accountant (all except `accounting:periods:lock`)
- [x] Unit tests: 41 passing | E2e tests: 25+
- [x] Postman: `M36-Bank-Rec-Period-Close.postman_collection.json` (17 requests)
- [x] 0 lint errors, 0 prettier errors
- [x] DONE: All M36 closure gates confirmed ✅

### M37 — Budgets + Forecasts + Procurement Advisory (Refactored: Demand-Aware Planning) ✅

- [x] Prisma schema: 8 enums (BudgetStatus, BudgetType, ForecastRunStatus +RUNNING, ForecastType, ProcurementSuggestionStatus, DemandCalendarType, DaypartType, ProcurementUrgency) + 5 models (Budget, BudgetLine, ForecastRun, ProcurementSuggestion, DemandCalendarEntry)
- [x] Relations added: User, Organization, Branch, FiscalPeriod, Account, CostCenter, InventoryItem, Event → DemandCalendarEntry
- [x] Migration #39 original: `20260409000000_m37_budgets_forecasts_procurement`
- [x] Migration #40 refactor: `20260413000000_m37_demand_calendar_forecast_refactor` — new enums, DemandCalendarEntry table, ForecastRun new columns (forecastHorizonStart/End, demandSignals, daypartSummaries), ProcurementSuggestion new columns (urgency, daypart, projectedUsage, currentStock, inboundStock, safetyStock, leadTimeDays, suggestedAction, demandCalendarEntryId)
- [x] Prisma Client v5.22.0 regenerated ✅
- [x] DTOs: CreateBudgetDto, ListBudgetsQueryDto, UpdateActualsDto, ListForecastQueryDto (+horizon), CreateDemandCalendarEntryDto, UpdateDemandCalendarEntryDto, ListDemandCalendarQueryDto, ReviewProcurementSuggestionDto
- [x] Services (3):
  - `BudgetService`: listBudgets, getBudget, createBudget, updateActuals (GL actuals), listProcurementSuggestions (urgency filter), reviewProcurementSuggestion
  - `ForecastService`: getForecast (demand-aware: daypart summaries, calendar uplift, reservation overlay, BOM-based item usage, urgency classification, rationale generation)
  - `DemandCalendarService`: list, getById, create, update, delete, getEntriesForWindow
- [x] Controllers: `BudgetController` (`/finance`) + `DemandCalendarController` (`/finance`) + `ForecastController` (`/franchise`)
- [x] Endpoints (13):
  - GET /finance/budgets
  - GET /finance/budgets/:id
  - POST /finance/budgets
  - POST /finance/budgets/:id/update-actuals
  - GET /finance/demand-calendar
  - GET /finance/demand-calendar/:id
  - POST /finance/demand-calendar
  - PATCH /finance/demand-calendar/:id
  - DELETE /finance/demand-calendar/:id
  - GET /franchise/forecast
  - GET /finance/procurement-suggestions (?urgency=)
  - PATCH /finance/procurement-suggestions/:id/review
- [x] Permissions (8): `finance:budget:read`, `finance:budget:write`, `finance:budget:update-actuals`, `franchise:forecast:read`, `finance:forecast:read`, `procurement:advisory:read`, `finance:demand-calendar:read`, `finance:demand-calendar:write`
- [x] Role matrix: Owner + Manager (full including demand-calendar write); Accountant (read + demand-calendar read only)
- [x] Actuals source: `JournalLine.groupBy(['accountId'])` where `journalEntry.status=POSTED` within budget period
- [x] Forecast logic (refactored):
  - Two-layer: Financial (GL run-rate) + Operational (daypart-aware demand forecasting)
  - Daypart summaries: BREAKFAST/LUNCH/DINNER/LATE_NIGHT per day, baseline from same-weekday history
  - Calendar uplift: DemandCalendarEntry demandMultiplier & expectedCovers overlay
  - Reservation overlay: confirmed/pending reservation partySize mapped to dayparts
  - Busy detection: projectedCovers > max(1.3x baseline, baseline+20)
  - Item usage: BOM-based from RecipeIngredient → projected from cover multiplier
  - Calendar item mentions: 1.5x uplift for items in calendar itemNotes
  - Urgency: URGENT_LOCAL_BUY / STOCK_UP_BEFORE_EVENT / ORDER_NEXT_PO / MONITOR
  - All rules-based, explainable, no AI/ML
- [x] Module: `BudgetModule` wired into `app.module.ts` ✅
- [x] Unit tests: `budget.service.spec.ts`, `forecast.service.spec.ts`, `demand-calendar.service.spec.ts`
- [x] E2e tests: `budget.e2e-spec.ts` — budgets + demand calendar CRUD + forecast with operational summary + procurement review
- [x] Seed: `seedBudgetData()` — Budget (3 lines), ForecastRun, ProcurementSuggestion, DemandCalendarEntries (3: brunch, sports night, Valentine's); idempotent ✅
- [x] Permissions seeded + ROLE_PERM_MATRIX updated for Owner, Manager, Accountant ✅
- [x] Postman: `M37-Budgets-Forecasts-Procurement-Advisory.postman_collection.json` (updated with Demand Calendar section)
- [x] DONE: M37 refactoring complete ✅

### M38 — Franchise + Multi-Branch Suite ✅

- [x] Migration #40: `20260413000000_m38_franchise_multi_branch`
- [x] Schema: 6 enums (`FranchiseRankingType`, `FranchiseWindowType`, `InterBranchTransferStatus`, `InterBranchTransferType`, `TransferUrgency`, `HqDigestFrequency`) + 4 models (`FranchiseRanking`, `BranchBudgetRollup`, `InterBranchTransfer`, `HqDigestSubscription`)
- [x] Module: `franchise/` — controller, service, DTOs, module
- [x] Endpoints: GET /franchise/overview, GET /franchise/rankings, POST /franchise/rankings/generate, GET /franchise/budgets, POST /franchise/transfers, GET /franchise/transfers, GET /franchise/transfers/:id, PATCH /franchise/transfers/:id/status, GET /franchise/procurement-pressure, POST /franchise/digests, GET /franchise/digests, PATCH /franchise/digests/:id
- [x] Unit tests: `franchise.service.spec.ts` — 19 tests (resolveOrgContext, overview, rankings, rollups, transfers+state machine, digests, procurement pressure)
- [x] E2e tests: `franchise.e2e-spec.ts` — auth, overview, rankings, budgets, transfers CRUD + lifecycle, procurement pressure, digest subscriptions CRUD
- [x] Seed: `seedFranchiseData()` — FranchiseRankings (6), BranchBudgetRollup, InterBranchTransfer (TRF-000001), HqDigestSubscriptions (2); idempotent ✅
- [x] Permissions: 8 new (`franchise:overview:read`, `franchise:ranking:read`, `franchise:budget:read`, `franchise:transfer:read/write/approve`, `franchise:digest:read/write`) — mapped to Owner (all), Manager (all), Accountant (read-only) ✅
- [x] Postman: `M38-Franchise-Multi-Branch-Suite.postman_collection.json`
- [x] DONE: M38 complete ✅

### M38.1 — Franchise Analytics + Consolidation ✅

- [x] Migration #41: `20260414000000_m38_1_franchise_analytics_consolidation`
- [x] Schema: 5 new enums (`FranchiseMetricFamily`, `ConsolidationRunStatus`, `ScorecardDomain`, `PerformanceTier`, `WasteMetricType`) + 6 new `FranchiseRankingType` values + 4 new models (`FranchiseKpiSnapshot`, `FranchiseConsolidationRun`, `BranchPerformanceScorecard`, `WasteBenchmarkSnapshot`)
- [x] Module: `franchise-analytics/` — controller, service, DTOs, module (separate from M38 `franchise/`)
- [x] Endpoints: GET /franchise/consolidated-finance, POST /franchise/consolidated-finance/generate, GET /franchise/financial-comparison, GET /franchise/waste-benchmarks, POST /franchise/waste-benchmarks/generate, GET /franchise/scorecards, POST /franchise/scorecards/generate, POST /franchise/rankings/generate-deep, GET /franchise/drilldown
- [x] Unit tests: `franchise-analytics.service.spec.ts` — resolveOrgContext, consolidated finance, branch financials (prime cost calc, zero revenue), financial comparison, waste benchmarks, scorecards (7 domains, deterministic tiers), deep rankings (6 types, filtering, empty), drilldown (revenue, COGS, prime cost, validation), snapshot generation + failure, tiering determinism
- [x] E2e tests: `franchise-analytics.e2e-spec.ts` — auth 401/403, consolidated finance (default + windowed), snapshot generation, financial comparison, waste benchmarks, scorecards (7 domains, valid tiers), deep rankings (all types + determinism), drilldown (REVENUE, COGS, PRIME_COST, 400 validation)
- [x] Seed: `seedFranchiseAnalyticsData()` — FranchiseKpiSnapshots (4: REVENUE, COGS, GROSS_PROFIT, PRIME_COST), FranchiseConsolidationRun (1), BranchPerformanceScorecards (6: 3 domains × 2 branches), WasteBenchmarkSnapshots (2), Deep FranchiseRankings (6: PRIME_COST, WASTE_EFFICIENCY, GROSS_MARGIN); idempotent ✅
- [x] Permissions: 5 new (`franchise:analytics:read`, `franchise:consolidation:generate`, `franchise:waste-benchmark:read`, `franchise:scorecard:read`, `franchise:ranking:generate-deep`) — mapped to Owner (all), Manager (all), Accountant (all) ✅
- [x] Postman: `M38_1-Franchise-Analytics-Consolidation.postman_collection.json`
- [x] DONE: M38.1 complete ✅

### M39 — Billing + Subscription Plans + Dev Portal ✅

- [x] Migration #42: `20260415000000_m39_billing_subscriptions_dev_portal`
- [x] Schema: 8 new enums (`PlanStatus`, `SubscriptionStatus`, `BillingCycle`, `UsageMetricType`, `ApiKeyStatus`, `WebhookStatus`, `WebhookEventType`, `SupportSessionStatus`) + 7 new models (`Plan`, `Subscription`, `UsageMeter`, `ApiKey`, `WebhookEndpoint`, `SupportSession`, `DevAdmin`)
- [x] Module: `billing/` — controller, service, DTOs, module
- [x] Endpoints: GET /billing, PATCH /billing/subscription, GET /billing/plans, POST /dev/api-keys, GET /dev/api-keys, POST /dev/api-keys/:id/revoke, POST /dev/webhooks, GET /dev/webhooks, PATCH /dev/webhooks/:id, GET /dev/usage, POST /support/sessions, GET /support/sessions, PATCH /support/sessions/:id/close, GET /dev/admins
- [x] Unit tests: `billing.service.spec.ts` — 26 tests covering org context resolution, billing overview, plan changes, status transitions, state machine validation, plan limit enforcement, API key creation/revocation, webhook CRUD, support session lifecycle, dev admin protection, grace period degradation, usage metering
- [x] E2e tests: `billing.e2e-spec.ts` — auth 401/403, billing overview, plans catalog, subscription update, API key create/list/revoke, webhook create/list/update, usage meters, support session open/list/close, dev admins, permission denial
- [x] Seed: `seedBillingData()` — 3 plans (SOLO/GROWTH/FRANCHISE; full feature set on every plan, location-only enforcement; SOLO=1, GROWTH=3, FRANCHISE=999_999), 1 active subscription, 1 demo API key, 1 demo webhook, 1 closed support session, 1 protected dev admin; idempotent (now upserts plan rows so re-seeding reconciles to corrected catalog) ✅
- [x] Permissions: 11 total (9 original M39 + 2 new under M39 Plan-Catalog Correction: `ops:plans:read`, `ops:plans:write`) — Owner/Manager get write, Accountant gets read-only ✅
- [x] Postman: `M39-Billing-Subscriptions-Dev-Portal.postman_collection.json`
- [x] DONE: M39 complete ✅

## Known Blockers

- Neon Postgres P1001: Database suspends after inactivity. M5 migration SQL created manually, needs to be applied when Neon comes online. Same pattern as M3.1 and M4.

## Notes

- The roadmap is software-first.
- Do not start M46 hardware work until the software stack is stable.
- Repo structure normalized: API under apps/api (not services/api), shared under packages/shared (not packages/contracts).
- **Windows DLL lock**: Prisma engine DLLs may be locked by stale `node.exe` processes (from `nest --watch`, turbo, or VS Code). Stop all node processes before running `pnpm db:generate`.
- **Neon suspend**: Neon Postgres suspends after inactivity. First request after suspension may return P1001; retry after 2-3 seconds.
- **E2e PIN data**: Running e2e tests modifies quick PIN data. Re-seed after e2e runs to restore demo PINs.
- DEMO_DATA_QA complete / demo UI ready
