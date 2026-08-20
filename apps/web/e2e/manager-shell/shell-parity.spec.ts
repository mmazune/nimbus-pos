import { test, expect } from "@playwright/test";

import { expectNoHorizontalOverflow, uiLogin } from "../supervisor-prompt3/fixtures";
import { MANAGER_TABS, branchSwitcher, managerLogin } from "./fixtures";

/**
 * Manager M-P1 — shared-shell parity. Manager renders the SAME shell regions as the
 * three existing roles, and the optional header slot leaves those roles untouched.
 */
test.describe("Manager shared-shell parity", () => {
  test("manager renders the shared shell regions and the brand logomark", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    await expect(page.locator("[data-operational-shell]")).toBeVisible();
    await expect(page.locator("[data-operational-header]")).toBeVisible();
    await expect(page.locator("[data-operational-bottom-nav]")).toBeVisible();
    await expect(page.locator("[data-manager-readiness]")).toBeVisible();
    await expect(page.locator("[data-operational-header] svg").first()).toBeVisible();
    await expect(page.getByLabel(/current time/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /log out/i }).first()).toBeVisible();
  });

  test("no manager tab overflows horizontally", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    for (const tab of MANAGER_TABS) {
      await page.goto(`/manager/${tab.toLowerCase()}`);
      await expect(page.locator("[data-operational-bottom-nav]")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  for (const [role, landing] of [
    ["waiter", /\/waiter\/floor/],
    ["cashier", /\/cashier\/floor/],
    ["supervisor", /\/supervisor\/floor/],
  ] as const) {
    test(`${role} header still renders without a branch switcher`, async ({ page }) => {
      await uiLogin(page, role);
      await page.waitForURL(landing, { timeout: 30_000 });
      await expect(page.locator("[data-operational-header]")).toBeVisible();
      await expect(branchSwitcher(page)).toHaveCount(0);
      await expect(page.locator("[data-manager-branch-switcher]")).toHaveCount(0);
      await expect(page.getByLabel(/current time/i)).toBeVisible();
    });
  }
});
