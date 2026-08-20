import { useMemo } from "react";

import {
  ManagerCardActionLink,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import { ManagerDonutChart } from "@/components/manager/dashboard/ManagerDashboardCharts";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import {
  formatManagerMoney,
  formatSharePercent,
  getManagerKpiBinding,
  toPaymentMixSlices,
} from "@/lib/manager/dashboard-model";

/**
 * Payment mix — the one card whose data genuinely supports a composition mark.
 *
 * `GET /api/dash/payment-mix` returns three method sums **and** the total the
 * backend itself computed, so the ring is a real part-of-whole, not a client-side
 * inference. `MOMO` is a single backend enum covering MTN and Airtel; the split
 * does not exist server-side, so the label says "Mobile money" and nothing implies
 * a per-provider breakdown.
 *
 * Empty state is truthful: a branch with no completed payments today shows
 * "No completed payments recorded today", not an empty ring at 0%.
 */
export function ManagerPaymentMixCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { currencyCode, paymentMixQuery } = snapshot;

  const { slices, total } = useMemo(
    () => toPaymentMixSlices(paymentMixQuery.data),
    [paymentMixQuery.data],
  );

  const donutSlices = slices.map((slice) => ({
    key: slice.key,
    // Resolving the label through the registry is what proves the slice is backed
    // by a verified field — an unregistered method key throws rather than renders.
    label: getManagerKpiBinding(`payments.${slice.key}`).label,
    value: slice.amount,
    display: formatManagerMoney(slice.amount, currencyCode),
    share: slice.share,
    shareDisplay: formatSharePercent(slice.share),
  }));

  const totalDisplay = formatManagerMoney(total, currencyCode);
  const description = slices
    .map((slice) => `${slice.label}: ${formatManagerMoney(slice.amount, currencyCode)} (${formatSharePercent(slice.share)})`)
    .join("; ");

  return (
    <ManagerDashboardCard
      testId="payment-mix"
      title="Payment mix"
      icon="cashierTill"
      accent="success"
      isLoading={paymentMixQuery.isLoading}
      isError={paymentMixQuery.isError}
      isEmpty={!paymentMixQuery.isLoading && !paymentMixQuery.isError && (total ?? 0) <= 0}
      emptyMessage="No completed payments have been recorded for this branch today."
      actions={<ManagerCardActionLink href="/manager/reports">Reports</ManagerCardActionLink>}
      footnote="Completed payments only. Mobile money is one backend method covering MTN and Airtel — this backend does not split them."
    >
      <ManagerDonutChart
        slices={donutSlices}
        title="Payment mix today"
        description={description || "No payment methods recorded."}
        centerLabel={getManagerKpiBinding("payments.total").label}
        centerValue={totalDisplay}
      />
    </ManagerDashboardCard>
  );
}
