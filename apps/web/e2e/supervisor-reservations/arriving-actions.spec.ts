import { expect, test } from "@playwright/test";

import {
  apiCreateReservation,
  apiLoginRole,
  gotoReservations,
  openReservationByName,
  uiLogin,
} from "./fixtures";

// Lifecycle mutations share table/reservation state → serialise.
test.describe.serial("Supervisor Reservations — arriving actions", () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLoginRole("supervisor");
  });

  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
  });

  test("confirm a PENDING reservation", async ({ page }) => {
    const res = await apiCreateReservation({ token, label: `Confirm ${Date.now()}`, minutesFromNow: 120 });
    await gotoReservations(page);
    await openReservationByName(page, res.customerName);

    await page.getByRole("button", { name: /^confirm$/i }).click();
    const dialog = page.getByRole("dialog", { name: /confirm this reservation/i });
    await dialog.getByRole("button", { name: /confirm reservation/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(/reservation confirmed/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(res.customerName, "i") })).toBeVisible();
  });

  test("assign a table then seat, and confirm no-show is unavailable once seated", async ({ page }) => {
    const res = await apiCreateReservation({ token, label: `Seat ${Date.now()}`, minutesFromNow: 90 });
    await apiLoginRole("supervisor");
    await gotoReservations(page);
    await openReservationByName(page, res.customerName);

    // Confirm first (PENDING → CONFIRMED enables Seat).
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /confirm reservation/i }).click();
    await expect(page.getByText(/reservation confirmed/i).first()).toBeVisible();

    // Seat via the seat dialog's table selector.
    await page.getByRole("button", { name: /seat guest/i }).click();
    const seatDialog = page.getByRole("dialog", { name: /seat this guest/i });
    await seatDialog.getByRole("radio").nth(1).click();
    await seatDialog.getByRole("button", { name: /seat guest/i }).click();
    await expect(page.getByText(/guest seated/i).first()).toBeVisible();

    // Once SEATED, no-show is not offered; complete is.
    await expect(page.getByRole("button", { name: /mark no-show/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /mark visit complete/i })).toBeVisible();
  });

  test("cancel requires a reason", async ({ page }) => {
    const res = await apiCreateReservation({ token, label: `Cancel ${Date.now()}`, minutesFromNow: 150 });
    await gotoReservations(page);
    await openReservationByName(page, res.customerName);

    await page.getByRole("button", { name: /^cancel$/i }).click();
    const dialog = page.getByRole("dialog", { name: /cancel this reservation/i });
    const confirm = dialog.getByRole("button", { name: /cancel reservation/i });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/cancellation reason/i).fill("QA cancel");
    await confirm.click();
    await expect(page.getByText(/reservation cancelled/i).first()).toBeVisible();
  });
});
