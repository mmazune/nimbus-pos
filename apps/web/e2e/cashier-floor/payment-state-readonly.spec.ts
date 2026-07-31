import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Prompt C2 — payment state is presented read-only. A fresh SENT bill has no
 * posted payments; the workspace says so without offering any payment action and
 * never claims the bill is settled.
 */
test.describe("Cashier payment state (read-only)", () => {
  test("an unpaid bill shows a truthful, action-free payment state", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    await expect(page.getByRole("heading", { level: 3, name: /^Payment state$/i })).toBeVisible();
    await expect(page.getByText(/no posted payments|awaiting payment|unpaid/i).first()).toBeVisible();
    await expect(page.getByText(/^Settled$/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /collect payment|take payment|^pay$/i })).toHaveCount(0);
  });
});
