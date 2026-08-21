/**
 * Accounting module routing — Track B5.1.
 *
 * B5.1 ships exactly ONE real surface, the dashboard, so the module root
 * redirects to it — the same module-with-redirect pattern `/manager/operations`
 * (B3), `/manager/staff` (B3) and `/manager/reports` (B4) already use.
 *
 * The paths for later sub-phases are deliberately NOT declared here. A route
 * constant is a promise that something answers at that URL; B5.1 has no
 * authority to make that promise on B5.2's behalf, and the menu tree names those
 * surfaces as honest not-yet rows instead (see `menu.ts`).
 */
export const ACCOUNTING_ROOT = "/manager/accounting";

export const ACCOUNTING_ROUTES = {
  dashboard: "/manager/accounting/dashboard",
} as const;

export const ACCOUNTING_LANDING = ACCOUNTING_ROUTES.dashboard;

export function isAccountingRoute(pathname: string) {
  return pathname.startsWith(ACCOUNTING_ROOT);
}
