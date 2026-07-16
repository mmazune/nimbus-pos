import { apiRequest } from "@/lib/api/client";

export type WaiterReservationDepositApi = {
  id?: string;
  amount?: string | number | null;
  status?: string | null;
  method?: string | null;
  reference?: string | null;
  recordedAt?: string | null;
};

export type WaiterReservationOrderApi = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  tableId?: string | null;
};

export type WaiterReservationApi = {
  id: string;
  reservationNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  partySize?: number | null;
  reservationAt?: string | null;
  expectedDurationMinutes?: number | null;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  specialRequests?: string | null;
  tableId?: string | null;
  seatedAt?: string | null;
  seatedOrderId?: string | null;
  depositRequired?: string | number | null;
  deposits?: WaiterReservationDepositApi[] | null;
  table?: {
    id: string;
    label?: string | null;
    capacity?: number | null;
  } | null;
  seatedOrder?: WaiterReservationOrderApi | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PaginatedWaiterReservationsResponse = {
  data: WaiterReservationApi[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type WaiterReservationListQuery = {
  status?: string;
  date?: string;
  upcoming?: boolean;
  tableId?: string;
  page?: number;
  pageSize?: number;
};

export type SeatReservationPayload = {
  tableId?: string;
  createOrder?: boolean;
  orderNotes?: string;
};

function buildReservationsQueryString(query: WaiterReservationListQuery = {}) {
  const params = new URLSearchParams();

  if (query.status) params.set("status", query.status);
  if (query.date) params.set("date", query.date);
  if (query.upcoming !== undefined) params.set("upcoming", String(query.upcoming));
  if (query.tableId) params.set("tableId", query.tableId);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

export async function listUpcomingReservations(
  token: string,
  branchId: string,
  query: WaiterReservationListQuery = {},
) {
  if (Object.keys(query).length > 0) {
    const response = await apiRequest<PaginatedWaiterReservationsResponse>(
      `/api/reservations${buildReservationsQueryString(query)}`,
      { token, branchId },
    );

    return response;
  }

  const response = await apiRequest<WaiterReservationApi[]>("/api/reservations/upcoming", {
    token,
    branchId,
  });

  return {
    data: response,
    total: response.length,
    page: 1,
    pageSize: response.length,
  };
}

export function getReservation(token: string, branchId: string, reservationId: string) {
  return apiRequest<WaiterReservationApi>(`/api/reservations/${reservationId}`, {
    token,
    branchId,
  });
}

export function seatReservation(
  token: string,
  branchId: string,
  reservationId: string,
  payload: SeatReservationPayload,
) {
  return apiRequest<WaiterReservationApi>(`/api/reservations/${reservationId}/seat`, {
    method: "PATCH",
    token,
    branchId,
    body: payload,
  });
}
