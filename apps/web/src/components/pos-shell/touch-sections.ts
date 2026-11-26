import { terminalSections, type KitSection } from "@/components/kit";

export type TouchRole = "waiter" | "cashier" | "supervisor";

/**
 * The sections each touch role shows today (T1 / U1 part a). The full list
 * per role lives in `kit/sections.ts` (decision R9); a section whose screen is
 * not built yet is left out here, never faked:
 *   waiter      Ready waits for E5 / U4
 *   supervisor  Team waits for U4
 */
const BUILT: Record<TouchRole, readonly string[]> = {
  waiter: ["floor", "reservations", "me"],
  cashier: ["floor", "receipts", "till", "me"],
  supervisor: ["floor", "reservations", "approvals", "me"],
};

export function touchSections(role: TouchRole): readonly KitSection[] {
  const keep = BUILT[role];
  return terminalSections[role].filter((s) => keep.includes(s.key));
}

/** The section a path belongs to: `/cashier/floor?tableId=x` → "floor". */
export function touchSectionKey(role: TouchRole, pathname: string): string {
  const match = touchSections(role).find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return match?.key ?? "";
}
