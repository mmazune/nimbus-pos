import { expect, test } from "@playwright/test";

import { ensureFloorFixture } from "./floor-fixture";
import { apiCall, makePins, pinSignIn, saveJson, shot } from "./support";

/**
 * T1 Done-when 3: proof for the three drawn texts the screens do not print.
 *   1. The header station ("Till 1"): an installer's setting. Shown when set.
 *   2. "A supervisor signs any difference": the close-the-till route takes no sign-off.
 *   3. "Refund · needs a supervisor": only refunds above the org limit wait, and the
 *      cashier cannot read that limit, so the words would be false for a small one.
 * Fixture database (T1_FLOOR_FIXTURE=1).
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const MAIN = "c3565ecbf51c58f06221d7d5"; // a seeded demo menu item, 42,000
const proof: Record<string, unknown> = {};

test.beforeAll(async () => {
  await ensureFloorFixture();
  await makePins();
});
test.afterAll(() => saveJson("left-out-proof.json", proof));

async function status(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (e) {
    return String((e as Error).message);
  }
}

test("1. the header shows the station's name when the station has one (1280 × 800)", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nimbus.stationTerminalLabel", "Till 1"));
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "cashier");
  await page.goto("/cashier/till");
  await expect(page.locator("header").first()).toContainText("Till 1");
  proof.station = await page.locator("header").first().innerText();
  await shot(page, "Header-station-Till-1-1280x800.png");
});

test("2. closing a till takes no supervisor sign-off", async () => {
  // The DTO is whitelisted (forbidNonWhitelisted): a sign-off field is refused before any lookup.
  const signed = await status(() => apiCall("cashier", "/tills/no-such-till/reconcile", "POST", { countedCash: 1, varianceReason: "x", supervisorId: "x", signedBy: "x" }));
  proof.reconcileWithSignOff = signed;
  expect(signed).toMatch(/→ 400 .*(supervisorId|signedBy) should not exist/);
});

test("3. a small refund is paid at once and the cashier cannot read the limit", async () => {
  const settings = await status(() => apiCall("cashier", "/settings"));
  proof.cashierSettings = settings;
  expect(settings).toMatch(/→ 403/);
  const limit = (await apiCall<{ discountApprovalThreshold?: string | number }>("manager", "/settings")).discountApprovalThreshold;
  proof.orgLimit = limit;

  const tables = await apiCall<Array<{ id: string; floorPlan?: { name?: string } | null }>>("manager", "/tables");
  const terrace = tables.filter((t) => t.floorPlan?.name === "Terrace");
  const order = await apiCall<{ id: string }>("waiter", "/pos/orders", "POST", { serviceType: "DINE_IN", tableId: terrace[(Date.now() + 3) % terrace.length].id });
  await apiCall("waiter", `/pos/orders/${order.id}/items`, "POST", { menuItemId: MAIN, quantity: 1 });
  await apiCall("waiter", `/pos/orders/${order.id}/send`, "POST", {});
  for (const step of ["in-kitchen", "ready", "mark-served"]) await apiCall("supervisor", `/pos/orders/${order.id}/${step}`, "POST", {});
  const full = await apiCall<{ total: string }>("waiter", `/pos/orders/${order.id}`);
  await apiCall("cashier", `/pos/orders/${order.id}/close`, "POST", { payments: [{ method: "CASH", amount: Number(full.total) }] }, { "Idempotency-Key": `t1-lo-${order.id}` });
  const { payments: list } = await apiCall<{ payments: Array<{ id: string }> }>("cashier", `/pos/orders/${order.id}/payments`);
  const refund = await apiCall<{ status: string }>(
    "cashier",
    `/pos/orders/${order.id}/refunds`,
    "POST",
    { paymentId: list[0].id, amount: 1000, reason: "Left-out proof" },
    { "Idempotency-Key": `t1-lo-r-${order.id}` },
  );
  proof.smallRefund = refund.status;
  expect(refund.status).toBe("COMPLETED");
});
