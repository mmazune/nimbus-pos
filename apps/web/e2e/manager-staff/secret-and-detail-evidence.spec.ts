import { expect, test } from "@playwright/test";

import {
  MANAGER_STAFF_ROUTES,
  captureConsoleErrors,
  listRows,
  managerLogin,
  qaPhone,
  qaStaffName,
  waitForListSettled,
} from "./fixtures";

/**
 * Evidence capture for the two B3 states that only exist mid-flow and so cannot
 * be reached by a plain `page.goto` — the **onboarding one-time-secret step** and
 * a **leave review detail** with the decision actions live.
 *
 * Captured at the two widths the B3 brief names (1440×900 and 1280×680) by
 * resizing explicitly, because 1280×680 is not one of the four viewport projects
 * in `playwright.config.ts`. The project matrix stays the canonical responsive
 * gate; this file only adds the two mid-flow frames.
 *
 * ⚠️ Creates a real staff member. Isolated disposable stack only.
 */
const WIDTHS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x680", width: 1280, height: 680 },
] as const;

test.describe("Manager B3 — mid-flow evidence", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const size of WIDTHS) {
    test(`onboarding one-time secret step at ${size.name}`, async ({ page }) => {
      const errors = captureConsoleErrors(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await managerLogin(page);
      await page.goto(MANAGER_STAFF_ROUTES.onboarding);
      await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible({ timeout: 30_000 });

      const suffix = `${size.width}${String(Date.now()).slice(-4)}`;
      const name = qaStaffName(suffix);
      await page.locator('input[name="firstName"]').fill(name.firstName);
      await page.locator('input[name="lastName"]').fill(name.lastName);
      await page.locator('input[name="phone"]').fill(qaPhone(Number(String(Date.now()).slice(-7))));
      await page.getByRole("button", { name: "Continue" }).click();

      await page.locator('input[name="roleName"][value="Cashier"]').check();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Create staff member" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Create and issue PIN" }).click();

      const secret = page.locator("[data-manager-one-time-secret]");
      await expect(secret).toBeVisible({ timeout: 45_000 });

      // Masked state — the default, and the one worth showing as evidence.
      await page.screenshot({
        path: `e2e/.evidence/manager-b3/mid-flow/${size.name}/onboarding-secret-masked.png`,
        fullPage: true,
      });

      // Revealed state, to prove the reveal affordance exists and is deliberate.
      await secret.getByRole("button", { name: "Reveal" }).click();
      await expect(page.locator("[data-manager-secret-value]")).toHaveAttribute(
        "data-manager-secret-value",
        "revealed",
      );
      await page.screenshot({
        path: `e2e/.evidence/manager-b3/mid-flow/${size.name}/onboarding-secret-revealed.png`,
        fullPage: true,
      });

      expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    });

    test(`leave review detail at ${size.name}`, async ({ page }) => {
      const errors = captureConsoleErrors(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await managerLogin(page);
      await page.goto(`${MANAGER_STAFF_ROUTES.leave}?status=PENDING`);
      await waitForListSettled(page);

      const rowCount = await listRows(page).count();
      test.skip(rowCount === 0, "needs at least one pending leave request");

      await listRows(page).first().click();
      await expect(page.locator("[data-manager-leave-detail]")).toBeVisible({ timeout: 30_000 });
      await page.screenshot({
        path: `e2e/.evidence/manager-b3/mid-flow/${size.name}/leave-review-detail.png`,
        fullPage: true,
      });

      // The confirmation, which is where the no-payroll / no-roster claim is made.
      await page.locator("[data-manager-leave-detail]").getByRole("button", { name: "Approve" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({
        path: `e2e/.evidence/manager-b3/mid-flow/${size.name}/leave-approve-confirmation.png`,
        fullPage: true,
      });
      // Cancel — this spec is for evidence, not for deciding.
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

      expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});
