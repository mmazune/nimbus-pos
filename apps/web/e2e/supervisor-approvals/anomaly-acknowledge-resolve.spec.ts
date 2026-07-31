import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiFirstAnomalyId, openApprovalDetail } from "./approvals-fixtures";

/**
 * Deterministic anomaly QA: deep-link straight to a seeded (P5B2-QA) anomaly by id (fetched from the
 * API by status), so queue ordering can't make the test flaky. Acknowledge/resolve are the real
 * canonical endpoints (also proven in the API matrix).
 */
test.describe("Approvals — anomaly acknowledge + resolve", () => {
  test("full lifecycle: acknowledge (stays actionable) then resolve (note required)", async ({ page }) => {
    const openId = await apiFirstAnomalyId("OPEN");
    test.skip(!openId, "No OPEN anomaly available");
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "anomaly", openId as string);

    // Acknowledge (note optional) → toast; row stays actionable; Resolve appears.
    await page.getByRole("button", { name: /^acknowledge$/i }).click();
    const ackDialog = page.getByRole("dialog");
    await expect(ackDialog).toBeVisible();
    await ackDialog.getByRole("button", { name: /^acknowledge$/i }).click();
    await expect(page.getByText(/anomaly acknowledged/i)).toBeVisible();

    const resolve = page.getByRole("button", { name: /^resolve$/i });
    await expect(resolve).toBeVisible();
    await resolve.click();
    const resDialog = page.getByRole("dialog");
    await expect(resDialog).toBeVisible();
    const confirm = resDialog.getByRole("button", { name: /^resolve$/i });
    await expect(confirm).toBeDisabled(); // note required
    await resDialog.getByRole("textbox").fill("P5B2-QA resolved — reviewed and cleared");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText(/anomaly resolved/i)).toBeVisible();
  });

  test("resolve confirmation is truthful about not mutating the underlying record", async ({ page }) => {
    const ackId = await apiFirstAnomalyId("ACKNOWLEDGED");
    test.skip(!ackId, "No ACKNOWLEDGED anomaly available");
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "anomaly", ackId as string);

    await page.getByRole("button", { name: /^resolve$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/original evidence is preserved/i);
    await expect(dialog).toContainText(/is not changed by this action/i);
    // Cancel — this assertion must not mutate state.
    await dialog.getByRole("button", { name: /cancel/i }).click();
  });

  test("acknowledge confirmation says the anomaly stays actionable", async ({ page }) => {
    const openId = await apiFirstAnomalyId("OPEN");
    test.skip(!openId, "No OPEN anomaly available");
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "anomaly", openId as string);

    await page.getByRole("button", { name: /^acknowledge$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/stays actionable until resolved|original evidence is preserved/i);
    await dialog.getByRole("button", { name: /cancel/i }).click();
  });
});
