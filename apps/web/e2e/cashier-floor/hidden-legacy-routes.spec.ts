import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — Queue/Receipts are hidden compatibility routes: reachable by
 * direct URL (NOT redirected in C1), never surfaced in the shell navigation.
 */
test.describe("Cashier hidden compatibility routes", () => {
  test("/cashier/queue still loads directly (not redirected)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.goto("/cashier/queue");
    await page.waitForURL(/\/cashier\/queue/, { timeout: 20_000 });
    expect(page.url()).toContain("/cashier/queue");
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("/cashier/receipts still loads directly (not redirected)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.goto("/cashier/receipts");
    await page.waitForURL(/\/cashier\/receipts/, { timeout: 20_000 });
    expect(page.url()).toContain("/cashier/receipts");
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("no shell nav link points to Queue or Receipts on any Cashier surface", async ({ page }) => {
    await uiLogin(page, "cashier");
    for (const path of ["/cashier/floor", "/cashier/till", "/cashier/me"]) {
      await page.goto(path);
      await page.waitForURL(new RegExp(path.replace(/\//g, "\\/")));
      await expect(page.getByRole("link", { name: /^queue$/i })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^receipts$/i })).toHaveCount(0);
    }
  });
});
