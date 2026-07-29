import { apiRequest } from "@/lib/api/client";
import {
  fetchSupervisorOrders,
  type SupervisorOrderListItem,
} from "@/lib/supervisor/orders";
import {
  fetchSupervisorReservations,
  type SupervisorReservation,
} from "@/lib/supervisor/reservations";

export type SupervisorTableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";

export const supervisorTableStatuses: SupervisorTableStatus[] = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "CLEANING",
];

export type SupervisorFloorPlan = {
  id: string;
  name: string;
  data?: Record<string, unknown> | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  tables?: SupervisorTable[];
};

export type SupervisorTable = {
  id: string;
  label: string;
  capacity?: number | null;
  status?: SupervisorTableStatus | string | null;
  isActive?: boolean | null;
  floorPlanId?: string | null;
  floorPlan?: {
    id: string;
    name?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SupervisorAvailabilitySummary = {
  total?: number;
  available?: number;
  occupied?: number;
  reserved?: number;
  cleaning?: number;
};

export type SupervisorAvailabilityTable = Pick<
  SupervisorTable,
  "id" | "label" | "capacity" | "status" | "floorPlanId"
>;

export type SupervisorFloorAvailability = {
  summary?: SupervisorAvailabilitySummary;
  tables?: SupervisorAvailabilityTable[];
};

export type SupervisorFloorData = {
  floorPlans: SupervisorFloorPlan[];
  tables: SupervisorTable[];
  activeOrders: SupervisorOrderListItem[];
  reservations: SupervisorReservation[];
};

export function fetchSupervisorFloorPlans(token: string, branchId: string) {
  return apiRequest<SupervisorFloorPlan[]>("/api/floor-plans", { token, branchId });
}

export function fetchSupervisorFloorPlanDetail(token: string, branchId: string, floorPlanId: string) {
  return apiRequest<SupervisorFloorPlan>(`/api/floor-plans/${floorPlanId}`, { token, branchId });
}

export function fetchSupervisorTables(token: string, branchId: string) {
  return apiRequest<SupervisorTable[]>("/api/tables", { token, branchId });
}

export function fetchSupervisorFloorAvailability(token: string, branchId: string) {
  return apiRequest<SupervisorFloorAvailability>("/api/floor/availability", { token, branchId });
}

export function fetchSupervisorTableDetail(token: string, branchId: string, tableId: string) {
  return apiRequest<SupervisorTable>(`/api/tables/${tableId}`, { token, branchId });
}

export function updateSupervisorTableStatus({
  branchId,
  status,
  tableId,
  token,
}: {
  branchId: string;
  status: SupervisorTableStatus;
  tableId: string;
  token: string;
}) {
  return apiRequest<SupervisorTable>(`/api/tables/${tableId}/status`, {
    method: "PATCH",
    token,
    branchId,
    body: { status },
  });
}

export async function loadSupervisorFloorData(token: string, branchId: string): Promise<SupervisorFloorData> {
  const [floorPlans, tables, ordersResponse, reservationsResponse] = await Promise.all([
    fetchSupervisorFloorPlans(token, branchId),
    fetchSupervisorTables(token, branchId),
    fetchSupervisorOrders(token, branchId, { excludeStatus: ["CLOSED", "VOIDED"], pageSize: 100 }),
    fetchSupervisorReservations(token, branchId, { pageSize: 200 }),
  ]);

  return {
    floorPlans,
    tables,
    activeOrders: ordersResponse.data || [],
    reservations: reservationsResponse.data || [],
  };
}
