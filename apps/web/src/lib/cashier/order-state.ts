import {
  asCashierNumber,
  formatCashierDateTime,
  formatCashierElapsed,
  formatCashierMoney,
  titleCaseCashier,
} from "@/lib/cashier/formatters";
import type {
  CashierOrderApi,
  CashierOrderItemApi,
  CashierOrderPaymentsApi,
  CashierOrderViewModel,
  CashierPaymentSummaryViewModel,
  CashierStatusTone,
} from "@/lib/cashier/order-types";

export const CASHIER_PAYABLE_STATUSES = ["SENT", "IN_KITCHEN", "READY", "SERVED"] as const;
export const CASHIER_READY_SERVED_STATUSES = ["READY", "SERVED"] as const;
export const CASHIER_IN_PROGRESS_STATUSES = ["SENT", "IN_KITCHEN"] as const;

const payableStatusSet = new Set<string>(CASHIER_PAYABLE_STATUSES);
const readyServedStatusSet = new Set<string>(CASHIER_READY_SERVED_STATUSES);
const inProgressStatusSet = new Set<string>(CASHIER_IN_PROGRESS_STATUSES);

function statusTone(status: string): CashierStatusTone {
  if (status === "SERVED" || status === "READY") return "success";
  if (status === "SENT" || status === "IN_KITCHEN") return "info";
  if (status === "CLOSED") return "neutral";
  if (status === "VOIDED") return "danger";
  return "warning";
}

function formatPerson(user: CashierOrderApi["user"]) {
  if (!user) return undefined;
  if (user.displayName) return user.displayName;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.email || undefined;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return undefined;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return undefined;
}

function modifierSummary(metadata: Record<string, unknown> | null | undefined) {
  const direct = metadataString(metadata, ["modifierSummary", "modifiers"]);
  if (direct) return direct;

  const selected = metadata?.selectedModifiers;
  if (!Array.isArray(selected)) return undefined;

  const names = selected
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const candidate = entry as { modifierOptionName?: unknown; modifierOptionId?: unknown };
      return typeof candidate.modifierOptionName === "string"
        ? candidate.modifierOptionName
        : typeof candidate.modifierOptionId === "string"
          ? candidate.modifierOptionId
          : undefined;
    })
    .filter((value): value is string => Boolean(value));

  return names.length ? names.join(", ") : undefined;
}

function normalizeLine(item: CashierOrderItemApi, index: number) {
  return {
    id: item.id || `line-${index}`,
    name: item.menuItem?.name || "Menu item unavailable",
    quantity: item.quantity || 1,
    unitPrice: asCashierNumber(item.price),
    lineTotal: asCashierNumber(item.subtotal),
    statusLabel: metadataString(item.metadata, ["status", "itemStatus", "kdsStatus"]),
    servingLabel:
      metadataString(item.metadata, ["servingLabel"]) ||
      item.menuItemServing?.label ||
      item.menuItemServing?.format ||
      undefined,
    notes: item.notes || undefined,
    modifierSummary: modifierSummary(item.metadata),
  };
}

export function isCashierPayableStatus(status: string | null | undefined) {
  return payableStatusSet.has(String(status || "").toUpperCase());
}

export function isCashierReadyServedStatus(status: string | null | undefined) {
  return readyServedStatusSet.has(String(status || "").toUpperCase());
}

export function isCashierInProgressStatus(status: string | null | undefined) {
  return inProgressStatusSet.has(String(status || "").toUpperCase());
}

export function deriveCashierPaymentState(
  summary?: CashierOrderPaymentsApi,
  failedReason?: string,
): CashierPaymentSummaryViewModel {
  if (!summary) {
    return {
      state: "unknown",
      label: "Unknown",
      tone: "neutral",
      payments: [],
      intents: [],
      unavailableReason: failedReason || "Payment summary pending",
    };
  }

  const paid = asCashierNumber(summary.totalPaid);
  const outstanding = asCashierNumber(summary.remainingBalance);
  const total = asCashierNumber(summary.orderTotal);
  const payments = summary.payments || [];
  const intents = summary.intents || [];

  if (summary.isSettled || (outstanding !== undefined && outstanding <= 0 && paid !== undefined && paid > 0)) {
    return { state: "settled", label: "Settled", tone: "success", paid, outstanding, total, payments, intents };
  }

  if (paid !== undefined && paid > 0 && outstanding !== undefined && outstanding > 0) {
    return { state: "partially-paid", label: "Partially paid", tone: "warning", paid, outstanding, total, payments, intents };
  }

  if ((paid === undefined || paid <= 0) && outstanding !== undefined) {
    return { state: "unpaid", label: "Unpaid", tone: "info", paid, outstanding, total, payments, intents };
  }

  return {
    state: "unknown",
    label: "Unknown",
    tone: "neutral",
    paid,
    outstanding,
    total,
    payments,
    intents,
    unavailableReason: "Payment summary pending",
  };
}

function readinessFor(status: string, payment: CashierPaymentSummaryViewModel) {
  if (status === "CLOSED") {
    return { label: "Closed", tone: "neutral" as CashierStatusTone };
  }
  if (!isCashierPayableStatus(status)) {
    return { label: "Not ready for cashier checkout", tone: "warning" as CashierStatusTone };
  }
  if (payment.state === "settled") {
    return { label: "Awaiting close workflow", tone: "success" as CashierStatusTone };
  }
  if (payment.state === "unknown") {
    return { label: "Payment summary unavailable", tone: "warning" as CashierStatusTone };
  }
  return { label: "Checkout ready", tone: "info" as CashierStatusTone };
}

export function normalizeCashierOrder({
  order,
  paymentSummary,
  paymentError,
  fallbackBranchName,
}: {
  order: CashierOrderApi;
  paymentSummary?: CashierOrderPaymentsApi;
  paymentError?: string;
  fallbackBranchName?: string;
}): CashierOrderViewModel {
  const status = String(order.status || "UNKNOWN").toUpperCase();
  const serviceType = String(order.serviceType || "UNKNOWN").toUpperCase();
  const currencyCode = order.branch?.currencyCode || undefined;
  const payment = deriveCashierPaymentState(paymentSummary, paymentError);
  const readiness = readinessFor(status, payment);
  const total = asCashierNumber(order.total);
  const serverName = formatPerson(order.user) || "Server unavailable";
  const tableName =
    order.table?.label ||
    (serviceType === "TAKEAWAY" ? "Takeaway" : "Table unavailable");
  const guestName = metadataString(order.metadata, ["guestName", "customerName", "guest_name", "customer_name"]);
  const billState = metadataString(order.metadata, ["billState", "billStatus", "bill_requested", "billRequested"]);

  const searchText = [
    order.orderNumber,
    order.id,
    tableName,
    serverName,
    guestName,
    status,
    titleCaseCashier(status),
    payment.label,
    serviceType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id: order.id,
    tableId: order.tableId || order.table?.id || null,
    userId: order.userId || order.user?.id || null,
    orderNumber: order.orderNumber || order.id,
    status,
    statusLabel: titleCaseCashier(status, "Unknown"),
    statusTone: statusTone(status),
    serviceType,
    serviceTypeLabel: titleCaseCashier(serviceType, "Service unavailable"),
    tableName,
    serverName,
    guestName,
    branchName: order.branch?.name || fallbackBranchName,
    createdAt: order.createdAt || undefined,
    updatedAt: order.updatedAt || undefined,
    openedLabel: formatCashierDateTime(order.createdAt, "Opened time unavailable"),
    updatedLabel: formatCashierDateTime(order.updatedAt || order.createdAt, "Updated time unavailable"),
    elapsedLabel: formatCashierElapsed(order.createdAt),
    subtotal: asCashierNumber(order.subtotal),
    tax: asCashierNumber(order.tax),
    discount: asCashierNumber(order.discount),
    total,
    currencyCode,
    formattedTotal: formatCashierMoney(total, currencyCode, "Total unavailable"),
    payment,
    readinessLabel: readiness.label,
    readinessTone: readiness.tone,
    canPreview: true,
    nonPayableReason: isCashierPayableStatus(status)
      ? undefined
      : "This order is not ready for cashier checkout.",
    billRequestedLabel: billState,
    itemCount: order.items?.length,
    lines: (order.items || []).map(normalizeLine),
    metadata: order.metadata || null,
    searchText,
  };
}
