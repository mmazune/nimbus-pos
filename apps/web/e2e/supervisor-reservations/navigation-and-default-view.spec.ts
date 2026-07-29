import { expect, test } from "@playwright/test";

import { gotoReservations, uiLogin } from "./fixtures";

test.describe("Supervisor Reservations — navigation & default view", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
  });

  test("defaults to Arriving with the four views and no Orders tab", async ({ page }) => {
    await gotoReservations(page);

    // Four canonical views, Arriving selected by default.
    for (const name of [/arriving/i, /seated/i, /attention/i, /history/i]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
    await expect(page.getByRole("tab", { name: /arriving/i })).toHaveAttribute("aria-selected", "true");

    // No "All" fifth view, no Orders navigation.
    await expect(page.getByRole("tab", { name: /^all$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^orders$/i })).toHaveCount(0);

    // Primary create action is present.
    await expect(page.getByRole("button", { name: /create reservation/i })).toBeVisible();
  });

  test("view + selection persist in the URL across reload and Back", async ({ page }) => {
    await gotoReservations(page);
    await page.getByRole("tab", { name: /history/i }).click();
    await expect(page).toHaveURL(/view=history/);

    await page.reload();
    await expect(page.getByRole("tab", { name: /history/i })).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await expect(page).not.toHaveURL(/view=history/);
  });

  test("arriving day navigation updates the date in the URL", async ({ page }) => {
    await gotoReservations(page);
    await page.getByRole("button", { name: /next day/i }).click();
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    await page.getByRole("button", { name: /^today$/i }).click();
    await expect(page).not.toHaveURL(/date=/);
  });
});
