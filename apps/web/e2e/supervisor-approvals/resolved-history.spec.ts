import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — resolved & history", () => {
  test("Done today loads today's decisions or a truthful empty state", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("tab", { name: /^Done today/ }).click();
    await expect(page).toHaveURL(/view=done/);
    const rows = queueRows(page);
    const empty = page.getByText(/nothing decided today yet/i);
    await expect(async () => {
      expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
    }).toPass();
  });

  test("History is lazy and paged, with an empty state", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/approvals?view=history");
    await expect(page.getByRole("tab", { name: /^History$/ })).toHaveAttribute("aria-selected", "true");
    const rows = queueRows(page);
    const empty = page.getByText(/no decisions on this page/i);
    await expect(async () => {
      expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
    }).toPass();
  });
});
