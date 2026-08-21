import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  MANAGER_CFG,
  branchSwitcher,
  captureBranchHeaders,
  card,
  digitsOf,
  kpiValue,
  managerLogin,
  waitForAccountingSettled,
} from "./fixtures";

/**
 * Track B5.1 — branch re-scoping (the visible proof that backend gap batch 2's
 * PC-03 fix reached the UI) and fail-closed card states.
 */
test.describe("Accounting re-scopes on a branch switch", () => {
  test("switching branch changes X-Branch-Id AND changes the money on screen", async ({ page }) => {
    await managerLogin(page);
    const headers = captureBranchHeaders(page);

    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const firstReceivable = await kpiValue(page, "ar.outstanding");
    const firstPayable = await kpiValue(page, "ap.outstanding");
    const firstJournals = await kpiValue(page, "ledger.journals");
    const firstPeriod = await kpiValue(page, "period.current");

    const beforeCount = headers.length;
    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await expect
      .poll(
        () =>
          headers
            .slice(beforeCount)
            .filter((entry) => entry.branchId === MANAGER_CFG.secondBranchId).length,
        { timeout: 45_000 },
      )
      .toBeGreaterThan(0);
    await waitForAccountingSettled(page);

    // Every accounting read after the switch carries the NEW branch header.
    const afterAccounting = headers
      .slice(beforeCount)
      .filter((entry) => /\/api\/(accounting|finance|franchise)\//.test(entry.url));
    expect(afterAccounting.length).toBeGreaterThan(0);
    for (const entry of afterAccounting) {
      expect(entry.branchId).toBe(MANAGER_CFG.secondBranchId);
    }

    // Branch-scoped figures must actually differ — a header that changes while
    // the number does not would mean the backend is still org-scoped (PC-03).
    const secondReceivable = await kpiValue(page, "ar.outstanding");
    const secondPayable = await kpiValue(page, "ap.outstanding");
    const secondJournals = await kpiValue(page, "ledger.journals");
    expect(digitsOf(secondReceivable)).not.toBe(digitsOf(firstReceivable));
    expect(digitsOf(secondPayable)).not.toBe(digitsOf(firstPayable));
    expect(digitsOf(secondJournals)).not.toBe(digitsOf(firstJournals));

    // ...and the ORGANISATION-level figure must NOT change. That contrast is the
    // whole point of labelling it: fiscal periods have no branch_id column.
    const secondPeriod = await kpiValue(page, "period.current");
    expect(secondPeriod).toBe(firstPeriod);
  });

  test("the branch-scoped cards say 'This branch' and the period card says 'Organisation data'", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    await expect(card(page, "accounting-receivable").locator('[data-accounting-scope="branch"]')).toBeVisible();
    await expect(card(page, "accounting-payable").locator('[data-accounting-scope="branch"]')).toBeVisible();
    await expect(
      card(page, "accounting-period").locator('[data-accounting-scope="organization"]'),
    ).toBeVisible();
  });
});

test.describe("Accounting fails closed", () => {
  test("a 500 on the receivable read shows the error state and NO number", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/ar/aging**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const receivable = card(page, "accounting-receivable");
    await expect(receivable.locator('[data-manager-card-state="error"]')).toBeVisible();
    // Fail-closed: no figure at all, not a stale one and never a zero.
    await expect(receivable.locator('[data-accounting-kpi="ar.outstanding"]')).toHaveCount(0);

    // The footnote must name the RIGHT reason: a failed read, not a partial page.
    await expect(receivable).toContainText(/This read failed/i);
    await expect(receivable).not.toContainText(/more open invoices than/i);

    // One failing endpoint degrades ONE card — the others still render.
    await expect(card(page, "accounting-payable").locator('[data-manager-card-state="ready"]')).toBeVisible();
    await expect(card(page, "accounting-ledger").locator('[data-manager-card-state="ready"]')).toBeVisible();
  });

  test("INVERTED 2026-08-21 (backend gap batch 3): a page carrying fewer invoices than `total` still shows the real balance — B5-F1 is fixed", async ({
    page,
  }) => {
    // This spec used to mock the PRE-FIX bug shape (a page carrying ONE invoice
    // while the server counts NINE — exactly what the live `?take=1` probe
    // produced) and assert the card WITHHELD the balance. Backend gap batch 3
    // fixed `ar/aging.summary` to aggregate a separate unpaginated query, so
    // `summary` is correct regardless of what page `accounts[]` carries — the
    // frontend's completeness gate (`isArAgingComplete`) no longer treats a
    // short page as a reason to withhold. This test is inverted, not deleted,
    // to prove the money now RENDERS instead of vanishing.
    await managerLogin(page);
    await page.route("**/api/accounting/ar/aging**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          asOf: "2026-08-21",
          total: 9,
          skip: 0,
          take: 100,
          summary: {
            current: "0",
            bucket_1_30: "0",
            bucket_31_60: "599800",
            bucket_61_90: "0",
            bucket_90_plus: "0",
            totalOutstanding: "599800",
          },
          accounts: [
            {
              customerAccountId: "c1",
              customerAccountName: "Demo Corporate Account 12",
              totalOutstanding: "599800",
              invoices: [{ invoiceId: "i1", outstandingBalance: "599800" }],
            },
          ],
        }),
      }),
    );

    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const receivable = card(page, "accounting-receivable");
    // No withheld state — the response is well-formed, so the balance renders.
    await expect(receivable.locator('[data-accounting-partial="ar-aging"]')).toHaveCount(0);
    await expect(receivable).not.toContainText(/withheld/i);
    await expect(receivable.locator('[data-accounting-kpi="ar.outstanding"]')).toContainText(
      "599,800",
    );
  });

  test("an empty payable ledger renders the empty state, not UGX 0", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/ap/aging**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          asOf: "2026-08-21T00:00:00.000Z",
          buckets: {
            current: "0",
            days1to30: "0",
            days31to60: "0",
            days61to90: "0",
            days90plus: "0",
            total: "0",
          },
          bySupplier: [],
          billCount: 0,
        }),
      }),
    );

    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const payable = card(page, "accounting-payable");
    await expect(payable.locator('[data-manager-card-state="empty"]')).toBeVisible();
    await expect(payable).toContainText(/no supplier bill/i);
  });
});
