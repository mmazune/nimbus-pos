import { useRouter } from "next/router";
import { useMemo } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingListScreen,
  AccountingReadOnlyCard,
} from "@/components/manager/accounting/shared";
import { ManagerBreadcrumbs, ManagerListTable, ManagerSearchFilterMenu, ManagerFilterChip, ManagerStatusPipeline, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import {
  ACCOUNTING_LIST_PAGE_SIZE,
  clampAccountingTake,
} from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingCount,
  formatAccountingDate,
  formatAccountingMoney,
  sumAccountingPageMoney,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import { AP_BILL_STATUSES, type ApBillLine, type ApBillRow } from "@/lib/accounting/types";
import { useApBillDetail, useApBillsList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/**
 * Vendors → Bills — Track B5.2. The Odoo C4/C5 list+form pair over
 * `GET /accounting/ap/bills` and `GET /accounting/ap/bills/:id`, and AP's
 * direct analogue of `CustomersInvoicesScreen`.
 *
 * `status` is validated against `AP_BILL_STATUSES` before it ever reaches the
 * URL or the request — this set includes `OVERDUE`, a value AR's
 * `InvoiceStatus` does not have, which is fine because this screen only ever
 * reads/writes `AP_BILL_STATUSES`.
 */
export function VendorsBillsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, AP_BILL_STATUSES);
  const selectedBillId = firstManagerQueryValue(router.query.billId);
  const { currencyCode } = useManagerBranch();

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useApBillsList({ status: status || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openBill = (billId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { billId, page }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ApBillRow>[] = useMemo(
    () => [
      { key: "billNumber", header: "Bill", render: (row) => row.billNumber || row.id },
      {
        key: "supplier",
        header: "Supplier",
        render: (row) => row.supplier?.name || <span className="text-text-muted">Unknown</span>,
      },
      { key: "billDate", header: "Billed", optional: true, hideBelowLarge: true, render: (row) => formatAccountingDate(row.billDate) },
      { key: "dueDate", header: "Due", render: (row) => formatAccountingDate(row.dueDate) },
      {
        key: "totalAmount",
        header: "Total",
        numeric: true,
        optional: true,
        defaultHidden: true,
        render: (row) => formatAccountingMoney(row.totalAmount, currencyCode),
      },
      {
        key: "outstandingAmount",
        header: "Outstanding",
        numeric: true,
        render: (row) => formatAccountingMoney(row.outstandingAmount, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.outstandingAmount));
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

  if (selectedBillId) {
    return (
      <VendorBillDetailPanel
        billId={selectedBillId}
        pageRows={rows}
        currencyCode={currencyCode}
        onClose={() => openBill(null)}
        onSelectBill={openBill}
      />
    );
  }

  return (
    <AccountingListScreen
      title="Bills"
      routeKey="ap.bills"
      search={{
        emptyHint: "This endpoint has no text search — filter by status.",
        filterChips: status ? (
          <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter bills"
            filters={AP_BILL_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
            activeFilterKeys={status ? [status] : []}
            onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      onSelectRow={(row) => openBill(row.id)}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No bills match"
      emptyMessage="No vendor bills in this branch match the current filters."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote={`The outstanding total sums the ${rows.length} bills on this page only — this endpoint returns no branch aggregate. For the branch total, see Aged payable.`}
    />
  );
}

const AP_BILL_PIPELINE = ["DRAFT", "APPROVED", "PARTIALLY_PAID", "PAID"] as const;

function VendorBillDetailPanel({
  currencyCode,
  billId,
  onClose,
  onSelectBill,
  pageRows,
}: {
  currencyCode: string | null;
  billId: string;
  onClose: () => void;
  onSelectBill: (id: string) => void;
  pageRows: readonly ApBillRow[];
}) {
  const detailQuery = useApBillDetail(billId);
  const bill = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === billId);

  const pipelineIndex = bill
    ? (AP_BILL_PIPELINE as readonly string[]).indexOf((bill.status || "").toUpperCase())
    : -1;

  const lineColumns: ManagerListColumn<ApBillLine>[] = [
    { key: "description", header: "Item", render: (line) => line.description || "—" },
    {
      key: "quantity",
      header: "Qty",
      numeric: true,
      render: (line) => (line.quantity === null || line.quantity === undefined ? "—" : String(line.quantity)),
    },
    { key: "unitPrice", header: "Unit", numeric: true, render: (line) => formatAccountingMoney(line.unitPrice, currencyCode) },
    { key: "lineTotal", header: "Line total", numeric: true, render: (line) => formatAccountingMoney(line.lineTotal, currencyCode) },
  ];

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Bills", href: ACCOUNTING_ROUTES.vendorBills }}
        recordLabel={bill?.billNumber || "Bill"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectBill(pageRows[position - 1].id),
                onNext: () => onSelectBill(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading bill…" />
      ) : detailQuery.isError || !bill ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Bill unavailable"
            description="This bill could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.vendorBills} label="Back to bills" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={accountingStatusTone(bill.status)}>{titleCaseAccountingStatus(bill.status)}</Badge>
            <ManagerStatusPipeline
              ariaLabel="Bill lifecycle"
              stages={AP_BILL_PIPELINE.map(titleCaseAccountingStatus)}
              currentIndex={pipelineIndex}
              exitLabel={`${titleCaseAccountingStatus(bill.status)} — left the bill lifecycle`}
            />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{bill.billNumber}</h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Supplier">{bill.supplier?.name || "Unknown"}</AccountingFieldRow>
                <AccountingFieldRow label="Supplier code">{bill.supplier?.code || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Bill date">{formatAccountingDate(bill.billDate)}</AccountingFieldRow>
                <AccountingFieldRow label="Due">{formatAccountingDate(bill.dueDate)}</AccountingFieldRow>
                <AccountingFieldRow label="Approved by">
                  {bill.approvedBy ? `${bill.approvedBy.firstName || ""} ${bill.approvedBy.lastName || ""}`.trim() || "—" : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Lines">{bill.lines?.length ?? 0}</AccountingFieldRow>
              </dl>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Bill lines{bill.lines?.length ? ` (${bill.lines.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Bill lines"
                  columns={lineColumns}
                  rows={bill.lines || []}
                  getRowId={(line) => line.id}
                  emptyTitle="No lines"
                  emptyMessage="This bill has no lines recorded."
                />
              </div>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Payment history{bill.paymentAllocs?.length ? ` (${bill.paymentAllocs.length})` : ""}
              </h3>
              <dl className="mt-2">
                {bill.paymentAllocs?.length ? (
                  bill.paymentAllocs.map((alloc, index) => (
                    <AccountingFieldRow key={alloc.id || index} label={alloc.vendorPayment?.paymentNumber || "Payment"}>
                      {formatAccountingMoney(alloc.vendorPayment?.amount, currencyCode)} ·{" "}
                      {formatAccountingDate(alloc.vendorPayment?.paymentDate)} ·{" "}
                      {titleCaseAccountingStatus(alloc.vendorPayment?.status)}
                    </AccountingFieldRow>
                  ))
                ) : (
                  <p className="py-2 text-sm text-text-muted">No payment has been recorded against this bill.</p>
                )}
              </dl>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Totals</h3>
                <dl className="mt-3">
                  <AccountingFieldRow label="Total">{formatAccountingMoney(bill.totalAmount, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Outstanding">
                    <span className="text-lg">{formatAccountingMoney(bill.outstandingAmount, currencyCode)}</span>
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Payments applied">{formatAccountingCount(bill._count?.paymentAllocs ?? null)}</AccountingFieldRow>
                </dl>
              </div>

              <AccountingReadOnlyCard
                actions={["Creating or approving a vendor bill", "Recording a supplier payment"]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
