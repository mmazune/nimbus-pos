import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiFirstAnomalyId, openApprovalDetail } from "./approvals-fixtures";

/**
 * Deterministic anomaly QA: deep-link straight to a seeded (P5B2-QA) anomaly by id (fetched from the
 * API by status), so queue ordering can't make the test flaky. Acknowledge/resolve are the real
 * canonical endpoints (also proven in the API matrix).
 */

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — anomaly acknowledge + resolve", () => {
  test("full lifecycle: acknowledge (stays actionable) then resolve (note required)", async ({ page }) => {
    const openId = await apiFirstAnomalyId("OPEN");
    test.skip(!openId, "No OPEN anomaly available");
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "anomaly", openId as string);
    const panel = page.locator("[data-approval]");
    await panel.getByRole("button", { name: /^acknowledge$/i }).click();
    await expect(panel.getByText(/alert acknowledged/i)).toBeVisible();
    await panel.getByRole("button", { name: /^mark resolved$/i }).click();
    const dialog = page.getByRole("dialog", { name: "Mark resolved" });
    await dialog.getByRole("button", { name: /^mark resolved$/i }).click();
    await expect(dialog.getByText("Write why.")).toBeVisible(); // note required
    await dialog.getByLabel(/what was done/i).fill("P5B2-QA resolved — reviewed and cleared");
    await dialog.getByRole("button", { name: /^mark resolved$/i }).click();
    await expect(panel.getByText(/alert resolved/i)).toBeVisible();
  });

  test("resolve confirmation is truthful about not mutating the underlying record", async ({ page }) => {
    const ackId = await apiFirstAnomalyId("ACKNOWLEDGED");
    test.skip(!ackId, "No ACKNOWLEDGED anomaly available");
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "anomaly", ackId as string);
    await page.locator("[data-approval]").getByRole("button", { name: /^mark resolved$/i }).click();
    const dialog = page.getByRole("dialog", { name: "Mark resolved" });
    await expect(dialog).toContainText(/original evidence is kept/i);
    await expect(dialog).toContainText(/is not changed by this action/i);
    await dialog.getByRole("button", { name: /cancel/i }).click();
  });

  test("acknowledge says the alert stays actionable", async ({ page }) => {
    const openId = await apiFirstAnomalyId("OPEN");
    test.skip(!openId, "No OPEN anomaly available");
    await uiLogin(page, "supervisor");
    await openApprovalDetail(page, "anomaly", openId as string);
    await expect(page.locator("[data-approval]")).toContainText(/keeps it here until it is resolved/i);
  });
});
