import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { domainRows, gotoApprovals, selectRowWithAction } from "./approvals-fixtures";

/**
 * Shift-swap — Prompt 5B2 Outcome C: Reject is truthful and available; Approve is NOT exposed
 * (roster reassignment is unsupported), and the UI says so honestly.
 */

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — shift-swap (Outcome C)", () => {
  test("pending shift-swap detail shows no Approve control + a truthful notice", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    const rows = domainRows(page, /^shift swaps$/i);
    test.skip((await rows.count()) === 0, "No pending shift swaps on this branch");
    await rows.first().click();
    const panel = page.locator("[data-approval]");
    await expect(panel.getByText(/the roster cannot be changed yet/i)).toBeVisible();
    expect(await panel.getByRole("button", { name: /^approve/i }).count()).toBe(0);
    await expect(panel.getByRole("button", { name: /decline the swap/i })).toBeVisible();
  });

  test("declining a shift-swap records the decision and changes no schedule", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    const found = await selectRowWithAction(page, /decline the swap/i, 8, domainRows(page, /^shift swaps$/i));
    test.skip(!found, "No actionable pending shift swap on this branch");
    await page.locator("[data-approval]").getByRole("button", { name: /decline the swap/i }).click();
    const dialog = page.getByRole("dialog", { name: "Decline the swap" });
    await expect(dialog.getByText(/no schedule or shift assignment is changed/i)).toBeVisible();
    await dialog.getByRole("button", { name: /decline the swap/i }).click();
    await expect(page.locator("[data-approval]").getByText(/shift swap declined/i)).toBeVisible();
  });
});
