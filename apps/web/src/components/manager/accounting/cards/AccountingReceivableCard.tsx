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
 * ✅ **B5-F1 FIXED (backend gap batch 3, 2026-08-21).** `GET /ar/aging` used to
 * aggregate `summary` over the RETURNED PAGE, not over the whole `where`
 * clause. Measured live on 2026-08-21: `?take=1` reported `total: 5` beside
 * `summary.totalOutstanding: 599,800`, where the true branch figure was
 * `9,106,400`. The backend now computes `summary` from a separate unpaginated
 * query, so it is a true branch total regardless of `take` — proven
 * page-size-independent at `take=1`/`take=3`/unpaginated on an identical
 * 9,106,400 dataset. This card still asks for a bounded page of
 * {@link AR_AGING_PAGE_SIZE} (that bound still governs the `accounts[]`
 * per-customer display breakdown, and paginating a display list is normal),
 * but no longer withholds the headline money on a large branch — there is
 * nothing left for the page to be incomplete about as far as the balance is
 * concerned. `isArAgingComplete` is kept only as a malformed-response guard.
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
