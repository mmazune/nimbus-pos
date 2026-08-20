import { apiRequest } from "@/lib/api/client";
import type {
  ManagerApprovalCount,
  ManagerDashboardResponse,
  ManagerKpiRefreshResponse,
  ManagerLowStockResponse,
  ManagerOpenOrdersResponse,
  ManagerPaymentMixResponse,
  ManagerTodaySummaryResponse,
} from "@/lib/manager/dashboard-types";

/**
 * Manager Overview dashboard — request layer (Track B2).
 *
 * Every request is branch-scoped through `apiRequest({ branchId })`, which sets
 * `X-Branch-Id` (`lib/api/client.ts`). No API-client change was needed for B2,
 * exactly as none was needed for M-P1's branch switcher.
 *
 * ⚠️ NO SSE. `/api/stream/metrics` requires `Authorization` + `X-Branch-Id`;
 * `EventSource` can send neither, and `apps/web` has no SSE reader at all
 * (MP0-07 / NG-14). Track C-04 owns that. B2 is POLLED and says so in the UI —
 * this module deliberately contains no `EventSource`, no `ReadableStream` reader,
 * and no `text/event-stream` request.
 */

// ── Verified /dash/* reads ──────────────────────────────────────────────────

export function getManagerDashboardRequest(token: string, branchId: string) {
  return apiRequest<ManagerDashboardResponse>("/api/dash/manager", { token, branchId });
}

export function getManagerTodaySummaryRequest(token: string, branchId: string) {
  return apiRequest<ManagerTodaySummaryResponse>("/api/dash/today-summary", { token, branchId });
}

export function getManagerPaymentMixRequest(token: string, branchId: string) {
  return apiRequest<ManagerPaymentMixResponse>("/api/dash/payment-mix", { token, branchId });
}

export function getManagerOpenOrdersRequest(token: string, branchId: string) {
  return apiRequest<ManagerOpenOrdersResponse>("/api/dash/open-orders", { token, branchId });
}

export function getManagerLowStockRequest(token: string, branchId: string) {
  return apiRequest<ManagerLowStockResponse>("/api/dash/low-stock", { token, branchId });
}

/**
 * `POST /api/dash/kpi/refresh` — recalculates and PERSISTS a `KpiSnapshot` row and
 * writes an audit event. It is a real write, so the UI puts it behind an explicit
 * confirmation and an in-flight lock (roadmap B2(e)). The empty body accepts the
 * controller's defaults (`scopeType: BRANCH`, `metricWindow: TODAY`).
 */
export function refreshManagerKpiRequest(token: string, branchId: string) {
  return apiRequest<ManagerKpiRefreshResponse>("/api/dash/kpi/refresh", {
    method: "POST",
    body: {},
    token,
    branchId,
  });
}

// ── Approval counts — COUNT-ONLY projections at the client boundary ──────────

/**
 * MP0-01 / NG-02: the leave and shift-swap list endpoints embed a full nested
 * `employee` object carrying `address`, `dateOfBirth`, private HR `notes` and
 * contact PII. The locked constraint is that such data is *never fetched*, and the
 * leak is at the **wire**, so a render-time whitelist is not sufficient.
 *
 * Two mitigations, applied together:
 *
 * 1. **Bound the page to one row** (`take=1` / `limit=1` — the server minimum), so
 *    at most a single record can cross the wire instead of a default page of 50.
 * 2. **Discard `data` here, at the API-client boundary.** These functions resolve
 *    to `{ domain, count }` and nothing else, so no employee field ever reaches
 *    React state, the React Query cache, or a devtools dump.
 *
 * The number itself is the server's own `total` for the filtered `where`, so
 * bounding the page does not bound the count.
 */
type CountEnvelope = { total?: number; data?: unknown };

function readTotal(payload: CountEnvelope | null | undefined) {
  const total = payload?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
}

/**
 * Discounts have no branch-wide list beyond `/pending` (SUP-RG-035), and `/pending`
 * returns a bare array with no `total`. Its rows carry no HR PII — only the
 * creating user's name and the parent order's number/totals — so the length is
 * read directly and the rows are still dropped here.
 */
export async function getManagerPendingDiscountCountRequest(
  token: string,
  branchId: string,
): Promise<ManagerApprovalCount> {
  const rows = await apiRequest<unknown[]>("/api/pos/discounts/pending", { token, branchId });
  return { domain: "discount", count: Array.isArray(rows) ? rows.length : 0 };
}

export async function getManagerPendingLeaveCountRequest(
  token: string,
  branchId: string,
): Promise<ManagerApprovalCount> {
  const payload = await apiRequest<CountEnvelope>("/api/hr/leave?status=PENDING&take=1", {
    token,
    branchId,
  });
  return { domain: "leave", count: readTotal(payload) };
}

export async function getManagerPendingShiftSwapCountRequest(
  token: string,
  branchId: string,
): Promise<ManagerApprovalCount> {
  const payload = await apiRequest<CountEnvelope>("/api/hr/shift-swaps?status=PENDING&take=1", {
    token,
    branchId,
  });
  return { domain: "shift-swap", count: readTotal(payload) };
}

/**
 * Anomalies are counted at `status=OPEN` only, and the card says exactly that.
 * `ACKNOWLEDGED` rows are decided-but-not-resolved; folding them into an "open"
 * number would overstate it, and counting them separately would cost a second
 * request for a number Overview does not act on.
 */
export async function getManagerOpenAnomalyCountRequest(
  token: string,
  branchId: string,
): Promise<ManagerApprovalCount> {
  const payload = await apiRequest<CountEnvelope>("/api/analytics/anomalies?status=OPEN&limit=1", {
    token,
    branchId,
  });
  return { domain: "anomaly", count: readTotal(payload) };
}
