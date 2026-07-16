import { apiRequest } from "@/lib/api/client";
import type {
  CashierOrderApi,
  CashierOrderPaymentsApi,
  CashierOrdersListQuery,
  CashierPaginatedOrdersResponse,
} from "@/lib/cashier/order-types";

function buildOrdersQueryString(query: CashierOrdersListQuery = {}) {
  const params = new URLSearchParams();

  if (query.status) params.set("status", query.status);
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.tableId) params.set("tableId", query.tableId);
  if (query.userId) params.set("userId", query.userId);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  if (query.excludeStatus) {
    const value = Array.isArray(query.excludeStatus)
      ? query.excludeStatus.join(",")
      : query.excludeStatus;
    if (value) params.set("excludeStatus", value);
  }

  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

export function listCashierOrders(
  token: string,
  branchId: string,
  query: CashierOrdersListQuery = {},
) {
  return apiRequest<CashierPaginatedOrdersResponse>(
    `/api/pos/orders${buildOrdersQueryString(query)}`,
    { token, branchId },
  );
}

export function getCashierOrder(token: string, branchId: string, orderId: string) {
  return apiRequest<CashierOrderApi>(`/api/pos/orders/${orderId}`, { token, branchId });
}

export function getCashierOrderPayments(token: string, branchId: string, orderId: string) {
  return apiRequest<CashierOrderPaymentsApi>(`/api/pos/orders/${orderId}/payments`, {
    token,
    branchId,
  });
}
