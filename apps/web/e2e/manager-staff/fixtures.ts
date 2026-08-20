import { expect, Page } from "@playwright/test";

export {
  FORBIDDEN_DOM_KEYS,
  MANAGER_CFG,
  MANAGER_BRANCH_STORAGE_KEY,
  MANAGER_STAFF_ROUTES,
  branchSwitcher,
  captureApiRequests,
  captureApiResponses,
  captureBranchHeaders,
  captureConsoleErrors,
  controlPanel,
  listRows,
  listTable,
  managerLogin,
  waitForApiRequest,
  waitForListSettled,
} from "../manager-operations/fixtures";

/**
 * Every QA record this suite creates is tagged so it is identifiable in the
 * disposable database afterwards and can never be mistaken for demo data.
 * Destructive/creating specs run ONLY against an isolated stack (see
 * docs/TESTING_AND_QA.md) — never shared Neon.
 */
export const QA_TAG = "ZZQA";

export function qaStaffName(suffix: string) {
  return { firstName: `${QA_TAG}${suffix}`, lastName: "Onboarding" };
}

/** A phone that satisfies the DTO's `/^[0-9+()\-\s]{6,30}$/` pattern. */
export function qaPhone(seed: number) {
  return `+25670${String(seed).padStart(7, "0")}`;
}

export function employeeCards(page: Page) {
  return page.locator("[data-manager-employee-card]");
}

export async function waitForDirectorySettled(page: Page) {
  await expect
    .poll(async () => {
      const kanban = await employeeCards(page).count();
      const table = await page.locator("[data-manager-list-row]").count();
      const empty = await page.getByRole("heading", { name: /^No staff match/i }).count();
      const error = await page.getByRole("heading", { name: /Directory unavailable/i }).count();
      return kanban + table + empty + error;
    }, { timeout: 45_000 })
    .toBeGreaterThan(0);
}
