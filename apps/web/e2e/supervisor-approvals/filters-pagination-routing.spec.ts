import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals } from "./approvals-fixtures";

test.describe("Approvals — filters, routing & URL state", () => {
  test("scope + domain changes are reflected in the URL and survive refresh", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);

    // Switch scope → Resolved. URL gains ?scope=resolved.
    await page.getByRole("tab", { name: /resolved/i }).click();
    await expect(page).toHaveURL(/scope=resolved/);

    // Switch domain → Leave. URL gains ?domain=leave.
    await page.getByRole("button", { name: /^leave$/i }).click();
    await expect(page).toHaveURL(/domain=leave/);

    // Refresh preserves scope + domain (the real requirement).
    await page.reload();
    await expect(page).toHaveURL(/scope=resolved/);
    await expect(page).toHaveURL(/domain=leave/);
    await expect(page.getByRole("tab", { name: /resolved/i })).toHaveAttribute("aria-selected", "true");

    // Filter changes use replace()-routing (no per-filter history entries, matching
    // Reservations), so Back returns to the prior page cleanly — stable, no crash.
    await page.goBack();
    await expect(page).toHaveURL(/\/supervisor\//);
    await expect(page.locator("body")).toBeVisible();
  });

  test("Resolved/History omit the Discounts domain (no branch-wide endpoint)", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);

    // Needs action shows Discounts.
    await expect(page.getByRole("button", { name: /^discounts$/i })).toBeVisible();

    await page.getByRole("tab", { name: /resolved/i }).click();
    await expect(page.getByRole("button", { name: /^discounts$/i })).toHaveCount(0);

    await page.getByRole("tab", { name: /history/i }).click();
    await expect(page.getByRole("button", { name: /^discounts$/i })).toHaveCount(0);
  });

  test("forcing discount history via URL shows a truthful order-scoped notice", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/approvals?scope=history&domain=discount");
    await expect(page.getByText(/available from the related order/i)).toBeVisible();
  });

  test("History exposes a date-range toolbar that maps to URL params", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/approvals?scope=history");
    const from = page.getByLabel(/history date from/i);
    await expect(from).toBeVisible();
    await from.fill("2026-01-01");
    await expect(page).toHaveURL(/from=2026-01-01/);
  });
});
