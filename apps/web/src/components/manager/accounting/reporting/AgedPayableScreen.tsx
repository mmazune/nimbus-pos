import {
  AccountingAgingBars,
  AccountingPrimaryKpi,
  AccountingRouteScopeNote,
  AccountingStatList,
} from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import { formatAccountingCount, formatAccountingMoney, overdueTotal, toApAgingBuckets } from "@/lib/accounting/model";
import type { ApAgingSupplierRow } from "@/lib/accounting/types";
import { useApAgingReport } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";

/**
 * Reporting → Aged payable — Track B5.2. The full-page counterpart to the
 * B5.1 dashboard's Payable card, over the SAME `GET /accounting/ap/aging`
 * route. This endpoint is UNPAGED by design (reads every open bill for the
 * branch), so `buckets.total`/`bySupplier[]` need no completeness guard —
 * unlike AR, this was never a partial read.
 */
export function AgedPayableScreen() {
  const { currencyCode } = useManagerBranch();
  const query = useApAgingReport();
  const data = query.data;
  const buckets = toApAgingBuckets(data);
  const bySupplier = data?.bySupplier || [];
  const billCount = data?.billCount ?? null;

  const columns: ManagerListColumn<ApAgingSupplierRow>[] = [
    { key: "supplier", header: "Supplier", render: (row) => row.supplierName },
    {
      key: "total",
      header: "Outstanding",
      numeric: true,
      render: (row) => formatAccountingMoney(row.total, currencyCode),
      total: () => formatAccountingMoney(data?.buckets?.total, currencyCode),
    },
  ];

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Aged payable"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="ap.aging" />
          </>
        }
      />

      {query.isLoading ? (
        <LoadingState title="Loading aged payable…" />
      ) : query.isError || !data ? (
        <ErrorState
          title="Aged payable unavailable"
          description="This report could not be read for the selected branch. Retry, or switch branch."
        />
      ) : (
        <>
          <div className="grid gap-5 rounded-lg bg-surface p-5 shadow-subtle sm:grid-cols-[minmax(0,1fr)_minmax(200px,0.6fr)]">
            <div>
              <AccountingPrimaryKpi
                kpiKey="ap.outstanding"
                value={formatAccountingMoney(data.buckets?.total, currencyCode)}
                hint="Billed by suppliers and not yet paid, across every open bill in this branch."
              />
              <div className="mt-4">
                <AccountingAgingBars
                  buckets={buckets}
                  currencyCode={currencyCode}
                  title="Payable aging by bucket"
                  description="Outstanding supplier balances grouped by how overdue they are: current, 1–30, 31–60, 61–90 and over 90 days."
                />
              </div>
            </div>
            <AccountingStatList
              rows={[
                { kpiKey: "ap.openBills", value: formatAccountingCount(billCount) },
                {
                  kpiKey: "ap.overdue",
                  value: formatAccountingMoney(overdueTotal(buckets), currencyCode),
                  tone: (overdueTotal(buckets) ?? 0) > 0 ? "danger" : "default",
                },
              ]}
            />
          </div>

          <ManagerListTable
            caption="Payable by supplier"
            columns={columns}
            rows={bySupplier}
            getRowId={(row) => row.supplierId}
            emptyTitle="Nothing outstanding"
            emptyMessage="No supplier in this branch currently carries an open balance."
            totalsLabel="This branch"
          />

          <p className="text-xs leading-5 text-text-muted">
            This report reads every open APPROVED, PARTIALLY_PAID and OVERDUE bill for the branch with
            no page size — the headline total, the {formatAccountingCount(billCount, "unknown")} open
            bills it counts, and the supplier-by-supplier table below are all branch totals, not a page
            subtotal.
          </p>
        </>
      )}
    </ManagerContentShell>
  );
}
