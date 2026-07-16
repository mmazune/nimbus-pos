import { apiRequest } from "@/lib/api/client";
import type {
  CashierReceiptApi,
  CashierReceiptHistoryApi,
  CashierReceiptReprintInput,
  CashierReceiptReprintResponse,
  CashierReceiptSendInput,
  CashierReceiptSendResponse,
} from "@/lib/cashier/receipt-types";

function idempotencyHeaders(idempotencyKey: string) {
  return { "Idempotency-Key": idempotencyKey };
}

export function getCashierReceipt(token: string, branchId: string, receiptId: string) {
  return apiRequest<CashierReceiptApi>(`/api/receipts/${receiptId}`, {
    token,
    branchId,
  });
}

export function getCashierReceiptHistory(token: string, branchId: string, receiptId: string) {
  return apiRequest<CashierReceiptHistoryApi>(`/api/receipts/${receiptId}/history?pageSize=50`, {
    token,
    branchId,
  });
}

export function requestCashierReceiptReprint({
  token,
  branchId,
  receiptId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  receiptId: string;
  idempotencyKey: string;
  input: CashierReceiptReprintInput;
}) {
  return apiRequest<CashierReceiptReprintResponse>(`/api/receipts/${receiptId}/reprint`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function requestCashierReceiptSend({
  token,
  branchId,
  receiptId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  receiptId: string;
  idempotencyKey: string;
  input: CashierReceiptSendInput;
}) {
  return apiRequest<CashierReceiptSendResponse>(`/api/receipts/${receiptId}/send`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}
