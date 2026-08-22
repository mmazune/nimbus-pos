/**
 * Manager Settings — types (Track B6).
 *
 * Mirrors the real `SettingsController` DTOs 1:1 (`apps/api/src/modules/settings/dto/`)
 * — no field is modelled here that the backend does not accept, and no field the
 * backend accepts is silently dropped, except the ones deliberately omitted for a
 * documented reason (see `settings-model.ts`).
 */

export type ManagerOrgSettings = {
  id: string;
  orgId: string;
  vatPercent: string;
  currency: string;
  baseCurrencyCode: string | null;
  discountApprovalThreshold: string;
  reservationHoldMinutes: number;
  receiptFooter: string | null;
  showCostToChef: boolean;
  anomalyThresholds: Record<string, unknown>;
  rounding: Record<string, unknown>;
  taxMatrix: Record<string, unknown>;
  attendance: Record<string, unknown>;
  inventoryTolerance: Record<string, unknown>;
  /** Present on the wire but deliberately not editable here — see settings-model.ts. */
  bookingPolicies: Record<string, unknown> | null;
  platformAccess: Record<string, unknown> | null;
};

export type ManagerTaxCategory = {
  name: string;
  vatPct: number;
};

export type ManagerExchangeRate = {
  id: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: string;
  effectiveAt: string;
  createdAt: string | null;
};

export type ManagerExchangeRateDraft = {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: string;
  effectiveAt: string;
};
