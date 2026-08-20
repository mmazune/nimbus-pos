/**
 * Manager Reports — wire and projected types (Track B4).
 *
 * Every type here was written against a **live** response captured on the
 * isolated stack on 2026-08-20, not against the API matrix. Two of the docs'
 * assumptions did not survive that check and the types below encode reality:
 *
 * 1. `GET /api/reports` is **not** the catalog. It is the paginated list of
 *    persisted report RUNS — `{data,total,page,pageSize}`. The catalog lives at
 *    `GET /api/reports/catalog` and returns a **bare array** of 37 entries.
 * 2. A run carries **no rows**. `rowCount` + an aggregate `summary` is the whole
 *    payload (MP0-08 / C-03). What the docs do not record is that 16 of the 24
 *    summaries embed a **real array** — `topItems`, `hourlyBreakdown`,
 *    `lowStockItems`, `categories`, `actors`, `staffBreakdown`, `breakdown` —
 *    and that this array is exactly what the CSV export is built from. B4 may
 *    therefore render it, because it is returned data, not invented data.
 */

// ── Catalog ─────────────────────────────────────────────────────────────────

/** The three statuses the live catalog actually returns: 24 / 1 / 12 of 37. */
export type ManagerReportCatalogStatus = "IMPLEMENTED" | "CONDITIONAL" | "PENDING_LATER";

/**
 * Every field except `key` is optional here on purpose.
 *
 * This type is the boundary the M-P1 readiness request already crosses
 * (`lib/manager/api.ts`), and the projection below is written to survive a
 * missing title, an unknown status or an absent `formats` array rather than
 * assuming the catalog's shape never changes. An entry that arrives malformed
 * degrades to "not generatable" instead of throwing or being offered.
 */
export type ManagerReportCatalogEntryApi = {
  key: string;
  title?: string;
  description?: string;
  status?: string;
  formats?: string[];
  permission?: string;
  /** Present on CONDITIONAL entries — why the data may be incomplete. */
  notes?: string | null;
  /** Present on PENDING_LATER entries — the milestone that would deliver it. */
  dependencyMilestone?: string | null;
};

/**
 * What the UI may do with an entry.
 *
 * Derived from the catalog's OWN `status` field — never from a list maintained
 * in the frontend. If the backend implements a generator tomorrow, this UI
 * offers it without a code change; if it withdraws one, the UI stops offering
 * it. That is the whole reason the availability state is honest.
 */
export type ManagerReportAvailability = "available" | "conditional" | "unavailable";

export type ManagerReportCatalogEntry = {
  key: string;
  title: string;
  description: string;
  status: ManagerReportCatalogStatus;
  availability: ManagerReportAvailability;
  /** UI grouping mirroring the backend's own A–H source sections. */
  category: string;
  formats: readonly string[];
  permission: string;
  notes: string | null;
  dependencyMilestone: string | null;
  /**
   * The POST route segment, or `null` when the backend exposes no generator.
   * A `null` here is what makes "generate" structurally impossible for the 13
   * entries that have no endpoint — the button cannot be wired to anything.
   */
  generatorPath: string | null;
  /** `top-items` is the ONLY DTO variant — it adds an optional `limit` (MP0-16). */
  supportsLimit: boolean;
};

// ── Runs ────────────────────────────────────────────────────────────────────

export type ManagerReportWindow = "DAY" | "WEEK" | "MONTH" | "CUSTOM";
export type ManagerReportRunStatus = "PENDING" | "COMPLETED" | "FAILED";

export type ManagerReportArtifactApi = {
  id: string;
  format?: string | null;
  status?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksum?: string | null;
  readyAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
};

export type ManagerReportRunApi = {
  id: string;
  orgId?: string | null;
  branchId?: string | null;
  reportType?: string | null;
  reportWindow?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  parameters?: Record<string, unknown> | null;
  rowCount?: number | null;
  summary?: unknown;
  generatedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  exportArtifacts?: ManagerReportArtifactApi[] | null;
};

export type ManagerReportRunsListApi = {
  data?: ManagerReportRunApi[] | null;
  total?: number | null;
  page?: number | null;
  pageSize?: number | null;
};

/** A CSV artifact this UI is willing to offer for download. */
export type ManagerReportArtifact = {
  id: string;
  fileName: string;
  fileSizeBytes: number | null;
  checksum: string | null;
  readyAt: string | null;
};

export type ManagerReportRun = {
  id: string;
  reportType: string;
  reportTypeLabel: string;
  reportWindow: ManagerReportWindow | null;
  status: ManagerReportRunStatus;
  /**
   * The run's OWN branch. `GET /reports/:id` is looked up by `orgId` alone, so a
   * run from another branch really is readable with this branch's header
   * (MP0-12 — re-verified live for B4). Carrying the field lets every surface
   * compare it against the active branch and fail safe instead of mislabelling
   * another branch's money as this branch's.
   */
  branchId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string | null;
  failureReason: string | null;
  /**
   * The generator's own count of the source records it aggregated. It is NOT
   * the number of rows in the CSV and is never labelled as such: SALES_BY_HOUR
   * reports 219 here and exports 24 hourly rows.
   */
  rowCount: number | null;
  summary: Record<string, unknown> | null;
  /** The newest READY CSV artifact, or null when none has been created yet. */
  csvArtifact: ManagerReportArtifact | null;
  /**
   * Pre-2026-08-20 PDF artifact rows. C-01 withdrew the fake PDF writer but left
   * the historical rows in place, and their files 404 on download (verified).
   * They are DISCLOSED as withdrawn and never offered as a download.
   */
  withdrawnPdfCount: number;
};

export type ManagerReportRunsPage = {
  rows: ManagerReportRun[];
  total: number;
  page: number;
  pageSize: number;
};

// ── Generate ────────────────────────────────────────────────────────────────

/**
 * The uniform generator payload (MP0-16, re-verified live for all 24 routes):
 * `{reportWindow, dateFrom?, dateTo?, parameters?}`, plus `limit?` on
 * `top-items` alone. `CUSTOM` is the only window that requires the dates — the
 * API returns 400 "dateFrom and dateTo required for CUSTOM window" without them.
 */
export type ManagerReportGenerateInput = {
  reportWindow: ManagerReportWindow;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};
