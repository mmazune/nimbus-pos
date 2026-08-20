import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { getManagerReportCatalogRequest } from "@/lib/manager/api";
import {
  createManagerReportCsvExport,
  downloadManagerReportExport,
  generateManagerReport,
  getManagerReportRun,
  listManagerReportRuns,
  projectManagerReportCatalogResponse,
  saveManagerReportDownload,
  type ManagerReportRunsQuery,
} from "@/lib/manager/reports-api";
import { projectManagerReportRun } from "@/lib/manager/reports-model";
import type {
  ManagerReportCatalogEntry,
  ManagerReportGenerateInput,
  ManagerReportRun,
  ManagerReportRunsPage,
} from "@/lib/manager/reports-types";
import { managerQueryKey } from "@/lib/manager/state";

/**
 * Manager Reports — React Query binding (Track B4).
 *
 * Performance contract (CLAUDE.md §15):
 *
 * - **One query per surface.** Catalog = 1 read. Runs = 1 list read; a selected
 *   run adds exactly 1 detail read. Nothing fans out.
 * - **No polling.** Generation is synchronous — the POST response already
 *   carries `status: COMPLETED` and its summary — so there is no job to watch
 *   and no interval is started. A polling loop here would be inventing an async
 *   pipeline the backend does not have.
 * - **Every key is `["manager", …, branchId]`** via `managerQueryKey`, so the
 *   existing narrow branch-switch invalidation re-scopes Reports with no new
 *   invalidation code.
 * - **Post-generate refresh is narrow.** Generating invalidates the Reports run
 *   keys only. It never sweeps the Manager namespace and never touches the
 *   Overview dashboard's nine keys, Operations, Staff or another role's cache.
 */

const CATALOG_STALE_TIME = 5 * 60_000; // The catalog is a static contract, not live data.
const LIST_STALE_TIME = 30_000;

function useManagerReportsSession() {
  const { accessToken, clearSession, isAuthenticated, isManager } = useAuth();
  const branch = useManagerBranch();
  return {
    accessToken,
    branchId: branch.branchId,
    branchName: branch.branchName,
    clearSession,
    currencyCode: branch.currencyCode,
    isEnabled: Boolean(accessToken && branch.branchId && isAuthenticated && isManager),
  };
}

function useAuthErrorGuard(clearSession: () => void, errors: readonly unknown[]) {
  const hasAuthError = errors.some((error) => error instanceof ApiError && error.isAuthError);
  useEffect(() => {
    if (hasAuthError) clearSession();
  }, [clearSession, hasAuthError]);
}

// ── Catalog + generate ──────────────────────────────────────────────────────

export type ManagerReportCatalogSnapshot = {
  branchId: string | null;
  branchName: string;
  currencyCode: string | null;
  isEnabled: boolean;
  catalogQuery: UseQueryResult<ManagerReportCatalogEntry[]>;
  /** The run produced by the most recent generate in THIS session, if any. */
  generatedRun: ManagerReportRun | null;
  generate: (entry: ManagerReportCatalogEntry, input: ManagerReportGenerateInput) => void;
  isGenerating: boolean;
  generateError: string | null;
  resetGenerate: () => void;
};

export function useManagerReportCatalog(): ManagerReportCatalogSnapshot {
  const session = useManagerReportsSession();
  const queryClient = useQueryClient();
  const [generatedRun, setGeneratedRun] = useState<ManagerReportRun | null>(null);

  /**
   * ⚠️ Shares the M-P1 readiness strip's query key and fetcher on purpose.
   *
   * The strip calls `GET /api/reports/catalog` on every Manager page to count
   * ready generators. A second key here meant the catalog page fetched the same
   * endpoint twice — proven live before this was fixed. Reusing the key makes
   * React Query serve both consumers from one cache entry and one request, and
   * `select` projects it without touching what the strip reads.
   */
  const catalogQuery = useQuery({
    queryKey: managerQueryKey("report-catalog", session.branchId),
    enabled: session.isEnabled,
    staleTime: CATALOG_STALE_TIME,
    retry: 1,
    queryFn: () =>
      getManagerReportCatalogRequest(session.accessToken as string, session.branchId as string),
    select: projectManagerReportCatalogResponse,
  });

  const generateMutation = useMutation({
    mutationFn: ({
      entry,
      input,
    }: {
      entry: ManagerReportCatalogEntry;
      input: ManagerReportGenerateInput;
    }) =>
      generateManagerReport(
        session.accessToken as string,
        session.branchId as string,
        entry.generatorPath,
        input,
      ),
    onSuccess: (run) => {
      setGeneratedRun(run);
      // Narrow: the new run belongs in the history list, and nothing else in the
      // Manager namespace is affected by it.
      void queryClient.invalidateQueries({
        queryKey: managerQueryKey("reports-runs", session.branchId),
      });
    },
  });

  useAuthErrorGuard(session.clearSession, [catalogQuery.error, generateMutation.error]);

  const generate = useCallback(
    (entry: ManagerReportCatalogEntry, input: ManagerReportGenerateInput) => {
      // Availability is decided by the catalog's own status. A report the
      // backend has not implemented is never dispatched — the request is not
      // merely hidden in the UI, it is refused here too.
      if (entry.availability === "unavailable" || !entry.generatorPath) return;
      if (generateMutation.isPending) return;
      generateMutation.mutate({ entry, input });
    },
    [generateMutation],
  );

  return {
    branchId: session.branchId,
    branchName: session.branchName,
    currencyCode: session.currencyCode,
    isEnabled: session.isEnabled,
    catalogQuery,
    generatedRun,
    generate,
    isGenerating: generateMutation.isPending,
    generateError:
      generateMutation.error instanceof Error ? generateMutation.error.message : null,
    resetGenerate: () => {
      setGeneratedRun(null);
      generateMutation.reset();
    },
  };
}

// ── Run history + detail ────────────────────────────────────────────────────

export type ManagerReportRunsSnapshot = {
  branchId: string | null;
  branchName: string;
  currencyCode: string | null;
  isEnabled: boolean;
  listQuery: UseQueryResult<ManagerReportRunsPage>;
  detailQuery: UseQueryResult<ManagerReportRun>;
  selectedRunId: string | null;
};

export function useManagerReportRuns(
  query: ManagerReportRunsQuery,
  selectedRunId: string | null,
): ManagerReportRunsSnapshot {
  const session = useManagerReportsSession();

  const listQuery = useQuery({
    queryKey: managerQueryKey(
      "reports-runs",
      session.branchId,
      query.page,
      query.reportType || "",
      query.status || "",
    ),
    enabled: session.isEnabled,
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      listManagerReportRuns(session.accessToken as string, session.branchId as string, query),
  });

  const detailQuery = useQuery({
    queryKey: managerQueryKey("reports-run-detail", session.branchId, selectedRunId || ""),
    // Fires only when a run is actually selected — a list with no selection
    // issues exactly one request.
    enabled: session.isEnabled && Boolean(selectedRunId),
    staleTime: LIST_STALE_TIME,
    retry: 1,
    queryFn: () =>
      getManagerReportRun(
        session.accessToken as string,
        session.branchId as string,
        selectedRunId as string,
      ),
  });

  useAuthErrorGuard(session.clearSession, [listQuery.error, detailQuery.error]);

  return {
    branchId: session.branchId,
    branchName: session.branchName,
    currencyCode: session.currencyCode,
    isEnabled: session.isEnabled,
    listQuery,
    detailQuery,
    selectedRunId,
  };
}

// ── CSV export + download ───────────────────────────────────────────────────

export type ManagerReportExportState = {
  /** Create the artifact if needed, then stream the server's file to the user. */
  download: (run: ManagerReportRun) => void;
  isExporting: boolean;
  exportError: string | null;
  /** The filename the browser actually saved, for an honest confirmation line. */
  lastDownloadedFileName: string | null;
  lastDownloadedBytes: number | null;
  reset: () => void;
};

/**
 * The export flow, which is two calls the user experiences as one action:
 *
 * 1. `POST /api/reports/export` creates the CSV artifact (or, for a run that
 *    already has one, is skipped entirely).
 * 2. `GET /api/reports/exports/:id/download` returns the file.
 *
 * **CSV only.** There is no format argument anywhere in this hook, so no PDF
 * request can be constructed — the backend would 501 it, and offering the
 * control at all would advertise an export Nimbus cannot produce.
 */
export function useManagerReportExport(): ManagerReportExportState {
  const session = useManagerReportsSession();
  const queryClient = useQueryClient();
  const [lastDownload, setLastDownload] = useState<{ fileName: string; bytes: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async (run: ManagerReportRun) => {
      const token = session.accessToken as string;
      const branchId = session.branchId as string;

      let artifact = run.csvArtifact;
      if (!artifact) {
        const created = await createManagerReportCsvExport(token, branchId, run.id);
        artifact = projectManagerReportRun({
          id: run.id,
          branchId,
          exportArtifacts: [created],
        }).csvArtifact;
      }

      if (!artifact) {
        throw new ApiError({
          status: 500,
          code: "MANAGER_REPORT_EXPORT_UNAVAILABLE",
          message: "The export was requested but the API returned no ready CSV artifact.",
        });
      }

      const download = await downloadManagerReportExport(
        token,
        branchId,
        artifact.id,
        artifact.fileName,
      );
      saveManagerReportDownload(download);
      return download;
    },
    onSuccess: (download) => {
      setLastDownload({ fileName: download.fileName, bytes: download.byteLength });
      // The run now has one more artifact — refresh just the Reports keys.
      void queryClient.invalidateQueries({
        queryKey: managerQueryKey("reports-runs", session.branchId),
      });
      void queryClient.invalidateQueries({
        queryKey: managerQueryKey("reports-run-detail", session.branchId),
      });
    },
  });

  useAuthErrorGuard(session.clearSession, [mutation.error]);

  return {
    download: (run) => {
      if (mutation.isPending) return;
      mutation.mutate(run);
    },
    isExporting: mutation.isPending,
    exportError: mutation.error instanceof Error ? mutation.error.message : null,
    lastDownloadedFileName: lastDownload?.fileName ?? null,
    lastDownloadedBytes: lastDownload?.bytes ?? null,
    reset: () => {
      setLastDownload(null);
      mutation.reset();
    },
  };
}
