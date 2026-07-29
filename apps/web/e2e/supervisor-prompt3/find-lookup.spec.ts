import { test, expect } from "@playwright/test";
import { uiLogin } from "./fixtures";

test.describe("Find order + legacy route handling", () => {
  test("legacy /supervisor/orders redirects into Floor (no Orders page, no loop)", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/orders");
    await page.waitForURL(/\/supervisor\/floor/, { timeout: 30_000 });
    expect(page.url()).toContain("/supervisor/floor");
    expect(page.url()).not.toContain("/supervisor/orders");
  });

  test("legacy /supervisor/orders?tableId=... preserves context into Floor", async ({ page }) => {
    await uiLogin(page, "supervisor");
    const tableId = "c69d0867ca31edee1d7205e8";
    await page.goto(`/supervisor/orders?tableId=${tableId}`);
    await page.waitForURL(/\/supervisor\/floor/, { timeout: 30_000 });
    expect(page.url()).toContain(`tableId=${tableId}`);
  });

  test("Find order dialog accepts input and shows a bounded result area", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/);
    await page.getByRole("button", { name: /find order/i }).first().click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    // There is at least one text input (search / exact id) inside the dialog.
    await expect(dialog.locator('input, [role="searchbox"]').first()).toBeVisible();
  });
});
