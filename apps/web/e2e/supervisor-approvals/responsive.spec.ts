import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

/** Runs under all four viewport projects (see playwright.config.ts). */
test.describe("Approvals — responsive", () => {
  test("no horizontal overflow on queue and on an open detail", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await expectNoHorizontalOverflow(page);

    const rows = queueRows(page);
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await expect(page.getByRole("button", { name: /back to list/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    // Bottom nav does not cover the queue controls.
    await expect(page.getByRole("tab", { name: /needs action/i })).toBeVisible();
  });
});
