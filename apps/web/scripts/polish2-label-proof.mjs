/**
 * Live proof of the shared table-label abbreviation (2026-08-20).
 *
 * The current demo branch only seeds SHORT labels (TD-01 … TD-22), so the long
 * "QA-…" labels the owner saw cannot be reproduced from live data without
 * mutating demo data (forbidden). This harness therefore rewrites the
 * `GET /api/tables` RESPONSE in the browser — a display-side test double, no
 * backend/demo-data change — so the real shared Floor renders long labels and we
 * can photograph the actual abbreviation + the preserved full title/aria-label.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/qa-shots/polish2";
mkdirSync(OUT, { recursive: true });

const RENAMES = [
  "QA-OPEN-01",
  "QA-P4-CLEAN-02",
  "QA-P4-PASS2-1440",
  "QA-PRE-BILL-01",
  "QA-OTHER-01",
  "TD-06",
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--disable-gpu", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.route("**/api/tables**", async (route) => {
  const response = await route.fetch();
  let body;
  try {
    body = await response.json();
  } catch {
    return route.fulfill({ response });
  }
  const list = Array.isArray(body) ? body : body?.data;
  if (Array.isArray(list)) {
    list.forEach((table, index) => {
      if (index < RENAMES.length) table.label = RENAMES[index];
    });
  }
  await route.fulfill({ response, json: body });
});

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { try { window.localStorage.clear(); } catch {} });
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /^email$/i }).click();
await page.locator('input[name="email"]').fill("waiter@nimbus.demo");
await page.locator('input[name="password"]').fill("Demo1234!");
await page.getByRole("button", { name: /^sign in$/i }).click();
await page.waitForURL(/\/waiter\/floor/, { timeout: 45_000 });
await page.waitForTimeout(2500);

const rendered = await page.evaluate(() =>
  [...document.querySelectorAll("[data-operational-table-label]")].slice(0, 8).map((el) => ({
    full: el.getAttribute("data-operational-table-label"),
    visible: el.querySelector("p")?.textContent?.trim(),
    title: el.querySelector("p")?.getAttribute("title"),
    ariaLabel: el.getAttribute("aria-label"),
    lines: Math.round((el.querySelector("p")?.getBoundingClientRect().height || 0)),
  })),
);

console.table(rendered);
await page.screenshot({ path: `${OUT}/label-abbreviation-1440x900.png` });
console.log("console errors:", errors.length, errors);
await browser.close();
