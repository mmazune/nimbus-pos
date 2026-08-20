import { test, expect } from "@playwright/test";

import { expectNoHorizontalOverflow, uiLogin } from "../supervisor-prompt3/fixtures";
import { MANAGER_TABS, branchSwitcher, managerLogin } from "./fixtures";

/**
 * Manager Track B1 — shared-shell parity. Manager renders the additive
 * `navigation="top"` variant of the SAME `OperationalShell`; the three
 * frontline roles keep the "bottom" default and must render byte-identically.
 */
test.describe("Manager shared-shell parity (top nav)", () => {
  test("manager renders the shared shell regions, the top nav, and the brand logomark", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    await expect(page.locator("[data-operational-shell]")).toBeVisible();
    await expect(page.locator("[data-operational-shell]")).toHaveAttribute("data-operational-shell-nav", "top");
    await expect(page.locator("[data-operational-top-nav]")).toBeVisible();
    // The retired bottom-nav-era header/bottom-bar markup must not be present for Manager.
    await expect(page.locator("[data-operational-header]")).toHaveCount(0);
    await expect(page.locator("[data-operational-bottom-nav]")).toHaveCount(0);
    await expect(page.locator("[data-manager-readiness]")).toBeVisible();
    await expect(page.locator("[data-operational-top-nav] svg").first()).toBeVisible();
    await expect(page.getByLabel(/current time/i)).toBeVisible();

    // Logout lives inside the identity/logout dropdown now, not a standalone button.
    await expect(page.getByRole("button", { name: /log out/i })).toHaveCount(0);
    const identityTrigger = page.getByRole("button", { name: /account menu/i });
    await expect(identityTrigger).toBeVisible();
    await identityTrigger.click();
    await expect(page.getByRole("menuitem", { name: /my profile/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^logout$/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("no manager surface overflows horizontally at 1024x768", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    for (const tab of MANAGER_TABS) {
      await page.goto(`/manager/${tab.toLowerCase()}`);
      await expect(page.locator("[data-operational-top-nav]")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("OD-4: below the xl breakpoint the module bar collapses to a single Menu control", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    await page.setViewportSize({ width: 900, height: 700 });

    const menubar = page.locator('[data-operational-top-nav] [role="menubar"]');
    await expect(menubar).toBeHidden();
    const menuButton = page.getByRole("button", { name: /open navigation menu/i });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    const collapsedMenu = page.getByRole("menu").last();
    await expect(collapsedMenu.getByRole("menuitem", { name: /^overview$/i })).toBeVisible();
    await expect(collapsedMenu.getByText(/^Operations$/)).toBeVisible();

    // It never falls back to the frontline bottom nav.
    await expect(page.locator("[data-operational-bottom-nav]")).toHaveCount(0);
  });

  for (const [role, landing] of [
    ["waiter", /\/waiter\/floor/],
    ["cashier", /\/cashier\/floor/],
    ["supervisor", /\/supervisor\/floor/],
  ] as const) {
    test(`${role} still renders the byte-identical bottom-nav shell (header, no top nav, no switcher)`, async ({ page }) => {
      await uiLogin(page, role);
      await page.waitForURL(landing, { timeout: 30_000 });
      await expect(page.locator("[data-operational-shell]")).toHaveAttribute("data-operational-shell-nav", "bottom");
      await expect(page.locator("[data-operational-header]")).toBeVisible();
      await expect(page.locator("[data-operational-bottom-nav]")).toBeVisible();
      await expect(page.locator("[data-operational-top-nav]")).toHaveCount(0);
      await expect(branchSwitcher(page)).toHaveCount(0);
      await expect(page.locator("[data-manager-branch-switcher]")).toHaveCount(0);
      await expect(page.getByLabel(/current time/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /log out/i }).first()).toBeVisible();
    });
  }
});
