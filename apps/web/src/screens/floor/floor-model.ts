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

export type FloorSource = {
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

  const tiles: FloorTile[] = [];
  for (const t of source.tables) {
    if (t.isActive === false || HIDDEN.has(up(t.status))) continue;
    const areaName = t.floorPlan?.name?.trim() || "";
    const base = {
      id: t.id,
      label: (t.label || "").trim() || "Table",
      areaKey: t.floorPlan?.id || t.floorPlanId || NO_AREA,
      areaName: areaName || "Other",
      seats: t.capacity ?? undefined,
    };
    const orders = (ordersByTable.get(t.id) ?? []).slice().sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
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
    const status = up(t.status);
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
  return tiles.sort((a, b) => compareLabels(a.label, b.label));
}

/** The tile's words for each density, as `TableTile` takes them. */
export function tileWords(t: FloorTile) {
  const seats = t.seats ? `${t.seats} seats` : undefined;
  const items = t.waiting ? `${t.waiting} ${t.waiting === 1 ? "item" : "items"}` : undefined;
  const booked = [t.bookedAt, t.party ? `${t.party} guests` : undefined].filter(Boolean).join(" · ") || undefined;
  switch (t.state) {
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

export type FloorArea = { key: string; name: string; count: number };

export function floorAreas(tiles: readonly FloorTile[]): FloorArea[] {
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
