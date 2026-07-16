import { WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { Badge, ErrorState, PageShell, StatusMessage } from "@/components/ui";
import { WaiterTableDetailPanel } from "@/components/waiter/floor/WaiterTableDetailPanel";
import { WaiterTableGrid } from "@/components/waiter/floor/WaiterTableGrid";
import { WaiterTableToolbar } from "@/components/waiter/floor/WaiterTableToolbar";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  filterWaiterTables,
  getWaiterTableAction,
  normalizeWaiterTables,
  type WaiterTableAction,
  type WaiterTableFilter,
  type WaiterTableViewModel,
} from "@/lib/waiter/floor-model";
import { loadWaiterFloorData } from "@/lib/waiter/floor-api";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "SHIFT_NOT_OPEN") {
      return {
        title: "Shift not started",
        description: "Start shift before taking service actions.",
      };
    }

    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return {
        title: "Order belongs to another waiter",
        description: "Editable service actions are blocked for this order.",
      };
    }

    if (error.isForbidden) {
      return {
        title: "Floor access blocked",
        description: "This waiter account does not have permission to read this floor.",
      };
    }

    if (error.isAuthError) {
      return {
        title: "Session expired",
        description: "Please log in again to continue.",
      };
    }

    return {
      title: "Could not load floor",
      description: error.message,
    };
  }

  return {
    title: "Could not load floor",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

function countTables(tables: WaiterTableViewModel[]) {
  return tables.reduce<Record<WaiterTableFilter, number>>(
    (counts, table) => {
      counts.all += 1;
      counts[table.status] += 1;
      if (table.isMine) counts.mine += 1;
      return counts;
    },
    { all: 0, available: 0, occupied: 0, reserved: 0, mine: 0 },
  );
}

export function WaiterFloorScreen() {
  const router = useRouter();
  const { accessToken, branchId, branchName, clearSession, user } = useAuth();
  const activeShift = useActiveShift();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WaiterTableFilter>("all");
  const [selectedAction, setSelectedAction] = useState<WaiterTableAction | null>(null);

  const floorQuery = useQuery({
    queryKey: ["waiter", "floor", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => loadWaiterFloorData(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (floorQuery.error instanceof ApiError && floorQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, floorQuery.error]);

  const tables = useMemo(
    () =>
      normalizeWaiterTables({
        tables: floorQuery.data?.tables || [],
        activeOrders: floorQuery.data?.activeOrders || [],
        upcomingReservations: floorQuery.data?.upcomingReservations || [],
        currentUserId: user?.id,
      }),
    [floorQuery.data, user?.id],
  );

  const counts = useMemo(() => countTables(tables), [tables]);
  const filteredTables = useMemo(
    () => filterWaiterTables(tables, filter, query),
    [filter, query, tables],
  );
  const shiftIsOpen = Boolean(activeShift.data);
  const hasNoTables = !floorQuery.isLoading && tables.length === 0;

  function handleSelectTable(table: WaiterTableViewModel) {
    setSelectedAction(getWaiterTableAction(table, shiftIsOpen));
  }

  const errorCopy = floorQuery.isError ? getErrorCopy(floorQuery.error) : null;

  return (
    <PageShell
      title="Floor"
      subtitle={branchName ? `${branchName} table service` : "Table service"}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={shiftIsOpen ? "success" : "warning"}>
            {shiftIsOpen ? "Shift open" : "Shift not started"}
          </Badge>
          <Badge variant="neutral">
            <span className="tabular-nums">{counts.all}</span>
            <span className="ml-1">tables</span>
          </Badge>
        </div>
      }
    >
      {!shiftIsOpen && !activeShift.isLoading ? (
        <StatusMessage tone="warning" title="Shift not started">
          Available-table start actions and reservation seating are blocked until a shift is open.
        </StatusMessage>
      ) : null}

      <WaiterTableToolbar
        query={query}
        filter={filter}
        counts={counts}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
      />

      {errorCopy ? (
        <ErrorState title={errorCopy.title} description={errorCopy.description} />
      ) : (
        <div className="grid grid-cols-[1fr_360px] items-start gap-6">
          <WaiterTableGrid
            tables={filteredTables}
            isLoading={floorQuery.isLoading}
            onSelectTable={handleSelectTable}
          />
          <div className="sticky top-36">
            <WaiterTableDetailPanel
              action={selectedAction}
              shiftIsOpen={shiftIsOpen}
              onStartOrder={(table) =>
                void router.push(`/waiter/orders/new?tableId=${encodeURIComponent(table.id)}`)
              }
              onOpenOrder={(table) => {
                if (table.orderId) void router.push(`/waiter/orders/${table.orderId}`);
              }}
              onOpenReservation={(table) => {
                if (table.reservationId) {
                  void router.push(
                    `/waiter/reservations?reservationId=${encodeURIComponent(table.reservationId)}`,
                  );
                }
              }}
              onClose={() => setSelectedAction(null)}
            />
          </div>
        </div>
      )}

      {hasNoTables ? (
        <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
          <WarningCircle size={18} weight="bold" aria-hidden />
          <span>Cleaning, blocked, inactive, and unavailable backend tables are hidden from this MVP view.</span>
        </div>
      ) : null}
    </PageShell>
  );
}
