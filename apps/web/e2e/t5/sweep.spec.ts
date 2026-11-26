import { expect, test, type Page } from "@playwright/test";

import { as, openTable, pinSignIn, saveJson, tableByLabel, terminal } from "./support";

/**
 * T5 (Done-when 7): no developer wording on the screens T5 built or changed — the chef's and the
 * bartender's sections, the waiter's Ready, and the order screen's new sheets — at 1280 × 800 and
 * 390 × 844. The ban list is T1's (e2e/t1/sweep.spec.ts), copied so this file runs on its own.
 */
const BANNED: Array<[string, RegExp]> = [
  ["permission key", /\bpos:[a-z-]+:/],
  ["route or endpoint path", /\/api\/|\/auth\/me|\/pos\/orders/],
  ["API", /\bAPI\b/],
  ["v1", /\bv1\b/i],
  ["stub", /\bstub\b/i],
  ["endpoint", /\bendpoints?\b/i],
  ["backend", /\bbackend\b/i],
  ["frontend", /\bfrontend\b/i],
  ["MVP", /\bMVP\b/],
  ["adapter", /\badapter\b/i],
  ["build-step name", /\bPrompt \d|\bTrack B\d|\bM-P\d|\bT[1-7]\b|\bE\d\b/],
  ["broken value", /undefined undefined|\[object Object\]|\bNaN\b|\bnull\b/],
  ["raw code", /\b(IN_KITCHEN|NO_SHOW|SAFE_DROP|PAID_OUT|SOLD_OUT|NOT_SENT|COLD_KITCHEN|NOTHING_SENDABLE|OPEN_TABLES)\b/],
];

const found: Record<string, string[]> = {};
test.afterAll(() => saveJson("sweep-wording-t5.json", found));

async function check(page: Page, where: string, hits: string[]) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const text = await page.locator("body").innerText();
  expect(text.length, `${where} rendered nothing`).toBeGreaterThan(20);
  for (const [name, re] of BANNED) {
    const m = text.match(re);
    if (m) hits.push(`${where}: ${name} "${text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 40).replace(/\s+/g, " ")}"`);
  }
}

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`chef, bartender and the waiter's Ready at ${vp.width}: no developer wording`, async ({ browser }) => {
    const hits: string[] = [];
    for (const who of ["chef1", "bartender1"]) {
      const T = await terminal(browser, vp);
      await pinSignIn(T.page, who);
      for (const route of ["/kitchen", "/kitchen/done", "/kitchen/sold-out"]) {
        await T.page.goto(route);
        await check(T.page, `${who} ${route}`, hits);
      }
      await T.ctx.close();
    }
    const W = await terminal(browser, vp);
    await pinSignIn(W.page, "waiter1");
    await W.page.goto("/waiter/ready");
    await check(W.page, "waiter /waiter/ready", hits);
    await W.ctx.close();
    found[`roles-${vp.width}`] = hits;
    expect(hits).toEqual([]);
  });

  test(`the order screen's new sheets at ${vp.width}: no developer wording`, async ({ browser }) => {
    const hits: string[] = [];
    const S = await terminal(browser, vp);
    await pinSignIn(S.page, "supervisor1");
    await openTable(S.page, "supervisor", (await tableByLabel("M20")).id);
    await check(S.page, "order screen", hits);
    await S.page.getByRole("button", { name: /^More for this table|^More$/ }).first().click();
    await check(S.page, "table actions", hits);
    for (const action of [/^Split bill/, /^Move a line/, /^Change waiter/, /^Join tables/]) {
      const tile = S.page.getByRole("dialog").getByRole("button", { name: action });
      if (!(await tile.count())) continue;
      await tile.first().click();
      await check(S.page, `${action.source} sheet`, hits);
      await S.page.getByRole("dialog").getByRole("button", { name: /^(Back|Cancel)$/ }).first().click(); // Join closes with Cancel (drawing Table-Join)
    }
    await S.ctx.close();
    await as("waiter1");
    found[`sheets-${vp.width}`] = hits;
    expect(hits).toEqual([]);
  });
}
