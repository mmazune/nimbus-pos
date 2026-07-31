import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

/** Runs under all four viewport projects — shift-swap + anomaly details and their dialogs fit. */
test.describe("Approvals — responsive closure (shift-swap + anomaly)", () => {
  for (const domain of [/^shift swaps$/i, /^anomalies$/i]) {
    test(`${domain.source} detail + dialog have no horizontal overflow`, async ({ page }) => {
      await uiLogin(page, "supervisor");
      await gotoApprovals(page);
      await page.getByRole("button", { name: domain }).click();
      await page.waitForLoadState("networkidle").catch(() => {});

      const count = await queueRows(page).count();
      test.skip(count === 0, "No rows for this domain on this branch");
      await queueRows(page).first().click();
      await expect(page.getByRole("button", { name: /back to list/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Open the first available action dialog and confirm it fits, then cancel.
      const actionBtn = page
        .getByRole("button", { name: /reject request|^acknowledge$|^resolve$/i })
        .first();
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
