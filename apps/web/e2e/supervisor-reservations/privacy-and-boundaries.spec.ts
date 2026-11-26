import { expect, test } from "@playwright/test";

import {
  apiCreateReservation,
  apiLoginRole,
  gotoReservations,
  openReservationByName,
  uiLogin,
} from "./fixtures";

test.describe.serial("Supervisor Reservations — privacy & boundaries", () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLoginRole("supervisor");
  });

  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
  });

  test("rows do not expose full phone/email; detail does", async ({ page }) => {
    const phone = "+256700123123";
    const res = await apiCreateReservation({ token, label: `Privacy ${Date.now()}`, minutesFromNow: 100 });
    void phone;

    await gotoReservations(page);
    // T1 (26 Nov 2026): the Reservations screen was rebuilt to the drawing Reservations-Supervisor; same endpoints and transitions.
    // The list must not render a raw email address or the phone.
    const listRegion = page.getByRole("region", { name: "Arriving" });
    await expect(listRegion.getByText(/@/)).toHaveCount(0);
    await expect(listRegion.getByText("+256700000000")).toHaveCount(0);

    // The phone appears only in the selected booking's panel.
    await openReservationByName(page, res.customerName);
    await expect(page.locator("[data-res-panel]").getByText("+256700000000")).toBeVisible();
  });

  test("no out-of-scope surfaces (payment, deposit recording, order close)", async ({ page }) => {
    await gotoReservations(page);
    await expect(page.getByRole("button", { name: /collect payment|record deposit|close order/i })).toHaveCount(0);
    // No Orders navigation returns.
    await expect(page.getByRole("link", { name: /^orders$/i })).toHaveCount(0);
  });
});
