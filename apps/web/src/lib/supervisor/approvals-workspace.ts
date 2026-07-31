/**
 * Supervisor Approvals — premium workspace data layer (Prompt 5B1).
 *
 * Consumes the verified Prompt 5A contract (`approvals-contract.ts`) and the
 * existing fetchers/formatters (`approvals.ts` / `orders.ts` / `order-financials.ts`).
 * It is ADDITIVE: it does not modify the 5A contract or any backend surface.
 *
 * Scope of 5B1 decisions: **Discounts + Leave are actionable**. Shift-swaps and
 * Anomalies render read-only through the same queue/detail architecture (their
 * live decisions land in Prompt 5B2).
 *
 * Queue model (all bounded, no browser storms):
 *  - NEEDS ACTION: one bounded (≤100) needs-action fetch per domain, merged for
 *    "All", client-paginated for display. Counts come from those bounded sets /
 *    server totals — never a full-list count fetch.
 *  - RESOLVED / HISTORY: server-paginated terminal windows for leave / shift-swap /
 *    anomaly. **Discounts have NO branch-wide list endpoint** (SUP-RG-035), so
 *    discount Resolved/History is not a branch-wide queue — the UI omits discount
 *    from those scopes and shows truthful "available from the related order" copy.
 */

import { apiRequest, ApiError } from "@/lib/api/client";
import {
  approveSupervisorDiscount,
  rejectSupervisorDiscount,
} from "@/lib/supervisor/orders";
import type { SupervisorOrderUser } from "@/lib/supervisor/orders";
import {
  fetchSupervisorPendingDiscounts,
  fetchSupervisorDiscountDetail,
  fetchSupervisorAnomalyDetail,
  formatSupervisorApprovalMoney,
  formatSupervisorApprovalDate,
  getSupervisorApprovalSeverity,
  getSupervisorApprovalStatusLabel,
  getSupervisorApprovalStatusTone,
  getSupervisorApprovalSeverityLabel,
  getSupervisorApprovalSeverityTone,
  getSupervisorUserName,
  getSupervisorEmployeeName,
  type SupervisorApprovalSeverity,
  type SupervisorApprovalTone,
  type SupervisorPendingDiscount,
  type SupervisorLeaveRequest,
  type SupervisorShiftSwap,
  type SupervisorAnomaly,
  type SupervisorPaginated,
} from "@/lib/supervisor/approvals";
import {
  APPROVAL_LIFECYCLE,
  APPROVAL_PAGE_SIZE_DEFAULT,
  APPROVAL_PAGE_SIZE_MAX,
  identityFromUser,
  identityFromEmployee,
  type ApprovalMinimalIdentity,
  type ApprovalWorkspaceDomain,
  type ApprovalQueueScope,
} from "@/lib/supervisor/approvals-contract";

// ── Domain presentation metadata ────────────────────────────────────────────

export const APPROVAL_DOMAIN_LABEL: Record<ApprovalWorkspaceDomain, string> = {
  discount: "Discounts",
  leave: "Leave",
  "shift-swap": "Shift swaps",
  anomaly: "Anomalies",
};

/** Domains a given scope can render as a branch-wide queue. */
export function domainsForScope(scope: ApprovalQueueScope): ApprovalWorkspaceDomain[] {
  if (scope === "needs-action") return ["discount", "leave", "shift-swap", "anomaly"];
  // Discounts have no branch-wide resolved/history endpoint (SUP-RG-035).
  return ["leave", "shift-swap", "anomaly"];
}

export function scopeSupportsDomain(scope: ApprovalQueueScope, domain: ApprovalWorkspaceDomain) {
  return domainsForScope(scope).includes(domain);
}

/** Whether this domain exposes live decision actions in Prompt 5B1. */
export function domainIsActionable(domain: ApprovalWorkspaceDomain): boolean {
  return domain === "discount" || domain === "leave";
}

// ── Normalised queue item (one shared row shell, domain-specific content) ─────

export type ApprovalQueueItem = {
  domain: ApprovalWorkspaceDomain;
  id: string;
  /** Primary operational identity (never a raw UUID). */
  identity: ApprovalMinimalIdentity;
  /** Row title = the identity display name. */
  title: string;
  /** Concise, privacy-safe request summary. */
  summary: string;
  status: string;
  statusLabel: string;
  statusTone: SupervisorApprovalTone;
  severity: SupervisorApprovalSeverity | null;
  severityLabel: string | null;
  severityTone: SupervisorApprovalTone | null;
  /** ISO time the row became actionable (created for pending, decided for terminal). */
  actionableAtIso: string | null;
  actionableAtLabel: string;
  /** Optional money/summary chip (discount value). */
  amountLabel: string | null;
  /** Deterministic sort inputs. */
  sortSeverity: number;
  sortTimeMs: number;
  /** The raw domain payload (drives the detail panel for leave / shift-swap). */
  raw: SupervisorPendingDiscount | SupervisorLeaveRequest | SupervisorShiftSwap | SupervisorAnomaly;
};

function timeMs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const SEVERITY_RANK: Record<SupervisorApprovalSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
  unavailable: 0,
};

function leaveDurationDays(startsAt?: string | null, endsAt?: string | null): number | null {
  if (!startsAt || !endsAt) return null;
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  // Inclusive whole-day span derived from returned dates (not a fabricated balance).
  return Math.floor((b - a) / 86_400_000) + 1;
}

function formatDateRange(startsAt?: string | null, endsAt?: string | null): string {
  const fmt = (v?: string | null) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "—"
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  };
  return `${fmt(startsAt)} → ${fmt(endsAt)}`;
}

function formatDay(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

// ── Per-domain normalisers ────────────────────────────────────────────────────

function normaliseDiscount(d: SupervisorPendingDiscount): ApprovalQueueItem {
  const identity = identityFromUser(d.createdBy as SupervisorOrderUser | null, { roleLabel: "Requester" });
  const status = (d.status || "PENDING").toUpperCase();
  const decidedAt = d.approvedAt || d.updatedAt || null;
  const actionableAtIso = status === "PENDING" ? d.createdAt || null : decidedAt;
  const orderRef = d.order?.orderNumber || (d.orderId ? `#${d.orderId.slice(-6)}` : null);
  const typeLabel = d.type ? getSupervisorApprovalStatusLabel(d.type) : "Discount";
  return {
    domain: "discount",
    id: d.id,
    identity,
    title: identity.displayName,
    summary: [orderRef ? `Order ${orderRef}` : null, `${typeLabel} discount`, d.reason?.trim() || null]
      .filter(Boolean)
      .join(" · "),
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    statusTone: getSupervisorApprovalStatusTone(status),
    severity: null,
    severityLabel: null,
    severityTone: null,
    actionableAtIso,
    actionableAtLabel: formatSupervisorApprovalDate(actionableAtIso),
    amountLabel: d.type === "PERCENTAGE" ? `${d.value ?? "—"}%` : formatSupervisorApprovalMoney(d.value),
    sortSeverity: 0,
    sortTimeMs: timeMs(actionableAtIso),
    raw: d,
  };
}

function normaliseLeave(l: SupervisorLeaveRequest): ApprovalQueueItem {
  const identity = identityFromEmployee(l.employee, { roleLabel: "Employee" });
  const status = (l.status || "PENDING").toUpperCase();
  const actionableAtIso = status === "PENDING" ? l.createdAt || null : l.reviewedAt || l.updatedAt || null;
  const days = leaveDurationDays(l.startsAt, l.endsAt);
  const typeLabel = l.leaveType ? getSupervisorApprovalStatusLabel(l.leaveType) : "Leave";
  return {
    domain: "leave",
    id: l.id,
    identity,
    title: identity.displayName,
    summary: [`${typeLabel} leave`, formatDateRange(l.startsAt, l.endsAt), days ? `${days} day${days === 1 ? "" : "s"}` : null]
      .filter(Boolean)
      .join(" · "),
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    statusTone: getSupervisorApprovalStatusTone(status),
    severity: null,
    severityLabel: null,
    severityTone: null,
    actionableAtIso,
    actionableAtLabel: formatSupervisorApprovalDate(actionableAtIso),
    amountLabel: null,
    sortSeverity: 0,
    sortTimeMs: timeMs(actionableAtIso),
    raw: l,
  };
}

function normaliseShiftSwap(s: SupervisorShiftSwap): ApprovalQueueItem {
  const requester = identityFromEmployee(s.requester, { roleLabel: "Requesting employee" });
  const target = identityFromEmployee(s.target, { roleLabel: "Target employee" });
  const status = (s.status || "PENDING").toUpperCase();
  const actionableAtIso = status === "PENDING" ? s.createdAt || null : s.approvedAt || s.updatedAt || null;
  return {
    domain: "shift-swap",
    id: s.id,
    identity: requester,
    title: requester.displayName,
    summary: [`Swap with ${target.displayName}`, `Shift ${formatDay(s.shiftDate)}`].filter(Boolean).join(" · "),
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    statusTone: getSupervisorApprovalStatusTone(status),
    severity: null,
    severityLabel: null,
    severityTone: null,
    actionableAtIso,
    actionableAtLabel: formatSupervisorApprovalDate(actionableAtIso),
    amountLabel: null,
    sortSeverity: 0,
    sortTimeMs: timeMs(actionableAtIso),
    raw: s,
  };
}

function normaliseAnomaly(a: SupervisorAnomaly): ApprovalQueueItem {
  const identity = identityFromUser(a.actorUser as SupervisorOrderUser | null, { roleLabel: "Actor" });
  const status = (a.status || "OPEN").toUpperCase();
  const severity = getSupervisorApprovalSeverity(a.severity);
  const actionableAtIso =
    status === "RESOLVED" || status === "ACKNOWLEDGED" ? a.acknowledgedAt || a.updatedAt || a.createdAt || null : a.createdAt || null;
  const typeLabel = a.rule?.name || (a.type ? getSupervisorApprovalStatusLabel(a.type) : "Anomaly");
  const affected = a.entityType ? getSupervisorApprovalStatusLabel(a.entityType) : null;
  return {
    domain: "anomaly",
    id: a.id,
    // For anomalies the "identity" line is the anomaly type; actor is secondary.
    identity: { ...identity, displayName: typeLabel },
    title: typeLabel,
    summary: [affected ? `Affects ${affected}` : null, `Actor ${identity.displayName}`].filter(Boolean).join(" · "),
    status,
    statusLabel: getSupervisorApprovalStatusLabel(status),
    statusTone: getSupervisorApprovalStatusTone(status),
    severity,
    severityLabel: getSupervisorApprovalSeverityLabel(severity),
    severityTone: getSupervisorApprovalSeverityTone(severity),
    actionableAtIso,
    actionableAtLabel: formatSupervisorApprovalDate(actionableAtIso),
    amountLabel: null,
    sortSeverity: SEVERITY_RANK[severity],
    sortTimeMs: timeMs(actionableAtIso),
    raw: a,
  };
}

export function normaliseQueueItem(
  domain: ApprovalWorkspaceDomain,
  raw: SupervisorPendingDiscount | SupervisorLeaveRequest | SupervisorShiftSwap | SupervisorAnomaly,
): ApprovalQueueItem {
  if (domain === "discount") return normaliseDiscount(raw as SupervisorPendingDiscount);
  if (domain === "leave") return normaliseLeave(raw as SupervisorLeaveRequest);
  if (domain === "shift-swap") return normaliseShiftSwap(raw as SupervisorShiftSwap);
  return normaliseAnomaly(raw as SupervisorAnomaly);
}

/**
 * Canonical deterministic ordering (§15): severity desc → actionable time desc →
 * stable id. Never a fabricated numeric urgency score; severity only ranks
 * anomalies (the only domain with a verified severity field).
 */
export function sortQueueItems(items: ApprovalQueueItem[]): ApprovalQueueItem[] {
  return [...items].sort((a, b) => {
    if (b.sortSeverity !== a.sortSeverity) return b.sortSeverity - a.sortSeverity;
    if (b.sortTimeMs !== a.sortTimeMs) return b.sortTimeMs - a.sortTimeMs;
    return a.id.localeCompare(b.id);
  });
}

function isTerminal(domain: ApprovalWorkspaceDomain, status: string): boolean {
  return APPROVAL_LIFECYCLE[domain].terminal.includes(status.toUpperCase());
}

// ── Bounded fetchers ──────────────────────────────────────────────────────────

const NEEDS_ACTION_FETCH_CAP = APPROVAL_PAGE_SIZE_MAX; // 100 — bounded per lane
const RESOLVED_WINDOW_DAYS = 14;

function qs(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export type DomainFetchResult = { items: ApprovalQueueItem[]; total: number };

/** Needs-action set for one domain (bounded ≤100), already normalised + sorted. */
export async function fetchNeedsAction(
  domain: ApprovalWorkspaceDomain,
  token: string,
  branchId: string,
): Promise<DomainFetchResult> {
  if (domain === "discount") {
    const rows = await fetchSupervisorPendingDiscounts(token, branchId);
    const items = sortQueueItems(rows.map((r) => normaliseQueueItem("discount", r)));
    return { items, total: rows.length };
  }
  if (domain === "leave") {
    const res = await apiRequest<SupervisorPaginated<SupervisorLeaveRequest>>(
      `/api/hr/leave${qs({ status: "PENDING", take: NEEDS_ACTION_FETCH_CAP, skip: 0 })}`,
      { token, branchId },
    );
    return { items: sortQueueItems((res.data || []).map((r) => normaliseQueueItem("leave", r))), total: res.total };
  }
  if (domain === "shift-swap") {
    const res = await apiRequest<SupervisorPaginated<SupervisorShiftSwap>>(
      `/api/hr/shift-swaps${qs({ status: "PENDING", take: NEEDS_ACTION_FETCH_CAP, skip: 0 })}`,
      { token, branchId },
    );
    return { items: sortQueueItems((res.data || []).map((r) => normaliseQueueItem("shift-swap", r))), total: res.total };
  }
  // anomaly needs-action = OPEN + ACKNOWLEDGED (two bounded lanes, merged).
  const [open, ack] = await Promise.all([
    apiRequest<SupervisorPaginated<SupervisorAnomaly>>(
      `/api/analytics/anomalies${qs({ status: "OPEN", limit: NEEDS_ACTION_FETCH_CAP, offset: 0 })}`,
      { token, branchId },
    ),
    apiRequest<SupervisorPaginated<SupervisorAnomaly>>(
      `/api/analytics/anomalies${qs({ status: "ACKNOWLEDGED", limit: NEEDS_ACTION_FETCH_CAP, offset: 0 })}`,
      { token, branchId },
    ),
  ]);
  const merged = [...(open.data || []), ...(ack.data || [])].map((r) => normaliseQueueItem("anomaly", r));
  return { items: sortQueueItems(merged), total: open.total + ack.total };
}

function resolvedDefaultDateFrom(): string {
  // Recent window for Resolved. Uses a fixed 14-day lookback from "now".
  const from = new Date(Date.now() - RESOLVED_WINDOW_DAYS * 86_400_000);
  return from.toISOString();
}

export type TerminalQueueParams = {
  scope: Extract<ApprovalQueueScope, "resolved" | "history">;
  page: number; // 1-based
  status?: string; // optional terminal status sub-filter
  dateFrom?: string;
  dateTo?: string;
};

/**
 * One terminal (Resolved/History) server page for a leave / shift-swap / anomaly
 * domain, client-filtered to terminal statuses. Server-paginated by `page`.
 * Discounts are unsupported here (throws — callers must gate with scopeSupportsDomain).
 */
export async function fetchTerminalPage(
  domain: ApprovalWorkspaceDomain,
  token: string,
  branchId: string,
  params: TerminalQueueParams,
): Promise<DomainFetchResult> {
  if (domain === "discount") {
    throw new Error("Discounts have no branch-wide resolved/history endpoint");
  }
  const pageSize = APPROVAL_PAGE_SIZE_DEFAULT;
  const offset = (Math.max(params.page, 1) - 1) * pageSize;
  const dateFrom = params.scope === "resolved" ? params.dateFrom || resolvedDefaultDateFrom() : params.dateFrom;
  const dateTo = params.dateTo;

  let rows: (SupervisorLeaveRequest | SupervisorShiftSwap | SupervisorAnomaly)[] = [];
  let total = 0;
  if (domain === "anomaly") {
    const res = await apiRequest<SupervisorPaginated<SupervisorAnomaly>>(
      `/api/analytics/anomalies${qs({ status: params.status, dateFrom, dateTo, limit: pageSize, offset })}`,
      { token, branchId },
    );
    rows = res.data || [];
    total = res.total;
  } else {
    const path = domain === "leave" ? "/api/hr/leave" : "/api/hr/shift-swaps";
    const res = await apiRequest<SupervisorPaginated<SupervisorLeaveRequest | SupervisorShiftSwap>>(
      `${path}${qs({ status: params.status, dateFrom, dateTo, take: pageSize, skip: offset })}`,
      { token, branchId },
    );
    rows = res.data || [];
    total = res.total;
  }

  const items = rows
    .map((r) => normaliseQueueItem(domain, r))
    .filter((it) => isTerminal(domain, it.status));
  return { items: sortQueueItems(items), total };
}

// ── Detail fetchers (fresh) ───────────────────────────────────────────────────

export function fetchDiscountDetail(token: string, branchId: string, id: string) {
  return fetchSupervisorDiscountDetail(token, branchId, id);
}
export function fetchAnomalyDetail(token: string, branchId: string, id: string) {
  return fetchSupervisorAnomalyDetail(token, branchId, id);
}

// ── Decision mutations ────────────────────────────────────────────────────────

export function approveDiscount(token: string, branchId: string, id: string, managerPin?: string) {
  return approveSupervisorDiscount(token, branchId, id, managerPin);
}
export function rejectDiscount(token: string, branchId: string, id: string, rejectionReason: string) {
  return rejectSupervisorDiscount(token, branchId, id, rejectionReason);
}

// PATCH /api/hr/leave/:id/review — body { status, reviewNotes? }. PENDING-only (409 on race).
export function reviewLeave(
  token: string,
  branchId: string,
  id: string,
  status: "APPROVED" | "REJECTED",
  reviewNotes?: string,
) {
  const trimmed = reviewNotes?.trim();
  return apiRequest<SupervisorLeaveRequest>(`/api/hr/leave/${id}/review`, {
    method: "PATCH",
    token,
    branchId,
    body: trimmed ? { status, reviewNotes: trimmed } : { status },
  });
}

// ── Shift-swap (Prompt 5B2, Outcome C: REJECT only — no roster reassignment) ──
//
// Approval is intentionally NOT exposed: `PATCH /hr/shift-swaps/:id/approve` writes status + audit
// only and does not reassign the roster (there is no runtime roster-mutation service; the request
// references only a date, not a specific ScheduleAssignment). Rejecting is truthful and safe — it
// sets REJECTED + audit and changes no schedule. PENDING-only (400/409 on race).
export function rejectShiftSwap(token: string, branchId: string, id: string, reviewNotes?: string) {
  const trimmed = reviewNotes?.trim();
  return apiRequest<SupervisorShiftSwap>(`/api/hr/shift-swaps/${id}/approve`, {
    method: "PATCH",
    token,
    branchId,
    body: trimmed ? { status: "REJECTED", reviewNotes: trimmed } : { status: "REJECTED" },
  });
}

// ── Anomaly (Prompt 5B2: acknowledge + resolve) ──
//
// PATCH /analytics/anomalies/:id/acknowledge — OPEN → ACKNOWLEDGED, notes optional (400 if not OPEN).
export function acknowledgeAnomaly(token: string, branchId: string, id: string, resolutionNotes?: string) {
  const trimmed = resolutionNotes?.trim();
  return apiRequest<SupervisorAnomaly>(`/api/analytics/anomalies/${id}/acknowledge`, {
    method: "PATCH",
    token,
    branchId,
    body: trimmed ? { resolutionNotes: trimmed } : {},
  });
}

// PATCH /analytics/anomalies/:id/resolve — ACKNOWLEDGED → RESOLVED only, notes REQUIRED (400 if not ACK).
export function resolveAnomaly(token: string, branchId: string, id: string, resolutionNotes: string) {
  return apiRequest<SupervisorAnomaly>(`/api/analytics/anomalies/${id}/resolve`, {
    method: "PATCH",
    token,
    branchId,
    body: { resolutionNotes: resolutionNotes.trim() },
  });
}

// ── Error mapping helpers (reuse the 5A contract's mapping) ───────────────────

export function decisionErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}
