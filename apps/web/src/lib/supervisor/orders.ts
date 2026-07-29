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
  rejectionReason?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  managerPinVerified?: boolean | null;
  metadata?: Record<string, unknown> | null;
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

// ── Prompt 3A service actions (Supervisor, pos:orders:write) ──
// Both are safe, non-financial order-service exceptions. Neither backend endpoint
// is wrapped in the BG3 reliability guard, so neither honors an Idempotency-Key —
// we intentionally do NOT attach one. Duplicate submissions are prevented in the
// UI via mutation-pending state, not via idempotency keys.

export type SupervisorRequestBillResult = {
  orderId: string;
  orderNumber?: string | null;
  status: SupervisorOrderStatus | string;
  billRequested: boolean;
  requestedAt: string;
};

// POST /api/pos/orders/:id/request-bill — no request body; audit-only on the
// backend (does not mutate order/payment state). Returns the bill-request receipt.
export function requestSupervisorOrderBill(token: string, branchId: string, orderId: string) {
  return apiRequest<SupervisorRequestBillResult>(`/api/pos/orders/${orderId}/request-bill`, {
    method: "POST",
    token,
    branchId,
  });
}

// POST /api/pos/orders/:id/mark-served — order-level READY → SERVED transition.
// TransitionOrderDto accepts an optional reason (recorded in the audit metadata).
export function markSupervisorOrderServed(
  token: string,
  branchId: string,
  orderId: string,
  reason?: string,
) {
  const trimmed = reason?.trim();
  return apiRequest<SupervisorOrderDetail>(`/api/pos/orders/${orderId}/mark-served`, {
    method: "POST",
    token,
    branchId,
    body: trimmed ? { reason: trimmed } : {},
  });
}

// ── Prompt 3B1 handoff actions (Supervisor: pos:order:split / merge / move-items) ──
// All four are BG3-wrapped with idempotencyMode "optional" — they honor an
// Idempotency-Key header when present. We attach one (from the idempotency-intent
// utility) so duplicate submits/retries are de-duplicated server-side.

function idempotencyHeaders(key?: string): Record<string, string> | undefined {
  return key ? { "Idempotency-Key": key } : undefined;
}

export type SupervisorSplitBillMode = "EQUAL" | "CUSTOM";

export type SupervisorSplitBillGroupInput = { label?: string; amount?: string };

export type SupervisorSplitBillInput = {
  mode: SupervisorSplitBillMode;
  count?: number;
  groups?: SupervisorSplitBillGroupInput[];
  reason?: string;
};

export type SupervisorSplitBillGroup = { groupId: string; label: string; amount: string };

export type SupervisorSplitBillResult = {
  ok: boolean;
  action: string;
  orderId: string;
  splitMode: SupervisorSplitBillMode;
  splitGroups: SupervisorSplitBillGroup[];
  totals: { subtotal: string; tax: string; discount: string; total: string };
  amountAllocated: string;
  amountRemaining: string;
  outstandingBalance: string;
  note?: string;
};

// POST /api/pos/orders/:id/split-bill — non-physical payable allocation groups
// stored on order metadata. Order/items/taxes/KDS are unchanged.
export function splitSupervisorBill(
  token: string,
  branchId: string,
  orderId: string,
  input: SupervisorSplitBillInput,
  idempotencyKey?: string,
) {
  return apiRequest<SupervisorSplitBillResult>(`/api/pos/orders/${orderId}/split-bill`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export type SupervisorItemSelectionInput = { orderItemId: string; quantity: number };

export type SupervisorSplitItemsInput = {
  items: SupervisorItemSelectionInput[];
  targetTableId?: string;
  reason?: string;
  notes?: string;
};

export type SupervisorMovedSummary = {
  sourceItemId?: string;
  targetItemId?: string;
  quantity: number;
};

export type SupervisorSplitItemsResult = {
  ok: boolean;
  action: string;
  sourceOrder: Partial<SupervisorOrderDetail> | null;
  childOrder: SupervisorOrderDetail | null;
  movedItems: SupervisorMovedSummary[];
  kds?: { strategy?: string; note?: string };
};

// POST /api/pos/orders/:id/split-items — physical split into a NEW child order.
export function splitSupervisorItems(
  token: string,
  branchId: string,
  orderId: string,
  input: SupervisorSplitItemsInput,
  idempotencyKey?: string,
) {
  return apiRequest<SupervisorSplitItemsResult>(`/api/pos/orders/${orderId}/split-items`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export type SupervisorMoveItemsInput = {
  targetOrderId: string;
  items: SupervisorItemSelectionInput[];
  reason?: string;
};

export type SupervisorMoveItemsResult = {
  ok: boolean;
  action: string;
  sourceOrder: SupervisorOrderDetail | null;
  targetOrder: SupervisorOrderDetail | null;
  movedItems: SupervisorMovedSummary[];
  kds?: { strategy?: string; note?: string };
};

// POST /api/pos/orders/:id/move-items — move items to an existing open target order.
export function moveSupervisorItems(
  token: string,
  branchId: string,
  orderId: string,
  input: SupervisorMoveItemsInput,
  idempotencyKey?: string,
) {
  return apiRequest<SupervisorMoveItemsResult>(`/api/pos/orders/${orderId}/move-items`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export type SupervisorMergeInput = {
  sourceOrderId: string;
  targetOrderId: string;
  reason?: string;
};

export type SupervisorMergeResult = {
  ok: boolean;
  action: string;
  sourceOrder: (Partial<SupervisorOrderDetail> & { mergedIntoOrderId?: string | null }) | null;
  targetOrder: SupervisorOrderDetail | null;
  moved?: { itemRowsMoved: number; totalQuantityMoved: number };
  kds?: { strategy?: string; note?: string };
};

// POST /api/pos/orders/merge — source becomes VOIDED (mergedIntoOrderId → target).
export function mergeSupervisorOrders(
  token: string,
  branchId: string,
  input: SupervisorMergeInput,
  idempotencyKey?: string,
) {
  return apiRequest<SupervisorMergeResult>(`/api/pos/orders/merge`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: input,
  });
}

export type SupervisorTransferTableInput = {
  targetTableId: string;
  reason?: string;
};

export type SupervisorTransferTableResult = {
  ok: boolean;
  action: string;
  orderId: string;
  previousTableId: string | null;
  newTableId: string;
  newTableLabel: string | null;
  reason: string | null;
};

// POST /api/pos/orders/:id/transfer-table — reassigns the order's table
// (order.tableId only). Backend returns HTTP 200 and honors an optional
// Idempotency-Key (BG3, idempotencyMode "optional"). The backend does NOT
// validate target occupancy / reservation / capacity and does NOT change table
// status — it only moves the order. Target must be an active table in the same
// branch (else 404); the same table is rejected (400); a closed/voided source is
// rejected (409).
export function transferSupervisorOrderTable(
  token: string,
  branchId: string,
  orderId: string,
  input: SupervisorTransferTableInput,
  idempotencyKey?: string,
) {
  const trimmedReason = input.reason?.trim();
  return apiRequest<SupervisorTransferTableResult>(`/api/pos/orders/${orderId}/transfer-table`, {
    method: "POST",
    token,
    branchId,
    headers: idempotencyHeaders(idempotencyKey),
    body: {
      targetTableId: input.targetTableId,
      ...(trimmedReason ? { reason: trimmedReason } : {}),
    },
  });
}

// ── Prompt 3B3A financial adjustments (Supervisor) ──
// Neither endpoint is BG3-wrapped, so neither honors an Idempotency-Key — duplicate
// submission is prevented in the UI via mutation-pending state, not idempotency keys.

export type SupervisorVoidOrderResult = Partial<SupervisorOrderDetail> & {
  id: string;
  status: SupervisorOrderStatus | string;
};

// POST /api/pos/orders/:id/void — active-order void (NOT a refund, NOT complimentary,
// NOT post-close void). TransitionOrderDto: reason optional overall but backend-
// required for IN_KITCHEN/READY. HTTP 200. Returns the bare updated order (status
// VOIDED); items/totals unchanged; a DINE_IN table is auto-released if it becomes idle.
export function voidSupervisorOrder(token: string, branchId: string, orderId: string, reason?: string) {
  const trimmed = reason?.trim();
  return apiRequest<SupervisorVoidOrderResult>(`/api/pos/orders/${orderId}/void`, {
    method: "POST",
    token,
    branchId,
    body: trimmed ? { reason: trimmed } : {},
  });
}

export type SupervisorDiscountType = "PERCENTAGE" | "FIXED";

export type SupervisorDiscountRequestInput = {
  type: SupervisorDiscountType;
  value: number;
  reason: string;
  metadata?: Record<string, unknown>;
};

// POST /api/pos/orders/:id/discounts — order-level discount REQUEST (basis = subtotal).
// HTTP 201. The backend decides the status: it AUTO-APPROVES when the amount is within
// the org discount-approval threshold (default 5000), else returns PENDING. The response
// is the bare Discount row and does NOT include updated order totals — re-fetch the order.
export function requestSupervisorOrderDiscount(
  token: string,
  branchId: string,
  orderId: string,
  input: SupervisorDiscountRequestInput,
) {
  return apiRequest<SupervisorDiscount>(`/api/pos/orders/${orderId}/discounts`, {
    method: "POST",
    token,
    branchId,
    body: {
      type: input.type,
      value: input.value,
      reason: input.reason.trim(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

// ── Prompt 3B3B discount decisions (Supervisor: pos:discount:approve) ──
// Neither endpoint is BG3-wrapped, so neither honors an Idempotency-Key — duplicate
// submission is prevented via mutation-pending state (a double-click 409s on the 2nd
// call because the discount is no longer PENDING). Both return HTTP 200 and the bare
// updated Discount (no nested relations) — re-fetch the order + its discounts for
// canonical totals and reviewer identity.

// POST /api/pos/discounts/:id/approve — managerPin is OPTIONAL (re-auths the approver
// against their own quick PIN; wrong PIN → 401). PENDING-only (else 409). Recalcs order
// totals (latest approved wins). NOTE: the backend does NOT block self-approval.
export function approveSupervisorDiscount(
  token: string,
  branchId: string,
  discountId: string,
  managerPin?: string,
) {
  const trimmed = managerPin?.trim();
  return apiRequest<SupervisorDiscount>(`/api/pos/discounts/${discountId}/approve`, {
    method: "POST",
    token,
    branchId,
    body: trimmed ? { managerPin: trimmed } : {},
  });
}

// POST /api/pos/discounts/:id/reject — rejectionReason REQUIRED (≤500). PENDING-only.
// Does NOT change order totals. Response is the bare updated Discount (status REJECTED).
export function rejectSupervisorDiscount(
  token: string,
  branchId: string,
  discountId: string,
  rejectionReason: string,
) {
  return apiRequest<SupervisorDiscount>(`/api/pos/discounts/${discountId}/reject`, {
    method: "POST",
    token,
    branchId,
    body: { rejectionReason: rejectionReason.trim() },
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
