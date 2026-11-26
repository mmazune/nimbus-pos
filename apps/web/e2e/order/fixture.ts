/**
 * T3 e2e fixture. Builds what "Table 12's evening" needs through the API, as the
 * manager would, on the throwaway database only:
 *   - a small fixture menu (fictional items) with a Popular group, measures and choices,
 *   - fresh Quick PINs for the four people, held in memory and never written anywhere,
 *   - a second waiter (fictional cast, +256 700 000 xxx), and open shifts for both waiters.
 *
 * Env (no defaults for secrets):
 *   PW_API_URL      the API under test (default http://localhost:4111)
 *   PW_BRANCH_ID    the demo branch (default Tapas Downtown)
 *   PW_MANAGER_EMAIL  (default manager@nimbus.demo)
 *   PW_DEMO_PASSWORD  the demo manager's password, from the shell
 */
import { expect, type Page, type Request, type Response } from "@playwright/test";

export const API = process.env.PW_API_URL || "http://localhost:4111";
export const BRANCH = process.env.PW_BRANCH_ID || "cb27be401a2c35dfc0d4e610";
const MANAGER_EMAIL = process.env.PW_MANAGER_EMAIL || "manager@nimbus.demo";

type Json = Record<string, any>;

export async function api(token: string | null, method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-branch-id": BRANCH,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function must(token: string | null, method: string, path: string, body?: unknown, ok = [200, 201]) {
  const r = await api(token, method, path, body);
  if (!ok.includes(r.status)) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`);
  return r.json;
}

export type Person = { userId: string; pin: string; name: string };
export type Venue = {
  managerToken: string;
  people: { waiter: Person; waiter2: Person; supervisor: Person; cashier: Person; manager: Person };
  items: Record<string, Json>;
};

const FIX = "T3";

async function ensureMenu(token: string) {
  const cats = await must(token, "GET", "/api/menu/categories");
  const cat: Json = (cats as Json[]).find((c) => c.name === `${FIX} fixture`) ?? (await must(token, "POST", "/api/menu/categories", { name: `${FIX} fixture`, sortOrder: 99 }));

  const groups = (await must(token, "GET", "/api/menu/browse-groups")) as Json[];
  const group = async (section: "FOOD" | "DRINKS", name: string, sortOrder: number): Promise<Json> => {
    const found = groups.find((g) => g.section === section && g.name === name);
    if (found) return found;
    const made = await must(token, "POST", "/api/menu/browse-groups", { section, name, sortOrder });
    groups.push(made);
    return made;
  };
  const gPopular = await group("DRINKS", "Popular", 0);
  const gWhisky = await group("DRINKS", "Whisky", 40);
  const gSoft = await group("DRINKS", "Soft drinks", 41);
  const gGrills = await group("FOOD", "Grills", 40);
  const gFoodPopular = await group("FOOD", "Popular food", 0);
  const gSides = await group("FOOD", "Sides", 41);

  const list = (await must(token, "GET", "/api/menu/items")) as Json[] | Json;
  const rows: Json[] = Array.isArray(list) ? list : list.data ?? [];
  const item = async (name: string, price: number, itemType: "FOOD" | "DRINK", station: string, browseGroupId: string): Promise<Json> => {
    let it: Json | undefined = rows.find((r) => r.name === name);
    if (!it) {
      it = (await must(token, "POST", "/api/menu/items", { name, price, itemType, station, categoryId: cat.id })) as Json;
      rows.push(it);
    }
    await must(token, "PATCH", `/api/menu/items/${it.id}/browse`, { browseGroupId, browseSubgroupId: null });
    return it;
  };

  const lager = await item("Lager 500 ml", 6000, "DRINK", "BAR", gPopular.id);
  const scotch = await item("Blended Scotch", 8000, "DRINK", "BAR", gWhisky.id);
  const cola = await item("Cola 300 ml", 3000, "DRINK", "BAR", gSoft.id);
  const burger = await item("Beef burger", 28000, "FOOD", "KITCHEN", gFoodPopular.id);
  const wings = await item("Chicken wings", 24000, "FOOD", "KITCHEN", gGrills.id);
  const chips = await item("Chips", 8000, "FOOD", "KITCHEN", gSides.id);

  // Measures on the Scotch: Tot, Double, Bottle.
  const servings = (await must(token, "GET", `/api/menu/items/${scotch.id}/servings`)) as Json[];
  if (!servings.length) {
    await must(token, "POST", `/api/menu/items/${scotch.id}/servings`, { format: "SHOT", label: "Tot", price: 8000, isDefault: true, sortOrder: 1 });
    await must(token, "POST", `/api/menu/items/${scotch.id}/servings`, { format: "DOUBLE", label: "Double", price: 15000, sortOrder: 2 });
    await must(token, "POST", `/api/menu/items/${scotch.id}/servings`, { format: "BOTTLE", label: "Bottle", price: 180000, sortOrder: 3 });
  }

  // Choice groups.
  const mgs = (await must(token, "GET", "/api/menu/modifier-groups")) as Json[];
  const mg = async (name: string, body: Json, options: Array<[string, string?]>): Promise<Json> => {
    let g: Json | undefined = mgs.find((x) => x.name === name);
    if (!g) {
      const made: Json = await must(token, "POST", "/api/menu/modifier-groups", { name, ...body });
      g = made;
      for (const [i, [opt, delta]] of options.entries()) {
        await must(token, "POST", `/api/menu/modifier-groups/${made.id}/options`, { name: opt, priceDelta: delta ?? "0", sortOrder: i });
      }
      mgs.push(made);
    }
    return g as Json;
  };
  const cooked = await mg("How cooked", { min: 1, max: 1, required: true, sortOrder: 1 }, [["Rare"], ["Medium"], ["Well done"]]);
  const extras = await mg("Extras", { min: 0, max: 3, required: false, sortOrder: 2 }, [["Cheese", "3000"], ["Bacon", "5000"]]);
  const leave = await mg("Leave out", { min: 0, max: 3, required: false, sortOrder: 3 }, [["Onions"], ["Tomato"], ["Sauce"]]);
  const mixer = await mg("Mixer", { min: 0, max: 1, required: false, sortOrder: 1 }, [["Cola"], ["Soda water"], ["Tonic"], ["Ginger ale"], ["Water"], ["Ice only"]]);
  await must(token, "POST", `/api/menu/items/${burger.id}/modifier-groups`, { groups: [{ groupId: cooked.id, sortOrder: 1 }, { groupId: extras.id, sortOrder: 2 }, { groupId: leave.id, sortOrder: 3 }] });
  await must(token, "POST", `/api/menu/items/${scotch.id}/modifier-groups`, { groups: [{ groupId: mixer.id, sortOrder: 1 }] });

  return { lager, scotch, cola, burger, wings, chips };
}

async function userIdByEmail(token: string, email: string): Promise<{ id: string; name: string }> {
  const me = await must(token, "GET", "/api/auth/me");
  if (me.email === email) return { id: me.id, name: `${me.firstName} ${me.lastName}` };
  throw new Error(`token is not ${email}`);
}

async function loginPassword(email: string): Promise<string> {
  const password = process.env.PW_DEMO_PASSWORD;
  if (!password) throw new Error("Set PW_DEMO_PASSWORD in the shell (the demo manager's password).");
  const r = await must(null, "POST", "/api/auth/login", { email, password });
  return r.accessToken as string;
}

async function freshPin(managerToken: string, userId: string): Promise<string> {
  const r = await must(managerToken, "POST", `/api/auth/users/${userId}/reset-quick-pin`, { branchId: BRANCH });
  return String(r.pin);
}

export async function pinToken(pin: string): Promise<string> {
  const r = await must(null, "POST", "/api/auth/quick-pin-login", { branchId: BRANCH, pin, platform: "POS_DESKTOP" });
  return r.accessToken as string;
}

async function employeeUser(managerToken: string, firstName: string, lastName: string): Promise<{ id: string; name: string } | null> {
  const r = await api(managerToken, "GET", "/api/hr/employees?take=100");
  const rows: Json[] = Array.isArray(r.json) ? r.json : r.json?.data ?? r.json?.items ?? [];
  const hit = rows.find((e) => e.firstName === firstName && e.lastName === lastName);
  const id = hit?.userId ?? hit?.user?.id;
  return id ? { id, name: `${firstName} ${lastName}` } : null;
}

/** The fixture's own tables, so the demo floor's open orders never get in the way. */
export const FIXTURE_TABLES = ["12", "14", "15", "16", "17", "18"];

async function ensureTables(token: string) {
  const tables = (await must(token, "GET", "/api/tables")) as Json[];
  for (const label of FIXTURE_TABLES) {
    if (!tables.some((t) => t.label === label)) await must(token, "POST", "/api/tables", { label, capacity: 4 });
  }
}

/** Voids open orders left on the fixture's tables by an earlier, failed run (never demo data). */
export async function resetFixtureTables(token: string) {
  const tables = ((await must(token, "GET", "/api/tables")) as Json[]).filter((t) => FIXTURE_TABLES.includes(t.label));
  for (const t of tables) {
    for (const o of await ordersOnTable(token, t.id)) {
      if (["CLOSED", "VOIDED"].includes(o.status)) continue;
      await api(token, "POST", `/api/pos/orders/${o.id}/void`, { reason: "T3 e2e: leftover from an earlier run" });
    }
  }
  await freeEmptyFixtureTables(token);
}

/**
 * Move table and Join tables (pos-handoff) leave the source table OCCUPIED with no
 * order (an API gap, listed for T2). The fixture puts its own empty tables back.
 */
export async function freeEmptyFixtureTables(token: string) {
  const tables = ((await must(token, "GET", "/api/tables")) as Json[]).filter((t) => FIXTURE_TABLES.includes(t.label));
  const open = (await must(token, "GET", "/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100")).data as Json[];
  for (const t of tables) {
    if (t.status !== "AVAILABLE" && !open.some((o) => o.tableId === t.id)) {
      await must(token, "PATCH", `/api/tables/${t.id}/status`, { status: "AVAILABLE" });
    }
  }
}

let cached: Venue | null = null;

/** Builds (or finds) everything once per worker. */
export async function setupVenue(): Promise<Venue> {
  if (cached) return cached;
  const managerToken = await loginPassword(MANAGER_EMAIL);
  const manager = await userIdByEmail(managerToken, MANAGER_EMAIL);
  const items = await ensureMenu(managerToken);
  await ensureTables(managerToken);
  await resetFixtureTables(managerToken);

  // Each demo person's id, from their own session (the seeded demo accounts share one password).
  const byEmail = async (email: string) => {
    const t = await loginPassword(email);
    const me = await must(t, "GET", "/api/auth/me");
    return { id: me.id as string, name: `${me.firstName} ${me.lastName}` };
  };
  const ids = {
    waiter: await byEmail(process.env.PW_WAITER_EMAIL || "waiter@nimbus.demo"),
    supervisor: await byEmail(process.env.PW_SUPERVISOR_EMAIL || "supervisor@nimbus.demo"),
    cashier: await byEmail(process.env.PW_CASHIER_EMAIL || "cashier@nimbus.demo"),
  };

  // A second waiter for "another waiter's table" (fictional cast, fictional phone block).
  let waiter2 = await employeeUser(managerToken, "Grace", "Atim");
  if (!waiter2) {
    const made = await api(managerToken, "POST", "/api/hr/frontline-staff/onboard", {
      firstName: "Grace",
      lastName: "Atim",
      phone: "+256700000123",
      roleName: "Waiter",
      issueQuickPin: true,
      employee: { hireDate: "2026-11-01", employmentType: "PERMANENT" },
    });
    const uid = made.json?.user?.id ?? made.json?.userId;
    if (!uid) throw new Error(`could not add the second waiter: ${made.status} ${JSON.stringify(made.json)?.slice(0, 200)}`);
    waiter2 = { id: uid, name: "Grace Atim" };
  }

  const people = {
    waiter: { userId: ids.waiter.id, name: ids.waiter.name, pin: await freshPin(managerToken, ids.waiter.id) },
    waiter2: { userId: waiter2.id, name: waiter2.name, pin: await freshPin(managerToken, waiter2.id) },
    supervisor: { userId: ids.supervisor.id, name: ids.supervisor.name, pin: await freshPin(managerToken, ids.supervisor.id) },
    cashier: { userId: ids.cashier.id, name: ids.cashier.name, pin: await freshPin(managerToken, ids.cashier.id) },
    manager: { userId: manager.id, name: manager.name, pin: await freshPin(managerToken, manager.id) },
  };

  for (const w of [people.waiter, people.waiter2]) {
    const t = await pinToken(w.pin);
    await api(t, "POST", "/api/shifts/open", {}); // 201, or 409 when already open
  }
  // Cash needs the taker's own open till (and a till needs a shift).
  for (const [code, p] of [["T3-C1", people.cashier], ["T3-M1", people.manager]] as const) {
    const t = await pinToken(p.pin);
    await api(t, "POST", "/api/shifts/open", {});
    const active = await api(t, "GET", "/api/tills/active");
    if (!active.json?.id) await must(t, "POST", "/api/tills/open", { tillCode: `${code}-${Date.now()}`, openingFloat: 100000 });
  }

  cached = { managerToken, people, items };
  return cached;
}

/** A free table with no open order, its label and id. */
export async function freeTable(token: string, avoid: string[] = [], label?: string): Promise<{ id: string; label: string }> {
  await freeEmptyFixtureTables(token);
  const tables = ((await must(token, "GET", "/api/tables")) as Json[]).filter((t) => (label ? t.label === label : FIXTURE_TABLES.includes(t.label) && t.label !== "12"));
  const open = (await must(token, "GET", "/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100")).data as Json[];
  const busy = new Set(open.map((o) => o.tableId));
  const t = tables
    .filter((x) => x.status === "AVAILABLE" && !busy.has(x.id) && !avoid.includes(x.id))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }))[0];
  if (!t) throw new Error("no free table left on the throwaway database");
  return { id: t.id, label: t.label };
}

export async function ordersOnTable(token: string, tableId: string): Promise<Json[]> {
  const r = await must(token, "GET", `/api/pos/orders?tableId=${tableId}&pageSize=50`);
  return r.data as Json[];
}

/** Sign in through the real login page with a Quick PIN, as that person would. */
export async function signInWithPin(page: Page, pin: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Quick PIN" }).click();
  await page.locator('input[name="branchId"]').fill(BRANCH);
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "Enter" }).click();
  await page.waitForURL(landing);
}

export type NetEntry = { method: string; path: string; status: number };

/** Records API calls as method, path and status only: no bodies, no headers (rule 15). */
export function recordNetwork(page: Page): NetEntry[] {
  const log: NetEntry[] = [];
  page.on("response", (res: Response) => {
    const req: Request = res.request();
    const url = new URL(req.url());
    if (!url.pathname.startsWith("/api/")) return;
    log.push({ method: req.method(), path: url.pathname + (url.search ? url.search : ""), status: res.status() });
  });
  return log;
}

/** Counts taps (clicks) the test makes, so a tap count is measured, not estimated. */
export function tapCounter(page: Page) {
  let n = 0;
  return {
    async tap(locator: ReturnType<Page["locator"]>) {
      n += 1;
      await locator.click();
    },
    get count() {
      return n;
    },
    reset() {
      n = 0;
    },
    page,
  };
}

/** Rule 10: no sideways scroll, no clipped text, no target under 44, no text under 12, at most one filled button. */
export async function measurePage(page: Page) {
  return page.evaluate(() => {
    const out = { sideways: 0, clipped: [] as string[], smallTargets: [] as string[], smallText: [] as string[], filled: 0 };
    out.sideways = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    // With a sheet open, what counts is the sheet: the page under its scrim cannot be touched.
    const dialogs = document.querySelectorAll("[role=dialog]");
    const scope = dialogs.length ? dialogs[dialogs.length - 1] : document.querySelector("[data-order-screen]") ?? document.body;
    for (const el of scope.querySelectorAll("button, a, input, [role=tab]")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 44 - 0.5 || (r.width < 44 - 0.5 && el.tagName !== "INPUT")) out.smallTargets.push(`${el.tagName} ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) out.clipped.push(`${el.tagName} ${(el.textContent || "").trim().slice(0, 40)}`);
      const s = getComputedStyle(el);
      // A chosen group, measure or option (aria-pressed / aria-selected) is a selection, not an action.
      const selection = el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true";
      if (s.backgroundColor === "rgb(0, 0, 51)" && el.tagName === "BUTTON" && !(el as HTMLButtonElement).disabled && !el.closest("header") && !selection) out.filled += 1;
    }
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || !n.textContent?.trim() || !visible(p)) continue;
      const size = parseFloat(getComputedStyle(p).fontSize);
      if (size < 12) out.smallText.push(`${n.textContent.trim().slice(0, 30)} ${size}px`);
    }
    return out;
  });
}

export function expectRule10(m: Awaited<ReturnType<typeof measurePage>>, label: string) {
  expect.soft(m.sideways, `${label}: sideways scroll`).toBe(0);
  expect.soft(m.clipped, `${label}: clipped text`).toEqual([]);
  expect.soft(m.smallTargets, `${label}: targets under 44 px`).toEqual([]);
  expect.soft(m.smallText, `${label}: text under 12 px`).toEqual([]);
  expect.soft(m.filled, `${label}: filled buttons`).toBeLessThanOrEqual(1);
}
