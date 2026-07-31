import {
  CASHIER_PAYABLE_STATUSES,
  deriveCashierPaymentState,
  isCashierPayableStatus,
} from "@/lib/cashier/order-state";
import type {
  CashierOrderApi,
  CashierOrderPaymentsApi,
  CashierStatusTone,
} from "@/lib/cashier/order-types";

/**
 * Central Cashier bill-eligibility classification (Prompt C2).
 *
 * The Floor-first Cashier resolves a physical table to its payable bill(s) and
 * opens a settlement workspace. Every decision about whether a bill is
 * cashier-settleable flows through ONE helper here so the resolution panel, the
 * multiple-bill selector, and the settlement workspace agree on state and,
 * critically, FAIL CLOSED on anything unknown.
 *
 * Design rules (locked):
 *  - status classification is derived only from canonical backend fields
 *    (`order.status` + `order.metadata` bill-request markers). It NEVER fetches
 *    a per-order payment summary — that is a bounded, one-at-a-time read that
 *    only runs AFTER a bill is selected (settlement workspace).
 *  - payment-aware classification (`classifyCashierBillPayment`) is used ONLY in
 *    the settlement workspace where the payment summary has already loaded.
 *  - unknown / unrecognised status → `UNKNOWN_UNSAFE`; unknown payment state is
 *    never shown as unpaid or zero-due.
 */

export type CashierBillClassification =
  | "PAYABLE"
  | "PAYMENT_IN_PROGRESS"
  | "PARTIALLY_PAID"
  | "SETTLED"
  | "TERMINAL_READ_ONLY"
  | "NOT_CASHIER_SETTLEABLE"
  | "UNKNOWN_UNSAFE";

/** Terminal, read-only order states — no cashier settlement is possible. */
const CASHIER_TERMINAL_STATUSES = new Set(["CLOSED", "VOIDED", "CANCELLED", "CANCELED", "REFUNDED"]);

/** Pre-payable states a cashier cannot settle (draft / not yet sent). */
const CASHIER_NOT_SETTLEABLE_STATUSES = new Set(["NEW", "DRAFT"]);

const PAYMENT_IN_PROGRESS_INTENT_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "INITIATED",
  "REQUIRES_ACTION",
  "AWAITING_CONFIRMATION",
]);

const PAYMENT_IN_PROGRESS_PAYMENT_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "FAILED",
]);

export function isCashierTerminalStatus(status: string | null | undefined) {
  return CASHIER_TERMINAL_STATUSES.has(String(status || "").toUpperCase());
}

export function isCashierNotSettleableStatus(status: string | null | undefined) {
  return CASHIER_NOT_SETTLEABLE_STATUSES.has(String(status || "").toUpperCase());
}

/**
 * A table-order candidate is a payable bill only when its status is one of the
 * canonical payable working states (SENT, IN_KITCHEN, READY, SERVED). This is
 * the ONLY set the resolution selector treats as a settleable candidate — never
 * "first active order", never a terminal order, never a NEW draft.
 */
export function isCashierPayableCandidateStatus(status: string | null | undefined) {
  return isCashierPayableStatus(status);
}

function metadataFlag(metadata: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!metadata) return false;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean" && value) return true;
    if (typeof value === "string") {
      const normalized = value.trim().toUpperCase();
      if (normalized === "REQUESTED" || normalized === "BILL_REQUESTED" || normalized === "TRUE") return true;
    }
  }
  return false;
}

/** Truthful bill-requested marker (audit/metadata-derived — there is no enum). */
export function isCashierBillRequested(order: CashierOrderApi): boolean {
  return metadataFlag(order.metadata, [
    "billRequested",
    "bill_requested",
    "billState",
    "billStatus",
  ]);
}

/**
 * Status-only classification. Safe to run on every candidate in a table's order
 * list WITHOUT a payment fetch. Unknown states fail closed.
 */
export function classifyCashierBillStatus(order: CashierOrderApi): CashierBillClassification {
  const status = String(order.status || "").toUpperCase();
  if (!status || status === "UNKNOWN") return "UNKNOWN_UNSAFE";
  if (isCashierTerminalStatus(status)) return "TERMINAL_READ_ONLY";
  if (isCashierNotSettleableStatus(status)) return "NOT_CASHIER_SETTLEABLE";
  if (isCashierPayableCandidateStatus(status)) return "PAYABLE";
  return "UNKNOWN_UNSAFE";
}

export function hasCashierPaymentInProgress(summary?: CashierOrderPaymentsApi): boolean {
  if (!summary) return false;
  const intentInProgress = (summary.intents || []).some((intent) =>
    PAYMENT_IN_PROGRESS_INTENT_STATUSES.has(String(intent.status || "").toUpperCase()),
  );
  if (intentInProgress) return true;
  return (summary.payments || []).some((payment) =>
    PAYMENT_IN_PROGRESS_PAYMENT_STATUSES.has(String(payment.status || "").toUpperCase()),
  );
}

/**
 * Payment-aware classification for the settlement workspace ONLY (summary must
 * already be loaded). Fails closed when the payment state is not determinable.
 */
export function classifyCashierBillPayment(
  order: CashierOrderApi,
  summary: CashierOrderPaymentsApi | undefined,
): CashierBillClassification {
  const statusClass = classifyCashierBillStatus(order);
  if (statusClass !== "PAYABLE") return statusClass;
  if (!summary) return "UNKNOWN_UNSAFE";

  if (hasCashierPaymentInProgress(summary)) return "PAYMENT_IN_PROGRESS";

  const payment = deriveCashierPaymentState(summary);
  if (payment.state === "settled") return "SETTLED";
  if (payment.state === "partially-paid") return "PARTIALLY_PAID";
  if (payment.state === "unpaid") return "PAYABLE";
  return "UNKNOWN_UNSAFE";
}

export const CASHIER_BILL_CLASSIFICATION_LABELS: Record<
  CashierBillClassification,
  { label: string; tone: CashierStatusTone }
> = {
  PAYABLE: { label: "Awaiting payment", tone: "info" },
  PAYMENT_IN_PROGRESS: { label: "Payment in progress", tone: "warning" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "warning" },
  SETTLED: { label: "Settled — awaiting close", tone: "success" },
  TERMINAL_READ_ONLY: { label: "Closed", tone: "neutral" },
  NOT_CASHIER_SETTLEABLE: { label: "Not ready for checkout", tone: "warning" },
  UNKNOWN_UNSAFE: { label: "State unavailable", tone: "danger" },
};

export type CashierBillCandidate = {
  order: CashierOrderApi;
  classification: CashierBillClassification;
  isBillRequested: boolean;
};

function candidateTimestamp(order: CashierOrderApi): number {
  const value = order.updatedAt || order.createdAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Split a table's order list into payable candidates and terminal (read-only)
 * orders. Deterministic sort for the payable set:
 *   1. bill-requested first;
 *   2. most-recent activity;
 *   3. stable order-id tie-break.
 * Terminal orders are sorted newest-first for the read-only fallback selector.
 */
export function deriveCashierBillCandidates(orders: CashierOrderApi[]): {
  payable: CashierBillCandidate[];
  terminal: CashierBillCandidate[];
} {
  const payable: CashierBillCandidate[] = [];
  const terminal: CashierBillCandidate[] = [];

  for (const order of orders) {
    const classification = classifyCashierBillStatus(order);
    const candidate: CashierBillCandidate = {
      order,
      classification,
      isBillRequested: isCashierBillRequested(order),
    };
    if (classification === "PAYABLE") payable.push(candidate);
    else if (classification === "TERMINAL_READ_ONLY") terminal.push(candidate);
    // NOT_CASHIER_SETTLEABLE (drafts) and UNKNOWN_UNSAFE are intentionally
    // excluded from both lists — a cashier never settles them from the Floor.
  }

  payable.sort((a, b) => {
    if (a.isBillRequested !== b.isBillRequested) return a.isBillRequested ? -1 : 1;
    const byTime = candidateTimestamp(b.order) - candidateTimestamp(a.order);
    if (byTime !== 0) return byTime;
    return String(a.order.id).localeCompare(String(b.order.id));
  });

  terminal.sort((a, b) => {
    const byTime = candidateTimestamp(b.order) - candidateTimestamp(a.order);
    if (byTime !== 0) return byTime;
    return String(a.order.id).localeCompare(String(b.order.id));
  });

  return { payable, terminal };
}

export type CashierBillResolution =
  | { kind: "zero"; terminal: CashierBillCandidate[] }
  | { kind: "single"; candidate: CashierBillCandidate; terminal: CashierBillCandidate[] }
  | { kind: "multiple"; candidates: CashierBillCandidate[]; terminal: CashierBillCandidate[] };

/**
 * Resolve a table's orders to a zero / single / multiple outcome. Never silently
 * selects the first of several payable bills — `multiple` forces an explicit
 * cashier choice.
 */
export function resolveCashierTableBills(orders: CashierOrderApi[]): CashierBillResolution {
  const { payable, terminal } = deriveCashierBillCandidates(orders);
  if (payable.length === 0) return { kind: "zero", terminal };
  if (payable.length === 1) return { kind: "single", candidate: payable[0], terminal };
  return { kind: "multiple", candidates: payable, terminal };
}

export { CASHIER_PAYABLE_STATUSES };
