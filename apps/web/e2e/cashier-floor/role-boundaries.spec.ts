import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — cross-role boundaries. Cashier Floor behaves like a Cashier (no
 * Waiter menu, no Supervisor control workspace, no transfer/void/discount), and
 * Waiter/Supervisor navigation is unchanged.
 */
test.describe("Cashier role boundaries", () => {
  test("Cashier Floor exposes no Supervisor/Waiter order-control affordances", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    for (const name of [/find order/i, /transfer table/i, /transfer server/i, /^void$/i, /approve discount/i, /add item|menu/i]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("selecting a Cashier table opens the bill workspace, not a menu or control workspace", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const card = page.locator("[data-operational-table-id]").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
    await expect(page.getByRole("button", { name: /add item|send to kitchen|mark served|request bill/i })).toHaveCount(0);
  });

  test("Waiter nav remains Floor/Reservations/Me (unchanged)", async ({ page }) => {
    await uiLogin(page, "waiter");
    await page.waitForURL(/\/waiter\/floor/, { timeout: 30_000 });
    for (const label of ["Floor", "Reservations", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
  });

  test("Supervisor nav remains Floor/Reservations/Approvals/Me (unchanged)", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/, { timeout: 30_000 });
    for (const label of ["Floor", "Reservations", "Approvals", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
  });
});
