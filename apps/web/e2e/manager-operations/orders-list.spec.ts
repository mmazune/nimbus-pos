import { expect, test } from "@playwright/test";

import {
  MANAGER_OPERATIONS_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  controlPanel,
  listRows,
  listTable,
  managerLogin,
  waitForApiRequest,
  waitForListSettled,
} from "./fixtures";

/**
 * Track B3 — Operations → Orders.
 *
 * Structure and truthfulness only, never specific figures: the seeded branch's
 * orders change with every run of the Cashier and Supervisor suites, so
 * asserting a total would be a flake rather than a check.
 */
test.describe("Manager Operations — orders list", () => {
  test("renders live branch orders with no console errors", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    await expect(controlPanel(page).getByRole("heading", { name: "Orders" })).toBeVisible();
    await expect(listTable(page)).toBeVisible();
    expect(await listRows(page).count()).toBeGreaterThan(0);

    // The read-only badge is THIS SURFACE's contract, stated on screen — and it
    // lives in the control panel, not in the shell strip, so it cannot appear
    // over a surface that does write (Staff).
    await expect(controlPanel(page).getByText("Read-only oversight")).toBeVisible();
    await expect(page.locator("[data-manager-readiness]").getByText(/read-only/i)).toHaveCount(0);

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("/manager/operations redirects into the orders list", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/operations");
    await page.waitForURL(`**${MANAGER_OPERATIONS_ROUTES.orders}`);
    await waitForListSettled(page);
    await expect(listTable(page)).toBeVisible();
  });

  test("exposes NO checkout, tender, close or void control", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    for (const banned of [
      /take payment/i,
      /collect payment/i,
      /^pay$/i,
      /close order/i,
      /void order/i,
      /split bill/i,
      /add item/i,
      /send to kitchen/i,
    ]) {
      await expect(page.getByRole("button", { name: banned })).toHaveCount(0);
    }
  });

  test("the pager is fed the endpoint's own total, and paginates server-side", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    const pagination = page.getByLabel("Pagination");
    await expect(pagination).toBeVisible();

    const label = await pagination.locator("span").first().innerText();
    // `from-to / total` — the total must exceed the page length whenever the
    // branch has more than one page, which is what proves it is not a row count.
    const match = label.match(/^(\d+)-(\d+)\s*\/\s*(\d+)$/);
    expect(match, `pager label "${label}" is from-to / total`).not.toBeNull();

    const [, from, to, total] = match!.map(Number);
    const rowCount = await listRows(page).count();
    expect(to - from + 1).toBe(rowCount);

    if (total > rowCount) {
      const requests = captureApiRequests(page);
      await pagination.getByRole("button", { name: "Next page" }).click();
      await expect.poll(() => page.url()).toContain("page=2");

      // Wait for the REQUEST, not for the list to "settle": the previous page's
      // rows stay on screen while page 2 is in flight, so a settle check would
      // return before anything had been asked for.
      const pageReads = await waitForApiRequest(requests, /\/api\/pos\/orders\?/);
      expect(pageReads[0].url, "page 2 is a real server read, not a client slice").toContain("page=2");

      await expect.poll(() => pagination.locator("span").first().innerText()).not.toBe(label);
    }
  });

  test("every orders request sends an explicit bounded page size and the branch header", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    const orderReads = requests.filter((request) => /\/api\/pos\/orders\?/.test(request.url));
    expect(orderReads.length).toBeGreaterThan(0);
    for (const request of orderReads) {
      expect(request.url, "an explicit pageSize is always sent (MP0-11)").toMatch(/pageSize=\d+/);
      expect(Number(new URL(request.url).searchParams.get("pageSize"))).toBeLessThanOrEqual(100);
      expect(request.branchId, "every read is branch-scoped").toBeTruthy();
      expect(request.method).toBe("GET");
    }
  });

  test("a status filter is applied server-side and shown as a removable chip", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    await page.getByRole("button", { name: "Filter orders" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Closed" }).click();

    await expect.poll(() => page.url()).toContain("status=CLOSED");

    // The filter reached the API, not just the URL.
    await waitForApiRequest(requests, /\/api\/pos\/orders\?.*status=CLOSED/);

    const chip = page.locator("[data-manager-filter-chip]");
    await expect(chip).toBeVisible();
    await chip.getByRole("button", { name: /Remove filter/ }).click();
    await expect.poll(() => page.url()).not.toContain("status=CLOSED");
  });

  test("the totals row is labelled as a page total, never a branch total", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.orders);
    await waitForListSettled(page);

    await expect(listTable(page).locator("tfoot").getByText("This page")).toBeVisible();
    await expect(page.getByText(/sums the \d+ orders on this page only/i)).toBeVisible();
  });

  test("URL state survives a reload", async ({ page }) => {
    await managerLogin(page);
    await page.goto(`${MANAGER_OPERATIONS_ROUTES.orders}?status=CLOSED&serviceType=DINE_IN`);
    await waitForListSettled(page);
    await expect(page.locator("[data-manager-filter-chip]")).toHaveCount(2);

    await page.reload();
    await waitForListSettled(page);
    await expect(page.locator("[data-manager-filter-chip]")).toHaveCount(2);
  });

  test("an invalid status in the URL fails safe instead of 400-ing the page", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(`${MANAGER_OPERATIONS_ROUTES.orders}?status=NOT_A_REAL_STATUS&page=-3`);
    await waitForListSettled(page);

    await expect(listTable(page)).toBeVisible();
    await expect(page.locator("[data-manager-filter-chip]")).toHaveCount(0);
    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });
});
