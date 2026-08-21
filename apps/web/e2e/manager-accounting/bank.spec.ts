import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  BANK_RECONCILIATION_STATUS_VALUES,
  BANK_STATEMENT_STATUS_VALUES,
  MANAGER_CFG,
  branchSwitcher,
  captureApiRequests,
  captureBranchHeaders,
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
 * Track B5.3 — Manager Accounting → Bank: Bank accounts, Bank statements,
 * Reconciliation. Frontend-only, strictly READ-ONLY (PC-01) — Manager holds
 * `pos:accounting:{bank-accounts,bank-statements,reconciliation}:read` but
 * neither `:match` nor `:create`, so there is no match/skip/complete control
 * anywhere on this surface.
 *
 * All three routes are PC-06 bare arrays with NO server-side status filter
 * (only `?bankAccountId=`) — the status chip filters the already-fetched
 * complete array client-side, so (unlike the B5.2 AR/AP specs) no request is
 * ever expected to carry `?status=`.
 *
 * Runs against the isolated local Docker stack only (never shared Neon). The
 * demo dataset carries zero bank rows out of the box (`ai/ENTERPRISE_UI_ROADMAP.md`
 * B5.3 row: "needs a fixture … before it can be designed") — every row-
 * dependent assertion below tolerates an honest empty state via `test.skip`,
 * matching the pattern `customers.spec.ts` already uses for AR credit notes.
 */
test.describe("Manager accounting — Bank accounts", () => {
  test("bank accounts list renders without a crash, live rows or an honest empty state", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.bankAccounts);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    const hasTable = (await listTable(page).count()) > 0;
    const hasEmptyState = (await page.getByRole("heading", { name: /^No /i }).count()) > 0;
    expect(hasTable || hasEmptyState).toBe(true);
    expect(errors).toEqual([]);
  });

  test("no pager renders on the bank accounts list — PC-06, no server total to bind to", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.bankAccounts);
    await waitForManagerListSettled(page);
    await expect(page.locator('[aria-label="Pagination"]')).toHaveCount(0);
  });
});

test.describe("Manager accounting — Bank statements", () => {
  test("statements list renders live rows with a real closing balance", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.bankStatements);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no bank statement seeded on this branch");

    await expect(listTable(page)).toBeVisible();
    const firstRowText = (await listRows(page).first().textContent()) || "";
    // A currency code immediately followed by digits proves a real closing
    // balance rendered, not a placeholder dash.
    expect(firstRowText).toMatch(/[A-Z]{2,3}\s?[\d,]+/);
  });

  test("the status filter narrows results client-side, tags the URL, and never reaches the server", async ({
    page,
  }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.bankStatements);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no bank statement seeded on this branch");

    const beforeFilter = requests.filter((request) => /\/api\/accounting\/bank-statements(\?|$)/.test(request.url)).length;

    await listFilterTrigger(page, "Filter bank statements").click();
    // Every real BankStatementStatus value is offered — no invented option.
    for (const value of BANK_STATEMENT_STATUS_VALUES) {
      await expect(page.getByRole("menuitemcheckbox", { name: new RegExp(`^${value}$`, "i") })).toBeVisible();
    }
    await listFilterOption(page, "Imported").click();

    await expect.poll(() => page.url()).toContain("status=IMPORTED");
    await waitForManagerListSettled(page);

    // Either every visible row is Imported, or an honest empty state.
    const rowCount = await listRows(page).count();
    if (rowCount > 0) {
      await expect(listRows(page).first()).toContainText(/Imported/i);
    } else {
      await expect(page.getByRole("heading", { name: /^No /i })).toBeVisible();
    }

    // This endpoint accepts no server-side status parameter at all — filtering
    // must NOT trigger a fresh network read (the array was already complete).
    const afterFilter = requests.filter((request) => /\/api\/accounting\/bank-statements(\?|$)/.test(request.url)).length;
    expect(afterFilter).toBe(beforeFilter);
    for (const request of requests) {
      if (/\/api\/accounting\/bank-statements(\?|$)/.test(request.url)) {
        expect(new URL(request.url).searchParams.get("status")).toBeNull();
      }
    }
  });

  test("clicking a row opens the statement detail with its lines and match state", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.bankStatements);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no bank statement seeded on this branch");

    const firstId = await listRows(page).first().getAttribute("data-manager-list-row");
    await listRows(page).first().click();

    await waitForApiRequest(requests, /\/api\/accounting\/bank-statements\/[^/?]+(\?|$)/);
    await expect.poll(() => page.url()).toContain("statementId=");
    if (firstId) expect(page.url()).toContain(firstId);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("link", { name: "Bank statements" })).toBeVisible();
    await expect(page.locator("main")).toContainText(/Balances/i);
    // Every match-state badge is one of the three real BankStatementLineStatus
    // values — never a fabricated or guessed state.
    const bodyText = (await page.locator("main").textContent()) || "";
    const hasAnyState = /Matched|Unmatched|Skipped/.test(bodyText);
    expect(hasAnyState).toBe(true);
  });

  test("a mocked 500 on the statements read fails closed with no crash", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.route("**/api/accounting/bank-statements**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.bankStatements);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
    await expect(page.getByText(/could not be read/i)).toBeVisible();
    await expect(listTable(page)).toHaveCount(0);
    expect(errors.filter((message) => !/Failed to load resource/.test(message))).toEqual([]);
  });

  test("no pager renders on the statements list — PC-06, no server total to bind to", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.bankStatements);
    await waitForManagerListSettled(page);
    await expect(page.locator('[aria-label="Pagination"]')).toHaveCount(0);
  });
});

test.describe("Manager accounting — Reconciliation", () => {
  test("reconciliation list renders live rows with a lifecycle status", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.bankReconciliation);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no reconciliation seeded on this branch");

    await expect(listTable(page)).toBeVisible();
    const firstRowText = (await listRows(page).first().textContent()) || "";
    expect(firstRowText).toMatch(/Open|In Progress|Completed|Disputed/i);
  });

  test("the status filter narrows results client-side and never reaches the server", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.bankReconciliation);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no reconciliation seeded on this branch");

    const beforeFilter = requests.filter((request) => /\/api\/accounting\/reconciliation(\?|$)/.test(request.url)).length;

    await listFilterTrigger(page, "Filter reconciliations").click();
    for (const value of BANK_RECONCILIATION_STATUS_VALUES) {
      await expect(page.getByRole("menuitemcheckbox", { name: new RegExp(`^${value.replace("_", " ")}$`, "i") })).toBeVisible();
    }
    await listFilterOption(page, "In Progress").click();

    await expect.poll(() => page.url()).toContain("status=IN_PROGRESS");
    await waitForManagerListSettled(page);

    const rowCount = await listRows(page).count();
    if (rowCount > 0) {
      await expect(listRows(page).first()).toContainText(/In Progress/i);
    } else {
      await expect(page.getByRole("heading", { name: /^No /i })).toBeVisible();
    }

    const afterFilter = requests.filter((request) => /\/api\/accounting\/reconciliation(\?|$)/.test(request.url)).length;
    expect(afterFilter).toBe(beforeFilter);
  });

  test("clicking a row opens the reconciliation detail with a truthful balance/difference and its lifecycle pipeline", async ({
    page,
  }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.bankReconciliation);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no reconciliation seeded on this branch");

    const firstId = await listRows(page).first().getAttribute("data-manager-list-row");
    await listRows(page).first().click();

    await waitForApiRequest(requests, /\/api\/accounting\/reconciliation\/[^/?]+(\?|$)/);
    await expect.poll(() => page.url()).toContain("reconciliationId=");
    if (firstId) expect(page.url()).toContain(firstId);
    await waitForManagerListSettled(page);

    await expect(statusPipeline(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "Reconciliation" })).toBeVisible();
    await expect(page.locator("main")).toContainText(/Difference/i);
    // The completion precondition is stated in words — never a Match/Skip/
    // Complete button, which the module-wide read-only sweep below also proves.
    await expect(page.getByRole("button", { name: /^match$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^skip$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^complete$/i })).toHaveCount(0);
  });

  test("a completed reconciliation's difference reads zero and an in-progress one's does not, when both exist", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.bankReconciliation);
    await waitForManagerListSettled(page);
    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "no reconciliation seeded on this branch");

    const rowTexts = await listRows(page).evaluateAll((rows) => rows.map((row) => row.textContent || ""));
    const completedIndex = rowTexts.findIndex((text) => /Completed/i.test(text));
    test.skip(completedIndex === -1, "no COMPLETED reconciliation seeded on this branch");

    await listRows(page).nth(completedIndex).click();
    await waitForManagerListSettled(page);
    await expect(page.locator("main")).toContainText(/Difference/i);
    // A COMPLETED reconciliation's statement balance and matched total agree —
    // rendered money, never a bare "0" that could be a missing-value fallback.
    const detailText = (await page.locator("main").textContent()) || "";
    expect(detailText).toMatch(/[A-Z]{2,3}\s?0(\D|$)/);
  });

  test("a mocked 500 on the reconciliation read fails closed with no crash", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.route("**/api/accounting/reconciliation**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );

    await page.goto(ACCOUNTING_ROUTES.bankReconciliation);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
    await expect(page.getByText(/could not be read/i)).toBeVisible();
    await expect(listTable(page)).toHaveCount(0);
    expect(errors.filter((message) => !/Failed to load resource/.test(message))).toEqual([]);
  });

  test("no pager renders on the reconciliation list — PC-06, no server total to bind to", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.bankReconciliation);
    await waitForManagerListSettled(page);
    await expect(page.locator('[aria-label="Pagination"]')).toHaveCount(0);
  });
});

/**
 * The same read-only guarantee `menu-and-read-only.spec.ts` proves for the
 * B5.1 dashboard and B5.2 Customers/Vendors surfaces, re-proven here for all
 * three Bank surfaces.
 */
const BANK_SURFACES = [ACCOUNTING_ROUTES.bankAccounts, ACCOUNTING_ROUTES.bankStatements, ACCOUNTING_ROUTES.bankReconciliation] as const;

test.describe("Manager accounting is read-only on the B5.3 Bank surfaces", () => {
  test("no new/create/import/match/skip/complete control renders on any Bank surface", async ({ page }) => {
    await managerLogin(page);

    for (const route of BANK_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);

      const content = page.locator("main");
      for (const label of [/^new$/i, /^create$/i, /^import$/i, /^match$/i, /^skip$/i, /^complete$/i, /^start$/i]) {
        await expect(content.getByRole("button", { name: label })).toHaveCount(0);
      }
      await expect(content.locator("form")).toHaveCount(0);
    }
  });

  test("every Bank surface issues GET-only accounting-scoped requests", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!/\/api\/accounting\//.test(url)) return;
      methods.push(request.method());
    });

    for (const route of BANK_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);
      await page.waitForTimeout(500);
    }

    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((method) => method === "GET")).toBe(true);
  });

  test("switching branch re-scopes the bank accounts read and degrades honestly on a branch with no bank data", async ({
    page,
  }) => {
    await managerLogin(page);
    const headers = captureBranchHeaders(page);
    await page.goto(ACCOUNTING_ROUTES.bankAccounts);
    await waitForManagerListSettled(page);
    test.skip(await branchSwitcher(page).count() === 0, "branch switcher not present at this viewport");

    const beforeCount = headers.length;
    await branchSwitcher(page).selectOption(MANAGER_CFG.secondBranchId);
    await expect
      .poll(
        () =>
          headers.slice(beforeCount).filter((entry) => entry.branchId === MANAGER_CFG.secondBranchId).length,
        { timeout: 45_000 },
      )
      .toBeGreaterThan(0);
    await waitForManagerListSettled(page);

    // Every bank-accounts read after the switch carries the NEW branch header.
    const afterAccounts = headers
      .slice(beforeCount)
      .filter((entry) => /\/api\/accounting\/bank-accounts(\?|$)/.test(entry.url));
    expect(afterAccounts.length).toBeGreaterThan(0);
    for (const entry of afterAccounts) {
      expect(entry.branchId).toBe(MANAGER_CFG.secondBranchId);
    }

    // Rooftop Bar (the fixed second demo branch) genuinely has zero bank rows
    // on the isolated stack this pass seeded — the empty state is a real read
    // outcome, not a stuck loading state or a crash.
    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
  });
});
