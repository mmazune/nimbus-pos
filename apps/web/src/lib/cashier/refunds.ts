import { ApiError, apiRequest } from "@/lib/api/client";
import type { CashierRefundApi, CreateCashierRefundInput } from "@/lib/cashier/refund-types";

function idempotencyHeaders(idempotencyKey: string) {
  return { "Idempotency-Key": idempotencyKey };
}

export function listCashierOrderRefunds(token: string, branchId: string, orderId: string) {
  return apiRequest<CashierRefundApi[]>(`/api/pos/orders/${orderId}/refunds`, {
    token,
    branchId,
  });
}

export function getCashierRefund(token: string, branchId: string, refundId: string) {
  return apiRequest<CashierRefundApi>(`/api/pos/refunds/${refundId}`, {
    token,
    branchId,
  });
}

export function createCashierRefund({
  token,
  branchId,
  orderId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  orderId: string;
  idempotencyKey: string;
  input: CreateCashierRefundInput;
}) {
  return apiRequest<CashierRefundApi>(`/api/pos/orders/${orderId}/refunds`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function mapRefundApiError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : fallback;
  }

  const haystack = `${error.code} ${error.message}`.toLowerCase();

  if (error.isForbidden) return "Cashier does not have permission for this refund action.";
  if (error.status === 400 && haystack.includes("exceeds")) return error.message;
  if (error.status === 404 && haystack.includes("payment")) return "Selected completed payment was not found.";
  if (error.status === 404 && haystack.includes("order")) return "Order was not found for this branch.";
  if (error.status === 409 && haystack.includes("closed")) return "Refunds are available after close.";
  if (haystack.includes("idempotency_in_flight")) return "This refund request is already processing.";
  if (haystack.includes("payload_mismatch")) return "This retry does not match the original refund request.";
  if (haystack.includes("maintenance")) return "Refund writes are blocked by maintenance.";
  if (error.status === 423) return "Refund writes are blocked by maintenance.";

  return error.message || fallback;
}
