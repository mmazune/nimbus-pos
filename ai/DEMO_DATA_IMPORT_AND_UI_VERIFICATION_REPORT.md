# Demo Data Import and UI Verification Report

Date: 2026-06-30
Repo: `C:\Users\arman\Desktop\nimbus-pos`

## Context Snapshot

- AI status before work: `DEMO_DATA_SCAN complete / pending CSV generation`.
- Frontend waiter MVP already existed through floor, order builder, orders queue, receipt/request bill, reservations, and Me tab HR self-service.
- Work was limited to enterprise demo data extraction, validation, import, verification, scripts, and status/report docs.

## Pack and Importer

- Demo pack found at `C:\Users\arman\Desktop\nimbus-pos\nimbus_enterprise_demo_data_pack.zip`.
- Extracted `demo-data/` into the repo root and copied `IMPLEMENTATION_PROMPT.md` into `demo-data/IMPLEMENTATION_PROMPT.md`.
- Implemented `packages/db/prisma/demo-import.ts`.
- Added package scripts:
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:import`
- Importer defaults to dry-run. Write mode requires `--write` or the package import script.
- Recovery mode `--skip-existing` was added for interrupted idempotent imports.

## CSV Summary

- CSV files discovered: 63
- Total rows parsed: 9,243
- Largest domains:
  - Orders: 1,192
  - Order items: 2,950
  - Payments: 747
  - Receipt events: 793, intentionally not imported as live delivery history
  - Inventory items: 180
  - Stock batches: 280
  - Stock adjustments: 257

## Validation Result

Dry-run validation passed:

- CSV files exist and parse.
- Critical headers validated.
- Duplicate natural keys checked.
- Decimal and ISO date fields parsed.
- Prisma enum values checked.
- Order/payment/AP/AR/GL totals checked.
- Mobile-money, PesaPal, receipt, printer, terminal, and HMS safety checked.
- Dry-run confirmed zero database writes.

## Write Import Result

Write import completed after an interrupted long-running write was resumed with `--skip-existing`.

Imported or verified present:

- Organization, branches, users, memberships, employees.
- Floor plans and tables.
- Menu categories/items/servings, modifiers, menu-modifier assignments.
- Inventory, suppliers, recipes, stock batches, stock adjustments.
- Shifts, tills, POS orders, order items, payments, refunds.
- Reservations, reservation deposits.
- Events, ticket classes, bookings, tickets.
- Attendance, leave, shift swaps.
- Accounting accounts, cost centers, fiscal periods, GL journals/lines.
- AP vendor bills/lines/payments.
- AR customer accounts/invoices/lines/receipts.
- Feedback/NPS source rows, anomalies, reports/exports.
- Devices, printer routes, alert channels/rules, feature flags, maintenance windows, training sessions.

Skipped by design:

- `15_recipes.csv`: recipe headers only; recipe lines imported as `RecipeIngredient`.
- `18_purchase_orders.csv`, `19_goods_receipts.csv`: no current Prisma model.
- `30_order_item_modifiers.csv`: no current `OrderItemModifier` model; modifier deltas are validation-only.
- `33_receipt_events.csv`: no live delivered/send history imported.
- `64_hms_api_keys_access_logs.csv`: no plaintext HMS keys imported.

## Post-Import Verification

Database verification passed:

- Organization: `Nimbus Hospitality Group`.
- Premium branches present: Tapas Downtown, Rooftop Bar, Garden Cafe, Events Kitchen / Banquet Hall.
- Existing `MAIN` and `DOWNTOWN` branches preserved.
- Counts include: 6 branches, 40 employees, 83 tables, 119 menu items, 204 inventory items, 309 stock batches, 1,198 orders, 750 payments, 125 reservations, 11 events, 42 journal entries, 24 vendor bills, 18 AR invoices, 80 feedback rows, 16 devices, 12 printer routes.
- Journal balance check: 0 unbalanced journals.
- Stock negative check: 0 negative stock batches.
- Mobile-money unsafe check: 0 unsafe `MOMO` rows after hardening one legacy seed row.
- Receipt live-send imported check: 0.

## Runtime Verification

- API started on `http://localhost:3001`.
- `GET /api/health` returned HTTP 200 with `db: ok`.
- Web was already running on `http://localhost:3000`.
- Route smoke returned HTTP 200 for:
  - `/login`
  - `/waiter/floor`
  - `/waiter/orders`
  - `/waiter/orders/:orderId`
  - `/waiter/reservations`
  - `/waiter/me`
- In-app Browser attach failed twice with browser webview attach timeout; verification used HTTP route smoke plus authenticated API checks.
- Seed waiter login `waiter@demo.local` / `Waiter#123` worked and returned 51 permissions.
- Imported waiter `waiter@nimbus.demo` / `Demo1234!` authenticated and had a membership, but flattened `roles` and `permissions` in `/api/auth/me` were empty, so guarded waiter endpoints returned 403. No auth/backend business logic was changed.

## Frontend Validation

- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`: passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`: failed in the Next build worker with exit code `3221226505`; no TypeScript or ESLint error was reported before the worker exit.

## Safety Constraints

Preserved:

- Public diner mobile-money remains pending/provider-gated.
- PesaPal remains owner SaaS subscription billing only.
- Receipt send remains pending/no live adapter.
- Printer routes are metadata only; no print driver invocation.
- Terminal pairing remains stub only; no acquirer/card-terminal traffic.
- No fake provider credentials imported.
- HMS plaintext API key CSV was not imported.
- Demo data uses synthetic customers/employees and no real bank/tax identities.
- No Prisma schema changes, no migrations, no backend business logic changes, no frontend UI changes, no Postman changes.

