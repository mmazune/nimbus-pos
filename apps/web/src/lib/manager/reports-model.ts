import { formatManagerOperationsMoney, toManagerOperationsAmount } from "./operations-model";
import type {
  ManagerReportArtifact,
  ManagerReportArtifactApi,
  ManagerReportRun,
  ManagerReportRunApi,
  ManagerReportRunStatus,
  ManagerReportWindow,
} from "./reports-types";

/**
 * Manager Reports — presentation model (Track B4).
 *
 * This file exists almost entirely to stop ONE class of defect: rendering a
 * number under a label that does not describe it. That is exactly what B3-D1
 * was (the ex-tax figure under a tax-inclusive label), and a report summary is
 * a far richer opportunity to repeat it — 24 generators, ~90 distinct summary
 * keys, money and counts and percentages side by side in the same flat object.
 *
 * The rule adopted here is **fail-safe classification**: a summary key is
 * formatted as money only if it appears in an explicit money list. An
 * unrecognised key renders as plain text with a humanised label. A new backend
 * field can therefore look unpolished, but it can never be mislabelled as
 * currency — and the alternative (a `/total|amount|sales/i` regex) would have
 * silently formatted `conversionRate` and `noShowRate` as money.
 */

export const MANAGER_REPORT_WINDOWS: readonly ManagerReportWindow[] = [
  "DAY",
  "WEEK",
  "MONTH",
  "CUSTOM",
];

export const MANAGER_REPORT_RUN_STATUSES: readonly ManagerReportRunStatus[] = [
  "PENDING",
  "COMPLETED",
  "FAILED",
];

export const MANAGER_REPORT_WINDOW_LABELS: Readonly<Record<ManagerReportWindow, string>> = {
  DAY: "Today",
  WEEK: "This week",
  MONTH: "This month",
  CUSTOM: "Custom range",
};

// ── Labels ──────────────────────────────────────────────────────────────────

/**
 * Explicit labels for the summary keys whose plain camel-case name would be
 * ambiguous or actively misleading.
 *
 * ⚠️ The three sales keys are the reason this map exists. Backend gap batch 1
 * INVERTED `grossSales`/`netSales` (MP0-10): `grossSales` is now
 * `SUM(order.total)` — tax-INCLUSIVE — and `netSales` is `grossSales − taxTotal`
 * — ex-tax. A bare "Gross sales" / "Net sales" label is forbidden across the
 * Manager workspace, so each of these states its tax basis, matching the
 * wording B2's Sales card already uses. **Do not "fix" these back.**
 */
const MANAGER_SUMMARY_LABELS: Readonly<Record<string, string>> = {
  grossSales: "Sales (tax-inclusive)",
  netSales: "Sales (ex-tax)",
  subtotalSales: "Subtotal (ex-tax, before discount)",
  taxTotal: "Tax",
  discountTotal: "Discounts",
  refundTotal: "Refunds",
  refundCount: "Refund count",
  safeDropTotal: "Safe drops",
  avgOrderValue: "Average order value",
  orderCount: "Orders",
  shiftCount: "Shifts",
  tillCount: "Tills",
  totalAmount: "Total",
  totalSales: "Total sales",
  grandTotal: "Grand total",
  totalVariance: "Total variance",
  totalEstimatedCost: "Estimated cost",
  totalRevenue: "Revenue",
  peakHour: "Peak hour",
  peakSales: "Peak-hour sales",
  totalOrders: "Orders",
  totalUniqueItems: "Distinct items",
  conversionRate: "Conversion rate",
  noShowRate: "No-show rate",
  overallUtilization: "Utilisation",
  totalPartySize: "Total covers",
  avgPartySize: "Average party size",
  totalLowStockItems: "Items below reorder level",
  itemsAffected: "Items affected",
  staffCount: "Staff",
  totalActorsWithAnomalies: "Staff with anomalies",
};

/**
 * Summary keys that hold MONEY. Every one was read off a live response on
 * 2026-08-20; nothing here is inferred from the name.
 */
const MANAGER_SUMMARY_MONEY_KEYS = new Set([
  "grossSales",
  "netSales",
  "subtotalSales",
  "taxTotal",
  "discountTotal",
  "refundTotal",
  "safeDropTotal",
  "avgOrderValue",
  "totalAmount",
  "totalSales",
  "grandTotal",
  "totalVariance",
  "totalEstimatedCost",
  "totalRevenue",
  "peakSales",
]);

/** Summary keys that hold a percentage the backend has already computed. */
const MANAGER_SUMMARY_PERCENT_KEYS = new Set([
  "conversionRate",
  "noShowRate",
  "overallUtilization",
]);

/**
 * Nested objects that are a `{label: money}` map rather than a record — these
 * are flattened into individual money rows (`Payment · CARD`), which is exactly
 * how the CSV renders them (`Payment (CARD),16691800`).
 */
const MANAGER_SUMMARY_MONEY_MAPS = new Set(["paymentBreakdown"]);

/** Nested objects that are a `{label: count}` map. */
const MANAGER_SUMMARY_COUNT_MAPS = new Set(["byStatus", "byType", "bySeverity"]);

const MANAGER_SUMMARY_MAP_PREFIXES: Readonly<Record<string, string>> = {
  paymentBreakdown: "Payment",
  byStatus: "Status",
  byType: "Type",
  bySeverity: "Severity",
};

export function humaniseManagerReportKey(key: string) {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function managerReportLabel(key: string) {
  return MANAGER_SUMMARY_LABELS[key] || humaniseManagerReportKey(key);
}

export function managerReportTypeLabel(reportType: string) {
  return humaniseManagerReportKey(reportType);
}

// ── Summary → key/value entries ─────────────────────────────────────────────

export type ManagerSummaryEntryKind = "money" | "percent" | "count" | "text";

export type ManagerSummaryEntry = {
  key: string;
  label: string;
  kind: ManagerSummaryEntryKind;
  value: string;
};

function formatPercent(value: unknown) {
  const amount = toManagerOperationsAmount(value as never);
  return amount === null ? String(value) : `${amount}%`;
}

function formatCount(value: unknown) {
  const amount = toManagerOperationsAmount(value as never);
  return amount === null ? String(value) : new Intl.NumberFormat("en-US").format(amount);
}

function entryFor(
  key: string,
  value: unknown,
  currencyCode: string | null,
  labelOverride?: string,
): ManagerSummaryEntry | null {
  if (value === null || value === undefined) return null;

  if (MANAGER_SUMMARY_MONEY_KEYS.has(key)) {
    return {
      key,
      label: labelOverride || managerReportLabel(key),
      kind: "money",
      value: formatManagerOperationsMoney(value as never, currencyCode),
    };
  }

  if (MANAGER_SUMMARY_PERCENT_KEYS.has(key)) {
    return { key, label: labelOverride || managerReportLabel(key), kind: "percent", value: formatPercent(value) };
  }

  if (typeof value === "number") {
    return { key, label: labelOverride || managerReportLabel(key), kind: "count", value: formatCount(value) };
  }

  // Strings that are not in the money list stay text — a decimal string whose
  // meaning is unknown is shown as-is rather than guessed into a currency.
  return { key, label: labelOverride || managerReportLabel(key), kind: "text", value: String(value) };
}

/**
 * Flatten a run's `summary` into ordered key/value rows.
 *
 * Arrays are deliberately SKIPPED here — they are the breakdown table, and
 * `toManagerReportBreakdown` renders them separately so a 24-row hourly series
 * never collapses into an unreadable key/value line.
 */
export function toManagerReportSummaryEntries(
  summary: Record<string, unknown> | null,
  currencyCode: string | null,
): ManagerSummaryEntry[] {
  if (!summary) return [];
  const entries: ManagerSummaryEntry[] = [];

  for (const [key, value] of Object.entries(summary)) {
    if (Array.isArray(value)) continue;

    if (value && typeof value === "object") {
      const isMoneyMap = MANAGER_SUMMARY_MONEY_MAPS.has(key);
      const isCountMap = MANAGER_SUMMARY_COUNT_MAPS.has(key);
      if (!isMoneyMap && !isCountMap) continue;

      const prefix = MANAGER_SUMMARY_MAP_PREFIXES[key] || managerReportLabel(key);
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        const label = `${prefix} · ${humaniseManagerReportKey(innerKey)}`;
        const entry = isMoneyMap
          ? entryFor("totalAmount", innerValue, currencyCode, label)
          : entryFor(`${key}.${innerKey}`, innerValue, currencyCode, label);
        if (entry) entries.push({ ...entry, key: `${key}.${innerKey}` });
      }
      continue;
    }

    const entry = entryFor(key, value, currencyCode);
    if (entry) entries.push(entry);
  }

  return entries;
}

// ── Summary → breakdown table ───────────────────────────────────────────────

export type ManagerBreakdownColumn = {
  field: string;
  label: string;
  kind: ManagerSummaryEntryKind;
};

export type ManagerReportBreakdown = {
  /** The summary key the rows came from, e.g. `topItems`. */
  sourceKey: string;
  label: string;
  columns: readonly ManagerBreakdownColumn[];
  rows: readonly Record<string, unknown>[];
};

/**
 * The per-report breakdown spec.
 *
 * ## Why this is curated and not derived
 *
 * The obvious implementation — "take the first array in `summary` and render
 * every key on its rows" — was written first and **produced a live mislabel**,
 * which is exactly the defect class B3-D1 belongs to:
 *
 * `grossSales` at the TOP level of a DAILY_SALES summary is `SUM(order.total)`
 * — **tax-inclusive** since backend gap batch 1. But `grossSales` inside
 * `topItems[]` and `categories[]` is `SUM(orderItem.subtotal)` — **ex-tax**.
 * The same field name carries two different tax bases in the same API, so a
 * single global label map cannot be correct for both, and the generic version
 * rendered per-item ex-tax figures under "Sales (tax-inclusive)".
 *
 * Recorded as B4-F2. Until the backend's vocabulary is reconciled, each report
 * names its own columns here, with the basis stated where money is involved.
 *
 * ## The columns mirror the CSV
 *
 * Each spec below reproduces that report's own CSV header from
 * `reports.service.ts#generateCsv`, in order — `Rank,Item,Quantity Sold,Gross
 * Sales` for TOP_ITEMS, `Method,Amount,Count,Percentage` for PAYMENT_MIX, and
 * so on. That is what makes the on-screen claim "these rows are what the CSV
 * contains" literally true, and it keeps raw identifiers (`menuItemId`,
 * `categoryId`, `inventoryItemId`) out of the table — the CSV does not carry
 * them either.
 *
 * Staff emails DO appear, in the four audit reports whose CSV exports them
 * (`Actor,Count,Total` and STAFF_OPERATIONS' `Email,…`). Showing them is not a
 * new disclosure: they are in the file the manager is about to download, and
 * these reports exist precisely to attribute voids, refunds and discounts.
 */
type ManagerBreakdownSpec = {
  sourceKey: string;
  label: string;
  columns: readonly ManagerBreakdownColumn[];
};

const money = (field: string, label: string): ManagerBreakdownColumn => ({ field, label, kind: "money" });
const count = (field: string, label: string): ManagerBreakdownColumn => ({ field, label, kind: "count" });
const percent = (field: string, label: string): ManagerBreakdownColumn => ({ field, label, kind: "percent" });
const plain = (field: string, label: string): ManagerBreakdownColumn => ({ field, label, kind: "text" });

const MANAGER_REPORT_BREAKDOWNS: Readonly<Record<string, ManagerBreakdownSpec>> = {
  PAYMENT_MIX: {
    sourceKey: "breakdown",
    label: "Payment methods",
    columns: [
      plain("method", "Method"),
      money("amount", "Amount"),
      count("count", "Payments"),
      percent("percentage", "Share"),
    ],
  },
  TOP_ITEMS: {
    sourceKey: "topItems",
    label: "Top items",
    columns: [
      plain("name", "Item"),
      count("quantitySold", "Quantity sold"),
      // Ex-tax: SUM(orderItem.subtotal). NOT the tax-inclusive basis the
      // top-level grossSales uses (B4-F2).
      money("grossSales", "Gross sales (ex-tax)"),
    ],
  },
  SALES_BY_CATEGORY: {
    sourceKey: "categories",
    label: "Sales by category",
    columns: [
      plain("categoryName", "Category"),
      count("quantitySold", "Quantity sold"),
      money("grossSales", "Gross sales (ex-tax)"),
      count("lineItems", "Line items"),
      percent("percentage", "Share"),
    ],
  },
  SALES_BY_HOUR: {
    sourceKey: "hourlyBreakdown",
    label: "Sales by hour",
    columns: [
      plain("label", "Hour"),
      count("orderCount", "Orders"),
      // SUM(order.total) — tax-inclusive, unlike the two above.
      money("sales", "Sales (tax-inclusive)"),
    ],
  },
  OPEN_CLOSED_ORDERS: {
    sourceKey: "breakdown",
    label: "Orders by status",
    columns: [
      plain("status", "Status"),
      count("count", "Orders"),
      money("totalValue", "Value (tax-inclusive)"),
    ],
  },
  DISCOUNTS_SUMMARY: {
    sourceKey: "actorBreakdown",
    label: "Discounts by actor",
    columns: [plain("email", "Actor"), count("count", "Discounts"), money("total", "Total")],
  },
  VOIDS_SUMMARY: {
    sourceKey: "actorBreakdown",
    label: "Voids by actor",
    columns: [plain("email", "Actor"), count("count", "Voids"), money("total", "Total")],
  },
  REFUNDS_SUMMARY: {
    sourceKey: "actorBreakdown",
    label: "Refunds by actor",
    columns: [plain("email", "Actor"), count("count", "Refunds"), money("total", "Total")],
  },
  CASH_VARIANCE: {
    sourceKey: "tillBreakdown",
    label: "Tills",
    columns: [
      plain("tillCode", "Till"),
      plain("operatorEmail", "Operator"),
      money("openingFloat", "Opening float"),
      money("expectedCash", "Expected"),
      money("countedCash", "Counted"),
      money("variance", "Variance"),
      plain("varianceStatus", "Status"),
    ],
  },
  CASH_MOVEMENTS: {
    sourceKey: "typeBreakdown",
    label: "Movements by type",
    columns: [plain("type", "Type"), count("count", "Movements"), money("total", "Total")],
  },
  STOCK_VARIANCE: {
    sourceKey: "varianceItems",
    label: "Stock variance by item",
    columns: [
      plain("name", "Item"),
      plain("unit", "Unit"),
      count("positiveAdjustments", "Positive"),
      count("negativeAdjustments", "Negative"),
      count("netChange", "Net change"),
      count("adjustmentCount", "Adjustments"),
    ],
  },
  WASTAGE_SUMMARY: {
    sourceKey: "wastageItems",
    label: "Wastage by item",
    columns: [
      plain("name", "Item"),
      plain("unit", "Unit"),
      count("totalWastedQty", "Wasted quantity"),
      money("estimatedCost", "Estimated cost"),
      count("adjustmentCount", "Adjustments"),
    ],
  },
  LOW_STOCK: {
    sourceKey: "lowStockItems",
    label: "Items below reorder level",
    columns: [
      plain("name", "Item"),
      plain("unit", "Unit"),
      count("currentStock", "In stock"),
      count("reorderLevel", "Reorder level"),
      count("reorderQty", "Reorder quantity"),
    ],
  },
  RESERVATION_DEPOSITS: {
    sourceKey: "statusBreakdown",
    label: "Deposits by status",
    columns: [plain("status", "Status"), count("count", "Deposits"), money("total", "Total")],
  },
  HIGH_RISK_ACTORS: {
    sourceKey: "actors",
    label: "Actors with anomalies",
    columns: [
      plain("userId", "User"),
      count("totalAnomalies", "Anomalies"),
      count("highSeverityCount", "High severity"),
      plain("anomalyTypes", "Types"),
    ],
  },
  STAFF_OPERATIONS: {
    sourceKey: "staffBreakdown",
    label: "Activity by staff member",
    columns: [
      plain("email", "Staff"),
      count("salesCount", "Sales"),
      money("salesTotal", "Sales total"),
      count("refundCount", "Refunds"),
      money("refundTotal", "Refund total"),
      count("discountCount", "Discounts"),
      money("discountTotal", "Discount total"),
      count("voidCount", "Voids"),
      money("voidTotal", "Void total"),
    ],
  },
};

/**
 * Extract the breakdown rows a summary carries, if this report has a spec.
 *
 * 16 of the 24 generators embed a real array in `summary`, and the CSV export
 * is built from that same array. Rendering it is showing the export's own
 * contents — it is NOT fabricating a row table from `rowCount`, which
 * C-03/MP0-08 forbids and which nothing in this module does.
 *
 * Returns `null` when the report has no spec or the array is empty, and the UI
 * then says in words that this report has no per-row breakdown.
 */
export function toManagerReportBreakdown(
  reportType: string,
  summary: Record<string, unknown> | null,
): ManagerReportBreakdown | null {
  if (!summary) return null;

  const spec = MANAGER_REPORT_BREAKDOWNS[reportType];
  if (!spec) return null;

  const value = summary[spec.sourceKey];
  if (!Array.isArray(value) || value.length === 0) return null;

  const rows = value.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
  if (!rows.length) return null;

  return { sourceKey: spec.sourceKey, label: spec.label, columns: spec.columns, rows };
}

/** Format one breakdown cell using the column's DECLARED kind, never a guess. */
export function formatManagerBreakdownCell(
  column: ManagerBreakdownColumn,
  value: unknown,
  currencyCode: string | null,
) {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return "—";

  if (column.kind === "money") return formatManagerOperationsMoney(value as never, currencyCode);
  if (column.kind === "percent") return formatPercent(value);
  if (column.kind === "count") return formatCount(value);
  return String(value);
}

export function isManagerBreakdownColumnNumeric(column: ManagerBreakdownColumn) {
  return column.kind === "money" || column.kind === "count" || column.kind === "percent";
}

// ── Runs ────────────────────────────────────────────────────────────────────

function text(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function readRunStatus(value: string | null | undefined): ManagerReportRunStatus {
  const raw = (value || "").toUpperCase();
  return raw === "COMPLETED" || raw === "FAILED" || raw === "PENDING" ? raw : "PENDING";
}

function readWindow(value: string | null | undefined): ManagerReportWindow | null {
  const raw = (value || "").toUpperCase();
  return (MANAGER_REPORT_WINDOWS as readonly string[]).includes(raw)
    ? (raw as ManagerReportWindow)
    : null;
}

function projectArtifact(artifact: ManagerReportArtifactApi): ManagerReportArtifact {
  return {
    id: artifact.id,
    fileName: text(artifact.fileName) || "report.csv",
    fileSizeBytes:
      typeof artifact.fileSizeBytes === "number" && Number.isFinite(artifact.fileSizeBytes)
        ? artifact.fileSizeBytes
        : null,
    checksum: text(artifact.checksum),
    readyAt: text(artifact.readyAt),
  };
}

/**
 * Project a run.
 *
 * The artifact split is the load-bearing part. `exportArtifacts[]` can contain
 * pre-2026-08-20 **PDF** rows that C-01 withdrew: they still say
 * `status: READY` and `mimeType: application/pdf`, but their file 404s on
 * download (verified live). They are counted so the detail view can DISCLOSE
 * them in words, and they are never turned into a download control.
 */
export function projectManagerReportRun(run: ManagerReportRunApi): ManagerReportRun {
  const artifacts = Array.isArray(run.exportArtifacts) ? run.exportArtifacts : [];
  const reportType = text(run.reportType) || "UNKNOWN";

  const csvArtifacts = artifacts
    .filter(
      (artifact) =>
        String(artifact.format || "").toUpperCase() === "CSV" &&
        String(artifact.status || "").toUpperCase() === "READY",
    )
    .map(projectArtifact);

  // Newest first — `readyAt` is set the moment the file lands on disk.
  csvArtifacts.sort((a, b) => (b.readyAt || "").localeCompare(a.readyAt || ""));

  return {
    id: run.id,
    reportType,
    reportTypeLabel: managerReportTypeLabel(reportType),
    reportWindow: readWindow(run.reportWindow),
    status: readRunStatus(run.status),
    branchId: text(run.branchId),
    dateFrom: text(run.dateFrom),
    dateTo: text(run.dateTo),
    generatedAt: text(run.generatedAt) || text(run.createdAt),
    failureReason: text(run.failureReason),
    rowCount:
      typeof run.rowCount === "number" && Number.isFinite(run.rowCount) ? run.rowCount : null,
    summary:
      run.summary && typeof run.summary === "object" && !Array.isArray(run.summary)
        ? (run.summary as Record<string, unknown>)
        : null,
    csvArtifact: csvArtifacts[0] || null,
    withdrawnPdfCount: artifacts.filter(
      (artifact) => String(artifact.format || "").toUpperCase() === "PDF",
    ).length,
  };
}

export function formatManagerReportRange(run: ManagerReportRun) {
  if (!run.dateFrom && !run.dateTo) return "—";
  const format = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };
  const from = format(run.dateFrom);
  const to = format(run.dateTo);
  return from === to ? from : `${from} → ${to}`;
}

export function formatManagerFileSize(bytes: number | null) {
  if (bytes === null) return "size unknown";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function managerReportStatusTone(status: ManagerReportRunStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  return "warning" as const;
}
