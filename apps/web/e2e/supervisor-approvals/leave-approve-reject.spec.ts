import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { domainRows, gotoApprovals } from "./approvals-fixtures";

/**
 * Leave decisions run against seeded pending leave on the disposable branch.
 * (Leave cannot be created for others via the self-scoped create API, so the
 * QA branch seeds PENDING leave rows — see the QA record register.)
 */

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — leave decisions", () => {
  test("approve a pending leave request → it leaves Waiting", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    const rows = domainRows(page, /^leave$/i);
    test.skip((await rows.count()) === 0, "No pending leave on this branch");
    await rows.first().click();
    const panel = page.locator("[data-approval]");
    await expect(panel.getByText(/does not change payroll/i)).toBeVisible();
    await panel.getByRole("button", { name: /approve the leave/i }).click();
    await expect(panel.getByText(/leave approved/i)).toBeVisible();
  });

  test("decline a pending leave request", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    const rows = domainRows(page, /^leave$/i);
    test.skip((await rows.count()) === 0, "No pending leave on this branch");
    await rows.first().click();
    const panel = page.locator("[data-approval]");
    await panel.getByRole("button", { name: /^decline$/i }).click();
    const dialog = page.getByRole("dialog", { name: "Decline the leave" });
    await dialog.getByLabel(/^why/i).fill("QA rejection");
    await dialog.getByRole("button", { name: /^decline$/i }).click();
    await expect(panel.getByText(/leave declined/i)).toBeVisible();
  });
});
