# Demo Data Import Strategy

## Recommendation

Use a hybrid importer. Generate deterministic CSVs for stable master data, read them inside a TypeScript seed/import script, and call domain services or APIs for state-machine-heavy records. Avoid direct SQL COPY for this foundation because it bypasses Decimal handling, audit/event side effects, service rules, idempotency, lifecycle counters, and guardrails.

## Exact Load Order

1. Organization, branches, settings, exchange rates.
2. Users, memberships, roles/permissions only if extending the existing catalog, quick PIN helper logic through bcrypt/HMAC seed code.
3. Floor plans, tables, tax categories, menu categories, browse groups/subgroups, menu items, servings, modifiers, item-modifier mappings.
4. Suppliers, inventory items, recipes, stock batches/opening balances, stock adjustments/counts/wastage.
5. HR positions, compensation profiles, employees, contracts, attendance policy, shift templates, schedules, assignments.
6. Accounting COA, cost centers, fiscal periods, posting source maps, tax ledger config.
7. Service-generated operations: shifts, tills, orders, KDS, discounts, payments, refunds, reservations, deposits, events, tickets.
8. AP/AR/bank/budget/franchise/report/feedback/anomaly/staff insight records.
9. Alerts, feature flags, maintenance windows, training sessions.
10. Device and printer-route metadata; terminal pairing remains STUB.
11. Optional HMS API key creation through service/API only.

## Upsert vs Service/API

Use Prisma upsert/createMany with natural-key guards for stable master data: organizations, branches, settings, floor/table, menu catalog, modifier catalog, inventory items, suppliers, HR master data, COA/cost centers/fiscal setup, feature flags/windows, devices and printer routes.

Use service/API logic for recipe replacement, stock adjustments, orders/items, KDS generation, discounts, payments/refunds, shifts/tills, reservations/deposits/seating, event bookings/ticket issuance/check-in, journal posting/reversal, AP payments, AR receipts, bank reconciliation, reports/exports, idempotency/sync/conflict rows, receipt send/reprint, training-mode simulations, and HMS API keys.

## Deterministic IDs And Natural Keys

Prefer natural-key upserts and let cuid2 defaults create primary keys. Use stable external keys in CSV columns for cross-file references, then resolve to real IDs during import. Avoid hard-coded cuid values unless the importer owns a namespace and collision checks are explicit.

## Audit And Event Trails

Sensitive writes should use the same services/controllers where practical so AuditLog, ReservationEvent, EventAuditLog, JournalLine, StockAdjustment, FlagAudit, and other event trails are created in the expected shape. For seed-only historical snapshots, create explicit actor fields and matching domain event rows where the schema uses domain-specific event tables. Do not synthesize auth/session/security audit histories.

## Money And Decimal Handling

Store all CSV money and quantities as strings with fixed decimal scale. Convert with Prisma Decimal-compatible values in TypeScript. Validate line totals before import: quantity times unit price equals line total, sum lines equals subtotal, subtotal minus discounts plus tax/service equals total, and payments do not exceed payable totals unless explicitly modeled as deposits/credits/refunds.

## Idempotency

Every CSV row should have a stable natural key and optional externalKey. Importer should support dry-run, apply, and verify modes. Apply mode must be repeatable: master data uses upsert, append-only data uses natural-key existence checks, and service-generated data uses idempotency keys where supported.

## Validation After Import

Count rows by branch/domain, compare expected totals to database totals, rerun dry-run after apply, and later smoke health, login, auth/me, one protected branch route, waiter floor/orders/reservations/receipt read, owner dashboard, reports, AP/AR list, and HMS read-only with a safe key.
