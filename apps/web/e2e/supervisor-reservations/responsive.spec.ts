import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, gotoReservations, uiLogin } from "./fixtures";

// Runs under all four viewport projects from playwright.config.ts.
test.describe("Supervisor Reservations — responsive", () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoReservations(page);
  });

  test("no horizontal overflow across views", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
    for (const name of [/seated/i, /attention/i, /history/i]) {
      await page.getByRole("tab", { name }).click();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the create dialog fits within the viewport", async ({ page }) => {
    await page.getByRole("button", { name: /create reservation/i }).click();
    await expect(page.getByRole("dialog", { name: /create reservation/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("bottom navigation does not cover the primary action", async ({ page }) => {
    const create = page.getByRole("button", { name: /create reservation/i });
    await expect(create).toBeVisible();
    const box = await create.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    if (box && viewport) {
      expect(box.y).toBeLessThan(viewport.height);
    }
  });
});
