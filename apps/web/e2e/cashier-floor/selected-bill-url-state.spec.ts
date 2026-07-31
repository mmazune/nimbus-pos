import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiResolveSingleBillTable } from "./c2-fixtures";

/**
 * Prompt C2 — canonical orderId URL state: refresh restores the selected bill;
 * Back returns to Floor; invalid/cross-branch orderId fails safe.
 */
test.describe("Cashier selected-bill URL state", () => {
  test("refresh restores the selected bill; Back returns to Floor", async ({ page }) => {
    const single = await apiResolveSingleBillTable();
    test.skip(!single, "no clean single-bill table was available in the branch");
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${single!.tableId}`);
    await page.waitForURL(new RegExp(`orderId=${single!.orderId}`), { timeout: 25_000 });
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`orderId=${single!.orderId}`));
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();

    await page.getByRole("button", { name: /back to floor/i }).click();
    await expect(page).not.toHaveURL(/orderId=/);
    await expect(page.locator("[data-operational-workspace]")).toHaveCount(0);
  });

  test("invalid orderId fails safe without showing another bill", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.goto("/cashier/floor?orderId=nonexistentorderid000000000000");
    await page.waitForURL(/\/cashier\/floor/);
    await expect(page.getByText(/bill unavailable|no longer available/i).first()).toBeVisible({ timeout: 25_000 });
  });
});
