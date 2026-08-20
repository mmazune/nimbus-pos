/**
 * Manager Overview dashboard — response types (Track B2).
 *
 * Every type below mirrors a response shape that was **live-verified** by M-P0
 * (`ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md`) and re-read from the controller +
 * service source before this phase was written
 * (`apps/api/src/modules/dashboards/dashboards.service.ts`).
 *
 * ⚠️ MONEY ARRIVES AS A STRING. Every money field on these endpoints is a Prisma
 * `Decimal`, which serialises to a JSON **string** (`"2980000"`), never a number.
 * Nothing may do arithmetic on these fields directly — parse through
 * `toManagerAmount()` in `dashboard-model.ts`, which fails closed to `null`
 * rather than to `0` (a fabricated zero is a wrong number, and a wrong number
 * is worse than an honest "unavailable").
 */

/** A Prisma Decimal over the wire. */
export type ManagerDecimal = string | number | null | undefined;

/** `GET /api/dash/manager` — `pos:dash:manager:read`, branch-scoped. */
export type ManagerDashboardResponse = {
  today: {
    grossSales: ManagerDecimal;
    netSales: ManagerDecimal;
    orderCount: number;
    avgOrderValue: ManagerDecimal;
  };
  openOrders: number;
  lowStockCount: number;
  anomalySummary: { openCount: number; highCount: number };
  /**
   * Branch-scoped OPEN counts (`shift.count`/`tillSession.count` filtered by
   * `orgId + branchId + status: 'OPEN'`). Counts are the ONLY till/shift data
   * that exists — `GET /api/tills` and `GET /api/shifts` are 404 and the
   * `/active` variants are operator-scoped (MP0-02).
   */
  shiftSummary: { activeShifts: number; activeTills: number };
  reservationsTodayCount: number;
  calculatedAt: string;
};

/** `GET /api/dash/today-summary` — `pos:dash:today-summary:read`, branch-scoped. */
export type ManagerTodaySummaryResponse = {
  date: string;
  grossSales: ManagerDecimal;
  netSales: ManagerDecimal;
  taxTotal: ManagerDecimal;
  discountTotal: ManagerDecimal;
  refundsTotal: ManagerDecimal;
  paymentMix: { cash: ManagerDecimal; card: ManagerDecimal; momo: ManagerDecimal };
  openOrders: number;
  closedOrders: number;
  avgOrderValue: ManagerDecimal;
  lowStockCount: number;
  anomalyOpenCount: number;
  anomalyHighCount: number;
  calculatedAt: string;
};

/** `GET /api/dash/payment-mix` — `pos:dash:today-summary:read`, branch-scoped. */
export type ManagerPaymentMixResponse = {
  cash: ManagerDecimal;
  card: ManagerDecimal;
  momo: ManagerDecimal;
  total: ManagerDecimal;
  date: string;
  calculatedAt: string;
};

export type ManagerOpenOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  serviceType: string;
  total: ManagerDecimal;
  createdAt: string;
};

/**
 * `GET /api/dash/open-orders` — `pos:dash:today-summary:read`, branch-scoped.
 *
 * ⚠️ MP0-09: the service hard-caps `take: 50` and returns `count = page length`,
 * so `count` is the PREVIEW length, not the branch total. The authoritative open
 * count is `ManagerDashboardResponse.openOrders`. Rows are ordered `createdAt asc`,
 * so the preview holds the OLDEST 50 — which is what makes an aging read honest.
 */
export type ManagerOpenOrdersResponse = {
  count: number;
  orders: ManagerOpenOrderRow[];
};

export type ManagerLowStockRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  currentStock: ManagerDecimal;
  reorderLevel: ManagerDecimal;
  reorderQty: ManagerDecimal;
};

/**
 * `GET /api/dash/low-stock` — `pos:dash:today-summary:read`, branch-scoped.
 * Unlike open-orders this is NOT capped: the service scans every active item with
 * a reorder level, so `count` is the real branch total.
 */
export type ManagerLowStockResponse = {
  count: number;
  items: ManagerLowStockRow[];
};

/** `POST /api/dash/kpi/refresh` — `pos:dash:kpi:refresh`. Returns a KpiSnapshot row. */
export type ManagerKpiRefreshResponse = {
  id: string;
  branchId: string | null;
  calculatedAt: string;
};

/**
 * The four approval domains surfaced as COUNTS on Overview.
 *
 * Overview decides nothing (roadmap B2 "Out of scope") — these are counts with a
 * drill-in into the surface that owns the decision.
 */
export type ManagerApprovalDomainKey = "discount" | "leave" | "shift-swap" | "anomaly";

/**
 * A count-only projection. The list endpoints behind leave / shift-swap embed full
 * `employee` objects carrying PII (address, dateOfBirth, private notes) — so the
 * request functions bound the page to a single row AND discard `data` at the
 * API-client boundary, exactly as MP0-01 requires. Only the server's own `total`
 * survives into React state or the query cache.
 */
export type ManagerApprovalCount = {
  domain: ManagerApprovalDomainKey;
  count: number;
};
