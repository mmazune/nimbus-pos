import { operationalIconNames } from "../../components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../../components/pos-shell/types";

/**
 * Cashier visible navigation (Prompt C1 — Floor-first).
 *
 * Exactly three items: Floor / Till / Me. Floor uses the SAME canonical `floor`
 * icon (SquaresFour) as Waiter and Supervisor for cross-role parity, landing on
 * the shared `OperationalFloor` at `/cashier/floor` (the default route).
 *
 * Queue and Receipts are intentionally REMOVED from visible navigation. Their
 * pages remain reachable by direct URL as hidden compatibility routes (see
 * `CASHIER_COMPATIBILITY_ROUTES` in `./floor-route.ts`) until their capabilities
 * migrate onto Floor / Find bill (Receipts → C4, Queue → C5). They are NOT
 * redirected in C1.
 */
export const cashierRoutes = [
  {
    href: "/cashier/floor",
    label: "Floor",
    icon: operationalIconNames.floor,
    match: (pathname: string) => pathname === "/cashier/floor",
  },
  {
    href: "/cashier/till",
    label: "Till",
    icon: operationalIconNames.cashierTill,
    match: (pathname: string) => pathname === "/cashier/till",
  },
  {
    href: "/cashier/me",
    label: "Me",
    icon: operationalIconNames.me,
    match: (pathname: string) => pathname === "/cashier/me",
  },
] as const satisfies readonly OperationalNavItem[];
