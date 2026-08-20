import { expect, test } from "@playwright/test";

import {
  captureConsoleErrors,
  card,
  DASHBOARD_CARDS,
  managerLogin,
  waitForDashboardSettled,
} from "./fixtures";

/**
 * Track B2 — the Overview dashboard renders live, branch-scoped data.
 *
 * These specs assert STRUCTURE and TRUTHFULNESS, never specific numbers: the
 * seeded demo branch's figures change with every order the other suites create,
 * so asserting "UGX 2,980,000" would be a flake, not a check.
 */
test.describe("Manager Overview dashboard", () => {
  test("renders all eight cards with live data and no console errors", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    await expect(page.locator("[data-manager-dashboard-grid]")).toBeVisible();
    await expect(page.locator("[data-manager-dashboard-card]")).toHaveCount(DASHBOARD_CARDS.length);

    for (const testId of DASHBOARD_CARDS) {
      const target = card(page, testId);
      await expect(target, `${testId} card is mounted`).toBeVisible();
      // A card must have settled into a real state — never left loading.
      await expect(
        target.locator('[data-manager-card-state="loading"]'),
        `${testId} is no longer loading`,
      ).toHaveCount(0);
    }

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("the sales card labels the tax basis instead of a bare gross/net", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const sales = card(page, "sales-today");
    await expect(sales.getByText("Sales today (tax-inclusive)")).toBeVisible();
    await expect(sales.getByText("Sales excluding tax")).toBeVisible();

    const salesText = (await sales.innerText()).toLowerCase();
    expect(salesText).not.toMatch(/(^|\s)gross sales(\s|$)/);
    expect(salesText).not.toMatch(/(^|\s)net sales(\s|$)/);
  });

  test("money renders in the branch currency with no fractional part", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const salesText = await card(page, "sales-today").innerText();
    // Either a real UGX figure, or an honest unavailable — never "UGX 0.00".
    expect(salesText).toMatch(/UGX [\d,]+|Unavailable/);
    expect(salesText).not.toMatch(/UGX [\d,]+\.\d/);
  });

  test("counts are drill-in links into the surface that owns them", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    await expect(card(page, "orders-today").getByRole("link", { name: "Open right now" })).toHaveAttribute(
      "href",
      "/manager/operations",
    );
    await expect(card(page, "approvals").getByRole("link", { name: "Leave requests" })).toHaveAttribute(
      "href",
      "/manager/staff",
    );

    await card(page, "open-orders").getByRole("link", { name: "Operations" }).click();
    await page.waitForURL(/\/manager\/operations/);
  });

  test("till and shift coverage is counts-only with no list and no drill-in", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const coverage = card(page, "coverage");
    await expect(coverage.getByText("Shifts open now")).toBeVisible();
    await expect(coverage.getByText("Tills open now")).toBeVisible();
    await expect(coverage).toContainText("no branch-wide tills or shifts list");
    // The two coverage counts are plain text, not links.
    await expect(coverage.getByRole("link", { name: "Tills open now" })).toHaveCount(0);
    await expect(coverage.locator("table")).toHaveCount(0);
  });

  test("charts expose their data to assistive technology", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const paymentMix = card(page, "payment-mix");
    const state = await paymentMix.locator("[data-manager-card-state]").getAttribute("data-manager-card-state");

    if (state === "ready") {
      const donut = paymentMix.locator('svg[role="img"]');
      await expect(donut).toHaveCount(1);
      await expect(donut.locator("title")).not.toBeEmpty();
      await expect(donut.locator("desc")).not.toBeEmpty();
    } else {
      // A branch with no payments today renders the honest empty state instead.
      expect(state).toBe("empty");
      await expect(paymentMix).toContainText("No completed payments");
    }
  });

  test("the branch readiness checklist states pass/attention in words", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/overview");
    await waitForDashboardSettled(page);

    const readiness = card(page, "readiness");
    await expect(readiness.getByText(/Ready|Attention/).first()).toBeVisible();
    await expect(readiness).toContainText("Branch");
  });
});
