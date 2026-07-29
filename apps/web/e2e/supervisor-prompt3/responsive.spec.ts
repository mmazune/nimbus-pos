import { test, expect } from "@playwright/test";
import { uiLogin, apiCreateSentOrder, expectNoHorizontalOverflow } from "./fixtures";

// Runs under every viewport project (1024x768, 1366x768, 1440x900, 1920x1080).
test.describe("Responsive viewport matrix — no horizontal overflow, controls reachable", () => {
  test("Supervisor Floor fits the viewport and header + bottom nav are reachable", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("link", { name: /^floor$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /find order/i }).first()).toBeVisible();
  });

  test("Find order dialog stays within the viewport", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/);
    await page.getByRole("button", { name: /find order/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Selected order workspace fits the viewport", async ({ page }) => {
    const { orderId, tableId } = await apiCreateSentOrder();
    await uiLogin(page, "supervisor");
    await page.goto(`/supervisor/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.getByRole("button", { name: /request bill/i }).first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });
});
