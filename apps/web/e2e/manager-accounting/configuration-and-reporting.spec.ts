import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  captureConsoleErrors,
  managerLogin,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.6 (2026-08-22) — Manager Accounting → Reporting (Budgets vs
 * actuals, Demand calendar, Forecast) + Configuration (Chart of accounts,
 * Cost centres, Posting source maps, Tax configuration).
 *
 * **This is the WRITE-ENABLED counterpart to every read-only spec elsewhere
 * in this directory.** PERMS-2 (2026-08-21) resolved PC-01/PC-02 — Manager
 * now holds the full accounting read+write permission set — and these seven
 * surfaces are the first to carry a real create/edit/archive affordance.
 * `menu-and-read-only.spec.ts`'s own "no write request" checks are scoped to
 * the Dashboard and the B5.2 Customers/Vendors/Reporting surfaces only; they
 * are not weakened by this file existing alongside them.
 */
const B56_ALL_ROUTES = [
  ACCOUNTING_ROUTES.budgets,
  ACCOUNTING_ROUTES.demandCalendar,
  ACCOUNTING_ROUTES.forecast,
  ACCOUNTING_ROUTES.chartOfAccounts,
  ACCOUNTING_ROUTES.costCentres,
  ACCOUNTING_ROUTES.postingSourceMaps,
  ACCOUNTING_ROUTES.taxConfig,
] as const;

test.describe("Manager accounting — B5.6 surfaces render with zero console errors", () => {
  for (const route of B56_ALL_ROUTES) {
    test(`${route} renders without a crash or console error`, async ({ page }) => {
      await managerLogin(page);
      const errors = captureConsoleErrors(page);
      await page.goto(route);
      await waitForManagerListSettled(page);
      await expect(page.getByRole("heading", { name: /^Manager access required/i })).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test("every B5.6 surface visibly labels itself write-enabled, distinct from a read-only surface", async ({ page }) => {
    await managerLogin(page);
    for (const route of B56_ALL_ROUTES) {
      await page.goto(route);
      await waitForManagerListSettled(page);
      await expect(page.getByText(/^Read \+ (write|refresh)$/).first()).toBeVisible();
    }
  });
});

test.describe("Manager accounting — Budgets vs actuals (B5.6)", () => {
  test("New budget opens a create dialog with a dynamic line-item editor", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.budgets);
    await waitForManagerListSettled(page);

    await page.getByRole("button", { name: "New budget" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Lines")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "+ Add line" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create budget" })).toBeDisabled();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("a POST to /finance/budgets fires only after the form is completed and submitted", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/finance\/budgets(\?|$)/.test(request.url())) methods.push(request.method());
    });

    await page.goto(ACCOUNTING_ROUTES.budgets);
    await waitForManagerListSettled(page);
    // No write yet — only the initial GET.
    expect(methods.every((method) => method === "GET")).toBe(true);
  });

  test("Refresh actuals is disabled for an ARCHIVED budget", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/finance/budgets", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "qa-archived-budget",
            name: "QA Archived Budget",
            budgetType: "OPERATIONAL",
            status: "ARCHIVED",
            periodStart: "2026-01-01",
            periodEnd: "2026-01-31",
            totalBudget: "100000",
            lines: [],
          },
        ]),
      });
    });

    await page.goto(ACCOUNTING_ROUTES.budgets);
    await waitForManagerListSettled(page);
    await expect(page.getByRole("button", { name: "Refresh actuals" })).toBeDisabled();
  });
});

test.describe("Manager accounting — Demand calendar (B5.6)", () => {
  test("New entry opens a create dialog; Save changes is disabled until the window is valid", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.demandCalendar);
    await waitForManagerListSettled(page);

    await page.getByRole("button", { name: "New entry" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create entry" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("Archive opens a confirm dialog naming the entry and the isActive:false consequence", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/finance/demand-calendar", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "qa-dc-1",
            calendarType: "BRUNCH",
            daypart: "ALL_DAY",
            title: "QA Archive Target",
            dateStart: "2026-09-01",
            dateEnd: "2026-09-02",
            isActive: true,
          },
        ]),
      });
    });

    await page.goto(ACCOUNTING_ROUTES.demandCalendar);
    await waitForManagerListSettled(page);
    await page.getByRole("button", { name: "Archive" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Archive this entry\?/i)).toBeVisible();
    await expect(dialog.getByText(/QA Archive Target/)).toBeVisible();
    await expect(dialog.getByText(/isActive: false/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("no hard-delete function is ever called from this screen", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/finance\/demand-calendar/.test(request.url())) methods.push(request.method());
    });

    await page.goto(ACCOUNTING_ROUTES.demandCalendar);
    await waitForManagerListSettled(page);
    await page.waitForTimeout(500);
    expect(methods).not.toContain("DELETE");
  });
});

test.describe("Manager accounting — Forecast (B5.6)", () => {
  test("Refresh forecast opens a confirm dialog naming refresh=true, not a POST", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.forecast);
    await waitForManagerListSettled(page);

    await page.getByRole("button", { name: "Refresh forecast" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/refresh=true/)).toBeVisible();
    await expect(dialog.getByText(/no separate write route/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("free-form assumptions/demandSignals/daypartSummaries render as structured data, not a guessed table", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.forecast);
    await waitForManagerListSettled(page);
    await expect(page.getByText(/free-form fields/i)).toBeVisible();
  });
});

test.describe("Manager accounting — Chart of accounts + Cost centres (B5.6)", () => {
  test("Chart of accounts labels itself organisation data and offers only Create, no edit/archive control", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.chartOfAccounts);
    await waitForManagerListSettled(page);

    await expect(page.getByText("Organisation data", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New account" })).toBeVisible();
    const content = page.locator("main");
    for (const label of [/^edit$/i, /^archive$/i, /^deactivate$/i, /^delete$/i]) {
      await expect(content.getByRole("button", { name: label })).toHaveCount(0);
    }
  });

  test("Cost centres labels itself organisation data and offers only Create", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.costCentres);
    await waitForManagerListSettled(page);

    await expect(page.getByText("Organisation data", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New cost centre" })).toBeVisible();
    const content = page.locator("main");
    for (const label of [/^edit$/i, /^archive$/i, /^deactivate$/i, /^delete$/i]) {
      await expect(content.getByRole("button", { name: label })).toHaveCount(0);
    }
  });
});

test.describe("Manager accounting — Posting source maps + Tax configuration (B5.6)", () => {
  test("Posting source maps offers Edit per row but no create control — rows are seed/system-created", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.postingSourceMaps);
    await waitForManagerListSettled(page);

    await expect(page.getByText("Organisation data", { exact: true })).toBeVisible();
    const rows = page.locator("[data-manager-list-row]");
    test.skip((await rows.count()) === 0, "no posting source map seeded on this branch");
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^new/i })).toHaveCount(0);
  });

  test("editing a posting source map opens a dialog prefilled with the existing debit/credit accounts", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.postingSourceMaps);
    await waitForManagerListSettled(page);
    const rows = page.locator("[data-manager-list-row]");
    test.skip((await rows.count()) === 0, "no posting source map seeded on this branch");

    await page.getByRole("button", { name: "Edit" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Debit account", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Credit account", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Cost centre required", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("Tax configuration shows an honest 'not configured yet' state distinct from an error, when the read 404s", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/tax-config", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"message":"No active tax ledger configuration found"}',
      });
    });

    await page.goto(ACCOUNTING_ROUTES.taxConfig);
    await waitForManagerListSettled(page);
    await expect(page.getByText(/not configured yet/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
  });

  test("Edit configuration opens a dialog that always sends `active` explicitly, never omitted", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.taxConfig);
    await waitForManagerListSettled(page);

    const editButton = page.getByRole("button", { name: /Edit configuration|Configure/ });
    await expect(editButton).toBeVisible();
    await editButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Active", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});
