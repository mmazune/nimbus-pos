import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — Cashier Floor-first navigation + default routing.
 */
test.describe("Cashier navigation + default route", () => {
  test("login lands on /cashier/floor with nav Floor/Till/Me (no Queue/Receipts/Orders)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/, { timeout: 30_000 });

    for (const label of ["Floor", "Till", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /^queue$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^receipts$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^orders$/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("bare /cashier redirects to /cashier/floor", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.goto("/cashier");
    await page.waitForURL(/\/cashier\/floor/, { timeout: 30_000 });
    expect(page.url()).toContain("/cashier/floor");
    expect(page.url()).not.toMatch(/\/cashier$/);
  });

  test("Floor nav item is active/current on the Floor route", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const floorLink = page.getByRole("link", { name: /^floor$/i }).first();
    await expect(floorLink).toBeVisible();
    // active nav is marked with aria-current in the shared bottom nav
    await expect(floorLink).toHaveAttribute("aria-current", /page|true/);
  });
});
