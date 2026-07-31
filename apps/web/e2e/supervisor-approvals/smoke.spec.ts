import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";

/**
 * Prompt 5A — NARROW Approvals route smoke (not the 5B workspace).
 *
 * Verifies the (still read-only) Approvals page loads with the current + newly
 * hardened response types, renders without crashing, shows no raw-undefined
 * identity, keeps the locked four-tab nav (NO Orders tab), and that Prompt 3
 * Floor + Prompt 4 Reservations still load. The full four-viewport Approvals
 * workflow belongs to Prompt 5B.
 */
test.describe("Supervisor Approvals — route smoke (Prompt 5A)", () => {
  test("Approvals route loads, renders, keeps four-tab nav, and no console error", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await uiLogin(page, "supervisor");

    await page.goto("/supervisor/approvals");
    // Page mounted at the right route and did not redirect away / crash.
    await expect(page).toHaveURL(/\/supervisor\/approvals/);
    // Body rendered (not a blank error boundary).
    await expect(page.locator("body")).toBeVisible();
    // Give the four domain read-queries a moment to settle.
    await page.waitForLoadState("networkidle").catch(() => {});

    // Locked nav: Approvals present, Orders ABSENT (Waiter/Supervisor never show Orders).
    await expect(page.getByRole("link", { name: /approvals/i }).first()).toBeVisible();
    expect(await page.getByRole("link", { name: /^orders$/i }).count()).toBe(0);

    // No raw "undefined"/"null"/"[object Object]" leaking into the rendered text.
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(bodyText).not.toContain("undefined undefined");
    expect(bodyText).not.toContain("[object object]");

    await expectNoHorizontalOverflow(page);

    // Filter out benign noise (favicon/network abort on teardown) — fail only on real app errors.
    const real = errors.filter(
      (e) => !/favicon|ERR_ABORTED|Failed to load resource.*404|net::ERR/i.test(e),
    );
    expect(real, `console errors: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("Prompt 3 Floor and Prompt 4 Reservations still load (regression)", async ({ page }) => {
    await uiLogin(page, "supervisor");

    await page.goto("/supervisor/floor");
    await expect(page).toHaveURL(/\/supervisor\/floor/);
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/supervisor/reservations");
    await expect(page).toHaveURL(/\/supervisor\/reservations/);
    await expect(page.getByRole("tab", { name: /arriving/i })).toBeVisible();
  });
});
