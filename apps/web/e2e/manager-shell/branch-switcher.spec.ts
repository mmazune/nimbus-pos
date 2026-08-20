import { test, expect } from "@playwright/test";

import {
  MANAGER_BRANCH_STORAGE_KEY,
  MANAGER_CFG,
  branchSwitcher,
  captureBranchHeaders,
  managerLogin,
} from "./fixtures";

/**
 * Manager M-P1 — the branch switcher: it lists the manager's ACTIVE memberships,
 * persists the selection across a reload, and re-scopes subsequent API reads by
 * changing the `X-Branch-Id` header (proved by request capture, not by inference).
 */
test.describe("Manager branch switcher", () => {
  test("lists the manager's four active branch memberships", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);

    const select = branchSwitcher(page);
    await expect(select).toBeVisible();
    const optionLabels = await select.locator("option").allTextContents();
    expect(optionLabels.length).toBe(4);
    for (const name of MANAGER_CFG.expectedBranchNames) {
      expect(optionLabels.join(" | ")).toContain(name);
    }
    await expect(select).toHaveValue(MANAGER_CFG.defaultBranchId);
  });

  test("the switcher has an accessible label", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    await expect(page.getByLabel(/active branch/i)).toBeVisible();
  });

  test("switching branch persists across a reload", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);

    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await expect(branchSwitcher(page)).toHaveValue(MANAGER_CFG.secondBranchId);

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      MANAGER_BRANCH_STORAGE_KEY,
    );
    expect(stored).toBe(MANAGER_CFG.secondBranchId);

    await page.reload();
    await page.waitForURL(/\/manager\/overview/);
    await expect(branchSwitcher(page)).toHaveValue(MANAGER_CFG.secondBranchId);

    // ...and across a route change too.
    await page.goto("/manager/settings");
    await expect(branchSwitcher(page)).toHaveValue(MANAGER_CFG.secondBranchId);
  });

  test("switching branch changes X-Branch-Id on subsequent API requests", async ({ page }) => {
    const captured = captureBranchHeaders(page);
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);

    const branchScoped = (branchId: string) =>
      captured.filter((entry) => /\/api\/devices/.test(entry.url) && entry.branchId === branchId);

    await expect
      .poll(() => branchScoped(MANAGER_CFG.defaultBranchId).length, { timeout: 20_000 })
      .toBeGreaterThan(0);

    const before = captured.length;
    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);

    // The switch triggers a refetch of the manager namespace with the NEW branch...
    await expect
      .poll(() => branchScoped(MANAGER_CFG.secondBranchId).length, { timeout: 20_000 })
      .toBeGreaterThan(0);

    // ...and once it settles, the newest branch-scoped read carries the new branch.
    // (The slice can still contain an in-flight old-branch request issued before the
    // switch, so the invariant asserted is the settled tail, not every entry.)
    await expect
      .poll(
        () => {
          const devices = captured.filter((entry) => /\/api\/devices/.test(entry.url));
          return devices[devices.length - 1]?.branchId ?? null;
        },
        { timeout: 20_000 },
      )
      .toBe(MANAGER_CFG.secondBranchId);

    // Auth is never re-scoped or re-fetched by a branch switch.
    const authAfterSwitch = captured.slice(before).filter((entry) => /\/api\/auth\/me/.test(entry.url));
    expect(authAfterSwitch.length).toBe(0);
  });

  test("the readiness strip reflects the selected branch", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    const readiness = page.locator("[data-manager-readiness]");
    await expect(readiness).toContainText(/Branch:\s*Tapas Downtown/i);

    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await expect(readiness).toContainText(/Branch:\s*Rooftop Bar/i);

    // Tills and shifts chips must not exist in M-P1 (no branch-wide source).
    await expect(readiness).not.toContainText(/Tills:/i);
    await expect(readiness).not.toContainText(/Shifts:/i);
  });
});
