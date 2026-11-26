import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

/** Runs under all four viewport projects (see playwright.config.ts). */

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — responsive", () => {
  test("no horizontal overflow on the list and on an open request", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await expectNoHorizontalOverflow(page);
    const rows = queueRows(page);
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await expect(page.locator("[data-approval]")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    await expect(page.getByRole("tab", { name: /^Waiting/ })).toBeVisible();
  });
});
