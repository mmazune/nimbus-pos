/**
 * URL state helpers for the Customers/Vendors list + detail surfaces —
 * Track B5.2.
 *
 * Same shape as `lib/manager/operations-route.ts` (B3): every list persists
 * `page` and its filter(s) in the URL, detail views use a query-param id
 * (`?invoiceId=`, `?billId=`, …) rather than a nested dynamic route — the same
 * "one page, list OR detail" pattern `ManagerOrdersScreen` established, chosen
 * again here rather than duplicated import so the two modules can evolve
 * independently (accounting stays self-contained per OD-2).
 */

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

/** A hand-edited `?status=NOT_REAL` resolves to "no filter", never a forwarded 400. */
export function readManagerEnum<T extends string>(value: ManagerQueryValue, allowed: readonly T[]): T | null {
  const raw = firstManagerQueryValue(value)?.toUpperCase();
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/**
 * Merge patch into the current query, deleting any key set to null/"".
 * Changing a FILTER always resets `page` to 1 — otherwise a filter change can
 * land on a page that no longer exists and render an empty list that looks
 * broken.
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
