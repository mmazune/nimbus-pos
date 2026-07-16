import { ApiError } from "@/lib/api/client";
import {
  asCashierNumber,
  formatCashierDateTime,
  titleCaseCashier,
} from "@/lib/cashier/formatters";
import type { CashierOrderApi, CashierOrderPaymentsApi } from "@/lib/cashier/order-types";
import type {
  CashierReceiptApi,
  CashierReceiptFilterId,
  CashierReceiptHistoryApi,
  CashierReceiptHistoryEventApi,
  CashierReceiptHistoryEventViewModel,
  CashierReceiptLineApi,
  CashierReceiptLineViewModel,
  CashierReceiptPaymentApi,
  CashierReceiptPaymentViewModel,
  CashierReceiptStatus,
  CashierReceiptViewModel,
} from "@/lib/cashier/receipt-types";

const PRINTABLE_STATUSES = new Set(["CLOSED", "VOIDED"]);

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function titleFromAction(action: string | null | undefined) {
  if (!action) return "Event recorded";
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function normalizeLine(line: CashierReceiptLineApi, index: number): CashierReceiptLineViewModel {
  return {
    id: line.id || `receipt-line-${index}`,
    name: line.name || "Receipt line",
    quantity: line.quantity || 1,
    unitPrice: asCashierNumber(line.unitPrice),
    lineTotal: asCashierNumber(line.lineTotal),
    serving: line.serving || undefined,
    notes: line.notes || undefined,
    modifierSummary: line.modifierSummary || metadataString(line.metadata, "modifierSummary"),
  };
}

function normalizePayment(payment: CashierReceiptPaymentApi, index: number): CashierReceiptPaymentViewModel {
  return {
    id: payment.id || `receipt-payment-${index}`,
    method: titleCaseCashier(payment.method, "Method unavailable"),
    status: titleCaseCashier(payment.status, "Status unavailable"),
    amount: asCashierNumber(payment.amount),
    reference: payment.transactionId || undefined,
    postedAt: payment.postedAt || undefined,
  };
}

function deriveReceiptStatus({
  status,
  paid,
  outstanding,
}: {
  status: string;
  paid?: number;
  outstanding?: number;
}): { state: CashierReceiptStatus; label: string; tone: CashierReceiptViewModel["receiptStatusTone"] } {
  if (PRINTABLE_STATUSES.has(status) && outstanding !== undefined && outstanding <= 0) {
    return { state: "available", label: "Available", tone: "success" };
  }
  if (outstanding !== undefined && outstanding > 0) {
    return { state: "pending-payment", label: "Pending payment", tone: "warning" };
  }
  if (status === "CLOSED") return { state: "closed", label: "Closed", tone: "neutral" };
  if (paid !== undefined && paid > 0) return { state: "available", label: "Available", tone: "success" };
  return { state: "unknown", label: "Unknown", tone: "neutral" };
}

function receiptDate(receipt: CashierReceiptApi) {
  return receipt.timestamps?.openedAt || receipt.timestamps?.createdAt || receipt.createdAt || undefined;
}

export function normalizeCashierReceipt(receipt: CashierReceiptApi): CashierReceiptViewModel {
  const id = receipt.receiptId || receipt.id || receipt.orderId || "receipt-unavailable";
  const orderId = receipt.orderId || id;
  const status = String(receipt.status || "UNKNOWN").toUpperCase();
  const totals = receipt.totals || {};
  const currencyCode = totals.currencyCode || receipt.branch?.currencyCode || "UGX";
  const paid = asCashierNumber(totals.paid);
  const outstanding = asCashierNumber(totals.outstanding);
  const receiptStatus = deriveReceiptStatus({ status, paid, outstanding });
  const serverName = receipt.server?.fullName || receipt.server?.email || "Server unavailable";
  const cashierName = receipt.cashier?.fullName || receipt.cashier?.email || "Cashier unavailable";
  const tableName = receipt.table?.label || (receipt.serviceType === "TAKEAWAY" ? "Takeaway" : "Table unavailable");
  const lines = (receipt.items || []).map(normalizeLine);
  const payments = (receipt.payments || []).map(normalizePayment);
  const reprintCount = receipt.history?.reprintCount || 0;
  const sentCount = receipt.history?.sentCount || 0;
  const canAct = PRINTABLE_STATUSES.has(status);

  const searchText = [
    id,
    receipt.receiptNumber,
    receipt.orderNumber,
    tableName,
    serverName,
    cashierName,
    receipt.branch?.name,
    receipt.organization?.name,
    status,
    receipt.serviceType,
    ...payments.map((payment) => `${payment.method} ${payment.reference || ""} ${payment.amount || ""}`),
    totals.total,
    totals.paid,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id,
    orderId,
    receiptNumber: receipt.receiptNumber || receipt.orderNumber || id,
    orderNumber: receipt.orderNumber || orderId,
    status,
    receiptStatus: receiptStatus.state,
    receiptStatusLabel: receiptStatus.label,
    receiptStatusTone: receiptStatus.tone,
    serviceType: titleCaseCashier(receipt.serviceType, "Service unavailable"),
    tableName,
    serverName,
    cashierName,
    branchName: receipt.branch?.name || "Branch unavailable",
    organizationName: receipt.organization?.name || "Nimbus POS",
    openedAt: receiptDate(receipt),
    updatedAt: receipt.timestamps?.updatedAt || undefined,
    currencyCode,
    subtotal: asCashierNumber(totals.subtotal),
    tax: asCashierNumber(totals.tax),
    discount: asCashierNumber(totals.discount),
    serviceCharge: asCashierNumber(totals.serviceCharge),
    total: asCashierNumber(totals.total),
    paid,
    outstanding,
    lines,
    payments,
    footer: receipt.footer || undefined,
    reprintCount,
    sentCount,
    viewedCount: receipt.history?.viewedCount || 0,
    canReprint: canAct,
    canSend: canAct,
    unavailableReason: canAct
      ? undefined
      : "Receipt actions are available after the order is closed or voided.",
    searchText,
  };
}

export function normalizeReceiptCandidate({
  order,
  paymentSummary,
  receipt,
}: {
  order: CashierOrderApi;
  paymentSummary?: CashierOrderPaymentsApi;
  receipt?: CashierReceiptApi;
}): CashierReceiptViewModel {
  if (receipt) return normalizeCashierReceipt(receipt);

  const totalPaid = asCashierNumber(paymentSummary?.totalPaid);
  const outstanding = asCashierNumber(paymentSummary?.remainingBalance);
  const total = asCashierNumber(order.total);
  const status = String(order.status || "UNKNOWN").toUpperCase();
  const receiptStatus = deriveReceiptStatus({ status, paid: totalPaid, outstanding });
  const serverName = order.user?.displayName || [order.user?.firstName, order.user?.lastName].filter(Boolean).join(" ") || order.user?.email || "Server unavailable";
  const tableName = order.table?.label || (order.serviceType === "TAKEAWAY" ? "Takeaway" : "Table unavailable");
  const searchText = [order.id, order.orderNumber, tableName, serverName, status, total, totalPaid, outstanding]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id: order.id,
    orderId: order.id,
    receiptNumber: order.orderNumber || order.id,
    orderNumber: order.orderNumber || order.id,
    status,
    receiptStatus: receiptStatus.state,
    receiptStatusLabel: receiptStatus.label,
    receiptStatusTone: receiptStatus.tone,
    serviceType: titleCaseCashier(order.serviceType, "Service unavailable"),
    tableName,
    serverName,
    cashierName: "Cashier unavailable",
    branchName: order.branch?.name || "Branch unavailable",
    organizationName: "Nimbus POS",
    openedAt: order.createdAt || undefined,
    updatedAt: order.updatedAt || undefined,
    currencyCode: order.branch?.currencyCode || "UGX",
    subtotal: asCashierNumber(order.subtotal),
    tax: asCashierNumber(order.tax),
    discount: asCashierNumber(order.discount),
    total,
    paid: totalPaid,
    outstanding,
    lines: [],
    payments: (paymentSummary?.payments || []).map(normalizePayment),
    reprintCount: 0,
    sentCount: 0,
    viewedCount: 0,
    canReprint: PRINTABLE_STATUSES.has(status),
    canSend: PRINTABLE_STATUSES.has(status),
    unavailableReason: PRINTABLE_STATUSES.has(status)
      ? undefined
      : "Receipt actions are available after order close.",
    searchText,
  };
}

export function normalizeReceiptHistory(
  history: CashierReceiptHistoryApi | undefined,
): CashierReceiptHistoryEventViewModel[] {
  return (history?.data || []).map(normalizeReceiptHistoryEvent);
}

function normalizeReceiptHistoryEvent(
  event: CashierReceiptHistoryEventApi,
): CashierReceiptHistoryEventViewModel {
  const action = event.action || "RECEIPT_EVENT";
  const status = metadataString(event.metadata, "status");
  const channel = metadataString(event.metadata, "channel");
  const reason = metadataString(event.metadata, "reason");
  const note = metadataString(event.metadata, "note");
  const copies = event.metadata?.copies;
  const createdAt = formatCashierDateTime(event.createdAt, "Time unavailable");

  if (action === "RECEIPT_REPRINTED") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: "Reprint request recorded",
      description: `Metadata reprint request${typeof copies === "number" ? `, ${copies} ${copies === 1 ? "copy" : "copies"}` : ""}${reason ? `, reason: ${reason}` : ""}.`,
      actor: event.actorUserId || undefined,
      createdAt,
      status: "Metadata only",
      tone: "info",
    };
  }

  if (action === "RECEIPT_SENT") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: "Digital send request pending",
      description:
        reason === "NO_LIVE_DELIVERY_ADAPTER"
          ? `Pending ${channel || "digital"} request recorded. No live adapter is connected.`
          : `Receipt send ${status ? status.toLowerCase() : "request"} recorded${note ? `, note: ${note}` : ""}.`,
      actor: event.actorUserId || undefined,
      createdAt,
      status: status || "PENDING",
      tone: "warning",
    };
  }

  if (action === "ORDER_PAID_AND_CLOSED" || action === "ORDER_AUTO_SETTLED") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: "Order closed",
      description: "Order close event recorded.",
      actor: event.actorUserId || undefined,
      createdAt,
      status,
      tone: "success",
    };
  }

  if (action === "PAYMENT_RECORDED") {
    return {
      id: event.id || `${action}-${event.createdAt}`,
      action,
      label: "Payment recorded",
      description: "Payment event recorded.",
      actor: event.actorUserId || undefined,
      createdAt,
      status,
      tone: "success",
    };
  }

  return {
    id: event.id || `${action}-${event.createdAt}`,
    action,
    label: action === "RECEIPT_VIEWED" ? "Receipt viewed" : titleFromAction(action),
    description: action === "RECEIPT_VIEWED" ? "Receipt detail opened." : "Event recorded.",
    actor: event.actorUserId || undefined,
    createdAt,
    status,
    tone: "neutral",
  };
}

export function filterCashierReceipts(
  receipts: CashierReceiptViewModel[],
  filter: CashierReceiptFilterId,
) {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  return receipts.filter((receipt) => {
    if (filter === "closed") return receipt.status === "CLOSED" || receipt.status === "VOIDED";
    if (filter === "paid") return (receipt.outstanding ?? 0) <= 0 && (receipt.paid ?? 0) > 0;
    if (filter === "pending-send") return receipt.sentCount > 0;
    if (filter === "reprinted") return receipt.reprintCount > 0;

    if (!receipt.openedAt) return true;
    const date = new Date(receipt.openedAt);
    if (Number.isNaN(date.getTime())) return true;
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === todayKey;
  });
}

export function searchCashierReceipts(receipts: CashierReceiptViewModel[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return receipts;
  return receipts.filter((receipt) => receipt.searchText.includes(query));
}

export function mapReceiptApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "IDEMPOTENCY_IN_FLIGHT") {
      return "This receipt request is already processing.";
    }
    if (error.code === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
      return "This retry does not match the original receipt request.";
    }
    if (error.code === "MAINTENANCE_WINDOW_ACTIVE" || error.code === "MAINTENANCE_WINDOW_BLOCKED") {
      return "Receipt writes are blocked by maintenance.";
    }
    if (error.isForbidden) return "This cashier account is not allowed to perform that receipt action.";
    if (error.status === 404) return "Receipt not found.";
    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
