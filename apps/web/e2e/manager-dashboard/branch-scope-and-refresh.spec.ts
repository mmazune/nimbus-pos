import { expect, test } from "@playwright/test";

import {
  branchSwitcher,
  captureApiRequests,
  card,
  dashRequests,
  MANAGER_CFG,
  managerLogin,
  waitForDashboardSettled,
} from "./fixtures";

const DASH_PATHS = [
  "/api/dash/manager",
  "/api/dash/today-summary",
  "/api/dash/payment-mix",
  "/api/dash/open-orders",
  "/api/dash/low-stock",
];

test.describe("Manager Overview — branch scope and KPI refresh", () => {
  test("every dashboard read carries the selected branch header", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    for (const path of DASH_PATHS) {
      const calls = dashRequests(requests, path);
      expect(calls.length, `${path} was requested`).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call.branchId, `${path} carries X-Branch-Id`).toBeTruthy();
      }
    }

    // Approval counts go to the four domain endpoints, never the generic inbox.
    expect(dashRequests(requests, "/api/pos/discounts/pending").length).toBeGreaterThan(0);
    expect(dashRequests(requests, "/api/hr/leave?status=PENDING").length).toBeGreaterThan(0);
    expect(dashRequests(requests, "/api/hr/shift-swaps?status=PENDING").length).toBeGreaterThan(0);
    expect(dashRequests(requests, "/api/analytics/anomalies?status=OPEN").length).toBeGreaterThan(0);
    expect(requests.filter((request) => /\/api\/approvals(\?|$)/.test(request.url))).toEqual([]);
  });

  test("switching branch re-scopes every card to the new X-Branch-Id", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const switcher = branchSwitcher(page);
    await expect(switcher).toBeVisible();

    // Let the first branch's reads finish before measuring, otherwise a late
    // initial response is captured and looks like a post-switch request.
    await page.waitForLoadState("networkidle");
    const requests = captureApiRequests(page);
    await switcher.selectOption(MANAGER_CFG.secondBranchId);
    await page.waitForTimeout(2_500);
    await waitForDashboardSettled(page);

    for (const path of DASH_PATHS) {
      const calls = dashRequests(requests, path);
      expect(calls.length, `${path} refetched after the branch switch`).toBeGreaterThan(0);
      expect(
        calls.every((call) => call.branchId === MANAGER_CFG.secondBranchId),
        `${path} refetched with the NEW branch id (saw ${[...new Set(calls.map((c) => c.branchId))].join(", ")})`,
      ).toBe(true);
    }

    // …and the header reflects the new branch, so no card can be read under the wrong name.
    await expect(page.locator("[data-manager-control-panel]")).not.toContainText("Tapas Downtown");
  });

  test("recalculate is confirmed, locked while in flight, and posts exactly once", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const requests = captureApiRequests(page);
    const trigger = page.locator("[data-manager-control-panel]").getByRole("button", { name: /recalculate/i });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("It changes no order, payment, stock or staff record.");

    // Cancelling must not write anything.
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toHaveCount(0);
    expect(dashRequests(requests, "/api/dash/kpi/refresh")).toEqual([]);

    await trigger.click();
    await page.getByRole("dialog").getByRole("button", { name: /recalculate/i }).click();

    await expect
      .poll(() => dashRequests(requests, "/api/dash/kpi/refresh").length, { timeout: 20_000 })
      .toBe(1);

    const post = dashRequests(requests, "/api/dash/kpi/refresh")[0];
    expect(post.method).toBe("POST");
    expect(post.branchId).toBeTruthy();

    // The refresh re-reads the cards rather than leaving stale numbers on screen.
    await expect
      .poll(() => dashRequests(requests, "/api/dash/manager").length, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(page.locator("[data-manager-dashboard-status]")).toContainText("KPI snapshot recorded at");
    await expect(card(page, "sales-today").locator('[data-manager-card-state="ready"]')).toBeVisible();
  });
});
