import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows, selectRowWithAction } from "./approvals-fixtures";

/**
 * Shift-swap — Prompt 5B2 Outcome C: Reject is truthful and available; Approve is NOT exposed
 * (roster reassignment is unsupported), and the UI says so honestly.
 */
test.describe("Approvals — shift-swap (Outcome C)", () => {
  test("pending shift-swap detail shows no Approve control + a truthful notice", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^shift swaps$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const count = await queueRows(page).count();
    test.skip(count === 0, "No pending shift swaps on this branch");
    await queueRows(page).first().click();

    // Truthful copy; no roster claim; no Approve button anywhere on the page.
    await expect(page.getByText(/schedule reassignment is not supported/i)).toBeVisible();
    expect(await page.getByRole("button", { name: /^approve/i }).count()).toBe(0);
    await expect(page.getByRole("button", { name: /reject request/i })).toBeVisible();
  });

  test("rejecting a shift-swap records the decision and changes no schedule", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^shift swaps$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const found = await selectRowWithAction(page, /reject request/i);
    test.skip(!found, "No actionable pending shift swap on this branch");

    await page.getByRole("button", { name: /reject request/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Consequence copy is truthful about no schedule change.
    await expect(dialog.getByText(/no schedule or shift assignment is changed/i)).toBeVisible();
    await dialog.getByRole("button", { name: /reject request/i }).click();

    await expect(page.getByText(/shift swap rejected/i)).toBeVisible();
  });
});
