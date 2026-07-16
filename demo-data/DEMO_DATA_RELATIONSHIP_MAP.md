# Demo Data Relationship Map

## Organization

`Nimbus Hospitality Group` (`nimbus`) owns four active branches: Tapas Downtown, Rooftop Bar, Garden Cafe, and Events Kitchen / Banquet Hall.

## Branches to operations

Each branch has staff, floor plans, tables, tax categories, menu categories, menu items, inventory items, suppliers, shifts, tills, orders, reservations, devices, printer route metadata, reports, alerts, and franchise/scorecard context.

## Menu → recipes → inventory

Menu items are branch-scoped. Recipe lines connect top menu items to inventory ingredients. Stock batches provide opening FIFO stock and stock ledger entries add opening balance/wastage movements.

## POS

Orders reference branches, tables, users, menu items, and payments. Closed orders have matching payments. Receipt history is represented as pending/audit-style events only; no delivered send state is used.

## Reservations / events

Reservations reference branch tables and can be used by the importer to seat/order-link if services support it. Events include ticket classes, bookings, and issued tickets.

## Accounting

COA and cost centers support balanced journals. AP bills link to suppliers and AP payments. AR invoices link to customer accounts and AR receipts. Journals are balanced by construction.

## Franchise

Branch differences are reflected in menu mix, sales volumes, reports, anomalies, and scorecard-ready summaries.
