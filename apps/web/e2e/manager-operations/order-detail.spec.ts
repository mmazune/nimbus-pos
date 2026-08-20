import { expect, test } from "@playwright/test";

import {
  MANAGER_OPERATIONS_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  listRows,
  managerLogin,
  waitForListSettled,
} from "./fixtures";

async function openFirstOrder(page: import("@playwright/test").Page) {
  await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
  await waitForListSettled(page);
  await listRows(page).first().click();
  await expect.poll(() => page.url()).toContain("orderId=");
  await expect(page.getByRole("heading", { name: /Totals/i })).toBeVisible({ timeout: 30_000 });
}

test.describe("Manager Operations — order record (read-only C5 form)", () => {
  test("opens a read-only record with breadcrumb, pipeline, lines and totals", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await openFirstOrder(page);

    await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();
    await expect(page.locator("[data-manager-status-pipeline]")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Order lines/i })).toBeVisible();
    await expect(page.getByText("Total (tax-inclusive)")).toBeVisible();
    await expect(page.getByText("This record is read-only")).toBeVisible();

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("offers no action that would change the order", async ({ page }) => {
    await managerLogin(page);
    await openFirstOrder(page);

    for (const banned of [
      /take payment/i,
      /collect payment/i,
      /close order/i,
      /void/i,
      /discount/i,
      /refund/i,
      /mark served/i,
      /request bill/i,
      /transfer/i,
      /merge/i,
      /^split/i,
      /reset to draft/i,
    ]) {
      await expect(page.getByRole("button", { name: banned })).toHaveCount(0);
    }
  });

  test("the record pager walks the current page of the list", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount < 2, "needs at least two orders on the page");

    await listRows(page).first().click();
    const pager = page.getByLabel("Record pagination");
    await expect(pager).toBeVisible();
    await expect(pager.locator("span").first()).toHaveText(`1 / ${rowCount}`);

    await pager.getByRole("button", { name: "Next record" }).click();
    await expect(pager.locator("span").first()).toHaveText(`2 / ${rowCount}`);
  });

  test("the breadcrumb returns to the list", async ({ page }) => {
    await managerLogin(page);
    await openFirstOrder(page);
    await page.getByRole("link", { name: "Orders" }).first().click();
    // Wait for the NAVIGATION, not for a list to settle: the record view already
    // renders a line table, so a settle check resolves before the route changes.
    await page.waitForURL((url) => !url.search.includes("orderId="), { timeout: 30_000 });
    await waitForListSettled(page);
    await expect(page.locator("[data-manager-list-table]")).toBeVisible();
    expect(page.url()).not.toContain("orderId=");
  });

  test("a selected order costs exactly one extra request", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    const requests = captureApiRequests(page);
    await listRows(page).first().click();
    await expect(page.getByRole("heading", { name: /Totals/i })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_000);

    const detailReads = requests.filter((request) => /\/api\/pos\/orders\/[^?]+$/.test(request.url));
    expect(detailReads.length, "one detail read per selection").toBe(1);
    expect(detailReads[0].branchId, "the detail read is branch-scoped").toBeTruthy();

    // MP0-01 / owner decision: the employee detail route is never used, and no
    // extra fan-out (payments, refunds, receipts) happens on selection.
    expect(requests.filter((request) => /\/api\/hr\/employees\//.test(request.url))).toHaveLength(0);
    expect(requests.filter((request) => /\/refunds|\/receipts|\/payments/.test(request.url))).toHaveLength(0);
  });

  test("an orderId from another branch fails safe", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(`${MANAGER_OPERATIONS_ROUTES.orders}?orderId=definitely-not-a-real-order-id`);

    await expect(page.getByText("Order unavailable")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Back to orders" })).toBeVisible();
    // A failed read must never paint a fabricated record.
    await expect(page.getByText("Total (tax-inclusive)")).toHaveCount(0);
    expect(errors.filter((entry) => !/Failed to load resource/.test(entry))).toEqual([]);
  });
});
