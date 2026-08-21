import { useRouter } from "next/router";
import { useMemo } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingReadOnlyCard,
  AccountingRouteScopeNote,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import {
  ManagerBreadcrumbs,
  ManagerContentShell,
  ManagerControlPanel,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import {
  accountingStatusTone,
  formatAccountingDate,
  formatAccountingMoney,
  titleCaseAccountingStatus,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import { BANK_STATEMENT_STATUSES, type BankStatementLineRow, type BankStatementRow } from "@/lib/accounting/types";
import { useBankStatementDetail, useBankStatementsList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { buildManagerListQuery, firstManagerQueryValue, readManagerEnum } from "@/lib/manager/accounting-route";

/**
 * Bank → Bank statements — Track B5.3. `GET /accounting/bank-statements` +
 * `GET /accounting/bank-statements/:id`.
 *
 * PC-06: the list is a bare array with no server total and no server-side
 * status filter (`?bankAccountId=` is the only accepted query param — this
 * screen does not narrow by account, since the demo fixture is one branch's
 * complete set either way). The status chip filters the already-fetched
 * complete array CLIENT-side, same "fetch it all, count it honestly" rule
 * PC-06 uses everywhere else — never forwarded to the server as an
 * unsupported query param.
 */
export function BankStatementsScreen() {
  const router = useRouter();
  const status = readManagerEnum(router.query.status, BANK_STATEMENT_STATUSES);
  const selectedStatementId = firstManagerQueryValue(router.query.statementId);
  const { currencyCode } = useManagerBranch();

  const listQuery = useBankStatementsList();
  const allRows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const rows = useMemo(
    () => (status ? allRows.filter((row) => (row.status || "").toUpperCase() === status) : allRows),
    [allRows, status],
  );
  const totalCount = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openStatement = (statementId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { statementId }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<BankStatementRow>[] = useMemo(
    () => [
      { key: "statementDate", header: "Statement date", render: (row) => formatAccountingDate(row.statementDate) },
      { key: "bankAccount", header: "Bank account", render: (row) => row.bankAccount?.name || "—" },
      { key: "reference", header: "Reference", optional: true, render: (row) => row.reference || "—" },
      {
        key: "openingBalance",
        header: "Opening",
        numeric: true,
        optional: true,
        defaultHidden: true,
        render: (row) => formatAccountingMoney(row.openingBalance, currencyCode),
      },
      {
        key: "closingBalance",
        header: "Closing",
        numeric: true,
        render: (row) => formatAccountingMoney(row.closingBalance, currencyCode),
      },
      {
        key: "lineCount",
        header: "Lines",
        numeric: true,
        optional: true,
        render: (row) => String(row._count?.lines ?? "—"),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
    ],
    [currencyCode],
  );

  if (selectedStatementId) {
    return <BankStatementDetailPanel statementId={selectedStatementId} pageRows={rows} onSelectStatement={openStatement} />;
  }

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Bank statements"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="bank.statements" />
          </>
        }
        search={{
          emptyHint: "This endpoint has no text search — filter by status.",
          filterChips: status ? (
            <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
          ) : null,
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter bank statements"
              filters={BANK_STATEMENT_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
            />
          ),
        }}
      />

      <ManagerListTable
        caption="Bank statements"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        onSelectRow={(row) => openStatement(row.id)}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Bank statements could not be read for the selected branch. Retry, or change the filters."
        emptyTitle="No statements match"
        emptyMessage="No bank statement in this branch matches the current filter."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote
          label={unpaginatedCountLabel(totalCount, "statements")}
        />{" "}
        {status
          ? `The status filter is applied in the browser over the complete branch result — this endpoint accepts no server-side status parameter.`
          : null}
      </p>
    </ManagerContentShell>
  );
}

function BankStatementDetailPanel({
  onSelectStatement,
  pageRows,
  statementId,
}: {
  onSelectStatement: (id: string | null) => void;
  pageRows: readonly BankStatementRow[];
  statementId: string;
}) {
  const { currencyCode } = useManagerBranch();
  const detailQuery = useBankStatementDetail(statementId);
  const statement = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === statementId);

  const lineColumns: ManagerListColumn<BankStatementLineRow>[] = [
    { key: "txDate", header: "Date", render: (line) => formatAccountingDate(line.txDate) },
    { key: "description", header: "Description", render: (line) => line.description || "—" },
    { key: "reference", header: "Reference", optional: true, render: (line) => line.reference || "—" },
    {
      key: "direction",
      header: "Direction",
      render: (line) => (line.direction ? titleCaseAccountingStatus(line.direction) : "—"),
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      render: (line) => formatAccountingMoney(line.amount, currencyCode),
    },
    {
      key: "status",
      header: "Match state",
      render: (line) => <Badge variant={accountingStatusTone(line.status)}>{titleCaseAccountingStatus(line.status)}</Badge>,
    },
  ];

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Bank statements", href: ACCOUNTING_ROUTES.bankStatements }}
        recordLabel={statement?.reference || "Statement"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectStatement(pageRows[position - 1].id),
                onNext: () => onSelectStatement(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading statement…" />
      ) : detailQuery.isError || !statement ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Statement unavailable"
            description="This bank statement could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.bankStatements} label="Back to bank statements" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={accountingStatusTone(statement.status)}>{titleCaseAccountingStatus(statement.status)}</Badge>
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                {statement.reference || statement.id}
              </h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Bank account">{statement.bankAccount?.name || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Account code">{statement.bankAccount?.accountCode || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Statement date">{formatAccountingDate(statement.statementDate)}</AccountingFieldRow>
                <AccountingFieldRow label="Period">
                  {formatAccountingDate(statement.periodStart)} – {formatAccountingDate(statement.periodEnd)}
                </AccountingFieldRow>
                <AccountingFieldRow label="Imported by">
                  {statement.importedBy
                    ? `${statement.importedBy.firstName || ""} ${statement.importedBy.lastName || ""}`.trim() || "—"
                    : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Lines">{statement.lines?.length ?? statement._count?.lines ?? 0}</AccountingFieldRow>
              </dl>

              {statement.notes ? (
                <p className="mt-3 text-sm leading-6 text-text-secondary">{statement.notes}</p>
              ) : null}

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Lines{statement.lines?.length ? ` (${statement.lines.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Statement lines"
                  columns={lineColumns}
                  rows={statement.lines || []}
                  getRowId={(line) => line.id}
                  emptyTitle="No lines"
                  emptyMessage="This statement has no lines recorded."
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Balances</h3>
                <dl className="mt-3">
                  <AccountingFieldRow label="Opening">{formatAccountingMoney(statement.openingBalance, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Closing">
                    <span className="text-lg">{formatAccountingMoney(statement.closingBalance, currencyCode)}</span>
                  </AccountingFieldRow>
                </dl>
              </div>

              <AccountingReadOnlyCard
                actions={["Importing a bank statement", "matching, skipping or completing its reconciliation"]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
