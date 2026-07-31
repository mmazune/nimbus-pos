import { test, expect, Page } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

async function firstTableId(page: Page): Promise<string> {
  const card = page.locator("[data-operational-table-id]").first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  return (await card.getAttribute("data-operational-table-id")) as string;
}

/**
 * Prompt C2 — canonical table-selection URL state (?tableId=…) with refresh /
 * Back / Forward survival, opening the read-only bill-resolution / settlement
 * workspace (no premature payment affordance).
 */
test.describe("Cashier table selection routing", () => {
  test("selecting a table writes tableId and opens a read-only bill workspace", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const id = await firstTableId(page);
    await page.locator(`[data-operational-table-id="${id}"]`).click();

    await page.waitForURL(new RegExp(`tableId=${id}`), { timeout: 20_000 });
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
    // No premature payment/settlement affordance in the C2 read-only foundation.
    for (const name of [/collect payment/i, /take payment/i, /^pay$/i, /close order/i, /split bill/i, /^open refund$/i]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("refresh preserves the selected table", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const id = await firstTableId(page);
    await page.locator(`[data-operational-table-id="${id}"]`).click();
    await page.waitForURL(new RegExp(`tableId=${id}`));

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`tableId=${id}`));
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
  });

  test("Back clears selection, Forward restores it", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const id = await firstTableId(page);
    await page.locator(`[data-operational-table-id="${id}"]`).click();
    await page.waitForURL(new RegExp(`tableId=${id}`));

    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(`tableId=${id}`));

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`tableId=${id}`));
  });

  test("invalid/cross-branch tableId fails safe (Table unavailable, no crash)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.goto("/cashier/floor?tableId=nonexistent-table-000000000000");
    await page.waitForURL(/\/cashier\/floor/);
    await expect(page.getByText(/table unavailable/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("body")).not.toContainText(/select a bill to continue/i);
  });
});
