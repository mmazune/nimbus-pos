# Demo Data Quality Checklist

## Pre-Generation

- [ ] Use only this repo: C:/Users/arman/Desktop/nimbus-pos.
- [ ] Do not use C:/Users/arman/Desktop/NIMBUS/nimbus-pos.
- [ ] Do not run migrations, seeds, servers, or production DB connections while generating CSVs.
- [ ] Confirm schema enum values from packages/db/prisma/schema.prisma; do not guess enum names.
- [ ] Confirm optional audit CSV/XLSX files are either present and parsed or explicitly reported missing.

## CSV Static Validation

- [ ] Every CSV has a header, stable row ordering, and deterministic external keys.
- [ ] Every required Prisma scalar/enum field is present or intentionally supplied by a service/default.
- [ ] Every enum value exists in the actual schema.
- [ ] Every date is ISO-8601 and compatible with UTC storage; business story uses Africa/Kampala for planning.
- [ ] Every Decimal/money/quantity field is a string, not binary floating math.
- [ ] No duplicate natural keys: user email, org slug, branch code/slug, table label per branch, category/menu item per scope, supplier/account/code numbers, order/reservation/event/journal/bill/invoice numbers.
- [ ] No real customer, employee, bank, tax, provider, or personal data.

## Referential Integrity

- [ ] All organization references resolve.
- [ ] All branch references resolve and respect org scope.
- [ ] All user, employee, role, and membership references resolve.
- [ ] Tables resolve to the correct branch/floor plan.
- [ ] Menu category, tax category, serving, modifier, and recipe references resolve.
- [ ] Inventory recipe lines reference valid inventory items and units.
- [ ] Orders reference valid users, branch tables, menu items, servings, modifiers, and shifts where applicable.
- [ ] Payments/refunds reference valid closed/payable orders and valid payments.
- [ ] Reservations reference available branch tables and do not overlap invalidly.
- [ ] Events/bookings/tickets maintain capacity and sold/check-in counters.
- [ ] HR attendance aligns with employees, schedules, shifts, leave, and swaps.
- [ ] Journal lines reference valid accounts, cost centers, and fiscal periods.

## Business Consistency

- [ ] Menu items use plausible ingredients.
- [ ] Recipes consume inventory in compatible units.
- [ ] Sales history uses items available at the same branch.
- [ ] Order totals equal item totals plus tax/discount/service rules.
- [ ] Payments do not exceed payable totals unless modeled as deposits, credits, or refunds.
- [ ] Stock usage, wastage, counts, and batches do not produce negative inventory unless explicitly allowed and documented.
- [ ] AP supplier bills align with suppliers and inventory/service story.
- [ ] AR invoices/receipts align with customer accounts and direct-bill/event story.
- [ ] Journal entries balance: total debits equal total credits per journal.
- [ ] Budgets, forecasts, franchise rankings, dashboards, reports, and anomalies are plausible against operational data.

## Safety Gates

- [ ] Public diner mobile-money remains labelled: CRITICAL - PENDING MTN/AIRTEL PROVIDER CONFIRMATION.
- [ ] PesaPal remains owner SaaS billing only.
- [ ] Receipt send remains PENDING - no live email/SMS/WhatsApp adapter.
- [ ] No receipt delivery success claims.
- [ ] Printer routes are metadata only; no print-driver invocation.
- [ ] Terminal pairing is STUB only; no acquirer/card-terminal traffic.
- [ ] HMS API keys are created through safe service/API flow only; no fake live provider credentials or plaintext secrets in CSV.
- [ ] MSR/badge login and smart spouts remain deferred late hardware wave.

## Future Post-Import Verification

- [ ] Dry-run reports zero unresolved foreign keys.
- [ ] Dry-run reports zero duplicate unique keys.
- [ ] Apply mode can run twice without creating duplicates.
- [ ] Row counts by CSV match expected created/updated/skipped counts.
- [ ] Aggregate sales, taxes, payments, refunds, stock values, payroll totals, AP/AR balances, and journal totals match generated control totals.
- [ ] Manual demo walkthrough can log in as each generated role.
