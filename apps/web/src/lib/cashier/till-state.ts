import { ApiError } from "@/lib/api/client";
import {
  asCashierNumber,
  formatCashierDateTime,
  formatCashierMoney,
  titleCaseCashier,
} from "@/lib/cashier/formatters";
import type {
  CashierCashMovementApi,
  CashierCashMovementViewModel,
  CashierTillApi,
  CashierTillSummaryMetric,
  CashierTillViewModel,
} from "@/lib/cashier/till-types";

function userName(user: NonNullable<CashierTillApi>["operatorUser"]) {
  if (!user) return "Operator unavailable";
  if (user.displayName) return user.displayName;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || "Operator unavailable";
}

function movementLabel(type: string) {
  return titleCaseCashier(type, "Movement unavailable");
}

function normalizeMovement(
  movement: CashierCashMovementApi,
  index: number,
  currencyCode?: string,
): CashierCashMovementViewModel {
  const type = String(movement?.type || "UNKNOWN").toUpperCase();
  const amount = asCashierNumber(movement?.amount);

  return {
    id: movement?.id || `movement-${index}`,
    type,
    label: movementLabel(type),
    amount,
    formattedAmount: formatCashierMoney(amount, currencyCode),
    reason: movement?.reason || "Reason unavailable",
    createdAtLabel: formatCashierDateTime(movement?.createdAt, "Time unavailable"),
  };
}

function sumMovements(movements: CashierCashMovementViewModel[], type: string) {
  return movements
    .filter((movement) => movement.type === type)
    .reduce((total, movement) => total + (movement.amount || 0), 0);
}

function metric({
  key,
  label,
  value,
  currencyCode,
  tone = "neutral",
}: {
  key: string;
  label: string;
  value?: number;
  currencyCode?: string;
  tone?: CashierTillSummaryMetric["tone"];
}): CashierTillSummaryMetric {
  return {
    key,
    label,
    value,
    formattedValue: formatCashierMoney(value, currencyCode),
    tone,
  };
}

function varianceTone(value?: number): CashierTillSummaryMetric["tone"] {
  if (value === undefined) return "neutral";
  if (Math.abs(value) <= 0.01) return "success";
  return "danger";
}

export function normalizeCashierTill(
  source: CashierTillApi,
  currencyCode?: string,
): CashierTillViewModel | null {
  if (!source) return null;

  const movements = (source.cashMovements || [])
    .filter(Boolean)
    .map((movement, index) => normalizeMovement(movement, index, currencyCode));
  const status = String(source.status || "UNKNOWN").toUpperCase();
  const openingFloat = asCashierNumber(source.openingFloat);
  const safeDrops = sumMovements(movements, "SAFE_DROP");
  const computedExpectedCash = asCashierNumber(source.computedExpectedCash);
  const expectedCash = computedExpectedCash ?? asCashierNumber(source.expectedCash);
  const countedCash = asCashierNumber(source.countedCash);
  const variance =
    asCashierNumber(source.variance) ??
    (countedCash !== undefined && expectedCash !== undefined ? countedCash - expectedCash : undefined);
  const cashPayments =
    expectedCash !== undefined && openingFloat !== undefined
      ? Math.max(0, expectedCash - openingFloat + safeDrops)
      : undefined;

  const metrics = [
    metric({ key: "openingFloat", label: "Opening Float", value: openingFloat, currencyCode, tone: "info" }),
    metric({ key: "cashPayments", label: "Cash Payments", value: cashPayments, currencyCode, tone: "success" }),
    metric({ key: "safeDrops", label: "Safe Drops", value: safeDrops, currencyCode, tone: "warning" }),
    metric({ key: "expectedCash", label: "Expected Cash", value: expectedCash, currencyCode, tone: "info" }),
    metric({ key: "countedCash", label: "Counted Cash", value: countedCash, currencyCode, tone: "neutral" }),
    metric({ key: "variance", label: "Variance", value: variance, currencyCode, tone: varianceTone(variance) }),
  ];

  return {
    id: source.id,
    tillCode: source.tillCode || source.id,
    status,
    statusLabel: titleCaseCashier(status, "Unknown"),
    openedAtLabel: formatCashierDateTime(source.openedAt, "Opened time unavailable"),
    closedAtLabel: source.closedAt ? formatCashierDateTime(source.closedAt) : undefined,
    reconciledAtLabel: source.reconciledAt ? formatCashierDateTime(source.reconciledAt) : undefined,
    operatorName: userName(source.operatorUser),
    shiftNumber: source.shift?.shiftNumber || source.shiftId || "Shift unavailable",
    openingFloat,
    cashPayments,
    safeDrops,
    expectedCash,
    countedCash,
    variance,
    varianceStatus: source.varianceStatus || undefined,
    currencyCode,
    notes: source.notes || undefined,
    movements,
    metrics,
    isOpen: status === "OPEN",
  };
}

export function mapTillApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.isForbidden) return "Permission denied for this till action.";
    if (error.status === 409 && /payload/i.test(error.message)) {
      return "This retry does not match the original till request.";
    }
    if (error.status === 409 && /flight|processing/i.test(error.message)) {
      return "This till request is already processing.";
    }
    if (error.status === 423 || /maintenance/i.test(error.message)) {
      return "Till writes are blocked by maintenance.";
    }
    if (error.status === 400) return error.message || "Till request did not pass validation.";
    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
