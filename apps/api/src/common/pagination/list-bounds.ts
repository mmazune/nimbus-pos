/**
 * Shared list-pagination bound for accounting/finance list routes
 * (backend gap batch 3 — B5-F3).
 *
 * ## Why this exists
 *
 * Track B5.1 (`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`
 * B5-F3) found that B0's "pagination bound" column was an artefact of a
 * combined `take`+`pageSize`+`limit` probe — `limit` isn't a field on these
 * DTOs, so the whitelist 400'd and the route was wrongly recorded as
 * "bounded". Probed with `take` alone, `ap/bills`, `ar/invoices`, `journals`
 * and `ar/aging` all returned 200 at `take=5000` — there was no server-side
 * maximum at all.
 *
 * The bound is expressed once, mirroring the existing leave/shift-swap
 * precedent (`MAX_LEAVE_PAGE_SIZE` in `attendance.service.ts`, itself citing
 * the Prompt 3D discounts fix, SUP-RG-032): the DTO already rejects
 * `take` above the max via `@Max`, and {@link clampTake} is the service-side
 * backstop so no caller — validated or not — can force an unbounded read.
 */
export const MAX_ACCOUNTING_LIST_PAGE_SIZE = 100;

/**
 * Clamp a caller-supplied `take` to `[1, max]`, falling back to `fallback`
 * when `take` is missing or not a finite number.
 */
export function clampTake(
  take: number | string | undefined,
  fallback = 50,
  max = MAX_ACCOUNTING_LIST_PAGE_SIZE,
): number {
  const n = Number(take);
  const resolved = take === undefined || take === null || !Number.isFinite(n) ? fallback : n;
  return Math.min(Math.max(Math.trunc(resolved), 1), max);
}
