import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Cross-role closure: only the Supervisor has Approvals + decision controls. Cashier and Waiter
 * never see Approvals. (Cross-role roster/anomaly state is verified via API/DB in the QA matrices,
 * since no employee-facing schedule UI exists.)
 */

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — cross-role visibility", () => {
  test("Cashier has its own nav and no Approvals", async ({ page }) => {
    await uiLogin(page, "cashier");
    expect(await page.getByRole("link", { name: /approvals/i }).count()).toBe(0);
    await expect(page.getByRole("link", { name: /^floor$/i }).first()).toBeVisible();
  });

  test("Waiter has no Approvals and no decision controls", async ({ page }) => {
    await uiLogin(page, "waiter");
    expect(await page.getByRole("link", { name: /approvals/i }).count()).toBe(0);
    await page.goto("/supervisor/approvals");
    await expect(page.locator("section[aria-label='Waiting']")).toHaveCount(0);
  });
});
