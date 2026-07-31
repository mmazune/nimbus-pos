import { test, expect } from "@playwright/test";

import { expectNoHorizontalOverflow, uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — responsive integrity at the active viewport project. Runs across
 * all four configured viewports (1024/1366/1440/1920).
 */
test.describe("Cashier Floor responsive", () => {
  test("no horizontal overflow on Floor / Till / Me and the bottom nav is present", async ({ page }) => {
    await uiLogin(page, "cashier");
    for (const path of ["/cashier/floor", "/cashier/till", "/cashier/me"]) {
      await page.goto(path);
      await page.waitForURL(new RegExp(path.replace(/\//g, "\\/")));
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("[data-operational-bottom-nav]")).toBeVisible();
    }
  });

  test("selected-table bill workspace does not overflow horizontally", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const card = page.locator("[data-operational-table-id]").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
