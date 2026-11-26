import { expect, test, type Page } from "@playwright/test";

import { api, apiRaw, as, ensureLambChops, openTable, pinSignIn, recordApi, rule10, saveJson, shot, tableByLabel, terminal } from "./support";

/**
 * T5 phase 2 — the menu knows what is left, on the demo venue, on terminals open at once.
 *   Terminal A: waiter1 (Sanyu) on M14.   Terminal B: waiter2 (Brian) on T03.   Terminal C: waiter3 on V06.
 * The chef sets a number and marks sold out through T2's routes (the kitchen screen is phase 5;
 * the chain in phase 6 does the same from that screen).
 */
test.describe.configure({ mode: "serial" });

const log: Record<string, unknown> = {};
test.afterAll(() => saveJson("phase2-menu-measured.json", log));

const lamb = (page: Page) => page.getByRole("button", { name: /^Lamb chops,/ });

async function toGrill(page: Page) {
  await page.getByRole("tab", { name: "Food" }).click().catch(() => undefined);
  await page.getByRole("button", { name: "Grill", exact: true }).click();
  await expect(lamb(page)).toBeVisible();
}

test("one menu call; 2 left, then sold out, on three terminals within 10 seconds; the red line; Send says what it skipped", async ({ browser }) => {
  test.setTimeout(240_000);
  const lambId = await ensureLambChops();
  const chef = await as("chef1");
  await api(chef.token, "POST", `/menu/items/${lambId}/available`, {});

  const A = await terminal(browser);
  const B = await terminal(browser);
  const C = await terminal(browser);
  const netA = recordApi(A.page);
  await pinSignIn(A.page, "waiter1");
  await pinSignIn(B.page, "waiter2");
  await pinSignIn(C.page, "waiter3");
  await openTable(A.page, "waiter", (await tableByLabel("M14")).id);
  await openTable(B.page, "waiter", (await tableByLabel("T03")).id);
  await openTable(C.page, "waiter", (await tableByLabel("V06")).id);
  for (const t of [A, B, C]) await toGrill(t.page);

  // One menu call: the workspace, once; never the old navigation and catalog reads.
  const menuCalls = netA.filter((c) => c.method === "GET" && /\/api\/menu\/(workspace|navigation|catalog|items\/[^/?]+$)/.test(c.path.split("?")[0]));
  log.menuCallsOnOpen = menuCalls;
  expect(menuCalls.map((c) => c.path.split("?")[0])).toEqual(["/api/menu/workspace"]);

  // The chef sets 2 left: every terminal shows "2 left" within 10 seconds.
  const setAt = Date.now();
  await api(chef.token, "PUT", `/menu/items/${lambId}/left`, { left: 2 });
  for (const t of [A, B, C]) await expect(lamb(t.page)).toHaveAttribute("aria-label", /2 left/, { timeout: 10_000 });
  log.twoLeftSeenAfterMs = Date.now() - setAt;
  await rule10(A.page, "A-2-left-1280", log);
  await shot(A.page, "phase2-2-left-1280x800.png");

  // A sends one: B and C count down to 1 left.
  await lamb(A.page).click();
  const sheet = A.page.locator("[data-order-item-sheet]");
  if (await sheet.count()) await sheet.getByRole("button", { name: /^Add/ }).click();
  await A.page.getByRole("button", { name: /^Send/ }).click();
  await expect(A.page.locator("[data-order-round]")).toHaveCount(1, { timeout: 15_000 });
  for (const t of [B, C]) await expect(lamb(t.page)).toHaveAttribute("aria-label", /1 left/, { timeout: 10_000 });

  // B puts the last one on the order (not sent) with a cola; then the chef marks it sold out.
  await lamb(B.page).click();
  const bSheet = B.page.locator("[data-order-item-sheet]");
  if (await bSheet.count()) await bSheet.getByRole("button", { name: /^Add/ }).click();
  await B.page.getByRole("tab", { name: "Drinks" }).click();
  await B.page.getByRole("button", { name: "Soft drinks", exact: true }).click().catch(() => undefined);
  const soft = B.page.locator("[data-order-items] button:not([aria-disabled])").first();
  const softName = ((await soft.getAttribute("aria-label")) ?? "").split(",")[0];
  await soft.click();
  const softSheet = B.page.locator("[data-order-item-sheet]");
  if (await softSheet.count()) await softSheet.getByRole("button", { name: /^Add/ }).click();
  await B.page.getByRole("tab", { name: "Food" }).click();
  await B.page.getByRole("button", { name: "Grill", exact: true }).click();

  const outAt = Date.now();
  await api(chef.token, "POST", `/menu/items/${lambId}/sold-out`, {});
  for (const t of [A, B, C]) {
    if (t === A) {
      await openTable(A.page, "waiter", (await tableByLabel("M03")).id);
      await toGrill(A.page);
    }
    await expect(lamb(t.page)).toHaveAttribute("aria-label", /Sold out since \d\d:\d\d/, { timeout: 10_000 });
  }
  log.soldOutSeenAfterMs = Date.now() - outAt;
  await expect(lamb(C.page)).toHaveAttribute("data-item-state", "soldOut");
  await rule10(C.page, "C-sold-out-1280", log);
  await shot(C.page, "phase2-sold-out-1280x800.png");

  // B's unsent line is red with Remove.
  const red = B.page.locator("[data-order-line-soldout]");
  await expect(red).toHaveCount(1, { timeout: 10_000 });
  await expect(red).toContainText("Lamb chops");
  await expect(red.getByRole("button", { name: "Remove" })).toBeVisible();
  await rule10(B.page, "B-red-line-1280", log);
  await shot(B.page, "phase2-red-line-1280x800.png");

  // Send: the lamb is skipped by name, the cola goes.
  await B.page.getByRole("button", { name: /^Send/ }).click();
  await expect(B.page.getByText(/^Not sent: 1 Lamb chops/)).toBeVisible({ timeout: 15_000 });
  await expect(B.page.getByText(/The rest went to the kitchen/)).toBeVisible();
  await shot(B.page, "phase2-send-report-1280x800.png");
  const waiter2 = await as("waiter2");
  const orders = await api<{ data: Array<{ id: string }> }>(waiter2.token, "GET", `/pos/orders?tableId=${(await tableByLabel("T03")).id}&excludeStatus=CLOSED,VOIDED`);
  const order = await api<{ items: Array<{ menuItem?: { name?: string }; sentAt?: string | null }> }>(waiter2.token, "GET", `/pos/orders/${orders.data[0].id}`);
  const sentNames = order.items.filter((i) => i.sentAt).map((i) => i.menuItem?.name);
  log.sentOnB = sentNames;
  expect(sentNames).toContain(softName);
  expect(sentNames).not.toContain("Lamb chops");

  // Remove takes the red line away.
  await B.page.locator("[data-order-line-soldout]").getByRole("button", { name: "Remove" }).click();
  await expect(B.page.locator("[data-order-line-soldout]")).toHaveCount(0, { timeout: 10_000 });

  // A sold-out item cannot be added on the server either.
  const refused = await apiRaw(waiter2.token, "POST", `/pos/orders/${orders.data[0].id}/items`, { menuItemId: lambId, quantity: 1 });
  log.addSoldOut = refused.status;
  expect(refused.status).toBe(409);

  for (const t of [A, B, C]) await t.ctx.close();
});

test("phone, 390 × 844: 3 left and sold out read on a phone tile", async ({ browser }) => {
  const lambId = await ensureLambChops();
  const chef = await as("chef1");
  await api(chef.token, "PUT", `/menu/items/${lambId}/left`, { left: 3 });
  const P = await terminal(browser, { width: 390, height: 844 });
  await pinSignIn(P.page, "waiter1");
  await openTable(P.page, "waiter", (await tableByLabel("M08")).id);
  await P.page.getByRole("button", { name: "Grill", exact: true }).click();
  await expect(lamb(P.page)).toHaveAttribute("aria-label", /3 left/, { timeout: 10_000 });
  await rule10(P.page, "phone-3-left-390", log);
  await shot(P.page, "phase2-3-left-390x844.png");
  await api(chef.token, "POST", `/menu/items/${lambId}/sold-out`, {});
  await expect(lamb(P.page)).toHaveAttribute("aria-label", /Sold out since/, { timeout: 10_000 });
  await rule10(P.page, "phone-sold-out-390", log);
  await shot(P.page, "phase2-sold-out-390x844.png");
  await P.ctx.close();
});
