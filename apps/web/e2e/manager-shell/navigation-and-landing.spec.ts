import { test, expect } from "@playwright/test";

import { MANAGER_TABS, isDesktopTopNavViewport, managerLogin } from "./fixtures";

/**
 * Manager Track B1 (top-nav shell conversion) — login landing, the locked
 * six-menu module bar, dropdown navigation, and the /manager redirect.
 */
test.describe("Manager top-nav navigation + landing", () => {
  test("manager login lands on /manager/overview", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/, { timeout: 30_000 });
    expect(page.url()).toContain("/manager/overview");
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("the module bar is exactly Overview/Operations/Staff/Reports/Settings/Me", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4) — proven in shell-parity.spec.ts");
    const menubar = page.locator('[data-operational-top-nav] [role="menubar"]');
    await expect(menubar).toBeVisible();
    for (const label of MANAGER_TABS) {
      await expect(menubar.getByRole("menuitem", { name: new RegExp(`^${label}$`, "i") })).toBeVisible();
    }
    await expect(menubar.getByRole("menuitem")).toHaveCount(6);
    await expect(menubar.getByRole("menuitem", { name: /^more$/i })).toHaveCount(0);
    await expect(menubar.getByRole("menuitem", { name: /^approvals$/i })).toHaveCount(0);
    await expect(menubar.getByRole("menuitem", { name: /^accounting$/i })).toHaveCount(0);
  });

  test("Overview and Me navigate directly — no dropdown", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4) — proven in shell-parity.spec.ts");
    const menubar = page.locator('[data-operational-top-nav] [role="menubar"]');

    await menubar.getByRole("menuitem", { name: /^me$/i }).click();
    await page.waitForURL(/\/manager\/me/, { timeout: 30_000 });
    await expect(page.getByRole("menu")).toHaveCount(0);

    await menubar.getByRole("menuitem", { name: /^overview$/i }).click();
    await page.waitForURL(/\/manager\/overview/, { timeout: 30_000 });
  });

  for (const label of ["Operations", "Staff", "Reports", "Settings"] as const) {
    test(`${label} opens a dropdown and navigates through its real link`, async ({ page }) => {
      await managerLogin(page);
      await page.waitForURL(/\/manager\/overview/);
      test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4) — proven in shell-parity.spec.ts");
      const menubar = page.locator('[data-operational-top-nav] [role="menubar"]');
      const trigger = menubar.getByRole("menuitem", { name: new RegExp(`^${label}$`, "i") });

      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();

      const realLink = menu.getByRole("menuitem", { name: new RegExp(`^${label} dashboard$`, "i") });
      await expect(realLink).toBeVisible();
      await realLink.click();
      const slug = label.toLowerCase();
      await page.waitForURL(new RegExp(`/manager/${slug}`), { timeout: 30_000 });
      await expect(page.locator("[data-operational-shell]")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
    });
  }

  test("not-yet rows inside a dropdown are inert, never a live link", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4) — proven in shell-parity.spec.ts");
    const menubar = page.locator('[data-operational-top-nav] [role="menubar"]');
    await menubar.getByRole("menuitem", { name: /^operations$/i }).click();

    const notYetRow = page.getByRole("menu").getByText(/^Orders$/);
    await expect(notYetRow).toBeVisible();
    await expect(page.getByRole("menu").getByRole("link", { name: /^Orders$/ })).toHaveCount(0);
    // Every not-yet Operations row is tagged "B3" — assert at least one renders, not exactly one.
    await expect(page.getByRole("menu").getByText(/^B3$/).first()).toBeVisible();
    await expect(page.getByRole("menu").getByText(/^B3$/)).toHaveCount(4);
  });

  test("bare /manager redirects to /manager/overview", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager");
    await page.waitForURL(/\/manager\/overview/, { timeout: 30_000 });
    expect(page.url()).not.toMatch(/\/manager$/);
  });

  test("foundation pages state the boundary instead of showing fabricated data", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager/reports");
    await expect(page.getByText(/This surface is not built yet/i)).toBeVisible();
    // Track B2 re-tagged the not-yet badges from the superseded M-P* numbering to
    // the canonical Track B phases, matching the labels the top-nav tree already uses.
    await expect(page.getByText(/Live data arrives in B4/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/UGX\s?\d/);
  });
});
