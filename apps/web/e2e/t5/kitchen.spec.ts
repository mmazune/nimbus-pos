import { expect, test, type Page } from "@playwright/test";

import { api, as, ensureLambChops, pinSignIn, rule10, saveJson, shot, tableByLabel, terminal } from "./support";

/**
 * T5 phase 5 — the kitchen and bar screens, on the demo venue: a chef and a bartender sign in with
 * a PIN and land on their own screen; eight tickets fit 1920 × 1080; Ready, Done with bring back,
 * Sold out with mark, back on and a number.
 */
test.describe.configure({ mode: "serial" });
const log: Record<string, unknown> = {};
test.afterAll(() => saveJson("phase5-kitchen-measured.json", log));
type Json = Record<string, any>;

const CHEF = ["KITCHEN", "COLD_KITCHEN", "DESSERT"];

async function openChefTickets(): Promise<Json[]> {
  const chef = await as("chef1");
  const out: Json[] = [];
  for (const s of CHEF) out.push(...(await api<{ data: Json[] }>(chef.token, "GET", `/kds/queue?station=${s}&pageSize=100`)).data.filter((t) => t.status !== "READY"));
  return out;
}

/** Sends one kitchen dish on free tables until the chef has at least `n` open tickets. */
async function atLeastTickets(n: number) {
  const w = (await as("waiter4")).token;
  await api(w, "POST", "/shifts/open", {}, [200, 201, 409]);
  const ws = await api<Json>(w, "GET", "/menu/workspace");
  const dish = (ws.items as Json[]).find((i) => i.station === "KITCHEN" && i.availability?.state !== "SOLD_OUT" && !i.servings?.length && !(i.choiceGroups ?? []).some((g: Json) => g.required)) as Json;
  const free = ["T07", "T10", "T12", "T13", "T14", "T15", "T16", "B05", "B06", "B07", "B08", "B09"];
  for (const label of free) {
    if ((await openChefTickets()).length >= n) break;
    const t = await tableByLabel(label);
    const o = await api<Json>(w, "POST", "/pos/orders", { serviceType: "DINE_IN", tableId: t.id }, [200, 201, 409]);
    if (!o?.id) continue;
    await api(w, "POST", `/pos/orders/${o.id}/items`, { menuItemId: dish.id, quantity: 1 });
    await api(w, "POST", `/pos/orders/${o.id}/send`, {});
  }
  return openChefTickets();
}

async function visibleTickets(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>("[data-kitchen-tickets]");
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-kitchen-ticket]"));
    const bar = document.querySelector<HTMLElement>("[data-touch-bar='terminal']")?.getBoundingClientRect().top ?? window.innerHeight;
    const fully = cards.filter((c) => {
      const r = c.closest("section")?.getBoundingClientRect() ?? c.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= bar + 1;
    }).length;
    return { cards: cards.length, fullyVisible: fully, gridScrolls: grid ? grid.scrollHeight > grid.clientHeight + 1 : false, pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 };
  });
}

test("a chef signs in with a PIN and lands on the kitchen screen; eight tickets fit 1920 × 1080", async ({ browser }) => {
  test.setTimeout(180_000);
  const tickets = await atLeastTickets(8);
  log.openChefTickets = tickets.length;
  expect(tickets.length).toBeGreaterThanOrEqual(8);
  const K = await terminal(browser, { width: 1920, height: 1080 });
  await pinSignIn(K.page, "chef1");
  await expect(K.page).toHaveURL(/\/kitchen$/);
  await expect(K.page.locator("[data-kitchen-ticket]").first()).toBeVisible();
  await K.page.getByRole("button", { name: /^All stations/ }).click().catch(() => undefined);
  const v = await visibleTickets(K.page);
  log.at1920 = v;
  expect(v.fullyVisible).toBeGreaterThanOrEqual(8);
  expect(v.pageScrolls).toBe(false);
  await rule10(K.page, "kitchen-1920", log);
  await shot(K.page, "phase5-kitchen-1920x1080.png");
  // Oldest first.
  const starts = await K.page.locator("[data-kitchen-ticket]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kitchen-ticket")));
  const order = tickets.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id)).map((t) => t.id);
  expect(starts.slice(0, 8)).toEqual(order.filter((id) => starts.includes(id)).slice(0, 8));
  await K.page.setViewportSize({ width: 1280, height: 800 });
  await rule10(K.page, "kitchen-1280", log);
  await shot(K.page, "phase5-kitchen-1280x800.png");
  await K.ctx.close();
});

test("Ready reaches the waiter; Done lists it and brings it back", async ({ browser }) => {
  const K = await terminal(browser);
  await pinSignIn(K.page, "chef1");
  const first = K.page.locator("[data-kitchen-ticket]").first();
  const id = await first.getAttribute("data-kitchen-ticket");
  await first.getByRole("button", { name: "Ready" }).click();
  await expect(K.page.locator(`[data-kitchen-ticket="${id}"]`)).toHaveCount(0, { timeout: 10_000 });
  const all = await api<{ tickets: Json[] }>((await as("manager1")).token, "GET", "/kds/ready?scope=all");
  expect(all.tickets.some((t) => t.id === id)).toBe(true);
  await K.page.getByRole("link", { name: /^Done/ }).first().click().catch(async () => K.page.goto("/kitchen/done"));
  await expect(K.page).toHaveURL(/\/kitchen\/done/);
  const row = K.page.locator("[data-kitchen-done] button").filter({ hasText: /Done \d\d:\d\d/ }).first();
  await row.click();
  await rule10(K.page, "done-sheet-1280", log);
  await shot(K.page, "phase5-done-1280x800.png");
  await K.page.getByRole("dialog").getByRole("button", { name: "Bring back to Tickets" }).click();
  await expect(K.page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
  await K.ctx.close();
});

test("Sold out: mark, back on and set a number; the waiter's menu follows", async ({ browser }) => {
  const lambId = await ensureLambChops();
  // Start from "on": another case on this venue may have left it sold out or counted down.
  await api((await as("chef1")).token, "POST", `/menu/items/${lambId}/available`, {});
  const K = await terminal(browser);
  await pinSignIn(K.page, "chef1");
  await K.page.goto("/kitchen/sold-out");
  await K.page.getByRole("tab", { name: /^All \d+ items/ }).click();
  await K.page.getByLabel("Find an item").fill("Lamb chops");
  const row = K.page.locator('[data-soldout-row="Lamb chops"]');
  // Another case may have left it sold out on this venue: put it back on first, as a chef would.
  if (await row.getByRole("button", { name: "Back on" }).count()) {
    await row.getByRole("button", { name: "Back on" }).click();
    await expect(row.getByRole("button", { name: "Mark sold out" })).toBeVisible({ timeout: 10_000 });
  }
  await row.getByRole("button", { name: "Mark sold out" }).click();
  await expect(row).toContainText("Sold out", { timeout: 10_000 });
  const w = (await as("waiter1")).token;
  const avail = async () => ((await api<Json>(w, "GET", "/menu/workspace")).items as Json[]).find((i) => i.id === lambId)?.availability;
  expect((await avail()).state).toBe("SOLD_OUT");
  await rule10(K.page, "soldout-1280", log);
  await shot(K.page, "phase5-sold-out-1280x800.png");
  await row.getByRole("button", { name: "Back on" }).click();
  await expect.poll(async () => (await avail()).state, { timeout: 10_000 }).toBe("AVAILABLE");
  await row.getByRole("button", { name: "Set a number" }).click();
  await K.page.getByRole("dialog").getByRole("button", { name: "12", exact: true }).click();
  await rule10(K.page, "set-number-1280", log);
  await shot(K.page, "phase5-set-number-1280x800.png");
  await K.page.getByRole("dialog").getByRole("button", { name: "Set 12 left" }).click();
  await expect.poll(async () => (await avail()).left, { timeout: 10_000 }).toBe(12);
  await K.ctx.close();
});

test("a bartender signs in with a PIN and lands on the bar screen, bar tickets only", async ({ browser }) => {
  const B = await terminal(browser);
  await pinSignIn(B.page, "bartender1");
  await expect(B.page).toHaveURL(/\/kitchen$/);
  await expect(B.page.locator("[data-touch-shell]")).toContainText("Bar");
  await expect(B.page.locator("[data-kitchen-tickets], [data-kitchen-screen] section[aria-label='No tickets']").first()).toBeVisible({ timeout: 20_000 });
  // Every ticket on the bartender's screen is a bar ticket (checked against the server's queue).
  const ids = await B.page.locator("[data-kitchen-ticket]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kitchen-ticket")));
  const bar = (await api<{ data: Json[] }>((await as("manager1")).token, "GET", "/kds/queue?station=BAR&pageSize=100")).data.map((t) => t.id);
  log.barTickets = ids.length;
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(bar).toContain(id);
  await rule10(B.page, "bar-1280", log);
  await shot(B.page, "phase5-bar-1280x800.png");
  // Chef and bartender bars: Tickets, Done, Sold out (Store waits for its engine).
  const nav = await B.page.locator("[data-touch-bar='terminal'] nav a, [data-touch-bar='terminal'] nav button").allTextContents();
  log.kitchenBar = nav;
  expect(nav.map((t) => t.replace(/\d+$/, "").trim())).toEqual(["Tickets", "Done", "Sold out"]);
  await B.ctx.close();
});
