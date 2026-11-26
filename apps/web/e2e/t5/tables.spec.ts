import { expect, test, type Page } from "@playwright/test";

import { api, apiRaw, as, openTable, pinSignIn, rule10, saveJson, shot, tableByLabel, terminal } from "./support";

/**
 * T5 phase 3 — areas, tabs and moving people, from the Floor and the table actions sheet,
 * on the demo venue. Each move is checked on the server afterwards.
 */
test.describe.configure({ mode: "serial" });
const log: Record<string, unknown> = {};
test.afterAll(() => saveJson("phase3-tables-measured.json", log));

type Json = Record<string, any>;

async function openOrderOn(label: string, who = "manager1"): Promise<Json | null> {
  const t = await tableByLabel(label);
  const r = await api<{ data: Json[] }>((await as(who)).token, "GET", `/pos/orders?tableId=${t.id}&excludeStatus=CLOSED,VOIDED`);
  return r.data[0] ?? null;
}

async function ensureTabsArea() {
  const m = (await as("manager1")).token;
  const { areas } = await api<{ areas: Json[] }>(m, "GET", "/areas");
  if (!areas.some((a) => a.kind === "TABS")) await api(m, "POST", "/areas", { name: "Tabs", kind: "TABS" });
}

async function actions(page: Page) {
  await page.getByRole("button", { name: "More for this table" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function pick(page: Page, name: RegExp) {
  await page.getByRole("dialog").getByRole("button", { name }).first().click();
}

async function filled(page: Page) {
  return page.getByRole("dialog").locator("button").filter({ hasText: /./ }).last();
}

test.beforeAll(async () => {
  await ensureTabsArea();
});

test("the Floor reads areas from the server; the Tabs area and New tab open a named tab", async ({ browser }) => {
  const W = await terminal(browser);
  await pinSignIn(W.page, "waiter1");
  await W.page.goto("/waiter/floor");
  await W.page.getByRole("tab", { name: "All tables" }).click();
  const chips = W.page.getByRole("group", { name: "Areas" }).getByRole("button");
  const names = (await chips.allTextContents()).map((t) => t.replace(/\d+$/, "").trim());
  log.areaChips = names;
  // The manager's order from GET /api/areas (sort, then name), tabs areas last.
  const server = (await api<{ areas: Json[] }>((await as("manager1")).token, "GET", "/areas")).areas;
  const expected = [...server.filter((a) => a.kind !== "TABS" && a.tables.length), ...server.filter((a) => a.kind === "TABS")].map((a) => a.name);
  log.serverAreas = expected;
  expect(names).toEqual(expected);
  expect(names[names.length - 1]).toBe("Tabs");
  await W.page.getByRole("button", { name: /^Tabs/ }).click();
  await W.page.getByRole("button", { name: "New tab" }).click();
  const sheet = W.page.getByRole("dialog");
  await expect(sheet).toContainText(/Tab \d+ is the next free number/);
  await sheet.getByLabel("Note").fill("Red cap by bar");
  await rule10(W.page, "new-tab-sheet-1280", log);
  await shot(W.page, "phase3-new-tab-1280x800.png");
  await sheet.getByRole("button", { name: /^Open Tab \d+$/ }).click();
  await expect(W.page.locator("[data-order-screen]")).toBeVisible({ timeout: 15_000 });
  await expect(W.page.getByRole("heading", { name: /^Tab \d+/ })).toBeVisible();
  // Back on the Floor the tab tile carries its note.
  await W.page.getByRole("button", { name: "Floor", exact: true }).first().click();
  await W.page.getByRole("tab", { name: "All tables" }).click();
  await W.page.getByRole("button", { name: /^Tabs/ }).click();
  await expect(W.page.locator("[data-floor-tile]").filter({ hasText: "Red cap by bar" })).toHaveCount(1);
  await rule10(W.page, "tabs-area-1280", log);
  await shot(W.page, "phase3-tabs-area-1280x800.png");
  const { areas } = await api<{ areas: Json[] }>((await as("manager1")).token, "GET", "/areas");
  const tab = (areas.find((a) => a.kind === "TABS") as Json).tables.find((t: Json) => t.tabNote === "Red cap by bar");
  log.tab = { label: tab?.label, isTab: tab?.isTab };
  expect(tab?.isTab).toBe(true);
  await W.ctx.close();
});

test("supervisor: move a table, join two and split them again, move a line, change waiter", async ({ browser }) => {
  test.setTimeout(180_000);
  const S = await terminal(browser);
  await pinSignIn(S.page, "supervisor1");

  // Move M01 → M05 (free): the order and the booking go with it.
  const before = await openOrderOn("M01");
  await openTable(S.page, "supervisor", (await tableByLabel("M01")).id);
  await actions(S.page);
  await rule10(S.page, "actions-sheet-1280", log);
  await shot(S.page, "phase3-actions-1280x800.png");
  await pick(S.page, /^Move table/);
  await pick(S.page, /^M05/);
  await shot(S.page, "phase3-move-1280x800.png");
  await S.page.getByRole("dialog").getByRole("button", { name: "Move to M05" }).click();
  await expect.poll(async () => (await openOrderOn("M05"))?.id, { timeout: 10_000 }).toBe(before?.id);
  expect(await openOrderOn("M01")).toBeNull();

  // Join M07 onto M04, then split M07 off again.
  const m04 = await openOrderOn("M04");
  const m07 = await openOrderOn("M07");
  await openTable(S.page, "supervisor", (await tableByLabel("M04")).id);
  await actions(S.page);
  await pick(S.page, /^Join tables/);
  await pick(S.page, /^M07/);
  await expect(S.page.getByRole("dialog")).toContainText(/One bill on M04/);
  await shot(S.page, "phase3-join-1280x800.png");
  await S.page.getByRole("dialog").getByRole("button", { name: /^Join 2 tables/ }).click();
  await expect.poll(async () => (await openOrderOn("M07"))?.id ?? null, { timeout: 10_000 }).toBeNull();
  const joined = await api<Json>((await as("manager1")).token, "GET", `/pos/orders/${m04?.id}`);
  log.joinTotal = { m04: m04?.total, m07: m07?.total, after: joined.total };
  expect(Number(joined.total)).toBeCloseTo(Number(m04?.total) + Number(m07?.total), 2);
  await S.page.getByRole("button", { name: "Floor", exact: true }).first().click();
  await expect(S.page.locator(`[data-floor-table-id="${(await tableByLabel("M07")).id}"]`)).toHaveAttribute("data-floor-tile", "joined", { timeout: 15_000 });
  await openTable(S.page, "supervisor", (await tableByLabel("M04")).id);
  await actions(S.page);
  await pick(S.page, /^Split tables again/);
  await pick(S.page, /^M07/);
  await S.page.getByRole("dialog").getByRole("button", { name: "Split M07 off" }).click();
  await expect.poll(async () => (await openOrderOn("M07"))?.total ?? null, { timeout: 10_000 }).toBe(m07?.total);

  // Move a line from M09 to M02 (free): M02 gets a bill with that line.
  const m09 = await api<Json>((await as("manager1")).token, "GET", `/pos/orders/${(await openOrderOn("M09"))?.id}`);
  const moved = (m09.items as Json[]).find((i) => i.sentAt && !i.voidedAt) as Json;
  await openTable(S.page, "supervisor", (await tableByLabel("M09")).id);
  await actions(S.page);
  await pick(S.page, /^Move a line/);
  await S.page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${moved.quantity} ${moved.menuItem.name}`) }).first().click();
  await pick(S.page, /^M02/);
  await shot(S.page, "phase3-line-move-1280x800.png");
  await S.page.getByRole("dialog").getByRole("button", { name: "Move to M02" }).click();
  await expect.poll(async () => {
    const o = await openOrderOn("M02");
    if (!o) return null;
    const full = await api<Json>((await as("manager1")).token, "GET", `/pos/orders/${o.id}`);
    return (full.items as Json[]).some((i) => i.menuItem?.name === moved.menuItem.name);
  }, { timeout: 10_000 }).toBe(true);

  // Change waiter: M12 (waiter1) to waiter2.
  const w2 = await as("waiter2");
  await openTable(S.page, "supervisor", (await tableByLabel("M12")).id);
  await actions(S.page);
  await pick(S.page, /^Change waiter/);
  await S.page.getByRole("dialog").getByRole("button", { name: /^Brian O/ }).first().click();
  await shot(S.page, "phase3-change-waiter-1280x800.png");
  await S.page.getByRole("dialog").getByRole("button", { name: /^Give it to Brian O/ }).click();
  await expect.poll(async () => (await openOrderOn("M12"))?.userId, { timeout: 10_000 }).toBe(w2.userId);
  await S.ctx.close();
});

test("split the bill four ways from the table actions sheet", async ({ browser }) => {
  test.setTimeout(180_000);
  const m = (await as("manager1")).token;
  const W = await terminal(browser);
  await pinSignIn(W.page, "waiter1");
  // Waiter: two lines on M06, one for guest 1 and one for guest 2, set on the line before Send.
  await openTable(W.page, "waiter", (await tableByLabel("M06")).id);
  await W.page.getByRole("button", { name: "Sides", exact: true }).click();
  const sides = W.page.locator("[data-order-items] button:not([aria-disabled])");
  for (const [i, g] of [[0, "1"], [1, "2"]] as const) {
    await sides.nth(i).click();
    const sheet = W.page.locator("[data-order-item-sheet]");
    if (await sheet.count()) {
      await sheet.getByRole("button", { name: g, exact: true }).click();
      await W.page.getByRole("button", { name: /^Add/ }).click();
    } else {
      await W.page.locator("[data-order-unsent] button").last().click();
      await W.page.locator("[data-order-item-sheet]").getByRole("button", { name: g, exact: true }).click();
      await W.page.getByRole("button", { name: /^Save/ }).click();
    }
  }
  await expect(W.page.locator("[data-order-unsent]")).toContainText("Guest 1");
  await expect(W.page.locator("[data-order-unsent]")).toContainText("Guest 2");
  await W.page.getByRole("button", { name: /^Send/ }).click();
  await expect(W.page.locator("[data-order-round]")).toHaveCount(1, { timeout: 15_000 });
  await W.ctx.close();

  const S = await terminal(browser);
  await pinSignIn(S.page, "supervisor1");
  // By guest: two bills.
  const m06 = await openOrderOn("M06");
  await openTable(S.page, "supervisor", (await tableByLabel("M06")).id);
  await actions(S.page);
  await pick(S.page, /^Split bill/);
  await expect(S.page.getByRole("dialog")).toContainText("Guest 1");
  await rule10(S.page, "split-guest-1280", log);
  await shot(S.page, "phase3-split-guest-1280x800.png");
  await S.page.getByRole("dialog").getByRole("button", { name: "Make 2 bills" }).click();
  await expect.poll(async () => {
    const r = await api<{ data: Json[] }>(m, "GET", `/pos/orders?tableId=${(await tableByLabel("M06")).id}&excludeStatus=CLOSED,VOIDED`);
    // T2: the first guest stays on the original bill; each other guest gets a bill of their own.
    return { bills: r.data.length, kept: r.data.some((o) => o.id === m06?.id) };
  }, { timeout: 10_000 }).toEqual({ bills: 2, kept: true });

  // By item: one line onto a second bill (M15 holds several lines).
  const m15 = await openOrderOn("M15");
  await openTable(S.page, "supervisor", (await tableByLabel("M15")).id);
  await actions(S.page);
  await pick(S.page, /^Split bill/);
  await S.page.getByRole("dialog").getByRole("tab", { name: "By item" }).click();
  await S.page.locator("[data-split-item] button").first().click();
  await shot(S.page, "phase3-split-item-1280x800.png");
  await S.page.getByRole("dialog").getByRole("button", { name: /^Make 2 bills · / }).click();
  await expect.poll(async () => {
    const r = await api<{ data: Json[] }>(m, "GET", `/pos/orders?tableId=${(await tableByLabel("M15")).id}&excludeStatus=CLOSED,VOIDED`);
    return r.data.length;
  }, { timeout: 10_000 }).toBe(2);
  log.splitItemFrom = m15?.id;

  // By amount and evenly on T02: the shares are recorded for the cashier.
  for (const way of ["By amount", "Evenly"] as const) {
    await openTable(S.page, "supervisor", (await tableByLabel("T02")).id);
    await actions(S.page);
    await pick(S.page, /^Split bill/);
    await S.page.getByRole("dialog").getByRole("tab", { name: way }).click();
    if (way === "By amount") {
      await S.page.getByRole("dialog").getByRole("button", { name: "Half" }).click();
      await shot(S.page, "phase3-split-amount-1280x800.png");
      await S.page.getByRole("dialog").getByRole("button", { name: /^Make 2 bills · / }).click();
    } else {
      await S.page.getByRole("dialog").getByRole("button", { name: "3", exact: true }).click();
      await expect(S.page.getByRole("dialog")).toContainText(/Each pays\s*UGX/);
      await shot(S.page, "phase3-split-even-1280x800.png");
      await S.page.getByRole("dialog").getByRole("button", { name: "Make 3 bills" }).click();
    }
    await expect(S.page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    await expect(S.page.getByText(/recorded for the cashier/)).toBeVisible();
  }
  const t02 = await openOrderOn("T02");
  const splits = await apiRaw(m, "GET", `/pos/orders/${t02?.id}/split-bill`);
  log.t02Splits = splits.status;
  await S.ctx.close();
});

test("hand over a table and all tables: the colleague accepts on their screen; a shift with open tables is refused with the way out", async ({ browser }) => {
  test.setTimeout(180_000);
  const A = await terminal(browser);
  const B = await terminal(browser);
  await pinSignIn(A.page, "waiter3");
  await pinSignIn(B.page, "waiter2");
  const w2 = await as("waiter2");
  await B.page.goto("/waiter/floor");

  // One table: V02 from Gloria (waiter3) to Brian (waiter2).
  await openTable(A.page, "waiter", (await tableByLabel("V02")).id);
  await A.page.getByRole("button", { name: "More for this table" }).click();
  await pick(A.page, /^Hand over this table/);
  await A.page.getByRole("dialog").getByRole("button", { name: /^Brian O/ }).first().click();
  await A.page.getByRole("dialog").getByRole("button", { name: /^Offer it to Brian O/ }).click();
  const incoming = B.page.getByRole("dialog").filter({ hasText: /offers you 1 table/ });
  await expect(incoming).toBeVisible({ timeout: 15_000 });
  await rule10(B.page, "handover-accept-1280", log);
  await shot(B.page, "phase3-handover-accept-1280x800.png");
  await incoming.getByRole("button", { name: "Accept 1 table" }).click();
  await expect.poll(async () => (await openOrderOn("V02"))?.userId, { timeout: 10_000 }).toBe(w2.userId);

  // End of shift with tables still open: refused, with "Hand over your tables".
  await A.page.goto("/waiter/me");
  await A.page.getByRole("button", { name: "End my shift" }).click();
  const confirm = A.page.getByRole("button", { name: /^End (my )?shift/ }).last();
  await confirm.click();
  await expect(A.page.getByText(/You still have open tables/)).toBeVisible({ timeout: 10_000 });
  await A.page.getByRole("button", { name: "Hand over your tables" }).click();
  await A.page.getByRole("dialog").getByRole("button", { name: /^Brian O/ }).first().click();
  await rule10(A.page, "handover-offer-1280", log);
  await shot(A.page, "phase3-handover-offer-1280x800.png");
  await A.page.getByRole("dialog").getByRole("button", { name: /^Offer \d+ tables? to Brian O/ }).click();
  await expect(A.page.getByText(/Offered to Brian O/)).toBeVisible();
  const all = B.page.getByRole("dialog").filter({ hasText: /offers you \d+ tables?/ });
  await expect(all).toBeVisible({ timeout: 15_000 });
  await all.getByRole("button", { name: /^Accept \d+ tables?$/ }).click();
  await expect(all).toHaveCount(0, { timeout: 10_000 });
  // Now the shift ends.
  await A.page.getByRole("button", { name: "End my shift" }).click();
  await A.page.getByRole("button", { name: /^End (my )?shift/ }).last().click();
  await expect(A.page.getByText("Your shift has ended.")).toBeVisible({ timeout: 10_000 });
  for (const t of [A, B]) await t.ctx.close();
});

test("phone, 390 × 844: the Tabs area and the actions sheet fit", async ({ browser }) => {
  const P = await terminal(browser, { width: 390, height: 844 });
  await pinSignIn(P.page, "waiter1");
  await P.page.goto("/waiter/floor");
  await P.page.getByRole("tab", { name: "All tables" }).click();
  for (let i = 0; i < 8 && !(await P.page.getByRole("button", { name: "New tab" }).count()); i += 1) {
    await P.page.getByRole("button", { name: "Next area" }).click();
  }
  await expect(P.page.getByRole("button", { name: "New tab" })).toBeVisible();
  await rule10(P.page, "phone-tabs-390", log);
  await shot(P.page, "phase3-tabs-390x844.png");
  await P.ctx.close();
});
