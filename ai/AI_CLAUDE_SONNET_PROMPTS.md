# AI_CLAUDE_SONNET_PROMPTS.md — Nimbus POS Milestone Execution Prompts

Use these prompts with Claude Sonnet or any coding model to execute the rebuild one milestone at a time.

## Universal Prompt Header (prepend to every milestone)

---

You are a senior TypeScript/NestJS/Prisma engineer working in a fresh Nimbus POS rebuild repo.

MANDATORY FIRST STEP:
Read these files fully before changing any code:

- ROADMAP.md
- repo file tree.txt
- ai/AI_CONTEXT.md
- ai/AI_STATUS.md
- ai/AI_ERROR_PROTOCOL.md
- ai/AI_COMPLETION_REPORT_TEMPLATE.md
- docs/ARCHITECTURE.md
- docs/API_CONVENTIONS.md

RULES:

- Implement ONLY the requested milestone scope.
- Follow the repo tree. If you add or move files, update `repo file tree.txt`.
- Build feature-by-feature in this order: DB → service → controller → tests → seed → Postman → docs.
- If any error happens, follow `ai/AI_ERROR_PROTOCOL.md` exactly.
- Do not pull deferred hardware milestones earlier.
- After completion: update `ai/AI_STATUS.md` and produce a completion report using `ai/AI_COMPLETION_REPORT_TEMPLATE.md`.

OUTPUT REQUIRED:

1. Step-by-step commands to run
2. File-by-file code changes
3. Postman changes
4. Updated `ai/AI_STATUS.md`
5. Completion report

---

## M0 Prompt — Repo Bootstrap + Workspace Tooling

Implement M0 from ROADMAP.md.

Primary outcome:

- Fresh monorepo with pnpm, Turbo, NestJS API, shared packages, lint/test/dev scripts, and docs scaffolding.

Minimum endpoints:

- GET /api/health

Deliverables: workspace, API scaffold, shared packages, scripts, README/docs stubs, working /api/health.

## M1 Prompt — Neon + Prisma Baseline + Seed Framework

Implement M1 from ROADMAP.md.

Primary outcome:

- Neon Postgres connection, Prisma client/migrations, deterministic idempotent seed runner, and DB-backed health endpoint.

Minimum endpoints:

- GET /api/health

Deliverables: Neon + Prisma config, migration flow, idempotent seed runner, DB-backed /api/health, env validation.

## M2 Prompt — Auth v1 (Email/Password/PIN) + JWT Sessions + RBAC

Implement M2 from ROADMAP.md.

Primary outcome:

- Core auth without hardware dependency: register/login/refresh/logout/me, role system, permission guard, audit on auth writes.

Minimum endpoints:

- POST /auth/register
- POST /auth/login
- POST /auth/pin-login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

Deliverables: register/login/pin-login/refresh/logout/me, roles/permissions, session persistence, permission guard, auth audit events.

## M3 Prompt — Multi-Tenancy Core (Org, Branch, Membership, Platform Access)

Implement M3 from ROADMAP.md.

Primary outcome:

- Everything becomes org-scoped and branch-scoped with explicit membership, active branch context, and platform access matrix.

Minimum endpoints:

- GET /orgs/me
- GET /branches
- POST /branches
- POST /memberships
- PATCH /memberships/:id

Deliverables: organizations, branches, memberships, active-branch context, tenant/platform guards, seed org and branches.

## M4 Prompt — Organization Settings + Numbering + Accounting Readiness Contracts

Implement M4 from ROADMAP.md.

Primary outcome:

- Global settings, tax defaults, currency, number sequences, receipt rules, service-charge policy, and accounting posting contracts defined before transactional modules.

Minimum endpoints:

- GET /settings/org
- PATCH /settings/org
- GET /settings/sequences
- POST /settings/sequences/:key/next
- GET /settings/payment-methods

Deliverables: org settings, branch settings, number sequences, tax categories, payment method config, posting-rule contracts.

## M5 Prompt — Floor Plans + Tables + Service Areas

Implement M5 from ROADMAP.md.

Primary outcome:

- Dining layout foundation with floors, sections, tables, capacities, and table states.

Minimum endpoints:

- GET /floor-plans
- POST /floor-plans
- GET /tables
- POST /tables
- PATCH /tables/:id/status

## M6 Prompt — Menu Catalog v1 (Categories, Items, Tax Categories, Availability)

Implement M6 from ROADMAP.md.

Primary outcome:

- Core menu management with category hierarchy, item lifecycle, SKU/plu, base pricing, tax categories, and sellability flags.

Minimum endpoints:

- GET /menu/categories
- POST /menu/categories
- GET /menu/items
- POST /menu/items
- PATCH /menu/items/:id

## M7 Prompt — Modifiers + Option Sets + Combo Rules

Implement M7 from ROADMAP.md.

Primary outcome:

- Modifier groups, min/max selection rules, price deltas, defaults, and combo scaffolding.

Minimum endpoints:

- GET /menu/modifiers
- POST /menu/modifiers
- POST /menu/items/:id/modifier-groups
- PATCH /menu/modifiers/:id

## M8 Prompt — Recipe BOM + Yield + Costing Contracts

Implement M8 from ROADMAP.md.

Primary outcome:

- Recipe system with ingredient quantities, unit conversions, yields, prep-loss %, and theoretical cost computation per dish/drink.

Minimum endpoints:

- GET /recipes
- POST /recipes
- PATCH /recipes/:id
- GET /recipes/:id/cost-preview

## M9 Prompt — Inventory Master Data (Items, Units, Categories, Reorder Policies)

Implement M9 from ROADMAP.md.

Primary outcome:

- Inventory catalog aligned with uploaded stock workbook: item master, units, categories, reorder levels, preferred supplier references.

Minimum endpoints:

- GET /inventory/items
- POST /inventory/items
- PATCH /inventory/items/:id
- GET /inventory/categories

## M10 Prompt — FIFO Stock Batches + Ledger Core

Implement M10 from ROADMAP.md.

Primary outcome:

- True stock batches, stock ledger, on-hand calculations, cost layers, and movement reasons.

Minimum endpoints:

- GET /inventory/batches
- GET /inventory/ledger
- POST /inventory/opening-balance

## M11 Prompt — Suppliers + Purchase Orders

Implement M11 from ROADMAP.md.

Primary outcome:

- Supplier master, contacts, payment terms, PO workflow, and approval thresholds.

Minimum endpoints:

- GET /suppliers
- POST /suppliers
- GET /purchase-orders
- POST /purchase-orders
- PATCH /purchase-orders/:id/submit
- PATCH /purchase-orders/:id/approve

## M12 Prompt — Goods Receipts + Landed Cost + Batch Receiving

Implement M12 from ROADMAP.md.

Primary outcome:

- GRN flow that converts approved POs into stock batches, supports partial receipt, variances, and landed-cost allocation.

Minimum endpoints:

- GET /goods-receipts
- POST /purchase-orders/:id/receive
- GET /goods-receipts/:id

## M13 Prompt — Stock Counts + Variance + Wastage + Adjustments

Implement M13 from ROADMAP.md.

Primary outcome:

- Cycle counts, shift-close counts, wastage reasons, shrinkage posting hooks, and manager overrides.

Minimum endpoints:

- POST /inventory/counts
- PATCH /inventory/counts/:id/submit
- POST /inventory/wastage
- POST /inventory/adjustments

## M14 Prompt — POS Orders Core (Draft -> Sent -> Served -> Closed)

Implement M14 from ROADMAP.md.

Primary outcome:

- Table and walk-in orders, order lines, notes, sent state, course/station routing metadata, and close readiness.

Minimum endpoints:

- GET /pos/orders
- POST /pos/orders
- PATCH /pos/orders/:id
- POST /pos/orders/:id/send
- POST /pos/orders/:id/close-request

## M15 Prompt — KDS + Station Routing + SLA Timers

Implement M15 from ROADMAP.md.

Primary outcome:

- Kitchen/bar display tickets, station configs, routing rules, bump/ready flow, and basic SSE events.

Minimum endpoints:

- GET /kds/tickets
- POST /kds/stations
- PATCH /kds/tickets/:id/start
- PATCH /kds/tickets/:id/ready
- GET /stream/kds

## M16 Prompt — Discounts + Manager Overrides + Void Rules

Implement M16 from ROADMAP.md.

Primary outcome:

- Line/order discounts, reason codes, override approvals, pre-close voids, and anomaly signals.

Minimum endpoints:

- POST /pos/orders/:id/discounts
- POST /pos/orders/:id/void-lines
- GET /approvals
- POST /approvals/:id/decide

## M17 Prompt — Shifts + Till Sessions + Cash Management

Implement M17 from ROADMAP.md.

Primary outcome:

- Open/close shifts, opening float, cash pickups, safe drops, till reconciliation, and shift-close report baseline.

Minimum endpoints:

- POST /shifts/open
- POST /shifts/:id/close
- POST /tills/open
- POST /tills/:id/safe-drop
- POST /tills/:id/reconcile

## M18 Prompt — Payments v1 (Cash, Card Stub, Mobile Money Intents)

Implement M18 from ROADMAP.md.

Primary outcome:

- Payment records, split payments, mobile money intent + webhook contract, and settlement-ready payment states.

Minimum endpoints:

- POST /payments/intents
- POST /payments/intents/:id/cancel
- POST /pos/orders/:id/close
- POST /webhooks/mtn
- POST /webhooks/airtel

## M19 Prompt — Refunds + Post-Close Voids + Receipt Reprints

Implement M19 from ROADMAP.md.

Primary outcome:

- Refund lifecycle, post-close void approval, reversal artifacts, and receipt reprint trail.

Minimum endpoints:

- POST /refunds
- POST /pos/orders/:id/post-close-void
- GET /receipts/:id
- POST /receipts/:id/reprint

## M20 Prompt — Reservations + Deposits + Seating Bridge

Implement M20 from ROADMAP.md.

Primary outcome:

- Table reservations with deposit tracking and conversion into seated orders.

Minimum endpoints:

- GET /reservations
- POST /reservations
- PATCH /reservations/:id/confirm
- PATCH /reservations/:id/seat
- PATCH /reservations/:id/cancel

## M21 Prompt — Events + Booking Portal + Ticketing

Implement M21 from ROADMAP.md.

Primary outcome:

- Premium events, event tables, ticket codes, check-in, and prepaid credit hooks.

Minimum endpoints:

- GET /events
- POST /events
- POST /bookings
- PATCH /bookings/:id/confirm
- POST /events/checkin
- GET /events/bookings/:id/ticket

## M22 Prompt — Anomaly Detection + Anti-Theft Signals

Implement M22 from ROADMAP.md.

Primary outcome:

- Threshold rules and derived signals for void spikes, discount abuse, cash variance, shrinkage, and suspicious staff behavior.

Minimum endpoints:

- GET /analytics/anomalies
- POST /analytics/anomaly-rules
- PATCH /analytics/anomalies/:id/acknowledge
- GET /analytics/risk-dashboard

## M23 Prompt — Operational Dashboards + KPI Streams

Implement M23 from ROADMAP.md.

Primary outcome:

- Owner/manager live dashboards, today/MTD sales, payment mix, open orders, low stock, and SSE-backed KPI streams.

Minimum endpoints:

- GET /dash/owner
- GET /dash/manager
- GET /stream/metrics
- GET /dash/today-summary

## M24 Prompt — Reporting v1 + Exports (CSV/PDF)

Implement M24 from ROADMAP.md.

Primary outcome:

- Shift-end, daily sales, payment mix, top items, stock variance, and export jobs.

Minimum endpoints:

- POST /reports/shift-end
- POST /reports/daily-sales
- POST /reports/export
- GET /reports/history/:id

## M25 Prompt — Customer Feedback + NPS + QR Follow-up

Implement M25 from ROADMAP.md.

Primary outcome:

- Feedback collection linked to orders/reservations/events, NPS rollups, and manager review views.

Minimum endpoints:

- POST /feedback/public
- GET /feedback
- GET /feedback/nps-summary
- PATCH /feedback/:id/tag

## M26 Prompt — Documents + Uploads + Attachments

Implement M26 from ROADMAP.md.

Primary outcome:

- Document store for invoices, receipts, contracts, payslips, and linked records.

Minimum endpoints:

- POST /documents/upload
- GET /documents
- GET /documents/:id/download
- DELETE /documents/:id

## M27 Prompt — Employees + Contracts + HR Core

Implement M27 from ROADMAP.md.

Primary outcome:

- Employee profiles, contract types, positions, salary basis, and staffing metadata for later attendance/payroll modules.

Minimum endpoints:

- GET /hr/employees
- POST /hr/employees
- PATCH /hr/employees/:id
- GET /hr/contracts

## M28 Prompt — Attendance + Leave + Shift Swaps

Implement M28 from ROADMAP.md.

Primary outcome:

- Clock events, presence statuses, leave requests, attendance policy rules, and peer shift-swap flow.

Minimum endpoints:

- POST /hr/attendance/clock
- GET /hr/attendance
- POST /hr/leave
- POST /hr/shift-swaps
- PATCH /hr/shift-swaps/:id/approve

## M29 Prompt — Scheduling + Templates + Duty Roster

Implement M29 from ROADMAP.md.

Primary outcome:

- Shift templates, rosters, role coverage rules, and branch duty planning.

Minimum endpoints:

- GET /workforce/templates
- POST /workforce/templates
- POST /workforce/schedules
- PATCH /workforce/schedules/:id/publish

## M30 Prompt — Payroll Engine + Pay Runs + Payslips

Implement M30 from ROADMAP.md.

Primary outcome:

- Payroll calculation from attendance/contracts/components with approval and payable hook generation.

Minimum endpoints:

- POST /payroll/runs/build
- PATCH /payroll/runs/:id/approve
- PATCH /payroll/runs/:id/pay
- GET /payroll/payslips/:id

## M31 Prompt — Staff Insights + Awards + Promotion Suggestions

Implement M31 from ROADMAP.md.

Primary outcome:

- Composite performance scoring across sales, reliability, attendance, wastage, and risk signals.

Minimum endpoints:

- GET /staff/insights
- POST /staff/awards
- POST /staff/promotion-suggestions/generate
- PATCH /staff/promotion-suggestions/:id/decision

## M32 Prompt — Accounting Foundation (COA + Cost Centers + Fiscal Periods)

Implement M32 from ROADMAP.md.

Primary outcome:

- Start real accounting after ops are stable: chart of accounts, departments/cost centers, fiscal periods, and lock policy.

Minimum endpoints:

- GET /accounting/accounts
- POST /accounting/accounts
- GET /accounting/periods
- PATCH /accounting/periods/:id/open

## M33 Prompt — General Ledger + Journal Entries + Posting Engine

Implement M33 from ROADMAP.md.

Primary outcome:

- Balanced journals, posting service, reversals, and first-class automated operational postings.

Minimum endpoints:

- GET /accounting/journals
- POST /accounting/journals
- POST /accounting/journals/:id/reverse
- POST /accounting/posting/replay

## M34 Prompt — Accounts Payable + Vendor Bills + Payments

Implement M34 from ROADMAP.md.

Primary outcome:

- Vendor bill workflow and AP aging integrated with PO/GRN and service-provider expenses.

Minimum endpoints:

- GET /accounting/ap/bills
- POST /accounting/ap/bills
- POST /accounting/ap/bills/:id/approve
- POST /accounting/ap/payments

## M35 Prompt — Accounts Receivable + Invoicing + Direct Bill

Implement M35 from ROADMAP.md.

Primary outcome:

- Customer/house accounts, invoice generation, receipts, credit notes, and aging.

Minimum endpoints:

- GET /accounting/ar/accounts
- POST /accounting/ar/invoices
- POST /accounting/ar/receipts
- GET /accounting/ar/aging

## M36 Prompt — Bank Reconciliation + Period Close + Locks

Implement M36 from ROADMAP.md.

Primary outcome:

- Bank statement import, matching, close workflow, retained earnings transfer, and lock controls.

Minimum endpoints:

- POST /accounting/bank-statements/import
- POST /accounting/reconciliation/match
- PATCH /accounting/periods/:id/close
- PATCH /accounting/periods/:id/lock

## M37 Prompt — Budgets + Forecasts + Procurement Advisory

Implement M37 from ROADMAP.md.

Primary outcome:

- Operational and financial budgets, variance tracking, and stocking guidance for branches and franchise rollups.

Minimum endpoints:

- GET /finance/budgets
- POST /finance/budgets
- POST /finance/budgets/update-actuals
- GET /franchise/forecast

## M38 Prompt — Franchise + Multi-Branch Suite

Implement M38 from ROADMAP.md.

Primary outcome:

- HQ dashboards, branch rankings, inter-branch visibility, central procurement, and multi-branch scorecards.

Minimum endpoints:

- GET /franchise/overview
- GET /franchise/rankings
- GET /franchise/budgets
- POST /franchise/transfers

## M39 Prompt — Billing + Subscription Plans + Dev Portal

Implement M39 from ROADMAP.md.

Primary outcome:

- Plan limits, restaurant lifecycle, dev admins, API keys, webhooks, support sessions, and usage logs.

Minimum endpoints:

- GET /billing
- PATCH /billing/subscription
- POST /dev/api-keys
- POST /dev/webhooks
- GET /dev/usage

## M40 Prompt — Alerts + Digests + Real-Time Owner Views

Implement M40 from ROADMAP.md.

Primary outcome:

- Email/SMS/Slack alert channels, scheduled digests, live owner streams, and escalation routing.

Minimum endpoints:

- GET /alerts
- POST /alerts/rules
- POST /alerts/test
- GET /owner/live

## M41 Prompt — Reliability Layer (Idempotency + Offline Contracts + Sync)

Implement M41 from ROADMAP.md.

Primary outcome:

- Generic idempotency storage, offline-safe write contracts, queue replay rules, and service worker/sync planning.

Minimum endpoints:

- POST /sync/replay
- GET /sync/jobs
- POST /sync/jobs/:id/retry

## M42 Prompt — Feature Flags + Maintenance Windows + Training Mode

Implement M42 from ROADMAP.md.

Primary outcome:

- Operational control plane for staged rollout, demo safety, and training/sandbox modes.

Minimum endpoints:

- GET /flags
- POST /flags
- PATCH /flags/:key
- POST /training/start

## M43 Prompt — Frontend Shell + Role-Based Workspaces

Implement M43 from ROADMAP.md.

Primary outcome:

- Unified web shell with role-filtered sidebar, dashboard landing pages, and shared UI patterns.

Minimum endpoints:

- Uses prior APIs only

## M44 Prompt — Frontend POS + KDS + Backoffice Vertical Screens

Implement M44 from ROADMAP.md.

Primary outcome:

- Production UI for POS terminal, KDS wallboard, inventory, finance, HR, analytics, reservations, and documents.

Minimum endpoints:

- Uses /pos/_ /kds/_ /inventory/_ /finance/_ /reports/\* and related APIs

## M45 Prompt — Passkeys + MFA + SSO/SCIM

Implement M45 from ROADMAP.md.

Primary outcome:

- Passwordless auth, TOTP policy, and enterprise identity integrations.

Minimum endpoints:

- POST /auth/passkeys/register
- POST /auth/passkeys/login
- POST /auth/totp/enable
- POST /auth/sso/callback

## M46 Prompt — Deferred Hardware Wave (Badges/MSR + Smart Spouts + Peripheral Drivers)

Implement M46 from ROADMAP.md.

Primary outcome:

- Late-wave hardware integration only after core product is stable: badge lifecycle, MSR auth, device custody, bar spout calibration and pour telemetry, printers/payment terminals hardening.

Minimum endpoints:

- POST /auth/msr-swipe
- POST /badges/assign
- POST /badges/:id/revoke
- POST /spouts/sessions
- POST /spouts/calibrations
- GET /devices

Deliverables: badge lifecycle, MSR login, device custody, smart spout entities and APIs, but only if all prior milestones are green.

## M47 Prompt — Launch Hardening + E2E + Security + CI/CD

Implement M47 from ROADMAP.md.

Primary outcome:

- Full regression suite, performance budgets, observability, backups, deployment scripts, and launch gates.

Minimum endpoints:

- GET /diag/health
- POST /diag/snapshot
- GET /release/gates

Deliverables: full regression gate, observability, backup/restore scripts, CI workflows, release gates, smoke tests.
