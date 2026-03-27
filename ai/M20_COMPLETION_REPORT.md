# M20 Completion Report — Reporting v1 + Exports

## Summary

M20 implements the operational reporting engine for Nimbus POS. It provides on-demand report generation for 6 report types (shift-end, daily-sales, payment-mix, top-items, stock-variance, anomaly-summary) with CSV/PDF export artifact creation and download. Reports aggregate data from existing operational tables and store structured summaries in ReportRun records.

## What Was Built

### Database Layer
- **5 enums**: `ReportType`, `ReportWindow`, `ExportFormat`, `ReportRunStatus`, `ExportArtifactStatus`
- **2 models**: `ReportRun` (report generation tracking), `ExportArtifact` (export file tracking)
- **16 indexes** for query performance across both tables
- **Migration**: `20260327200000_m20_reporting_exports` (migration #24)

### API Endpoints (10 total)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/api/reports/shift-end` | `pos:reports:shift-end:generate` | Generate shift-end report |
| POST | `/api/reports/daily-sales` | `pos:reports:daily-sales:generate` | Generate daily sales report |
| POST | `/api/reports/payment-mix` | `pos:reports:payment-mix:generate` | Generate payment mix report |
| POST | `/api/reports/top-items` | `pos:reports:top-items:generate` | Generate top items report |
| POST | `/api/reports/stock-variance` | `pos:reports:stock-variance:generate` | Generate stock variance report |
| POST | `/api/reports/anomaly-summary` | `pos:reports:anomaly-summary:generate` | Generate anomaly summary report |
| GET | `/api/reports` | `pos:reports:history:read` | List reports (paginated, filterable) |
| GET | `/api/reports/:id` | `pos:reports:history:read` | Get report by ID with export artifacts |
| POST | `/api/reports/export` | `pos:reports:exports:read` | Create CSV/PDF export from completed report |
| GET | `/api/reports/exports/:id/download` | `pos:reports:exports:download` | Download export artifact file |

### Permissions (11 total)

- `pos:reports:shift-end:generate`, `pos:reports:daily-sales:generate`, `pos:reports:payment-mix:generate`
- `pos:reports:top-items:generate`, `pos:reports:stock-variance:generate`, `pos:reports:anomaly-summary:generate`
- `pos:reports:reservation-summary:generate`, `pos:reports:event-summary:generate` (reserved)
- `pos:reports:exports:read`, `pos:reports:exports:download`, `pos:reports:history:read`

### Role Mappings

| Role | Permissions |
|------|-----------|
| Owner | All 11 permissions |
| Manager | All 11 permissions |
| Accountant | daily-sales:generate, payment-mix:generate, exports:read, exports:download, history:read |
| Supervisor | shift-end:generate, daily-sales:generate, top-items:generate, exports:read, exports:download, history:read |
| Cashier | None |
| Chef | None |
| Waiter | None |

### Report Types

| Type | Data Sources | Key Metrics |
|------|-------------|-------------|
| SHIFT_END | Shift, TillSession, CashMovement, Order, Payment, Refund | Shift/till counts, gross/net sales, payment breakdown, refunds, safe drops |
| DAILY_SALES | Order, Payment, Refund | Gross/net sales, tax, discounts, order count, AOV, payment mix |
| PAYMENT_MIX | Payment | Method breakdown with amounts, counts, percentages |
| TOP_ITEMS | OrderItem, MenuItem | Top-N items by quantity sold and gross sales contribution |
| STOCK_VARIANCE | StockAdjustment, InventoryItem | Positive/negative adjustments, net change per item |
| ANOMALY_SUMMARY | AnomalyEvent | Totals by status, severity, type |

### Export Formats

- **CSV**: Structured key-value or tabular format depending on report type
- **PDF**: Structured text document (v1 — proper PDF render reserved for future milestone)

### Audit Events

| Action | Trigger |
|--------|---------|
| REPORT_RUN_COMPLETED | Report generation succeeded |
| REPORT_RUN_FAILED | Report generation failed |
| EXPORT_ARTIFACT_CREATED | Export artifact created (pending) |
| EXPORT_ARTIFACT_READY | Export file generated and ready |

## Files Created/Modified

### Created
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/api/src/modules/reports/reports.controller.ts`
- `apps/api/src/modules/reports/reports.module.ts`
- `apps/api/src/modules/reports/reports.service.spec.ts`
- `apps/api/src/modules/reports/dto/create-shift-end-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-daily-sales-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-payment-mix-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-top-items-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-stock-variance-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-anomaly-summary-report.dto.ts`
- `apps/api/src/modules/reports/dto/create-export.dto.ts`
- `apps/api/src/modules/reports/dto/list-reports-query.dto.ts`
- `apps/api/src/modules/reports/dto/index.ts`
- `apps/api/test/reports.e2e-spec.ts`
- `packages/db/prisma/migrations/20260327200000_m20_reporting_exports/migration.sql`
- `postman/collections/M20-Reporting-v1-Exports.postman_collection.json`
- `ai/M20_COMPLETION_REPORT.md`

### Modified
- `packages/db/prisma/schema.prisma` — M20 enums, models, relations
- `packages/db/prisma/seed.ts` — M20 permissions, role mappings, seed data function
- `apps/api/src/app.module.ts` — ReportsModule import
- `.gitignore` — Added `apps/api/exports/` to ignore generated export artifacts
- `docs/ARCHITECTURE.md` — M20 section
- `docs/MODULES.md` — Reports / Exports status updated
- `docs/POSTMAN_ENDPOINT_GUIDE.md` — M20 endpoint table
- `ai/AI_STATUS.md` — M20 checklist + status update

## Test Counts

- Unit tests: 20 new (reports.service.spec.ts)
- E2E tests: 17 new (reports.e2e-spec.ts)
- Total unit tests: ~390 (24 suites)
- Total e2e tests: ~354 (20 suites)

## Bugs Fixed During Verification

1. **`user.sub` → `user.id`** — `@CurrentUser()` returns `{ id }` not `{ sub }`. All 7 controller method calls fixed.
2. **StockAdjustment field names** — `inventoryItemId` → `itemId`, `quantity` → `qtyDelta` per actual Prisma schema.
3. **DTO definite assignment** — Added `!` to required DTO properties (`reportWindow!:`, `reportRunId!:`, `format!:`) for strict init.
4. **Pagination string coercion** — `page`/`pageSize` query params coerced via `Number()` to ensure Prisma `skip`/`take` receive integers.
5. **Unused import** — Removed `ExportArtifactStatus` from service imports.

## Known Limitations

1. **Synchronous export generation** — Large reports may cause slower API responses. A future milestone could add async job processing (BullMQ).
2. **Local filesystem storage** — Export artifacts are stored on the API server's local disk. Production deployments should migrate to S3/GCS.
3. **Text-based PDF** — PDF exports are structured text documents, not proper PDF renders via pdfkit/puppeteer.
4. **RESERVATION_SUMMARY and EVENT_SUMMARY** — Enum values reserved but not yet implemented as generator methods.
5. **No scheduled reports** — All reports are on-demand. Scheduled/recurring reports reserved for a future milestone.

## Deferred Items

- M13.1 (MTN Native Request-to-Pay) = **PENDING**
- M13.2 (Airtel Native) = **PENDING**
- Cloud object storage for export artifacts
- Async report generation via job queue
- Proper PDF rendering library integration
- Scheduled/recurring report generation

## Verification Checklist

- [x] `pnpm db:generate` passes
- [x] Migration applied (#24)
- [x] Seed runs twice idempotently
- [x] Lint: 0 errors
- [x] Unit tests pass
- [x] E2E tests pass
- [x] Postman collection created with 16 requests
- [x] All docs updated
- [x] AI_STATUS.md updated
- [x] Branch: milestone/m20-reporting-exports
