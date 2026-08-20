import { test, expect } from "@playwright/test";

import { MANAGER_TABS, managerLogin } from "./fixtures";

/**
 * Manager M-P1 — login landing, the locked six-tab nav, and the /manager redirect.
 */
test.describe("Manager navigation + landing", () => {
  test("manager login lands on /manager/overview", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/, { timeout: 30_000 });
    expect(page.url()).toContain("/manager/overview");
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("the bottom nav is exactly Overview/Operations/Staff/Reports/Settings/Me", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);
    const nav = page.locator("[data-operational-bottom-nav]");
    await expect(nav).toBeVisible();
    for (const label of MANAGER_TABS) {
      await expect(nav.getByRole("link", { name: new RegExp(`^${label}$`, "i") })).toBeVisible();
    }
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: /^more$/i })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /^approvals$/i })).toHaveCount(0);
  });

  test("every tab navigates and marks itself current", async ({ page }) => {
    await managerLogin(page);
    await page.waitForURL(/\/manager\/overview/);

    for (const label of MANAGER_TABS) {
      const link = page.locator("[data-operational-bottom-nav]").getByRole("link", {
        name: new RegExp(`^${label}$`, "i"),
      });
      await link.click();
      const slug = label.toLowerCase();
      await page.waitForURL(new RegExp(`/manager/${slug}`), { timeout: 30_000 });
      await expect(link).toHaveAttribute("aria-current", /page|true/);
      await expect(page.locator("[data-operational-shell]")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
    }
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
    await expect(page.getByText(/Live data arrives in M-P5/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/UGX\s?\d/);
  });
});
