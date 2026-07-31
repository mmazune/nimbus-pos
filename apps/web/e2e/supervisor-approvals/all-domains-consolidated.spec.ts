import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

test.describe("Approvals — consolidated four-domain closure", () => {
  test("all four domains filter cleanly across Needs action", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);

    for (const name of [/^discounts$/i, /^leave$/i, /^shift swaps$/i, /^anomalies$/i]) {
      await page.getByRole("button", { name }).click();
      await page.waitForLoadState("networkidle").catch(() => {});
      // Either rows or a truthful empty state — never a crash.
      const rows = queueRows(page);
      const empty = page.getByText(/no approvals need action|no .* need action/i);
      await expect(async () => {
        expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
      }).toPass();
    }

    // Back to All, four-tab nav intact, no Orders.
    await page.getByRole("button", { name: /^all$/i }).click();
    expect(await page.getByRole("link", { name: /^orders$/i }).count()).toBe(0);
  });

  test("Resolved omits discounts but supports leave / shift-swap / anomaly", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("tab", { name: /resolved/i }).click();
    await expect(page.getByRole("button", { name: /^discounts$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^leave$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^shift swaps$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^anomalies$/i })).toBeVisible();
  });
});
