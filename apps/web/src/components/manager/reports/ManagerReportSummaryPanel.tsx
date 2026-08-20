import { useMemo } from "react";

import { Badge, Button, StatusMessage } from "@/components/ui";
import { formatManagerDateTime } from "@/lib/manager/operations-model";
import {
  formatManagerBreakdownCell,
  formatManagerFileSize,
  formatManagerReportRange,
  isManagerBreakdownColumnNumeric,
  managerReportLabel,
  managerReportStatusTone,
  toManagerReportBreakdown,
  toManagerReportSummaryEntries,
  MANAGER_REPORT_WINDOW_LABELS,
} from "@/lib/manager/reports-model";
import type { ManagerReportRun } from "@/lib/manager/reports-types";
import { cn } from "@/lib/utils/cn";

/**
 * A generated run, rendered (Track B4).
 *
 * ## What may be shown, and why
 *
 * `GET /reports/:id` returns **no rows** — `rowCount` plus an aggregate
 * `summary` (MP0-08 / C-03). So the primary rendering is a key/value panel, and
 * **no row table is ever derived from `rowCount`**.
 *
 * There is one nuance the API matrix does not record and this phase verified
 * live: **16 of the 24 summaries embed a real array** (`topItems`,
 * `hourlyBreakdown`, `categories`, `lowStockItems`, `actors`, `staffBreakdown`,
 * `breakdown`), and the CSV export is generated from exactly that array — a
 * TOP_ITEMS export really is 20 tabular rows of `Rank,Item,Quantity Sold,Gross
 * Sales`. Rendering it is therefore showing the file's own contents before
 * download, not fabricating rows. When a summary carries no array the panel
 * says so in words instead of inventing a table.
 *
 * ## rowCount is never called a row count
 *
 * `rowCount` is whatever each generator counted while aggregating —
 * `shifts.length + tillCount` for SHIFT_END, `salesAgg._count` (219) for
 * DAILY_SALES, `orders.length` (219) for SALES_BY_HOUR whose export is 24 rows.
 * It is labelled **"Records aggregated"** and never equated with the export's
 * line count.
 */

type ManagerReportSummaryPanelProps = {
  run: ManagerReportRun;
  currencyCode: string | null;
  activeBranchId: string | null;
  onDownloadCsv: () => void;
  isExporting: boolean;
  exportError: string | null;
  lastDownloadedFileName: string | null;
  lastDownloadedBytes: number | null;
};

const PREVIEW_ROW_LIMIT = 10;

export function ManagerReportSummaryPanel({
  activeBranchId,
  currencyCode,
  exportError,
  isExporting,
  lastDownloadedBytes,
  lastDownloadedFileName,
  onDownloadCsv,
  run,
}: ManagerReportSummaryPanelProps) {
  const entries = useMemo(
    () => toManagerReportSummaryEntries(run.summary, currencyCode),
    [currencyCode, run.summary],
  );
  const breakdown = useMemo(
    () => toManagerReportBreakdown(run.reportType, run.summary),
    [run.reportType, run.summary],
  );

  const previewRows = breakdown ? breakdown.rows.slice(0, PREVIEW_ROW_LIMIT) : [];
  const hiddenRowCount = breakdown ? breakdown.rows.length - previewRows.length : 0;

  // MP0-12: runs resolve by orgId, so a run's own branch is displayed and
  // compared rather than assumed to be the active one.
  const isOutOfBranch = Boolean(run.branchId && activeBranchId && run.branchId !== activeBranchId);

  return (
    <section data-manager-report-run={run.id} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold text-text-primary">{run.reportTypeLabel}</h2>
            <Badge variant={managerReportStatusTone(run.status)}>{run.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {run.reportWindow ? MANAGER_REPORT_WINDOW_LABELS[run.reportWindow] : "Period unknown"}
            {" · "}
            {formatManagerReportRange(run)}
            {" · generated "}
            {formatManagerDateTime(run.generatedAt)}
          </p>
        </div>

        {run.status === "COMPLETED" ? (
          <Button
            variant="secondary"
            onClick={onDownloadCsv}
            disabled={isExporting}
            data-manager-report-download
          >
            {isExporting ? "Preparing CSV…" : "Download CSV"}
          </Button>
        ) : null}
      </header>

      {isOutOfBranch ? (
        <StatusMessage tone="warning" title="This run belongs to another branch">
          It was generated for branch {run.branchId}. Nimbus resolves report runs by organization,
          not by branch, so figures below are not this branch&apos;s.
        </StatusMessage>
      ) : null}

      {run.status === "FAILED" ? (
        <StatusMessage tone="danger" title="This report failed to generate">
          {run.failureReason || "The API recorded a failure but returned no reason."}
        </StatusMessage>
      ) : null}

      {exportError ? (
        <StatusMessage tone="danger" title="The CSV could not be downloaded">
          {exportError}
        </StatusMessage>
      ) : null}

      {lastDownloadedFileName ? (
        <StatusMessage tone="success" title="CSV downloaded">
          Saved {lastDownloadedFileName} ({formatManagerFileSize(lastDownloadedBytes)}) — the file is
          produced by the API, not assembled in this browser.
        </StatusMessage>
      ) : null}

      {run.withdrawnPdfCount > 0 ? (
        <StatusMessage tone="info" title="An older PDF artifact is attached to this run">
          {run.withdrawnPdfCount === 1 ? "One PDF export was" : `${run.withdrawnPdfCount} PDF exports were`}{" "}
          recorded before 2026-08-20, when Nimbus withdrew its PDF writer — it stamped plain text as
          a PDF. Those files are not downloadable and no PDF export is offered. CSV is the only
          format this backend can produce.
        </StatusMessage>
      ) : null}

      {/* Summary — the key/value panel that MP0-08 permits. */}
      <div className="rounded-lg bg-surface p-4 shadow-subtle">
        <h3 className="pb-3 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
          Summary
        </h3>
        {entries.length === 0 ? (
          <p className="text-sm text-text-secondary">
            This run recorded no summary figures.
          </p>
        ) : (
          <dl
            data-manager-report-summary
            className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {entries.map((entry) => (
              <div key={entry.key} className="flex min-w-0 flex-col">
                <dt className="text-xs text-text-muted">{entry.label}</dt>
                <dd
                  className={cn(
                    "truncate text-base font-semibold text-text-primary",
                    entry.kind === "money" || entry.kind === "count" ? "tabular-nums" : null,
                  )}
                >
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="pt-3 text-xs leading-5 text-text-muted">
          Records aggregated: <span className="tabular-nums">{run.rowCount ?? "—"}</span>. This is
          the number of source records this generator scanned — not the number of lines in the CSV,
          which summarises them.
        </p>
      </div>

      {/* Breakdown — the array the summary really carries, and the CSV's own rows. */}
      {breakdown ? (
        <div className="min-w-0 rounded-lg bg-surface p-4 shadow-subtle">
          <h3 className="pb-1 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
            {breakdown.label}
          </h3>
          <p className="pb-3 text-xs text-text-muted">
            These rows come from the run&apos;s own summary and are what the CSV export contains.
          </p>
          <div className="overflow-x-auto">
            <table data-manager-report-breakdown className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">{breakdown.label} for {run.reportTypeLabel}</caption>
              <thead>
                <tr className="border-b border-border-subtle">
                  {breakdown.columns.map((column) => (
                    <th
                      key={column.field}
                      scope="col"
                      className={cn(
                        "px-2 py-2 text-xs font-bold uppercase tracking-[0.04em] text-text-muted",
                        isManagerBreakdownColumnNumeric(column) ? "text-right" : "text-left",
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr
                    key={`${breakdown.sourceKey}-${index}`}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    {breakdown.columns.map((column) => (
                      <td
                        key={column.field}
                        className={cn(
                          "px-2 py-2 text-text-primary",
                          isManagerBreakdownColumnNumeric(column)
                            ? "text-right tabular-nums"
                            : "text-left",
                        )}
                      >
                        {formatManagerBreakdownCell(column, row[column.field], currencyCode)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hiddenRowCount > 0 ? (
            <p className="pt-3 text-xs text-text-muted">
              Showing the first {previewRows.length} of {breakdown.rows.length} rows. Download the
              CSV for all of them.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs leading-5 text-text-muted">
          This report returns aggregate figures only — it carries no per-row breakdown, so none is
          shown. The CSV export contains the same summary figures.
        </p>
      )}
    </section>
  );
}
