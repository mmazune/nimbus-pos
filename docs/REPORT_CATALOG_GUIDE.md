# REPORT_CATALOG_GUIDE.md — Nimbus POS M20.1

## Overview

The **Report Catalog** (`GET /api/reports/catalog`) returns a JSON array describing every report type known to the system — its key, human-readable title, description, implementation status, supported export formats, and required permission.

Frontend clients should call this endpoint to build dynamic "Generate Report" UIs.

## Catalog Entry Schema

```json
{
  "key": "DAILY_SALES",
  "title": "Daily Sales Report",
  "description": "Gross/net sales, tax, discounts, order count, AOV, payment mix",
  "status": "IMPLEMENTED",
  "formats": ["CSV", "PDF"],
  "permission": "pos:reports:daily-sales:generate"
}
```

| Field         | Type       | Description                                         |
| ------------- | ---------- | --------------------------------------------------- |
| `key`         | string     | ReportType enum value (used in POST body)           |
| `title`       | string     | Human-readable label for UI display                 |
| `description` | string     | Short description of what the report contains        |
| `status`      | string     | `IMPLEMENTED`, `CONDITIONAL`, or `PENDING_LATER`    |
| `formats`     | string[]   | Supported export formats (CSV, PDF)                  |
| `permission`  | string     | Permission action string required to generate        |

## Status Values

| Status          | Meaning                                                      |
| --------------- | ------------------------------------------------------------ |
| `IMPLEMENTED`   | Generator exists, data is queried, report can be generated   |
| `CONDITIONAL`   | Code exists but result depends on optional module data        |
| `PENDING_LATER` | Planned for a future milestone — no generator yet            |

## Report Types (M20 + M20.1)

### A) Core Sales / Revenue

| Key               | Title                        | Status        | Permission                              |
| ----------------- | ---------------------------- | ------------- | --------------------------------------- |
| SHIFT_END         | Shift-End Report             | IMPLEMENTED   | pos:reports:shift-end:generate          |
| DAILY_SALES       | Daily Sales Report           | IMPLEMENTED   | pos:reports:daily-sales:generate        |
| PAYMENT_MIX       | Payment Mix Report           | IMPLEMENTED   | pos:reports:payment-mix:generate        |
| TOP_ITEMS         | Top Items Report             | IMPLEMENTED   | pos:reports:top-items:generate          |
| SALES_BY_CATEGORY | Sales by Category / PMIX     | IMPLEMENTED   | pos:reports:sales-by-category:generate  |
| SALES_BY_HOUR     | Sales by Hour / Daypart      | IMPLEMENTED   | pos:reports:sales-by-hour:generate      |
| OPEN_CLOSED_ORDERS| Open vs Closed Orders        | IMPLEMENTED   | pos:reports:sales-by-hour:generate      |

### B) Loss Prevention / Cash Control

| Key               | Title                        | Status        | Permission                              |
| ----------------- | ---------------------------- | ------------- | --------------------------------------- |
| DISCOUNTS_SUMMARY | Discounts Summary            | IMPLEMENTED   | pos:reports:discounts:generate          |
| VOIDS_SUMMARY     | Voids Summary                | IMPLEMENTED   | pos:reports:voids:generate              |
| REFUNDS_SUMMARY   | Refunds Summary              | IMPLEMENTED   | pos:reports:refunds:generate            |
| CASH_VARIANCE     | Cash Variance / Over-Short   | IMPLEMENTED   | pos:reports:cash-variance:generate      |
| CASH_MOVEMENTS    | Cash Movements Detail        | IMPLEMENTED   | pos:reports:cash-movements:generate     |

### C) Inventory

| Key               | Title                        | Status        | Permission                              |
| ----------------- | ---------------------------- | ------------- | --------------------------------------- |
| STOCK_VARIANCE    | Stock Variance Report        | IMPLEMENTED   | pos:reports:stock-variance:generate     |
| WASTAGE_SUMMARY   | Wastage / Spoilage Report    | IMPLEMENTED   | pos:reports:wastage:generate            |
| LOW_STOCK         | Low-Stock Alert Report       | IMPLEMENTED   | pos:reports:low-stock:generate          |

### D) Reservations / Events

| Key                  | Title                     | Status        | Permission                              |
| -------------------- | ------------------------- | ------------- | --------------------------------------- |
| RESERVATION_SUMMARY  | Reservation Summary       | IMPLEMENTED   | pos:reports:reservations:generate       |
| RESERVATION_DEPOSITS | Reservation Deposits      | IMPLEMENTED   | pos:reports:reservations:generate       |
| RESERVATION_NO_SHOWS | Reservation No-Shows      | IMPLEMENTED   | pos:reports:reservations:generate       |
| EVENT_SUMMARY        | Event Summary             | IMPLEMENTED   | pos:reports:events:generate             |
| EVENT_BOOKINGS       | Event Bookings Detail     | IMPLEMENTED   | pos:reports:events:generate             |
| EVENT_CHECKINS       | Event Check-In Detail     | IMPLEMENTED   | pos:reports:events:generate             |

### E) Risk / Staff

| Key               | Title                        | Status        | Permission                              |
| ----------------- | ---------------------------- | ------------- | --------------------------------------- |
| ANOMALY_SUMMARY   | Anomaly Summary              | IMPLEMENTED   | pos:reports:anomaly-summary:generate    |
| HIGH_RISK_ACTORS  | High-Risk Actors Report      | IMPLEMENTED   | pos:reports:anomaly-summary:generate    |
| STAFF_OPERATIONS  | Staff Operations Report      | IMPLEMENTED   | pos:reports:staff-operations:generate   |

## Generating a Report

```bash
# 1. Generate
curl -X POST http://localhost:3001/api/reports/sales-by-category \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-branch-id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{"reportWindow":"DAY"}'

# 2. Export to CSV
curl -X POST http://localhost:3001/api/reports/export \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-branch-id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{"reportRunId":"<id from step 1>","format":"CSV"}'

# 3. Download
curl -O http://localhost:3001/api/reports/exports/<artifactId>/download \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-branch-id: $BRANCH_ID"
```

## Report Windows

| Value    | Behavior                                                |
| -------- | ------------------------------------------------------- |
| `DAY`    | Today (midnight to now)                                 |
| `WEEK`   | Last 7 days                                             |
| `MONTH`  | Last 30 days                                            |
| `CUSTOM` | Requires `dateFrom` and `dateTo` fields (ISO date)      |

## Role Access Matrix

| Role        | Reports accessible                                        |
| ----------- | --------------------------------------------------------- |
| Owner       | All 24 report types + catalog                              |
| Manager     | All 24 report types + catalog                              |
| Accountant  | Financial subset (8): sales, payments, discounts, cash, refunds |
| Supervisor  | Operational subset (10): sales, inventory, reservations, events |
| Other roles | No report access                                           |
