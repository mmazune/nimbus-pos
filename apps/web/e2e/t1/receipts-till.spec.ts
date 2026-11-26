import { expect, test, type Page } from "@playwright/test";

import { ensureFloorFixture } from "./floor-fixture";
import { apiCall, expectRules, makePins, pageRules, pinSignIn, saveJson, shot } from "./support";

/**
 * T1 phase 4: Receipts and Till for the cashier, by PIN (drawings
 * Cashier-Receipts and Cashier-Till). Fixture database (T1_FLOOR_FIXTURE=1).
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const measured: Record<string, unknown> = {};
const MAIN = "c3565ecbf51c58f06221d7d5"; // a seeded demo menu item, 42,000
let bill = "";
let paidTotal = "";

test.beforeAll(async () => {
  await ensureFloorFixture();
  await makePins();
  // A bill paid today: opened, sent, served, paid in cash at a VIP table.
  const tables = await apiCall<Array<{ id: string; floorPlan?: { name?: string } | null }>>("manager", "/tables");
  const vip = tables.filter((t) => t.floorPlan?.name === "VIP");
  const table = vip[Date.now() % vip.length];
  const order = await apiCall<{ id: string; orderNumber: string }>("waiter", "/pos/orders", "POST", { serviceType: "DINE_IN", tableId: table.id });
  // 5 × 42,000 = 210,000: room for a refund above the demo org's approval limit (UGX 150,000)
  await apiCall("waiter", `/pos/orders/${order.id}/items`, "POST", { menuItemId: MAIN, quantity: 5 });
  await apiCall("waiter", `/pos/orders/${order.id}/send`, "POST", {});
  for (const step of ["in-kitchen", "ready", "mark-served"]) await apiCall("supervisor", `/pos/orders/${order.id}/${step}`, "POST", {});
  const full = await apiCall<{ total: string; orderNumber: string }>("waiter", `/pos/orders/${order.id}`);
  await apiCall("cashier", `/pos/orders/${order.id}/close`, "POST", { payments: [{ method: "CASH", amount: Number(full.total) }] }, { "Idempotency-Key": `t1-rt-${order.id}` });
  bill = full.orderNumber.replace(/^ORD-/, "");
  paidTotal = full.total;
});
test.afterAll(() => saveJson("receipts-till-measured.json", measured));

async function rules(page: Page, name: string) {
  const r = await pageRules(page);
  measured[name] = r;
  expectRules(r);
}

test("cashier finds today's paid bill, opens it and asks for refunds (1280 × 800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "cashier");
  await page.goto("/cashier/receipts");
  await expect(page.getByRole("tab", { name: /^Today · \d+/ })).toBeVisible();
  await page.getByLabel(/find a bill/i).fill(bill);
  const row = page.getByRole("button", { name: new RegExp(`^Bill ${bill},`) });
  await expect(row).toBeVisible();
  await row.click();
  const panel = page.locator("[data-receipt]");
  await expect(panel).toContainText(`Bill ${bill}`);
  await expect(panel).toContainText("Cash");
  await expect(panel).toContainText(`UGX ${Number(paidTotal).toLocaleString("en-US")}`);
  await expect(page.getByRole("button", { name: /print again|send receipt/i })).toHaveCount(0);
  await rules(page, "receipts-1280");
  await shot(page, "Cashier-Receipts-1280x800.png");

  // a small refund (under the approval limit) is recorded at once
  await panel.getByRole("button", { name: "Refund" }).click();
  let sheet = page.getByRole("dialog", { name: new RegExp(`^Refund · bill ${bill}`) });
  await expect(sheet.getByRole("button", { name: /^Cash/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Ask for the refund" }).click();
  await expect(sheet.getByText(/Enter a refund amount/)).toBeVisible();
  await sheet.getByLabel(/^amount/i).fill("2000");
  await sheet.getByLabel(/^why/i).fill("Dish sent back");
  await rules(page, "refund-sheet-1280");
  await shot(page, "Cashier-Receipts-refund-1280x800.png");
  await sheet.getByRole("button", { name: "Ask for the refund" }).click();
  await expect(sheet.getByText("Refund recorded.")).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();

  // a refund above the limit waits; what can still be refunded drops, and the bill shows it
  await panel.getByRole("button", { name: "Refund" }).click();
  sheet = page.getByRole("dialog", { name: new RegExp(`^Refund · bill ${bill}`) });
  const left = Number(paidTotal) - 2000;
  await expect(sheet).toContainText(`Up to UGX ${left.toLocaleString("en-US")} can be refunded.`);
  await sheet.getByLabel(/^amount/i).fill("160000");
  await sheet.getByLabel(/^why/i).fill("Wrong order");
  await sheet.getByRole("button", { name: "Ask for the refund" }).click();
  await expect(sheet.getByText("Saved. It waits for approval before money goes back.")).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(panel.getByText("Refund waiting for approval")).toBeVisible();
  await panel.getByRole("button", { name: "Refund" }).click();
  sheet = page.getByRole("dialog", { name: new RegExp(`^Refund · bill ${bill}`) });
  await expect(sheet).toContainText(`Up to UGX ${(left - 160000).toLocaleString("en-US")} can be refunded.`);
  await sheet.getByRole("button", { name: "Cancel" }).click();

  // the refund flag moves the order's updatedAt; the bill stays under Today (split by opening day)
  await page.reload();
  await page.getByLabel(/find a bill/i).fill(bill);
  await expect(page.getByRole("button", { name: new RegExp(`^Bill ${bill},`) })).toBeVisible();
});

test("cashier drops cash to the safe, counts and closes the till, and opens a new one (1280 × 800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "cashier");
  await page.goto("/cashier/till");
  const start = page.getByRole("button", { name: "Start shift" });
  const openTill = page.getByRole("button", { name: "Open the till" });
  await expect(page.getByText(/Cash in the drawer|Open the till/).first()).toBeVisible();
  if (await start.isVisible()) {
    await start.click();
    await expect(page.getByText("Your shift has started.")).toBeVisible();
  }
  if (await openTill.isVisible()) {
    await page.getByLabel(/float at the start/i).fill("200000");
    await openTill.click();
    await expect(page.getByText("Should be in the drawer")).toBeVisible();
  }
  await expect(page.getByText("Should be in the drawer")).toBeVisible();
  await expect(page.getByText("Cash payments in the branch, less refunds")).toBeVisible();
  await rules(page, "till-1280");
  await shot(page, "Cashier-Till-1280x800.png");

  await page.getByRole("button", { name: "Drop to the safe" }).click();
  const drop = page.getByRole("dialog", { name: "Drop to the safe" });
  await drop.getByLabel(/^amount/i).fill("1000");
  await rules(page, "safe-drop-sheet-1280");
  await drop.getByRole("button", { name: "Record the drop" }).click();
  await expect(page.getByText("UGX 1,000 dropped to the safe.")).toBeVisible();

  // a count that does not match asks why
  await page.reload();
  await expect(page.getByText("Dropped to the safe · ")).toBeVisible();
  const expectedText = (await page.getByText("Should be in the drawer").locator("..").textContent()) ?? "";
  const expected = expectedText.replace(/.*UGX\s*/, "").replace(/[^\d]/g, "");
  await page.getByLabel(/cash counted/i).fill(String(Number(expected) - 500));
  await expect(page.getByText("Short by UGX 500")).toBeVisible();
  await page.getByRole("button", { name: "Count and close" }).click();
  await expect(page.getByText("Write why.")).toBeVisible();
  await shot(page, "Cashier-Till-variance-1280x800.png");

  // count exactly what the server expects, confirm, close
  await page.getByLabel(/cash counted/i).fill(expected);
  await page.getByRole("button", { name: "Count and close" }).click();
  const confirm = page.getByRole("dialog", { name: "Close the till?" });
  await expect(confirm).toContainText("No difference");
  await rules(page, "close-confirm-1280");
  await confirm.getByRole("button", { name: "Close the till" }).click();
  await expect(page.getByText("The till is counted and closed.")).toBeVisible();
  await expect(page.getByText("No difference")).toBeVisible();
  await shot(page, "Cashier-Till-closed-1280x800.png");

  // the next till opens from here, without a reload
  await page.getByRole("button", { name: "Open a new till" }).click();
  await page.getByLabel(/float at the start/i).fill("150000");
  await page.getByRole("button", { name: "Open the till" }).click();
  await expect(page.getByText("Should be in the drawer")).toBeVisible();
});

test("Receipts and Till at 390 × 844, each sheet open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pinSignIn(page, "cashier");
  await page.goto("/cashier/receipts");
  await expect(page.getByRole("tab", { name: /^Today · \d+/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bill / }).first()).toBeVisible();
  await rules(page, "receipts-390");
  await page.getByLabel(/find a bill/i).fill(bill);
  await page.getByRole("button", { name: new RegExp(`^Bill ${bill}`) }).click();
  const billSheet = page.getByRole("dialog", { name: "Bill" });
  await expect(billSheet).toBeVisible();
  await rules(page, "receipts-sheet-390");
  await shot(page, "Cashier-Receipts-390x844.png");
  await billSheet.getByRole("button", { name: "Refund" }).click();
  const refund = page.getByRole("dialog", { name: new RegExp(`^Refund · bill ${bill}`) });
  await refund.getByLabel(/^amount/i).fill("1000");
  await refund.getByLabel(/^why/i).fill("Short pour");
  await rules(page, "refund-sheet-390");
  await refund.getByRole("button", { name: "Ask for the refund" }).click();
  await expect(refund.getByText("Refund recorded.")).toBeVisible();
  await refund.getByRole("button", { name: "Done" }).click();
  // back on the bill, as the person left it; close it
  await page.getByRole("dialog", { name: "Bill" }).getByRole("button", { name: "Close" }).click();
  await page.getByLabel(/find a bill/i).fill("");
  await page.getByRole("tab", { name: "Earlier" }).click();
  await expect(page.getByText(/^Page \d+ of \d+/)).toBeVisible();
  await rules(page, "receipts-earlier-390");
  await shot(page, "Cashier-Receipts-earlier-390x844.png");

  await page.goto("/cashier/till");
  await expect(page.getByText("Should be in the drawer")).toBeVisible();
  await rules(page, "till-390");
  await shot(page, "Cashier-Till-390x844.png");
  await page.getByRole("button", { name: "Drop to the safe" }).click();
  await page.getByRole("dialog", { name: "Drop to the safe" }).getByLabel(/^amount/i).fill("500");
  await rules(page, "safe-drop-sheet-390");
  await page.getByRole("dialog", { name: "Drop to the safe" }).getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel(/cash counted/i).fill("1");
  await expect(page.getByText(/^Short by UGX/)).toBeVisible();
  await rules(page, "till-variance-390");
  await page.getByLabel(/why it does not match/i).fill("Test count");
  await page.getByRole("button", { name: "Count and close" }).click();
  await expect(page.getByRole("dialog", { name: "Close the till?" })).toBeVisible();
  await rules(page, "close-confirm-390");
  await shot(page, "Cashier-Till-close-390x844.png");
  await page.getByRole("dialog", { name: "Close the till?" }).getByRole("button", { name: "Keep it open" }).click();
});
