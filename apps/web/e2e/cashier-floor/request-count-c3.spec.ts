import { test, expect, type Page } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCashierTillActive, apiCreateServedBill, apiEnsureCashierShift } from "./c3-fixtures";

/** The Settlement section only — History copy also mentions a closed bill. */
function settlementSection(page: Page) {
  return page.locator('section[aria-labelledby="cashier-settlement-actions"]');
}

/**
 * Prompt C3 — the post-mutation refresh stays NARROW.
 *
 * After a settlement mutation the workspace may re-read only:
 *   - the mutation itself,
 *   - the two canonical money reads for THIS bill (detail + payments),
 *   - the bounded table-bill list for THIS table,
 *   - the shared Floor snapshot (tables + active orders + reservations),
 *   - shift/till readiness.
 * Nothing else — no queue sweep, no receipts/refunds list, no menu/profile, and
 * no request storm.
 */
const ALLOWED = [
  /\/api\/pos\/orders\/[^/]+\/close$/,
  /\/api\/pos\/orders\/[^/]+$/,
  /\/api\/pos\/orders\/[^/]+\/payments$/,
  /\/api\/pos\/orders\?/,
  /\/api\/tables$/,
  /\/api\/reservations\?/,
  /\/api\/shifts\/active$/,
  /\/api\/tills\/active$/,
];

const FORBIDDEN = [
  /\/api\/receipts/,
  /\/api\/refunds/,
  /\/api\/pos\/refunds/,
  /\/api\/menu/,
  /\/api\/auth\/me/,
];

test.describe("Cashier settlement request budget (C3)", () => {
  test("a close mutation triggers only narrow, bounded re-reads", async ({ page }) => {
    test.slow();
    const shiftReady = await apiEnsureCashierShift();
    const tillReady = await apiCashierTillActive();
    test.skip(!shiftReady || !tillReady, "cashier shift/till readiness unavailable on this stack");

    const bill = await apiCreateServedBill();
    test.skip(!bill, "could not build a SERVED QA bill on this stack");
    if (!bill) return;

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${bill.tableId}&orderId=${bill.orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("button", { name: /close with cash payment/i })).toBeEnabled({ timeout: 20_000 });

    const seen: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/")) seen.push(url);
    });

    await page.getByRole("button", { name: /close with cash payment/i }).click();
    await expect(settlementSection(page).getByText(/This bill is closed\./i)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_500);

    const unexpected = seen.filter((url) => !ALLOWED.some((pattern) => pattern.test(url)));
    expect(unexpected, `unexpected requests after close:\n${unexpected.join("\n")}`).toEqual([]);

    for (const pattern of FORBIDDEN) {
      expect(seen.filter((url) => pattern.test(url)), `forbidden domain hit: ${pattern}`).toEqual([]);
    }

    // One mutation + a bounded refresh set. Generous ceiling, but far below a storm.
    expect(seen.length, `request count after close: ${seen.length}\n${seen.join("\n")}`).toBeLessThanOrEqual(16);
    expect(seen.filter((u) => /\/close$/.test(u)).length, "exactly one close call").toBe(1);
  });
});
