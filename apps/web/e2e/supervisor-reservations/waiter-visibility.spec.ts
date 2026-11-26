import { expect, test } from "@playwright/test";

import { P4B_MARKER, gotoReservations, shownName, uiLogin } from "./fixtures";

// Cross-role: a Supervisor-created reservation must be visible to Waiter without
// a full application restart (canonical persistence + narrow invalidation).
test.describe.serial("Supervisor → Waiter visibility", () => {
  test("a Supervisor-created reservation appears in Waiter Reservations", async ({ page }) => {
    const label = `${P4B_MARKER} Waiter ${Date.now()}`;

    // Supervisor creates the reservation. Keep it on TODAY (default date) so it appears in the
    // Waiter's today view, with a late-evening time that is still in the future at run time.
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
    // T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
    await page.getByRole("button", { name: "New reservation" }).click();
    const dialog = page.getByRole("dialog", { name: "New reservation" });
    await dialog.getByLabel(/guest's name/i).fill(label);
    await dialog.getByLabel(/^guests/i).fill("2");
    await dialog.getByLabel(/^time/i).fill("23:59");
    await dialog.getByRole("button", { name: "Create booking" }).click();
    await expect(dialog).toBeHidden();

    // Waiter logs in and sees the same reservation (shown as "P. Waiter …").
    await uiLogin(page, "waiter");
    await page.goto("/waiter/reservations");
    await expect(page.getByText(new RegExp(shownName(label).replace(".", "\\."), "i")).first()).toBeVisible({ timeout: 20_000 });

    // Waiter has no Supervisor-only lifecycle controls on this surface.
    await expect(page.getByRole("button", { name: /mark no-show|cancel reservation/i })).toHaveCount(0);
  });
});
