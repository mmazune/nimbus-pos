import { expect, test } from "@playwright/test";

import { apiCreateReservation, apiLoginRole, gotoReservations, uiLogin } from "./fixtures";

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

    const row = page.getByRole("button", { name: new RegExp(res.customerName, "i") });
    await expect(row).toBeVisible();
    // Operational copy, never implementation copy.
    await expect(row).toContainText(/overdue/i);
    await expect(page.getByText(/prompt 4a|backend|reconciliation/i)).toHaveCount(0);

    // No bulk resolution controls exist.
    await expect(page.getByRole("button", { name: /resolve all|mark all|complete all/i })).toHaveCount(0);

    // The individual reservation still exposes a real decision (No-show / Cancel).
    await row.click();
    await expect(page.getByRole("button", { name: /mark no-show/i })).toBeVisible();
  });
});
