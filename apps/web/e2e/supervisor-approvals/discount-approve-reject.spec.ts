import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

test.describe("Approvals — discount decisions", () => {
  test("approve a pending discount → toast + terminal state", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^discounts$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(queueRows(page).first()).toBeVisible();
    await queueRows(page).first().click();

    // Detail loads with an Approve action (fresh unpaid order → not payment-blocked).
    const approve = page.getByRole("button", { name: /approve discount/i });
    await expect(approve).toBeVisible();
    await approve.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /approve discount/i }).click();

    await expect(page.getByText(/discount approved/i)).toBeVisible();
  });

  test("reject a pending discount requires a reason → toast", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("button", { name: /^discounts$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(queueRows(page).first()).toBeVisible();
    await queueRows(page).first().click();

    await page.getByRole("button", { name: /^reject$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Confirm is disabled until a reason is entered.
    const confirm = dialog.getByRole("button", { name: /reject discount/i });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("QA rejection — not authorised");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText(/discount rejected/i)).toBeVisible();
  });
});
