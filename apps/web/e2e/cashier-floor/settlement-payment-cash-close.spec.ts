import { test, expect, type Page } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import {
  apiBillState,
  apiCashierTillActive,
  apiCreateServedBill,
  apiEnsureCashierShift,
  apiReceiptStatus,
} from "./c3-fixtures";

/** The Settlement section only — History copy also mentions a closed bill. */
function settlementSection(page: Page) {
  return page.locator('section[aria-labelledby="cashier-settlement-actions"]');
}

/**
 * Prompt C3 — full cash payment settles AND closes the bill at the single
 * verified choke point (`POST /pos/orders/:id/close`), and the workspace
 * transitions to a truthful closed state with a receipt in existence.
 *
 * This spec performs a REAL money mutation on a bill it creates itself.
 */
test.describe("Cashier settlement — cash payment and close", () => {
  test("a full cash payment closes the bill and the workspace tells the truth", async ({ page }) => {
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

    // Cash is the default method and the amount prefills to the canonical outstanding.
    const amount = page.locator('input[name="cashierPaymentAmount"]');
    await expect(amount).toBeVisible({ timeout: 20_000 });
    expect(Number(await amount.inputValue())).toBeCloseTo(bill.total, 2);

    const closeButton = page.getByRole("button", { name: /close with cash payment/i });
    await expect(closeButton).toBeEnabled({ timeout: 20_000 });
    await closeButton.click();

    // Terminal state replaces the settlement form once the canonical re-read lands.
    await expect(settlementSection(page).getByText(/This bill is closed\./i)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[name="cashierPaymentAmount"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /close with cash payment/i })).toHaveCount(0);
    await expect(page.getByText(/A receipt exists for this bill/i)).toBeVisible();

    // Canonical backend state — no optimistic UI claim is trusted here.
    const state = await apiBillState(bill.orderId);
    expect(state.status).toBe("CLOSED");
    expect(state.isSettled).toBe(true);
    expect(Number(state.remainingBalance)).toBe(0);
    expect(Number(state.totalPaid)).toBeCloseTo(bill.total, 2);
    expect(state.methods.some((method: string) => method.startsWith("CASH:"))).toBe(true);

    const receipt = await apiReceiptStatus(bill.orderId);
    expect(receipt.status).toBe(200);
    expect(receipt.body?.orderNumber).toBe(bill.orderNumber);
  });
});
