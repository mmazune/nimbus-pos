import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Prompt C2 — the settlement workspace is a READ-ONLY foundation: it shows Bill,
 * Totals, Payment state, Settlement readiness, and History sections, and exposes
 * NO payment / split / close / receipt / refund mutation control.
 */
test.describe("Cashier settlement workspace (read-only)", () => {
  test("shows canonical sections and no mutation controls", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    for (const name of [/^Bill$/i, /^Totals$/i, /^Payment state$/i, /^Settlement readiness$/i]) {
      await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    }
    await expect(page.getByText(/^Read-only$/i).first()).toBeVisible();

    for (const name of [
      /collect payment/i,
      /take payment/i,
      /^pay$/i,
      /close order/i,
      /split bill/i,
      /split items/i,
      /^open refund$/i,
      /print receipt/i,
      /reprint/i,
      /transfer table/i,
      /^void$/i,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });
});
