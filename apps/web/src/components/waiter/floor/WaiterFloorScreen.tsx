import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { OperationalFloor } from "@/components/floor/OperationalFloor";
import { OperationalTableWorkspaceFrame } from "@/components/floor/OperationalTableWorkspaceFrame";
import { ErrorState } from "@/components/ui";
import { WaiterTableWorkspace } from "@/components/waiter/floor/WaiterTableWorkspace";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getWaiterTableAction,
  normalizeWaiterTables,
  type WaiterTableViewModel,
} from "@/lib/waiter/floor-model";
import { loadWaiterFloorData, type WaiterFloorData } from "@/lib/waiter/floor-api";
import { loadWaiterMenuWorkspace, type WaiterOrderApi } from "@/lib/waiter/order-api";
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

export function WaiterFloorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, branchName, clearSession, user } = useAuth();
  const activeShift = useActiveShift();
  const [selectionOverride, setSelectionOverride] = useState<string | null>();
  const selectionPushedRef = useRef(false);

  const floorQuery = useQuery({
    queryKey: ["waiter", "floor", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => loadWaiterFloorData(accessToken as string, branchId as string),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
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
  const routeTableId = typeof router.query.tableId === "string" ? router.query.tableId : undefined;
  const selectedTableId = selectionOverride === undefined ? routeTableId : selectionOverride || undefined;
  useEffect(() => {
    setSelectionOverride(undefined);
  }, [routeTableId]);
  const requestedOrderId = typeof router.query.orderId === "string" ? router.query.orderId : undefined;
  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId),
    [selectedTableId, tables],
  );
  const selectedAction = selectedTable
    ? getWaiterTableAction(selectedTable, shiftIsOpen)
    : null;
  const opensOrderWorkspace = Boolean(
    requestedOrderId ||
      selectedAction?.intent === "start-order" ||
      selectedAction?.intent === "own-order",
  );

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

  function handleOpenOrder(tableId: string, orderId: string, order?: WaiterOrderApi) {
    setSelectionOverride(tableId);
    if (order && branchId) {
      queryClient.setQueryData<WaiterFloorData>(["waiter", "floor", branchId], (current) => {
        if (!current) return current;
        const activeOrder: WaiterOrderApi = {
          ...order,
          id: orderId,
          tableId,
          userId: order.userId || user?.id,
          table: order.table || { id: tableId },
        };
        return {
          ...current,
          activeOrders: [
            activeOrder,
            ...current.activeOrders.filter((entry) => entry.id !== orderId && entry.tableId !== tableId),
          ],
        };
      });
    }
    void router.replace(
      { pathname: "/waiter/floor", query: { tableId, orderId } },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  const errorCopy = floorQuery.isError ? getErrorCopy(floorQuery.error) : null;

  return (
    <>
      <OperationalFloor
        branchName={branchName}
        readinessLabel={shiftIsOpen ? "Shift open" : "Shift not started"}
        readinessTone={shiftIsOpen ? "success" : "warning"}
        tables={tables}
        isLoading={floorQuery.isLoading}
        error={errorCopy}
        selectedTableId={selectedTableId}
        onSelectTable={handleSelectTable}
        onRetry={() => void floorQuery.refetch()}
      />

      {selectedAction ? (
        <OperationalTableWorkspaceFrame immersive={opensOrderWorkspace} onClose={handleCloseWorkspace}>
          <WaiterTableWorkspace
            action={selectedAction}
            requestedOrderId={requestedOrderId}
            shiftIsOpen={shiftIsOpen}
            onClose={handleCloseWorkspace}
            onOpenOrder={handleOpenOrder}
          />
        </OperationalTableWorkspaceFrame>
      ) : null}

      {selectedTableId && !floorQuery.isLoading && !selectedTable && !floorQuery.isError ? (
        <OperationalTableWorkspaceFrame onClose={handleCloseWorkspace}>
          <ErrorState
            title="Table unavailable"
            description="The selected table is not accessible on this Floor. Close this context and choose another table."
          />
        </OperationalTableWorkspaceFrame>
      ) : null}
    </>
  );
}
