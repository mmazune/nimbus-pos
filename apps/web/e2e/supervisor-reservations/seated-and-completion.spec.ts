import { expect, test } from "@playwright/test";

import {
  apiConfirmReservation,
  apiCreateReservation,
  apiFirstAvailableTable,
  apiLoginRole,
  apiSeatReservation,
  gotoReservations,
  openReservationByName,
  uiLogin, shownName } from "./fixtures";

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

    // T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
    await page.getByRole("button", { name: "Complete booking" }).click();
    await expect(page.getByText("Booking completed.").first()).toBeVisible();

    // It leaves Seated and appears in History as COMPLETED.
    await page.getByRole("tab", { name: /seated/i }).click();
    await expect(page.getByRole("button", { name: new RegExp(shownName(res.customerName), "i") })).toHaveCount(0);

    await page.getByRole("tab", { name: /history/i }).click();
    await openReservationByName(page, res.customerName);
    // Assert the terminal read-only state in the detail workspace (unambiguous — avoids the
    // hidden <option>Completed</option> in the terminal-status filter dropdown).
    await expect(page.locator("[data-res-panel]").getByText("Completed", { exact: true })).toBeVisible();
    // Terminal record → no active lifecycle actions.
    await expect(page.getByRole("button", { name: "Complete booking" })).toHaveCount(0);
  });
});
