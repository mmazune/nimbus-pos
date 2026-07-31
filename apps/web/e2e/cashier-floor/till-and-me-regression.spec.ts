import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — Till and Me remain reachable and unregressed under the new nav.
 */
test.describe("Cashier Till + Me regression", () => {
  test("Till is reachable from the shell nav", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    await page.getByRole("link", { name: /^till$/i }).first().click();
    await page.waitForURL(/\/cashier\/till/, { timeout: 20_000 });
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
    await expect(page.getByRole("link", { name: /^till$/i }).first()).toHaveAttribute("aria-current", /page|true/);
  });

  test("Me is reachable and shows shared logout", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    await page.getByRole("link", { name: /^me$/i }).first().click();
    await page.waitForURL(/\/cashier\/me/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /log ?out|sign ?out/i }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });
});
