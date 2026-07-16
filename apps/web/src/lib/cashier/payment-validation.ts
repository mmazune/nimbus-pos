import { ApiError } from "@/lib/api/client";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";
import type { CashierPaymentMethodConfig, CashierPaymentMethodId } from "@/lib/cashier/payment-types";

export const CASHIER_PAYMENT_METHODS: CashierPaymentMethodConfig[] = [
  {
    id: "CASH",
    label: "Cash",
    shortLabel: "Cash",
    backendMethod: "CASH",
    requiresReference: false,
    supportsPartial: false,
    caveat: "Cash is recorded only as the final settlement through order close.",
  },
  {
    id: "CARD_REFERENCE",
    label: "Card reference",
    shortLabel: "Card",
    backendMethod: "CARD",
    requiresReference: true,
    supportsPartial: true,
    caveat: "STUB - no live acquirer/card-terminal traffic.",
  },
  {
    id: "MTN_REFERENCE",
    label: "MTN MoMo reference",
    shortLabel: "MTN",
    backendMethod: "MOMO",
    provider: "MTN",
    requiresReference: true,
    supportsPartial: true,
    caveat: "CRITICAL - MTN/Airtel diner checkout pending provider confirmation. Record a manual reference only.",
  },
  {
    id: "AIRTEL_REFERENCE",
    label: "Airtel Money reference",
    shortLabel: "Airtel",
    backendMethod: "MOMO",
    provider: "AIRTEL",
    requiresReference: true,
    supportsPartial: true,
    caveat: "CRITICAL - MTN/Airtel diner checkout pending provider confirmation. Record a manual reference only.",
  },
  {
    id: "BANK_TRANSFER",
    label: "Bank transfer reference",
    shortLabel: "Bank",
    backendMethod: "BANK_TRANSFER",
    requiresReference: true,
    supportsPartial: true,
    caveat: "Bank transfer is manual reference only.",
  },
];

export function getCashierPaymentMethod(id: CashierPaymentMethodId) {
  return CASHIER_PAYMENT_METHODS.find((method) => method.id === id) || CASHIER_PAYMENT_METHODS[0];
}

export function formatCashierAmountInput(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";
  return value.toFixed(2).replace(/\.00$/, "");
}

export function cents(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.round(value * 100);
}

export function parseCashierPaymentAmount(input: string) {
  const value = input.trim();
  if (!value) return { error: "Amount is required." };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { error: "Use a positive amount with no more than 2 decimal places." };
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }

  return { amount };
}

export function hasPendingCashierPaymentIntent(order: CashierOrderViewModel) {
  return order.payment.intents.some((intent) => {
    const status = String(intent.status || "").toUpperCase();
    return status === "PENDING" || status === "REQUIRES_ACTION";
  });
}

export function getCashierOutstandingAmount(order: CashierOrderViewModel) {
  return order.payment.outstanding ?? order.total ?? 0;
}

export function isCashierOrderClosed(order: CashierOrderViewModel) {
  return order.status === "CLOSED";
}

export function isCashierOrderVoid(order: CashierOrderViewModel) {
  return order.status === "VOIDED";
}

export function mapCashierMutationError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "IDEMPOTENCY_IN_FLIGHT") {
      return "Payment is already processing. Check the payment summary before retrying.";
    }
    if (error.code === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
      return "This retry does not match the original payment request.";
    }
    if (error.code === "MAINTENANCE_WINDOW_ACTIVE" || error.code === "MAINTENANCE_WINDOW_BLOCKED") {
      return "Checkout writes are blocked by maintenance.";
    }
    if (error.isForbidden) return "This cashier account is not allowed to perform that checkout action.";
    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function validateCashierPaymentInput({
  amountInput,
  methodId,
  order,
  readiness,
  reference,
  paymentSummaryBlocked,
}: {
  amountInput: string;
  methodId: CashierPaymentMethodId;
  order: CashierOrderViewModel;
  readiness: CashierReadinessSnapshot;
  reference: string;
  paymentSummaryBlocked?: boolean;
}) {
  const reasons: string[] = [];
  const method = getCashierPaymentMethod(methodId);
  const parsed = parseCashierPaymentAmount(amountInput);
  const outstanding = getCashierOutstandingAmount(order);
  const outstandingCents = cents(outstanding) ?? 0;
  const amountCents = parsed.amount === undefined ? undefined : cents(parsed.amount);

  if (readiness.shift.status !== "active") reasons.push("No active shift. Start a shift before checkout.");
  if (method.id === "CASH" && readiness.till.status !== "active") {
    reasons.push("No active till. Cash payments are blocked.");
  }
  if (paymentSummaryBlocked) reasons.push("Payment summary must load before payment entry.");
  if (isCashierOrderClosed(order) || isCashierOrderVoid(order)) reasons.push("Order is not in a payable state.");
  if (hasPendingCashierPaymentIntent(order)) {
    reasons.push("A provider intent is pending. Resolve it before adding another payment.");
  }
  if (parsed.error) reasons.push(parsed.error);
  if (amountCents !== undefined && amountCents > outstandingCents) {
    reasons.push("Amount cannot exceed outstanding balance.");
  }
  if (amountCents !== undefined && method.id === "CASH" && amountCents !== outstandingCents) {
    reasons.push("Partial cash is deferred because cash can only be recorded through final order close.");
  }
  if (method.id === "CASH" && order.status !== "SERVED") {
    reasons.push("Cash close is available only when the backend order status is Served.");
  }
  if (method.requiresReference && !reference.trim()) {
    reasons.push("Manual reference is required for this method.");
  }
  if (outstandingCents <= 0) reasons.push("This order is already settled.");

  return {
    amount: parsed.amount,
    reasons,
    canSubmit: reasons.length === 0 && parsed.amount !== undefined,
  };
}
