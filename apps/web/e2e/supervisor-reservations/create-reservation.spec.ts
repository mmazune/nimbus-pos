import { expect, test } from "@playwright/test";

import { P4B_MARKER, gotoReservations, uiLogin } from "./fixtures";

test.describe.serial("Supervisor Reservations — create", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
  });

  test("rejects a missing guest name", async ({ page }) => {
    await page.getByRole("button", { name: /create reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /create reservation/i });
    await expect(dialog).toBeVisible();

    // The date input has a native `min={today}` constraint, so a past date is blocked by the
    // browser itself before the app's own onSubmit validation ever runs. Use a valid future
    // date/time here so the empty-guest-name case exercises the app's own field validation.
    const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel(/date/i).fill(futureDate);
    await dialog.getByLabel(/^time/i).fill("12:00");
    await dialog.getByRole("button", { name: "Create reservation", exact: true }).click();
    // The dialog renders per-field inline errors (role="alert"), not a summary banner.
    await expect(dialog.getByText(/guest name is required/i)).toBeVisible();
    await expect(dialog).toBeVisible(); // not dismissed
  });

  test("rejects a past time via the native date-input constraint", async ({ page }) => {
    await page.getByRole("button", { name: /create reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /create reservation/i });
    await expect(dialog).toBeVisible();

    const dateInput = dialog.getByLabel(/date/i);
    await dateInput.fill("2000-01-01");
    await dialog.getByRole("button", { name: "Create reservation", exact: true }).click();
    // Native HTML5 constraint validation (min={today}) blocks submission — the browser reports
    // the field invalid and the dialog is never dismissed.
    await expect(dateInput).toHaveJSProperty("validity.valid", false);
    await expect(dialog).toBeVisible();
  });

  test("creates a valid reservation and opens its detail", async ({ page }) => {
    const label = `Create ${Date.now()}`;
    // Use tomorrow so the time is always in the future regardless of the wall clock
    // (a hardcoded time-of-day would be rejected as "in the past" late in the day).
    const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByRole("button", { name: /create reservation/i }).click();
    const dialog = page.getByRole("dialog", { name: /create reservation/i });

    await dialog.getByLabel(/guest name/i).fill(`${P4B_MARKER} ${label}`);
    await dialog.getByLabel(/party size/i).fill("3");
    await dialog.getByLabel(/date/i).fill(futureDate);
    await dialog.getByLabel(/^time/i).fill("21:30");

    const submit = dialog.getByRole("button", { name: "Create reservation", exact: true });
    // Prevent duplicate submissions — the button disables while pending.
    await submit.click();

    await expect(dialog).toBeHidden();
    // New reservation is selected and its workspace shows the marked name.
    await expect(page.getByRole("heading", { name: new RegExp(label, "i") })).toBeVisible();
    await expect(page).toHaveURL(/selected=/);
  });
});
