import { formatMoney } from "@/lib/waiter/order-model";

import type {
  RequestOrderBillResponse,
  SendReceiptResponse,
  WaiterReceiptApi,
  WaiterReceiptHistoryApi,
  WaiterReceiptHistoryEventApi,
  WaiterReceiptLineApi,
} from "./receipt-api";

export type WaiterBillStateViewModel = {
  receiptId?: string;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  description: string;
  canRequestBill: boolean;
  requestDisabledReason?: string;
  canViewReceipt: boolean;
};

export type WaiterReceiptLineViewModel = {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  serving?: string;
  notes?: string;
  modifierSummary?: string;
};

export type WaiterReceiptHistoryEventViewModel = {
  id: string;
  action: string;
  label: string;
  description: string;
  createdAt?: string;
  status?: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

export type WaiterReceiptActionStateViewModel = {
  canReprint: boolean;
  reprintReason?: string;
  canSend: boolean;
  sendReason?: string;
  pendingAdapterCopy: string;
};

export type WaiterReceiptViewModel = {
  id: string;
  receiptNumber: string;
  orderId: string;
  orderNumber: string;
  tableName: string;
  guestName: string;
  waiterName: string;
  branchName: string;
  organizationName: string;
  createdAt?: string;
  status: string;
  billState: string;
  sendStatus: string;
  currencyCode: string;
  lines: WaiterReceiptLineViewModel[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  serviceCharge?: number;
  total?: number;
  paid?: number;
  outstanding?: number;
  footer?: string;
  reprintCount: number;
  sentCount: number;
  actionState: WaiterReceiptActionStateViewModel;
};

const PRINTABLE_STATUSES = new Set(["CLOSED", "VOIDED"]);

function asNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function titleFromAction(action: string | null | undefined) {
  if (!action) return "Receipt event";
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeLine(line: WaiterReceiptLineApi, index: number): WaiterReceiptLineViewModel {
  return {
    id: line.id || `line-${index}`,
    name: line.name || "Receipt line",
    quantity: line.quantity || 1,
    unitPrice: asNumber(line.unitPrice),
    lineTotal: asNumber(line.lineTotal),
    serving: line.serving || undefined,
    notes: line.notes || undefined,
    modifierSummary: line.modifierSummary || metadataString(line.metadata, "modifierSummary"),
  };
}

export function normalizeWaiterReceipt(receipt: WaiterReceiptApi): WaiterReceiptViewModel {
  const id = receipt.receiptId || receipt.id || receipt.orderId || "receipt-unavailable";
  const orderId = receipt.orderId || id;
  const status = String(receipt.status || "UNKNOWN").toUpperCase();
  const totals = receipt.totals || {};
  const currencyCode = totals.currencyCode || receipt.branch?.currencyCode || "UGX";
  const reprintCount = receipt.history?.reprintCount || 0;
  const sentCount = receipt.history?.sentCount || 0;
  const canPrintOrSend = PRINTABLE_STATUSES.has(status);

  return {
    id,
    receiptNumber: receipt.receiptNumber || receipt.orderNumber || id,
    orderId,
    orderNumber: receipt.orderNumber || orderId,
    tableName: receipt.table?.label || (receipt.serviceType === "TAKEAWAY" ? "Takeaway" : "Table unavailable"),
    guestName: receipt.guest?.name || receipt.guestName || receipt.customerName || "Guest not added",
    waiterName: receipt.server?.fullName || receipt.server?.email || "Server unavailable",
    branchName: receipt.branch?.name || "Branch unavailable",
    organizationName: receipt.organization?.name || "Nimbus POS",
    createdAt: receipt.timestamps?.openedAt || receipt.timestamps?.createdAt || receipt.createdAt || undefined,
    status,
    billState: receipt.billState || receipt.paymentState || status,
    sendStatus: receipt.sendStatus || (sentCount > 0 ? "PENDING" : "Not sent"),
    currencyCode,
    lines: (receipt.items || []).map(normalizeLine),
    subtotal: asNumber(totals.subtotal),
    tax: asNumber(totals.tax),
    discount: asNumber(totals.discount),
    serviceCharge: asNumber(totals.serviceCharge),
    total: asNumber(totals.total),
    paid: asNumber(totals.paid),
    outstanding: asNumber(totals.outstanding),
    footer: receipt.footer || undefined,
    reprintCount,
    sentCount,
    actionState: {
      canReprint: canPrintOrSend,
      reprintReason: canPrintOrSend
        ? undefined
        : "Reprint is available after the order is closed or voided.",
      canSend: canPrintOrSend,
      sendReason: canPrintOrSend
        ? undefined
        : "Send receipt is available after the order is closed or voided.",
      pendingAdapterCopy:
        "Receipt send is pending. No live email/SMS/WhatsApp adapter is connected yet.",
    },
  };
}

export function normalizeReceiptHistory(
  history: WaiterReceiptHistoryApi | undefined,
): WaiterReceiptHistoryEventViewModel[] {
  return (history?.data || []).map(normalizeReceiptHistoryEvent);
}

function normalizeReceiptHistoryEvent(
  event: WaiterReceiptHistoryEventApi,
): WaiterReceiptHistoryEventViewModel {
  const action = event.action || "RECEIPT_EVENT";
  const status = metadataString(event.metadata, "status");
  const channel = metadataString(event.metadata, "channel");
  const reason = metadataString(event.metadata, "reason");
  const copies = event.metadata?.copies;
  const formattedTime = formatDateTime(event.createdAt);

  if (action === "RECEIPT_REPRINTED") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: "Reprinted",
      description: `Reprint request recorded${typeof copies === "number" ? `, ${copies} copy` : ""}.`,
      createdAt: formattedTime,
      tone: "info",
    };
  }

  if (action === "RECEIPT_SENT") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: status === "PENDING" ? "Send pending" : "Send attempted",
      description:
        reason === "NO_LIVE_DELIVERY_ADAPTER"
          ? `Pending ${channel || "digital"} receipt request, no live adapter connected.`
          : `Receipt send ${status ? status.toLowerCase() : "attempt"} recorded.`,
      createdAt: formattedTime,
      status,
      tone: status === "PENDING" ? "warning" : "info",
    };
  }

  if (action === "RECEIPT_VIEWED") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: "Viewed",
      description: "Receipt preview opened.",
      createdAt: formattedTime,
      tone: "neutral",
    };
  }

  return {
    id: event.id || `${action}-${event.createdAt}`,
    action,
    label: titleFromAction(action),
    description: "Backend receipt event recorded.",
    createdAt: formattedTime,
    status,
    tone: "neutral",
  };
}

export function normalizeRequestBillResult(result: RequestOrderBillResponse) {
  return {
    receiptId: result.receipt?.receiptId || result.receiptId || result.orderId || result.id,
    requestedAt: result.requestedAt,
    billRequested: Boolean(result.billRequested),
  };
}

export function normalizeSendReceiptResult(result: SendReceiptResponse | undefined) {
  if (!result) return undefined;
  return {
    status: result.status || "PENDING",
    supported: result.supported === true,
    reason: result.reason,
    copy:
      result.status === "PENDING" && result.supported === false
        ? "Receipt send is pending. No live email/SMS/WhatsApp adapter is connected yet."
        : "Receipt send request recorded.",
  };
}

export function formatReceiptMoney(
  value: number | undefined,
  currencyCode: string | undefined,
  unavailable = "Total unavailable",
) {
  if (value === undefined) return unavailable;
  return formatMoney(value, currencyCode || "UGX");
}
