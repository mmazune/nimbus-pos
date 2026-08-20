import { useMemo } from "react";

import {
  ManagerCardActionLink,
  ManagerCardPrimaryKpi,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import { ManagerRatioMeter } from "@/components/manager/dashboard/ManagerDashboardCharts";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import {
  formatManagerCount,
  formatStockQuantity,
  getManagerKpiBinding,
  toLowStockEntries,
} from "@/lib/manager/dashboard-model";

/**
 * Low stock.
 *
 * Unlike open-orders this endpoint is **not capped** — the service scans every
 * active item that has a reorder level, so `count` is the branch total and the
 * item list is complete. The card shows the four deepest shortfalls with a ratio
 * meter of current stock against the reorder level; the meter is a real ratio of
 * two returned fields, and any item whose numbers do not parse renders an empty
 * track plus an explicit "Unavailable" rather than a bar at zero.
 *
 * Drill-in is Reports, not Operations: the branch-wide inventory surface is a
 * report generator (`POST /api/reports/low-stock`, B4), and Operations owns
 * orders/tables/reservations.
 */
export function ManagerLowStockCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { lowStockQuery } = snapshot;
  const entries = useMemo(() => toLowStockEntries(lowStockQuery.data), [lowStockQuery.data]);
  const count = lowStockQuery.data?.count ?? null;

  return (
    <ManagerDashboardCard
      testId="low-stock"
      title="Low stock"
      icon="inventory"
      accent="warning"
      isLoading={lowStockQuery.isLoading}
      isError={lowStockQuery.isError}
      isEmpty={!lowStockQuery.isLoading && !lowStockQuery.isError && count === 0}
      emptyMessage="Every tracked item on this branch is above its reorder level."
      actions={<ManagerCardActionLink href="/manager/reports">Reports</ManagerCardActionLink>}
      footnote="Counts active items whose stock on hand is at or below their reorder level. Items without a reorder level are not tracked here."
    >
      <ManagerCardPrimaryKpi
        kpiKey="lowStock.count"
        value={formatManagerCount(count)}
        hint="Deepest shortfalls first."
      />

      <div className="min-w-0">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {getManagerKpiBinding("lowStock.items").label}
        </p>
        <ul className="flex min-w-0 flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.row.id} className="min-w-0">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-text-secondary" title={entry.row.name}>
                  {entry.row.name}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-text-primary">
                  {formatStockQuantity(entry.currentStock, entry.row.unit)}
                  <span className="font-normal text-text-muted">
                    {" "}
                    / {formatStockQuantity(entry.reorderLevel, entry.row.unit)}
                  </span>
                </span>
              </div>
              <div className="mt-1">
                <ManagerRatioMeter
                  value={entry.coverage}
                  tone={entry.coverage !== null && entry.coverage <= 0.25 ? "danger" : "warning"}
                  label={
                    entry.coverage === null
                      ? `${entry.row.name}: stock level unavailable`
                      : `${entry.row.name}: ${Math.round(entry.coverage * 100)}% of its reorder level`
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ManagerDashboardCard>
  );
}
