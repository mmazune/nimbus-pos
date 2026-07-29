import { test, expect } from "@playwright/test";
import { uiLogin } from "./fixtures";

test.describe("Cross-role regression (shared shell/Floor not broken by Prompt 3)", () => {
  test("Waiter Floor loads with the Waiter nav (Floor/Reservations/Me)", async ({ page }) => {
    await uiLogin(page, "waiter");
    await page.waitForURL(/\/waiter\/floor/, { timeout: 30_000 });
    for (const label of ["Floor", "Reservations", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("Cashier surfaces load: Queue, Receipts, Till", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/queue/, { timeout: 30_000 });
    for (const [label, path] of [
      ["Receipts", "/cashier/receipts"],
      ["Till", "/cashier/till"],
      ["Queue", "/cashier/queue"],
    ] as const) {
      await page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first().click();
      await page.waitForURL(new RegExp(path.replace("/", "\\/")), { timeout: 20_000 });
      await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
    }
  });
});
