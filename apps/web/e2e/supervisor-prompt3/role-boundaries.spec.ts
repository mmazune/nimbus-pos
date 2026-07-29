import { test, expect } from "@playwright/test";
import { uiLogin } from "./fixtures";

test.describe("Cross-role boundaries", () => {
  test("Waiter lands on Waiter Floor with no Supervisor Find order / order actions", async ({ page }) => {
    await uiLogin(page, "waiter");
    await page.waitForURL(/\/waiter\/floor/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /find order/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /transfer table|split bill|approve discount/i })).toHaveCount(0);
  });

  test("Cashier lands on Cashier Queue with the Cashier nav (Queue/Receipts/Till/Me)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/queue/, { timeout: 30_000 });
    for (const label of ["Queue", "Receipts", "Till", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /find order/i })).toHaveCount(0);
  });

  test("Waiter cannot reach the Supervisor Floor workspace (guard blocks with an access-required state)", async ({ page }) => {
    await uiLogin(page, "waiter");
    await page.waitForURL(/\/waiter\/floor/);
    await page.goto("/supervisor/floor");
    // The SupervisorSessionGuard renders an in-place access block (no supervisor workspace).
    await expect(page.getByText(/supervisor access required/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /find order/i })).toHaveCount(0);
  });
});
