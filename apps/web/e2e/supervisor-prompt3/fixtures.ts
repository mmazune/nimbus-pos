import { expect, Page } from "@playwright/test";

// ── Config (env-first; defaults target the disposable local demo only) ──
export const CFG = {
  api: process.env.PW_API_URL || "http://localhost:4001",
  branchId: process.env.PW_BRANCH_ID || "cb27be401a2c35dfc0d4e610",
  supervisor: {
    email: process.env.PW_SUPERVISOR_EMAIL || "supervisor@nimbus.demo",
    password: process.env.PW_SUPERVISOR_PASSWORD || "Demo1234!",
  },
  waiter: {
    email: process.env.PW_WAITER_EMAIL || "waiter@nimbus.demo",
    password: process.env.PW_WAITER_PASSWORD || "Demo1234!",
  },
  cashier: {
    email: process.env.PW_CASHIER_EMAIL || "cashier@nimbus.demo",
    password: process.env.PW_CASHIER_PASSWORD || "Demo1234!",
  },
  // Stable demo fixtures (demo-import stableIds).
  menuItemId: "c7dd9d1e70d97821b8979f2d",
  servingStd: "cdf5ec9f54d147ebf47901e2",
  availableTables: [
    "c69d0867ca31edee1d7205e8",
    "c3eb12a6467cbac75ac769ed",
    "c89cdc7be13bb26c869b57a8",
    "cdddfd22710c728cae7ce940",
    "c52a62c04ad624a4ead049b8",
    "c218161f60f5f8adf3dc1288",
    "cceb0572c544845bf8880801",
  ],
};

type Role = "supervisor" | "waiter" | "cashier";

// ── UI login: drives the real login form (password mode). ──
export async function uiLogin(page: Page, role: Role) {
  const creds = CFG[role];
  await page.goto("/login");
  // switch to email/password mode (the toggle is labelled "Email"; default is "Quick PIN")
  await page.getByRole("button", { name: /^email$/i }).click();
  await page.locator('input[name="email"]').fill(creds.email);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // wait until we leave /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

// ── API helpers (self-contained QA data creation) ──
let apiTableIdx = 0;

async function apiLogin(role: Role) {
  const creds = CFG[role];
  const res = await fetch(`${CFG.api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  const json = await res.json();
  return json.accessToken as string;
}

function h(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Branch-Id": CFG.branchId,
    "Content-Type": "application/json",
  };
}

async function pickAvailableTable(token: string): Promise<string> {
  const tables = (await fetch(`${CFG.api}/api/tables`, { headers: h(token) }).then((r) => r.json())) as Array<{
    id: string;
    status: string;
  }>;
  const free = tables.find((t) => String(t.status).toUpperCase() === "AVAILABLE");
  if (free) return free.id;
  // fall back to the static list if the branch is fully occupied
  return CFG.availableTables[apiTableIdx++ % CFG.availableTables.length];
}

/** Creates a DINE_IN order with one line, sends it (→ SENT). Returns {orderId, tableId}. */
export async function apiCreateSentOrder(): Promise<{ orderId: string; tableId: string }> {
  const token = await apiLogin("supervisor");
  const tableId = await pickAvailableTable(token);
  const o = await fetch(`${CFG.api}/api/pos/orders`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ serviceType: "DINE_IN", tableId }),
  }).then((r) => r.json());
  const orderId = o.id as string;
  await fetch(`${CFG.api}/api/pos/orders/${orderId}/items`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({ menuItemId: CFG.menuItemId, menuItemServingId: CFG.servingStd, quantity: 2, notes: "P3D-E2E" }),
  });
  await fetch(`${CFG.api}/api/pos/orders/${orderId}/send`, {
    method: "POST",
    headers: h(token),
    body: JSON.stringify({}),
  });
  return { orderId, tableId };
}

/** Asserts the page body does not overflow horizontally at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return { scrollW: de.scrollWidth, clientW: de.clientWidth };
  });
  // allow 2px tolerance for sub-pixel rounding
  expect(overflow.scrollW, `scrollWidth ${overflow.scrollW} > clientWidth ${overflow.clientW}`).toBeLessThanOrEqual(
    overflow.clientW + 2,
  );
}
