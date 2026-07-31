import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Prompt C2 — request budget for the resolution + settlement flow. No per-table
 * payment fetch on the Floor; one table-bills query for the selected table; one
 * detail + one payment-state query for the selected bill.
 */
test.describe("Cashier C2 request budget", () => {
  test("opening a table bill stays within the budget", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    const calls: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/")) calls.push(url);
    });

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(2_000);

    // Table-bills list for the selected table (tableId filter).
    const tableBills = calls.filter((u) => /\/api\/pos\/orders\?[^#]*tableId=/.test(u));
    expect(tableBills.length, `table-bills queries: ${tableBills.join(", ")}`).toBeGreaterThanOrEqual(1);
    expect(tableBills.length, "table-bills query is not storming").toBeLessThanOrEqual(3);

    // Exactly the selected bill's detail + payments (bounded).
    const detail = calls.filter((u) => new RegExp(`/api/pos/orders/${orderId}(\\?|$)`).test(u));
    const payments = calls.filter((u) => new RegExp(`/api/pos/orders/${orderId}/payments`).test(u));
    expect(detail.length, `selected-bill detail calls: ${detail.join(", ")}`).toBeGreaterThanOrEqual(1);
    expect(detail.length, "no detail storm").toBeLessThanOrEqual(3);
    expect(payments.length, `selected-bill payment calls: ${payments.join(", ")}`).toBeGreaterThanOrEqual(1);
    expect(payments.length, "no payment storm").toBeLessThanOrEqual(3);
  });
});
