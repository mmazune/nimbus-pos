import { expect, test } from "@playwright/test";

import {
  MANAGER_REPORTS_ROUTES,
  UNAVAILABLE_GENERATOR,
  captureApiRequests,
  captureConsoleErrors,
  listTable,
  managerLogin,
  reportForm,
  waitForListSettled,
} from "./fixtures";

/**
 * Track B4 — the report catalog.
 *
 * The catalog is the surface where an untruth would be cheapest to ship: 37
 * entries, only 24 of which this backend can actually run. These specs prove the
 * availability split comes from the API and that an unavailable report offers no
 * way to run it.
 */
test.describe("Manager Reports — catalog", () => {
  test.beforeEach(async ({ page }) => {
    await managerLogin(page);
  });

  test("renders all 37 catalog entries with no console errors", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await page.goto(MANAGER_REPORTS_ROUTES.catalog);
    await waitForListSettled(page);

    await expect(listTable(page)).toBeVisible();
    const rows = listTable(page).locator("tbody tr");
    await expect(rows).toHaveCount(37);

    // The split is the API's, not a number typed into the UI.
    await expect(page.getByText(/publishes 37 reports/)).toBeVisible();
    await expect(page.getByText(/24 can be generated now/)).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("/manager/reports redirects into the catalog", async ({ page }) => {
    await page.goto("/manager/reports");
    await expect(page).toHaveURL(new RegExp(`${MANAGER_REPORTS_ROUTES.catalog}$`));
  });

  test("the catalog read is bounded to one branch-scoped request", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.catalog);
    await waitForListSettled(page);
    const requests = captureApiRequests(page);
    await page.reload();
    await waitForListSettled(page);

    const catalogReads = requests.filter((request) => request.url.includes("/api/reports/catalog"));
    expect(catalogReads.length).toBe(1);
    expect(catalogReads[0].branchId).toBeTruthy();
    expect(catalogReads[0].method).toBe("GET");
  });

  test("a category filter narrows the list and shows a removable chip", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?category=${encodeURIComponent("Inventory")}`);
    await waitForListSettled(page);

    const rows = listTable(page).locator("tbody tr");
    await expect(rows).toHaveCount(3); // STOCK_VARIANCE, WASTAGE_SUMMARY, LOW_STOCK
    await expect(page.locator("[data-manager-filter-chip]")).toContainText("Inventory");

    await page.getByRole("button", { name: /Remove filter Inventory/i }).click();
    await expect(rows).toHaveCount(37);
  });

  test("search narrows the catalog client-side", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?q=cash`);
    await waitForListSettled(page);

    const rows = listTable(page).locator("tbody tr");
    // CASH_VARIANCE + CASH_MOVEMENTS + CASH_FLOW
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText(/Cash/i);
  });

  test("an unavailable report offers NO way to generate it", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=${UNAVAILABLE_GENERATOR}`);

    // The reason is the API's own dependency milestone, not a generic message.
    const reason = page.locator("[data-manager-report-unavailable]");
    await expect(reason).toBeVisible();
    await expect(reason).toContainText(/M30/);
    await expect(reason).toContainText(/no generator/i);

    // No form, and not a disabled button either — the control is absent.
    await expect(reportForm(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /generate/i })).toHaveCount(0);

    // And nothing was posted on its behalf.
    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toEqual([]);
  });

  test("an unavailable report advertises no export format", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?q=payroll`);
    await waitForListSettled(page);

    const row = listTable(page).locator("tbody tr").first();
    await expect(row).toContainText("Not yet available");
    // The catalog says `['CSV']` for it, but a format badge would promise a
    // download that cannot exist.
    await expect(row).not.toContainText("CSV");
  });

  test("an invalid report key in the URL falls back to the list", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=../../etc/passwd`);
    await waitForListSettled(page);
    await expect(listTable(page)).toBeVisible();
    await expect(listTable(page).locator("tbody tr")).toHaveCount(37);
  });

  test("no PDF control exists anywhere on the catalog", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.catalog);
    await waitForListSettled(page);

    const controls = await page.locator("button, a").allTextContents();
    expect(controls.filter((text) => /pdf/i.test(text))).toEqual([]);
  });

  test("the catalog advertises no graph or pivot view", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.catalog);
    await waitForListSettled(page);

    const body = (await page.locator("main").innerText()).toLowerCase();
    expect(body).not.toContain("pivot");
    expect(body).not.toContain("graph view");
  });
});
