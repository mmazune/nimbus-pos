import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";
import { gotoApprovals } from "./approvals-fixtures";

test.describe("Approvals — navigation & default queue", () => {
  test("defaults to Needs action / All, keeps four-tab nav, no Orders", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);

    // Scope selector present; Needs action is the default selected tab.
    const needsAction = page.getByRole("tab", { name: /needs action/i });
    await expect(needsAction).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /resolved/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /history/i })).toBeVisible();

    // Domain filter: All + four domains, All pressed by default.
    await expect(page.getByRole("button", { name: /^all$/i })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^discounts$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^leave$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^shift swaps$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^anomalies$/i })).toBeVisible();

    // Locked nav: Approvals present, Orders absent.
    await expect(page.getByRole("link", { name: /approvals/i }).first()).toBeVisible();
    expect(await page.getByRole("link", { name: /^orders$/i }).count()).toBe(0);

    // Default URL is clean (no scope param → needs-action).
    expect(new URL(page.url()).searchParams.get("scope")).toBeNull();

    await expectNoHorizontalOverflow(page);
  });

  test("empty selection shows the placeholder detail", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await expect(page.getByText(/select an approval/i)).toBeVisible();
  });
});
