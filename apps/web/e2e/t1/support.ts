import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

/**
 * T1 shared e2e support: PIN sign-in, the rule-10 page measurements and proof files.
 *
 * Run against a THROWAWAY local database only. Nothing here holds a credential:
 *   PW_BASE_URL, PW_API_URL, PW_BRANCH_ID   where the app, the API and the branch are
 *   T1_PASSWORD                              the seeded demo password, from the shell
 * PINs are made at load time: `makePins()` asks the API for a fresh quick PIN for
 * each test person (a manager reset, the only route that exists), keeps it in this
 * process's memory and never writes or prints it.
 */
export const REPO = join(__dirname, "..", "..", "..", "..");
export const PROOF = join(REPO, "reports", "proof", "T1");
mkdirSync(PROOF, { recursive: true });

export const API = process.env.PW_API_URL || "http://localhost:3001";
export const BRANCH = process.env.PW_BRANCH_ID || "cb27be401a2c35dfc0d4e610";

export type Person = "waiter" | "cashier" | "supervisor" | "manager";
const EMAIL: Record<Person, string> = {
  waiter: process.env.T1_WAITER_EMAIL || "waiter@nimbus.demo",
  cashier: process.env.T1_CASHIER_EMAIL || "cashier@nimbus.demo",
  supervisor: process.env.T1_SUPERVISOR_EMAIL || "supervisor@nimbus.demo",
  manager: process.env.T1_MANAGER_EMAIL || "manager@nimbus.demo",
};

function password(): string {
  const p = process.env.T1_PASSWORD;
  if (!p) throw new Error("T1_PASSWORD is not set in the shell (the seeded demo password).");
  return p;
}

async function api<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-branch-id": BRANCH,
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

const tokens = new Map<Person, { token: string; userId: string }>();

/** A password session for API set-up (never used to drive the screens). */
export async function apiSession(who: Person) {
  const hit = tokens.get(who);
  if (hit) return hit;
  const login = await api<{ accessToken: string }>("/auth/login", { method: "POST", body: { email: EMAIL[who], password: password() } });
  const me = await api<{ id?: string; user?: { id: string } }>("/auth/me", { token: login.accessToken });
  const value = { token: login.accessToken, userId: (me.user?.id ?? me.id) as string };
  tokens.set(who, value);
  return value;
}

export async function apiCall<T>(who: Person, path: string, method = "GET", body?: unknown): Promise<T> {
  const { token } = await apiSession(who);
  return api<T>(path, { method, token, body });
}

const pins = new Map<Person, string>();

/** Fresh quick PINs for the touch roles, held in memory for this run only. */
export async function makePins(people: readonly Person[] = ["waiter", "cashier", "supervisor"]) {
  const manager = await apiSession("manager");
  for (const who of people) {
    if (pins.has(who)) continue;
    const { userId } = await apiSession(who);
    const res = await api<{ pin: string }>(`/auth/users/${userId}/reset-quick-pin`, {
      method: "POST",
      token: manager.token,
      body: { branchId: BRANCH },
    });
    pins.set(who, res.pin);
  }
}

/** Sign in the way a person does at the terminal: branch, then the PIN on the keypad. */
export async function pinSignIn(page: Page, who: Person) {
  const pin = pins.get(who);
  if (!pin) throw new Error(`no PIN made for ${who}; call makePins() first`);
  await page.goto("/login");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* storage blocked */
    }
  });
  await page.goto("/login");
  await page.locator('input[name="branchId"]').fill(BRANCH);
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /^enter$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
}

export type Rules = {
  viewport: string;
  sideways: number;
  clipped: string[];
  small: string[];
  tinyText: string[];
  filled: string[];
  checkedText: number;
  checkedTargets: number;
};

/**
 * Rule 10: no sideways scroll, no clipped text, no target under 44 px, no text
 * under 12 px, at most one filled button. Hidden elements are skipped.
 * "Filled" = a button whose ground is the kit primary, outside the header and bars.
 */
export async function pageRules(page: Page): Promise<Rules> {
  return page.evaluate(() => {
    const primary = getComputedStyle(document.documentElement).getPropertyValue("--kit-color-primary").trim();
    const probe = document.createElement("i");
    probe.style.color = primary;
    document.body.appendChild(probe);
    const primaryRgb = getComputedStyle(probe).color;
    probe.remove();
    const out = {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      sideways: document.documentElement.scrollWidth - window.innerWidth,
      clipped: [] as string[],
      small: [] as string[],
      tinyText: [] as string[],
      filled: [] as string[],
      checkedText: 0,
      checkedTargets: 0,
    };
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      const r = (el as HTMLElement).getBoundingClientRect();
      // 1 px boxes are screen-reader-only labels (sr-only), hidden from sight on purpose.
      return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1;
    };
    const name = (el: Element) => ((el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40));
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (!visible(el)) continue;
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
      if (!ownText) continue;
      out.checkedText += 1;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) out.clipped.push(`${el.tagName} "${name(el)}" ${el.scrollWidth}>${el.clientWidth}`);
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.tinyText.push(`${el.tagName} "${name(el)}" ${fs}px`);
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [role=tab]"))) {
      if (!visible(el)) continue;
      out.checkedTargets += 1;
      if (!["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && el.scrollHeight > el.clientHeight + 1) out.clipped.push(`${el.tagName} "${name(el)}" taller ${el.scrollHeight}>${el.clientHeight}`);
      if (el.offsetWidth < 44 || el.offsetHeight < 44) out.small.push(`${el.tagName} "${name(el)}" ${el.offsetWidth}x${el.offsetHeight}`);
      // A chosen chip or option (aria-pressed / aria-selected) is a selection, not an action button.
      const chosen = el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true";
      if (el.tagName === "BUTTON" && !chosen && !el.closest("header, nav") && getComputedStyle(el).backgroundColor === primaryRgb) out.filled.push(name(el));
    }
    return out;
  });
}

export function expectRules(r: Rules) {
  expect(r.checkedText, "text elements checked").toBeGreaterThan(5);
  expect(r.checkedTargets, "targets checked").toBeGreaterThan(3);
  expect(r.sideways, "sideways overflow px").toBeLessThanOrEqual(0);
  expect(r.clipped, "clipped text").toEqual([]);
  expect(r.small, "targets under 44 px").toEqual([]);
  expect(r.tinyText, "text under 12 px").toEqual([]);
  expect(r.filled.length, `filled buttons: ${r.filled.join(", ")}`).toBeLessThanOrEqual(1);
}

export function saveJson(name: string, value: unknown) {
  writeFileSync(join(PROOF, name), JSON.stringify(value, null, 2));
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(PROOF, name) });
}

/** Header and bar heights as drawn: terminal 64 / 76, phone bar 84. */
export async function chrome(page: Page) {
  return page.evaluate(() => {
    const vis = (sel: string) => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.getBoundingClientRect().height > 0);
      return el ? Math.round(el.getBoundingClientRect().height) : 0;
    };
    return {
      header: vis('[data-touch-header] header'),
      bar: vis('[data-touch-bar] nav'),
      sections: Array.from(document.querySelectorAll<HTMLElement>("[data-touch-bar] nav"))
        .filter((n) => n.getBoundingClientRect().height > 0)
        .flatMap((n) => Array.from(n.querySelectorAll("a")).map((a) => a.getAttribute("data-kit-section"))),
    };
  });
}
