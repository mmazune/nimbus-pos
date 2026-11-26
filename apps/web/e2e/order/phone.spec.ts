/**
 * T3 phase 5: the order screen on a phone, 390 × 844 (drawings Order-Phone,
 * Order-Phone-Check, Order-Phone-Item). Menu first, the order as a sheet, the
 * item as a sheet. The waiter's part of "Table 12's evening" at phone size.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { api, expectRule10, freeTable, measurePage, ordersOnTable, pinToken, setupVenue, signInWithPin } from "./fixture";

const PROOF = join(__dirname, "../../../../reports/proof/T3");
mkdirSync(PROOF, { recursive: true });

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("waiter on a phone: food, then drinks, two sends", async ({ page }) => {
  test.setTimeout(120_000);
  const v = await setupVenue();
  const table = await freeTable(v.managerToken);
  await signInWithPin(page, v.people.waiter.pin, /\/waiter\/floor/);
  await page.locator(`[data-operational-table-id="${table.id}"]`).first().tap();
  const screen = page.locator("[data-order-phone]");
  await expect(screen).toBeVisible();

  // Food: Grills → burger (the item sheet), Sides → chips ×2, Grills → wings.
  await page.getByRole("button", { name: "Grills", exact: true }).tap();
  await page.getByRole("button", { name: /^Beef burger,/ }).tap();
  const sheet = page.locator("[data-order-item-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Medium", exact: true }).tap();
  await sheet.getByRole("button", { name: "Cheese · 3,000", exact: true }).tap();
  await sheet.getByRole("button", { name: "Onions", exact: true }).tap();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PROOF, "built-Order-Phone-Item-390x844.png") });
  expectRule10(await measurePage(page), "Order-Phone-Item 390");
  await page.getByRole("button", { name: "Add · UGX 31,000" }).tap();
  await page.getByRole("button", { name: "Sides", exact: true }).tap();
  await page.getByRole("button", { name: /^Chips,/ }).tap();
  await page.getByRole("button", { name: /^Chips,/ }).tap();
  await page.getByRole("button", { name: "Grills", exact: true }).tap();
  await page.getByRole("button", { name: /^Chicken wings,/ }).tap();
  expect((await ordersOnTable(v.managerToken, table.id)).filter((o) => !["CLOSED", "VOIDED"].includes(o.status))).toHaveLength(0);

  const foot = page.locator("[data-order-foot]");
  await expect(foot.getByRole("button", { name: "Order · 4" })).toBeVisible();
  await foot.getByRole("button", { name: "Send 4 items" }).tap();
  await expect(foot.getByRole("button", { name: "Send" })).toBeDisabled();

  // Drinks: Popular → lager ×2, Whisky → Double + Cola, cola.
  await page.getByRole("tab", { name: "Drinks" }).tap();
  await page.getByRole("button", { name: "Popular", exact: true }).tap();
  await page.getByRole("button", { name: /^Lager 500 ml,/ }).tap();
  await page.getByRole("button", { name: /^Lager 500 ml,/ }).tap();
  await page.getByRole("button", { name: "Whisky", exact: true }).tap();
  await page.getByRole("button", { name: "Blended Scotch, Double, 15,000" }).tap();
  await page.locator("[data-order-mixer]").getByRole("button", { name: "Cola", exact: true }).tap();
  await page.getByLabel("Search the whole menu").fill("col");
  await page.getByRole("button", { name: /^Cola 300 ml,/ }).tap();
  await page.getByLabel("Search the whole menu").fill("");
  await page.getByRole("button", { name: "Whisky", exact: true }).tap();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PROOF, "built-Order-Phone-390x844.png") });
  expectRule10(await measurePage(page), "Order-Phone 390");

  // The order as a sheet.
  await foot.getByRole("button", { name: /^Order · / }).tap();
  const lines = page.locator("[data-order-lines]");
  await expect(lines.getByText("Not sent · tap a line to change it")).toBeVisible();
  await expect(page.locator("[data-order-total]")).toHaveText("UGX 101,000");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PROOF, "built-Order-Phone-Check-390x844.png") });
  expectRule10(await measurePage(page), "Order-Phone-Check 390");
  await page.getByRole("dialog", { name: "Order" }).getByRole("button", { name: "Send 4 items" }).tap();
  const dialog = page.getByRole("dialog", { name: "Order" });
  await expect(dialog.getByText("Not sent · tap a line to change it")).toHaveCount(0);
  await expect(dialog.locator("[data-order-lines] section")).toHaveCount(2);

  const order = (await ordersOnTable(v.managerToken, table.id)).find((o) => !["CLOSED", "VOIDED"].includes(o.status));
  if (!order) throw new Error("no order after Send");
  const detail = (await api(v.managerToken, "GET", `/api/pos/orders/${order.id}`)).json;
  expect(new Set(detail.items.map((i: { sentAt: string }) => i.sentAt)).size).toBe(2);
  expect(detail.total).toBe("101000");
  const cashierToken = await pinToken(v.people.cashier.pin);
  expect([200, 201]).toContain((await api(cashierToken, "POST", `/api/pos/orders/${order.id}/close`, { payments: [{ method: "CASH", amount: 101000 }] })).status);
});
