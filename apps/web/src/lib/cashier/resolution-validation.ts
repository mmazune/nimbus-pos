import { ApiError } from "@/lib/api/client";
import { asCashierNumber } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { cents, isCashierOrderClosed, isCashierOrderVoid } from "@/lib/cashier/payment-validation";
import type {
  CashierSplitBillGroupInput,
  CashierSplitBillMetadata,
  CashierSplitBillMode,
  CashierSplitItemSelection,
} from "@/lib/cashier/resolution-types";

export const CASHIER_RESOLUTION_OPEN_STATUSES = ["SENT", "IN_KITCHEN", "READY", "SERVED"] as const;

const openResolutionStatuses = new Set<string>(CASHIER_RESOLUTION_OPEN_STATUSES);

export function parseCashierResolutionAmount(input: string) {
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

export function formatCashierResolutionAmount(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";
  return value.toFixed(2);
}

export function parseCashierSplitBillMetadata(metadata: Record<string, unknown> | null | undefined) {
  const splitBill = metadata?.splitBill;
  if (!splitBill || typeof splitBill !== "object") return null;
  return splitBill as CashierSplitBillMetadata;
}

export function mapCashierResolutionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "IDEMPOTENCY_IN_FLIGHT") {
      return "This resolution action is already processing. Refresh the order before retrying.";
    }
    if (error.code === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
      return "This retry does not match the original resolution request.";
    }
    if (error.code === "MAINTENANCE_WINDOW_ACTIVE" || error.code === "MAINTENANCE_WINDOW_BLOCKED") {
      return "Resolution writes are blocked by maintenance.";
    }
    if (error.isForbidden) return "This cashier account is not allowed to perform that resolution action.";
    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function cashierResolutionOrderReasons({
  order,
  paymentSummaryBlocked,
  mutationInFlight,
}: {
  order: CashierOrderViewModel;
  paymentSummaryBlocked?: boolean;
  mutationInFlight?: boolean;
}) {
  const reasons: string[] = [];

  if (mutationInFlight) reasons.push("Another resolution action is already running.");
  if (paymentSummaryBlocked) reasons.push("Payment summary must load before split or resolution actions.");
  if (isCashierOrderClosed(order) || isCashierOrderVoid(order)) reasons.push("Closed or voided orders cannot be changed.");
  if (order.status === "CLOSED" && order.payment.state === "settled") {
    reasons.push("Fully settled and closed orders cannot be changed.");
  }
  if (!openResolutionStatuses.has(order.status)) {
    reasons.push("Only active service orders can be split or resolved.");
  }

  return reasons;
}

export function validateSplitBillInput({
  order,
  mode,
  equalCount,
  groups,
}: {
  order: CashierOrderViewModel;
  mode: CashierSplitBillMode;
  equalCount: number;
  groups: CashierSplitBillGroupInput[];
}) {
  const reasons: string[] = [];
  const orderTotalCents = cents(order.total) ?? 0;

  if (orderTotalCents <= 0) reasons.push("Order total must be available before bill split.");

  if (mode === "EQUAL") {
    if (!Number.isInteger(equalCount) || equalCount < 2 || equalCount > 20) {
      reasons.push("Equal split count must be between 2 and 20.");
    }

    return {
      reasons,
      canSubmit: reasons.length === 0,
      previewGroups: buildEqualSplitPreview(order.total || 0, equalCount),
    };
  }

  if (groups.length < 2) reasons.push("Custom split needs at least two groups.");

  const parsedGroups = groups.map((group, index) => {
    const parsed = parseCashierResolutionAmount(group.amount || "");
    if (parsed.error) reasons.push(`Guest ${index + 1}: ${parsed.error}`);
    return {
      label: group.label?.trim() || `Guest ${index + 1}`,
      amount: parsed.amount,
    };
  });

  const groupTotalCents = parsedGroups.reduce((sum, group) => sum + (cents(group.amount) || 0), 0);
  if (orderTotalCents > 0 && groupTotalCents !== orderTotalCents) {
    reasons.push("Custom split amounts must equal the order total.");
  }

  return {
    reasons,
    canSubmit: reasons.length === 0,
    previewGroups: parsedGroups,
  };
}

export function selectedResolutionItems(quantities: Record<string, number>): CashierSplitItemSelection[] {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}

export function validateResolutionItemSelection({
  order,
  quantities,
  requireReason,
  reason,
  targetOrderId,
}: {
  order: CashierOrderViewModel;
  quantities: Record<string, number>;
  requireReason?: boolean;
  reason?: string;
  targetOrderId?: string;
}) {
  const reasons: string[] = [];
  const selected = selectedResolutionItems(quantities);

  if (targetOrderId !== undefined && !targetOrderId) reasons.push("Choose a target order.");
  if (!selected.length) reasons.push("Select at least one item.");
  if (requireReason && !reason?.trim()) reasons.push("Reason is required.");

  selected.forEach((item) => {
    const line = order.lines.find((candidate) => candidate.id === item.orderItemId);
    if (!line) {
      reasons.push("Selected item is no longer available on this order.");
      return;
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > line.quantity) {
      reasons.push(`${line.name}: quantity must be between 1 and ${line.quantity}.`);
    }
  });

  return {
    selected,
    reasons,
    canSubmit: reasons.length === 0,
  };
}

export function isSafeTargetOrder(order: CashierOrderViewModel, sourceOrderId: string) {
  if (order.id === sourceOrderId) return false;
  if (!openResolutionStatuses.has(order.status)) return false;
  if (order.payment.state === "settled") return false;
  return true;
}

export function hasSourcePayments(order: CashierOrderViewModel) {
  const paid = order.payment.paid ?? 0;
  return paid > 0 || order.payment.payments.length > 0 || order.payment.intents.length > 0;
}

function buildEqualSplitPreview(total: number, count: number) {
  if (!Number.isInteger(count) || count < 2 || count > 20) return [];

  const totalCents = cents(total) || 0;
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return Array.from({ length: count }, (_, index) => ({
    label: `Guest ${index + 1}`,
    amount: (base + (index === count - 1 ? remainder : 0)) / 100,
  }));
}

export function amountFromUnknown(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? asCashierNumber(value) : undefined;
}
