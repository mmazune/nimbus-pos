import { expect, test } from "@playwright/test";

import {
  apiConfirmReservation,
  apiCreateReservation,
  apiFirstAvailableTable,
  apiLoginRole,
  apiSeatReservation,
  gotoReservations,
  openReservationByName,
  uiLogin,
} from "./fixtures";

test.describe.serial("Supervisor Reservations — seated & manual completion", () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLoginRole("supervisor");
  });

  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
  });

  test("manual complete moves a SEATED reservation to History", async ({ page }) => {
    // Seat a reservation via API (no linked order — completion must still work).
    const res = await apiCreateReservation({ token, label: `Complete ${Date.now()}`, minutesFromNow: 30 });
    await apiConfirmReservation(token, res.id);
    const tableId = await apiFirstAvailableTable(token);
    await apiSeatReservation(token, res.id, tableId);

    await gotoReservations(page);
    await page.getByRole("tab", { name: /seated/i }).click();
    await openReservationByName(page, res.customerName);

    await page.getByRole("button", { name: /mark visit complete/i }).click();
    const dialog = page.getByRole("dialog", { name: /mark visit complete/i });
    // Truthful: does not close an order or collect payment.
    await expect(dialog.getByText(/does not/i)).toBeVisible();
    await dialog.getByRole("button", { name: /mark complete/i }).click();

    await expect(page.getByText(/visit completed/i)).toBeVisible();

    // It leaves Seated and appears in History as COMPLETED.
    await page.getByRole("tab", { name: /seated/i }).click();
    await expect(page.getByRole("button", { name: new RegExp(res.customerName, "i") })).toHaveCount(0);

    await page.getByRole("tab", { name: /history/i }).click();
    await openReservationByName(page, res.customerName);
    await expect(page.getByText(/completed/i).first()).toBeVisible();
    // Terminal record → no active lifecycle actions.
    await expect(page.getByRole("button", { name: /mark visit complete/i })).toHaveCount(0);
  });
});
