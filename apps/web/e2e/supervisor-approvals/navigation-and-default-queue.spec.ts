import { test, expect } from "@playwright/test";

import { uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";
import { gotoApprovals } from "./approvals-fixtures";

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — navigation & default queue", () => {
  test("defaults to Waiting, keeps the four-section bar, no Orders", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await expect(page.getByRole("tab", { name: /^Waiting/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /^Done today/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^History$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /approvals/i }).first()).toBeVisible();
    expect(await page.getByRole("link", { name: /^orders$/i }).count()).toBe(0);
    expect(new URL(page.url()).searchParams.get("view")).toBeNull();
    await expectNoHorizontalOverflow(page);
  });

  test("empty selection shows the placeholder detail", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await expect(page.getByText(/choose a request to see it here/i)).toBeVisible();
  });
});
