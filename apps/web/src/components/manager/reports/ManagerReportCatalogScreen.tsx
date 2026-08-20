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
import { ManagerReportParameterForm } from "@/components/manager/reports/ManagerReportParameterForm";
import { ManagerReportSummaryPanel } from "@/components/manager/reports/ManagerReportSummaryPanel";
import { Badge, Button, EmptyState, ErrorState, LoadingState, StatusMessage } from "@/components/ui";
import { useManagerReportCatalog, useManagerReportExport } from "@/lib/manager/reports-context";
import {
  MANAGER_REPORT_CATEGORIES,
  countManagerReportAvailability,
  filterManagerReportCatalog,
  managerReportUnavailableReason,
} from "@/lib/manager/reports-catalog";
import {
  MANAGER_REPORTS_ROUTES,
  readManagerReportCategory,
  readManagerReportKey,
  readManagerReportSearch,
} from "@/lib/manager/reports-route";
import { buildManagerListQuery } from "@/lib/manager/operations-route";
import type { ManagerReportCatalogEntry } from "@/lib/manager/reports-types";

/**
 * Reports → Catalog (Track B4).
 *
 * The Odoo **C4 list** over `GET /api/reports/catalog`, which returns all 37
 * entries with the backend's own `IMPLEMENTED` (24) / `CONDITIONAL` (1) /
 * `PENDING_LATER` (12) status. **Availability is that field, not a list kept
 * here**, so this screen cannot drift from what the backend can actually run.
 *
 * The unavailable state is truthful and structural: those 13 entries have no
 * generator route at all (`generatorPath === null`), so selecting one opens an
 * explanation naming the milestone the API itself cites — never a generate
 * button, never a disabled one pretending the capability is nearly here.
 *
 * **No PDF anywhere.** Every entry advertises `['CSV']` since C-01, and the
 * projection strips PDF even if it reappeared, because the backend 501s on it.
 *
 * **No graph or pivot, and the view switcher does not advertise them** — Nimbus
 * exposes no row payload to pivot over, so they are a backend gap (C-03), not a
 * UI gap. Nothing on this screen hints they are coming.
 */
export function ManagerReportCatalogScreen() {
  const router = useRouter();
  const search = readManagerReportSearch(router.query.q);
  const category = readManagerReportCategory(router.query.category);
  const selectedKey = readManagerReportKey(router.query.report);

  const snapshot = useManagerReportCatalog();
  const { catalogQuery, currencyCode, generatedRun } = snapshot;
  const exportState = useManagerReportExport();

  const entries = useMemo(() => catalogQuery.data || [], [catalogQuery.data]);
  const visible = useMemo(
    () => filterManagerReportCatalog(entries, { search, category }),
    [category, entries, search],
  );
  const counts = useMemo(() => countManagerReportAvailability(entries), [entries]);
  const selected = useMemo(
    () => entries.find((entry) => entry.key === selectedKey) || null,
    [entries, selectedKey],
  );

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

  const openReport = useCallback(
    (key: string | null) => {
      snapshot.resetGenerate();
      exportState.reset();
      void router.push(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, { report: key }) },
        undefined,
        { shallow: true },
      );
    },
    [exportState, router, snapshot],
  );

  const columns: ManagerListColumn<ManagerReportCatalogEntry>[] = useMemo(
    () => [
      { key: "title", header: "Report", render: (row) => row.title },
      {
        key: "category",
        header: "Category",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.category,
      },
      {
        key: "description",
        header: "What it covers",
        optional: true,
        defaultHidden: true,
        render: (row) => row.description || "—",
      },
      {
        key: "format",
        header: "Format",
        // Only shown where a file can actually be produced. The catalog
        // advertises `['CSV']` on all 37 entries including the 13 with no
        // generator, and printing "CSV" beside a report that cannot be run
        // would promise a download that does not exist.
        render: (row) =>
          row.availability === "unavailable" || !row.formats.length ? (
            <span className="text-text-muted">—</span>
          ) : (
            row.formats.map((format) => (
              <Badge key={format} variant="neutral">
                {format}
              </Badge>
            ))
          ),
      },
      {
        key: "availability",
        header: "Availability",
        render: (row) => {
          if (row.availability === "available") return <Badge variant="success">Available</Badge>;
          if (row.availability === "conditional") {
            return <Badge variant="warning">Depends on source data</Badge>;
          }
          return <Badge variant="neutral">Not yet available</Badge>;
        },
      },
    ],
    [],
  );

  // ── One report selected: parameters + result ──────────────────────────────
  if (selected) {
    const unavailableReason = managerReportUnavailableReason(selected);

    return (
      <ManagerContentShell>
        <ManagerBreadcrumbs
          parent={{ label: "Reports", href: MANAGER_REPORTS_ROUTES.catalog }}
          recordLabel={selected.title}
        />

        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm text-text-secondary">{selected.description}</p>
          <p className="text-xs text-text-muted">
            Catalog key <span className="font-mono">{selected.key}</span>
            {/* The export format is stated only where a file can actually be
                produced — the catalog advertises CSV even for the 13 entries
                with no generator, and repeating that here would promise a
                download that cannot exist. */}
            {selected.availability !== "unavailable" && selected.formats.length
              ? ` · exports as ${selected.formats.join(", ")}`
              : null}{" "}
            · guarded by <span className="font-mono">{selected.permission}</span>
          </p>
        </div>

        {unavailableReason ? (
          <StatusMessage
            tone={selected.availability === "conditional" ? "warning" : "info"}
            title={
              selected.availability === "conditional"
                ? "This report depends on source data quality"
                : "Not yet available"
            }
          >
            <span data-manager-report-unavailable>
              {selected.notes || unavailableReason}
              {selected.availability === "unavailable"
                ? " There is no generator for it on this backend, so it cannot be run here."
                : null}
            </span>
          </StatusMessage>
        ) : null}

        {selected.availability === "unavailable" ? null : (
          <ManagerReportParameterForm
            entry={selected}
            isGenerating={snapshot.isGenerating}
            onGenerate={(input) => snapshot.generate(selected, input)}
          />
        )}

        {snapshot.generateError ? (
          <StatusMessage tone="danger" title="The report could not be generated">
            {snapshot.generateError}
          </StatusMessage>
        ) : null}

        {generatedRun ? (
          <ManagerReportSummaryPanel
            run={generatedRun}
            currencyCode={currencyCode}
            activeBranchId={snapshot.branchId}
            onDownloadCsv={() => exportState.download(generatedRun)}
            isExporting={exportState.isExporting}
            exportError={exportState.exportError}
            lastDownloadedFileName={exportState.lastDownloadedFileName}
            lastDownloadedBytes={exportState.lastDownloadedBytes}
          />
        ) : null}
      </ManagerContentShell>
    );
  }

  // ── The catalog list ──────────────────────────────────────────────────────
  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Report catalog"
        badge={<Badge variant="neutral">Read-only until you generate</Badge>}
        search={{
          value: search,
          onChange: (value) => patchQuery({ q: value || null }),
          placeholder: "Search reports",
          filterChips: category ? (
            <ManagerFilterChip label={category} onClear={() => patchQuery({ category: null })} />
          ) : null,
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter reports"
              filters={MANAGER_REPORT_CATEGORIES.map((value) => ({
                key: value,
                label: value,
              }))}
              activeFilterKeys={category ? [category] : []}
              onToggleFilter={(key) => patchQuery({ category: category === key ? null : key })}
            />
          ),
        }}
      />

      {catalogQuery.isLoading ? (
        <LoadingState title="Loading the report catalog" />
      ) : catalogQuery.isError ? (
        <div className="flex min-w-0 flex-col items-start gap-3">
          <ErrorState
            title="The report catalog could not be read"
            description="Retry, or check that this branch is still selected."
          />
          <Button variant="secondary" onClick={() => void catalogQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No reports match"
          description="No catalog entry matches the current search or category."
        />
      ) : (
        <ManagerListTable
          caption="Report catalog"
          columns={columns}
          rows={visible}
          getRowId={(row) => row.key}
          onSelectRow={(row) => openReport(row.key)}
        />
      )}

      <p className="text-xs leading-5 text-text-muted">
        This backend publishes {counts.total} reports: {counts.available} can be generated now
        {counts.conditional > 0
          ? `, ${counts.conditional} depend on the quality of their source data`
          : ""}
        , and {counts.unavailable} are not yet available — each of those says why, naming the
        milestone the API itself cites. Every export is CSV; Nimbus has no PDF renderer, so no PDF
        is offered anywhere.
      </p>
    </ManagerContentShell>
  );
}
