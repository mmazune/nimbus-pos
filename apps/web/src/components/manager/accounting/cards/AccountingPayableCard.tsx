import {
  AccountingAgingBars,
  AccountingPrimaryKpi,
  AccountingRouteScopeNote,
  AccountingStatList,
} from "@/components/manager/accounting/shared";
import { ManagerDashboardCard } from "@/components/manager/dashboard/ManagerDashboardCard";
import {
  formatAccountingCount,
  formatAccountingMoney,
  overdueTotal,
  toAccountingAmount,
  toApAgingBuckets,
} from "@/lib/accounting/model";
import type { AccountingDashboardSnapshot } from "@/lib/manager/accounting-context";

/**
 * Vendors — payable. Nimbus's analogue of Odoo's **Purchases** card, minus its
 * `Upload` and `New` buttons: uploading a bill and creating one are both
 * `accounting:ap:bill:write`, which this role does not hold.
 *
 * Unlike its AR counterpart this card needs no completeness guard.
 * `getApAgingSummary` reads **every** open bill for the branch with no `take`,
 * so `buckets.total` is the branch total by construction and `billCount` counts
 * the same set. Backend gap batch 2 is what made that true per branch: the
 * aggregate previously spanned every branch while `GET /ap/bills` beneath it
 * returned one, so the screen could not be reconciled by anyone reading it.
 */
export function AccountingPayableCard({ snapshot }: { snapshot: AccountingDashboardSnapshot }) {
  const { apAgingQuery, currencyCode } = snapshot;
  const data = apAgingQuery.data;
  const buckets = toApAgingBuckets(data);
  const billCount = data?.billCount ?? null;
  const topSupplier = data?.bySupplier?.length
    ? [...data.bySupplier].sort(
        (a, b) => (toAccountingAmount(b.total) ?? 0) - (toAccountingAmount(a.total) ?? 0),
      )[0]
    : null;
  const isEmpty = !apAgingQuery.isLoading && !apAgingQuery.isError && billCount === 0;
  const overdue = overdueTotal(buckets);

  return (
    <ManagerDashboardCard
      testId="accounting-payable"
      title="Vendors — payable"
      icon="inventory"
      accent="warning"
      isLoading={apAgingQuery.isLoading}
      isError={apAgingQuery.isError}
      isEmpty={isEmpty}
      emptyMessage="No supplier bill in this branch is currently outstanding."
      actions={<AccountingRouteScopeNote routeKey="ap.aging" />}
      footnote="Open APPROVED, PARTIALLY_PAID and OVERDUE bills with a balance, aged against their due date. This report reads every matching bill for the branch, so the figures are branch totals rather than a page subtotal."
    >
      <AccountingPrimaryKpi
        kpiKey="ap.outstanding"
        value={formatAccountingMoney(data?.buckets?.total, currencyCode)}
        hint="Billed by suppliers and not yet paid."
      />
      <AccountingStatList
        rows={[
          { kpiKey: "ap.openBills", value: formatAccountingCount(billCount) },
          {
            kpiKey: "ap.overdue",
            value: formatAccountingMoney(overdue, currencyCode),
            tone: (overdue ?? 0) > 0 ? "danger" : "default",
          },
          {
            kpiKey: "ap.topSupplier",
            label: topSupplier ? topSupplier.supplierName : undefined,
            value: topSupplier
              ? formatAccountingMoney(topSupplier.total, currencyCode)
              : "Unavailable",
          },
        ]}
      />
      <AccountingAgingBars
        buckets={buckets}
        currencyCode={currencyCode}
        title="Payable aging by bucket"
        description="Outstanding supplier balances grouped by how overdue they are: current, 1–30, 31–60, 61–90 and over 90 days."
      />
    </ManagerDashboardCard>
  );
}
