import type { OperationalTopNavGroup, OperationalTopNavMenu } from "@/components/pos-shell/OperationalTopNav";

import { MANAGER_OPERATIONS_ROUTES } from "./operations-route";
import { managerRoutes } from "./routes";
import { MANAGER_STAFF_ROUTES } from "./staff-route";

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
      heading: "Oversight",
      items: [
        {
          key: "operations-orders",
          label: "Orders",
          href: MANAGER_OPERATIONS_ROUTES.orders,
          available: true,
        },
        {
          key: "operations-tables",
          label: "Tables",
          href: MANAGER_OPERATIONS_ROUTES.tables,
          available: true,
        },
        {
          key: "operations-reservations",
          label: "Reservations",
          href: MANAGER_OPERATIONS_ROUTES.reservations,
          available: true,
        },
        {
          // Deferred by B3 with a written reason rather than silently dropped:
          // the owner's B3 scope enumerated Orders, Tables and Reservations only,
          // and the anomaly/exception feed has no assigned phase yet. The tag says
          // "Deferred", not a phase number, because inventing one would be a
          // roadmap claim this phase has no authority to make.
          key: "operations-exceptions",
          label: "Exceptions",
          href: MANAGER_OPERATIONS_ROUTES.orders,
          available: false,
          notYetNote: "Deferred",
        },
      ],
    },
  ],
  staff: [
    {
      heading: "Directory",
      items: [
        {
          key: "staff-directory",
          label: "Directory",
          href: MANAGER_STAFF_ROUTES.directory,
          available: true,
        },
        {
          key: "staff-onboarding",
          label: "Onboard frontline staff",
          href: MANAGER_STAFF_ROUTES.onboarding,
          available: true,
        },
        {
          key: "staff-quick-pin",
          label: "Quick PIN administration",
          href: MANAGER_STAFF_ROUTES.quickPin,
          available: true,
        },
      ],
    },
    {
      heading: "Review",
      items: [
        { key: "staff-leave", label: "Leave requests", href: MANAGER_STAFF_ROUTES.leave, available: true },
        {
          key: "staff-shift-swaps",
          label: "Shift swaps",
          href: MANAGER_STAFF_ROUTES.shiftSwaps,
          available: true,
        },
        {
          // Same reasoning as Exceptions above: `GET /api/hr/attendance` is
          // verified, but it embeds a full PII employee object and it is outside
          // the owner's enumerated B3 scope, so it is deferred with a reason
          // rather than half-built.
          key: "staff-attendance",
          label: "Attendance",
          href: MANAGER_STAFF_ROUTES.directory,
          available: false,
          notYetNote: "Deferred",
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

  // Track B3: grouped menus now carry the route's own `match` too. Without it,
  // `isMenuActive` falls back to exact-href comparison against the menu items,
  // which de-highlights the module the moment a sub-route adds URL state (an
  // order record, a selected employee). `managerRoutes` stays the single source
  // of what "inside this module" means.
  return { key, label: route.label, match: route.match, groups };
});
