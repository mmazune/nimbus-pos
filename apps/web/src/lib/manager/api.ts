import { apiRequest } from "@/lib/api/client";

/**
 * Manager reads used by the M-P1 readiness strip.
 *
 * Only two, and both are M-P0-verified GREEN with a permission the Manager holds:
 *
 * - `GET /api/reports/catalog` — 37 entries with truthful IMPLEMENTED (24) /
 *   CONDITIONAL (1) / PENDING_LATER (12) statuses. This is the honest
 *   generator-availability source (MANAGER-GAP-008), not a guess.
 * - `GET /api/devices` — branch-scoped, `{data, total, page, pageSize}`; verified live
 *   to re-scope on `X-Branch-Id` (Tapas POS 1 vs Rooftop POS 1).
 *
 * Deliberately NOT called here: `/api/tills` and `/api/shifts` (they do not exist —
 * MP0-02) and `/api/approvals` (only partly branch-scoped — MP0-05, handled in M-P2).
 */

export type ManagerReportCatalogEntry = {
  key: string;
  title?: string;
  description?: string;
  status?: "IMPLEMENTED" | "CONDITIONAL" | "PENDING_LATER" | string;
  formats?: string[];
  permission?: string;
};

export type ManagerDeviceSummaryResponse = {
  data?: Array<{ id: string; status?: string | null; branchId?: string | null }>;
  total?: number;
  page?: number;
  pageSize?: number;
};

export function getManagerReportCatalogRequest(token: string, branchId: string) {
  return apiRequest<ManagerReportCatalogEntry[]>("/api/reports/catalog", { token, branchId });
}

export function getManagerDeviceSummaryRequest(token: string, branchId: string) {
  // Explicit bounded page size — MP0-11 recorded that pageSize/take are unbounded on
  // several list routes, so Manager always sends its own bound.
  return apiRequest<ManagerDeviceSummaryResponse>("/api/devices?page=1&pageSize=50", {
    token,
    branchId,
  });
}
