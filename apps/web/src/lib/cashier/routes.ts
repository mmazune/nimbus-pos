import {
  CashRegister,
  Receipt,
  UserCircle,
  ListChecks,
} from "@phosphor-icons/react";

export const cashierRoutes = [
  {
    href: "/cashier/queue",
    label: "Queue",
    icon: ListChecks,
  },
  {
    href: "/cashier/receipts",
    label: "Receipts",
    icon: Receipt,
  },
  {
    href: "/cashier/till",
    label: "Till",
    icon: CashRegister,
  },
  {
    href: "/cashier/me",
    label: "Me",
    icon: UserCircle,
  },
] as const;

