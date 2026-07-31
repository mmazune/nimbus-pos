import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiTryCreateMultiBillTable } from "./c2-fixtures";

/**
 * Prompt C2 — when a table carries more than one payable bill (e.g. split
 * children / distinct concurrent orders), each is rendered as a DISTINCT
 * selectable bill; the first is never auto-collapsed. Execution of split
 * settlement remains C3.
 */
test.describe("Cashier split / multi-bill representation", () => {
  test("distinct payable bills are individually selectable", async ({ page }) => {
    const multi = await apiTryCreateMultiBillTable();
    test.skip(!multi, "backend did not allow multiple concurrent bills on one table");
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${multi!.tableId}`);
    await expect(page.getByText(/multiple bills on this table/i)).toBeVisible({ timeout: 25_000 });

    const bills = page.getByRole("button", { name: /Opened/ });
    expect(await bills.count()).toBeGreaterThanOrEqual(2);
    // Selecting the SECOND bill opens that bill (not a silently-collapsed first).
    await bills.nth(1).click();
    await expect(page).toHaveURL(/orderId=/);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
  });
});
