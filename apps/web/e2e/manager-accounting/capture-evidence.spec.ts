import { test } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  MANAGER_CFG,
  accountingMenuTrigger,
  branchSwitcher,
  isDesktopTopNavViewport,
  managerLogin,
  waitForAccountingSettled,
} from "./fixtures";

/**
 * Screenshot evidence for the B5.1 QA index. Not assertions — these exist so the
 * four required views can be VIEWED rather than described.
 */
const DIR = "e2e/.evidence/manager-accounting";

test.describe("B5.1 evidence", () => {
  test("dashboard", async ({ page }, testInfo) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    await page.screenshot({ path: `${DIR}/${testInfo.project.name}-01-dashboard.png`, fullPage: true });
  });

  test("menu tree open", async ({ page }, testInfo) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    test.skip(!isDesktopTopNavViewport(page), "the desktop dropdown only renders at xl and up");
    await accountingMenuTrigger(page).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${testInfo.project.name}-02-menu-open.png` });
  });

  test("card error state", async ({ page }, testInfo) => {
    await managerLogin(page);
    await page.route("**/api/accounting/ar/aging**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    await page.screenshot({ path: `${DIR}/${testInfo.project.name}-03-card-error.png`, fullPage: true });
  });

  test("branch-switched dashboard", async ({ page }, testInfo) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await page.waitForTimeout(1_500);
    await waitForAccountingSettled(page);
    await page.screenshot({
      path: `${DIR}/${testInfo.project.name}-04-branch-switched.png`,
      fullPage: true,
    });
  });
});

/**
 * The QA matrix's second review size, 1280×680 — just below the `xl` (1280px)
 * collapse threshold in HEIGHT but at it in width, which is where the five-card
 * grid is tightest. `test.use` overrides the project viewport so this runs once
 * per project at a fixed size; it is pinned to a single project below so the
 * same four files are not written four times.
 */
test.describe("B5.1 evidence at 1280x680", () => {
  test.use({ viewport: { width: 1280, height: 680 } });

  test("dashboard and menu at the review size", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "vp-1440x900",
      "captured once — the viewport is fixed by test.use, so other projects would rewrite identical files",
    );
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    await page.screenshot({ path: `${DIR}/1280x680-01-dashboard.png`, fullPage: true });

    await accountingMenuTrigger(page).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/1280x680-02-menu-open.png` });

    await page.keyboard.press("Escape");
    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await page.waitForTimeout(1_500);
    await waitForAccountingSettled(page);
    await page.screenshot({ path: `${DIR}/1280x680-04-branch-switched.png`, fullPage: true });
  });

  test("card error state at the review size", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "vp-1440x900", "captured once");
    await managerLogin(page);
    await page.route("**/api/accounting/ar/aging**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    await page.screenshot({ path: `${DIR}/1280x680-03-card-error.png`, fullPage: true });
  });
});
