import {
  asCashierNumber,
  formatCashierDateTime,
  titleCaseCashier,
} from "@/lib/cashier/formatters";
import type { CashierPaymentApi } from "@/lib/cashier/order-types";
import type {
  CashierRefundApi,
  CashierRefundPaymentOption,
  CashierRefundStatusViewModel,
  CashierRefundSummary,
  CashierRefundViewModel,
} from "@/lib/cashier/refund-types";

const ACTIVE_REFUND_STATUSES = new Set(["PENDING", "PENDING_APPROVAL", "APPROVED", "COMPLETED"]);

function personName(
  user:
    | {
        firstName?: string | null;
        lastName?: string | null;
        displayName?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback: string,
) {
  if (!user) return fallback;
  if (user.displayName) return user.displayName;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || fallback;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function deriveRefundStatus(status: string | null | undefined): CashierRefundStatusViewModel {
  const normalized = String(status || "UNKNOWN").toUpperCase();

  if (normalized === "PENDING" || normalized === "PENDING_APPROVAL") {
    return { status: normalized, label: "Pending approval", tone: "warning", approvalRequired: true };
  }
  if (normalized === "APPROVED") {
    return { status: normalized, label: "Approved", tone: "info", approvalRequired: false };
  }
  if (normalized === "COMPLETED") {
    return { status: normalized, label: "Completed", tone: "success", approvalRequired: false };
  }
  if (normalized === "REJECTED") {
    return { status: normalized, label: "Rejected", tone: "danger", approvalRequired: false };
  }
  if (normalized === "FAILED") {
    return { status: normalized, label: "Failed", tone: "danger", approvalRequired: false };
  }
  if (normalized === "CANCELLED") {
    return { status: normalized, label: "Cancelled", tone: "neutral", approvalRequired: false };
  }

  return { status: normalized, label: "Unknown", tone: "neutral", approvalRequired: false };
}

export function normalizeCashierRefund(refund: CashierRefundApi): CashierRefundViewModel {
  const status = deriveRefundStatus(refund.status);

  return {
    id: refund.id,
    paymentId: refund.paymentId || "Payment unavailable",
    provider: refund.provider || "Provider unavailable",
    amount: asCashierNumber(refund.amount),
    reason: refund.reason || "No reason returned",
    status: status.status,
    statusLabel: status.label,
    statusTone: status.tone,
    approvalRequired: status.approvalRequired,
    requestedBy: personName(refund.createdBy, refund.createdById || "Requester unavailable"),
    approvedBy: refund.approvedBy
      ? personName(refund.approvedBy, "Approver unavailable")
      : refund.approvedById || "Not approved",
    createdAt: refund.createdAt ? formatCashierDateTime(refund.createdAt) : undefined,
    updatedAt: refund.updatedAt ? formatCashierDateTime(refund.updatedAt) : undefined,
    failureReason: metadataString(refund.metadata, ["failureReason", "error", "reasonFailed"]),
  };
}

function paymentProvider(payment: CashierPaymentApi) {
  const provider = metadataString(payment.metadata, ["provider"]);
  return provider || payment.method || undefined;
}

function paymentReference(payment: CashierPaymentApi) {
  return payment.externalTransactionId || payment.transactionId || metadataString(payment.metadata, ["reference"]);
}

function refundedByPayment(refunds: CashierRefundApi[]) {
  const totals = new Map<string, number>();
  for (const refund of refunds) {
    const paymentId = refund.paymentId;
    const status = String(refund.status || "").toUpperCase();
    const amount = asCashierNumber(refund.amount);
    if (!paymentId || amount === undefined || !ACTIVE_REFUND_STATUSES.has(status)) continue;
    totals.set(paymentId, (totals.get(paymentId) || 0) + amount);
  }
  return totals;
}

export function deriveRefundableAmount({
  payments,
  refunds,
  refundsTrusted,
}: {
  payments?: CashierPaymentApi[] | null;
  refunds?: CashierRefundApi[] | null;
  refundsTrusted: boolean;
}): CashierRefundSummary {
  if (!refundsTrusted) {
    return {
      alreadyRefunded: 0,
      paymentOptions: [],
      trustBlockedReason: "Could not load refund history, so refundable amount cannot be trusted.",
    };
  }

  const refunded = refundedByPayment(refunds || []);
  const paymentOptions: CashierRefundPaymentOption[] = (payments || []).map((payment) => {
    const amount = asCashierNumber(payment.amount);
    const alreadyRefunded = refunded.get(payment.id) || 0;
    const status = String(payment.status || "UNKNOWN").toUpperCase();
    const refundableAmount = amount === undefined ? undefined : Math.max(0, amount - alreadyRefunded);
    const disabledReason =
      status !== "COMPLETED"
        ? "Only completed payments can be refunded."
        : refundableAmount !== undefined && refundableAmount <= 0
          ? "This payment has no refundable balance."
          : undefined;

    return {
      id: payment.id,
      payment,
      method: payment.method || "Unknown method",
      provider: paymentProvider(payment),
      reference: paymentReference(payment),
      status,
      amount,
      alreadyRefunded,
      refundableAmount,
      postedAt: payment.postedAt || payment.createdAt || undefined,
      disabledReason,
    };
  });

  const totalPaid = paymentOptions.reduce((sum, option) => sum + (option.amount || 0), 0);
  const alreadyRefunded = Array.from(refunded.values()).reduce((sum, amount) => sum + amount, 0);
  const remainingRefundable = paymentOptions.reduce(
    (sum, option) => sum + (option.disabledReason ? 0 : option.refundableAmount || 0),
    0,
  );

  return {
    totalPaid,
    alreadyRefunded,
    remainingRefundable,
    paymentOptions,
  };
}

export function deriveRefundThresholdState(amount: number | undefined, threshold: number) {
  if (amount === undefined || amount <= 0) {
    return {
      overThreshold: false,
      copy: `Auto-approval threshold: ${threshold.toLocaleString()} UGX.`,
    };
  }

  return amount <= threshold
    ? {
        overThreshold: false,
        copy: "Refund is within cashier auto-approval threshold.",
      }
    : {
        overThreshold: true,
        copy: "Refund exceeds cashier auto-approval threshold. It will require manager approval.",
      };
}

export function refundStatusLabel(value: string | null | undefined) {
  const status = deriveRefundStatus(value);
  return status.label === "Unknown" ? titleCaseCashier(value, "Unknown") : status.label;
}
