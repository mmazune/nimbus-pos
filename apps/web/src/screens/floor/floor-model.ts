import type { TableState } from "@/components/kit";

/**
 * The Floor's own reading of today's data (T1 / U1 parts b and c).
 *
 * Every role already loads the same three things — `/api/tables`,
 * `/api/pos/orders` (open ones) and `/api/reservations` — so the Floor takes
 * them raw and decides, in one place, what each tile says. A tile never shows
 * something the data does not hold: guests on an open table, "Late", "Bill"
 * and "Ready" have no source today and are left out (see the T1 report).
 */

export type FloorTableApi = {
  id: string;
  label?: string | null;
  capacity?: number | null;
  status?: string | null;
  isActive?: boolean | null;
  floorPlanId?: string | null;
  floorPlan?: { id?: string | null; name?: string | null } | null;
};

export type FloorOrderApi = {
  id: string;
  tableId?: string | null;
  userId?: string | null;
  status?: string | null;
  total?: string | number | null;
  createdAt?: string | null;
  items?: readonly unknown[] | null;
  user?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
};

export type FloorReservationApi = {
  id: string;
  tableId?: string | null;
  table?: { id?: string | null } | null;
  status?: string | null;
  reservationAt?: string | null;
  partySize?: number | null;
};

/** `GET /api/areas` (T2): the branch's areas, in the manager's order, with their tables. */
export type FloorAreaApi = {
  id: string;
  name: string;
  kind?: "TABLES" | "TABS" | string | null;
  sortOrder?: number | null;
  tables?: ReadonlyArray<{ id: string; label?: string | null; isTab?: boolean | null; tabNote?: string | null; joinedToTableId?: string | null }> | null;
};

/** `GET /api/floor/state` (T2): each table's state, derived on the server, never written. */
export type FloorStateApi = {
  at?: string;
  tables?: ReadonlyArray<{
    tableId: string;
    state: "LATE" | "READY" | "NOT_SENT" | "SENT" | "OPEN" | "JOINED" | "FREE" | string;
    joinedToTableId?: string | null;
    counts?: { notSent?: number; held?: number; ready?: number; late?: number; tickets?: number } | null;
  }> | null;
};

export type FloorSource = {
  /** When present, tiles take Late, Ready, Not sent and Joined from the server. */
  floorState?: FloorStateApi;
  /** When present, areas come from the server; otherwise from each table's floor plan (older data). */
  areas?: readonly FloorAreaApi[];
  tables: readonly FloorTableApi[];
  activeOrders: readonly FloorOrderApi[];
  reservations: readonly FloorReservationApi[];
};

/** How a role reads ownership: the waiter sees "You" and others in grey; cashier and supervisor see names. */
export type FloorViewer = { userId?: string | null; ownership: "waiter" | "names" };

export type FloorTile = {
  id: string;
  label: string;
  areaKey: string;
  areaName: string;
  /** A bar tab (T2): numbered "Tab n", with an optional note. */
  isTab?: boolean;
  tabNote?: string;
  state: TableState;
  mine: boolean;
  /** Open on someone else's name, drawn flat grey (waiter only). */
  others: boolean;
  who?: string;
  /** Grouped shillings, "86,000". */
  amount?: string;
  /** "42 min", "1 h 20". */
  minutes?: string;
  seats?: number;
  /** "20:00" */
  bookedAt?: string;
  party?: number;
  /** Items entered and not sent. */
  waiting?: number;
  /** Tickets ready at the pass, or late in the kitchen (server state). */
  ready?: number;
  late?: number;
  /** "M12": this table's bill is joined onto that table's. */
  joinedTo?: string;
};

const HIDDEN = new Set(["BLOCKED", "UNAVAILABLE", "OUT_OF_SERVICE"]);
const ACTIVE = new Set(["NEW", "SENT", "IN_KITCHEN", "READY", "SERVED"]);
const BOOKED = new Set(["PENDING", "CONFIRMED"]);
export const NO_AREA = "__none";

function up(v: string | null | undefined) {
  return String(v ?? "").toUpperCase();
}

/** "Brian Okello" → "Brian O."; a single word stays as it is. */
export function shortName(user: FloorOrderApi["user"]): string | undefined {
  if (!user) return undefined;
  const full = (user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ")).trim();
  if (!full) return undefined;
  const parts = full.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Shillings as exact cents, from "420100", "420100.5" or 420100. Never a float sum. */
export function toCents(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  const text = String(value).trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(text);
  if (!m) return 0n;
  const cents = BigInt(m[2]) * 100n + BigInt((m[3] ?? "0").padEnd(2, "0"));
  return m[1] === "-" ? -cents : cents;
}

/** 8_600_000n → "86,000"; cents are shown only when there are some. */
export function groupCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rest = abs % 100n;
  return `${neg ? "-" : ""}${whole}${rest ? `.${rest.toString().padStart(2, "0")}` : ""}`;
}

/** 42 → "42 min", 80 → "1 h 20", 65 → "1 h 05". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.max(0, min)} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hhmm(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Natural order: "2" before "10", "TD-02" before "TD-10". */
export function compareLabels(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function buildFloorTiles(source: FloorSource, viewer: FloorViewer, now: Date = new Date()): FloorTile[] {
  const ordersByTable = new Map<string, FloorOrderApi[]>();
  for (const o of source.activeOrders) {
    if (!o.tableId || !ACTIVE.has(up(o.status))) continue;
    const list = ordersByTable.get(o.tableId) ?? [];
    list.push(o);
    ordersByTable.set(o.tableId, list);
  }
  const bookingByTable = new Map<string, { at: Date; party?: number }>();
  for (const r of source.reservations) {
    const tableId = r.tableId || r.table?.id;
    if (!tableId || !BOOKED.has(up(r.status)) || !r.reservationAt) continue;
    const at = new Date(r.reservationAt);
    // Only today's bookings mark a table; a stale booking from another day is not "Reserved" now.
    if (Number.isNaN(at.getTime()) || !sameDay(at, now)) continue;
    const prev = bookingByTable.get(tableId);
    if (!prev || at < prev.at) bookingByTable.set(tableId, { at, party: r.partySize ?? undefined });
  }

  // Server areas (T2): which area each table is in, and whether it is a tab.
  const areaOf = new Map<string, { area: FloorAreaApi; isTab: boolean; tabNote?: string }>();
  for (const a of source.areas ?? []) {
    for (const t of a.tables ?? []) areaOf.set(t.id, { area: a, isTab: Boolean(t.isTab), tabNote: t.tabNote?.trim() || undefined });
  }

  const tiles: FloorTile[] = [];
  for (const t of source.tables) {
    if (t.isActive === false || HIDDEN.has(up(t.status))) continue;
    const inArea = areaOf.get(t.id);
    // With server areas, a table the areas list does not hold is put away (or not yet in an area): not on the floor.
    if (source.areas && !inArea) continue;
    const areaName = inArea?.area.name.trim() || t.floorPlan?.name?.trim() || "";
    const base = {
      id: t.id,
      label: (t.label || "").trim() || "Table",
      areaKey: inArea?.area.id || t.floorPlan?.id || t.floorPlanId || NO_AREA,
      areaName: areaName || "Other",
      seats: inArea?.isTab ? undefined : (t.capacity ?? undefined),
      ...(inArea?.isTab ? { isTab: true, tabNote: inArea.tabNote } : {}),
    };
    const all = (ordersByTable.get(t.id) ?? []).slice().sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
    // An order with nothing on it yet (NEW, no items) does not make a table busy — as the old
    // floor model read it. If the table is marked occupied (a seated booking), it shows open.
    const orders = all.filter((o) => up(o.status) !== "NEW" || (o.items?.length ?? 0) > 0);
    const status = up(t.status);
    if (!orders.length && all.length && status === "OCCUPIED") {
      const oldest = all[0];
      const ownerId = oldest.userId || oldest.user?.id;
      const mine = Boolean(viewer.userId && ownerId === viewer.userId);
      const opened = oldest.createdAt ? new Date(oldest.createdAt) : null;
      tiles.push({
        ...base,
        state: "open",
        mine,
        others: viewer.ownership === "waiter" && !mine,
        who: viewer.ownership === "waiter" && mine ? "You" : shortName(oldest.user),
        minutes: opened && !Number.isNaN(opened.getTime()) ? formatMinutes(Math.floor((now.getTime() - opened.getTime()) / 60000)) : undefined,
      });
      continue;
    }
    if (orders.length) {
      // A table with several open orders: whose, mine and minutes come from the oldest; the amount is the sum.
      const oldest = orders[0];
      const ownerId = oldest.userId || oldest.user?.id;
      const mine = Boolean(viewer.userId && ownerId === viewer.userId);
      const allNew = orders.some((o) => up(o.status) === "NEW");
      const waiting = orders.filter((o) => up(o.status) === "NEW").reduce((n, o) => n + (o.items?.length ?? 0), 0);
      const opened = oldest.createdAt ? new Date(oldest.createdAt) : null;
      const minutes = opened && !Number.isNaN(opened.getTime()) ? formatMinutes(Math.floor((now.getTime() - opened.getTime()) / 60000)) : undefined;
      const sum = orders.reduce((acc, o) => acc + toCents(o.total), 0n);
      const name = shortName(oldest.user);
      tiles.push({
        ...base,
        state: allNew ? "notSent" : "open",
        mine,
        others: viewer.ownership === "waiter" && !mine,
        who: viewer.ownership === "waiter" && mine ? "You" : name,
        amount: sum > 0n ? groupCents(sum) : undefined,
        minutes,
        waiting: allNew ? waiting : undefined,
      });
      continue;
    }
    if (status === "CLEANING") {
      tiles.push({ ...base, state: "cleaning", mine: false, others: false });
      continue;
    }
    if (status === "OCCUPIED") {
      // Marked occupied with no order on it: open, nobody's, no amount.
      tiles.push({ ...base, state: "open", mine: false, others: false });
      continue;
    }
    const booking = bookingByTable.get(t.id);
    if (booking || status === "RESERVED") {
      tiles.push({
        ...base,
        state: "reserved",
        mine: false,
        others: false,
        bookedAt: booking ? hhmm(booking.at) : undefined,
        party: booking?.party,
      });
      continue;
    }
    tiles.push({ ...base, state: "free", mine: false, others: false });
  }
  // The server's state wins where it knows more: Late and Ready from the kitchen, lines not sent
  // on a table already sent, and a table joined onto another (T2 GET /api/floor/state).
  const server = new Map((source.floorState?.tables ?? []).map((t) => [t.tableId, t]));
  const labelOf = new Map(source.tables.map((t) => [t.id, (t.label ?? "").trim()]));
  for (const tile of tiles) {
    const st = server.get(tile.id);
    if (!st) continue;
    const c = st.counts ?? {};
    if (st.state === "LATE") Object.assign(tile, { state: "late", late: c.late ?? undefined });
    else if (st.state === "READY") Object.assign(tile, { state: "ready", ready: c.ready ?? undefined });
    else if (st.state === "NOT_SENT" && tile.state === "open") Object.assign(tile, { state: "notSent", waiting: c.notSent ?? undefined });
    else if (st.state === "JOINED") {
      Object.assign(tile, { state: "joined", joinedTo: st.joinedToTableId ? labelOf.get(st.joinedToTableId) : undefined, amount: undefined, who: undefined });
    }
  }
  return tiles.sort((a, b) => compareLabels(a.label, b.label));
}

/** A tab's note as the tile shows it: whole words up to what a tile holds (the full note is on the tab). */
export function shortNote(note: string, max = 16): string {
  if (note.length <= max) return note;
  const words = note.split(/\s+/);
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  // No dangling little word at the end ("Friday, by" reads as cut).
  out = out.replace(/(\s+(by|at|the|of|near|and|in|on|a|to))+$/i, "");
  return (out || note.slice(0, max)).replace(/[,;:.]+$/, "");
}

/** The tile's words for each density, as `TableTile` takes them. */
export function tileWords(t: FloorTile) {
  const seats = t.seats ? `${t.seats} seats` : undefined;
  const items = t.waiting ? `${t.waiting} ${t.waiting === 1 ? "item" : "items"}` : undefined;
  const booked = [t.bookedAt, t.party ? `${t.party} guests` : undefined].filter(Boolean).join(" · ") || undefined;
  if (t.isTab && t.tabNote && (t.state === "free" || t.state === "open" || t.state === "notSent")) {
    // A tab is found by its note ("Red cap at the bar"), not by seats.
    return { detail: shortNote(t.tabNote), short: t.minutes };
  }
  switch (t.state) {
    case "joined":
      return { detail: t.joinedTo ? `Joined to ${t.joinedTo}` : "Joined", short: t.joinedTo ? `To ${t.joinedTo}` : undefined };
    case "ready":
      return { detail: [t.ready && t.ready > 1 ? `${t.ready} ready` : "At the pass", t.minutes].filter(Boolean).join(" · "), short: t.minutes };
    case "late":
      return { detail: [t.late && t.late > 1 ? `${t.late} late` : "Kitchen late", t.minutes].filter(Boolean).join(" · "), short: t.minutes };
    case "free":
    case "cleaning":
      return { detail: seats, short: seats };
    case "reserved":
      return { detail: booked ?? seats, short: t.bookedAt ?? seats };
    case "notSent":
      return { detail: items ? `${items} not sent` : t.minutes, short: items ?? t.minutes };
    default:
      return { detail: t.minutes, short: t.minutes };
  }
}

export type FloorArea = { key: string; name: string; count: number; tabs?: boolean };

export function floorAreas(tiles: readonly FloorTile[], server?: readonly FloorAreaApi[]): FloorArea[] {
  if (server) {
    // The manager's order; a tabs area shows even when no tab is open, so "New tab" has a home.
    const count = new Map<string, number>();
    for (const t of tiles) count.set(t.areaKey, (count.get(t.areaKey) ?? 0) + 1);
    return server
      .map((a) => ({ key: a.id, name: a.name, count: count.get(a.id) ?? 0, tabs: up(a.kind) === "TABS", order: a.sortOrder ?? 0 }))
      .filter((a) => a.count > 0 || a.tabs)
      .sort((a, b) => Number(a.tabs) - Number(b.tabs) || a.order - b.order || compareLabels(a.name, b.name))
      .map(({ order: _order, ...a }) => a);
  }
  const map = new Map<string, FloorArea>();
  for (const t of tiles) {
    const a = map.get(t.areaKey) ?? { key: t.areaKey, name: t.areaName, count: 0 };
    a.count += 1;
    map.set(t.areaKey, a);
  }
  return [...map.values()].sort((a, b) => (a.key === NO_AREA ? 1 : b.key === NO_AREA ? -1 : compareLabels(a.name, b.name)));
}

export const ROOMY = { h: 108, minW: 136, gap: 12 } as const;
export const COMPACT = { h: 84, minW: 124, gap: 10 } as const;
export const MAX_COLUMNS = 12;

export type FloorLayout = { density: "roomy" | "compact"; columns: number; fits: boolean };

/**
 * Roomy when the area's tables fit the space between header and bar; else
 * compact; else compact and the grid scrolls down (R11). Never sideways.
 */
export function chooseLayout(count: number, width: number, height: number): FloorLayout {
  const cols = (min: number, gap: number) => Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + gap) / (min + gap))));
  const needs = (rows: number, h: number, gap: number) => rows * h + Math.max(0, rows - 1) * gap;
  const rc = cols(ROOMY.minW, ROOMY.gap);
  if (needs(Math.ceil(count / rc), ROOMY.h, ROOMY.gap) <= height) return { density: "roomy", columns: rc, fits: true };
  const cc = cols(COMPACT.minW, COMPACT.gap);
  return { density: "compact", columns: cc, fits: needs(Math.ceil(count / cc), COMPACT.h, COMPACT.gap) <= height };
}

/** Search by number: "4" finds "4", "TD-04", "Table 4"; text finds a label that contains it. */
export function findTables(tiles: readonly FloorTile[], query: string): FloorTile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const digits = /^\d+$/.test(q) ? Number(q) : null;
  return tiles.filter((t) => {
    const label = t.label.toLowerCase();
    if (digits !== null) {
      const nums = label.match(/\d+/g)?.map(Number) ?? [];
      return nums.includes(digits);
    }
    return label.includes(q);
  });
}
