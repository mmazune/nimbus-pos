import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { MANAGER_TABS, managerLogin } from "./fixtures";

/**
 * Manager M-P1 — cross-role boundaries.
 *
 * Note on the expected behaviour: every existing role guard renders a BLOCKED STATE
 * with a "Return to login" action rather than auto-redirecting. Manager mirrors that
 * exactly, so these specs assert the blocked state (and the reason the button carries),
 * not a silent redirect.
 */
test.describe("Manager role boundaries", () => {
  for (const role of ["waiter", "cashier", "supervisor"] as const) {
    test(`${role} cannot open /manager/overview`, async ({ page }) => {
      await uiLogin(page, role);
      await page.goto("/manager/overview");
      await expect(page.getByRole("heading", { name: /Manager access required/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("[data-operational-bottom-nav]")).toHaveCount(0);

      await page.getByRole("button", { name: /return to login/i }).click();
      // The guard clears the session and replaces to /login?reason=manager_only. The
      // shared session effect present in EVERY role guard can then replace the reason
      // with session_required, so the deterministic assertion is "returned to login with
      // a stated reason"; the manager_only copy itself is asserted separately below.
      await page.waitForURL(/\/login/, { timeout: 30_000 });
      await expect(page.getByRole("button", { name: /^sign in$|^email$/i }).first()).toBeVisible();
      await expect(page.getByRole("status").first()).toBeVisible();
    });
  }

  test("/login?reason=manager_only states the manager-only boundary", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {
        // storage access can be restricted in some contexts
      }
    });
    await page.goto("/login?reason=manager_only");
    await expect(page.getByText(/available to manager accounts only/i)).toBeVisible();
  });

  for (const [role, route, copy] of [
    ["waiter", "/waiter/floor", /Waiter workspace only/i],
    ["cashier", "/cashier/floor", /Cashier access required/i],
    ["supervisor", "/supervisor/floor", /Supervisor access required/i],
  ] as const) {
    test(`manager cannot open the ${role} workspace`, async ({ page }) => {
      await managerLogin(page);
      await page.waitForURL(/\/manager\/overview/);
      await page.goto(route);
      await expect(page.getByRole("heading", { name: copy })).toBeVisible({ timeout: 20_000 });
    });
  }

  test("the manager workspace exposes no operational write affordance in M-P1", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    for (const tab of MANAGER_TABS.filter((label) => label !== "Me")) {
      await page.goto(`/manager/${tab.toLowerCase()}`);
      for (const name of [
        /take payment/i,
        /collect payment/i,
        /close order/i,
        /add item/i,
        /send to kitchen/i,
        /approve/i,
        /reject/i,
        /void/i,
        /refund/i,
      ]) {
        await expect(page.getByRole("button", { name })).toHaveCount(0);
      }
    }
  });
});
