import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/** Prompt 5B1 must not regress the Prompt 3 Floor or Prompt 4 Reservations surfaces. */
test.describe("Approvals — Prompt 3 / Prompt 4 regression", () => {
  test("Floor still loads with no Orders tab", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/floor");
    await expect(page).toHaveURL(/\/supervisor\/floor/);
    await expect(page.locator("body")).toBeVisible();
    expect(await page.getByRole("link", { name: /^orders$/i }).count()).toBe(0);
  });

  test("Reservations still loads with the Arriving view", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/reservations");
    await expect(page).toHaveURL(/\/supervisor\/reservations/);
    await expect(page.getByRole("tab", { name: /arriving/i })).toBeVisible();
  });

  test("Waiter has no Approvals access", async ({ page }) => {
    await uiLogin(page, "waiter");
    expect(await page.getByRole("link", { name: /approvals/i }).count()).toBe(0);
  });
});
