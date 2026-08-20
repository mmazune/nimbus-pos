import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";

import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { OperationalFloor } from "@/components/floor";
import { Badge, Card } from "@/components/ui";
import { useManagerFloor } from "@/lib/manager/operations-context";
import {
  formatManagerDateTime,
  titleCaseManagerStatus,
  type ManagerFloorTableViewModel,
} from "@/lib/manager/operations-model";
import {
  MANAGER_OPERATIONS_ROUTES,
  buildManagerListQuery,
  firstManagerQueryValue,
} from "@/lib/manager/operations-route";

/**
 * Operations → Tables (Track B3).
 *
 * Manager is the **fourth consumer of the shared `OperationalFloor`** — the same
 * toolbar, grid, cards, status labels, `First L.` staff formatting, breakpoints
 * and 176px card height that Waiter, Cashier and Supervisor render. There is no
 * `ManagerFloor*` component and there must never be one (CLAUDE.md §13); the
 * only Manager-specific code is the data layer that produces the shared view
 * model, exactly like `lib/cashier/floor-model.ts` does for Cashier.
 *
 * Behaviour after selection is where roles legitimately differ (the locked
 * shared-Floor decision). Waiter opens an order builder, Cashier a settlement
 * workspace, Supervisor a table-control workspace — **Manager opens a read-only
 * summary with a link into the order record.** It offers no table-status write,
 * no seat, no assign and no order action.
 *
 * Guest names are never placed on a Floor card, for Manager as for every other
 * role.
 */
export function ManagerTablesScreen() {
  const router = useRouter();
  const selectedTableId = firstManagerQueryValue(router.query.tableId);
  const floor = useManagerFloor();

  const selectTable = useCallback(
    (tableId: string | null) => {
      void router.replace(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, { tableId }) },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const selected = useMemo<ManagerFloorTableViewModel | null>(
    () => floor.tables.find((table) => table.id === selectedTableId) || null,
    [floor.tables, selectedTableId],
  );

  const counts = useMemo(() => {
    const occupied = floor.tables.filter((table) => table.status === "occupied").length;
    const reserved = floor.tables.filter((table) => table.status === "reserved").length;
    return { occupied, reserved, total: floor.tables.length };
  }, [floor.tables]);

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Tables"
        badge={<Badge variant="neutral">Read-only oversight</Badge>}
      />

      <p className="max-w-3xl text-sm text-text-secondary">
        {floor.isLoading
          ? "Reading the floor for this branch…"
          : floor.isError
            ? "The floor snapshot could not be read for this branch."
            : `${counts.total} tables on this floor — ${counts.occupied} occupied, ${counts.reserved} reserved. This is the same floor the service roles see; nothing here changes a table.`}
      </p>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
        <div className="min-w-0">
          <OperationalFloor
            branchName={floor.branchName}
            readinessLabel="Oversight"
            readinessTone="info"
            tables={floor.tables}
            isLoading={floor.isLoading}
            error={
              floor.isError
                ? {
                    title: "Floor unavailable",
                    description:
                      "The tables, active orders or reservations could not be read for this branch. Retry when the connection is stable.",
                  }
                : null
            }
            selectedTableId={selectedTableId || undefined}
            onSelectTable={(table) => selectTable(table.id)}
            onRetry={floor.refetch}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {selected ? (
            <Card className="min-w-0" data-manager-table-panel={selected.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold tracking-tight text-text-primary">{selected.label}</h2>
                <Badge
                  variant={
                    selected.status === "occupied"
                      ? "info"
                      : selected.status === "reserved"
                        ? "warning"
                        : "success"
                  }
                >
                  {titleCaseManagerStatus(selected.status)}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Seats</dt>
                  <dd className="font-semibold text-text-primary">{selected.capacity ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Area</dt>
                  <dd className="font-semibold text-text-primary">{selected.floorPlanName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Server</dt>
                  <dd className="font-semibold text-text-primary">{selected.assignedStaffName || "Unassigned"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Open order</dt>
                  <dd className="font-semibold text-text-primary">
                    {selected.activeOrder ? selected.activeOrder.orderNumber : "None"}
                  </dd>
                </div>
                {selected.reservation ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">Next reservation</dt>
                    <dd className="font-semibold text-text-primary">
                      {formatManagerDateTime(selected.reservation.reservationAt)}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {selected.activeOrder ? (
                <Link
                  href={{
                    pathname: MANAGER_OPERATIONS_ROUTES.orders,
                    query: { orderId: selected.activeOrder.id },
                  }}
                  className="mt-5 inline-flex rounded-md px-2 py-1 text-sm font-semibold text-brand-navy-900 underline outline-none hover:bg-surface-muted focus-visible:shadow-focus"
                >
                  Open the order record
                </Link>
              ) : null}

              <p className="mt-5 text-xs leading-5 text-text-muted">
                Read-only. Seating a guest, changing a table&apos;s status, assigning a server and every
                order action stay with the roles that own them.
              </p>
            </Card>
          ) : (
            <Card className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary">Select a table</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choosing a table shows its seats, area, server, open order and next reservation. No
                guest name is ever shown on a floor card.
              </p>
            </Card>
          )}

          <Card className="min-w-0 bg-status-warning-surface">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-status-warning">
              What this floor cannot show
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Tills and shifts are not on this screen. This backend has no branch-wide tills or shifts
              list — <code>GET /api/tills</code> and <code>GET /api/shifts</code> do not exist, and the
              <code> /active</code> variants return only the caller&apos;s own row. They appear on
              Overview as counts, which is all that can be read honestly.
            </p>
          </Card>
        </div>
      </div>
    </ManagerContentShell>
  );
}
