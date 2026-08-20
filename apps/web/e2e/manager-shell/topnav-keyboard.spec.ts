import { test, expect } from "@playwright/test";

import { isDesktopTopNavViewport, managerLogin } from "./fixtures";

/**
 * Manager Track B1 — keyboard-only traversal of the module bar and its
 * dropdowns (acceptance gate: full keyboard operation is mandatory, not just
 * mouse click-to-open). The desktop `role="menubar"` only exists at xl+
 * (OD-4); below that, the collapsed control's mechanics are covered by the
 * dedicated spec in shell-parity.spec.ts, so these tests skip there.
 */
test.describe("Manager top-nav keyboard operation", () => {
  test("ArrowRight/ArrowLeft/Home/End move focus across the menubar (roving tabindex)", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4)");

    const overview = page.getByRole("menuitem", { name: /^overview$/i });
    await overview.focus();
    await expect(overview).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menuitem", { name: /^operations$/i })).toBeFocused();

    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: /^me$/i })).toBeFocused();

    await page.keyboard.press("Home");
    await expect(overview).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("menuitem", { name: /^me$/i })).toBeFocused();
  });

  test("Enter/Space opens a dropdown, ArrowDown moves through items, Escape returns focus to the trigger", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4)");

    const trigger = page.getByRole("menuitem", { name: /^operations$/i });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const firstItem = page.getByRole("menu").getByRole("menuitem").first();
    await expect(firstItem).toBeFocused();

    await page.keyboard.press("ArrowDown");
    const items = page.getByRole("menu").getByRole("menuitem");
    await expect(items.nth(1)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking outside a dropdown closes it", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4)");

    await page.getByRole("menuitem", { name: /^staff$/i }).click();
    await expect(page.getByRole("menu")).toBeVisible();

    await page.mouse.click(20, 20);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("a route change closes any open dropdown", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    test.skip(!isDesktopTopNavViewport(page), "below xl the module bar collapses (OD-4)");

    await page.getByRole("menuitem", { name: /^reports$/i }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    // Track B4 replaced the "Reports dashboard" foundation link with the module's
    // first real surface. What this spec proves — a route change closes the
    // dropdown — is unchanged.
    await menu.getByRole("menuitem", { name: /^Catalog$/i }).click();
    await page.waitForURL(/\/manager\/reports/, { timeout: 30_000 });
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("the identity/logout menu is fully keyboard operable", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);

    const identityTrigger = page.getByRole("button", { name: /account menu/i });
    await identityTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: /my profile/i })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /^logout$/i })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(identityTrigger).toBeFocused();
  });
});
