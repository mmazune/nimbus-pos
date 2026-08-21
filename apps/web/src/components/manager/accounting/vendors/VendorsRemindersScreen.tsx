import { useRouter } from "next/router";
import { useMemo } from "react";

import { AccountingListScreen } from "@/components/manager/accounting/shared";
import { ManagerFilterChip, ManagerSearchFilterMenu, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import { ACCOUNTING_LIST_PAGE_SIZE, clampAccountingTake } from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingDate,
  formatAccountingMoney,
  sumAccountingPageMoney,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import type { ApReminderRow } from "@/lib/accounting/types";
import { useApRemindersList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { buildManagerListQuery, readManagerEnum, readManagerPage } from "@/lib/manager/accounting-route";

/**
 * `AP reminder` statuses — not exported from `lib/accounting/types.ts` (no
 * const array exists there for this enum), so declared locally rather than
 * widening that shared module for a single screen.
 */
const AP_REMINDER_STATUSES = ["PENDING", "DISMISSED", "AUTO_RESOLVED"] as const;

/** Vendors → Reminders — Track B5.2. List-only over `GET /accounting/ap/reminders`. */
export function VendorsRemindersScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, AP_REMINDER_STATUSES);
  const { currencyCode } = useManagerBranch();

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useApRemindersList({ status: status || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ApReminderRow>[] = useMemo(
    () => [
      {
        key: "supplier",
        header: "Supplier",
        render: (row) => row.supplier?.name || <span className="text-text-muted">Unknown</span>,
      },
      { key: "billNumber", header: "Bill", render: (row) => row.vendorBill?.billNumber || "—" },
      { key: "dueDate", header: "Due", render: (row) => formatAccountingDate(row.dueDate) },
      {
        key: "outstandingAmount",
        header: "Outstanding",
        numeric: true,
        render: (row) => formatAccountingMoney(row.vendorBill?.outstandingAmount, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.vendorBill?.outstandingAmount));
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
      title="Reminders"
      routeKey="ap.reminders"
      search={{
        emptyHint: "This endpoint has no text search — filter by status.",
        filterChips: status ? (
          <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter reminders"
            filters={AP_REMINDER_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
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
      emptyTitle="No reminders"
      emptyMessage="No payment reminders exist for this branch yet."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote={`The outstanding total sums the ${rows.length} reminders on this page only — this endpoint returns no branch aggregate.`}
    />
  );
}
