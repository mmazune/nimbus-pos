import { useMemo } from "react";

import {
  ManagerCardActionLink,
  ManagerCardPrimaryKpi,
  ManagerCardStatList,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import { ManagerBarSeries } from "@/components/manager/dashboard/ManagerDashboardCharts";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import {
  formatManagerCount,
  formatManagerElapsed,
  isOpenOrdersPreviewCapped,
  minutesSince,
  oldestOpenOrder,
  toAgingBuckets,
  toManagerCount,
  toOrderStatusSplit,
} from "@/lib/manager/dashboard-model";

/**
 * Open orders + aging.
 *
 * Two different sources, deliberately:
 *
 * - The **headline count** is `/dash/manager.openOrders` — a real `count()` over
 *   the branch. It is never taken from `/dash/open-orders.count`, which is the
 *   page length of a `take: 50` query and read `50` live while the true count was
 *   `112` (MP0-09).
 * - The **aging bars and status split** come from `/dash/open-orders.orders[]`,
 *   which is ordered `createdAt asc` and therefore holds the OLDEST rows — the
 *   right sample for an aging read. When the branch has more open orders than the
 *   preview returns, the card says so in words rather than implying the bars
 *   cover everything.
 */
export function ManagerOpenOrdersCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { managerQuery, openOrdersQuery } = snapshot;
  // Memoised so the aging/status derivation below has a stable dependency and does
  // not recompute (and re-bucket against a new `Date.now()`) on every render.
  const rows = useMemo(() => openOrdersQuery.data?.orders || [], [openOrdersQuery.data]);
  const authoritativeOpen = toManagerCount(managerQuery.data?.openOrders);

  const { buckets, oldestMinutes, statuses } = useMemo(() => {
    const now = Date.now();
    const oldest = oldestOpenOrder(rows);
    return {
      buckets: toAgingBuckets(rows, now),
      oldestMinutes: oldest ? minutesSince(oldest.createdAt, now) : null,
      statuses: toOrderStatusSplit(rows).slice(0, 3),
    };
  }, [rows]);

  const isCapped = isOpenOrdersPreviewCapped(openOrdersQuery.data, authoritativeOpen);
  const previewLength = rows.length;
  const hasOpenOrders = (authoritativeOpen ?? 0) > 0 || previewLength > 0;

  return (
    <ManagerDashboardCard
      testId="open-orders"
      title="Open orders"
      icon="table"
      accent="warning"
      isLoading={managerQuery.isLoading}
      isError={managerQuery.isError}
      isEmpty={!managerQuery.isLoading && !managerQuery.isError && !hasOpenOrders}
      emptyMessage="No orders are open on this branch right now."
      actions={<ManagerCardActionLink href="/manager/operations">Operations</ManagerCardActionLink>}
      footnote={
        openOrdersQuery.isError
          ? "The open-order list could not be read, so no aging is shown. The count above comes from a separate endpoint and is unaffected."
          : isCapped
            ? `Aging and status cover the ${previewLength} oldest open orders — the list endpoint returns at most 50 rows, so it is a preview, not the whole branch.`
            : "Aging and status cover every open order the list endpoint returned."
      }
    >
      <ManagerCardPrimaryKpi
        kpiKey="openOrders.count"
        value={formatManagerCount(authoritativeOpen)}
        hint="Orders in NEW, SENT, IN_KITCHEN, READY or SERVED."
      />

      {openOrdersQuery.isLoading ? null : openOrdersQuery.isError ? null : (
        <>
          <ManagerBarSeries
            bars={buckets}
            title="How long open orders have been open"
            description={`Open orders grouped by age, from the ${previewLength} oldest rows the list endpoint returned.`}
          />
          <ManagerCardStatList
            rows={[
              {
                kpiKey: "openOrders.oldest",
                value: formatManagerElapsed(oldestMinutes),
                href: "/manager/operations",
              },
            ]}
          />
          {statuses.length ? (
            <p className="text-xs leading-5 text-text-secondary">
              <span className="font-semibold text-text-primary">Status of those rows:</span>{" "}
              {statuses.map((status) => `${status.label} ${status.count}`).join(" · ")}
            </p>
          ) : null}
        </>
      )}
    </ManagerDashboardCard>
  );
}
