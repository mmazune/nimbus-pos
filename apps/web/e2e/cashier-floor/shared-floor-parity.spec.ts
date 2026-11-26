import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — Cashier renders the SAME shared OperationalFloor surface as
 * Waiter/Supervisor (toolbar, search, filters, grid), with no Cashier-only
 * guest/payment data and no Cashier-only Find/settlement control in C1.
 */
test.describe("Cashier shared Floor parity", () => {
  // T1 (26 Nov 2026, drawing Main / R11): the status filter chips are replaced by area chips
  // and the header's "Find a table" search; the grid is the shared kit Floor.
  test("shared Floor (area chips + header search) and table grid render", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);

    await expect(page.getByRole("button", { name: /find a table/i }).first()).toBeVisible();
    await expect(page.getByRole("group", { name: "Areas" })).toBeVisible();
    await expect(page.locator("[data-floor-grid]")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^floor$/i }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Cannot reach Nimbus API/i);
  });

  test("Cashier exposes its Find bill sibling but not Supervisor's Find order (C2)", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    // C2 adds the Cashier-only Find bill sibling above the shared Floor.
    await expect(page.getByRole("button", { name: /find bill/i })).toBeVisible();
    // Supervisor's Find order never leaks into the Cashier Floor.
    await expect(page.getByRole("button", { name: /find order/i })).toHaveCount(0);
  });

  test("Floor cards expose no guest phone/email/receipt reference", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\+?\d[\d\s-]{8,}\d/); // no long phone-like digit runs
    expect(body).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i); // no email addresses
    expect(body).not.toMatch(/receipt\s*#/i);
  });
});
