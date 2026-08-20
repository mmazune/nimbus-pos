import type {
  ManagerReportAvailability,
  ManagerReportCatalogEntry,
  ManagerReportCatalogEntryApi,
  ManagerReportCatalogStatus,
} from "./reports-types";

/**
 * Manager Reports — the catalog model (Track B4).
 *
 * ## The availability rule
 *
 * The backend already publishes a truthful availability signal, so B4 does not
 * invent one. `GET /api/reports/catalog` tags every entry `IMPLEMENTED` (24),
 * `CONDITIONAL` (1) or `PENDING_LATER` (12) — the exact 24-of-37 split
 * `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` verified. The UI maps that field
 * straight through, and the 13 non-implemented entries have **no generator
 * route at all**, so an unavailable report cannot be generated even by
 * accident: `generatorPath` is `null` and there is nothing to call.
 *
 * ## Why a route map exists at all
 *
 * The catalog does NOT publish the POST path — only a `key`. The map below is
 * therefore the one piece of coupling B4 cannot avoid, and it is deliberately
 * explicit rather than derived by a `key.toLowerCase().replace("_","-")` trick,
 * because two entries would break such a rule (`DISCOUNTS_SUMMARY` posts to
 * `/discounts-summary` but `RESERVATION_SUMMARY` posts to `/reservation-summary`
 * while `MENU_ENGINEERING` posts to nothing at all). Every entry here was
 * checked against `reports.controller.ts` and then **executed live** — all 24
 * returned 201.
 */

/** catalog key → POST route segment. Only the 24 IMPLEMENTED entries appear. */
const MANAGER_REPORT_GENERATOR_PATHS: Readonly<Record<string, string>> = {
  SHIFT_END: "shift-end",
  DAILY_SALES: "daily-sales",
  PAYMENT_MIX: "payment-mix",
  TOP_ITEMS: "top-items",
  SALES_BY_CATEGORY: "sales-by-category",
  SALES_BY_HOUR: "sales-by-hour",
  OPEN_CLOSED_ORDERS: "open-closed-orders",
  DISCOUNTS_SUMMARY: "discounts-summary",
  VOIDS_SUMMARY: "voids-summary",
  REFUNDS_SUMMARY: "refunds-summary",
  CASH_VARIANCE: "cash-variance",
  CASH_MOVEMENTS: "cash-movements",
  STOCK_VARIANCE: "stock-variance",
  WASTAGE_SUMMARY: "wastage-summary",
  LOW_STOCK: "low-stock",
  RESERVATION_SUMMARY: "reservation-summary",
  RESERVATION_DEPOSITS: "reservation-deposits",
  RESERVATION_NO_SHOWS: "reservation-no-shows",
  EVENT_SUMMARY: "event-summary",
  EVENT_BOOKINGS: "event-bookings",
  EVENT_CHECKINS: "event-checkins",
  ANOMALY_SUMMARY: "anomaly-summary",
  HIGH_RISK_ACTORS: "high-risk-actors",
  STAFF_OPERATIONS: "staff-operations",
};

/**
 * `top-items` is the ONLY generator whose DTO differs from the uniform one
 * (MP0-16): it adds `limit?: number` with `@IsInt @Min(1)`.
 */
const MANAGER_REPORT_LIMIT_KEYS = new Set(["TOP_ITEMS"]);

/**
 * Categories are a **UI grouping**, exactly like Supervisor Reservations'
 * Arriving/Seated/Attention views — they are never a persisted field and the
 * catalog does not return one. They mirror the backend's own source sections
 * (`reports.service.ts` A–H, in catalog order), so the grouping is the API
 * author's, not one this phase invented.
 */
export const MANAGER_REPORT_CATEGORIES = [
  "Sales & revenue",
  "Discounts, voids & refunds",
  "Cash & till control",
  "Inventory",
  "Reservations",
  "Events",
  "Risk & anomalies",
  "Staff",
  "Not yet available",
] as const;

export type ManagerReportCategory = (typeof MANAGER_REPORT_CATEGORIES)[number];

const MANAGER_REPORT_CATEGORY_BY_KEY: Readonly<Record<string, ManagerReportCategory>> = {
  // A) Core Sales / Revenue
  SHIFT_END: "Sales & revenue",
  DAILY_SALES: "Sales & revenue",
  PAYMENT_MIX: "Sales & revenue",
  TOP_ITEMS: "Sales & revenue",
  SALES_BY_CATEGORY: "Sales & revenue",
  SALES_BY_HOUR: "Sales & revenue",
  OPEN_CLOSED_ORDERS: "Sales & revenue",
  MENU_ENGINEERING: "Sales & revenue",
  // B) Discount / Void / Refund
  DISCOUNTS_SUMMARY: "Discounts, voids & refunds",
  VOIDS_SUMMARY: "Discounts, voids & refunds",
  REFUNDS_SUMMARY: "Discounts, voids & refunds",
  // C) Cash / Till / Shift Control
  CASH_VARIANCE: "Cash & till control",
  CASH_MOVEMENTS: "Cash & till control",
  // D) Inventory / Stock Control
  STOCK_VARIANCE: "Inventory",
  WASTAGE_SUMMARY: "Inventory",
  LOW_STOCK: "Inventory",
  // E) Reservation / Deposit
  RESERVATION_SUMMARY: "Reservations",
  RESERVATION_DEPOSITS: "Reservations",
  RESERVATION_NO_SHOWS: "Reservations",
  // F) Event / Ticketing
  EVENT_SUMMARY: "Events",
  EVENT_BOOKINGS: "Events",
  EVENT_CHECKINS: "Events",
  // G) Risk / Anomaly
  ANOMALY_SUMMARY: "Risk & anomalies",
  HIGH_RISK_ACTORS: "Risk & anomalies",
  // H) Staff Operations
  STAFF_OPERATIONS: "Staff",
};

function readStatus(value: string | null | undefined): ManagerReportCatalogStatus {
  const raw = (value || "").toUpperCase();
  if (raw === "IMPLEMENTED" || raw === "CONDITIONAL" || raw === "PENDING_LATER") return raw;
  // An unrecognised status fails CLOSED — an unknown state is treated as not
  // generatable rather than optimistically offered.
  return "PENDING_LATER";
}

export function managerReportAvailability(
  status: ManagerReportCatalogStatus,
  hasGenerator: boolean,
): ManagerReportAvailability {
  if (!hasGenerator) return "unavailable";
  if (status === "IMPLEMENTED") return "available";
  if (status === "CONDITIONAL") return "conditional";
  return "unavailable";
}

function text(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

export function projectManagerReportCatalogEntry(
  entry: ManagerReportCatalogEntryApi,
): ManagerReportCatalogEntry {
  const status = readStatus(entry.status);
  const generatorPath = MANAGER_REPORT_GENERATOR_PATHS[entry.key] ?? null;

  // Every format the catalog advertises is CSV since C-01 (2026-08-20). The UI
  // still renders what the endpoint actually says rather than a hard-coded
  // "CSV" badge, so if a format is ever added the badge tells the truth — but
  // PDF is filtered out here regardless, because the backend 501s on it and a
  // PDF badge would advertise an export that cannot be produced.
  const formats = (Array.isArray(entry.formats) ? entry.formats : [])
    .map((format) => String(format).toUpperCase())
    .filter((format) => format !== "PDF");

  return {
    key: entry.key,
    title: text(entry.title) || entry.key,
    description: text(entry.description) || "",
    status,
    availability: managerReportAvailability(status, Boolean(generatorPath)),
    category:
      status === "PENDING_LATER"
        ? "Not yet available"
        : MANAGER_REPORT_CATEGORY_BY_KEY[entry.key] ?? "Not yet available",
    formats,
    permission: text(entry.permission) || "",
    notes: text(entry.notes),
    dependencyMilestone: text(entry.dependencyMilestone),
    generatorPath,
    supportsLimit: MANAGER_REPORT_LIMIT_KEYS.has(entry.key),
  };
}

export function projectManagerReportCatalog(
  entries: readonly ManagerReportCatalogEntryApi[],
): ManagerReportCatalogEntry[] {
  return entries.map(projectManagerReportCatalogEntry);
}

/**
 * The one-line reason an entry cannot be generated, in the API's own words
 * wherever it supplies them. Never a generic "coming soon".
 */
export function managerReportUnavailableReason(entry: ManagerReportCatalogEntry) {
  if (entry.availability === "available") return null;
  if (entry.dependencyMilestone) {
    return `Not yet available — this report needs ${entry.dependencyMilestone}.`;
  }
  if (!entry.generatorPath) {
    return "Not yet available — this backend exposes no generator for this report.";
  }
  return "Not yet available.";
}

/** Client-side text match over the fields the catalog actually returns. */
export function filterManagerReportCatalog(
  entries: readonly ManagerReportCatalogEntry[],
  { search, category }: { search: string; category: string | null },
) {
  const needle = search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (!needle) return true;
    return (
      entry.title.toLowerCase().includes(needle) ||
      entry.description.toLowerCase().includes(needle) ||
      entry.key.toLowerCase().includes(needle)
    );
  });
}

export function countManagerReportAvailability(entries: readonly ManagerReportCatalogEntry[]) {
  let available = 0;
  let conditional = 0;
  let unavailable = 0;
  for (const entry of entries) {
    if (entry.availability === "available") available += 1;
    else if (entry.availability === "conditional") conditional += 1;
    else unavailable += 1;
  }
  return { available, conditional, unavailable, total: entries.length };
}
