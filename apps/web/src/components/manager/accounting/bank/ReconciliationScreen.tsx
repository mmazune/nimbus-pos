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
  ManagerStatusPipeline,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import {
  accountingStatusTone,
  formatAccountingCount,
  formatAccountingDate,
  formatAccountingMoney,
  isReconciliationBalanced,
  reconciliationPipelineIndex,
  RECONCILIATION_PIPELINE,
  titleCaseAccountingStatus,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import {
  BANK_RECONCILIATION_STATUSES,
  type BankReconciliationRow,
  type BankStatementLineRow,
} from "@/lib/accounting/types";
import { useBankReconciliationDetail, useBankReconciliationsList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { buildManagerListQuery, firstManagerQueryValue, readManagerEnum } from "@/lib/manager/accounting-route";

const RECONCILIATION_PIPELINE_LABELS = RECONCILIATION_PIPELINE.map(titleCaseAccountingStatus);

/**
 * Bank → Reconciliation — Track B5.3. `GET /accounting/reconciliation` +
 * `GET /accounting/reconciliation/:id`. Nimbus's honest analogue of Odoo's
 * match/skip/complete workbench, rendered entirely READ-ONLY: Manager holds
 * `pos:accounting:reconciliation:read` but neither `:match` nor `:create`
 * (PC-01), so there is no Match / Skip / Complete control anywhere on this
 * surface — `AccountingReadOnlyCard` names those three actions instead of
 * showing a disabled button for any of them.
 *
 * PC-06 applies to the list the same way it does to bank-statements: a bare
 * array, no server total, no server-side status filter — the status chip
 * filters the already-fetched complete array client-side.
 */
export function ReconciliationScreen() {
  const router = useRouter();
  const status = readManagerEnum(router.query.status, BANK_RECONCILIATION_STATUSES);
  const selectedReconciliationId = firstManagerQueryValue(router.query.reconciliationId);
  const { currencyCode } = useManagerBranch();

  const listQuery = useBankReconciliationsList();
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

  const openReconciliation = (reconciliationId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { reconciliationId }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<BankReconciliationRow>[] = useMemo(
    () => [
      { key: "bankAccount", header: "Bank account", render: (row) => row.bankAccount?.name || "—" },
      { key: "bankStatement", header: "Statement", optional: true, render: (row) => row.bankStatement?.reference || "—" },
      {
        key: "statementBalance",
        header: "Statement balance",
        numeric: true,
        optional: true,
        render: (row) => formatAccountingMoney(row.statementBalance, currencyCode),
      },
      {
        key: "matchedTotal",
        header: "Matched",
        numeric: true,
        render: (row) => formatAccountingMoney(row.matchedTotal, currencyCode),
      },
      {
        key: "unmatchedCount",
        header: "Unmatched lines",
        numeric: true,
        render: (row) => formatAccountingCount(row.unmatchedCount ?? null),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
    ],
    [currencyCode],
  );

  if (selectedReconciliationId) {
    return (
      <ReconciliationDetailPanel
        reconciliationId={selectedReconciliationId}
        pageRows={rows}
        onSelectReconciliation={openReconciliation}
      />
    );
  }

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Reconciliation"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="bank.reconciliations" />
          </>
        }
        search={{
          emptyHint: "This endpoint has no text search — filter by status.",
          filterChips: status ? (
            <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
          ) : null,
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter reconciliations"
              filters={BANK_RECONCILIATION_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
            />
          ),
        }}
      />

      <ManagerListTable
        caption="Reconciliations"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        onSelectRow={(row) => openReconciliation(row.id)}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Reconciliations could not be read for the selected branch. Retry, or change the filters."
        emptyTitle="No reconciliations match"
        emptyMessage="No bank reconciliation in this branch matches the current filter."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={unpaginatedCountLabel(totalCount, "reconciliations")} />{" "}
        {status
          ? "The status filter is applied in the browser over the complete branch result — this endpoint accepts no server-side status parameter."
          : null}
      </p>

      <AccountingReadOnlyCard
        actions={["Starting a reconciliation", "matching or skipping a statement line", "completing a reconciliation"]}
      />
    </ManagerContentShell>
  );
}

function ReconciliationDetailPanel({
  onSelectReconciliation,
  pageRows,
  reconciliationId,
}: {
  onSelectReconciliation: (id: string | null) => void;
  pageRows: readonly BankReconciliationRow[];
  reconciliationId: string;
}) {
  const { currencyCode } = useManagerBranch();
  const detailQuery = useBankReconciliationDetail(reconciliationId);
  const rec = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === reconciliationId);
  const pipelineIndex = reconciliationPipelineIndex(rec?.status);
  const balanced = isReconciliationBalanced(rec?.difference);
  const lines = rec?.bankStatement?.lines || [];

  const lineColumns: ManagerListColumn<BankStatementLineRow>[] = [
    { key: "txDate", header: "Date", render: (line) => formatAccountingDate(line.txDate) },
    { key: "description", header: "Description", render: (line) => line.description || "—" },
    {
      key: "direction",
      header: "Direction",
      render: (line) => (line.direction ? titleCaseAccountingStatus(line.direction) : "—"),
    },
    { key: "amount", header: "Amount", numeric: true, render: (line) => formatAccountingMoney(line.amount, currencyCode) },
    {
      key: "matchEvidence",
      header: "Matched via",
      render: (line) => {
        if (line.status !== "MATCHED") return "—";
        if (line.matchedJournalLineId) return "Journal line";
        if (line.matchedManualEntryId) return "Manual entry";
        return "—";
      },
    },
    { key: "matchedAt", header: "Matched", optional: true, render: (line) => formatAccountingDate(line.matchedAt) },
    {
      key: "status",
      header: "State",
      render: (line) => <Badge variant={accountingStatusTone(line.status)}>{titleCaseAccountingStatus(line.status)}</Badge>,
    },
  ];

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Reconciliation", href: ACCOUNTING_ROUTES.bankReconciliation }}
        recordLabel={rec?.bankAccount?.name ? `Reconciliation — ${rec.bankAccount.name}` : "Reconciliation"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectReconciliation(pageRows[position - 1].id),
                onNext: () => onSelectReconciliation(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading reconciliation…" />
      ) : detailQuery.isError || !rec ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Reconciliation unavailable"
            description="This reconciliation could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.bankReconciliation} label="Back to reconciliation" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ManagerStatusPipeline
              ariaLabel="Reconciliation lifecycle"
              stages={RECONCILIATION_PIPELINE_LABELS}
              currentIndex={pipelineIndex}
              exitLabel={`${titleCaseAccountingStatus(rec.status)} — left the reconciliation lifecycle`}
              exitTone="warning"
            />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                {rec.bankAccount?.name || "Bank account"}
              </h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Statement">{rec.bankStatement?.reference || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Fiscal period">{rec.fiscalPeriod?.name || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Started by">
                  {rec.startedBy ? `${rec.startedBy.firstName || ""} ${rec.startedBy.lastName || ""}`.trim() || "—" : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Completed by">
                  {rec.completedBy
                    ? `${rec.completedBy.firstName || ""} ${rec.completedBy.lastName || ""}`.trim() || "—"
                    : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Started">{formatAccountingDate(rec.createdAt)}</AccountingFieldRow>
                <AccountingFieldRow label="Completed">{formatAccountingDate(rec.completedAt)}</AccountingFieldRow>
              </dl>

              {rec.notes ? <p className="mt-3 text-sm leading-6 text-text-secondary">{rec.notes}</p> : null}

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Statement lines{lines.length ? ` (${lines.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Reconciliation statement lines"
                  columns={lineColumns}
                  rows={lines}
                  getRowId={(line) => line.id}
                  emptyTitle="No lines"
                  emptyMessage="This reconciliation has no linked statement, or its statement has no lines."
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Balance</h3>
                <dl className="mt-3">
                  <AccountingFieldRow label="Statement balance">
                    {formatAccountingMoney(rec.statementBalance, currencyCode)}
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Matched total">
                    {formatAccountingMoney(rec.matchedTotal, currencyCode)}
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Difference">
                    <span
                      className={
                        balanced === true
                          ? "text-status-success"
                          : balanced === false
                            ? "text-status-warning"
                            : undefined
                      }
                    >
                      {formatAccountingMoney(rec.difference, currencyCode)}
                    </span>
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Matched / Unmatched lines">
                    {formatAccountingCount(rec.matchedCount ?? null)} / {formatAccountingCount(rec.unmatchedCount ?? null)}
                  </AccountingFieldRow>
                </dl>
                {balanced === false ? (
                  <p className="mt-3 text-xs leading-5 text-text-secondary">
                    Completion requires this difference to be exactly zero — a non-zero difference is the endpoint
                    working as designed, not a defect, until every line is matched or skipped.
                  </p>
                ) : null}
              </div>

              <AccountingReadOnlyCard
                actions={["Matching or skipping a statement line", "completing this reconciliation"]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
