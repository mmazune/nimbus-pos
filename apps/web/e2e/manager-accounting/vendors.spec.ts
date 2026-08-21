import { test, expect } from "@playwright/test";

import {
  AP_BILL_STATUS_VALUES,
  ACCOUNTING_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  listFilterOption,
  listFilterTrigger,
  listRows,
  listTable,
  managerLogin,
  statusPipeline,
  waitForApiRequest,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.2 — Manager Accounting → Vendors (AP): Bills, Suppliers, Credit
 * notes, Payments, Recurring profiles, Reminders. Frontend-only, strictly
 * READ-ONLY (PC-01/PC-02) — mirrors `customers.spec.ts`'s AR coverage.
 *
 * Runs against the isolated local Docker stack only (never shared Neon).
 */
test.describe("Manager accounting — Vendors", () => {
  test("bills list renders live rows, the status filter narrows and never sends an invalid value", async ({
    page,
  }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.vendorBills);
    await waitForManagerListSettled(page);

    await expect(listTable(page)).toBeVisible();
    const rowCount = await listRows(page).count();
    expect(rowCount).toBeGreaterThan(0);
    const firstRowText = (await listRows(page).first().textContent()) || "";
    expect(firstRowText).toMatch(/[A-Z]{2,3}\s?[\d,]+/);

    await listFilterTrigger(page, "Filter bills").click();
    await listFilterOption(page, "Approved").click();

    await waitForApiRequest(requests, /\/api\/accounting\/ap\/bills\?.*status=APPROVED/);
    await expect.poll(() => page.url()).toContain("status=APPROVED");
    await waitForManagerListSettled(page);

    const filteredCount = await listRows(page).count();
    if (filteredCount > 0) {
      await expect(listRows(page).first()).toContainText(/Approved/i);
    } else {
      await expect(page.getByRole("heading", { name: /^No /i })).toBeVisible();
    }

    // AP's status set includes OVERDUE, which AR's InvoiceStatus does not have
    // (batch 3 `@IsEnum` on `ap/bills?status=`) — assert every captured
    // request stays inside that set.
    const billRequests = requests.filter((request) => /\/api\/accounting\/ap\/bills(\?|$)/.test(request.url));
    expect(billRequests.length).toBeGreaterThan(0);
    for (const request of billRequests) {
      const status = new URL(request.url).searchParams.get("status");
      if (status) expect(AP_BILL_STATUS_VALUES as readonly string[]).toContain(status);
    }
  });

  test("clicking a bill row opens the detail with its lifecycle pipeline", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.vendorBills);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no bills seeded on this branch");

    const firstId = await listRows(page).first().getAttribute("data-manager-list-row");
    await listRows(page).first().click();

    await waitForApiRequest(requests, /\/api\/accounting\/ap\/bills\/[^/?]+(\?|$)/);
    await expect.poll(() => page.url()).toContain("billId=");
    if (firstId) expect(page.url()).toContain(firstId);
    await waitForManagerListSettled(page);

    await expect(statusPipeline(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "Bills" })).toBeVisible();
  });

  test("suppliers list renders live rows and the detail shows the summary + recent bills/payments shape", async ({
    page,
  }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.vendorSuppliers);
    await waitForManagerListSettled(page);

    await expect(listTable(page)).toBeVisible();
    const rowCount = await listRows(page).count();
    expect(rowCount).toBeGreaterThan(0);

    const firstId = await listRows(page).first().getAttribute("data-manager-list-row");
    await listRows(page).first().click();

    // Unlike bills/invoices, `GET /ap/suppliers/:id` is NOT a flat record — it
    // returns `{supplier, summary, recentBills, recentPayments}` — so this
    // detail deliberately has no `ManagerStatusPipeline` (no lifecycle enum on
    // a supplier record). Assert the SHAPE lands instead.
    await waitForApiRequest(requests, /\/api\/accounting\/ap\/suppliers\/[^/?]+(\?|$)/);
    await expect.poll(() => page.url()).toContain("supplierId=");
    if (firstId) expect(page.url()).toContain(firstId);
    await waitForManagerListSettled(page);

    const main = page.locator("main");
    await expect(main.getByText("Summary", { exact: true })).toBeVisible();
    await expect(main.getByText("Outstanding", { exact: true })).toBeVisible();
    await expect(main.getByText("Billed", { exact: true })).toBeVisible();
    await expect(main.getByText("Paid", { exact: true })).toBeVisible();

    // Recent bills/payments tables render regardless of whether this supplier
    // has any — a crash-free render is the assertion, not a non-empty count.
    await expect(main.getByText(/^Recent bills/)).toBeVisible();
    await expect(main.getByText(/^Recent payments/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Suppliers" })).toBeVisible();
  });

  for (const surface of [
    { name: "credit notes", route: ACCOUNTING_ROUTES.vendorCreditNotes, emptyHeading: /No credit notes/i },
    { name: "payments", route: ACCOUNTING_ROUTES.vendorPayments, emptyHeading: /No payments/i },
    { name: "recurring profiles", route: ACCOUNTING_ROUTES.vendorRecurringProfiles, emptyHeading: /No recurring profiles/i },
    { name: "reminders", route: ACCOUNTING_ROUTES.vendorReminders, emptyHeading: /No reminders/i },
  ]) {
    test(`${surface.name} list renders without a crash — live rows or an honest empty state`, async ({ page }) => {
      await managerLogin(page);
      const errors = captureConsoleErrors(page);
      await page.goto(surface.route);
      await waitForManagerListSettled(page);

      // These four returned `total: 0` on the reference dataset (route
      // registry `observed` notes) — an empty dataset here is the expected
      // shape, not a test failure, so either state is accepted.
      await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
      const hasTable = (await listTable(page).count()) > 0;
      const hasEmptyState = (await page.getByRole("heading", { name: /^No /i }).count()) > 0;
      expect(hasTable || hasEmptyState).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test("a mocked 500 on the bills read fails closed with no crash", async ({ page }) => {
    await managerLogin(page);
    // "Failed to load resource" is Chromium's own console entry for the
    // mocked 500, not evidence of an app crash — see the identical note in
    // `customers.spec.ts`.
    const errors = captureConsoleErrors(page);
    await page.route("**/api/accounting/ap/bills**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.vendorBills);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
    await expect(page.getByText(/could not be read/i)).toBeVisible();
    await expect(listTable(page)).toHaveCount(0);
    expect(errors.filter((message) => !/Failed to load resource/.test(message))).toEqual([]);
  });

  test("zero console errors and a small, GET-only, accounting-scoped request budget for the bills list", async ({
    page,
  }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.vendorBills);
    await waitForManagerListSettled(page);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);

    const requests = captureApiRequests(page);
    await page.reload();
    await waitForManagerListSettled(page);
    await page.waitForTimeout(1_500);

    const accountingRequests = requests.filter((request) =>
      /\/api\/(accounting|finance|franchise)\//.test(request.url),
    );
    expect(accountingRequests.length).toBeGreaterThan(0);
    expect(accountingRequests.length).toBeLessThanOrEqual(5);
    for (const request of accountingRequests) {
      expect(request.method).toBe("GET");
    }
  });
});
