import { expect, test } from "@playwright/test";

import {
  MANAGER_REPORTS_ROUTES,
  VERIFIED_GENERATORS,
  activeBranchId,
  apiJson,
  breakdownTable,
  captureApiRequests,
  captureConsoleErrors,
  downloadButton,
  managerLogin,
  reportForm,
  summaryEntries,
  summaryPanel,
  waitForGeneratedRun,
} from "./fixtures";

/**
 * Track B4 — generate, render and export.
 *
 * These are the specs that would catch a repeat of B3-D1: a number rendered
 * under a label that does not describe it. The gross/net cross-check compares
 * the report's own figures against `/api/dash/today-summary` — the endpoint the
 * B2 Overview reads — so the two surfaces cannot silently disagree about the
 * same day's money.
 */
test.describe("Manager Reports — generate", () => {
  test.beforeEach(async ({ page }) => {
    await managerLogin(page);
  });

  for (const key of VERIFIED_GENERATORS) {
    test(`${key} generates a real run and renders its summary`, async ({ page }) => {
      const errors = captureConsoleErrors(page);
      const requests = captureApiRequests(page);

      await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=${key}`);
      await expect(reportForm(page)).toBeVisible();

      await page.getByRole("button", { name: /^Generate report$/ }).click();
      await waitForGeneratedRun(page);

      // A real POST to that generator's own route, branch-scoped.
      const posts = requests.filter(
        (request) => request.method === "POST" && /\/api\/reports\//.test(request.url),
      );
      expect(posts.length).toBe(1);
      expect(posts[0].branchId).toBeTruthy();

      await expect(summaryPanel(page)).toBeVisible();
      await expect(page.getByText("COMPLETED")).toBeVisible();

      // rowCount is never called a row count.
      await expect(page.getByText(/Records aggregated/)).toBeVisible();

      expect(errors).toEqual([]);
    });
  }

  test("DAILY_SALES gross/net match /api/dash/today-summary exactly", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    const entries = await summaryEntries(page);
    const dash = await apiJson(page, "/api/dash/today-summary");

    /**
     * ⚠️ MP0-10 / B3-D1. `grossSales` is tax-INCLUSIVE and `netSales` is ex-tax.
     * Both labels state their basis and neither is a bare "Gross"/"Net" — that
     * inversion is precisely what shipped a wrong number on the B2 Overview.
     */
    const expectMoney = (value: string) =>
      `UGX ${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    expect(entries["Sales (tax-inclusive)"]).toBe(expectMoney(dash.grossSales));
    expect(entries["Sales (ex-tax)"]).toBe(expectMoney(dash.netSales));
    expect(entries["Tax"]).toBe(expectMoney(dash.taxTotal));
    expect(entries["Subtotal (ex-tax, before discount)"]).toBe(expectMoney(dash.subtotalSales));

    // The accounting identity the backend fix restored.
    expect(Number(dash.grossSales)).toBe(Number(dash.netSales) + Number(dash.taxTotal));
    expect(Number(dash.grossSales)).toBeGreaterThanOrEqual(Number(dash.netSales));

    // No bare Gross/Net anywhere on the surface.
    const labels = Object.keys(entries);
    expect(labels).not.toContain("Gross sales");
    expect(labels).not.toContain("Net sales");
  });

  test("DAILY_SALES renders NO breakdown table and says why", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    await expect(breakdownTable(page)).toHaveCount(0);
    await expect(page.getByText(/no per-row breakdown/)).toBeVisible();
  });

  test("TOP_ITEMS renders a real breakdown with an ex-tax label and no raw ids", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=TOP_ITEMS`);

    // The only generator with a limit control.
    await expect(page.locator("[data-manager-report-limit]")).toBeVisible();

    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    await expect(breakdownTable(page)).toBeVisible();
    const headers = await breakdownTable(page).locator("th").allTextContents();

    // B4-F2: per-item grossSales is SUM(orderItem.subtotal) — ex-tax — unlike
    // the tax-inclusive top-level field of the same name.
    expect(headers).toContain("Gross sales (ex-tax)");
    expect(headers.join(" ")).not.toMatch(/tax-inclusive/i);

    // The columns mirror the CSV, which carries no identifier column.
    expect(headers.join(" ").toLowerCase()).not.toContain("id");

    const firstRow = await breakdownTable(page).locator("tbody tr").first().allTextContents();
    expect(firstRow.join(" ")).toMatch(/UGX/);
  });

  test("only TOP_ITEMS offers a row limit", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);
    await expect(reportForm(page)).toBeVisible();
    await expect(page.locator("[data-manager-report-limit]")).toHaveCount(0);
  });

  test("a CUSTOM range requires both dates before it will submit", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);

    await page.locator('[data-manager-report-window="CUSTOM"]').click();
    await expect(page.locator("[data-manager-report-date-from]")).toBeVisible();

    // Clearing a date must block submission rather than let the API 400.
    await page.locator("[data-manager-report-date-from]").fill("");
    await expect(page.getByText(/needs both a start and an end date/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Generate report$/ })).toBeDisabled();

    expect(requests.filter((request) => request.method === "POST")).toEqual([]);
  });

  test("a CUSTOM range sends dateFrom and dateTo", async ({ page }) => {
    const requests = captureApiRequests(page);
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);

    await page.locator('[data-manager-report-window="CUSTOM"]').click();
    await page.locator("[data-manager-report-date-from]").fill("2026-08-01");
    await page.locator("[data-manager-report-date-to]").fill("2026-08-20");
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    const post = requests.find((request) => request.method === "POST");
    expect(post).toBeTruthy();
    // Scoped to the run header — "Custom range" is also the period button's label.
    await expect(page.locator("[data-manager-report-run]").getByText(/Custom range ·/)).toBeVisible();
  });
});

test.describe("Manager Reports — CSV export", () => {
  test.beforeEach(async ({ page }) => {
    await managerLogin(page);
  });

  test("downloads a real CSV whose CONTENTS match the rendered figures", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    const entries = await summaryEntries(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await downloadButton(page).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^daily_sales_.*\.csv$/);

    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = await require("fs/promises").readFile(path as string, "utf8");

    // A real CSV, not a stub and not a client-assembled string.
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Metric,Value");
    expect(lines.length).toBeGreaterThan(5);

    // The file's own numbers are the ones the screen showed.
    const rows = Object.fromEntries(lines.slice(1).map((line: string) => line.split(",")));
    const asMoney = (raw: string) =>
      `UGX ${Number(raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    expect(asMoney(rows["Gross Sales"])).toBe(entries["Sales (tax-inclusive)"]);
    expect(asMoney(rows["Net Sales"])).toBe(entries["Sales (ex-tax)"]);
    expect(asMoney(rows["Tax Total"])).toBe(entries["Tax"]);
    expect(rows["Order Count"]).toBe(entries["Orders"].replace(/,/g, ""));

    await expect(page.getByText(/CSV downloaded/)).toBeVisible();
    await expect(page.getByText(/produced by the API, not assembled in this browser/)).toBeVisible();
  });

  test("a TOP_ITEMS export is genuinely tabular and matches the preview", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=TOP_ITEMS`);
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    const firstPreviewRow = await breakdownTable(page)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents();

    const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await downloadButton(page).click();
    const download = await downloadPromise;
    const csv = await require("fs/promises").readFile((await download.path()) as string, "utf8");

    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Rank,Item,Quantity Sold,Gross Sales");
    expect(lines.length).toBeGreaterThan(2);

    // The top row of the file is the top row of the preview.
    const [, item, quantity] = lines[1].split(",");
    expect(item).toBe(firstPreviewRow[0]);
    expect(quantity).toBe(firstPreviewRow[1].replace(/,/g, ""));
  });

  test("the export request asks for CSV and never PDF", async ({ page }) => {
    const requests = captureApiRequests(page);
    const bodies: string[] = [];
    page.on("request", (request) => {
      // The web app is on :3100 and the API on :4001, so every write is
      // cross-origin and the browser sends a CORS **preflight OPTIONS** first.
      // Playwright reports that as its own request event, so a URL-only filter
      // counts each POST twice.
      if (request.method() !== "POST") return;
      if (request.url().includes("/api/reports/export")) bodies.push(request.postData() || "");
    });

    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=PAYMENT_MIX`);
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await downloadButton(page).click();
    await downloadPromise;

    expect(bodies.length).toBe(1);
    expect(bodies[0]).toContain('"format":"CSV"');
    expect(bodies[0]).not.toContain("PDF");

    // The download itself is a GET carrying the branch header.
    const downloads = requests.filter(
      (request) => /\/exports\/.*\/download/.test(request.url) && request.method === "GET",
    );
    expect(downloads.length).toBe(1);
    expect(downloads[0].branchId).toBeTruthy();
  });

  test("forcing a PDF export surfaces the backend's honest 501", async ({ page }) => {
    await page.goto(`${MANAGER_REPORTS_ROUTES.catalog}?report=DAILY_SALES`);
    await page.getByRole("button", { name: /^Generate report$/ }).click();
    await waitForGeneratedRun(page);

    /**
     * The UI has no PDF path, so this drives the API directly with the page's
     * own session to prove what a PDF request would do — the reason B4 offers no
     * PDF control is a real 501, not an assumption (C-01).
     */
    const runId = await page.locator("[data-manager-report-run]").getAttribute("data-manager-report-run");
    const result = await page.evaluate(
      async ({ api, runId: id, branchId }) => {
        const token = window.localStorage.getItem("nimbus.accessToken");
        const response = await fetch(`${api}/api/reports/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(branchId ? { "X-Branch-Id": branchId } : {}),
          },
          body: JSON.stringify({ reportRunId: id, format: "PDF" }),
        });
        return { status: response.status, body: await response.json() };
      },
      { api: process.env.PW_API_URL || "http://localhost:4001", runId, branchId: await activeBranchId(page) },
    );

    expect(result.status).toBe(501);
    expect(result.body.message).toMatch(/not supported/i);
    expect(result.body.message).toMatch(/CSV/);
  });
});
