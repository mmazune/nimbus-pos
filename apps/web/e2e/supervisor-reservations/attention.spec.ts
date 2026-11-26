import { expect, test } from "@playwright/test";

import { apiCreateReservation, apiLoginRole, gotoReservations, uiLogin, shownName } from "./fixtures";

test.describe.serial("Supervisor Reservations — attention", () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLoginRole("supervisor");
  });

  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
  });

  test("an overdue PENDING reservation surfaces in Attention with an operational reason", async ({ page }) => {
    // Scheduled well in the past (> 15 min grace) → server marks it overdue.
    const res = await apiCreateReservation({ token, label: `Overdue ${Date.now()}`, minutesFromNow: -60 });

    await gotoReservations(page);
    await page.getByRole("tab", { name: /attention/i }).click();

    // T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
    const row = page.getByRole("button", { name: new RegExp(shownName(res.customerName), "i") });
    await expect(row).toBeVisible();
    // Operational copy, never implementation copy.
    await expect(row).toContainText(/late/i);
    await expect(page.getByText(/prompt 4a|backend|reconciliation/i)).toHaveCount(0);

    // No bulk resolution controls exist.
    await expect(page.getByRole("button", { name: /resolve all|mark all|complete all/i })).toHaveCount(0);

    // The individual reservation still exposes a real decision (No-show / Cancel).
    await row.click();
    await expect(page.getByRole("button", { name: /^no-show$/i })).toBeVisible();
  });
});
