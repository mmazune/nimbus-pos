import { expect, Page } from "@playwright/test";

export {
  MANAGER_CFG,
  MANAGER_BRANCH_STORAGE_KEY,
  branchSwitcher,
  captureApiRequests,
  captureConsoleErrors,
  controlPanel,
  listRows,
  listTable,
  managerLogin,
  waitForApiRequest,
  waitForListSettled,
} from "../manager-operations/fixtures";

export const MANAGER_REPORTS_ROUTES = {
  catalog: "/manager/reports/catalog",
  runs: "/manager/reports/runs",
} as const;

/**
 * The three generators this suite drives end to end. They are chosen to cover
 * the three structurally different shapes B4 has to render, not just three names:
 *
 * - `DAILY_SALES` — a pure aggregate summary with NO breakdown array, and the
 *   report whose gross/net is cross-checked against `/api/dash/today-summary`.
 * - `TOP_ITEMS` — the only generator with a `limit` parameter, and a real
 *   breakdown array whose CSV is genuinely tabular.
 * - `PAYMENT_MIX` — a breakdown-only report, proving the table is not special
 *   to TOP_ITEMS.
 */
export const VERIFIED_GENERATORS = ["DAILY_SALES", "TOP_ITEMS", "PAYMENT_MIX"] as const;

/** A PENDING_LATER catalog entry — no generator exists for it on any backend. */
export const UNAVAILABLE_GENERATOR = "PAYROLL_SUMMARY";

export function reportForm(page: Page) {
  return page.locator("[data-manager-report-form]");
}

export function summaryPanel(page: Page) {
  return page.locator("[data-manager-report-summary]");
}

export function breakdownTable(page: Page) {
  return page.locator("[data-manager-report-breakdown]");
}

export function downloadButton(page: Page) {
  return page.locator("[data-manager-report-download]");
}

/** Waits for the generated run panel to appear after a generate. */
export async function waitForGeneratedRun(page: Page) {
  await expect(page.locator("[data-manager-report-run]")).toBeVisible({ timeout: 45_000 });
}

/**
 * Reads a summary figure by its rendered label.
 *
 * Deliberately label-driven rather than index-driven: the whole point of B4's
 * money handling is that a value sits under the RIGHT label, so a test that
 * matched on position would not prove the thing that matters.
 */
export async function summaryValue(page: Page, label: string) {
  const row = summaryPanel(page).locator("div", { has: page.getByText(label, { exact: true }) }).first();
  const text = await row.textContent();
  return (text || "").replace(label, "").trim();
}

/** Every value currently rendered in the summary panel, keyed by its label. */
export async function summaryEntries(page: Page) {
  return summaryPanel(page).evaluate((panel) => {
    const out: Record<string, string> = {};
    for (const cell of Array.from(panel.children)) {
      const label = cell.querySelector("dt")?.textContent?.trim();
      const value = cell.querySelector("dd")?.textContent?.trim();
      if (label && value) out[label] = value;
    }
    return out;
  });
}

/**
 * The branch the page is actually operating on.
 *
 * ⚠️ `nimbus.managerBranchId` is written only when the manager EXPLICITLY
 * switches branch — a fresh login runs on `me.context.defaultBranchId` and
 * writes nothing. Reading localStorage alone therefore yields `null` on a clean
 * session, and a request sent without `X-Branch-Id` gets a **400**, which is how
 * this helper originally produced a misleading "NaN" comparison rather than a
 * real mismatch.
 */
export async function activeBranchId(page: Page) {
  return page.evaluate(async (api) => {
    const stored = window.localStorage.getItem("nimbus.managerBranchId");
    if (stored) return stored;
    const token = window.localStorage.getItem("nimbus.accessToken");
    const response = await fetch(`${api}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await response.json();
    return me?.context?.defaultBranchId ?? null;
  }, process.env.PW_API_URL || "http://localhost:4001");
}

/**
 * Calls the API directly with the page's own session, so a UI figure can be
 * compared against the endpoint that produced it. Throws on a non-2xx so a
 * broken comparison fails loudly instead of silently comparing `undefined`.
 */
export async function apiJson(page: Page, path: string) {
  const branchId = await activeBranchId(page);
  const result = await page.evaluate(
    async (target) => {
      const token = window.localStorage.getItem("nimbus.accessToken");
      const response = await fetch(`${target.api}${target.path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(target.branchId ? { "X-Branch-Id": target.branchId } : {}),
        },
      });
      return { status: response.status, body: await response.json() };
    },
    { api: process.env.PW_API_URL || "http://localhost:4001", path, branchId },
  );

  if (result.status >= 300) {
    throw new Error(`apiJson ${path} → HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  }
  return result.body;
}
