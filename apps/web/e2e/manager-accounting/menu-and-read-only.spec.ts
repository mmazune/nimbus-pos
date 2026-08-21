import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  accountingMenuTrigger,
  isDesktopTopNavViewport,
  managerLogin,
  waitForAccountingSettled,
} from "./fixtures";

/**
 * Track B5.1 — the menu tree opens and navigates, and the whole module is
 * read-only with no write affordance anywhere.
 */
test.describe("Manager accounting menu tree", () => {
  test("the Accounting menu opens and its one live row navigates to the dashboard", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    test.skip(
      !isDesktopTopNavViewport(page),
      "below xl the module bar collapses (OD-4) — the collapsed tree is covered by the row test below",
    );

    await accountingMenuTrigger(page).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // Odoo's groupings, adapted — the headings are not invented.
    for (const heading of ["Customers", "Vendors", "Bank", "Review", "Reporting", "Configuration"]) {
      await expect(menu.getByText(heading, { exact: true })).toBeVisible();
    }

    await menu.getByRole("menuitem", { name: /^Dashboard$/ }).click();
    await page.waitForURL(/\/manager\/accounting\/dashboard/, { timeout: 30_000 });
  });

  test("exactly one row is a link; every other row is inert and phase-tagged", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    test.skip(!isDesktopTopNavViewport(page), "the desktop dropdown only renders at xl and up");

    await accountingMenuTrigger(page).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // Dashboard is the only clickable row in B5.1.
    //
    // Matched on the ANCHOR, not on `getByRole("link")`: every row carries an
    // explicit `role="menuitem"`, which overrides the implicit link role, so a
    // role-based query would find nothing and prove nothing.
    const links = menu.locator('a[role="menuitem"]');
    await expect(links).toHaveCount(1);
    await expect(links).toHaveText(/^Dashboard$/);

    // Every not-yet row carries a real sub-phase tag, and none is an anchor.
    for (const label of ["Invoices", "Bills", "Reconciliation", "Journal entries", "Chart of accounts"]) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
      await expect(menu.locator('a[role="menuitem"]', { hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
    }
    const tags = await menu.getByText(/^B5\.[23456]$/).count();
    expect(tags).toBeGreaterThanOrEqual(20);
  });

  test("surfaces Nimbus cannot back are ABSENT, not greyed out", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    test.skip(!isDesktopTopNavViewport(page), "the desktop dropdown only renders at xl and up");

    await accountingMenuTrigger(page).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // NG-07 → C-11: no financial statement exists on this backend.
    for (const absent of [
      "Balance Sheet",
      "Profit and Loss",
      "Trial Balance",
      "Cash Flow",
      "Partner Ledger",
      "Tax Report",
      // PC-02: Manager is 403 on procurement suggestions, so no row promises them.
      "Procurement suggestions",
      // POST-only endpoints have nothing to list.
      "Receipts",
      "Manual entries",
    ]) {
      await expect(menu.getByText(absent, { exact: true })).toHaveCount(0);
    }
  });
});

test.describe("Manager accounting is read-only", () => {
  test("no create, post, approve or match control renders anywhere on the module", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const content = page.locator("main");
    // Not even a disabled one — the owner's ruling forbids the affordance itself.
    for (const label of [/^new$/i, /^create$/i, /^post$/i, /^approve$/i, /^match$/i, /^upload$/i, /^import$/i]) {
      await expect(content.getByRole("button", { name: label })).toHaveCount(0);
    }
    await expect(content.locator("form")).toHaveCount(0);
    await expect(content.locator("button:disabled")).toHaveCount(0);
  });

  test("the module names what it cannot do instead of hiding it", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const panel = page.locator("[data-accounting-denied-writes]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/read/i);
    await expect(panel).toContainText(/bank reconciliation/i);
    await expect(panel).toContainText(/journal entry/i);
    await expect(panel).toContainText(/fiscal period/i);
  });

  test("the page issues no write request at all", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!/\/api\/(accounting|finance|franchise)\//.test(url)) return;
      methods.push(request.method());
    });

    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);
    await page.waitForTimeout(1_000);

    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((method) => method === "GET")).toBe(true);
  });
});
