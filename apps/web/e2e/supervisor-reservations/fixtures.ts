import { expect, Page } from "@playwright/test";

import { CFG } from "../supervisor-prompt3/fixtures";

export { CFG, uiLogin, expectNoHorizontalOverflow } from "../supervisor-prompt3/fixtures";

// ── QA data marker ──
// Every synthetic reservation this suite creates is tagged so QA records are
// identifiable and never collide with real data. Contact details are synthetic.
export const P4B_MARKER = "P4B-QA";

type Role = "supervisor" | "waiter" | "cashier";

function h(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Branch-Id": CFG.branchId,
    "Content-Type": "application/json",
  };
}

export async function apiLoginRole(role: Role): Promise<string> {
  const creds = CFG[role];
  const res = await fetch(`${CFG.api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  const json = await res.json();
  return json.accessToken as string;
}

export type QaReservation = {
  id: string;
  reservationNumber?: string;
  customerName: string;
  status: string;
  reservationAt: string;
};

/**
 * Create a synthetic reservation directly via the API (self-contained QA data).
 * `minutesFromNow` positions it relative to now: negative → overdue past time.
 */
export async function apiCreateReservation(options: {
  token: string;
  label: string;
  partySize?: number;
  minutesFromNow?: number;
  tableId?: string;
}): Promise<QaReservation> {
  const at = new Date(Date.now() + (options.minutesFromNow ?? 90) * 60_000).toISOString();
  const body: Record<string, unknown> = {
    customerName: `${P4B_MARKER} ${options.label}`,
    customerPhone: "+256700000000",
    partySize: options.partySize ?? 2,
    reservationAt: at,
    source: "MANUAL",
  };
  if (options.tableId) body.tableId = options.tableId;
  const res = await fetch(`${CFG.api}/api/reservations`, {
    method: "POST",
    headers: h(options.token),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiConfirmReservation(token: string, id: string) {
  await fetch(`${CFG.api}/api/reservations/${id}/confirm`, { method: "PATCH", headers: h(token), body: "{}" });
}

export async function apiSeatReservation(token: string, id: string, tableId: string) {
  await fetch(`${CFG.api}/api/reservations/${id}/seat`, {
    method: "PATCH",
    headers: h(token),
    body: JSON.stringify({ tableId }),
  });
}

export async function apiFirstAvailableTable(token: string): Promise<string> {
  const tables = (await fetch(`${CFG.api}/api/tables`, { headers: h(token) }).then((r) => r.json())) as Array<{
    id: string;
    status: string;
  }>;
  const free = tables.find((t) => String(t.status).toUpperCase() === "AVAILABLE");
  return free ? free.id : CFG.availableTables[0];
}

/** Navigate to the Supervisor Reservations page and wait for the view selector. */
export async function gotoReservations(page: Page) {
  await page.goto("/supervisor/reservations");
  await expect(page.getByRole("tab", { name: /arriving/i })).toBeVisible();
}

/** Open a reservation's detail workspace by its (marked) guest name. */
export async function openReservationByName(page: Page, name: string) {
  // Narrow the current view to the target first — the list can be long, so a page-local
  // search keeps the freshly-created reservation reliably on-screen before we click it.
  const search = page.getByRole("searchbox").first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill(name);
  }
  const row = page.getByRole("button", { name: new RegExp(name, "i") }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: new RegExp(name, "i") })).toBeVisible();
}
