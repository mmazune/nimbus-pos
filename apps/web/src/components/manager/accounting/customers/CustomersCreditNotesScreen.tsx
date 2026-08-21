import { useRouter } from "next/router";
import { useMemo } from "react";

import { AccountingListScreen } from "@/components/manager/accounting/shared";
import { ManagerFilterChip, ManagerSearchFilterMenu, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import {
  ACCOUNTING_LIST_PAGE_SIZE,
  clampAccountingTake,
} from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingDate,
  formatAccountingMoney,
  sumAccountingPageMoney,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { AR_CREDIT_NOTE_STATUSES, type ArCreditNoteRow } from "@/lib/accounting/types";
import { useArCreditNotesList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  buildManagerListQuery,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/**
 * Customers → Credit notes — Track B5.2. The Odoo C4 list view over
 * `GET /accounting/ar/credit-notes`.
 *
 * LIST ONLY: the route registry has no `ar.creditNote` singular key, so this
 * surface has no detail record — rows are not clickable and `onSelectRow` is
 * deliberately omitted from `AccountingListScreen`. This surface returned
 * `total 0` on the last live-verified branch, so the empty-state copy is what
 * most managers will actually see.
 */
export function CustomersCreditNotesScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, AR_CREDIT_NOTE_STATUSES);
  const { currencyCode } = useManagerBranch();

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useArCreditNotesList({ status: status || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ArCreditNoteRow>[] = useMemo(
    () => [
      { key: "creditNoteNumber", header: "Credit note", render: (row) => row.creditNoteNumber || row.id },
      {
        key: "customer",
        header: "Customer",
        render: (row) => row.customerAccount?.name || <span className="text-text-muted">Unknown</span>,
      },
      {
        key: "invoice",
        header: "Against invoice",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.invoice?.invoiceNumber || "—",
      },
      { key: "issueDate", header: "Issued", render: (row) => formatAccountingDate(row.issueDate) },
      {
        key: "amount",
        header: "Amount",
        numeric: true,
        optional: true,
        defaultHidden: true,
        render: (row) => formatAccountingMoney(row.amount, currencyCode),
      },
      {
        key: "remainingAmount",
        header: "Remaining",
        numeric: true,
        render: (row) => formatAccountingMoney(row.remainingAmount, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.remainingAmount));
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

  return (
    <AccountingListScreen
      title="Credit notes"
      routeKey="ar.creditNotes"
      search={{
        emptyHint: "This endpoint has no text search — filter by status.",
        filterChips: status ? (
          <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter credit notes"
            filters={AR_CREDIT_NOTE_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
            activeFilterKeys={status ? [status] : []}
            onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No credit notes"
      emptyMessage="No AR credit notes exist for this branch yet."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote={`The remaining total sums the ${rows.length} credit notes on this page only — this endpoint returns no branch aggregate.`}
    />
  );
}
