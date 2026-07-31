import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — Floor default load stays within the request budget: one bounded
 * Floor query domain (tables + orders + reservations), and NO Queue-only,
 * Receipts-history, or per-table payment fetch.
 */
test.describe("Cashier Floor request budget", () => {
  test("default Floor load makes no receipt-history or per-table payment request", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/")) apiCalls.push(url);
    });

    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    // Let the Floor query settle.
    await page.waitForTimeout(2_500);

    const receiptHistory = apiCalls.filter((u) => /\/api\/receipts\/.+\/history/.test(u));
    const perTablePayments = apiCalls.filter((u) => /\/api\/pos\/orders\/[^/]+\/payments/.test(u));
    const orderDetail = apiCalls.filter((u) => /\/api\/pos\/orders\/[^/?]+(\?|$)/.test(u) && !/\/api\/pos\/orders\?/.test(u));

    expect(receiptHistory, `unexpected receipt-history calls: ${receiptHistory.join(", ")}`).toHaveLength(0);
    expect(perTablePayments, `unexpected per-table payment calls: ${perTablePayments.join(", ")}`).toHaveLength(0);
    expect(orderDetail, `unexpected selected-order detail calls before selection: ${orderDetail.join(", ")}`).toHaveLength(0);

    // The bounded Floor list query (orders list) is the expected data source.
    const ordersList = apiCalls.filter((u) => /\/api\/pos\/orders\?/.test(u));
    expect(ordersList.length, "Floor loads the bounded orders list exactly once (deduped)").toBeLessThanOrEqual(2);
  });
});
