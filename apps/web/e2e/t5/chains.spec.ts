import { expect, test, type Page } from "@playwright/test";

import { api, as, ensureLambChops, openTable, pinSignIn, rule10, saveJson, shot, tableByLabel, terminal } from "./support";

/**
 * T5 phase 6 — the chains, as real people, on the demo venue (fresh each run through stack.sh).
 * Every chain runs with the waiters at 1280 × 800 and again at 390 × 844; the chef and the
 * supervisor work at 1280 × 800. Each size uses its own free tables.
 */
test.describe.configure({ mode: "default" });
const log: Record<string, unknown> = {};
test.afterAll(() => saveJson("phase6-chains-measured.json", log));
type Json = Record<string, any>;

const SIZES = [
  { tag: "1280", vp: { width: 1280, height: 800 } },
  { tag: "390", vp: { width: 390, height: 844 } },
] as const;

const lamb = (page: Page) => page.getByRole("button", { name: /^Lamb chops,/ });

async function openOrderOn(label: string): Promise<Json | null> {
  const t = await tableByLabel(label);
  const r = await api<{ data: Json[] }>((await as("manager1")).token, "GET", `/pos/orders?tableId=${t.id}&excludeStatus=CLOSED,VOIDED`);
  return r.data[0] ?? null;
}

async function fullOrder(id: string): Promise<Json> {
  return api<Json>((await as("manager1")).token, "GET", `/pos/orders/${id}`);
}

/** On the order screen: Food › the group › the item (the phone shows the same groups). */
async function addItem(page: Page, group: string, name: string, section: "Food" | "Drinks" = "Food") {
  await page.getByRole("tab", { name: section }).click().catch(() => undefined);
  const groupButton = page.getByRole("button", { name: group, exact: true }).first();
  // The phone shows four groups; the rest are behind "More · n" (drawing Order-Phone).
  if (!(await groupButton.isVisible().catch(() => false))) await page.getByRole("button", { name: /^More · \d+/ }).first().click();
  await page.getByRole("button", { name: group, exact: true }).last().click();
  await page.getByRole("button", { name: new RegExp(`^${name.replace(/[()]/g, ".")},`) }).first().click();
  const sheet = page.locator("[data-order-item-sheet]");
  if (await sheet.count()) await page.getByRole("button", { name: /^Add/ }).click();
}

/** The unsent lines: the terminal panel, or the phone's order sheet. */
async function orderLines(page: Page) {
  // On a phone the order is a sheet behind "Order · n"; wait for the screen to have it, then open it.
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    const open = page.getByRole("button", { name: /^Order · \d+/ });
    await expect(open).toBeVisible({ timeout: 15_000 });
    await open.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  return page.locator("[data-order-lines]").last();
}

async function closeOrderSheet(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) await dialog.getByRole("button", { name: /^Close/ }).first().click().catch(() => undefined);
}

async function send(page: Page) {
  await page.getByRole("button", { name: /^Send/ }).first().click();
}

/** A Food item at the kitchen station that opens no required choice, from a named group. */
async function kitchenDish(groupLike: RegExp, avoid: string[] = []): Promise<{ name: string; group: string }> {
  const ws = await api<Json>((await as("manager1")).token, "GET", "/menu/workspace");
  const groups = (ws.sections as Json[]).flatMap((s) => s.groups as Json[]);
  for (const g of groups.filter((x) => groupLike.test(x.name))) {
    for (const id of g.itemIds as string[]) {
      const it = (ws.items as Json[]).find((i) => i.id === id);
      if (!it || it.station !== "KITCHEN" || it.servings?.length > 1 || (it.choiceGroups ?? []).length || avoid.includes(it.name)) continue;
      if (it.availability?.state === "SOLD_OUT" || it.name === "Lamb chops") continue;
      return { name: it.name, group: g.name };
    }
  }
  throw new Error(`no plain kitchen dish in ${groupLike}`);
}

/** A plain soft drink (no measures, no choices) and its group. */
async function softDrink(): Promise<{ name: string; group: string }> {
  const ws = await api<Json>((await as("manager1")).token, "GET", "/menu/workspace");
  const groups = (ws.sections as Json[]).flatMap((s) => s.groups as Json[]).filter((g) => /soft/i.test(g.name));
  for (const g of groups) {
    for (const id of g.itemIds as string[]) {
      const it = (ws.items as Json[]).find((i) => i.id === id);
      if (it && !(it.servings?.length > 1) && !(it.choiceGroups ?? []).length) return { name: it.name, group: g.name };
    }
  }
  throw new Error("no plain soft drink");
}

for (const size of SIZES) {
  test(`Lamb chops — waiters at ${size.tag}: the chef sets 2 left, one is sent, two waiters race for the last, the loser is told and the rest goes; grey on a third terminal`, async ({ browser }) => {
    test.setTimeout(240_000);
    const tables = size.tag === "1280" ? ["M16", "M17", "M18"] : ["M19", "M21", "M23"];
    const lambId = await ensureLambChops();

    // The chef, on the kitchen screen: Sold out › All items › Lamb chops › Set a number › 2.
    const K = await terminal(browser);
    await pinSignIn(K.page, "chef1");
    await K.page.goto("/kitchen/sold-out");
    await K.page.getByRole("tab", { name: /^All \d+ items/ }).click();
    await K.page.getByLabel("Find an item").fill("Lamb chops");
    const row = K.page.locator('[data-soldout-row="Lamb chops"]');
    if (await row.getByRole("button", { name: "Back on" }).count()) await row.getByRole("button", { name: "Back on" }).click();
    await row.getByRole("button", { name: "Set a number" }).click();
    await K.page.getByRole("textbox", { name: "Left now" }).fill("2");
    await K.page.getByRole("dialog").getByRole("button", { name: "Set 2 left" }).click();
    await expect(row).toContainText("2 left", { timeout: 10_000 });

    // The three waiters who order are on shift (an earlier case may have ended one; they start again).
    for (const w of ["waiter1", "waiter2", "waiter3"]) await api((await as(w)).token, "POST", "/shifts/open", {}, [200, 201, 409]);
    const [A, B, C, D] = await Promise.all([0, 1, 2, 3].map(() => terminal(browser, size.vp)));
    await Promise.all([pinSignIn(A.page, "waiter1"), pinSignIn(B.page, "waiter2"), pinSignIn(C.page, "waiter3"), pinSignIn(D.page, "waiter4")]);
    const [ta, tb, tc] = await Promise.all(tables.map((l) => tableByLabel(l)));
    await openTable(A.page, "waiter", ta.id);
    await openTable(B.page, "waiter", tb.id);
    await openTable(C.page, "waiter", tc.id);
    await openTable(D.page, "waiter", (await tableByLabel(size.tag === "1280" ? "V06" : "M32")).id);
    for (const t of [A, B, C, D]) {
      await t.page.getByRole("button", { name: "Grill", exact: true }).first().click();
      await expect(lamb(t.page)).toHaveAttribute("aria-label", /2 left/, { timeout: 10_000 });
    }

    // One waiter sends one.
    await lamb(A.page).click();
    await send(A.page);
    for (const t of [B, C, D]) await expect(lamb(t.page)).toHaveAttribute("aria-label", /1 left/, { timeout: 10_000 });

    // Two waiters each put the last one and a soft drink on, then send at the same moment.
    const soft = await softDrink();
    for (const t of [B, C]) {
      await lamb(t.page).click();
      await addItem(t.page, soft.group, soft.name, "Drinks");
    }
    await Promise.all([send(B.page), send(C.page)]);
    const told = async (p: Page) => (await p.getByText(/^Not sent: 1 Lamb chops/).count()) > 0;
    await expect.poll(async () => Number(await told(B.page)) + Number(await told(C.page)), { timeout: 15_000 }).toBe(1);
    const loser = (await told(B.page)) ? B : C;
    await expect(loser.page.getByText(/The rest went to the kitchen/)).toBeVisible();
    await rule10(loser.page, `lamb-loser-${size.tag}`, log);
    await shot(loser.page, `phase6-lamb-loser-${size.tag}.png`);

    // On the server: exactly one of the two sent the lamb; both drinks went; none left, sold out.
    const sentLamb = [];
    for (const l of [tables[1], tables[2]]) {
      const o = await openOrderOn(l);
      const full = await fullOrder(o!.id);
      const items = full.items as Json[];
      sentLamb.push(items.some((i) => i.menuItemId === lambId && i.sentAt));
      expect(items.some((i) => i.menuItemId !== lambId && i.sentAt)).toBe(true);
    }
    log[`lamb-${size.tag}-sentLamb`] = sentLamb;
    expect(sentLamb.filter(Boolean).length).toBe(1);
    const ws = await api<Json>((await as("waiter1")).token, "GET", "/menu/workspace");
    const av = ((ws.items as Json[]).find((i) => i.id === lambId) as Json).availability;
    log[`lamb-${size.tag}-availability`] = av;
    expect(av.state).toBe("SOLD_OUT");

    // The third terminal sees it grey within 10 seconds.
    await expect(lamb(D.page)).toHaveAttribute("aria-label", /Sold out since/, { timeout: 10_000 });
    await expect(lamb(D.page)).toHaveAttribute("data-item-state", "soldOut");
    await rule10(D.page, `lamb-third-${size.tag}`, log);
    await shot(D.page, `phase6-lamb-third-${size.tag}.png`);
    for (const t of [A, B, C, D, K]) await t.ctx.close();
  });

  test(`Starters now, mains later — waiter at ${size.tag}: hold, send, Ready on the kitchen screen, the waiter's Ready, Collected, fire, undo once, allergy on the ticket`, async ({ browser }) => {
    test.setTimeout(240_000);
    const label = size.tag === "1280" ? "M24" : "M25";
    const starter = await kitchenDish(/^Tapas|Starters/);
    const main = await kitchenDish(/^Grill|^Mains/, [starter.name]);
    log[`starters-${size.tag}-dishes`] = { starter, main };
    const W = await terminal(browser, size.vp);
    const K = await terminal(browser);
    await pinSignIn(W.page, "waiter1");
    await pinSignIn(K.page, "chef1");
    const table = await tableByLabel(label);
    await openTable(W.page, "waiter", table.id);

    // Starter with a nut allergy; main held for later and to take away.
    await addItem(W.page, starter.group, starter.name);
    let lines = await orderLines(W.page);
    await lines.getByRole("button", { name: new RegExp(`^1 ${starter.name}`) }).click();
    await W.page.locator("[data-order-item-sheet]").getByRole("button", { name: "Nuts", exact: true }).click();
    await W.page.getByRole("button", { name: /^Save/ }).click();
    await closeOrderSheet(W.page);
    await addItem(W.page, main.group, main.name);
    lines = await orderLines(W.page);
    await lines.getByRole("button", { name: new RegExp(`^1 ${main.name}`) }).click();
    const sheet = W.page.locator("[data-order-item-sheet]");
    await sheet.getByRole("button", { name: /^Hold for later/ }).click();
    await sheet.getByRole("button", { name: "Takeaway", exact: true }).click();
    await rule10(W.page, `starters-line-sheet-${size.tag}`, log);
    await shot(W.page, `phase6-line-sheet-${size.tag}.png`);
    await W.page.getByRole("button", { name: /^Save/ }).click();
    await closeOrderSheet(W.page);
    await send(W.page);
    await expect.poll(async () => {
      const o = await openOrderOn(label);
      if (!o) return null;
      const items = (await fullOrder(o.id)).items as Json[];
      return items.map((i) => `${i.menuItem?.name}:${i.sentAt ? "sent" : i.heldAt ? "held" : "new"}`).sort().join("|");
    }, { timeout: 15_000 }).toBe([`${main.name}:held`, `${starter.name}:sent`].sort().join("|"));

    // The kitchen sees only the starter, the allergy in red.
    await K.page.goto("/kitchen");
    const ticket = K.page.locator("[data-kitchen-ticket]").filter({ hasText: label });
    await expect(ticket).toHaveCount(1, { timeout: 15_000 });
    await expect(ticket).toContainText(starter.name);
    await expect(ticket).not.toContainText(main.name);
    await expect(ticket.locator("[data-kitchen-flags]")).toContainText(/Nuts allergy/i);
    await shot(K.page, `phase6-kitchen-starter-${size.tag}.png`);

    // Ready on the kitchen screen reaches the waiter's Ready.
    await ticket.getByRole("button", { name: "Ready" }).click();
    await expect(ticket).toHaveCount(0, { timeout: 10_000 });
    await W.page.goto("/waiter/ready");
    const card = W.page.locator("[data-ready-ticket]").filter({ hasText: label });
    await expect(card).toHaveCount(1, { timeout: 15_000 });
    await expect(W.page.locator("[data-touch-shell]")).toContainText(/Ready/);
    await rule10(W.page, `ready-${size.tag}`, log);
    await shot(W.page, `phase6-waiter-ready-${size.tag}.png`);
    await card.getByRole("button", { name: "Collected" }).click();
    await expect(card).toHaveCount(0, { timeout: 10_000 });

    // Fire the main; undo once inside 3 seconds (nothing reaches the kitchen); fire again.
    await W.page.goto("/waiter/floor");
    await openTable(W.page, "waiter", table.id);
    lines = await orderLines(W.page);
    await expect(lines.locator("[data-order-held]")).toContainText(main.name);
    await lines.getByRole("button", { name: "Fire now" }).click();
    await closeOrderSheet(W.page);
    await expect(W.page.getByText(/goes to the kitchen in \d seconds/)).toBeVisible({ timeout: 5_000 });
    await shot(W.page, `phase6-fire-undo-${size.tag}.png`);
    await W.page.getByRole("button", { name: "Undo" }).click();
    await expect(W.page.getByText(new RegExp(`${main.name} held again`))).toBeVisible({ timeout: 5_000 });
    // Past the 3-second window: the main is still held and never sent (on the server), and the
    // kitchen screen, read after the window, shows no ticket for it.
    await K.page.waitForTimeout(4_000);
    const afterUndo = ((await fullOrder((await openOrderOn(label))!.id)).items as Json[]).find((i) => i.menuItem?.name === main.name) as Json;
    log[`starters-${size.tag}-afterUndo`] = { heldAt: Boolean(afterUndo.heldAt), sentAt: afterUndo.sentAt ?? null, fireAt: afterUndo.fireAt ?? null };
    expect(Boolean(afterUndo.heldAt) && !afterUndo.sentAt).toBe(true);
    await K.page.reload();
    await expect(K.page.locator("[data-kitchen-tickets], [data-kitchen-screen] section[aria-label='No tickets']").first()).toBeVisible({ timeout: 20_000 });
    await expect(K.page.locator("[data-kitchen-ticket]").filter({ hasText: main.name }).filter({ hasText: label })).toHaveCount(0);
    lines = await orderLines(W.page);
    await lines.getByRole("button", { name: "Fire now" }).click();
    await closeOrderSheet(W.page);
    const mainTicket = K.page.locator("[data-kitchen-ticket]").filter({ hasText: label }).filter({ hasText: main.name });
    // The screen reads every 5 seconds; the fire goes out once its 3-second window ends.
    await expect(mainTicket).toHaveCount(1, { timeout: 20_000 });
    await expect(mainTicket.locator("[data-kitchen-flags]")).toContainText(/Takeaway/);
    await shot(K.page, `phase6-kitchen-main-${size.tag}.png`);
    for (const t of [W, K]) await t.ctx.close();
  });

  test(`A busy Friday — waiters at ${size.tag}: a tab opened and named, a party moved, two tables joined and split, a hand-over accepted, then the shift ended`, async ({ browser }) => {
    test.setTimeout(240_000);
    const m = (await as("manager1")).token;
    const { areas } = await api<{ areas: Json[] }>(m, "GET", "/areas");
    if (!areas.some((a) => a.kind === "TABS")) await api(m, "POST", "/areas", { name: "Tabs", kind: "TABS" });
    const [from, to, joinA, joinB] = size.tag === "1280" ? ["M26", "M27", "M28", "M29"] : ["M31", "M10", "M11", "M13"];
    const leaver = size.tag === "1280" ? "waiter3" : "waiter4";
    // The leaver holds a table (waiter4 has no shift on the venue: it starts one, as a person would).
    const lv = await as(leaver);
    await api(lv.token, "POST", "/shifts/open", {}, [200, 201, 409]);
    const dish = await kitchenDish(/^Tapas|Starters/);
    const ws = await api<Json>(lv.token, "GET", "/menu/workspace");
    const dishId = ((ws.items as Json[]).find((i) => i.name === dish.name) as Json).id;
    for (const l of [from, joinA, joinB]) {
      const t = await tableByLabel(l);
      const o = await api<Json>(lv.token, "POST", "/pos/orders", { serviceType: "DINE_IN", tableId: t.id });
      await api(lv.token, "POST", `/pos/orders/${o.id}/items`, { menuItemId: dishId, quantity: 1 });
      await api(lv.token, "POST", `/pos/orders/${o.id}/send`, {});
    }

    // A tab opened and named by a waiter.
    const W = await terminal(browser, size.vp);
    await pinSignIn(W.page, "waiter1");
    await W.page.goto("/waiter/floor");
    await W.page.getByRole("tab", { name: /^All (tables|tabs)$/ }).click();
    if (size.tag === "1280") await W.page.getByRole("button", { name: /^Tabs/ }).click();
    else for (let i = 0; i < 8 && !(await W.page.getByRole("button", { name: "New tab" }).count()); i += 1) await W.page.getByRole("button", { name: "Next area" }).click();
    await W.page.getByRole("button", { name: "New tab" }).click();
    const note = `Friday ${size.tag}, by the pillar`;
    await W.page.getByRole("dialog").getByLabel("Note").fill(note);
    await W.page.getByRole("dialog").getByRole("button", { name: /^Open Tab \d+$/ }).click();
    await expect(W.page.locator("[data-order-screen]")).toBeVisible({ timeout: 15_000 });
    await shot(W.page, `phase6-friday-tab-${size.tag}.png`);

    // The supervisor moves a party and joins two tables, then splits them again.
    const S = await terminal(browser);
    await pinSignIn(S.page, "supervisor1");
    const moving = await openOrderOn(from);
    await openTable(S.page, "supervisor", (await tableByLabel(from)).id);
    await S.page.getByRole("button", { name: "More for this table" }).click();
    await S.page.getByRole("dialog").getByRole("button", { name: /^Move table/ }).click();
    await S.page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${to}`) }).first().click();
    await S.page.getByRole("dialog").getByRole("button", { name: `Move to ${to}` }).click();
    await expect.poll(async () => (await openOrderOn(to))?.id, { timeout: 10_000 }).toBe(moving?.id);
    const b = await openOrderOn(joinB);
    await openTable(S.page, "supervisor", (await tableByLabel(joinA)).id);
    await S.page.getByRole("button", { name: "More for this table" }).click();
    await S.page.getByRole("dialog").getByRole("button", { name: /^Join tables/ }).click();
    await S.page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${joinB}`) }).first().click();
    await S.page.getByRole("dialog").getByRole("button", { name: /^Join 2 tables/ }).click();
    await expect.poll(async () => (await openOrderOn(joinB))?.id ?? null, { timeout: 10_000 }).toBeNull();
    await S.page.getByRole("button", { name: "More for this table" }).click();
    await S.page.getByRole("dialog").getByRole("button", { name: /^Split tables again/ }).click();
    await S.page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${joinB}`) }).first().click();
    await S.page.getByRole("dialog").getByRole("button", { name: `Split ${joinB} off` }).click();
    await expect.poll(async () => (await openOrderOn(joinB))?.total ?? null, { timeout: 10_000 }).toBe(b?.total);

    // The leaver ends the shift: refused while tables are open; hands them all over; the colleague accepts; the shift ends.
    const L = await terminal(browser, size.vp);
    const R = await terminal(browser, size.vp);
    await pinSignIn(L.page, leaver);
    await pinSignIn(R.page, "waiter2");
    await R.page.goto("/waiter/floor");
    await L.page.goto("/waiter/me");
    await L.page.getByRole("button", { name: "End my shift" }).click();
    await L.page.getByRole("button", { name: "End my shift" }).last().click();
    await expect(L.page.getByText(/You still have open tables/)).toBeVisible({ timeout: 10_000 });
    await L.page.getByRole("button", { name: "Hand over your tables" }).click();
    await L.page.getByRole("dialog").getByRole("button", { name: /^Brian O/ }).first().click();
    await rule10(L.page, `friday-offer-${size.tag}`, log);
    await shot(L.page, `phase6-friday-offer-${size.tag}.png`);
    await L.page.getByRole("dialog").getByRole("button", { name: /^Offer \d+ tables? to Brian O/ }).click();
    const offer = R.page.getByRole("dialog").filter({ hasText: /offers you \d+ tables?/ });
    await expect(offer).toBeVisible({ timeout: 15_000 });
    await rule10(R.page, `friday-accept-${size.tag}`, log);
    await shot(R.page, `phase6-friday-accept-${size.tag}.png`);
    await offer.getByRole("button", { name: /^Accept \d+ tables?$/ }).click();
    await expect(offer).toHaveCount(0, { timeout: 10_000 });
    await L.page.getByRole("button", { name: "End my shift" }).click();
    await L.page.getByRole("button", { name: "End my shift" }).last().click();
    await expect(L.page.getByText("Your shift has ended.")).toBeVisible({ timeout: 10_000 });
    const w2 = await as("waiter2");
    expect((await openOrderOn(to))?.userId).toBe(w2.userId);
    for (const t of [W, S, L, R]) await t.ctx.close();
  });
}
