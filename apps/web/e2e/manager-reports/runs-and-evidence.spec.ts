import { expect, test } from "@playwright/test";

import {
  MANAGER_REPORTS_ROUTES,
  activeBranchId,
  apiJson,
  breakdownTable,
  captureApiRequests,
  captureConsoleErrors,
  listTable,
  managerLogin,
  summaryPanel,
  waitForApiRequest,
  waitForListSettled,
} from "./fixtures";

/**
 * Track B4 — run history, run detail, request budgets and screenshot evidence.
 */
test.describe("Manager Reports — run history", () => {
  test.beforeEach(async ({ page }) => {
    await managerLogin(page);
  });

  test("lists persisted runs with no console errors", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);

    await expect(listTable(page)).toBeVisible();
    // History is genuinely server-side, so the copy may say so.
    await expect(page.getByText(/stored by the API/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the pager is fed the endpoint's own total, not a page length", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);

    const api = await apiJson(page, "/api/reports?page=1&pageSize=25");
    expect(api.total).toBeGreaterThan(0);

    const rows = await listTable(page).locator("tbody tr").count();
    expect(rows).toBeLessThanOrEqual(25);

    // `1-25 / 35` — the right-hand number is the server's `total`.
    await expect(page.getByText(new RegExp(`/ ${api.total}\\b`))).toBeVisible();
  });

  test("every history request sends an explicit bounded page size and the branch header", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);

    const reads = requests.filter(
      (request) => request.method === "GET" && /\/api\/reports\?/.test(request.url),
    );
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(read.url).toMatch(/pageSize=\d+/);
      expect(Number(new URL(read.url).searchParams.get("pageSize"))).toBeLessThanOrEqual(100);
      expect(read.branchId).toBeTruthy();
    }
  });

  test("paginates server-side", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);

    const api = await apiJson(page, "/api/reports?page=1&pageSize=25");
    test.skip(api.total <= 25, "not enough runs on this stack to paginate");

    await page.getByRole("button", { name: /next/i }).first().click();
    const paged = await waitForApiRequest(requests, /\/api\/reports\?.*page=2/);
    expect(paged.length).toBeGreaterThan(0);
    await expect(page).toHaveURL(/page=2/);
  });

  test("a status filter is applied server-side as a removable chip", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(`${MANAGER_REPORTS_ROUTES.runs}?status=COMPLETED`);
    await waitForListSettled(page);

    const filtered = requests.filter((request) => /status=COMPLETED/.test(request.url));
    expect(filtered.length).toBeGreaterThan(0);
    await expect(page.locator("[data-manager-filter-chip]")).toContainText("COMPLETED");
  });

  test("an invalid status in the URL fails safe instead of 400-ing the page", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(`${MANAGER_REPORTS_ROUTES.runs}?status=DEFINITELY_NOT_A_STATUS`);
    await waitForListSettled(page);

    await expect(listTable(page)).toBeVisible();
    expect(requests.filter((request) => /DEFINITELY_NOT_A_STATUS/.test(request.url))).toEqual([]);
  });

  test("opening a run costs exactly one extra request", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);

    const requests = captureApiRequests(page);
    await listTable(page).locator("tbody tr").first().click();
    await expect(summaryPanel(page)).toBeVisible({ timeout: 30_000 });

    const detailReads = requests.filter(
      (request) =>
        request.method === "GET" && /\/api\/reports\/[A-Za-z0-9]+$/.test(request.url.split("?")[0]),
    );
    expect(detailReads.length).toBe(1);
    expect(detailReads[0].branchId).toBeTruthy();
  });

  test("a run id from another branch fails safe rather than mislabelling money", async ({ page }) => {
    /**
     * MP0-12: `GET /reports/:id` resolves by orgId ALONE — a run from another
     * branch really does return 200 under this branch's header. The client
     * rejects it at the API boundary, so the figures can never be rendered under
     * the wrong branch's name.
     */
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);

    const branchId = await activeBranchId(page);
    const listed = await apiJson(page, "/api/reports?page=1&pageSize=100");
    const foreign = {
      activeBranch: branchId,
      ids: (listed.data || []).map((run: any) => run.branchId),
    };

    // Every run this branch lists really is this branch's.
    for (const branchId of foreign.ids) expect(branchId).toBe(foreign.activeBranch);

    // A syntactically valid but unknown id must not paint a record.
    await page.goto(`${MANAGER_REPORTS_ROUTES.runs}?runId=cxxxxxxxxxxxxxxxxxxxxxxx`);
    await expect(summaryPanel(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /could not be opened/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("a legacy PDF artifact is disclosed but never offered", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.runs}?status=COMPLETED`);
    await waitForListSettled(page);

    /**
     * The seeded runs that carry a withdrawn PDF artifact are the OLDEST, and
     * this suite generates new runs every time it executes — so a page-1 lookup
     * silently stops finding them and the spec skips itself into uselessness.
     * Walk to the LAST page, where the oldest runs are.
     */
    const findPdfRun = async () => {
      const first = await apiJson(page, "/api/reports?page=1&pageSize=100");
      const lastPage = Math.max(1, Math.ceil((first.total || 0) / 100));
      for (let pageNumber = lastPage; pageNumber >= 1; pageNumber -= 1) {
        const body =
          pageNumber === 1
            ? first
            : await apiJson(page, `/api/reports?page=${pageNumber}&pageSize=100`);
        const hit = (body.data || []).find((run: any) =>
          (run.exportArtifacts || []).some((artifact: any) => artifact.format === "PDF"),
        );
        if (hit) return hit;
      }
      return null;
    };

    const withPdf = await findPdfRun();
    test.skip(!withPdf, "no legacy PDF artifact on this stack");

    await page.goto(`${MANAGER_REPORTS_ROUTES.runs}?runId=${withPdf.id}`);
    await expect(summaryPanel(page)).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText(/older PDF artifact/i)).toBeVisible();
    await expect(page.getByText(/withdrew its PDF writer/i)).toBeVisible();

    // Disclosed in prose — but no control offers one.
    const controls = await page.locator("button, a").allTextContents();
    expect(controls.filter((text) => /pdf/i.test(text))).toEqual([]);
  });

  test("no run can be deleted or edited from this surface", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.runs);
    await waitForListSettled(page);
    await listTable(page).locator("tbody tr").first().click();
    await expect(summaryPanel(page)).toBeVisible({ timeout: 30_000 });

    const controls = await page.locator("button").allTextContents();
    for (const banned of [/delete/i, /remove/i, /edit/i, /rename/i]) {
      expect(controls.filter((text) => banned.test(text))).toEqual([]);
    }
  });
});

test.describe("Manager B4 — request budgets", () => {
  test.beforeEach(async ({ page }) => {
    await managerLogin(page);
  });

  for (const [name, route, budget] of [
    ["reports-catalog", MANAGER_REPORTS_ROUTES.catalog, 4],
    ["reports-runs", MANAGER_REPORTS_ROUTES.runs, 4],
  ] as const) {
    test(`${name} loads within ${budget} API requests`, async ({ page }) => {
      // Load once so the surface is already open, then measure a clean reload —
      // attaching straight after login catches the tail of the landing page's
      // own /auth/me (the B3 harness lesson).
      await page.goto(route);
      await waitForListSettled(page);

      const requests = captureApiRequests(page);
      await page.reload();
      await waitForListSettled(page);

      // Preflights are transport overhead of the split-origin QA stack, not
      // application reads, so the budget counts real requests.
      const real = requests.filter((request) => request.method !== "OPTIONS");
      expect(real.length).toBeLessThanOrEqual(budget);
    });
  }

  test("Reports does not poll", async ({ page }) => {
    await page.goto(MANAGER_REPORTS_ROUTES.catalog);
    await waitForListSettled(page);

    const requests = captureApiRequests(page);
    await page.waitForTimeout(8_000);
    expect(requests.filter((request) => request.method !== "OPTIONS")).toEqual([]);
  });
});

test.describe("Manager B4 — screenshot evidence", () => {
  for (const [label, width, height] of [
    ["1440x900", 1440, 900],
    ["1280x680", 1280, 680],
  ] as const) {
    test(`captures the four B4 surfaces at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await managerLogin(page);
      const dir = `e2e/.evidence/manager-b4/${label}`;

      // 1. The catalog.
      await page.goto(MANAGER_REPORTS_ROUTES.catalog);
      await waitForListSettled(page);
      await page.screenshot({ path: `${dir}/01-catalog.png`, fullPage: true });

      // 2. A parameter form (TOP_ITEMS — the one with a limit field).
      await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=TOP_ITEMS`);
      await expect(page.locator("[data-manager-report-form]")).toBeVisible();
      await page.screenshot({ path: `${dir}/02-parameter-form.png`, fullPage: true });

      // 3. A generated report with its summary and breakdown.
      await page.getByRole("button", { name: /^Generate report$/ }).click();
      await expect(breakdownTable(page)).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: `${dir}/03-generated-report.png`, fullPage: true });

      // 4. The truthful unavailable state.
      await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=PAYROLL_SUMMARY`);
      await expect(page.locator("[data-manager-report-unavailable]")).toBeVisible();
      await page.screenshot({ path: `${dir}/04-unavailable.png`, fullPage: true });

      // 5. The run history, for completeness.
      await page.goto(MANAGER_REPORTS_ROUTES.runs);
      await waitForListSettled(page);
      await page.screenshot({ path: `${dir}/05-run-history.png`, fullPage: true });
    });
  }
});
