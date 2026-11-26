import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreatePendingDiscount, domainRows, gotoApprovals } from "./approvals-fixtures";

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

// The domain chips and the date-range toolbar are not in the drawing and were removed
// (listed in the T1 report); the view and the open request stay in the URL.
test.describe("Approvals — filters, routing & URL state", () => {
  test("the view is reflected in the URL and survives refresh", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("tab", { name: /^Done today/ }).click();
    await expect(page).toHaveURL(/view=done/);
    await page.reload();
    await expect(page).toHaveURL(/view=done/);
    await expect(page.getByRole("tab", { name: /^Done today/ })).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await expect(page).toHaveURL(/\/supervisor\//);
    await expect(page.locator("body")).toBeVisible();
  });

  test("Done today and History hold no discounts (no branch-wide endpoint)", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/approvals?view=history");
    await expect(page.getByRole("tab", { name: /^History$/ })).toHaveAttribute("aria-selected", "true");
    await expect(domainRows(page, /^discounts$/i)).toHaveCount(0);
    await expect(page.getByText(/leave, swaps and alerts/i)).toBeVisible();
  });

  test("an old deep link (selDomain + selId) still opens the request", async ({ page }) => {
    const { discountId } = await apiCreatePendingDiscount();
    await uiLogin(page, "supervisor");
    await page.goto(`/supervisor/approvals?selDomain=discount&selId=${discountId}`);
    await expect(page.locator(`[data-approval="discount:${discountId}"]`)).toBeVisible();
  });

  test("History pages with Newer / Older", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/approvals?view=history");
    await expect(page.getByRole("button", { name: /^newer$/i })).toBeDisabled();
    await expect(page.getByText(/^Page 1 /)).toBeVisible();
  });
});
