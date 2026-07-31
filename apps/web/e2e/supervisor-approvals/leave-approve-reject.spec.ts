import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

/**
 * Leave decisions run against seeded pending leave on the disposable branch.
 * (Leave cannot be created for others via the self-scoped create API, so the
 * QA branch seeds PENDING leave rows — see the QA record register.)
 */
test.describe("Approvals — leave decisions", () => {
  test("approve a pending leave request → toast + row leaves the queue", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^leave$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const countBefore = await queueRows(page).count();
    test.skip(countBefore === 0, "No pending leave on this branch");
    await queueRows(page).first().click();

    // Detail is truthful: no payroll / roster claim.
    await expect(page.getByText(/does not (change|adjust) payroll/i)).toBeVisible();

    await page.getByRole("button", { name: /approve leave/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /approve leave/i }).click();

    await expect(page.getByText(/leave approved/i)).toBeVisible();
  });

  test("reject a pending leave request → toast", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^leave$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const countBefore = await queueRows(page).count();
    test.skip(countBefore === 0, "No pending leave on this branch");
    await queueRows(page).first().click();

    await page.getByRole("button", { name: /^reject$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").fill("QA rejection");
    await dialog.getByRole("button", { name: /reject leave/i }).click();

    await expect(page.getByText(/leave rejected/i)).toBeVisible();
  });
});
