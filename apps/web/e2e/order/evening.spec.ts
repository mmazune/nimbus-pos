/**
 * "Table 12's evening" (T3 phase 6, Done-when 5, 6, 8): real people, real PINs,
 * one browser each, at 1280 × 800.
 *  1. The waiter sends food at a free table 12.
 *  2. She adds drinks and sends again (only the new lines go).
 *  3. The supervisor voids the wings, made, with a reason. A waiter cannot.
 *  4. The cashier takes 100,000 in cash; the change shows before and after.
 *  5. Table 12 is free.
 * Tap counts are measured in taps.spec.ts, from the Floor.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { tapTable } from "../t5/floor";

import { api, expectRule10, freeTable, measurePage, ordersOnTable, pinToken, setupVenue, signInWithPin } from "./fixture";

const PROOF = join(__dirname, "../../../../reports/proof/T3");
mkdirSync(PROOF, { recursive: true });
const RUN = process.env.T3_RUN || "1";

async function person(browser: Browser, pin: string, landing: RegExp, size = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await signInWithPin(page, pin, landing);
  return page;
}

async function openTable(page: Page, tableId: string) {
  await tapTable(page, tableId, "click");
  await expect(page.locator("[data-order-screen]")).toBeVisible();
}

test("Table 12's evening", async ({ browser }) => {
  test.setTimeout(180_000);
  const v = await setupVenue();
  const table = await freeTable(v.managerToken, [], "12");

  // ── 1. The waiter sends food at a free table 12 ──
  const waiter = await person(browser, v.people.waiter.pin, /\/waiter\/floor/);
  await tapTable(waiter, table.id, "click");
  await expect(waiter.locator("[data-order-screen]")).toBeVisible();
  await expect(waiter.getByRole("heading", { name: "Table 12" })).toBeVisible();

  // Back to the screen's opening view between tasks.
  const home = async () => {
    await waiter.getByRole("tab", { name: "Food" }).click();
  };

  // A burger with choices: Grills → Beef burger → Medium → Add.
  await home();
  await waiter.getByRole("button", { name: "Popular", exact: true }).click();
  await waiter.getByRole("button", { name: /^Beef burger,/ }).click();
  await waiter.locator("[data-order-item-sheet]").getByRole("button", { name: "Medium", exact: true }).click();
  await waiter.locator("[data-order-item-sheet]").getByRole("button", { name: "Onions", exact: true }).click(); // an extra choice, beyond the count
  await waiter.getByRole("button", { name: "Add · UGX 28,000" }).click();

  await waiter.getByRole("button", { name: "Sides", exact: true }).click();
  await waiter.locator("[data-order-qty]").getByRole("button", { name: "2", exact: true }).click();
  await waiter.getByRole("button", { name: /^Chips,/ }).click();
  await waiter.getByRole("button", { name: "Grills", exact: true }).click();
  await waiter.getByRole("button", { name: /^Chicken wings,/ }).click();
  const wPanel = waiter.locator("[data-order-panel]");
  await expect(wPanel.locator("[data-order-total]")).toHaveText("UGX 68,000");
  await wPanel.getByRole("button", { name: "Send 4 items" }).click();
  await expect(wPanel.locator("[data-order-round]")).toHaveCount(1);
  const order = (await ordersOnTable(v.managerToken, table.id)).find((o) => !["CLOSED", "VOIDED"].includes(o.status));
  if (!order) throw new Error("no order after the first Send");

  // ── 2. She adds drinks and sends again ──
  // A beer from Popular: Drinks opens on Popular (R3: Popular is the first group), then the lager.
  await home();
  await waiter.getByRole("tab", { name: "Drinks" }).click();
  await expect(waiter.getByRole("button", { name: "Popular", exact: true })).toHaveAttribute("aria-pressed", "true");
  await waiter.getByRole("button", { name: /^Lager 500 ml,/ }).click();
  await waiter.getByRole("button", { name: /^Lager 500 ml,/ }).click(); // the second lager
  // A double whisky with cola: Drinks (opens on Popular, where the house Scotch is) → Double → Cola.
  await home();
  await waiter.getByRole("tab", { name: "Drinks" }).click();
  await waiter.getByRole("button", { name: "Blended Scotch, Double, 15,000" }).click();
  await waiter.locator("[data-order-mixer]").getByRole("button", { name: "Cola", exact: true }).click();
  await waiter.getByRole("button", { name: "Soft drinks", exact: true }).click();
  await waiter.getByRole("button", { name: /^Cola 300 ml,/ }).click();
  await expect(wPanel.locator("[data-order-total]")).toHaveText("UGX 98,000");
  // The same whisky by search (typing is not a tap): search, Double, Cola — then removed again.
  await home();
  await waiter.getByRole("button", { name: "Search the whole menu" }).click();
  await waiter.getByLabel("Search the whole menu").fill("bs");
  await waiter.locator("[data-order-search]").getByRole("button", { name: "Blended Scotch, Double, 15,000" }).click();
  await waiter.locator("[data-order-mixer]").getByRole("button", { name: "Cola", exact: true }).first().click();
  await waiter.getByRole("button", { name: "Back to the menu" }).click().catch(() => undefined);
  await wPanel.locator("[data-order-unsent]").getByRole("button", { name: /^1 Blended Scotch/ }).last().click();
  await waiter.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(wPanel.locator("[data-order-total]")).toHaveText("UGX 98,000");
  await waiter.getByRole("tab", { name: "Drinks" }).click();
  await waiter.getByRole("button", { name: "Whisky", exact: true }).click();
  await waiter.waitForTimeout(400);
  await waiter.screenshot({ path: join(PROOF, `evening-${RUN}-1-waiter-before-second-send.png`) });
  expectRule10(await measurePage(waiter), "waiter 1280 drinks");
  await wPanel.getByRole("button", { name: "Send 4 items" }).click();
  await expect(wPanel.locator("[data-order-round]")).toHaveCount(2);

  // The waiter cannot void: a sent line does nothing on tap, and the API refuses her.
  await wPanel.locator("[data-order-round]").last().getByRole("button", { name: /Chicken wings/ }).click();
  await expect(waiter.locator("[data-order-void-sheet]")).toHaveCount(0);
  const detail = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  const wings = detail.items.find((i: { menuItem: { name: string } }) => i.menuItem.name === "Chicken wings");
  const waiterToken = await pinToken(v.people.waiter.pin);
  const refused = await api(waiterToken, "POST", `/api/orders/${order.id}/items/${wings.id}/void`, { reason: "GUEST_COMPLAINT", wasMade: true });
  expect(refused.status).toBe(403);
  await waiter.context().close();

  // ── 3. The supervisor voids the wings, made, with a reason ──
  const sup = await person(browser, v.people.supervisor.pin, /\/supervisor\//);
  await sup.goto("/supervisor/floor");
  await openTable(sup, table.id);
  const sPanel = sup.locator("[data-order-panel]");
  await expect(sPanel.locator("[data-order-total]")).toHaveText("UGX 98,000");
  await expect(sPanel.getByRole("button", { name: "Take payment" })).toHaveCount(0);
  await sPanel.getByRole("button", { name: "More for this table" }).click();
  await sup.waitForTimeout(400);
  await sup.screenshot({ path: join(PROOF, `evening-${RUN}-2-supervisor-table-actions.png`) });
  expectRule10(await measurePage(sup), "supervisor table actions 1280");
  await sup.getByRole("button", { name: /Void an item/ }).click();
  await sup.locator("[data-order-void-pick]").getByRole("button", { name: /Chicken wings/ }).click();
  const vs = sup.locator("[data-order-void-sheet]");
  await expect(vs).toBeVisible();
  await sup.getByRole("tab", { name: "Made, it is waste" }).click();
  await vs.getByRole("button", { name: "Guest complaint", exact: true }).click();
  await expect(vs.getByText("The bill becomes UGX 74,000.")).toBeVisible();
  await sup.waitForTimeout(400);
  await sup.screenshot({ path: join(PROOF, `evening-${RUN}-3-supervisor-void.png`) });
  expectRule10(await measurePage(sup), "supervisor void 1280");
  await sup.getByRole("button", { name: "Void 1 item · UGX 24,000" }).click();
  await expect(vs).toHaveCount(0);
  await expect(sPanel.locator("[data-order-total]")).toHaveText("UGX 74,000");
  await expect(sPanel.getByRole("button", { name: /Chicken wings.*voided/ })).toBeVisible();
  const afterVoid = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  const voided = afterVoid.items.find((i: { id: string }) => i.id === wings.id);
  expect(voided.voidReason).toBe("GUEST_COMPLAINT");
  expect(voided.wasMade).toBe(true);
  expect(afterVoid.total).toBe("74000");
  await sup.context().close();

  // ── 4. The cashier takes 100,000 in cash ──
  const cashier = await person(browser, v.people.cashier.pin, /\/cashier\//);
  await cashier.goto("/cashier/floor");
  await openTable(cashier, table.id);
  const cPanel = cashier.locator("[data-order-panel]");
  await expect(cPanel.locator("[data-order-total]")).toHaveText("UGX 74,000");
  await cPanel.getByRole("button", { name: "Take payment" }).click();
  const pay = cashier.locator("[data-order-pay]");
  await expect(pay.locator("[data-order-to-pay]")).toHaveText("UGX 74,000");
  await pay.getByRole("button", { name: "100,000", exact: true }).click();
  const changeBefore = await pay.locator("[data-order-change-before]").innerText();
  expect(changeBefore).toContain("UGX 26,000");
  await cashier.waitForTimeout(400);
  await cashier.screenshot({ path: join(PROOF, `evening-${RUN}-4-cashier-pay-before.png`) });
  expectRule10(await measurePage(cashier), "cashier pay 1280");
  await pay.getByRole("button", { name: "Take UGX 74,000 in cash" }).click();
  const after = cashier.locator("[data-order-change-after]");
  await expect(after).toContainText("UGX 26,000");
  await expect(after).toContainText("Cash given UGX 100,000");
  await cashier.waitForTimeout(400);
  await cashier.screenshot({ path: join(PROOF, `evening-${RUN}-5-cashier-paid.png`) });
  await cashier.getByRole("button", { name: "Back to the floor" }).click();
  await expect(cashier.locator("[data-order-screen]")).toHaveCount(0);

  // ── 5. Table 12 is free ──
  const tables = (await api(v.managerToken, "GET", "/api/tables")).json as Array<{ id: string; status: string }>;
  expect(tables.find((t) => t.id === table.id)?.status).toBe("AVAILABLE");
  const closed = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  expect(closed.status).toBe("CLOSED");
  const payments = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}/payments`)).json;
  expect(payments.payments[0].changeGiven).toBe("26000");
  await cashier.context().close();

});
