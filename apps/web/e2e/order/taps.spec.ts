/**
 * Done-when 8: tap counts, measured with a click counter, counted from the
 * waiter's home (the Floor) including the table tap, as A2 §3.8 counts. Each task
 * starts on the Floor with nothing unsent on the table and ends with "Leave without
 * sending" (not counted). Typing is not a tap (moses-build-standards §4.1).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { tapTable } from "../t5/floor";

import { freeTable, setupVenue, signInWithPin } from "./fixture";

const PROOF = join(__dirname, "../../../../reports/proof/T3");
mkdirSync(PROOF, { recursive: true });
test.use({ viewport: { width: 1280, height: 800 } });

test("tap counts from the Floor", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  let n = 0;
  const tap = async (loc: ReturnType<Page["locator"]>) => {
    n += 1;
    await loc.click();
  };
  const task = async (name: string, steps: () => Promise<void>, expectLine: RegExp) => {
    n = 0;
    await tap(page.locator(`[data-floor-table-id="${table.id}"] button`).first());
    await expect(page.locator("[data-order-menu]")).toBeVisible();
    await steps();
    await expect(page.locator("[data-order-unsent]").getByRole("button", { name: expectLine })).toBeVisible();
    const taps = n;
    await page.getByRole("button", { name: "Floor" }).click();
    await page.getByRole("button", { name: "Leave without sending" }).click();
    await expect(page.locator("[data-order-screen]")).toHaveCount(0);
    return [name, taps] as const;
  };

  const results = [
    await task("a beer from Popular: table, Drinks, Lager", async () => {
      await tap(page.getByRole("tab", { name: "Drinks" }));
      await tap(page.getByRole("button", { name: /^Lager 500 ml,/ }));
    }, /^1 Lager 500 ml/),
    await task("a double whisky with cola by search: table, Search, Double, Cola (typing “bs” not counted)", async () => {
      await tap(page.getByRole("button", { name: "Search the whole menu" }));
      await page.getByLabel("Search the whole menu").fill("bs");
      await tap(page.locator("[data-order-search]").getByRole("button", { name: "Blended Scotch, Double, 15,000" }));
      await tap(page.locator("[data-order-mixer]").getByRole("button", { name: "Cola", exact: true }));
    }, /Blended Scotch, Double · Cola/),
    await task("a double whisky with cola by groups: table, Drinks (Popular), Double, Cola", async () => {
      await tap(page.getByRole("tab", { name: "Drinks" }));
      await tap(page.getByRole("button", { name: "Blended Scotch, Double, 15,000" }));
      await tap(page.locator("[data-order-mixer]").getByRole("button", { name: "Cola", exact: true }));
    }, /Blended Scotch, Double · Cola/),
    await task("a burger with choices: table, Beef burger (Food › Popular food), Medium, Add", async () => {
      await tap(page.getByRole("button", { name: /^Beef burger,/ }));
      await tap(page.locator("[data-order-item-sheet]").getByRole("button", { name: "Medium", exact: true }));
      await tap(page.getByRole("button", { name: "Add · UGX 28,000" }));
    }, /Beef burger, Medium/),
  ];
  const counts = Object.fromEntries(results);
  writeFileSync(join(PROOF, "tap-counts.json"), JSON.stringify({ from: "the waiter's Floor, including the table tap", counts }, null, 2));
  expect(counts["a beer from Popular: table, Drinks, Lager"]).toBeLessThanOrEqual(4);
  expect(counts["a double whisky with cola by search: table, Search, Double, Cola (typing “bs” not counted)"]).toBeLessThanOrEqual(4);
  expect(counts["a burger with choices: table, Beef burger (Food › Popular food), Medium, Add"]).toBeLessThanOrEqual(4);
  expect(counts["a double whisky with cola by groups: table, Drinks (Popular), Double, Cola"]).toBeLessThanOrEqual(4);
  // Done-when 8: none above four.
  for (const [what, n] of Object.entries(counts)) expect(n, what).toBeLessThanOrEqual(4);
});
