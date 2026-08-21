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

  test("exactly twenty-one rows are links; every other row is inert and phase-tagged", async ({ page }) => {
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
    // tagged "B5.5" (Fiscal periods, Period close runs) — 21 total. Every one
    // cites a live-verified endpoint in `ACCOUNTING_ROUTE_REGISTRY` via
    // `lib/accounting/menu.ts`.
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
    // BEFORE Posting runs — menu.ts's own row order, not appended at the end.
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
    ]);

    // Every not-yet row carries a real sub-phase tag, and none is an anchor.
    // Re-picked from labels B5.2/B5.3/B5.4/B5.5 did NOT touch (Fiscal periods/
    // Period close runs moved to the available list above, so they can no
    // longer appear here).
    for (const label of ["Chart of accounts", "Cost centres", "Tax configuration"]) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
      await expect(menu.locator('a[role="menuitem"]', { hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
    }
    // Exactly 7 inert rows remain (28 total − 21 available), one tag each,
    // and none is tagged B5.3/B5.4/B5.5 any more — all three sub-phases shipped.
    const tags = await menu.getByText(/^B5\.6$/).count();
    expect(tags).toBe(7);
    await expect(menu.getByText("B5.3", { exact: true })).toHaveCount(0);
    await expect(menu.getByText("B5.4", { exact: true })).toHaveCount(0);
    await expect(menu.getByText("B5.5", { exact: true })).toHaveCount(0);
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
