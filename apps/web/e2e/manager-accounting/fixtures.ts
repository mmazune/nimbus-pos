import { expect, Page } from "@playwright/test";

export {
  MANAGER_CFG,
  MANAGER_BRANCH_STORAGE_KEY,
  branchSwitcher,
  captureBranchHeaders,
  isDesktopTopNavViewport,
  managerLogin,
} from "../manager-shell/fixtures";
export { captureApiRequests, captureConsoleErrors } from "../manager-dashboard/fixtures";

export const ACCOUNTING_ROUTES = {
  root: "/manager/accounting",
  dashboard: "/manager/accounting/dashboard",
} as const;

/** The five cards the B5.1 grid ships, in render order. */
export const ACCOUNTING_CARDS = [
  "accounting-receivable",
  "accounting-payable",
  "accounting-ledger",
  "accounting-bank",
  "accounting-period",
] as const;

export function card(page: Page, testId: (typeof ACCOUNTING_CARDS)[number]) {
  return page.locator(`[data-manager-dashboard-card="${testId}"]`);
}

export function kpi(page: Page, key: string) {
  return page.locator(`[data-accounting-kpi="${key}"]`);
}

/** Resolves once every card has left its loading state. */
export async function waitForAccountingSettled(page: Page) {
  await page.locator("[data-accounting-dashboard-grid]").waitFor({ state: "visible", timeout: 45_000 });
  await expect
    .poll(() => page.locator('[data-manager-card-state="loading"]').count(), { timeout: 45_000 })
    .toBe(0);
}

/**
 * The rendered text of a KPI, minus its label.
 *
 * Deliberately keyed on the binding key rather than on position: the whole point
 * of the KPI registry is that a figure sits under the RIGHT binding, so a
 * positional match would not prove the thing that matters.
 */
export async function kpiValue(page: Page, key: string) {
  const node = kpi(page, key);
  await expect(node).toBeVisible();
  const text = (await node.textContent()) || "";
  return text.trim();
}

/** Digits only, so "UGX 9,106,400" and "9106400" compare equal. */
export function digitsOf(value: string) {
  return (value.match(/\d/g) || []).join("");
}

export function accountingMenuTrigger(page: Page) {
  return page
    .locator('[data-operational-top-nav] [role="menubar"]')
    .getByRole("menuitem", { name: /^accounting$/i });
}
