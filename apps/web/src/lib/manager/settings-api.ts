import { apiRequest } from "@/lib/api/client";
import type {
  ManagerExchangeRate,
  ManagerExchangeRateDraft,
  ManagerOrgSettings,
} from "@/lib/manager/settings-types";

/**
 * Manager Settings — request layer (Track B6).
 *
 * Every route here is verified in `docs/manager-settings-docs/MANAGER_SETTINGS_API_MATRIX.md`
 * §1 against a live isolated stack. `platformAccess` is read (so it round-trips
 * untouched on a general PATCH) but never rendered or written by any form in this
 * module — see `settings-model.ts` for why.
 */

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function projectManagerOrgSettings(raw: unknown): ManagerOrgSettings {
  const source = (raw || {}) as Record<string, unknown>;
  return {
    id: str(source.id),
    orgId: str(source.orgId),
    vatPercent: str(source.vatPercent) || "0",
    currency: str(source.currency) || "UGX",
    baseCurrencyCode: typeof source.baseCurrencyCode === "string" ? source.baseCurrencyCode : null,
    discountApprovalThreshold: str(source.discountApprovalThreshold) || "0",
    reservationHoldMinutes: num(source.reservationHoldMinutes, 30),
    receiptFooter: typeof source.receiptFooter === "string" ? source.receiptFooter : null,
    showCostToChef: bool(source.showCostToChef),
    anomalyThresholds: jsonObject(source.anomalyThresholds),
    rounding: jsonObject(source.rounding),
    taxMatrix: jsonObject(source.taxMatrix),
    attendance: jsonObject(source.attendance),
    inventoryTolerance: jsonObject(source.inventoryTolerance),
    bookingPolicies:
      source.bookingPolicies && typeof source.bookingPolicies === "object"
        ? (source.bookingPolicies as Record<string, unknown>)
        : null,
    platformAccess:
      source.platformAccess && typeof source.platformAccess === "object"
        ? (source.platformAccess as Record<string, unknown>)
        : null,
  };
}

export async function getManagerOrgSettings(token: string, branchId: string) {
  const raw = await apiRequest<Record<string, unknown>>("/api/settings", { token, branchId });
  return projectManagerOrgSettings(raw);
}

/** `PUT /settings/currency` — currency + optional baseCurrencyCode. */
export async function updateManagerCurrency(
  token: string,
  branchId: string,
  input: { currency: string; baseCurrencyCode?: string },
) {
  return apiRequest<unknown>("/api/settings/currency", {
    method: "PUT",
    body: input,
    token,
    branchId,
  });
}

/** `PUT /settings/tax-matrix` — defaultVatPct + categories[]. */
export async function updateManagerTaxMatrix(
  token: string,
  branchId: string,
  input: { defaultVatPct: number; categories: { name: string; vatPct: number }[] },
) {
  return apiRequest<unknown>("/api/settings/tax-matrix", {
    method: "PUT",
    body: input,
    token,
    branchId,
  });
}

/** `PUT /settings/rounding` — mode + increment. */
export async function updateManagerRounding(
  token: string,
  branchId: string,
  input: { mode: "NEAREST" | "UP" | "DOWN"; increment: number },
) {
  return apiRequest<unknown>("/api/settings/rounding", {
    method: "PUT",
    body: input,
    token,
    branchId,
  });
}

/** `PATCH /thresholds` — the one route that bundles two storage locations (see API matrix §1). */
export async function updateManagerThresholds(
  token: string,
  branchId: string,
  input: { lateVoidMin: number; heavyDiscountUGX: number; discountApprovalThreshold: string },
) {
  return apiRequest<unknown>("/api/thresholds", {
    method: "PATCH",
    body: input,
    token,
    branchId,
  });
}

/**
 * `PATCH /settings` — the general route, used ONLY for fields with no dedicated
 * PUT/PATCH sibling: `reservationHoldMinutes`, `receiptFooter`, `showCostToChef`,
 * `attendance`, `inventoryTolerance`. Each JSON field is a full replace server-side
 * (not a deep merge) — callers must spread the existing object and override only
 * the known key, never send a bare `{autoClockOutHours: n}` that would drop any
 * other key already stored there.
 */
export async function updateManagerGeneralSettings(
  token: string,
  branchId: string,
  input: Partial<{
    reservationHoldMinutes: number;
    receiptFooter: string;
    showCostToChef: boolean;
    attendance: Record<string, unknown>;
    inventoryTolerance: Record<string, unknown>;
  }>,
) {
  return apiRequest<unknown>("/api/settings", {
    method: "PATCH",
    body: input,
    token,
    branchId,
  });
}

// ── Exchange rates (list + create only — no edit/delete route exists) ─────────

function projectManagerExchangeRate(raw: unknown): ManagerExchangeRate {
  const source = (raw || {}) as Record<string, unknown>;
  return {
    id: str(source.id),
    baseCurrencyCode: str(source.baseCurrencyCode),
    quoteCurrencyCode: str(source.quoteCurrencyCode),
    rate: str(source.rate),
    effectiveAt: str(source.effectiveAt),
    createdAt: typeof source.createdAt === "string" ? source.createdAt : null,
  };
}

export async function listManagerExchangeRates(token: string, branchId: string) {
  const response = await apiRequest<unknown[]>("/api/settings/exchange-rates", { token, branchId });
  return (Array.isArray(response) ? response : []).map(projectManagerExchangeRate);
}

export async function createManagerExchangeRate(
  token: string,
  branchId: string,
  draft: ManagerExchangeRateDraft,
) {
  return apiRequest<unknown>("/api/settings/exchange-rate", {
    method: "POST",
    body: draft,
    token,
    branchId,
  });
}
