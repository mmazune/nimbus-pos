import { MANAGER_REPORT_CATEGORIES } from "./reports-catalog";
import { MANAGER_REPORT_RUN_STATUSES } from "./reports-model";
import type { ManagerReportRunStatus } from "./reports-types";

import { firstManagerQueryValue, type ManagerQueryValue } from "./operations-route";

/**
 * Manager Reports routing + URL state (Track B4).
 *
 * Follows the rules B3 encoded in `operations-route.ts` rather than restating
 * them: every value read from the URL is validated against the endpoint's own
 * enum (a hand-edited `?status=NOPE` becomes "no filter" instead of 400-ing the
 * page), and page numbers clamp to >= 1.
 *
 * The module has two surfaces, matching the menu tree B1 already published:
 * `Catalog` and `Report runs`.
 */
export const MANAGER_REPORTS_ROUTES = {
  catalog: "/manager/reports/catalog",
  runs: "/manager/reports/runs",
} as const;

export const MANAGER_REPORTS_LANDING = MANAGER_REPORTS_ROUTES.catalog;

/** `?report=DAILY_SALES` opens the generate form for one catalog entry. */
export function readManagerReportKey(value: ManagerQueryValue) {
  const raw = firstManagerQueryValue(value);
  if (!raw) return null;
  // Catalog keys are SCREAMING_SNAKE; anything else cannot match an entry and
  // is treated as no selection rather than passed on.
  return /^[A-Z][A-Z0-9_]*$/.test(raw) ? raw : null;
}

/** `?runId=…` opens one run's detail. */
export function readManagerRunId(value: ManagerQueryValue) {
  const raw = firstManagerQueryValue(value);
  if (!raw) return null;
  return /^[A-Za-z0-9_-]{6,64}$/.test(raw) ? raw : null;
}

export function readManagerReportCategory(value: ManagerQueryValue) {
  const raw = firstManagerQueryValue(value);
  if (!raw) return null;
  return (MANAGER_REPORT_CATEGORIES as readonly string[]).includes(raw) ? raw : null;
}

export function readManagerRunStatus(value: ManagerQueryValue): ManagerReportRunStatus | null {
  const raw = firstManagerQueryValue(value)?.toUpperCase();
  if (!raw) return null;
  return (MANAGER_REPORT_RUN_STATUSES as readonly string[]).includes(raw)
    ? (raw as ManagerReportRunStatus)
    : null;
}

export function readManagerRunReportType(value: ManagerQueryValue) {
  return readManagerReportKey(value);
}

export function readManagerReportSearch(value: ManagerQueryValue) {
  const raw = firstManagerQueryValue(value);
  // Bounded so a pathological URL cannot drive an unbounded client-side scan.
  return raw ? raw.slice(0, 80) : "";
}
