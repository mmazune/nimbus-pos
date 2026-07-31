import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Prompt C2 — settlement readiness is presented truthfully and does not auto-open
 * a till or auto-navigate. An "Open Till" link is available for the cashier.
 */
test.describe("Cashier settlement readiness", () => {
  test("shows shift/till readiness with an Open Till link and no auto-navigation", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    await expect(page.getByRole("heading", { level: 3, name: /^Settlement readiness$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open till/i })).toBeVisible();
    // The workspace did not navigate us away to the Till on its own.
    await expect(page).toHaveURL(new RegExp(`orderId=${orderId}`));
    await expect(page).not.toHaveURL(/\/cashier\/till/);
  });
});
