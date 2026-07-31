import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiResolveSingleBillTable, apiTryCreateMultiBillTable } from "./c2-fixtures";

/**
 * Prompt C2 — table→bill resolution: one payable bill auto-resolves; multiple
 * payable bills force an explicit selector (never a silent first-pick).
 */
test.describe("Cashier table→bill resolution", () => {
  test("exactly one payable bill auto-resolves into the settlement workspace", async ({ page }) => {
    const single = await apiResolveSingleBillTable();
    test.skip(!single, "no clean single-bill table was available in the branch");
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${single!.tableId}`);
    // Single payable bill → auto-resolve adds orderId to the URL.
    await page.waitForURL(new RegExp(`orderId=${single!.orderId}`), { timeout: 25_000 });
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /^Totals$/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /^Payment state$/i })).toBeVisible();
  });

  test("multiple payable bills show an explicit selector (no silent first-pick)", async ({ page }) => {
    const multi = await apiTryCreateMultiBillTable();
    test.skip(!multi, "backend did not allow two concurrent bills on one table");
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${multi!.tableId}`);
    await expect(page.getByText(/multiple bills on this table/i)).toBeVisible({ timeout: 25_000 });
    // The URL must NOT auto-carry any orderId until the cashier chooses.
    await expect(page).not.toHaveURL(/orderId=/);
    const bills = page.getByRole("button", { name: /Opened/ });
    await expect(bills.first()).toBeVisible();
    await bills.first().click();
    await expect(page).toHaveURL(/orderId=/);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
  });
});
