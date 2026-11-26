import { terminalSections, type KitSection } from "@/components/kit";

export type TouchRole = "waiter" | "cashier" | "supervisor" | "kitchen";

/**
 * The sections each touch role shows today (T1 / U1 part a). The full list
 * per role lives in `kit/sections.ts` (decision R9); a section whose screen is
 * not built yet is left out here, never faked:
 *   supervisor  Team waits for U4
 *   kitchen     Store waits for its engine (E7)
 * (T5 built the waiter's Ready on T2's ready list, and the kitchen and bar screen.)
 */
const BUILT: Record<TouchRole, readonly string[]> = {
  waiter: ["floor", "reservations", "ready", "me"],
  cashier: ["floor", "receipts", "till", "me"],
  supervisor: ["floor", "reservations", "approvals", "me"],
  kitchen: ["tickets", "done", "sold-out"],
};

export function touchSections(role: TouchRole): readonly KitSection[] {
  const keep = BUILT[role];
  return terminalSections[role].filter((s) => keep.includes(s.key));
}

/** The section a path belongs to: `/cashier/floor?tableId=x` → "floor". */
export function touchSectionKey(role: TouchRole, pathname: string): string {
  // The longest href that matches: /kitchen/done is Done, not Tickets (/kitchen).
  const match = touchSections(role)
    .filter((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.key ?? "";
}
