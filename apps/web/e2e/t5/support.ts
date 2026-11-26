import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { expectRule10, measurePage } from "../order/fixture";
import { expectRules, pageRules, settle } from "../t1/support";
import { venuePerson, type VenueKey } from "./venue";

/**
 * T5 shared e2e support, on the demo venue only (run through e2e/t5/stack.sh).
 * Sign-ins come from the venue's own load-time passwords and PINs (T5_SIGNIN, memory only);
 * nothing here writes, logs or prints one.
 */
export const REPO = join(__dirname, "..", "..", "..", "..");
export const PROOF = join(REPO, "reports", "proof", "T5");
mkdirSync(PROOF, { recursive: true });

export const API = process.env.PW_API_URL || "http://localhost:3001";
export const BRANCH = () => {
  const b = process.env.PW_BRANCH_ID;
  if (!b) throw new Error("PW_BRANCH_ID is not set: run through e2e/t5/stack.sh");
  return b;
};

type Json = Record<string, any>;

export async function api<T = any>(token: string | null, method: string, path: string, body?: unknown, ok = [200, 201]): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-branch-id": BRANCH(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!ok.includes(res.status)) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 240)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** The raw status and body, for a test that expects a refusal. */
export async function apiRaw(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { "content-type": "application/json", "x-branch-id": BRANCH(), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: Json | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const sessions = new Map<string, { token: string; userId: string; name: string }>();

/** A session for API set-up, as that person (their PIN where they have one, else their password). */
export async function as(key: VenueKey | string) {
  const hit = sessions.get(key);
  if (hit) return hit;
  const p = venuePerson(key);
  const login = p.pin
    ? await api<{ accessToken: string }>(null, "POST", "/auth/quick-pin-login", { branchId: BRANCH(), pin: p.pin, platform: "POS_DESKTOP" })
    : await api<{ accessToken: string }>(null, "POST", "/auth/login", { email: p.email, password: p.password });
  const me = await api<Json>(login.accessToken, "GET", "/auth/me");
  const value = { token: login.accessToken, userId: (me.id ?? me.user?.id) as string, name: `${me.firstName ?? me.user?.firstName ?? ""} ${me.lastName ?? me.user?.lastName ?? ""}`.trim() };
  sessions.set(key, value);
  return value;
}

/** Sign in at a terminal as that person: Quick PIN, the branch, the PIN on the keypad. */
export async function pinSignIn(page: Page, key: VenueKey | string) {
  const pin = venuePerson(key).pin;
  if (!pin) throw new Error(`${key} has no PIN`);
  await page.goto("/login");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* storage blocked */
    }
  });
  await page.goto("/login");
  const quick = page.getByRole("button", { name: "Quick PIN" });
  if (await quick.count()) await quick.click();
  await page.locator('input[name="branchId"]').fill(BRANCH());
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /^enter$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
}

/** A second (third…) terminal: its own browser context, so its sign-in is its own. */
export async function terminal(browser: Browser, size: { width: number; height: number } = { width: 1280, height: 800 }): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: size, timezoneId: "Africa/Kampala" });
  return { ctx, page: await ctx.newPage() };
}

export async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: join(PROOF, name), fullPage: false });
}

export function saveJson(name: string, value: unknown) {
  writeFileSync(join(PROOF, name), JSON.stringify(value, null, 2));
}

/** Rule 10 on what is on screen now; the measurements go into `log` under `label`. */
export async function rule10(page: Page, label: string, log: Record<string, unknown>) {
  // An open order screen covers the Floor: measure the screen (and an open sheet), as T3 did;
  // anywhere else, the whole page, as T1 did.
  if (await page.locator("[data-order-screen]").count()) {
    await settle(page);
    const m = await measurePage(page);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log[label] = { ...m, sideways, viewport: page.viewportSize() };
    expectRule10({ ...m, sideways: Math.max(0, sideways) }, label);
    return m;
  }
  const r = await pageRules(page);
  log[label] = r;
  expectRules(r);
  return r;
}

/** Records API calls as method, path and status only (rule 15: no bodies, no headers). */
export function recordApi(page: Page) {
  const log: Array<{ method: string; path: string; status: number }> = [];
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith("/api/")) return;
    log.push({ method: res.request().method(), path: url.pathname + url.search, status: res.status() });
  });
  return log;
}

/** A table on the venue by label, with its id. */
export async function tableByLabel(label: string): Promise<{ id: string; label: string }> {
  const { areas } = await api<{ areas: Array<{ tables: Array<{ id: string; label: string }> }> }>((await as("manager1")).token, "GET", "/areas");
  const t = areas.flatMap((a) => a.tables).find((x) => x.label === label);
  if (!t) throw new Error(`no table ${label} on the venue`);
  return t;
}

/** A menu item on the venue by name. */
export async function itemByName(name: string): Promise<Json> {
  const ws = await api<Json>((await as("manager1")).token, "GET", "/menu/workspace");
  const it = (ws.items as Json[]).find((i) => i.name === name);
  if (!it) throw new Error(`no menu item ${name}`);
  return it;
}

/**
 * "Lamb chops", in Food › Grill: the venue grills lamb skewers but sells no chops, so the test
 * adds the dish as a manager would (fictional price), once per venue.
 */
export async function ensureLambChops(): Promise<string> {
  const m = (await as("manager1")).token;
  const ws = await api<Json>(m, "GET", "/menu/workspace");
  const found = (ws.items as Json[]).find((i) => i.name === "Lamb chops");
  if (found) return found.id;
  const cats = await api<Json[]>(m, "GET", "/menu/categories");
  const made = await api<Json>(m, "POST", "/menu/items", { name: "Lamb chops", price: 45000, itemType: "FOOD", station: "KITCHEN", categoryId: cats[0].id });
  const groups = await api<Json[]>(m, "GET", "/menu/browse-groups");
  const grill = groups.find((g) => g.section === "FOOD" && /^grill/i.test(g.name));
  if (grill) await api(m, "PATCH", `/menu/items/${made.id}/browse`, { browseGroupId: grill.id, browseSubgroupId: null });
  return made.id;
}

/** Open the order screen on a table from the Floor, as a person would. */
export async function openTable(page: Page, role: "waiter" | "cashier" | "supervisor", tableId: string) {
  if (await page.locator("[data-order-screen]").count()) {
    await page.getByRole("button", { name: "Floor", exact: true }).first().click();
    const leave = page.getByRole("dialog").getByRole("button", { name: /^Leave/ });
    if (await leave.count()) await leave.first().click();
    await expect(page.locator("[data-order-screen]")).toHaveCount(0);
  }
  if (!page.url().includes(`/${role}/floor`)) await page.goto(`/${role}/floor`);
  const { tapTable } = await import("./floor");
  await tapTable(page, tableId);
  await expect(page.locator("[data-order-screen]")).toBeVisible();
}
