import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

test.describe("Approvals — discount self-approval", () => {
  test("a self-requested discount shows a truthful self-approval notice", async ({ page }) => {
    // Seeded P5B1-QA discounts are created by the Supervisor (self-requested).
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^discounts$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(queueRows(page).first()).toBeVisible();
    await queueRows(page).first().click();

    // Truthful governance copy — approval is permitted but recorded.
    await expect(page.getByText(/you requested this discount/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /approve discount/i })).toBeEnabled();
  });
});
