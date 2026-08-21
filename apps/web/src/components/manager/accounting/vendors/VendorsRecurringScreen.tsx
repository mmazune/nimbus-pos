import { useRouter } from "next/router";
import { useMemo } from "react";

import { AccountingListScreen } from "@/components/manager/accounting/shared";
import { ManagerFilterChip, ManagerSearchFilterMenu, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import { ACCOUNTING_LIST_PAGE_SIZE, clampAccountingTake } from "@/lib/accounting/api";
import { formatAccountingDate, formatAccountingMoney, sumAccountingPageMoney, toAccountingPager } from "@/lib/accounting/model";
import type { ApRecurringProfileRow } from "@/lib/accounting/types";
import { useApRecurringProfilesList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { buildManagerListQuery, firstManagerQueryValue, readManagerPage } from "@/lib/manager/accounting-route";

const ACTIVE_FILTERS = [
  { key: "true", label: "Active" },
  { key: "false", label: "Inactive" },
] as const;

/**
 * Vendors → Recurring profiles — Track B5.2. List-only over
 * `GET /accounting/ap/recurring-profiles`. There is no cadence enum exported
 * anywhere in the frontend, so `cadence` renders as the raw label the backend
 * sends rather than a typed filter — filtering here is `isActive` only, as a
 * two-option boolean toggle rather than an enum filter menu.
 */
export function VendorsRecurringScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const activeParam = firstManagerQueryValue(router.query.active);
  const isActive = activeParam === "true" ? true : activeParam === "false" ? false : undefined;
  const { currencyCode } = useManagerBranch();

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = useApRecurringProfilesList({ isActive, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<ApRecurringProfileRow>[] = useMemo(
    () => [
      {
        key: "supplier",
        header: "Supplier",
        render: (row) => row.supplier?.name || <span className="text-text-muted">Unknown</span>,
      },
      { key: "cadence", header: "Cadence", render: (row) => row.cadence || "—" },
      { key: "nextDueDate", header: "Next due", render: (row) => formatAccountingDate(row.nextDueDate) },
      {
        key: "amount",
        header: "Amount",
        numeric: true,
        render: (row) => formatAccountingMoney(row.amount, currencyCode),
        total: (pageRows) => {
          const sum = sumAccountingPageMoney(pageRows.map((row) => row.amount));
          return sum === null ? "Unavailable" : formatAccountingMoney(String(sum), currencyCode);
        },
      },
      {
        key: "isActive",
        header: "Status",
        render: (row) =>
          row.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>,
      },
    ],
    [currencyCode],
  );

  const pager = toAccountingPager({ page, pageSize: take, total: listQuery.data?.total });

  return (
    <AccountingListScreen
      title="Recurring profiles"
      routeKey="ap.recurringProfiles"
      search={{
        emptyHint: "This endpoint has no text search — filter by active state.",
        filterChips: activeParam ? (
          <ManagerFilterChip
            label={activeParam === "true" ? "Active" : "Inactive"}
            onClear={() => patchQuery({ active: null })}
          />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter recurring profiles"
            filters={ACTIVE_FILTERS.map((filter) => ({ key: filter.key, label: filter.label }))}
            activeFilterKeys={activeParam ? [activeParam] : []}
            onToggleFilter={(key) => patchQuery({ active: activeParam === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No recurring profiles"
      emptyMessage="No recurring vendor bill profiles exist for this branch yet."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote={`The amount total sums the ${rows.length} profiles on this page only — this endpoint returns no branch aggregate.`}
    />
  );
}
