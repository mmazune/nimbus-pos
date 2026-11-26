/**
 * The kitchen and bar screen's data (T2 E5 tickets, E2 availability).
 *   tickets      GET /api/kds/queue (each ticket's lines, voided lines kept and flagged, allergies)
 *   Ready        POST /api/kds/tickets/:id/mark-ready · bring back: POST /api/kds/tickets/:id/recall
 *   sold out     POST /api/menu/items/:id/sold-out · back on: …/available · a number: PUT …/left
 * A chef works the kitchen, cold kitchen and dessert stations; a bartender the bar (T2's rule;
 * the server refuses anything else with NOT_YOUR_STATION).
 */
import { apiRequest } from "@/lib/api/client";

type Ctx = { token: string; branchId: string };

export const CHEF_STATIONS = ["KITCHEN", "COLD_KITCHEN", "DESSERT"] as const;
export const BAR_STATIONS = ["BAR"] as const;

export type KitchenLine = {
  id: string;
  orderItemId: string;
  quantity: number;
  name: string;
  menuItemId: string;
  serving: string | null;
  notes: string | null;
  allergy: string | null;
  takeaway: boolean;
  voided: boolean;
  voidedAt: string | null;
};

export type KitchenTicket = {
  id: string;
  orderId: string;
  table: string | null;
  serviceType: string | null;
  station: string;
  status: "QUEUED" | "READY" | "RECALLED" | string;
  allergies: string[];
  startedAt: string;
  createdAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  recalledAt: string | null;
  amberAt: number;
  redAt: number;
  lines: KitchenLine[];
};

type ApiTicket = {
  id: string;
  orderId: string;
  table?: { label?: string | null } | null;
  serviceType?: string | null;
  station: string;
  status: string;
  allergies?: string[] | null;
  startedAt: string;
  createdAt: string;
  readyAt?: string | null;
  collectedAt?: string | null;
  recalledAt?: string | null;
  amberAtSeconds?: number;
  redAtSeconds?: number;
  items?: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    menuItemName: string;
    menuItemId: string;
    serving?: { label?: string | null; format?: string | null } | null;
    notes?: string | null;
    allergy?: string | null;
    takeaway?: boolean | null;
    voided?: boolean;
    voidedAt?: string | null;
  }> | null;
};

function mapTicket(t: ApiTicket): KitchenTicket {
  return {
    id: t.id,
    orderId: t.orderId,
    table: t.table?.label?.trim() || null,
    serviceType: t.serviceType ?? null,
    station: t.station,
    status: t.status,
    allergies: t.allergies ?? [],
    startedAt: t.startedAt,
    createdAt: t.createdAt,
    readyAt: t.readyAt ?? null,
    collectedAt: t.collectedAt ?? null,
    recalledAt: t.recalledAt ?? null,
    amberAt: t.amberAtSeconds ?? 600,
    redAt: t.redAtSeconds ?? 1200,
    lines: (t.items ?? []).map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      quantity: i.quantity,
      name: i.menuItemName,
      menuItemId: i.menuItemId,
      serving: i.serving?.label && i.serving.label.toLowerCase() !== "standard" ? i.serving.label : null,
      notes: i.notes?.trim() || null,
      allergy: i.allergy?.trim() || null,
      takeaway: Boolean(i.takeaway),
      voided: Boolean(i.voided),
      voidedAt: i.voidedAt ?? null,
    })),
  };
}

/** One page of tickets for the stations, oldest first (the drawing's order; the API ranks red first). */
export async function loadTickets(ctx: Ctx, stations: readonly string[], status?: "READY"): Promise<KitchenTicket[]> {
  const all: KitchenTicket[] = [];
  for (const station of stations) {
    const res = await apiRequest<{ data?: ApiTicket[] }>(`/api/kds/queue?station=${station}${status ? `&status=${status}` : ""}&pageSize=100`, ctx);
    all.push(...(res.data ?? []).map(mapTicket));
  }
  return all.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
}

export async function markReady(ctx: Ctx, ticketId: string) {
  return apiRequest(`/api/kds/tickets/${ticketId}/mark-ready`, { ...ctx, method: "POST", body: {} });
}

export async function bringBack(ctx: Ctx, ticketId: string) {
  return apiRequest(`/api/kds/tickets/${ticketId}/recall`, { ...ctx, method: "POST", body: {} });
}

export async function markSoldOut(ctx: Ctx, menuItemId: string) {
  return apiRequest(`/api/menu/items/${menuItemId}/sold-out`, { ...ctx, method: "POST", body: {} });
}

export async function markAvailable(ctx: Ctx, menuItemId: string) {
  return apiRequest(`/api/menu/items/${menuItemId}/available`, { ...ctx, method: "POST", body: {} });
}

export async function setLeft(ctx: Ctx, menuItemId: string, left: number) {
  return apiRequest(`/api/menu/items/${menuItemId}/left`, { ...ctx, method: "PUT", body: { left } });
}

/** "26 min" since a moment; the colour of a ticket by its age against the station's limits. */
export function ageOf(ticket: Pick<KitchenTicket, "startedAt" | "amberAt" | "redAt">, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(ticket.startedAt).getTime()) / 1000));
  const tone: "green" | "amber" | "red" = seconds >= ticket.redAt ? "red" : seconds >= ticket.amberAt ? "amber" : "green";
  return { minutes: Math.floor(seconds / 60), tone };
}

/** What to make now: every live line on the open tickets, summed by item and measure, most first. */
export function toMakeNow(tickets: readonly KitchenTicket[]) {
  const sum = new Map<string, { name: string; quantity: number }>();
  for (const t of tickets) {
    if (t.status === "READY") continue;
    for (const l of t.lines) {
      if (l.voided) continue;
      const name = l.serving ? `${l.name}, ${l.serving.toLowerCase()}` : l.name;
      const cur = sum.get(name) ?? { name, quantity: 0 };
      cur.quantity += l.quantity;
      sum.set(name, cur);
    }
  }
  return [...sum.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export const tableWord = (label: string | null, serviceType?: string | null) =>
  !label ? (serviceType === "TAKEAWAY" ? "Takeaway" : "No table") : /^\d+$/.test(label) ? `Table ${label}` : label;

export const hhmm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Kampala" }).format(new Date(iso)) : "";
