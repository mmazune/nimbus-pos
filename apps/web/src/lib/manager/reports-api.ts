import { API_BASE_URL, ApiError, apiRequest } from "../api/client";
import { projectManagerReportCatalog } from "./reports-catalog";
import { projectManagerReportRun } from "./reports-model";
import type {
  ManagerReportArtifactApi,
  ManagerReportCatalogEntry,
  ManagerReportCatalogEntryApi,
  ManagerReportGenerateInput,
  ManagerReportRun,
  ManagerReportRunApi,
  ManagerReportRunsListApi,
  ManagerReportRunsPage,
  ManagerReportRunStatus,
} from "./reports-types";

/**
 * Manager Reports — request layer (Track B4).
 *
 * Four rules, the same shape as `operations-api.ts`:
 *
 * 1. **Bounded, always.** `/api/reports` has `@Min(1)` and **no `@Max`** on
 *    `pageSize` and no service clamp (MP0-11 / C-12), so every call here sends
 *    one constant page size that never comes from user input.
 * 2. **Branch-scoped, always.** Every request passes `branchId` →
 *    `X-Branch-Id`. The list endpoint really is branch-scoped; `GET /reports/:id`
 *    and the download are **org-scoped only** (MP0-12, re-verified live for B4:
 *    a Tapas run returned 200 under a Rooftop header), so this module ALSO
 *    re-checks the run's own `branchId` at the boundary — see `getManagerReportRun`.
 * 3. **Projected at the boundary**, so a summary shape the UI has not been
 *    taught about cannot leak into state or the cache unexamined.
 * 4. **No file is ever built in the browser.** The CSV download streams the
 *    server's own bytes via `response.blob()`. There is no `new Blob([...])`
 *    over client data anywhere in the Manager tree, and the B4 assertion script
 *    proves it — a client-synthesised CSV would be a fabricated artifact
 *    wearing a real filename.
 */

/** One page size for the run history. */
export const MANAGER_REPORTS_PAGE_SIZE = 25;

/**
 * The catalog is NOT fetched here.
 *
 * `GET /api/reports/catalog` already has exactly one caller in this app —
 * `getManagerReportCatalogRequest` in `lib/manager/api.ts`, which the M-P1
 * readiness strip issues on EVERY Manager page to count ready generators. Adding
 * a second fetcher under a second query key made the Reports catalog page issue
 * the same request twice (measured live: `2x GET /api/reports/catalog` on one
 * load), which is precisely the duplicate-query regression CLAUDE.md §15
 * forbids.
 *
 * So Reports reuses that request AND its query key, and projects the shared
 * cache entry with React Query's `select`. One endpoint, one fetcher, one cache
 * entry, two consumers. See `useManagerReportCatalog` in `reports-context.ts`.
 */
export function projectManagerReportCatalogResponse(
  entries: readonly ManagerReportCatalogEntryApi[] | null | undefined,
): ManagerReportCatalogEntry[] {
  return projectManagerReportCatalog(Array.isArray(entries) ? entries : []);
}

// ── Run history ─────────────────────────────────────────────────────────────

export type ManagerReportRunsQuery = {
  page: number;
  reportType?: string | null;
  status?: ManagerReportRunStatus | null;
};

export function buildManagerReportRunsPath({ page, reportType, status }: ManagerReportRunsQuery) {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, Math.trunc(page) || 1)));
  // Explicit bound — never omitted, never widened from the UI (MP0-11).
  params.set("pageSize", String(MANAGER_REPORTS_PAGE_SIZE));
  if (reportType) params.set("reportType", reportType);
  if (status) params.set("status", status);
  return `/api/reports?${params.toString()}`;
}

export async function listManagerReportRuns(
  token: string,
  branchId: string,
  query: ManagerReportRunsQuery,
): Promise<ManagerReportRunsPage> {
  const response = await apiRequest<ManagerReportRunsListApi>(buildManagerReportRunsPath(query), {
    token,
    branchId,
  });

  return {
    rows: (response.data || []).map(projectManagerReportRun),
    // The endpoint's own count — never a page length.
    total: typeof response.total === "number" ? response.total : 0,
    page: typeof response.page === "number" ? response.page : query.page,
    pageSize: typeof response.pageSize === "number" ? response.pageSize : MANAGER_REPORTS_PAGE_SIZE,
  };
}

/**
 * A single run.
 *
 * ⚠️ **The cross-branch guard is here, not in a component.** The route resolves
 * by `orgId` alone, so a run id belonging to another branch of the same
 * organization returns **200** with that branch's money in it. Reading it under
 * the current branch's heading would be a silent mislabel of the kind B3-D1
 * warned about, so a run whose own `branchId` is not the active branch is
 * rejected at the boundary and never reaches the cache.
 */
export async function getManagerReportRun(
  token: string,
  branchId: string,
  runId: string,
): Promise<ManagerReportRun> {
  const response = await apiRequest<ManagerReportRunApi>(
    `/api/reports/${encodeURIComponent(runId)}`,
    { token, branchId },
  );

  const run = projectManagerReportRun(response);

  if (run.branchId && run.branchId !== branchId) {
    throw new ApiError({
      status: 404,
      code: "MANAGER_REPORT_OUT_OF_BRANCH",
      message:
        "This report run belongs to a different branch. Switch branch to open it — Nimbus resolves report runs by organization, so it is not shown under this branch.",
      details: { runId, runBranchId: run.branchId, activeBranchId: branchId },
    });
  }

  return run;
}

// ── Generate ────────────────────────────────────────────────────────────────

/**
 * Run a generator.
 *
 * `generatorPath` comes from the catalog projection and is `null` for all 13
 * non-implemented entries, so an unavailable report has no route to call. The
 * guard below makes that structural rather than merely conventional.
 *
 * Generation is **synchronous** — the live response is already
 * `status: COMPLETED` with its summary attached (MP0-QA), so there is no polling
 * state and none is invented.
 */
export async function generateManagerReport(
  token: string,
  branchId: string,
  generatorPath: string | null,
  input: ManagerReportGenerateInput,
): Promise<ManagerReportRun> {
  if (!generatorPath) {
    throw new ApiError({
      status: 501,
      code: "MANAGER_REPORT_NOT_IMPLEMENTED",
      message: "This report has no generator on this backend, so it cannot be run.",
    });
  }

  const body: Record<string, unknown> = { reportWindow: input.reportWindow };
  // Sent only for CUSTOM — the API 400s without them, and sending them on a
  // DAY/WEEK/MONTH run would imply the range was honoured when it is not.
  if (input.reportWindow === "CUSTOM") {
    if (input.dateFrom) body.dateFrom = input.dateFrom;
    if (input.dateTo) body.dateTo = input.dateTo;
  }
  if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
    body.limit = input.limit;
  }

  const response = await apiRequest<ManagerReportRunApi>(
    `/api/reports/${encodeURIComponent(generatorPath)}`,
    { token, branchId, method: "POST", body },
  );

  return projectManagerReportRun(response);
}

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Create a CSV export artifact for a run.
 *
 * **CSV is hard-coded and there is no format parameter on this function.**
 * Since C-01 (2026-08-20) the backend returns **501** for `format: PDF` before
 * any artifact row is created, and the catalog advertises `['CSV']` on all 37
 * entries. Making the format a parameter would put a PDF request one caller
 * away; making it a constant means no code path in this app can ask for one.
 */
export async function createManagerReportCsvExport(
  token: string,
  branchId: string,
  runId: string,
) {
  const response = await apiRequest<ManagerReportArtifactApi>("/api/reports/export", {
    token,
    branchId,
    method: "POST",
    body: { reportRunId: runId, format: "CSV" },
  });
  return response;
}

export type ManagerReportDownload = {
  blob: Blob;
  fileName: string;
  contentType: string;
  byteLength: number;
};

/**
 * Download an export artifact.
 *
 * This is the one Manager read that cannot go through `apiRequest`: that helper
 * parses every response as text/JSON, which would corrupt a file. It therefore
 * uses `fetch` directly while keeping the client's own conventions — bearer
 * token, `X-Branch-Id`, `X-Request-Id` and a bounded timeout (CLAUDE.md §15).
 *
 * The bytes returned are **the server's**. `response.blob()` is the only Blob
 * construction in the Manager tree; nothing here assembles CSV text.
 */
export async function downloadManagerReportExport(
  token: string,
  branchId: string,
  artifactId: string,
  fallbackFileName: string,
  timeoutMs = 30_000,
): Promise<ManagerReportDownload> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort("timeout"), timeoutMs);

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/reports/exports/${encodeURIComponent(artifactId)}/download`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Branch-Id": branchId,
          "X-Request-Id":
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `req-${Date.now().toString(36)}`,
        },
        signal: controller.signal,
      },
    );
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError({
      status: 0,
      code: aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      message: aborted
        ? `The export did not download within ${Math.round(timeoutMs / 1000)} seconds.`
        : "The export could not be downloaded — the API could not be reached.",
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!response.ok) {
    // A withdrawn pre-2026-08-20 PDF artifact 404s here ("Export file not found
    // on disk"). Surface the API's own words rather than a generic failure.
    let message = `The export could not be downloaded (HTTP ${response.status}).`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body — keep the status message */
    }
    throw new ApiError({ status: response.status, code: `HTTP_${response.status}`, message });
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);

  return {
    blob,
    fileName: match?.[1] || fallbackFileName,
    contentType: response.headers.get("content-type") || blob.type || "text/csv",
    byteLength: blob.size,
  };
}

/**
 * Hand the downloaded bytes to the browser.
 *
 * Separated from the fetch so the transport can be tested and asserted on its
 * own, and so it is obvious that the object URL wraps a server-provided Blob.
 */
export function saveManagerReportDownload(download: ManagerReportDownload) {
  const url = URL.createObjectURL(download.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = download.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
