import type {
  CashierOpenTillInput,
  CashierReconcileTillInput,
  CashierSafeDropInput,
  CashierTillValidationResult,
} from "@/lib/cashier/till-types";

function decimalPlaces(value: number) {
  const raw = String(value);
  const [, decimals = ""] = raw.split(".");
  return decimals.length;
}

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function validateOpenTillInput(input: {
  tillCode: string;
  openingFloat: string;
  notes: string;
}): CashierTillValidationResult<CashierOpenTillInput> {
  const reasons: string[] = [];
  const tillCode = input.tillCode.trim();
  const openingFloat = money(input.openingFloat);

  if (!tillCode) reasons.push("Till code is required.");
  if (tillCode.length > 50) reasons.push("Till code must be 50 characters or fewer.");
  if (openingFloat === undefined) reasons.push("Opening float must be a valid amount.");
  if (openingFloat !== undefined && openingFloat < 0) reasons.push("Opening float cannot be negative.");
  if (openingFloat !== undefined && decimalPlaces(openingFloat) > 2) reasons.push("Opening float can use at most 2 decimals.");
  if (input.notes.trim().length > 500) reasons.push("Notes must be 500 characters or fewer.");

  return {
    canSubmit: reasons.length === 0,
    reasons,
    value:
      reasons.length === 0 && openingFloat !== undefined
        ? { tillCode, openingFloat, notes: cleanOptional(input.notes) }
        : undefined,
  };
}

export function validateSafeDropInput(input: {
  amount: string;
  reason: string;
  expectedCash?: number;
}): CashierTillValidationResult<CashierSafeDropInput> {
  const reasons: string[] = [];
  const amount = money(input.amount);
  const reason = input.reason.trim();

  if (amount === undefined) reasons.push("Safe drop amount must be a valid amount.");
  if (amount !== undefined && amount <= 0) reasons.push("Safe drop amount must be greater than 0.");
  if (amount !== undefined && decimalPlaces(amount) > 2) reasons.push("Safe drop amount can use at most 2 decimals.");
  if (input.expectedCash !== undefined && amount !== undefined && amount > input.expectedCash) {
    reasons.push("Safe drop cannot exceed expected cash shown by the till summary.");
  }
  if (!reason) reasons.push("Reason is required.");
  if (reason.length > 500) reasons.push("Reason must be 500 characters or fewer.");

  return {
    canSubmit: reasons.length === 0,
    reasons,
    value: reasons.length === 0 && amount !== undefined ? { amount, reason } : undefined,
  };
}

export function validateReconcileInput(input: {
  countedCash: string;
  varianceReason: string;
  notes: string;
  expectedCash?: number;
}): CashierTillValidationResult<CashierReconcileTillInput> & { previewVariance?: number } {
  const reasons: string[] = [];
  const countedCash = money(input.countedCash);
  const varianceReason = input.varianceReason.trim();
  const notes = input.notes.trim();
  const previewVariance =
    countedCash !== undefined && input.expectedCash !== undefined
      ? countedCash - input.expectedCash
      : undefined;

  if (countedCash === undefined) reasons.push("Counted cash must be a valid amount.");
  if (countedCash !== undefined && countedCash < 0) reasons.push("Counted cash cannot be negative.");
  if (countedCash !== undefined && decimalPlaces(countedCash) > 2) reasons.push("Counted cash can use at most 2 decimals.");
  if (previewVariance !== undefined && Math.abs(previewVariance) > 0.01 && !varianceReason) {
    reasons.push("Variance reason is required when counted cash does not match expected cash.");
  }
  if (varianceReason.length > 500) reasons.push("Variance reason must be 500 characters or fewer.");
  if (notes.length > 500) reasons.push("Notes must be 500 characters or fewer.");

  return {
    canSubmit: reasons.length === 0,
    reasons,
    previewVariance,
    value:
      reasons.length === 0 && countedCash !== undefined
        ? {
            countedCash,
            varianceReason: cleanOptional(input.varianceReason),
            notes: cleanOptional(input.notes),
          }
        : undefined,
  };
}
