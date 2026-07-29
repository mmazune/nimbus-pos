import { operationalIconNames } from "../../components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../../components/pos-shell/types";

export const waiterRoutes = [
  {
    href: "/waiter/floor",
    label: "Floor",
    icon: operationalIconNames.floor,
    match: (pathname: string) => pathname === "/waiter/floor" || pathname.startsWith("/waiter/orders"),
  },
  {
    href: "/waiter/reservations",
    label: "Reservations",
    icon: operationalIconNames.reservations,
    match: (pathname: string) => pathname === "/waiter/reservations",
  },
  {
    href: "/waiter/me",
    label: "Me",
    icon: operationalIconNames.me,
    match: (pathname: string) => pathname === "/waiter/me",
  },
] as const satisfies readonly OperationalNavItem[];
