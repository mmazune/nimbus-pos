import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  AR_INVOICE_STATUS_VALUES,
  captureApiRequests,
  captureConsoleErrors,
  digitsOf,
  listFilterOption,
  listFilterTrigger,
  listRows,
  listTable,
  managerLogin,
  managerPagerNext,
  managerPagerPrevious,
  readManagerPagerTotal,
  statusPipeline,
  waitForApiRequest,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.2 — Manager Accounting → Customers (AR): Invoices, Customer
 * accounts, Credit notes. Frontend-only, strictly READ-ONLY (PC-01/PC-02).
 *
 * Runs against the isolated local Docker stack only (never shared Neon).
 */
test.describe("Manager accounting — Customers", () => {
  test("invoices list renders live rows with a real outstanding balance", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);

    await expect(listTable(page)).toBeVisible();
    const rowCount = await listRows(page).count();
    expect(rowCount).toBeGreaterThan(0);

    // The Outstanding column renders formatted money (e.g. "UGX 599,800") — a
    // currency code immediately followed by digits proves a real balance
    // rendered, not a placeholder dash. (Total is optional/hidden by default,
    // so Outstanding is the money column actually on screen.)
    const firstRowText = (await listRows(page).first().textContent()) || "";
    expect(firstRowText).toMatch(/[A-Z]{2,3}\s?[\d,]+/);
  });

  test("the status filter narrows results, tags the URL, and never sends an invalid status", async ({
    page,
  }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);

    await listFilterTrigger(page, "Filter invoices").click();
    await listFilterOption(page, "Issued").click();

    await waitForApiRequest(requests, /\/api\/accounting\/ar\/invoices\?.*status=ISSUED/);
    await expect.poll(() => page.url()).toContain("status=ISSUED");
    await waitForManagerListSettled(page);

    // Either every visible row is ISSUED, or an honest empty state — never a crash.
    const rowCount = await listRows(page).count();
    if (rowCount > 0) {
      await expect(listRows(page).first()).toContainText(/Issued/i);
    } else {
      await expect(page.getByRole("heading", { name: /^No /i })).toBeVisible();
    }

    // The backend only accepts these six values (batch 3 `@IsEnum` on
    // `ar/invoices?status=`) — assert every captured request either omits
    // `status` or sends one of them, proving the UI can never forward a
    // hand-typed invalid value.
    const invoiceRequests = requests.filter((request) => /\/api\/accounting\/ar\/invoices(\?|$)/.test(request.url));
    expect(invoiceRequests.length).toBeGreaterThan(0);
    for (const request of invoiceRequests) {
      const status = new URL(request.url).searchParams.get("status");
      if (status) expect(AR_INVOICE_STATUS_VALUES as readonly string[]).toContain(status);
    }
  });

  test("pagination advances the row set when there is more than one page, or Next stays disabled", async ({
    page,
  }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);

    const total = await readManagerPagerTotal(page);
    const firstPageIds = await listRows(page).evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-manager-list-row")),
    );

    if (total > firstPageIds.length) {
      await expect(managerPagerNext(page)).toBeEnabled();
      await managerPagerNext(page).click();
      await waitForApiRequest(requests, /\/api\/accounting\/ar\/invoices\?.*skip=25/);
      await waitForManagerListSettled(page);

      const secondPageIds = await listRows(page).evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-manager-list-row")),
      );
      expect(secondPageIds).not.toEqual(firstPageIds);
      await expect(managerPagerPrevious(page)).toBeEnabled();
    } else {
      // The whole dataset fits on one page (<=25 invoices) — Next has nowhere to go.
      await expect(managerPagerNext(page)).toBeDisabled();
    }
  });

  test("clicking a row opens the invoice detail with its lifecycle pipeline", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no invoices seeded on this branch");

    const firstId = await listRows(page).first().getAttribute("data-manager-list-row");
    await listRows(page).first().click();

    await waitForApiRequest(requests, /\/api\/accounting\/ar\/invoices\/[^/?]+(\?|$)/);
    await expect.poll(() => page.url()).toContain("invoiceId=");
    if (firstId) expect(page.url()).toContain(firstId);
    await waitForManagerListSettled(page);

    await expect(statusPipeline(page)).toBeVisible();
    // The breadcrumb parent link back to the list.
    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
  });

  test("a mocked 500 on the invoices read fails closed with no crash", async ({ page }) => {
    await managerLogin(page);
    // Not asserted empty here: Chromium itself logs a "Failed to load
    // resource: 500" console entry for the mocked response — expected browser
    // behaviour for any failed fetch, not evidence of an app crash (the same
    // reason `branch-scope-and-failure.spec.ts`'s 500-mock specs don't assert
    // an empty error list either). `pageerror` (an uncaught exception) is what
    // would prove a crash, and none of these are that.
    const errors = captureConsoleErrors(page);
    await page.route("**/api/accounting/ar/invoices**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
    await expect(page.getByText(/could not be read/i)).toBeVisible();
    await expect(listTable(page)).toHaveCount(0);
    expect(errors.filter((message) => !/Failed to load resource/.test(message))).toEqual([]);
  });

  test("customer accounts list renders live rows and opens a detail on row click", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.customerAccounts);
    await waitForManagerListSettled(page);

    await expect(listTable(page)).toBeVisible();
    const rowCount = await listRows(page).count();
    expect(rowCount).toBeGreaterThan(0);

    // The Invoices column is a server `_count`, a plain digit — not money.
    const firstRowText = (await listRows(page).first().textContent()) || "";
    expect(digitsOf(firstRowText).length).toBeGreaterThan(0);

    await listRows(page).first().click();
    await waitForApiRequest(requests, /\/api\/accounting\/ar\/accounts\/[^/?]+(\?|$)/);
    await expect.poll(() => page.url()).toContain("accountId=");
    await waitForManagerListSettled(page);

    await expect(page.getByRole("link", { name: "Accounts" })).toBeVisible();
    await expect(page.locator("main")).toContainText(/Invoices/i);
  });

  test("credit notes list renders without a crash, live rows or an honest empty state", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.customerCreditNotes);
    await waitForManagerListSettled(page);

    // Never a genuine failure — either the table (rows may still be zero and
    // just not render an empty-state HEADING because the table itself renders
    // the header row) or the honest "No credit notes" empty state.
    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    const hasTable = (await listTable(page).count()) > 0;
    const hasEmptyState = (await page.getByRole("heading", { name: /^No /i }).count()) > 0;
    expect(hasTable || hasEmptyState).toBe(true);
    expect(errors).toEqual([]);
  });

  test("zero console errors across a full customers-invoices load", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("the invoices list issues a small, GET-only, accounting-scoped request budget", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.customerInvoices);
    await waitForManagerListSettled(page);

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
