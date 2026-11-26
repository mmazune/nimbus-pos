import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreatePendingDiscount, openApprovalDetail } from "./approvals-fixtures";

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — discount self-approval", () => {
  test("a self-requested discount shows a truthful self-approval notice", async ({ page }) => {
    const { discountId } = await apiCreatePendingDiscount(); // asked by the supervisor
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "discount", discountId);
    const panel = page.locator("[data-approval]");
    await expect(panel.getByText(/you asked for this discount yourself/i)).toBeVisible();
    await expect(panel.getByRole("button", { name: /approve the discount/i })).toBeEnabled();
  });
});
