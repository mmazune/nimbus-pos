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

/**
 * `GET /api/dash/manager` — `pos:dash:manager:read`, branch-scoped.
 *
 * ⚠️ SALES VOCABULARY — re-verified against `dashboards.service.ts` after backend
 * gap batch 1 (2026-08-20, MP0-10). `Order.total = subtotal + tax − discount`, so:
 *
 *     grossSales    = SUM(order.total)              TAX-INCLUSIVE
 *     netSales      = grossSales − taxTotal         EX-tax
 *     subtotalSales = SUM(order.subtotal)           ex-tax, BEFORE discount
 *
 * and the invariant is `grossSales >= netSales`. This is the OPPOSITE of the
 * pre-batch meaning B2 was written against, where `grossSales` was `SUM(subtotal)`
 * and `netSales` was `SUM(total)`. B3 re-pointed the two sales KPI bindings
 * accordingly — see `MANAGER_KPI_BINDINGS` in `dashboard-model.ts`.
 */
export type ManagerDashboardResponse = {
  today: {
    /** TAX-INCLUSIVE (`SUM(order.total)`). Never label this a bare "gross". */
    grossSales: ManagerDecimal;
    /** EX-tax (`grossSales − taxTotal`). Never label this a bare "net". */
    netSales: ManagerDecimal;
    /** Added by backend gap batch 1 — optional so a pre-batch API degrades honestly. */
    taxTotal?: ManagerDecimal;
    /** Ex-tax, pre-discount. The figure this endpoint published as `grossSales` before the batch. */
    subtotalSales?: ManagerDecimal;
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
  /** TAX-INCLUSIVE — same vocabulary as `ManagerDashboardResponse.today`. */
  grossSales: ManagerDecimal;
  /** EX-tax. */
  netSales: ManagerDecimal;
  /** Ex-tax, pre-discount (added by backend gap batch 1). */
  subtotalSales?: ManagerDecimal;
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
 * ✅ MP0-09 FIXED 2026-08-20 (backend gap batch 1) — the response now carries
 * `total` (the real open-order count, from the same shared `where` the dashboards
 * count with), `limit` (the page bound, 50) and `truncated`.
 *
 * ⚠️ `count` deliberately KEPT its old meaning — rows in THIS response, i.e. the
 * page length — so B2 kept working across the change. Never show `count` to a
 * user: `total` is the honest number, and this dashboard's headline still comes
 * from `/dash/manager.openOrders` (the card contract CLAUDE.md §12 locks).
 *
 * Rows are ordered `createdAt asc`, so the page holds the OLDEST orders — which is
 * what makes the aging read honest.
 *
 * `total`/`limit`/`truncated` are optional here because a pre-batch API would not
 * send them; the model falls back to the old count comparison rather than assuming.
 */
export type ManagerOpenOrdersResponse = {
  /** Page length of THIS response (≤ `limit`) — never a branch total. */
  count: number;
  /** MP0-09: the real branch-wide open-order count. */
  total?: number;
  /** MP0-09: the server-side page bound applied to `orders` (50). */
  limit?: number;
  /** MP0-09: true when the branch has more open orders than this page returned. */
  truncated?: boolean;
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
