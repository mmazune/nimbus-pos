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

/**
 * The kit Reservations screen (T1, 26 Nov 2026) shows a guest as "P. Confirm 123"
 * (first initial, then the rest), as the drawing does.
 */
export function shownName(name: string): string {
  return name.trim().replace(/^(\S)\S*\s+/, "$1. ");
}

/** Open a reservation's side panel by its (marked) guest name. */
export async function openReservationByName(page: Page, name: string) {
  const shown = shownName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const row = page.getByRole("button", { name: new RegExp(shown, "i") }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: new RegExp(shown, "i") })).toBeVisible();
}

/**
 * T1 (26 Nov 2026): the kit Reservations screen offers only tables that are free
 * now and seat the party. A test that seats creates its own free QA table through
 * the manager's API (no password is written here: it reuses the configured one).
 */
export async function apiCreateQaTable(capacity = 4): Promise<{ id: string; label: string }> {
  const login = await fetch(`${CFG.api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.PW_MANAGER_EMAIL || "manager@nimbus.demo",
      password: process.env.PW_MANAGER_PASSWORD || CFG.supervisor.password,
    }),
  }).then((r) => r.json());
  const label = `QA ${Date.now().toString(36).slice(-5)}`;
  const res = await fetch(`${CFG.api}/api/tables`, {
    method: "POST",
    headers: h(login.accessToken),
    body: JSON.stringify({ label, capacity }),
  });
  return res.json();
}
