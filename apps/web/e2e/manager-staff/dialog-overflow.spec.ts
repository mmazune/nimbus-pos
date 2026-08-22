import { test, expect, Page, Locator } from "@playwright/test";

import { MANAGER_CFG, managerLogin, MANAGER_STAFF_ROUTES } from "./fixtures";

/**
 * Track B6 (2026-08-22) — dialog overflow at the two short-viewport ends the
 * B5.7-GAP pass established for accounting (`e2e/manager-accounting/
 * dialog-overflow.spec.ts`), applied to B6's two new confirm dialogs:
 * employee status change (Suspend/Reactivate/Offboard) and revoke invitation.
 * Neither 1280x680 nor 1366x768 is a standard Playwright project — both are
 * forced explicitly via `page.setViewportSize`, matching the accounting spec's
 * own approach exactly (same helper, reimplemented here rather than imported,
 * since this file lives in a different e2e domain with its own fixtures).
 */

const SHORT_VIEWPORTS = [
  { width: 1280, height: 680 },
  { width: 1366, height: 768 },
] as const;

async function assertDialogFitsViewport(page: Page, dialog: Locator, primaryAction: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport not set");

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox, "dialog must have a bounding box (be laid out, not display:none)").not.toBeNull();
  if (!dialogBox) return;

  expect(dialogBox.x, "dialog left edge is not clipped off-screen").toBeGreaterThanOrEqual(0);
  expect(dialogBox.y, "dialog top edge is not clipped off-screen").toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width, "dialog right edge fits within the viewport width").toBeLessThanOrEqual(viewport.width + 1);
  expect(dialogBox.y + dialogBox.height, "dialog bottom edge fits within the viewport height").toBeLessThanOrEqual(viewport.height + 1);

  const actionBox = await primaryAction.boundingBox();
  expect(actionBox, "the primary action button must be laid out").not.toBeNull();
  if (!actionBox) return;
  expect(actionBox.y, "the primary action is not above the visible viewport").toBeGreaterThanOrEqual(0);
  expect(actionBox.y + actionBox.height, "the primary action is reachable within the viewport height").toBeLessThanOrEqual(viewport.height + 1);

  const position = await dialog.evaluate((el) => getComputedStyle(el.parentElement || el).position);
  expect(position, "the dialog's overlay wrapper is position:fixed, not flowed in-document").toBe("fixed");
}

for (const viewport of SHORT_VIEWPORTS) {
  test.describe(`B6 dialog overflow — ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
    });

    test("Suspend employee confirm dialog fits, with the Suspend button reachable", async ({ page }) => {
      await managerLogin(page);
      await page.goto(MANAGER_STAFF_ROUTES.directory);

      const firstCard = page.locator("[data-manager-employee-card]").first();
      await expect(firstCard).toBeVisible({ timeout: 30_000 });
      await firstCard.click();

      const suspendTrigger = page.getByRole("button", { name: /^suspend$/i }).first();
      await expect(suspendTrigger).toBeVisible();
      await suspendTrigger.click();

      const dialog = page.getByRole("dialog", { name: /^suspend/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^suspend$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
      await dialog.getByRole("button", { name: /^cancel$/i }).click();
    });

    test("Revoke invitation confirm dialog fits, with the reason field and Revoke button reachable", async ({ page }) => {
      const token = await (async () => {
        const res = await fetch(`${MANAGER_CFG.api}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: MANAGER_CFG.email, password: MANAGER_CFG.password }),
        });
        const json = await res.json();
        return json.accessToken as string;
      })();

      const createRes = await fetch(`${MANAGER_CFG.api}/api/onboarding/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Branch-Id": MANAGER_CFG.defaultBranchId,
        },
        body: JSON.stringify({
          invitations: [{ email: `zzqa.dialog.${Date.now()}@example-b6qa.test`, roleName: "Accountant" }],
        }),
      });
      test.skip(!createRes.ok, "invitation create is unavailable in this environment (onboarding:write not seeded)");

      await managerLogin(page);
      await page.goto(MANAGER_STAFF_ROUTES.invitations);

      const revokeButton = page.getByRole("button", { name: /^revoke$/i }).first();
      await expect(revokeButton).toBeVisible({ timeout: 30_000 });
      await revokeButton.click();

      const dialog = page.getByRole("dialog", { name: /revoke the invitation/i });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel(/reason/i)).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^revoke invitation$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
      await dialog.getByRole("button", { name: /^cancel$/i }).click();
    });
  });
}
