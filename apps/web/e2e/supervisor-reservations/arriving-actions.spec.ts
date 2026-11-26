import { expect, test } from "@playwright/test";

import {
  apiCreateQaTable,
  apiCreateReservation,
  apiLoginRole,
  gotoReservations,
  openReservationByName,
  uiLogin,
} from "./fixtures";

// T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
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

    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByText("Booking confirmed.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm booking" })).toHaveCount(0);
  });

  test("seat at a free table, and no-show is unavailable once seated", async ({ page }) => {
    const table = await apiCreateQaTable(4);
    const res = await apiCreateReservation({ token, label: `Seat ${Date.now()}`, minutesFromNow: 90 });
    await gotoReservations(page);
    await openReservationByName(page, res.customerName);

    // Confirm first (PENDING → CONFIRMED enables Seat).
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByText("Booking confirmed.").first()).toBeVisible();

    // Seat at the fresh QA table, offered among the free tables that fit.
    const panel = page.locator("[data-res-panel]");
    await panel.getByRole("button", { name: new RegExp(`^${table.label}`) }).click();
    await panel.getByRole("button", { name: /^Seat at / }).click();
    await expect(panel.getByText(/^Seated at /)).toBeVisible();

    // Once SEATED, no-show is not offered; complete is.
    await expect(page.getByRole("button", { name: /no-show/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Complete booking" })).toBeVisible();
  });

  test("cancel requires a reason", async ({ page }) => {
    const res = await apiCreateReservation({ token, label: `Cancel ${Date.now()}`, minutesFromNow: 150 });
    await gotoReservations(page);
    await openReservationByName(page, res.customerName);

    await page.locator("[data-res-panel]").getByRole("button", { name: "Cancel booking" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel booking" });
    const confirm = dialog.getByRole("button", { name: "Cancel booking" });
    await confirm.click();
    await expect(dialog.getByText("Write the reason.")).toBeVisible();
    await dialog.getByLabel(/why is it cancelled/i).fill("QA cancel");
    await confirm.click();
    await expect(page.getByText("Booking cancelled.").first()).toBeVisible();
  });
});
