import { apiRequest } from "@/lib/api/client";
import type {
  CashierResolutionMutationResponse,
  CashierSplitBillResponse,
  CashierTableApi,
  MergeCashierOrdersInput,
  MoveCashierOrderItemsInput,
  SplitCashierBillInput,
  SplitCashierItemsInput,
  TransferCashierOrderServerInput,
  TransferCashierOrderTableInput,
} from "@/lib/cashier/resolution-types";

function idempotencyHeaders(idempotencyKey: string) {
  return { "Idempotency-Key": idempotencyKey };
}

export function listCashierTables(token: string, branchId: string) {
  return apiRequest<CashierTableApi[]>("/api/tables", {
    token,
    branchId,
  });
}

export function splitCashierBill({
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
  input: SplitCashierBillInput;
}) {
  return apiRequest<CashierSplitBillResponse>(`/api/pos/orders/${orderId}/split-bill`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function splitCashierItems({
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
  input: SplitCashierItemsInput;
}) {
  return apiRequest<CashierResolutionMutationResponse>(`/api/pos/orders/${orderId}/split-items`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function mergeCashierOrders({
  token,
  branchId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  idempotencyKey: string;
  input: MergeCashierOrdersInput;
}) {
  return apiRequest<CashierResolutionMutationResponse>("/api/pos/orders/merge", {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function moveCashierOrderItems({
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
  input: MoveCashierOrderItemsInput;
}) {
  return apiRequest<CashierResolutionMutationResponse>(`/api/pos/orders/${orderId}/move-items`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function transferCashierOrderTable({
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
  input: TransferCashierOrderTableInput;
}) {
  return apiRequest<CashierResolutionMutationResponse>(`/api/pos/orders/${orderId}/transfer-table`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function transferCashierOrderServer({
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
  input: TransferCashierOrderServerInput;
}) {
  return apiRequest<CashierResolutionMutationResponse>(`/api/pos/orders/${orderId}/transfer-server`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}
