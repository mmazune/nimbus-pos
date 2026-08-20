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
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { useManagerReservations } from "@/lib/manager/operations-context";
import {
  MANAGER_RESERVATION_SCOPES,
  MANAGER_RESERVATION_STATUS_FILTERS,
  formatManagerDateTime,
  managerReservationStatusTone,
  titleCaseManagerStatus,
  toManagerPager,
} from "@/lib/manager/operations-model";
import {
  buildManagerListQuery,
  readManagerPage,
  readManagerReservationScope,
  readManagerReservationStatus,
} from "@/lib/manager/operations-route";
import type { ManagerReservationRow } from "@/lib/manager/operations-types";

/**
 * Operations → Reservations (Track B3). Read-only oversight over the SAME
 * bounded `scope=active|history` contract Supervisor Prompt 4A/4B established —
 * no second reservation contract was invented for Manager.
 *
 * Read-only means read-only: there is no create, confirm, assign, seat, cancel,
 * no-show or manual-complete control here. Those are Supervisor's, they are
 * already built, and duplicating them under Manager would fork a verified
 * lifecycle across two surfaces.
 *
 * Guest **contact** details are never fetched into this surface — the row
 * projection in `operations-api.ts` drops `guestPhone`/`guestEmail` at the API
 * boundary. The guest NAME is shown, matching the Supervisor precedent that puts
 * names in rows and contact behind a workspace Manager does not have.
 */
export function ManagerReservationsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const scope = readManagerReservationScope(router.query.scope);
  const status = readManagerReservationStatus(router.query.status);

  const { listQuery } = useManagerReservations({ page, scope, status });
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

  const columns: ManagerListColumn<ManagerReservationRow>[] = useMemo(
    () => [
      { key: "reservationNumber", header: "Reference", render: (row) => row.reservationNumber },
      {
        key: "guest",
        header: "Guest",
        render: (row) => row.guestName || <span className="text-text-muted">Not recorded</span>,
      },
      {
        key: "reservationAt",
        header: "Booked for",
        render: (row) => formatManagerDateTime(row.reservationAt),
      },
      {
        key: "partySize",
        header: "Party",
        numeric: true,
        render: (row) => row.partySize ?? "—",
      },
      {
        key: "table",
        header: "Table",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.tableLabel || <span className="text-text-muted">Unassigned</span>,
      },
      {
        key: "order",
        header: "Linked order",
        optional: true,
        defaultHidden: true,
        render: (row) => (row.hasSeatedOrder ? "Yes" : "No"),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={managerReservationStatusTone(row.status)}>
            {titleCaseManagerStatus(row.status)}
          </Badge>
        ),
      },
    ],
    [],
  );

  const pager = toManagerPager({
    page,
    pageSize: listQuery.data?.pageSize ?? 25,
    rowCount: rows.length,
    total: listQuery.data?.total ?? 0,
  });

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Reservations"
        badge={<Badge variant="neutral">Read-only oversight</Badge>}
        secondaryActions={
          <div className="flex items-center gap-1 rounded-md bg-surface-muted p-0.5" role="group" aria-label="Reservation scope">
            {MANAGER_RESERVATION_SCOPES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={scope === option}
                data-manager-reservation-scope={option}
                onClick={() => patchQuery({ scope: option })}
                className={cn(
                  "rounded px-2.5 py-1 text-sm font-semibold outline-none focus-visible:shadow-focus",
                  scope === option
                    ? "bg-surface text-text-primary shadow-subtle"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                {option === "active" ? "Active" : "History"}
              </button>
            ))}
          </div>
        }
        search={{
          emptyHint: "This endpoint has no text search — filter by status.",
          filterChips: status ? (
            <ManagerFilterChip
              label={titleCaseManagerStatus(status)}
              onClear={() => patchQuery({ status: null })}
            />
          ) : null,
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter reservations"
              filters={MANAGER_RESERVATION_STATUS_FILTERS.map((value) => ({
                key: value,
                label: titleCaseManagerStatus(value),
              }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
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
        caption="Branch reservations"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="The reservation list could not be read for this branch. Retry, or change the scope."
        emptyTitle="No reservations"
        emptyMessage={
          scope === "active"
            ? "No pending, confirmed or seated reservations for this branch."
            : "No completed, cancelled or no-show reservations match this filter."
        }
      />

      <p className="max-w-3xl text-xs leading-5 text-text-muted">
        Oversight only. Creating, confirming, assigning a table, seating, cancelling, marking a
        no-show and completing a reservation are supervisor actions and are not offered here. Guest
        phone and email are not read into this surface at all.
      </p>
    </ManagerContentShell>
  );
}
