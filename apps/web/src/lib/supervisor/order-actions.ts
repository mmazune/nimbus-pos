import type { SupervisorOrderStatus, SupervisorPaymentState } from "./orders";

// Payment states that mean money is (or was) attached to the order. Active-order
// financial adjustments (void / discount request) are UI-gated off these — the
// backend does NOT itself check payment state, so this guard is a deliberate,
// documented frontend safety boundary (a paid order belongs to the payment/refund
// or post-close workflow, all Cashier-owned and out of Supervisor scope).
const MONEY_PAYMENT_STATES: readonly SupervisorPaymentState[] = [
  "settled",
  "partially-paid",
  "pending",
  "failed",
  "refunded",
];

// ─────────────────────────────────────────────────────────────────────────────
// Central Supervisor order-action availability.
//
// This is the single source of truth for whether a Supervisor order action is
// visible/enabled and what infrastructure it requires (confirmation, reason,
// manager PIN, idempotency key). UI components must derive button state from
// here rather than re-implementing per-button conditions.
//
// Prompt 3A wires only the two verified, non-financial service actions
// (request-bill, mark-served). Every other action is encoded here as prepared
// foundation for Prompt 3B and stays hidden until that phase enables it.
// ─────────────────────────────────────────────────────────────────────────────

export type SupervisorOrderAction =
  | "request-bill"
  | "mark-served"
  | "split-bill"
  | "split-items"
  | "merge"
  | "move-items"
  | "transfer-table"
  | "transfer-server"
  | "void"
  | "request-discount"
  | "approve-discount"
  | "reject-discount"
  | "complimentary";

export type SupervisorActionAvailability = {
  action: SupervisorOrderAction;
  visible: boolean;
  enabled: boolean;
  reason: string | null;
  requiresConfirmation: boolean;
  requiresReason: boolean;
  requiresManagerPin: boolean;
  requiresIdempotencyKey: boolean;
};

export type SupervisorOrderActionContext = {
  permissions: readonly string[];
  order: { status: SupervisorOrderStatus | string } | null;
  orderErrored?: boolean;
  isMutating?: boolean;
  /** Number of order lines available for split/move actions. */
  lineCount?: number;
  /** Order total (number or decimal string) for split-bill / discount gating. */
  total?: number | string | null;
  /** Derived payment state; financial actions require a money-free order. */
  paymentState?: SupervisorPaymentState;
  /** True when payment state could not be confirmed (loading or errored) — pauses financial actions. */
  paymentUnavailable?: boolean;
  /** True when an unresolved PENDING discount already exists (blocks a duplicate request). */
  hasPendingDiscount?: boolean;
};

// Actions that are LIVE. Prompt 3A shipped request-bill + mark-served; Prompt 3B1
// added split-bill, split-items, move-items, and merge; Prompt 3B2 added
// transfer-table; Prompt 3B3A added active-order void + request-discount; Prompt
// 3B3B adds discount approve/reject + complimentary. transfer-server stays
// foundation (blockedReason: no safe server selector).
export const SUPERVISOR_LIVE_ORDER_ACTIONS: readonly SupervisorOrderAction[] = [
  "request-bill",
  "mark-served",
  "split-bill",
  "split-items",
  "move-items",
  "merge",
  "transfer-table",
  "void",
  "request-discount",
  "approve-discount",
  "reject-discount",
  "complimentary",
];

const OPEN_STATUSES: readonly SupervisorOrderStatus[] = [
  "NEW",
  "SENT",
  "IN_KITCHEN",
  "READY",
  "SERVED",
];

// Statuses in which the backend accepts a discount request / discount approval
// (DISCOUNTABLE_STATES on the backend; SERVED is excluded). Approving a discount
// recalcs order totals and the backend re-checks this, so approve is gated here too.
const DISCOUNTABLE_STATUSES: readonly SupervisorOrderStatus[] = [
  "NEW",
  "SENT",
  "IN_KITCHEN",
  "READY",
];

type ActionMeta = {
  /** Required permission, or null if the action needs none. */
  permission: string | null;
  requiresConfirmation: boolean;
  requiresReason: boolean;
  requiresManagerPin: boolean;
  requiresIdempotencyKey: boolean;
  /** Order statuses in which the action is operationally valid. */
  allowedStatuses: readonly SupervisorOrderStatus[];
  /** Requires at least one order line (split-items / move-items). */
  requiresLines?: boolean;
  /** Requires a positive order total (split-bill / request-discount). */
  requiresPositiveTotal?: boolean;
  /** Requires a money-free order (void / request-discount financial safety gate). */
  requiresCleanPayment?: boolean;
  /** Blocked while an unresolved PENDING discount already exists (request-discount). */
  blockedByPendingDiscount?: boolean;
  /**
   * A hard blocker that keeps the action unavailable even when permission and
   * status are satisfied (e.g. a required safe selector that does not exist yet).
   */
  blockedReason?: string;
};

const ACTION_META: Record<SupervisorOrderAction, ActionMeta> = {
  // ── Prompt 3A live service actions ──
  "request-bill": {
    permission: "pos:orders:write",
    requiresConfirmation: false,
    requiresReason: false,
    requiresManagerPin: false,
    requiresIdempotencyKey: false, // backend request-bill is not BG3-wrapped
    allowedStatuses: OPEN_STATUSES,
  },
  "mark-served": {
    permission: "pos:orders:write",
    requiresConfirmation: true,
    requiresReason: false, // TransitionOrderDto reason is optional
    requiresManagerPin: false,
    requiresIdempotencyKey: false, // backend mark-served is not BG3-wrapped
    allowedStatuses: ["READY"],
  },

  // ── Prompt 3B foundation (hidden in 3A) ──
  "split-bill": {
    permission: "pos:order:split",
    requiresConfirmation: true,
    requiresReason: false,
    requiresManagerPin: false,
    requiresIdempotencyKey: true,
    allowedStatuses: OPEN_STATUSES,
    requiresPositiveTotal: true,
  },
  "split-items": {
    permission: "pos:order:split",
    requiresConfirmation: true,
    requiresReason: false,
    requiresManagerPin: false,
    requiresIdempotencyKey: true,
    allowedStatuses: OPEN_STATUSES,
    requiresLines: true,
  },
  merge: {
    permission: "pos:order:merge",
    requiresConfirmation: true,
    requiresReason: true, // merge requires an explicit reason in the UI
    requiresManagerPin: false,
    requiresIdempotencyKey: true,
    allowedStatuses: OPEN_STATUSES,
  },
  "move-items": {
    permission: "pos:order:move-items",
    requiresConfirmation: true,
    requiresReason: false,
    requiresManagerPin: false,
    requiresIdempotencyKey: true,
    allowedStatuses: OPEN_STATUSES,
    requiresLines: true,
  },
  "transfer-table": {
    permission: "pos:order:transfer",
    requiresConfirmation: true,
    requiresReason: false,
    requiresManagerPin: false,
    requiresIdempotencyKey: true,
    allowedStatuses: OPEN_STATUSES,
  },
  "transfer-server": {
    permission: "pos:order:transfer",
    requiresConfirmation: true,
    requiresReason: false,
    requiresManagerPin: false,
    requiresIdempotencyKey: true,
    allowedStatuses: OPEN_STATUSES,
    blockedReason: "A safe server selector is not available in this version.",
  },
  void: {
    permission: "pos:orders:void",
    requiresConfirmation: true,
    // Backend requires a reason only for IN_KITCHEN/READY; the UI requires it for
    // every active void so the audit trail is always meaningful (backend-accepted).
    requiresReason: true,
    requiresManagerPin: false, // the /void endpoint accepts no manager PIN
    requiresIdempotencyKey: false, // /void is NOT BG3-wrapped
    allowedStatuses: ["NEW", "SENT", "IN_KITCHEN", "READY"], // SERVED → CLOSED only
    requiresCleanPayment: true,
  },
  "request-discount": {
    permission: "pos:discount:request",
    requiresConfirmation: true,
    requiresReason: true, // RequestDiscountDto reason is @IsNotEmpty
    requiresManagerPin: false,
    requiresIdempotencyKey: false, // discount request is NOT BG3-wrapped
    allowedStatuses: ["NEW", "SENT", "IN_KITCHEN", "READY"], // DISCOUNTABLE_STATES (SERVED excluded)
    requiresPositiveTotal: true,
    requiresCleanPayment: true,
    blockedByPendingDiscount: true,
  },
  "approve-discount": {
    permission: "pos:discount:approve",
    requiresConfirmation: true,
    requiresReason: false, // ApproveDiscountDto has no notes; managerPin optional
    requiresManagerPin: false, // manager PIN is optional (re-auths the approver)
    requiresIdempotencyKey: false, // approve is NOT BG3-wrapped
    // Approval recalcs order totals; the backend re-checks the order is still
    // discountable (SERVED excluded). Payment-gated (mutates totals).
    allowedStatuses: DISCOUNTABLE_STATUSES,
    requiresCleanPayment: true,
  },
  "reject-discount": {
    permission: "pos:discount:approve",
    requiresConfirmation: true,
    requiresReason: true, // RejectDiscountDto rejectionReason is required
    requiresManagerPin: false,
    requiresIdempotencyKey: false, // reject is NOT BG3-wrapped
    // Rejection does NOT change totals, so it is not payment-gated; the UI keeps
    // it to open orders (a pending discount normally lives on an open order).
    allowedStatuses: OPEN_STATUSES,
  },
  complimentary: {
    // Outcome B — no dedicated complimentary type exists; a whole-order comp is a
    // verified discount request (100% + metadata {complimentary,category} + reason),
    // so it uses the discount-request permission and lifecycle (may return PENDING).
    permission: "pos:discount:request",
    requiresConfirmation: true,
    requiresReason: true,
    requiresManagerPin: false,
    requiresIdempotencyKey: false, // discount request is NOT BG3-wrapped
    allowedStatuses: DISCOUNTABLE_STATUSES, // SERVED excluded (DISCOUNTABLE_STATES)
    requiresPositiveTotal: true,
    requiresCleanPayment: true,
    blockedByPendingDiscount: true,
  },
};

function unavailableStatusReason(
  action: SupervisorOrderAction,
  status: SupervisorOrderStatus | string | undefined,
): string {
  if (action === "mark-served") {
    return "Mark served becomes available once the kitchen marks this order ready.";
  }
  if (action === "request-bill") {
    return "Bill actions are unavailable on a closed or voided order.";
  }
  if (action === "void") {
    return "This order can no longer be voided as an active order.";
  }
  if (action === "request-discount" || action === "complimentary") {
    return "This can't be requested on a served, closed, or voided order.";
  }
  if (action === "approve-discount") {
    return "This discount can't be approved while the order is served, closed, or voided.";
  }
  if (action === "reject-discount") {
    return "This discount can't be reviewed on a closed or voided order.";
  }
  return status
    ? `This action is not available while the order is ${status.toLowerCase()}.`
    : "This action is not available for the current order state.";
}

export function getSupervisorOrderActionAvailability(
  action: SupervisorOrderAction,
  ctx: SupervisorOrderActionContext,
): SupervisorActionAvailability {
  const meta = ACTION_META[action];
  const isLive = SUPERVISOR_LIVE_ORDER_ACTIONS.includes(action);
  const hasPermission = meta.permission ? ctx.permissions.includes(meta.permission) : true;

  const visible = isLive && hasPermission;

  const status = ctx.order?.status as SupervisorOrderStatus | undefined;
  const hasOrder = Boolean(ctx.order) && !ctx.orderErrored;
  const statusAllowed = Boolean(status && meta.allowedStatuses.includes(status));
  const mutating = Boolean(ctx.isMutating);
  const totalValue = ctx.total === undefined || ctx.total === null ? null : Number(ctx.total);
  const hasLines = meta.requiresLines ? (ctx.lineCount ?? 0) > 0 : true;
  const hasPositiveTotal = meta.requiresPositiveTotal
    ? totalValue !== null && Number.isFinite(totalValue) && totalValue > 0
    : true;
  const paymentBlocked = Boolean(
    meta.requiresCleanPayment &&
      (ctx.paymentUnavailable === true ||
        (ctx.paymentState !== undefined && MONEY_PAYMENT_STATES.includes(ctx.paymentState))),
  );
  const pendingDiscountBlocked = Boolean(meta.blockedByPendingDiscount && ctx.hasPendingDiscount);

  const enabled =
    visible &&
    hasOrder &&
    statusAllowed &&
    hasLines &&
    hasPositiveTotal &&
    !paymentBlocked &&
    !pendingDiscountBlocked &&
    !mutating &&
    !meta.blockedReason;

  let reason: string | null = null;
  if (visible && !enabled) {
    if (meta.blockedReason) reason = meta.blockedReason;
    else if (!hasOrder) reason = "No active order is linked to this context.";
    else if (!statusAllowed) reason = unavailableStatusReason(action, status);
    else if (paymentBlocked) {
      reason = ctx.paymentUnavailable
        ? "Payment state is unavailable right now — this adjustment is paused until it can be confirmed."
        : "A payment exists on this order — use the payment or refund workflow instead of an active-order adjustment.";
    } else if (pendingDiscountBlocked) {
      reason = "A discount request is already pending approval on this order.";
    } else if (!hasLines) reason = "This order has no items to move.";
    else if (!hasPositiveTotal) {
      reason = action === "request-discount"
        ? "There is no positive amount left to discount."
        : "This order has no billable total to split.";
    } else if (mutating) reason = "Another action is in progress.";
  }

  return {
    action,
    visible,
    enabled,
    reason,
    requiresConfirmation: meta.requiresConfirmation,
    requiresReason: meta.requiresReason,
    requiresManagerPin: meta.requiresManagerPin,
    requiresIdempotencyKey: meta.requiresIdempotencyKey,
  };
}

export function listSupervisorOrderActions(
  ctx: SupervisorOrderActionContext,
): SupervisorActionAvailability[] {
  return (Object.keys(ACTION_META) as SupervisorOrderAction[]).map((action) =>
    getSupervisorOrderActionAvailability(action, ctx),
  );
}
