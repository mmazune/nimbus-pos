import { useRouter } from "next/router";
import { useMemo } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingListScreen,
  AccountingReadOnlyCard,
} from "@/components/manager/accounting/shared";
import {
  ManagerBreadcrumbs,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { Badge, Card, ErrorState, LoadingState } from "@/components/ui";
import { ACCOUNTING_LIST_PAGE_SIZE, clampAccountingTake } from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingDate,
  formatAccountingMoney,
  isJournalBalanced,
  isJournalReadableInBranch,
  sumAccountingPageMoney,
  sumJournalLineAmounts,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import { JOURNAL_STATUSES, type JournalLineRow, type JournalRow } from "@/lib/accounting/types";
import { useJournalDetail, useJournalsList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/**
 * Accounting → Journal entries — Track B5.4. `GET /accounting/journals` +
 * `GET /accounting/journals/:id`, Nimbus's "General ledger" surface (there is
 * no separate general-ledger or trial-balance endpoint anywhere in the API —
 * `ACCOUNTING_OMITTED_ITEMS` already records why: NG-07 → C-11. This list
 * IS what the B5.1 dashboard's "General ledger" card counts).
 *
 * `createJournal` refuses to persist an unbalanced entry (`ledger.service.ts`
 * throws `debits ≠ credits` before it ever reaches Postgres), so every row
 * this screen can show is balanced by construction — the detail view still
 * proves it two independent ways (the journal's own stored totals, and a
 * fresh sum over its lines) rather than trusting that invariant blindly.
 */
export function JournalsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, JOURNAL_STATUSES);
  const selectedJournalId = firstManagerQueryValue(router.query.journalId);
  const { currencyCode } = useManagerBranch();

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useJournalsList({ status: status || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openJournal = (journalId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { journalId, page }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<JournalRow>[] = useMemo(
    () => [
      { key: "journalNumber", header: "Journal", render: (row) => row.journalNumber || row.id },
      { key: "journalDate", header: "Date", render: (row) => formatAccountingDate(row.journalDate) },
      {
        key: "reference",
        header: "Reference",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.reference || row.description || "—",
      },
      { key: "sourceKey", header: "Source", optional: true, defaultHidden: true, render: (row) => row.sourceKey || "Manual" },
      {
        key: "totalDebit",
        header: "Total debit",
        numeric: true,
        render: (row) => formatAccountingMoney(row.totalDebit, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.totalDebit));
          return sum === null ? "Unavailable" : formatAccountingMoney(String(sum), currencyCode);
        },
      },
      {
        key: "totalCredit",
        header: "Total credit",
        numeric: true,
        render: (row) => formatAccountingMoney(row.totalCredit, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.totalCredit));
          return sum === null ? "Unavailable" : formatAccountingMoney(String(sum), currencyCode);
        },
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
    ],
    [currencyCode],
  );

  const pager = toAccountingPager({ page, pageSize: take, total: listQuery.data?.total });

  if (selectedJournalId) {
    return (
      <JournalDetailPanel
        journalId={selectedJournalId}
        pageRows={rows}
        currencyCode={currencyCode}
        onSelectJournal={openJournal}
      />
    );
  }

  return (
    <AccountingListScreen
      title="Journal entries"
      routeKey="accounting.journals"
      search={{
        emptyHint: "This endpoint has no text search — filter by status.",
        filterChips: status ? (
          <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter journal entries"
            filters={JOURNAL_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
            activeFilterKeys={status ? [status] : []}
            onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      onSelectRow={(row) => openJournal(row.id)}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No journal entries match"
      emptyMessage="No journal entry in this branch matches the current filter."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote="Every entry here was posted balanced — createJournal refuses to persist debits ≠ credits. Journal posting, reversal and posting-run replay are performed by an Owner or Accountant; the manager role holds accounting read access only."
    />
  );
}

function JournalDetailPanel({
  currencyCode,
  journalId,
  onSelectJournal,
  pageRows,
}: {
  currencyCode: string | null;
  journalId: string;
  onSelectJournal: (id: string | null) => void;
  pageRows: readonly JournalRow[];
}) {
  const { branchId } = useManagerBranch();
  const detailQuery = useJournalDetail(journalId);
  const journal = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === journalId);
  const readableHere = journal ? isJournalReadableInBranch(journal, branchId) : true;

  const lineColumns: ManagerListColumn<JournalLineRow>[] = [
    {
      key: "account",
      header: "Account",
      render: (line) => (line.account ? `${line.account.code ? `${line.account.code} · ` : ""}${line.account.name}` : "—"),
    },
    { key: "costCenter", header: "Cost centre", optional: true, render: (line) => line.costCenter?.name || "—" },
    { key: "description", header: "Description", optional: true, hideBelowLarge: true, render: (line) => line.description || "—" },
    {
      key: "debit",
      header: "Debit",
      numeric: true,
      render: (line) => ((line.direction || "").toUpperCase() === "DEBIT" ? formatAccountingMoney(line.amount, currencyCode) : "—"),
    },
    {
      key: "credit",
      header: "Credit",
      numeric: true,
      render: (line) => ((line.direction || "").toUpperCase() === "CREDIT" ? formatAccountingMoney(line.amount, currencyCode) : "—"),
    },
  ];

  const balanced = journal ? isJournalBalanced(journal) : null;
  const lineDebitSum = journal ? sumJournalLineAmounts(journal.lines, "DEBIT") : null;
  const lineCreditSum = journal ? sumJournalLineAmounts(journal.lines, "CREDIT") : null;

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Journal entries", href: ACCOUNTING_ROUTES.journals }}
        recordLabel={journal?.journalNumber || "Journal"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectJournal(pageRows[position - 1].id),
                onNext: () => onSelectJournal(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading journal…" />
      ) : detailQuery.isError || !journal ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Journal unavailable"
            description="This journal entry could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.journals} label="Back to journal entries" />
        </div>
      ) : !readableHere ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Journal unavailable"
            description="This journal entry belongs to a different branch than the one currently selected (C-25: the backend read has no branch filter of its own on this route — the frontend refuses to display a cross-branch result rather than trust it)."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.journals} label="Back to journal entries" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={accountingStatusTone(journal.status)}>{titleCaseAccountingStatus(journal.status)}</Badge>
            <Badge variant={balanced === null ? "neutral" : balanced ? "success" : "danger"}>
              {balanced === null ? "Balance unavailable" : balanced ? "Balanced" : "Not balanced"}
            </Badge>
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                {journal.journalNumber || journal.id}
              </h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Journal date">{formatAccountingDate(journal.journalDate)}</AccountingFieldRow>
                <AccountingFieldRow label="Reference">{journal.reference || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Description">{journal.description || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Source">
                  {journal.sourceKey || "Manual"}
                  {journal.sourceDocumentId ? ` · ${journal.sourceDocumentId}` : ""}
                </AccountingFieldRow>
                <AccountingFieldRow label="Fiscal period">
                  {journal.fiscalPeriod
                    ? `${journal.fiscalPeriod.name || journal.fiscalPeriod.id} (${titleCaseAccountingStatus(journal.fiscalPeriod.status)})`
                    : "Not assigned"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Posted by">
                  {journal.postedBy
                    ? `${journal.postedBy.firstName || ""} ${journal.postedBy.lastName || ""}`.trim() || "—"
                    : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Posted at">{formatAccountingDate(journal.postedAt)}</AccountingFieldRow>
                <AccountingFieldRow label="Lines">{journal.lines?.length ?? 0}</AccountingFieldRow>
              </dl>

              {journal.reversedFrom || journal.reversalEntry ? (
                <dl className="mt-3 border-t border-border-subtle/60 pt-3">
                  {journal.reversedFrom ? (
                    <AccountingFieldRow label="Reverses">
                      <AccountingBackLink
                        href={`${ACCOUNTING_ROUTES.journals}?journalId=${journal.reversedFrom.id}`}
                        label={journal.reversedFrom.journalNumber || journal.reversedFrom.id}
                      />
                    </AccountingFieldRow>
                  ) : null}
                  {journal.reversalEntry ? (
                    <AccountingFieldRow label="Reversed by">
                      <AccountingBackLink
                        href={`${ACCOUNTING_ROUTES.journals}?journalId=${journal.reversalEntry.id}`}
                        label={journal.reversalEntry.journalNumber || journal.reversalEntry.id}
                      />
                    </AccountingFieldRow>
                  ) : null}
                </dl>
              ) : null}

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Lines{journal.lines?.length ? ` (${journal.lines.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Journal lines"
                  columns={lineColumns}
                  rows={journal.lines || []}
                  getRowId={(line) => line.id}
                  emptyTitle="No lines"
                  emptyMessage="This journal entry has no lines recorded."
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <Card className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Balance tie-out</h3>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Two independently computed figures: the journal&apos;s own stored totals, and a fresh sum over its
                  lines. The API refuses to persist a mismatch, so these should always agree.
                </p>
                <dl className="mt-3">
                  <AccountingFieldRow label="Header total debit">{formatAccountingMoney(journal.totalDebit, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Sum of debit lines">
                    {lineDebitSum === null ? "Unavailable" : formatAccountingMoney(String(lineDebitSum), currencyCode)}
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Header total credit">{formatAccountingMoney(journal.totalCredit, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Sum of credit lines">
                    {lineCreditSum === null ? "Unavailable" : formatAccountingMoney(String(lineCreditSum), currencyCode)}
                  </AccountingFieldRow>
                </dl>
              </Card>

              <AccountingReadOnlyCard
                actions={["Posting a journal entry", "reversing one", "replaying a posting run"]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
