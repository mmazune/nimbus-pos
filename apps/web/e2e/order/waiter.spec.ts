/**
 * T3 phases 2 and 3: the order screen for a waiter on a 1280 × 800 terminal.
 * Done-when 2 (a free table tapped and left saves nothing), 3 (the second Send
 * sends only the new lines) and 4 (search by three letters and by initials,
 * quantity first, "Same again").
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { tapTable } from "../t5/floor";

import { api, expectRule10, freeTable, measurePage, ordersOnTable, pinToken, recordNetwork, setupVenue, signInWithPin } from "./fixture";

const PROOF = join(__dirname, "../../../../reports/proof/T3");
mkdirSync(PROOF, { recursive: true });

test.use({ viewport: { width: 1280, height: 800 } });

async function openTable(page: Page, tableId: string) {
  await tapTable(page, tableId, "click");
  await expect(page.locator("[data-order-screen]")).toBeVisible();
  await expect(page.locator("[data-order-menu]")).toBeVisible();
}

test("a free table tapped and left creates nothing on the server", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  const ordersBefore = (await ordersOnTable(v.managerToken, table.id)).length;
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  const net = recordNetwork(page);
  await openTable(page, table.id);
  await expect(page.getByText("Nothing on this table yet")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(PROOF, "built-Order-Empty-1280x800.png") });
  expectRule10(await measurePage(page), "Order-Empty 1280");
  await page.getByRole("button", { name: "Floor" }).click();
  await expect(page.locator("[data-order-screen]")).toHaveCount(0);
  await page.waitForTimeout(500);
  const writes = net.filter((e) => e.method !== "GET");
  writeFileSync(join(PROOF, "free-table-network.json"), JSON.stringify({ table: table.label, calls: net, writes }, null, 2));
  expect(writes).toEqual([]);
  expect((await ordersOnTable(v.managerToken, table.id)).length).toBe(ordersBefore);
});

test("waiter sends food, adds drinks, and the second Send sends only the new lines", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  const net = recordNetwork(page);
  await openTable(page, table.id);

  // Food: a burger with choices, two chips (quantity first), wings.
  await page.getByRole("button", { name: "Popular", exact: true }).click();
  await page.getByRole("button", { name: /^Beef burger, 28,000/ }).click();
  const sheet = page.locator("[data-order-item-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Medium", exact: true }).click();
  await sheet.getByRole("button", { name: "Onions", exact: true }).click();
  await page.getByRole("button", { name: "Add · UGX 28,000" }).click();
  await page.getByRole("button", { name: "Sides", exact: true }).click();
  await page.locator("[data-order-qty]").getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: /^Chips,/ }).click();
  await page.getByRole("button", { name: "Grills", exact: true }).click();
  await page.getByRole("button", { name: /^Chicken wings,/ }).click();

  const panel = page.locator("[data-order-panel]");
  await expect(panel.getByRole("button", { name: /2 Chips/ })).toBeVisible();
  await expect(panel.locator("[data-order-total]")).toHaveText("UGX 68,000");
  expect(net.filter((e) => e.method !== "GET")).toEqual([]); // still nothing saved before Send

  await panel.getByRole("button", { name: "Send 4 items" }).click();
  await expect(panel.locator("[data-order-round]")).toHaveCount(1);
  const creates = net.filter((e) => e.method === "POST" && e.path === "/api/pos/orders");
  expect(creates).toHaveLength(1);

  // Drinks: Popular → lager ×2, Whisky → Double + Cola, Soft drinks → cola.
  await page.getByRole("tab", { name: "Drinks" }).click();
  await page.getByRole("button", { name: "Popular", exact: true }).click();
  await page.locator("[data-order-qty]").getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: /^Lager 500 ml,/ }).click();
  await page.getByRole("button", { name: "Blended Scotch, Double, 15,000" }).click();
  await page.locator("[data-order-mixer]").getByRole("button", { name: "Cola", exact: true }).click();
  await expect(panel.getByRole("button", { name: /Blended Scotch, Double · Cola/ })).toBeVisible();
  // Search: three letters, then initials.
  await page.getByRole("button", { name: "Search the whole menu" }).click();
  await page.getByLabel("Search the whole menu").fill("col");
  await expect(page.locator("[data-order-search]").getByRole("button", { name: /^Cola 300 ml,/ })).toBeVisible();
  await page.getByLabel("Search the whole menu").fill("bs");
  await expect(page.locator("[data-order-search]").getByRole("button", { name: /Blended Scotch, Tot/ })).toBeVisible();
  await page.getByLabel("Search the whole menu").fill("col");
  await page.locator("[data-order-search]").getByRole("button", { name: /^Cola 300 ml,/ }).click();
  await page.getByRole("button", { name: "Back to the menu" }).click();
  await page.getByRole("button", { name: "Whisky", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(PROOF, "built-Order-Terminal-1280x800.png") });
  expectRule10(await measurePage(page), "Order-Terminal 1280");

  await expect(panel.locator("[data-order-total]")).toHaveText("UGX 98,000");
  const before = net.length;
  await panel.getByRole("button", { name: "Send 4 items" }).click();
  await expect(panel.locator("[data-order-round]")).toHaveCount(2);
  await expect(panel.locator("[data-order-total]")).toHaveText("UGX 98,000");

  const second = net.slice(before);
  expect(second.filter((e) => e.method === "POST" && e.path === "/api/pos/orders")).toEqual([]);
  expect(second.filter((e) => e.method === "POST" && /\/items$/.test(e.path))).toHaveLength(3);
  expect(second.filter((e) => e.method === "POST" && /\/send$/.test(e.path))).toHaveLength(1);

  const order = (await ordersOnTable(v.managerToken, table.id)).find((o) => !["CLOSED", "VOIDED"].includes(o.status));
  if (!order) throw new Error("the order was not found after the first Send");
  const detail = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  const rounds = new Set(detail.items.map((i: { sentAt: string }) => i.sentAt));
  expect(rounds.size).toBe(2);
  expect(detail.total).toBe("98000");

  // "Same again" re-adds the drinks of the last round, not sent.
  await panel.getByRole("button", { name: "Same again" }).click();
  await expect(panel.locator("[data-order-unsent]")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Send 4 items" })).toBeVisible();
  await expect(panel.locator("[data-order-total]")).toHaveText("UGX 128,000");
  // Tap an unsent line: change how many, then remove another.
  await panel.locator("[data-order-unsent]").getByRole("button", { name: /^2 Lager 500 ml/ }).click();
  await page.locator("[data-order-item-sheet]").waitFor();
  await page.getByRole("button", { name: "Fewer items" }).click();
  await page.getByRole("button", { name: "Save · UGX 6,000" }).click();
  await expect(panel.locator("[data-order-unsent]").getByRole("button", { name: /^1 Lager 500 ml/ })).toBeVisible();
  await panel.locator("[data-order-unsent]").getByRole("button", { name: /^1 Cola 300 ml/ }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(panel.locator("[data-order-unsent]").getByRole("button", { name: /Cola 300 ml/ })).toHaveCount(0);
  await expect(panel.locator("[data-order-total]")).toHaveText("UGX 119,000");
  // Leave it unsent: the leave guard asks; leave without sending.
  await page.getByRole("button", { name: "Floor" }).click();
  await page.getByRole("button", { name: "Leave without sending" }).click();
  await expect(page.locator("[data-order-screen]")).toHaveCount(0);
  const after = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  expect(after.items).toHaveLength(detail.items.length);

  writeFileSync(join(PROOF, "two-sends-network.json"), JSON.stringify({ table: table.label, calls: net }, null, 2));
  // Close this table's order so the next run starts on a clean floor.
  const cashierToken = await pinToken(v.people.cashier.pin);
  await api(cashierToken, "POST", `/api/pos/orders/${order.id}/close`, { payments: [{ method: "CASH", amount: 98000 }] });
});

test("race: a double tap on Send makes one order and one ticket round", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  const net = recordNetwork(page);
  await openTable(page, table.id);
  await page.getByRole("button", { name: "Sides", exact: true }).click();
  await page.getByRole("button", { name: /^Chips,/ }).click();
  const send = page.locator("[data-order-panel]").getByRole("button", { name: "Send 1 item" });
  await Promise.all([send.click({ noWaitAfter: true }), send.click({ noWaitAfter: true, force: true }).catch(() => undefined)]);
  await expect(page.locator("[data-order-panel] [data-order-round]")).toHaveCount(1);
  await page.waitForTimeout(500);
  expect(net.filter((e) => e.method === "POST" && e.path === "/api/pos/orders")).toHaveLength(1);
  expect(net.filter((e) => e.method === "POST" && /\/send$/.test(e.path) && e.status < 300)).toHaveLength(1);
  const open = (await ordersOnTable(v.managerToken, table.id)).filter((o) => !["CLOSED", "VOIDED"].includes(o.status));
  expect(open).toHaveLength(1);
  const detail = (await api(v.managerToken, "GET", `/api/pos/orders/${open[0].id}`)).json;
  expect(detail.items).toHaveLength(1);
  const cashierToken = await pinToken(v.people.cashier.pin);
  await api(cashierToken, "POST", `/api/pos/orders/${open[0].id}/close`, { payments: [{ method: "CASH", amount: 8000 }] });
});

test("race: two waiters send on the same free table at once; the screen shows both orders", async ({ browser }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  const pages: Page[] = [];
  for (const pin of [v.people.waiter.pin, v.people.waiter2.pin]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    await signInWithPin(p, pin, /\/waiter\/floor/);
    await openTable(p, table.id);
    await p.getByRole("button", { name: "Sides", exact: true }).click();
    await p.getByRole("button", { name: /^Chips,/ }).click();
    pages.push(p);
  }
  await Promise.all(pages.map((p) => p.locator("[data-order-panel]").getByRole("button", { name: "Send 1 item" }).click()));
  for (const p of pages) await expect(p.locator("[data-order-panel] [data-order-round]")).toHaveCount(1);
  const open = (await ordersOnTable(v.managerToken, table.id)).filter((o) => !["CLOSED", "VOIDED"].includes(o.status));
  expect(open).toHaveLength(2);
  // Reopened, the table says it holds two orders instead of silently showing one.
  await pages[0].getByRole("button", { name: "Floor" }).click();
  await pages[0].reload();
  await openTable(pages[0], table.id);
  await expect(pages[0].getByText("2 open orders on this table")).toBeVisible();
  const cashierToken = await pinToken(v.people.cashier.pin);
  for (const o of open) await api(cashierToken, "POST", `/api/pos/orders/${o.id}/close`, { payments: [{ method: "CASH", amount: 8000 }] });
  for (const p of pages) await p.context().close();
});

test("another waiter's table: read only, as drawn", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  const graceToken = await pinToken(v.people.waiter2.pin);
  const created = (await api(graceToken, "POST", "/api/pos/orders", { serviceType: "DINE_IN", tableId: table.id })).json;
  await api(graceToken, "POST", `/api/pos/orders/${created.id}/items`, { menuItemId: v.items.lager.id, quantity: 2 });
  await api(graceToken, "POST", `/api/pos/orders/${created.id}/items`, { menuItemId: v.items.chips.id, quantity: 1 });
  await api(graceToken, "POST", `/api/pos/orders/${created.id}/send`, {});

  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  await tapTable(page, table.id, "click");
  const other = page.locator("[data-order-other]");
  await expect(other).toBeVisible();
  await expect(other.getByText("This is Grace A.’s table")).toBeVisible();
  const panel = page.locator("[data-order-panel]");
  // The lines, as the kitchen sees them (the order read is refused to a waiter).
  await expect(panel.getByText("3 items")).toBeVisible();
  await expect(panel.getByRole("button", { name: /^2 Lager 500 ml/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^1 Chips/ })).toBeVisible();
  await expect(panel.locator("[data-order-total]")).toHaveText("UGX 20,000");
  await expect(panel.getByRole("button", { name: /Send|Take payment/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^2 Lager 500 ml, 12,000/ })).toBeVisible();
  await expect(panel.getByText("The lines as the kitchen has them")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search the whole menu" })).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PROOF, "built-Order-Other-1280x800.png") });
  expectRule10(await measurePage(page), "Order-Other 1280");

  // Print bill prints from this terminal (the API refuses the bill request to a waiter, so none is recorded).
  await page.evaluate(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints += 1;
    };
  });
  await panel.getByRole("button", { name: "Print bill" }).click();
  await expect(page.getByText("Bill sent to print")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  await page.getByRole("button", { name: "Done" }).click();

  // Take it over with a supervisor's PIN, typed by the supervisor on this device.
  await other.getByRole("button", { name: /Take it over/ }).click();
  const pinSheet = page.locator("[data-order-pin]");
  await expect(pinSheet).toBeVisible();
  for (const d of v.people.supervisor.pin) await page.getByRole("dialog").getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Take it over" }).click();
  await expect(page.locator("[data-order-other]")).toHaveCount(0);
  await expect(page.locator("[data-order-menu]")).toBeVisible();
  const mine = (await api(v.managerToken, "GET", `/api/pos/orders/${created.id}`)).json;
  expect(mine.userId).toBe(v.people.waiter.userId);
  const cashierToken = await pinToken(v.people.cashier.pin);
  await api(cashierToken, "POST", `/api/pos/orders/${created.id}/close`, { payments: [{ method: "CASH", amount: 20000 }] });
});
