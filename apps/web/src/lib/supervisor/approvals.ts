import { apiRequest } from "@/lib/api/client";
import type { SupervisorDiscount, SupervisorOrderUser } from "@/lib/supervisor/orders";

export type SupervisorApprovalDomain =
  | "discount"
  | "refund"
  | "void"
  | "leave"
  | "shift-swap"
  | "anomaly";

export type SupervisorApprovalFilter =
  | "all"
  | "discount"
  | "refund"
  | "void"
  | "leave"
  | "shift-swap"
  | "anomaly"
  | "unavailable"
  | "high-priority";

export type SupervisorApprovalSort =
  | "newest"
  | "oldest"
  | "highest-amount"
  | "domain"
  | "status"
  | "severity";

export type SupervisorApprovalTone = "neutral" | "success" | "warning" | "danger" | "info";

export type SupervisorApprovalSeverity = "none" | "low" | "medium" | "high" | "critical" | "unavailable";

export type SupervisorApprovalTag = {
  key: string;
  label: string;
  tone: SupervisorApprovalTone;
};

export type SupervisorApprovalDomainState = {
  domain: SupervisorApprovalDomain;
  label: string;
  endpoint: string;
  permission: string;
  readOnly: boolean;
  available: boolean;
  count: number | null;
  status: "loaded" | "loading" | "failed" | "unavailable";
  caveat?: string;
  error?: string | null;
};

export type SupervisorApprovalItem = {
  id: string;
  domain: SupervisorApprovalDomain;
  domainLabel: string;
  reference: string;
  status: string;
  statusLabel: string;
  requester: string;
  amount: number | null;
  amountLabel: string;
  reason: string;
  orderId: string | null;
  orderReference: string | null;
  tableId: string | null;
  employeeName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  severity: SupervisorApprovalSeverity;
  severityLabel: string;
  tags: SupervisorApprovalTag[];
  searchText: string;
  raw: unknown;
};

export type SupervisorPendingDiscount = SupervisorDiscount & {
  orderId?: string | null;
  managerPinVerified?: boolean | null;
  order?: {
    id: string;
    orderNumber?: string | null;
    subtotal?: string | number | null;
    total?: string | number | null;
  } | null;
};

export type SupervisorEmployee = {
  id: string;
  employeeCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  user?: SupervisorOrderUser | null;
};

export type SupervisorLeaveRequest = {
  id: string;
  employeeId?: string | null;
  leaveType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
  status?: string | null;
  requestedById?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  employee?: SupervisorEmployee | null;
  requestedBy?: SupervisorOrderUser | null;
  reviewedBy?: SupervisorOrderUser | null;
};

export type SupervisorShiftSwap = {
  id: string;
  requesterEmployeeId?: string | null;
  targetEmployeeId?: string | null;
  shiftDate?: string | null;
  reason?: string | null;
  status?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  reviewNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  requester?: SupervisorEmployee | null;
  target?: SupervisorEmployee | null;
  approvedBy?: SupervisorOrderUser | null;
};

export type SupervisorAnomaly = {
  id: string;
  type?: string | null;
  status?: string | null;
  severity?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorUserId?: string | null;
  relatedOrderId?: string | null;
  relatedShiftId?: string | null;
  relatedTillSessionId?: string | null;
  relatedPaymentId?: string | null;
  relatedRefundId?: string | null;
  relatedReservationId?: string | null;
  relatedEventId?: string | null;
  score?: string | number | null;
  title?: string | null;
  description?: string | null;
  evidence?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  acknowledgedById?: string | null;
  acknowledgedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  rule?: {
    code?: string | null;
    name?: string | null;
    type?: string | null;
  } | null;
  actorUser?: SupervisorOrderUser | null;
  acknowledgedBy?: SupervisorOrderUser | null;
};

export type SupervisorPaginated<T> = {
  data: T[];
  total: number;
  limit?: number;
  offset?: number;
};

export const supervisorApprovalFilters: Array<{ value: SupervisorApprovalFilter; label: string }> = [
  { value: "all", label: "All available" },
  { value: "discount", label: "Discounts" },
  { value: "refund", label: "Refunds" },
  { value: "void", label: "Void watch" },
  { value: "leave", label: "Leave" },
  { value: "shift-swap", label: "Shift swaps" },
  { value: "anomaly", label: "Anomalies" },
  { value: "unavailable", label: "Unavailable" },
  { value: "high-priority", label: "High priority" },
];

export const supervisorApprovalSorts: Array<{ value: SupervisorApprovalSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "highest-amount", label: "Highest amount" },
  { value: "domain", label: "Domain" },
  { value: "status", label: "Status" },
  { value: "severity", label: "Severity" },
];

export const unavailableSupervisorApprovalDomains: SupervisorApprovalDomainState[] = [
  {
    domain: "refund",
    label: "Refund approvals",
    endpoint: "No verified pending-refunds list endpoint",
    permission: "pos:refund:read",
    readOnly: true,
    available: false,
    count: null,
    status: "unavailable",
    caveat:
      "Refund approval queue requires a verified pending-refunds list endpoint. Order-level refund history exists but is not a queue.",
  },
  {
    domain: "void",
    label: "Post-close void watch",
    endpoint: "POST /api/pos/orders/:id/post-close-void",
    permission: "pos:void:postclose",
    readOnly: false,
    available: false,
    count: null,
    status: "unavailable",
    caveat: "Post-close void execution exists but no read-only candidate queue was verified.",
  },
];

function appendParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

function buildQueryPath(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => appendParam(params, key, value));
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ""}`;
}

export function fetchSupervisorPendingDiscounts(token: string, branchId: string) {
  return apiRequest<SupervisorPendingDiscount[]>("/api/pos/discounts/pending", { token, branchId });
}

export function fetchSupervisorDiscountDetail(token: string, branchId: string, discountId: string) {
  return apiRequest<SupervisorPendingDiscount>(`/api/pos/discounts/${discountId}`, { token, branchId });
}

export function fetchSupervisorRefundDetail(token: string, branchId: string, refundId: string) {
  return apiRequest<unknown>(`/api/pos/refunds/${refundId}`, { token, branchId });
}

export function fetchSupervisorLeaveRequests(token: string, branchId: string) {
  return apiRequest<SupervisorPaginated<SupervisorLeaveRequest>>(
    buildQueryPath("/api/hr/leave", { status: "PENDING", take: 50 }),
    { token, branchId },
  );
}

export function fetchSupervisorShiftSwaps(token: string, branchId: string) {
  return apiRequest<SupervisorPaginated<SupervisorShiftSwap>>(
    buildQueryPath("/api/hr/shift-swaps", { status: "PENDING", take: 50 }),
    { token, branchId },
  );
}

export function fetchSupervisorAnomalies(token: string, branchId: string) {
  return apiRequest<SupervisorPaginated<SupervisorAnomaly>>(
    buildQueryPath("/api/analytics/anomalies", { status: "OPEN", limit: 50 }),
    { token, branchId },
  );
}

export function fetchSupervisorAnomalyDetail(token: string, branchId: string, anomalyId: string) {
  return apiRequest<SupervisorAnomaly>(`/api/analytics/anomalies/${anomalyId}`, { token, branchId });
}

export function toSupervisorApprovalAmount(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatSupervisorApprovalMoney(value: string | number | null | undefined) {
  const amount = toSupervisorApprovalAmount(value);
  if (amount === null) return "Amount unavailable";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSupervisorApprovalDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getSupervisorApprovalDomainLabel(domain: SupervisorApprovalDomain) {
  const labels: Record<SupervisorApprovalDomain, string> = {
    discount: "Discount",
    refund: "Refund",
    void: "Post-close void",
    leave: "Leave",
    "shift-swap": "Shift swap",
    anomaly: "Anomaly",
  };
  return labels[domain];
}

export function getSupervisorApprovalStatusLabel(status: string | null | undefined) {
  const raw = String(status || "UNKNOWN").trim();
  if (!raw || raw === "UNKNOWN") return "Status unknown";
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getSupervisorApprovalSeverity(value: string | null | undefined): SupervisorApprovalSeverity {
  const raw = String(value || "").toUpperCase();
  if (raw === "CRITICAL") return "critical";
  if (raw === "HIGH") return "high";
  if (raw === "MEDIUM") return "medium";
  if (raw === "LOW") return "low";
  return "unavailable";
}

export function getSupervisorApprovalSeverityLabel(severity: SupervisorApprovalSeverity) {
  const labels: Record<SupervisorApprovalSeverity, string> = {
    none: "No severity",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    unavailable: "Severity unavailable",
  };
  return labels[severity];
}

export function getSupervisorApprovalSeverityTone(severity: SupervisorApprovalSeverity): SupervisorApprovalTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "neutral";
}

export function getSupervisorApprovalStatusTone(status: string | null | undefined): SupervisorApprovalTone {
  const raw = String(status || "").toUpperCase();
  if (raw === "PENDING" || raw === "OPEN") return "warning";
  if (raw === "APPROVED" || raw === "ACKNOWLEDGED" || raw === "RESOLVED") return "success";
  if (raw === "REJECTED" || raw === "FAILED") return "danger";
  return "neutral";
}

export function getSupervisorUserName(user: SupervisorOrderUser | null | undefined) {
  if (!user) return "Requester unavailable";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "Requester unavailable";
}

export function getSupervisorEmployeeName(employee: SupervisorEmployee | null | undefined) {
  if (!employee) return "Employee unavailable";
  const name = employee.displayName || [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return name || employee.employeeCode || employee.user?.email || "Employee unavailable";
}

export function getSupervisorApprovalExceptionTags(item: SupervisorApprovalItem) {
  return item.tags;
}

function baseSearchText(parts: Array<string | number | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function normalizeSupervisorDiscountApproval(discount: SupervisorPendingDiscount): SupervisorApprovalItem {
  const amount = toSupervisorApprovalAmount(discount.value);
  const requester = getSupervisorUserName(discount.createdBy);
  const status = discount.status || "PENDING";
  const orderReference = discount.order?.orderNumber || discount.orderId || null;
  const tags: SupervisorApprovalTag[] = [
    { key: "pending", label: getSupervisorApprovalStatusLabel(status), tone: getSupervisorApprovalStatusTone(status) },
    { key: "read-only", label: "Read-only", tone: "info" },
  ];

  if (discount.type) {
    tags.push({ key: "discount-type", label: getSupervisorApprovalStatusLabel(discount.type), tone: "neutral" });
  }

  return {
    id: discount.id,
    domain: "discount",
    domainLabel: "Discount",
    reference: discount.id,
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    requester,
    amount,
    amountLabel: formatSupervisorApprovalMoney(discount.value),
    reason: discount.reason || "Reason unavailable",
    orderId: discount.order?.id || discount.orderId || null,
    orderReference,
    tableId: null,
    employeeName: null,
    createdAt: discount.createdAt || null,
    updatedAt: discount.updatedAt || null,
    severity: "unavailable",
    severityLabel: "Severity unavailable",
    tags,
    searchText: baseSearchText([
      discount.id,
      "discount",
      status,
      requester,
      discount.reason,
      discount.type,
      discount.value,
      orderReference,
    ]),
    raw: discount,
  };
}

export function normalizeSupervisorLeaveApproval(leave: SupervisorLeaveRequest): SupervisorApprovalItem {
  const employeeName = getSupervisorEmployeeName(leave.employee);
  const requester = getSupervisorUserName(leave.requestedBy);
  const status = leave.status || "PENDING";
  const tags: SupervisorApprovalTag[] = [
    { key: "pending", label: getSupervisorApprovalStatusLabel(status), tone: getSupervisorApprovalStatusTone(status) },
    { key: "leave-type", label: getSupervisorApprovalStatusLabel(leave.leaveType), tone: "neutral" },
  ];

  return {
    id: leave.id,
    domain: "leave",
    domainLabel: "Leave",
    reference: leave.id,
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    requester,
    amount: null,
    amountLabel: "Amount unavailable",
    reason: leave.reason || "Reason unavailable",
    orderId: null,
    orderReference: null,
    tableId: null,
    employeeName,
    createdAt: leave.createdAt || null,
    updatedAt: leave.updatedAt || null,
    severity: "unavailable",
    severityLabel: "Severity unavailable",
    tags,
    searchText: baseSearchText([
      leave.id,
      "leave",
      status,
      leave.leaveType,
      requester,
      employeeName,
      leave.reason,
      leave.startsAt,
      leave.endsAt,
    ]),
    raw: leave,
  };
}

export function normalizeSupervisorShiftSwapApproval(swap: SupervisorShiftSwap): SupervisorApprovalItem {
  const requesterEmployee = getSupervisorEmployeeName(swap.requester);
  const targetEmployee = getSupervisorEmployeeName(swap.target);
  const status = swap.status || "PENDING";
  const tags: SupervisorApprovalTag[] = [
    { key: "pending", label: getSupervisorApprovalStatusLabel(status), tone: getSupervisorApprovalStatusTone(status) },
    { key: "swap", label: "Shift swap", tone: "info" },
  ];

  return {
    id: swap.id,
    domain: "shift-swap",
    domainLabel: "Shift swap",
    reference: swap.id,
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    requester: requesterEmployee,
    amount: null,
    amountLabel: "Amount unavailable",
    reason: swap.reason || "Reason unavailable",
    orderId: null,
    orderReference: null,
    tableId: null,
    employeeName: targetEmployee,
    createdAt: swap.createdAt || null,
    updatedAt: swap.updatedAt || null,
    severity: "unavailable",
    severityLabel: "Severity unavailable",
    tags,
    searchText: baseSearchText([
      swap.id,
      "shift swap",
      status,
      requesterEmployee,
      targetEmployee,
      swap.reason,
      swap.shiftDate,
    ]),
    raw: swap,
  };
}

export function normalizeSupervisorAnomalyApproval(anomaly: SupervisorAnomaly): SupervisorApprovalItem {
  const severity = getSupervisorApprovalSeverity(anomaly.severity);
  const severityLabel = getSupervisorApprovalSeverityLabel(severity);
  const requester = getSupervisorUserName(anomaly.actorUser);
  const status = anomaly.status || "OPEN";
  const tags: SupervisorApprovalTag[] = [
    { key: "status", label: getSupervisorApprovalStatusLabel(status), tone: getSupervisorApprovalStatusTone(status) },
    { key: "severity", label: severityLabel, tone: getSupervisorApprovalSeverityTone(severity) },
  ];

  if (anomaly.type) {
    tags.push({ key: "type", label: getSupervisorApprovalStatusLabel(anomaly.type), tone: "neutral" });
  }

  return {
    id: anomaly.id,
    domain: "anomaly",
    domainLabel: "Anomaly",
    reference: anomaly.title || anomaly.id,
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    requester,
    amount: toSupervisorApprovalAmount(anomaly.score),
    amountLabel: anomaly.score === null || anomaly.score === undefined ? "Amount unavailable" : `Score ${anomaly.score}`,
    reason: anomaly.description || anomaly.title || "Reason unavailable",
    orderId: anomaly.relatedOrderId || null,
    orderReference: anomaly.relatedOrderId || null,
    tableId: null,
    employeeName: requester,
    createdAt: anomaly.createdAt || null,
    updatedAt: anomaly.updatedAt || null,
    severity,
    severityLabel,
    tags,
    searchText: baseSearchText([
      anomaly.id,
      "anomaly",
      anomaly.title,
      anomaly.description,
      anomaly.type,
      anomaly.status,
      anomaly.severity,
      anomaly.entityType,
      anomaly.entityId,
      anomaly.relatedOrderId,
      anomaly.relatedReservationId,
      requester,
    ]),
    raw: anomaly,
  };
}

export function normalizeSupervisorApprovalItem(
  domain: SupervisorApprovalDomain,
  value: SupervisorPendingDiscount | SupervisorLeaveRequest | SupervisorShiftSwap | SupervisorAnomaly,
) {
  if (domain === "discount") return normalizeSupervisorDiscountApproval(value as SupervisorPendingDiscount);
  if (domain === "leave") return normalizeSupervisorLeaveApproval(value as SupervisorLeaveRequest);
  if (domain === "shift-swap") return normalizeSupervisorShiftSwapApproval(value as SupervisorShiftSwap);
  return normalizeSupervisorAnomalyApproval(value as SupervisorAnomaly);
}

export function filterSupervisorApprovalItems({
  filter,
  items,
  query,
}: {
  filter: SupervisorApprovalFilter;
  items: SupervisorApprovalItem[];
  query: string;
}) {
  const needle = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      item.domain === filter ||
      (filter === "high-priority" && (item.severity === "high" || item.severity === "critical"));

    if (!matchesFilter) return false;
    if (!needle) return true;
    return item.searchText.includes(needle);
  });
}

function dateMs(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

const severityRank: Record<SupervisorApprovalSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
  unavailable: 0,
};

export function sortSupervisorApprovalItems(items: SupervisorApprovalItem[], sort: SupervisorApprovalSort) {
  return [...items].sort((a, b) => {
    if (sort === "oldest") return dateMs(a.createdAt) - dateMs(b.createdAt);
    if (sort === "highest-amount") return (b.amount ?? -1) - (a.amount ?? -1);
    if (sort === "domain") return a.domainLabel.localeCompare(b.domainLabel);
    if (sort === "status") return a.statusLabel.localeCompare(b.statusLabel);
    if (sort === "severity") return severityRank[b.severity] - severityRank[a.severity];
    return dateMs(b.createdAt) - dateMs(a.createdAt);
  });
}

export function countSupervisorApprovals(items: SupervisorApprovalItem[]) {
  return {
    discounts: items.filter((item) => item.domain === "discount").length,
    leave: items.filter((item) => item.domain === "leave").length,
    shiftSwaps: items.filter((item) => item.domain === "shift-swap").length,
    anomalies: items.filter((item) => item.domain === "anomaly").length,
    highPriority: items.filter((item) => item.severity === "high" || item.severity === "critical").length,
    total: items.length,
  };
}
