import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Prompt C2 — Find bill foundation: a Cashier-only sibling control (never inside
 * the shared Floor) opens a bounded lookup and routes the selected bill into the
 * canonical settlement workspace via orderId URL state.
 */
test.describe("Cashier Find bill", () => {
  test("opens a bounded lookup and routes a result into the settlement workspace", async ({ page }) => {
    await apiCreateBill();
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);

    await page.getByRole("button", { name: /find bill/i }).click();
    const dialog = page.getByRole("dialog", { name: /find bill/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox").first()).toBeVisible();

    const firstResult = dialog.getByRole("button", { name: /Opened/ }).first();
    await expect(firstResult).toBeVisible({ timeout: 20_000 });
    await firstResult.click();

    await expect(page).toHaveURL(/orderId=/);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /^Totals$/i })).toBeVisible();
  });

  test("Find bill is not present for Waiter or Supervisor", async ({ page }) => {
    await uiLogin(page, "waiter");
    await page.waitForURL(/\/waiter\/floor/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /find bill/i })).toHaveCount(0);

    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /find bill/i })).toHaveCount(0);
  });
});
