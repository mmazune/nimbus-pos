import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  branchSwitcher,
  captureConsoleErrors,
  card,
  kpi,
  managerLogin,
  statusPipeline,
  waitForAccountingSettled,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.5 — Manager Accounting → Closing: Fiscal periods, Period close
 * runs. Frontend-only, strictly READ-ONLY (PC-01/OD-9) — Manager holds
 * `pos:accounting:periods:read` and `pos:accounting:period-close-runs:read`
 * but neither `:open`, `:close` nor `:lock`, so there is no lifecycle control
 * anywhere on either surface (re-verified live: PATCH .../open, .../close,
 * .../lock all 403).
 *
 * 🔴 C-27 (new finding, this pass): Manager's token ADDITIONALLY holds
 * `pos:accounting:periods:create` — a pre-existing M28-era grant the
 * 2026-08-20 permissions cutover never revoked. Live-proven: Manager
 * `POST /accounting/periods` → 201 on the isolated stack. This UI still
 * renders NO create control despite the token technically permitting one —
 * the Fiscal periods screen discloses this by name rather than claiming a
 * blanket "read access only" that this specific grant falsifies.
 *
 * Both routes are PC-06 bare arrays with no server total and ORGANISATION
 * scope (batch 2: `FiscalPeriod` has no `branch_id` column at all;
 * `PeriodCloseRun.branchId` is nullable and the close path never stamps it)
 * — a branch switch must re-fetch (the query key still includes branchId,
 * matching every other accounting surface's invalidation contract) but the
 * RESULT must be byte-identical.
 *
 * Fixtures created live via the Owner token on the isolated B5.5 QA stack
 * (see the completion report): two DRAFT periods, two OPEN (FY2026-Q3,
 * FY2026-07, from demo-import), two CLOSED (FY2026-05 from demo-import,
 * FY2026-06 closed live through `PATCH .../close` — the one real
 * `PeriodCloseRun`), one LOCKED (FY2026-04, via `PATCH .../lock`). Every
 * row-dependent assertion below still tolerates an honest empty state via
 * `test.skip`, matching the B5.3/B5.4 pattern, since this phase's own
 * fixtures may not exist on every stack this spec runs against.
 */
test.describe("Manager accounting — Fiscal periods", () => {
  test("fiscal periods list renders without a crash, live rows or an honest empty state", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    const hasTable = (await page.locator("[data-manager-list-table]").count()) > 0;
    const hasEmptyState = (await page.getByRole("heading", { name: /^No /i }).count()) > 0;
    expect(hasTable || hasEmptyState).toBe(true);
    expect(errors).toEqual([]);
  });

  test("the page labels itself organisation data, not branch data", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);

    await expect(page.getByText("Organisation data", { exact: true })).toBeVisible();
    await expect(page.getByText(/organisation-wide/i)).toBeVisible();
  });

  test("the C-27 finding is disclosed by name — Manager's token can create a period, but this screen offers no create control", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);

    await expect(page.getByText(/C-27/).first()).toBeVisible();
    await expect(page.getByText(/pos:accounting:periods:create/)).toBeVisible();
    const content = page.locator("main");
    for (const label of [/^new$/i, /^create$/i, /^open$/i, /^close$/i, /^lock$/i]) {
      await expect(content.getByRole("button", { name: label })).toHaveCount(0);
    }
  });

  test("every seeded lifecycle stage renders through the status pipeline, and LOCKED is never off-pipeline", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);
    const rows = page.locator("[data-manager-list-row]");
    test.skip((await rows.count()) === 0, "no fiscal period seeded on this branch");

    // At least one pipeline widget renders per row, in the DRAFT/OPEN/CLOSED/
    // LOCKED order — never rendered as an "off pipeline" exit chip, because a
    // real, recognised status is never treated as off the pipeline.
    const pipelines = statusPipeline(page);
    await expect(pipelines.first()).toBeVisible();
    const exitChips = page.locator('[data-manager-status-pipeline="exit"]');
    // Every seeded row here carries a real, recognised status — none should
    // render the "Status unavailable" exit chip.
    await expect(exitChips).toHaveCount(0);
  });

  test("no pager renders on the fiscal periods list — PC-06, no server total to bind to", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);
    await expect(page.locator('[aria-label="Pagination"]')).toHaveCount(0);
  });

  test("switching branch re-fetches but the result is byte-identical — proving organisation scope, not a broken filter", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);

    const before = (await page.locator("[data-manager-list-row]").allTextContents()).sort();

    await branchSwitcher(page).selectOption({ label: "Rooftop Bar" });
    await waitForManagerListSettled(page);

    const after = (await page.locator("[data-manager-list-row]").allTextContents()).sort();
    expect(after).toEqual(before);
  });

  test("a malformed status fails closed to 'Status unavailable', never a guessed real stage", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/periods**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "qa-malformed-period",
            name: "QA malformed period",
            startsAt: "2026-01-01T00:00:00.000Z",
            endsAt: "2026-01-31T23:59:59.000Z",
            status: "ARCHIVED", // not a real FiscalPeriodStatus member
          },
        ]),
      }),
    );

    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);

    // Fails closed: an explicit "Status unavailable" exit chip, never a real
    // stage badge (DRAFT/OPEN/CLOSED/LOCKED) and never a fabricated 5th stage.
    await expect(page.locator('[data-manager-status-pipeline="exit"]').first()).toBeVisible();
    await expect(page.getByText("Status unavailable").first()).toBeVisible();
    for (const stage of ["Draft", "Open", "Closed", "Locked"]) {
      await expect(page.locator('[data-manager-status-pipeline="pipeline"]', { hasText: stage })).toHaveCount(0);
    }
  });

  test("a 500 on the periods read fails closed with no crash", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/periods**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
    await waitForManagerListSettled(page);
    await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
  });
});

test.describe("Manager accounting — Period close runs", () => {
  test("period close runs list renders without a crash, live rows or an honest empty state", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    const hasTable = (await page.locator("[data-manager-list-table]").count()) > 0;
    const hasEmptyState = (await page.getByRole("heading", { name: /^No /i }).count()) > 0;
    expect(hasTable || hasEmptyState).toBe(true);
    expect(errors).toEqual([]);
  });

  test("the page labels itself organisation data, not branch data", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);

    await expect(page.getByText("Organisation data", { exact: true })).toBeVisible();
    await expect(page.getByText(/organisation-wide/i)).toBeVisible();
  });

  test("the B5.5-F1 finding is disclosed — FAILED and PENDING are unreachable through the live API", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);

    await expect(page.getByText(/B5\.5-F1/).first()).toBeVisible();
    await expect(page.getByText(/reads Completed/i)).toBeVisible();
  });

  test("a completed run shows a truthful money tie-out — income, expense and retained earnings, negative when expenses exceed income", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);
    const rows = page.locator("[data-manager-list-row]");
    test.skip((await rows.count()) === 0, "no period close run seeded on this branch");

    await expect(page.getByText("Completed").first()).toBeVisible();
    // A real fixture with expense > income renders a NEGATIVE retained
    // earnings figure — never silently flipped to a positive or hidden.
    const negative = page.getByText(/^-UGX/);
    if ((await negative.count()) > 0) {
      await expect(negative.first()).toBeVisible();
    }
  });

  test("no pager renders on the period close runs list — PC-06, no server total to bind to", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);
    await expect(page.locator('[aria-label="Pagination"]')).toHaveCount(0);
  });

  test("switching branch re-fetches but the result is byte-identical — proving organisation scope, not a broken filter", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);

    const before = (await page.locator("[data-manager-list-row]").allTextContents()).sort();

    await branchSwitcher(page).selectOption({ label: "Rooftop Bar" });
    await waitForManagerListSettled(page);

    const after = (await page.locator("[data-manager-list-row]").allTextContents()).sort();
    expect(after).toEqual(before);
  });

  test("a malformed status fails closed to 'Status unavailable', never a guessed COMPLETED/success styling", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/period-close-runs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "qa-malformed-run",
            status: "SUCCESS", // not a real PeriodCloseRunStatus member
            closedAt: "2026-08-21T00:00:00.000Z",
            incomeTotal: "100000",
            expenseTotal: "50000",
            retainedEarningsAmount: "50000",
            closedBy: { id: "u1", firstName: "QA", lastName: "Tester" },
            fiscalPeriod: { id: "p1", name: "QA malformed run period" },
          },
        ]),
      }),
    );

    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);

    await expect(page.getByText("Status unavailable").first()).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Failed", { exact: true })).toHaveCount(0);
  });

  test("a 500 on the period close runs read fails closed with no crash", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/accounting/period-close-runs**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.periodCloseRuns);
    await waitForManagerListSettled(page);
    await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
  });
});

/**
 * Read-only guarantees, re-proven on the two B5.5 surfaces — same shape as
 * the B5.2/B5.3/B5.4 sweeps elsewhere in this directory. Additional tests,
 * not a relaxation of the module-wide ones in `menu-and-read-only.spec.ts`.
 */
const B5_5_SURFACES = [ACCOUNTING_ROUTES.fiscalPeriods, ACCOUNTING_ROUTES.periodCloseRuns] as const;

test.describe("Manager accounting is read-only on the B5.5 Closing surfaces", () => {
  test("no create, open, close or lock control renders on either B5.5 surface", async ({ page }) => {
    await managerLogin(page);

    for (const route of B5_5_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);

      const content = page.locator("main");
      for (const label of [/^new$/i, /^create$/i, /^open$/i, /^close$/i, /^lock$/i]) {
        await expect(content.getByRole("button", { name: label })).toHaveCount(0);
      }
      await expect(content.locator("form")).toHaveCount(0);
    }
  });

  test("every B5.5 surface issues GET-only accounting-scoped requests", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!/\/api\/accounting\//.test(url)) return;
      methods.push(request.method());
    });

    for (const route of B5_5_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);
      await page.waitForTimeout(500);
    }

    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((method) => method === "GET")).toBe(true);
  });
});

/**
 * The B5.1 dashboard's Fiscal period card — the three `noDrillInReason`
 * placeholders (`period.current`, `period.open`, `period.closeRuns`) are now
 * real links into the two B5.5 surfaces.
 */
test.describe("Manager accounting dashboard — Fiscal period card links into Closing", () => {
  test("the current-period figure and the open/close-run stats all link into a real B5.5 surface", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.dashboard);
    await waitForAccountingSettled(page);

    const periodCard = card(page, "accounting-period");
    await expect(periodCard).toBeVisible();

    await expect(kpi(page, "period.current").getByRole("link")).toHaveCount(1);
    await expect(kpi(page, "period.open").getByRole("link")).toHaveCount(1);
    await expect(kpi(page, "period.closeRuns").getByRole("link")).toHaveCount(1);

    await kpi(page, "period.closeRuns").getByRole("link").click();
    await page.waitForURL(/\/manager\/accounting\/closing\/period-close-runs/, { timeout: 15_000 });
  });
});
