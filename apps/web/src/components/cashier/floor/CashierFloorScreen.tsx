import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { OperationalTableWorkspaceFrame } from "@/components/floor/OperationalTableWorkspaceFrame";
import { ErrorState } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cashierBillQueryKeys } from "@/lib/cashier/bill-query-keys";
import { useCashierContext } from "@/lib/cashier/context";
import { listCashierOperationalReservations, type CashierFloorData } from "@/lib/cashier/floor-api";
import type { CashierOrderApi } from "@/lib/cashier/order-types";
import { listCashierTables } from "@/lib/cashier/resolution";
import { FloorScreen } from "@/screens/floor/FloorScreen";
import { errorWords } from "@/screens/shared/words";
import { loadAllActiveOrders } from "@/screens/floor/floor-data";
import {
  normalizeCashierFloorTables,
  type CashierFloorTableViewModel,
} from "@/lib/cashier/floor-model";
import {
  CASHIER_FLOOR_ROUTE,
  buildCashierBillQuery,
  clearCashierBillQuery,
  firstCashierQueryValue,
} from "@/lib/cashier/floor-route";
import { useCashierReadiness } from "@/lib/cashier/readiness";

import { CashierBillResolutionPanel } from "./CashierBillResolutionPanel";
import { CashierFindBillDialog } from "./CashierFindBillDialog";
import { CashierSettlementWorkspace } from "./CashierSettlementWorkspace";

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        title: "Floor access blocked",
        description: "This cashier account cannot read branch Floor data.",
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

/**
 * Cashier Floor screen (Prompt C2 resolution + Prompt C3 settlement execution).
 *
 * Cashier is the third consumer of the shared `OperationalFloor`. Behaviour
 * differs from Waiter/Supervisor ONLY after selection:
 *  - selecting a table opens `CashierBillResolutionPanel` (zero / one / multiple
 *    payable bill resolution → the canonical settlement workspace);
 *  - a compact Cashier-only **Find bill** sibling (never inside the shared Floor)
 *    opens tableless/takeaway/closed bills into the SAME workspace via orderId.
 *
 * URL state: `?tableId=` (table context) and `?orderId=` (selected bill), both
 * refresh / Back / Forward safe. Floor and resolution stay read-only; payment,
 * partial/split settlement, and close execute inside the settlement workspace
 * (C3). Refund, receipt, transfer, void, and discount remain out of scope.
 */
const FLOOR_VIEWER = { ownership: "names" as const };

export function CashierFloorScreen() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isCashier } = useAuth();
  const context = useCashierContext();
  const readiness = useCashierReadiness();
  const [selectionOverride, setSelectionOverride] = useState<string | null>();
  const [findOpen, setFindOpen] = useState(false);
  const selectionPushedRef = useRef(false);
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isCashier);
  const routeTableId = firstCashierQueryValue(router.query.tableId) || undefined;
  const requestedOrderId = firstCashierQueryValue(router.query.orderId) || undefined;
  const selectedTableId = selectionOverride === undefined ? routeTableId : selectionOverride || undefined;

  const floorQuery = useQuery({
    queryKey: cashierBillQueryKeys.floor(branchId),
    enabled: canQuery,
    queryFn: async (): Promise<CashierFloorData> => {
      const token = accessToken as string;
      const branch = branchId as string;
      const [tables, activeOrders, reservations] = await Promise.all([
        listCashierTables(token, branch),
        loadAllActiveOrders<CashierOrderApi>(token, branch),
        listCashierOperationalReservations(token, branch),
      ]);
      return { tables, activeOrders, reservations };
    },
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (floorQuery.error instanceof ApiError && floorQuery.error.isAuthError) clearSession();
  }, [clearSession, floorQuery.error]);

  useEffect(() => {
    setSelectionOverride(undefined);
  }, [routeTableId]);

  const tables = useMemo(
    () =>
      normalizeCashierFloorTables({
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

  const floorOrder = useMemo(
    () =>
      requestedOrderId
        ? floorQuery.data?.activeOrders.find((order) => order.id === requestedOrderId)
        : undefined,
    [floorQuery.data?.activeOrders, requestedOrderId],
  );

  function handleSelectTable(table: CashierFloorTableViewModel) {
    const hasSelection = Boolean(selectedTableId || requestedOrderId);
    selectionPushedRef.current = !hasSelection;
    setSelectionOverride(table.id);
    const target = {
      pathname: CASHIER_FLOOR_ROUTE,
      query: buildCashierBillQuery(router.query, { tableId: table.id, orderId: null }),
    };
    if (hasSelection) void router.replace(target, undefined, { shallow: true, scroll: false });
    else void router.push(target, undefined, { shallow: true, scroll: false });
  }

  // Exactly one payable bill on the selected table — resolve into the workspace
  // WITHOUT a new history entry (Back from the workspace returns to Floor).
  function handleResolveSingle(orderId: string) {
    void router.replace(
      {
        pathname: CASHIER_FLOOR_ROUTE,
        query: buildCashierBillQuery(router.query, { tableId: selectedTableId ?? null, orderId }),
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  // Explicit pick from the multiple-bill selector — pushes history so browser
  // Back returns to the selector.
  function handleSelectBill(orderId: string) {
    void router.push(
      {
        pathname: CASHIER_FLOOR_ROUTE,
        query: buildCashierBillQuery(router.query, { tableId: selectedTableId ?? null, orderId }),
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  // "Back to bills" — deterministically return to the table's bill list.
  function handleBackToBills() {
    void router.replace(
      { pathname: CASHIER_FLOOR_ROUTE, query: clearCashierBillQuery(router.query) },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  // Find bill → open the canonical settlement workspace. Table-linked bills
  // anchor to their table; tableless/takeaway bills open with orderId only.
  function handleFindSelect({ orderId, tableId }: { orderId: string; tableId: string | null }) {
    setFindOpen(false);
    const hasSelection = Boolean(selectedTableId || requestedOrderId);
    selectionPushedRef.current = !hasSelection;
    setSelectionOverride(tableId ?? null);
    const target = {
      pathname: CASHIER_FLOOR_ROUTE,
      query: buildCashierBillQuery(router.query, { tableId: tableId ?? null, orderId }),
    };
    if (hasSelection) void router.replace(target, undefined, { shallow: true, scroll: false });
    else void router.push(target, undefined, { shallow: true, scroll: false });
  }

  function handleCloseWorkspace() {
    const tableIdToFocus = selectedTableId;
    setSelectionOverride(null);
    window.setTimeout(() => {
      const target = [...document.querySelectorAll<HTMLElement>("[data-operational-table-id]")].find(
        (element) => element.dataset.operationalTableId === tableIdToFocus,
      );
      target?.focus();
    }, 0);
    if (selectionPushedRef.current) {
      selectionPushedRef.current = false;
      router.back();
      return;
    }
    void router.replace(
      { pathname: CASHIER_FLOOR_ROUTE, query: buildCashierBillQuery(router.query, { tableId: null, orderId: null }) },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  const floorError = floorQuery.isError ? getErrorCopy(floorQuery.error) : null;
  const resolvingTable = Boolean(selectedTableId) && floorQuery.isLoading && !selectedTable;
  const invalidSelectedTable = Boolean(
    selectedTableId && !floorQuery.isLoading && !floorQuery.isError && !selectedTable,
  );
  // A bill opened without a valid table context (tableless/takeaway/Find bill, or
  // a table that is not on this Floor) resolves directly by orderId.
  const directBill = Boolean(requestedOrderId) && (!selectedTableId || invalidSelectedTable);

  return (
    <>
      <FloorScreen
        role="cashier"
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
        extraAction={canQuery ? { label: "Find bill", icon: "search", onClick: () => setFindOpen(true) } : undefined}
      />

      {findOpen && accessToken && branchId ? (
        <CashierFindBillDialog
          token={accessToken}
          branchId={branchId}
          fallbackBranchName={context.branchName}
          onClose={() => setFindOpen(false)}
          onSelectBill={handleFindSelect}
        />
      ) : null}

      {selectedTable && !resolvingTable && accessToken && branchId ? (
        <OperationalTableWorkspaceFrame onClose={handleCloseWorkspace}>
          <CashierBillResolutionPanel
            table={selectedTable}
            selectedOrderId={requestedOrderId}
            token={accessToken}
            branchId={branchId}
            fallbackBranchName={context.branchName}
            readiness={readiness}
            onResolveSingle={handleResolveSingle}
            onSelectBill={handleSelectBill}
            onBackToBills={handleBackToBills}
            onClose={handleCloseWorkspace}
          />
        </OperationalTableWorkspaceFrame>
      ) : null}

      {directBill && !resolvingTable && accessToken && branchId ? (
        <OperationalTableWorkspaceFrame onClose={handleCloseWorkspace}>
          <CashierSettlementWorkspace
            orderId={requestedOrderId as string}
            token={accessToken}
            branchId={branchId}
            tableId={selectedTableId ?? null}
            fallbackBranchName={context.branchName}
            fallbackOrder={floorOrder}
            readiness={readiness}
            onClose={handleCloseWorkspace}
          />
        </OperationalTableWorkspaceFrame>
      ) : null}

      {invalidSelectedTable && !requestedOrderId ? (
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
