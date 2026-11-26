import { expect, test } from "@playwright/test";

import { gotoReservations, uiLogin } from "./fixtures";

test.describe("Supervisor Reservations — history & pagination", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
    await page.getByRole("tab", { name: /history/i }).click();
    await expect(page).toHaveURL(/view=history/);
  });

  // T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
  // The drawing has no history filters (status, from/to); they were removed and are listed in the T1 report.
  test("history shows finished bookings and no active lifecycle actions", async ({ page }) => {
    const rows = page.getByRole("region", { name: "History" }).getByRole("button");
    if (await rows.count()) {
      await expect(rows.first()).toContainText(/Completed|Cancelled|No-show/);
      await rows.first().click();
      const panel = page.locator("[data-res-panel]");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("button", { name: /Confirm booking|Seat at|Cancel booking|Complete booking|No-show|Change table/ })).toHaveCount(0);
    }
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
