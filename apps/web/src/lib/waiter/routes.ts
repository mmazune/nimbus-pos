import { CalendarCheck, List as ListIcon, SquaresFour, UserCircle } from "@phosphor-icons/react";

export const waiterRoutes = [
  {
    href: "/waiter/floor",
    label: "Floor",
    icon: SquaresFour,
  },
  {
    href: "/waiter/orders",
    label: "Orders",
    icon: ListIcon,
    iconSize: 44,
  },
  {
    href: "/waiter/reservations",
    label: "Reservations",
    icon: CalendarCheck,
  },
  {
    href: "/waiter/me",
    label: "Me",
    icon: UserCircle,
  },
] as const;
