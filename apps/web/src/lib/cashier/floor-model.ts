import {
  formatOperationalStaffIdentity,
  sortOperationalTables,
} from "@/components/floor/formatters";
import type { OperationalTableViewModel } from "@/components/floor/types";
import type { CashierOrderApi } from "@/lib/cashier/order-types";
import type { CashierFloorReservationApi } from "@/lib/cashier/floor-api";
import type { CashierTableApi } from "@/lib/cashier/resolution-types";

/**
 * Cashier Floor view model (Prompt C1).
 *
 * Produces the SAME `OperationalTableViewModel` shape that Waiter and Supervisor
 * feed into the shared `OperationalFloor`, so the toolbar, grid, cards, status
 * labels, staff formatting (`First L.`), reservation overlay, and sorting are
 * byte-for-byte identical across all three roles. Cashier's read-first Floor
 * mirrors Supervisor's derivation: table status comes from the backend table
 * status plus any active order / active reservation cross-reference — never from
 * a per-table payment fetch.
 *
 * Privacy: this model intentionally carries NO guest name, phone, email, payment
 * reference, or receipt reference. Only shared-safe card fields are populated.
 */

export type CashierFloorTableViewModel = OperationalTableViewModel & {
  raw: CashierTableApi;
  activeOrder?: CashierOrderApi;
  reservation?: CashierFloorReservationApi;
};

const HIDDEN_TABLE_STATUSES = new Set(["CLEANING", "BLOCKED", "UNAVAILABLE", "OUT_OF_SERVICE"]);
const ACTIVE_ORDER_STATUSES = new Set(["NEW", "SENT", "IN_KITCHEN", "READY", "SERVED"]);
const ACTIVE_RESERVATION_STATUSES = new Set(["PENDING", "CONFIRMED"]);

function formatReservationTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function normalizeCashierFloorTables({
  activeOrders,
  reservations,
  tables,
}: {
  activeOrders: CashierOrderApi[];
  reservations: CashierFloorReservationApi[];
  tables: CashierTableApi[];
}): CashierFloorTableViewModel[] {
  const orderByTable = new Map<string, CashierOrderApi>();
  activeOrders.forEach((order) => {
    const tableId = order.tableId || order.table?.id;
    if (!tableId || !ACTIVE_ORDER_STATUSES.has(String(order.status || "").toUpperCase())) return;
    if (!orderByTable.has(tableId)) orderByTable.set(tableId, order);
  });

  const reservationByTable = new Map<string, CashierFloorReservationApi>();
  reservations.forEach((reservation) => {
    const tableId = reservation.tableId || reservation.table?.id;
    if (!tableId || !ACTIVE_RESERVATION_STATUSES.has(String(reservation.status || "").toUpperCase())) return;
    if (!reservationByTable.has(tableId)) reservationByTable.set(tableId, reservation);
  });

  return sortOperationalTables(
    tables
      .filter((table) => {
        const status = String(table.status || "").toUpperCase();
        return table.isActive !== false && !HIDDEN_TABLE_STATUSES.has(status);
      })
      .map((table) => {
        const activeOrder = orderByTable.get(table.id);
        const reservation = reservationByTable.get(table.id);
        const backendStatus = String(table.status || "").toUpperCase();
        const orderStatus = String(activeOrder?.status || "").toUpperCase();
        const status =
          (activeOrder && orderStatus !== "NEW") || backendStatus === "OCCUPIED"
            ? "occupied"
            : reservation || backendStatus === "RESERVED"
              ? "reserved"
              : "available";

        return {
          id: table.id,
          label: table.label || "Table",
          floorPlanId: table.floorPlan?.id || null,
          floorPlanName: table.floorPlan?.name || null,
          capacity: table.capacity ?? reservation?.partySize ?? null,
          status,
          assignedStaffId: activeOrder?.userId || activeOrder?.user?.id || null,
          assignedStaffName: activeOrder?.user
            ? formatOperationalStaffIdentity(activeOrder.user)
            : null,
          isMine: false,
          activeOrderId: activeOrder?.id || null,
          activeOrderStatus: activeOrder?.status || null,
          reservationId: reservation?.id || null,
          reservationStatus: reservation?.status || null,
          reservationTime: formatReservationTime(reservation?.reservationAt),
          attentionState: null,
          disabledReason: null,
          raw: table,
          activeOrder,
          reservation,
        } satisfies CashierFloorTableViewModel;
      }),
  );
}
