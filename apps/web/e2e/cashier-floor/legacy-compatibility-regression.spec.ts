import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C2 — Queue and Receipts remain hidden compatibility routes: reachable by
 * direct URL, never in navigation, never redirected, never mounted on Floor.
 */
test.describe("Cashier legacy compatibility routes", () => {
  test("Queue and Receipts still render by direct URL and are absent from nav", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);

    // Not in navigation.
    for (const label of ["Queue", "Receipts"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") })).toHaveCount(0);
    }

    await page.goto("/cashier/queue");
    await expect(page).toHaveURL(/\/cashier\/queue/);
    await expect(page.getByRole("heading", { name: /^Queue$/i })).toBeVisible({ timeout: 20_000 });

    await page.goto("/cashier/receipts");
    await expect(page).toHaveURL(/\/cashier\/receipts/);
    await expect(page.locator("body")).not.toContainText(/404|not found/i);
  });

  test("nav is exactly Floor / Till / Me", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    for (const label of ["Floor", "Till", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
  });
});
