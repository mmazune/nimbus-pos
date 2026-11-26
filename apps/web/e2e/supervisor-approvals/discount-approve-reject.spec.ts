import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreatePendingDiscount, openApprovalDetail } from "./approvals-fixtures";

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — discount decisions", () => {
  test("approve a pending discount → terminal state", async ({ page }) => {
    const { discountId } = await apiCreatePendingDiscount();
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "discount", discountId);
    const panel = page.locator("[data-approval]");
    const approve = panel.getByRole("button", { name: /approve the discount/i });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expect(panel.getByText(/discount approved/i)).toBeVisible();
  });

  test("reject a pending discount requires a reason", async ({ page }) => {
    const { discountId } = await apiCreatePendingDiscount();
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "discount", discountId);
    const panel = page.locator("[data-approval]");
    await panel.getByRole("button", { name: /^decline$/i }).click();
    const dialog = page.getByRole("dialog", { name: "Decline the discount" });
    await dialog.getByRole("button", { name: /^decline$/i }).click();
    await expect(dialog.getByText("Write why.")).toBeVisible();
    await dialog.getByLabel(/^why/i).fill("QA rejection — not authorised");
    await dialog.getByRole("button", { name: /^decline$/i }).click();
    await expect(panel.getByText(/discount declined/i)).toBeVisible();
  });
});
