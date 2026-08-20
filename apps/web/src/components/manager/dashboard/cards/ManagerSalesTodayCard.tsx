import {
  ManagerCardActionLink,
  ManagerCardPrimaryKpi,
  ManagerCardStatList,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import { formatManagerMoney, toManagerAmount } from "@/lib/manager/dashboard-model";

/**
 * Sales today.
 *
 * ⚠️ MP0-10 — the single most dangerous label on this dashboard, and the one
 * place a backend fix silently inverted a shipped frontend.
 *
 * B2 was written against the pre-batch vocabulary (`netSales = SUM(order.total)`,
 * tax-inclusive; `grossSales = SUM(order.subtotal)`, ex-tax). Backend gap batch 1
 * (2026-08-20) **swapped both meanings**: `grossSales` is now `SUM(order.total)`
 * (tax-inclusive) and `netSales` is `grossSales − taxTotal` (ex-tax), restoring
 * `gross >= net`. B2's bindings were not updated with it, so this card rendered
 * the EX-tax figure under the tax-inclusive label. **B3 re-points both rows
 * (defect B3-D1).**
 *
 * Neither figure may ever be labelled a bare "Gross" or "Net"; both labels here
 * state the tax basis explicitly, and the binding registry pins each to its field.
 *
 * **No chart.** Nimbus has no bucketed revenue series on any dashboard endpoint,
 * and `/dash/snapshots` — the only candidate — is gated behind
 * `pos:dash:owner:read`, which the Manager does **not** hold. A trend line would
 * therefore have to be invented, so this card ships chartless, exactly like the
 * Odoo reference's own Salaries card.
 */
export function ManagerSalesTodayCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { currencyCode, managerQuery, todaySummaryQuery } = snapshot;
  const today = managerQuery.data?.today;
  const summary = todaySummaryQuery.data;

  // Each field falls back independently: if today-summary fails, the headline
  // from /dash/manager still renders and only the summary-backed rows say so.
  const summaryMoney = (value: Parameters<typeof formatManagerMoney>[0]) =>
    todaySummaryQuery.isError ? "Unavailable" : formatManagerMoney(value, currencyCode);

  return (
    <ManagerDashboardCard
      testId="sales-today"
      title="Sales today"
      icon="revenue"
      accent="brand"
      isLoading={managerQuery.isLoading}
      isError={managerQuery.isError}
      actions={<ManagerCardActionLink href="/manager/reports">Reports</ManagerCardActionLink>}
      footnote="Counts orders SERVED or CLOSED since midnight. The tax-inclusive figure is the sum of order totals; the ex-tax figure is that same sum less tax — neither is a bare “gross” or “net”."
    >
      <ManagerCardPrimaryKpi
        kpiKey="sales.taxInclusive"
        value={formatManagerMoney(today?.grossSales, currencyCode)}
        hint="Sum of order totals, tax included."
      />
      <ManagerCardStatList
        rows={[
          {
            kpiKey: "sales.exTax",
            value: formatManagerMoney(today?.netSales, currencyCode),
          },
          { kpiKey: "sales.tax", value: summaryMoney(summary?.taxTotal) },
          { kpiKey: "sales.discounts", value: summaryMoney(summary?.discountTotal) },
          {
            kpiKey: "sales.refunds",
            value: summaryMoney(summary?.refundsTotal),
            // Red only when there is something to flag — a day with no refunds is
            // good news, not a warning.
            tone: (toManagerAmount(summary?.refundsTotal) ?? 0) > 0 ? "danger" : "default",
          },
        ]}
      />
    </ManagerDashboardCard>
  );
}
