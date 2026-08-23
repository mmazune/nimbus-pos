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

    // Track B6.7 (2026-08-22) — the new credential-reset confirm dialog.
    //
    // ⚠️ Does NOT rely on directory ordering or loop through cards. The demo
    // org accumulates a ZZQA-tagged fixture employee from every onboarding
    // spec run (PIN-only by default), so "click the first card, fall back
    // through the rest" degrades badly as the directory grows — after
    // repeated runs it holds 100+ people, most PIN-only, and a scan loop
    // both risks the 60s test timeout and can misread a still-loading
    // (visible-but-disabled) button as ineligible. Instead this test creates
    // its OWN password-login fixture via the API (same pattern as "Revoke
    // invitation confirm dialog" above) and reaches it through the search
    // box — a bounded, single API round trip instead of an unbounded scan.
    test("Reset credential confirm dialog fits, with the Reset credential button reachable", async ({
      page,
    }) => {
      const token = await (async () => {
        const res = await fetch(`${MANAGER_CFG.api}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: MANAGER_CFG.email, password: MANAGER_CFG.password }),
        });
        const json = await res.json();
        return json.accessToken as string;
      })();

      const uniqueName = `ZZQA-B67-Dialog-${Date.now()}`;
      const onboardRes = await fetch(`${MANAGER_CFG.api}/api/hr/frontline-staff/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Branch-Id": MANAGER_CFG.defaultBranchId,
        },
        body: JSON.stringify({
          email: `zzqa.dialog.${Date.now()}@example-b6qa.test`,
          firstName: uniqueName,
          lastName: "DialogFixture",
          phone: `+2507${String(Date.now()).slice(-8)}`,
          roleName: "Cashier",
          enablePasswordLogin: true,
          temporaryPassword: "ZZQA-Dialog#Strong2026",
          issueQuickPin: false,
          employee: { hireDate: "2026-08-01", employmentType: "PERMANENT" },
        }),
      });
      test.skip(!onboardRes.ok, "frontline onboarding is unavailable in this environment");

      await managerLogin(page);
      await page.goto(MANAGER_STAFF_ROUTES.directory);
      await page.getByPlaceholder("Search name, code or email…").fill(uniqueName);

      const card = page.locator("[data-manager-employee-card]", { hasText: uniqueName });
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.click();

      const trigger = page.locator("[data-manager-credential-reset-action]").getByRole("button", {
        name: /reset credential|send a new reset/i,
      });
      await expect(trigger).toBeEnabled({ timeout: 30_000 });
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: /reset credential for/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /reset credential|send a new reset/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
      // Never a Manager-set secret — no password/PIN input anywhere in this dialog.
      await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
      await dialog.getByRole("button", { name: /^cancel$/i }).click();
    });
  });
}
