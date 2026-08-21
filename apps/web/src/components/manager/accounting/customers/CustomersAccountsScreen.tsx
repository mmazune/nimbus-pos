import { useRouter } from "next/router";
import { useMemo } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingListScreen,
  AccountingReadOnlyCard,
} from "@/components/manager/accounting/shared";
import { ManagerBreadcrumbs, ManagerFilterChip, ManagerSearchFilterMenu, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import {
  ACCOUNTING_LIST_PAGE_SIZE,
  clampAccountingTake,
} from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingCount,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import { AR_ACCOUNT_STATUSES, AR_ACCOUNT_TYPES, type ArAccountRow } from "@/lib/accounting/types";
import { useArAccountDetail, useArAccountsList } from "@/lib/manager/accounting-surface-queries";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/**
 * Customers → Accounts — Track B5.2. The Odoo C4/C5 list+form pair over
 * `GET /accounting/ar/accounts` and `GET /accounting/ar/accounts/:id`.
 *
 * Two independent filters (`status`, `type`) share ONE `ManagerSearchFilterMenu`
 * via composite keys (`status:ACTIVE`, `type:CORPORATE`), the same pattern
 * `ManagerOrdersScreen` (B3) uses for `status`/`serviceType`.
 */
export function CustomersAccountsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, AR_ACCOUNT_STATUSES);
  const type = readManagerEnum(router.query.type, AR_ACCOUNT_TYPES);
  const selectedAccountId = firstManagerQueryValue(router.query.accountId);

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useArAccountsList({
    status: status || undefined,
    type: type || undefined,
    skip: (page - 1) * take,
    take,
  });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openAccount = (accountId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { accountId, page }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ArAccountRow>[] = useMemo(
    () => [
      { key: "name", header: "Account", render: (row) => row.name || row.id },
      { key: "code", header: "Code", optional: true, hideBelowLarge: true, render: (row) => row.code || "—" },
      { key: "type", header: "Type", render: (row) => titleCaseAccountingStatus(row.type) },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
      {
        key: "invoices",
        header: "Invoices",
        numeric: true,
        optional: true,
        render: (row) => formatAccountingCount(row._count?.invoices ?? null),
      },
    ],
    [],
  );

  const pager = toAccountingPager({ page, pageSize: take, total: listQuery.data?.total });

  if (selectedAccountId) {
    return (
      <CustomerAccountDetailPanel
        accountId={selectedAccountId}
        pageRows={rows}
        onClose={() => openAccount(null)}
        onSelectAccount={openAccount}
      />
    );
  }

  return (
    <AccountingListScreen
      title="Accounts"
      routeKey="ar.accounts"
      search={{
        emptyHint: "This endpoint has no text search — filter by status or type.",
        filterChips: (
          <>
            {status ? (
              <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
            ) : null}
            {type ? (
              <ManagerFilterChip label={titleCaseAccountingStatus(type)} onClear={() => patchQuery({ type: null })} />
            ) : null}
          </>
        ),
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter customer accounts"
            filters={[
              ...AR_ACCOUNT_STATUSES.map((value) => ({ key: `status:${value}`, label: titleCaseAccountingStatus(value) })),
              ...AR_ACCOUNT_TYPES.map((value) => ({ key: `type:${value}`, label: titleCaseAccountingStatus(value) })),
            ]}
            activeFilterKeys={[status ? `status:${status}` : "", type ? `type:${type}` : ""].filter(Boolean)}
            onToggleFilter={(key) => {
              const [field, value] = key.split(":");
              const current = field === "status" ? status : type;
              patchQuery({ [field]: current === value ? null : value });
            }}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      onSelectRow={(row) => openAccount(row.id)}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No customer accounts match"
      emptyMessage="No customer accounts in this branch match the current filters."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
    />
  );
}

function CustomerAccountDetailPanel({
  accountId,
  onClose,
  onSelectAccount,
  pageRows,
}: {
  accountId: string;
  onClose: () => void;
  onSelectAccount: (id: string) => void;
  pageRows: readonly ArAccountRow[];
}) {
  const detailQuery = useArAccountDetail(accountId);
  const account = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === accountId);

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Accounts", href: ACCOUNTING_ROUTES.customerAccounts }}
        recordLabel={account?.name || "Account"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectAccount(pageRows[position - 1].id),
                onNext: () => onSelectAccount(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading account…" />
      ) : detailQuery.isError || !account ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Account unavailable"
            description="This customer account could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.customerAccounts} label="Back to accounts" />
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
          <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{account.name}</h2>
              <Badge variant={accountingStatusTone(account.status)}>{titleCaseAccountingStatus(account.status)}</Badge>
            </div>

            <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
              <AccountingFieldRow label="Code">{account.code || "—"}</AccountingFieldRow>
              <AccountingFieldRow label="Type">{titleCaseAccountingStatus(account.type)}</AccountingFieldRow>
              <AccountingFieldRow label="Status">{titleCaseAccountingStatus(account.status)}</AccountingFieldRow>
              <AccountingFieldRow label="Contact name">{account.contactName || "—"}</AccountingFieldRow>
              <AccountingFieldRow label="Email">{account.email || "—"}</AccountingFieldRow>
              <AccountingFieldRow label="Phone">{account.phone || "—"}</AccountingFieldRow>
              <AccountingFieldRow label="Address">{account.address || "—"}</AccountingFieldRow>
            </dl>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Activity</h3>
              <dl className="mt-3">
                <AccountingFieldRow label="Invoices">{formatAccountingCount(account._count?.invoices ?? null)}</AccountingFieldRow>
                <AccountingFieldRow label="Receipts">{formatAccountingCount(account._count?.receipts ?? null)}</AccountingFieldRow>
                <AccountingFieldRow label="Credit notes">{formatAccountingCount(account._count?.creditNotes ?? null)}</AccountingFieldRow>
              </dl>
            </div>

            <AccountingReadOnlyCard
              actions={["Issuing a customer invoice or receipt", "Editing a customer account"]}
            />
          </div>
        </div>
      )}
    </>
  );
}
