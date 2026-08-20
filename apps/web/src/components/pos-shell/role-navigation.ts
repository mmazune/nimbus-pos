import { cashierRoutes } from "../../lib/cashier/routes";
import { managerRoutes } from "../../lib/manager/routes";
import { supervisorRoutes } from "../../lib/supervisor/routes";
import { waiterRoutes } from "../../lib/waiter/routes";

import type { OperationalNavItem, OperationalRole } from "./types";

export const operationalRoleNavigation: Record<
  OperationalRole,
  readonly OperationalNavItem[]
> = {
  cashier: cashierRoutes,
  manager: managerRoutes,
  supervisor: supervisorRoutes,
  waiter: waiterRoutes,
};

export function getOperationalRoleNavigation(role: OperationalRole) {
  return operationalRoleNavigation[role];
}

export function isOperationalRouteActive(item: OperationalNavItem, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.href;
}
