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

  /**
   * The first REAL link inside each module's dropdown.
   *
   * B1 shipped every module with a single `"<Module> dashboard"` link to its
   * honest foundation page. **B3 replaced that for Operations and Staff, and B4
   * for Reports**, so those menus now open onto their first real surface
   * instead. Settings is the last module still carrying the B1 shape, and keeps
   * the original expectation until B6.
   *
   * This spec was last updated at B2 and had drifted behind both phases; the
   * invariant it protects — every module dropdown has a real, working link — is
   * unchanged.
   */
  const MODULE_REAL_LINK = {
    Operations: /^Orders$/i,
    Staff: /^Directory$/i,
    Reports: /^Catalog$/i,
    Settings: /^Settings dashboard$/i,
  } as const;

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

      const realLink = menu.getByRole("menuitem", { name: MODULE_REAL_LINK[label] });
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
    // Settings is the last module whose tree is still mostly not-yet, so it is
    // where this invariant can still be observed. Operations/Staff (B3) and
    // Reports (B4) are now built, and their rows are real links by design.
    await menubar.getByRole("menuitem", { name: /^settings$/i }).click();

    const notYetRow = page.getByRole("menu").getByText(/^Branch profile$/);
    await expect(notYetRow).toBeVisible();
    await expect(page.getByRole("menu").getByRole("link", { name: /^Branch profile$/ })).toHaveCount(0);
    // Every not-yet Settings row is tagged "B6".
    await expect(page.getByRole("menu").getByText(/^B6$/).first()).toBeVisible();
    await expect(page.getByRole("menu").getByText(/^B6$/)).toHaveCount(6);
  });

  test("bare /manager redirects to /manager/overview", async ({ page }) => {
    await managerLogin(page);
    await page.goto("/manager");
    await page.waitForURL(/\/manager\/overview/, { timeout: 30_000 });
    expect(page.url()).not.toMatch(/\/manager$/);
  });

  test("foundation pages state the boundary instead of showing fabricated data", async ({ page }) => {
    await managerLogin(page);
    // Settings is the ONLY surface still on the honest foundation screen:
    // Overview graduated at B2, Operations and Staff at B3, Reports at B4.
    await page.goto("/manager/settings");
    await expect(page.getByText(/This surface is not built yet/i)).toBeVisible();
    // Track B2 re-tagged the not-yet badges from the superseded M-P* numbering to
    // the canonical Track B phases, matching the labels the top-nav tree already uses.
    await expect(page.getByText(/Live data arrives in B6/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/UGX\s?\d/);
  });
});
