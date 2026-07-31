import { test, expect } from "@playwright/test";

import { expectNoHorizontalOverflow, uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Prompt C2 — the settlement workspace fits every configured viewport with no
 * horizontal overflow and no bottom-nav obstruction. Runs under all four
 * viewport projects.
 */
test.describe("Cashier C2 responsive", () => {
  test("the settlement workspace does not overflow and keeps the bottom nav", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });
    await expectNoHorizontalOverflow(page);
    await expect(page.locator("[data-operational-bottom-nav]")).toBeVisible();
  });

  test("the Find bill dialog fits the viewport", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    await page.getByRole("button", { name: /find bill/i }).click();
    await expect(page.getByRole("dialog", { name: /find bill/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
