import {
  AccountingAgingBars,
  AccountingPrimaryKpi,
  AccountingRouteScopeNote,
  AccountingStatList,
} from "@/components/manager/accounting/shared";
import { ManagerDashboardCard } from "@/components/manager/dashboard/ManagerDashboardCard";
import {
  AR_AGING_PAGE_SIZE,
  formatAccountingCount,
  formatAccountingMoney,
  isArAgingComplete,
  overdueTotal,
  toArAgingBuckets,
} from "@/lib/accounting/model";
import type { AccountingDashboardSnapshot } from "@/lib/manager/accounting-context";

/**
 * Customers — receivable. Nimbus's honest analogue of Odoo's **Sales** card
 * (screenshots 02/16): title, a money headline, count rows, and a bucketed bar
 * mark. Odoo's `New` button is deliberately absent — see the module docblock.
 *
 * 🔴 **B5-F1, and the reason this card has a state the others do not.**
 * `GET /ar/aging` aggregates `summary` over the RETURNED PAGE, not over the
 * whole `where` clause. Measured live on 2026-08-21: `?take=1` reports
 * `total: 5` beside `summary.totalOutstanding: 599,800`, where the true branch
 * figure is `9,106,400`. So this card asks for a bounded page of
 * {@link AR_AGING_PAGE_SIZE}, then checks whether that page carried every
 * matching invoice. If it did not, **no money is shown at all** — an
 * understated receivable balance is worse than an admitted gap, and B4-D1's
 * lesson was precisely that a plausible wrong number survives review while a
 * missing one does not.
 *
 * Its AP counterpart needs no such guard: that endpoint is unpaged.
 */
export function AccountingReceivableCard({ snapshot }: { snapshot: AccountingDashboardSnapshot }) {
  const { arAgingQuery, currencyCode } = snapshot;
  const data = arAgingQuery.data;
  const complete = isArAgingComplete(data);
  const buckets = toArAgingBuckets(data);
  const openInvoices = data?.total ?? null;
  const isEmpty = !arAgingQuery.isLoading && !arAgingQuery.isError && complete && openInvoices === 0;

  /**
   * The footnote has to name the RIGHT reason.
   *
   * `complete` is false both when the page is genuinely partial and when there
   * is no response at all, so keying the copy off it alone made a failed read
   * claim "this branch has more open invoices than the page requested" — a
   * specific, confident and wrong explanation. Caught by viewing the error-state
   * screenshot during B5.1 QA.
   */
  const footnote = arAgingQuery.isError
    ? "Aged from open ISSUED and PARTIALLY_PAID invoices. This read failed, so no balance is shown at all."
    : complete
      ? `Open ISSUED and PARTIALLY_PAID invoices with a balance, aged against their due date. Requested ${AR_AGING_PAGE_SIZE} accounts and the branch fits inside that page, so these are branch totals.`
      : `The aging endpoint totals only the page it returns, and this branch has more open invoices than the ${AR_AGING_PAGE_SIZE}-account page requested. No balance is shown rather than an understated one.`;

  return (
    <ManagerDashboardCard
      testId="accounting-receivable"
      title="Customers — receivable"
      icon="revenue"
      accent="success"
      isLoading={arAgingQuery.isLoading}
      isError={arAgingQuery.isError}
      isEmpty={isEmpty}
      emptyMessage="No customer invoice in this branch is currently outstanding."
      actions={<AccountingRouteScopeNote routeKey="ar.aging" />}
      footnote={footnote}
    >
      {complete ? (
        <>
          <AccountingPrimaryKpi
            kpiKey="ar.outstanding"
            value={formatAccountingMoney(data?.summary?.totalOutstanding, currencyCode)}
            hint="Invoiced and not yet settled."
          />
          <AccountingStatList
            rows={[
              { kpiKey: "ar.openInvoices", value: formatAccountingCount(openInvoices) },
              {
                kpiKey: "ar.customers",
                value: formatAccountingCount(data?.accounts?.length ?? null),
              },
              {
                kpiKey: "ar.overdue",
                value: formatAccountingMoney(overdueTotal(buckets), currencyCode),
                // Red only when something is actually late — a branch with no
                // overdue balance is good news, not a warning.
                tone: (overdueTotal(buckets) ?? 0) > 0 ? "danger" : "default",
              },
            ]}
          />
          <AccountingAgingBars
            buckets={buckets}
            currencyCode={currencyCode}
            title="Receivable aging by bucket"
            description="Outstanding customer balances grouped by how overdue they are: current, 1–30, 31–60, 61–90 and over 90 days."
          />
        </>
      ) : (
        <div data-accounting-partial="ar-aging" className="flex flex-1 flex-col gap-2">
          <p className="text-sm font-semibold text-status-warning">
            Receivable balance withheld
          </p>
          <p className="text-sm text-text-secondary">
            This branch reports {formatAccountingCount(openInvoices, "an unknown number of")} open
            invoices, more than the aging report totals in one page. Showing the page&apos;s subtotal
            as a branch balance would understate it.
          </p>
        </div>
      )}
    </ManagerDashboardCard>
  );
}
