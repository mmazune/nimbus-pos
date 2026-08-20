import {
  ManagerCardActionLink,
  ManagerCardPrimaryKpi,
  ManagerCardStatList,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import { formatManagerCount, formatManagerMoney } from "@/lib/manager/dashboard-model";

/**
 * Orders today.
 *
 * The headline counts orders the sales aggregate itself counted (status SERVED or
 * CLOSED, created today) — the same population as the money on the Sales card, so
 * the two cards cannot disagree. "Open right now" is a different population (every
 * live order regardless of when it opened) and is labelled as such; its
 * authoritative source is `/dash/manager.openOrders`, never the capped preview
 * (MP0-09).
 *
 * **No chart:** closed-today and open-now are not parts of one whole, so a stacked
 * or ringed composition of them would assert a relationship that does not exist.
 */
export function ManagerOrdersTodayCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { currencyCode, managerQuery, todaySummaryQuery } = snapshot;
  const today = managerQuery.data?.today;

  return (
    <ManagerDashboardCard
      testId="orders-today"
      title="Orders today"
      icon="operations"
      accent="info"
      isLoading={managerQuery.isLoading}
      isError={managerQuery.isError}
      actions={<ManagerCardActionLink href="/manager/operations">Operations</ManagerCardActionLink>}
      footnote="“Closed today” counts orders created and closed since midnight; “open right now” counts every live order regardless of when it started, so the two do not sum."
    >
      <ManagerCardPrimaryKpi
        kpiKey="orders.count"
        value={formatManagerCount(today?.orderCount)}
        hint="Orders that reached SERVED or CLOSED since midnight."
      />
      <ManagerCardStatList
        rows={[
          {
            kpiKey: "orders.avgValue",
            value: formatManagerMoney(today?.avgOrderValue, currencyCode),
          },
          {
            kpiKey: "orders.closed",
            value: todaySummaryQuery.isError
              ? "Unavailable"
              : formatManagerCount(todaySummaryQuery.data?.closedOrders),
            href: "/manager/operations",
          },
          {
            kpiKey: "openOrders.count",
            label: "Open right now",
            value: formatManagerCount(managerQuery.data?.openOrders),
            href: "/manager/operations",
          },
        ]}
      />
    </ManagerDashboardCard>
  );
}
