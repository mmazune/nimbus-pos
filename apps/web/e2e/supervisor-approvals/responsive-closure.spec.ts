import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";
import { domainRows, gotoApprovals } from "./approvals-fixtures";

/** Runs under all four viewport projects — shift-swap + anomaly details and their dialogs fit. */

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — responsive closure (shift-swap + anomaly)", () => {
  for (const domain of [/^shift swaps$/i, /^anomalies$/i]) {
    test(`${domain.source} detail + sheet have no horizontal overflow`, async ({ page }) => {
      await uiLogin(page, "supervisor");
      await gotoApprovals(page);
      const rows = domainRows(page, domain);
      test.skip((await rows.count()) === 0, "No rows for this kind on this branch");
      await rows.first().click();
      await expect(page.locator("[data-approval]")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const actionBtn = page.locator("[data-approval]").getByRole("button", { name: /decline the swap|^mark resolved$/i }).first();
      if (await actionBtn.count()) {
        await actionBtn.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await dialog.getByRole("button", { name: /cancel/i }).click();
      }
    });
  }
});
