import type { PillTone } from "@/components/kit";
import type { SupervisorReservation } from "@/lib/supervisor/reservations";

import { formatMinutes, type FloorTile } from "../floor/floor-model";

/**
 * Reservations, read for the two touch roles (T1 phase 2; drawings
 * Reservations-Waiter and Reservations-Supervisor). Views are groupings of
 * real statuses, never new statuses:
 *   Arriving   PENDING and CONFIRMED, today
 *   Seated     SEATED
 *   Attention  overdue (server flag) or a SEATED booking with no table or order
 *   History    COMPLETED, CANCELLED, NO_SHOW
 * Actions mirror the API's own transitions exactly (lifecycle doc, 4B).
 */
export type ResView = "arriving" | "seated" | "attention" | "history";

export type ResAction = "confirm" | "seat" | "changeTable" | "cancel" | "noShow" | "complete";

const ARRIVING = new Set(["PENDING", "CONFIRMED"]);
export const TERMINAL = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

function up(v: string | null | undefined) {
  return String(v ?? "").toUpperCase();
}

/** "Jane Mukasa" → "J. Mukasa"; one word stays. Guest names live in this screen only, never on a tile. */
export function guestName(r: SupervisorReservation): string {
  const full = (r.customerName ?? "").trim();
  if (!full) return "Guest";
  const parts = full.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(" ")}`;
}

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

export function tableName(r: SupervisorReservation): string | undefined {
  const label = r.table?.label?.trim();
  if (!label) return undefined;
  return /^\d+$/.test(label) ? `Table ${label}` : label;
}

/** A SEATED booking that has lost its table or its order: someone has to look. */
export function seatedProblem(r: SupervisorReservation): string | undefined {
  if (up(r.status) !== "SEATED") return undefined;
  if (!r.tableId) return "Seated with no table";
  if (!r.seatedOrderId) return "Seated with no order";
  const orderStatus = up(r.seatedOrder?.status);
  if (orderStatus === "CLOSED" || orderStatus === "VOIDED") return "Order closed, booking still seated";
  return undefined;
}

export function viewOf(r: SupervisorReservation): ResView {
  const s = up(r.status);
  if (TERMINAL.has(s)) return "history";
  if (s === "SEATED") return "seated";
  return "arriving";
}

export function needsAttention(r: SupervisorReservation): boolean {
  return Boolean(r.overdue) || Boolean(seatedProblem(r));
}

export type ResPill = { tone: PillTone; word: string };

/** The one pill on a row, in the drawing's words. */
export function rowPill(r: SupervisorReservation, bookedTile: FloorTile | undefined, now: Date): ResPill {
  const s = up(r.status);
  if (s === "COMPLETED") return { tone: "green", word: "Completed" };
  if (s === "CANCELLED") return { tone: "neutral", word: "Cancelled" };
  if (s === "NO_SHOW") return { tone: "red", word: "No-show" };
  if (s === "SEATED") {
    const problem = seatedProblem(r);
    if (problem) return { tone: "amber", word: problem };
    const since = r.seatedAt ? Math.floor((now.getTime() - new Date(r.seatedAt).getTime()) / 60000) : null;
    return { tone: "brand", word: since !== null && since >= 0 ? `Seated ${formatMinutes(since)}` : "Seated" };
  }
  if (r.overdue) return { tone: "red", word: `Late ${formatMinutes(r.overdueByMinutes ?? 0)}` };
  if (!r.tableId) return { tone: "amber", word: "Needs a table" };
  if (bookedTile && (bookedTile.state === "open" || bookedTile.state === "notSent")) return { tone: "amber", word: "Table still in use" };
  if (s === "PENDING") return { tone: "neutral", word: "Not confirmed" };
  const at = r.reservationAt ? new Date(r.reservationAt) : null;
  if (!at || Number.isNaN(at.getTime())) return { tone: "neutral", word: "Confirmed" };
  const mins = Math.round((at.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return { tone: "neutral", word: "Due now" };
  return { tone: "neutral", word: `In ${formatMinutes(mins)}` };
}

export function rowLine(r: SupervisorReservation): string {
  const guests = r.partySize ? `${r.partySize} ${r.partySize === 1 ? "guest" : "guests"}` : "";
  const where = tableName(r) ?? "No table yet";
  return [guests, where].filter(Boolean).join(" · ");
}

const SOURCE: Record<string, string> = {
  WALK_IN: "walked in",
  PHONE: "booked by phone",
  WHATSAPP: "booked on WhatsApp",
  INSTAGRAM: "booked on Instagram",
  MANUAL: "booked at the desk",
  OTHER: "booked",
};

export function panelLine(r: SupervisorReservation): string {
  const guests = r.partySize ? `${r.partySize} ${r.partySize === 1 ? "guest" : "guests"}` : "";
  return [hhmm(r.reservationAt), guests, SOURCE[up(r.source)] ?? ""].filter(Boolean).join(" · ");
}

/** What a role may do now: mirrors the API's transitions (PENDING→confirm/cancel/no-show; CONFIRMED→seat/cancel/no-show; SEATED→complete). */
export function actionsFor(r: SupervisorReservation, role: "waiter" | "supervisor"): Set<ResAction> {
  const s = up(r.status);
  const out = new Set<ResAction>();
  if (role === "waiter") {
    if (s === "CONFIRMED") out.add("seat");
    return out;
  }
  if (s === "PENDING") ["confirm", "changeTable", "cancel"].forEach((a) => out.add(a as ResAction));
  if (s === "CONFIRMED") ["seat", "changeTable", "cancel"].forEach((a) => out.add(a as ResAction));
  // No-show only when late, never automatic (decision R-4B).
  if ((s === "PENDING" || s === "CONFIRMED") && r.overdue) out.add("noShow");
  if (s === "SEATED") out.add("complete");
  return out;
}

/** Free tables that seat the party now, the booked one first when it is free. */
export function seatOptions(r: SupervisorReservation, tiles: readonly FloorTile[], limit = 4): FloorTile[] {
  const party = r.partySize ?? 1;
  const free = tiles.filter((t) => t.state === "free" && (t.seats ?? 0) >= party);
  free.sort((a, b) => (a.seats ?? 0) - (b.seats ?? 0) || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const booked = free.find((t) => t.id === r.tableId);
  const rest = free.filter((t) => t.id !== r.tableId);
  return (booked ? [booked, ...rest] : rest).slice(0, limit);
}

export function tileName(t: FloorTile): string {
  return /^\d+$/.test(t.label) ? `Table ${t.label}` : t.label;
}

export function summaryLine(today: readonly SupervisorReservation[]): string {
  const coming = today.filter((r) => ARRIVING.has(up(r.status))).length;
  const late = today.filter((r) => ARRIVING.has(up(r.status)) && r.overdue).length;
  return `Today · ${coming} still to come${late ? ` · ${late} late` : ""}`;
}

/** "2026-11-26" in the device's own day. */
export function isoDay(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-11-26" + "20:30" → ISO instant in the device's zone, or null. */
export function toInstant(day: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  const [y, mo, d] = day.split("-").map(Number);
  const at = new Date(y, mo - 1, d, h, m, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}
