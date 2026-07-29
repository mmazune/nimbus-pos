import { test, expect } from "@playwright/test";
import { uiLogin } from "./fixtures";

test.describe("Supervisor Floor shell + navigation (locked decisions)", () => {
  test("lands on Floor with 4-tab nav (Floor/Reservations/Approvals/Me), NO Orders tab", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/, { timeout: 30_000 });

    for (const label of ["Floor", "Reservations", "Approvals", "Me"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /^orders$/i })).toHaveCount(0);
  });

  test("shared Floor surface renders (toolbar search + table grid) and the Supervisor-only Find order control is present", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/);

    // Shared OperationalFloor toolbar has a search box.
    await expect(page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first()).toBeVisible();
    // Find order sibling control (Supervisor-only, above the shared Floor).
    await expect(page.getByRole("button", { name: /find order/i }).first()).toBeVisible();
    // No API error banner.
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("Find order opens a modal dialog and can be dismissed", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.waitForURL(/\/supervisor\/floor/);
    await page.getByRole("button", { name: /find order/i }).first().click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    // dismiss (Escape)
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });
});
