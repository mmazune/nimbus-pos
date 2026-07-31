import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { gotoApprovals, queueRows } from "./approvals-fixtures";

/** A row title must be a human/operational label — never a bare UUID/cuid. */
const RAW_ID = /^[0-9a-f]{20,}$/i;

test.describe("Approvals — identity & privacy", () => {
  test("row titles are names/types, never raw ids, and no PII leaks", async ({ page }) => {
    await uiLogin(page, "supervisor");
    await gotoApprovals(page);
    await page.waitForLoadState("networkidle").catch(() => {});

    const rows = queueRows(page);
    const count = await rows.count();
    test.skip(count === 0, "No needs-action rows on this branch");

    for (let i = 0; i < Math.min(count, 10); i += 1) {
      const text = (await rows.nth(i).innerText()).trim();
      // First line is the title.
      const title = text.split("\n")[0]?.trim() ?? "";
      expect(title, `row ${i} title is a raw id`).not.toMatch(RAW_ID);
      expect(text.toLowerCase()).not.toContain("undefined undefined");
      expect(text).not.toContain("[object Object]");
    }

    // No email addresses surfaced in the queue (contact PII stays out of rows).
    const queueText = await page.getByRole("list", { name: /approval queue/i }).innerText();
    expect(queueText).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
