import { apiCall } from "./support";

/**
 * The drawn floor, built through the API on a SECOND throwaway database
 * (never the one the regression suite runs on): Main hall 32, Terrace 16,
 * Bar 10, VIP 6 and "Tabs" 6 = 70 tables, numbered as the drawings number them.
 * The "Tabs" area here is six ordinary tables named "Tab 1"…"Tab 6": real tabs
 * for standing guests arrive with T2; these only prove a "Tab 3" name fits a
 * three-across phone tile.
 *
 * States, as Table-Tile draws them, with what the data can hold today:
 *   open, yours       waiter orders on 2, 6, 9, 12, 17 (sent)
 *   not sent          waiter order on 23 (items, never sent)
 *   open, another's   supervisor orders on 3, 5, 10, 13, 16, 19, 20, 24, 26, 28, 30
 *   reserved          bookings today on 7 (20:00, 6) and 21 (20:30, 4)
 *   cleaning          table 15
 *   free              the rest
 * Idempotent: it stops if a "Main hall" floor plan already exists.
 */
const AREAS: Array<{ name: string; labels: string[]; seats: number[] }> = [
  { name: "Main hall", labels: Array.from({ length: 32 }, (_, i) => String(i + 1)), seats: [4, 4, 2, 2, 6, 4, 6, 4] },
  { name: "Terrace", labels: Array.from({ length: 16 }, (_, i) => String(i + 33)), seats: [4, 2] },
  { name: "Bar", labels: Array.from({ length: 10 }, (_, i) => String(i + 49)), seats: [2] },
  { name: "VIP", labels: Array.from({ length: 6 }, (_, i) => String(i + 59)), seats: [8, 6] },
  { name: "Tabs", labels: Array.from({ length: 6 }, (_, i) => `Tab ${i + 1}`), seats: [2] },
];

const FOOD = "ce0efed29ff1eee3501e4eab"; // a seeded demo menu item (Tapas Downtown)
const MAIN = "c3565ecbf51c58f06221d7d5";

type Plan = { id: string; name: string };
type Table = { id: string; label: string };

function todayAt(h: number, m: number) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

async function order(who: "waiter" | "supervisor", tableId: string, lines: string[], send: boolean) {
  const o = await apiCall<{ id: string }>(who, "/pos/orders", "POST", { serviceType: "DINE_IN", tableId });
  for (const menuItemId of lines) await apiCall(who, `/pos/orders/${o.id}/items`, "POST", { menuItemId, quantity: 1 });
  if (send) await apiCall(who, `/pos/orders/${o.id}/send`, "POST", {});
}

/**
 * The drawn condition, on the fixture database only: the seeded demo tables are
 * set inactive (not deleted; PATCH isActive false) so only the drawn areas show,
 * and a demo shift that has run for days is closed and a fresh one opened, so the
 * Floor shows no "needs a review" line the drawing does not have.
 */
async function drawnCondition() {
  const drawn = new Set(AREAS.map((a) => a.name));
  const tables = await apiCall<Array<{ id: string; isActive?: boolean; floorPlan?: { name?: string } | null }>>("manager", "/tables");
  for (const t of tables) {
    if (t.isActive !== false && !drawn.has(t.floorPlan?.name ?? "")) await apiCall("manager", `/tables/${t.id}`, "PATCH", { isActive: false });
  }
  const shift = await apiCall<{ id: string; openedAt?: string } | null>("waiter", "/shifts/active").catch(() => null);
  const stale = shift?.openedAt ? Date.now() - new Date(shift.openedAt).getTime() > 8 * 3600_000 : false;
  if (shift && stale) await apiCall("waiter", `/shifts/${shift.id}/close`, "POST", {});
  if (!shift || stale) await apiCall("waiter", "/shifts/open", "POST", {});
}

export async function ensureFloorFixture(): Promise<"made" | "present"> {
  await drawnCondition();
  const plans = await apiCall<Plan[]>("manager", "/floor-plans");
  if (plans.some((p) => p.name === "Main hall")) return "present";

  const byLabel = new Map<string, string>();
  for (const area of AREAS) {
    const plan = await apiCall<Plan>("manager", "/floor-plans", "POST", { name: area.name });
    for (const [i, label] of area.labels.entries()) {
      const t = await apiCall<Table>("manager", "/tables", "POST", {
        label,
        capacity: area.seats[i % area.seats.length],
        floorPlanId: plan.id,
      });
      byLabel.set(label, t.id);
    }
  }
  const id = (label: string) => byLabel.get(label) as string;

  for (const n of ["2", "6", "9", "12", "17"]) await order("waiter", id(n), [FOOD, MAIN], true);
  await order("waiter", id("23"), [FOOD, MAIN, FOOD], false);
  for (const n of ["3", "5", "10", "13", "16", "19", "20", "24", "26", "28", "30"]) await order("supervisor", id(n), [MAIN], true);

  await apiCall("supervisor", "/reservations", "POST", {
    customerName: "Fixture booking A",
    partySize: 6,
    reservationAt: todayAt(20, 0),
    tableId: id("7"),
    source: "PHONE",
  });
  await apiCall("supervisor", "/reservations", "POST", {
    customerName: "Fixture booking B",
    partySize: 4,
    reservationAt: todayAt(20, 30),
    tableId: id("21"),
    source: "PHONE",
  });
  await apiCall("supervisor", `/tables/${id("15")}/status`, "PATCH", { status: "CLEANING" });
  return "made";
}
