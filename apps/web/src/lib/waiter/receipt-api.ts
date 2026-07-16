import { apiRequest } from "@/lib/api/client";

export type RequestOrderBillResponse = {
  orderId?: string;
  orderNumber?: string;
  status?: string;
  billRequested?: boolean;
  requestedAt?: string;
  receipt?: WaiterReceiptApi;
  receiptId?: string;
  id?: string;
};

export type WaiterReceiptApi = {
  receiptId?: string;
  id?: string;
  receiptNumber?: string | null;
  orderId?: string;
  orderNumber?: string | null;
  status?: string | null;
  serviceType?: string | null;
  organization?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
  } | null;
  branch?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    currencyCode?: string | null;
    timezone?: string | null;
  } | null;
  table?: {
    id?: string;
    label?: string | null;
  } | null;
  server?: {
    id?: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
  guest?: {
    name?: string | null;
  } | null;
  customerName?: string | null;
  guestName?: string | null;
  totals?: {
    subtotal?: string | number | null;
    tax?: string | number | null;
    discount?: string | number | null;
    serviceCharge?: string | number | null;
    total?: string | number | null;
    paid?: string | number | null;
    outstanding?: string | number | null;
    currencyCode?: string | null;
  } | null;
  items?: WaiterReceiptLineApi[] | null;
  payments?: Array<{
    id?: string;
    method?: string | null;
    status?: string | null;
    amount?: string | number | null;
    transactionId?: string | null;
    postedAt?: string | null;
  }> | null;
  footer?: string | null;
  timestamps?: {
    openedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  createdAt?: string | null;
  history?: {
    viewedCount?: number | null;
    reprintCount?: number | null;
    sentCount?: number | null;
  } | null;
  sendStatus?: string | null;
  paymentState?: string | null;
  billState?: string | null;
};

export type WaiterReceiptLineApi = {
  id?: string;
  menuItemId?: string | null;
  name?: string | null;
  sku?: string | null;
  serving?: string | null;
  quantity?: number | null;
  unitPrice?: string | number | null;
  lineTotal?: string | number | null;
  notes?: string | null;
  modifierSummary?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type WaiterReceiptHistoryApi = {
  data?: WaiterReceiptHistoryEventApi[] | null;
  total?: number;
  page?: number;
  pageSize?: number;
  receiptId?: string;
};

export type WaiterReceiptHistoryEventApi = {
  id?: string;
  action?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
};

export type ReprintReceiptResponse = {
  ok?: boolean;
  action?: string;
  receiptId?: string;
  copies?: number;
  reason?: string | null;
  reprintedAt?: string;
  printable?: WaiterReceiptApi;
};

export type ReceiptSendChannel = "email" | "sms" | "whatsapp";

export type SendReceiptPayload = {
  channel: ReceiptSendChannel;
  recipient: string;
  locale?: string;
  note?: string;
};

export type SendReceiptResponse = {
  ok?: boolean;
  action?: string;
  receiptId?: string;
  deliveryId?: string;
  channel?: ReceiptSendChannel;
  recipient?: string;
  status?: "PENDING" | "DELIVERED" | "FAILED" | string;
  supported?: boolean;
  reason?: string;
  requestedAt?: string;
};

function idempotencyKey(prefix: string, id: string) {
  return `${prefix}-${id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function requestOrderBill(token: string, branchId: string, orderId: string) {
  return apiRequest<RequestOrderBillResponse>(`/api/pos/orders/${orderId}/request-bill`, {
    method: "POST",
    token,
    branchId,
  });
}

export function getReceipt(token: string, branchId: string, receiptId: string) {
  return apiRequest<WaiterReceiptApi>(`/api/receipts/${receiptId}`, {
    token,
    branchId,
  });
}

export function getReceiptHistory(token: string, branchId: string, receiptId: string) {
  return apiRequest<WaiterReceiptHistoryApi>(`/api/receipts/${receiptId}/history`, {
    token,
    branchId,
  });
}

export function reprintReceipt(token: string, branchId: string, receiptId: string) {
  return apiRequest<ReprintReceiptResponse>(`/api/receipts/${receiptId}/reprint`, {
    method: "POST",
    token,
    branchId,
    headers: {
      "Idempotency-Key": idempotencyKey("waiter-reprint", receiptId),
    },
    body: {
      reason: "Guest requested a duplicate receipt.",
      copies: 1,
    },
  });
}

export function sendReceipt(
  token: string,
  branchId: string,
  receiptId: string,
  payload: SendReceiptPayload,
) {
  return apiRequest<SendReceiptResponse>(`/api/receipts/${receiptId}/send`, {
    method: "POST",
    token,
    branchId,
    headers: {
      "Idempotency-Key": idempotencyKey("waiter-send", receiptId),
    },
    body: payload,
  });
}
