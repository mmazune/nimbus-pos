// RELATIVE imports on purpose: this module is executed directly by
// `scripts/manager-b2-assertions.ts` under `tsx`, which does not resolve the
// Next.js `@/` path alias at runtime. Same precedent as `lib/manager/routes.ts`
// and `branch-model.ts`, which are exercised by the M-P1/B1 assertion scripts.
import { formatWaiterMoney } from "../waiter/formatters";

import type {
  ManagerApprovalDomainKey,
  ManagerDecimal,
  ManagerLowStockResponse,
  ManagerLowStockRow,
  ManagerOpenOrderRow,
  ManagerOpenOrdersResponse,
  ManagerPaymentMixResponse,
} from "./dashboard-types";

/**
 * Manager Overview dashboard — pure model (Track B2).
 *
 * No React, no aliased component imports, no network: everything here is a plain
 * function so `scripts/manager-b2-assertions.ts` can execute it directly, the same
 * split M-P1 used for `branch-model.ts`.
 */

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * Parse a wire Decimal into a number, or `null` when it is absent/unparseable.
 *
 * FAIL-CLOSED: never coerce a missing value to `0`. A dashboard that renders
 * "UGX 0" for "we could not read this" is fabricating a number.
 */
export function toManagerAmount(value: ManagerDecimal): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * UGX renders with zero fraction digits. This deliberately reuses the SHARED
 * currency formatter (`lib/waiter/formatters.ts`) named in the locked decision
 * rather than forking a fourth per-role money formatter — it already owns the
 * zero-fraction currency set and the `currencyDisplay: "code"` convention.
 */
export function formatManagerMoney(
  value: ManagerDecimal,
  currencyCode?: string | null,
  fallback = "Unavailable",
) {
  return formatWaiterMoney(toManagerAmount(value), currencyCode, fallback);
}

/** Whole-number counts. Fails closed to `null`, never to `0`. */
export function toManagerCount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

export function formatManagerCount(value: number | null | undefined, fallback = "Unavailable") {
  const count = toManagerCount(value);
  return count === null ? fallback : new Intl.NumberFormat("en-US").format(count);
}

/** `37%` — share of a total. `null` when the total is missing or zero. */
export function toSharePercent(part: number | null, total: number | null) {
  if (part === null || total === null || total <= 0) return null;
  return (part / total) * 100;
}

export function formatSharePercent(value: number | null, fallback = "—") {
  if (value === null) return fallback;
  return `${value >= 10 || value === 0 ? Math.round(value) : Math.round(value * 10) / 10}%`;
}

export function formatManagerClockTime(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatManagerElapsed(minutes: number | null, fallback = "—") {
  if (minutes === null || !Number.isFinite(minutes)) return fallback;
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${Math.floor(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.floor(minutes % 60);
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

// ── Payment mix ─────────────────────────────────────────────────────────────

export type ManagerPaymentMethodKey = "cash" | "card" | "momo";

export type ManagerPaymentSlice = {
  key: ManagerPaymentMethodKey;
  label: string;
  amount: number | null;
  share: number | null;
};

/**
 * The three methods the endpoint actually aggregates. `MOMO` is the single
 * backend enum value covering MTN and Airtel — the backend does not split them,
 * so the UI must not imply it does.
 */
const PAYMENT_METHOD_LABELS: Record<ManagerPaymentMethodKey, string> = {
  cash: "Cash",
  card: "Card",
  momo: "Mobile money",
};

export function toPaymentMixSlices(
  response: ManagerPaymentMixResponse | undefined,
): { slices: ManagerPaymentSlice[]; total: number | null } {
  if (!response) return { slices: [], total: null };

  const total = toManagerAmount(response.total);
  const slices = (["cash", "card", "momo"] as const).map<ManagerPaymentSlice>((key) => {
    const amount = toManagerAmount(response[key]);
    return {
      key,
      label: PAYMENT_METHOD_LABELS[key],
      amount,
      share: toSharePercent(amount, total),
    };
  });

  return { slices, total };
}

// ── Open orders: aging + status split (derived from the CAPPED preview) ──────

export type ManagerAgingBucketKey = "under15" | "under30" | "under60" | "over60";

export type ManagerAgingBucket = {
  key: ManagerAgingBucketKey;
  label: string;
  /** Screen-reader / tooltip description — never colour alone. */
  description: string;
  count: number;
  tone: "neutral" | "info" | "warning" | "danger";
};

const AGING_BUCKETS: ReadonlyArray<{
  key: ManagerAgingBucketKey;
  label: string;
  description: string;
  tone: ManagerAgingBucket["tone"];
  maxMinutes: number;
}> = [
  { key: "under15", label: "0–15m", description: "Open under 15 minutes", tone: "neutral", maxMinutes: 15 },
  { key: "under30", label: "15–30m", description: "Open 15 to 30 minutes", tone: "info", maxMinutes: 30 },
  { key: "under60", label: "30–60m", description: "Open 30 to 60 minutes", tone: "warning", maxMinutes: 60 },
  {
    key: "over60",
    label: "60m+",
    description: "Open more than an hour",
    tone: "danger",
    maxMinutes: Number.POSITIVE_INFINITY,
  },
];

export function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, (now - created) / 60_000);
}

export function toAgingBuckets(rows: readonly ManagerOpenOrderRow[], now: number): ManagerAgingBucket[] {
  const counts = new Map<ManagerAgingBucketKey, number>(AGING_BUCKETS.map((bucket) => [bucket.key, 0]));

  for (const row of rows) {
    const minutes = minutesSince(row.createdAt, now);
    // A row with no readable timestamp is skipped, not bucketed into "fresh".
    if (minutes === null) continue;
    const bucket = AGING_BUCKETS.find((candidate) => minutes < candidate.maxMinutes) || AGING_BUCKETS[AGING_BUCKETS.length - 1];
    counts.set(bucket.key, (counts.get(bucket.key) || 0) + 1);
  }

  return AGING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    description: bucket.description,
    tone: bucket.tone,
    count: counts.get(bucket.key) || 0,
  }));
}

export type ManagerOrderStatusSlice = { status: string; label: string; count: number };

export function titleCaseStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function toOrderStatusSplit(rows: readonly ManagerOpenOrderRow[]): ManagerOrderStatusSlice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.status) continue;
    counts.set(row.status, (counts.get(row.status) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, label: titleCaseStatus(status), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * `/dash/open-orders` returns a bounded page and reports `count = page length`.
 * Anything derived from those rows — aging, status split, oldest order — describes
 * the page, not the branch, whenever the branch total exceeds it. The UI must say
 * so; this helper is what it asks.
 *
 * ✅ FU-3 (backend gap batch 1, 2026-08-20): the endpoint now answers the question
 * itself with `truncated`, alongside the honest `total` and the server's own
 * `limit`. That reply is preferred whenever it is present. The length comparison
 * below survives only as the fallback for an API that predates the fix — it is not
 * a second source of truth.
 */
export const OPEN_ORDERS_PREVIEW_CAP = 50;

export function isOpenOrdersPreviewCapped(
  preview: ManagerOpenOrdersResponse | undefined,
  authoritativeOpenOrders: number | null,
) {
  if (!preview) return false;
  if (typeof preview.truncated === "boolean") return preview.truncated;
  const previewLength = preview.orders?.length ?? 0;
  if (previewLength >= (preview.limit ?? OPEN_ORDERS_PREVIEW_CAP)) return true;
  return authoritativeOpenOrders !== null && authoritativeOpenOrders > previewLength;
}

/**
 * The branch-wide open-order count as reported by `/dash/open-orders` itself
 * (MP0-09 `total`). Returns `null` on a pre-batch API rather than falling back to
 * `count`, which is the page length — a wrong number is worse than an honest gap.
 *
 * This is a CROSS-CHECK, not the headline: the Overview card still binds its KPI to
 * `/dash/manager.openOrders` (CLAUDE.md §12).
 */
export function openOrdersReportedTotal(preview: ManagerOpenOrdersResponse | undefined) {
  const total = preview?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export function oldestOpenOrder(rows: readonly ManagerOpenOrderRow[]): ManagerOpenOrderRow | null {
  // The endpoint already orders `createdAt asc`; re-derive rather than trust order.
  let oldest: ManagerOpenOrderRow | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const time = new Date(row.createdAt).getTime();
    if (Number.isNaN(time) || time >= oldestTime) continue;
    oldestTime = time;
    oldest = row;
  }
  return oldest;
}

// ── Low stock ───────────────────────────────────────────────────────────────

export type ManagerLowStockEntry = {
  row: ManagerLowStockRow;
  currentStock: number | null;
  reorderLevel: number | null;
  /** How far below the reorder level the item sits. `null` when either side is unreadable. */
  shortfall: number | null;
  /** 0–1 fill of the reorder level, clamped. `null` when unreadable. */
  coverage: number | null;
};

export function toLowStockEntries(
  response: ManagerLowStockResponse | undefined,
  limit = 4,
): ManagerLowStockEntry[] {
  if (!response?.items?.length) return [];

  return response.items
    .map<ManagerLowStockEntry>((row) => {
      const currentStock = toManagerAmount(row.currentStock);
      const reorderLevel = toManagerAmount(row.reorderLevel);
      const shortfall =
        currentStock === null || reorderLevel === null ? null : Math.max(0, reorderLevel - currentStock);
      const coverage =
        currentStock === null || reorderLevel === null || reorderLevel <= 0
          ? null
          : Math.max(0, Math.min(1, currentStock / reorderLevel));
      return { row, currentStock, reorderLevel, shortfall, coverage };
    })
    .sort((a, b) => {
      // Deepest shortfall first; unreadable rows sink rather than jump the queue.
      if (a.shortfall === null) return b.shortfall === null ? 0 : 1;
      if (b.shortfall === null) return -1;
      return b.shortfall - a.shortfall;
    })
    .slice(0, limit);
}

export function formatStockQuantity(value: number | null, unit: string | null | undefined) {
  if (value === null) return "Unavailable";
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${amount} ${unit}` : amount;
}

// ── Approvals ───────────────────────────────────────────────────────────────

export type ManagerApprovalDomainMeta = {
  key: ManagerApprovalDomainKey;
  label: string;
  /** What the count literally is — the UI never says "pending" where it means "open". */
  countLabel: string;
  endpoint: string;
  drillIn: string;
};

/**
 * The four domains, each read through its CANONICAL domain endpoint — never the
 * generic `GET /api/approvals`, which is only partly branch-scoped (MP0-05: live
 * `total: 16` spanning five branches including one the Manager is not a member of,
 * plus five org-scoped FINANCE rows). Every endpoint below filters on
 * `orgId + branchId` in its own service, so the count is branch-true at the source
 * and needs no client-side re-filtering.
 */
export const MANAGER_APPROVAL_DOMAINS: readonly ManagerApprovalDomainMeta[] = [
  {
    key: "discount",
    label: "Discount approvals",
    countLabel: "awaiting a decision",
    endpoint: "GET /api/pos/discounts/pending",
    drillIn: "/manager/operations",
  },
  {
    key: "leave",
    label: "Leave requests",
    countLabel: "pending review",
    endpoint: "GET /api/hr/leave?status=PENDING",
    drillIn: "/manager/staff",
  },
  {
    key: "shift-swap",
    label: "Shift swaps",
    countLabel: "pending review",
    endpoint: "GET /api/hr/shift-swaps?status=PENDING",
    drillIn: "/manager/staff",
  },
  {
    key: "anomaly",
    label: "Anomalies",
    countLabel: "open, not yet acknowledged",
    endpoint: "GET /api/analytics/anomalies?status=OPEN",
    drillIn: "/manager/operations",
  },
];

// ── KPI → verified field → drill-in registry ────────────────────────────────

/**
 * The roadmap's B2 acceptance gate: *"every rendered KPI maps to a verified
 * response field; every count has a drill-in target."*
 *
 * This registry is the machine-checkable form of that gate — `manager-b2-assertions.ts`
 * walks it, and the completion report's KPI table is generated from it. A KPI that
 * is not in here must not be rendered.
 *
 * `drillIn: null` is permitted ONLY with a `noDrillInReason`, and there is exactly
 * one legitimate case: till/shift coverage, whose owning surface does not exist on
 * this backend at all (MP0-02).
 */
export type ManagerKpiBinding = {
  key: string;
  /** The label as rendered. Checked for the banned bare `Gross`/`Net` wording (MP0-10). */
  label: string;
  endpoint: string;
  field: string;
  drillIn: string | null;
  noDrillInReason?: string;
  note?: string;
};

export const MANAGER_KPI_BINDINGS: readonly ManagerKpiBinding[] = [
  {
    key: "sales.taxInclusive",
    label: "Sales today (tax-inclusive)",
    endpoint: "GET /api/dash/manager",
    field: "today.grossSales",
    drillIn: "/manager/reports",
    note: "MP0-10 was FIXED by backend gap batch 1 (2026-08-20) and the meaning of both fields INVERTED: grossSales is now SUM(order.total) — tax-inclusive — and netSales is grossSales − taxTotal. B2 shipped before that batch and bound this label to today.netSales, which after the batch renders the EX-tax figure under a tax-inclusive label. B3 re-pointed it to today.grossSales (defect B3-D1).",
  },
  {
    key: "sales.exTax",
    label: "Sales excluding tax",
    endpoint: "GET /api/dash/manager",
    field: "today.netSales",
    drillIn: "/manager/reports",
    note: "netSales = grossSales − taxTotal and is EX-tax — smaller than the tax-inclusive figure. Re-pointed from today.grossSales in B3 alongside sales.taxInclusive (defect B3-D1).",
  },
  {
    key: "sales.tax",
    label: "Tax collected",
    endpoint: "GET /api/dash/today-summary",
    field: "taxTotal",
    drillIn: "/manager/reports",
  },
  {
    key: "sales.discounts",
    label: "Discounts given",
    endpoint: "GET /api/dash/today-summary",
    field: "discountTotal",
    drillIn: "/manager/reports",
  },
  {
    key: "sales.refunds",
    label: "Refunds",
    endpoint: "GET /api/dash/today-summary",
    field: "refundsTotal",
    drillIn: "/manager/reports",
  },
  {
    key: "orders.count",
    label: "Orders served or closed today",
    endpoint: "GET /api/dash/manager",
    field: "today.orderCount",
    drillIn: "/manager/operations",
  },
  {
    key: "orders.avgValue",
    label: "Average order value (tax-inclusive)",
    endpoint: "GET /api/dash/manager",
    field: "today.avgOrderValue",
    drillIn: "/manager/reports",
  },
  {
    key: "orders.closed",
    label: "Closed today",
    endpoint: "GET /api/dash/today-summary",
    field: "closedOrders",
    drillIn: "/manager/operations",
  },
  {
    key: "payments.cash",
    label: "Cash",
    endpoint: "GET /api/dash/payment-mix",
    field: "cash",
    drillIn: "/manager/reports",
  },
  {
    key: "payments.card",
    label: "Card",
    endpoint: "GET /api/dash/payment-mix",
    field: "card",
    drillIn: "/manager/reports",
  },
  {
    key: "payments.momo",
    label: "Mobile money",
    endpoint: "GET /api/dash/payment-mix",
    field: "momo",
    drillIn: "/manager/reports",
    note: "MOMO is one backend enum covering MTN and Airtel; the split does not exist server-side.",
  },
  {
    key: "payments.total",
    label: "Payments collected today",
    endpoint: "GET /api/dash/payment-mix",
    field: "total",
    drillIn: "/manager/reports",
  },
  {
    key: "openOrders.count",
    label: "Open orders right now",
    endpoint: "GET /api/dash/manager",
    field: "openOrders",
    drillIn: "/manager/operations",
    note: "Authoritative count, and the locked binding (CLAUDE.md §12). /dash/open-orders.count is the PAGE LENGTH and must never be shown; since backend gap batch 1 that endpoint also publishes an honest `total` — used only as a cross-check and to word the page footnote (MP0-09).",
  },
  {
    key: "openOrders.aging",
    label: "Open-order aging",
    endpoint: "GET /api/dash/open-orders",
    field: "orders[].createdAt",
    drillIn: "/manager/operations",
    note: "Derived from the oldest open orders the endpoint's bounded page returns — labelled as a preview whenever the endpoint's own `truncated` flag says the branch has more (MP0-09).",
  },
  {
    key: "openOrders.oldest",
    label: "Oldest open order",
    endpoint: "GET /api/dash/open-orders",
    field: "orders[].createdAt",
    drillIn: "/manager/operations",
  },
  {
    key: "lowStock.count",
    label: "Items at or below reorder level",
    endpoint: "GET /api/dash/low-stock",
    field: "count",
    drillIn: "/manager/reports",
    note: "Not capped — the service scans every active item with a reorder level.",
  },
  {
    key: "lowStock.items",
    label: "Deepest shortfalls",
    endpoint: "GET /api/dash/low-stock",
    field: "items[].currentStock / items[].reorderLevel",
    drillIn: "/manager/reports",
  },
  {
    key: "approvals.needsDecision",
    label: "Items awaiting a decision",
    endpoint:
      "GET /api/pos/discounts/pending + /api/hr/leave + /api/hr/shift-swaps + /api/analytics/anomalies",
    field: "sum of the four branch-scoped counts",
    drillIn: "/manager/operations",
    note: "A client-side sum of four separately verified counts; every part is also shown on its own row, and an unreadable queue is excluded from the sum rather than counted as zero.",
  },
  {
    key: "approvals.discount",
    label: "Discount approvals",
    endpoint: "GET /api/pos/discounts/pending",
    field: "length",
    drillIn: "/manager/operations",
  },
  {
    key: "approvals.leave",
    label: "Leave requests",
    endpoint: "GET /api/hr/leave?status=PENDING&take=1",
    field: "total",
    drillIn: "/manager/staff",
  },
  {
    key: "approvals.shiftSwap",
    label: "Shift swaps",
    endpoint: "GET /api/hr/shift-swaps?status=PENDING&take=1",
    field: "total",
    drillIn: "/manager/staff",
  },
  {
    key: "approvals.anomaly",
    label: "Anomalies",
    endpoint: "GET /api/analytics/anomalies?status=OPEN&limit=1",
    field: "total",
    drillIn: "/manager/operations",
  },
  {
    key: "anomalies.high",
    label: "High or critical severity",
    endpoint: "GET /api/dash/manager",
    field: "anomalySummary.highCount",
    drillIn: "/manager/operations",
  },
  {
    key: "coverage.shifts",
    label: "Shifts open now",
    endpoint: "GET /api/dash/manager",
    field: "shiftSummary.activeShifts",
    drillIn: null,
    noDrillInReason:
      "There is no branch-wide shifts surface to drill into: GET /api/shifts is 404 and /shifts/active is operator-scoped (MP0-02).",
  },
  {
    key: "coverage.tills",
    label: "Tills open now",
    endpoint: "GET /api/dash/manager",
    field: "shiftSummary.activeTills",
    drillIn: null,
    noDrillInReason:
      "There is no branch-wide tills surface to drill into: GET /api/tills is 404 and /tills/active is operator-scoped (MP0-02).",
  },
  {
    key: "coverage.reservations",
    label: "Reservations booked today",
    endpoint: "GET /api/dash/manager",
    field: "reservationsTodayCount",
    drillIn: "/manager/operations",
  },
];

export function getManagerKpiBinding(key: string) {
  const binding = MANAGER_KPI_BINDINGS.find((entry) => entry.key === key);
  if (!binding) {
    throw new Error(
      `Manager KPI "${key}" is not registered in MANAGER_KPI_BINDINGS — every rendered KPI must declare its verified endpoint field and drill-in target.`,
    );
  }
  return binding;
}
