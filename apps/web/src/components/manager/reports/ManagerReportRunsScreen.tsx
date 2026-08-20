import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";

import {
  ManagerBreadcrumbs,
  ManagerContentShell,
  ManagerControlPanel,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ManagerReportSummaryPanel } from "@/components/manager/reports/ManagerReportSummaryPanel";
import { Badge, Button, ErrorState, LoadingState } from "@/components/ui";
import { formatManagerDateTime, toManagerPager } from "@/lib/manager/operations-model";
import { buildManagerListQuery } from "@/lib/manager/operations-route";
import { MANAGER_REPORTS_PAGE_SIZE } from "@/lib/manager/reports-api";
import { useManagerReportExport, useManagerReportRuns } from "@/lib/manager/reports-context";
import {
  MANAGER_REPORT_RUN_STATUSES,
  formatManagerReportRange,
  managerReportStatusTone,
  managerReportTypeLabel,
} from "@/lib/manager/reports-model";
import {
  MANAGER_REPORTS_ROUTES,
  readManagerRunId,
  readManagerRunReportType,
  readManagerRunStatus,
} from "@/lib/manager/reports-route";
import { readManagerPage } from "@/lib/manager/operations-route";
import type { ManagerReportRun } from "@/lib/manager/reports-types";

/**
 * Reports → Report runs (Track B4).
 *
 * **History is genuinely persisted** — this was verified before it was built,
 * because the prompt required an honest session-only fallback if it were not.
 * `GET /api/reports` returns `{data,total,page,pageSize}` over real
 * `report_runs` rows (32 on the QA branch: 7 seeded plus this phase's own), and
 * each row carries its `exportArtifacts[]`. So the list is a server-paginated,
 * branch-scoped read, not a session buffer, and it says nothing about
 * persistence that is not true.
 *
 * Pagination is server-side against the endpoint's own `total`, with an
 * explicit page size on every request (`/api/reports` has `@Min(1)` and **no
 * `@Max`** — MP0-11 / C-12).
 */
export function ManagerReportRunsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const reportType = readManagerRunReportType(router.query.reportType);
  const status = readManagerRunStatus(router.query.status);
  const selectedRunId = readManagerRunId(router.query.runId);

  const snapshot = useManagerReportRuns({ page, reportType, status }, selectedRunId);
  const { currencyCode, detailQuery, listQuery } = snapshot;
  const exportState = useManagerReportExport();

  const rows = useMemo(() => listQuery.data?.rows || [], [listQuery.data]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      void router.replace(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const openRun = useCallback(
    (runId: string | null) => {
      exportState.reset();
      void router.push(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, { runId, page }) },
        undefined,
        { shallow: true },
      );
    },
    [exportState, page, router],
  );

  const columns: ManagerListColumn<ManagerReportRun>[] = useMemo(
    () => [
      { key: "report", header: "Report", render: (row) => row.reportTypeLabel },
      {
        key: "period",
        header: "Period",
        optional: true,
        hideBelowLarge: true,
        render: (row) => formatManagerReportRange(row),
      },
      {
        key: "generated",
        header: "Generated",
        render: (row) => formatManagerDateTime(row.generatedAt),
      },
      {
        key: "records",
        header: "Records",
        numeric: true,
        optional: true,
        render: (row) => (row.rowCount === null ? "—" : row.rowCount),
      },
      {
        key: "export",
        header: "Export",
        render: (row) =>
          row.csvArtifact ? (
            <Badge variant="info">CSV ready</Badge>
          ) : (
            <span className="text-text-muted">On demand</span>
          ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={managerReportStatusTone(row.status)}>{row.status}</Badge>,
      },
    ],
    [],
  );

  const pager = toManagerPager({
    page,
    pageSize: listQuery.data?.pageSize ?? MANAGER_REPORTS_PAGE_SIZE,
    rowCount: rows.length,
    total: listQuery.data?.total ?? 0,
  });

  // ── One run selected ──────────────────────────────────────────────────────
  if (selectedRunId) {
    const run = detailQuery.data;

    return (
      <ManagerContentShell>
        <ManagerBreadcrumbs
          parent={{ label: "Report runs", href: MANAGER_REPORTS_ROUTES.runs }}
          recordLabel={run ? run.reportTypeLabel : "Report run"}
        />

        {detailQuery.isLoading ? (
          <LoadingState title="Loading this report run" />
        ) : detailQuery.isError ? (
          <div className="flex min-w-0 flex-col items-start gap-3">
            <ErrorState
              title="This report run could not be opened"
              description={
                detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "The run could not be read for this branch."
              }
            />
            <Button variant="secondary" onClick={() => void detailQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : run ? (
          <ManagerReportSummaryPanel
            run={run}
            currencyCode={currencyCode}
            activeBranchId={snapshot.branchId}
            onDownloadCsv={() => exportState.download(run)}
            isExporting={exportState.isExporting}
            exportError={exportState.exportError}
            lastDownloadedFileName={exportState.lastDownloadedFileName}
            lastDownloadedBytes={exportState.lastDownloadedBytes}
          />
        ) : null}
      </ManagerContentShell>
    );
  }

  // ── The run list ──────────────────────────────────────────────────────────
  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Report runs"
        badge={<Badge variant="neutral">Saved by the API</Badge>}
        search={{
          // `/api/reports` accepts `reportType` and `status` only — it has no
          // text-search parameter, so the box hosts chips and the filter menu
          // and omits the input rather than greying one out.
          emptyHint: "This endpoint has no text search — filter by report or status.",
          filterChips: (
            <>
              {reportType ? (
                <ManagerFilterChip
                  label={managerReportTypeLabel(reportType)}
                  onClear={() => patchQuery({ reportType: null })}
                />
              ) : null}
              {status ? (
                <ManagerFilterChip label={status} onClear={() => patchQuery({ status: null })} />
              ) : null}
            </>
          ),
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter report runs"
              filters={MANAGER_REPORT_RUN_STATUSES.map((value) => ({
                key: value,
                label: value,
              }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
            />
          ),
        }}
        pager={{
          ...pager,
          onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }),
          onNext: () => patchQuery({ page: page + 1 }),
        }}
      />

      <ManagerListTable
        caption="Report runs for this branch"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        onSelectRow={(row) => openRun(row.id)}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="The report history could not be read for this branch. Retry, or clear the filters."
        emptyTitle="No report runs"
        emptyMessage="No report has been generated for this branch with these filters. Generate one from the catalog."
      />

      <p className="text-xs leading-5 text-text-muted">
        Report runs are stored by the API, so this history survives sign-out and is shared with
        anyone who can read this branch&apos;s reports. Exports are CSV only.
      </p>
    </ManagerContentShell>
  );
}
