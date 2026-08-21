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
import { AR_INVOICE_STATUSES, type ArInvoiceLine, type ArInvoiceRow } from "@/lib/accounting/types";
import { useArInvoiceDetail, useArInvoicesList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/**
 * Customers → Invoices — Track B5.2. The Odoo C4/C5 list+form pair over
 * `GET /accounting/ar/invoices` and `GET /accounting/ar/invoices/:id`.
 *
 * `status` is validated against `AR_INVOICE_STATUSES` before it ever reaches
 * the URL or the request — batch 3 made an invalid value 400 rather than 500,
 * but this screen never sends one in the first place (a hand-edited
 * `?status=OVERDUE`, a real AP value InvoiceStatus does not have, resolves to
 * "no filter" instead of being forwarded).
 */
export function CustomersInvoicesScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, AR_INVOICE_STATUSES);
  const selectedInvoiceId = firstManagerQueryValue(router.query.invoiceId);
  const { currencyCode } = useManagerBranch();

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useArInvoicesList({ status: status || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openInvoice = (invoiceId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { invoiceId, page }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ArInvoiceRow>[] = useMemo(
    () => [
      { key: "invoiceNumber", header: "Invoice", render: (row) => row.invoiceNumber || row.id },
      {
        key: "customer",
        header: "Customer",
        render: (row) => row.customerAccount?.name || <span className="text-text-muted">Unknown</span>,
      },
      { key: "invoiceDate", header: "Issued", optional: true, hideBelowLarge: true, render: (row) => formatAccountingDate(row.invoiceDate) },
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
        key: "outstandingBalance",
        header: "Outstanding",
        numeric: true,
        render: (row) => formatAccountingMoney(row.outstandingBalance, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.outstandingBalance));
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

  if (selectedInvoiceId) {
    return (
      <CustomerInvoiceDetailPanel
        invoiceId={selectedInvoiceId}
        pageRows={rows}
        currencyCode={currencyCode}
        onClose={() => openInvoice(null)}
        onSelectInvoice={openInvoice}
      />
    );
  }

  return (
    <AccountingListScreen
      title="Invoices"
      routeKey="ar.invoices"
      search={{
        emptyHint: "This endpoint has no text search — filter by status.",
        filterChips: status ? (
          <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter invoices"
            filters={AR_INVOICE_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
            activeFilterKeys={status ? [status] : []}
            onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      onSelectRow={(row) => openInvoice(row.id)}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No invoices match"
      emptyMessage="No customer invoices in this branch match the current filters."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote={`The outstanding total sums the ${rows.length} invoices on this page only — this endpoint returns no branch aggregate. For the branch total, see Aged receivable.`}
    />
  );
}

const AR_INVOICE_PIPELINE = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID"] as const;

function CustomerInvoiceDetailPanel({
  currencyCode,
  invoiceId,
  onClose,
  onSelectInvoice,
  pageRows,
}: {
  currencyCode: string | null;
  invoiceId: string;
  onClose: () => void;
  onSelectInvoice: (id: string) => void;
  pageRows: readonly ArInvoiceRow[];
}) {
  const detailQuery = useArInvoiceDetail(invoiceId);
  const invoice = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === invoiceId);

  const pipelineIndex = invoice
    ? (AR_INVOICE_PIPELINE as readonly string[]).indexOf((invoice.status || "").toUpperCase())
    : -1;

  const lineColumns: ManagerListColumn<ArInvoiceLine>[] = [
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
        parent={{ label: "Invoices", href: ACCOUNTING_ROUTES.customerInvoices }}
        recordLabel={invoice?.invoiceNumber || "Invoice"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectInvoice(pageRows[position - 1].id),
                onNext: () => onSelectInvoice(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading invoice…" />
      ) : detailQuery.isError || !invoice ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Invoice unavailable"
            description="This invoice could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.customerInvoices} label="Back to invoices" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={accountingStatusTone(invoice.status)}>{titleCaseAccountingStatus(invoice.status)}</Badge>
            <ManagerStatusPipeline
              ariaLabel="Invoice lifecycle"
              stages={AR_INVOICE_PIPELINE.map(titleCaseAccountingStatus)}
              currentIndex={pipelineIndex}
              exitLabel={`${titleCaseAccountingStatus(invoice.status)} — left the invoice lifecycle`}
            />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{invoice.invoiceNumber}</h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Customer">{invoice.customerAccount?.name || "Unknown"}</AccountingFieldRow>
                <AccountingFieldRow label="Account code">{invoice.customerAccount?.code || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Issued">{formatAccountingDate(invoice.invoiceDate)}</AccountingFieldRow>
                <AccountingFieldRow label="Due">{formatAccountingDate(invoice.dueDate)}</AccountingFieldRow>
                <AccountingFieldRow label="Issued by">
                  {invoice.issuedBy ? `${invoice.issuedBy.firstName || ""} ${invoice.issuedBy.lastName || ""}`.trim() || "—" : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Lines">{invoice.lines?.length ?? 0}</AccountingFieldRow>
              </dl>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Invoice lines{invoice.lines?.length ? ` (${invoice.lines.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Invoice lines"
                  columns={lineColumns}
                  rows={invoice.lines || []}
                  getRowId={(line) => line.id}
                  emptyTitle="No lines"
                  emptyMessage="This invoice has no lines recorded."
                />
              </div>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Receipt history{invoice.receiptAllocs?.length ? ` (${invoice.receiptAllocs.length})` : ""}
              </h3>
              <dl className="mt-2">
                {invoice.receiptAllocs?.length ? (
                  invoice.receiptAllocs.map((alloc, index) => (
                    <AccountingFieldRow key={alloc.id || index} label={alloc.receipt?.receiptNumber || "Receipt"}>
                      {formatAccountingMoney(alloc.receipt?.amount, currencyCode)} ·{" "}
                      {formatAccountingDate(alloc.receipt?.receiptDate)} ·{" "}
                      {titleCaseAccountingStatus(alloc.receipt?.status)}
                    </AccountingFieldRow>
                  ))
                ) : (
                  <p className="py-2 text-sm text-text-muted">No receipt has been recorded against this invoice.</p>
                )}
              </dl>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Totals</h3>
                <dl className="mt-3">
                  <AccountingFieldRow label="Total">{formatAccountingMoney(invoice.totalAmount, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Outstanding">
                    <span className="text-lg">{formatAccountingMoney(invoice.outstandingBalance, currencyCode)}</span>
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Receipts applied">{formatAccountingCount(invoice._count?.receiptAllocs ?? null)}</AccountingFieldRow>
                </dl>
              </div>

              <AccountingReadOnlyCard
                actions={["Issuing a customer invoice or receipt", "Applying a payment to this invoice"]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
