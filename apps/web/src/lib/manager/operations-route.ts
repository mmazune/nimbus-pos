import {
  MANAGER_ORDER_STATUS_FILTERS,
  MANAGER_RESERVATION_SCOPES,
  MANAGER_RESERVATION_STATUS_FILTERS,
  MANAGER_SERVICE_TYPE_FILTERS,
} from "./operations-model";
import type { ManagerReservationScope } from "./operations-types";

/**
 * Manager Operations routing + URL state (Track B3).
 *
 * Every list surface persists its scope/filters/page/selection in the URL, so
 * refresh, Back and Forward all restore the same view — the same rule Supervisor
 * Reservations and Cashier C2 already follow.
 *
 * Two hard rules encoded here rather than in components:
 *
 * - **Every value read from the URL is validated against the endpoint's own
 *   enum.** A hand-edited `?status=DEFINITELY_NOT_A_STATUS` resolves to "no
 *   filter" instead of being forwarded to the API and 400-ing the page.
 * - **Page numbers are clamped to >= 1.** `?page=0` and `?page=-4` are the same
 *   bounded first page, never an unbounded or negative `skip`.
 */

export const MANAGER_OPERATIONS_ROUTES = {
  orders: "/manager/operations/orders",
  tables: "/manager/operations/tables",
  reservations: "/manager/operations/reservations",
} as const;

export const MANAGER_OPERATIONS_LANDING = MANAGER_OPERATIONS_ROUTES.orders;

export type ManagerQueryValue = string | string[] | undefined;
export type ManagerQuery = Record<string, ManagerQueryValue>;

export function firstManagerQueryValue(value: ManagerQueryValue): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return typeof value === "string" ? value.trim() || null : null;
}

export function readManagerPage(value: ManagerQueryValue) {
  const raw = firstManagerQueryValue(value);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function readEnum<T extends string>(value: ManagerQueryValue, allowed: readonly T[]): T | null {
  const raw = firstManagerQueryValue(value)?.toUpperCase();
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function readManagerOrderStatus(value: ManagerQueryValue) {
  return readEnum(value, MANAGER_ORDER_STATUS_FILTERS);
}

export function readManagerServiceType(value: ManagerQueryValue) {
  return readEnum(value, MANAGER_SERVICE_TYPE_FILTERS);
}

export function readManagerReservationStatus(value: ManagerQueryValue) {
  return readEnum(value, MANAGER_RESERVATION_STATUS_FILTERS);
}

export function readManagerReservationScope(value: ManagerQueryValue): ManagerReservationScope {
  const raw = firstManagerQueryValue(value)?.toLowerCase();
  return (MANAGER_RESERVATION_SCOPES as readonly string[]).includes(raw || "")
    ? (raw as ManagerReservationScope)
    : "active";
}

/**
 * Merge patch into the current query, deleting any key set to null/"".
 * Changing a FILTER always resets `page` to 1 — otherwise a filter change can
 * land on page 7 of a 2-page result and render an empty list that looks broken.
 */
export function buildManagerListQuery(current: ManagerQuery, patch: Record<string, string | number | null>) {
  const next: ManagerQuery = { ...current };
  const changesFilter = Object.keys(patch).some((key) => key !== "page");

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") delete next[key];
    else next[key] = String(value);
  }

  if (changesFilter && !("page" in patch)) delete next.page;
  return next;
}
