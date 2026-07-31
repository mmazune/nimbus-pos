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

  // Prompt C1: Cashier is now Floor-first. It lands on /cashier/floor with nav
  // Floor/Till/Me; Queue and Receipts are hidden compatibility routes reachable
  // only by direct URL (retired in C4/C5), not shell links.
  test("Cashier surfaces load: Floor (default) + Till nav, Queue/Receipts by direct URL", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/, { timeout: 30_000 });
    for (const label of ["Floor", "Till", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /^queue$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^receipts$/i })).toHaveCount(0);
    // Compatibility routes still load directly without regression.
    for (const path of ["/cashier/queue", "/cashier/receipts", "/cashier/till"]) {
      await page.goto(path);
      await page.waitForURL(new RegExp(path.replace(/\//g, "\\/")), { timeout: 20_000 });
      await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
    }
  });
});
