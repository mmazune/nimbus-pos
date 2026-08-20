import { readFileSync } from "fs";
import { join } from "path";

import { operationalShellLayout } from "../src/components/pos-shell/layout";
import {
  isOperationalRouteActive,
  operationalRoleNavigation,
} from "../src/components/pos-shell/role-navigation";
import {
  operationalIconNames,
  operationalIconSizes,
} from "../src/components/pos-shell/role-icon-config";
import type { OperationalNavItem } from "../src/components/pos-shell/types";
import {
  buildSupervisorFloorContextQuery,
  firstLegacyQueryValue,
} from "../src/lib/supervisor/legacy-orders-route";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Shell assertion failed: ${message}`);
}

function labels(items: readonly OperationalNavItem[]) {
  return items.map((item) => item.label).join(",");
}

function assertUniqueDestinations(items: readonly OperationalNavItem[], role: string) {
  assert(new Set(items.map((item) => item.href)).size === items.length, `${role} destinations are unique`);
}

const requiredIcons = [
  "floor",
  "reservations",
  "approvals",
  "me",
  "back",
  "search",
  "close",
  "refresh",
  "logout",
  "branch",
  "workstation",
  "serviceArea",
  "time",
  "warning",
  "success",
  "table",
] as const;

const iconRegistrySource = readFileSync(
  join(process.cwd(), "apps/web/src/components/pos-shell/role-icons.ts"),
  "utf8",
);
requiredIcons.forEach((name) => assert(iconRegistrySource.includes(`${name}:`), `icon registry contains ${name}`));
assert(iconRegistrySource.includes("floor: SquaresFour"), "Floor uses the canonical SquaresFour icon");
// Density pass (owner-approved 2026-08-20): the canonical bottom-nav icon size moved
// 24px -> 20px in role-icon-config.ts. The assertion still guards centralization, at
// the new canonical value.
assert(operationalIconSizes.bottomNavigation === 20, "bottom navigation icon size is centralized at 20px");

const { waiter, cashier, supervisor, manager } = operationalRoleNavigation;
assert(labels(waiter) === "Floor,Reservations,Me", "Waiter labels remain Floor, Reservations, Me");
assert(labels(cashier) === "Floor,Till,Me", "Cashier labels are Floor, Till, Me (Prompt C1 Floor-first)");
assert(cashier.length === 3, "Cashier route count is three");
assert(!cashier.some((item) => item.label === "Queue" || item.href === "/cashier/queue"), "Queue is absent from Cashier navigation");
assert(!cashier.some((item) => item.label === "Receipts" || item.href === "/cashier/receipts"), "Receipts is absent from Cashier navigation");
assert(cashier[0].href === "/cashier/floor", "Cashier default nav item is Floor at /cashier/floor");
assert(cashier[0].icon === operationalIconNames.floor, "Cashier Floor consumes the shared Floor icon name");
assert(cashier[0].icon === waiter[0].icon && cashier[0].icon === supervisor[0].icon, "All three roles' Floor tab share one icon definition");
assert(labels(supervisor) === "Floor,Reservations,Approvals,Me", "Supervisor has exactly four approved labels");
assert(supervisor.length === 4, "Supervisor route count is four");
assert(!supervisor.some((item) => item.href === "/supervisor/orders" || item.label === "Orders"), "Orders is absent from Supervisor navigation");

assertUniqueDestinations(waiter, "Waiter");
assertUniqueDestinations(cashier, "Cashier");
assertUniqueDestinations(supervisor, "Supervisor");
// Manager joined the shared shell in M-P1 (2026-08-20) as the fourth registry consumer.
assertUniqueDestinations(manager, "Manager");
assert(labels(manager) === "Overview,Operations,Staff,Reports,Settings,Me", "Manager has exactly six approved labels");
assert(manager.length === 6, "Manager route count is six");
assert(Object.keys(operationalRoleNavigation).length === 4, "the shared nav registry serves exactly four roles");
assert(manager[5].icon === waiter[2].icon, "Manager Me shares the canonical me icon with the other roles");

assert(isOperationalRouteActive(waiter[0], "/waiter/floor"), "Waiter Floor is active on Floor");
assert(isOperationalRouteActive(waiter[0], "/waiter/orders/order-1"), "Waiter contextual order routes keep Floor active");
assert(isOperationalRouteActive(supervisor[2], "/supervisor/approvals"), "Supervisor Approvals matches explicitly");
assert(!supervisor.some((item) => isOperationalRouteActive(item, "/supervisor/orders")), "legacy Orders route activates no tab");
assert(supervisor[0].icon === operationalIconNames.floor, "Supervisor Floor consumes the shared Floor icon name");
assert(waiter[0].icon === supervisor[0].icon, "Waiter and Supervisor Floor share one icon definition");
assert(waiter[1].icon === supervisor[1].icon, "Waiter and Supervisor Reservations share one icon definition");

assert(firstLegacyQueryValue(["table-1", "table-2"]) === "table-1", "legacy array query uses the first value");
assert(
  JSON.stringify(buildSupervisorFloorContextQuery({ tableId: "table-1" })) === JSON.stringify({ tableId: "table-1" }),
  "legacy tableId redirects to Floor unchanged",
);
assert(
  JSON.stringify(buildSupervisorFloorContextQuery({ orderId: "order-1" }, "table-2"))
    === JSON.stringify({ tableId: "table-2", orderId: "order-1" }),
  "legacy orderId preserves order context and resolved table",
);
assert(
  JSON.stringify(buildSupervisorFloorContextQuery({ orderId: "order-tableless" }, null))
    === JSON.stringify({ orderId: "order-tableless" }),
  "tableless order lookup context is not discarded",
);

assert(
  operationalShellLayout.contentTopPaddingPx > operationalShellLayout.headerHeightPx + operationalShellLayout.readinessHeightPx,
  "content top padding clears the fixed header and readiness strip",
);
assert(
  operationalShellLayout.contentBottomClearancePx > operationalShellLayout.bottomNavigationHeightPx,
  "content bottom clearance exceeds fixed bottom navigation height",
);
assert(operationalShellLayout.maxContentWidthPx === 1600, "all roles share the 1600px maximum content width");

console.log("Shell assertions passed: icons, role labels/counts (four roles), unique destinations, matching, legacy redirect context, and fixed offsets.");
