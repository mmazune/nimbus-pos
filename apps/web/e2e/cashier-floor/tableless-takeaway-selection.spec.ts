import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateTakeawayBill } from "./c2-fixtures";

/**
 * Prompt C2 — a tableless / takeaway bill opens the canonical settlement
 * workspace with orderId only (no fabricated table), and refresh restores it.
 */
test.describe("Cashier tableless / takeaway bill", () => {
  test("a takeaway bill opens by orderId with no tableId", async ({ page }) => {
    const { orderId } = await apiCreateTakeawayBill();
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?orderId=${orderId}`);
    await page.waitForURL(new RegExp(`orderId=${orderId}`), { timeout: 25_000 });
    await expect(page).not.toHaveURL(/tableId=/);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
    await expect(page.getByText(/takeaway/i).first()).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`orderId=${orderId}`));
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
  });
});
