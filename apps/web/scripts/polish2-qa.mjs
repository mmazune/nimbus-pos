/**
 * OWNER UI POLISH WAVE 2 — live verification harness (2026-08-20).
 *
 * Drives the real dev stack (web :3000 / API :3001), proves the /login page has
 * ZERO page-level scroll at every supported terminal viewport, captures the four
 * role surfaces at 1280x680 and 1440x900, and records console errors.
 *
 * Usage: node scripts/polish2-qa.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT = process.env.QA_OUT || "/tmp/qa-shots/polish2";
const PASSWORD = "Demo1234!";

const VIEWPORTS = [
  { name: "1280x680", width: 1280, height: 680 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

const SHOT_VIEWPORTS = VIEWPORTS.filter((v) => v.name === "1280x680" || v.name === "1440x900");

const ROLES = {
  waiter: { email: "waiter@nimbus.demo", landing: "/waiter/floor", pages: [["floor", "/waiter/floor"]] },
  cashier: {
    email: "cashier@nimbus.demo",
    landing: "/cashier/floor",
    pages: [["floor", "/cashier/floor"], ["till", "/cashier/till"]],
  },
  supervisor: {
    email: "supervisor@nimbus.demo",
    landing: "/supervisor/floor",
    pages: [["floor", "/supervisor/floor"], ["approvals", "/supervisor/approvals"]],
  },
  manager: { email: "manager@nimbus.demo", landing: "/manager/overview", pages: [["overview", "/manager/overview"]] },
};

mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const results = [];

function attach(page, tag) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${tag}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${tag}] pageerror: ${err.message}`));
}

async function metrics(page) {
  return page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    innerHeight: window.innerHeight,
    bodyScrollHeight: document.body.scrollHeight,
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
    headerHeight: Math.round(
      document.querySelector("[data-operational-header]")?.getBoundingClientRect().height || 0,
    ),
    navHeight: Math.round(
      document.querySelector("[data-operational-bottom-nav]")?.getBoundingClientRect().height || 0,
    ),
    cardHeight: Math.round(
      document.querySelector("[data-operational-table-id]")?.getBoundingClientRect().height || 0,
    ),
    contextLabel:
      document.querySelector("[data-operational-header] p + div span:last-of-type")?.textContent?.trim() || null,
  }));
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { window.localStorage.clear(); } catch {} });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^email$/i }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--disable-gpu", "--disable-dev-shm-usage"],
});

// ── 1. /login page-scroll proof at ALL four viewports ──
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  attach(page, `login@${vp.name}`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const m = await metrics(page);
  results.push({ surface: "login", viewport: vp.name, ...m });
  if (SHOT_VIEWPORTS.some((s) => s.name === vp.name)) {
    await page.screenshot({ path: `${OUT}/login-${vp.name}.png` });
  }
  await ctx.close();
}

// ── 2. Role surfaces ──
for (const [role, cfg] of Object.entries(ROLES)) {
  for (const vp of SHOT_VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    attach(page, `${role}@${vp.name}`);
    try {
      await login(page, cfg.email);
      for (const [label, path] of cfg.pages) {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        const m = await metrics(page);
        results.push({ surface: `${role}-${label}`, viewport: vp.name, ...m });
        await page.screenshot({ path: `${OUT}/${role}-${label}-${vp.name}.png` });
      }
    } catch (error) {
      results.push({ surface: `${role}`, viewport: vp.name, error: String(error).slice(0, 200) });
    }
    await ctx.close();
  }
}

await browser.close();

console.log("\n=== METRICS ===");
console.table(results);
console.log("\n=== CONSOLE ERRORS (%d) ===", consoleErrors.length);
consoleErrors.forEach((e) => console.log(e));
