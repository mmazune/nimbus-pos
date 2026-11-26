import { expect, test, type Page } from "@playwright/test";

import { ensureFloorFixture } from "./floor-fixture";
import { makePins, pinSignIn, saveJson, type Person } from "./support";

/**
 * T1 phase 6 (Done-when 4): no screen the waiter, cashier or supervisor can reach
 * outside an open table shows a permission key, a route, an endpoint or other
 * developer wording. Every section, the hidden cashier Queue, and the "not your
 * role" guards, at 1280 × 800 and 390 × 844.
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const BANNED: Array<[string, RegExp]> = [
  ["permission key", /\bpos:[a-z-]+:/],
  ["route or endpoint path", /\/api\/|\/auth\/me|\/pos\/orders/],
  ["API", /\bAPI\b/],
  ["v1", /\bv1\b/i],
  ["stub", /\bstub\b/i],
  ["endpoint", /\bendpoints?\b/i],
  ["backend", /\bbackend\b/i],
  ["MVP", /\bMVP\b/],
  ["adapter", /\badapter\b/i],
  ["build-step name", /\bPrompt \d|\bTrack B\d|\bM-P\d/],
  ["broken value", /undefined undefined|\[object Object\]|\bNaN\b/],
  ["raw status code", /\b(IN_KITCHEN|NO_SHOW|SAFE_DROP|PAID_OUT)\b/],
];

/**
 * Known and listed (reports/T1_REPORT.md): wording that is beyond Done-when 4's three items
 * (permission key, route, endpoint) and lives in a file outside T1's folders. Matched exactly,
 * so any new hit still fails.
 */
const LISTED: string[] = [
  // T5 reworded the one entry that was here (lib/cashier/payment-validation.ts) into a cashier's words.
];

const ROUTES: Record<Exclude<Person, "manager">, string[]> = {
  waiter: ["/waiter/floor", "/waiter/reservations", "/waiter/me", "/supervisor/floor", "/cashier/floor"],
  cashier: ["/cashier/floor", "/cashier/receipts", "/cashier/till", "/cashier/me", "/cashier/queue", "/supervisor/approvals"],
  supervisor: ["/supervisor/floor", "/supervisor/reservations", "/supervisor/approvals", "/supervisor/me", "/waiter/floor"],
};

const found: Record<string, string[]> = {};

test.beforeAll(async () => {
  await ensureFloorFixture();
  await makePins();
});
test.afterAll(() => saveJson("sweep-wording.json", found));

async function bodyText(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.locator("body").innerText();
}

for (const [w, h] of [
  [1280, 800],
  [390, 844],
] as const) {
  for (const who of ["waiter", "cashier", "supervisor"] as const) {
    test(`${who} at ${w} × ${h}: no developer wording on any section`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await pinSignIn(page, who);
      const hits: string[] = [];
      for (const route of ROUTES[who]) {
        await page.goto(route);
        let text = await bodyText(page);
        for (const known of LISTED) text = text.split(known).join(" ");
        expect(text.length, `${route} rendered nothing`).toBeGreaterThan(20);
        for (const [name, re] of BANNED) {
          const m = text.match(re);
          if (m) hits.push(`${route}: ${name} "${text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 40).replace(/\s+/g, " ")}"`);
        }
      }
      found[`${who}-${w}`] = hits;
      expect(hits).toEqual([]);
    });
  }
}
