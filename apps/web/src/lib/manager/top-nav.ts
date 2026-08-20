import type { OperationalTopNavGroup, OperationalTopNavMenu } from "@/components/pos-shell/OperationalTopNav";

import { managerRoutes } from "./routes";

type ManagerMenuGroupsByKey = Record<string, readonly OperationalTopNavGroup[] | undefined>;

/**
 * Grouped dropdown submenus per top-level Manager menu (Track B1,
 * `ai/ENTERPRISE_UI_ROADMAP.md` B1(c)). Overview and Me stay direct-action
 * menus with no dropdown, exactly as the roadmap table specifies. Every
 * `available: false` row is an HONEST not-yet state — B1 ships the menu TREE
 * (the labels the roadmap names), not the surfaces themselves; each later
 * phase (B3/B4/B6) replaces its rows with a real page, one at a time. The
 * `available: true` row in each group is today's real M-P1 foundation page,
 * so the surface stays reachable while its tree is honestly incomplete.
 */
const MANAGER_MENU_GROUPS: ManagerMenuGroupsByKey = {
  operations: [
    {
      items: [
        { key: "operations-dashboard", label: "Operations dashboard", href: "/manager/operations", available: true },
      ],
    },
    {
      heading: "Oversight",
      items: [
        { key: "operations-orders", label: "Orders", href: "/manager/operations", available: false, notYetNote: "B3" },
        { key: "operations-tables", label: "Tables", href: "/manager/operations", available: false, notYetNote: "B3" },
        {
          key: "operations-reservations",
          label: "Reservations",
          href: "/manager/operations",
          available: false,
          notYetNote: "B3",
        },
        {
          key: "operations-exceptions",
          label: "Exceptions",
          href: "/manager/operations",
          available: false,
          notYetNote: "B3",
        },
      ],
    },
  ],
  staff: [
    {
      items: [{ key: "staff-dashboard", label: "Staff dashboard", href: "/manager/staff", available: true }],
    },
    {
      heading: "Administration",
      items: [
        { key: "staff-directory", label: "Directory", href: "/manager/staff", available: false, notYetNote: "B3" },
        { key: "staff-onboarding", label: "Onboarding", href: "/manager/staff", available: false, notYetNote: "B3" },
        { key: "staff-attendance", label: "Attendance", href: "/manager/staff", available: false, notYetNote: "B3" },
        { key: "staff-leave", label: "Leave", href: "/manager/staff", available: false, notYetNote: "B3" },
        {
          key: "staff-shift-swaps",
          label: "Shift swaps",
          href: "/manager/staff",
          available: false,
          notYetNote: "B3",
        },
      ],
    },
  ],
  reports: [
    {
      items: [{ key: "reports-dashboard", label: "Reports dashboard", href: "/manager/reports", available: true }],
    },
    {
      heading: "Reporting",
      items: [
        { key: "reports-catalog", label: "Catalog", href: "/manager/reports", available: false, notYetNote: "B4" },
        { key: "reports-runs", label: "Report runs", href: "/manager/reports", available: false, notYetNote: "B4" },
      ],
    },
  ],
  settings: [
    {
      items: [{ key: "settings-dashboard", label: "Settings dashboard", href: "/manager/settings", available: true }],
    },
    {
      heading: "Configuration",
      items: [
        {
          key: "settings-branch-profile",
          label: "Branch profile",
          href: "/manager/settings",
          available: false,
          notYetNote: "B6",
        },
        { key: "settings-devices", label: "Devices", href: "/manager/settings", available: false, notYetNote: "B6" },
        { key: "settings-printers", label: "Printers", href: "/manager/settings", available: false, notYetNote: "B6" },
        {
          key: "settings-terminals",
          label: "Terminals",
          href: "/manager/settings",
          available: false,
          notYetNote: "B6",
        },
        { key: "settings-alerts", label: "Alerts", href: "/manager/settings", available: false, notYetNote: "B6" },
        { key: "settings-sync", label: "Sync", href: "/manager/settings", available: false, notYetNote: "B6" },
      ],
    },
  ],
};

/**
 * Derived from `managerRoutes` (the single locked six-surface source of
 * truth) — never a second hand-maintained list. If `managerRoutes` ever
 * changes, this tree changes with it automatically for Overview/Me; a new
 * grouped surface needs a `MANAGER_MENU_GROUPS` entry keyed by its route
 * segment.
 */
export const managerTopNavMenus: readonly OperationalTopNavMenu[] = managerRoutes.map((route) => {
  const key = route.href.replace("/manager/", "");
  const groups = MANAGER_MENU_GROUPS[key];

  if (!groups) {
    // Overview and Me: direct-action menus, no dropdown (roadmap B1(c)).
    return { key, label: route.label, href: route.href, match: route.match };
  }

  return { key, label: route.label, groups };
});
