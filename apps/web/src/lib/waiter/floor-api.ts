import { apiRequest } from "@/lib/api/client";

export type WaiterTableApi = {
  id: string;
  label: string;
  capacity?: number | null;
  status?: string | null;
  isActive?: boolean | null;
  floorPlanId?: string | null;
  floorPlan?: {
    id: string;
    name?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
};

export type WaiterOrderApi = {
  id: string;
  tableId?: string | null;
  userId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  serviceType?: string | null;
  total?: string | number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  table?: {
    id: string;
    label?: string | null;
  } | null;
  user?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  items?: Array<{ id: string }> | null;
};

export type WaiterReservationApi = {
  id: string;
  reservationNumber?: string | null;
  customerName?: string | null;
  partySize?: number | null;
  reservationAt?: string | null;
  status?: string | null;
  tableId?: string | null;
  seatedOrderId?: string | null;
  table?: {
    id: string;
    label?: string | null;
    capacity?: number | null;
  } | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type WaiterFloorData = {
  tables: WaiterTableApi[];
  activeOrders: WaiterOrderApi[];
  reservations: WaiterReservationApi[];
};

export function listWaiterTables(token: string, branchId: string) {
  return apiRequest<WaiterTableApi[]>("/api/tables", { token, branchId });
}

export function getWaiterTable(token: string, branchId: string, tableId: string) {
  return apiRequest<WaiterTableApi>(`/api/tables/${tableId}`, { token, branchId });
}

export async function listWaiterActiveOrders(token: string, branchId: string) {
  const response = await apiRequest<PaginatedResponse<WaiterOrderApi>>(
    "/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100",
    { token, branchId },
  );

  return response.data || [];
}

export async function listWaiterOperationalReservations(token: string, branchId: string) {
  const response = await apiRequest<PaginatedResponse<WaiterReservationApi>>(
    "/api/reservations?pageSize=200",
    { token, branchId },
  );

  return response.data || [];
}

export async function loadWaiterFloorData(token: string, branchId: string): Promise<WaiterFloorData> {
  const [tables, activeOrders, reservations] = await Promise.all([
    listWaiterTables(token, branchId),
    listWaiterActiveOrders(token, branchId),
    listWaiterOperationalReservations(token, branchId),
  ]);

  return { tables, activeOrders, reservations };
}
