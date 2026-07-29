import type { SupervisorItemSelectionInput, SupervisorSplitBillInput } from "./orders";

// ─────────────────────────────────────────────────────────────────────────────
// Pure form/validation helpers for Supervisor Prompt 3B1 handoff actions.
//
// Money math runs in integer cents to avoid float drift and to mirror the backend
// (split-bill EQUAL: floor per group, last group absorbs the rounding residual so
// the sum equals the order total exactly; CUSTOM: group amounts must sum to total).
// No React / runtime imports so this stays unit/assertion testable.
// ─────────────────────────────────────────────────────────────────────────────

export const SPLIT_BILL_MIN_COUNT = 2;
export const SPLIT_BILL_MAX_COUNT = 20;

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Convert a decimal string / number to integer cents (round to nearest). */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToFixed(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export type SplitPreviewGroup = { label: string; amount: string };
export type SplitPreview = {
  groups: SplitPreviewGroup[];
  allocated: string;
  remaining: string;
  totalCents: number;
  allocatedCents: number;
};

export type Validity = { valid: boolean; reason?: string };

export function validateEqualCount(count: number): Validity {
  if (!Number.isInteger(count)) return { valid: false, reason: "Count must be a whole number." };
  if (count < SPLIT_BILL_MIN_COUNT) {
    return { valid: false, reason: `Split into at least ${SPLIT_BILL_MIN_COUNT} groups.` };
  }
  if (count > SPLIT_BILL_MAX_COUNT) {
    return { valid: false, reason: `Split into at most ${SPLIT_BILL_MAX_COUNT} groups.` };
  }
  return { valid: true };
}

/**
 * Client preview of an EQUAL split. Mirrors the backend exactly: each group gets
 * floor(total/count) cents; the LAST group takes the remaining cents so the sum
 * equals the total. Returns null for invalid input.
 */
export function computeEqualSplitPreview(
  totalValue: number | string,
  count: number,
): SplitPreview | null {
  if (!validateEqualCount(count).valid) return null;
  const totalCents = toCents(totalValue);
  if (totalCents <= 0) return null;
  const base = Math.floor(totalCents / count);
  const groups: SplitPreviewGroup[] = [];
  let allocated = 0;
  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const amountCents = isLast ? totalCents - allocated : base;
    allocated += amountCents;
    groups.push({ label: `Person ${i + 1}`, amount: centsToFixed(amountCents) });
  }
  return {
    groups,
    allocated: centsToFixed(allocated),
    remaining: centsToFixed(totalCents - allocated),
    totalCents,
    allocatedCents: allocated,
  };
}

/** Validate a single custom amount input string. */
export function parseCustomAmountCents(input: string): number | null {
  const trimmed = input.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const cents = toCents(trimmed);
  return cents > 0 ? cents : null;
}

export type CustomSplitValidation = Validity & {
  sumCents: number;
  totalCents: number;
};

/**
 * Validate custom split groups: at least 2 groups, each a positive amount, and the
 * sum must equal the order total exactly (to the cent).
 */
export function validateCustomSplit(
  amounts: string[],
  totalValue: number | string,
): CustomSplitValidation {
  const totalCents = toCents(totalValue);
  if (amounts.length < SPLIT_BILL_MIN_COUNT) {
    return { valid: false, reason: `Add at least ${SPLIT_BILL_MIN_COUNT} groups.`, sumCents: 0, totalCents };
  }
  let sumCents = 0;
  for (const raw of amounts) {
    const cents = parseCustomAmountCents(raw);
    if (cents === null) {
      return { valid: false, reason: "Each group needs a positive amount (up to 2 decimals).", sumCents, totalCents };
    }
    sumCents += cents;
  }
  if (sumCents !== totalCents) {
    return {
      valid: false,
      reason: `Allocated ${centsToFixed(sumCents)} must equal the order total ${centsToFixed(totalCents)}.`,
      sumCents,
      totalCents,
    };
  }
  return { valid: true, sumCents, totalCents };
}

export function buildEqualSplitInput(count: number, reason?: string): SupervisorSplitBillInput {
  const trimmed = reason?.trim();
  return { mode: "EQUAL", count, ...(trimmed ? { reason: trimmed } : {}) };
}

export function buildCustomSplitInput(
  groups: { label?: string; amount: string }[],
  reason?: string,
): SupervisorSplitBillInput {
  const trimmed = reason?.trim();
  return {
    mode: "CUSTOM",
    groups: groups.map((g) => ({
      ...(g.label && g.label.trim() ? { label: g.label.trim() } : {}),
      amount: centsToFixed(toCents(g.amount)),
    })),
    ...(trimmed ? { reason: trimmed } : {}),
  };
}

// ── Line selection (split-items / move-items) ──

export type OrderLine = { id: string; quantity?: number | null };

/**
 * Validate a line selection map. Requires at least one selected line; each
 * selected quantity must be a whole number between 1 and the line's ordered
 * quantity; no unknown lines.
 */
export function validateLineSelections(
  selections: SupervisorItemSelectionInput[],
  lines: OrderLine[],
): Validity {
  if (selections.length === 0) return { valid: false, reason: "Select at least one item." };
  const byId = new Map(lines.map((l) => [l.id, Math.max(0, Math.floor(Number(l.quantity ?? 0)))]));
  const seen = new Set<string>();
  for (const sel of selections) {
    if (seen.has(sel.orderItemId)) return { valid: false, reason: "An item was selected more than once." };
    seen.add(sel.orderItemId);
    const available = byId.get(sel.orderItemId);
    if (available === undefined) return { valid: false, reason: "A selected item is no longer on the order." };
    if (!Number.isInteger(sel.quantity) || sel.quantity < 1) {
      return { valid: false, reason: "Each selected quantity must be at least 1." };
    }
    if (sel.quantity > available) {
      return { valid: false, reason: "A selected quantity exceeds what is available." };
    }
  }
  return { valid: true };
}

/** Build the item-selection array from a quantity map, dropping zero quantities. */
export function buildItemSelections(quantities: Record<string, number>): SupervisorItemSelectionInput[] {
  return Object.entries(quantities)
    .filter(([, qty]) => Number.isInteger(qty) && qty > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}
