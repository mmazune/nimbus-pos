/**
 * What the old table sheets did that the one order screen keeps, driven in the
 * browser: quantity first from a keyboard digit, the supervisor's Find order, the
 * reservation card ("Seat them here"), and the shift-not-started banner.
 */
import { expect, test, type Page } from "@playwright/test";

import { api, freeTable, ordersOnTable, pinToken, setupVenue, signInWithPin } from "./fixture";

test.use({ viewport: { width: 1280, height: 800 } });

async function openTable(page: Page, tableId: string) {
  await page.locator(`[data-operational-table-id="${tableId}"]`).first().click();
  await expect(page.locator("[data-order-screen]")).toBeVisible();
}

test("quantity first from a keyboard digit", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  await openTable(page, table.id);
  await page.getByRole("button", { name: "Sides", exact: true }).click();
  await page.keyboard.press("3");
  await page.getByRole("button", { name: /^Chips,/ }).click();
  await expect(page.locator("[data-order-unsent]").getByRole("button", { name: /^3 Chips/ })).toBeVisible();
  await page.getByRole("button", { name: "Floor" }).click();
  await page.getByRole("button", { name: "Leave without sending" }).click();
  expect((await ordersOnTable(v.managerToken, table.id)).filter((o) => !["CLOSED", "VOIDED"].includes(o.status))).toHaveLength(0);
});

test("supervisor: Find order opens the order in the same screen", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  const t = await pinToken(v.people.waiter.pin);
  const order = (await api(t, "POST", "/api/pos/orders", { serviceType: "DINE_IN", tableId: table.id })).json;
  await api(t, "POST", `/api/pos/orders/${order.id}/items`, { menuItemId: v.items.chips.id, quantity: 1 });
  await api(t, "POST", `/api/pos/orders/${order.id}/send`, {});
  await signInWithPin(page, v.people.supervisor.pin, /\/supervisor\//);
  await page.goto("/supervisor/floor");
  await page.getByRole("button", { name: "Find order" }).click();
  await page.getByLabel("Search orders").fill(order.orderNumber);
  await page.getByRole("list", { name: "Order results" }).getByRole("button").first().click();
  await expect(page.locator("[data-order-screen]")).toBeVisible();
  await expect(page.locator("[data-order-panel]").getByRole("button", { name: /^1 Chips/ })).toBeVisible();
  await expect(page.locator("[data-order-panel] [data-order-total]")).toHaveText("UGX 8,000");
  const cashierToken = await pinToken(v.people.cashier.pin);
  await api(cashierToken, "POST", `/api/pos/orders/${order.id}/close`, { payments: [{ method: "CASH", amount: 8000 }] });
});

test("a booked table: Seat them here, then the menu", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  const at = new Date(Date.now() + 20 * 60_000).toISOString();
  const made = await api(v.managerToken, "POST", "/api/reservations", { customerName: "Ruth N.", customerPhone: "+256700000124", partySize: 3, reservationAt: at, tableId: table.id });
  expect(made.status, JSON.stringify(made.json)).toBe(201);
  const res = made.json;
  await api(v.managerToken, "PATCH", `/api/reservations/${res.id}/confirm`, {});
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  await openTable(page, table.id);
  const card = page.locator("[data-order-reserved]");
  await expect(card).toBeVisible();
  await expect(card.getByText("3 guests")).toBeVisible();
  await card.getByRole("button", { name: "Seat them here" }).click();
  await expect(page.locator("[data-order-reserved]")).toHaveCount(0);
  await expect(page.locator("[data-order-menu]")).toBeVisible();
  expect((await api(v.managerToken, "GET", `/api/reservations/${res.id}`)).json.status).toBe("SEATED");
  for (const o of await ordersOnTable(v.managerToken, table.id)) {
    if (!["CLOSED", "VOIDED"].includes(o.status)) await api(v.managerToken, "POST", `/api/pos/orders/${o.id}/void`, { reason: "T3 e2e: seated test" });
  }
  await api(v.managerToken, "POST", `/api/reservations/${res.id}/complete`, {});
});

test("a waiter whose shift is not open sees why, and nothing is added", async ({ page }) => {
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  const t = await pinToken(v.people.waiter2.pin);
  const shift = (await api(t, "GET", "/api/shifts/active")).json;
  if (shift?.id) expect([200, 201]).toContain((await api(t, "POST", `/api/shifts/${shift.id}/close`, {})).status);
  try {
    await signInWithPin(page, v.people.waiter2.pin, /\/waiter\/floor/);
    await openTable(page, table.id);
    await expect(page.locator("[data-order-screen]").getByText("Shift not started")).toBeVisible();
    await expect(page.getByText("Start your shift under Me before taking orders.")).toBeVisible();
    await page.getByRole("button", { name: "Sides", exact: true }).click();
    await page.getByRole("button", { name: /^Chips,/ }).click();
    await expect(page.locator("[data-order-unsent]")).toHaveCount(0);
    await expect(page.locator("[data-order-panel]").getByRole("button", { name: /^Send/ })).toHaveCount(0);
  } finally {
    await api(t, "POST", "/api/shifts/open", {});
  }
});
