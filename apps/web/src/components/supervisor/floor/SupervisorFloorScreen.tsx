import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { OperationalTableWorkspaceFrame } from "@/components/floor/OperationalTableWorkspaceFrame";
import { ErrorState } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupervisorContext } from "@/lib/supervisor/context";
import {
  fetchSupervisorFloorPlans,
  fetchSupervisorTables,
  type SupervisorFloorData,
} from "@/lib/supervisor/floor";
import { fetchSupervisorReservations } from "@/lib/supervisor/reservations";
import { FloorScreen } from "@/screens/floor/FloorScreen";
import { errorWords } from "@/screens/shared/words";
import { loadAllActiveOrders } from "@/screens/floor/floor-data";
import {
  normalizeSupervisorFloorTables,
  type SupervisorFloorTableViewModel,
} from "@/lib/supervisor/floor-model";
import { firstLegacyQueryValue } from "@/lib/supervisor/legacy-orders-route";
import { fetchSupervisorOrderDetail } from "@/lib/supervisor/orders";

import { SupervisorFindOrderDialog } from "./SupervisorFindOrderDialog";
import { SupervisorTableControlWorkspace } from "./SupervisorTableControlWorkspace";

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        title: "Floor access blocked",
        description: "This supervisor account cannot read branch Floor data.",
      };
    }
    if (error.isAuthError) {
      return { title: "Session expired", description: "Please log in again to continue." };
    }
    return { title: "Could not load floor", description: errorWords(error) };
  }

  return {
    title: "Could not load floor",
    description: errorWords(error, "Try again when the connection is stable."),
  };
}

const FLOOR_VIEWER = { ownership: "names" as const };

export function SupervisorFloorScreen() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const context = useSupervisorContext();
  const [selectionOverride, setSelectionOverride] = useState<string | null>();
  const [findOpen, setFindOpen] = useState(false);
  const selectionPushedRef = useRef(false);
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);
  const canUpdateStatus = context.permissions.includes("pos:table:write");
  const routeTableId = firstLegacyQueryValue(router.query.tableId) || undefined;
  const requestedOrderId = firstLegacyQueryValue(router.query.orderId) || undefined;
  const selectedTableId = selectionOverride === undefined ? routeTableId : selectionOverride || undefined;

  const floorQuery = useQuery({
    queryKey: ["supervisor", "floor", branchId],
    enabled: canQuery,
    queryFn: async (): Promise<SupervisorFloorData> => {
      const token = accessToken as string;
      const branch = branchId as string;
      const [floorPlans, tables, activeOrders, reservations] = await Promise.all([
        fetchSupervisorFloorPlans(token, branch),
        fetchSupervisorTables(token, branch),
        loadAllActiveOrders<SupervisorFloorData["activeOrders"][number]>(token, branch),
        fetchSupervisorReservations(token, branch, { pageSize: 200 }),
      ]);
      return { floorPlans, tables, activeOrders, reservations: reservations.data || [] };
    },
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const tables = useMemo(
    () => normalizeSupervisorFloorTables({
      tables: floorQuery.data?.tables || [],
      activeOrders: floorQuery.data?.activeOrders || [],
      reservations: floorQuery.data?.reservations || [],
    }),
    [floorQuery.data],
  );

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, tables],
  );
  const floorOrder = requestedOrderId
    ? floorQuery.data?.activeOrders.find((order) => order.id === requestedOrderId)
    : undefined;

  const orderContextQuery = useQuery({
    queryKey: ["supervisor", "order-detail", branchId, requestedOrderId],
    enabled: canQuery && Boolean(requestedOrderId),
    queryFn: () => fetchSupervisorOrderDetail(accessToken as string, branchId as string, requestedOrderId as string),
    placeholderData: floorOrder,
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  useEffect(() => {
    if (floorQuery.error instanceof ApiError && floorQuery.error.isAuthError) clearSession();
    if (orderContextQuery.error instanceof ApiError && orderContextQuery.error.isAuthError) clearSession();
  }, [clearSession, floorQuery.error, orderContextQuery.error]);

  useEffect(() => {
    setSelectionOverride(undefined);
  }, [routeTableId]);

  useEffect(() => {
    if (!router.isReady || routeTableId || !requestedOrderId || !orderContextQuery.data) return;
    const resolvedTableId = orderContextQuery.data.table?.id || orderContextQuery.data.tableId || null;
    if (!resolvedTableId) return;
    setSelectionOverride(resolvedTableId);
    void router.replace(
      { pathname: "/supervisor/floor", query: { tableId: resolvedTableId, orderId: requestedOrderId } },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [orderContextQuery.data, requestedOrderId, routeTableId, router, router.isReady]);

  function handleSelectTable(table: SupervisorFloorTableViewModel) {
    const hasSelection = Boolean(selectedTableId || requestedOrderId);
    selectionPushedRef.current = !hasSelection;
    setSelectionOverride(table.id);
    const query: Record<string, string> = { tableId: table.id };
    if (table.activeOrderId) query.orderId = table.activeOrderId;
    const target = { pathname: "/supervisor/floor", query };
    if (hasSelection) void router.replace(target, undefined, { shallow: true, scroll: false });
    else void router.push(target, undefined, { shallow: true, scroll: false });
  }

  function handleNavigateToOrder({ orderId, tableId }: { orderId: string; tableId?: string | null }) {
    setSelectionOverride(tableId ?? null);
    const query: Record<string, string> = { orderId };
    if (tableId) query.tableId = tableId;
    void router.replace({ pathname: "/supervisor/floor", query }, undefined, { shallow: true, scroll: false });
  }

  // Find order → open the canonical order workspace. Table-linked orders anchor to
  // their table; tableless/takeaway orders open with orderId only (no fabricated
  // table). Pushes a history entry only when opening from a clean Floor.
  function handleFindSelect({ orderId, tableId }: { orderId: string; tableId: string | null }) {
    setFindOpen(false);
    const hasSelection = Boolean(selectedTableId || requestedOrderId);
    selectionPushedRef.current = !hasSelection;
    setSelectionOverride(tableId ?? null);
    const query: Record<string, string> = { orderId };
    if (tableId) query.tableId = tableId;
    const target = { pathname: "/supervisor/floor", query };
    if (hasSelection) void router.replace(target, undefined, { shallow: true, scroll: false });
    else void router.push(target, undefined, { shallow: true, scroll: false });
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
    void router.replace("/supervisor/floor", undefined, { shallow: true, scroll: false });
  }

  const floorError = floorQuery.isError ? getErrorCopy(floorQuery.error) : null;
  const invalidSelectedTable = Boolean(
    selectedTableId && !floorQuery.isLoading && !floorQuery.isError && !selectedTable,
  );
  const isResolvingSelectedTable = Boolean(
    selectedTableId && floorQuery.isLoading && !selectedTable,
  );

  return (
    <>
      <FloorScreen
        role="supervisor"
        source={floorQuery.data}
        readAt={floorQuery.dataUpdatedAt}
        viewer={FLOOR_VIEWER}
        isLoading={floorQuery.isLoading}
        error={floorError}
        onRetry={() => void floorQuery.refetch()}
        onOpenTable={(tableId) => {
          const table = tables.find((entry) => entry.id === tableId);
          if (table) handleSelectTable(table);
        }}
        extraAction={canQuery ? { label: "Find order", icon: "search", onClick: () => setFindOpen(true) } : undefined}
      />

      {findOpen && accessToken && branchId ? (
        <SupervisorFindOrderDialog
          token={accessToken}
          branchId={branchId}
          onClose={() => setFindOpen(false)}
          onSelectOrder={handleFindSelect}
        />
      ) : null}

      {(selectedTable || requestedOrderId) && !invalidSelectedTable && !isResolvingSelectedTable ? (
        <OperationalTableWorkspaceFrame onClose={handleCloseWorkspace}>
          <SupervisorTableControlWorkspace
            table={selectedTable}
            requestedOrderId={requestedOrderId}
            canUpdateStatus={canUpdateStatus}
            permissions={context.permissions}
            onClose={handleCloseWorkspace}
            onNavigateToOrder={handleNavigateToOrder}
          />
        </OperationalTableWorkspaceFrame>
      ) : null}

      {invalidSelectedTable ? (
        <OperationalTableWorkspaceFrame onClose={handleCloseWorkspace}>
          <div className="grid gap-5">
            <button
              type="button"
              className="w-fit rounded-md px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus"
              onClick={handleCloseWorkspace}
            >
              Back to Floor
            </button>
            <ErrorState
              title="Table unavailable"
              description="The selected table is not accessible on this Floor. Return to Floor and choose another table."
            />
          </div>
        </OperationalTableWorkspaceFrame>
      ) : null}
    </>
  );
}
