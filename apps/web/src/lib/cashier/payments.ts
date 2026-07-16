import { apiRequest } from "@/lib/api/client";
import type {
  CashierCloseOrderResponse,
  CashierManualReferencePaymentResponse,
  CashierPaymentIntentResponse,
  CloseCashierOrderInput,
  CreateCashierManualReferencePaymentInput,
  CreateCashierPaymentIntentInput,
} from "@/lib/cashier/payment-types";

function idempotencyHeaders(idempotencyKey: string) {
  return { "Idempotency-Key": idempotencyKey };
}

export function createCashierManualReferencePayment({
  token,
  branchId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  idempotencyKey: string;
  input: CreateCashierManualReferencePaymentInput;
}) {
  return apiRequest<CashierManualReferencePaymentResponse>("/api/payments/manual-reference", {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export function createCashierPaymentIntent({
  token,
  branchId,
  idempotencyKey,
  input,
}: {
  token: string;
  branchId: string;
  idempotencyKey: string;
  input: CreateCashierPaymentIntentInput;
}) {
  return apiRequest<CashierPaymentIntentResponse>("/api/payments/intents", {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: { ...input, idempotencyKey },
  });
}

export function closeCashierOrder({
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
  input: CloseCashierOrderInput;
}) {
  return apiRequest<CashierCloseOrderResponse>(`/api/pos/orders/${orderId}/close`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}
