import { expect, test } from "@playwright/test";

import { P4B_MARKER, gotoReservations, shownName, uiLogin } from "./fixtures";

// T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
// The new-booking sheet types the day as 2026-11-26 and the time as 20:30 (kit Fields, no native pickers).
test.describe("Supervisor Reservations — create", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
  });

  test("rejects a missing guest name", async ({ page }) => {
    await page.getByRole("button", { name: "New reservation" }).click();
    const dialog = page.getByRole("dialog", { name: "New reservation" });
    await expect(dialog).toBeVisible();
    const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel(/^day/i).fill(futureDate);
    await dialog.getByLabel(/^time/i).fill("12:00");
    await dialog.getByRole("button", { name: "Create booking" }).click();
    await expect(dialog.getByText("Write the guest's name.")).toBeVisible();
    await expect(dialog).toBeVisible(); // not dismissed
  });

  test("rejects a past time", async ({ page }) => {
    await page.getByRole("button", { name: "New reservation" }).click();
    const dialog = page.getByRole("dialog", { name: "New reservation" });
    await dialog.getByLabel(/guest's name/i).fill(`${P4B_MARKER} Past`);
    await dialog.getByLabel(/^day/i).fill("2000-01-01");
    await dialog.getByLabel(/^time/i).fill("12:00");
    await dialog.getByRole("button", { name: "Create booking" }).click();
    await expect(dialog.getByText("That time has passed.")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("creates a valid reservation and opens its detail", async ({ page }) => {
    const label = `Create ${Date.now()}`;
    const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByRole("button", { name: "New reservation" }).click();
    const dialog = page.getByRole("dialog", { name: "New reservation" });

    await dialog.getByLabel(/guest's name/i).fill(`${P4B_MARKER} ${label}`);
    await dialog.getByLabel(/^guests/i).fill("3");
    await dialog.getByLabel(/^day/i).fill(futureDate);
    await dialog.getByLabel(/^time/i).fill("21:30");
    await dialog.getByRole("button", { name: "Create booking" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: new RegExp(shownName(`${P4B_MARKER} ${label}`).replace(".", "\\."), "i") })).toBeVisible();
    await expect(page).toHaveURL(/id=/);
  });
});
