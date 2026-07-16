# Demo Data Scan Report

## Context Snapshot

- Current state from ai/AI_STATUS.md: latest frontend milestone is WAITER-MVP Me Tab HR / Shift Self-Service UI done on 2026-06-20; verification refresh on 2026-06-30 passed web typecheck/lint/build with corepack pnpm@8.15.0, while API port 3001 was unavailable.
- Backend scope is complete through BG7 HMS Integration; next backend gap marker remains BG8 TBD.
- Scan date: 2026-06-30. Project governance memory includes 2026-05-18 as the earlier milestone context date.

## Repo Path Confirmed

- Confirmed working directory: C:/Users/arman/Desktop/nimbus-pos
- Repo-pinned pnpm precheck: corepack pnpm@8.15.0 --version returned 8.15.0.
- No server was started. No migration, seed, Prisma generate, build, or database command was run.

## Files And Areas Scanned

- Mandatory governance/context: README.md, ROADMAP.md, repo file tree.txt, ai/AI_CONTEXT.md, ai/AI_STATUS.md, ai/AI_ERROR_PROTOCOL.md, ai/AI_COMPLETION_REPORT_TEMPLATE.md, docs/ARCHITECTURE.md, docs/API_CONVENTIONS.md, docs/POSTMAN_ENDPOINT_GUIDE.md.
- Database: packages/db/prisma/schema.prisma, packages/db/prisma/seed.ts, packages/db/prisma/migrations/\* (57 migration directories), packages/db/package.json.
- Seed subfolder: packages/db/prisma/seed/ is absent or contains no files in this checkout; seed logic is concentrated in packages/db/prisma/seed.ts.
- API source: 556 TypeScript files under apps/api/src, including 245 DTO files, 53 controllers, and 73 service files.
- Postman: 56 collections and 1 environment file. Parsed collections reported 0 localhost:3000 URLs and 0 non-{{baseUrl}}/api raw URLs in this parser pass.
- Completion reports: 69 files matching ai/\*COMPLETION_REPORT.md.
- Frontend docs: apps/web/README.md read.

## Uploaded / Audit-Derived Files

- MISSING nimbus_updated_endpoint_register_m0_m42_bg0_bg6.csv
- MISSING nimbus_updated_gap_status_bg0_bg6.csv
- MISSING nimbus_updated_route_verification_summary_bg0_bg6.csv
- MISSING nimbus_updated_frontend_workflow_map_bg0_bg6.csv
- MISSING nimbus_updated_reusable_component_map_bg0_bg6.csv
- MISSING nimbus_updated_role_endpoint_matrix_bg0_bg6.csv
- MISSING nimbus_updated_lucidchart_map_spec_bg0_bg6.csv
- MISSING nimbus_bg0_bg6_gap_fix_register.csv
- MISSING nimbus_updated_master_audit_bg0_bg6.md
- MISSING nimbus_updated_master_audit_bg0_bg6.xlsx

These requested audit files were not present, so this report is based on source, Prisma schema, seed.ts, docs, completion reports, and Postman.

## Existing Seed Data Summary

- Organization seed currently creates Nimbus Restaurant Group with slug nimbus and legal name Nimbus Restaurant Group LLC. Future premium demo should either update this row to Nimbus Hospitality Group by slug, or explicitly create a new org plus fresh memberships. Updating slug nimbus is safer for current Postman/frontend assumptions.
- Existing branches: Main Branch (MAIN/main/UTC/USD) and Downtown Branch (DOWNTOWN/downtown/UTC/USD).
- Existing demo users: owner@demo.local, manager@demo.local, accountant@demo.local, cashier@demo.local, chef@demo.local, waiter@demo.local. Roles also include Owner, Manager, Accountant, Supervisor, Cashier, Chef, Waiter, Bartender, Procurement, Stock Manager, Event Manager.
- Existing memberships: Owner, Manager, Accountant have MAIN and DOWNTOWN access; Cashier, Chef, Waiter are MAIN only.
- Existing quick PINs: waiter 123456 LOW_6, cashier 654321 LOW_6, manager 12345678 HIGH_8, hashed with branch-aware lookup.
- Existing floor/table data: Main Dining and Patio, 15 tables T1-T10, VIP-1, VIP-2, P1-P3 for MAIN.
- Existing menu data: 5 categories, 2 tax categories, about 20 menu items, browse groups/subgroups, serving formats, modifier groups/options, item-group assignments.
- Existing inventory/recipe data: 24 inventory items, 10 base recipes, modifier-linked recipe entries, and stock batches.
- Existing operational data: 6 orders across NEW, SENT, IN_KITCHEN, SERVED, CLOSED, VOIDED; KDS SLA configs/tickets; discounts; cash/card/MTN-demo/manual-reference payments; shifts/tills/cash movements; reservations/deposits/events/tickets/check-ins.
- Existing HR/accounting data: 8 positions, 4 compensation profiles, 4 employees, 3 contracts, attendance/leave/swap examples, schedules, payroll components/adjustment, 13 system COA accounts, posting maps, tax config, journal/posting rows, AP/AR/bank/budget/franchise/billing/alerts/reliability/control-plane demo rows.
- Seed patterns: mostly findUnique/findFirst natural-key guards plus create; createMany for role permissions; SeedHistory upserts milestone markers; waiter-permission revoke step removes unsafe waiter permissions after additive role binding.

## Prisma Model Inventory Summary

- Models: 163
- Enums: 169
- Org-scoped models: 141
- Branch-scoped models: 110
- Models with unique constraints: 76
- Models with explicit actor/audit fields: 58

See ai/DEMO_DATA_SCHEMA_FIELD_INVENTORY.md for the full model and enum inventory.

## API / DTO Contract Findings

- Branch context is required across branch-operational endpoints via X-Branch-Id; imports must resolve branch IDs from branch codes before service calls.
- State-machine-heavy domains should not be raw inserted if the demo should exercise real UI workflows: orders, KDS, payments, refunds, shifts/tills, reservations, events/tickets, AP/AR receipts, journal posting, bank reconciliation, reliability, feature/training audit.
- Money fields are Prisma Decimal in many models; future CSV should store decimal values as strings and import with Prisma Decimal-safe handling.
- Auth/session records, refresh tokens, password reset tokens, invitations, and HMS API keys should be created through existing services/helpers, not arbitrary CSV rows.
- Receipt send is 202 PENDING with no live email/SMS/WhatsApp adapter. Demo data must not show delivered receipt sends.
- Public diner mobile-money remains CRITICAL - PENDING MTN/AIRTEL PROVIDER CONFIRMATION. PesaPal is owner SaaS billing only.
- Printer routes and terminal pairing are metadata/stub only. No driver, acquirer, printer, or terminal integration should be invoked.

## Demo Story Design

- Fixed demo now: 2026-06-30T12:00:00+03:00 (Africa/Kampala), stored as UTC timestamps.
- Historical operating window: 2026-04-01 through 2026-06-30, with denser recent data in the last 14 days and a lively current-day open shift.
- Proposed organization: Nimbus Hospitality Group, keyed by existing slug nimbus unless a later prompt deliberately creates a separate org.
- Proposed branches: Tapas Downtown, Rooftop Bar, Garden Cafe, Events Kitchen / Banquet Hall. Suggested new codes if additive: TAPAS_DOWNTOWN, ROOFTOP_BAR, GARDEN_CAFE, EVENTS_KITCHEN.
- Staff target: about 32 employees across ownership/management/accounting/procurement/stock, service, kitchen, bar, cashiers, event staff, and casual banquet workers.
- Floor/table target: Tapas Downtown 22 tables, Rooftop 16 tables/high-tops, Garden Cafe 18 tables, Events Kitchen 12 banquet tables/configurable areas.
- Menu target: 55-75 sellable items, 2-4 serving variants where useful, modifiers for doneness, sides, sauces, brunch add-ons, non-alcoholic variants, and internal POS beverage records only for age-restricted items.
- Inventory target: 90-120 inventory items, 8-12 suppliers, opening FIFO batches, par/reorder points, recipes for 35-45 top sellable items, wastage/count variance tied to sales.
- Sales target: 1,200-2,000 orders over 90 days, with 80-140 current-day orders across branches; payments exactly match closed order totals.
- Reservations/events target: 120 reservations over 60 days, 8 events, 20-40 event bookings, tickets/check-ins for completed and upcoming events.
- HR/payroll/accounting target: published schedules, attendance aligned to shifts, leave and swaps, one pay run, balanced journals, AP/AR cycles, budgets, forecasts, franchise rankings, alerts, and reports.

## Required Demo Data Domains

Tenancy, users/RBAC, floor/table, menu/modifier/recipe, inventory/FIFO, suppliers/AP, POS/KDS/payments/refunds/receipts metadata, reservations/events/tickets, HR/workforce/payroll, accounting/ledger/AP/AR/bank/budget/franchise, dashboards/reports/exports/documents, feedback/anomalies/alerts, feature flags, training mode, devices/printer routes, and safe HMS metadata.

## Conflict And Idempotency Risks Found

- Existing org slug nimbus can fragment demo data if duplicated under a new slug. Prefer idempotent update or a consciously new isolated demo org.
- Existing MAIN/DOWNTOWN branches have operational rows; renaming them affects tests, while additive premium branches require fresh memberships and Postman variable resolution.
- Existing @demo.local emails are globally unique; new premium users should use @nimbus.demo or @nimbus.test unless updating existing users.
- Many seed rows use findFirst/create guards, not upsert; future importer must centralize natural-key lookup and dry-run duplicate checks.
- Counters and totals can drift if raw inserts bypass services: soldCount, checkedInCount, order totals, invoice balances, stock remaining, payroll/journal totals.

## Unsafe / Deferred Surfaces

- Public diner mobile money: keep labelled CRITICAL - PENDING MTN/AIRTEL PROVIDER CONFIRMATION; generate only pending/not-enabled rows.
- PesaPal: owner SaaS billing only, not diner checkout.
- Receipt delivery: PENDING/no adapter; no delivered claims.
- Printer and card terminal: metadata/stub only.
- HMS API keys: service/API only; no plaintext secrets in CSV.
- MSR/badge login and smart spouts: deferred late hardware wave.

## Files Created By This Scan

- ai/DEMO_DATA_SCAN_REPORT.md
- ai/DEMO_DATA_SCHEMA_FIELD_INVENTORY.md
- ai/DEMO_DATA_CSV_MANIFEST.md
- ai/DEMO_DATA_IMPORT_STRATEGY.md
- ai/DEMO_DATA_QUALITY_CHECKLIST.md

## Recommended Next Prompt

Generate deterministic CSV fixtures and an idempotent dry-run importer using ai/DEMO_DATA_CSV_MANIFEST.md, without database writes until the generated files are reviewed.
