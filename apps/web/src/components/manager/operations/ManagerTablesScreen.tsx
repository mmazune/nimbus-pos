import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";

import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { OrderScreen } from "@/screens/order/OrderScreen";
import { OperationalFloor } from "@/components/floor";
import { useManagerFloor } from "@/lib/manager/operations-context";
import { type ManagerFloorTableViewModel } from "@/lib/manager/operations-model";
import { buildManagerListQuery, firstManagerQueryValue } from "@/lib/manager/operations-route";

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
 * T3 (26 Nov 2026, R1): one tap on a table opens the same order screen for every
 * role, here under the top bar (drawing Order-Laptop). Rights change the buttons:
 * a manager may add, send, void a line, use the table actions and take payment.
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

      />

      <p className="max-w-3xl text-sm text-text-secondary">
        {floor.isLoading
          ? "Reading the floor for this branch…"
          : floor.isError
            ? "The floor snapshot could not be read for this branch."
            : `${counts.total} tables on this floor — ${counts.occupied} occupied, ${counts.reserved} reserved. Tap a table to open its order: the same screen every role uses.`}
      </p>

      <div className="min-w-0">
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

      </div>
      {selected ? (
        <OrderScreen
          key={selected.id}
          role="manager"
          frame="laptop"
          trail="Floor"
          tableId={selected.id}
          tableLabel={selected.label}
          seats={selected.capacity}
          onClose={() => selectTable(null)}
          onChanged={floor.refetch}
        />
      ) : null}
    </ManagerContentShell>
  );
}
