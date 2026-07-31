/**
 * Supervisor Approvals — verified backend contract layer (Prompt 5A).
 *
 * This module is the typed, domain-specific contract that the premium Approvals
 * workspace (Prompt 5B) consumes. It is ADDITIVE and consumed by 5B only — the
 * current read-only Approvals page (`lib/supervisor/approvals.ts` + its
 * components) is intentionally left unchanged.
 *
 * Architecture (locked): **domain-specific endpoints, never the generic
 * `unified-approvals` inbox.** The Supervisor role does not hold `approvals:read`
 * / `approvals:decide` (verified on shared Neon), so every decision uses its
 * canonical domain endpoint below — there is NO `POST /api/approvals/:id/decide`.
 *
 * The Needs-action / Resolved / History split is a set of UI groupings over each
 * domain's real lifecycle statuses — NOT persisted statuses.
 */

import {
  getSupervisorUserName,
  getSupervisorEmployeeName,
  type SupervisorEmployee,
} from "@/lib/supervisor/approvals";
import type { SupervisorOrderUser } from "@/lib/supervisor/orders";

// ── Domains & scopes ────────────────────────────────────────────────────────

/** The four actionable approval domains (refund / post-close void stay unavailable). */
export type ApprovalWorkspaceDomain = "discount" | "leave" | "shift-swap" | "anomaly";

/** UI queue groupings — never persisted statuses. */
export type ApprovalQueueScope = "needs-action" | "resolved" | "history";

// ── Canonical per-domain lifecycle (mirrors backend enums exactly) ───────────

type DomainLifecycle = {
  /** Statuses that still require a Supervisor decision → the Needs-action lane. */
  needsAction: readonly string[];
  /** Terminal statuses → Resolved (recent) / History (paginated). */
  terminal: readonly string[];
  /**
   * Intermediate statuses that are decided but not terminal (anomaly ACKNOWLEDGED
   * awaits resolution). Rendered inside Needs-action as an "in-progress" sub-lane.
   */
  inProgress?: readonly string[];
};

export const APPROVAL_LIFECYCLE: Record<ApprovalWorkspaceDomain, DomainLifecycle> = {
  discount: { needsAction: ["PENDING"], terminal: ["APPROVED", "REJECTED"] },
  leave: { needsAction: ["PENDING"], terminal: ["APPROVED", "REJECTED", "CANCELLED"] },
  "shift-swap": { needsAction: ["PENDING"], terminal: ["APPROVED", "REJECTED", "CANCELLED"] },
  // OPEN → ACKNOWLEDGED (still needs action: resolution) → RESOLVED (terminal).
  anomaly: { needsAction: ["OPEN"], inProgress: ["ACKNOWLEDGED"], terminal: ["RESOLVED"] },
};

/** All statuses that keep a row in the Needs-action lane for a domain. */
export function needsActionStatuses(domain: ApprovalWorkspaceDomain): string[] {
  const l = APPROVAL_LIFECYCLE[domain];
  return [...l.needsAction, ...(l.inProgress ?? [])];
}

// ── Canonical endpoints (verified live) ──────────────────────────────────────

/**
 * Availability of a branch-wide list per scope.
 *
 * ⚠️ Contract gap for 5B: discounts have **no branch-wide list endpoint** — only
 * `GET /pos/discounts/pending` (Needs-action) and per-order lists. So discount
 * Resolved/History cannot be shown as a branch-wide queue without a new backend
 * endpoint (out of Prompt 5A scope). Leave / shift-swap / anomaly support all
 * three scopes via a status + `dateFrom`/`dateTo` filtered list.
 */
export const APPROVAL_ENDPOINTS: Record<
  ApprovalWorkspaceDomain,
  {
    needsActionList: string;
    /** null = no branch-wide list endpoint (discount) → History unavailable branch-wide. */
    scopedList: string | null;
    decide: Record<string, string>; // action → path template with :id
  }
> = {
  discount: {
    needsActionList: "/pos/discounts/pending",
    scopedList: null,
    decide: {
      approve: "/pos/discounts/:id/approve",
      reject: "/pos/discounts/:id/reject",
    },
  },
  leave: {
    needsActionList: "/hr/leave",
    scopedList: "/hr/leave",
    decide: { review: "/hr/leave/:id/review" }, // body: { status: APPROVED|REJECTED, reviewNotes? }
  },
  "shift-swap": {
    needsActionList: "/hr/shift-swaps",
    scopedList: "/hr/shift-swaps",
    decide: { approve: "/hr/shift-swaps/:id/approve" }, // body: { status: APPROVED|REJECTED, reviewNotes? }
  },
  anomaly: {
    needsActionList: "/analytics/anomalies",
    scopedList: "/analytics/anomalies",
    decide: {
      acknowledge: "/analytics/anomalies/:id/acknowledge", // body: { resolutionNotes? }
      resolve: "/analytics/anomalies/:id/resolve", // body: { resolutionNotes (required) }
    },
  },
};

// ── Bounded pagination (matches server bounds) ───────────────────────────────

export const APPROVAL_PAGE_SIZE_DEFAULT = 25;
export const APPROVAL_PAGE_SIZE_MAX = 100; // server rejects take/limit > 100

export type ApprovalQueueParams = {
  scope: ApprovalQueueScope;
  page?: number; // 1-based
  pageSize?: number;
  status?: string; // a single lifecycle status (History filtering)
  dateFrom?: string; // ISO — History window
  dateTo?: string; // ISO — History window
};

/**
 * Build the query object with the CORRECT per-domain param names:
 * leave/shift-swap use skip/take; anomaly uses offset/limit; discount /pending
 * takes none. Server bounds are respected (pageSize clamped to [1,100]).
 */
export function buildApprovalQueueQuery(
  domain: ApprovalWorkspaceDomain,
  params: ApprovalQueueParams,
): Record<string, string> {
  const pageSize = Math.min(
    Math.max(params.pageSize ?? APPROVAL_PAGE_SIZE_DEFAULT, 1),
    APPROVAL_PAGE_SIZE_MAX,
  );
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const q: Record<string, string> = {};

  if (domain === "discount") {
    // /pending is unpaginated + PENDING only; nothing to add.
    return q;
  }
  if (params.status) q.status = params.status;
  if (params.dateFrom) q.dateFrom = params.dateFrom;
  if (params.dateTo) q.dateTo = params.dateTo;

  if (domain === "anomaly") {
    q.limit = String(pageSize);
    q.offset = String(offset);
  } else {
    q.take = String(pageSize);
    q.skip = String(offset);
  }
  return q;
}

// ── Minimal safe identity (names primary, UUID never a title) ────────────────

/**
 * The only identity shape the Approvals UI should render. It never carries
 * payroll, contact, address, tax, bank, or HR-profile data — only operational
 * display fields. `displayName` is guaranteed to be a human label, never a
 * raw UUID.
 */
export type ApprovalMinimalIdentity = {
  id: string | null;
  displayName: string;
  firstName: string | null;
  lastInitial: string | null;
  roleLabel: string | null;
  branchId: string | null;
  active: boolean | null;
};

const UNKNOWN_IDENTITY: ApprovalMinimalIdentity = {
  id: null,
  displayName: "Unknown staff member",
  firstName: null,
  lastInitial: null,
  roleLabel: null,
  branchId: null,
  active: null,
};

function lastInitialOf(lastName: string | null | undefined): string | null {
  const t = (lastName ?? "").trim();
  return t ? `${t.charAt(0).toUpperCase()}.` : null;
}

/** Resolve a minimal identity from a user relation (requester / reviewer). */
export function identityFromUser(
  user: SupervisorOrderUser | null | undefined,
  opts?: { roleLabel?: string | null; branchId?: string | null },
): ApprovalMinimalIdentity {
  if (!user) return { ...UNKNOWN_IDENTITY, ...(opts?.roleLabel ? { roleLabel: opts.roleLabel } : {}) };
  const displayName = getSupervisorUserName(user); // name → email → "Requester unavailable"
  return {
    id: user.id ?? null,
    displayName,
    firstName: user.firstName ?? null,
    lastInitial: lastInitialOf(user.lastName),
    roleLabel: opts?.roleLabel ?? null,
    branchId: opts?.branchId ?? null,
    active: null,
  };
}

/** Resolve a minimal identity from an employee relation (leave/swap subject). */
export function identityFromEmployee(
  employee: SupervisorEmployee | null | undefined,
  opts?: { roleLabel?: string | null },
): ApprovalMinimalIdentity {
  if (!employee) return UNKNOWN_IDENTITY;
  const displayName = getSupervisorEmployeeName(employee);
  return {
    id: employee.id ?? null,
    displayName,
    firstName: employee.firstName ?? null,
    lastInitial: lastInitialOf(employee.lastName),
    roleLabel: opts?.roleLabel ?? null,
    branchId: (employee as { branchId?: string | null }).branchId ?? null,
    active: (employee as { status?: string | null }).status
      ? (employee as { status?: string | null }).status === "ACTIVE"
      : null,
  };
}

/**
 * A short, non-identifying support reference for a row — a truncated id shown
 * ONLY in support/detail contexts, never as the row title. Prevents the
 * "raw UUID as heading" leak (SUP-RG-016).
 */
export function approvalSupportReference(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

// ── React Query keys (narrow, branch-scoped) ─────────────────────────────────

export const approvalKeys = {
  root: (branchId: string) => ["supervisor", "approvals", branchId] as const,
  queue: (
    branchId: string,
    domain: ApprovalWorkspaceDomain,
    scope: ApprovalQueueScope,
    params?: ApprovalQueueParams | null,
  ) => ["supervisor", "approvals", branchId, "queue", domain, scope, params ?? null] as const,
  detail: (branchId: string, domain: ApprovalWorkspaceDomain, id: string) =>
    ["supervisor", "approvals", branchId, "detail", domain, id] as const,
  counts: (branchId: string) => ["supervisor", "approvals", branchId, "counts"] as const,
};

/**
 * The exact, NARROW query keys to invalidate after a decision in `domain`.
 * Invalidate only this domain's queues + the counts + the affected detail — never
 * all Supervisor queries, Floor, Reservations, profile, auth, menu, all-orders, or
 * all-employees. Cross-role keys owned by other libs (order detail/Floor for
 * discount approve; Cashier order row) are listed in APPROVAL_CROSS_ROLE_INVALIDATION
 * for 5B to combine explicitly.
 */
export function approvalDecisionInvalidationKeys(
  branchId: string,
  domain: ApprovalWorkspaceDomain,
  detailId?: string,
): Array<readonly unknown[]> {
  const keys: Array<readonly unknown[]> = [
    approvalKeys.queue(branchId, domain, "needs-action"),
    approvalKeys.queue(branchId, domain, "resolved"),
    approvalKeys.queue(branchId, domain, "history"),
    approvalKeys.counts(branchId),
  ];
  if (detailId) keys.push(approvalKeys.detail(branchId, domain, detailId));
  return keys;
}

/**
 * Documentation of the cross-role keys 5B must ALSO invalidate for a discount
 * decision (they belong to the order/cashier libs, not this module). Approve
 * recalculates order totals; reject does not. Never invalidate globally.
 */
export const APPROVAL_CROSS_ROLE_INVALIDATION = {
  discountApprove: [
    "supervisor order detail (selected order)",
    "supervisor order discounts (selected order)",
    "supervisor floor (only the affected table)",
    "cashier canonical order row (affected order)",
  ],
  discountReject: [
    "supervisor order discounts (selected order)",
    // totals unchanged → no order-total / floor invalidation required
  ],
  leaveDecision: ["waiter/self leave status (if surfaced)", "roster only when contractually changed"],
  shiftSwapDecision: [
    "requester employee schedule",
    "target employee schedule",
    "roster only when contractually changed",
  ],
  anomalyDecision: ["originating operational read only when required"],
} as const;

// ── Counts contract ──────────────────────────────────────────────────────────

export type ApprovalCounts = Record<ApprovalWorkspaceDomain, number> & { total: number };

/**
 * Derive queue counts from the SERVER-COMPUTED `total` of each bounded
 * Needs-action list (each list endpoint returns a `count()` total). 5B should
 * request page 1 with a small pageSize and read `total` — this avoids fetching
 * full rows just to count, and never crosses branches. Anomaly Needs-action =
 * OPEN + ACKNOWLEDGED.
 */
export function approvalCountsFromTotals(input: {
  discount: number;
  leave: number;
  shiftSwap: number;
  anomaly: number;
}): ApprovalCounts {
  const total = input.discount + input.leave + input.shiftSwap + input.anomaly;
  return {
    discount: input.discount,
    leave: input.leave,
    "shift-swap": input.shiftSwap,
    anomaly: input.anomaly,
    total,
  };
}

// ── Error contract (§39) ─────────────────────────────────────────────────────

/**
 * Map an API error status to safe UI copy. Never surface raw Prisma/SQL text.
 * The hardened backend returns 409 on a concurrent/terminal-state decision and
 * 404 on cross-branch / missing rows (branch isolation), 403 on permission.
 */
export function mapApprovalErrorToMessage(status: number | undefined): string {
  switch (status) {
    case 400:
      return "That decision isn’t valid for this item’s current state.";
    case 403:
      return "You don’t have permission to make this decision.";
    case 404:
      return "This item is no longer available in your branch.";
    case 409:
      return "Someone already actioned this item. Refreshing the queue.";
    case 408:
    case 504:
      return "The request timed out. Please try again.";
    case 401:
      return "Your session expired. Please sign in again.";
    default:
      return "Something went wrong making that decision. Please try again.";
  }
}
