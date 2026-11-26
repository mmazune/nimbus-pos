import type { OperationalIconName } from "@/components/pos-shell/role-icons";

/**
 * The sections of the bar for each role — the one registry the bars read.
 *
 * Terminal (touch) roles: exactly as decision R9 lists them
 * (docs/direction/01-decisions.md). Phone bars for manager, owner and
 * accountant: as drawn in Nav-Roles, Manager-Phone-Today, Owner-Phone-Today and
 * Accountant-Phone-Costs (R13). No Orders, no Menu.
 *
 * `href` is the route the section will open. Several are new routes that later
 * milestones build (SCREENS.md); U0 does not wire the bar into the app (U1 does).
 */
export type KitSection = {
  key: string;
  label: string;
  icon: OperationalIconName;
  href: string;
};

export type TerminalRole = "waiter" | "cashier" | "supervisor" | "kitchen" | "storeKeeper";
export type PhoneRole = "waiter" | "manager" | "owner" | "accountant";

export const terminalSections: Record<TerminalRole, readonly KitSection[]> = {
  waiter: [
    { key: "floor", label: "Floor", icon: "floor", href: "/waiter/floor" },
    { key: "reservations", label: "Reservations", icon: "reservations", href: "/waiter/reservations" },
    { key: "ready", label: "Ready", icon: "ready", href: "/waiter/ready" },
    { key: "me", label: "Me", icon: "me", href: "/waiter/me" },
  ],
  cashier: [
    { key: "floor", label: "Floor", icon: "floor", href: "/cashier/floor" },
    { key: "receipts", label: "Receipts", icon: "cashierReceipts", href: "/cashier/receipts" },
    { key: "till", label: "Till", icon: "cashierTill", href: "/cashier/till" },
    { key: "me", label: "Me", icon: "me", href: "/cashier/me" },
  ],
  supervisor: [
    { key: "floor", label: "Floor", icon: "floor", href: "/supervisor/floor" },
    { key: "reservations", label: "Reservations", icon: "reservations", href: "/supervisor/reservations" },
    { key: "approvals", label: "Approvals", icon: "approvals", href: "/supervisor/approvals" },
    { key: "team", label: "Team", icon: "staff", href: "/supervisor/team" },
    { key: "me", label: "Me", icon: "me", href: "/supervisor/me" },
  ],
  kitchen: [
    { key: "tickets", label: "Tickets", icon: "tickets", href: "/kitchen" },
    { key: "done", label: "Done", icon: "done", href: "/kitchen/done" },
    { key: "sold-out", label: "Sold out", icon: "soldOut", href: "/kitchen/sold-out" },
    { key: "store", label: "Store", icon: "store", href: "/kitchen/store" },
  ],
  storeKeeper: [
    { key: "requests", label: "Requests", icon: "requests", href: "/store/requests" },
    { key: "stock", label: "Stock", icon: "stock", href: "/store/stock" },
    { key: "receive", label: "Receive", icon: "receive", href: "/store/receive" },
    { key: "count", label: "Count", icon: "count", href: "/store/count" },
    { key: "me", label: "Me", icon: "me", href: "/store/me" },
  ],
};

export const phoneSections: Record<PhoneRole, readonly KitSection[]> = {
  waiter: terminalSections.waiter,
  manager: [
    { key: "today", label: "Today", icon: "today", href: "/manager/overview" },
    { key: "floor", label: "Floor", icon: "floor", href: "/manager/operations/floor" },
    { key: "approvals", label: "Approvals", icon: "approvals", href: "/manager/approvals" },
    { key: "reports", label: "Reports", icon: "reportsChart", href: "/manager/reports" },
    { key: "more", label: "More", icon: "more", href: "/manager/more" },
  ],
  owner: [
    { key: "today", label: "Today", icon: "today", href: "/owner/today" },
    { key: "branches", label: "Branches", icon: "branch", href: "/owner/branches" },
    { key: "reports", label: "Reports", icon: "reportsChart", href: "/owner/reports" },
    { key: "alerts", label: "Alerts", icon: "alerts", href: "/owner/alerts" },
    { key: "more", label: "More", icon: "more", href: "/owner/more" },
  ],
  accountant: [
    { key: "today", label: "Today", icon: "today", href: "/accounting/today" },
    { key: "costs", label: "Costs", icon: "revenue", href: "/accounting/costs" },
    { key: "purchases", label: "Purchases", icon: "purchases", href: "/accounting/purchases" },
    { key: "reports", label: "Reports", icon: "reportsChart", href: "/accounting/reports" },
    { key: "more", label: "More", icon: "more", href: "/accounting/more" },
  ],
};
