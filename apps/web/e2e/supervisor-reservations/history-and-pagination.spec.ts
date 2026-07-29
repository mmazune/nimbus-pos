import { expect, test } from "@playwright/test";

import { gotoReservations, uiLogin } from "./fixtures";

test.describe("Supervisor Reservations — history & pagination", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
    await page.getByRole("tab", { name: /history/i }).click();
    await expect(page).toHaveURL(/view=history/);
  });

  test("history exposes terminal filters and no active lifecycle actions", async ({ page }) => {
    // Terminal status filter is present.
    await expect(page.getByRole("combobox").first()).toBeVisible();

    // Date range controls exist for history.
    await expect(page.getByLabel(/from/i)).toBeVisible();
    await expect(page.getByLabel(/to/i)).toBeVisible();

    // Selecting the first history row (if any) shows a read-only workspace.
    const firstRow = page.getByRole("region", { name: /reservation views|/ }).locator("button");
    const rows = page.locator("#supervisor-reservation-list-region li button");
    if (await rows.count()) {
      await rows.first().click();
      await expect(page.getByRole("button", { name: /confirm|seat guest|mark visit complete/i })).toHaveCount(0);
    }
    void firstRow;
  });

  test("pagination controls keep view + page state in the URL", async ({ page }) => {
    const next = page.getByRole("button", { name: /^next$/i });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page).toHaveURL(/view=history/);
      await page.reload();
      await expect(page).toHaveURL(/page=2/);
    }
  });
});
