import {
  CalendarCheck,
  GridFour,
  ListChecks,
  ShieldCheck,
  UserCircle,
} from "@phosphor-icons/react";

export const supervisorRoutes = [
  {
    href: "/supervisor/floor",
    label: "Floor",
    icon: GridFour,
  },
  {
    href: "/supervisor/orders",
    label: "Orders",
    icon: ListChecks,
  },
  {
    href: "/supervisor/reservations",
    label: "Reservations",
    icon: CalendarCheck,
  },
  {
    href: "/supervisor/approvals",
    label: "Approvals",
    icon: ShieldCheck,
  },
  {
    href: "/supervisor/me",
    label: "Me",
    icon: UserCircle,
  },
] as const;

