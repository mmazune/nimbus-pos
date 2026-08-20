import { expect, Page } from "@playwright/test";

export { MANAGER_CFG, MANAGER_BRANCH_STORAGE_KEY, branchSwitcher, captureBranchHeaders, managerLogin } from "../manager-shell/fixtures";

/** The eight cards the Track B2 Overview grid ships, in render order. */
export const DASHBOARD_CARDS = [
  "sales-today",
  "orders-today",
  "payment-mix",
  "open-orders",
  "low-stock",
  "approvals",
  "coverage",
  "readiness",
] as const;

export function card(page: Page, testId: (typeof DASHBOARD_CARDS)[number]) {
  return page.locator(`[data-manager-dashboard-card="${testId}"]`);
}

/**
 * Resolves once EVERY card has left its loading state. Polling the count matters:
 * waiting on the first loading node alone returns while other cards are still in
 * flight, which then leaks their requests into whatever the test measures next.
 */
export async function waitForDashboardSettled(page: Page) {
  await page.locator("[data-manager-dashboard-grid]").waitFor({ state: "visible" });
  await expect
    .poll(() => page.locator('[data-manager-card-state="loading"]').count(), { timeout: 45_000 })
    .toBe(0);
}

/** Records every console error and uncaught page error for a zero-error assertion. */
export function captureConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Every `/api/...` request the page makes, with method and branch header. */
export function captureApiRequests(page: Page) {
  const seen: Array<{ url: string; method: string; branchId: string | null }> = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!/\/api\//.test(url)) return;
    seen.push({ url, method: request.method(), branchId: request.headers()["x-branch-id"] ?? null });
  });
  return seen;
}

export function dashRequests(
  requests: Array<{ url: string; method: string; branchId: string | null }>,
  path: string,
) {
  return requests.filter((request) => request.url.includes(path));
}
