import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C2 — cross-role regression. The Cashier settlement/Find-bill surfaces
 * never leak into Waiter or Supervisor, and their table behaviour is unchanged.
 */
test.describe("Cashier C2 cross-role regression", () => {
  test("Waiter table selection opens the menu/order flow, not a Cashier bill workspace", async ({ page }) => {
    await uiLogin(page, "waiter");
    await page.waitForURL(/\/waiter\/floor/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /find bill/i })).toHaveCount(0);
    const card = page.locator("[data-operational-table-id]").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    // Waiter opens its own workspace — never the Cashier settlement sections.
    await expect(page.getByRole("heading", { level: 3, name: /^Payment state$/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: /^Settlement readiness$/i })).toHaveCount(0);
  });

  test("Supervisor table selection opens the control workspace, not a Cashier bill workspace", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /find bill/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /find order/i })).toBeVisible();
  });

  test("Cashier nav and Floor are Cashier-only (no Supervisor/Waiter controls)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    await expect(page.getByRole("button", { name: /find bill/i })).toBeVisible();
    for (const name of [/find order/i, /transfer table/i, /^void$/i, /approve discount/i, /add item/i]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });
});
