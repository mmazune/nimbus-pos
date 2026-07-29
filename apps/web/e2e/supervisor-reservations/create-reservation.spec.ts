import { expect, test } from "@playwright/test";

import { P4B_MARKER, gotoReservations, uiLogin } from "./fixtures";

test.describe.serial("Supervisor Reservations — create", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
  });

  test("rejects a past time and a missing guest name", async ({ page }) => {
    await page.getByRole("button", { name: /create reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /create reservation/i });
    await expect(dialog).toBeVisible();

    // Empty name + past time → cannot submit.
    await dialog.getByLabel(/date/i).fill("2000-01-01");
    await dialog.getByRole("button", { name: /create reservation/i }).click();
    await expect(dialog.getByText(/fix the highlighted fields/i)).toBeVisible();
    await expect(dialog).toBeVisible(); // not dismissed
  });

  test("creates a valid reservation and opens its detail", async ({ page }) => {
    const label = `Create ${Date.now()}`;
    await page.getByRole("button", { name: /create reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /create reservation/i });

    await dialog.getByLabel(/guest name/i).fill(`${P4B_MARKER} ${label}`);
    await dialog.getByLabel(/party size/i).fill("3");
    // Date defaults to the current operational date; set a clearly future time.
    await dialog.getByLabel(/^time/i).fill("21:30");

    const submit = dialog.getByRole("button", { name: /create reservation/i });
    // Prevent duplicate submissions — the button disables while pending.
    await submit.click();

    await expect(dialog).toBeHidden();
    // New reservation is selected and its workspace shows the marked name.
    await expect(page.getByRole("heading", { name: new RegExp(label, "i") })).toBeVisible();
    await expect(page).toHaveURL(/selected=/);
  });
});
