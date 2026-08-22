import type { ManagerExchangeRateDraft, ManagerTaxCategory } from "@/lib/manager/settings-types";

/**
 * Manager Settings — pure model (Track B6). No React, no network.
 *
 * ## What is deliberately NOT in this UI, and why
 *
 * - **Platform access** (`useRoleDefaults`/`overrides`) — stored, but has ZERO
 *   consumers anywhere in `apps/api/src` (repo-wide grep, confirmed in
 *   `docs/manager-settings-docs/MANAGER_SETTINGS_API_MATRIX.md` §1). Building a
 *   toggle for it would visually imply a permission-override capability that does
 *   not exist.
 * - **Booking policies** — the DTO accepts an arbitrary object; nothing in the
 *   codebase reads `bookingPolicies` at all (confirmed by grep). No shape to build
 *   a typed form against, and no consumer to justify a raw-JSON editor.
 * - **Franchise weights** — real and consumed (`staff-insights.service.ts`), but
 *   gated on `pos:staff:weights:update`, which Manager does not hold (only
 *   `:read`). Editing it via the general `/settings` PATCH would bypass that
 *   domain's own permission gate and its own audit event.
 * - **`metadata` / `defaults`** — free-form, unstructured, zero consumers found.
 *   Matches the project's standing "no free-form parameters editor" rule (B4-F6,
 *   B5.6).
 */

export const MANAGER_SETTINGS_SECTIONS = [
  { key: "currency", label: "Currency" },
  { key: "tax", label: "Tax & VAT" },
  { key: "rounding", label: "Rounding" },
  { key: "thresholds", label: "Approval thresholds" },
  { key: "operations", label: "Reservations & receipts" },
  { key: "tolerances", label: "Attendance & inventory" },
  { key: "exchange-rates", label: "Exchange rates" },
] as const;

export type ManagerSettingsSectionKey = (typeof MANAGER_SETTINGS_SECTIONS)[number]["key"];

export function isManagerSettingsSectionKey(value: string): value is ManagerSettingsSectionKey {
  return (MANAGER_SETTINGS_SECTIONS as readonly { key: string }[]).some((s) => s.key === value);
}

// ── Currency ────────────────────────────────────────────────────────────────

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function validateCurrencyDraft(draft: { currency: string; baseCurrencyCode: string }) {
  const errors: Record<string, string> = {};
  const currency = draft.currency.trim().toUpperCase();
  if (!currency) errors.currency = "Currency is required.";
  else if (!CURRENCY_PATTERN.test(currency)) errors.currency = "Use a 3-letter ISO code, e.g. UGX.";
  const base = draft.baseCurrencyCode.trim().toUpperCase();
  if (base && !CURRENCY_PATTERN.test(base)) {
    errors.baseCurrencyCode = "Use a 3-letter ISO code, e.g. USD, or leave blank.";
  }
  return errors;
}

// ── Tax matrix ──────────────────────────────────────────────────────────────

export function validateTaxMatrixDraft(draft: { defaultVatPct: string; categories: ManagerTaxCategory[] }) {
  const errors: Record<string, string> = {};
  const pct = Number(draft.defaultVatPct);
  if (draft.defaultVatPct.trim() === "" || Number.isNaN(pct)) errors.defaultVatPct = "Enter a number.";
  else if (pct < 0 || pct > 100) errors.defaultVatPct = "Must be between 0 and 100.";

  draft.categories.forEach((category, index) => {
    if (!category.name.trim()) errors[`category-${index}-name`] = "Name is required.";
    if (Number.isNaN(category.vatPct) || category.vatPct < 0 || category.vatPct > 100) {
      errors[`category-${index}-vatPct`] = "Must be between 0 and 100.";
    }
  });

  return errors;
}

export function emptyManagerTaxCategory(): ManagerTaxCategory {
  return { name: "", vatPct: 0 };
}

// ── Rounding ────────────────────────────────────────────────────────────────

export const MANAGER_ROUNDING_MODES = ["NEAREST", "UP", "DOWN"] as const;

export function validateRoundingDraft(draft: { mode: string; increment: string }) {
  const errors: Record<string, string> = {};
  if (!(MANAGER_ROUNDING_MODES as readonly string[]).includes(draft.mode)) {
    errors.mode = "Choose a rounding mode.";
  }
  const increment = Number(draft.increment);
  if (draft.increment.trim() === "" || !Number.isInteger(increment) || increment < 1) {
    errors.increment = "Enter a whole number of 1 or more.";
  }
  return errors;
}

// ── Approval thresholds ─────────────────────────────────────────────────────

export function validateThresholdsDraft(draft: {
  lateVoidMin: string;
  heavyDiscountUGX: string;
  discountApprovalThreshold: string;
}) {
  const errors: Record<string, string> = {};
  const lateVoidMin = Number(draft.lateVoidMin);
  if (draft.lateVoidMin.trim() === "" || !Number.isInteger(lateVoidMin) || lateVoidMin < 0) {
    errors.lateVoidMin = "Enter a whole number of 0 or more.";
  }
  const heavyDiscount = Number(draft.heavyDiscountUGX);
  if (draft.heavyDiscountUGX.trim() === "" || !Number.isInteger(heavyDiscount) || heavyDiscount < 0) {
    errors.heavyDiscountUGX = "Enter a whole number of 0 or more.";
  }
  const threshold = Number(draft.discountApprovalThreshold);
  if (draft.discountApprovalThreshold.trim() === "" || Number.isNaN(threshold) || threshold < 0) {
    errors.discountApprovalThreshold = "Enter an amount of 0 or more.";
  }
  return errors;
}

// ── Reservations & receipts (general PATCH) ────────────────────────────────

export function validateOperationsDraft(draft: { reservationHoldMinutes: string; receiptFooter: string }) {
  const errors: Record<string, string> = {};
  const minutes = Number(draft.reservationHoldMinutes);
  if (draft.reservationHoldMinutes.trim() === "" || !Number.isInteger(minutes) || minutes < 1) {
    errors.reservationHoldMinutes = "Enter a whole number of 1 or more.";
  }
  if (draft.receiptFooter.length > 500) {
    errors.receiptFooter = "Limited to 500 characters.";
  }
  return errors;
}

// ── Attendance & inventory tolerances (general PATCH) ──────────────────────

export function validateTolerancesDraft(draft: { autoClockOutHours: string; variancePct: string }) {
  const errors: Record<string, string> = {};
  const hours = Number(draft.autoClockOutHours);
  if (draft.autoClockOutHours.trim() === "" || !Number.isInteger(hours) || hours < 1 || hours > 48) {
    errors.autoClockOutHours = "Enter a whole number of hours between 1 and 48.";
  }
  const pct = Number(draft.variancePct);
  if (draft.variancePct.trim() === "" || Number.isNaN(pct) || pct < 0 || pct > 100) {
    errors.variancePct = "Enter a percentage between 0 and 100.";
  }
  return errors;
}

// ── Exchange rates ──────────────────────────────────────────────────────────

export function emptyManagerExchangeRateDraft(today: string): ManagerExchangeRateDraft {
  return { baseCurrencyCode: "", quoteCurrencyCode: "", rate: "", effectiveAt: today };
}

export function validateExchangeRateDraft(draft: ManagerExchangeRateDraft) {
  const errors: Record<string, string> = {};
  const base = draft.baseCurrencyCode.trim().toUpperCase();
  const quote = draft.quoteCurrencyCode.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(base)) errors.baseCurrencyCode = "Use a 3-letter ISO code.";
  if (!CURRENCY_PATTERN.test(quote)) errors.quoteCurrencyCode = "Use a 3-letter ISO code.";
  if (base && quote && base === quote) errors.quoteCurrencyCode = "Base and quote currency must differ.";
  const rate = Number(draft.rate);
  if (draft.rate.trim() === "" || Number.isNaN(rate) || rate <= 0) {
    errors.rate = "Enter a rate greater than 0.";
  }
  if (!draft.effectiveAt || Number.isNaN(new Date(draft.effectiveAt).getTime())) {
    errors.effectiveAt = "Enter a valid date.";
  }
  return errors;
}

export function formatManagerRate(rate: string) {
  const value = Number(rate);
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 6 }) : rate;
}
