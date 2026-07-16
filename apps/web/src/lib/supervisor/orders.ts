import { apiRequest } from "@/lib/api/client";

export type SupervisorOrderStatus =
  | "NEW"
  | "SENT"
  | "IN_KITCHEN"
  | "READY"
  | "SERVED"
  | "VOIDED"
  | "CLOSED";

export type SupervisorServiceType = "DINE_IN" | "TAKEAWAY";

export type SupervisorOrderUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type SupervisorOrderTable = {
  id: string;
  label?: string | null;
};

export type SupervisorOrderListItem = {
  id: string;
  orgId?: string;
  branchId?: string;
  tableId?: string | null;
  userId?: string;
  orderNumber?: string | null;
  status: SupervisorOrderStatus | string;
  serviceType?: SupervisorServiceType | string | null;
  subtotal?: string | number | null;
  tax?: string | number | null;
  discount?: string | number | null;
  total?: string | number | null;
  anomalyFlags?: unknown;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: Array<{ id: string }>;
  table?: SupervisorOrderTable | null;
  user?: SupervisorOrderUser | null;
};

export type SupervisorOrderMenuItem = {
  id: string;
  name?: string | null;
  station?: string | null;
};

export type SupervisorOrderServing = {
  id: string;
  format?: string | null;
  label?: string | null;
};

export type SupervisorOrderItem = {
  id: string;
  menuItemId?: string;
  menuItemServingId?: string | null;
  quantity?: number | null;
  price?: string | number | null;
  subtotal?: string | number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  menuItem?: SupervisorOrderMenuItem | null;
  menuItemServing?: SupervisorOrderServing | null;
};

export type SupervisorOrderDetail = Omit<SupervisorOrderListItem, "items"> & {
  items?: SupervisorOrderItem[];
};

export type SupervisorPaginatedOrders = {
  data: SupervisorOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type SupervisorPaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | string;
export type SupervisorPaymentIntentStatus =
  | "PENDING"
  | "REQUIRES_ACTION"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | string;

export type SupervisorPayment = {
  id: string;
  amount?: string | number | null;
  method?: string | null;
  status?: SupervisorPaymentStatus | null;
  captureMode?: string | null;
  verificationStatus?: string | null;
  transactionId?: string | null;
  externalTransactionId?: string | null;
  payerPhone?: string | null;
  postedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SupervisorPaymentIntent = {
  id: string;
  provider?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  status?: SupervisorPaymentIntentStatus | null;
  providerRef?: string | null;
  customerPhone?: string | null;
  failureReason?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SupervisorOrderPayments = {
  payments: SupervisorPayment[];
  intents: SupervisorPaymentIntent[];
  orderTotal: string;
  totalPaid: string;
  remainingBalance: string;
  isSettled: boolean;
};

export type SupervisorDiscount = {
  id: string;
  type?: string | null;
  value?: string | number | null;
  reason?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED" | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: SupervisorOrderUser | null;
  approvedBy?: SupervisorOrderUser | null;
  rejectedBy?: SupervisorOrderUser | null;
};

export type SupervisorPaginatedDiscounts = {
  data: SupervisorDiscount[];
  total: number;
  page: number;
  pageSize: number;
};

export type SupervisorRefund = {
  id: string;
  paymentId?: string | null;
  provider?: string | null;
  amount?: string | number | null;
  reason?: string | null;
  status?: "PENDING" | "APPROVED" | "COMPLETED" | "FAILED" | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: SupervisorOrderUser | null;
};

export type SupervisorOrdersQuery = {
  status?: SupervisorOrderStatus;
  serviceType?: SupervisorServiceType;
  tableId?: string;
  userId?: string;
  excludeStatus?: SupervisorOrderStatus[];
  page?: number;
  pageSize?: number;
};

export type SupervisorPaymentState =
  | "settled"
  | "partially-paid"
  | "unpaid"
  | "pending"
  | "failed"
  | "refunded"
  | "unknown";

export type SupervisorOrdersFilter =
  | "all-active"
  | "in-progress"
  | "ready-served"
  | "payable"
  | "partial-paid"
  | "exception-watch";

export type SupervisorOrdersSort = "newest" | "oldest" | "highest-total" | "status" | "table";

export type SupervisorOrderExceptionTone = "info" | "warning" | "danger";

export type SupervisorOrderExceptionTag = {
  key: string;
  label: string;
  tone: SupervisorOrderExceptionTone;
};

export const supervisorActiveOrderStatuses: SupervisorOrderStatus[] = [
  "NEW",
  "SENT",
  "IN_KITCHEN",
  "READY",
  "SERVED",
];

export const supervisorOrderStatusLabels: Record<SupervisorOrderStatus, string> = {
  NEW: "New",
  SENT: "Sent",
  IN_KITCHEN: "In kitchen",
  READY: "Ready",
  SERVED: "Served",
  VOIDED: "Voided",
  CLOSED: "Closed",
};

function appendParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

function buildOrdersPath(query: SupervisorOrdersQuery = {}) {
  const params = new URLSearchParams();
  appendParam(params, "status", query.status);
  appendParam(params, "serviceType", query.serviceType);
  appendParam(params, "tableId", query.tableId);
  appendParam(params, "userId", query.userId);
  appendParam(params, "page", query.page);
  appendParam(params, "pageSize", query.pageSize);

  if (query.excludeStatus?.length) {
    params.set("excludeStatus", query.excludeStatus.join(","));
  }

  const qs = params.toString();
  return `/api/pos/orders${qs ? `?${qs}` : ""}`;
}

export function fetchSupervisorOrders(token: string, branchId: string, query: SupervisorOrdersQuery = {}) {
  return apiRequest<SupervisorPaginatedOrders>(buildOrdersPath(query), { token, branchId });
}

export function fetchSupervisorOrderDetail(token: string, branchId: string, orderId: string) {
  return apiRequest<SupervisorOrderDetail>(`/api/pos/orders/${orderId}`, { token, branchId });
}

export function fetchSupervisorOrderPayments(token: string, branchId: string, orderId: string) {
  return apiRequest<SupervisorOrderPayments>(`/api/pos/orders/${orderId}/payments`, { token, branchId });
}

export function fetchSupervisorOrderRefunds(token: string, branchId: string, orderId: string) {
  return apiRequest<SupervisorRefund[]>(`/api/pos/orders/${orderId}/refunds`, { token, branchId });
}

export function fetchSupervisorOrderDiscounts(token: string, branchId: string, orderId: string) {
  return apiRequest<SupervisorPaginatedDiscounts>(`/api/pos/orders/${orderId}/discounts?pageSize=50`, {
    token,
    branchId,
  });
}

export function toMoneyNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatSupervisorMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(toMoneyNumber(value));
}

export function formatSupervisorDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatSupervisorShortTime(value: string | null | undefined) {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function minutesSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
}

export function formatAge(value: string | null | undefined) {
  const minutes = minutesSince(value);
  if (minutes === null) return "Age unknown";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder > 0 ? `${hours}h ${remainder}m ago` : `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getSupervisorOrderLabel(order: Pick<SupervisorOrderListItem, "orderNumber" | "id">) {
  return order.orderNumber || order.id;
}

export function getSupervisorOrderStatusLabel(status: string | null | undefined) {
  if (!status) return "Unknown";
  return supervisorOrderStatusLabels[status as SupervisorOrderStatus] || status.replace(/_/g, " ").toLowerCase();
}

export function getSupervisorUserName(user: SupervisorOrderUser | null | undefined) {
  if (!user) return "Unassigned";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "Unassigned";
}

export function getSupervisorTableLabel(order: Pick<SupervisorOrderListItem, "table" | "tableId" | "serviceType">) {
  if (order.table?.label) return order.table.label;
  if (order.tableId) return order.tableId;
  return order.serviceType === "TAKEAWAY" ? "Takeaway" : "No table";
}

export function getPaymentState(payments?: SupervisorOrderPayments | null): SupervisorPaymentState {
  if (!payments) return "unknown";

  const total = toMoneyNumber(payments.orderTotal);
  const paid = toMoneyNumber(payments.totalPaid);
  const remaining = toMoneyNumber(payments.remainingBalance);
  const hasPendingIntent = payments.intents.some((intent) =>
    ["PENDING", "REQUIRES_ACTION"].includes(String(intent.status || "")),
  );
  const hasFailed = payments.payments.some((payment) => payment.status === "FAILED")
    || payments.intents.some((intent) => intent.status === "FAILED");
  const hasRefunded = payments.payments.some((payment) => payment.status === "REFUNDED");

  if (hasFailed) return "failed";
  if (hasRefunded) return "refunded";
  if (hasPendingIntent) return "pending";
  if (payments.isSettled || (total > 0 && remaining <= 0)) return "settled";
  if (paid > 0 && remaining > 0) return "partially-paid";
  return "unpaid";
}

export function getPaymentStateLabel(state: SupervisorPaymentState) {
  const labels: Record<SupervisorPaymentState, string> = {
    settled: "Settled",
    "partially-paid": "Partially paid",
    unpaid: "Unpaid",
    pending: "Payment pending",
    failed: "Payment failed",
    refunded: "Refunded",
    unknown: "Payment unknown",
  };
  return labels[state];
}

export function getPaymentStateTone(state: SupervisorPaymentState): "neutral" | "success" | "warning" | "danger" | "info" {
  if (state === "settled") return "success";
  if (state === "partially-paid" || state === "pending") return "warning";
  if (state === "failed" || state === "refunded") return "danger";
  if (state === "unpaid") return "neutral";
  return "info";
}

export function getSupervisorOrderExceptionTags({
  discounts,
  order,
  payments,
  refunds,
}: {
  order: SupervisorOrderListItem | SupervisorOrderDetail;
  payments?: SupervisorOrderPayments | null;
  refunds?: SupervisorRefund[] | null;
  discounts?: SupervisorPaginatedDiscounts | null;
}) {
  const tags: SupervisorOrderExceptionTag[] = [];
  const paymentState = getPaymentState(payments);
  const staleMinutes = minutesSince(order.updatedAt);
  const status = order.status as SupervisorOrderStatus;

  if (status === "VOIDED") tags.push({ key: "voided", label: "Voided", tone: "danger" });
  if (status === "SERVED" && paymentState === "unpaid") {
    tags.push({ key: "served-unpaid", label: "Served unpaid", tone: "warning" });
  }
  if (paymentState === "partially-paid") {
    tags.push({ key: "partial-payment", label: "Partial payment", tone: "warning" });
  }
  if (paymentState === "pending") {
    tags.push({ key: "pending-payment", label: "Payment pending", tone: "warning" });
  }
  if (paymentState === "failed") {
    tags.push({ key: "failed-payment", label: "Payment failed", tone: "danger" });
  }
  if (order.serviceType === "DINE_IN" && !order.tableId && !order.table?.id) {
    tags.push({ key: "missing-table", label: "No table", tone: "warning" });
  }
  if (staleMinutes !== null && staleMinutes >= 45 && supervisorActiveOrderStatuses.includes(status)) {
    tags.push({ key: "stale", label: "No update 45m+", tone: "info" });
  }
  if (refunds?.length) {
    tags.push({ key: "refund", label: "Refund history", tone: "danger" });
  }
  if (discounts?.data.some((discount) => discount.status === "PENDING")) {
    tags.push({ key: "pending-discount", label: "Discount pending", tone: "warning" });
  } else if (discounts?.data.length) {
    tags.push({ key: "discount", label: "Discount history", tone: "info" });
  }

  return tags;
}

export function orderMatchesSearch(order: SupervisorOrderListItem, search: string, paymentState?: SupervisorPaymentState) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    order.id,
    order.orderNumber,
    order.status,
    order.serviceType,
    order.notes,
    getSupervisorTableLabel(order),
    getSupervisorUserName(order.user),
    paymentState ? getPaymentStateLabel(paymentState) : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}
