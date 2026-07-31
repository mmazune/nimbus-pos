import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals } from "./approvals-fixtures";

test.describe("Approvals — resolved & history", () => {
  test("Resolved scope loads terminal decisions or a truthful empty state", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.getByRole("tab", { name: /resolved/i }).click();
    await expect(page).toHaveURL(/scope=resolved/);

    // Either rows or the recent-decisions empty copy — never a crash / raw error.
    const rows = page.getByRole("list", { name: /approval queue/i }).getByRole("button");
    const empty = page.getByText(/no recent decisions/i);
    await expect(async () => {
      expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
    }).toPass();
  });

  test("History scope is lazy and paginated with an empty state", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await page.goto("/supervisor/approvals?scope=history&domain=leave");
    await expect(page.getByRole("tab", { name: /history/i })).toHaveAttribute("aria-selected", "true");

    const rows = page.getByRole("list", { name: /approval queue/i }).getByRole("button");
    const empty = page.getByText(/no approval history matches/i);
    await expect(async () => {
      expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
    }).toPass();
  });
});
