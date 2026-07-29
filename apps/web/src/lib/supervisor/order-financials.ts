import type { SupervisorDiscountRequestInput, SupervisorDiscountType } from "./orders";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers for Supervisor Prompt 3B3A financial adjustments (active-order VOID
// and order-level DISCOUNT REQUEST). No React / runtime imports so this stays
// unit/assertion testable.
//
// Discount math mirrors the backend exactly (discounts.service):
//   basis = order.subtotal (pre-tax)
//   PERCENTAGE amount = round2(subtotal * value / 100)
//   FIXED amount      = min(value, subtotal)
//   newTotal          = max(0, subtotal - amount)
// The backend AUTO-APPROVES when the amount is within the org threshold (default
// 5000) else returns PENDING — that decision is backend-authoritative, so the UI
// never asserts a final status before the response (no predictor here).
// ─────────────────────────────────────────────────────────────────────────────

export const DISCOUNT_PERCENT_MIN = 0.01;
export const DISCOUNT_PERCENT_MAX = 100;
export const DISCOUNT_FIXED_MIN = 0.01;
export const ADJUSTMENT_REASON_MAX = 500;

// Up to two decimal places — mirrors RequestDiscountDto @IsNumber({ maxDecimalPlaces: 2 }).
const DISCOUNT_VALUE_PATTERN = /^\d+(\.\d{1,2})?$/;

export type FinancialValidity = { valid: boolean; reason?: string };

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Parse a discount value string; null if not a positive number with ≤2 decimals. */
export function parseDiscountValue(input: string): number | null {
  const trimmed = input.trim();
  if (!DISCOUNT_VALUE_PATTERN.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate a discount value against the verified backend rules. PERCENTAGE is
 * 0.01–100; FIXED is ≥0.01 and (UI safety, to avoid a negative resulting total)
 * must not exceed the order subtotal. Never silently caps — returns a clear reason.
 */
export function validateDiscountValue(
  type: SupervisorDiscountType,
  rawValue: number | string,
  subtotal: number | string | null | undefined,
): FinancialValidity {
  const value = typeof rawValue === "number" ? rawValue : parseDiscountValue(rawValue);
  if (value === null || !Number.isFinite(value)) {
    return { valid: false, reason: "Enter a number with up to 2 decimal places." };
  }
  if (value <= 0) return { valid: false, reason: "Enter an amount greater than zero." };

  if (type === "PERCENTAGE") {
    if (value < DISCOUNT_PERCENT_MIN) return { valid: false, reason: `Minimum is ${DISCOUNT_PERCENT_MIN}%.` };
    if (value > DISCOUNT_PERCENT_MAX) return { valid: false, reason: "A percentage discount cannot exceed 100%." };
    return { valid: true };
  }

  // FIXED
  if (value < DISCOUNT_FIXED_MIN) return { valid: false, reason: "Enter a positive amount." };
  const sub = Number(subtotal);
  if (Number.isFinite(sub) && sub > 0 && value > sub) {
    return { valid: false, reason: "A fixed discount cannot exceed the order subtotal." };
  }
  return { valid: true };
}

export type DiscountPreview = { discountAmount: number; newTotal: number };

/** Client preview of the discount effect. Returns null for invalid input. */
export function computeDiscountPreview(
  type: SupervisorDiscountType,
  value: number | string,
  subtotal: number | string | null | undefined,
): DiscountPreview | null {
  const v = typeof value === "number" ? value : parseDiscountValue(value);
  const sub = Number(subtotal);
  if (v === null || !Number.isFinite(v) || v <= 0 || !Number.isFinite(sub) || sub <= 0) return null;
  const amount = type === "PERCENTAGE" ? round2((sub * v) / 100) : Math.min(v, sub);
  const newTotal = Math.max(0, round2(sub - amount));
  return { discountAmount: round2(amount), newTotal };
}

/** Void requires a non-empty reason (≤500 chars) in the UI (audit-meaningful). */
export function validateAdjustmentReason(reason: string): FinancialValidity {
  const trimmed = reason.trim();
  if (!trimmed) return { valid: false, reason: "A reason is required." };
  if (trimmed.length > ADJUSTMENT_REASON_MAX) {
    return { valid: false, reason: `Keep the reason under ${ADJUSTMENT_REASON_MAX} characters.` };
  }
  return { valid: true };
}

/** Map an active-order void failure to concise operational copy. */
export function voidOrderErrorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/Invalid transition/i.test(message)) {
    return "This order can no longer be voided as an active order — its status changed. Refresh and try again.";
  }
  if (/Post-kitchen void requires a reason/i.test(message)) {
    return "A reason is required to void an order the kitchen has already started.";
  }
  if (/not found/i.test(message)) {
    return "This order could not be found. Refresh the Floor and try again.";
  }
  return message || "Could not void the order. Retry when the connection is stable.";
}

/** Map a discount-request failure to concise operational copy. */
export function discountRequestErrorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/exceed 100/i.test(message)) return "A percentage discount cannot exceed 100%.";
  if (/Cannot apply discount to order/i.test(message)) {
    return "A discount can't be applied to this order in its current state. Refresh and try again.";
  }
  if (/not found/i.test(message)) return "This order could not be found. Refresh and try again.";
  return message || "Could not request the discount. Retry when the connection is stable.";
}

// ── Prompt 3B3B: discount decisions + complimentary ──

/** Manager PIN is OPTIONAL on approve. If provided it must be ≤8 chars (DTO @MaxLength(8)). */
export const MANAGER_PIN_MAX = 8;

export function validateManagerPin(pin: string): FinancialValidity {
  const trimmed = pin.trim();
  if (!trimmed) return { valid: true }; // optional — empty is fine
  if (trimmed.length > MANAGER_PIN_MAX) {
    return { valid: false, reason: `A PIN is at most ${MANAGER_PIN_MAX} characters.` };
  }
  return { valid: true };
}

/** Map a discount-approval failure to concise operational copy. */
export function approveDiscountErrorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/Invalid manager PIN/i.test(message)) return "That PIN was not recognised. Check it and try again.";
  if (/Cannot approve a discount in/i.test(message)) {
    return "This discount has already been decided. Refresh to see its current state.";
  }
  if (/no longer in a state that accepts discounts/i.test(message)) {
    return "The order changed and can no longer take this discount. Refresh and try again.";
  }
  if (/not found/i.test(message)) return "This discount could not be found. Refresh the list.";
  return message || "Could not approve the discount. Retry when the connection is stable.";
}

/** Map a discount-rejection failure to concise operational copy. */
export function rejectDiscountErrorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/Cannot reject a discount in/i.test(message)) {
    return "This discount has already been decided. Refresh to see its current state.";
  }
  if (/not found/i.test(message)) return "This discount could not be found. Refresh the list.";
  return message || "Could not reject the discount. Retry when the connection is stable.";
}

// Complimentary is Outcome B: a truthful WHOLE-ORDER discount request (100% of the
// subtotal) carrying persisted `metadata` + a required reason. It is NOT a void and NOT
// a refund. Categories below are persisted verbatim in the discount metadata + reason.
export type ComplimentaryCategory =
  | "SERVICE_RECOVERY"
  | "MANAGEMENT_HOSPITALITY"
  | "QUALITY_ISSUE"
  | "PROMOTIONAL"
  | "OTHER";

export const COMPLIMENTARY_CATEGORIES: { value: ComplimentaryCategory; label: string }[] = [
  { value: "SERVICE_RECOVERY", label: "Service recovery" },
  { value: "MANAGEMENT_HOSPITALITY", label: "Management hospitality" },
  { value: "QUALITY_ISSUE", label: "Quality issue" },
  { value: "PROMOTIONAL", label: "Promotional authorisation" },
  { value: "OTHER", label: "Other" },
];

/**
 * Build the verified whole-order Complimentary request: a 100% PERCENTAGE discount so
 * the backend drives the subtotal to a 0 total (floored), with the complimentary
 * category + flag persisted in metadata and the operational reason in `reason`.
 */
export function buildComplimentaryDiscountInput(
  reason: string,
  category: ComplimentaryCategory,
): SupervisorDiscountRequestInput {
  return {
    type: "PERCENTAGE",
    value: 100,
    reason: reason.trim(),
    metadata: { complimentary: true, category },
  };
}
