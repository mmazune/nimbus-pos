/**
 * T3 phase 4: the same order screen for supervisor, cashier and manager.
 * Table actions with an endpoint today (move, join, change waiter, split,
 * discount, cancel), the payment safety gate, a takeaway opened by id through
 * Find bill, and the manager's laptop frame.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { api, expectRule10, freeTable, measurePage, pinToken, setupVenue, signInWithPin, type Venue } from "./fixture";

const PROOF = join(__dirname, "../../../../reports/proof/T3");
mkdirSync(PROOF, { recursive: true });

async function person(browser: Browser, pin: string, landing: RegExp, size = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await signInWithPin(page, pin, landing);
  return page;
}

/** An order made through the API as the waiter would: lines, then Send. */
async function sentOrder(v: Venue, tableId: string | null, lines: Array<{ item: string; qty?: number }>) {
  const token = await pinToken(tableId ? v.people.waiter.pin : v.people.cashier.pin);
  const created = await api(token, "POST", "/api/pos/orders", tableId ? { serviceType: "DINE_IN", tableId } : { serviceType: "TAKEAWAY" });
  expect(created.status).toBe(201);
  for (const l of lines) {
    const r = await api(token, "POST", `/api/pos/orders/${created.json.id}/items`, { menuItemId: v.items[l.item].id, quantity: l.qty ?? 1 });
    expect(r.status).toBe(201);
  }
  expect((await api(token, "POST", `/api/pos/orders/${created.json.id}/send`, {})).status).toBe(200);
  return created.json as { id: string; orderNumber: string };
}

async function openTable(page: Page, tableId: string) {
  await page.locator(`[data-operational-table-id="${tableId}"]`).first().click();
  await expect(page.locator("[data-order-screen]")).toBeVisible();
}

async function actions(page: Page) {
  await page.locator("[data-order-panel]").getByRole("button", { name: "More for this table" }).click();
  await expect(page.locator("[data-order-actions]")).toBeVisible();
}

test("supervisor: move, change waiter, split, discount, join, cancel", async ({ browser }) => {
  test.setTimeout(180_000);
  const v = await setupVenue();
  const a = await freeTable(v.managerToken);
  const b = await freeTable(v.managerToken, [a.id]);
  const order = await sentOrder(v, a.id, [{ item: "burger" }, { item: "chips", qty: 2 }]);
  const sup = await person(browser, v.people.supervisor.pin, /\/supervisor\//);
  await sup.goto("/supervisor/floor");

  // Move table: to the free table b.
  await openTable(sup, a.id);
  await actions(sup);
  await sup.getByRole("button", { name: /Move table/ }).click();
  await sup.locator("[data-order-move]").getByRole("button", { name: new RegExp(`^${b.label}`) }).click();
  await sup.getByRole("button", { name: `Move to ${b.label}` }).click();
  await expect(sup.locator("[data-order-screen]")).toHaveCount(0);
  expect((await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json.tableId).toBe(b.id);

  // Change waiter: give it to the second waiter.
  await openTable(sup, b.id);
  await actions(sup);
  await sup.getByRole("button", { name: /Change waiter/ }).click();
  await sup.locator("[data-order-waiters]").getByRole("button", { name: "Grace A.", exact: true }).first().click();
  await sup.getByRole("button", { name: "Give it to Grace A." }).click();
  await expect(sup.getByText("Grace A. has this table now")).toBeVisible();
  const moved = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  expect([v.people.waiter2.userId]).toContain(moved.userId);

  // Split bill: equal parts recorded.
  await actions(sup);
  await sup.getByRole("button", { name: /Split bill/ }).click();
  await sup.locator("[data-order-split]").getByRole("button", { name: /^2/ }).click();
  await sup.getByRole("button", { name: "Split in 2" }).click();
  await expect(sup.getByText("Split in 2 recorded")).toBeVisible();

  // Discount: the words follow the API's answer (taken, or waiting for approval).
  await actions(sup);
  await sup.getByRole("button", { name: /Discount/ }).click();
  await sup.getByRole("button", { name: "10%", exact: true }).click();
  await sup.getByRole("button", { name: "Regular guest", exact: true }).click();
  await sup.getByRole("button", { name: "Take 10% off" }).click();
  await expect(sup.getByText(/10% off (taken|is waiting for approval)/)).toBeVisible();
  const discounts = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}/discounts`)).json;
  const rows = (Array.isArray(discounts) ? discounts : discounts.data) as Array<{ status: string }>;
  const status = rows[rows.length - 1].status;
  await expect(sup.getByText(status === "APPROVED" ? "10% off taken" : "10% off is waiting for approval")).toBeVisible();
  if (status === "APPROVED") {
    await expect(sup.locator("[data-order-discount]")).toContainText("UGX 4,400");
    await expect(sup.locator("[data-order-panel] [data-order-total]")).toHaveText("UGX 39,600");
  }
  await sup.locator("[data-order-screen]").getByRole("button", { name: "Floor" }).click();

  // Join tables: a second order on a free table c joins onto b's bill; c is free after.
  const c = await freeTable(v.managerToken, [a.id, b.id]);
  const other = await sentOrder(v, c.id, [{ item: "wings" }]);
  await sup.reload();
  await openTable(sup, c.id);
  await actions(sup);
  await sup.getByRole("button", { name: /Join tables/ }).click();
  await sup.locator("[data-order-join]").getByRole("button", { name: new RegExp(`^${b.label}`) }).click();
  await sup.getByRole("button", { name: `Join to ${b.label}` }).click();
  await expect(sup.locator("[data-order-screen]")).toHaveCount(0);
  const joined = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  expect(joined.items.some((i: { menuItem: { name: string } }) => i.menuItem.name === "Chicken wings")).toBe(true);
  expect(["CLOSED", "VOIDED", "MERGED"]).toContain((await api(v.managerToken, "GET", `/api/pos/orders/${other.id}`)).json.status);

  // Cancel the order: voided, not deleted; table b is free.
  await openTable(sup, b.id);
  await actions(sup);
  await sup.getByRole("button", { name: /Cancel the order/ }).click();
  await sup.getByLabel("Why").fill("Guests left before eating");
  await sup.getByRole("button", { name: "Cancel the order" }).last().click();
  await expect(sup.locator("[data-order-screen]")).toHaveCount(0);
  expect((await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json.status).toBe("VOIDED");
  const tables = (await api(v.managerToken, "GET", "/api/tables")).json as Array<{ id: string; status: string }>;
  expect(tables.find((t) => t.id === b.id)?.status).toBe("AVAILABLE");
  await sup.context().close();
});

test("a posted payment hides Discount and Cancel, and To pay is what is left", async ({ browser }) => {
  const v = await setupVenue();
  const t = await freeTable(v.managerToken);
  const order = await sentOrder(v, t.id, [{ item: "burger" }]);
  const cashierToken = await pinToken(v.people.cashier.pin);
  const part = await api(cashierToken, "POST", "/api/payments/manual-reference", { orderId: order.id, method: "CARD", amount: 10000, externalTransactionId: `T3-${Date.now()}` });
  expect([200, 201]).toContain(part.status);

  const sup = await person(browser, v.people.supervisor.pin, /\/supervisor\//);
  await sup.goto("/supervisor/floor");
  await openTable(sup, t.id);
  await actions(sup);
  await expect(sup.getByText("A payment is already posted")).toBeVisible();
  await expect(sup.getByRole("button", { name: /^Discount/ })).toHaveCount(0);
  await expect(sup.getByRole("button", { name: /Cancel the order/ })).toHaveCount(0);
  await sup.context().close();

  const cashier = await person(browser, v.people.cashier.pin, /\/cashier\//);
  await cashier.goto("/cashier/floor");
  await openTable(cashier, t.id);
  await cashier.locator("[data-order-panel]").getByRole("button", { name: "Take payment" }).click();
  await expect(cashier.locator("[data-order-to-pay]")).toHaveText("UGX 18,000");
  await expect(cashier.getByText("UGX 10,000 already paid")).toBeVisible();
  await cashier.getByRole("button", { name: /^Card/ }).click();
  await cashier.getByRole("button", { name: "Take UGX 18,000 by card" }).click();
  await expect(cashier.locator("[data-order-paid]")).toBeVisible();
  expect((await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json.status).toBe("CLOSED");
  await cashier.context().close();
});

test("cashier: a takeaway opens by id from Find bill, in the same screen", async ({ browser }) => {
  const v = await setupVenue();
  const order = await sentOrder(v, null, [{ item: "chips" }]);
  const cashier = await person(browser, v.people.cashier.pin, /\/cashier\//);
  await cashier.goto("/cashier/floor");
  await cashier.getByRole("button", { name: "Find bill" }).click();
  await cashier.getByLabel("Search bills").fill(order.orderNumber);
  await cashier.getByRole("list", { name: "Bill results" }).getByRole("button").first().click();
  await expect(cashier.locator("[data-order-screen]")).toBeVisible();
  await expect(cashier.getByRole("heading", { name: `Order ${order.orderNumber}` })).toBeVisible();
  await cashier.locator("[data-order-panel]").getByRole("button", { name: "Take payment" }).click();
  await cashier.getByRole("button", { name: "Exact", exact: true }).click();
  await cashier.getByRole("button", { name: "Take UGX 8,000 in cash" }).click();
  await expect(cashier.locator("[data-order-change-after]")).toContainText("No change to give");
  await cashier.context().close();
});

test("manager on a laptop: the same table under the top bar", async ({ browser }) => {
  const v = await setupVenue();
  const t = await freeTable(v.managerToken);
  const order = await sentOrder(v, t.id, [{ item: "burger" }, { item: "lager", qty: 2 }]);
  const mgr = await person(browser, v.people.manager.pin, /\/manager\//, { width: 1440, height: 900 });
  await mgr.goto("/manager/operations/tables");
  await openTable(mgr, t.id);
  await expect(mgr.locator("[data-order-laptop-bar]")).toBeVisible();
  await expect(mgr.locator("[data-operational-top-nav]")).toBeVisible();
  await expect(mgr.locator("[data-order-panel]").getByRole("button", { name: "Take payment" })).toBeVisible();
  await expect(mgr.locator("[data-order-laptop-bar]").getByRole("button", { name: "Split bill" })).toBeVisible();
  await expect(mgr.locator("[data-order-panel]").getByRole("button", { name: "More for this table" })).toHaveCount(0);
  await mgr.waitForTimeout(400);
  await mgr.screenshot({ path: join(PROOF, "built-Order-Laptop-1440x900.png") });
  expectRule10(await measurePage(mgr), "manager laptop 1440");
  await mgr.locator("[data-order-panel]").getByRole("button", { name: "Take payment" }).click();
  await mgr.getByRole("button", { name: "Exact", exact: true }).click();
  await mgr.getByRole("button", { name: "Take UGX 40,000 in cash" }).click();
  await expect(mgr.locator("[data-order-paid]")).toBeVisible();
  expect((await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json.status).toBe("CLOSED");
  await mgr.context().close();
});
