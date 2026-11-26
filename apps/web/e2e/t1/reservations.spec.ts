import { expect, test, type Page } from "@playwright/test";

import { ensureFloorFixture } from "./floor-fixture";
import { apiCall, expectRules, makePins, pageRules, pinSignIn, saveJson, shot } from "./support";

/**
 * T1 phase 2: Reservations for the waiter and the supervisor, driven by PIN in
 * the browser (drawings Reservations-Waiter and Reservations-Supervisor).
 * Same fixture database as floor.spec.ts (T1_FLOOR_FIXTURE=1).
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const measured: Record<string, unknown> = {};
const stamp = Date.now().toString(36).slice(-4);

type Table = { id: string; label: string; floorPlan?: { name?: string } | null };

async function tableId(label: string) {
  const tables = await apiCall<Table[]>("manager", "/tables");
  const t = tables.find((x) => x.label === label && x.floorPlan?.name === "Main hall");
  if (!t) throw new Error(`no table ${label}`);
  return t.id;
}

function minutesFromNow(m: number) {
  return new Date(Date.now() + m * 60_000).toISOString();
}

test.beforeAll(async () => {
  await ensureFloorFixture();
  await makePins();
});
test.afterAll(() => saveJson("reservations-measured.json", measured));

async function rules(page: Page, name: string) {
  const r = await pageRules(page);
  measured[name] = r;
  expectRules(r);
}

test("waiter seats a late booking at another free table (1280 × 800)", async ({ page }) => {
  // A confirmed booking for 4, due 30 minutes ago, on a table the waiter's own order still holds
  // (2, 6, 9, 12 or 17 in the fixture: the first one with no booking in that window).
  let made: { id: string } | undefined;
  let busyLabel = "";
  for (const label of ["2", "6", "9", "12", "17"]) {
    try {
      made = await apiCall<{ id: string }>("supervisor", "/reservations", "POST", {
        customerName: `Late Guest ${stamp}`,
        partySize: 4,
        reservationAt: minutesFromNow(-30),
        tableId: await tableId(label),
        source: "PHONE",
        notes: "Birthday. Wants a quiet corner.",
      });
      busyLabel = label;
      break;
    } catch (e) {
      if (!String(e).includes("409")) throw e;
    }
  }
  if (!made) throw new Error("every busy fixture table already has a booking in this window");
  await apiCall("supervisor", `/reservations/${made.id}/confirm`, "PATCH", {});
  const madeId = made.id;

  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "waiter");
  await page.goto("/waiter/reservations");
  const row = page.getByRole("button", { name: new RegExp(`L\\. Guest ${stamp}`) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/Late/);
  await row.click();
  const panel = page.locator(`[data-res-panel="${madeId}"]`);
  await expect(panel).toContainText(`Table ${busyLabel} is not free.`);
  await expect(panel).toContainText("To change or cancel a booking, ask a supervisor.");
  await expect(panel.getByRole("button", { name: /cancel booking/i })).toHaveCount(0);
  await rules(page, "waiter-1280");
  await shot(page, "Reservations-Waiter-1280x800.png");
  // choose the second free table offered, not the first
  const options = panel.locator("button[aria-pressed]");
  await expect(options.first()).toBeVisible();
  const second = options.nth(1);
  const label = (await second.locator("span").first().textContent())?.trim() ?? "";
  await second.click();
  await panel.getByRole("button", { name: new RegExp(`^Seat at ${label.replace(/^Table /, "table ")}$`) }).click();
  await expect(panel).toContainText(`Seated at ${label}.`);
  const after = await apiCall<{ status: string; table?: { label?: string } }>("supervisor", `/reservations/${madeId}`);
  expect(after.status).toBe("SEATED");
  expect(`Table ${after.table?.label}`).toBe(label);
  await shot(page, "Reservations-Waiter-seated-1280x800.png");
  // the table the waiter just seated now shows open on the Floor
  const tables = await apiCall<Array<{ id: string; label: string }>>("manager", "/tables");
  const seatedId = tables.find((t) => `Table ${t.label}` === label)?.id;
  await page.goto("/waiter/floor");
  await page.getByRole("tab", { name: "All tables" }).click();
  for (const area of ["Main hall", "Terrace", "Bar", "VIP", "Tabs"]) {
    await page.getByRole("button", { name: new RegExp(`^${area}`) }).click();
    if (await page.locator(`[data-floor-table-id="${seatedId}"]`).count()) break;
  }
  await expect(page.locator(`[data-floor-table-id="${seatedId}"]`)).toHaveAttribute("data-floor-tile", "open");
});

test("supervisor creates, confirms, moves, completes and cancels bookings (1280 × 800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await pinSignIn(page, "supervisor");
  await page.goto("/supervisor/reservations");
  await expect(page.getByRole("tab", { name: /^Arriving/ })).toBeVisible();

  // create
  const later = new Date(Date.now() + 90 * 60_000);
  const hh = String(later.getHours()).padStart(2, "0");
  const mm = String(later.getMinutes()).padStart(2, "0");
  await page.getByRole("button", { name: "New reservation" }).click();
  const sheet = page.getByRole("dialog", { name: "New reservation" });
  await sheet.getByLabel("Guest's name").fill(`Rita Namara ${stamp}`);
  await sheet.getByLabel("Phone").fill("+256 700 000 112");
  await sheet.getByLabel("Guests").fill("4");
  await sheet.getByLabel("Time").fill(`${hh}:${mm}`);
  await rules(page, "supervisor-create-1280");
  await shot(page, "Reservations-Supervisor-new-1280x800.png");
  await sheet.getByRole("button", { name: "Create booking" }).click();
  await expect(sheet).toHaveCount(0);
  const row = page.getByRole("button", { name: new RegExp(`R\\. Namara ${stamp}`) });
  await expect(row).toBeVisible();
  await row.click();
  const panel = page.locator("[data-res-panel]");
  await expect(panel).toContainText("+256 700 000 112");

  // confirm
  await panel.getByRole("button", { name: "Confirm booking" }).click();
  await expect(panel).toContainText("Booking confirmed.");

  // move (change table)
  await panel.getByRole("button", { name: "Change table" }).click();
  const move = page.getByRole("dialog", { name: "Change table" });
  const target = move.locator("button[aria-pressed]").first();
  const targetLabel = (await target.locator("span").first().textContent())?.trim() ?? "";
  await target.click();
  await move.getByRole("button", { name: `Move to ${targetLabel}` }).click();
  await expect(panel).toContainText(`Moved to ${targetLabel}.`);
  await rules(page, "supervisor-1280");
  await shot(page, "Reservations-Supervisor-1280x800.png");

  // seat, then complete
  await panel.getByRole("button", { name: /^Seat at / }).click();
  await expect(panel).toContainText(/Seated at /);
  await page.getByRole("tab", { name: /^Seated/ }).click();
  await page.getByRole("button", { name: new RegExp(`R\\. Namara ${stamp}`) }).click();
  await panel.getByRole("button", { name: "Complete booking" }).click();
  await expect(panel).toContainText("Booking completed.");

  // cancel another booking, with a reason
  const other = await apiCall<{ id: string }>("supervisor", "/reservations", "POST", {
    customerName: `Sam Okello ${stamp}`,
    partySize: 2,
    reservationAt: minutesFromNow(120),
    source: "PHONE",
  });
  await page.getByRole("tab", { name: /^Arriving/ }).click();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(`S\\. Okello ${stamp}`) }).click();
  await page.locator(`[data-res-panel="${other.id}"]`).getByRole("button", { name: "Cancel booking" }).click();
  const cancel = page.getByRole("dialog", { name: "Cancel booking" });
  await cancel.getByRole("button", { name: "Cancel booking" }).click();
  await expect(cancel).toContainText("Write the reason.");
  await cancel.getByLabel("Why is it cancelled?").fill("The guest called to cancel");
  await shot(page, "Reservations-Supervisor-cancel-1280x800.png");
  await cancel.getByRole("button", { name: "Cancel booking" }).click();
  await expect(cancel).toHaveCount(0);
  const done = await apiCall<{ status: string }>("supervisor", `/reservations/${other.id}`);
  expect(done.status).toBe("CANCELLED");
  const finished = await apiCall<Array<{ customerName: string; status: string }>>("supervisor", "/reservations?scope=history&pageSize=100")
    .then((r) => (r as unknown as { data: Array<{ customerName: string; status: string }> }).data);
  expect(finished.find((x) => x.customerName === `Rita Namara ${stamp}`)?.status).toBe("COMPLETED");
});

test("both roles at 390 × 844 and the supervisor History", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const who of ["waiter", "supervisor"] as const) {
    await pinSignIn(page, who);
    await page.goto(`/${who}/reservations`);
    await expect(page.getByRole("tab", { name: /^Arriving/ })).toBeVisible();
    await rules(page, `${who}-390`);
    await shot(page, `Reservations-${who}-390x844.png`);
  }
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: /Completed|Cancelled|No-show/ }).first()).toBeVisible();
  await rules(page, "supervisor-history-390");
  await shot(page, "Reservations-supervisor-history-390x844.png");
});

test("at 390 × 844: the waiter seats from the booking sheet; the supervisor creates and cancels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const made = await apiCall<{ id: string }>("supervisor", "/reservations", "POST", {
    customerName: `Phone Guest ${stamp}`,
    partySize: 2,
    reservationAt: minutesFromNow(40),
    source: "PHONE",
  });
  await apiCall("supervisor", `/reservations/${made.id}/confirm`, "PATCH", {});

  await pinSignIn(page, "waiter");
  await page.goto("/waiter/reservations");
  await page.getByRole("button", { name: new RegExp(`P\\. Guest ${stamp}`) }).click();
  const sheet = page.getByRole("dialog", { name: new RegExp(`P\\. Guest ${stamp}`) });
  await expect(sheet).toBeVisible();
  await rules(page, "waiter-detail-sheet-390");
  await shot(page, "Reservations-waiter-sheet-390x844.png");
  await sheet.getByRole("button", { name: /^Seat at / }).click();
  await expect(sheet.getByText(/^Seated at /)).toBeVisible();

  await pinSignIn(page, "supervisor");
  await page.goto("/supervisor/reservations");
  await page.getByRole("button", { name: "New reservation" }).click();
  const create = page.getByRole("dialog", { name: "New reservation" });
  await create.getByLabel("Guest's name").fill(`Phone Booking ${stamp}`);
  await create.getByLabel("Guests").fill("3");
  const later = new Date(Date.now() + 150 * 60_000);
  await create.getByLabel("Time").fill(`${String(later.getHours()).padStart(2, "0")}:${String(later.getMinutes()).padStart(2, "0")}`);
  await rules(page, "supervisor-create-sheet-390");
  await shot(page, "Reservations-supervisor-new-390x844.png");
  await create.getByRole("button", { name: "Create booking" }).click();
  await expect(create).toHaveCount(0);
  const detail = page.getByRole("dialog", { name: new RegExp(`P\\. Booking ${stamp}`) });
  if (!(await detail.isVisible())) await page.getByRole("button", { name: new RegExp(`P\\. Booking ${stamp}`) }).click();
  await detail.getByRole("button", { name: "Cancel booking" }).click();
  const cancel = page.getByRole("dialog", { name: "Cancel booking" });
  await cancel.getByLabel(/why is it cancelled/i).fill("Booked twice by mistake");
  await rules(page, "supervisor-cancel-sheet-390");
  await cancel.getByRole("button", { name: "Cancel booking" }).click();
  await expect(cancel).toHaveCount(0);
});
