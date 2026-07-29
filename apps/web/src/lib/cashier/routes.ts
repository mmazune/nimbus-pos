import { operationalIconNames } from "../../components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../../components/pos-shell/types";

export const cashierRoutes = [
  {
    href: "/cashier/queue",
    label: "Queue",
    icon: operationalIconNames.cashierQueue,
    match: (pathname: string) => pathname === "/cashier/queue",
  },
  {
    href: "/cashier/receipts",
    label: "Receipts",
    icon: operationalIconNames.cashierReceipts,
    match: (pathname: string) => pathname === "/cashier/receipts",
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
