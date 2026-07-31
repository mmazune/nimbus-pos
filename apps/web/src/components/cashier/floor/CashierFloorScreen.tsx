import { MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { OperationalFloor } from "@/components/floor/OperationalFloor";
import { OperationalTableWorkspaceFrame } from "@/components/floor/OperationalTableWorkspaceFrame";
import { Button, ErrorState } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cashierBillQueryKeys } from "@/lib/cashier/bill-query-keys";
import { useCashierContext } from "@/lib/cashier/context";
import { loadCashierFloorData } from "@/lib/cashier/floor-api";
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
    return { title: "Could not load floor", description: error.message };
  }

  return {
    title: "Could not load floor",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

/**
 * Cashier Floor screen (Prompt C2).
 *
 * Cashier is the third consumer of the shared `OperationalFloor`. Behaviour
 * differs from Waiter/Supervisor ONLY after selection:
 *  - selecting a table opens `CashierBillResolutionPanel` (zero / one / multiple
 *    payable bill resolution → the canonical settlement workspace);
 *  - a compact Cashier-only **Find bill** sibling (never inside the shared Floor)
 *    opens tableless/takeaway/closed bills into the SAME workspace via orderId.
 *
 * URL state: `?tableId=` (table context) and `?orderId=` (selected bill), both
 * refresh / Back / Forward safe. Everything here is READ-ONLY — no payment,
 * split, close, refund, receipt, transfer, void, or discount affordance.
 */
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
    queryFn: () => loadCashierFloorData(accessToken as string, branchId as string),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
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
      {/* Cashier-only workspace control. Rendered as a sibling ABOVE the shared
          OperationalFloor — it never forks the shared Floor presentation. */}
      <div className="-mb-2 flex justify-end">
        <Button variant="secondary" size="compact" onClick={() => setFindOpen(true)} disabled={!canQuery}>
          <span className="inline-flex items-center gap-2">
            <MagnifyingGlass size={18} weight="bold" aria-hidden />
            Find bill
          </span>
        </Button>
      </div>

      <OperationalFloor
        branchName={context.branchName}
        readinessLabel={readiness.shift.label}
        readinessTone={readiness.shift.tone}
        tables={tables}
        isLoading={floorQuery.isLoading}
        error={floorError}
        selectedTableId={selectedTableId}
        onSelectTable={handleSelectTable}
        onRetry={() => void floorQuery.refetch()}
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
