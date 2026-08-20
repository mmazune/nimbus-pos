import { test, expect, type Page } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";
import { apiBillState, apiCreateServedBill, apiEnsureCashierShift } from "./c3-fixtures";

/** The Settlement section only — History copy also mentions a closed bill. */
function settlementSection(page: Page) {
  return page.locator('section[aria-labelledby="cashier-settlement-actions"]');
}

/**
 * Prompt C3 — settlement fails CLOSED.
 *
 * 1. An unresolved payment summary blocks every money action and is never
 *    rendered as unpaid or zero-due.
 * 2. A terminal (closed) bill offers no settlement control at all.
 * 3. A bill that is not in a closable backend state says so instead of offering
 *    a close that would 409.
 */
test.describe("Cashier settlement — fail closed", () => {
  test("an unavailable payment summary blocks payment and split without claiming unpaid", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    await page.route(`**/api/pos/orders/${orderId}/payments`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Simulated payment summary outage", statusCode: 500 }),
      }),
    );

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    // Fail-closed classification, not "unpaid".
    await expect(page.getByText(/State unavailable/i).first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/not shown as paid or unpaid/i)).toBeVisible();
    await expect(page.getByText(/^Settled$/i)).toHaveCount(0);

    // Both money surfaces are blocked with a truthful reason.
    await expect(page.getByText(/Payment summary must load before payment entry/i)).toBeVisible();
    await expect(page.getByText(/Payment summary must load before split or resolution actions/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /close with cash payment/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^save split$/i })).toBeDisabled();
  });

  test("a closed bill exposes no settlement control", async ({ page }) => {
    test.slow();
    const shiftReady = await apiEnsureCashierShift();
    test.skip(!shiftReady, "cashier shift readiness unavailable on this stack");
    const bill = await apiCreateServedBill();
    test.skip(!bill, "could not build a SERVED QA bill on this stack");
    if (!bill) return;

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${bill.tableId}&orderId=${bill.orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });
    const closeButton = page.getByRole("button", { name: /close with cash payment/i });
    await expect(closeButton).toBeEnabled({ timeout: 20_000 });
    await closeButton.click();
    await expect(settlementSection(page).getByText(/This bill is closed\./i)).toBeVisible({ timeout: 30_000 });

    // Re-open the same (now terminal) bill from a cold URL — still no controls.
    await page.goto(`/cashier/floor?orderId=${bill.orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });
    await expect(settlementSection(page).getByText(/This bill is closed\./i)).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('input[name="cashierPaymentAmount"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /close with cash payment/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^save split$/i })).toHaveCount(0);

    expect((await apiBillState(bill.orderId)).status).toBe("CLOSED");
  });

  test("a non-SERVED bill states the cash-close precondition instead of offering it", async ({ page }) => {
    const shiftReady = await apiEnsureCashierShift();
    test.skip(!shiftReady, "cashier shift readiness unavailable on this stack");
    // apiCreateBill leaves the order in SENT — payable, but not closable.
    const { orderId, tableId } = await apiCreateBill();

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    await expect(page.getByText(/Cash close is available only when the backend order status is Served/i)).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole("button", { name: /close with cash payment/i })).toBeDisabled();
  });
});
