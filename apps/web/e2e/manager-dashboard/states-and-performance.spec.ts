import { expect, test } from "@playwright/test";

import {
  captureApiRequests,
  captureConsoleErrors,
  card,
  DASHBOARD_CARDS,
  managerLogin,
  waitForDashboardSettled,
} from "./fixtures";

test.describe("Manager Overview — states, honesty and performance", () => {
  test("a failing endpoint degrades ONE card and shows no number for it", async ({ page }) => {
    await managerLogin(page);

    // Force a 500 on low-stock only; every other card must stay healthy.
    await page.route("**/api/dash/low-stock**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 500, message: "Injected failure for QA" }),
      }),
    );

    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const lowStock = card(page, "low-stock");
    await expect(lowStock.locator('[data-manager-card-state="error"]')).toBeVisible();
    await expect(lowStock).toContainText("could not be read");
    // Fail-closed: no fabricated zero, no stale figure.
    await expect(lowStock).not.toContainText("Items at or below reorder level");

    for (const testId of ["sales-today", "orders-today", "coverage"] as const) {
      await expect(
        card(page, testId).locator('[data-manager-card-state="error"]'),
        `${testId} is unaffected by the low-stock failure`,
      ).toHaveCount(0);
    }
  });

  test("a failing approvals queue is named, and the total covers only what was read", async ({ page }) => {
    await managerLogin(page);
    await page.route("**/api/hr/leave**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "QA" }) }),
    );

    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const approvals = card(page, "approvals");
    await expect(approvals).toContainText("Unavailable");
    await expect(approvals).toContainText("1 of 4 queues could not be read");
  });

  test("the degraded live-stream state is stated in words and no stream is opened", async ({ page }) => {
    await managerLogin(page);

    // Instrument EventSource so an SSE attempt is provable, not merely unobserved.
    await page.addInitScript(() => {
      const flagged = window as unknown as { __sseOpened?: boolean; EventSource: unknown };
      const original = flagged.EventSource;
      if (typeof original === "function") {
        flagged.EventSource = new Proxy(original, {
          construct(target, args) {
            flagged.__sseOpened = true;
            return Reflect.construct(target as never, args as never);
          },
        });
      }
    });

    const requests = captureApiRequests(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    await expect(page.locator('[data-manager-stream-state="degraded"]')).toContainText(
      "Live stream unavailable",
    );
    await expect(page.locator("[data-manager-dashboard-status]")).toContainText("Refreshes every 60 seconds");

    expect(requests.filter((request) => request.url.includes("/api/stream/"))).toEqual([]);
    const usedEventSource = await page.evaluate(
      () => (window as unknown as { __sseOpened?: boolean }).__sseOpened === true,
    );
    expect(usedEventSource).toBe(false);
  });

  test("an empty branch shows honest empty states, not fabricated zeros", async ({ page }) => {
    await managerLogin(page);

    const calculatedAt = "2026-08-20T08:00:00.000Z";
    await page.route("**/api/dash/manager**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          today: { grossSales: "0", netSales: "0", orderCount: 0, avgOrderValue: "0" },
          openOrders: 0,
          lowStockCount: 0,
          anomalySummary: { openCount: 0, highCount: 0 },
          shiftSummary: { activeShifts: 0, activeTills: 0 },
          reservationsTodayCount: 0,
          calculatedAt,
        }),
      }),
    );
    await page.route("**/api/dash/payment-mix**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cash: "0", card: "0", momo: "0", total: "0", date: "2026-08-20", calculatedAt }),
      }),
    );
    await page.route("**/api/dash/open-orders**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: 0, orders: [] }) }),
    );
    await page.route("**/api/dash/low-stock**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: 0, items: [] }) }),
    );

    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    await expect(card(page, "payment-mix")).toContainText("No completed payments");
    await expect(card(page, "open-orders")).toContainText("No orders are open");
    await expect(card(page, "low-stock")).toContainText("above its reorder level");
    // A genuine zero is still shown as a zero where it IS the reading.
    await expect(card(page, "coverage")).toContainText("0");
  });

  test("the dashboard loads within its request budget and never storms", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    const errors = captureConsoleErrors(page);

    // Login itself lands on /manager/overview, so discard that page load and
    // measure ONE clean navigation.
    await page.waitForLoadState("networkidle");
    requests.length = 0;
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);
    await page.waitForTimeout(3_000);

    const dashboardCalls = requests.filter((request) =>
      /\/api\/(dash|pos\/discounts\/pending|hr\/leave|hr\/shift-swaps|analytics\/anomalies)/.test(request.url),
    );
    // Nine dashboard reads, one per card query. The ceiling allows a retry, not a storm.
    expect(
      dashboardCalls.length,
      `dashboard requests: ${dashboardCalls.map((call) => call.url).join(", ")}`,
    ).toBeGreaterThanOrEqual(9);
    expect(
      dashboardCalls.length,
      `dashboard requests: ${dashboardCalls.map((call) => call.url).join(", ")}`,
    ).toBeLessThanOrEqual(12);

    // The shell's own /api/auth/me is still fetched exactly once (performance rule).
    expect(requests.filter((request) => request.url.includes("/api/auth/me")).length).toBe(1);
    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("the page never scrolls horizontally at this viewport", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test("every card is reachable and operable from the keyboard", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const links = page.locator("[data-manager-dashboard-grid] a");
    const count = await links.count();
    expect(count).toBeGreaterThan(DASHBOARD_CARDS.length);

    const first = links.first();
    await first.focus();
    await expect(first).toBeFocused();
  });
});
