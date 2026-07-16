# Enterprise Demo Data Generation Report

## Summary

Generated a deterministic, reviewable CSV pack for Nimbus Hospitality Group.

## Row count highlights

- Branches: 4
- Employees: 36
- Tables: 68
- Menu items: 99
- Inventory items: 180
- Stock batches: 280
- Orders: 1192
- Order items: 2950
- Payments: 747
- Reservations: 120
- Events: 8
- Event tickets: 69
- Journal entries: 40
- Journal lines: 80

## Domains covered

Tenancy, RBAC mappings, floor/tables, menu/modifiers/servings, recipes, inventory/FIFO opening balances, stock ledger movements, suppliers/AP, shifts/tills, POS orders, order lines, payments, refunds, receipts-as-audit-events, reservations/deposits, events/bookings/tickets, attendance/leave/swaps, COA/cost centers/fiscal periods, balanced GL journals, AP bills/payments, AR accounts/invoices/receipts, feedback, anomalies, devices/printer routes, reports, alerts, feature flags, maintenance windows, training sessions, and HMS-safe metadata.

## Skipped

- Purchase orders and goods receipts CSVs were intentionally not generated because the scan manifest reported no current Prisma model for those rows.
- HMS plaintext API keys were not generated.
- Live receipt delivery and live public mobile-money success rows were not generated.

## Known importer requirement

State-machine-heavy domains should be validated and imported through repo-aware logic. Use dry-run first.
