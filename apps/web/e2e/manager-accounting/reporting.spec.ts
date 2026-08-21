import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  MANAGER_CFG,
  branchSwitcher,
  captureBranchHeaders,
  digitsOf,
  kpiValue,
  managerLogin,
  managerPager,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.2 — Manager Accounting → Reporting: Aged receivable, Aged
 * payable. Full-page counterparts to the B5.1 dashboard cards, over the SAME
 * `ar.aging`/`ap.aging` routes — the cross-check below is the specific proof
 * the B5.2 brief asked for.
 *
 * Runs against the isolated local Docker stack only (never shared Neon).
 */
test.describe("Manager accounting — Reporting (aging)", () => {
  test("aged receivable renders the headline KPI, an aging-bar mark and a by-customer breakdown", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.agedReceivable);
    await waitForManagerListSettled(page);

    const receivable = await kpiValue(page, "ar.outstanding");
    expect(receivable).toMatch(/[A-Z]{3}/);
    expect(digitsOf(receivable).length).toBeGreaterThan(0);

    await expect(page.locator("[data-accounting-aging-bars]")).toBeVisible();
    const svg = page.locator("[data-accounting-aging-bars] svg[role='img']");
    await expect(svg.locator("title")).toHaveCount(1);
    await expect(svg.locator("desc")).toHaveCount(1);

    await expect(page.getByText("Receivable by customer", { exact: true })).toBeVisible();
  });

  test("aged payable renders the headline KPI, an aging-bar mark and a by-supplier breakdown", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.agedPayable);
    await waitForManagerListSettled(page);

    const payable = await kpiValue(page, "ap.outstanding");
    expect(payable).toMatch(/[A-Z]{3}/);
    expect(digitsOf(payable).length).toBeGreaterThan(0);

    await expect(page.locator("[data-accounting-aging-bars]")).toBeVisible();
    const svg = page.locator("[data-accounting-aging-bars] svg[role='img']");
    await expect(svg.locator("title")).toHaveCount(1);
    await expect(svg.locator("desc")).toHaveCount(1);

    await expect(page.getByText("Payable by supplier", { exact: true })).toBeVisible();
  });

  test("the aged receivable and aged payable headlines match the B5.1 dashboard cards for the same branch", async ({
    page,
  }) => {
    await managerLogin(page);

    // Capture the dashboard's own figures first — the B5.1 card and the B5.2
    // report read the SAME `ar.aging`/`ap.aging` endpoints, so the two must
    // agree exactly for one branch. This is the specific cross-check the
    // B5.2 brief asked for.
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForManagerListSettled(page);
    const dashboardReceivable = digitsOf(await kpiValue(page, "ar.outstanding"));
    const dashboardPayable = digitsOf(await kpiValue(page, "ap.outstanding"));
    expect(dashboardReceivable.length).toBeGreaterThan(0);
    expect(dashboardPayable.length).toBeGreaterThan(0);

    await page.goto(ACCOUNTING_ROUTES.agedReceivable);
    await waitForManagerListSettled(page);
    const reportReceivable = digitsOf(await kpiValue(page, "ar.outstanding"));
    expect(reportReceivable).toBe(dashboardReceivable);

    await page.goto(ACCOUNTING_ROUTES.agedPayable);
    await waitForManagerListSettled(page);
    const reportPayable = digitsOf(await kpiValue(page, "ap.outstanding"));
    expect(reportPayable).toBe(dashboardPayable);
  });

  test("switching branch re-scopes the aged receivable headline to a different balance", async ({ page }) => {
    await managerLogin(page);
    const headers = captureBranchHeaders(page);

    await page.goto(ACCOUNTING_ROUTES.agedReceivable);
    await waitForManagerListSettled(page);
    const firstReceivable = digitsOf(await kpiValue(page, "ar.outstanding"));

    const beforeCount = headers.length;
    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await expect
      .poll(
        () =>
          headers.slice(beforeCount).filter((entry) => entry.branchId === MANAGER_CFG.secondBranchId).length,
        { timeout: 45_000 },
      )
      .toBeGreaterThan(0);
    await waitForManagerListSettled(page);

    const secondReceivable = digitsOf(await kpiValue(page, "ar.outstanding"));
    // Different branch, different balance — the number itself is not
    // asserted (it can legitimately change again as the seed evolves), only
    // that re-scoping actually changed it (PC-03's visible proof, same as
    // the B5.1 dashboard's branch-switch spec).
    expect(secondReceivable).not.toBe(firstReceivable);
  });

  test("neither aging report renders a pager — both are full-branch, unpaginated reads", async ({ page }) => {
    await managerLogin(page);

    await page.goto(ACCOUNTING_ROUTES.agedReceivable);
    await waitForManagerListSettled(page);
    await expect(managerPager(page)).toHaveCount(0);

    await page.goto(ACCOUNTING_ROUTES.agedPayable);
    await waitForManagerListSettled(page);
    await expect(managerPager(page)).toHaveCount(0);
  });
});
