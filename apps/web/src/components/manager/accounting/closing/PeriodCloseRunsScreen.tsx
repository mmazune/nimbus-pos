import { useMemo } from "react";

import { AccountingPeriodCloseRunStatusBadge, AccountingReadOnlyNote, AccountingRouteScopeNote, AccountingUnpaginatedNote } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import { formatAccountingDate, formatAccountingMoney, toPeriodCloseRunStatus, unpaginatedCountLabel } from "@/lib/accounting/model";
import type { PeriodCloseRunRow } from "@/lib/accounting/types";
import { usePeriodCloseRunsList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";

/**
 * Accounting → Period close runs — Track B5.5 (Closing). `GET /accounting/period-close-runs`.
 *
 * List-only, same shape as Fiscal periods and B5.4's Posting runs: there is no
 * `GET /period-close-runs/:id` anywhere in the API, so there is no detail
 * route to promise and no `?runId=` state here.
 *
 * ⚠️ **ORGANISATION DATA.** `PeriodCloseRun.branchId` is a real, non-null
 * column on the Prisma model, but `closeFiscalPeriod()` (`bank-rec.service.ts`)
 * never sets it on the row it creates — every close run this backend has ever
 * produced carries `branchId: null`. Batch 2 ruled this org-level BY DESIGN
 * because the column is never stamped, not because it does not exist; the
 * scope badge and footnote say so.
 *
 * 🔴 **B5.5-F1 (new finding, this pass, not implemented — out of scope for a
 * frontend-only phase): `PeriodCloseRunStatus.FAILED` and `.PENDING` are
 * UNREACHABLE through the live API.** `closeFiscalPeriod()`'s own transaction
 * always creates the run with `status: 'COMPLETED'` — there is no branch in
 * that method that persists `FAILED`, and no code anywhere writes `PENDING`
 * (the Prisma `@default(PENDING)` is a schema default this create call always
 * overrides). A close attempt that cannot proceed throws a `ConflictException`
 * / `NotFoundException` BEFORE any `PeriodCloseRun` row exists at all — so
 * there is no way to observe a failed run, only a refused request. The status
 * badge still renders all three enum members and fails closed on anything
 * else, because the enum member existing is not the same claim as this UI
 * having produced one through the API.
 */
export function PeriodCloseRunsScreen() {
  const { currencyCode } = useManagerBranch();
  const listQuery = usePeriodCloseRunsList();
  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  const columns: ManagerListColumn<PeriodCloseRunRow>[] = useMemo(
    () => [
      { key: "fiscalPeriod", header: "Fiscal period", render: (row) => row.fiscalPeriod?.name || "—" },
      { key: "closedAt", header: "Closed", render: (row) => formatAccountingDate(row.closedAt) },
      {
        key: "closedBy",
        header: "Closed by",
        optional: true,
        render: (row) =>
          row.closedBy ? `${row.closedBy.firstName || ""} ${row.closedBy.lastName || ""}`.trim() || "—" : "—",
      },
      {
        key: "incomeTotal",
        header: "Income",
        numeric: true,
        optional: true,
        render: (row) => formatAccountingMoney(row.incomeTotal, currencyCode),
      },
      {
        key: "expenseTotal",
        header: "Expense",
        numeric: true,
        optional: true,
        render: (row) => formatAccountingMoney(row.expenseTotal, currencyCode),
      },
      {
        key: "retainedEarningsAmount",
        header: "Retained earnings",
        numeric: true,
        render: (row) => formatAccountingMoney(row.retainedEarningsAmount, currencyCode),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <AccountingPeriodCloseRunStatusBadge status={toPeriodCloseRunStatus(row.status)} />,
      },
      {
        key: "failureReason",
        header: "Failure reason",
        optional: true,
        defaultHidden: true,
        render: (row) => row.failureReason || "—",
      },
      { key: "notes", header: "Notes", optional: true, defaultHidden: true, render: (row) => row.notes || "—" },
    ],
    [currencyCode],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Period close runs"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="accounting.periodCloseRuns" />
          </>
        }
      />

      <ManagerListTable
        caption="Period close runs"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Period close runs could not be read for this organisation. Retry."
        emptyTitle="No period close runs"
        emptyMessage="No fiscal period has been closed for this organisation yet."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={unpaginatedCountLabel(count, "close runs")} /> Period close runs are
        organisation-wide on this backend — the close path never records which branch triggered a
        close, so this list is identical under every branch. Every row here reads Completed: the
        close endpoint either succeeds and creates a Completed run, or refuses the request outright
        with no run created at all — this backend has no code path that ever writes a Failed or
        Pending row (B5.5-F1).{" "}
        <AccountingReadOnlyNote actions={["Closing a fiscal period"]} />
      </p>
    </ManagerContentShell>
  );
}
