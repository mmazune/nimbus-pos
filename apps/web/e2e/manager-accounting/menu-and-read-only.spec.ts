import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_AVAILABLE_MENU_KEYS,
  ACCOUNTING_ROUTES,
  accountingMenuTrigger,
  isDesktopTopNavViewport,
  managerLogin,
  waitForAccountingSettled,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.1 (menu shell) + B5.2 (Customers/Vendors/Reporting surfaces) — the
 * menu tree opens and navigates, and the whole module is read-only with no
 * write affordance anywhere.
 *
 * ⚠️ 2026-08-21: B5.2 promoted 11 rows from not-yet to available (Invoices,
 * Customer accounts, Credit notes ×2, Bills, Payments, Suppliers, Recurring
 * profiles, Payment reminders, Aged receivable, Aged payable), joining the
 * B5.1 Dashboard for 12 available rows. B5.3 (same day) promoted the 3 Bank
 * rows (Bank accounts, Bank statements, Reconciliation) — 15 total. B5.4
 * (same day) promoted exactly the four rows `lib/accounting/menu.ts` already
 * tagged "B5.4" since B5.1 — Journal entries, Posting runs, Posting errors,
 * Audit trail — 19 total. Track B5.5 promoted the exact two rows the menu
 * tree already tagged "B5.5" — Fiscal periods, Period close runs —
 * **21 available rows total**. The assertions below are UPDATED (not
 * relaxed) to the new count, and the "which rows are still inert" checks
 * were re-picked from labels B5.2/B5.3/B5.4/B5.5 did NOT touch.
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

  test("all twenty-eight rows are links; the menu tree has no inert row left", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    test.skip(!isDesktopTopNavViewport(page), "the desktop dropdown only renders at xl and up");

    await accountingMenuTrigger(page).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // B5.2 (2026-08-21) promoted 11 rows from not-yet to available, joining
    // the B5.1 Dashboard for 12; B5.3 (same day) promoted the 3 Bank rows —
    // 15; B5.4 (same day) promoted the 4 rows the menu tree already tagged
    // "B5.4" since B5.1 (Journal entries, Posting runs, Posting errors, Audit
    // trail) — 19; B5.5 (same day) promoted the 2 rows the menu tree already
    // tagged "B5.5" (Fiscal periods, Period close runs) — 21; B5.6
    // (2026-08-22) promoted the LAST 7 rows the menu tree already tagged
    // "B5.6" (Budgets vs actuals, Demand calendar, Forecast, Chart of
    // accounts, Cost centres, Posting source maps, Tax configuration) — **28
    // total, every row in the tree**. Every one cites a live-verified
    // endpoint in `ACCOUNTING_ROUTE_REGISTRY` via `lib/accounting/menu.ts`.
    //
    // Matched on the ANCHOR, not on `getByRole("link")`: every row carries an
    // explicit `role="menuitem"`, which overrides the implicit link role, so a
    // role-based query would find nothing and prove nothing.
    const links = menu.locator('a[role="menuitem"]');
    await expect(links).toHaveCount(ACCOUNTING_AVAILABLE_MENU_KEYS.length);
    // In menu order — note "Credit notes" appears twice (Customers AND
    // Vendors each carry their own credit-note surface). The Bank group sits
    // BEFORE "Accounting"/"Review" in the tree, and within "Accounting",
    // Fiscal periods / Period close runs land AFTER Journal entries and
    // BEFORE Posting runs. B5.6's three Reporting rows land AFTER Aged
    // payable; its four Configuration rows are last — menu.ts's own row
    // order, not appended arbitrarily.
    await expect(links).toHaveText([
      "Dashboard",
      "Invoices",
      "Customer accounts",
      "Credit notes",
      "Bills",
      "Payments",
      "Credit notes",
      "Suppliers",
      "Recurring profiles",
      "Payment reminders",
      "Bank accounts",
      "Bank statements",
      "Reconciliation",
      "Journal entries",
      "Fiscal periods",
      "Period close runs",
      "Posting runs",
      "Posting errors",
      "Audit trail",
      "Aged receivable",
      "Aged payable",
      "Budgets vs actuals",
      "Demand calendar",
      "Forecast",
      "Chart of accounts",
      "Cost centres",
      "Posting source maps",
      "Tax configuration",
    ]);

    // INVERTED 2026-08-22 (Track B5.6): the tree had 7 inert B5.6-tagged rows
    // through B5.5; B5.6 promoted every one of them, so there is nothing left
    // to be tagged with any sub-phase — a "not-yet" row here would now be the
    // drift this gate exists to catch.
    await expect(menu.getByText(/^B5\.\d$/)).toHaveCount(0);
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

  test("INVERTED (Track B5.7) — the module names what it still cannot do; bank reconciliation and fiscal periods are no longer on that list, because they are real now", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const panel = page.locator("[data-accounting-denied-writes]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/read/i);
    // Still genuinely denied (B5.2 AR/AP writes, journal CREATE, posting replay).
    await expect(panel).toContainText(/vendor bill/i);
    await expect(panel).toContainText(/customer invoice/i);
    await expect(panel).toContainText(/journal entry/i);
    await expect(panel).toContainText(/posting run/i);
    // No longer denied — Track B5.7 surfaced both for real. Asserting their
    // ABSENCE here is the inverse of the pre-B5.7 assertion, not a deletion.
    await expect(panel).not.toContainText(/match, skip or complete a bank reconciliation/i);
    await expect(panel).not.toContainText(/open, close or lock a fiscal period/i);
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

/**
 * B5.2 (2026-08-21) — the same read-only guarantees, re-proven on the eleven
 * new Customers/Vendors/Reporting surfaces, not just the B5.1 dashboard.
 * These are ADDITIONAL tests, not a relaxation of the ones above: the
 * dashboard's own "no write request" / "no forbidden control" specs are
 * untouched.
 */
const B5_2_SURFACES = [
  ACCOUNTING_ROUTES.customerInvoices,
  ACCOUNTING_ROUTES.customerAccounts,
  ACCOUNTING_ROUTES.customerCreditNotes,
  ACCOUNTING_ROUTES.vendorBills,
  ACCOUNTING_ROUTES.vendorSuppliers,
  ACCOUNTING_ROUTES.vendorCreditNotes,
  ACCOUNTING_ROUTES.vendorPayments,
  ACCOUNTING_ROUTES.vendorRecurringProfiles,
  ACCOUNTING_ROUTES.vendorReminders,
  ACCOUNTING_ROUTES.agedReceivable,
  ACCOUNTING_ROUTES.agedPayable,
] as const;

test.describe("Manager accounting is read-only on the B5.2 Customers/Vendors/Reporting surfaces", () => {
  test("no create, post, approve or match control renders on any B5.2 list/report surface", async ({ page }) => {
    await managerLogin(page);

    for (const route of B5_2_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);

      const content = page.locator("main");
      for (const label of [/^new$/i, /^create$/i, /^post$/i, /^approve$/i, /^match$/i, /^upload$/i, /^import$/i]) {
        await expect(content.getByRole("button", { name: label })).toHaveCount(0);
      }
      await expect(content.locator("form")).toHaveCount(0);
      // ⚠️ Deliberately NOT the dashboard test's blanket `button:disabled`
      // count-0 check: these list surfaces legitimately render a disabled
      // Previous-page pager button on page 1 (`hasPrevious: false`) and a
      // disabled Next-page button when the whole dataset fits on one page —
      // real navigational state, not a write affordance the owner's ruling
      // bans. The forbidden-label loop above is the actual write-affordance
      // check and it is NOT relaxed.
    }
  });

  test("every B5.2 surface issues GET-only accounting-scoped requests", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      // Same route-glob the dashboard spec above uses — already covers
      // `/api/accounting/ar/*` and `/api/accounting/ap/*`, so no narrowing
      // was needed, only broader page coverage.
      if (!/\/api\/(accounting|finance|franchise)\//.test(url)) return;
      methods.push(request.method());
    });

    for (const route of B5_2_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);
      await page.waitForTimeout(500);
    }

    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((method) => method === "GET")).toBe(true);
  });
});
