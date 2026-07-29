import { expect, test } from "@playwright/test";

import { P4B_MARKER, gotoReservations, uiLogin } from "./fixtures";

// Cross-role: a Supervisor-created reservation must be visible to Waiter without
// a full application restart (canonical persistence + narrow invalidation).
test.describe.serial("Supervisor → Waiter visibility", () => {
  test("a Supervisor-created reservation appears in Waiter Reservations", async ({ page }) => {
    const label = `${P4B_MARKER} Waiter ${Date.now()}`;

    // Supervisor creates the reservation.
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
    await page.getByRole("button", { name: /create reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /create reservation/i });
    await dialog.getByLabel(/guest name/i).fill(label);
    await dialog.getByLabel(/party size/i).fill("2");
    await dialog.getByLabel(/^time/i).fill("20:15");
    await dialog.getByRole("button", { name: /create reservation/i }).click();
    await expect(dialog).toBeHidden();

    // Waiter logs in and sees the same reservation.
    await uiLogin(page, "waiter");
    await page.goto("/waiter/reservations");
    await expect(page.getByText(new RegExp(label, "i"))).toBeVisible({ timeout: 20_000 });

    // Waiter has no Supervisor-only lifecycle controls on this surface.
    await expect(page.getByRole("button", { name: /mark no-show|cancel reservation/i })).toHaveCount(0);
  });
});
