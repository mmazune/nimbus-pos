import { expect, test, type Page } from "@playwright/test";

import { ensureFloorFixture } from "./floor-fixture";
import { apiCall, expectRules, makePins, pageRules, pinSignIn, saveJson, shot } from "./support";

/**
 * T1 phase 5: Approvals for the supervisor, by PIN (drawing Supervisor-Approvals).
 * Fixture database (T1_FLOOR_FIXTURE=1). Made through the API first:
 *   a discount above the demo org's approval limit (UGX 150,000), asked by the manager,
 *   a leave request from the waiter. Pending swaps come from the demo data (no route makes a roster).
 * The demo branch also has acknowledged alerts, one of which is resolved here.
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const measured: Record<string, unknown> = {};
const MAIN = "c3565ecbf51c58f06221d7d5";
let bill = "";
const stamp = Date.now().toString(36).slice(-4);

function isoDay(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test.beforeAll(async () => {
  await ensureFloorFixture();
  await makePins();
  const tables = await apiCall<Array<{ id: string; floorPlan?: { name?: string } | null }>>("manager", "/tables");
  const terrace = tables.filter((t) => t.floorPlan?.name === "Terrace");
  const order = await apiCall<{ id: string; orderNumber: string }>("waiter", "/pos/orders", "POST", { serviceType: "DINE_IN", tableId: terrace[Date.now() % terrace.length].id });
  await apiCall("waiter", `/pos/orders/${order.id}/items`, "POST", { menuItemId: MAIN, quantity: 5 });
  await apiCall("waiter", `/pos/orders/${order.id}/send`, "POST", {});
  await apiCall("manager", `/pos/orders/${order.id}/discounts`, "POST", { type: "FIXED", value: 160000, reason: `Regular guest ${stamp}` });
  bill = order.orderNumber.replace(/^ORD-/, "");

  const waiterMe = await apiCall<{ employee?: { id: string } }>("waiter", "/auth/me");
  const offset = 40 + (Math.floor(Date.now() / 1000) % 300);
  await apiCall("waiter", "/hr/leave", "POST", {
    employeeId: waiterMe.employee?.id,
    leaveType: "ANNUAL",
    startsAt: `${isoDay(offset)}T00:00:00.000Z`,
    endsAt: `${isoDay(offset + 1)}T23:59:00.000Z`,
    reason: `Family wedding ${stamp}`,
  });
  // A swap needs a published roster assignment and no route makes one, so the demo's own
  // pending swaps are used (four in the seed).
});
test.afterAll(() => saveJson("approvals-measured.json", measured));

async function rules(page: Page, name: string) {
  const r = await pageRules(page);
  measured[name] = r;
  expectRules(r);
}

test("supervisor declines a discount, approves leave, declines a swap, resolves an alert (1280 × 800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "supervisor");
  await page.goto("/supervisor/approvals");
  await expect(page.getByRole("tab", { name: /^Waiting · \d+/ })).toBeVisible();
  for (const banned of [/pos:[a-z]/, /\/api\//, /endpoint/i]) await expect(page.locator("body")).not.toContainText(banned);

  // discount: approve is offered (no money taken yet); decline asks why
  const discount = page.getByRole("button", { name: new RegExp(`^Discount · bill ${bill}`) });
  await discount.click();
  let panel = page.locator("[data-approval^='discount:']");
  await expect(panel).toContainText(`Regular guest ${stamp}`);
  await expect(panel.getByRole("button", { name: "Approve the discount" })).toBeEnabled();
  await rules(page, "approvals-1280");
  await shot(page, "Supervisor-Approvals-1280x800.png");
  await panel.getByRole("button", { name: "Decline" }).click();
  const why = page.getByRole("dialog", { name: "Decline the discount" });
  await why.getByRole("button", { name: "Decline" }).click();
  await expect(why.getByText("Write why.")).toBeVisible();
  await why.getByLabel(/^why/i).fill("Not a regular");
  await rules(page, "decline-sheet-1280");
  await why.getByRole("button", { name: "Decline" }).click();
  await expect(panel.getByText("Discount declined.")).toBeVisible();
  await expect(panel).toContainText("Declined by");

  // leave: approve
  await page.getByRole("button", { name: /^Leave · / }).filter({ hasText: /\d/ }).first().click();
  panel = page.locator("[data-approval^='leave:']");
  await expect(panel.getByRole("button", { name: "Approve the leave" })).toBeVisible();
  await panel.getByRole("button", { name: "Approve the leave" }).click();
  await expect(panel.getByText("Leave approved.")).toBeVisible();

  // swap: decline only
  await page.getByRole("button", { name: /^Shift swap · / }).first().click();
  panel = page.locator("[data-approval^='shift-swap:']");
  await expect(panel.getByRole("button", { name: /approve/i })).toHaveCount(0);
  await panel.getByRole("button", { name: "Decline the swap" }).click();
  await page.getByRole("dialog", { name: "Decline the swap" }).getByRole("button", { name: "Decline the swap" }).click();
  await expect(panel.getByText("Shift swap declined.")).toBeVisible();

  // alert: an acknowledged one is resolved with notes
  const alert = page.getByRole("button", { name: /^Alert · / }).first();
  if (await alert.count()) {
    await alert.click();
    panel = page.locator("[data-approval^='anomaly:']");
    const resolve = panel.getByRole("button", { name: "Mark resolved" });
    if (await resolve.count()) {
      await resolve.click();
      const notes = page.getByRole("dialog", { name: "Mark resolved" });
      await notes.getByLabel(/what was done/i).fill("Checked the till with the cashier");
      await notes.getByRole("button", { name: "Mark resolved" }).click();
      await expect(panel.getByText("Alert resolved.")).toBeVisible();
    }
  }

  // Done today shows the decisions with who and when
  await page.getByRole("tab", { name: /^Done today/ }).click();
  await expect(page.getByRole("button", { name: /^Leave · / }).first()).toContainText("Approved");
  await page.getByRole("button", { name: /^Leave · / }).first().click();
  await expect(page.locator("[data-approval^='leave:']")).toContainText(/Decided by.*\d\d:\d\d/);
  await rules(page, "approvals-done-1280");
  await shot(page, "Supervisor-Approvals-done-1280x800.png");
});

test("Approvals at 390 × 844 with the request sheet open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pinSignIn(page, "supervisor");
  await page.goto("/supervisor/approvals");
  await expect(page.getByRole("tab", { name: /^Waiting · \d+/ })).toBeVisible();
  await rules(page, "approvals-390");
  await shot(page, "Supervisor-Approvals-390x844.png");
  await page.getByRole("tab", { name: /^Done today/ }).click();
  const first = page.getByRole("button", { name: /^(Leave|Shift swap|Alert) · / }).first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await rules(page, "approvals-sheet-390");
  await shot(page, "Supervisor-Approvals-sheet-390x844.png");
});
