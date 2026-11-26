import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { domainRows, gotoApprovals, queueRows } from "./approvals-fixtures";

// T1 (26 Nov 2026): Approvals rebuilt to the drawing Supervisor-Approvals (Waiting / Done today /
// History, one list, a side panel). Same routes and decisions; selectors updated.

test.describe("Approvals — consolidated four-domain closure", () => {
  test("all four kinds show in one Waiting list, or a truthful empty state", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    const rows = queueRows(page);
    const empty = page.getByText(/nothing is waiting for you/i);
    await expect(async () => {
      expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
    }).toPass();
    for (const name of [/^discounts$/i, /^leave$/i, /^shift swaps$/i, /^anomalies$/i]) {
      for (const t of await domainRows(page, name).allInnerTexts()) expect(t).not.toMatch(/undefined|\[object/i);
    }
    expect(await page.getByRole("link", { name: /^orders$/i }).count()).toBe(0);
  });

  test("Done today and History hold leave / shift-swap / alert decisions, never discounts", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    for (const tab of [/^Done today/, /^History$/]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.locator("section[aria-label='Done today'], section[aria-label='History']")).toBeVisible();
      await expect(domainRows(page, /^discounts$/i)).toHaveCount(0);
    }
  });
});
