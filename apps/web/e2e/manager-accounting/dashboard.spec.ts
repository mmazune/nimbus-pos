import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_CARDS,
  ACCOUNTING_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  card,
  digitsOf,
  kpiValue,
  managerLogin,
  waitForAccountingSettled,
} from "./fixtures";

/**
 * Track B5.1 — the Accounting dashboard renders LIVE figures, read-only, from
 * verified endpoints.
 *
 * Runs against the isolated local Docker stack only (never shared Neon).
 */
test.describe("Manager accounting dashboard", () => {
  test("the module root redirects to the dashboard", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.root);
    await page.waitForURL(/\/manager\/accounting\/dashboard/, { timeout: 30_000 });
    expect(page.url()).toContain(ACCOUNTING_ROUTES.dashboard);
  });

  test("all five cards render and none stays in a loading state", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    for (const testId of ACCOUNTING_CARDS) {
      await expect(card(page, testId)).toBeVisible();
    }
    await expect(page.locator("[data-manager-dashboard-card]")).toHaveCount(ACCOUNTING_CARDS.length);
  });

  test("receivable and payable render real money from the aging endpoints", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    // Money, not a placeholder: a currency code and at least one digit.
    const receivable = await kpiValue(page, "ar.outstanding");
    expect(receivable).toMatch(/[A-Z]{3}/);
    expect(digitsOf(receivable).length).toBeGreaterThan(0);

    const payable = await kpiValue(page, "ap.outstanding");
    expect(payable).toMatch(/[A-Z]{3}/);
    expect(digitsOf(payable).length).toBeGreaterThan(0);

    // Both cards draw the aging bar mark from the endpoint's own buckets.
    await expect(card(page, "accounting-receivable").locator("[data-accounting-aging-bars]")).toBeVisible();
    await expect(card(page, "accounting-payable").locator("[data-accounting-aging-bars]")).toBeVisible();

    // The mark is never the only carrier — the same numbers exist as text.
    const svg = card(page, "accounting-payable").locator("svg[role='img']").first();
    await expect(svg.locator("title")).toHaveCount(1);
    await expect(svg.locator("desc")).toHaveCount(1);
  });

  test("the ledger card counts journals and states that no statement exists", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const journals = await kpiValue(page, "ledger.journals");
    expect(digitsOf(journals).length).toBeGreaterThan(0);
    await expect(card(page, "accounting-ledger")).toContainText(/no balance sheet, profit and loss/i);
  });

  test("the fiscal period card names the current period and labels it organisation data", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const periodCard = card(page, "accounting-period");
    await expect(periodCard.locator('[data-accounting-scope="organization"]')).toBeVisible();
    await expect(periodCard.locator("[data-accounting-period-status]")).toBeVisible();
    // PC-07: four states, and Locked is presented as terminal.
    await expect(periodCard).toContainText(/Draft → Open → Closed → Locked/);
    await expect(periodCard).toContainText(/no unlock route/i);
  });

  test("the bank card discloses that its count is not a server total", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const bankCard = card(page, "accounting-bank");
    // Either a live count with the PC-06 disclosure, or the honest empty state.
    const disclosure = bankCard.locator("[data-accounting-unpaginated-note]");
    const empty = bankCard.locator('[data-manager-card-state="empty"]');
    expect((await disclosure.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test("the page states its refresh mode and the missing live stream", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    await expect(page.locator('[data-accounting-stream-state="degraded"]')).toBeVisible();
    await expect(page.locator("[data-accounting-dashboard-status]")).toContainText(/Refreshes every/i);
  });

  test("one load issues a bounded number of branch-scoped GET requests and no console error", async ({
    page,
  }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);

    // Land on the module FIRST, then measure a clean reload. Measuring the
    // navigation itself would fold in the Overview dashboard's own nine reads,
    // which the login landing has already issued — that would be a budget for
    // two pages, not for this one.
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const requests = captureApiRequests(page);
    await page.reload();
    await waitForAccountingSettled(page);
    await page.waitForTimeout(1_500);

    const accountingRequests = requests.filter((request) =>
      /\/api\/(accounting|finance|franchise)\//.test(request.url),
    );
    // Exactly nine dashboard reads. A tenth would mean a card fanned out per row.
    expect(accountingRequests.length).toBe(9);

    for (const request of accountingRequests) {
      expect(request.method).toBe("GET");
      expect(request.branchId).toBeTruthy();
    }

    // Total page budget, shell reads included.
    expect(requests.length).toBeLessThanOrEqual(14);
    expect(errors).toEqual([]);
  });
});
