import { apiRequest } from "@/lib/api/client";
import type { CashierOrderApi } from "@/lib/cashier/order-types";
import { listCashierOrders } from "@/lib/cashier/orders";
import { listCashierTables } from "@/lib/cashier/resolution";
import type { CashierTableApi } from "@/lib/cashier/resolution-types";

/**
 * Cashier Floor data contract (Prompt C1).
 *
 * Cashier is the third consumer of the shared `OperationalFloor` alongside
 * Waiter and Supervisor. It reads the SAME canonical Floor endpoints every
 * operational role already uses — `/api/tables`, `/api/pos/orders`, and
 * `/api/reservations` — via one bounded query domain (`loadCashierFloorData`).
 * There is NO Cashier-specific Floor endpoint and NO per-table payment fetch:
 * table status is derived client-side exactly as Supervisor's read-first Floor
 * already does. Cashier holds `pos:table:read`, `pos:orders:read`, and
 * `pos:reservation:read` (verified in the C0 permission matrix), so nothing here
 * requires a new grant.
 */

export type CashierFloorReservationApi = {
  id: string;
  reservationNumber?: string | null;
  partySize?: number | null;
  reservationAt?: string | null;
  status?: string | null;
  tableId?: string | null;
  table?: {
    id: string;
    label?: string | null;
    capacity?: number | null;
  } | null;
};

type CashierReservationsResponse = {
  data?: CashierFloorReservationApi[] | null;
};

export type CashierFloorData = {
  tables: CashierTableApi[];
  activeOrders: CashierOrderApi[];
  reservations: CashierFloorReservationApi[];
};

export async function listCashierActiveOrders(token: string, branchId: string) {
  const response = await listCashierOrders(token, branchId, {
    excludeStatus: ["CLOSED", "VOIDED"],
    pageSize: 100,
  });

  return response.data || [];
}

export async function listCashierOperationalReservations(token: string, branchId: string) {
  const response = await apiRequest<CashierReservationsResponse>(
    "/api/reservations?pageSize=200",
    { token, branchId },
  );

  return response.data || [];
}

export async function loadCashierFloorData(token: string, branchId: string): Promise<CashierFloorData> {
  const [tables, activeOrders, reservations] = await Promise.all([
    listCashierTables(token, branchId),
    listCashierActiveOrders(token, branchId),
    listCashierOperationalReservations(token, branchId),
  ]);

  return { tables, activeOrders, reservations };
}
