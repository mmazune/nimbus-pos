import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, ErrorState } from "@/components/ui";
import { OrderScreen } from "@/screens/order/OrderScreen";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getWaiterTableAction,
  normalizeWaiterTables,
  type WaiterTableViewModel,
} from "@/lib/waiter/floor-model";
import {
  listWaiterOperationalReservations,
  listWaiterTables,
  type WaiterFloorData,
  type WaiterOrderApi as FloorWaiterOrder,
} from "@/lib/waiter/floor-api";
import { FloorScreen } from "@/screens/floor/FloorScreen";
import { errorWords } from "@/screens/shared/words";
import { loadAllActiveOrders, loadAreas } from "@/screens/floor/floor-data";
import { loadWaiterMenuWorkspace } from "@/lib/waiter/order-api";
import { seatReservation } from "@/lib/waiter/reservation-api";
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
      description: errorWords(error),
    };
  }

  return {
    title: "Could not load floor",
    description: errorWords(error, "Try again when the connection is stable."),
  };
}

export function WaiterFloorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession, user } = useAuth();
  const activeShift = useActiveShift();
  const [selectionOverride, setSelectionOverride] = useState<string | null>();
  const selectionPushedRef = useRef(false);

  const floorQuery = useQuery({
    queryKey: ["waiter", "floor", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: async (): Promise<WaiterFloorData> => {
      const token = accessToken as string;
      const branch = branchId as string;
      const [tables, activeOrders, reservations, areas] = await Promise.all([
        listWaiterTables(token, branch),
        loadAllActiveOrders<FloorWaiterOrder>(token, branch),
        listWaiterOperationalReservations(token, branch),
        loadAreas(token, branch),
      ]);
      return { tables, activeOrders, reservations, areas };
    },
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (floorQuery.error instanceof ApiError && floorQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, floorQuery.error]);

  useEffect(() => {
    if (!accessToken || !branchId) return;

    void queryClient.prefetchQuery({
      queryKey: ["waiter", "menu-workspace", branchId],
      queryFn: () => loadWaiterMenuWorkspace(accessToken, branchId),
      staleTime: 5 * 60_000,
    });
  }, [accessToken, branchId, queryClient]);

  const tables = useMemo(
    () =>
      normalizeWaiterTables({
        tables: floorQuery.data?.tables || [],
        activeOrders: floorQuery.data?.activeOrders || [],
        reservations: floorQuery.data?.reservations || [],
        currentUserId: user?.id,
      }),
    [floorQuery.data, user?.id],
  );

  const shiftIsOpen = Boolean(activeShift.data);
  const viewer = useMemo(() => ({ userId: user?.id, ownership: "waiter" as const }), [user?.id]);
  const routeTableId = typeof router.query.tableId === "string" ? router.query.tableId : undefined;
  const selectedTableId = selectionOverride === undefined ? routeTableId : selectionOverride || undefined;
  useEffect(() => {
    setSelectionOverride(undefined);
  }, [routeTableId]);
  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId),
    [selectedTableId, tables],
  );
  const selectedAction = selectedTable
    ? getWaiterTableAction(selectedTable, shiftIsOpen)
    : null;
  const seatable = useMemo(() => {
    if (!selectedTable || selectedTable.activeOrderId) return null;
    return (floorQuery.data?.reservations || []).find(
      (r) => r.tableId === selectedTable.id && (r.status === "PENDING" || r.status === "CONFIRMED"),
    ) ?? null;
  }, [floorQuery.data?.reservations, selectedTable]);

  function handleSelectTable(table: WaiterTableViewModel) {
    if (typeof performance !== "undefined") {
      performance.clearMarks("waiter-table-click");
      performance.clearMarks("waiter-menu-shell-visible");
      performance.clearMarks("waiter-menu-content-visible");
      performance.clearMarks("waiter-cached-order-visible");
      performance.clearMarks("waiter-order-pending-visible");
      performance.clearMeasures("waiter-table-click-to-shell");
      performance.clearMeasures("waiter-table-click-to-menu-content");
      performance.clearMeasures("waiter-table-click-to-cached-order");
      performance.clearMeasures("waiter-table-click-to-order-pending");
      performance.mark("waiter-table-click");
    }
    const hasSelection = Boolean(selectedTableId);
    selectionPushedRef.current = !hasSelection;
    setSelectionOverride(table.id);
    const target = { pathname: "/waiter/floor", query: { tableId: table.id } };
    if (hasSelection) {
      void router.replace(target, undefined, { shallow: true, scroll: false });
    } else {
      void router.push(target, undefined, { shallow: true, scroll: false });
    }
  }

  function handleCloseWorkspace() {
    const tableIdToFocus = selectedTableId;
    setSelectionOverride(null);
    window.setTimeout(() => {
      const target = [...document.querySelectorAll<HTMLElement>("[data-operational-table-id]")]
        .find((element) => element.dataset.operationalTableId === tableIdToFocus);
      target?.focus();
    }, 0);
    if (selectionPushedRef.current) {
      selectionPushedRef.current = false;
      router.back();
      return;
    }

    void router.replace("/waiter/floor", undefined, { shallow: true, scroll: false });
  }

  const errorCopy = floorQuery.isError ? getErrorCopy(floorQuery.error) : null;

  return (
    <>
      {selectedTableId && !floorQuery.isLoading && !selectedTable && !floorQuery.isError ? (
        <div className="grid gap-3" data-floor-table-unavailable>
          <ErrorState
            title="Table unavailable"
            description="The selected table is not accessible on this Floor. Choose another table."
          />
          <div>
            <Button variant="secondary" size="compact" onClick={handleCloseWorkspace}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      <FloorScreen
        role="waiter"
        source={floorQuery.data}
        readAt={floorQuery.dataUpdatedAt}
        viewer={viewer}
        isLoading={floorQuery.isLoading}
        error={errorCopy}
        onRetry={() => void floorQuery.refetch()}
        onOpenTable={(tableId) => {
          const table = tables.find((entry) => entry.id === tableId);
          if (table) handleSelectTable(table);
        }}
      />

      {selectedAction && selectedTable ? (
        <OrderScreen
          key={selectedTable.id}
          role="waiter"
          tableId={selectedTable.id}
          tableLabel={selectedTable.label}
          seats={selectedTable.capacity}
          onClose={handleCloseWorkspace}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] })}
          orderingBlocked={
            shiftIsOpen ? null : { title: "Shift not started", detail: "Start your shift under Me before taking orders." }
          }
          reservation={
            seatable
              ? {
                  title: `Booked${seatable.reservationAt ? ` for ${new Date(seatable.reservationAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" })}` : ""}`,
                  detail: [seatable.customerName, seatable.partySize ? `${seatable.partySize} guests` : null]
                    .filter(Boolean)
                    .join(" · "),
                  onSeat: async () => {
                    if (!accessToken || !branchId) return false;
                    try {
                      await seatReservation(accessToken, branchId, seatable.id, { tableId: selectedTable.id, createOrder: true });
                      await queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
                      return true;
                    } catch {
                      return false;
                    }
                  },
                }
              : null
          }
        />
      ) : null}

    </>
  );
}
