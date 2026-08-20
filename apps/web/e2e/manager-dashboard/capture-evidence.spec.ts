import { expect, test } from "@playwright/test";

import {
  branchSwitcher,
  captureConsoleErrors,
  MANAGER_CFG,
  managerLogin,
  waitForDashboardSettled,
} from "./fixtures";

/**
 * Evidence capture for the Track B2 completion report. Not an assertion suite —
 * it drives the real UI and writes screenshots to the git-ignored evidence dir.
 * Run explicitly: `playwright test e2e/manager-dashboard/capture-evidence.spec.ts --project=vp-1440x900`.
 */
const OUT = "e2e/.evidence/b2-screenshots";

test.describe("Track B2 evidence", () => {
  test("dashboard at 1440x900 and 1280x680", async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);
    await page.screenshot({ path: `${OUT}/01-dashboard-1440x900.png`, fullPage: true });

    await page.setViewportSize({ width: 1280, height: 680 });
    await page.reload();
    await waitForDashboardSettled(page);
    await page.screenshot({ path: `${OUT}/02-dashboard-1280x680.png`, fullPage: true });

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("branch-switched dashboard at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await page.waitForTimeout(2_000);
    await waitForDashboardSettled(page);
    await page.screenshot({ path: `${OUT}/03-dashboard-branch-switched-1440x900.png`, fullPage: true });
  });

  test("a failed card at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await managerLogin(page);
    await page.route("**/api/dash/low-stock**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "QA" }) }),
    );
    await page.route("**/api/hr/leave**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "QA" }) }),
    );
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);
    await page.screenshot({ path: `${OUT}/04-dashboard-card-error-1440x900.png`, fullPage: true });
  });

  test("the recalculate confirmation at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);
    await page.locator("[data-manager-control-panel]").getByRole("button", { name: /recalculate/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: `${OUT}/05-recalculate-confirmation-1440x900.png` });
  });
});
