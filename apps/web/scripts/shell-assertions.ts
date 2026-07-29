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
assert(operationalIconSizes.bottomNavigation === 24, "bottom navigation icon size is centralized at 24px");

const { waiter, cashier, supervisor } = operationalRoleNavigation;
assert(labels(waiter) === "Floor,Reservations,Me", "Waiter labels remain Floor, Reservations, Me");
assert(labels(cashier) === "Queue,Receipts,Till,Me", "Cashier approved labels remain intact");
assert(labels(supervisor) === "Floor,Reservations,Approvals,Me", "Supervisor has exactly four approved labels");
assert(supervisor.length === 4, "Supervisor route count is four");
assert(!supervisor.some((item) => item.href === "/supervisor/orders" || item.label === "Orders"), "Orders is absent from Supervisor navigation");

assertUniqueDestinations(waiter, "Waiter");
assertUniqueDestinations(cashier, "Cashier");
assertUniqueDestinations(supervisor, "Supervisor");

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

console.log("Shell assertions passed: icons, role labels/counts, unique destinations, matching, legacy redirect context, and fixed offsets.");
