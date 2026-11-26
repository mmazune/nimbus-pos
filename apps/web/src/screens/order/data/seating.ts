/**
 * Tables and people (T2 E3): move, join and split again, move a line, the four bill splits,
 * change waiter, hand-overs and tabs. Each call is T2's locked route; nothing is decided here.
 */
import { apiRequest } from "@/lib/api/client";

import { toMinor, type Minor } from "./money";

type Ctx = { token: string; branchId: string };

export async function moveTable(ctx: Ctx, tableId: string, toTableId: string) {
  return apiRequest(`/api/tables/${tableId}/move`, { ...ctx, method: "POST", body: { toTableId } });
}

/** `otherId`'s bill joins this table's bill (one bill on `hostId`). */
export async function joinTables(ctx: Ctx, hostId: string, otherId: string) {
  return apiRequest(`/api/tables/${hostId}/join`, { ...ctx, method: "POST", body: { tableId: otherId } });
}

/** Undo a join: `otherId` gets its own bill back. */
export async function splitTables(ctx: Ctx, hostId: string, otherId: string) {
  return apiRequest(`/api/tables/${hostId}/split`, { ...ctx, method: "POST", body: { tableId: otherId } });
}

export async function moveLine(ctx: Ctx, orderId: string, itemId: string, toTableId: string, quantity?: number) {
  return apiRequest<{ toTable?: { label?: string } }>(`/api/pos/orders/${orderId}/lines/${itemId}/move`, {
    ...ctx,
    method: "POST",
    body: { toTableId, ...(quantity ? { quantity } : {}) },
  });
}

/** By guest: one bill per guest, from the guest each line was ordered for. */
export async function splitByGuest(ctx: Ctx, orderId: string) {
  return apiRequest<{ children?: Array<{ guest: number; orderId: string; total: string }> }>(`/api/pos/orders/${orderId}/split-by-guest`, {
    ...ctx,
    method: "POST",
    body: {},
  });
}

/** By item: the picked lines become a second bill on the same table. */
export async function splitByItem(ctx: Ctx, orderId: string, items: Array<{ orderItemId: string; quantity: number }>) {
  return apiRequest(`/api/pos/orders/${orderId}/split-items`, { ...ctx, method: "POST", body: { items } });
}

/** By amount: the shares are recorded for the cashier (the bill stays one bill until paid). */
export async function splitByAmount(ctx: Ctx, orderId: string, amountsMinor: Minor[]) {
  const groups = amountsMinor.map((m, i) => ({ label: `Bill ${i + 1}`, amount: (m / 100).toFixed(2) }));
  return apiRequest(`/api/pos/orders/${orderId}/split-bill`, { ...ctx, method: "POST", body: { mode: "CUSTOM", groups } });
}

export async function splitEvenly(ctx: Ctx, orderId: string, count: number) {
  return apiRequest(`/api/pos/orders/${orderId}/split-bill`, { ...ctx, method: "POST", body: { mode: "EQUAL", count } });
}

/** Even shares in whole shillings; the first share takes what does not divide (Split-Even). */
export function evenShares(totalMinor: Minor, count: number): Minor[] {
  const shillings = Math.round(totalMinor / 100);
  const each = Math.floor(shillings / count);
  const extra = shillings - each * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? each + extra : each) * 100);
}

export async function changeWaiterAt(ctx: Ctx, tableId: string, toUserId: string) {
  return apiRequest(`/api/tables/${tableId}/change-waiter`, { ...ctx, method: "POST", body: { toUserId } });
}

export type Handover = {
  id: string;
  status: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  tables: Array<{ id: string; label: string }>;
  createdAt: string | null;
};

type ApiHandover = {
  id: string;
  status?: string;
  fromUserId?: string;
  toUserId?: string;
  fromUser?: { firstName?: string | null; lastName?: string | null } | null;
  toUser?: { firstName?: string | null; lastName?: string | null } | null;
  from?: string | null;
  to?: string | null;
  tables?: Array<{ id: string; label?: string | null }> | null;
  tableIds?: string[] | null;
  tableLabels?: string[] | null;
  createdAt?: string | null;
};

const short = (u?: { firstName?: string | null; lastName?: string | null } | null, fallback?: string | null) => {
  if (fallback) return fallback;
  const f = (u?.firstName ?? "").trim();
  const l = (u?.lastName ?? "").trim();
  return [f, l ? `${l.charAt(0)}.` : ""].filter(Boolean).join(" ") || "A colleague";
};

function mapHandover(h: ApiHandover): Handover {
  const tables = h.tables?.length
    ? h.tables.map((t) => ({ id: t.id, label: (t.label ?? "").trim() || "Table" }))
    : (h.tableIds ?? []).map((id, i) => ({ id, label: h.tableLabels?.[i] ?? "Table" }));
  return {
    id: h.id,
    status: h.status ?? "PENDING",
    fromUserId: h.fromUserId ?? "",
    toUserId: h.toUserId ?? "",
    fromName: short(h.fromUser, h.from),
    toName: short(h.toUser, h.to),
    tables,
    createdAt: h.createdAt ?? null,
  };
}

export async function listHandovers(ctx: Ctx): Promise<{ incoming: Handover[]; outgoing: Handover[] }> {
  const res = await apiRequest<{ incoming?: ApiHandover[]; outgoing?: ApiHandover[] }>("/api/handovers", ctx);
  return { incoming: (res.incoming ?? []).map(mapHandover), outgoing: (res.outgoing ?? []).map(mapHandover) };
}

export async function offerHandover(ctx: Ctx, toUserId: string, tables: { tableIds: string[] } | { all: true }) {
  return apiRequest(`/api/handovers`, { ...ctx, method: "POST", body: { toUserId, ...tables } });
}

export async function answerHandover(ctx: Ctx, id: string, answer: "accept" | "decline" | "cancel") {
  return apiRequest(`/api/handovers/${id}/${answer}`, { ...ctx, method: "POST", body: {} });
}

export async function openTab(ctx: Ctx, areaId: string, note?: string) {
  return apiRequest<{ id: string; label?: string; tabNumber?: number }>(`/api/areas/${areaId}/tabs`, {
    ...ctx,
    method: "POST",
    body: note?.trim() ? { note: note.trim() } : {},
  });
}

/** Colleagues holding tables now, from the open orders a waiter may read (no staff list is readable to a waiter). */
export type Colleague = { userId: string; name: string; tables: number; openMinor: Minor };

export async function colleaguesOnFloor(ctx: Ctx, meId: string | null): Promise<Colleague[]> {
  type Row = { userId?: string | null; tableId?: string | null; total?: string | number | null; user?: { id?: string; firstName?: string | null; lastName?: string | null } | null };
  const res = await apiRequest<{ data?: Row[] }>("/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=500", ctx);
  const by = new Map<string, Colleague & { tableIds: Set<string> }>();
  for (const o of res.data ?? []) {
    const id = o.userId ?? o.user?.id;
    if (!id || id === meId) continue;
    const c = by.get(id) ?? { userId: id, name: short(o.user), tables: 0, openMinor: 0, tableIds: new Set<string>() };
    if (o.tableId) c.tableIds.add(o.tableId);
    c.openMinor += toMinor(o.total) ?? 0;
    c.tables = c.tableIds.size;
    by.set(id, c);
  }
  return [...by.values()].map(({ tableIds: _t, ...c }) => c).sort((a, b) => a.name.localeCompare(b.name));
}
