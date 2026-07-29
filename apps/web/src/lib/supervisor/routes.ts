import { operationalIconNames } from "../../components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../../components/pos-shell/types";

export const supervisorRoutes = [
  {
    href: "/supervisor/floor",
    label: "Floor",
    icon: operationalIconNames.floor,
    match: (pathname: string) => pathname === "/supervisor/floor",
  },
  {
    href: "/supervisor/reservations",
    label: "Reservations",
    icon: operationalIconNames.reservations,
    match: (pathname: string) => pathname === "/supervisor/reservations",
  },
  {
    href: "/supervisor/approvals",
    label: "Approvals",
    icon: operationalIconNames.approvals,
    match: (pathname: string) => pathname === "/supervisor/approvals",
  },
  {
    href: "/supervisor/me",
    label: "Me",
    icon: operationalIconNames.me,
    match: (pathname: string) => pathname === "/supervisor/me",
  },
] as const satisfies readonly OperationalNavItem[];
