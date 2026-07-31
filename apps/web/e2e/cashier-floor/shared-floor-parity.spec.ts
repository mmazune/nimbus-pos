import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";

/**
 * Prompt C1 — Cashier renders the SAME shared OperationalFloor surface as
 * Waiter/Supervisor (toolbar, search, filters, grid), with no Cashier-only
 * guest/payment data and no Cashier-only Find/settlement control in C1.
 */
test.describe("Cashier shared Floor parity", () => {
  test("shared toolbar (search + status filters) and table grid render", async ({ page }) => {
    await uiLogin(page, "cashier");
    await page.waitForURL(/\/cashier\/floor/);

    await expect(page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first()).toBeVisible();
    for (const filter of ["Available", "Occupied", "Reserved"]) {
      await expect(page.getByRole("button", { name: new RegExp(filter, "i") }).first()).toBeVisible();
    }
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
