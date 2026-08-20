import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";

import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ManagerOrderDetailPanel } from "@/components/manager/operations/ManagerOrderDetailPanel";
import { Badge } from "@/components/ui";
import { useManagerOrders } from "@/lib/manager/operations-context";
import {
  MANAGER_ORDER_STATUS_FILTERS,
  MANAGER_SERVICE_TYPE_FILTERS,
  formatManagerDateTime,
  formatManagerOperationsMoney,
  managerOrderStatusTone,
  sumManagerPageMoney,
  titleCaseManagerStatus,
  toManagerPager,
} from "@/lib/manager/operations-model";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerOrderStatus,
  readManagerPage,
  readManagerServiceType,
} from "@/lib/manager/operations-route";
import type { ManagerOrderRow } from "@/lib/manager/operations-types";

/**
 * Operations → Orders (Track B3). The Odoo **C4 list view** over
 * `GET /api/pos/orders`, and the first Manager surface with a real record list.
 *
 * READ-ONLY, by design and by construction: this screen renders no tender panel,
 * no order-builder control, no status transition, no close, no void and no
 * discount affordance. Selecting a row opens a read-only C5 record. The B3
 * assertion script proves no mutation verb reaches this directory.
 *
 * Pagination is SERVER-side and fed by the endpoint's own `total` — the control
 * panel's pager takes `{from,to,total}` precisely so a page length can never be
 * mistaken for a record count.
 */
export function ManagerOrdersScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerOrderStatus(router.query.status);
  const serviceType = readManagerServiceType(router.query.serviceType);
  const selectedOrderId = firstManagerQueryValue(router.query.orderId);

  const snapshot = useManagerOrders({ page, status, serviceType }, selectedOrderId);
  const { currencyCode, listQuery } = snapshot;
  const rows = useMemo(() => listQuery.data?.rows || [], [listQuery.data]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      void router.replace(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const openOrder = useCallback(
    (orderId: string | null) => {
      void router.push(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, { orderId, page }) },
        undefined,
        { shallow: true },
      );
    },
    [page, router],
  );

  const columns: ManagerListColumn<ManagerOrderRow>[] = useMemo(
    () => [
      { key: "orderNumber", header: "Order", render: (row) => row.orderNumber },
      {
        key: "table",
        header: "Table",
        render: (row) => row.tableLabel || <span className="text-text-muted">Takeaway</span>,
      },
      {
        key: "server",
        header: "Server",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.serverName || <span className="text-text-muted">Unassigned</span>,
      },
      {
        key: "serviceType",
        header: "Service",
        optional: true,
        hideBelowLarge: true,
        render: (row) => titleCaseManagerStatus(row.serviceType),
      },
      {
        key: "items",
        header: "Lines",
        numeric: true,
        optional: true,
        defaultHidden: true,
        render: (row) => (row.itemCount === null ? "—" : row.itemCount),
      },
      {
        key: "opened",
        header: "Opened",
        render: (row) => formatManagerDateTime(row.createdAt),
      },
      {
        key: "total",
        header: "Total",
        numeric: true,
        render: (row) => formatManagerOperationsMoney(row.total, currencyCode),
        // A PAGE total, and the totals row says exactly that. `/pos/orders`
        // returns no aggregate, so a branch total cannot be computed here and is
        // never implied.
        total: (pageRows) => {
          const sum = sumManagerPageMoney(pageRows.map((row) => row.total));
          return sum === null
            ? "Unavailable"
            : formatManagerOperationsMoney(String(sum), currencyCode);
        },
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={managerOrderStatusTone(row.status)}>
            {titleCaseManagerStatus(row.status)}
          </Badge>
        ),
      },
    ],
    [currencyCode],
  );

  const pager = toManagerPager({
    page,
    pageSize: listQuery.data?.pageSize ?? 25,
    rowCount: rows.length,
    total: listQuery.data?.total ?? 0,
  });

  if (selectedOrderId) {
    return (
      <ManagerContentShell>
        <ManagerOrderDetailPanel
          snapshot={snapshot}
          pageRows={rows}
          onClose={() => openOrder(null)}
          onSelectOrder={(orderId) => openOrder(orderId)}
        />
      </ManagerContentShell>
    );
  }

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Orders"
        badge={<Badge variant="neutral">Read-only oversight</Badge>}
        search={{
          // `/pos/orders` has NO text-search parameter (verified against
          // ListOrdersQueryDto), so the box hosts chips and the filter menu and
          // omits the input entirely rather than greying one out.
          emptyHint: "This endpoint has no text search — filter by status or service.",
          filterChips: (
            <>
              {status ? (
                <ManagerFilterChip
                  label={titleCaseManagerStatus(status)}
                  onClear={() => patchQuery({ status: null })}
                />
              ) : null}
              {serviceType ? (
                <ManagerFilterChip
                  label={titleCaseManagerStatus(serviceType)}
                  onClear={() => patchQuery({ serviceType: null })}
                />
              ) : null}
            </>
          ),
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter orders"
              filters={[
                ...MANAGER_ORDER_STATUS_FILTERS.map((value) => ({
                  key: `status:${value}`,
                  label: titleCaseManagerStatus(value),
                })),
                ...MANAGER_SERVICE_TYPE_FILTERS.map((value) => ({
                  key: `serviceType:${value}`,
                  label: titleCaseManagerStatus(value),
                })),
              ]}
              activeFilterKeys={[
                status ? `status:${status}` : "",
                serviceType ? `serviceType:${serviceType}` : "",
              ].filter(Boolean)}
              onToggleFilter={(key) => {
                const [field, value] = key.split(":");
                const current = field === "status" ? status : serviceType;
                patchQuery({ [field]: current === value ? null : value });
              }}
              // No Group By column: `/pos/orders` cannot group server-side, and
              // grouping a single bounded page in the browser would label a page
              // slice as a branch grouping.
            />
          ),
        }}
        pager={{
          ...pager,
          onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }),
          onNext: () => patchQuery({ page: page + 1 }),
        }}
      />

      <ManagerListTable
        caption="Branch orders"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        onSelectRow={(row) => openOrder(row.id)}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="The order list could not be read for this branch. Retry, or clear the filters."
        emptyTitle="No orders match"
        emptyMessage="No orders in this branch match the current filters."
        totalsLabel="This page"
      />

      <p className="text-xs leading-5 text-text-muted">
        The totals row sums the {rows.length} orders on this page only — this endpoint returns no
        branch or day aggregate, so no wider total is shown here. Day totals live on Reports.
      </p>
    </ManagerContentShell>
  );
}
