import {
  AccountingAgingBars,
  AccountingPrimaryKpi,
  AccountingRouteScopeNote,
  AccountingStatList,
} from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import {
  formatAccountingCount,
  formatAccountingMoney,
  isArAgingComplete,
  overdueTotal,
  toArAgingBuckets,
} from "@/lib/accounting/model";
import type { ArAgingAccountRow } from "@/lib/accounting/types";
import { useArAgingReport } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";

/**
 * Reporting → Aged receivable — Track B5.2. The full-page counterpart to the
 * B5.1 dashboard's Receivable card, over the SAME `GET /accounting/ar/aging`
 * route. Post backend gap batch 3 the headline `summary.totalOutstanding` is a
 * true branch total regardless of page size (B5-F1 fixed), so
 * `isArAgingComplete()` here is a malformed-response guard only, exactly like
 * the dashboard card — kept for that purpose, not re-widened into a
 * completeness check.
 *
 * The `accounts[]` breakdown table IS still genuinely page-limited to
 * `AR_AGING_PAGE_SIZE` (100) — realistic for a single branch's customer base,
 * and the footnote says so rather than implying it is exhaustive.
 */
export function AgedReceivableScreen() {
  const { currencyCode } = useManagerBranch();
  const query = useArAgingReport();
  const data = query.data;
  const complete = isArAgingComplete(data);
  const buckets = toArAgingBuckets(data);
  const accounts = data?.accounts || [];

  const columns: ManagerListColumn<ArAgingAccountRow>[] = [
    { key: "customer", header: "Customer", render: (row) => row.customerAccountName },
    { key: "code", header: "Code", optional: true, render: (row) => row.customerAccountCode || "—" },
    { key: "invoices", header: "Open invoices", numeric: true, render: (row) => row.invoices?.length ?? 0 },
    {
      key: "totalOutstanding",
      header: "Outstanding",
      numeric: true,
      render: (row) => formatAccountingMoney(row.totalOutstanding, currencyCode),
      total: () => formatAccountingMoney(data?.summary?.totalOutstanding, currencyCode),
    },
  ];

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Aged receivable"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="ar.aging" />
          </>
        }
      />

      {query.isLoading ? (
        <LoadingState title="Loading aged receivable…" />
      ) : query.isError || !complete ? (
        <ErrorState
          title="Aged receivable unavailable"
          description="This report could not be read for the selected branch. Retry, or switch branch."
        />
      ) : (
        <>
          <div className="grid gap-5 rounded-lg bg-surface p-5 shadow-subtle sm:grid-cols-[minmax(0,1fr)_minmax(200px,0.6fr)]">
            <div>
              <AccountingPrimaryKpi
                kpiKey="ar.outstanding"
                value={formatAccountingMoney(data?.summary?.totalOutstanding, currencyCode)}
                hint="Invoiced and not yet settled, across every customer in this branch."
              />
              <div className="mt-4">
                <AccountingAgingBars
                  buckets={buckets}
                  currencyCode={currencyCode}
                  title="Receivable aging by bucket"
                  description="Outstanding customer balances grouped by how overdue they are: current, 1–30, 31–60, 61–90 and over 90 days."
                />
              </div>
            </div>
            <AccountingStatList
              rows={[
                { kpiKey: "ar.openInvoices", value: formatAccountingCount(data?.total ?? null) },
                { kpiKey: "ar.customers", value: formatAccountingCount(accounts.length) },
                {
                  kpiKey: "ar.overdue",
                  value: formatAccountingMoney(overdueTotal(buckets), currencyCode),
                  tone: (overdueTotal(buckets) ?? 0) > 0 ? "danger" : "default",
                },
              ]}
            />
          </div>

          <ManagerListTable
            caption="Receivable by customer"
            columns={columns}
            rows={accounts}
            getRowId={(row) => row.customerAccountId}
            emptyTitle="Nothing outstanding"
            emptyMessage="No customer in this branch currently carries an open balance."
            totalsLabel="This branch"
          />

          <p className="text-xs leading-5 text-text-muted">
            The headline total and per-customer breakdown both come from the same branch-scoped read.
            The customer-by-customer table is limited to the first 100 customers with a balance — a
            realistic bound for one branch, and the headline total above is correct regardless of
            whether this branch has more than that.
          </p>
        </>
      )}
    </ManagerContentShell>
  );
}
