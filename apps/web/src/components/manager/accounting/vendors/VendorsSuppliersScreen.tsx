import { useRouter } from "next/router";
import { useMemo } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingListScreen,
  AccountingReadOnlyCard,
} from "@/components/manager/accounting/shared";
import { ManagerBreadcrumbs, ManagerListTable, ManagerSearchFilterMenu, ManagerFilterChip, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import {
  ACCOUNTING_LIST_PAGE_SIZE,
  clampAccountingTake,
} from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingDate,
  formatAccountingMoney,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import { AP_COUNTERPARTY_TYPES, type ApSupplierDetail, type ApSupplierRow } from "@/lib/accounting/types";
import { useApSupplierDetail, useApSuppliersList } from "@/lib/manager/accounting-surface-queries";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/**
 * Vendors → Suppliers — Track B5.2. The Odoo C4/C5 list+form pair over
 * `GET /accounting/ap/suppliers` and `GET /accounting/ap/suppliers/:id`.
 *
 * Unlike the other three B5.2 detail views, the supplier detail is NOT a flat
 * record — `GET /ap/suppliers/:id` returns `{supplier, summary, recentBills,
 * recentPayments}`, so every field below is read off the right branch of that
 * envelope rather than off a single row. There is also no lifecycle status
 * enum here (a supplier is not a document that moves through states), so this
 * screen renders an Active/Inactive `Badge` next to the title instead of
 * `ManagerStatusPipeline`.
 */
export function VendorsSuppliersScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const counterpartyType = readManagerEnum(router.query.counterpartyType, AP_COUNTERPARTY_TYPES);
  const selectedSupplierId = firstManagerQueryValue(router.query.supplierId);

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useApSuppliersList({ counterpartyType: counterpartyType || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openSupplier = (supplierId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { supplierId, page }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ApSupplierRow>[] = useMemo(
    () => [
      { key: "name", header: "Supplier", render: (row) => row.name || row.id },
      { key: "code", header: "Code", render: (row) => row.code || "—" },
      {
        key: "counterpartyType",
        header: "Type",
        optional: true,
        render: (row) => (row.counterpartyType ? titleCaseAccountingStatus(row.counterpartyType) : "—"),
      },
      { key: "contactName", header: "Contact", optional: true, hideBelowLarge: true, render: (row) => row.contactName || "—" },
      {
        key: "email",
        header: "Email",
        optional: true,
        hideBelowLarge: true,
        defaultHidden: true,
        render: (row) => row.email || "—",
      },
      {
        key: "paymentTermDays",
        header: "Terms (days)",
        numeric: true,
        optional: true,
        render: (row) => String(row.paymentTermDays ?? "—"),
      },
      {
        key: "isActive",
        header: "Active",
        render: (row) => (row.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>),
      },
    ],
    [],
  );

  const pager = toAccountingPager({ page, pageSize: take, total: listQuery.data?.total });

  if (selectedSupplierId) {
    return (
      <VendorSupplierDetailPanel
        supplierId={selectedSupplierId}
        pageRows={rows}
        onClose={() => openSupplier(null)}
        onSelectSupplier={openSupplier}
      />
    );
  }

  return (
    <AccountingListScreen
      title="Suppliers"
      routeKey="ap.suppliers"
      search={{
        emptyHint: "This endpoint has no text search — filter by counterparty type.",
        filterChips: counterpartyType ? (
          <ManagerFilterChip
            label={titleCaseAccountingStatus(counterpartyType)}
            onClear={() => patchQuery({ counterpartyType: null })}
          />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter suppliers"
            filters={AP_COUNTERPARTY_TYPES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
            activeFilterKeys={counterpartyType ? [counterpartyType] : []}
            onToggleFilter={(key) => patchQuery({ counterpartyType: counterpartyType === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      onSelectRow={(row) => openSupplier(row.id)}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No suppliers match"
      emptyMessage="No suppliers in this branch match the current filters."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote={`Showing ${rows.length} suppliers on this page. Payment terms and activation status are read directly from each supplier record.`}
    />
  );
}

function VendorSupplierDetailPanel({
  onClose,
  onSelectSupplier,
  pageRows,
  supplierId,
}: {
  onClose: () => void;
  onSelectSupplier: (id: string) => void;
  pageRows: readonly ApSupplierRow[];
  supplierId: string;
}) {
  const detailQuery = useApSupplierDetail(supplierId);
  const supplier = detailQuery.data?.supplier;
  const summary = detailQuery.data?.summary;
  const recentBills = detailQuery.data?.recentBills || [];
  const recentPayments = detailQuery.data?.recentPayments || [];
  const position = pageRows.findIndex((row) => row.id === supplierId);
  const currencyCode = summary?.currencyCode ?? null;

  const recentBillColumns: ManagerListColumn<ApSupplierDetail["recentBills"][number]>[] = [
    { key: "billNumber", header: "Bill", render: (row) => row.billNumber || row.id },
    { key: "billDate", header: "Billed", render: (row) => formatAccountingDate(row.billDate) },
    { key: "dueDate", header: "Due", render: (row) => formatAccountingDate(row.dueDate) },
    {
      key: "totalAmount",
      header: "Total",
      numeric: true,
      render: (row) => formatAccountingMoney(row.totalAmount, currencyCode),
    },
    {
      key: "outstandingAmount",
      header: "Outstanding",
      numeric: true,
      render: (row) => formatAccountingMoney(row.outstandingAmount, currencyCode),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
    },
  ];

  const recentPaymentColumns: ManagerListColumn<ApSupplierDetail["recentPayments"][number]>[] = [
    { key: "paymentNumber", header: "Payment", render: (row) => row.paymentNumber || row.id },
    { key: "paymentDate", header: "Date", render: (row) => formatAccountingDate(row.paymentDate) },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      render: (row) => formatAccountingMoney(row.amount, currencyCode),
    },
    { key: "paymentMethod", header: "Method", render: (row) => (row.paymentMethod ? titleCaseAccountingStatus(row.paymentMethod) : "—") },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
    },
  ];

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Suppliers", href: ACCOUNTING_ROUTES.vendorSuppliers }}
        recordLabel={supplier?.name || "Supplier"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectSupplier(pageRows[position - 1].id),
                onNext: () => onSelectSupplier(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading supplier…" />
      ) : detailQuery.isError || !supplier ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Supplier unavailable"
            description="This supplier could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.vendorSuppliers} label="Back to suppliers" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {supplier.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{supplier.name}</h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Code">{supplier.code || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Counterparty type">
                  {supplier.counterpartyType ? titleCaseAccountingStatus(supplier.counterpartyType) : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Contact name">{supplier.contactName || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Email">{supplier.email || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Phone">{supplier.phone || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Payment terms (days)">{String(supplier.paymentTermDays ?? "—")}</AccountingFieldRow>
                <AccountingFieldRow label="Tax ID">{supplier.taxId || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Bank name">{supplier.bankName || "—"}</AccountingFieldRow>
              </dl>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Recent bills{recentBills.length ? ` (${recentBills.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Recent bills"
                  columns={recentBillColumns}
                  rows={recentBills}
                  getRowId={(row) => row.id}
                  emptyTitle="No bills"
                  emptyMessage="This supplier has no recent bills recorded."
                />
              </div>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Recent payments{recentPayments.length ? ` (${recentPayments.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Recent payments"
                  columns={recentPaymentColumns}
                  rows={recentPayments}
                  getRowId={(row) => row.id}
                  emptyTitle="No payments"
                  emptyMessage="This supplier has no recent payments recorded."
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Summary</h3>
                <dl className="mt-3">
                  <AccountingFieldRow label="Bills">{summary?.billCount ?? "—"}</AccountingFieldRow>
                  <AccountingFieldRow label="Open bills">{summary?.openBillCount ?? "—"}</AccountingFieldRow>
                  <AccountingFieldRow label="Outstanding">
                    <span className="text-lg">{formatAccountingMoney(summary?.outstandingTotal, currencyCode)}</span>
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Billed">{formatAccountingMoney(summary?.billedTotal, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Paid">{formatAccountingMoney(summary?.paidTotal, currencyCode)}</AccountingFieldRow>
                  <AccountingFieldRow label="Open credit notes">
                    {summary?.openCreditNoteCount ?? "—"} · {formatAccountingMoney(summary?.openCreditNoteRemaining, currencyCode)}
                  </AccountingFieldRow>
                </dl>
              </div>

              <AccountingReadOnlyCard
                actions={[
                  "Creating or approving a vendor bill",
                  "Recording a supplier payment",
                  "Editing a supplier record",
                ]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
