import { expect, Page } from "@playwright/test";

export {
  MANAGER_CFG,
  MANAGER_BRANCH_STORAGE_KEY,
  branchSwitcher,
  captureBranchHeaders,
  managerLogin,
} from "../manager-shell/fixtures";
export { captureApiRequests, captureConsoleErrors } from "../manager-dashboard/fixtures";

export const MANAGER_OPERATIONS_ROUTES = {
  orders: "/manager/operations/orders",
  tables: "/manager/operations/tables",
  reservations: "/manager/operations/reservations",
} as const;

export const MANAGER_STAFF_ROUTES = {
  directory: "/manager/staff/directory",
  onboarding: "/manager/staff/onboarding",
  quickPin: "/manager/staff/quick-pin",
  leave: "/manager/staff/leave",
  shiftSwaps: "/manager/staff/shift-swaps",
} as const;

export function listTable(page: Page) {
  return page.locator("[data-manager-list-table]");
}

export function listRows(page: Page) {
  return page.locator("[data-manager-list-row]");
}

export function controlPanel(page: Page) {
  return page.locator("[data-manager-control-panel]");
}

/**
 * Resolves once a Manager list surface has settled — the table, an empty state
 * or an error state is on screen.
 *
 * ⚠️ This is an ARRIVAL barrier, not a TRANSITION barrier. It returns
 * immediately when content is already present, so it must never be used to wait
 * for the *next* state after an interaction: a paginate or a scope switch keeps
 * the previous table on screen while the new page is in flight, so this helper
 * resolves before the request has even been issued. Use
 * {@link waitForApiRequest} for that.
 */
export async function waitForListSettled(page: Page) {
  await expect
    .poll(async () => {
      const table = await listTable(page).count();
      const empty = await page.getByRole("heading", { name: /^No /i }).count();
      const error = await page.getByRole("heading", { name: /unavailable/i }).count();
      return table + empty + error;
    }, { timeout: 45_000 })
    .toBeGreaterThan(0);
}

/**
 * Waits for a captured request whose URL matches `pattern` — the correct barrier
 * after an interaction that triggers a refetch, because the previous page's
 * content stays on screen while the new one loads.
 */
export async function waitForApiRequest(
  requests: Array<{ url: string; method: string; branchId: string | null }>,
  pattern: RegExp,
  timeout = 30_000,
) {
  await expect
    .poll(() => requests.filter((request) => pattern.test(request.url)).length, { timeout })
    .toBeGreaterThan(0);
  return requests.filter((request) => pattern.test(request.url));
}

/**
 * The shared Floor's page heading. `exact` matters: the Manager Tables screen
 * also renders a "What this floor cannot show" card, and a substring match on
 * "Floor" resolves to both, which is a strict-mode violation rather than a
 * product problem.
 */
export function sharedFloorHeading(page: Page) {
  return page.getByRole("heading", { name: "Floor", exact: true });
}

/**
 * The keys the Manager suite treats as forbidden on the wire and in the DOM.
 * Mirrors `lib/manager/staff-projection.ts` FORBIDDEN_STAFF_KEYS — the e2e proof
 * and the runtime allow-list check the same list, so they cannot drift.
 */
export const FORBIDDEN_DOM_KEYS = [
  "compensationProfile",
  "baseAmount",
  "salaryBasis",
  "salaryAmount",
  "allowances",
  "deductions",
  "dateOfBirth",
  "emergencyContactName",
  "emergencyContactPhone",
  "bankAccount",
  "taxId",
] as const;

/** Every response body the page received, so the WIRE can be inspected too. */
export function captureApiResponses(page: Page) {
  const bodies: Array<{ url: string; body: string }> = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!/\/api\//.test(url)) return;
    try {
      const body = await response.text();
      bodies.push({ url, body });
    } catch {
      // A cancelled or streamed response cannot be read; ignore it rather than fail.
    }
  });
  return bodies;
}
