import { expect, test, type Page } from "@playwright/test";

import { ensureFloorFixture } from "./floor-fixture";
import { apiCall, expectRules, makePins, pageRules, pinSignIn, saveJson, shot, mainItemId } from "./support";

/**
 * T1 phase 3: Me for waiter, cashier and supervisor (drawing Waiter-Me), by PIN.
 * Fixture database (T1_FLOOR_FIXTURE=1).
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const measured: Record<string, unknown> = {};

test.beforeAll(async () => {
  await ensureFloorFixture();
  await makePins();
});
test.afterAll(() => saveJson("me-measured.json", measured));

async function rules(page: Page, name: string) {
  const r = await pageRules(page);
  measured[name] = r;
  expectRules(r);
}

async function fact(page: Page, label: string) {
  const row = page.locator("section[aria-label='My day'] div").filter({ hasText: new RegExp(`^${label}`) }).last();
  return (await row.textContent())?.replace(label, "").trim() ?? "";
}

test("waiter: a real order opened, sent and paid moves My day (1280 × 800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "waiter");
  await page.goto("/waiter/me");
  await expect(page.locator("section[aria-label='My day']")).toContainText("Sales so far");
  const before = { sales: await fact(page, "Sales so far"), served: await fact(page, "Tables served") };

  // open on a free fixture table, send, serve, pay in cash
  const tables = await apiCall<Array<{ id: string; label: string; floorPlan?: { name?: string } | null }>>("manager", "/tables");
  const free = tables.find((t) => t.floorPlan?.name === "VIP");
  if (!free) throw new Error("no VIP table in the fixture");
  const order = await apiCall<{ id: string }>("waiter", "/pos/orders", "POST", { serviceType: "DINE_IN", tableId: free.id });
  await apiCall("waiter", `/pos/orders/${order.id}/items`, "POST", { menuItemId: await mainItemId(), quantity: 1 });
  await apiCall("waiter", `/pos/orders/${order.id}/send`, "POST", {});
  for (const step of ["in-kitchen", "ready", "mark-served"]) await apiCall("supervisor", `/pos/orders/${order.id}/${step}`, "POST", {});
  const full = await apiCall<{ total: string }>("waiter", `/pos/orders/${order.id}`);
  await apiCall("cashier", `/pos/orders/${order.id}/close`, "POST", { payments: [{ method: "CASH", amount: Number(full.total) }] }, { "Idempotency-Key": `t1-me-${order.id}` });

  await page.reload();
  await expect(page.locator("section[aria-label='My day']")).toContainText("Sales so far");
  const after = { sales: await fact(page, "Sales so far"), served: await fact(page, "Tables served") };
  const n = (v: string) => BigInt(v.replace(/[^\d]/g, "") || "0");
  measured.myDay = { before, after, orderTotal: full.total };
  expect(n(after.sales) - n(before.sales)).toBe(BigInt(String(full.total).split(".")[0]));
  expect(Number(after.served)).toBeGreaterThanOrEqual(Number(before.served));

  await rules(page, "waiter-me-1280");
  await shot(page, "Waiter-Me-1280x800.png");
});

test("waiter asks for leave, clocks in, and End my shift asks first (1280 × 800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "waiter");
  await page.goto("/waiter/me");
  await page.getByRole("button", { name: "Ask for leave" }).click();
  const sheet = page.getByRole("dialog", { name: "Ask for leave" });
  await sheet.getByRole("button", { name: "Send the request" }).click();
  await expect(sheet.getByText(/Write the first day/)).toBeVisible();
  // a day no earlier run has asked for (the API refuses an overlapping request)
  // (T5: far from the approvals spec's leave, which uses the same waiter on the demo venue)
  const d = new Date(Date.now() + (800 + (Math.floor(Date.now() / 1000) % 600)) * 86_400_000);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await sheet.getByLabel(/^first day/i).fill(day);
  await sheet.getByLabel(/^last day/i).fill(day);
  await sheet.getByLabel(/^why/i).fill("Family wedding");
  await rules(page, "waiter-leave-sheet-1280");
  await shot(page, "Waiter-Me-leave-1280x800.png");
  await sheet.getByRole("button", { name: "Send the request" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator("section[aria-label='My requests']")).toContainText("Waiting");

  const clockIn = page.getByRole("button", { name: /^Clock (in|out)$/ });
  if (await clockIn.count()) {
    const word = (await clockIn.textContent())?.trim();
    await clockIn.click();
    await expect(page.getByText(word === "Clock in" ? "Clocked in." : "Clocked out.")).toBeVisible();
  }

  await page.getByRole("button", { name: "End my shift" }).click();
  const end = page.getByRole("dialog", { name: "End your shift?" });
  await expect(end).toContainText(/open|no tables/);
  await rules(page, "waiter-end-sheet-1280");
  await end.getByRole("button", { name: "Keep working" }).click();
  await expect(end).toHaveCount(0);
});

test("cashier and supervisor Me, and all three at 390 × 844", async ({ page }) => {
  for (const who of ["cashier", "supervisor"] as const) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await pinSignIn(page, who);
    await page.goto(`/${who}/me`);
    await expect(page.locator("section[aria-label='My shift']")).toBeVisible();
    await expect(page.locator("section[aria-label='My day']")).not.toContainText("Sales so far");
    for (const banned of [/Restricted surfaces/i, /Known limitations/i, /Readiness/i, /pos:[a-z]/, /\/api\//]) {
      await expect(page.locator("body")).not.toContainText(banned);
    }
    await rules(page, `${who}-me-1280`);
    await shot(page, `${who}-Me-1280x800.png`);
  }
  for (const who of ["waiter", "cashier", "supervisor"] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await pinSignIn(page, who);
    await page.goto(`/${who}/me`);
    await expect(page.locator("section[aria-label='My shift']")).toBeVisible();
    await rules(page, `${who}-me-390`);
    await shot(page, `${who}-Me-390x844.png`);
  }
  // Log out is the one filled button; it lands on the PIN screen.
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login/);
});
