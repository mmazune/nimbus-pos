import { test, expect, type Page } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import {
  apiBillState,
  apiCashierTillActive,
  apiCreateServedBill,
  apiEnsureCashierShift,
} from "./c3-fixtures";

/** The Settlement section only — History copy also mentions a closed bill. */
function settlementSection(page: Page) {
  return page.locator('section[aria-labelledby="cashier-settlement-actions"]');
}

/**
 * Prompt C3 — partial payment + remaining balance.
 *
 * A manual/stub reference payment for less than the total leaves the bill OPEN
 * and partially paid with a canonical remaining balance (never an optimistic
 * total); the remainder is then settled with cash, which closes the bill.
 *
 * REAL money mutations on a bill this spec creates itself.
 */
test.describe("Cashier settlement — partial payment then remainder", () => {
  test("a partial reference payment leaves a canonical remaining balance that cash then closes", async ({ page }) => {
    test.slow();
    const shiftReady = await apiEnsureCashierShift();
    const tillReady = await apiCashierTillActive();
    test.skip(!shiftReady || !tillReady, "cashier shift/till readiness unavailable on this stack");

    const bill = await apiCreateServedBill();
    test.skip(!bill, "could not build a SERVED QA bill on this stack");
    if (!bill) return;

    const partial = Math.floor(bill.total / 2);
    const remainder = Number((bill.total - partial).toFixed(2));
    const reference = `C3-PW-${Date.now()}`;

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${bill.tableId}&orderId=${bill.orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    // Card is a split-tender (partial-capable) manual reference method.
    await page.locator('label:has-text("Card")').first().click();
    await page.locator('input[name="cashierPaymentAmount"]').fill(String(partial));
    await page.locator('input[name="cashierPaymentReference"]').fill(reference);
    await page.getByRole("button", { name: /record card reference/i }).click();

    // Canonical remaining balance is re-read, not inferred.
    await expect(page.getByText(/^Partially paid$/i).first()).toBeVisible({ timeout: 30_000 });
    const midState = await apiBillState(bill.orderId);
    expect(midState.status).toBe("SERVED");
    expect(midState.isSettled).toBe(false);
    expect(Number(midState.totalPaid)).toBeCloseTo(partial, 2);
    expect(Number(midState.remainingBalance)).toBeCloseTo(remainder, 2);

    // The cash amount now prefills to the remaining balance only.
    const amount = page.locator('input[name="cashierPaymentAmount"]');
    await page.locator('label:has-text("Cash")').first().click();
    await expect(amount).toBeVisible();
    await expect
      .poll(async () => Number(await amount.inputValue()), { timeout: 20_000 })
      .toBeCloseTo(remainder, 2);

    await page.getByRole("button", { name: /close with cash payment/i }).click();
    await expect(settlementSection(page).getByText(/This bill is closed\./i)).toBeVisible({ timeout: 30_000 });

    const finalState = await apiBillState(bill.orderId);
    expect(finalState.status).toBe("CLOSED");
    expect(finalState.isSettled).toBe(true);
    expect(Number(finalState.remainingBalance)).toBe(0);
    expect(Number(finalState.totalPaid)).toBeCloseTo(bill.total, 2);
    expect(finalState.methods.length).toBe(2);
  });
});
